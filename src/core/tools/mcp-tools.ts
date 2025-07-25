import {
  MCPClient,
  Tool as MCPTool,
  ToolResult as MCPToolResult,
} from '../mcp/base.js';
import { ToolCall, ToolResult } from '../providers/base.js';
import { ToolArguments } from '../../types/ProviderTypes.js';
import { JsonValue } from '../../types/UtilityTypes.js';

/**
 * JSON Schema property definition for tool parameters
 */
export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  enum?: JsonValue[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  default?: JsonValue;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

/**
 * Tool definition for LLM consumption with proper JSON Schema typing
 */
export interface LLMTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
}

/**
 * Service for managing MCP tools and making them available to LLMs
 */
export class MCPToolService {
  private clients: MCPClient[] = [];
  private availableTools: Map<string, { client: MCPClient; tool: MCPTool }> =
    new Map();

  constructor(clients: MCPClient[]) {
    this.clients = clients;
  }

  /**
   * Initialize the service by discovering tools from all connected MCP clients
   */
  async initialize(): Promise<void> {
    this.availableTools.clear();

    for (const client of this.clients) {
      if (!client.isConnected()) {
        await client.connect();
      }

      try {
        const tools = await client.listTools();
        for (const tool of tools) {
          // Prefix tool names with client name to avoid conflicts
          const toolName = `${client.getServerName()}_${tool.name}`;
          this.availableTools.set(toolName, { client, tool });
        }
      } catch (error) {
        console.warn(
          `Failed to discover tools from ${client.getServerName()}: ${error}`
        );
      }
    }
  }

  /**
   * Get tool definitions formatted for LLM consumption
   */
  getToolDefinitions(): LLMTool[] {
    const tools: LLMTool[] = [];

    for (const [toolName, { tool }] of this.availableTools) {
      tools.push({
        name: toolName,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.inputSchema.properties as Record<
            string,
            JsonSchemaProperty
          >,
          required: tool.inputSchema.required || [],
        },
      });
    }

    return tools;
  }

  /**
   * Execute a tool call from the LLM
   */
  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const toolInfo = this.availableTools.get(toolCall.name);
    if (!toolInfo) {
      return {
        toolCallId: toolCall.id,
        result: `Error: Tool '${toolCall.name}' not found`,
        isError: true,
      };
    }

    try {
      const { client, tool } = toolInfo;

      // Extract the original tool name (remove client prefix)
      const originalToolName = tool.name;

      // Validate tool arguments before calling
      const validatedArgs = this.validateToolArguments(
        toolCall.arguments,
        tool.inputSchema
      );

      const mcpResult = await client.callTool(originalToolName, validatedArgs);

      // Convert MCP result to tool result
      const result = this.formatMCPResult(mcpResult);

      return {
        toolCallId: toolCall.id,
        result,
        isError: mcpResult.isError || false,
      };
    } catch (error) {
      return {
        toolCallId: toolCall.id,
        result: `Error executing tool: ${error}`,
        isError: true,
      };
    }
  }

  /**
   * Validate tool arguments against the input schema
   */
  private validateToolArguments(
    args: ToolArguments,
    schema: unknown
  ): ToolArguments {
    // Basic validation - in a production system, you'd use a JSON Schema validator
    if (!args || typeof args !== 'object') {
      throw new Error('Tool arguments must be an object');
    }

    // Check required fields if they exist in schema
    if (schema && typeof schema === 'object' && 'required' in schema) {
      const required = (schema as { required: unknown }).required;
      if (Array.isArray(required)) {
        for (const requiredField of required) {
          if (typeof requiredField === 'string' && !(requiredField in args)) {
            throw new Error(
              `Required field '${requiredField}' is missing from tool arguments`
            );
          }
        }
      }
    }

    return args;
  }

  /**
   * Generate system message with tool definitions
   */
  generateToolsSystemMessage(): string {
    const tools = this.getToolDefinitions();

    if (tools.length === 0) {
      return '';
    }

    let message =
      'You have access to the following tools. When you need to use a tool, respond with a tool call in this exact format:\n\n';
    message +=
      '```json\n{\n  "tool_calls": [\n    {\n      "id": "call_123",\n      "name": "tool_name",\n      "arguments": {"param": "value"}\n    }\n  ]\n}\n```\n\n';
    message += 'Available tools:\n\n';

    for (const tool of tools) {
      message += `**${tool.name}**: ${tool.description}\n`;
      message += `Parameters: ${JSON.stringify(tool.parameters, null, 2)}\n\n`;
    }

    message +=
      "Only use tools when necessary to complete the user's request. Always explain what you're doing when using tools.";

    return message;
  }

  /**
   * Check if a message contains tool calls
   */
  detectToolCalls(content: string): ToolCall[] | null {
    try {
      // Look for JSON blocks containing tool_calls
      const jsonBlocks = content.match(/```json\s*(\{[\s\S]*?\})\s*```/g);

      if (!jsonBlocks) {
        return null;
      }

      for (const block of jsonBlocks) {
        const jsonContent = block.replace(/```json\s*|\s*```/g, '');

        try {
          const parsed = JSON.parse(jsonContent);
          if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
            return parsed.tool_calls.map((call: unknown) => ({
              id: (call as { id?: string }).id || this.generateCallId(),
              name: (call as { name: string }).name,
              arguments:
                (call as { arguments?: ToolArguments }).arguments || {},
            }));
          }
        } catch {
          // Continue to next block if this one isn't valid JSON
          continue;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get available tool names
   */
  getAvailableToolNames(): string[] {
    return Array.from(this.availableTools.keys());
  }

  private formatMCPResult(mcpResult: MCPToolResult): string {
    if (mcpResult.content.length === 0) {
      return 'No content returned';
    }

    return mcpResult.content
      .map(item => {
        if (item.type === 'text') {
          return item.text || '';
        }
        // Handle other content types as needed
        return `[${item.type} content]`;
      })
      .join('\n');
  }

  private generateCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
