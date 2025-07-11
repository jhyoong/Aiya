import { CommandRegistry, CommandDefinition } from './CommandRegistry.js';

export interface SlashCommand {
  name: string;
  usage: string;
  description: string;
  parameters?: string[] | undefined;
}

export interface SuggestionResult {
  displayText: string;
  completionText: string;
}

export class SuggestionEngine {
  /**
   * Convert CommandDefinition to SlashCommand for backward compatibility
   */
  private static convertToSlashCommand(
    command: CommandDefinition
  ): SlashCommand {
    return {
      name: command.name,
      usage: command.usage,
      description: command.description,
      ...(command.parameters && { parameters: command.parameters }),
    };
  }

  /**
   * Get all commands from the CommandRegistry
   */
  private getCommands(): SlashCommand[] {
    return CommandRegistry.getAllCommands().map(cmd =>
      SuggestionEngine.convertToSlashCommand(cmd)
    );
  }

  getSuggestion(input: string): SuggestionResult | null {
    // Only provide suggestions for slash commands
    if (!input.startsWith('/')) {
      return null;
    }

    // If input is just '/', show the first command
    if (input === '/') {
      const commands = this.getCommands();
      const firstCommand = commands[0];
      return firstCommand
        ? {
            displayText: firstCommand.usage,
            completionText: `/${firstCommand.name}`,
          }
        : null;
    }

    const commandPart = input.slice(1); // Remove the '/'

    // Use CommandRegistry for exact match
    const exactMatch = CommandRegistry.getCommand(commandPart);
    if (exactMatch) {
      return {
        displayText: exactMatch.usage,
        completionText: `/${exactMatch.name}`,
      };
    }

    // Use CommandRegistry for partial matches
    const partialMatches = CommandRegistry.findCommands(commandPart);

    if (partialMatches.length === 1) {
      const match = partialMatches[0];
      if (match) {
        return {
          displayText: match.usage,
          completionText: `/${match.name}`,
        };
      }
    }

    // If multiple matches, return the first one
    if (partialMatches.length > 1) {
      const firstMatch = partialMatches[0];
      if (firstMatch) {
        return {
          displayText: firstMatch.usage,
          completionText: `/${firstMatch.name}`,
        };
      }
    }

    return null;
  }

  getAllSuggestions(input: string): SlashCommand[] {
    if (!input.startsWith('/')) {
      return [];
    }

    if (input === '/') {
      return this.getCommands();
    }

    const commandPart = input.slice(1);
    const matches = CommandRegistry.findCommands(commandPart);
    return matches.map(cmd => SuggestionEngine.convertToSlashCommand(cmd));
  }

  isValidCommand(input: string): boolean {
    if (!input.startsWith('/')) {
      return false;
    }

    const commandPart = input.slice(1).split(' ')[0];
    return commandPart ? CommandRegistry.hasCommand(commandPart) : false;
  }

  getCommandHelp(commandName: string): SlashCommand | null {
    const command = CommandRegistry.getCommand(commandName);
    return command ? SuggestionEngine.convertToSlashCommand(command) : null;
  }
}
