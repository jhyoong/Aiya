import React from 'react';
import { Box, Text, useInput } from 'ink';
import { Alert, ConfirmInput } from '@inkjs/ui';
import { WelcomeScreen } from './WelcomeScreen.js';
import { ProviderSelection } from './ProviderSelection.js';
import { ProviderConfigForm } from './ProviderConfigForm.js';
import { ConnectionTest } from './ConnectionTest.js';
import { ExtendedProviderConfig } from '../../../core/config/manager.js';
import {
  ConfigurationGenerator,
  SetupSession,
} from '../../../core/config/generation.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Three choice input component for multi-provider prompt
interface ThreeChoiceInputProps {
  onAddProvider: () => void;
  onFinishSetup: () => void;
  onSaveAndExit: () => void;
}

const ThreeChoiceInput: React.FC<ThreeChoiceInputProps> = ({
  onAddProvider,
  onFinishSetup,
  onSaveAndExit,
}) => {
  useInput(input => {
    if (input === 'y' || input === 'Y') {
      onAddProvider();
    } else if (input === 'n' || input === 'N') {
      onFinishSetup();
    } else if (input === 's' || input === 'S') {
      onSaveAndExit();
    }
  });

  return null; // This component only handles input, no visual output
};

// Setup steps state machine
type SetupStep =
  | 'welcome'
  | 'provider-selection'
  | 'provider-config'
  | 'connection-test'
  | 'multi-provider-prompt'
  | 'additional-provider-selection'
  | 'additional-provider-config'
  | 'additional-connection-test'
  | 'save-and-exit'
  | 'summary'
  | 'complete'
  | 'error';

interface SetupWizardState {
  step: SetupStep;
  primaryProvider?: ExtendedProviderConfig;
  additionalProviders: ExtendedProviderConfig[];
  currentProviderType?: ExtendedProviderConfig['type'];
  skipValidation: boolean;
  error?: string;
}

interface SetupWizardProps {
  projectPath?: string;
  onComplete: (success: boolean, configPath?: string) => void;
  onError: (error: string) => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({
  projectPath = process.cwd(),
  onComplete,
  onError,
}) => {
  const [state, setState] = React.useState<SetupWizardState>({
    step: 'welcome',
    additionalProviders: [],
    skipValidation: false,
  });

  const configGenerator = React.useMemo(() => new ConfigurationGenerator(), []);

  // Error boundary effect
  React.useEffect(() => {
    if (state.error) {
      onError(state.error);
    }
  }, [state.error, onError]);

  const handleError = (error: string) => {
    setState(prev => ({ ...prev, step: 'error', error }));
  };

  const handleWelcomeContinue = () => {
    setState(prev => ({ ...prev, step: 'provider-selection' }));
  };

  const handleProviderSelect = (
    providerType: ExtendedProviderConfig['type']
  ) => {
    setState(prev => ({
      ...prev,
      step: 'provider-config',
      currentProviderType: providerType,
    }));
  };

  const handleProviderConfigComplete = (config: ExtendedProviderConfig) => {
    const isAdditional = state.step === 'additional-provider-config';

    if (isAdditional) {
      // Check for duplicates in additional providers
      const existingIndex = state.additionalProviders.findIndex(
        provider =>
          provider.type === config.type &&
          provider.model === config.model &&
          provider.baseUrl === config.baseUrl
      );

      let updatedProviders: ExtendedProviderConfig[];
      if (existingIndex !== -1) {
        // Replace existing duplicate configuration
        updatedProviders = [...state.additionalProviders];
        updatedProviders[existingIndex] = config;
      } else {
        // Add new configuration
        updatedProviders = [...state.additionalProviders, config];
      }

      setState(prev => ({
        ...prev,
        additionalProviders: updatedProviders,
        step: 'additional-connection-test',
      }));
    } else {
      setState(prev => ({
        ...prev,
        primaryProvider: config,
        step: 'connection-test',
      }));
    }
  };

  const handleProviderConfigBack = () => {
    const isAdditional = state.step === 'additional-provider-config';
    setState(prev => {
      const newState: SetupWizardState = {
        ...prev,
        step: isAdditional
          ? 'additional-provider-selection'
          : 'provider-selection',
      };
      delete newState.currentProviderType;
      return newState;
    });
  };

  const handleConnectionTestSuccess = () => {
    const isAdditional = state.step === 'additional-connection-test';

    if (isAdditional) {
      setState(prev => ({ ...prev, step: 'multi-provider-prompt' }));
    } else {
      setState(prev => ({ ...prev, step: 'multi-provider-prompt' }));
    }
  };

  const handleConnectionTestSkip = () => {
    setState(prev => ({ ...prev, skipValidation: true }));
    handleConnectionTestSuccess();
  };

  const handleMultiProviderResponse = (addAnother: boolean) => {
    if (addAnother) {
      setState(prev => ({ ...prev, step: 'additional-provider-selection' }));
    } else {
      setState(prev => ({ ...prev, step: 'summary' }));
    }
  };

  const handleSaveAndExit = () => {
    setState(prev => ({ ...prev, step: 'save-and-exit' }));
  };

  const handleAdditionalProviderSelect = (
    providerType: ExtendedProviderConfig['type']
  ) => {
    setState(prev => ({
      ...prev,
      step: 'additional-provider-config',
      currentProviderType: providerType,
    }));
  };

  const handleSummaryComplete = async () => {
    try {
      await saveConfiguration();
      setState(prev => ({ ...prev, step: 'complete' }));
    } catch (error) {
      handleError(
        error instanceof Error ? error.message : 'Failed to save configuration'
      );
    }
  };

  const saveConfiguration = async () => {
    if (!state.primaryProvider) {
      throw new Error('No primary provider configured');
    }

    const session: SetupSession = {
      primaryProvider: state.primaryProvider,
      additionalProviders: state.additionalProviders,
      skipValidation: state.skipValidation,
      projectPath,
    };

    const configPath = path.join(projectPath, '.aiya.yaml');

    // Configuration will overwrite existing file if present

    // Generate and save new configuration
    const yamlContent = configGenerator.generateYAML(session);
    await fs.writeFile(configPath, yamlContent, 'utf8');

    onComplete(true, configPath);
  };

  const renderStep = () => {
    switch (state.step) {
      case 'welcome':
        return <WelcomeScreen onContinue={handleWelcomeContinue} />;

      case 'provider-selection':
        return (
          <ProviderSelection
            onSelect={handleProviderSelect}
            title='Choose your primary AI provider:'
          />
        );

      case 'provider-config':
        if (!state.currentProviderType) {
          handleError('No provider type selected');
          return null;
        }
        return (
          <ProviderConfigForm
            providerType={state.currentProviderType}
            onComplete={handleProviderConfigComplete}
            onBack={handleProviderConfigBack}
          />
        );

      case 'connection-test':
        if (!state.primaryProvider) {
          handleError('No primary provider configured');
          return null;
        }
        return (
          <ConnectionTest
            config={state.primaryProvider}
            onSuccess={handleConnectionTestSuccess}
            onSkip={handleConnectionTestSkip}
          />
        );

      case 'multi-provider-prompt':
        return (
          <Box flexDirection='column' paddingX={2} paddingY={1}>
            <Box marginBottom={1}>
              <Text bold color='blue'>
                Add Another Provider?
              </Text>
            </Box>

            <Box marginBottom={1}>
              <Text>
                You can configure additional AI providers to switch between
                during chat sessions.
              </Text>
            </Box>

            <Box marginBottom={1}>
              <Text dimColor>
                This allows you to use '/model-switch' to change providers on
                the fly.
              </Text>
            </Box>

            <Box marginBottom={1}>
              <Text bold>Choose an option:</Text>
            </Box>

            <Box marginBottom={1}>
              <Text dimColor>[y] Add another provider</Text>
              <Text dimColor>[n] Finish setup with current configuration</Text>
              <Text dimColor>[s] Save current configuration and exit</Text>
            </Box>

            <ThreeChoiceInput
              onAddProvider={() => handleMultiProviderResponse(true)}
              onFinishSetup={() => handleMultiProviderResponse(false)}
              onSaveAndExit={() => handleSaveAndExit()}
            />
          </Box>
        );

      case 'additional-provider-selection':
        return (
          <ProviderSelection
            onSelect={handleAdditionalProviderSelect}
            onSaveAndExit={handleSaveAndExit}
            title='Choose an additional provider:'
            showSaveAndExit={true}
          />
        );

      case 'additional-provider-config':
        if (!state.currentProviderType) {
          handleError('No provider type selected');
          return null;
        }
        return (
          <ProviderConfigForm
            providerType={state.currentProviderType}
            onComplete={handleProviderConfigComplete}
            onBack={handleProviderConfigBack}
          />
        );

      case 'additional-connection-test':
        const lastProvider =
          state.additionalProviders[state.additionalProviders.length - 1];
        if (!lastProvider) {
          handleError('No additional provider configured');
          return null;
        }
        return (
          <ConnectionTest
            config={lastProvider}
            onSuccess={handleConnectionTestSuccess}
            onSkip={handleConnectionTestSkip}
          />
        );

      case 'save-and-exit':
        if (!state.primaryProvider) {
          handleError('No primary provider configured');
          return null;
        }

        const partialSession: SetupSession = {
          primaryProvider: state.primaryProvider,
          additionalProviders: state.additionalProviders,
          skipValidation: state.skipValidation,
          projectPath,
        };

        return (
          <Box flexDirection='column' paddingX={2} paddingY={1}>
            <Box marginBottom={1}>
              <Text bold color='yellow'>
                Save Current Configuration
              </Text>
            </Box>

            <Box marginBottom={1}>
              <Text>
                Your current configuration will be saved and you can add more
                providers later.
              </Text>
            </Box>

            <Box marginBottom={1}>
              <Text>{configGenerator.generatePreview(partialSession)}</Text>
            </Box>

            <ConfirmInput
              onConfirm={handleSummaryComplete}
              onCancel={() =>
                setState(prev => ({ ...prev, step: 'multi-provider-prompt' }))
              }
            />

            <Box marginTop={1}>
              <Text dimColor>
                Press y to save and exit, n to go back to multi-provider prompt
              </Text>
            </Box>
          </Box>
        );

      case 'summary':
        if (!state.primaryProvider) {
          handleError('No primary provider configured');
          return null;
        }

        const session: SetupSession = {
          primaryProvider: state.primaryProvider,
          additionalProviders: state.additionalProviders,
          skipValidation: state.skipValidation,
          projectPath,
        };

        return (
          <Box flexDirection='column' paddingX={2} paddingY={1}>
            <Box marginBottom={1}>
              <Text bold color='green'>
                Setup Complete!
              </Text>
            </Box>

            <Box marginBottom={1}>
              <Text>{configGenerator.generatePreview(session)}</Text>
            </Box>

            <ConfirmInput
              onConfirm={handleSummaryComplete}
              onCancel={() =>
                setState(prev => ({ ...prev, step: 'multi-provider-prompt' }))
              }
            />

            <Box marginTop={1}>
              <Text dimColor>
                Press y to save configuration, n to go back and modify
              </Text>
            </Box>
          </Box>
        );

      case 'complete':
        return (
          <Box flexDirection='column' paddingX={2} paddingY={1}>
            <Alert variant='success'>
              <Text>✅ Configuration saved successfully!</Text>
            </Alert>

            <Box marginTop={1} marginBottom={1}>
              <Text>Your Aiya configuration has been saved to .aiya.yaml</Text>
            </Box>

            <Box marginBottom={1}>
              <Text bold color='blue'>
                Next Steps:
              </Text>
            </Box>

            <Box flexDirection='column' paddingLeft={2} marginBottom={1}>
              <Text>• Run 'aiya chat' to start chatting with your AI</Text>
              <Text>• Use 'aiya search &lt;pattern&gt;' to search files</Text>
              {state.additionalProviders.length > 0 && (
                <Text>• Use '/model-switch' in chat to change providers</Text>
              )}
              <Text>• Type '/help' in chat for available commands</Text>
            </Box>

            <Box marginTop={1}>
              <Text dimColor>
                Press Ctrl+C to exit, or wait a moment for automatic exit...
              </Text>
            </Box>
          </Box>
        );

      case 'error':
        return (
          <Box flexDirection='column' paddingX={2} paddingY={1}>
            <Alert variant='error'>
              <Text>Setup Error</Text>
            </Alert>

            <Box marginTop={1}>
              <Text color='red'>{state.error || 'Unknown error occurred'}</Text>
            </Box>

            <Box marginTop={1}>
              <Text dimColor>
                Please try running 'aiya init' again or check the documentation.
              </Text>
            </Box>
          </Box>
        );

      default:
        return (
          <Box flexDirection='column' paddingX={2} paddingY={1}>
            <Text>Unknown setup step: {state.step}</Text>
          </Box>
        );
    }
  };

  // Auto-exit after completion
  React.useEffect(() => {
    if (state.step === 'complete') {
      const timer = setTimeout(() => {
        onComplete(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state.step, onComplete]);

  return (
    <Box flexDirection='column'>
      {/* Progress indicator */}
      <Box paddingX={2} paddingY={1} borderStyle='single' borderColor='gray'>
        <Text dimColor>Aiya Setup Wizard - Step {getStepNumber()}/5</Text>
      </Box>

      {/* Main content */}
      {renderStep()}
    </Box>
  );

  function getStepNumber(): number {
    const stepOrder: SetupStep[] = [
      'welcome',
      'provider-selection',
      'provider-config',
      'connection-test',
      'multi-provider-prompt',
    ];

    const currentIndex = stepOrder.indexOf(state.step);
    return currentIndex === -1 ? 5 : currentIndex + 1;
  }
};
