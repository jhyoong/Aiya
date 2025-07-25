import { Command } from 'commander';
import React from 'react';
import { render, useStdin } from 'ink';
import { ConfigManager } from '../../core/config/manager.js';
import { ProviderFactory } from '../../core/providers/factory.js';
import { WorkspaceSecurity } from '../../core/security/workspace.js';
import { FilesystemMCPClient } from '../../core/mcp/filesystem.js';
import { ShellMCPClient } from '../../core/mcp/shell.js';
import { TodoMCPAdapter } from '../../core/mcp/todo-adapter.js';
import {
  requiresApproval,
  extractCommandName,
} from '../../core/mcp/shell-constants.js';
import { DELAYS } from '../../core/config/timing-constants.js';
import { PROCESSING } from '../../core/config/limits-constants.js';
import { Message, ToolCall } from '../../core/providers/base.js';
import { ProviderResponse } from '../../types/ProviderTypes.js';
import { MCPToolService } from '../../core/tools/mcp-tools.js';
import { ToolExecutor } from '../../core/tools/executor.js';
import { ToolMemoryService } from '../../core/tools/memory.js';
import { ToolLogger } from '../../core/tools/logger.js';
import { ShellLogger } from '../../core/tools/shell-logger.js';
import { ChatInterface } from '../../ui/components/ChatInterface.js';
import { StartupLoader } from '../../ui/components/StartupLoader.js';
import { ThinkingParser } from '../../utils/thinking-parser.js';
import { useTextBuffer } from '../../ui/core/TextBuffer.js';
import { useTerminalSize } from '../../ui/hooks/useTerminalSize.js';
import { TokenCounter } from '../../core/tokens/counter.js';
import { initializeCommandSystem } from '../commands/index.js';
import {
  CommandExecutor,
  CommandContext,
  ChatSession,
} from '../CommandExecutor.js';
import * as fs from 'fs';

interface ChatWrapperProps {
  onMessage: (message: string) => Promise<string>;
  onMessageStream?:
    | ((
        message: string
      ) => AsyncGenerator<
        { content: string; thinking?: string; done: boolean },
        void,
        unknown
      >)
    | undefined;
  onExit: () => void;
  provider: string;
  model: string;
  contextLength: number;
  tokenCounter: TokenCounter;
  initialProviderName: string;
  configManager: ConfigManager;
  session: ChatSession;
  toolConfirmationRef: {
    current: ((toolCalls: ToolCall[]) => Promise<boolean>) | null;
  };
}

const ChatWrapper: React.FC<ChatWrapperProps> = props => {
  const { stdin, setRawMode } = useStdin();
  const { columns: terminalWidth } = useTerminalSize();

  // Use the tool confirmation ref from props
  const { toolConfirmationRef } = props;

  // Use state to track current provider information
  const [currentProvider, setCurrentProvider] = React.useState(() => {
    const providerConfig = props.configManager.getProviderConfig(
      props.initialProviderName
    );
    return {
      name: props.initialProviderName,
      type: providerConfig?.type || props.provider,
      model: providerConfig?.model || props.model,
    };
  });

  // Use state to track context length dynamically
  const [contextLength, setContextLength] = React.useState(() => {
    return props.session.tokenCounter.getContextLength();
  });

  // Use state to track token usage and update it reactively
  const [tokenUsage, setTokenUsage] = React.useState(() => {
    const usage = props.session.tokenCounter.getUsage();
    const lastMessage = props.session.tokenCounter.getLastMessageUsage();
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
      const usage = props.session.tokenCounter.getUsage();
      const lastMessage = props.session.tokenCounter.getLastMessageUsage();
      setTokenUsage({
        sent: lastMessage?.sent || 0,
        sentTotal: usage.input,
        received: lastMessage?.received || 0,
        receivedTotal: usage.output,
      });
    };

    // Update immediately when counter changes
    updateTokenUsage();

    // Also update context length
    setContextLength(props.session.tokenCounter.getContextLength());

    // Listen for token update events
    const handleTokenUpdate = () => {
      updateTokenUsage();
    };

    props.session.tokenCounter.on('tokenUpdate', handleTokenUpdate);

    // Cleanup event listener
    return () => {
      props.session.tokenCounter.off('tokenUpdate', handleTokenUpdate);
    };
  }, [props.session.tokenCounter]);

  // Handle provider changes from ChatInterface
  const handleProviderChange = React.useCallback(
    (newProvider: { name: string; type: string; model: string }) => {
      setCurrentProvider(newProvider);

      // The token counter state will be updated automatically by the useEffect that watches props.session.tokenCounter
      // This ensures the UI immediately reflects the new session state
    },
    []
  );

  const isValidPath = React.useCallback((filePath: string): boolean => {
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch {
      return false;
    }
  }, []);

  const widthFraction = 0.9;
  const inputWidth = Math.max(
    20,
    Math.floor(terminalWidth * widthFraction) - 3
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
    currentProvider,
    onProviderChange: handleProviderChange,
    provider: currentProvider.type,
    model: currentProvider.model,
    contextLength: contextLength,
    onToolConfirmationRequest: toolConfirmationRef,
  });
};

export const chatCommand = new Command('chat')
  .description('Start an interactive chat session')
  .action(async () => {
    // Create startup state management
    let updateStep: ((step: string) => void) | null = null;
    let completeLoading: (() => void) | null = null;

    // Create the startup component with state management
    const StartupManager = () => {
      const [currentStep, setCurrentStep] = React.useState(
        'Starting chat session...'
      );
      const [isLoading, setIsLoading] = React.useState(true);

      React.useEffect(() => {
        updateStep = setCurrentStep;
        completeLoading = () => setIsLoading(false);
      }, []);

      if (!isLoading) {
        return null;
      }

      // Check if this is a completion message (starts with "Chat started")
      const isComplete = currentStep.startsWith('Chat started');

      return React.createElement(StartupLoader, {
        currentStep,
        isVisible: true,
        isComplete,
      });
    };

    // Start the UI render
    const { unmount } = render(React.createElement(StartupManager));

    // Helper functions
    const showLoader = (step: string) => {
      if (updateStep) updateStep(step);
    };

    const hideLoader = () => {
      if (completeLoading) completeLoading();
    };

    try {
      // Small delay to ensure the component is mounted
      await new Promise(resolve => setTimeout(resolve, DELAYS.UI_SHORT));

      // Initialize command system for slash commands
      initializeCommandSystem();

      // Check if configuration exists
      const configExists = await checkConfiguration();
      if (!configExists) {
        hideLoader();
        unmount();
        return; // Exit gracefully - user was prompted to run init
      }

      const configManager = new ConfigManager();
      const config = await configManager.load();
      showLoader('Configuration loaded successfully');

      const currentProvider = configManager.getCurrentProvider();
      showLoader(
        `Setting up ${currentProvider.type} - ${currentProvider.model}`
      );

      const provider = ProviderFactory.create(currentProvider);
      showLoader('Provider created successfully');

      // Create tool memory service for session
      const toolMemoryService = new ToolMemoryService();

      // Clear any old generic 'RunCommand' and 'shell_RunCommand' preferences to prevent conflicts with new shell-specific approval
      toolMemoryService.clearPreference('RunCommand');
      toolMemoryService.clearPreference('shell_RunCommand');

      // Create shell logger for session
      const shellLogger = new ShellLogger();

      // Create tool logger for session (use same session ID as shell logger)
      const toolLogger = new ToolLogger(shellLogger.getSessionId());

      const security = new WorkspaceSecurity(
        process.cwd(),
        config.security.allowedExtensions,
        config.security.maxFileSize
      );
      const mcpClient = new FilesystemMCPClient(security);
      await mcpClient.connect();
      showLoader('MCP client connected successfully');

      const shellClient = new ShellMCPClient(toolMemoryService, shellLogger);
      await shellClient.connect();
      showLoader('Shell MCP client connected successfully');

      const todoClient = new TodoMCPAdapter();
      await todoClient.connect();
      showLoader('Todo MCP client connected successfully');

      // Verify connection
      showLoader('Verifying provider health...');
      if (!(await provider.isHealthy())) {
        hideLoader();
        throw new Error('Cannot connect to provider server');
      }
      showLoader('Provider health check passed');

      // Initialize MCP tool service
      const toolService = new MCPToolService([
        mcpClient,
        shellClient,
        todoClient,
      ]);
      await toolService.initialize();
      showLoader('MCP tool service initialized');

      // Create tool confirmation callback that will be set by ChatInterface
      const toolConfirmationRef = {
        current: null as
          | ((
              toolCalls: ToolCall[],
              storePreference?: (
                toolName: string,
                choice: 'allow' | 'allow-always' | 'reject'
              ) => void
            ) => Promise<boolean>)
          | null,
      };

      const toolExecutor = new ToolExecutor(
        toolService,
        process.env.AIYA_VERBOSE === 'true',
        config.tools?.requireConfirmation !== false
          ? async (toolCalls: ToolCall[]) => {
              // Handle shell commands specially - these bypass the normal confirmation flow
              const shellCalls = toolCalls.filter(
                call => call.name === 'shell_RunCommand'
              );
              const nonShellCalls = toolCalls.filter(
                call => call.name !== 'shell_RunCommand'
              );

              // Process shell commands with command-specific approval FIRST
              for (const shellCall of shellCalls) {
                const command = shellCall.arguments.command;
                if (!command || typeof command !== 'string') continue;

                // Check if command requires approval
                if (requiresApproval(command)) {
                  const commandType = extractCommandName(command);
                  const memoryKey = `shell:${commandType}`;

                  // Check stored preference first
                  const storedPreference =
                    toolMemoryService.getPreference(memoryKey);

                  if (storedPreference === 'reject') {
                    shellLogger.logApprovalResult(
                      command,
                      commandType,
                      false,
                      'rejected'
                    );
                    return false;
                  }

                  if (storedPreference !== 'allow') {
                    // Log approval request
                    shellLogger.logApprovalRequest(command, commandType);

                    // Use existing tool confirmation system but with shell-specific logic
                    if (toolConfirmationRef.current) {
                      // Create a fake tool call that represents this shell command for the existing system
                      const shellToolCall: ToolCall = {
                        id: `shell-${Date.now()}`,
                        name: `shell:${commandType}`, // Use shell:rm, shell:curl etc as the "tool name"
                        arguments: { command, commandType },
                      };

                      const storeShellPreference = (
                        _toolName: string,
                        choice: 'allow' | 'allow-always' | 'reject'
                      ) => {
                        if (choice === 'allow-always') {
                          toolMemoryService.setPreference(memoryKey, 'allow');
                          shellLogger.logApprovalResult(
                            command,
                            commandType,
                            true,
                            'allow-always'
                          );
                        } else if (choice === 'reject') {
                          toolMemoryService.setPreference(memoryKey, 'reject');
                          shellLogger.logApprovalResult(
                            command,
                            commandType,
                            false,
                            'reject'
                          );
                        } else {
                          shellLogger.logApprovalResult(
                            command,
                            commandType,
                            true,
                            'allow-once'
                          );
                        }
                      };

                      const approved = await toolConfirmationRef.current(
                        [shellToolCall],
                        storeShellPreference
                      );
                      if (!approved) return false;
                    } else {
                      // Fallback if no callback available - deny by default
                      shellLogger.logApprovalResult(
                        command,
                        commandType,
                        false,
                        'no-callback'
                      );
                      return false;
                    }
                  }
                }
              }

              // Process non-shell tool calls normally (only if ChatInterface has set up callback)
              if (nonShellCalls.length > 0 && toolConfirmationRef.current) {
                const storePreference = (
                  toolName: string,
                  choice: 'allow' | 'allow-always' | 'reject'
                ) => {
                  if (choice === 'allow-always') {
                    toolExecutor.storeToolPreference(toolName, 'allow');
                  } else if (choice === 'reject') {
                    toolExecutor.storeToolPreference(toolName, 'reject');
                  }
                };
                const approved = await toolConfirmationRef.current(
                  nonShellCalls,
                  storePreference
                );
                if (!approved) return false;
              }

              return true;
            }
          : undefined,
        toolMemoryService,
        toolLogger
      );
      showLoader('Tool executor created');

      // Get model information for context length
      const modelInfo = await provider.getModelInfo();
      showLoader('Model information retrieved');

      const currentProviderConfig = configManager.getCurrentProvider();
      const currentProviderName = config.current_provider || 'default';

      const session: ChatSession = {
        messages: [],
        tokenCounter: new TokenCounter(
          provider,
          currentProviderConfig.type,
          currentProviderConfig.model,
          modelInfo.contextLength
        ),
        toolService,
        toolExecutor,
        addedFiles: [],
        thinkingMode: config.ui.thinking,
        configManager,
        provider,
        currentProviderName,
      };
      showLoader('Chat session initialized');

      // Add system message with tool definitions
      const toolsSystemMessage = toolService.generateToolsSystemMessage();
      if (toolsSystemMessage) {
        session.messages.push({
          role: 'system',
          content: toolsSystemMessage,
        });
      }

      // Show completion message with checkmark
      showLoader(
        `Chat started with ${currentProvider.type} - ${currentProvider.model}`
      );

      // Small delay to show the completion message
      await new Promise(resolve => setTimeout(resolve, DELAYS.UI_LONG));

      hideLoader();
      unmount(); // Clean up the startup loader
      const { unmount: chatUnmount } = render(
        React.createElement(ChatWrapper, {
          onMessage: (message: string) =>
            handleMessage(message, session, mcpClient, config.ui.streaming),
          onMessageStream: config.ui.streaming
            ? (message: string) =>
                handleMessageStream(message, session, mcpClient)
            : undefined,
          onExit: () => {
            session.tokenCounter.endSession();
            chatUnmount();
            // Don't call process.exit(0) immediately - let the process naturally exit
          },
          provider: currentProviderConfig.type,
          model: currentProviderConfig.model,
          contextLength: modelInfo.contextLength,
          tokenCounter: session.tokenCounter,
          initialProviderName: currentProviderName,
          configManager: configManager,
          session: session,
          toolConfirmationRef: toolConfirmationRef,
        })
      );
    } catch (error) {
      hideLoader();
      if (unmount) unmount(); // Clean up startup loader on error
      console.error('❌ Chat session failed:', error);
      throw error; // Let the parent handle the error instead of force-exit
    }
  });

async function* handleMessageStream(
  input: string,
  session: ChatSession,
  mcpClient: FilesystemMCPClient
): AsyncGenerator<
  { content: string; thinking?: string; done: boolean },
  void,
  unknown
> {
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
    content: userContent,
  });

  try {
    let response = '';
    const thinkingParser = new ThinkingParser(session.thinkingMode, true); // Enable incremental mode
    let streamResponse: ProviderResponse | null = null;

    for await (const chunk of session.provider.stream(session.messages)) {
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
      content: response,
    };

    // Process tool calls if available
    if (session.toolExecutor) {
      let currentMessage = assistantMessage;
      let iterationCount = 0;
      const maxIterations = PROCESSING.MAX_ITERATIONS; // Prevent infinite loops

      // Keep processing tool calls until no more are found
      while (iterationCount < maxIterations) {
        const { updatedMessage, toolResults, hasToolCalls } =
          await session.toolExecutor.processMessage(currentMessage);

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

        for await (const chunk of session.provider.stream(session.messages)) {
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
        const hasMoreToolCalls = session.toolExecutor.messageNeedsToolExecution(
          {
            role: 'assistant',
            content: followUpResponse,
          }
        );

        currentMessage = {
          role: 'assistant',
          content: followUpResponse,
        };

        iterationCount++;

        // If this response doesn't have tool calls, we'll exit the loop
        if (!hasMoreToolCalls) {
          session.messages.push(currentMessage);
          break;
        }
      }

      if (iterationCount >= maxIterations) {
        yield {
          content: '\n\n⚠️  Maximum tool execution iterations reached',
          done: false,
        };
      }
    } else {
      session.messages.push(assistantMessage);
    }

    // Track token usage for the main response
    if (streamResponse) {
      const tokenUsage = session.tokenCounter.extractTokenUsage(
        streamResponse,
        userContent
      );
      session.tokenCounter.trackTokenUsage(
        tokenUsage.input,
        tokenUsage.output,
        tokenUsage.estimated
      );
    }

    yield {
      content: `\n\n${session.tokenCounter.formatTokenDisplay()}`,
      done: true,
    };
  } catch (error) {
    throw new Error(
      `Chat error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function handleMessage(
  input: string,
  session: ChatSession,
  mcpClient: FilesystemMCPClient,
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
    content: userContent,
  });

  try {
    let assistantMessage: Message;
    let providerResponse: ProviderResponse | null = null;

    if (useStreaming) {
      let response = '';
      const thinkingParser = new ThinkingParser(session.thinkingMode);

      for await (const chunk of session.provider.stream(session.messages)) {
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
        content: response,
      };
    } else {
      const response = await session.provider.chat(session.messages);
      assistantMessage = {
        role: 'assistant',
        content: response.content,
      };
      providerResponse = response;
    }

    // Process tool calls if available
    if (session.toolExecutor) {
      const { updatedMessage, toolResults, hasToolCalls } =
        await session.toolExecutor.processMessage(assistantMessage);
      session.messages.push(updatedMessage);

      if (hasToolCalls) {
        session.messages.push(...toolResults);
        const followUpResponse = await session.provider.chat(session.messages);
        session.messages.push({
          role: 'assistant',
          content: followUpResponse.content,
        });

        // Track token usage for follow-up response
        if (followUpResponse) {
          const tokenUsage = session.tokenCounter.extractTokenUsage(
            followUpResponse,
            userContent
          );
          session.tokenCounter.trackTokenUsage(
            tokenUsage.input,
            tokenUsage.output,
            tokenUsage.estimated
          );
        }

        return `${updatedMessage.content}\n\n${followUpResponse.content}`;
      }
    } else {
      session.messages.push(assistantMessage);
    }

    // Track token usage for the main response
    if (providerResponse) {
      const tokenUsage = session.tokenCounter.extractTokenUsage(
        providerResponse,
        userContent
      );
      session.tokenCounter.trackTokenUsage(
        tokenUsage.input,
        tokenUsage.output,
        tokenUsage.estimated
      );
    }

    return `${assistantMessage.content}\n\n${session.tokenCounter.formatTokenDisplay()}`;
  } catch (error) {
    throw new Error(
      `Chat error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function handleSlashCommand(
  command: string,
  session: ChatSession,
  mcpClient: FilesystemMCPClient
): Promise<string> {
  // Create command context
  const context: CommandContext = {
    workingDirectory: process.cwd(),
    isConfigured: true,
    session: session,
    mcpClient: mcpClient,
  };

  // Create command executor
  const executor = new CommandExecutor(context);

  // Execute command using CommandRegistry
  const result = await executor.executeCommand(command);

  if (result.success) {
    return result.output || '';
  } else {
    let errorMessage = result.error || 'Unknown error';
    if (result.suggestions && result.suggestions.length > 0) {
      errorMessage += `\n\nSuggestions:\n${result.suggestions.map(s => `  ${s}`).join('\n')}`;
    }
    return errorMessage;
  }
}

async function checkConfiguration(): Promise<boolean> {
  const configPath = '.aiya.yaml';

  try {
    await fs.promises.access(configPath, fs.constants.F_OK);
    return true; // Configuration file exists
  } catch {
    // Configuration file doesn't exist
    console.log('\n❌ No configuration found');
    console.log('Aiya needs to be initialized before you can start chatting.');
    console.log('\n🚀 To get started, run:');
    console.log('   aiya init');
    console.log(
      '\nThis will guide you through setting up your AI provider (Ollama, OpenAI, or Gemini).'
    );
    console.log('\n💡 After setup, you can:');
    console.log('   • Run "aiya chat" to start chatting');
    console.log('   • Run "aiya search <pattern>" to search files');
    console.log('   • Edit .aiya.yaml to customize settings');
    console.log('\nFor help, visit: https://github.com/jhyoong/Aiya\n');

    return false;
  }
}

function getHelpText(): string {
  return `Aiya Chat Commands:
  exit, quit, /exit, /quit - Exit chat session
  clear          - Clear conversation history
  help           - Show this help
  /read <file>   - Read and display file
  /add <file>    - Add file content to context for next prompt
  /search <pat>  - Search for files
  /tokens        - Show token usage
  /thinking [mode] - Set thinking display mode (on/brief/off)
  /model-switch [provider] - Switch between configured AI providers`;
}
