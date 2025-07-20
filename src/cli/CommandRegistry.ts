import { CommandContext } from './CommandExecutor.js';

/**
 * Categories for organizing commands in the registry
 */
export type CommandCategory = 'core' | 'config' | 'utility';

/**
 * Handler interface for command execution
 */
export interface CommandHandler {
  execute(args: string[], context?: CommandContext): Promise<string> | string;
}

/**
 * Complete definition of a command including metadata and handler
 */
export interface CommandDefinition {
  name: string;
  description: string;
  usage: string;
  aliases?: string[];
  handler: CommandHandler;
  requiresConfig?: boolean;
  category: CommandCategory;
  parameters?: string[];
  examples?: string[];
}

/**
 * Result of command validation including error details and suggestions
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  suggestions?: string[];
}

export class CommandRegistry {
  private static commands = new Map<string, CommandDefinition>();
  private static aliases = new Map<string, string>();

  /**
   * Register a command with the registry
   */
  static registerCommand(definition: CommandDefinition): void {
    this.commands.set(definition.name, definition);

    // Register aliases
    if (definition.aliases) {
      for (const alias of definition.aliases) {
        this.aliases.set(alias, definition.name);
      }
    }
  }

  /**
   * Get a command by name or alias
   */
  static getCommand(name: string): CommandDefinition | undefined {
    // Try direct command name first
    const command = this.commands.get(name);
    if (command) {
      return command;
    }

    // Try alias lookup
    const aliasTarget = this.aliases.get(name);
    if (aliasTarget) {
      return this.commands.get(aliasTarget);
    }

    return undefined;
  }

  /**
   * Get all registered commands
   */
  static getAllCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands by category
   */
  static getCommandsByCategory(category: CommandCategory): CommandDefinition[] {
    return this.getAllCommands().filter(cmd => cmd.category === category);
  }

  /**
   * Check if a command exists
   */
  static hasCommand(name: string): boolean {
    return this.commands.has(name) || this.aliases.has(name);
  }

  /**
   * Find commands that match a partial name
   */
  static findCommands(partial: string): CommandDefinition[] {
    const lowerPartial = partial.toLowerCase();
    const results: CommandDefinition[] = [];

    // Check direct command names
    for (const [name, command] of this.commands) {
      if (name.toLowerCase().startsWith(lowerPartial)) {
        results.push(command);
      }
    }

    // Check aliases
    for (const [alias, commandName] of this.aliases) {
      if (alias.toLowerCase().startsWith(lowerPartial)) {
        const command = this.commands.get(commandName);
        if (command && !results.includes(command)) {
          results.push(command);
        }
      }
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Validate a command and its arguments
   */
  static validateCommand(name: string, args: string[]): ValidationResult {
    const command = this.getCommand(name);

    if (!command) {
      const similar = this.findCommands(name);
      return {
        valid: false,
        error: `Unknown command: ${name}`,
        suggestions:
          similar.length > 0
            ? [`Did you mean: ${similar.map(c => c.name).join(', ')}?`]
            : ['Use /help to see available commands'],
      };
    }

    // Basic parameter validation
    if (command.parameters) {
      const requiredParams = command.parameters.filter(
        p => !p.startsWith('[') || !p.endsWith(']')
      );
      if (args.length < requiredParams.length) {
        return {
          valid: false,
          error: `Missing required parameters for ${command.name}`,
          suggestions: [`Usage: ${command.usage}`, ...(command.examples || [])],
        };
      }
    }

    return { valid: true };
  }

  /**
   * Generate help text for a specific command or all commands
   */
  static generateHelpText(commandName?: string): string {
    if (commandName) {
      const command = this.getCommand(commandName);
      if (!command) {
        return `Unknown command: ${commandName}`;
      }

      let help = `**${command.name}** - ${command.description}\n\n`;
      help += `**Usage:** ${command.usage}\n`;

      if (command.aliases && command.aliases.length > 0) {
        help += `**Aliases:** ${command.aliases.join(', ')}\n`;
      }

      if (command.examples && command.examples.length > 0) {
        help += `**Examples:**\n`;
        for (const example of command.examples) {
          help += `  ${example}\n`;
        }
      }

      if (command.requiresConfig) {
        help += `\n*Note: This command requires project configuration*\n`;
      }

      return help;
    }

    // Generate help for all commands, grouped by category
    let help = '**Available Commands**\n\n';

    const categories: CommandCategory[] = ['core', 'config', 'utility'];

    for (const category of categories) {
      const commands = this.getCommandsByCategory(category);
      if (commands.length === 0) continue;

      help += `**${category.charAt(0).toUpperCase() + category.slice(1)} Commands:**\n`;

      for (const command of commands.sort((a, b) =>
        a.name.localeCompare(b.name)
      )) {
        help += `  **/${command.name}** - ${command.description}\n`;
        if (command.aliases && command.aliases.length > 0) {
          help += `    *Aliases: ${command.aliases.join(', ')}*\n`;
        }
      }
      help += '\n';
    }

    help +=
      'Use `/help <command>` for detailed information about a specific command.\n';
    return help;
  }

  /**
   * Get command names for autocomplete
   */
  static getCommandNames(): string[] {
    const names = Array.from(this.commands.keys());
    const aliasNames = Array.from(this.aliases.keys());
    return [...names, ...aliasNames].sort();
  }

  /**
   * Clear all registered commands (useful for testing)
   */
  static clear(): void {
    this.commands.clear();
    this.aliases.clear();
  }

  /**
   * Get command statistics
   */
  static getStats(): {
    totalCommands: number;
    totalAliases: number;
    categoryCounts: Record<CommandCategory, number>;
  } {
    const categoryCounts: Record<CommandCategory, number> = {
      core: 0,
      config: 0,
      utility: 0,
    };

    for (const command of this.commands.values()) {
      categoryCounts[command.category]++;
    }

    return {
      totalCommands: this.commands.size,
      totalAliases: this.aliases.size,
      categoryCounts,
    };
  }
}
