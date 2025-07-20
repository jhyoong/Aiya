import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { SuggestionEngine } from '../../cli/suggestions.js';
import { UnifiedInput } from './UnifiedInput.js';
import { TextBuffer } from '../core/TextBuffer.js';

interface CommandInputProps {
  onCommand: (command: string) => Promise<void>;
  onExit?: () => void;
  prompt?: string;
  suggestionEngine?: SuggestionEngine;
  buffer: TextBuffer;
  inputWidth: number;
}

export const CommandInput: React.FC<CommandInputProps> = ({
  onCommand,
  onExit,
  prompt = '> ',
  suggestionEngine = new SuggestionEngine(),
  buffer,
  inputWidth,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (submittedInput: string) => {
    if (!submittedInput.trim()) return;

    setIsProcessing(true);

    try {
      await onCommand(submittedInput.trim());
    } catch (_error) {
      // Error handling will be managed by parent component
    } finally {
      buffer.setText('');
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    onExit?.();
  };

  const handleEscape = () => {
    onExit?.();
  };

  return (
    <Box flexDirection='column'>
      <UnifiedInput
        buffer={buffer}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onEscape={handleEscape}
        placeholder='Enter command...'
        suggestionEngine={suggestionEngine}
        showSuggestions={true}
        prefix={prompt}
        borderColor='blue'
        focusColor='cyan'
        inputWidth={inputWidth}
        focus={!isProcessing}
      />

      {isProcessing && (
        <Box marginTop={1}>
          <Text color='yellow'>Processing...</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color='gray' dimColor>
          Use Tab to autocomplete, ESC to exit, Ctrl+C to quit
        </Text>
      </Box>
    </Box>
  );
};
