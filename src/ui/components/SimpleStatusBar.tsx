import React from 'react';
import { Box, Text } from 'ink';

interface SimpleStatusBarProps {
  status: 'idle' | 'processing' | 'error' | 'success';
  message?: string | undefined;
  provider?: string | undefined;
  model?: string | undefined;
  contextLength?: number | undefined;
}

export const SimpleStatusBar: React.FC<SimpleStatusBarProps> = ({
  status,
  message,
  provider,
  model,
  contextLength,
}) => {
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
    <Box paddingX={1} paddingY={0}>
      <Text color="gray">
        {getStatusIcon()} {status.toUpperCase()}
        {message && ` | ${message}`}
        {provider && ` | ${provider}`}
        {model && `:${model}`}
        {contextLength && ` | ${contextLength.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}ctx`}
      </Text>
    </Box>
  );
};