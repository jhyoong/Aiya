import { CommandRegistry, CommandDefinition, ValidationResult } from './CommandRegistry.js';

export interface CommandContext {
  workingDirectory: string;
  configPath?: string;
  isConfigured: boolean;
  userId?: string;
  sessionId?: string;
}

export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  suggestions?: string[];
}

export class CommandExecutor {
  private context: CommandContext;

  constructor(context: CommandContext) {
    this.context = context;
  }

  /**
   * Parse a command line input into command name and arguments
   */
  static parseCommandLine(input: string): { command: string; args: string[] } {
    const trimmed = input.trim();
    
    if (!trimmed.startsWith('/')) {
      throw new Error('Invalid command format: must start with /');
    }

    // Remove the leading slash
    const withoutSlash = trimmed.slice(1);
    
    // Split on spaces but preserve quoted strings
    const parts = withoutSlash.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    
    // Remove quotes from quoted arguments
    const processedParts = parts.map(part => {
      if (part.startsWith('"') && part.endsWith('"')) {
        return part.slice(1, -1);
      }
      return part;
    });

    const command = processedParts[0] || '';
    const args = processedParts.slice(1);

    return { command, args };
  }

  /**
   * Validate a command before execution
   */
  validateCommand(commandName: string, args: string[]): ValidationResult {
    const validation = CommandRegistry.validateCommand(commandName, args);
    
    if (!validation.valid) {
      return validation;
    }

    // Additional validation for config-dependent commands
    const command = CommandRegistry.getCommand(commandName);
    if (command?.requiresConfig && !this.context.isConfigured) {
      return {
        valid: false,
        error: `Command ${commandName} requires project configuration`,
        suggestions: [
          'Run `aiya init` to configure the project',
          'Ensure .aiya.yaml exists in your project directory'
        ]
      };
    }

    return { valid: true };
  }

  /**
   * Execute a command with proper error handling and validation
   */
  async executeCommand(input: string): Promise<ExecutionResult> {
    try {
      const { command, args } = CommandExecutor.parseCommandLine(input);
      
      // Validate the command
      const validation = this.validateCommand(command, args);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || 'Validation failed',
          suggestions: validation.suggestions || []
        };
      }

      // Get the command definition
      const commandDef = CommandRegistry.getCommand(command);
      if (!commandDef) {
        return {
          success: false,
          error: `Unknown command: ${command}`,
          suggestions: ['Use /help to see available commands']
        };
      }

      // Execute the command
      try {
        const result = await commandDef.handler.execute(args, this.context);
        
        return {
          success: true,
          output: typeof result === 'string' ? result : JSON.stringify(result)
        };
      } catch (handlerError: any) {
        return {
          success: false,
          error: `Command execution failed: ${handlerError.message}`,
          suggestions: [
            `Use /help ${command} for usage information`,
            'Check command arguments and try again'
          ]
        };
      }

    } catch (parseError: any) {
      return {
        success: false,
        error: `Invalid command format: ${parseError.message}`,
        suggestions: [
          'Commands must start with /',
          'Use quotes for arguments with spaces',
          'Example: /read "file name.txt"'
        ]
      };
    }
  }

  /**
   * Get help for a command or list all commands
   */
  getHelp(commandName?: string): string {
    return CommandRegistry.generateHelpText(commandName);
  }

  /**
   * Update the execution context
   */
  updateContext(updates: Partial<CommandContext>): void {
    this.context = { ...this.context, ...updates };
  }

  /**
   * Get the current execution context
   */
  getContext(): CommandContext {
    return { ...this.context };
  }

  /**
   * Check if a command exists
   */
  hasCommand(commandName: string): boolean {
    return CommandRegistry.hasCommand(commandName);
  }

  /**
   * Get command suggestions for autocomplete
   */
  getCommandSuggestions(partial: string): string[] {
    if (!partial.startsWith('/')) {
      return [];
    }

    const commandPart = partial.slice(1);
    const matches = CommandRegistry.findCommands(commandPart);
    return matches.map(cmd => `/${cmd.name}`);
  }

  /**
   * Get detailed command information
   */
  getCommandInfo(commandName: string): CommandDefinition | undefined {
    return CommandRegistry.getCommand(commandName);
  }

  /**
   * Get command statistics
   */
  getStats(): { totalCommands: number; availableCommands: number; configRequiredCommands: number } {
    const allCommands = CommandRegistry.getAllCommands();
    const configRequiredCommands = allCommands.filter(cmd => cmd.requiresConfig);
    const availableCommands = this.context.isConfigured 
      ? allCommands.length 
      : allCommands.length - configRequiredCommands.length;

    return {
      totalCommands: allCommands.length,
      availableCommands,
      configRequiredCommands: configRequiredCommands.length
    };
  }
}