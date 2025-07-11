import { CommandDefinition, CommandRegistry } from '../CommandRegistry.js';
import { CommandContext } from '../CommandExecutor.js';
import { ProviderFactory } from '../../core/providers/factory.js';
import { TokenCounter } from '../../core/tokens/counter.js';

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
    examples: ['/read src/main.ts', '/read package.json'],
    requiresConfig: false,
    handler: {
      execute: async (args: string[], context?: CommandContext) => {
        if (!context?.session || !context?.mcpClient) {
          throw new Error('Command requires active chat session');
        }

        if (args.length === 0) {
          return 'Usage: /read <file_path>';
        }

        const readResult = await context.mcpClient.callTool('read_file', {
          path: args[0],
        });
        if (readResult.isError) {
          return `Error: ${readResult.content[0]?.text}`;
        } else {
          return `File: ${args[0]}\n${readResult.content[0]?.text}`;
        }
      },
    },
  },
  {
    name: 'add',
    description: 'Add file content to context for next prompt',
    usage: '/add <file_path>',
    category: 'core',
    parameters: ['<file_path>'],
    examples: ['/add src/components/Button.tsx', '/add docs/api.md'],
    requiresConfig: false,
    handler: {
      execute: async (args: string[], context?: CommandContext) => {
        if (!context?.session || !context?.mcpClient) {
          throw new Error('Command requires active chat session');
        }

        if (args.length === 0) {
          return 'Usage: /add <file_path>';
        }

        const addResult = await context.mcpClient.callTool('read_file', {
          path: args[0],
        });
        if (addResult.isError) {
          return `Error: ${addResult.content[0]?.text}`;
        } else {
          const fileContent = addResult.content[0]?.text || '';
          const formattedContent = `File: ${args[0]}\n\`\`\`\n${fileContent}\n\`\`\``;
          context.session.addedFiles.push(formattedContent);
          return `Added ${args[0]} to context for the next prompt`;
        }
      },
    },
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
      '/search "class Component"',
    ],
    requiresConfig: false,
    handler: {
      execute: async (args: string[], context?: CommandContext) => {
        if (!context?.session || !context?.mcpClient) {
          throw new Error('Command requires active chat session');
        }

        if (args.length === 0) {
          return 'Usage: /search <pattern>';
        }

        const searchResult = await context.mcpClient.callTool('search_files', {
          pattern: args[0],
        });
        if (searchResult.isError) {
          return `Error: ${searchResult.content[0]?.text}`;
        } else {
          const files = JSON.parse(searchResult.content[0]?.text || '[]');
          return `Found ${files.length} files:\n${files.map((f: string) => `  ${f}`).join('\n')}`;
        }
      },
    },
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
      execute: async (_args: string[], context?: CommandContext) => {
        if (!context?.session) {
          throw new Error('Command requires active chat session');
        }

        const usage = context.session.tokenCounter.getUsage();
        const stats = context.session.tokenCounter.getSessionStats();
        return `Session ID: ${context.session.tokenCounter.getSessionId()}\nTotal tokens: ${usage.total} (sent: ${usage.input}, received: ${usage.output})\nMessages: ${context.session.messages.length}\nAverage tokens per message: ${stats.averageTokensPerMessage}`;
      },
    },
  },
  {
    name: 'thinking',
    description: 'Set thinking display mode (on/brief/off)',
    usage: '/thinking [mode]',
    category: 'utility',
    parameters: ['[mode]'],
    examples: ['/thinking on', '/thinking brief', '/thinking off', '/thinking'],
    requiresConfig: false,
    handler: {
      execute: async (args: string[], context?: CommandContext) => {
        if (!context?.session) {
          throw new Error('Command requires active chat session');
        }

        if (args.length === 0) {
          return `Current thinking mode: ${context.session.thinkingMode}\nAvailable modes: on, brief, off`;
        }

        const mode = args[0]?.toLowerCase();
        if (mode === 'on' || mode === 'brief' || mode === 'off') {
          context.session.thinkingMode = mode as 'on' | 'brief' | 'off';
          return `Thinking mode set to: ${mode}`;
        } else {
          return `Invalid thinking mode: ${mode || 'undefined'}\nAvailable modes: on, brief, off`;
        }
      },
    },
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
      '/model-switch openai-gpt4',
    ],
    requiresConfig: true,
    handler: {
      execute: async (args: string[], context?: CommandContext) => {
        if (!context?.session) {
          throw new Error('Command requires active chat session');
        }

        try {
          const availableProviders =
            context.session.configManager.getAvailableProviders();

          // No arguments - list available providers
          if (args.length === 0) {
            if (availableProviders.length === 0) {
              return 'No providers configured. Please add provider configurations to your .aiya.yaml file.';
            }

            if (availableProviders.length === 1) {
              return 'Only one provider configured. Please add more provider configurations to enable switching.';
            }

            const providerList = availableProviders
              .map(name => {
                const config =
                  context.session!.configManager.getProviderConfig(name);
                const current =
                  name === context.session!.currentProviderName
                    ? ' (current)'
                    : '';
                return `  ${name}: ${config?.type || 'unknown'} - ${config?.model || 'unknown'}${current}`;
              })
              .join('\n');

            return `Available providers:\n${providerList}\n\nUsage: /model-switch <provider-name>`;
          }

          // Provider name specified
          const targetProvider = args[0];
          if (!targetProvider) {
            return 'Provider name is required. Usage: /model-switch <provider-name>';
          }

          if (!context.session.configManager.validateProvider(targetProvider)) {
            return `Provider "${targetProvider}" not found. Available providers: ${availableProviders.join(', ')}`;
          }

          // If switching to the same provider, just return current status
          if (targetProvider === context.session.currentProviderName) {
            const config =
              context.session.configManager.getProviderConfig(targetProvider);
            return `Already using provider "${targetProvider}" (${config?.type || 'unknown'} - ${config?.model || 'unknown'})`;
          }

          // Switch to new provider
          const success =
            await context.session.configManager.switchProvider(targetProvider);
          if (!success) {
            return `Failed to switch to provider "${targetProvider}"`;
          }

          // Create new provider instance
          const newProviderConfig =
            context.session.configManager.getProviderConfig(targetProvider);
          if (!newProviderConfig) {
            return `Failed to get configuration for provider "${targetProvider}"`;
          }

          const newProvider = ProviderFactory.create(newProviderConfig);

          // Update session
          context.session.provider = newProvider;
          context.session.currentProviderName = targetProvider;

          // Update token counter with new provider
          const modelInfo = await newProvider.getModelInfo();
          context.session.tokenCounter = new TokenCounter(
            newProvider,
            newProviderConfig.type,
            newProviderConfig.model,
            modelInfo.contextLength
          );

          return `Switched to provider "${targetProvider}" (${newProviderConfig.type} - ${newProviderConfig.model})`;
        } catch (error) {
          return `Error switching provider: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
    },
  },
  {
    name: 'help',
    description: 'Show help information for commands',
    usage: '/help [command]',
    aliases: ['h', '?'],
    category: 'utility',
    parameters: ['[command]'],
    examples: ['/help', '/help read', '/help model-switch'],
    requiresConfig: false,
    handler: {
      execute: async (args: string[]) => {
        const commandName = args[0];
        return CommandRegistry.generateHelpText(commandName);
      },
    },
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
      execute: async (_args: string[], _context?: CommandContext) => {
        return 'Goodbye!';
      },
    },
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
      execute: async (_args: string[], context?: CommandContext) => {
        if (!context?.session) {
          throw new Error('Command requires active chat session');
        }

        context.session.messages = [];
        context.session.tokenCounter.resetSession();
        context.session.addedFiles = [];
        return '🧹 Session cleared';
      },
    },
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
      '/config set model ollama-llama3',
    ],
    requiresConfig: false,
    handler: {
      execute: async (args: string[], context?: CommandContext) => {
        if (!context?.session) {
          throw new Error('Command requires active chat session');
        }

        if (args.length === 0) {
          const currentProvider =
            context.session.configManager.getCurrentProvider();
          const availableProviders =
            context.session.configManager.getAvailableProviders();

          return (
            `Current Configuration:\n` +
            `  Current Provider: ${context.session.currentProviderName}\n` +
            `  Type: ${currentProvider.type}\n` +
            `  Model: ${currentProvider.model}\n` +
            `  Base URL: ${currentProvider.baseUrl || 'default'}\n` +
            `  Available Providers: ${availableProviders.join(', ')}\n\n` +
            `Use '/config list' to see all providers or '/help config' for more options.`
          );
        }

        const action = args[0]?.toLowerCase();
        if (action === 'list') {
          const availableProviders =
            context.session.configManager.getAvailableProviders();
          if (availableProviders.length === 0) {
            return 'No providers configured.';
          }

          const providerList = availableProviders
            .map(name => {
              const config =
                context.session!.configManager.getProviderConfig(name);
              const current =
                name === context.session!.currentProviderName
                  ? ' (current)'
                  : '';
              return `  ${name}: ${config?.type || 'unknown'} - ${config?.model || 'unknown'}${current}`;
            })
            .join('\n');

          return `Configured Providers:\n${providerList}`;
        }

        return `Config action '${action}' not implemented yet. Available actions: list`;
      },
    },
  },
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
export function getCommandDefinition(
  name: string
): CommandDefinition | undefined {
  return CORE_COMMANDS.find(
    cmd => cmd.name === name || cmd.aliases?.includes(name)
  );
}
