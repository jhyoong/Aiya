import React from 'react';
import { Box, Text } from 'ink';
import { Select } from '@inkjs/ui';

export type ShellConfirmationChoice = 'allow-once' | 'reject' | 'allow-always';

interface ShellCommandConfirmationDialogProps {
  command: string;
  commandType: string;
  onChoice: (choice: ShellConfirmationChoice) => void;
}

export const ShellCommandConfirmationDialog: React.FC<ShellCommandConfirmationDialogProps> = ({
  command,
  commandType,
  onChoice,
}) => {
  const handleSelect = (value: string) => {
    onChoice(value as ShellConfirmationChoice);
  };

  const isDangerous = ['rm', 'sudo', 'curl', 'wget', 'chmod', 'chown', 'mv', 'cp'].includes(commandType.toLowerCase());

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="yellow">
          ⚠️  The assistant wants to execute a shell command:
        </Text>
      </Box>

      <Box 
        borderStyle="round" 
        borderColor={isDangerous ? "red" : "yellow"}
        paddingX={2} 
        paddingY={1} 
        marginBottom={1}
      >
        <Box flexDirection="column">
          <Text bold color={isDangerous ? "red" : "cyan"}>
            {isDangerous ? "🚨 " : "🔧 "}Command: {commandType}
          </Text>
          <Text dimColor wrap="wrap">
            {command}
          </Text>
        </Box>
      </Box>

      {isDangerous && (
        <Box marginBottom={1}>
          <Text bold color="red">
            ⚠️  This command could modify your system. Use caution!
          </Text>
        </Box>
      )}

      <Box marginBottom={1}>
        <Text dimColor>Use arrow keys to navigate, Enter to select</Text>
      </Box>

      <Select
        options={[
          { label: 'Allow Once', value: 'allow-once' },
          { label: `Allow Always for '${commandType}' commands`, value: 'allow-always' },
          { label: 'Reject', value: 'reject' },
        ]}
        onChange={handleSelect}
      />
    </Box>
  );
};