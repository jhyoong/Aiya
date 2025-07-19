import React from 'react';
import { Box, Text } from 'ink';
import { Select } from '@inkjs/ui';

export type ConfirmationChoice = 'allow-once' | 'reject' | 'allow-always';

export interface ConfirmationDialogChoice {
  label: string;
  value: ConfirmationChoice;
}

interface GenericConfirmationDialogProps {
  title: string;
  content: React.ReactNode;
  warningMessage?: string;
  choices?: ConfirmationDialogChoice[];
  onChoice: (choice: ConfirmationChoice) => void;
}

export const GenericConfirmationDialog: React.FC<
  GenericConfirmationDialogProps
> = ({ title, content, warningMessage, choices, onChoice }) => {
  const defaultChoices: ConfirmationDialogChoice[] = [
    { label: 'Allow Once', value: 'allow-once' },
    { label: 'Allow Always', value: 'allow-always' },
    { label: 'Reject', value: 'reject' },
  ];

  const handleSelect = (value: string) => {
    onChoice(value as ConfirmationChoice);
  };

  return (
    <Box flexDirection='column' paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color='yellow'>
          ⚠️ {title}
        </Text>
      </Box>

      <Box
        borderStyle='round'
        borderColor='yellow'
        paddingX={2}
        paddingY={1}
        marginBottom={1}
      >
        {content}
      </Box>

      {warningMessage && (
        <Box marginBottom={1}>
          <Text bold color='red'>
            ⚠️ {warningMessage}
          </Text>
        </Box>
      )}

      <Box marginBottom={1}>
        <Text dimColor>Use arrow keys to navigate, Enter to select</Text>
      </Box>

      <Select options={choices || defaultChoices} onChange={handleSelect} />
    </Box>
  );
};

// Backward compatible ToolConfirmationDialog
export interface ToolConfirmationDialogProps {
  toolCalls: Array<{
    name: string;
    arguments: any;
  }>;
  onChoice: (choice: ConfirmationChoice) => void;
}

export const ToolConfirmationDialog: React.FC<ToolConfirmationDialogProps> = ({
  toolCalls,
  onChoice,
}) => {
  const formatArguments = (args: any): string => {
    return Object.entries(args)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(', ');
  };

  const content = (
    <>
      {toolCalls.map((tool, index) => (
        <Box
          key={index}
          flexDirection='column'
          marginBottom={index < toolCalls.length - 1 ? 1 : 0}
        >
          <Text bold color='cyan'>
            • {tool.name}
          </Text>
          <Text dimColor> {formatArguments(tool.arguments)}</Text>
        </Box>
      ))}
    </>
  );

  return (
    <GenericConfirmationDialog
      title='The assistant wants to execute the following tools:'
      content={content}
      onChoice={onChoice}
    />
  );
};

// Backward compatible ShellCommandConfirmationDialog
export interface ShellCommandConfirmationDialogProps {
  command: string;
  commandType: string;
  onChoice: (choice: ConfirmationChoice) => void;
}

export const ShellCommandConfirmationDialog: React.FC<
  ShellCommandConfirmationDialogProps
> = ({ command, commandType, onChoice }) => {
  const isDangerous = [
    'rm',
    'sudo',
    'curl',
    'wget',
    'chmod',
    'chown',
    'mv',
    'cp',
  ].includes(commandType.toLowerCase());

  const content = (
    <Box flexDirection='column'>
      <Text bold color={isDangerous ? 'red' : 'cyan'}>
        {isDangerous ? '🚨 ' : '🔧 '}Command: {commandType}
      </Text>
      <Text dimColor wrap='wrap'>
        {command}
      </Text>
    </Box>
  );

  const customChoices: ConfirmationDialogChoice[] = [
    { label: 'Allow Once', value: 'allow-once' },
    {
      label: `Allow Always for '${commandType}' commands`,
      value: 'allow-always',
    },
    { label: 'Reject', value: 'reject' },
  ];

  const warningMessage = isDangerous
    ? 'This command could modify your system. Use caution!'
    : undefined;

  const props: any = {
    title: 'The assistant wants to execute a shell command:',
    content: content,
    choices: customChoices,
    onChoice: onChoice,
  };

  if (warningMessage) {
    props.warningMessage = warningMessage;
  }

  return <GenericConfirmationDialog {...props} />;
};

// Re-export types for backward compatibility
export type ToolConfirmationChoice = ConfirmationChoice;
export type ShellConfirmationChoice = ConfirmationChoice;
