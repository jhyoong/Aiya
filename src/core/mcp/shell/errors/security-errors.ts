/**
 * Security-Related Shell Error Classes
 * 
 * Error classes for security violations, blocked commands, and dangerous operations.
 * Updated to use category-based context instead of risk scores.
 */

import { ShellExecutionError } from './base-errors.js';
import { ShellErrorType, ShellErrorContext } from '../types.js';

/**
 * Base Shell Security Error
 * 
 * Parent class for all security-related shell errors.
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
 * Shell Command Blocked Error
 * 
 * Thrown when a command is blocked by security policy.
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
        'Contact administrator if this command should be allowed',
      ],
      false, // Security errors are not retryable
      403
    );
    this.name = 'ShellCommandBlockedError';
  }
}

/**
 * Shell Path Traversal Error
 * 
 * Thrown when path traversal attempts are detected in commands.
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
        'Use relative paths from workspace root',
      ],
      false, // Security errors are not retryable
      403
    );
    this.name = 'ShellPathTraversalError';
  }
}

/**
 * Shell Workspace Violation Error
 * 
 * Thrown when commands attempt to access files outside the workspace.
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
        'Avoid accessing system directories',
      ]
    );
    this.name = 'ShellWorkspaceViolationError';
  }
}

/**
 * Shell Dangerous Command Error
 * 
 * Thrown when dangerous commands are detected.
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
        'Contact administrator if this operation is necessary',
      ]
    );
    this.name = 'ShellDangerousCommandError';
  }
}

/**
 * Shell Command Injection Error
 * 
 * Thrown when potential command injection is detected.
 */
export class ShellCommandInjectionError extends ShellSecurityError {
  constructor(command: string, suspiciousPattern: string, context: ShellErrorContext) {
    super(
      `Potential command injection detected in: ${command}. Suspicious pattern: ${suspiciousPattern}`,
      context,
      'COMMAND_INJECTION',
      [
        'Avoid using special characters like ;, |, &, $, `, etc.',
        'Use proper escaping for command arguments',
        'Break complex commands into simpler parts',
        'Validate all input parameters',
      ]
    );
    this.name = 'ShellCommandInjectionError';
  }
}

/**
 * Shell Privilege Escalation Error
 * 
 * Thrown when commands attempt privilege escalation.
 */
export class ShellPrivilegeEscalationError extends ShellSecurityError {
  constructor(command: string, context: ShellErrorContext) {
    super(
      `Privilege escalation attempt detected: ${command}`,
      context,
      'PRIVILEGE_ESCALATION',
      [
        'Commands requiring elevated privileges are not allowed',
        'Use commands that work within your current permission level',
        'Contact administrator for system-level operations',
        'Consider alternative approaches that don\'t require elevated access',
      ]
    );
    this.name = 'ShellPrivilegeEscalationError';
  }
}

/**
 * Shell File System Restriction Error
 * 
 * Thrown when commands attempt to access restricted file system areas.
 */
export class ShellFileSystemRestrictionError extends ShellSecurityError {
  constructor(command: string, restrictedPath: string, context: ShellErrorContext) {
    super(
      `File system restriction: ${command} attempted to access restricted path ${restrictedPath}`,
      context,
      'FILE_SYSTEM_RESTRICTION',
      [
        'Access to system directories is restricted',
        'Work within your designated workspace directory',
        'Use relative paths from the workspace root',
        'Contact administrator if access to this path is required',
      ]
    );
    this.name = 'ShellFileSystemRestrictionError';
  }
}

/**
 * Shell Network Restriction Error
 * 
 * Thrown when commands attempt network operations that are restricted.
 */
export class ShellNetworkRestrictionError extends ShellSecurityError {
  constructor(command: string, networkOperation: string, context: ShellErrorContext) {
    super(
      `Network restriction: ${command} attempted ${networkOperation}`,
      context,
      'NETWORK_RESTRICTION',
      [
        'Network operations may be restricted in this environment',
        'Use local alternatives when possible',
        'Contact administrator for network access requirements',
        'Consider if the operation is necessary for your task',
      ]
    );
    this.name = 'ShellNetworkRestrictionError';
  }
}