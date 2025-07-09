import React, { useCallback } from 'react';
import { Box, Text } from 'ink';
import { TextBuffer } from '../core/TextBuffer.js';
import { SuggestionEngine, SuggestionResult } from '../../cli/suggestions.js';
import { cpSlice, cpLen } from '../utils/textUtils.js';
import { useKeypress } from '../hooks/useKeypress.js';
import chalk from 'chalk';
import stringWidth from 'string-width';

export interface UnifiedInputProps {
  buffer: TextBuffer;
  onSubmit?: (text: string) => void;
  onCancel?: () => void;
  onTab?: () => void;
  onEscape?: () => void;
  suggestionEngine?: SuggestionEngine;
  showSuggestions?: boolean;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  borderColor?: string;
  focusColor?: string;
  textColor?: string;
  placeholderColor?: string;
  suggestionColor?: string;
  inputWidth: number;
  focus?: boolean;
}

export function UnifiedInput({
  buffer,
  onSubmit,
  onCancel,
  onTab,
  onEscape,
  suggestionEngine,
  showSuggestions = true,
  placeholder = 'Type your message...',
  prefix = '',
  suffix = '',
  borderColor = 'blue',
  focusColor = 'cyan',
  textColor = 'white',
  placeholderColor = 'gray',
  suggestionColor = 'yellow',
  inputWidth,
  focus = true,
}: UnifiedInputProps) {
  const [currentSuggestion, setCurrentSuggestion] = React.useState<SuggestionResult | null>(null);

  // Handle tab completion
  const handleTabCompletion = useCallback(() => {
    if (currentSuggestion) {
      const newText = currentSuggestion.completionText;
      if (newText !== buffer.text) {
        buffer.setText(newText);
      }
    }
    
    if (onTab) {
      onTab();
    }
  }, [currentSuggestion, buffer, onTab]);

  // Handle keyboard input using useKeypress hook
  const handleKeypress = useCallback((key: any) => {
    if (!focus) {
      return;
    }

    // Handle component-level keys before passing to TextBuffer
    if (key.name === 'return') {
      if (onSubmit) {
        onSubmit(buffer.text);
      }
      return;
    }

    if (key.name === 'escape') {
      if (onEscape) {
        onEscape();
      }
      return;
    }

    if (key.name === 'tab') {
      handleTabCompletion();
      return;
    }

    if (key.ctrl && (key.name === 'c' || key.name === 'd')) {
      if (onCancel) {
        onCancel();
      }
      return;
    }

    // Pass all other keys directly to TextBuffer - no adaptation needed!
    try {
      buffer.handleInput(key);
    } catch (error) {
      console.error('Error handling input in TextBuffer:', error, { key });
    }
  }, [focus, buffer, onSubmit, onEscape, onCancel, handleTabCompletion]);

  // Set up input handling with useKeypress
  useKeypress(handleKeypress, { isActive: focus });

  // Update suggestions when text changes
  React.useEffect(() => {
    if (suggestionEngine && showSuggestions) {
      const suggestion = suggestionEngine.getSuggestion(buffer.text);
      setCurrentSuggestion(suggestion);
    }
  }, [buffer.text, suggestionEngine, showSuggestions]);

  const renderInputText = () => {
    const linesToRender = buffer.viewportVisualLines;
    const [cursorVisualRowAbsolute, cursorVisualColAbsolute] = buffer.visualCursor;
    const scrollVisualRow = buffer.visualScrollRow;

    if (buffer.text.length === 0 && placeholder) {
      return focus ? (
        <Text>
          {chalk.inverse(placeholder.slice(0, 1))}
          <Text color={placeholderColor}>{placeholder.slice(1)}</Text>
        </Text>
      ) : (
        <Text color={placeholderColor}>{placeholder}</Text>
      );
    }

    return (
      <Box flexDirection="column">
        {linesToRender.map((lineText, visualIdxInRenderedSet) => {
          const cursorVisualRow = cursorVisualRowAbsolute - scrollVisualRow;
          let display = cpSlice(lineText, 0, inputWidth);
          const currentVisualWidth = stringWidth(display);
          
          if (currentVisualWidth < inputWidth) {
            display = display + ' '.repeat(inputWidth - currentVisualWidth);
          }

          if (visualIdxInRenderedSet === cursorVisualRow) {
            const relativeVisualColForHighlight = cursorVisualColAbsolute;
            if (relativeVisualColForHighlight >= 0) {
              if (relativeVisualColForHighlight < cpLen(display)) {
                const charToHighlight =
                  cpSlice(
                    display,
                    relativeVisualColForHighlight,
                    relativeVisualColForHighlight + 1,
                  ) || ' ';
                const highlighted = chalk.inverse(charToHighlight);
                display =
                  cpSlice(display, 0, relativeVisualColForHighlight) +
                  highlighted +
                  cpSlice(display, relativeVisualColForHighlight + 1);
              } else if (
                relativeVisualColForHighlight === cpLen(display) &&
                cpLen(display) === inputWidth
              ) {
                display = display + chalk.inverse(' ');
              }
            }
          }
          
          return (
            <Text key={`line-${visualIdxInRenderedSet}`}>{display}</Text>
          );
        })}
      </Box>
    );
  };

  const renderSuggestion = () => {
    if (!currentSuggestion || !showSuggestions || !focus) {
      return null;
    }

    if (buffer.text === currentSuggestion.completionText) {
      return null;
    }

    return (
      <Box marginTop={1}>
        <Text color={suggestionColor}>
          💡 {currentSuggestion.displayText}
        </Text>
        <Text color={placeholderColor}> (Tab to complete)</Text>
      </Box>
    );
  };

  const borderColorToUse = focus ? focusColor : borderColor;

  return (
    <Box flexDirection="column">
      <Box 
        borderStyle="round" 
        borderColor={borderColorToUse}
        paddingX={1}
        paddingY={0}
        minHeight={1}
      >
        <Box flexDirection="row" width="100%">
          {prefix && <Text color={textColor}>{prefix}</Text>}
          <Box flexGrow={1}>
            {renderInputText()}
          </Box>
          {suffix && <Text color={textColor}>{suffix}</Text>}
        </Box>
      </Box>
      {renderSuggestion()}
    </Box>
  );
}

export default UnifiedInput;