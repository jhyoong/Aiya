import React from 'react';
import { Box, Text } from 'ink';
import { Select } from '@inkjs/ui';
import { ExtendedProviderConfig } from '../../../core/config/manager.js';

interface ProviderOption {
  label: string;
  value: ExtendedProviderConfig['type'];
  description: string;
}

interface ProviderSelectionProps {
  onSelect: (providerType: ExtendedProviderConfig['type']) => void;
  onSaveAndExit?: () => void;
  title?: string;
  showSaveAndExit?: boolean;
}

export const ProviderSelection: React.FC<ProviderSelectionProps> = ({ 
  onSelect, 
  onSaveAndExit,
  title = "Choose your AI provider:",
  showSaveAndExit = false
}) => {
  const allProviders: ProviderOption[] = [
    {
      label: 'Ollama - Local AI models',
      value: 'ollama',
      description: 'Free, runs locally, good for development and privacy'
    },
    {
      label: 'OpenAI - GPT models',
      value: 'openai',
      description: 'Paid API or free, state-of-the-art models, function calling'
    },
    {
      label: 'Google Gemini - Gemini models',
      value: 'gemini',
      description: 'Paid API, large context windows, vision support, thinking mode'
    }
  ];

  const availableProviders = allProviders;

  const handleSelect = (value: string) => {
    if (value === 'save-and-exit') {
      onSaveAndExit?.();
    } else {
      onSelect(value as ExtendedProviderConfig['type']);
    }
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="green">
          {title}
        </Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text dimColor>
          Use arrow keys to navigate, Enter to select
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Select
          options={[
            ...availableProviders.map(provider => ({
              label: provider.label,
              value: provider.value
            })),
            ...(showSaveAndExit ? [{
              label: 'I changed my mind (Save current config and exit)',
              value: 'save-and-exit'
            }] : [])
          ]}
          onChange={handleSelect}
        />
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          💡 Provider details will be shown during configuration
        </Text>
      </Box>
    </Box>
  );
};