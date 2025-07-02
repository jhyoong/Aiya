import { ToolResult, Message } from '../providers/base.js';
import { MCPToolService } from './mcp-tools.js';
import chalk from 'chalk';

/**
 * Tool execution coordinator for handling LLM tool calls
 */
export class ToolExecutor {
  private mcpService: MCPToolService;
  private verbose: boolean;

  constructor(mcpService: MCPToolService, verbose: boolean = false) {
    this.mcpService = mcpService;
    this.verbose = verbose;
  }

  /**
   * Process a message and execute any tool calls found
   */
  async processMessage(message: Message): Promise<{ 
    updatedMessage: Message; 
    toolResults: Message[]; 
    hasToolCalls: boolean 
  }> {
    // Only process assistant messages for tool calls
    if (message.role !== 'assistant') {
      return {
        updatedMessage: message,
        toolResults: [],
        hasToolCalls: false
      };
    }

    // Detect tool calls in the message content
    const toolCalls = this.mcpService.detectToolCalls(message.content);
    
    if (!toolCalls || toolCalls.length === 0) {
      return {
        updatedMessage: message,
        toolResults: [],
        hasToolCalls: false
      };
    }

    if (this.verbose) {
      console.log(chalk.yellow(`🔧 Detected ${toolCalls.length} tool call(s)`));
    }

    // Execute all tool calls
    const toolResults: ToolResult[] = [];
    for (const toolCall of toolCalls) {
      if (this.verbose) {
        console.log(chalk.blue(`  → Executing: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`));
      }
      
      const result = await this.mcpService.executeTool(toolCall);
      toolResults.push(result);
      
      if (this.verbose) {
        const status = result.isError ? chalk.red('✗') : chalk.green('✓');
        console.log(`  ${status} ${toolCall.name}: ${result.result.substring(0, 100)}${result.result.length > 100 ? '...' : ''}`);
      }
    }

    // Create updated assistant message with tool calls
    const updatedMessage: Message = {
      ...message,
      toolCalls: toolCalls
    };

    // Create tool result messages
    const toolResultMessages: Message[] = toolResults.map(result => ({
      role: 'tool' as const,
      content: result.result,
      toolCallId: result.toolCallId
    }));

    return {
      updatedMessage,
      toolResults: toolResultMessages,
      hasToolCalls: true
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
      return `✅ All ${successful} tool call(s) executed successfully`;
    } else if (successful === 0) {
      return `❌ All ${failed} tool call(s) failed`;
    } else {
      return `⚠️  ${successful} successful, ${failed} failed tool call(s)`;
    }
  }
}