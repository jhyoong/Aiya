import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text } from 'ink';
import { Select } from '@inkjs/ui';
import {
  CommandRiskAssessment,
  CommandRiskCategory,
} from '../../core/mcp/shell.js';
import { ConfirmationResponse } from '../../core/mcp/confirmation.js';
import chalk from 'chalk';

/**
 * Props for the ConfirmationPrompt component
 */
export interface ConfirmationPromptProps {
  /** The command to be executed */
  command: string;
  /** Risk assessment details */
  riskAssessment: CommandRiskAssessment;
  /** Current working directory */
  workingDirectory: string;
  /** Whether the prompt is visible */
  isVisible: boolean;
  /** Timeout in milliseconds for the prompt */
  timeout: number;
  /** Callback when user makes a decision */
  onResponse: (response: ConfirmationResponse) => void;
  /** Callback when prompt is cancelled */
  onCancel?: () => void;
  /** Whether to show detailed information */
  showDetails?: boolean;
  /** Whether the component should be focused */
  focus?: boolean;
}

/**
 * Internal state for the confirmation prompt
 */
interface ConfirmationState {
  /** Time remaining for the prompt */
  timeLeft: number;
  /** Whether to show detailed information */
  showDetails: boolean;
  /** Whether the prompt has been resolved */
  isResolved: boolean;
}

/**
 * Configuration options for the confirmation prompt
 */
export interface ConfirmationPromptConfig {
  /** Border color for the prompt */
  borderColor?: string;
  /** Background color for the prompt */
  backgroundColor?: string;
  /** Text color for the prompt */
  textColor?: string;
  /** Color for risk indicators */
  riskColor?: string;
  /** Color for options */
  optionsColor?: string;
  /** Color for countdown */
  countdownColor?: string;
  /** Whether to show animations */
  showAnimations?: boolean;
  /** Whether to show progress bar */
  showProgressBar?: boolean;
}

/**
 * Default configuration for the confirmation prompt
 */
export const DEFAULT_CONFIG: Required<ConfirmationPromptConfig> = {
  borderColor: 'cyan',
  backgroundColor: 'black',
  textColor: 'white',
  riskColor: 'red',
  optionsColor: 'yellow',
  countdownColor: 'yellow',
  showAnimations: true,
  showProgressBar: true,
};

/**
 * Get risk color based on category
 */
function getRiskColor(category: CommandRiskCategory): string {
  switch (category) {
    case CommandRiskCategory.SAFE:
      return 'green';
    case CommandRiskCategory.LOW:
      return 'yellow';
    case CommandRiskCategory.MEDIUM:
      return 'orange';
    case CommandRiskCategory.HIGH:
      return 'red';
    case CommandRiskCategory.CRITICAL:
      return 'magenta';
    default:
      return 'white';
  }
}

/**
 * React/Ink Confirmation Prompt Component
 *
 * This component replaces the raw console-based confirmation prompt
 * with a proper React/Ink integration that works within Aiya's UI system.
 */
export const ConfirmationPrompt: React.FC<ConfirmationPromptProps> = ({
  command,
  riskAssessment,
  workingDirectory,
  isVisible,
  timeout,
  onResponse,
  showDetails = false,
}) => {
  // Component state
  const [state, setState] = useState<ConfirmationState>({
    timeLeft: Math.ceil(timeout / 1000),
    showDetails,
    isResolved: false,
  });

  // Refs for cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onResponseRef = useRef(onResponse);

  // Update onResponse ref when it changes
  useEffect(() => {
    onResponseRef.current = onResponse;
  }, [onResponse]);

  // Handle timeout countdown
  useEffect(() => {
    if (!isVisible || state.isResolved) {
      return;
    }

    // Set up timeout
    timeoutRef.current = setTimeout(() => {
      if (!state.isResolved) {
        setState(prev => ({ ...prev, isResolved: true }));
        onResponseRef.current({
          decision: 'deny',
          rememberDecision: false,
          timedOut: true,
        });
      }
    }, timeout);

    // Set up countdown interval
    intervalRef.current = setInterval(() => {
      setState(prev => {
        const newTimeLeft = prev.timeLeft - 1;
        if (newTimeLeft <= 0) {
          return { ...prev, timeLeft: 0 };
        }
        return { ...prev, timeLeft: newTimeLeft };
      });
    }, 1000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isVisible, timeout, state.isResolved]);

  // Handle user response
  const handleResponse = useCallback(
    (response: ConfirmationResponse) => {
      if (state.isResolved) return;

      setState(prev => ({ ...prev, isResolved: true }));
      onResponseRef.current(response);
    },
    [state.isResolved]
  );

  // Define select options
  const selectOptions = [
    { label: 'Allow once', value: 'allow' },
    { label: 'Deny', value: 'deny' },
    { label: 'Trust pattern (remember for session)', value: 'trust' },
    { label: 'Block pattern (remember for session)', value: 'block' },
    { label: state.showDetails ? 'Hide details' : 'Show details', value: 'toggle_details' },
  ];

  // Handle select change
  const handleSelectChange = useCallback(
    (value: string) => {
      if (state.isResolved) return;

      if (value === 'toggle_details') {
        setState(prev => ({ ...prev, showDetails: !prev.showDetails }));
        return;
      }

      const rememberDecision = value === 'trust' || value === 'block';
      handleResponse({
        decision: value as 'allow' | 'deny' | 'trust' | 'block',
        rememberDecision,
        timedOut: false,
      });
    },
    [state.isResolved, state.showDetails, handleResponse]
  );

  // Don't render if not visible or already resolved
  if (!isVisible) {
    return null;
  }

  const riskColor = getRiskColor(riskAssessment.category);
  const riskText = `${riskAssessment.category.toUpperCase()} (Score: ${riskAssessment.riskScore})`;

  // Apply color based on risk category
  let coloredRiskText: string;
  switch (riskColor) {
    case 'green':
      coloredRiskText = chalk.green.bold(riskText);
      break;
    case 'yellow':
      coloredRiskText = chalk.yellow.bold(riskText);
      break;
    case 'orange':
      coloredRiskText = chalk.hex('#FFA500').bold(riskText);
      break;
    case 'red':
      coloredRiskText = chalk.red.bold(riskText);
      break;
    case 'magenta':
      coloredRiskText = chalk.magenta.bold(riskText);
      break;
    default:
      coloredRiskText = chalk.white.bold(riskText);
      break;
  }

  return (
    <Box
      flexDirection='column'
      borderStyle='round'
      borderColor='cyan'
      paddingX={2}
      paddingY={1}
      marginY={1}
      minHeight={12}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text color='cyan' bold>
          🔍 COMMAND CONFIRMATION REQUIRED
        </Text>
      </Box>

      {/* Command Information */}
      <Box flexDirection='column' marginBottom={1}>
        <Box marginBottom={1}>
          <Text color='white' bold>
            Command:
          </Text>
          <Text color='cyan'> {command}</Text>
        </Box>
        <Box marginBottom={1}>
          <Text color='white' bold>
            Working Directory:
          </Text>
          <Text color='gray'> {workingDirectory}</Text>
        </Box>
        <Box marginBottom={1}>
          <Text color='white' bold>
            Risk Level:
          </Text>
          <Text> {coloredRiskText}</Text>
        </Box>
      </Box>

      {/* Risk Factors */}
      {riskAssessment.riskFactors.length > 0 && (
        <Box flexDirection='column' marginBottom={1}>
          <Text color='white' bold>
            Risk Factors:
          </Text>
          {riskAssessment.riskFactors.map((factor, index) => (
            <Text key={index} color='yellow'>
              • {factor}
            </Text>
          ))}
        </Box>
      )}

      {/* Potential Impact */}
      {riskAssessment.context.potentialImpact.length > 0 && (
        <Box flexDirection='column' marginBottom={1}>
          <Text color='white' bold>
            Potential Impact:
          </Text>
          {riskAssessment.context.potentialImpact.map((impact, index) => (
            <Text key={index} color='red'>
              • {impact}
            </Text>
          ))}
        </Box>
      )}

      {/* Mitigation Suggestions */}
      {riskAssessment.context.mitigationSuggestions.length > 0 && (
        <Box flexDirection='column' marginBottom={1}>
          <Text color='white' bold>
            Suggestions:
          </Text>
          {riskAssessment.context.mitigationSuggestions.map(
            (suggestion, index) => (
              <Text key={index} color='green'>
                • {suggestion}
              </Text>
            )
          )}
        </Box>
      )}

      {/* Additional Details (if requested) */}
      {state.showDetails && (
        <Box flexDirection='column' marginBottom={1}>
          <Text color='white' bold>
            Additional Details:
          </Text>
          <Text color='gray'>
            <Text bold>Command Type:</Text> {riskAssessment.context.commandType}
          </Text>
          <Text color='gray'>
            <Text bold>Requires Confirmation:</Text>{' '}
            {riskAssessment.requiresConfirmation ? 'Yes' : 'No'}
          </Text>
          <Text color='gray'>
            <Text bold>Should Block:</Text>{' '}
            {riskAssessment.shouldBlock ? 'Yes' : 'No'}
          </Text>
        </Box>
      )}

      {/* Options */}
      <Box flexDirection='column' marginBottom={1}>
        <Text color='white' bold>
          Choose an option (timeout in {state.timeLeft}s):
        </Text>
        <Select
          options={selectOptions}
          onChange={handleSelectChange}
          isDisabled={state.isResolved}
          visibleOptionCount={5}
        />
      </Box>
    </Box>
  );
};

/**
 * Hook for managing confirmation prompt state
 */
export function useConfirmationPrompt() {
  const [promptState, setPromptState] = useState<{
    isVisible: boolean;
    props: Omit<ConfirmationPromptProps, 'isVisible' | 'onResponse'> | null;
    response: ConfirmationResponse | null;
  }>({
    isVisible: false,
    props: null,
    response: null,
  });

  const showPrompt = useCallback(
    (props: Omit<ConfirmationPromptProps, 'isVisible' | 'onResponse'>) => {
      setPromptState({
        isVisible: true,
        props,
        response: null,
      });
    },
    []
  );

  const hidePrompt = useCallback(() => {
    setPromptState(prev => ({ ...prev, isVisible: false }));
  }, []);

  const handleResponse = useCallback((response: ConfirmationResponse) => {
    setPromptState(prev => ({
      ...prev,
      isVisible: false,
      response,
    }));
  }, []);

  return {
    promptState,
    showPrompt,
    hidePrompt,
    handleResponse,
  };
}

export default ConfirmationPrompt;

