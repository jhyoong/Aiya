/**
 * Dangerous Command Detector
 * 
 * Detects dangerous command patterns that could cause system damage.
 * This module replaces the complex risk scoring with simple boolean detection.
 */

import {
  DANGEROUS_COMMANDS,
  DANGEROUS_PATTERNS,
} from '../constants.js';

/**
 * Result of dangerous command detection
 */
export interface DangerousCommandResult {
  /** Whether the command is dangerous */
  dangerous: boolean;
  
  /** Reason why the command is considered dangerous */
  reason?: string;
  
  /** The specific pattern or command that matched */
  matched?: string;
  
  /** Severity level of the dangerous operation */
  severity?: 'high' | 'critical';
}

/**
 * Dangerous Command Detector
 * 
 * Provides static methods to detect dangerous commands and patterns.
 * Simplified version that removes complex risk scoring in favor of 
 * straightforward pattern matching.
 */
export class DangerousCommandDetector {
  /**
   * Check if a command contains dangerous operations
   * 
   * @param command - The command to analyze
   * @returns Detection result with reason if dangerous
   */
  static isDangerous(command: string): DangerousCommandResult {
    if (!command || typeof command !== 'string') {
      return { dangerous: false };
    }

    const normalizedCommand = command.toLowerCase().trim();

    // Check exact command matches first
    const exactMatch = this.checkExactMatches(normalizedCommand);
    if (exactMatch.dangerous) {
      return exactMatch;
    }

    // Check regex patterns
    const patternMatch = this.checkPatterns(command);
    if (patternMatch.dangerous) {
      return patternMatch;
    }

    return { dangerous: false };
  }

  /**
   * Check for exact dangerous command matches
   */
  private static checkExactMatches(normalizedCommand: string): DangerousCommandResult {
    for (const dangerousCmd of DANGEROUS_COMMANDS) {
      const normalizedDangerous = dangerousCmd.toLowerCase();
      
      if (normalizedCommand.includes(normalizedDangerous)) {
        // Determine severity based on command type
        const severity = this.getSeverityForCommand(dangerousCmd);
        
        return {
          dangerous: true,
          reason: `Contains dangerous command: ${dangerousCmd}`,
          matched: dangerousCmd,
          severity,
        };
      }
    }
    
    return { dangerous: false };
  }

  /**
   * Check for dangerous regex patterns
   */
  private static checkPatterns(command: string): DangerousCommandResult {
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        // Determine severity based on pattern type
        const severity = this.getSeverityForPattern(pattern);
        
        return {
          dangerous: true,
          reason: `Matches dangerous pattern: ${pattern.toString()}`,
          matched: pattern.toString(),
          severity,
        };
      }
    }
    
    return { dangerous: false };
  }

  /**
   * Determine severity level for a specific command
   */
  private static getSeverityForCommand(command: string): 'high' | 'critical' {
    const criticalCommands = [
      'rm -rf /',
      'rm -rf /*',
      'format',
      'dd if=/dev/zero',
      'mkfs',
      'fdisk',
      ':(){ :|:& };:',
      'shutdown',
      'reboot',
      'halt',
      'poweroff',
    ];

    return criticalCommands.some(critical => 
      command.toLowerCase().includes(critical.toLowerCase())
    ) ? 'critical' : 'high';
  }

  /**
   * Determine severity level for a regex pattern
   */
  private static getSeverityForPattern(pattern: RegExp): 'high' | 'critical' {
    const criticalPatterns = [
      /^\/etc\//,
      /^\/usr\//,
      /^\/bin\//,
      /^\/sbin\//,
      />\s*\/dev\/[sh]d[a-z]/,
      /:\(\)\s*\{.*\|\s*:\s*&\s*\}\s*;:\s*/,
    ];

    return criticalPatterns.some(critical => 
      critical.toString() === pattern.toString()
    ) ? 'critical' : 'high';
  }

  /**
   * Check if a command is likely to be a system destruction command
   */
  static isSystemDestructive(command: string): boolean {
    const destructivePatterns = [
      'rm -rf /',
      'rm -rf /*',
      'format',
      'dd if=/dev/zero',
      'mkfs',
      'fdisk',
      'parted',
    ];

    const normalizedCommand = command.toLowerCase().trim();
    return destructivePatterns.some(pattern => 
      normalizedCommand.includes(pattern.toLowerCase())
    );
  }

  /**
   * Check if a command involves privilege escalation
   */
  static isPrivilegeEscalation(command: string): boolean {
    const escalationPatterns = [
      /sudo\s/,
      /su\s-/,
      /su\sroot/,
      /chmod\s+[4-7][0-7][0-7]/,
      /chmod\s+\+s/,
      /chown\s+root/,
    ];

    return escalationPatterns.some(pattern => pattern.test(command));
  }

  /**
   * Check if a command involves network operations
   */
  static isNetworkOperation(command: string): boolean {
    const networkPatterns = [
      /curl\s/,
      /wget\s/,
      /nc\s/,
      /netcat\s/,
      /ssh\s/,
      /scp\s/,
      /rsync\s.*::/,
    ];

    return networkPatterns.some(pattern => pattern.test(command));
  }

  /**
   * Check if a command involves file system modification
   */
  static isFileSystemModification(command: string): boolean {
    const modificationPatterns = [
      /rm\s/,
      /rmdir\s/,
      /mv\s/,
      /cp\s.*>/,
      /chmod\s/,
      /chown\s/,
      /mkdir\s/,
      /touch\s/,
      />\s*[^&]/,
      />>\s/,
    ];

    return modificationPatterns.some(pattern => pattern.test(command));
  }

  /**
   * Get a list of dangerous command categories for a given command
   */
  static categorizeCommand(command: string): string[] {
    const categories: string[] = [];

    if (this.isSystemDestructive(command)) {
      categories.push('system_destructive');
    }
    
    if (this.isPrivilegeEscalation(command)) {
      categories.push('privilege_escalation');
    }
    
    if (this.isNetworkOperation(command)) {
      categories.push('network_operation');
    }
    
    if (this.isFileSystemModification(command)) {
      categories.push('file_system_modification');
    }

    // Check for additional dangerous patterns
    const result = this.isDangerous(command);
    if (result.dangerous) {
      categories.push('dangerous_pattern');
    }

    return categories;
  }

  /**
   * Get human-readable explanation for why a command is dangerous
   */
  static getExplanation(command: string): string {
    const result = this.isDangerous(command);
    
    if (!result.dangerous) {
      return 'Command appears to be safe';
    }

    const categories = this.categorizeCommand(command);
    const explanations: string[] = [];

    if (categories.includes('system_destructive')) {
      explanations.push('Could cause irreversible system damage');
    }
    
    if (categories.includes('privilege_escalation')) {
      explanations.push('Attempts to escalate privileges');
    }
    
    if (categories.includes('network_operation')) {
      explanations.push('Performs network operations that could be risky');
    }
    
    if (categories.includes('file_system_modification')) {
      explanations.push('Modifies file system in potentially dangerous ways');
    }

    if (explanations.length === 0) {
      explanations.push(result.reason || 'Contains dangerous patterns');
    }

    return explanations.join('; ');
  }
}