import React from 'react';
import { Box, Text } from 'ink';
import { Spinner, StatusMessage } from '@inkjs/ui';

export type StatusBarMode = 'full' | 'simple';

interface UnifiedStatusBarProps {
  mode?: StatusBarMode;
  status:
    | 'idle'
    | 'processing'
    | 'error'
    | 'success'
    | 'waiting-for-tool-confirmation';
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

export const UnifiedStatusBar: React.FC<UnifiedStatusBarProps> = ({
  mode = 'full',
  status,
  message,
  provider,
  model,
  contextLength,
  tokenUsage,
  currentProvider,
}) => {
  const formatTokenUsage = (usage: NonNullable<typeof tokenUsage>): string => {
    return `[Tokens: sent ${usage.sent} (${usage.sentTotal}), received ${usage.received} (${usage.receivedTotal})]`;
  };

  const formatNumber = (num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const getProviderModelDisplay = (): string => {
    if (currentProvider) {
      return `${currentProvider.name}:${currentProvider.model}`;
    }
    let display = '';
    if (provider) display += provider;
    if (model) display += `:${model}`;
    return display;
  };

  if (mode === 'simple') {
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
            {getProviderModelDisplay()}
            {contextLength && ` | ${formatNumber(contextLength)}ctx`}
            {tokenUsage && ` | ${formatTokenUsage(tokenUsage)}`}
          </Text>
        )}
      </Box>
    );
  }

  // Full mode (original StatusBar behavior)
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
      borderStyle='round'
      borderColor='gray'
      paddingX={1}
      justifyContent='space-between'
    >
      <Box>
        <Text color={getStatusColor()}>
          {getStatusIcon()} {status.toUpperCase()}
        </Text>
        {message && <Text color='gray'> | {message}</Text>}
      </Box>
      {(provider ||
        model ||
        contextLength ||
        tokenUsage ||
        currentProvider) && (
        <Box>
          <Text color='cyan'>{currentProvider?.name || provider}</Text>
          <Text color='magenta'>:{currentProvider?.model || model}</Text>
          {contextLength && (
            <Text color='blue'> | {formatNumber(contextLength)}ctx</Text>
          )}
          {tokenUsage && (
            <Text color='green'> | {formatTokenUsage(tokenUsage)}</Text>
          )}
        </Box>
      )}
    </Box>
  );
};

// Re-export as StatusBar for backward compatibility
export const StatusBar = UnifiedStatusBar;
// Re-export as SimpleStatusBar for backward compatibility
export const SimpleStatusBar: React.FC<
  Omit<UnifiedStatusBarProps, 'mode'>
> = props => <UnifiedStatusBar {...props} mode='simple' />;
