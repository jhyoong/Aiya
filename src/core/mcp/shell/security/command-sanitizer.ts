/**
 * Command Sanitizer
 * 
 * Validates and sanitizes shell commands to prevent injection attacks
 * and other security vulnerabilities.
 */

import {
  SHELL_EXPANSION_PATTERNS,
  LIMITS,
} from '../constants.js';

/**
 * Result of command validation
 */
export interface ValidationResult {
  /** Whether the command is valid */
  valid: boolean;
  
  /** Reason for validation failure */
  reason?: string;
  
  /** Sanitized version of the command */
  sanitized?: string;
  
  /** Validation warnings */
  warnings?: string[];
}

/**
 * Command Sanitizer
 * 
 * Provides static methods to validate and sanitize shell commands
 * for security and safety.
 */
export class CommandSanitizer {
  /**
   * Validate command input for security issues
   * 
   * @param command - The command to validate
   * @returns Validation result with sanitized command if valid
   */
  static validateInput(command: string): ValidationResult {
    if (!command || typeof command !== 'string') {
      return { 
        valid: false, 
        reason: 'Command must be a non-empty string' 
      };
    }

    // Check length limit
    if (command.length > LIMITS.MAX_COMMAND_LENGTH) {
      return {
        valid: false,
        reason: `Command exceeds maximum length of ${LIMITS.MAX_COMMAND_LENGTH} characters`,
      };
    }

    // Check for empty command
    if (command.trim().length === 0) {
      return {
        valid: false,
        reason: 'Command cannot be empty or only whitespace',
      };
    }

    // Check for control characters
    const controlCharCheck = this.checkControlCharacters(command);
    if (!controlCharCheck.valid) {
      return controlCharCheck;
    }

    // Check for shell expansion patterns
    const expansionCheck = this.checkShellExpansion(command);
    if (!expansionCheck.valid) {
      return expansionCheck;
    }

    // Check for command injection
    const injectionCheck = this.checkCommandInjection(command);
    if (!injectionCheck.valid) {
      return injectionCheck;
    }

    // Sanitize the command
    const sanitized = this.sanitizeCommand(command);
    const warnings = this.generateWarnings(command, sanitized);

    return { 
      valid: true, 
      sanitized,
      warnings: warnings.length > 0 ? warnings : []
    };
  }

  /**
   * Sanitize a command by removing dangerous patterns
   * 
   * @param command - The command to sanitize
   * @returns Sanitized command string
   */
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

  /**
   * Check for null bytes and control characters
   */
  private static checkControlCharacters(command: string): ValidationResult {
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(command)) {
      return {
        valid: false,
        reason: 'Command contains invalid control characters',
      };
    }
    return { valid: true };
  }

  /**
   * Check for dangerous shell expansion patterns
   */
  private static checkShellExpansion(command: string): ValidationResult {
    for (const pattern of SHELL_EXPANSION_PATTERNS) {
      if (pattern.test(command)) {
        return {
          valid: false,
          reason: `Command contains dangerous shell expansion pattern: ${pattern.toString()}`,
        };
      }
    }
    return { valid: true };
  }

  /**
   * Check for command injection patterns
   */
  private static checkCommandInjection(command: string): ValidationResult {
    if (this.containsCommandInjection(command)) {
      return {
        valid: false,
        reason: 'Command contains potential command injection patterns',
      };
    }
    return { valid: true };
  }

  /**
   * Detect command injection patterns
   */
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

    return chainPatterns.some(pattern => pattern.test(command));
  }

  /**
   * Generate warnings for potentially problematic but not invalid commands
   */
  private static generateWarnings(original: string, sanitized: string): string[] {
    const warnings: string[] = [];

    // Check if sanitization changed the command
    if (original !== sanitized) {
      warnings.push('Command was modified during sanitization');
    }

    // Check for complex commands that might be risky
    if (this.isComplexCommand(original)) {
      warnings.push('Command contains complex operations (pipes, redirects, etc.)');
    }

    // Check for globbing patterns
    if (/[*?]/.test(original)) {
      warnings.push('Command contains wildcard patterns');
    }

    // Check for path traversal attempts
    if (/\.\.\//.test(original)) {
      warnings.push('Command contains path traversal patterns');
    }

    return warnings;
  }

  /**
   * Check if command has complex operations
   */
  private static isComplexCommand(command: string): boolean {
    const complexPatterns = [
      /[;|&]/, // Command chaining or pipes
      /[<>]/, // Redirections
      /[`$]/, // Command substitution or variable expansion
      /[{}]/, // Brace expansion
      /[*?]/, // Glob patterns
    ];

    return complexPatterns.some(pattern => pattern.test(command));
  }

  /**
   * Extract potential file paths from command for validation
   * 
   * @param command - The command to analyze
   * @returns Array of potential file paths found in the command
   */
  static extractFilePathsFromCommand(command: string): string[] {
    const paths: string[] = [];

    // Simple regex to extract potential file paths
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

    // Remove duplicates and clean up paths
    return [...new Set(paths)].map(path => path.trim());
  }

  /**
   * Check if command appears to be attempting path traversal
   * 
   * @param command - The command to check
   * @returns True if path traversal patterns are detected
   */
  static hasPathTraversal(command: string): boolean {
    const traversalPatterns = [
      /\.\.\/+/,
      /\/\.\.\/+/,
      /\.\.\\+/,
      /\\\.\.\\+/,
    ];

    return traversalPatterns.some(pattern => pattern.test(command));
  }

  /**
   * Check if command contains network operations
   * 
   * @param command - The command to check
   * @returns True if network operations are detected
   */
  static hasNetworkOperations(command: string): boolean {
    const networkPatterns = [
      /curl\s/,
      /wget\s/,
      /nc\s/,
      /netcat\s/,
      /ssh\s/,
      /scp\s/,
      /rsync\s.*::/,
      /ping\s/,
      /telnet\s/,
      /ftp\s/,
    ];

    return networkPatterns.some(pattern => pattern.test(command));
  }

  /**
   * Normalize command for consistent comparison
   * 
   * @param command - The command to normalize
   * @returns Normalized command string
   */
  static normalizeCommand(command: string): string {
    return command
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Check if two commands are functionally equivalent after normalization
   * 
   * @param command1 - First command
   * @param command2 - Second command
   * @returns True if commands are equivalent
   */
  static areCommandsEquivalent(command1: string, command2: string): boolean {
    return this.normalizeCommand(command1) === this.normalizeCommand(command2);
  }

  /**
   * Check if command is a simple command without complex features
   */
  static isSimpleCommand(command: string): boolean {
    // Check for pipes, redirects, command substitution, etc.
    const complexPatterns = [
      /\|/,        // pipes
      />/,         // redirects
      /</,         // input redirects
      /`/,         // command substitution
      /\$\(/,      // command substitution
      /&&/,        // command chaining
      /\|\|/,      // or logic
      /;/,         // command separator
    ];
    
    return !complexPatterns.some(pattern => pattern.test(command));
  }
}