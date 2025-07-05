import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { SuggestionEngine, SuggestionResult } from '../../cli/suggestions.js';
import { useEnhancedInput } from '../hooks/useEnhancedInput.js';

interface SimpleInputProps {
  onSubmit: (input: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  prompt?: string;
  suggestionEngine?: SuggestionEngine;
}

export const SimpleInput: React.FC<SimpleInputProps> = ({
  onSubmit,
  onCancel,
  placeholder = 'Type your message...',
  prompt = '> ',
  suggestionEngine,
}) => {
  const [input, setInput] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null);

  const updateSuggestion = (currentInput: string) => {
    if (suggestionEngine) {
      const newSuggestion = suggestionEngine.getSuggestion(currentInput);
      setSuggestion(newSuggestion);
    }
  };

  useEffect(() => {
    updateSuggestion(input);
  }, [input, suggestionEngine]);

  // Keep cursor position in sync with input length
  useEffect(() => {
    if (cursorPosition > input.length) {
      setCursorPosition(input.length);
    } else if (cursorPosition < 0) {
      setCursorPosition(0);
    }
  }, [input.length, cursorPosition]);

  const sanitizePastedContent = (content: string): string => {
    return content
      .replace(/[\r\n]+/g, ' ')          // Replace newlines with single space
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars except tab
      .replace(/\s+/g, ' ')              // Normalize whitespace to single spaces
      .trim();                           // Remove leading/trailing spaces
  };

  useEnhancedInput((inputChar: string, key: any) => {
    
    if (key.escape) {
      onCancel?.();
      return;
    }

    if (key.return) {
      if (input.trim()) {
        onSubmit(input);
        setInput('');
        setCursorPosition(0);
        setSuggestion(null);
      }
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
      // Auto-complete with suggestion
      setInput(suggestion.completionText);
      setCursorPosition(suggestion.completionText.length);
      setSuggestion(null);
      return;
    }

    // Backspace at cursor position
    if (key.backspace && cursorPosition > 0) {
      const safePosition = Math.min(cursorPosition, input.length);
      if (safePosition > 0) {
        const newInput = input.slice(0, safePosition - 1) + input.slice(safePosition);
        setInput(newInput);
        setCursorPosition(safePosition - 1);
      }
      return;
    }

    // Delete at cursor position
    if (key.delete && cursorPosition < input.length) {
      const safePosition = Math.min(cursorPosition, input.length);
      const newInput = input.slice(0, safePosition) + input.slice(safePosition + 1);
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
        const safePosition = Math.min(cursorPosition, input.length);
        const newInput = input.slice(0, safePosition) + inputChar + input.slice(safePosition);
        setInput(newInput);
        setCursorPosition(safePosition + 1);
      } else {
        // Multi-character input (likely pasted content) - insert at cursor position
        const cleanedInput = sanitizePastedContent(inputChar);
        if (cleanedInput) {
          const safePosition = Math.min(cursorPosition, input.length);
          const newInput = input.slice(0, safePosition) + cleanedInput + input.slice(safePosition);
          setInput(newInput);
          setCursorPosition(safePosition + cleanedInput.length);
        }
      }
    }
  });

  const renderSuggestion = () => {
    if (!suggestion || !input.startsWith('/')) return null;

    // Show suggestion text that extends beyond current input
    const suggestionText = suggestion.displayText;
    if (suggestionText.startsWith(input)) {
      const remainingText = suggestionText.slice(input.length);
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
    const safePosition = Math.min(Math.max(0, cursorPosition), input.length);
    const beforeCursor = input.slice(0, safePosition);
    const afterCursor = input.slice(safePosition);
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
      <Text color="gray" dimColor>{placeholder}</Text>
      {renderInputWithCursor()}
      
      {suggestion && input.startsWith('/') && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            Tab to complete: {suggestion.displayText}
          </Text>
        </Box>
      )}
    </Box>
  );
};