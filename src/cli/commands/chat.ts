import { Command } from 'commander';
import React from 'react';
import { render, useStdin } from 'ink';
import { ConfigManager } from '../../core/config/manager.js';
import { ProviderFactory } from '../../core/providers/factory.js';
import { LLMProvider } from '../../core/providers/base.js';
import { WorkspaceSecurity } from '../../core/security/workspace.js';
import { EnhancedFilesystemMCPClient } from '../../core/mcp/enhanced-filesystem.js';
import { Message } from '../../core/providers/base.js';
import { MCPToolService } from '../../core/tools/mcp-tools.js';
import { ToolExecutor } from '../../core/tools/executor.js';
import { ChatInterface } from '../../ui/components/ChatInterface.js';
import { ThinkingParser } from '../../utils/thinking-parser.js';
import { useTextBuffer } from '../../ui/core/TextBuffer.js';
import { useTerminalSize } from '../../ui/hooks/useTerminalSize.js';
import { TokenCounter } from '../../core/tokens/counter.js';
import * as fs from 'fs';

interface ChatSession {
  messages: Message[];
  tokenCounter: TokenCounter;
  toolService?: MCPToolService;
  toolExecutor?: ToolExecutor;
  addedFiles: string[];
  thinkingMode: 'on' | 'brief' | 'off';
}

interface ChatWrapperProps {
  onMessage: (message: string) => Promise<string>;
  onMessageStream?: ((message: string) => AsyncGenerator<{ content: string; thinking?: string; done: boolean }, void, unknown>) | undefined;
  onExit: () => void;
  provider: string;
  model: string;
  contextLength: number;
  tokenCounter: TokenCounter;
}

const ChatWrapper: React.FC<ChatWrapperProps> = (props) => {
  const { stdin, setRawMode } = useStdin();
  const { columns: terminalWidth } = useTerminalSize();
  
  // Use state to track token usage and update it reactively
  const [tokenUsage, setTokenUsage] = React.useState(() => {
    const usage = props.tokenCounter.getUsage();
    const lastMessage = props.tokenCounter.getLastMessageUsage();
    return {
      sent: lastMessage?.sent || 0,
      sentTotal: usage.input,
      received: lastMessage?.received || 0,
      receivedTotal: usage.output,
    };
  });
  
  // Update token usage when counter changes
  React.useEffect(() => {
    const updateTokenUsage = () => {
      const usage = props.tokenCounter.getUsage();
      const lastMessage = props.tokenCounter.getLastMessageUsage();
      setTokenUsage({
        sent: lastMessage?.sent || 0,
        sentTotal: usage.input,
        received: lastMessage?.received || 0,
        receivedTotal: usage.output,
      });
    };
    
    // Update every second to keep it reactive
    const interval = setInterval(updateTokenUsage, 1000);
    return () => clearInterval(interval);
  }, [props.tokenCounter]);
  
  const isValidPath = React.useCallback((filePath: string): boolean => {
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch (_e) {
      return false;
    }
  }, []);

  const widthFraction = 0.9;
  const inputWidth = Math.max(
    20,
    Math.floor(terminalWidth * widthFraction) - 3,
  );

  const buffer = useTextBuffer({
    initialText: '',
    viewport: { height: 10, width: inputWidth },
    stdin,
    setRawMode,
    isValidPath,
    shellModeActive: false,
  });

  return React.createElement(ChatInterface, {
    ...props,
    buffer,
    inputWidth,
    tokenUsage,
  });
};

export const chatCommand = new Command('chat')
  .description('Start an interactive chat session')
  .action(async () => {
    try {
      console.log('🚀 Starting chat session...');
      const configManager = new ConfigManager();
      const config = await configManager.load();
      console.log('✅ Configuration loaded successfully');
      
      const provider = ProviderFactory.create(config.provider);
      console.log('✅ Provider created successfully');
      
      const security = new WorkspaceSecurity(
        process.cwd(),
        config.security.allowedExtensions,
        config.security.maxFileSize
      );
      const mcpClient = new EnhancedFilesystemMCPClient(security);
      await mcpClient.connect();
      console.log('✅ MCP client connected successfully');
      
      // Verify connection
      console.log('🔍 Verifying provider health...');
      if (!(await provider.isHealthy())) {
        throw new Error('Cannot connect to provider server');
      }
      console.log('✅ Provider health check passed');
      
      // Initialize MCP tool service
      const toolService = new MCPToolService([mcpClient]);
      await toolService.initialize();
      console.log('✅ MCP tool service initialized');
      
      const toolExecutor = new ToolExecutor(toolService, process.env.AIYA_VERBOSE === 'true');
      console.log('✅ Tool executor created');
      
      // Get model information for context length
      const modelInfo = await provider.getModelInfo();
      console.log('✅ Model information retrieved');
      
      const session: ChatSession = {
        messages: [],
        tokenCounter: new TokenCounter(provider, config.provider.type, config.provider.model, modelInfo.contextLength),
        toolService,
        toolExecutor,
        addedFiles: [],
        thinkingMode: config.ui.thinking
      };
      console.log('✅ Chat session initialized');
      
      // Add system message with tool definitions
      const toolsSystemMessage = toolService.generateToolsSystemMessage();
      if (toolsSystemMessage) {
        session.messages.push({
          role: 'system',
          content: toolsSystemMessage
        });
      }
      
      // Render the Ink-based chat interface
      console.log('🎨 Starting chat interface...');
      const { unmount } = render(
        React.createElement(ChatWrapper, {
          onMessage: (message: string) => handleMessage(message, session, provider, mcpClient, config.ui.streaming),
          onMessageStream: config.ui.streaming ? 
            (message: string) => handleMessageStream(message, session, provider, mcpClient) : 
            undefined,
          onExit: () => {
            session.tokenCounter.endSession();
            unmount();
            // Don't call process.exit(0) immediately - let the process naturally exit
          },
          provider: config.provider.type,
          model: config.provider.model,
          contextLength: modelInfo.contextLength,
          tokenCounter: session.tokenCounter,
        })
      );
      
    } catch (error) {
      console.error('❌ Chat session failed:', error);
      throw error; // Let the parent handle the error instead of force-exit
    }
  });

async function* handleMessageStream(
  input: string,
  session: ChatSession,
  provider: LLMProvider,
  mcpClient: EnhancedFilesystemMCPClient
): AsyncGenerator<{ content: string; thinking?: string; done: boolean }, void, unknown> {
  const trimmed = input.trim();
  
  if (trimmed === 'exit' || trimmed === 'quit') {
    yield { content: 'Goodbye!', done: true };
    // Don't force exit - let the parent component handle it
    return;
  }
  
  if (trimmed === 'help') {
    yield { content: getHelpText(), done: true };
    return;
  }
  
  if (trimmed === 'clear') {
    session.messages = [];
    session.tokenCounter.resetSession();
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
    let response = '';
    const thinkingParser = new ThinkingParser(session.thinkingMode, true); // Enable incremental mode
    let streamResponse: any = null;
    
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
        streamResponse = chunk;
        break;
      }
    }
    
    const assistantMessage = {
      role: 'assistant' as const,
      content: response
    };
    
    // Process tool calls if available
    if (session.toolExecutor) {
      let currentMessage = assistantMessage;
      let iterationCount = 0;
      const maxIterations = 10; // Prevent infinite loops
      
      // Keep processing tool calls until no more are found
      while (iterationCount < maxIterations) {
        const { updatedMessage, toolResults, hasToolCalls } = await session.toolExecutor.processMessage(currentMessage);
        
        // Add the assistant message (with tool calls if any)
        session.messages.push(updatedMessage);
        
        if (!hasToolCalls) {
          // No tool calls found, we're done
          break;
        }
        
        // Add tool result messages
        session.messages.push(...toolResults);
        
        // Get follow-up response from the model using streaming
        let followUpResponse = '';
        const followUpParser = new ThinkingParser(session.thinkingMode, true);
        
        for await (const chunk of provider.stream(session.messages)) {
          const results = followUpParser.processChunk(chunk.content);
          
          for (const result of results) {
            if (result.isThinking) {
              // Yield thinking content
              yield { content: '', thinking: result.content, done: false };
            } else {
              // Yield regular content
              yield { content: result.content, done: false };
              followUpResponse += result.content;
            }
          }
          
          if (chunk.done) {
            break;
          }
        }
        
        // Check if this follow-up response contains more tool calls
        const hasMoreToolCalls = session.toolExecutor.messageNeedsToolExecution({
          role: 'assistant',
          content: followUpResponse
        });
        
        currentMessage = {
          role: 'assistant',
          content: followUpResponse
        };
        
        iterationCount++;
        
        // If this response doesn't have tool calls, we'll exit the loop
        if (!hasMoreToolCalls) {
          session.messages.push(currentMessage);
          break;
        }
      }
      
      if (iterationCount >= maxIterations) {
        yield { content: '\n\n⚠️  Maximum tool execution iterations reached', done: false };
      }
      
    } else {
      session.messages.push(assistantMessage);
    }
    
    // Track token usage for the main response
    if (streamResponse) {
      const tokenUsage = session.tokenCounter.extractTokenUsage(streamResponse, userContent);
      session.tokenCounter.trackTokenUsage(tokenUsage.input, tokenUsage.output, tokenUsage.estimated);
    }
    
    yield { content: `\n\n${session.tokenCounter.formatTokenDisplay()}`, done: true };
    
  } catch (error) {
    throw new Error(`Chat error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function handleMessage(
  input: string,
  session: ChatSession,
  provider: LLMProvider,
  mcpClient: EnhancedFilesystemMCPClient,
  useStreaming: boolean
): Promise<string> {
  const trimmed = input.trim();
  
  if (trimmed === 'exit' || trimmed === 'quit') {
    return 'Goodbye!';
  }
  
  if (trimmed === 'help') {
    return getHelpText();
  }
  
  if (trimmed === 'clear') {
    session.messages = [];
    session.tokenCounter.resetSession();
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
    let assistantMessage: Message;
    let providerResponse: any = null;
    
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
          providerResponse = chunk;
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
      providerResponse = response;
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
        
        // Track token usage for follow-up response
        if (followUpResponse) {
          const tokenUsage = session.tokenCounter.extractTokenUsage(followUpResponse, userContent);
          session.tokenCounter.trackTokenUsage(tokenUsage.input, tokenUsage.output, tokenUsage.estimated);
        }
        
        return `${updatedMessage.content}\n\n${followUpResponse.content}`;
      }
    } else {
      session.messages.push(assistantMessage);
    }
    
    // Track token usage for the main response
    if (providerResponse) {
      const tokenUsage = session.tokenCounter.extractTokenUsage(providerResponse, userContent);
      session.tokenCounter.trackTokenUsage(tokenUsage.input, tokenUsage.output, tokenUsage.estimated);
    }
    
    return `${assistantMessage.content}\n\n${session.tokenCounter.formatTokenDisplay()}`;
    
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
        const usage = session.tokenCounter.getUsage();
        const stats = session.tokenCounter.getSessionStats();
        return `Session ID: ${session.tokenCounter.getSessionId()}\nTotal tokens: ${usage.total} (sent: ${usage.input}, received: ${usage.output})\nMessages: ${session.messages.length}\nAverage tokens per message: ${stats.averageTokensPerMessage}`;
        
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