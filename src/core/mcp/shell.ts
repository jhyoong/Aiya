import {
  MCPClient,
  Tool,
  ToolResult,
  MCPServerInfo,
  MCPError,
} from './base.js';
import { WorkspaceSecurity } from '../security/workspace.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { performance } from 'perf_hooks';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as fs from 'fs';

/**
 * Parameters for shell command execution
 */
export interface ShellExecuteParams {
  command: string;
  cwd?: string;
  timeout?: number;
}

/**
 * Result of shell command execution
 */
export interface ShellExecuteResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

/**
 * Shell Error Types for comprehensive error classification
 */
export enum ShellErrorType {
  EXECUTION_ERROR = 'execution_error',
  SECURITY_ERROR = 'security_error',
  PERMISSION_ERROR = 'permission_error',
  TIMEOUT_ERROR = 'timeout_error',
  COMMAND_NOT_FOUND = 'command_not_found',
  INPUT_VALIDATION = 'input_validation',
  WORKSPACE_VIOLATION = 'workspace_violation',
  PATH_TRAVERSAL = 'path_traversal',
  COMMAND_BLOCKED = 'command_blocked',
  DANGEROUS_COMMAND = 'dangerous_command',
  CONFIGURATION_ERROR = 'configuration_error',
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * Shell Error Context for comprehensive error tracking
 */
export interface ShellErrorContext {
  command: string;
  workingDirectory: string;
  timeout?: number;
  exitCode?: number;
  executionTime?: number;
  riskScore?: number;
  securityEvent?: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  originalError?: unknown;
}

/**
 * Base Shell Execution Error extending MCPError with enhanced context
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
}

/**
 * Shell Security Error for security violations
 */
export class ShellSecurityError extends ShellExecutionError {
  constructor(
    message: string,
    context: ShellErrorContext,
    securityType: string,
    suggestions: string[] = [],
    cause?: Error
  ) {
    super(
      message,
      ShellErrorType.SECURITY_ERROR,
      { ...context, securityEvent: securityType },
      suggestions,
      false, // Security errors are not retryable
      403,
      cause
    );
    this.name = 'ShellSecurityError';
  }
}

/**
 * Shell Command Blocked Error for blocked commands
 */
export class ShellCommandBlockedError extends ShellExecutionError {
  constructor(command: string, reason: string, context: ShellErrorContext) {
    super(
      `Command blocked: ${command}. Reason: ${reason}`,
      ShellErrorType.COMMAND_BLOCKED,
      { ...context, securityEvent: 'COMMAND_BLOCKED' },
      [
        'Review the command for security risks',
        'Check if the command is in the allowed commands list',
        'Use a safer alternative command',
        'Contact administrator if this command should be allowed'
      ],
      false, // Security errors are not retryable
      403
    );
    this.name = 'ShellCommandBlockedError';
  }
}

/**
 * Shell Path Traversal Error for path traversal attempts
 */
export class ShellPathTraversalError extends ShellExecutionError {
  constructor(path: string, context: ShellErrorContext) {
    super(
      `Path traversal attempt detected: ${path}`,
      ShellErrorType.PATH_TRAVERSAL,
      { ...context, securityEvent: 'PATH_TRAVERSAL' },
      [
        'Use paths within the workspace directory',
        'Avoid using ../ or absolute paths',
        'Check file access permissions',
        'Use relative paths from workspace root'
      ],
      false, // Security errors are not retryable
      403
    );
    this.name = 'ShellPathTraversalError';
  }
}

/**
 * Shell Input Validation Error for input validation failures
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
        'Use properly escaped strings'
      ],
      false, // Input validation errors are not retryable
      400
    );
    this.name = 'ShellInputValidationError';
  }
}

/**
 * Shell Timeout Error for command timeouts
 */
export class ShellTimeoutError extends ShellExecutionError {
  constructor(command: string, timeoutSeconds: number, context: ShellErrorContext) {
    super(
      `Command timed out after ${timeoutSeconds} seconds: ${command}`,
      ShellErrorType.TIMEOUT_ERROR,
      context,
      [
        'Try running the command with a longer timeout',
        'Break down the command into smaller parts',
        'Check if the command is stuck in an infinite loop',
        'Optimize the command for better performance'
      ],
      true, // Timeout errors are retryable
      -1
    );
    this.name = 'ShellTimeoutError';
  }
}

/**
 * Shell Permission Error for permission-related failures
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
        'Try running with appropriate permissions'
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
        'Try using the full path to the command'
      ],
      false, // Command not found errors are not retryable
      127
    );
    this.name = 'ShellCommandNotFoundError';
  }
}

/**
 * Shell Workspace Violation Error
 */
export class ShellWorkspaceViolationError extends ShellSecurityError {
  constructor(command: string, path: string, context: ShellErrorContext) {
    super(
      `Workspace violation: ${command} attempted to access ${path}`,
      context,
      'WORKSPACE_VIOLATION',
      [
        'Operations must be performed within the workspace directory',
        'Use relative paths from the workspace root',
        'Check workspace configuration and boundaries',
        'Avoid accessing system directories'
      ]
    );
    this.name = 'ShellWorkspaceViolationError';
  }
}

/**
 * Shell Dangerous Command Error
 */
export class ShellDangerousCommandError extends ShellSecurityError {
  constructor(command: string, reason: string, context: ShellErrorContext) {
    super(
      `Dangerous command detected: ${command}. Reason: ${reason}`,
      context,
      'DANGEROUS_COMMAND',
      [
        'Use safer alternatives to accomplish the task',
        'Review the command for potential risks',
        'Consider breaking down into smaller, safer operations',
        'Contact administrator if this operation is necessary'
      ]
    );
    this.name = 'ShellDangerousCommandError';
  }
}

/**
 * Error Pattern for Shell Error Categorization
 */
export interface ShellErrorPattern {
  /** Patterns to match in error messages */
  messagePatterns: (string | RegExp)[];
  
  /** Patterns to match in stderr output */
  stderrPatterns?: (string | RegExp)[];
  
  /** Exit codes that indicate this error type */
  exitCodes?: number[];
  
  /** Error type to assign when pattern matches */
  errorType: ShellErrorType;
  
  /** Whether this error type is retryable */
  retryable: boolean;
  
  /** Default suggestions for this error type */
  suggestions: string[];
  
  /** Priority for pattern matching (higher priority wins) */
  priority: number;
}

/**
 * Comprehensive Shell Error Categorization System
 * Analyzes shell execution errors and categorizes them with appropriate suggestions
 */
export class ShellErrorCategorizer {
  private static readonly ERROR_PATTERNS: ShellErrorPattern[] = [
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
      priority: 100,
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
      priority: 90,
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
      stderrPatterns: [
        /timeout/i,
        /timed out/i,
        /operation timed out/i,
      ],
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
      priority: 80,
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
      priority: 95,
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
      priority: 70,
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
      priority: 85,
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
      priority: 85,
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
      priority: 60,
    },
    
    // General execution errors (lowest priority)
    {
      messagePatterns: [
        /error/i,
        /failed/i,
        /exception/i,
        /abort/i,
        /crash/i,
      ],
      stderrPatterns: [
        /error/i,
        /failed/i,
        /exception/i,
        /abort/i,
      ],
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
      priority: 10,
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
        errorType: matchingPattern.errorType,
        suggestions: this.enhanceSuggestions(matchingPattern.suggestions, context),
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
        return new ShellPermissionError(command, context, originalError as Error);
        
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
        return new ShellWorkspaceViolationError(command, workingDirectory, context);
        
      case ShellErrorType.DANGEROUS_COMMAND:
        return new ShellDangerousCommandError(command, errorMessage, context);
        
      case ShellErrorType.SECURITY_ERROR:
        return new ShellSecurityError(errorMessage, context, 'SECURITY_ERROR', categorization.suggestions);
        
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
   * Analyze command risk based on patterns and context
   */
  static analyzeCommandRisk(
    command: string,
    workingDirectory: string,
    executionTime: number
  ): {
    riskScore: number;
    riskFactors: string[];
    category: string;
  } {
    let riskScore = 0;
    const riskFactors: string[] = [];
    
    // Command-based risk factors
    if (command.includes('rm')) {
      riskScore += 30;
      riskFactors.push('File deletion command');
    }
    
    if (command.includes('curl') || command.includes('wget')) {
      riskScore += 20;
      riskFactors.push('Network download command');
    }
    
    if (command.includes('sudo') || command.includes('su')) {
      riskScore += 50;
      riskFactors.push('Privilege escalation command');
    }
    
    if (command.includes('chmod') || command.includes('chown')) {
      riskScore += 25;
      riskFactors.push('Permission modification command');
    }
    
    if (command.includes('|') || command.includes(';') || command.includes('&&')) {
      riskScore += 15;
      riskFactors.push('Command chaining or piping');
    }
    
    if (command.includes('*') || command.includes('?')) {
      riskScore += 10;
      riskFactors.push('Wildcard patterns');
    }
    
    if (command.includes('..')) {
      riskScore += 35;
      riskFactors.push('Path traversal patterns');
    }
    
    // Execution time risk factors
    if (executionTime > 30000) {
      riskScore += 15;
      riskFactors.push('Long execution time');
    }
    
    // Working directory risk factors
    if (workingDirectory.includes('/tmp') || workingDirectory.includes('temp')) {
      riskScore += 10;
      riskFactors.push('Temporary directory usage');
    }
    
    // Determine category
    let category = 'safe';
    if (riskScore > 70) {
      category = 'dangerous';
    } else if (riskScore > 30) {
      category = 'moderate';
    }
    
    return {
      riskScore: Math.min(riskScore, 100),
      riskFactors,
      category,
    };
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
    if (lowerCommand.match(/^(npm|yarn|pnpm|node|python|pip|cargo|go|dotnet)\s/)) {
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
      metadata.environmentVariables = envMatches.map(match => match.substring(1));
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
  ): ShellErrorPattern | null {
    let bestMatch: ShellErrorPattern | null = null;
    let bestPriority = -1;
    
    for (const pattern of this.ERROR_PATTERNS) {
      let matches = false;
      
      // Check message patterns
      if (pattern.messagePatterns.some(p => this.matchesPattern(errorMessage, p))) {
        matches = true;
      }
      
      // Check stderr patterns
      if (pattern.stderrPatterns && pattern.stderrPatterns.some(p => this.matchesPattern(stderr, p))) {
        matches = true;
      }
      
      // Check exit codes
      if (pattern.exitCodes && pattern.exitCodes.includes(exitCode)) {
        matches = true;
      }
      
      // Check overall text for general patterns
      if (pattern.messagePatterns.some(p => this.matchesPattern(allText, p))) {
        matches = true;
      }
      
      if (matches && pattern.priority > bestPriority) {
        bestMatch = pattern;
        bestPriority = pattern.priority;
      }
    }
    
    return bestMatch;
  }

  private static matchesPattern(text: string, pattern: string | RegExp): boolean {
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
      enhanced.push('Consider using a longer timeout for long-running commands');
    }
    
    if (context.command.includes('npm') || context.command.includes('yarn')) {
      enhanced.push('Try running with --verbose flag for more detailed output');
      enhanced.push('Check if node_modules directory exists and has proper permissions');
    }
    
    if (context.command.includes('git')) {
      enhanced.push('Check if you are in a git repository');
      enhanced.push('Verify git configuration and credentials');
    }
    
    return enhanced;
  }
}

/**
 * Dangerous Command Detection System
 */
export class DangerousCommandDetector {
  private static readonly DANGEROUS_COMMANDS = [
    // System destruction commands
    'rm -rf /',
    'rm -rf /*',
    'rm -rf ~/',
    'rm -rf *',
    'format',
    'format c:',
    'dd if=/dev/zero',
    'dd if=/dev/random',
    'dd if=/dev/urandom',
    'mkfs',
    'fdisk',
    'parted',
    
    // Fork bombs and resource exhaustion
    ':(){ :|:& };:',
    ':(){ :|: & };:',
    'while true; do',
    'for((;;))',
    
    // Network and remote execution
    'curl.*|.*bash',
    'wget.*|.*bash',
    'curl.*|.*sh',
    'wget.*|.*sh',
    'nc -l',
    'netcat -l',
    
    // System access and privilege escalation
    'sudo',
    'su -',
    'su root',
    'passwd',
    'chpasswd',
    'chmod 777',
    'chmod -R 777',
    'chown -R',
    'sudo rm',
    'sudo systemctl',
    'chown root:root',
    
    // System configuration
    'systemctl',
    'service',
    'init',
    'reboot',
    'shutdown',
    'halt',
    'poweroff',
    
    // Dangerous file operations
    'truncate -s 0',
    'shred',
    'wipe',
    'srm',
    
    // Process manipulation
    'kill -9 1',
    'killall -9',
    'pkill -9',
    
    // System directories access
    'cd /etc',
    'cd /usr',
    'cd /bin',
    'cd /sbin',
    'cd /var',
    'cd /root',
    'cd /home/',
    'cd ~/',
    
    // Dangerous redirections
    '> /dev/sda',
    '> /dev/hda',
    '> /etc/',
    '> /usr/',
    '> /bin/',
  ];

  private static readonly DANGEROUS_PATTERNS = [
    // Path traversal patterns
    /\.\.\/+/,
    /\/\.\.\/+/,
    /\.\.\\+/,
    /\\\.\.\\+/,
    /\/\.\.\/.*\/etc/,
    /\/\.\.\/.*\/usr/,
    /\/\.\.\/.*\/var/,
    /\.\..*\/etc\/passwd/,
    /\.\..*\/etc\/shadow/,
    
    // System path access
    /^\/etc\//,
    /^\/usr\//,
    /^\/bin\//,
    /^\/sbin\//,
    /^\/var\//,
    /^\/root\//,
    /^\/home\/[^\/]+\//,
    /^~\//,
    /\/etc\/passwd/,
    /\/etc\/shadow/,
    /\/usr\/bin/,
    /\/var\/log/,
    /\/tmp\/.*malicious/,
    
    // Command injection patterns
    /;\s*rm\s/,
    /;\s*sudo\s/,
    /;\s*su\s/,
    /&&\s*rm\s/,
    /\|\s*rm\s/,
    /`.*rm\s/,
    /\$\(.*rm\s/,
    
    // Privilege escalation patterns
    /sudo\s+rm/,
    /sudo\s+systemctl/,
    /sudo\s+chmod/,
    /sudo\s+chown/,
    /chown\s+root:root/,
    /chmod\s+777\s+\/etc/,
    
    // Dangerous redirections
    />\s*\/dev\/[sh]d[a-z]/,
    />\s*\/etc\//,
    />\s*\/usr\//,
    />\s*\/bin\//,
    
    // Network command patterns
    /curl\s+.*\|\s*(bash|sh)/,
    /wget\s+.*\|\s*(bash|sh)/,
    /nc\s+-l/,
    /netcat\s+-l/,
    
    // Fork bomb patterns
    /:\(\)\s*\{.*\|\s*:\s*&\s*\}\s*;:\s*/,
    /while\s+true.*do/,
    /for\s*\(\(;;?\)\)/,
  ];

  static isDangerous(command: string): { dangerous: boolean; reason?: string } {
    const normalizedCommand = command.toLowerCase().trim();
    
    // Check exact matches
    for (const dangerousCmd of this.DANGEROUS_COMMANDS) {
      if (normalizedCommand.includes(dangerousCmd.toLowerCase())) {
        return { 
          dangerous: true, 
          reason: `Contains dangerous command: ${dangerousCmd}` 
        };
      }
    }
    
    // Check patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        return { 
          dangerous: true, 
          reason: `Matches dangerous pattern: ${pattern}` 
        };
      }
    }
    
    return { dangerous: false };
  }

  static calculateRiskScore(command: string): number {
    let score = 0;
    const normalizedCommand = command.toLowerCase();
    
    // Base risk factors
    if (normalizedCommand.includes('rm')) score += 30;
    if (normalizedCommand.includes('sudo')) score += 40;
    if (normalizedCommand.includes('chmod')) score += 20;
    if (normalizedCommand.includes('chown')) score += 20;
    if (normalizedCommand.includes('curl') || normalizedCommand.includes('wget')) score += 15;
    if (normalizedCommand.includes('bash') || normalizedCommand.includes('sh')) score += 10;
    if (normalizedCommand.includes('|')) score += 10;
    if (normalizedCommand.includes(';')) score += 10;
    if (normalizedCommand.includes('&')) score += 10;
    if (normalizedCommand.includes('*')) score += 15;
    if (normalizedCommand.includes('..')) score += 25;
    if (normalizedCommand.includes('/etc/') || normalizedCommand.includes('/usr/')) score += 30;
    
    return Math.min(score, 100);
  }
}

/**
 * Command Input Sanitization and Validation System
 */
export class CommandSanitizer {

  private static readonly SHELL_EXPANSION_PATTERNS = [
    // Command substitution
    /`[^`]*`/g,
    /\$\([^)]*\)/g,
    
    // Variable expansion
    /\$\{[^}]*\}/g,
    /\$[A-Za-z_][A-Za-z0-9_]*/g,
    
    // Glob patterns that could be dangerous
    /\*\*/g,
    /\?\?+/g,
    
    // History expansion
    /![^!]*!/g,
    
    // Process substitution
    /<\([^)]*\)/g,
    />\([^)]*\)/g,
  ];

  static validateInput(command: string): { valid: boolean; reason?: string; sanitized?: string } {
    if (!command || typeof command !== 'string') {
      return { valid: false, reason: 'Command must be a non-empty string' };
    }

    if (command.length > 1000) {
      return { valid: false, reason: 'Command exceeds maximum length of 1000 characters' };
    }

    if (command.trim().length === 0) {
      return { valid: false, reason: 'Command cannot be empty or only whitespace' };
    }

    // Check for null bytes or control characters
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(command)) {
      return { valid: false, reason: 'Command contains invalid control characters' };
    }

    // Check for dangerous shell expansion patterns
    for (const pattern of this.SHELL_EXPANSION_PATTERNS) {
      if (pattern.test(command)) {
        return { 
          valid: false, 
          reason: `Command contains dangerous shell expansion pattern: ${pattern}` 
        };
      }
    }

    // Check for command injection patterns
    if (this.containsCommandInjection(command)) {
      return { 
        valid: false, 
        reason: 'Command contains potential command injection patterns' 
      };
    }

    // Sanitize the command
    const sanitized = this.sanitizeCommand(command);
    
    return { valid: true, sanitized };
  }

  static sanitizeCommand(command: string): string {
    let sanitized = command;
    
    // Remove excessive whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    // Remove dangerous Unicode characters
    sanitized = sanitized.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    // Remove potentially dangerous escape sequences
    sanitized = sanitized.replace(/\\x[0-9a-fA-F]{2}/g, '');
    sanitized = sanitized.replace(/\\u[0-9a-fA-F]{4}/g, '');
    sanitized = sanitized.replace(/\\U[0-9a-fA-F]{8}/g, '');
    
    return sanitized;
  }

  private static containsCommandInjection(command: string): boolean {
    // Check for command chaining that could be used for injection
    const chainPatterns = [
      // Command chaining with dangerous commands
      /;\s*rm\s/,
      /;\s*sudo\s/,
      /;\s*su\s/,
      /;\s*chmod\s/,
      /;\s*chown\s/,
      /;\s*curl\s/,
      /;\s*wget\s/,
      
      // Background command execution
      /&\s*rm\s/,
      /&\s*sudo\s/,
      /&\s*curl\s/,
      /&\s*wget\s/,
      
      // Pipe to dangerous commands
      /\|\s*rm\s/,
      /\|\s*sudo\s/,
      /\|\s*bash\s/,
      /\|\s*sh\s/,
      /\|\s*eval\s/,
      
      // Logical operators with dangerous commands
      /&&\s*rm\s/,
      /&&\s*sudo\s/,
      /\|\|\s*rm\s/,
      /\|\|\s*sudo\s/,
    ];

    for (const pattern of chainPatterns) {
      if (pattern.test(command)) {
        return true;
      }
    }

    return false;
  }

  static extractFilePathsFromCommand(command: string): string[] {
    const paths: string[] = [];
    
    // Simple regex to extract potential file paths
    // This is a basic implementation - could be enhanced
    const pathPatterns = [
      // Absolute paths
      /\/[^\s;|&<>]+/g,
      // Relative paths with directory traversal
      /\.\.\/[^\s;|&<>]+/g,
      // Home directory paths
      /~\/[^\s;|&<>]+/g,
      // Current directory paths
      /\.\/[^\s;|&<>]+/g,
    ];

    for (const pattern of pathPatterns) {
      const matches = command.match(pattern);
      if (matches) {
        paths.push(...matches);
      }
    }

    return paths;
  }

  static isSimpleCommand(command: string): boolean {
    // Check if command is a simple command without chaining, pipes, etc.
    const complexPatterns = [
      /[;|&]/,  // Command chaining or pipes
      /[<>]/,   // Redirections
      /[`$]/,   // Command substitution or variable expansion
      /[{}]/,   // Brace expansion
      /[*?]/,   // Glob patterns
    ];

    for (const pattern of complexPatterns) {
      if (pattern.test(command)) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Enhanced Workspace Boundary Enforcement System
 */
export class WorkspaceBoundaryEnforcer {
  private security: WorkspaceSecurity;

  constructor(security: WorkspaceSecurity) {
    this.security = security;
  }

  validateCommandPaths(command: string): { valid: boolean; reason?: string; validatedPaths?: string[] } {
    const extractedPaths = CommandSanitizer.extractFilePathsFromCommand(command);
    const validatedPaths: string[] = [];

    for (const path of extractedPaths) {
      try {
        // Validate each path is within workspace boundaries
        const validatedPath = this.security.validatePath(path);
        validatedPaths.push(validatedPath);
      } catch (error) {
        return {
          valid: false,
          reason: `Path validation failed for '${path}': ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }

    return { valid: true, validatedPaths };
  }

  validateWorkingDirectory(command: string, requestedCwd?: string): { valid: boolean; reason?: string; validatedCwd?: string } {
    let workingDirectory = this.security.getWorkspaceRoot();

    if (requestedCwd) {
      try {
        workingDirectory = this.security.validatePath(requestedCwd);
      } catch (error) {
        return {
          valid: false,
          reason: `Working directory validation failed: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }

    // Check if command tries to change directory outside workspace
    const cdMatches = command.match(/cd\s+([^\s;|&<>]+)/g);
    if (cdMatches) {
      for (const cdMatch of cdMatches) {
        const targetDir = cdMatch.replace(/cd\s+/, '');
        
        try {
          // Resolve the target directory relative to current working directory
          const resolvedPath = this.resolvePath(targetDir, workingDirectory);
          this.security.validatePath(resolvedPath);
        } catch (error) {
          return {
            valid: false,
            reason: `Directory change validation failed for '${targetDir}': ${error instanceof Error ? error.message : String(error)}`
          };
        }
      }
    }

    return { valid: true, validatedCwd: workingDirectory };
  }

  checkPathTraversal(command: string): { safe: boolean; reason?: string } {
    const pathTraversalPatterns = [
      // Directory traversal patterns
      /\.\.\/+/g,
      /\/\.\.\/+/g,
      /\.\.\\+/g,
      /\\\.\.\\+/g,
      
      // Absolute path patterns that might escape workspace
      /\/etc\/+/g,
      /\/usr\/+/g,
      /\/bin\/+/g,
      /\/sbin\/+/g,
      /\/var\/+/g,
      /\/root\/+/g,
      /\/home\/[^\/]+\/+/g,
      /~\/+/g,
      
      // Dangerous file access patterns
      /\/dev\/+/g,
      /\/proc\/+/g,
      /\/sys\/+/g,
      /\/tmp\/+/g,
    ];

    for (const pattern of pathTraversalPatterns) {
      const matches = command.match(pattern);
      if (matches) {
        return {
          safe: false,
          reason: `Path traversal pattern detected: ${matches[0]}`
        };
      }
    }

    return { safe: true };
  }

  enforceWorkspaceBoundary(command: string, workingDirectory: string): { allowed: boolean; reason?: string; sanitizedCommand?: string } {
    // Check for dangerous path patterns
    const pathCheck = this.checkPathTraversal(command);
    if (!pathCheck.safe) {
      return {
        allowed: false,
        reason: pathCheck.reason || 'Path traversal detected'
      };
    }

    // Validate command paths
    const pathValidation = this.validateCommandPaths(command);
    if (!pathValidation.valid) {
      return {
        allowed: false,
        reason: pathValidation.reason || 'Path validation failed'
      };
    }

    // Validate working directory
    const cwdValidation = this.validateWorkingDirectory(command, workingDirectory);
    if (!cwdValidation.valid) {
      return {
        allowed: false,
        reason: cwdValidation.reason || 'Working directory validation failed'
      };
    }

    // Replace relative paths with absolute paths within workspace
    const sanitizedCommand = this.sanitizePathsInCommand(command, workingDirectory);

    return {
      allowed: true,
      sanitizedCommand
    };
  }

  private resolvePath(targetPath: string, basePath: string): string {
    // Handle special cases
    if (targetPath === '.') return basePath;
    if (targetPath === '..') return path.dirname(basePath);
    
    // Handle absolute paths
    if (path.isAbsolute(targetPath)) return targetPath;
    
    // Handle relative paths
    return path.resolve(basePath, targetPath);
  }

  private sanitizePathsInCommand(command: string, workingDirectory: string): string {
    let sanitized = command;
    
    // Replace relative paths with absolute paths within workspace
    const relativePaths = command.match(/\.\/[^\s;|&<>]+/g);
    if (relativePaths) {
      for (const relativePath of relativePaths) {
        const absolutePath = this.resolvePath(relativePath, workingDirectory);
        if (this.security.isPathSafe(absolutePath)) {
          sanitized = sanitized.replace(relativePath, absolutePath);
        }
      }
    }

    return sanitized;
  }

  validateFileOperations(command: string): { allowed: boolean; reason?: string } {
    const fileOperationPatterns = [
      // File creation/modification outside workspace
      /touch\s+\/[^\s;|&<>]+/g,
      /mkdir\s+\/[^\s;|&<>]+/g,
      /cp\s+[^\s;|&<>]+\s+\/[^\s;|&<>]+/g,
      /mv\s+[^\s;|&<>]+\s+\/[^\s;|&<>]+/g,
      /ln\s+[^\s;|&<>]+\s+\/[^\s;|&<>]+/g,
      
      // File deletion outside workspace
      /rm\s+\/[^\s;|&<>]+/g,
      /rmdir\s+\/[^\s;|&<>]+/g,
      
      // File reading outside workspace
      /cat\s+\/[^\s;|&<>]+/g,
      /head\s+\/[^\s;|&<>]+/g,
      /tail\s+\/[^\s;|&<>]+/g,
      /less\s+\/[^\s;|&<>]+/g,
      /more\s+\/[^\s;|&<>]+/g,
      /vim\s+\/[^\s;|&<>]+/g,
      /nano\s+\/[^\s;|&<>]+/g,
      /emacs\s+\/[^\s;|&<>]+/g,
    ];

    for (const pattern of fileOperationPatterns) {
      const matches = command.match(pattern);
      if (matches) {
        for (const match of matches) {
          const paths = match.split(/\s+/).slice(1); // Remove command name
          for (const path of paths) {
            if (!this.security.isPathSafe(path)) {
              return {
                allowed: false,
                reason: `File operation attempted outside workspace: ${match}`
              };
            }
          }
        }
      }
    }

    return { allowed: true };
  }

  getWorkspaceRoot(): string {
    return this.security.getWorkspaceRoot();
  }

  getRelativePath(absolutePath: string): string {
    return this.security.getRelativePathFromWorkspace(absolutePath);
  }
}

/**
 * Shell Tool Configuration Interface
 */
export interface ShellToolConfig {
  allowedCommands: string[];
  blockedCommands: string[];
  requireConfirmation: boolean;
  autoApprovePatterns: string[];
  maxExecutionTime: number;
  allowComplexCommands: boolean;
}

/**
 * Command Whitelist/Blacklist System
 */
export class CommandFilter {
  private config: ShellToolConfig;
  private defaultConfig: ShellToolConfig = {
    allowedCommands: [
      // Basic safe commands
      'echo', 'cat', 'head', 'tail', 'less', 'more',
      'ls', 'dir', 'pwd', 'find', 'grep', 'sort', 'wc',
      'date', 'whoami', 'id', 'uname', 'which', 'where',
      
      // Development commands
      'npm', 'yarn', 'pnpm', 'node', 'python', 'pip',
      'git', 'docker', 'docker-compose',
      'make', 'cmake', 'gcc', 'clang', 'javac', 'java',
      'cargo', 'rustc', 'go', 'dotnet',
      
      // Build and test commands
      'build', 'test', 'lint', 'format', 'compile',
      'jest', 'mocha', 'pytest', 'phpunit', 'rspec',
      
      // File operations (within workspace)
      'touch', 'mkdir', 'cp', 'mv', 'ln',
      'tar', 'gzip', 'gunzip', 'zip', 'unzip',
      
      // Text processing
      'awk', 'sed', 'cut', 'tr', 'diff', 'patch',
    ],
    blockedCommands: [
      // System commands
      'sudo', 'su', 'passwd', 'chpasswd', 'usermod',
      'systemctl', 'service', 'init', 'reboot', 'shutdown',
      'halt', 'poweroff', 'mount', 'umount',
      
      // Destructive commands
      'rm', 'rmdir', 'shred', 'wipe', 'dd',
      'format', 'fdisk', 'parted', 'mkfs',
      
      // Network commands
      'nc', 'netcat', 'telnet', 'ftp', 'ssh', 'scp',
      'rsync', 'curl', 'wget', 'ping', 'nmap',
      
      // Process control
      'kill', 'killall', 'pkill', 'nohup', 'screen', 'tmux',
      
      // System modification
      'chmod', 'chown', 'chgrp', 'setfacl', 'getfacl',
      'crontab', 'at', 'batch',
    ],
    requireConfirmation: true,
    autoApprovePatterns: [
      '^ls($|\\s)',
      '^pwd($|\\s)',
      '^echo($|\\s)',
      '^cat($|\\s)',
      '^head($|\\s)',
      '^tail($|\\s)',
      '^grep($|\\s)',
      '^find($|\\s)',
      '^git status($|\\s)',
      '^npm test($|\\s)',
      '^npm run($|\\s)',
      '^yarn test($|\\s)',
      '^yarn run($|\\s)',
    ],
    maxExecutionTime: 30,
    allowComplexCommands: false,
  };

  constructor(config?: Partial<ShellToolConfig>) {
    this.config = { ...this.defaultConfig, ...config };
  }

  updateConfig(config: Partial<ShellToolConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ShellToolConfig {
    return { ...this.config };
  }

  isCommandAllowed(command: string): { allowed: boolean; reason?: string; requiresConfirmation?: boolean } {
    const normalizedCommand = command.toLowerCase().trim();
    const commandName = this.extractCommandName(normalizedCommand);

    // Check if command is explicitly blocked
    if (this.isCommandBlocked(commandName, normalizedCommand)) {
      return {
        allowed: false,
        reason: `Command '${commandName}' is blocked by security policy`
      };
    }

    // Check for complex commands if not allowed
    if (!this.config.allowComplexCommands && !CommandSanitizer.isSimpleCommand(command)) {
      return {
        allowed: false,
        reason: 'Complex commands with pipes, redirections, or chaining are not allowed'
      };
    }

    // Check if command is explicitly allowed
    if (this.isCommandWhitelisted(commandName, normalizedCommand)) {
      // Check if it matches auto-approve patterns
      if (this.matchesAutoApprovePattern(normalizedCommand)) {
        return { allowed: true, requiresConfirmation: false };
      }
      return { allowed: true, requiresConfirmation: this.config.requireConfirmation };
    }

    // Command not in whitelist - requires confirmation if enabled
    if (this.config.requireConfirmation) {
      return {
        allowed: true,
        requiresConfirmation: true,
        reason: `Command '${commandName}' is not in the allowed list and requires confirmation`
      };
    }

    return { allowed: true, requiresConfirmation: false };
  }

  private extractCommandName(command: string): string {
    // Extract the base command name (first word)
    const parts = command.split(/\s+/);
    return parts[0] || '';
  }

  private isCommandBlocked(commandName: string, fullCommand: string): boolean {
    // Check exact command name matches
    if (this.config.blockedCommands.includes(commandName)) {
      return true;
    }

    // Check if any blocked command is contained in the full command
    for (const blockedCmd of this.config.blockedCommands) {
      if (fullCommand.includes(blockedCmd.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  private isCommandWhitelisted(commandName: string, _fullCommand: string): boolean {
    // Check exact command name matches
    if (this.config.allowedCommands.includes(commandName)) {
      return true;
    }

    // Check if command starts with any allowed command
    for (const allowedCmd of this.config.allowedCommands) {
      if (commandName.startsWith(allowedCmd.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  private matchesAutoApprovePattern(command: string): boolean {
    for (const pattern of this.config.autoApprovePatterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(command)) {
        return true;
      }
    }
    return false;
  }

  addAllowedCommand(command: string): void {
    if (!this.config.allowedCommands.includes(command)) {
      this.config.allowedCommands.push(command);
    }
  }

  removeAllowedCommand(command: string): void {
    const index = this.config.allowedCommands.indexOf(command);
    if (index > -1) {
      this.config.allowedCommands.splice(index, 1);
    }
  }

  addBlockedCommand(command: string): void {
    if (!this.config.blockedCommands.includes(command)) {
      this.config.blockedCommands.push(command);
    }
  }

  removeBlockedCommand(command: string): void {
    const index = this.config.blockedCommands.indexOf(command);
    if (index > -1) {
      this.config.blockedCommands.splice(index, 1);
    }
  }

  addAutoApprovePattern(pattern: string): void {
    if (!this.config.autoApprovePatterns.includes(pattern)) {
      this.config.autoApprovePatterns.push(pattern);
    }
  }

  removeAutoApprovePattern(pattern: string): void {
    const index = this.config.autoApprovePatterns.indexOf(pattern);
    if (index > -1) {
      this.config.autoApprovePatterns.splice(index, 1);
    }
  }

  resetToDefaults(): void {
    this.config = { ...this.defaultConfig };
  }
}

/**
 * Security Event Logging System
 */
export interface ShellSecurityEvent {
  timestamp: Date;
  eventType: 'COMMAND_BLOCKED' | 'COMMAND_ALLOWED' | 'PATH_TRAVERSAL' | 'INPUT_VALIDATION' | 'WORKSPACE_VIOLATION' | 'DANGEROUS_COMMAND' | 'SANITIZATION';
  command: string;
  workingDirectory: string;
  reason?: string | undefined;
  riskScore?: number | undefined;
  userContext?: string | undefined;
  details?: Record<string, any> | undefined;
}

/**
 * Enhanced Shell Execution Log for comprehensive command tracking
 */
export interface ShellExecutionLog {
  /** Unique identifier for this execution */
  id: string;
  
  /** Session identifier for grouping related executions */
  sessionId?: string;
  
  /** User identifier */
  userId?: string;
  
  /** Timestamp when the execution started */
  timestamp: Date;
  
  /** The command that was executed */
  command: string;
  
  /** Original command before any sanitization */
  originalCommand?: string;
  
  /** Working directory where the command was executed */
  workingDirectory: string;
  
  /** Relative path from workspace root */
  workingDirectoryRelative: string;
  
  /** Command execution result */
  exitCode: number;
  
  /** Execution time in milliseconds */
  executionTime: number;
  
  /** Whether the execution was successful */
  success: boolean;
  
  /** Standard output from the command */
  stdout?: string;
  
  /** Standard error from the command */
  stderr?: string;
  
  /** Output size in bytes */
  outputSize: number;
  
  /** Error type if execution failed */
  errorType?: ShellErrorType;
  
  /** Detailed error information */
  error?: {
    message: string;
    type: ShellErrorType;
    suggestions: string[];
    retryable: boolean;
    code?: number;
  };
  
  /** Security events associated with this execution */
  securityEvents: ShellSecurityEvent[];
  
  /** Performance metrics */
  performance: {
    /** CPU usage during execution (if available) */
    cpuUsage?: number;
    
    /** Memory usage during execution (if available) */
    memoryUsage?: number;
    
    /** Network activity (if available) */
    networkActivity?: {
      requests: number;
      bytesTransferred: number;
    };
    
    /** File system operations */
    fileSystemOperations?: {
      reads: number;
      writes: number;
      bytesRead: number;
      bytesWritten: number;
    };
  };
  
  /** Risk assessment */
  riskAssessment: {
    /** Risk score (0-100) */
    riskScore: number;
    
    /** Risk factors identified */
    riskFactors: string[];
    
    /** Whether manual approval was required */
    manualApprovalRequired: boolean;
    
    /** Whether the command was approved */
    approved: boolean;
  };
  
  /** Command metadata */
  metadata: {
    /** Command category (e.g., 'build', 'test', 'file', 'network') */
    category?: string;
    
    /** Detected file operations */
    fileOperations?: string[];
    
    /** Detected network operations */
    networkOperations?: string[];
    
    /** Environment variables used */
    environmentVariables?: string[];
    
    /** Command tags for categorization */
    tags?: string[];
  };
}

/**
 * Log Level enumeration for filtering
 */
export enum ShellLogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  SECURITY = 'security',
}

/**
 * Log Query interface for filtering logs
 */
export interface ShellLogQuery {
  /** Filter by date range */
  dateRange?: {
    start: Date;
    end: Date;
  };
  
  /** Filter by command pattern */
  commandPattern?: string | RegExp;
  
  /** Filter by success status */
  success?: boolean;
  
  /** Filter by error type */
  errorType?: ShellErrorType;
  
  /** Filter by risk score range */
  riskScoreRange?: {
    min: number;
    max: number;
  };
  
  /** Filter by execution time range */
  executionTimeRange?: {
    min: number;
    max: number;
  };
  
  /** Filter by user ID */
  userId?: string;
  
  /** Filter by session ID */
  sessionId?: string;
  
  /** Filter by log level */
  logLevel?: ShellLogLevel;
  
  /** Maximum number of results */
  limit?: number;
  
  /** Results offset for pagination */
  offset?: number;
}

/**
 * Log Statistics interface for reporting
 */
export interface ShellLogStatistics {
  /** Total number of executions */
  totalExecutions: number;
  
  /** Number of successful executions */
  successfulExecutions: number;
  
  /** Number of failed executions */
  failedExecutions: number;
  
  /** Success rate percentage */
  successRate: number;
  
  /** Average execution time */
  averageExecutionTime: number;
  
  /** Most commonly executed commands */
  topCommands: Array<{
    command: string;
    count: number;
    successRate: number;
  }>;
  
  /** Most common error types */
  topErrors: Array<{
    errorType: ShellErrorType;
    count: number;
    percentage: number;
  }>;
  
  /** Risk score distribution */
  riskScoreDistribution: {
    low: number;    // 0-30
    medium: number; // 31-70
    high: number;   // 71-100
  };
  
  /** Execution time distribution */
  executionTimeDistribution: {
    fast: number;    // < 1s
    normal: number;  // 1-10s
    slow: number;    // > 10s
  };
  
  /** Security events summary */
  securityEventsSummary: {
    totalEvents: number;
    blockedCommands: number;
    pathTraversalAttempts: number;
    dangerousCommands: number;
    workspaceViolations: number;
  };
}

/**
 * Log Export Format options
 */
export enum ShellLogExportFormat {
  JSON = 'json',
  CSV = 'csv',
  TEXT = 'text',
  HTML = 'html',
}

/**
 * Log Export Configuration
 */
export interface ShellLogExportConfig {
  /** Export format */
  format: ShellLogExportFormat;
  
  /** Query for filtering logs to export */
  query?: ShellLogQuery;
  
  /** Whether to include sensitive data */
  includeSensitiveData?: boolean;
  
  /** Whether to include performance metrics */
  includePerformanceMetrics?: boolean;
  
  /** Whether to include security events */
  includeSecurityEvents?: boolean;
  
  /** Output file path */
  outputPath?: string;
}

/**
 * Performance Monitor for shell command execution
 * Collects CPU, memory, network, and file system metrics
 */
export class ShellPerformanceMonitor {
  private static readonly MONITOR_INTERVAL = 100; // Monitor every 100ms
  private monitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | undefined;
  private metrics: {
    cpuUsage: number[];
    memoryUsage: number[];
    networkActivity: {
      requests: number;
      bytesTransferred: number;
    };
    fileSystemOperations: {
      reads: number;
      writes: number;
      bytesRead: number;
      bytesWritten: number;
    };
  };

  constructor() {
    this.metrics = {
      cpuUsage: [],
      memoryUsage: [],
      networkActivity: {
        requests: 0,
        bytesTransferred: 0,
      },
      fileSystemOperations: {
        reads: 0,
        writes: 0,
        bytesRead: 0,
        bytesWritten: 0,
      },
    };
  }

  /**
   * Start monitoring performance metrics
   */
  startMonitoring(): void {
    if (this.monitoring) {
      return;
    }

    this.monitoring = true;
    this.resetMetrics();

    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, ShellPerformanceMonitor.MONITOR_INTERVAL);
  }

  /**
   * Stop monitoring and return collected metrics
   */
  stopMonitoring(): {
    cpuUsage?: number;
    memoryUsage?: number;
    networkActivity?: {
      requests: number;
      bytesTransferred: number;
    };
    fileSystemOperations?: {
      reads: number;
      writes: number;
      bytesRead: number;
      bytesWritten: number;
    };
  } {
    if (!this.monitoring) {
      return {};
    }

    this.monitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    // Calculate averages and return final metrics
    const avgCpuUsage = this.metrics.cpuUsage.length > 0 
      ? this.metrics.cpuUsage.reduce((sum, val) => sum + val, 0) / this.metrics.cpuUsage.length
      : undefined;

    const avgMemoryUsage = this.metrics.memoryUsage.length > 0
      ? this.metrics.memoryUsage.reduce((sum, val) => sum + val, 0) / this.metrics.memoryUsage.length
      : undefined;

    const result: {
      cpuUsage?: number;
      memoryUsage?: number;
      networkActivity?: {
        requests: number;
        bytesTransferred: number;
      };
      fileSystemOperations?: {
        reads: number;
        writes: number;
        bytesRead: number;
        bytesWritten: number;
      };
    } = {};
    
    if (avgCpuUsage !== undefined) {
      result.cpuUsage = avgCpuUsage;
    }
    if (avgMemoryUsage !== undefined) {
      result.memoryUsage = avgMemoryUsage;
    }
    result.networkActivity = this.metrics.networkActivity;
    result.fileSystemOperations = this.metrics.fileSystemOperations;
    
    return result;
  }

  /**
   * Get current performance snapshot
   */
  getSnapshot(): {
    cpuUsage?: number;
    memoryUsage?: number;
    networkActivity: {
      requests: number;
      bytesTransferred: number;
    };
    fileSystemOperations: {
      reads: number;
      writes: number;
      bytesRead: number;
      bytesWritten: number;
    };
  } {
    const avgCpuUsage = this.metrics.cpuUsage.length > 0 
      ? this.metrics.cpuUsage.reduce((sum, val) => sum + val, 0) / this.metrics.cpuUsage.length
      : undefined;

    const avgMemoryUsage = this.metrics.memoryUsage.length > 0
      ? this.metrics.memoryUsage.reduce((sum, val) => sum + val, 0) / this.metrics.memoryUsage.length
      : undefined;

    const result: {
      cpuUsage?: number;
      memoryUsage?: number;
      networkActivity: {
        requests: number;
        bytesTransferred: number;
      };
      fileSystemOperations: {
        reads: number;
        writes: number;
        bytesRead: number;
        bytesWritten: number;
      };
    } = {
      networkActivity: { ...this.metrics.networkActivity },
      fileSystemOperations: { ...this.metrics.fileSystemOperations },
    };
    
    if (avgCpuUsage !== undefined) {
      result.cpuUsage = avgCpuUsage;
    }
    if (avgMemoryUsage !== undefined) {
      result.memoryUsage = avgMemoryUsage;
    }
    
    return result;
  }

  /**
   * Reset all metrics
   */
  private resetMetrics(): void {
    this.metrics.cpuUsage = [];
    this.metrics.memoryUsage = [];
    this.metrics.networkActivity = {
      requests: 0,
      bytesTransferred: 0,
    };
    this.metrics.fileSystemOperations = {
      reads: 0,
      writes: 0,
      bytesRead: 0,
      bytesWritten: 0,
    };
  }

  /**
   * Collect current system metrics
   */
  private collectMetrics(): void {
    try {
      // Collect CPU usage
      const cpuUsage = process.cpuUsage();
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to milliseconds
      this.metrics.cpuUsage.push(cpuPercent);

      // Collect memory usage
      const memoryUsage = process.memoryUsage();
      this.metrics.memoryUsage.push(memoryUsage.heapUsed);

      // Note: Network and file system metrics would require more complex monitoring
      // For now, we'll track basic metrics that can be estimated
      
    } catch (error) {
      // Silent fail - performance monitoring shouldn't break execution
    }
  }

  /**
   * Estimate file system operations from command content
   */
  static estimateFileOperations(command: string, stdout: string, _stderr: string): {
    reads: number;
    writes: number;
    bytesRead: number;
    bytesWritten: number;
  } {
    let reads = 0;
    let writes = 0;
    let bytesRead = 0;
    let bytesWritten = 0;

    // Estimate based on command type
    const lowerCommand = command.toLowerCase();

    // Read operations
    if (lowerCommand.match(/^(cat|head|tail|less|more|grep|find|ls|dir)\s/)) {
      reads = 1;
      bytesRead = stdout.length; // Approximate
    }

    // Write operations
    if (lowerCommand.match(/^(cp|mv|touch|mkdir|echo.*>|.*>\s)/)) {
      writes = 1;
      bytesWritten = command.length; // Very rough estimate
    }

    // Multiple file operations
    if (lowerCommand.includes('*') || lowerCommand.includes('?')) {
      reads = Math.max(reads, 10); // Wildcard likely touches multiple files
      writes = Math.max(writes, 5);
    }

    return {
      reads,
      writes,
      bytesRead,
      bytesWritten,
    };
  }

  /**
   * Estimate network activity from command content
   */
  static estimateNetworkActivity(command: string, stdout: string, stderr: string): {
    requests: number;
    bytesTransferred: number;
  } {
    let requests = 0;
    let bytesTransferred = 0;

    const lowerCommand = command.toLowerCase();

    // Network commands
    if (lowerCommand.match(/^(curl|wget|ping|ssh|scp|rsync|git\s+(pull|push|clone|fetch))\s/)) {
      requests = 1;
      bytesTransferred = stdout.length + stderr.length; // Rough estimate
    }

    // Multiple network operations
    if (lowerCommand.includes('curl') && lowerCommand.includes('&')) {
      requests = (lowerCommand.match(/curl/g) || []).length;
    }

    return {
      requests,
      bytesTransferred,
    };
  }
}

/**
 * Enhanced Shell Execution Logger with comprehensive logging capabilities
 * Following the TokenLogger pattern for file-based logging with rotation
 */
export class ShellExecutionLogger {
  private logFile: string;
  private securityLogFile: string;
  private events: ShellSecurityEvent[] = [];
  private executionLogs: ShellExecutionLog[] = [];
  private maxEvents: number = 1000;
  private maxExecutionLogs: number = 500;
  private sessionId: string;
  
  constructor(
    sessionId: string,
    maxEvents: number = 1000,
    maxExecutionLogs: number = 500,
    _logLevel: ShellLogLevel = ShellLogLevel.INFO
  ) {
    this.sessionId = sessionId;
    this.maxEvents = maxEvents;
    this.maxExecutionLogs = maxExecutionLogs;
    // Log level is preserved for future use
    void _logLevel;

    // Create logs directory following TokenLogger pattern
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const aiyaDir = path.join(homeDir, '.aiya');
    const logsDir = path.join(aiyaDir, 'logs');

    // Ensure directories exist
    if (!fs.existsSync(aiyaDir)) {
      fs.mkdirSync(aiyaDir, { recursive: true });
    }
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    this.logFile = path.join(logsDir, 'shell-execution.log');
    this.securityLogFile = path.join(logsDir, 'shell-security.log');
  }

  /**
   * Log a security event with enhanced context
   */
  logSecurityEvent(event: Omit<ShellSecurityEvent, 'timestamp'>): void {
    const securityEvent: ShellSecurityEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.events.push(securityEvent);

    // Rotate logs if needed
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Write to security log file
    this.writeSecurityLogEntry(securityEvent);

    // Log to console in development/debug mode
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_SHELL_SECURITY) {
      console.log(`[SHELL SECURITY] ${event.eventType}: ${event.command} - ${event.reason || 'No reason provided'}`);
    }
  }

  /**
   * Log a shell execution with comprehensive tracking
   */
  logExecution(log: Omit<ShellExecutionLog, 'timestamp' | 'id' | 'sessionId'>): void {
    const executionLog: ShellExecutionLog = {
      ...log,
      id: this.generateExecutionId(),
      sessionId: this.sessionId,
      timestamp: new Date(),
    };

    this.executionLogs.push(executionLog);

    // Rotate logs if needed
    if (this.executionLogs.length > this.maxExecutionLogs) {
      this.executionLogs = this.executionLogs.slice(-this.maxExecutionLogs);
    }

    // Write to execution log file
    this.writeExecutionLogEntry(executionLog);

    // Log to console in development/debug mode
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_SHELL_SECURITY) {
      console.log(`[SHELL EXECUTION] ${log.command} - Exit Code: ${log.exitCode}, Time: ${log.executionTime}ms`);
    }
  }

  /**
   * Query execution logs with filtering
   */
  queryExecutionLogs(query: ShellLogQuery): ShellExecutionLog[] {
    let results = [...this.executionLogs];

    // Apply filters
    if (query.dateRange) {
      results = results.filter(log => 
        log.timestamp >= query.dateRange!.start && 
        log.timestamp <= query.dateRange!.end
      );
    }

    if (query.commandPattern) {
      const pattern = typeof query.commandPattern === 'string' 
        ? new RegExp(query.commandPattern, 'i') 
        : query.commandPattern;
      results = results.filter(log => pattern.test(log.command));
    }

    if (query.success !== undefined) {
      results = results.filter(log => log.success === query.success);
    }

    if (query.errorType) {
      results = results.filter(log => log.errorType === query.errorType);
    }

    if (query.riskScoreRange) {
      results = results.filter(log => 
        log.riskAssessment.riskScore >= query.riskScoreRange!.min &&
        log.riskAssessment.riskScore <= query.riskScoreRange!.max
      );
    }

    if (query.executionTimeRange) {
      results = results.filter(log => 
        log.executionTime >= query.executionTimeRange!.min &&
        log.executionTime <= query.executionTimeRange!.max
      );
    }

    if (query.userId) {
      results = results.filter(log => log.userId === query.userId);
    }

    if (query.sessionId) {
      results = results.filter(log => log.sessionId === query.sessionId);
    }

    // Sort by timestamp (most recent first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || results.length;
    
    return results.slice(offset, offset + limit);
  }

  /**
   * Get execution statistics
   */
  getExecutionStatistics(): ShellLogStatistics {
    const totalExecutions = this.executionLogs.length;
    const successfulExecutions = this.executionLogs.filter(log => log.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;
    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;
    
    const averageExecutionTime = totalExecutions > 0 
      ? this.executionLogs.reduce((sum, log) => sum + log.executionTime, 0) / totalExecutions 
      : 0;

    // Calculate top commands
    const commandCounts = this.executionLogs.reduce((acc, log) => {
      const cmd = log.command.split(' ')[0]; // Get base command
      if (cmd && cmd.length > 0) {
        if (!acc[cmd]) {
          acc[cmd] = { count: 0, successful: 0 };
        }
        acc[cmd]!.count++;
        if (log.success) {
          acc[cmd]!.successful++;
        }
      }
      return acc;
    }, {} as Record<string, { count: number; successful: number }>);

    const topCommands = Object.entries(commandCounts)
      .map(([command, stats]) => ({
        command,
        count: stats.count,
        successRate: stats.count > 0 ? (stats.successful / stats.count) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate top errors
    const errorCounts = this.executionLogs
      .filter(log => log.errorType)
      .reduce((acc, log) => {
        const errorType = log.errorType!;
        acc[errorType] = (acc[errorType] || 0) + 1;
        return acc;
      }, {} as Record<ShellErrorType, number>);

    const topErrors = Object.entries(errorCounts)
      .map(([errorType, count]) => ({
        errorType: errorType as ShellErrorType,
        count,
        percentage: failedExecutions > 0 ? (count / failedExecutions) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate risk score distribution
    const riskScoreDistribution = this.executionLogs.reduce(
      (acc, log) => {
        const score = log.riskAssessment.riskScore;
        if (score <= 30) acc.low++;
        else if (score <= 70) acc.medium++;
        else acc.high++;
        return acc;
      },
      { low: 0, medium: 0, high: 0 }
    );

    // Calculate execution time distribution
    const executionTimeDistribution = this.executionLogs.reduce(
      (acc, log) => {
        const time = log.executionTime;
        if (time < 1000) acc.fast++;
        else if (time <= 10000) acc.normal++;
        else acc.slow++;
        return acc;
      },
      { fast: 0, normal: 0, slow: 0 }
    );

    // Security events summary
    const eventsByType = this.events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const securityEventsSummary = {
      totalEvents: this.events.length,
      blockedCommands: eventsByType['COMMAND_BLOCKED'] || 0,
      pathTraversalAttempts: eventsByType['PATH_TRAVERSAL'] || 0,
      dangerousCommands: eventsByType['DANGEROUS_COMMAND'] || 0,
      workspaceViolations: eventsByType['WORKSPACE_VIOLATION'] || 0,
    };

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate: Math.round(successRate * 100) / 100,
      averageExecutionTime: Math.round(averageExecutionTime),
      topCommands,
      topErrors,
      riskScoreDistribution,
      executionTimeDistribution,
      securityEventsSummary,
    };
  }

  /**
   * Export logs in various formats
   */
  exportLogs(config: ShellLogExportConfig): string {
    const logs = config.query ? this.queryExecutionLogs(config.query) : this.executionLogs;
    
    switch (config.format) {
      case ShellLogExportFormat.JSON:
        return this.exportAsJSON(logs, config);
      case ShellLogExportFormat.CSV:
        return this.exportAsCSV(logs, config);
      case ShellLogExportFormat.TEXT:
        return this.exportAsText(logs, config);
      case ShellLogExportFormat.HTML:
        return this.exportAsHTML(logs, config);
      default:
        return this.exportAsJSON(logs, config);
    }
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.events = [];
    this.executionLogs = [];
    
    // Clear log files
    try {
      fs.writeFileSync(this.logFile, '');
      fs.writeFileSync(this.securityLogFile, '');
    } catch (error) {
      console.error('Failed to clear log files:', error);
    }
  }

  /**
   * Rotate logs if they get too large
   */
  rotateLogs(): void {
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    
    try {
      // Rotate execution log
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size > maxFileSize) {
          const backupFile = `${this.logFile}.${Date.now()}.backup`;
          fs.renameSync(this.logFile, backupFile);
        }
      }

      // Rotate security log
      if (fs.existsSync(this.securityLogFile)) {
        const stats = fs.statSync(this.securityLogFile);
        if (stats.size > maxFileSize) {
          const backupFile = `${this.securityLogFile}.${Date.now()}.backup`;
          fs.renameSync(this.securityLogFile, backupFile);
        }
      }
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }

  // Private helper methods
  private generateExecutionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private writeExecutionLogEntry(log: ShellExecutionLog): void {
    const logLine = `[${log.timestamp.toISOString()}] [${log.sessionId}] [${log.id}] ${log.command} - Exit: ${log.exitCode}, Time: ${log.executionTime}ms, Success: ${log.success}`;
    
    try {
      fs.appendFileSync(this.logFile, logLine + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write execution log:', error);
    }
  }

  private writeSecurityLogEntry(event: ShellSecurityEvent): void {
    const logLine = `[${event.timestamp.toISOString()}] [${this.sessionId}] [${event.eventType}] ${event.command} - ${event.reason || 'No reason'}`;
    
    try {
      fs.appendFileSync(this.securityLogFile, logLine + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write security log:', error);
    }
  }

  private exportAsJSON(logs: ShellExecutionLog[], config: ShellLogExportConfig): string {
    const exportData = {
      generatedAt: new Date().toISOString(),
      sessionId: this.sessionId,
      totalLogs: logs.length,
      statistics: this.getExecutionStatistics(),
      logs: logs.map(log => this.sanitizeLogForExport(log, config)),
    };

    return JSON.stringify(exportData, null, 2);
  }

  private exportAsCSV(logs: ShellExecutionLog[], _config: ShellLogExportConfig): string {
    const headers = [
      'id', 'timestamp', 'command', 'workingDirectory', 'exitCode',
      'executionTime', 'success', 'errorType', 'riskScore'
    ];

    const rows = logs.map(log => [
      log.id,
      log.timestamp.toISOString(),
      log.command,
      log.workingDirectoryRelative,
      log.exitCode,
      log.executionTime,
      log.success,
      log.errorType || '',
      log.riskAssessment.riskScore
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private exportAsText(logs: ShellExecutionLog[], _config: ShellLogExportConfig): string {
    const lines = logs.map(log => {
      const timestamp = log.timestamp.toISOString();
      const status = log.success ? 'SUCCESS' : 'FAILED';
      const error = log.errorType ? ` (${log.errorType})` : '';
      return `[${timestamp}] ${status}${error} - ${log.command} (${log.executionTime}ms)`;
    });

    return lines.join('\n');
  }

  private exportAsHTML(logs: ShellExecutionLog[], _config: ShellLogExportConfig): string {
    const stats = this.getExecutionStatistics();
    const rows = logs.map(log => {
      const status = log.success ? 'success' : 'error';
      const timestamp = log.timestamp.toISOString();
      return `
        <tr class="${status}">
          <td>${timestamp}</td>
          <td><code>${log.command}</code></td>
          <td>${log.workingDirectoryRelative}</td>
          <td>${log.exitCode}</td>
          <td>${log.executionTime}ms</td>
          <td>${log.success ? 'Success' : 'Failed'}</td>
          <td>${log.errorType || ''}</td>
          <td>${log.riskAssessment.riskScore}</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Shell Execution Log Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .stats { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .success { background-color: #d4edda; }
            .error { background-color: #f8d7da; }
            code { background: #f1f1f1; padding: 2px 4px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <h1>Shell Execution Log Report</h1>
          <div class="stats">
            <h2>Statistics</h2>
            <p>Total Executions: ${stats.totalExecutions}</p>
            <p>Success Rate: ${stats.successRate}%</p>
            <p>Average Execution Time: ${stats.averageExecutionTime}ms</p>
          </div>
          <h2>Execution Log</h2>
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Command</th>
                <th>Directory</th>
                <th>Exit Code</th>
                <th>Time</th>
                <th>Status</th>
                <th>Error Type</th>
                <th>Risk Score</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `;
  }

  private sanitizeLogForExport(log: ShellExecutionLog, config: ShellLogExportConfig): Partial<ShellExecutionLog> {
    const sanitized: Partial<ShellExecutionLog> = {
      id: log.id,
      timestamp: log.timestamp,
      command: log.command,
      workingDirectoryRelative: log.workingDirectoryRelative,
      exitCode: log.exitCode,
      executionTime: log.executionTime,
      success: log.success,
      riskAssessment: log.riskAssessment,
    };

    if (log.errorType) {
      sanitized.errorType = log.errorType;
    }

    if (config.includeSensitiveData) {
      sanitized.workingDirectory = log.workingDirectory;
      if (log.originalCommand) {
        sanitized.originalCommand = log.originalCommand;
      }
      if (log.stdout) {
        sanitized.stdout = log.stdout;
      }
      if (log.stderr) {
        sanitized.stderr = log.stderr;
      }
    }

    if (config.includePerformanceMetrics) {
      sanitized.performance = log.performance;
    }

    if (config.includeSecurityEvents) {
      sanitized.securityEvents = log.securityEvents;
    }

    return sanitized;
  }

  // Legacy methods for backward compatibility
  getSecurityEvents(limit?: number): ShellSecurityEvent[] {
    const events = [...this.events].reverse();
    return limit ? events.slice(0, limit) : events;
  }

  getExecutionLogs(limit?: number): ShellExecutionLog[] {
    const logs = [...this.executionLogs].reverse();
    return limit ? logs.slice(0, limit) : logs;
  }

  getSecuritySummary() {
    return this.getExecutionStatistics().securityEventsSummary;
  }

  exportSecurityReport(): string {
    return this.exportLogs({
      format: ShellLogExportFormat.JSON,
      includeSecurityEvents: true,
      includePerformanceMetrics: true,
    });
  }

  // Helper methods for common security events
  logCommandBlocked(command: string, workingDirectory: string, reason: string, riskScore?: number): void {
    this.logSecurityEvent({
      eventType: 'COMMAND_BLOCKED',
      command,
      workingDirectory,
      reason,
      riskScore: riskScore || undefined,
    });
  }

  logCommandAllowed(command: string, workingDirectory: string, reason?: string): void {
    this.logSecurityEvent({
      eventType: 'COMMAND_ALLOWED',
      command,
      workingDirectory,
      reason: reason || undefined,
    });
  }

  logPathTraversal(command: string, workingDirectory: string, reason: string): void {
    this.logSecurityEvent({
      eventType: 'PATH_TRAVERSAL',
      command,
      workingDirectory,
      reason,
    });
  }

  logInputValidation(command: string, workingDirectory: string, reason: string): void {
    this.logSecurityEvent({
      eventType: 'INPUT_VALIDATION',
      command,
      workingDirectory,
      reason,
    });
  }

  logWorkspaceViolation(command: string, workingDirectory: string, reason: string): void {
    this.logSecurityEvent({
      eventType: 'WORKSPACE_VIOLATION',
      command,
      workingDirectory,
      reason,
    });
  }

  logDangerousCommand(command: string, workingDirectory: string, reason: string, riskScore?: number): void {
    this.logSecurityEvent({
      eventType: 'DANGEROUS_COMMAND',
      command,
      workingDirectory,
      reason,
      riskScore: riskScore || undefined,
    });
  }

  logSanitization(command: string, workingDirectory: string, reason: string): void {
    this.logSecurityEvent({
      eventType: 'SANITIZATION',
      command,
      workingDirectory,
      reason,
    });
  }
}

/**
 * ShellMCPClient - MCP client for shell command execution
 * 
 * Phase 3: Complete security integration with comprehensive protection
 * Provides secure shell command execution within workspace boundaries
 */
export class ShellMCPClient extends MCPClient {
  private security: WorkspaceSecurity;
  private boundaryEnforcer: WorkspaceBoundaryEnforcer;
  private commandFilter: CommandFilter;
  private executionLogger: ShellExecutionLogger;
  private sessionId: string;

  constructor(security: WorkspaceSecurity, config?: Partial<ShellToolConfig>) {
    super('shell');
    this.security = security;
    this.boundaryEnforcer = new WorkspaceBoundaryEnforcer(security);
    this.commandFilter = new CommandFilter(config);
    this.sessionId = randomUUID();
    this.executionLogger = new ShellExecutionLogger(this.sessionId);
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async ping(): Promise<boolean> {
    return this.connected;
  }

  async getServerInfo(): Promise<MCPServerInfo> {
    return {
      name: 'Shell MCP Server',
      version: '1.0.0',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
      },
    };
  }

  async listTools(): Promise<Tool[]> {
    return [
      {
        name: 'ExecuteCommand',
        description: 'Execute shell commands safely within workspace boundaries with comprehensive security protection including dangerous command detection, input sanitization, path traversal prevention, and audit logging',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The shell command to execute (subject to security validation)',
            },
            cwd: {
              type: 'string',
              description: 'Working directory for command execution (default: workspace root, must be within workspace)',
            },
            timeout: {
              type: 'number',
              description: 'Command timeout in seconds (default: 30)',
              minimum: 1,
              maximum: 300,
              default: 30,
            },
          },
          required: ['command'],
        },
      },
    ];
  }

  async callTool(name: string, args: Record<string, any>): Promise<ToolResult> {
    try {
      switch (name) {
        case 'ExecuteCommand':
          return await this.executeCommand(args);
        default:
          return {
            content: [
              {
                type: 'text',
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Shell execution error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async listResources(): Promise<any[]> {
    return [];
  }

  async readResource(_uri: string): Promise<ToolResult> {
    return {
      content: [
        {
          type: 'text',
          text: 'Resources not supported by Shell MCP client',
        },
      ],
      isError: true,
    };
  }

  /**
   * ExecuteCommand tool implementation (Phase 4: enhanced logging and error handling)
   */
  private async executeCommand(params: any): Promise<ToolResult> {
    const { command, cwd, timeout = 30 } = params as ShellExecuteParams;
    const securityEvents: ShellSecurityEvent[] = [];
    const performanceMonitor = new ShellPerformanceMonitor();
    const startTime = performance.now();
    
    let workingDirectory = this.security.getWorkspaceRoot();
    let sanitizedCommand = command;
    let finalCommand = command;
    let result: ShellExecuteResult | null = null;

    try {
      // 1. Basic parameter validation
      if (!command || typeof command !== 'string') {
        const context: ShellErrorContext = {
          command: String(command),
          workingDirectory,
          timestamp: new Date(),
        };
        throw new ShellInputValidationError(String(command), 'Command parameter is required and must be a string', context);
      }

      if (timeout < 1 || timeout > 300) {
        const context: ShellErrorContext = {
          command,
          workingDirectory,
          timeout,
          timestamp: new Date(),
        };
        throw new ShellInputValidationError(String(timeout), 'Timeout must be between 1 and 300 seconds', context);
      }

      // 2. Input validation and sanitization
      const inputValidation = CommandSanitizer.validateInput(command);
      if (!inputValidation.valid) {
        this.executionLogger.logInputValidation(command, workingDirectory, inputValidation.reason!);
        const context: ShellErrorContext = {
          command,
          workingDirectory,
          timestamp: new Date(),
        };
        throw new ShellInputValidationError(command, inputValidation.reason!, context);
      }

      sanitizedCommand = inputValidation.sanitized!;
      if (sanitizedCommand !== command) {
        this.executionLogger.logSanitization(command, workingDirectory, 'Command input sanitized');
      }

      // 3. Dangerous command detection
      const dangerCheck = DangerousCommandDetector.isDangerous(sanitizedCommand);
      if (dangerCheck.dangerous) {
        const riskScore = DangerousCommandDetector.calculateRiskScore(sanitizedCommand);
        this.executionLogger.logDangerousCommand(sanitizedCommand, workingDirectory, dangerCheck.reason!, riskScore);
        const context: ShellErrorContext = {
          command: sanitizedCommand,
          workingDirectory,
          riskScore,
          timestamp: new Date(),
        };
        throw new ShellCommandBlockedError(sanitizedCommand, dangerCheck.reason!, context);
      }

      // 4. Command filtering (whitelist/blacklist)
      const filterCheck = this.commandFilter.isCommandAllowed(sanitizedCommand);
      if (!filterCheck.allowed) {
        this.executionLogger.logCommandBlocked(sanitizedCommand, workingDirectory, filterCheck.reason!);
        const context: ShellErrorContext = {
          command: sanitizedCommand,
          workingDirectory,
          timestamp: new Date(),
        };
        throw new ShellCommandBlockedError(sanitizedCommand, filterCheck.reason!, context);
      }

      // 5. Working directory validation
      if (cwd) {
        try {
          workingDirectory = await this.security.validateFileAccess(cwd, 'read');
        } catch (error) {
          this.executionLogger.logWorkspaceViolation(sanitizedCommand, cwd, `Invalid working directory: ${error instanceof Error ? error.message : String(error)}`);
          const context: ShellErrorContext = {
            command: sanitizedCommand,
            workingDirectory: cwd,
            timestamp: new Date(),
            originalError: error,
          };
          throw new ShellInputValidationError(cwd, `Invalid working directory: ${error instanceof Error ? error.message : String(error)}`, context);
        }
      }

      // 6. Workspace boundary enforcement
      const boundaryCheck = this.boundaryEnforcer.enforceWorkspaceBoundary(sanitizedCommand, workingDirectory);
      if (!boundaryCheck.allowed) {
        this.executionLogger.logWorkspaceViolation(sanitizedCommand, workingDirectory, boundaryCheck.reason!);
        const context: ShellErrorContext = {
          command: sanitizedCommand,
          workingDirectory,
          timestamp: new Date(),
        };
        throw new ShellPathTraversalError(boundaryCheck.reason!, context);
      }

      // 7. File operation validation
      const fileOpCheck = this.boundaryEnforcer.validateFileOperations(sanitizedCommand);
      if (!fileOpCheck.allowed) {
        this.executionLogger.logWorkspaceViolation(sanitizedCommand, workingDirectory, fileOpCheck.reason!);
        const context: ShellErrorContext = {
          command: sanitizedCommand,
          workingDirectory,
          timestamp: new Date(),
        };
        throw new ShellPathTraversalError(fileOpCheck.reason!, context);
      }

      // 8. Final command preparation
      finalCommand = boundaryCheck.sanitizedCommand || sanitizedCommand;
      this.executionLogger.logCommandAllowed(finalCommand, workingDirectory, filterCheck.reason);

      // 9. Start performance monitoring
      performanceMonitor.startMonitoring();

      // 10. Execute command with timeout and error handling
      result = await this.executeCommandWithTimeout(finalCommand, workingDirectory, timeout);

      // 11. Stop performance monitoring
      const performanceMetrics = performanceMonitor.stopMonitoring();

      // 12. Analyze command risk and extract metadata
      const riskAnalysis = ShellErrorCategorizer.analyzeCommandRisk(finalCommand, workingDirectory, result.executionTime);
      const commandMetadata = ShellErrorCategorizer.extractCommandMetadata(finalCommand);
      const fileOperations = ShellPerformanceMonitor.estimateFileOperations(finalCommand, result.stdout, result.stderr);
      const networkActivity = ShellPerformanceMonitor.estimateNetworkActivity(finalCommand, result.stdout, result.stderr);

      // 13. Log comprehensive execution details
      const logEntry: Omit<ShellExecutionLog, 'timestamp' | 'id' | 'sessionId'> = {
        command: finalCommand,
        workingDirectory,
        workingDirectoryRelative: this.security.getRelativePathFromWorkspace(workingDirectory),
        exitCode: result.exitCode,
        executionTime: result.executionTime,
        success: result.success,
        stdout: result.stdout,
        stderr: result.stderr,
        outputSize: (result.stdout.length + result.stderr.length),
        securityEvents,
        performance: {
          networkActivity: {
            requests: networkActivity.requests,
            bytesTransferred: networkActivity.bytesTransferred,
          },
          fileSystemOperations: {
            reads: fileOperations.reads,
            writes: fileOperations.writes,
            bytesRead: fileOperations.bytesRead,
            bytesWritten: fileOperations.bytesWritten,
          },
        },
        riskAssessment: {
          riskScore: riskAnalysis.riskScore,
          riskFactors: riskAnalysis.riskFactors,
          manualApprovalRequired: riskAnalysis.riskScore > 70,
          approved: true, // Since it was executed
        },
        metadata: {
          category: commandMetadata.category,
          fileOperations: commandMetadata.fileOperations,
          networkOperations: commandMetadata.networkOperations,
          environmentVariables: commandMetadata.environmentVariables,
          tags: commandMetadata.tags,
        },
      };

      if (command !== finalCommand) {
        logEntry.originalCommand = command;
      }

      if (!result.success) {
        logEntry.errorType = ShellErrorType.EXECUTION_ERROR;
        logEntry.error = {
          message: result.stderr || 'Command execution failed',
          type: ShellErrorType.EXECUTION_ERROR,
          suggestions: ['Check command output for error details', 'Verify command syntax'],
          retryable: true,
          code: result.exitCode,
        };
      }

      if (performanceMetrics.cpuUsage !== undefined) {
        logEntry.performance.cpuUsage = performanceMetrics.cpuUsage;
      }

      if (performanceMetrics.memoryUsage !== undefined) {
        logEntry.performance.memoryUsage = performanceMetrics.memoryUsage;
      }

      this.executionLogger.logExecution(logEntry);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              command: finalCommand,
              originalCommand: command !== finalCommand ? command : undefined,
              workingDirectory: this.security.getRelativePathFromWorkspace(workingDirectory),
              timeout,
              result,
              security: {
                validated: true,
                sanitized: sanitizedCommand !== command,
                riskScore: riskAnalysis.riskScore,
                riskFactors: riskAnalysis.riskFactors,
                phase: 'Phase 4 - Enhanced Logging and Error Handling',
              },
              performance: performanceMetrics,
              metadata: commandMetadata,
            }, null, 2),
          },
        ],
      };

    } catch (error) {
      
      // Stop performance monitoring if it was started
      performanceMonitor.stopMonitoring();

      // Create appropriate error context
      const executionTime = performance.now() - startTime;

      // Use error categorization for better error handling
      let categorizedError: ShellExecutionError;
      
      if (error instanceof ShellExecutionError) {
        categorizedError = error;
      } else {
        // Categorize the error using the new system
        categorizedError = ShellErrorCategorizer.createCategorizedError(
          error,
          result?.exitCode || -1,
          result?.stdout || '',
          result?.stderr || '',
          finalCommand,
          workingDirectory,
          executionTime,
          error
        );
      }

      // Log failed execution with comprehensive details
      const failedLogEntry: Omit<ShellExecutionLog, 'timestamp' | 'id' | 'sessionId'> = {
        command: finalCommand,
        workingDirectory,
        workingDirectoryRelative: this.security.getRelativePathFromWorkspace(workingDirectory),
        exitCode: categorizedError.code || -1,
        executionTime,
        success: false,
        stdout: result?.stdout || '',
        stderr: result?.stderr || categorizedError.message,
        outputSize: (result?.stdout?.length || 0) + (result?.stderr?.length || 0) + categorizedError.message.length,
        errorType: categorizedError.errorType,
        error: {
          message: categorizedError.message,
          type: categorizedError.errorType,
          suggestions: categorizedError.suggestions,
          retryable: categorizedError.retryable,
        },
        securityEvents,
        performance: {
          networkActivity: {
            requests: 0,
            bytesTransferred: 0,
          },
          fileSystemOperations: {
            reads: 0,
            writes: 0,
            bytesRead: 0,
            bytesWritten: 0,
          },
        },
        riskAssessment: {
          riskScore: 0,
          riskFactors: ['Execution failed'],
          manualApprovalRequired: false,
          approved: false,
        },
        metadata: {
          category: 'error',
          fileOperations: [],
          networkOperations: [],
          environmentVariables: [],
          tags: ['error', 'failed'],
        },
      };

      if (command !== finalCommand) {
        failedLogEntry.originalCommand = command;
      }

      if (categorizedError.code !== undefined) {
        failedLogEntry.error!.code = categorizedError.code;
      }

      this.executionLogger.logExecution(failedLogEntry);

      // Re-throw the categorized error
      throw categorizedError;
    }
  }

  /**
   * Execute command with timeout handling and structured error response
   */
  private async executeCommandWithTimeout(
    command: string,
    workingDirectory: string,
    timeoutSeconds: number
  ): Promise<ShellExecuteResult> {
    const execAsync = promisify(exec);
    const startTime = performance.now();

    try {
      // Set up AbortController for timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeoutSeconds * 1000);

      // Execute command
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDirectory,
        signal: abortController.signal,
        maxBuffer: 1024 * 1024, // 1MB buffer limit
      });

      clearTimeout(timeoutId);
      const executionTime = performance.now() - startTime;

      return {
        success: true,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: 0,
        executionTime: Math.round(executionTime),
      };
    } catch (error: any) {
      const executionTime = performance.now() - startTime;

      // Handle timeout
      if (error.name === 'AbortError' || error.signal === 'SIGTERM') {
        return {
          success: false,
          stdout: '',
          stderr: `Command timed out after ${timeoutSeconds} seconds`,
          exitCode: -1,
          executionTime: Math.round(executionTime),
        };
      }

      // Handle command not found
      if (error.code === 'ENOENT') {
        return {
          success: false,
          stdout: '',
          stderr: `Command not found: ${command}`,
          exitCode: 127,
          executionTime: Math.round(executionTime),
        };
      }

      // Handle permission denied
      if (error.code === 'EACCES') {
        return {
          success: false,
          stdout: '',
          stderr: `Permission denied: ${command}`,
          exitCode: 126,
          executionTime: Math.round(executionTime),
        };
      }

      // Handle non-zero exit codes (command ran but failed)
      if (error.code && typeof error.code === 'number') {
        return {
          success: false,
          stdout: error.stdout || '',
          stderr: error.stderr || error.message,
          exitCode: error.code,
          executionTime: Math.round(executionTime),
        };
      }

      // Handle other errors
      return {
        success: false,
        stdout: '',
        stderr: error.message || 'Unknown execution error',
        exitCode: 1,
        executionTime: Math.round(executionTime),
      };
    }
  }

  // Security and configuration methods
  updateConfiguration(config: Partial<ShellToolConfig>): void {
    this.commandFilter.updateConfig(config);
  }

  getConfiguration(): ShellToolConfig {
    return this.commandFilter.getConfig();
  }

  getSecuritySummary() {
    return this.executionLogger.getSecuritySummary();
  }

  getSecurityEvents(limit?: number): ShellSecurityEvent[] {
    return this.executionLogger.getSecurityEvents(limit);
  }

  getExecutionLogs(limit?: number): ShellExecutionLog[] {
    return this.executionLogger.getExecutionLogs(limit);
  }

  queryExecutionLogs(query: ShellLogQuery): ShellExecutionLog[] {
    return this.executionLogger.queryExecutionLogs(query);
  }

  getExecutionStatistics(): ShellLogStatistics {
    return this.executionLogger.getExecutionStatistics();
  }

  exportSecurityReport(): string {
    return this.executionLogger.exportSecurityReport();
  }

  exportLogs(config: ShellLogExportConfig): string {
    return this.executionLogger.exportLogs(config);
  }

  clearSecurityLogs(): void {
    this.executionLogger.clearLogs();
  }

  rotateLogs(): void {
    this.executionLogger.rotateLogs();
  }

  addAllowedCommand(command: string): void {
    this.commandFilter.addAllowedCommand(command);
  }

  addBlockedCommand(command: string): void {
    this.commandFilter.addBlockedCommand(command);
  }

  resetConfigurationToDefaults(): void {
    this.commandFilter.resetToDefaults();
  }

  // New enhanced methods for Phase 4
  getSessionId(): string {
    return this.sessionId;
  }

  analyzeCommandRisk(command: string, workingDirectory?: string): {
    riskScore: number;
    riskFactors: string[];
    category: string;
  } {
    return ShellErrorCategorizer.analyzeCommandRisk(
      command,
      workingDirectory || this.security.getWorkspaceRoot(),
      0
    );
  }

  extractCommandMetadata(command: string): {
    category: string;
    fileOperations: string[];
    networkOperations: string[];
    environmentVariables: string[];
    tags: string[];
  } {
    return ShellErrorCategorizer.extractCommandMetadata(command);
  }

  categorizeError(
    error: unknown,
    exitCode: number,
    stdout: string,
    stderr: string,
    command: string,
    workingDirectory: string,
    executionTime: number
  ): {
    errorType: ShellErrorType;
    suggestions: string[];
    retryable: boolean;
    context: ShellErrorContext;
  } {
    return ShellErrorCategorizer.categorizeError(
      error,
      exitCode,
      stdout,
      stderr,
      command,
      workingDirectory,
      executionTime
    );
  }
}