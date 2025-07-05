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

export const useEnhancedInput = (handler: InputHandler) => {
  const handlerRef = useRef(handler);
  const interceptedEvents = useRef<Map<string, number>>(new Map());

  // Update handler ref when it changes
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

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
        
        // Call handler immediately
        handlerRef.current(str || '', enhancedKey);
        
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
    handlerRef.current(inputChar, enhancedKey);
  });
};