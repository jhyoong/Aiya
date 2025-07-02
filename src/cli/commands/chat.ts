import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'readline';
import { ConfigManager } from '../../core/config/manager.js';
import { OllamaProvider } from '../../core/providers/ollama.js';
import { WorkspaceSecurity } from '../../core/security/workspace.js';
import { FilesystemMCPClient } from '../../core/mcp/filesystem.js';
import { Message } from '../../core/providers/base.js';
import { MCPToolService } from '../../core/tools/mcp-tools.js';
import { ToolExecutor } from '../../core/tools/executor.js';

interface ChatSession {
  messages: Message[];
  tokenCount: number;
  toolService?: MCPToolService;
  toolExecutor?: ToolExecutor;
}

export const chatCommand = new Command('chat')
  .description('Start an interactive chat session')
  .option('-f, --file <path>', 'Include file content in context')
  .option('-c, --context <pattern>', 'Include files matching pattern in context')
  .option('--no-stream', 'Disable streaming responses')
  .action(async (options) => {
    try {
      const configManager = new ConfigManager();
      const config = await configManager.load();
      
      const provider = new OllamaProvider(config.provider.model, config.provider.baseUrl);
      const security = new WorkspaceSecurity(
        process.cwd(),
        config.security.allowedExtensions,
        config.security.maxFileSize
      );
      const mcpClient = new FilesystemMCPClient(security);
      await mcpClient.connect();
      
      // Verify connection
      if (!(await provider.isHealthy())) {
        throw new Error('Cannot connect to Ollama server');
      }
      
      console.log(chalk.blue('🤖 Aiya Chat Session Started'));
      console.log(chalk.gray(`   Model: ${config.provider.model}`));
      console.log(chalk.gray('   Type "exit" to quit, "help" for commands'));
      console.log();
      
      // Initialize MCP tool service
      const toolService = new MCPToolService([mcpClient]);
      await toolService.initialize();
      
      const toolExecutor = new ToolExecutor(toolService, process.env.AIYA_VERBOSE === 'true');
      
      const session: ChatSession = {
        messages: [],
        tokenCount: 0,
        toolService,
        toolExecutor
      };
      
      // Add system message with tool definitions
      const toolsSystemMessage = toolService.generateToolsSystemMessage();
      if (toolsSystemMessage) {
        session.messages.push({
          role: 'system',
          content: toolsSystemMessage
        });
        console.log(chalk.gray('🔧 Tools available: ') + chalk.cyan(toolService.getAvailableToolNames().join(', ')));
      }
      
      // Load initial context if specified
      if (options.file || options.context) {
        await loadInitialContext(session, mcpClient, options);
      }
      
      // Start interactive loop
      await startChatLoop(session, provider, mcpClient, config.ui.streaming && !options.noStream);
      
    } catch (error) {
      console.error(chalk.red('❌ Chat session failed:'));
      console.error(chalk.red(`   ${error}`));
      process.exit(1);
    }
  });

async function loadInitialContext(
  session: ChatSession, 
  mcpClient: FilesystemMCPClient, 
  options: any
): Promise<void> {
  try {
    let contextContent = '';
    
    if (options.file) {
      console.log(chalk.yellow(`📄 Loading file: ${options.file}`));
      const result = await mcpClient.callTool('read_file', { path: options.file });
      if (!result.isError && result.content[0]?.text) {
        contextContent += `File: ${options.file}\n\`\`\`\n${result.content[0].text}\n\`\`\`\n\n`;
      }
    }
    
    if (options.context) {
      console.log(chalk.yellow(`🔍 Loading context: ${options.context}`));
      const result = await mcpClient.callTool('search_files', { pattern: options.context });
      if (!result.isError && result.content[0]?.text) {
        const files = JSON.parse(result.content[0].text) as string[];
        for (const file of files.slice(0, 5)) { // Limit to first 5 files
          const fileResult = await mcpClient.callTool('read_file', { path: file });
          if (!fileResult.isError && fileResult.content[0]?.text) {
            contextContent += `File: ${file}\n\`\`\`\n${fileResult.content[0].text}\n\`\`\`\n\n`;
          }
        }
      }
    }
    
    if (contextContent) {
      session.messages.push({
        role: 'system',
        content: `Project context:\n\n${contextContent}`
      });
      console.log(chalk.green('✅ Context loaded'));
    }
  } catch (error) {
    console.warn(chalk.yellow(`⚠️  Failed to load context: ${error}`));
  }
}

async function startChatLoop(
  session: ChatSession,
  provider: OllamaProvider,
  mcpClient: FilesystemMCPClient,
  useStreaming: boolean
): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.blue('💬 You: ')
  });
  
  const prompt = () => {
    rl.prompt();
  };
  
  rl.on('line', async (input) => {
    const trimmed = input.trim();
    
    if (trimmed === 'exit' || trimmed === 'quit') {
      console.log(chalk.gray('👋 Goodbye!'));
      rl.close();
      return;
    }
    
    if (trimmed === 'help') {
      showHelp();
      prompt();
      return;
    }
    
    if (trimmed === 'clear') {
      session.messages = [];
      session.tokenCount = 0;
      console.log(chalk.green('🧹 Session cleared'));
      prompt();
      return;
    }
    
    if (trimmed.startsWith('/')) {
      await handleSlashCommand(trimmed, session, mcpClient);
      prompt();
      return;
    }
    
    if (!trimmed) {
      prompt();
      return;
    }
    
    // Add user message
    session.messages.push({
      role: 'user',
      content: trimmed
    });
    
    try {
      console.log(chalk.green('🤖 Aiya: '), { newline: false });
      
      let assistantMessage: Message;
      
      if (useStreaming) {
        let response = '';
        for await (const chunk of provider.stream(session.messages)) {
          process.stdout.write(chunk.content);
          response += chunk.content;
          if (chunk.done) {
            session.tokenCount += chunk.tokensUsed || 0;
            break;
          }
        }
        console.log(); // New line after streaming
        
        assistantMessage = {
          role: 'assistant',
          content: response
        };
      } else {
        const response = await provider.chat(session.messages);
        console.log(response.content);
        
        assistantMessage = {
          role: 'assistant',
          content: response.content
        };
        
        session.tokenCount += response.tokensUsed || 0;
      }
      
      // Process message for tool calls
      if (session.toolExecutor) {
        const { updatedMessage, toolResults, hasToolCalls } = await session.toolExecutor.processMessage(assistantMessage);
        
        // Add the assistant message (with tool calls if any)
        session.messages.push(updatedMessage);
        
        if (hasToolCalls) {
          // Add tool result messages
          session.messages.push(...toolResults);
          
          // Get follow-up response from the model
          console.log(chalk.yellow('🔄 Processing tool results...'));
          
          try {
            const followUpResponse = await provider.chat(session.messages);
            console.log(chalk.green('🤖 Aiya: ') + followUpResponse.content);
            
            session.messages.push({
              role: 'assistant',
              content: followUpResponse.content
            });
            
            session.tokenCount += followUpResponse.tokensUsed || 0;
          } catch (error) {
            console.log(chalk.red(`❌ Error processing tool results: ${error}`));
          }
        }
      } else {
        session.messages.push(assistantMessage);
      }
      
      // Show token count
      console.log(chalk.gray(`[Tokens: ${session.tokenCount}]`));
      
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error}`));
    }
    
    prompt();
  });
  
  rl.on('close', () => {
    process.exit(0);
  });
  
  prompt();
}

async function handleSlashCommand(
  command: string,
  session: ChatSession,
  mcpClient: FilesystemMCPClient
): Promise<void> {
  const parts = command.slice(1).split(' ');
  const cmd = parts[0];
  const args = parts.slice(1);
  
  try {
    switch (cmd) {
      case 'read':
        if (args.length === 0) {
          console.log(chalk.red('Usage: /read <file_path>'));
          return;
        }
        const readResult = await mcpClient.callTool('read_file', { path: args[0] });
        if (readResult.isError) {
          console.log(chalk.red(`Error: ${readResult.content[0]?.text}`));
        } else {
          console.log(chalk.gray(`File: ${args[0]}`));
          console.log(readResult.content[0]?.text);
        }
        break;
        
      case 'search':
        if (args.length === 0) {
          console.log(chalk.red('Usage: /search <pattern>'));
          return;
        }
        const searchResult = await mcpClient.callTool('search_files', { pattern: args[0] });
        if (searchResult.isError) {
          console.log(chalk.red(`Error: ${searchResult.content[0]?.text}`));
        } else {
          const files = JSON.parse(searchResult.content[0]?.text || '[]');
          console.log(chalk.gray(`Found ${files.length} files:`));
          files.forEach((file: string) => console.log(chalk.gray(`  ${file}`)));
        }
        break;
        
      case 'tokens':
        console.log(chalk.gray(`Session tokens: ${session.tokenCount}`));
        console.log(chalk.gray(`Messages: ${session.messages.length}`));
        break;
        
      default:
        console.log(chalk.red(`Unknown command: /${cmd}`));
        console.log(chalk.gray('Available commands: /read, /search, /tokens'));
    }
  } catch (error) {
    console.log(chalk.red(`Command error: ${error}`));
  }
}

function showHelp(): void {
  console.log(chalk.blue('📖 Aiya Chat Commands:'));
  console.log(chalk.gray('  exit, quit     - Exit chat session'));
  console.log(chalk.gray('  clear          - Clear conversation history'));
  console.log(chalk.gray('  help           - Show this help'));
  console.log(chalk.gray('  /read <file>   - Read and display file'));
  console.log(chalk.gray('  /search <pat>  - Search for files'));
  console.log(chalk.gray('  /tokens        - Show token usage'));
  console.log();
}