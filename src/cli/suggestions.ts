export interface SlashCommand {
  name: string;
  usage: string;
  description: string;
  parameters?: string[];
}

export interface SuggestionResult {
  displayText: string;
  completionText: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: 'read',
    usage: '/read <file_path>',
    description: 'Read and display file content',
    parameters: ['<file_path>']
  },
  {
    name: 'add',
    usage: '/add <file_path>',
    description: 'Add file content to context for next prompt',
    parameters: ['<file_path>']
  },
  {
    name: 'search',
    usage: '/search <pattern>',
    description: 'Search for files matching pattern',
    parameters: ['<pattern>']
  },
  {
    name: 'tokens',
    usage: '/tokens',
    description: 'Show token usage statistics',
    parameters: []
  },
  {
    name: 'thinking',
    usage: '/thinking [mode]',
    description: 'Set thinking display mode (on/brief/off)',
    parameters: ['[mode]']
  }
];

export class SuggestionEngine {
  private commands: SlashCommand[];

  constructor(commands: SlashCommand[] = SLASH_COMMANDS) {
    this.commands = commands;
  }

  getSuggestion(input: string): SuggestionResult | null {
    // Only provide suggestions for slash commands
    if (!input.startsWith('/')) {
      return null;
    }

    // If input is just '/', show the first command
    if (input === '/') {
      const firstCommand = this.commands[0];
      return firstCommand ? {
        displayText: firstCommand.usage,
        completionText: `/${firstCommand.name}`
      } : null;
    }

    const commandPart = input.slice(1); // Remove the '/'
    
    // Find exact matches first
    const exactMatch = this.commands.find(cmd => cmd.name === commandPart);
    if (exactMatch) {
      return {
        displayText: exactMatch.usage,
        completionText: `/${exactMatch.name}`
      };
    }

    // Find partial matches
    const partialMatches = this.commands.filter(cmd => 
      cmd.name.startsWith(commandPart.toLowerCase())
    );

    if (partialMatches.length === 1) {
      const match = partialMatches[0];
      return match ? {
        displayText: match.usage,
        completionText: `/${match.name}`
      } : null;
    }

    // If multiple matches, return the first one
    if (partialMatches.length > 1) {
      const firstMatch = partialMatches[0];
      return firstMatch ? {
        displayText: firstMatch.usage,
        completionText: `/${firstMatch.name}`
      } : null;
    }

    return null;
  }

  getAllSuggestions(input: string): SlashCommand[] {
    if (!input.startsWith('/')) {
      return [];
    }

    if (input === '/') {
      return this.commands;
    }

    const commandPart = input.slice(1).toLowerCase();
    return this.commands.filter(cmd => 
      cmd.name.toLowerCase().startsWith(commandPart)
    );
  }

  isValidCommand(input: string): boolean {
    if (!input.startsWith('/')) {
      return false;
    }

    const commandPart = input.slice(1).split(' ')[0];
    return this.commands.some(cmd => cmd.name === commandPart);
  }

  getCommandHelp(commandName: string): SlashCommand | null {
    const command = this.commands.find(cmd => cmd.name === commandName);
    return command || null;
  }
}