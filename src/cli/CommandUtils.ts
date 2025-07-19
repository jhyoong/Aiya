import { CommandDefinition } from './CommandRegistry.js';
import { CONTENT } from '../core/config/threshold-constants.js';

export interface ArgumentDefinition {
  name: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'file' | 'directory';
  description?: string;
  defaultValue?: any;
  allowedValues?: string[];
}

export interface ParsedArguments {
  [key: string]: any;
}

export class CommandUtils {
  /**
   * Parse parameter definitions from usage string
   * Example: "/read <file_path>" -> [{ name: 'file_path', required: true, type: 'file' }]
   */
  static parseParameterDefinitions(
    _usage: string,
    parameters?: string[]
  ): ArgumentDefinition[] {
    if (!parameters) return [];

    return parameters.map(param => {
      const isRequired = param.startsWith('<') && param.endsWith('>');
      const isOptional = param.startsWith('[') && param.endsWith(']');

      let name = param;
      if (isRequired || isOptional) {
        name = param.slice(1, -1);
      }

      // Infer type from parameter name
      let type: ArgumentDefinition['type'] = 'string';
      if (name.includes('path') || name.includes('file')) {
        type = 'file';
      } else if (name.includes('dir') || name.includes('directory')) {
        type = 'directory';
      } else if (
        name.includes('count') ||
        name.includes('number') ||
        name.includes('size')
      ) {
        type = 'number';
      } else if (
        name.includes('enable') ||
        name.includes('disable') ||
        name.includes('flag')
      ) {
        type = 'boolean';
      }

      return {
        name,
        required: isRequired,
        type,
        description: `${name} parameter`,
      };
    });
  }

  /**
   * Parse command arguments based on argument definitions
   */
  static parseArguments(
    args: string[],
    definitions: ArgumentDefinition[]
  ): ParsedArguments {
    const parsed: ParsedArguments = {};

    for (let i = 0; i < definitions.length; i++) {
      const def = definitions[i];
      if (!def) continue;

      const value = args[i];

      if (!value && def.required) {
        throw new Error(`Missing required argument: ${def.name}`);
      }

      if (!value && def.defaultValue !== undefined) {
        parsed[def.name] = def.defaultValue;
        continue;
      }

      if (!value) {
        continue; // Optional argument not provided
      }

      // Type conversion
      try {
        switch (def.type) {
          case 'number':
            parsed[def.name] = parseFloat(value);
            if (isNaN(parsed[def.name])) {
              throw new Error(`Invalid number: ${value}`);
            }
            break;
          case 'boolean':
            parsed[def.name] =
              value.toLowerCase() === 'true' ||
              value === '1' ||
              value.toLowerCase() === 'yes';
            break;
          case 'string':
          case 'file':
          case 'directory':
          default:
            parsed[def.name] = value;
            break;
        }

        // Validate allowed values
        if (
          def.allowedValues &&
          !def.allowedValues.includes(parsed[def.name])
        ) {
          throw new Error(
            `Invalid value for ${def.name}. Allowed values: ${def.allowedValues.join(', ')}`
          );
        }
      } catch (error: any) {
        throw new Error(`Error parsing argument ${def.name}: ${error.message}`);
      }
    }

    return parsed;
  }

  /**
   * Generate usage help text for a command
   */
  static generateUsageHelp(command: CommandDefinition): string {
    let help = `**${command.name}** - ${command.description}\n\n`;
    help += `**Usage:** ${command.usage}\n`;

    if (command.aliases && command.aliases.length > 0) {
      help += `**Aliases:** ${command.aliases.join(', ')}\n`;
    }

    if (command.parameters && command.parameters.length > 0) {
      help += `\n**Parameters:**\n`;
      const definitions = this.parseParameterDefinitions(
        command.usage,
        command.parameters
      );

      for (const def of definitions) {
        const required = def.required ? '(required)' : '(optional)';
        help += `  **${def.name}** ${required} - ${def.description}\n`;
      }
    }

    if (command.examples && command.examples.length > 0) {
      help += `\n**Examples:**\n`;
      for (const example of command.examples) {
        help += `  ${example}\n`;
      }
    }

    if (command.requiresConfig) {
      help += `\n*Note: This command requires project configuration (run \`aiya init\` first)*\n`;
    }

    return help;
  }

  /**
   * Validate file path argument
   */
  static validateFilePath(path: string): { valid: boolean; error?: string } {
    if (!path || typeof path !== 'string') {
      return { valid: false, error: 'File path must be a non-empty string' };
    }

    // Basic path validation (expand as needed)
    if (path.includes('..')) {
      return { valid: false, error: 'Path traversal not allowed' };
    }

    if (path.startsWith('/') && process.platform === 'win32') {
      return {
        valid: false,
        error: 'Absolute Unix paths not supported on Windows',
      };
    }

    return { valid: true };
  }

  /**
   * Validate directory path argument
   */
  static validateDirectoryPath(path: string): {
    valid: boolean;
    error?: string;
  } {
    return this.validateFilePath(path); // Same validation for now
  }

  /**
   * Sanitize command input to prevent injection
   */
  static sanitizeInput(input: string): string {
    // Remove potentially dangerous characters
    return input.replace(/[;&|`$(){}[\]\\]/g, '');
  }

  /**
   * Format command execution result for display
   */
  static formatResult(result: any): string {
    if (typeof result === 'string') {
      return result;
    }

    if (typeof result === 'object') {
      return JSON.stringify(result, null, 2);
    }

    return String(result);
  }

  /**
   * Check if a command name is valid
   */
  static isValidCommandName(name: string): boolean {
    // Command names should be alphanumeric with hyphens
    return /^[a-z0-9-]+$/.test(name);
  }

  /**
   * Suggest similar command names based on typos
   */
  static suggestSimilarCommands(
    input: string,
    availableCommands: string[]
  ): string[] {
    const suggestions: string[] = [];
    const inputLower = input.toLowerCase();

    for (const command of availableCommands) {
      const commandLower = command.toLowerCase();

      // Exact prefix match
      if (commandLower.startsWith(inputLower)) {
        suggestions.push(command);
        continue;
      }

      // Levenshtein distance for typo detection
      const distance = this.levenshteinDistance(inputLower, commandLower);
      if (distance <= CONTENT.EDIT_DISTANCE_THRESHOLD && command.length > CONTENT.MIN_STRING_LENGTH) {
        suggestions.push(command);
      }
    }

    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      const row = matrix[0];
      if (row) row[i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      const col = matrix[j];
      if (col) col[0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        const currentRow = matrix[j];
        const prevRow = matrix[j - 1];
        const currentRowPrev = matrix[j];

        if (currentRow && prevRow && currentRowPrev) {
          currentRow[i] = Math.min(
            (currentRowPrev[i - 1] || 0) + 1, // deletion
            (prevRow[i] || 0) + 1, // insertion
            (prevRow[i - 1] || 0) + indicator // substitution
          );
        }
      }
    }

    const lastRow = matrix[str2.length];
    return lastRow ? lastRow[str1.length] || 0 : 0;
  }
}
