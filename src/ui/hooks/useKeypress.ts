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
          // Handle special keys
          if (key.name === 'return' && key.sequence === '\x1B\r') {
            key.meta = true;
          }

          // Detect Shift+Enter combination
          // Shift+Enter typically sends sequence '\r' with shift: true
          // or can be detected by sequence comparison
          if (key.name === 'return' && key.shift) {
            // This is Shift+Enter
            key.name = 'shift+return';
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
