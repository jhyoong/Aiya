import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { ConfigManager } from '../../core/config/manager.js';
import { OllamaProvider } from '../../core/providers/ollama.js';
import { WorkspaceSecurity } from '../../core/security/workspace.js';
import { EnhancedFilesystemMCPClient } from '../../core/mcp/enhanced-filesystem.js';
import { Message } from '../../core/providers/base.js';
import { MCPToolService } from '../../core/tools/mcp-tools.js';
import { ToolExecutor } from '../../core/tools/executor.js';
import { ChatInterface } from '../../ui/components/ChatInterface.js';
import { ThinkingParser } from '../../utils/thinking-parser.js';

interface ChatSession {
  messages: Message[];
  tokenCount: number;
  toolService?: MCPToolService;
  toolExecutor?: ToolExecutor;
  addedFiles: string[];
  thinkingMode: 'on' | 'brief' | 'off';
}

export const chatInkCommand = new Command('chat')
  .description('Start an interactive chat session')
  .action(async () => {
    try {
      const configManager = new ConfigManager();
      const config = await configManager.load();
      
      const provider = new OllamaProvider(config.provider.model, config.provider.baseUrl);
      const security = new WorkspaceSecurity(
        process.cwd(),
        config.security.allowedExtensions,
        config.security.maxFileSize
      );
      const mcpClient = new EnhancedFilesystemMCPClient(security);
      await mcpClient.connect();
      
      // Verify connection
      if (!(await provider.isHealthy())) {
        throw new Error('Cannot connect to Ollama server');
      }
      
      // Initialize MCP tool service
      const toolService = new MCPToolService([mcpClient]);
      await toolService.initialize();
      
      const toolExecutor = new ToolExecutor(toolService, process.env.AIYA_VERBOSE === 'true');
      
      const session: ChatSession = {
        messages: [],
        tokenCount: 0,
        toolService,
        toolExecutor,
        addedFiles: [],
        thinkingMode: config.ui.thinking
      };
      
      // Add system message with tool definitions
      const toolsSystemMessage = toolService.generateToolsSystemMessage();
      if (toolsSystemMessage) {
        session.messages.push({
          role: 'system',
          content: toolsSystemMessage
        });
      }
      
      // Render the Ink-based chat interface
      const { unmount } = render(
        React.createElement(ChatInterface, {
          onMessage: (message: string) => handleMessage(message, session, provider, mcpClient, config.ui.streaming),
          onMessageStream: config.ui.streaming ? 
            (message: string) => handleMessageStream(message, session, provider, mcpClient) : 
            undefined,
          onExit: () => {
            unmount();
            process.exit(0);
          },
          provider: 'Ollama',
          model: config.provider.model,
        })
      );
      
    } catch (error) {
      console.error('❌ Chat session failed:', error);
      process.exit(1);
    }
  });

async function* handleMessageStream(
  input: string,
  session: ChatSession,
  provider: OllamaProvider,
  mcpClient: EnhancedFilesystemMCPClient
): AsyncGenerator<{ content: string; thinking?: string; done: boolean }, void, unknown> {
  const trimmed = input.trim();
  
  if (trimmed === 'exit' || trimmed === 'quit') {
    process.exit(0);
  }
  
  if (trimmed === 'help') {
    yield { content: getHelpText(), done: true };
    return;
  }
  
  if (trimmed === 'clear') {
    session.messages = [];
    session.tokenCount = 0;
    session.addedFiles = [];
    yield { content: '🧹 Session cleared', done: true };
    return;
  }
  
  if (trimmed.startsWith('/')) {
    const result = await handleSlashCommand(trimmed, session, mcpClient);
    yield { content: result, done: true };
    return;
  }
  
  if (!trimmed) {
    yield { content: '', done: true };
    return;
  }
  
  // Prepare user message content
  let userContent = trimmed;
  
  // Add file contents if any files were added
  if (session.addedFiles.length > 0) {
    const fileContents = session.addedFiles.join('\n\n');
    userContent = `${fileContents}\n\n${trimmed}`;
    session.addedFiles = [];
  }
  
  // Add user message
  session.messages.push({
    role: 'user',
    content: userContent
  });
  
  try {
    const tokensBeforePrompt = session.tokenCount;
    
    let response = '';
    const thinkingParser = new ThinkingParser(session.thinkingMode, true); // Enable incremental mode
    
    for await (const chunk of provider.stream(session.messages)) {
      const results = thinkingParser.processChunk(chunk.content);
      
      for (const result of results) {
        if (result.isThinking) {
          // Yield raw thinking content
          yield { content: '', thinking: result.content, done: false };
        } else {
          // Yield regular content
          yield { content: result.content, done: false };
          response += result.content;
        }
      }
      
      if (chunk.done) {
        session.tokenCount += chunk.tokensUsed || 0;
        break;
      }
    }
    
    const assistantMessage = {
      role: 'assistant' as const,
      content: response
    };
    
    // Process tool calls if available
    if (session.toolExecutor) {
      const { updatedMessage, toolResults, hasToolCalls } = await session.toolExecutor.processMessage(assistantMessage);
      session.messages.push(updatedMessage);
      
      if (hasToolCalls) {
        session.messages.push(...toolResults);
        const followUpResponse = await provider.chat(session.messages);
        session.messages.push({
          role: 'assistant',
          content: followUpResponse.content
        });
        session.tokenCount += followUpResponse.tokensUsed || 0;
        
        yield { content: `\n\n${followUpResponse.content}`, done: false };
      }
    } else {
      session.messages.push(assistantMessage);
    }
    
    const promptTokens = session.tokenCount - tokensBeforePrompt;
    yield { content: `\n\n[Tokens: ${promptTokens} (${session.tokenCount})]`, done: true };
    
  } catch (error) {
    throw new Error(`Chat error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function handleMessage(
  input: string,
  session: ChatSession,
  provider: OllamaProvider,
  mcpClient: EnhancedFilesystemMCPClient,
  useStreaming: boolean
): Promise<string> {
  const trimmed = input.trim();
  
  if (trimmed === 'exit' || trimmed === 'quit') {
    process.exit(0);
  }
  
  if (trimmed === 'help') {
    return getHelpText();
  }
  
  if (trimmed === 'clear') {
    session.messages = [];
    session.tokenCount = 0;
    session.addedFiles = [];
    return '🧹 Session cleared';
  }
  
  if (trimmed.startsWith('/')) {
    return await handleSlashCommand(trimmed, session, mcpClient);
  }
  
  if (!trimmed) {
    return '';
  }
  
  // Prepare user message content
  let userContent = trimmed;
  
  // Add file contents if any files were added
  if (session.addedFiles.length > 0) {
    const fileContents = session.addedFiles.join('\n\n');
    userContent = `${fileContents}\n\n${trimmed}`;
    session.addedFiles = [];
  }
  
  // Add user message
  session.messages.push({
    role: 'user',
    content: userContent
  });
  
  try {
    const tokensBeforePrompt = session.tokenCount;
    
    let assistantMessage: Message;
    
    if (useStreaming) {
      let response = '';
      const thinkingParser = new ThinkingParser(session.thinkingMode);
      
      for await (const chunk of provider.stream(session.messages)) {
        const results = thinkingParser.processChunk(chunk.content);
        
        for (const result of results) {
          if (!result.isThinking) {
            response += result.content;
          }
        }
        
        if (chunk.done) {
          session.tokenCount += chunk.tokensUsed || 0;
          break;
        }
      }
      
      assistantMessage = {
        role: 'assistant',
        content: response
      };
    } else {
      const response = await provider.chat(session.messages);
      assistantMessage = {
        role: 'assistant',
        content: response.content
      };
      session.tokenCount += response.tokensUsed || 0;
    }
    
    // Process tool calls if available
    if (session.toolExecutor) {
      const { updatedMessage, toolResults, hasToolCalls } = await session.toolExecutor.processMessage(assistantMessage);
      session.messages.push(updatedMessage);
      
      if (hasToolCalls) {
        session.messages.push(...toolResults);
        const followUpResponse = await provider.chat(session.messages);
        session.messages.push({
          role: 'assistant',
          content: followUpResponse.content
        });
        session.tokenCount += followUpResponse.tokensUsed || 0;
        
        return `${updatedMessage.content}\n\n${followUpResponse.content}`;
      }
    } else {
      session.messages.push(assistantMessage);
    }
    
    const promptTokens = session.tokenCount - tokensBeforePrompt;
    return `${assistantMessage.content}\n\n[Tokens: ${promptTokens} (${session.tokenCount})]`;
    
  } catch (error) {
    throw new Error(`Chat error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function handleSlashCommand(
  command: string,
  session: ChatSession,
  mcpClient: EnhancedFilesystemMCPClient
): Promise<string> {
  const parts = command.slice(1).split(' ');
  const cmd = parts[0];
  const args = parts.slice(1);
  
  try {
    switch (cmd) {
      case 'read':
        if (args.length === 0) {
          return 'Usage: /read <file_path>';
        }
        const readResult = await mcpClient.callTool('read_file', { path: args[0] });
        if (readResult.isError) {
          return `Error: ${readResult.content[0]?.text}`;
        } else {
          return `File: ${args[0]}\n${readResult.content[0]?.text}`;
        }
        
      case 'add':
        if (args.length === 0) {
          return 'Usage: /add <file_path>';
        }
        const addResult = await mcpClient.callTool('read_file', { path: args[0] });
        if (addResult.isError) {
          return `Error: ${addResult.content[0]?.text}`;
        } else {
          const fileContent = addResult.content[0]?.text || '';
          const formattedContent = `File: ${args[0]}\n\`\`\`\n${fileContent}\n\`\`\``;
          session.addedFiles.push(formattedContent);
          return `Added ${args[0]} to context for the next prompt`;
        }
        
      case 'search':
        if (args.length === 0) {
          return 'Usage: /search <pattern>';
        }
        const searchResult = await mcpClient.callTool('search_files', { pattern: args[0] });
        if (searchResult.isError) {
          return `Error: ${searchResult.content[0]?.text}`;
        } else {
          const files = JSON.parse(searchResult.content[0]?.text || '[]');
          return `Found ${files.length} files:\n${files.map((f: string) => `  ${f}`).join('\n')}`;
        }
        
      case 'tokens':
        return `Session tokens: ${session.tokenCount}\nMessages: ${session.messages.length}`;
        
      case 'thinking':
        if (args.length === 0) {
          return `Current thinking mode: ${session.thinkingMode}\nAvailable modes: on, brief, off`;
        }
        
        const mode = args[0]?.toLowerCase();
        if (mode === 'on' || mode === 'brief' || mode === 'off') {
          session.thinkingMode = mode as 'on' | 'brief' | 'off';
          return `Thinking mode set to: ${mode}`;
        } else {
          return `Invalid thinking mode: ${mode || 'undefined'}\nAvailable modes: on, brief, off`;
        }
        
      default:
        return `Unknown command: /${cmd}\nAvailable commands: /read, /add, /search, /tokens, /thinking`;
    }
  } catch (error) {
    return `Command error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

function getHelpText(): string {
  return `Aiya Chat Commands:
  exit, quit     - Exit chat session
  clear          - Clear conversation history
  help           - Show this help
  /read <file>   - Read and display file
  /add <file>    - Add file content to context for next prompt
  /search <pat>  - Search for files
  /tokens        - Show token usage
  /thinking [mode] - Set thinking display mode (on/brief/off)`;
}