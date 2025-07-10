import React from 'react';
import { Box, Text } from 'ink';
import { Spinner, Alert, ConfirmInput } from '@inkjs/ui';
import { ExtendedProviderConfig } from '../../../core/config/manager.js';
import { ConnectionTester } from '../../../core/config/testing.js';

interface ConnectionTestProps {
  config: ExtendedProviderConfig;
  onSuccess: () => void;
  onSkip: () => void;
}

type TestState = 'idle' | 'testing' | 'success' | 'error' | 'skipped';

export const ConnectionTest: React.FC<ConnectionTestProps> = ({
  config,
  onSuccess,
  onSkip
}) => {
  const [state, setState] = React.useState<TestState>('idle');
  const [error, setError] = React.useState<string>('');
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [showSkipOption, setShowSkipOption] = React.useState(false);

  const connectionTester = React.useMemo(() => new ConnectionTester(), []);

  React.useEffect(() => {
    // Start testing automatically when component mounts
    testConnection();
  }, []);

  const testConnection = async () => {
    setState('testing');
    setError('');
    setSuggestions([]);
    setShowSkipOption(false);

    try {
      const result = await connectionTester.testProvider(config);
      
      if (result.success) {
        setState('success');
        // Auto-proceed after showing success message
        setTimeout(onSuccess, 1500);
      } else {
        setState('error');
        setError(result.error || 'Connection test failed');
        setSuggestions(result.suggestions || []);
        // Show skip option after a delay
        setTimeout(() => setShowSkipOption(true), 3000);
      }
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setSuggestions(['Check your configuration and try again']);
      setTimeout(() => setShowSkipOption(true), 3000);
    }
  };

  const handleRetry = () => {
    setShowSkipOption(false);
    testConnection();
  };

  const handleSkip = () => {
    setState('skipped');
    onSkip();
  };

  const renderContent = () => {
    switch (state) {
      case 'idle':
        return (
          <Box flexDirection="column">
            <Text>Preparing connection test...</Text>
          </Box>
        );

      case 'testing':
        return (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Spinner label={`Testing connection to ${config.type}...`} />
            </Box>
            
            <Text dimColor>
              Checking: {config.model} @ {config.baseUrl || 'default endpoint'}
            </Text>
          </Box>
        );

      case 'success':
        return (
          <Box flexDirection="column">
            <Alert variant="success">
              <Text>✅ Connection test successful!</Text>
            </Alert>
            
            <Box marginTop={1}>
              <Text dimColor>
                Model {config.model} is available and ready to use.
              </Text>
            </Box>
          </Box>
        );

      case 'error':
        return (
          <Box flexDirection="column">
            <Alert variant="error">
              <Text>❌ Connection test failed</Text>
            </Alert>
            
            <Box marginTop={1} marginBottom={1}>
              <Text color="red">Error: {error}</Text>
            </Box>
            
            {suggestions.length > 0 && (
              <Box flexDirection="column" marginBottom={1}>
                <Text bold>💡 Suggestions:</Text>
                {suggestions.map((suggestion, index) => (
                  <Text key={index} dimColor>
                    • {suggestion}
                  </Text>
                ))}
              </Box>
            )}
            
            {showSkipOption ? (
              <Box flexDirection="column">
                <ConfirmInput
                  onConfirm={handleRetry}
                  onCancel={handleSkip}
                />
                
                <Box marginTop={1}>
                  <Text dimColor>
                    Press y to retry, n to skip testing and continue setup
                  </Text>
                </Box>
              </Box>
            ) : (
              <Text dimColor>
                Testing will continue in a moment...
              </Text>
            )}
          </Box>
        );

      case 'skipped':
        return (
          <Box flexDirection="column">
            <Alert variant="warning">
              <Text>⚠️ Connection test skipped</Text>
            </Alert>
            
            <Box marginTop={1}>
              <Text dimColor>
                Configuration saved but may need adjustment later.
              </Text>
            </Box>
          </Box>
        );

      default:
        return <Text>Unknown state</Text>;
    }
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="blue">
          Testing Connection
        </Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text dimColor>
          Verifying your {config.type} configuration...
        </Text>
      </Box>
      
      {renderContent()}
      
      {state !== 'success' && state !== 'skipped' && (
        <Box marginTop={2}>
          <Text dimColor>
            This ensures your configuration is working before saving
          </Text>
        </Box>
      )}
    </Box>
  );
};