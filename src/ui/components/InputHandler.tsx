import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { useEnhancedInput } from '../hooks/useEnhancedInput.js';

interface InputHandlerProps {
  onInput: (input: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  multiline?: boolean;
}

export const InputHandler: React.FC<InputHandlerProps> = ({
  onInput,
  onCancel,
  placeholder = 'Enter your input...',
  multiline = false,
}) => {
  const [input, setInput] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isActive, setIsActive] = useState(true);

  // Keep cursor position in sync with input length
  React.useEffect(() => {
    if (cursorPosition > input.length) {
      setCursorPosition(input.length);
    }
  }, [input.length, cursorPosition]);

  const sanitizePastedContent = (content: string, multiline: boolean): string => {
    if (multiline) {
      // Preserve newlines in multiline mode
      return content.replace(/[\x00-\x1F\x7F]/g, '').replace(/[\r\n]/g, '\n');
    } else {
      // Convert to single line
      return content
        .replace(/[\r\n]/g, ' ')
        .replace(/[\x00-\x1F\x7F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
  };

  useEnhancedInput((inputChar: string, key: any) => {
    if (!isActive) return;

    if (key.escape) {
      onCancel?.();
      return;
    }

    if (key.return) {
      if (multiline && !key.ctrl) {
        // Insert newline at cursor position in multiline mode
        const newInput = input.slice(0, cursorPosition) + '\n' + input.slice(cursorPosition);
        setInput(newInput);
        setCursorPosition(prev => prev + 1);
        return;
      }
      onInput(input);
      setInput('');
      setCursorPosition(0);
      setIsActive(false);
      return;
    }

    // Arrow key navigation
    if (key.leftArrow) {
      setCursorPosition(prev => Math.max(0, prev - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorPosition(prev => Math.min(input.length, prev + 1));
      return;
    }

    // Up/Down arrows for multiline navigation
    if (multiline && key.upArrow) {
      // Move cursor up one line
      const lines = input.slice(0, cursorPosition).split('\n');
      if (lines.length > 1) {
        const currentLinePos = lines[lines.length - 1]?.length || 0;
        const prevLineLength = lines[lines.length - 2]?.length || 0;
        const newPos = cursorPosition - currentLinePos - 1 - (prevLineLength - Math.min(currentLinePos, prevLineLength));
        setCursorPosition(Math.max(0, newPos));
      }
      return;
    }

    if (multiline && key.downArrow) {
      // Move cursor down one line
      const beforeCursor = input.slice(0, cursorPosition);
      const afterCursor = input.slice(cursorPosition);
      const lines = beforeCursor.split('\n');
      const currentLinePos = lines[lines.length - 1]?.length || 0;
      const nextLineIndex = afterCursor.indexOf('\n');
      
      if (nextLineIndex !== -1) {
        const nextLineContent = afterCursor.slice(nextLineIndex + 1);
        const nextLineEnd = nextLineContent.indexOf('\n');
        const nextLineLength = nextLineEnd === -1 ? nextLineContent.length : nextLineEnd;
        const newPos = cursorPosition + nextLineIndex + 1 + Math.min(currentLinePos, nextLineLength);
        setCursorPosition(Math.min(input.length, newPos));
      }
      return;
    }

    // Enhanced navigation
    if ((key.ctrl && inputChar === 'a') || key.home) {
      setCursorPosition(0);
      return;
    }

    if ((key.ctrl && inputChar === 'e') || key.end) {
      setCursorPosition(input.length);
      return;
    }

    // Backspace at cursor position
    if (key.backspace && cursorPosition > 0) {
      const newInput = input.slice(0, cursorPosition - 1) + input.slice(cursorPosition);
      setInput(newInput);
      setCursorPosition(prev => prev - 1);
      return;
    }

    // Delete at cursor position
    if (key.delete && cursorPosition < input.length) {
      const newInput = input.slice(0, cursorPosition) + input.slice(cursorPosition + 1);
      setInput(newInput);
      return;
    }

    if (key.ctrl && inputChar === 'c') {
      onCancel?.();
      return;
    }

    // Handle paste operations (Ctrl+V / Cmd+V)
    if ((key.ctrl || key.meta) && inputChar === 'v') {
      // Paste operation detected - will be handled by next condition
      return;
    }

    // Handle both single characters AND multi-character input (paste)
    if (inputChar && inputChar.length >= 1 && !key.ctrl && !key.meta) {
      if (inputChar.length === 1) {
        // Single character input (normal typing) - insert at cursor position
        const newInput = input.slice(0, cursorPosition) + inputChar + input.slice(cursorPosition);
        setInput(newInput);
        setCursorPosition(prev => prev + 1);
      } else {
        // Multi-character input (likely pasted content) - insert at cursor position
        const cleanedInput = sanitizePastedContent(inputChar, multiline);
        if (cleanedInput) {
          const newInput = input.slice(0, cursorPosition) + cleanedInput + input.slice(cursorPosition);
          setInput(newInput);
          setCursorPosition(prev => prev + cleanedInput.length);
        }
      }
    }
  });

  const renderInputWithCursor = () => {
    // Insert a visible cursor character at the current position
    const beforeCursor = input.slice(0, cursorPosition);
    const afterCursor = input.slice(cursorPosition);
    const displayText = beforeCursor + '|' + afterCursor;
    
    if (multiline) {
      return (
        <Box flexDirection="column">
          <Text color="blue">{'> '}</Text>
          <Text wrap="wrap">{displayText}</Text>
        </Box>
      );
    } else {
      return (
        <Box>
          <Text color="blue">{'> '}</Text>
          <Text wrap="wrap">{displayText}</Text>
        </Box>
      );
    }
  };

  return (
    <Box flexDirection="column">
      <Text color="gray">{placeholder}</Text>
      {isActive ? renderInputWithCursor() : (
        <Box>
          <Text color="blue">{'> '}</Text>
          <Text>{input}</Text>
        </Box>
      )}
    </Box>
  );
};