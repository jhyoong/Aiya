/**
 * Command Categorization System
 * 
 * Provides simple pattern-based categorization to replace the complex risk assessment system.
 * Commands are categorized into four levels: SAFE, RISKY, DANGEROUS, BLOCKED
 */

import {
  SAFE_COMMAND_PATTERNS,
  RISKY_COMMAND_PATTERNS,
  DANGEROUS_COMMAND_PATTERNS,
  BLOCKED_COMMAND_PATTERNS,
} from './constants.js';

/**
 * Command security categories
 */
export enum CommandCategory {
  /** Safe commands that execute without confirmation */
  SAFE = 'safe',
  
  /** Risky commands that require confirmation */
  RISKY = 'risky',
  
  /** Dangerous commands that require confirmation with warnings */
  DANGEROUS = 'dangerous',
  
  /** Blocked commands that are never allowed */
  BLOCKED = 'blocked',
}

/**
 * Result of command categorization
 */
export interface CommandCategorization {
  /** The assigned category */
  category: CommandCategory;
  
  /** The pattern that matched (if any) */
  matchedPattern?: string;
  
  /** Human-readable reason for the categorization */
  reason: string;
  
  /** Whether user confirmation is required */
  requiresConfirmation: boolean;
  
  /** Whether the command should be allowed to execute */
  allowExecution: boolean;
  
  /** Additional context about the categorization */
  context?: {
    /** Command type (e.g., 'file_operation', 'network', 'system') */
    type?: string;
    
    /** Potential impact description */
    impact?: string;
    
    /** Suggested alternatives if blocked */
    alternatives?: string[];
  };
}

/**
 * Main command categorization function
 * 
 * Analyzes a command and assigns it to one of four security categories
 * based on pattern matching. This replaces the complex risk scoring system.
 * 
 * @param command - The command string to categorize
 * @returns CommandCategorization result with category and metadata
 */
export function categorizeCommand(command: string): CommandCategorization {
  if (!command || typeof command !== 'string') {
    return {
      category: CommandCategory.BLOCKED,
      reason: 'Invalid command input',
      requiresConfirmation: false,
      allowExecution: false,
      context: {
        type: 'validation_error',
        impact: 'No command provided',
      },
    };
  }

  const normalizedCommand = command.trim().toLowerCase();
  
  if (normalizedCommand.length === 0) {
    return {
      category: CommandCategory.BLOCKED,
      reason: 'Empty command',
      requiresConfirmation: false,
      allowExecution: false,
      context: {
        type: 'validation_error',
        impact: 'No operation to perform',
      },
    };
  }

  // 1. Check blocked patterns first (highest priority)
  const blockedResult = checkBlockedPatterns(command, normalizedCommand);
  if (blockedResult) {
    return blockedResult;
  }

  // 2. Check dangerous patterns
  const dangerousResult = checkDangerousPatterns(command, normalizedCommand);
  if (dangerousResult) {
    return dangerousResult;
  }

  // 3. Check safe patterns
  const safeResult = checkSafePatterns(command, normalizedCommand);
  if (safeResult) {
    return safeResult;
  }

  // 4. Check risky patterns
  const riskyResult = checkRiskyPatterns(command, normalizedCommand);
  if (riskyResult) {
    return riskyResult;
  }

  // 5. Default to risky for unknown commands
  return {
    category: CommandCategory.RISKY,
    reason: 'Unknown command requires confirmation for safety',
    requiresConfirmation: true,
    allowExecution: true,
    context: {
      type: 'unknown_command',
      impact: 'Unverified operation - proceed with caution',
      alternatives: ['Verify command safety before proceeding'],
    },
  };
}

/**
 * Check if command matches any blocked patterns
 */
function checkBlockedPatterns(
  _command: string,
  normalizedCommand: string
): CommandCategorization | null {
  for (const pattern of BLOCKED_COMMAND_PATTERNS) {
    if (matchesPattern(normalizedCommand, pattern)) {
      return {
        category: CommandCategory.BLOCKED,
        matchedPattern: pattern,
        reason: 'Command matches blocked pattern - operation not permitted',
        requiresConfirmation: false,
        allowExecution: false,
        context: {
          type: 'blocked_operation',
          impact: 'Potentially destructive operation blocked for safety',
          alternatives: [
            'Use safer alternatives',
            'Contact administrator if this operation is necessary',
          ],
        },
      };
    }
  }
  return null;
}

/**
 * Check if command matches any dangerous patterns
 */
function checkDangerousPatterns(
  _command: string,
  normalizedCommand: string
): CommandCategorization | null {
  for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
    if (matchesPattern(normalizedCommand, pattern)) {
      return {
        category: CommandCategory.DANGEROUS,
        matchedPattern: pattern,
        reason: 'Command contains dangerous operations - confirmation required',
        requiresConfirmation: true,
        allowExecution: true,
        context: {
          type: 'dangerous_operation',
          impact: 'High-risk operation that could affect system or data',
          alternatives: [
            'Consider safer alternatives',
            'Ensure you understand the consequences',
            'Create backups if modifying important data',
          ],
        },
      };
    }
  }
  return null;
}

/**
 * Check if command matches any safe patterns
 */
function checkSafePatterns(
  _command: string,
  normalizedCommand: string
): CommandCategorization | null {
  for (const pattern of SAFE_COMMAND_PATTERNS) {
    if (matchesPattern(normalizedCommand, pattern)) {
      return {
        category: CommandCategory.SAFE,
        matchedPattern: pattern,
        reason: 'Command matches safe pattern - approved for execution',
        requiresConfirmation: false,
        allowExecution: true,
        context: {
          type: 'safe_operation',
          impact: 'Read-only or low-impact operation',
        },
      };
    }
  }
  return null;
}

/**
 * Check if command matches any risky patterns
 */
function checkRiskyPatterns(
  _command: string,
  normalizedCommand: string
): CommandCategorization | null {
  for (const pattern of RISKY_COMMAND_PATTERNS) {
    if (matchesPattern(normalizedCommand, pattern)) {
      return {
        category: CommandCategory.RISKY,
        matchedPattern: pattern,
        reason: 'Command matches risky pattern - confirmation recommended',
        requiresConfirmation: true,
        allowExecution: true,
        context: {
          type: 'risky_operation',
          impact: 'Moderate-risk operation that modifies workspace',
          alternatives: [
            'Review the operation before proceeding',
            'Ensure workspace is backed up if needed',
          ],
        },
      };
    }
  }
  return null;
}

/**
 * Test if a command matches a pattern
 * Supports both string matching and regex patterns
 */
function matchesPattern(command: string, pattern: string): boolean {
  try {
    // If pattern starts with ^, treat as regex
    if (pattern.startsWith('^')) {
      const regex = new RegExp(pattern, 'i');
      return regex.test(command);
    }
    
    // Otherwise, simple string inclusion
    return command.includes(pattern.toLowerCase());
  } catch (error) {
    // If regex is malformed, fall back to string inclusion
    return command.includes(pattern.toLowerCase());
  }
}

/**
 * Get category display information for UI purposes
 */
export function getCategoryInfo(category: CommandCategory): {
  displayName: string;
  color: string;
  icon: string;
  description: string;
} {
  switch (category) {
    case CommandCategory.SAFE:
      return {
        displayName: 'Safe',
        color: 'green',
        icon: '✓',
        description: 'Low-risk operations that can execute without confirmation',
      };
      
    case CommandCategory.RISKY:
      return {
        displayName: 'Risky',
        color: 'yellow',
        icon: '⚠',
        description: 'Medium-risk operations that require user confirmation',
      };
      
    case CommandCategory.DANGEROUS:
      return {
        displayName: 'Dangerous',
        color: 'orange',
        icon: '⚠',
        description: 'High-risk operations that require confirmation with warnings',
      };
      
    case CommandCategory.BLOCKED:
      return {
        displayName: 'Blocked',
        color: 'red',
        icon: '✗',
        description: 'Blocked operations that are not permitted for safety',
      };
      
    default:
      return {
        displayName: 'Unknown',
        color: 'gray',
        icon: '?',
        description: 'Unknown category',
      };
  }
}

/**
 * Check if a category requires confirmation
 */
export function requiresConfirmation(category: CommandCategory): boolean {
  return category === CommandCategory.RISKY || category === CommandCategory.DANGEROUS;
}

/**
 * Check if a category allows execution
 */
export function allowsExecution(category: CommandCategory): boolean {
  return category !== CommandCategory.BLOCKED;
}

/**
 * Get suggested confirmation message for a category
 */
export function getConfirmationMessage(
  category: CommandCategory,
  command: string
): string {
  switch (category) {
    case CommandCategory.RISKY:
      return `Execute risky command: "${command}"?\nThis operation will modify your workspace.`;
      
    case CommandCategory.DANGEROUS:
      return `⚠ WARNING: Execute dangerous command: "${command}"?\nThis operation could have significant system impact. Proceed with caution.`;
      
    case CommandCategory.BLOCKED:
      return `❌ Command blocked: "${command}"\nThis operation is not permitted for safety reasons.`;
      
    default:
      return `Execute command: "${command}"?`;
  }
}

/**
 * Batch categorize multiple commands
 * Useful for analyzing command sequences or pipelines
 */
export function categorizeCommands(commands: string[]): CommandCategorization[] {
  return commands.map(categorizeCommand);
}

/**
 * Get the highest risk category from a list of categorizations
 * Used when analyzing command pipelines or sequences
 */
export function getHighestRiskCategory(
  categorizations: CommandCategorization[]
): CommandCategory {
  const categoryPriority = {
    [CommandCategory.BLOCKED]: 4,
    [CommandCategory.DANGEROUS]: 3,
    [CommandCategory.RISKY]: 2,
    [CommandCategory.SAFE]: 1,
  };

  let highestCategory = CommandCategory.SAFE;
  let highestPriority = 0;

  for (const cat of categorizations) {
    const priority = categoryPriority[cat.category];
    if (priority > highestPriority) {
      highestPriority = priority;
      highestCategory = cat.category;
    }
  }

  return highestCategory;
}