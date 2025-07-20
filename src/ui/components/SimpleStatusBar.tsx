import React from 'react';
import { Box, Text } from 'ink';
import { Spinner, StatusMessage } from '@inkjs/ui';

interface SimpleStatusBarProps {
  status: 'idle' | 'processing' | 'error' | 'success' | 'waiting-for-tool-confirmation';
  message?: string | undefined;
  provider?: string | undefined;
  model?: string | undefined;
  contextLength?: number | undefined;
  tokenUsage?:
    | {
        sent: number;
        sentTotal: number;
        received: number;
        receivedTotal: number;
      }
    | undefined;
  currentProvider?:
    | {
        name: string;
        type: string;
        model: string;
      }
    | undefined;
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
  const renderStatusIndicator = () => {
    switch (status) {
      case 'processing':
        return <Spinner label={message || 'Processing'} />;
      case 'error':
        return (
          <StatusMessage variant='error'>{message || 'Error'}</StatusMessage>
        );
      case 'success':
        return (
          <StatusMessage variant='success'>
            {message || 'Success'}
          </StatusMessage>
        );
      case 'waiting-for-tool-confirmation':
        return (
          <StatusMessage variant='warning'>
            {message || 'Waiting for tool confirmation...'}
          </StatusMessage>
        );
      case 'idle':
      default:
        return (
          <StatusMessage variant='info'>{message || 'Idle'}</StatusMessage>
        );
    }
  };

  return (
    <Box paddingX={1} paddingY={0}>
      {renderStatusIndicator()}
      {(currentProvider || provider || contextLength || tokenUsage) && (
        <Text color='gray'>
          {' | '}
          {currentProvider ? (
            `${currentProvider.name}:${currentProvider.model}`
          ) : (
            <>
              {provider && `${provider}`}
              {model && `:${model}`}
            </>
          )}
          {contextLength &&
            ` | ${contextLength.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}ctx`}
          {tokenUsage &&
            ` | [Tokens: sent ${tokenUsage.sent} (${tokenUsage.sentTotal}), received ${tokenUsage.received} (${tokenUsage.receivedTotal})]`}
        </Text>
      )}
    </Box>
  );
};
