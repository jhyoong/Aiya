import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { SuggestionEngine, SuggestionResult } from '../../cli/suggestions.js';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null);

  useInput((inputChar: string, key: any) => {
    if (isProcessing) return;

    if (key.escape) {
      onExit?.();
      return;
    }

    if (key.return) {
      handleSubmit();
      return;
    }

    if (key.tab && suggestion) {
      // Auto-complete with suggestion
      setInput(suggestion.completionText);
      setSuggestion(null);
      return;
    }

    if (key.backspace) {
      const newInput = input.slice(0, -1);
      setInput(newInput);
      updateSuggestion(newInput);
      return;
    }

    if (key.ctrl && inputChar === 'c') {
      onExit?.();
      return;
    }

    // Handle regular character input
    if (inputChar && inputChar.length === 1 && !key.ctrl && !key.meta) {
      const newInput = input + inputChar;
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
      setSuggestion(null);
      setIsProcessing(false);
    }
  };

  const renderSuggestion = () => {
    if (!suggestion || !input) return null;

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
      <Box>
        <Text color="blue">{prompt}</Text>
        <Text>{input}</Text>
        {renderSuggestion()}
        {!isProcessing && <Text color="gray">_</Text>}
      </Box>
      
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