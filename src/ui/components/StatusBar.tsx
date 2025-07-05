import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  status: 'idle' | 'processing' | 'error' | 'success';
  message?: string | undefined;
  provider?: string | undefined;
  model?: string | undefined;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  status,
  message,
  provider,
  model,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'yellow';
      case 'error':
        return 'red';
      case 'success':
        return 'green';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return '⏳';
      case 'error':
        return '❌';
      case 'success':
        return '✅';
      default:
        return '⚪';
    }
  };

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
    >
      <Box>
        <Text color={getStatusColor()}>
          {getStatusIcon()} {status.toUpperCase()}
        </Text>
        {message && (
          <Text color="gray"> | {message}</Text>
        )}
      </Box>
      {(provider || model) && (
        <Box>
          {provider && <Text color="cyan">{provider}</Text>}
          {model && <Text color="magenta">:{model}</Text>}
        </Box>
      )}
    </Box>
  );
};