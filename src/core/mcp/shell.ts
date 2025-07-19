import {
  MCPClient,
  Tool,
  ToolResult,
  MCPServerInfo,
  MCPToolError,
} from './base.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * ShellMCPClient - MCP client for executing shell commands
 *
 * Provides a single tool:
 * - RunCommand: Execute bash commands and return output
 */
export class ShellMCPClient extends MCPClient {
  constructor() {
    super('shell');
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async ping(): Promise<boolean> {
    return this.connected;
  }

  async getServerInfo(): Promise<MCPServerInfo> {
    return {
      name: 'Shell MCP Server',
      version: '1.0.0',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
      },
    };
  }

  async listTools(): Promise<Tool[]> {
    return [
      {
        name: 'RunCommand',
        description: 'Execute a shell command and return its output',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The shell command to execute',
            },
            timeout: {
              type: 'number',
              description: 'Timeout in milliseconds (default: 30000)',
              default: 30000,
            },
          },
          required: ['command'],
        },
      },
    ];
  }

  async callTool(name: string, args: Record<string, any>): Promise<ToolResult> {
    if (name !== 'RunCommand') {
      throw new MCPToolError(name, `Unknown tool: ${name}`);
    }

    return this.runCommand(args);
  }

  async listResources(): Promise<never[]> {
    return [];
  }

  async readResource(): Promise<ToolResult> {
    throw new MCPToolError(
      'readResource',
      'Resources not supported by shell client'
    );
  }

  private async runCommand(args: Record<string, any>): Promise<ToolResult> {
    const { command, timeout = 30000 } = args;

    if (!command || typeof command !== 'string') {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: command parameter is required and must be a string',
          },
        ],
        isError: true,
      };
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout,
        cwd: process.cwd(),
      });

      let output = '';
      if (stdout) {
        output += `stdout:\n${stdout}`;
      }
      if (stderr) {
        if (output) output += '\n\n';
        output += `stderr:\n${stderr}`;
      }

      if (!output) {
        output = 'Command executed successfully with no output';
      }

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
        isError: false,
      };
    } catch (error: any) {
      let errorMessage = `Command failed: ${command}\n`;

      if (error.code === 'ETIMEOUT') {
        errorMessage += `Error: Command timed out after ${timeout}ms`;
      } else if (error.stdout || error.stderr) {
        if (error.stdout) {
          errorMessage += `stdout:\n${error.stdout}\n\n`;
        }
        if (error.stderr) {
          errorMessage += `stderr:\n${error.stderr}\n\n`;
        }
        errorMessage += `Exit code: ${error.code || 'unknown'}`;
      } else {
        errorMessage += `Error: ${error.message}`;
      }

      return {
        content: [
          {
            type: 'text',
            text: errorMessage,
          },
        ],
        isError: true,
      };
    }
  }
}
