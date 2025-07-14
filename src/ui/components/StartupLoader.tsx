import React from 'react';
import { Box } from 'ink';
import { Spinner, StatusMessage } from '@inkjs/ui';

export interface StartupLoaderProps {
  currentStep: string;
  isVisible: boolean;
  isComplete?: boolean;
}

export const StartupLoader: React.FC<StartupLoaderProps> = ({
  currentStep,
  isVisible,
  isComplete = false,
}) => {
  if (!isVisible) {
    return null;
  }

  return (
    <Box paddingX={1} paddingY={0}>
      {isComplete ? (
        <StatusMessage variant='success'>{currentStep}</StatusMessage>
      ) : (
        <Spinner label={currentStep} />
      )}
    </Box>
  );
};
