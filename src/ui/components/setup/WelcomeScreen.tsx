import React from 'react';
import { Box, Text } from 'ink';
import { Alert } from '@inkjs/ui';
import { DELAYS } from '../../../core/config/timing-constants.js';

interface WelcomeScreenProps {
  onContinue: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue }) => {
  React.useEffect(() => {
    // Auto-continue after showing welcome message
    const timer = setTimeout(onContinue, DELAYS.WELCOME_AUTO_CONTINUE);
    return () => clearTimeout(timer);
  }, [onContinue]);

  return (
    <Box flexDirection='column' paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color='blue'>
          🤖 Welcome to Aiya Setup
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          This wizard will help you configure AI providers for your project.
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          You can always reconfigure later by running 'aiya init' again.
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Alert variant='info'>
          <Text>Getting started...</Text>
        </Alert>
      </Box>
    </Box>
  );
};
