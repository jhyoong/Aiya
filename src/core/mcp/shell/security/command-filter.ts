/**
 * Command Filter
 * 
 * Filters shell commands based on configuration, managing allowed/blocked commands,
 * auto-approval patterns, and confirmation requirements using the new category-based system.
 */

import { CommandSanitizer } from './command-sanitizer.js';
import { categorizeCommand, CommandCategory } from '../command-categorization.js';
import { DEFAULT_SHELL_CONFIG } from '../constants.js';
import { ShellToolConfig } from '../types.js';

/**
 * Result of command filtering
 */
export interface CommandFilterResult {
  /** Whether the command is allowed to execute */
  allowed: boolean;
  
  /** Reason if command is not allowed */
  reason?: string;
  
  /** Whether the command requires user confirmation */
  requiresConfirmation: boolean;
  
  /** Command category for security classification */
  category: CommandCategory;
  
  /** Pattern that matched (if any) */
  matchedPattern?: string;
}


/**
 * Filters commands based on security policies and configuration
 */
export class CommandFilter {
  private config: ShellToolConfig;
  
  constructor(config?: Partial<ShellToolConfig>) {
    this.config = { ...DEFAULT_SHELL_CONFIG, ...config };
    this.validateConfig();
  }

  /**
   * Determines if a command is allowed and whether it requires confirmation
   */
  isCommandAllowed(command: string): CommandFilterResult {
    const normalizedCommand = command.toLowerCase().trim();
    const commandName = this.extractCommandName(normalizedCommand);
    
    // Get command category using new categorization system
    const categorization = categorizeCommand(command);
    
    // Check if command is blocked by category
    if (categorization.category === CommandCategory.BLOCKED) {
      return {
        allowed: false,
        reason: categorization.reason,
        requiresConfirmation: false,
        category: categorization.category,
        ...(categorization.matchedPattern && { matchedPattern: categorization.matchedPattern }),
      };
    }
    
    // Check for dangerous commands
    if (categorization.category === CommandCategory.DANGEROUS) {
      if (!this.config.allowDangerous) {
        return {
          allowed: false,
          reason: 'Dangerous commands are disabled in configuration',
          requiresConfirmation: false,
          category: categorization.category,
          ...(categorization.matchedPattern && { matchedPattern: categorization.matchedPattern }),
        };
      }
      
      return {
        allowed: true,
        reason: categorization.reason,
        requiresConfirmation: this.config.requireConfirmationForDangerous,
        category: categorization.category,
        ...(categorization.matchedPattern && { matchedPattern: categorization.matchedPattern }),
      };
    }
    
    // Check if command is explicitly blocked by configuration
    if (this.isCommandBlocked(commandName, normalizedCommand)) {
      return {
        allowed: false,
        reason: `Command '${commandName}' is blocked by security policy`,
        requiresConfirmation: false,
        category: categorization.category,
      };
    }

    // Check for complex commands if not allowed
    if (
      !this.config.allowComplexCommands &&
      !CommandSanitizer.isSimpleCommand(command)
    ) {
      return {
        allowed: false,
        reason: 'Complex commands with pipes, redirections, or chaining are not allowed',
        requiresConfirmation: false,
        category: categorization.category,
      };
    }

    // Check if command matches trusted patterns (bypass confirmation)
    if (this.matchesTrustedPattern(normalizedCommand)) {
      return {
        allowed: true,
        requiresConfirmation: false,
        category: categorization.category,
        ...(categorization.matchedPattern && { matchedPattern: categorization.matchedPattern }),
      };
    }
    
    // Check legacy auto-approve patterns for backwards compatibility
    if (this.matchesAutoApprovePattern(normalizedCommand)) {
      return {
        allowed: true,
        requiresConfirmation: false,
        category: categorization.category,
        ...(categorization.matchedPattern && { matchedPattern: categorization.matchedPattern }),
      };
    }

    // Apply category-based confirmation rules
    let requiresConfirmation = false;
    
    if (categorization.category === CommandCategory.RISKY && this.config.requireConfirmationForRisky) {
      requiresConfirmation = true;
    }

    return {
      allowed: true,
      requiresConfirmation,
      category: categorization.category,
      ...(categorization.matchedPattern && { matchedPattern: categorization.matchedPattern }),
    };
  }

  /**
   * Updates the filter configuration
   */
  updateConfig(config: Partial<ShellToolConfig>): void {
    this.config = { ...this.config, ...config };
    this.validateConfig();
  }

  /**
   * Gets a copy of the current configuration
   */
  getConfig(): ShellToolConfig {
    return { ...this.config };
  }

  /**
   * Filter command for execution
   */
  async filterCommand(command: string, _workingDirectory: string): Promise<CommandFilterResult> {
    return this.isCommandAllowed(command);
  }

  /**
   * Adds a command to the allowed list
   */
  addAllowedCommand(command: string): void {
    if (!this.config.allowedCommands.includes(command)) {
      this.config.allowedCommands.push(command);
    }
  }

  /**
   * Removes a command from the allowed list
   */
  removeAllowedCommand(command: string): void {
    const index = this.config.allowedCommands.indexOf(command);
    if (index > -1) {
      this.config.allowedCommands.splice(index, 1);
    }
  }

  /**
   * Adds a command to the blocked list
   */
  addBlockedCommand(command: string): void {
    if (!this.config.blockedCommands.includes(command)) {
      this.config.blockedCommands.push(command);
    }
  }

  /**
   * Removes a command from the blocked list
   */
  removeBlockedCommand(command: string): void {
    const index = this.config.blockedCommands.indexOf(command);
    if (index > -1) {
      this.config.blockedCommands.splice(index, 1);
    }
  }

  /**
   * Adds a trusted command pattern
   */
  addTrustedPattern(pattern: string): void {
    if (!this.config.trustedCommands.includes(pattern)) {
      this.config.trustedCommands.push(pattern);
    }
  }

  /**
   * Removes a trusted command pattern
   */
  removeTrustedPattern(pattern: string): void {
    const index = this.config.trustedCommands.indexOf(pattern);
    if (index > -1) {
      this.config.trustedCommands.splice(index, 1);
    }
  }

  /**
   * Resets configuration to defaults
   */
  resetToDefaults(): void {
    this.config = { ...DEFAULT_SHELL_CONFIG };
  }

  /**
   * Extracts the base command name from a command string
   */
  private extractCommandName(command: string): string {
    const parts = command.split(/\s+/);
    return parts[0] || '';
  }

  /**
   * Checks if a command is explicitly blocked
   */
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

  /**
   * Checks if command matches trusted patterns (bypass confirmation)
   */
  private matchesTrustedPattern(command: string): boolean {
    for (const pattern of this.config.trustedCommands) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(command)) {
          return true;
        }
      } catch (error) {
        // Invalid regex pattern, skip
        continue;
      }
    }
    return false;
  }

  /**
   * Checks if command matches legacy auto-approve patterns
   */
  private matchesAutoApprovePattern(command: string): boolean {
    for (const pattern of this.config.autoApprovePatterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(command)) {
          return true;
        }
      } catch (error) {
        // Invalid regex pattern, skip
        continue;
      }
    }
    return false;
  }

  /**
   * Validates configuration values
   */
  private validateConfig(): void {
    // Validate confirmationTimeout
    if (this.config.confirmationTimeout <= 0) {
      throw new Error(
        `Invalid confirmationTimeout: ${this.config.confirmationTimeout}. Must be greater than 0.`
      );
    }

    // Validate maxExecutionTime
    if (this.config.maxExecutionTime <= 0) {
      throw new Error(
        `Invalid maxExecutionTime: ${this.config.maxExecutionTime}. Must be greater than 0.`
      );
    }

    // Validate arrays
    if (!Array.isArray(this.config.allowedCommands)) {
      throw new Error('allowedCommands must be an array');
    }

    if (!Array.isArray(this.config.blockedCommands)) {
      throw new Error('blockedCommands must be an array');
    }

    if (!Array.isArray(this.config.trustedCommands)) {
      throw new Error('trustedCommands must be an array');
    }

    if (!Array.isArray(this.config.autoApprovePatterns)) {
      throw new Error('autoApprovePatterns must be an array');
    }

    if (!Array.isArray(this.config.alwaysBlockPatterns)) {
      throw new Error('alwaysBlockPatterns must be an array');
    }

    // Validate boolean fields
    if (typeof this.config.sessionMemory !== 'boolean') {
      throw new Error('sessionMemory must be a boolean');
    }

    if (typeof this.config.allowComplexCommands !== 'boolean') {
      throw new Error('allowComplexCommands must be a boolean');
    }

    if (typeof this.config.requireConfirmationForRisky !== 'boolean') {
      throw new Error('requireConfirmationForRisky must be a boolean');
    }

    if (typeof this.config.requireConfirmationForDangerous !== 'boolean') {
      throw new Error('requireConfirmationForDangerous must be a boolean');
    }

    if (typeof this.config.allowDangerous !== 'boolean') {
      throw new Error('allowDangerous must be a boolean');
    }

    // Validate regex patterns in trustedCommands
    this.config.trustedCommands.forEach((pattern, index) => {
      try {
        new RegExp(pattern);
      } catch (error) {
        throw new Error(
          `Invalid regex pattern in trustedCommands[${index}]: ${pattern}`
        );
      }
    });

    // Validate regex patterns in autoApprovePatterns
    this.config.autoApprovePatterns.forEach((pattern, index) => {
      try {
        new RegExp(pattern);
      } catch (error) {
        throw new Error(
          `Invalid regex pattern in autoApprovePatterns[${index}]: ${pattern}`
        );
      }
    });

    // Validate regex patterns in alwaysBlockPatterns
    this.config.alwaysBlockPatterns.forEach((pattern, index) => {
      try {
        new RegExp(pattern);
      } catch (error) {
        throw new Error(
          `Invalid regex pattern in alwaysBlockPatterns[${index}]: ${pattern}`
        );
      }
    });
  }
}