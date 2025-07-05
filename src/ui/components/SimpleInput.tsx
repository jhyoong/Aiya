import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { SuggestionEngine, SuggestionResult } from '../../cli/suggestions.js';

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

  useInput((inputChar: string, key: any) => {
    if (key.escape) {
      onCancel?.();
      return;
    }

    if (key.return) {
      if (input.trim()) {
        onSubmit(input);
        setInput('');
        setSuggestion(null);
      }
      return;
    }

    if (key.tab && suggestion) {
      // Auto-complete with suggestion
      setInput(suggestion.completionText);
      setSuggestion(null);
      return;
    }

    if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
      return;
    }

    if (key.ctrl && inputChar === 'c') {
      onCancel?.();
      return;
    }

    // Handle regular character input
    if (inputChar && inputChar.length === 1 && !key.ctrl && !key.meta) {
      setInput(prev => prev + inputChar);
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

  return (
    <Box flexDirection="column">
      <Text color="gray" dimColor>{placeholder}</Text>
      <Box>
        <Text color="blue">{prompt}</Text>
        <Text>{input}</Text>
        {renderSuggestion()}
        <Text color="gray" dimColor>_</Text>
      </Box>
      
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