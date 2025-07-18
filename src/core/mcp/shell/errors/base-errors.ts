/**
 * Base Shell Error Classes
 * 
 * Core error classes for shell command execution failures.
 * Updated to use category-based context instead of risk scores.
 */

import { MCPError } from '../../base.js';
import { ShellErrorType, ShellErrorContext } from '../types.js';

/**
 * Base Shell Execution Error
 * 
 * Common base class for all shell-related errors with enhanced context
 * and actionable suggestions for users.
 */
export class ShellExecutionError extends MCPError {
  public readonly errorType: ShellErrorType;
  public readonly context: ShellErrorContext;
  public readonly suggestions: string[];
  public readonly retryable: boolean;

  constructor(
    message: string,
    errorType: ShellErrorType,
    context: ShellErrorContext,
    suggestions: string[] = [],
    retryable: boolean = false,
    code?: number,
    cause?: Error
  ) {
    super(message, code, cause);
    this.name = 'ShellExecutionError';
    this.errorType = errorType;
    this.context = context;
    this.suggestions = suggestions;
    this.retryable = retryable;
  }

  /**
   * Convert error to JSON for logging and debugging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errorType: this.errorType,
      context: this.context,
      suggestions: this.suggestions,
      retryable: this.retryable,
      code: this.code,
      stack: this.stack,
    };
  }

  /**
   * Get a user-friendly error message with suggestions
   */
  getUserFriendlyMessage(): string {
    let message = this.message;
    
    if (this.suggestions.length > 0) {
      message += '\n\nSuggestions:';
      this.suggestions.forEach((suggestion, index) => {
        message += `\n  ${index + 1}. ${suggestion}`;
      });
    }
    
    return message;
  }

  /**
   * Check if this error should be retried
   */
  isRetryable(): boolean {
    return this.retryable;
  }

  /**
   * Get error severity based on type
   */
  getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    switch (this.errorType) {
      case ShellErrorType.SECURITY_ERROR:
      case ShellErrorType.PATH_TRAVERSAL:
      case ShellErrorType.WORKSPACE_VIOLATION:
        return 'critical';
      
      case ShellErrorType.COMMAND_BLOCKED:
      case ShellErrorType.PERMISSION_ERROR:
        return 'high';
      
      case ShellErrorType.TIMEOUT_ERROR:
      case ShellErrorType.INPUT_VALIDATION:
        return 'medium';
      
      case ShellErrorType.COMMAND_NOT_FOUND:
      case ShellErrorType.EXECUTION_ERROR:
        return 'low';
      
      default:
        return 'medium';
    }
  }
}

/**
 * Shell Input Validation Error
 * 
 * Thrown when command input fails validation checks.
 */
export class ShellInputValidationError extends ShellExecutionError {
  constructor(input: string, reason: string, context: ShellErrorContext) {
    super(
      `Input validation failed for: ${input}. Reason: ${reason}`,
      ShellErrorType.INPUT_VALIDATION,
      context,
      [
        'Check command syntax and format',
        'Avoid special characters and control sequences',
        'Ensure command length is within limits',
        'Use properly escaped strings',
      ],
      false, // Input validation errors are not retryable
      400
    );
    this.name = 'ShellInputValidationError';
  }
}

/**
 * Shell Timeout Error
 * 
 * Thrown when command execution exceeds the configured timeout.
 */
export class ShellTimeoutError extends ShellExecutionError {
  constructor(
    command: string,
    timeoutSeconds: number,
    context: ShellErrorContext
  ) {
    super(
      `Command timed out after ${timeoutSeconds} seconds: ${command}`,
      ShellErrorType.TIMEOUT_ERROR,
      context,
      [
        'Try running the command with a longer timeout',
        'Break down the command into smaller parts',
        'Check if the command is stuck in an infinite loop',
        'Optimize the command for better performance',
      ],
      true, // Timeout errors are retryable
      -1
    );
    this.name = 'ShellTimeoutError';
  }
}

/**
 * Shell Permission Error
 * 
 * Thrown when command execution fails due to insufficient permissions.
 */
export class ShellPermissionError extends ShellExecutionError {
  constructor(command: string, context: ShellErrorContext, cause?: Error) {
    super(
      `Permission denied: ${command}`,
      ShellErrorType.PERMISSION_ERROR,
      context,
      [
        'Check file and directory permissions',
        'Ensure you have execute permissions for the command',
        'Verify workspace access rights',
        'Try running with appropriate permissions',
      ],
      false, // Permission errors are not retryable
      126,
      cause
    );
    this.name = 'ShellPermissionError';
  }
}

/**
 * Shell Command Not Found Error
 * 
 * Thrown when the specified command cannot be found in the system PATH.
 */
export class ShellCommandNotFoundError extends ShellExecutionError {
  constructor(command: string, context: ShellErrorContext) {
    super(
      `Command not found: ${command}`,
      ShellErrorType.COMMAND_NOT_FOUND,
      context,
      [
        'Check if the command is installed',
        'Verify the command name spelling',
        'Check if the command is in your PATH',
        'Try using the full path to the command',
      ],
      false, // Command not found errors are not retryable
      127
    );
    this.name = 'ShellCommandNotFoundError';
  }
}

/**
 * Generic Shell Execution Error
 * 
 * Thrown for general command execution failures that don't fit other categories.
 */
export class ShellGeneralExecutionError extends ShellExecutionError {
  constructor(
    command: string,
    exitCode: number,
    stderr: string,
    context: ShellErrorContext
  ) {
    const message = `Command failed with exit code ${exitCode}: ${command}${stderr ? `\nError: ${stderr}` : ''}`;
    
    super(
      message,
      ShellErrorType.EXECUTION_ERROR,
      context,
      [
        'Check the command syntax and arguments',
        'Verify that all required files and resources exist',
        'Review the error output for specific details',
        'Try running the command manually to diagnose the issue',
      ],
      true, // General execution errors may be retryable
      exitCode
    );
    this.name = 'ShellGeneralExecutionError';
  }
}