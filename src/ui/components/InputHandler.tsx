import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface InputHandlerProps {
  onInput: (input: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  multiline?: boolean;
}

export const InputHandler: React.FC<InputHandlerProps> = ({
  onInput,
  onCancel,
  placeholder = 'Enter your input...',
  multiline = false,
}) => {
  const [input, setInput] = useState('');
  const [isActive, setIsActive] = useState(true);

  useInput((inputChar: string, key: any) => {
    if (!isActive) return;

    if (key.escape) {
      onCancel?.();
      return;
    }

    if (key.return) {
      if (multiline && !key.ctrl) {
        setInput(prev => prev + '\n');
        return;
      }
      onInput(input);
      setInput('');
      setIsActive(false);
      return;
    }

    if (key.backspace) {
      setInput(prev => prev.slice(0, -1));
      return;
    }

    if (key.ctrl && inputChar === 'c') {
      onCancel?.();
      return;
    }

    if (inputChar && inputChar.length === 1 && !key.ctrl && !key.meta) {
      setInput(prev => prev + inputChar);
    }
  });

  return (
    <Box flexDirection="column">
      <Text color="gray">{placeholder}</Text>
      <Box>
        <Text color="blue">{'> '}</Text>
        <Text>{input}</Text>
        {isActive && <Text color="gray">{'_'}</Text>}
      </Box>
    </Box>
  );
};