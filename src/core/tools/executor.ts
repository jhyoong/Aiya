import { ToolResult, Message, ToolCall } from '../providers/base.js';
import { MCPToolService } from './mcp-tools.js';
import { ToolMemoryService, ToolPreference } from './memory.js';
import { ToolLogger } from './logger.js';
import chalk from 'chalk';

/**
 * Tool execution coordinator for handling LLM tool calls
 */
export class ToolExecutor {
  private mcpService: MCPToolService;
  private verbose: boolean;
  private confirmationCallback?: ((toolCalls: ToolCall[]) => Promise<boolean>) | undefined;
  private memoryService: ToolMemoryService;
  private toolLogger: ToolLogger;

  constructor(
    mcpService: MCPToolService, 
    verbose: boolean = false,
    confirmationCallback?: ((toolCalls: ToolCall[]) => Promise<boolean>) | undefined,
    memoryService?: ToolMemoryService,
    toolLogger?: ToolLogger
  ) {
    this.mcpService = mcpService;
    this.verbose = verbose;
    this.confirmationCallback = confirmationCallback;
    this.memoryService = memoryService || new ToolMemoryService();
    this.toolLogger = toolLogger || new ToolLogger();
  }

  /**
   * Process a message and execute any tool calls found
   */
  async processMessage(message: Message): Promise<{
    updatedMessage: Message;
    toolResults: Message[];
    hasToolCalls: boolean;
  }> {
    // Only process assistant messages for tool calls
    if (message.role !== 'assistant') {
      return {
        updatedMessage: message,
        toolResults: [],
        hasToolCalls: false,
      };
    }

    // Detect tool calls in the message content
    const toolCalls = this.mcpService.detectToolCalls(message.content);

    if (!toolCalls || toolCalls.length === 0) {
      return {
        updatedMessage: message,
        toolResults: [],
        hasToolCalls: false,
      };
    }

    if (this.verbose) {
      console.log(chalk.yellow(` Detected ${toolCalls.length} tool call(s)`));
    }

    // Check memory for stored preferences first
    const toolsNeedingConfirmation: ToolCall[] = [];
    let shouldExecute = true;

    for (const toolCall of toolCalls) {
      // Special handling for shell tools - they should ALWAYS go through confirmation callback
      // to enable command-specific approval (shell:rm, shell:curl, etc.)
      if (toolCall.name === 'shell_RunCommand') {
        toolsNeedingConfirmation.push(toolCall);
        continue;
      }
      
      const storedPreference = this.memoryService.getPreference(toolCall.name);
      
      if (storedPreference === 'reject') {
        // Auto-reject due to stored preference
        if (this.verbose) {
          console.log(chalk.red(`🚫 Tool '${toolCall.name}' auto-rejected due to stored preference`));
        }
        shouldExecute = false;
        break;
      } else if (storedPreference === 'allow') {
        // Auto-allow due to stored preference
        if (this.verbose) {
          console.log(chalk.green(`✓ Tool '${toolCall.name}' auto-allowed due to stored preference`));
        }
      } else {
        // No stored preference, needs confirmation
        toolsNeedingConfirmation.push(toolCall);
      }
    }

    // If any tool was auto-rejected, cancel execution
    if (!shouldExecute) {
      return {
        updatedMessage: message,
        toolResults: [],
        hasToolCalls: false,
      };
    }

    // Request confirmation for tools without stored preferences
    if (toolsNeedingConfirmation.length > 0 && this.confirmationCallback) {
      const confirmed = await this.confirmationCallback(toolsNeedingConfirmation);
      if (!confirmed) {
        // User cancelled - return message without tool execution
        if (this.verbose) {
          console.log(chalk.red('🚫 Tool execution cancelled by user'));
        }
        return {
          updatedMessage: message,
          toolResults: [],
          hasToolCalls: false,
        };
      }
    }

    // Execute all tool calls
    const toolResults: ToolResult[] = [];
    for (const toolCall of toolCalls) {
      if (this.verbose) {
        console.log(
          chalk.blue(
            `  → Executing: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`
          )
        );
      }

      const startTime = Date.now();
      const result = await this.mcpService.executeTool(toolCall);
      const duration = Date.now() - startTime;
      
      // Log tool execution
      this.toolLogger.logToolExecution(
        toolCall.name,
        toolCall.arguments,
        result.isError ? undefined : result.result,
        result.isError ? result.result : undefined,
        duration
      );
      
      toolResults.push(result);

      if (this.verbose) {
        const status = result.isError ? chalk.red('✗') : chalk.green('✓');
        console.log(
          `  ${status} ${toolCall.name}: ${result.result.substring(0, 100)}${result.result.length > 100 ? '...' : ''}`
        );
      }
    }

    // Create updated assistant message with tool calls
    const updatedMessage: Message = {
      ...message,
      toolCalls: toolCalls,
    };

    // Create tool result messages
    const toolResultMessages: Message[] = toolResults.map(result => ({
      role: 'tool' as const,
      content: result.result,
      toolCallId: result.toolCallId,
    }));

    return {
      updatedMessage,
      toolResults: toolResultMessages,
      hasToolCalls: true,
    };
  }

  /**
   * Check if a conversation needs tool execution
   */
  needsToolExecution(messages: Message[]): boolean {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant') {
      return false;
    }

    const toolCalls = this.mcpService.detectToolCalls(lastMessage.content);
    return toolCalls !== null && toolCalls.length > 0;
  }

  /**
   * Check if a single message needs tool execution
   */
  messageNeedsToolExecution(message: Message): boolean {
    if (message.role !== 'assistant') {
      return false;
    }

    const toolCalls = this.mcpService.detectToolCalls(message.content);
    return toolCalls !== null && toolCalls.length > 0;
  }

  /**
   * Extract clean content from assistant message (remove tool call JSON)
   */
  extractCleanContent(content: string): string {
    // Remove JSON tool call blocks from the content
    return content.replace(/```json\s*\{[\s\S]*?\}\s*```/g, '').trim();
  }

  /**
   * Generate follow-up prompt for tool results
   */
  generateFollowUpPrompt(toolResults: Message[]): string {
    if (toolResults.length === 0) {
      return '';
    }

    let prompt = 'Tool execution results:\n\n';

    for (const result of toolResults) {
      prompt += `Tool result: ${result.content}\n\n`;
    }

    prompt += 'Please continue your response based on these results.';

    return prompt;
  }

  /**
   * Check if all tool calls in a message were successful
   */
  areToolCallsSuccessful(toolResults: ToolResult[]): boolean {
    return toolResults.every(result => !result.isError);
  }

  /**
   * Get summary of tool execution
   */
  getExecutionSummary(toolResults: ToolResult[]): string {
    const successful = toolResults.filter(r => !r.isError).length;
    const failed = toolResults.filter(r => r.isError).length;

    if (failed === 0) {
      return `All ${successful} tool call(s) executed successfully`;
    } else if (successful === 0) {
      return `❌ All ${failed} tool call(s) failed`;
    } else {
      return `⚠️  ${successful} successful, ${failed} failed tool call(s)`;
    }
  }

  /**
   * Store tool preference in memory
   */
  storeToolPreference(toolName: string, preference: ToolPreference): void {
    this.memoryService.setPreference(toolName, preference);
    if (this.verbose) {
      console.log(chalk.blue(`📝 Stored preference for '${toolName}': ${preference}`));
    }
  }

  /**
   * Get memory service instance (for external access)
   */
  getMemoryService(): ToolMemoryService {
    return this.memoryService;
  }

  /**
   * Get tool logger instance (for external access)
   */
  getToolLogger(): ToolLogger {
    return this.toolLogger;
  }
}
