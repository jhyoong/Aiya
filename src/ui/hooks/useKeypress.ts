/** This file is for the annoying backspace bug that's not fixed in Ink. */
import { useEffect, useRef } from 'react';
import { useStdin } from 'ink';
import readline from 'readline';

export interface Key {
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  paste: boolean;
  sequence: string;
}

/**
 * @param onKeypress - The callback function to execute on each keypress.
 * @param options - Options to control the hook's behavior.
 * @param options.isActive - Whether the hook should be actively listening for input.
 */
export function useKeypress(
  onKeypress: (key: Key) => void,
  { isActive }: { isActive: boolean }
) {
  const { stdin, setRawMode } = useStdin();
  const onKeypressRef = useRef(onKeypress);
  
  // State to track Shift+Enter sequence detection
  const shiftEnterStateRef = useRef<{
    expectingReturn: boolean;
    timeout: NodeJS.Timeout | null;
  }>({ expectingReturn: false, timeout: null });

  useEffect(() => {
    onKeypressRef.current = onKeypress;
  }, [onKeypress]);

  useEffect(() => {
    if (!isActive || !stdin.isTTY) {
      return;
    }

    setRawMode(true);

    // Enable bracketed paste mode
    process.stdout.write('\x1b[?2004h');

    const rl = readline.createInterface({ input: stdin });
    let isPaste = false;
    let pasteBuffer = Buffer.alloc(0);

    const handleKeypress = (_: unknown, key: Key) => {
      // Detect bracketed paste sequences by their escape codes
      if (key.sequence === '\x1b[200~') {
        key.name = 'paste-start';
        isPaste = true;
      } else if (key.sequence === '\x1b[201~') {
        key.name = 'paste-end';
        isPaste = false;
        onKeypressRef.current({
          name: '',
          ctrl: false,
          meta: false,
          shift: false,
          paste: true,
          sequence: pasteBuffer.toString(),
        });
        pasteBuffer = Buffer.alloc(0);
      } else if (key.name === 'paste-start') {
        isPaste = true;
      } else if (key.name === 'paste-end') {
        isPaste = false;
        onKeypressRef.current({
          name: '',
          ctrl: false,
          meta: false,
          shift: false,
          paste: true,
          sequence: pasteBuffer.toString(),
        });
        pasteBuffer = Buffer.alloc(0);
      } else {
        if (isPaste) {
          pasteBuffer = Buffer.concat([pasteBuffer, Buffer.from(key.sequence)]);
        } else {
          // Handle Shift+Enter sequence detection for terminals that send it as two events
          const state = shiftEnterStateRef.current;
          
          // Clear any existing timeout
          if (state.timeout) {
            clearTimeout(state.timeout);
            state.timeout = null;
          }

          // Check if this is the first part of Shift+Enter (backslash)
          if (key.sequence === '\\' && !key.name) {
            state.expectingReturn = true;
            // Set timeout to reset state if return doesn't come quickly
            state.timeout = setTimeout(() => {
              state.expectingReturn = false;
              // Send the backslash as regular text since no return followed
              onKeypressRef.current({ ...key, paste: isPaste });
            }, 50); // 50ms should be enough for the sequence
            return; // Don't process this event yet
          }

          // Check if this is the second part of Shift+Enter (return after backslash)
          if (state.expectingReturn && key.name === 'return' && key.sequence === '\r') {
            state.expectingReturn = false;
            // Convert to Shift+Enter
            key.name = 'shift+return';
            key.shift = true;
            onKeypressRef.current({ ...key, paste: isPaste });
            return;
          }

          // Reset state if we get any other key
          if (state.expectingReturn) {
            state.expectingReturn = false;
          }

          // Standard Shift+Enter detection for other terminals
          const isStandardShiftEnter = 
            // Method 1: Direct shift flag detection (most reliable)
            (key.name === 'return' && key.shift) ||
            // Method 2: Common escape sequence for Shift+Enter in many terminals
            (key.sequence === '\x1B\r');

          if (isStandardShiftEnter) {
            key.name = 'shift+return';
            key.shift = true;
          }

          onKeypressRef.current({ ...key, paste: isPaste });
        }
      }
    };

    readline.emitKeypressEvents(stdin, rl);
    stdin.on('keypress', handleKeypress);

    return () => {
      // Disable bracketed paste mode before cleanup
      process.stdout.write('\x1b[?2004l');

      // Clean up Shift+Enter detection timeout
      const state = shiftEnterStateRef.current;
      if (state.timeout) {
        clearTimeout(state.timeout);
        state.timeout = null;
      }

      stdin.removeListener('keypress', handleKeypress);
      rl.close();
      setRawMode(false);

      // If we are in the middle of a paste, send what we have.
      if (isPaste) {
        onKeypressRef.current({
          name: '',
          ctrl: false,
          meta: false,
          shift: false,
          paste: true,
          sequence: pasteBuffer.toString(),
        });
        pasteBuffer = Buffer.alloc(0);
      }
    };
  }, [isActive, stdin, setRawMode]);
}
