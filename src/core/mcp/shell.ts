import {
  MCPClient,
  Tool,
  ToolResult,
  MCPServerInfo,
  MCPError,
} from './base.js';
import { WorkspaceSecurity } from '../security/workspace.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { performance } from 'perf_hooks';

/**
 * Parameters for shell command execution
 */
export interface ShellExecuteParams {
  command: string;
  cwd?: string;
  timeout?: number;
}

/**
 * Result of shell command execution
 */
export interface ShellExecuteResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

/**
 * ShellMCPClient - MCP client for shell command execution
 * 
 * Phase 1: Basic structure and tool registration
 * Provides secure shell command execution within workspace boundaries
 */
export class ShellMCPClient extends MCPClient {
  private security: WorkspaceSecurity;

  constructor(security: WorkspaceSecurity) {
    super('shell');
    this.security = security;
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
        name: 'ExecuteCommand',
        description: 'Execute shell commands safely within workspace boundaries',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The shell command to execute',
            },
            cwd: {
              type: 'string',
              description: 'Working directory for command execution (default: workspace root)',
            },
            timeout: {
              type: 'number',
              description: 'Command timeout in seconds (default: 30)',
              minimum: 1,
              maximum: 300,
              default: 30,
            },
          },
          required: ['command'],
        },
      },
    ];
  }

  async callTool(name: string, args: Record<string, any>): Promise<ToolResult> {
    try {
      switch (name) {
        case 'ExecuteCommand':
          return await this.executeCommand(args);
        default:
          return {
            content: [
              {
                type: 'text',
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Shell execution error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async listResources(): Promise<any[]> {
    return [];
  }

  async readResource(_uri: string): Promise<ToolResult> {
    return {
      content: [
        {
          type: 'text',
          text: 'Resources not supported by Shell MCP client',
        },
      ],
      isError: true,
    };
  }

  /**
   * ExecuteCommand tool implementation (Phase 2: actual command execution)
   */
  private async executeCommand(params: any): Promise<ToolResult> {
    const { command, cwd, timeout = 30 } = params as ShellExecuteParams;

    // Validate required parameters
    if (!command || typeof command !== 'string') {
      throw new MCPError('Command parameter is required and must be a string');
    }

    // Validate working directory if provided
    let workingDirectory = this.security.getWorkspaceRoot();
    if (cwd) {
      try {
        workingDirectory = await this.security.validateFileAccess(cwd, 'read');
      } catch (error) {
        throw new MCPError(`Invalid working directory: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Validate timeout
    if (timeout < 1 || timeout > 300) {
      throw new MCPError('Timeout must be between 1 and 300 seconds');
    }

    // Execute command with timeout and error handling
    const result = await this.executeCommandWithTimeout(command, workingDirectory, timeout);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            command,
            workingDirectory: this.security.getRelativePathFromWorkspace(workingDirectory),
            timeout,
            result,
            phase: 'Phase 2 - Core Execution',
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Execute command with timeout handling and structured error response
   */
  private async executeCommandWithTimeout(
    command: string,
    workingDirectory: string,
    timeoutSeconds: number
  ): Promise<ShellExecuteResult> {
    const execAsync = promisify(exec);
    const startTime = performance.now();

    try {
      // Set up AbortController for timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeoutSeconds * 1000);

      // Execute command
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDirectory,
        signal: abortController.signal,
        maxBuffer: 1024 * 1024, // 1MB buffer limit
      });

      clearTimeout(timeoutId);
      const executionTime = performance.now() - startTime;

      return {
        success: true,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: 0,
        executionTime: Math.round(executionTime),
      };
    } catch (error: any) {
      const executionTime = performance.now() - startTime;

      // Handle timeout
      if (error.name === 'AbortError' || error.signal === 'SIGTERM') {
        return {
          success: false,
          stdout: '',
          stderr: `Command timed out after ${timeoutSeconds} seconds`,
          exitCode: -1,
          executionTime: Math.round(executionTime),
        };
      }

      // Handle command not found
      if (error.code === 'ENOENT') {
        return {
          success: false,
          stdout: '',
          stderr: `Command not found: ${command}`,
          exitCode: 127,
          executionTime: Math.round(executionTime),
        };
      }

      // Handle permission denied
      if (error.code === 'EACCES') {
        return {
          success: false,
          stdout: '',
          stderr: `Permission denied: ${command}`,
          exitCode: 126,
          executionTime: Math.round(executionTime),
        };
      }

      // Handle non-zero exit codes (command ran but failed)
      if (error.code && typeof error.code === 'number') {
        return {
          success: false,
          stdout: error.stdout || '',
          stderr: error.stderr || error.message,
          exitCode: error.code,
          executionTime: Math.round(executionTime),
        };
      }

      // Handle other errors
      return {
        success: false,
        stdout: '',
        stderr: error.message || 'Unknown execution error',
        exitCode: 1,
        executionTime: Math.round(executionTime),
      };
    }
  }
}