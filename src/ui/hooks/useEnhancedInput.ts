import { useEffect, useRef } from 'react';
import { useInput } from 'ink';
import { stdin } from 'process';
import { emitKeypressEvents } from 'readline';

interface EnhancedKey {
  name?: string;
  sequence?: string;
  backspace: boolean;
  delete: boolean;
  return: boolean;
  escape: boolean;
  leftArrow: boolean;
  rightArrow: boolean;
  upArrow: boolean;
  downArrow: boolean;
  home: boolean;
  end: boolean;
  tab: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

type InputHandler = (inputChar: string, key: EnhancedKey) => void;

// Helper functions for event interception
function shouldInterceptKey(str: string | undefined, _key: any): boolean {
  // Intercept \x7f (DEL character, ASCII 127) - backspace in most terminals
  if (str === '\x7f' || (str && str.charCodeAt(0) === 127)) {
    return true;
  }
  return false;
}

function createEnhancedKeyFromInterception(str: string, key: any): EnhancedKey {
  const enhancedKey: EnhancedKey = {
    name: key?.name,
    sequence: key?.sequence || str,
    backspace: false,
    delete: false,
    return: false,
    escape: false,
    leftArrow: false,
    rightArrow: false,
    upArrow: false,
    downArrow: false,
    home: false,
    end: false,
    tab: false,
    ctrl: key?.ctrl || false,
    meta: key?.meta || false,
    shift: key?.shift || false,
  };

  // Handle intercepted \x7f as backspace
  if (str === '\x7f' || (str && str.charCodeAt(0) === 127)) {
    enhancedKey.backspace = true;
    enhancedKey.delete = false;
    enhancedKey.name = 'backspace';
  }

  return enhancedKey;
}

function createEnhancedKeyFromInk(_inputChar: string, key: any): EnhancedKey {
  // Use Ink's detection as the primary source
  return {
    name: key.name,
    sequence: key.sequence,
    backspace: key.backspace || false,
    delete: key.delete || false,
    return: key.return || false,
    escape: key.escape || false,
    leftArrow: key.leftArrow || false,
    rightArrow: key.rightArrow || false,
    upArrow: key.upArrow || false,
    downArrow: key.downArrow || false,
    home: key.home || false,
    end: key.end || false,
    tab: key.tab || false,
    ctrl: key.ctrl || false,
    meta: key.meta || false,
    shift: key.shift || false,
  };
}

function shouldSkipInkProcessing(_inputChar: string, key: any): boolean {
  // Skip if this looks like a processed version of an intercepted key
  if (key.delete && !key.backspace && !key.name && !key.sequence) {
    return true; // Likely a processed \x7f
  }
  return false;
}

// Helper functions for paste handling
function isPasteOperation(inputChar: string, timeSinceLastInput: number): boolean {
  // Consider it a paste if:
  // 1. Multiple characters received at once, OR
  // 2. Single character but arriving very quickly after another (< 10ms)
  return inputChar.length > 1 || (inputChar.length === 1 && timeSinceLastInput < 10);
}

function isSpecialKey(key: any): boolean {
  return key.return || key.escape || key.backspace || key.delete || 
         key.leftArrow || key.rightArrow || key.upArrow || key.downArrow ||
         key.home || key.end || key.tab || key.ctrl || key.meta;
}

export const useEnhancedInput = (handler: InputHandler) => {
  const handlerRef = useRef(handler);
  const interceptedEvents = useRef<Map<string, number>>(new Map());
  const pasteBuffer = useRef<string>('');
  const pasteTimer = useRef<NodeJS.Timeout | null>(null);
  const lastInputTime = useRef<number>(0);
  const isInPasteMode = useRef<boolean>(false);

  // Update handler ref when it changes
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // Paste handling functions
  const flushPasteBuffer = () => {
    if (pasteBuffer.current) {
      const bufferedContent = pasteBuffer.current;
      pasteBuffer.current = '';
      isInPasteMode.current = false;
      
      // Create a key object indicating this is pasted content
      const pasteKey: EnhancedKey = {
        name: 'paste',
        sequence: bufferedContent,
        backspace: false,
        delete: false,
        return: false,
        escape: false,
        leftArrow: false,
        rightArrow: false,
        upArrow: false,
        downArrow: false,
        home: false,
        end: false,
        tab: false,
        ctrl: false,
        meta: false,
        shift: false,
      };
      
      handlerRef.current(bufferedContent, pasteKey);
    }
  };

  const handlePasteInput = (inputChar: string) => {
    pasteBuffer.current += inputChar;
    
    // Clear existing timer and set a new one
    if (pasteTimer.current) {
      clearTimeout(pasteTimer.current);
    }
    
    // Flush the buffer after a short delay (50ms) to allow for chunked paste content
    pasteTimer.current = setTimeout(() => {
      flushPasteBuffer();
    }, 50);
  };

  const handleNormalInput = (inputChar: string, key: EnhancedKey) => {
    // If we were in paste mode, flush the buffer first
    if (isInPasteMode.current) {
      flushPasteBuffer();
    }
    
    // Process the normal input
    handlerRef.current(inputChar, key);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (pasteTimer.current) {
        clearTimeout(pasteTimer.current);
      }
    };
  }, []);

  // Key interception for specific sequences
  useEffect(() => {
    if (typeof stdin.setRawMode === 'function' && stdin.isTTY) {
      emitKeypressEvents(stdin);
    }

    const handleKeyInterception = (str: string | undefined, key: any) => {
      if (shouldInterceptKey(str, key)) {
        const eventId = `${Date.now()}-${Math.random()}`;
        const enhancedKey = createEnhancedKeyFromInterception(str!, key);
        
        // Record this interception
        interceptedEvents.current.set(eventId, Date.now());
        
        // Use normal input handler for intercepted keys
        handleNormalInput(str || '', enhancedKey);
        
        // Clean up old intercepted events
        setTimeout(() => {
          interceptedEvents.current.delete(eventId);
        }, 100);
      }
    };

    stdin.on('keypress', handleKeyInterception);

    return () => {
      stdin.removeListener('keypress', handleKeyInterception);
      interceptedEvents.current.clear();
    };
  }, []);

  // Use Ink's useInput for non-intercepted keys
  useInput((inputChar: string, key: any) => {
    // Check if this might be an intercepted key
    const recentInterceptions = Array.from(interceptedEvents.current.values())
      .filter(timestamp => Date.now() - timestamp < 50);

    if (recentInterceptions.length > 0 && shouldSkipInkProcessing(inputChar, key)) {
      return; // Skip this event as it was likely intercepted
    }

    // Process with Ink's detected key information
    const enhancedKey = createEnhancedKeyFromInk(inputChar, key);
    
    // Calculate time since last input for paste detection
    const currentTime = Date.now();
    const timeSinceLastInput = currentTime - lastInputTime.current;
    lastInputTime.current = currentTime;
    
    // Handle special keys (non-character input) immediately
    if (isSpecialKey(key)) {
      handleNormalInput(inputChar, enhancedKey);
      return;
    }
    
    // Detect paste operations for character input
    if (inputChar && !key.ctrl && !key.meta) {
      const isPaste = isPasteOperation(inputChar, timeSinceLastInput);
      
      if (isPaste) {
        // Handle as paste operation
        isInPasteMode.current = true;
        handlePasteInput(inputChar);
      } else {
        // Handle as normal character input
        handleNormalInput(inputChar, enhancedKey);
      }
    } else {
      // Handle other input normally
      handleNormalInput(inputChar, enhancedKey);
    }
  });
};