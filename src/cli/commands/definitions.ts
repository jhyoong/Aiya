import { CommandDefinition, CommandRegistry } from '../CommandRegistry.js';
import { CommandContext } from '../CommandExecutor.js';
import { ProviderFactory } from '../../core/providers/factory.js';
import { TokenCounter } from '../../core/tokens/counter.js';
import { glob } from 'glob';
import { SEARCH } from '../../core/config/limits-constants.js';

/**
 * Parse search command arguments to determine search mode and options
 */
function parseSearchArgs(args: string[]): {
  query: string;
  options: any;
  useContentSearch: boolean;
} {
  const query = args[0] || '';
  const options: any = {
    searchType: 'fuzzy',
    maxResults: SEARCH.DEFAULT_MAX_RESULTS,
    contextLines: 2,
  };

  let useContentSearch = false;

  // Check if any arguments start with '--' (CLI flags)
  const hasFlags = args.some(arg => arg && arg.startsWith('--'));

  if (hasFlags) {
    useContentSearch = true;
    options.searchType = 'literal'; // Default for content search

    // Parse flag-value pairs
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];

      if (arg && arg.startsWith('--')) {
        const flag = arg.slice(2);
        const nextArg = args[i + 1];

        switch (flag) {
          case 'searchType':
            if (nextArg && !nextArg.startsWith('--')) {
              options.searchType = nextArg;
              i++; // Skip next arg as it's the value
            }
            break;
          case 'maxResults':
            if (nextArg && !nextArg.startsWith('--')) {
              options.maxResults =
                parseInt(nextArg, 10) || SEARCH.DEFAULT_MAX_RESULTS;
              i++; // Skip next arg as it's the value
            }
            break;
          case 'contextLines':
            if (nextArg && !nextArg.startsWith('--')) {
              options.contextLines = parseInt(nextArg, 10) || 2;
              i++; // Skip next arg as it's the value
            }
            break;
          case 'includeGlobs': {
            // Collect all non-flag arguments following this flag
            const includeGlobs = [];
            let j = i + 1;
            while (j < args.length && args[j] && !args[j]!.startsWith('--')) {
              includeGlobs.push(args[j]);
              j++;
            }
            if (includeGlobs.length > 0) {
              options.includeGlobs = includeGlobs;
              i = j - 1; // Set i to last consumed argument
            }
            break;
          }
          case 'excludeGlobs': {
            // Collect all non-flag arguments following this flag
            const excludeGlobs = [];
            let k = i + 1;
            while (k < args.length && args[k] && !args[k]!.startsWith('--')) {
              excludeGlobs.push(args[k]);
              k++;
            }
            if (excludeGlobs.length > 0) {
              options.excludeGlobs = excludeGlobs;
              i = k - 1; // Set i to last consumed argument
            }
            break;
          }
        }
      }
    }
  }

  return { query, options, useContentSearch };
}

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

        const readResult = await context.mcpClient.callTool('ReadFile', {
          path: args[0],
        });
        if (readResult.isError) {
          return `Error: ${readResult.content[0]?.text}`;
        } else {
          const readResponse = JSON.parse(readResult.content[0]?.text || '{}');
          const fileContent = readResponse.content || '';
          return `File: ${args[0]}\n${fileContent}`;
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

        const addResult = await context.mcpClient.callTool('ReadFile', {
          path: args[0],
        });
        if (addResult.isError) {
          return `Error: ${addResult.content[0]?.text}`;
        } else {
          const addResponse = JSON.parse(addResult.content[0]?.text || '{}');
          const fileContent = addResponse.content || '';
          const formattedContent = `File: ${args[0]}\n\`\`\`\n${fileContent}\n\`\`\``;
          context.session.addedFiles.push(formattedContent);
          return `Added ${args[0]} to context for the next prompt`;
        }
      },
    },
  },
  {
    name: 'search',
    description: 'Search for files by name (default) or content with options',
    usage: '/search <pattern> [--flags]',
    category: 'core',
    parameters: ['<pattern>', '[--flags]'],
    examples: [
      '/search component',
      '/search utils.ts',
      `/search "import React" --searchType literal --maxResults ${SEARCH.SMALL_MAX_RESULTS}`,
      '/search error --includeGlobs "*.ts" "*.js" --excludeGlobs "*.test.*"',
    ],
    requiresConfig: false,
    handler: {
      execute: async (args: string[], context?: CommandContext) => {
        if (!context?.session || !context?.mcpClient) {
          throw new Error('Command requires active chat session');
        }

        if (args.length === 0) {
          return 'Usage: /search <pattern> [--flags]\n\nExamples:\n  /search component (filename search)\n  /search "class" --searchType literal (content search)';
        }

        // Parse arguments to detect if CLI flags are used
        const { query, options, useContentSearch } = parseSearchArgs(args);

        if (useContentSearch) {
          // Advanced mode: Use MCP SearchFiles tool for content search
          const searchResult = await context.mcpClient.callTool('SearchFiles', {
            pattern: query,
            options: options,
          });

          if (searchResult.isError) {
            return `Error: ${searchResult.content[0]?.text}`;
          }

          const searchResponse = JSON.parse(
            searchResult.content[0]?.text || '{}'
          );
          const results = searchResponse.results || [];

          if (results.length === 0) {
            return `No content matches found for pattern: ${query}`;
          }

          return `Found ${results.length} content matches:\n${results.map((match: any) => `  ${match.file}:${match.line} - ${match.match}`).join('\n')}`;
        } else {
          // Default mode: Fuzzy search filenames
          try {
            const workspaceRoot = context.workingDirectory || process.cwd();
            const pattern = `**/*${query}*`;

            const files = await glob(pattern, {
              cwd: workspaceRoot,
              ignore: [
                '**/node_modules/**',
                '**/.git/**',
                '**/dist/**',
                '**/build/**',
              ],
              nodir: true,
              maxDepth: SEARCH.MAX_DIRECTORY_DEPTH,
            });

            if (files.length === 0) {
              return `No files found matching: ${query}`;
            }

            // Limit results for readability
            const maxResults = options.maxResults || SEARCH.ALT_MAX_RESULTS;
            const displayFiles = files.slice(0, maxResults);
            const truncated = files.length > maxResults;

            let result = `Found ${files.length} file${files.length === 1 ? '' : 's'} matching "${query}":\n`;
            result += displayFiles.map(file => `  ${file}`).join('\n');

            if (truncated) {
              result += `\n... and ${files.length - maxResults} more files`;
            }

            return result;
          } catch (error) {
            return `Error searching files: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
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

            const session = context.session; // Type narrowing after null check
            const providerList = availableProviders
              .map(name => {
                const config = session.configManager.getProviderConfig(name);
                const current =
                  name === session.currentProviderName ? ' (current)' : '';
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

          const session = context.session; // Type narrowing after null check
          const providerList = availableProviders
            .map(name => {
              const config = session.configManager.getProviderConfig(name);
              const current =
                name === session.currentProviderName ? ' (current)' : '';
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
