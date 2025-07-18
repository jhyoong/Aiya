/**
 * Execution Error Classes and Categorization System
 * 
 * Error categorization and analysis for shell command execution failures.
 * Updated to remove risk scoring and focus on pattern-based categorization.
 */

import { ShellExecutionError, ShellPermissionError, ShellCommandNotFoundError, ShellTimeoutError, ShellInputValidationError } from './base-errors.js';
import { ShellSecurityError, ShellCommandBlockedError, ShellPathTraversalError, ShellWorkspaceViolationError, ShellDangerousCommandError } from './security-errors.js';
import { ShellErrorType, ShellErrorContext } from '../types.js';
import type { ErrorPattern } from '../types.js';
import { ERROR_PRIORITIES } from '../constants.js';

/**
 * Configuration Error
 * 
 * Thrown when shell configuration is invalid or missing.
 */
export class ShellConfigurationError extends ShellExecutionError {
  constructor(configKey: string, reason: string, context: ShellErrorContext) {
    super(
      `Configuration error for '${configKey}': ${reason}`,
      ShellErrorType.CONFIGURATION_ERROR,
      context,
      [
        'Check configuration files',
        'Verify configuration syntax',
        'Ensure required configuration values are set',
        'Review configuration documentation',
        'Check for missing configuration files',
      ],
      false,
      400
    );
    this.name = 'ShellConfigurationError';
  }
}

/**
 * Unknown Shell Error
 * 
 * Fallback error for unclassified execution failures.
 */
export class ShellUnknownError extends ShellExecutionError {
  constructor(message: string, exitCode: number, context: ShellErrorContext) {
    super(
      `Unknown error: ${message}`,
      ShellErrorType.UNKNOWN_ERROR,
      context,
      [
        'Check the command output for specific error details',
        'Verify command syntax and arguments',
        'Try running the command with different options',
        'Check system logs for additional information',
        'Contact support if the issue persists',
      ],
      false,
      exitCode
    );
    this.name = 'ShellUnknownError';
  }
}

/**
 * Comprehensive Shell Error Categorization System
 * 
 * Analyzes shell execution errors and categorizes them with appropriate suggestions.
 * Updated to remove risk scoring functionality.
 */
export class ShellErrorCategorizer {
  private static readonly ERROR_PATTERNS: ErrorPattern[] = [
    // Permission errors (highest priority)
    {
      messagePatterns: [
        /permission denied/i,
        /access denied/i,
        /operation not permitted/i,
        /EACCES/,
        /EPERM/,
      ],
      stderrPatterns: [
        /permission denied/i,
        /access denied/i,
        /you don't have permission/i,
        /not allowed/i,
      ],
      exitCodes: [126],
      errorType: ShellErrorType.PERMISSION_ERROR,
      retryable: false,
      suggestions: [
        'Check file and directory permissions',
        'Ensure you have execute permissions for the command',
        'Verify workspace access rights',
        'Try running with appropriate permissions',
        'Check if the file or directory exists',
      ],
      priority: ERROR_PRIORITIES.PERMISSION_ERROR,
    },

    // Command not found errors
    {
      messagePatterns: [
        /command not found/i,
        /not found/i,
        /ENOENT/,
        /no such file or directory/i,
        /cannot find/i,
      ],
      stderrPatterns: [
        /command not found/i,
        /not found/i,
        /no such file or directory/i,
        /cannot find/i,
        /bad command/i,
      ],
      exitCodes: [127],
      errorType: ShellErrorType.COMMAND_NOT_FOUND,
      retryable: false,
      suggestions: [
        'Check if the command is installed',
        'Verify the command name spelling',
        'Check if the command is in your PATH',
        'Try using the full path to the command',
        'Install the required package or tool',
      ],
      priority: ERROR_PRIORITIES.COMMAND_NOT_FOUND,
    },

    // Timeout errors
    {
      messagePatterns: [
        /timeout/i,
        /timed out/i,
        /ETIMEDOUT/,
        /operation timed out/i,
        /request timeout/i,
      ],
      stderrPatterns: [/timeout/i, /timed out/i, /operation timed out/i],
      exitCodes: [-1],
      errorType: ShellErrorType.TIMEOUT_ERROR,
      retryable: true,
      suggestions: [
        'Try running the command with a longer timeout',
        'Break down the command into smaller parts',
        'Check if the command is stuck in an infinite loop',
        'Optimize the command for better performance',
        'Check network connectivity if the command involves network operations',
      ],
      priority: ERROR_PRIORITIES.TIMEOUT_ERROR,
    },

    // Path traversal and workspace violations
    {
      messagePatterns: [
        /path traversal/i,
        /outside workspace/i,
        /workspace boundary/i,
        /invalid path/i,
        /security violation/i,
      ],
      stderrPatterns: [
        /path traversal/i,
        /outside workspace/i,
        /access denied.*workspace/i,
      ],
      exitCodes: [403],
      errorType: ShellErrorType.PATH_TRAVERSAL,
      retryable: false,
      suggestions: [
        'Use paths within the workspace directory',
        'Avoid using ../ or absolute paths',
        'Check file access permissions',
        'Use relative paths from workspace root',
        'Review workspace security settings',
      ],
      priority: ERROR_PRIORITIES.SECURITY_ERROR,
    },

    // Input validation errors
    {
      messagePatterns: [
        /invalid.*input/i,
        /invalid.*command/i,
        /invalid.*argument/i,
        /invalid.*option/i,
        /syntax error/i,
        /bad.*syntax/i,
      ],
      stderrPatterns: [
        /invalid.*input/i,
        /invalid.*command/i,
        /invalid.*argument/i,
        /invalid.*option/i,
        /syntax error/i,
        /bad.*syntax/i,
        /usage:/i,
      ],
      exitCodes: [400],
      errorType: ShellErrorType.INPUT_VALIDATION,
      retryable: false,
      suggestions: [
        'Check command syntax and format',
        'Verify command arguments and options',
        'Review command documentation',
        'Avoid special characters without proper escaping',
        'Use properly formatted strings',
      ],
      priority: ERROR_PRIORITIES.INPUT_VALIDATION,
    },

    // Security and dangerous command errors
    {
      messagePatterns: [
        /command blocked/i,
        /dangerous command/i,
        /security.*blocked/i,
        /not allowed.*security/i,
        /blocked.*policy/i,
      ],
      stderrPatterns: [
        /command blocked/i,
        /dangerous command/i,
        /security.*blocked/i,
        /not allowed.*security/i,
      ],
      exitCodes: [403],
      errorType: ShellErrorType.COMMAND_BLOCKED,
      retryable: false,
      suggestions: [
        'Review the command for security risks',
        'Check if the command is in the allowed commands list',
        'Use a safer alternative command',
        'Contact administrator if this command should be allowed',
        'Review security policies and restrictions',
      ],
      priority: ERROR_PRIORITIES.SECURITY_ERROR,
    },

    // Workspace violation errors
    {
      messagePatterns: [
        /workspace.*violation/i,
        /outside.*workspace/i,
        /workspace.*boundary/i,
        /access.*denied.*workspace/i,
      ],
      stderrPatterns: [
        /workspace.*violation/i,
        /outside.*workspace/i,
        /workspace.*boundary/i,
      ],
      exitCodes: [403],
      errorType: ShellErrorType.WORKSPACE_VIOLATION,
      retryable: false,
      suggestions: [
        'Operations must be performed within the workspace directory',
        'Use relative paths from the workspace root',
        'Check workspace configuration and boundaries',
        'Avoid accessing system directories',
        'Review workspace access permissions',
      ],
      priority: ERROR_PRIORITIES.WORKSPACE_VIOLATION,
    },

    // Configuration errors
    {
      messagePatterns: [
        /configuration.*error/i,
        /config.*error/i,
        /invalid.*configuration/i,
        /missing.*configuration/i,
      ],
      stderrPatterns: [
        /configuration.*error/i,
        /config.*error/i,
        /invalid.*configuration/i,
      ],
      exitCodes: [400],
      errorType: ShellErrorType.CONFIGURATION_ERROR,
      retryable: false,
      suggestions: [
        'Check configuration files',
        'Verify configuration syntax',
        'Ensure required configuration values are set',
        'Review configuration documentation',
        'Check for missing configuration files',
      ],
      priority: ERROR_PRIORITIES.CONFIGURATION_ERROR,
    },

    // General execution errors (lowest priority)
    {
      messagePatterns: [/error/i, /failed/i, /exception/i, /abort/i, /crash/i],
      stderrPatterns: [/error/i, /failed/i, /exception/i, /abort/i],
      exitCodes: [1, 2, 3, 4, 5],
      errorType: ShellErrorType.EXECUTION_ERROR,
      retryable: true,
      suggestions: [
        'Check the command output for specific error details',
        'Verify command arguments and syntax',
        'Check if required dependencies are installed',
        'Review command documentation',
        'Try running the command in a different environment',
      ],
      priority: ERROR_PRIORITIES.EXECUTION_ERROR,
    },
  ];

  /**
   * Categorize an error based on execution context
   */
  static categorizeError(
    error: unknown,
    exitCode: number,
    stdout: string,
    stderr: string,
    command: string,
    workingDirectory: string,
    executionTime: number,
    originalError?: unknown
  ): {
    errorType: ShellErrorType;
    suggestions: string[];
    retryable: boolean;
    context: ShellErrorContext;
  } {
    const errorMessage = this.extractErrorMessage(error);
    const allText = `${errorMessage} ${stdout} ${stderr}`.toLowerCase();

    // Find the best matching pattern
    const matchingPattern = this.findBestMatchingPattern(
      errorMessage,
      stderr,
      exitCode,
      allText
    );

    const context: ShellErrorContext = {
      command,
      workingDirectory,
      exitCode,
      executionTime,
      timestamp: new Date(),
      originalError,
    };

    if (matchingPattern) {
      return {
        errorType: matchingPattern.errorType as ShellErrorType,
        suggestions: this.enhanceSuggestions(
          matchingPattern.suggestions,
          context
        ),
        retryable: matchingPattern.retryable,
        context,
      };
    }

    // Default to unknown error
    return {
      errorType: ShellErrorType.UNKNOWN_ERROR,
      suggestions: [
        'Check the command output for specific error details',
        'Verify command syntax and arguments',
        'Try running the command with different options',
        'Check system logs for additional information',
        'Contact support if the issue persists',
      ],
      retryable: false,
      context,
    };
  }

  /**
   * Create appropriate error instance based on categorization
   */
  static createCategorizedError(
    error: unknown,
    exitCode: number,
    stdout: string,
    stderr: string,
    command: string,
    workingDirectory: string,
    executionTime: number,
    originalError?: unknown
  ): ShellExecutionError {
    const categorization = this.categorizeError(
      error,
      exitCode,
      stdout,
      stderr,
      command,
      workingDirectory,
      executionTime,
      originalError
    );

    const errorMessage = this.extractErrorMessage(error);
    const context = categorization.context;

    // Create specific error types based on categorization
    switch (categorization.errorType) {
      case ShellErrorType.PERMISSION_ERROR:
        return new ShellPermissionError(
          command,
          context,
          originalError as Error
        );

      case ShellErrorType.COMMAND_NOT_FOUND:
        return new ShellCommandNotFoundError(command, context);

      case ShellErrorType.TIMEOUT_ERROR:
        return new ShellTimeoutError(command, context.timeout || 30, context);

      case ShellErrorType.PATH_TRAVERSAL:
        return new ShellPathTraversalError(command, context);

      case ShellErrorType.INPUT_VALIDATION:
        return new ShellInputValidationError(command, errorMessage, context);

      case ShellErrorType.COMMAND_BLOCKED:
        return new ShellCommandBlockedError(command, errorMessage, context);

      case ShellErrorType.WORKSPACE_VIOLATION:
        return new ShellWorkspaceViolationError(
          command,
          workingDirectory,
          context
        );

      case ShellErrorType.DANGEROUS_COMMAND:
        return new ShellDangerousCommandError(command, errorMessage, context);

      case ShellErrorType.SECURITY_ERROR:
        return new ShellSecurityError(
          errorMessage,
          context,
          'SECURITY_ERROR',
          categorization.suggestions
        );

      case ShellErrorType.CONFIGURATION_ERROR:
        return new ShellConfigurationError(
          'unknown',
          errorMessage,
          context
        );

      case ShellErrorType.UNKNOWN_ERROR:
        return new ShellUnknownError(errorMessage, exitCode, context);

      default:
        return new ShellExecutionError(
          errorMessage,
          categorization.errorType,
          context,
          categorization.suggestions,
          categorization.retryable,
          exitCode,
          originalError as Error
        );
    }
  }

  /**
   * Extract command metadata for enhanced logging
   */
  static extractCommandMetadata(command: string): {
    category: string;
    fileOperations: string[];
    networkOperations: string[];
    environmentVariables: string[];
    tags: string[];
  } {
    const metadata = {
      category: 'general',
      fileOperations: [] as string[],
      networkOperations: [] as string[],
      environmentVariables: [] as string[],
      tags: [] as string[],
    };

    const lowerCommand = command.toLowerCase();

    // Categorize command
    if (
      lowerCommand.match(/^(npm|yarn|pnpm|node|python|pip|cargo|go|dotnet)\s/)
    ) {
      metadata.category = 'development';
      metadata.tags.push('development');
    } else if (lowerCommand.match(/^(git)\s/)) {
      metadata.category = 'version-control';
      metadata.tags.push('git', 'version-control');
    } else if (lowerCommand.match(/^(docker|docker-compose)\s/)) {
      metadata.category = 'containerization';
      metadata.tags.push('docker', 'container');
    } else if (lowerCommand.match(/^(test|jest|mocha|pytest|phpunit)\s/)) {
      metadata.category = 'testing';
      metadata.tags.push('testing');
    } else if (lowerCommand.match(/^(build|make|cmake|gcc|clang)\s/)) {
      metadata.category = 'build';
      metadata.tags.push('build', 'compilation');
    } else if (lowerCommand.match(/^(ls|dir|pwd|find|grep|cat|head|tail)\s/)) {
      metadata.category = 'file-system';
      metadata.tags.push('file-system', 'read-only');
    } else if (lowerCommand.match(/^(cp|mv|rm|mkdir|rmdir|touch)\s/)) {
      metadata.category = 'file-operations';
      metadata.tags.push('file-system', 'write');
    } else if (lowerCommand.match(/^(curl|wget|ping|ssh|scp|rsync)\s/)) {
      metadata.category = 'network';
      metadata.tags.push('network');
    }

    // Extract file operations
    const fileOpPatterns = [
      /\b(cp|copy|mv|move|rm|del|mkdir|rmdir|touch|ln|link)\s+([^\s;|&<>]+)/gi,
    ];

    fileOpPatterns.forEach(pattern => {
      const matches = command.match(pattern);
      if (matches) {
        metadata.fileOperations.push(...matches);
      }
    });

    // Extract network operations
    const networkOpPatterns = [
      /\b(curl|wget|ping|ssh|scp|rsync)\s+([^\s;|&<>]+)/gi,
    ];

    networkOpPatterns.forEach(pattern => {
      const matches = command.match(pattern);
      if (matches) {
        metadata.networkOperations.push(...matches);
      }
    });

    // Extract environment variables
    const envVarPattern = /\$([A-Z_][A-Z0-9_]*)/gi;
    const envMatches = command.match(envVarPattern);
    if (envMatches) {
      metadata.environmentVariables = envMatches.map(match =>
        match.substring(1)
      );
    }

    return metadata;
  }

  // Private helper methods
  private static extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as any).message);
    }
    return String(error);
  }

  private static findBestMatchingPattern(
    errorMessage: string,
    stderr: string,
    exitCode: number,
    allText: string
  ): ErrorPattern | null {
    let bestMatch: ErrorPattern | null = null;
    let bestPriority = -1;

    for (const pattern of this.ERROR_PATTERNS) {
      let matches = false;

      // Check message patterns
      if (
        pattern.messagePatterns.some((p: RegExp) => this.matchesPattern(errorMessage, p))
      ) {
        matches = true;
      }

      // Check stderr patterns
      if (
        pattern.stderrPatterns &&
        pattern.stderrPatterns.some((p: RegExp) => this.matchesPattern(stderr, p))
      ) {
        matches = true;
      }

      // Check exit codes
      if (pattern.exitCodes && pattern.exitCodes.includes(exitCode)) {
        matches = true;
      }

      // Check overall text for general patterns
      if (pattern.messagePatterns.some((p: RegExp) => this.matchesPattern(allText, p))) {
        matches = true;
      }

      if (matches && pattern.priority > bestPriority) {
        bestMatch = pattern;
        bestPriority = pattern.priority;
      }
    }

    return bestMatch;
  }

  private static matchesPattern(
    text: string,
    pattern: string | RegExp
  ): boolean {
    if (typeof pattern === 'string') {
      return text.toLowerCase().includes(pattern.toLowerCase());
    }
    return pattern.test(text);
  }

  private static enhanceSuggestions(
    baseSuggestions: string[],
    context: ShellErrorContext
  ): string[] {
    const enhanced = [...baseSuggestions];

    // Add context-specific suggestions
    if (context.exitCode === 127) {
      enhanced.push('Check if the command is installed in your system');
    }

    if (context.exitCode === 126) {
      enhanced.push('Check if the file has executable permissions');
    }

    if (context.executionTime && context.executionTime > 30000) {
      enhanced.push(
        'Consider using a longer timeout for long-running commands'
      );
    }

    if (context.command.includes('npm') || context.command.includes('yarn')) {
      enhanced.push('Try running with --verbose flag for more detailed output');
      enhanced.push(
        'Check if node_modules directory exists and has proper permissions'
      );
    }

    if (context.command.includes('git')) {
      enhanced.push('Check if you are in a git repository');
      enhanced.push('Verify git configuration and credentials');
    }

    return enhanced;
  }
}