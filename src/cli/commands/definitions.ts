import { CommandDefinition, CommandRegistry } from '../CommandRegistry.js';

/**
 * Core slash command definitions for the Aiya CLI
 */
export const CORE_COMMANDS: CommandDefinition[] = [
  {
    name: 'read',
    description: 'Read and display file content',
    usage: '/read <file_path>',
    category: 'core',
    parameters: ['<file_path>'],
    examples: [
      '/read src/main.ts',
      '/read package.json'
    ],
    requiresConfig: false,
    handler: {
      execute: async (_args: string[]) => {
        // Handler implementation will be provided during integration
        throw new Error('Handler not implemented yet');
      }
    }
  },
  {
    name: 'add',
    description: 'Add file content to context for next prompt',
    usage: '/add <file_path>',
    category: 'core',
    parameters: ['<file_path>'],
    examples: [
      '/add src/components/Button.tsx',
      '/add docs/api.md'
    ],
    requiresConfig: false,
    handler: {
      execute: async (_args: string[]) => {
        throw new Error('Handler not implemented yet');
      }
    }
  },
  {
    name: 'search',
    description: 'Search for files matching pattern',
    usage: '/search <pattern>',
    category: 'core',
    parameters: ['<pattern>'],
    examples: [
      '/search *.ts',
      '/search components/',
      '/search "class Component"'
    ],
    requiresConfig: false,
    handler: {
      execute: async (_args: string[]) => {
        throw new Error('Handler not implemented yet');
      }
    }
  },
  {
    name: 'tokens',
    description: 'Show token usage statistics',
    usage: '/tokens',
    category: 'utility',
    parameters: [],
    examples: ['/tokens'],
    requiresConfig: false,
    handler: {
      execute: async (_args: string[]) => {
        throw new Error('Handler not implemented yet');
      }
    }
  },
  {
    name: 'thinking',
    description: 'Set thinking display mode (on/brief/off)',
    usage: '/thinking [mode]',
    category: 'utility',
    parameters: ['[mode]'],
    examples: [
      '/thinking on',
      '/thinking brief',
      '/thinking off',
      '/thinking'
    ],
    requiresConfig: false,
    handler: {
      execute: async (_args: string[]) => {
        throw new Error('Handler not implemented yet');
      }
    }
  },
  {
    name: 'model-switch',
    description: 'Switch between configured AI providers/models',
    usage: '/model-switch [provider]',
    aliases: ['switch', 'model'],
    category: 'config',
    parameters: ['[provider]'],
    examples: [
      '/model-switch',
      '/model-switch ollama-qwen3',
      '/model-switch openai-gpt4'
    ],
    requiresConfig: true,
    handler: {
      execute: async (_args: string[]) => {
        throw new Error('Handler not implemented yet');
      }
    }
  },
  {
    name: 'help',
    description: 'Show help information for commands',
    usage: '/help [command]',
    aliases: ['h', '?'],
    category: 'utility',
    parameters: ['[command]'],
    examples: [
      '/help',
      '/help read',
      '/help model-switch'
    ],
    requiresConfig: false,
    handler: {
      execute: async (args: string[]) => {
        const commandName = args[0];
        return CommandRegistry.generateHelpText(commandName);
      }
    }
  },
  {
    name: 'exit',
    description: 'Exit the application gracefully',
    usage: '/exit',
    aliases: ['quit', 'q'],
    category: 'utility',
    parameters: [],
    examples: ['/exit', '/quit'],
    requiresConfig: false,
    handler: {
      execute: async (_args: string[]) => {
        throw new Error('Handler not implemented yet');
      }
    }
  },
  {
    name: 'clear',
    description: 'Clear the chat history and context',
    usage: '/clear',
    aliases: ['cls'],
    category: 'utility',
    parameters: [],
    examples: ['/clear'],
    requiresConfig: false,
    handler: {
      execute: async (_args: string[]) => {
        throw new Error('Handler not implemented yet');
      }
    }
  },
  {
    name: 'config',
    description: 'Manage Aiya configuration settings',
    usage: '/config [action] [options]',
    category: 'config',
    parameters: ['[action]', '[options]'],
    examples: [
      '/config',
      '/config add-provider',
      '/config list',
      '/config set model ollama-llama3'
    ],
    requiresConfig: false,
    handler: {
      execute: async (_args: string[]) => {
        throw new Error('Handler not implemented yet');
      }
    }
  }
];

/**
 * Register all default commands with the CommandRegistry
 */
export function registerDefaultCommands(): void {
  for (const command of CORE_COMMANDS) {
    CommandRegistry.registerCommand(command);
  }
}

/**
 * Get command definition by name (for external access)
 */
export function getCommandDefinition(name: string): CommandDefinition | undefined {
  return CORE_COMMANDS.find(cmd => cmd.name === name || cmd.aliases?.includes(name));
}