import React from 'react';
import { Box, Text } from 'ink';

interface SimpleStatusBarProps {
  status: 'idle' | 'processing' | 'error' | 'success';
  message?: string | undefined;
  provider?: string | undefined;
  model?: string | undefined;
  contextLength?: number | undefined;
  tokenUsage?: {
    sent: number;
    sentTotal: number;
    received: number;
    receivedTotal: number;
  } | undefined;
  currentProvider?: {
    name: string;
    type: string;
    model: string;
  } | undefined;
}

export const SimpleStatusBar: React.FC<SimpleStatusBarProps> = ({
  status,
  message,
  provider,
  model,
  contextLength,
  tokenUsage,
  currentProvider,
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
        {currentProvider ? (
          ` | ${currentProvider.name}:${currentProvider.model}`
        ) : (
          <>
            {provider && ` | ${provider}`}
            {model && `:${model}`}
          </>
        )}
        {contextLength && ` | ${contextLength.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}ctx`}
        {tokenUsage && ` | [Tokens: sent ${tokenUsage.sent} (${tokenUsage.sentTotal}), received ${tokenUsage.received} (${tokenUsage.receivedTotal})]`}
      </Text>
    </Box>
  );
};