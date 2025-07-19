import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { LAYOUT } from '../../core/config/ui-constants.js';

interface ToolExecutionProps {
  toolName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number | undefined;
  output?: string[] | undefined;
  error?: string | undefined;
}

export const ToolExecution: React.FC<ToolExecutionProps> = ({
  toolName,
  status,
  progress,
  output = [],
  error,
}) => {
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  useEffect(() => {
    if (status === 'running') {
      const interval = setInterval(() => {
        setSpinnerFrame(prev => (prev + 1) % spinnerFrames.length);
      }, 100);

      return () => clearInterval(interval);
    }
    return undefined;
  }, [status, spinnerFrames.length]);

  const getStatusIcon = (): string => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'running':
        return spinnerFrames[spinnerFrame] || '⠋';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '⚪';
    }
  };

  const getStatusColor = (): string => {
    switch (status) {
      case 'pending':
        return 'yellow';
      case 'running':
        return 'blue';
      case 'completed':
        return 'green';
      case 'failed':
        return 'red';
      default:
        return 'gray';
    }
  };

  const renderProgressBar = () => {
    if (progress === undefined) return null;

    const barWidth = LAYOUT.PROGRESS_BAR_WIDTH;
    const filled = Math.round((progress / 100) * barWidth);
    const empty = barWidth - filled;

    return (
      <Box>
        <Text color='gray'>[</Text>
        <Text color='green'>{'█'.repeat(filled)}</Text>
        <Text color='gray'>{'░'.repeat(empty)}</Text>
        <Text color='gray'>] {progress}%</Text>
      </Box>
    );
  };

  return (
    <Box
      flexDirection='column'
      borderStyle='round'
      borderColor='gray'
      paddingX={1}
    >
      <Box>
        <Text color={getStatusColor()}>
          {getStatusIcon()} {toolName}
        </Text>
        <Text color='gray'> - {status}</Text>
      </Box>

      {renderProgressBar()}

      {output.length > 0 && (
        <Box flexDirection='column' marginTop={1}>
          <Text color='gray'>Output:</Text>
          {output.slice(-5).map((line: string, index: number) => (
            <Text key={index} color='white'>
              {line}
            </Text>
          ))}
        </Box>
      )}

      {error && (
        <Box marginTop={1}>
          <Text color='red'>Error: {error}</Text>
        </Box>
      )}
    </Box>
  );
};
