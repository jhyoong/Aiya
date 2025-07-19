import React from 'react';
import { Box, Text } from 'ink';
import { Select } from '@inkjs/ui';
import { ToolCall } from '../../core/providers/base.js';

interface ToolConfirmationDialogProps {
  toolCalls: ToolCall[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const ToolConfirmationDialog: React.FC<ToolConfirmationDialogProps> = ({
  toolCalls,
  onConfirm,
  onCancel,
}) => {
  const formatArguments = (args: any): string => {
    return Object.entries(args)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(', ');
  };

  const handleSelect = (value: string) => {
    if (value === 'confirm') {
      onConfirm();
    } else {
      onCancel();
    }
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="yellow">
          ⚠️  The assistant wants to execute the following tools:
        </Text>
      </Box>

      <Box 
        borderStyle="round" 
        borderColor="yellow" 
        paddingX={2} 
        paddingY={1} 
        marginBottom={1}
      >
        {toolCalls.map((tool, index) => (
          <Box key={index} flexDirection="column" marginBottom={index < toolCalls.length - 1 ? 1 : 0}>
            <Text bold color="cyan">• {tool.name}</Text>
            <Text dimColor>  {formatArguments(tool.arguments)}</Text>
          </Box>
        ))}
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>Use arrow keys to navigate, Enter to select</Text>
      </Box>

      <Select
        options={[
          { label: 'Execute Tools', value: 'confirm' },
          { label: 'Cancel', value: 'cancel' },
        ]}
        onChange={handleSelect}
      />
    </Box>
  );
};