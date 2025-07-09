import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
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
}

export const StatusBar: React.FC<StatusBarProps> = ({
  status,
  message,
  provider,
  model,
  contextLength,
  tokenUsage,
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
      {(provider || model || contextLength || tokenUsage) && (
        <Box>
          {provider && <Text color="cyan">{provider}</Text>}
          {model && <Text color="magenta">:{model}</Text>}
          {contextLength && (
            <Text color="blue"> | {contextLength.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}ctx</Text>
          )}
          {tokenUsage && (
            <Text color="green"> | [Tokens: sent {tokenUsage.sent} ({tokenUsage.sentTotal}), received {tokenUsage.received} ({tokenUsage.receivedTotal})]</Text>
          )}
        </Box>
      )}
    </Box>
  );
};