import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { SuggestionEngine, SuggestionResult } from '../../cli/suggestions.js';
import { useEnhancedInput } from '../hooks/useEnhancedInput.js';

interface CommandInputProps {
  onCommand: (command: string) => Promise<void>;
  onExit?: () => void;
  prompt?: string;
  suggestionEngine?: SuggestionEngine;
}

export const CommandInput: React.FC<CommandInputProps> = ({
  onCommand,
  onExit,
  prompt = '> ',
  suggestionEngine = new SuggestionEngine(),
}) => {
  const [input, setInput] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null);

  // Keep cursor position in sync with input length
  React.useEffect(() => {
    if (cursorPosition > input.length) {
      setCursorPosition(input.length);
    }
  }, [input.length, cursorPosition]);

  const sanitizePastedContent = (content: string): string => {
    return content
      .replace(/[\r\n]/g, ' ')           // Replace newlines with spaces
      .replace(/[\x00-\x1F\x7F]/g, '')   // Remove control characters
      .replace(/\s+/g, ' ')              // Normalize whitespace
      .trim();                           // Remove leading/trailing spaces
  };

  useEnhancedInput((inputChar: string, key: any) => {
    if (isProcessing) return;

    if (key.escape) {
      onExit?.();
      return;
    }

    if (key.return) {
      handleSubmit();
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

    // Enhanced navigation
    if ((key.ctrl && inputChar === 'a') || key.home) {
      setCursorPosition(0);
      return;
    }

    if ((key.ctrl && inputChar === 'e') || key.end) {
      setCursorPosition(input.length);
      return;
    }

    if (key.tab && suggestion) {
      // Auto-complete with suggestion - replace from cursor to end
      const newInput = input.slice(0, cursorPosition) + suggestion.completionText.slice(cursorPosition);
      setInput(newInput);
      setCursorPosition(newInput.length);
      setSuggestion(null);
      updateSuggestion(newInput);
      return;
    }

    // Backspace at cursor position
    if (key.backspace && cursorPosition > 0) {
      const newInput = input.slice(0, cursorPosition - 1) + input.slice(cursorPosition);
      setInput(newInput);
      setCursorPosition(prev => prev - 1);
      updateSuggestion(newInput);
      return;
    }

    // Delete at cursor position
    if (key.delete && cursorPosition < input.length) {
      const newInput = input.slice(0, cursorPosition) + input.slice(cursorPosition + 1);
      setInput(newInput);
      updateSuggestion(newInput);
      return;
    }

    if (key.ctrl && inputChar === 'c') {
      onExit?.();
      return;
    }

    // Handle paste operations (Ctrl+V / Cmd+V)
    if ((key.ctrl || key.meta) && inputChar === 'v') {
      // Paste operation detected - will be handled by next condition
      return;
    }

    // Handle both single characters AND multi-character input (paste)
    if (inputChar && inputChar.length >= 1 && !key.ctrl && !key.meta) {
      let newInput: string;
      
      if (inputChar.length === 1) {
        // Single character input (normal typing) - insert at cursor position
        newInput = input.slice(0, cursorPosition) + inputChar + input.slice(cursorPosition);
        setCursorPosition(prev => prev + 1);
      } else {
        // Multi-character input (likely pasted content) - insert at cursor position
        const cleanedInput = sanitizePastedContent(inputChar);
        if (cleanedInput) {
          newInput = input.slice(0, cursorPosition) + cleanedInput + input.slice(cursorPosition);
          setCursorPosition(prev => prev + cleanedInput.length);
        } else {
          return; // Skip if sanitization resulted in empty content
        }
      }
      
      setInput(newInput);
      updateSuggestion(newInput);
    }
  });

  const updateSuggestion = (currentInput: string) => {
    const newSuggestion = suggestionEngine.getSuggestion(currentInput);
    setSuggestion(newSuggestion);
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;

    setIsProcessing(true);
    
    try {
      await onCommand(input.trim());
    } catch (error) {
      // Error handling will be managed by parent component
    } finally {
      setInput('');
      setCursorPosition(0);
      setSuggestion(null);
      setIsProcessing(false);
    }
  };

  const renderSuggestion = () => {
    if (!suggestion || !input) return null;

    // Show suggestion text that extends beyond current input starting from cursor
    const suggestionText = suggestion.displayText;
    const inputFromStart = input.slice(0, cursorPosition);
    if (suggestionText.startsWith(inputFromStart)) {
      const remainingText = suggestionText.slice(cursorPosition);
      return (
        <Text color="gray" dimColor>
          {remainingText}
        </Text>
      );
    }

    return null;
  };

  const renderInputWithCursor = () => {
    // Insert a visible cursor character at the current position
    const beforeCursor = input.slice(0, cursorPosition);
    const afterCursor = input.slice(cursorPosition);
    const displayText = beforeCursor + '|' + afterCursor;
    
    return (
      <Box>
        <Text color="blue">{prompt}</Text>
        <Text wrap="wrap">{displayText}</Text>
        {renderSuggestion()}
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      {!isProcessing ? renderInputWithCursor() : (
        <Box>
          <Text color="blue">{prompt}</Text>
          <Text>{input}</Text>
        </Box>
      )}
      
      {suggestion && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            Tab to complete: {suggestion.displayText}
          </Text>
        </Box>
      )}
      
      {isProcessing && (
        <Box marginTop={1}>
          <Text color="yellow">Processing...</Text>
        </Box>
      )}
      
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Use Tab to autocomplete, ESC to exit, Ctrl+C to quit
        </Text>
      </Box>
    </Box>
  );
};