import React from 'react';
import { Box, Text } from 'ink';
import { TextInput, Select, PasswordInput, ConfirmInput } from '@inkjs/ui';
import { ExtendedProviderConfig } from '../../../core/config/manager.js';
import { OllamaCollector } from '../../../core/config/collectors/ollama.js';
import { OpenAICollector } from '../../../core/config/collectors/openai.js';
import { GeminiCollector } from '../../../core/config/collectors/gemini.js';
import { getDefaultModel, getModelCapabilities } from '../../../core/config/models.js';

interface FormState {
  model: string;
  baseUrl: string;
  apiKey: string;
  contextLength?: number;
  location?: string;
  projectId?: string;
  customBaseUrl: boolean;
  isCustomModel: boolean;
  customModel: string;
  step: 'model' | 'custom-model' | 'endpoint-prompt' | 'endpoint' | 'apiKey' | 'advanced' | 'complete';
}

interface ProviderConfigFormProps {
  providerType: ExtendedProviderConfig['type'];
  onComplete: (config: ExtendedProviderConfig) => void;
  onBack: () => void;
}

export const ProviderConfigForm: React.FC<ProviderConfigFormProps> = ({
  providerType,
  onComplete,
  onBack
}) => {
  const [state, setState] = React.useState<FormState>(() => {
    // Initialize with dynamic defaults from centralized model system
    // Only use centralized defaults for supported providers
    const supportedProviders = ['ollama', 'openai', 'gemini'] as const;
    const defaultModel = supportedProviders.includes(providerType as any) 
      ? getDefaultModel(providerType as 'ollama' | 'openai' | 'gemini')
      : '';
    
    return {
      model: defaultModel,
      baseUrl: providerType === 'ollama' ? 'http://localhost:11434' : '',
      apiKey: '',
      step: 'model' as const,
      customBaseUrl: false,
      isCustomModel: false,
      customModel: '',
      // Provider-specific fields
      ...(providerType === 'gemini' && { location: 'us-central1' })
    };
  });

  const [availableModels, setAvailableModels] = React.useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = React.useState(false);

  // Load available models when component mounts or when relevant config changes
  React.useEffect(() => {
    const loadModels = async () => {
      setIsLoadingModels(true);
      try {
        let collector;
        const partialConfig = {
          baseUrl: state.baseUrl,
          apiKey: state.apiKey
        };

        switch (providerType) {
          case 'ollama':
            collector = new OllamaCollector();
            break;
          case 'openai':
            collector = new OpenAICollector();
            break;
          case 'gemini':
            collector = new GeminiCollector();
            break;
          default:
            setAvailableModels([]);
            return;
        }

        const models = await collector.getAvailableModels(partialConfig);
        setAvailableModels(models);
      } catch (error) {
        console.error('Failed to load models:', error);
        setAvailableModels([]);
      } finally {
        setIsLoadingModels(false);
      }
    };

    loadModels();
  }, [providerType, state.baseUrl, state.apiKey]);

  const handleModelSelect = (model: string) => {
    if (model === 'custom') {
      setState(prev => ({ ...prev, isCustomModel: true, step: 'custom-model' }));
    } else {
      setState(prev => ({ ...prev, model, isCustomModel: false }));
      
      // Determine next step based on provider type
      if (providerType === 'ollama') {
        setState(prev => ({ ...prev, step: 'endpoint' }));
      } else if (providerType === 'openai') {
        setState(prev => ({ ...prev, step: 'endpoint-prompt' }));
      } else {
        setState(prev => ({ ...prev, step: 'apiKey' }));
      }
    }
  };

  const handleEndpointConfig = (useCustom: boolean) => {
    setState(prev => ({ 
      ...prev, 
      customBaseUrl: useCustom,
      step: useCustom ? 'endpoint' : (providerType === 'ollama' ? 'complete' : 'apiKey')
    }));
  };

  const handleCustomModelSubmit = (customModel: string) => {
    if (!customModel.trim()) {
      return; // Don't proceed if empty
    }
    
    setState(prev => ({ 
      ...prev, 
      customModel: customModel.trim(),
      model: customModel.trim()
    }));
    
    // Determine next step based on provider type
    if (providerType === 'ollama') {
      setState(prev => ({ ...prev, step: 'endpoint' }));
    } else if (providerType === 'openai') {
      setState(prev => ({ ...prev, step: 'endpoint-prompt' }));
    } else {
      setState(prev => ({ ...prev, step: 'apiKey' }));
    }
  };

  const handleEndpointPrompt = (useCustomEndpoint: boolean) => {
    if (useCustomEndpoint) {
      setState(prev => ({ ...prev, customBaseUrl: true, step: 'endpoint' }));
    } else {
      // Use default OpenAI endpoint
      setState(prev => ({ 
        ...prev, 
        customBaseUrl: false, 
        baseUrl: 'https://api.openai.com/v1',
        step: 'apiKey' 
      }));
    }
  };

  const handleComplete = () => {
    const config: ExtendedProviderConfig = {
      type: providerType,
      model: state.model,
      baseUrl: state.baseUrl,
      ...(state.apiKey && { apiKey: state.apiKey }),
      capabilities: getCapabilitiesForProvider(providerType)
    };

    // Add provider-specific configurations
    if (providerType === 'gemini' && (state.location || state.projectId)) {
      config.gemini = {
        ...(state.location && { location: state.location }),
        ...(state.projectId && { projectId: state.projectId }),
        maxTokens: 8192,
        thinkingBudget: 20000,
        includeThoughts: true
      };
    }

    onComplete(config);
  };

  const getCapabilitiesForProvider = (type: ExtendedProviderConfig['type']) => {
    // Use centralized model capabilities for supported providers
    const supportedProviders = ['ollama', 'openai', 'gemini'] as const;
    
    if (supportedProviders.includes(type as any)) {
      const capabilities = getModelCapabilities(type as 'ollama' | 'openai' | 'gemini', state.model);
      
      // Map contextLength to maxTokens and handle Ollama custom context length
      const maxTokens = type === 'ollama' && state.contextLength 
        ? state.contextLength 
        : capabilities.contextLength;
      
      return {
        maxTokens,
        supportsFunctionCalling: capabilities.supportsFunctionCalling,
        supportsVision: capabilities.supportsVision,
        supportsStreaming: capabilities.supportsStreaming,
        supportsThinking: capabilities.supportsThinking,
        ...(capabilities.costPerToken && { costPerToken: capabilities.costPerToken })
      };
    }
    
    // Fallback for unsupported provider types
    return {
      maxTokens: 8192,
      supportsFunctionCalling: false,
      supportsVision: false,
      supportsStreaming: true,
      supportsThinking: false
    };
  };

  const renderStep = () => {
    switch (state.step) {
      case 'model':
        return (
          <Box flexDirection="column">
            <Text bold color="blue">Select Model</Text>
            <Box marginBottom={1}>
              <Text dimColor>
                Choose the AI model to use with {providerType}
              </Text>
            </Box>
            
            {isLoadingModels ? (
              <Text>Loading available models...</Text>
            ) : (
              <Select
                options={[
                  ...availableModels.map(model => ({
                    label: model,
                    value: model
                  })),
                  {
                    label: 'Custom (enter manually)',
                    value: 'custom'
                  }
                ]}
                onChange={handleModelSelect}
              />
            )}
          </Box>
        );

      case 'custom-model':
        return (
          <Box flexDirection="column">
            <Text bold color="blue">Enter Custom Model Name</Text>
            <Box marginBottom={1}>
              <Text dimColor>
                Enter the exact model name for {providerType}
              </Text>
            </Box>
            
            <TextInput
              key={`custom-model-${state.step}`}
              placeholder={`Enter ${providerType} model name`}
              onSubmit={handleCustomModelSubmit}
            />
            
            <Box marginTop={1}>
              <Text dimColor>
                💡 Make sure the model name is exactly as recognized by the provider
              </Text>
            </Box>
          </Box>
        );

      case 'endpoint-prompt':
        return (
          <Box flexDirection="column">
            <Text bold color="blue">API Endpoint Configuration</Text>
            <Box marginBottom={1}>
              <Text dimColor>
                Choose your OpenAI API endpoint
              </Text>
            </Box>
            
            <Box marginBottom={1}>
              <Text>
                Select an option:
              </Text>
            </Box>
            
            <Box marginBottom={1}>
              <Text dimColor>• Default: Use OpenAI's official API (api.openai.com)</Text>
              <Text dimColor>• Custom: Use OpenAI-compatible API (Perplexity, Together AI, local servers, etc.)</Text>
            </Box>

            <ConfirmInput
              onConfirm={() => handleEndpointPrompt(true)}
              onCancel={() => handleEndpointPrompt(false)}
            />
            
            <Box marginTop={1}>
              <Text dimColor>
                Press y for custom endpoint, n for default OpenAI endpoint
              </Text>
            </Box>
          </Box>
        );

      case 'endpoint':
        if (providerType === 'ollama') {
          return (
            <Box flexDirection="column">
              <Text bold color="blue">Configure Endpoint</Text>
              <Box marginBottom={1}>
                <Text dimColor>
                  Enter Ollama server endpoint (default: http://localhost:11434)
                </Text>
              </Box>
              
              <TextInput
                key={`endpoint-${state.step}`}
                placeholder="http://localhost:11434"
                onSubmit={(value) => {
                  setState(prev => ({ ...prev, baseUrl: value || 'http://localhost:11434', step: 'complete' }));
                }}
              />
            </Box>
          );
        }
        
        if (providerType === 'openai') {
          return (
            <Box flexDirection="column">
              <Text bold color="blue">Custom OpenAI Endpoint</Text>
              <Box marginBottom={1}>
                <Text dimColor>
                  Enter your OpenAI-compatible API endpoint
                </Text>
              </Box>
              
              <Box marginBottom={1}>
                <Text dimColor>
                  Examples: https://api.perplexity.ai, https://api.together.xyz/v1, http://localhost:8000/v1
                </Text>
              </Box>
              
              <TextInput
                key={`endpoint-${state.step}`}
                placeholder="https://api.example.com/v1"
                onSubmit={(value) => {
                  setState(prev => ({ 
                    ...prev, 
                    baseUrl: value || 'https://api.openai.com/v1', 
                    step: 'apiKey' 
                  }));
                }}
              />
              
              <Box marginTop={1}>
                <Text dimColor>
                  💡 Make sure the endpoint is OpenAI API compatible
                </Text>
              </Box>
            </Box>
          );
        }
        
        return (
          <Box flexDirection="column">
            <Text bold color="blue">Custom Endpoint</Text>
            <ConfirmInput
              onConfirm={() => handleEndpointConfig(true)}
              onCancel={() => handleEndpointConfig(false)}
            />
          </Box>
        );

      case 'apiKey':
        return (
          <Box flexDirection="column">
            <Text bold color="blue">API Key</Text>
            <Box marginBottom={1}>
              <Text dimColor>
                Enter your {providerType} API key (or set environment variable)
              </Text>
            </Box>
            
            <PasswordInput
              key={`apikey-${state.step}`}
              placeholder={`${providerType.toUpperCase()}_API_KEY`}
              onSubmit={(apiKey) => {
                setState(prev => ({ ...prev, apiKey: apiKey || '', step: 'complete' }));
              }}
            />
            
            <Box marginTop={1}>
              <Text dimColor>
                💡 You can also set the {providerType.toUpperCase()}_API_KEY environment variable
              </Text>
            </Box>
          </Box>
        );

      case 'complete':
        return (
          <Box flexDirection="column">
            <Text bold color="green">Configuration Complete</Text>
            <Box marginBottom={1}>
              <Text>
                Review your {providerType} configuration:
              </Text>
            </Box>
            
            <Box flexDirection="column" marginBottom={1} paddingLeft={2}>
              <Text>• Provider: {providerType}</Text>
              <Text>• Model: {state.model}{state.isCustomModel ? ' (custom)' : ''}</Text>
              {state.baseUrl && <Text>• Endpoint: {state.baseUrl}</Text>}
              {state.apiKey && <Text>• API Key: {'*'.repeat(Math.min(state.apiKey.length, 8))}</Text>}
            </Box>
            
            <ConfirmInput
              onConfirm={handleComplete}
              onCancel={onBack}
            />
          </Box>
        );

      default:
        return <Text>Unknown step</Text>;
    }
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold>
          Configuring {providerType.charAt(0).toUpperCase() + providerType.slice(1)}
        </Text>
      </Box>
      
      {renderStep()}
      
      <Box marginTop={2}>
        <Text dimColor>
          Press Ctrl+C to cancel, or use the interface to navigate
        </Text>
      </Box>
    </Box>
  );
};