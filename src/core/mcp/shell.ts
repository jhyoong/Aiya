import {
  MCPClient,
  Tool,
  ToolResult,
  MCPServerInfo,
  MCPToolError,
} from './base.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { extractCommandName } from './shell-constants.js';
import { TIMEOUTS } from '../config/timing-constants.js';
import { ToolMemoryService, ToolPreference } from '../tools/memory.js';
import { ShellLogger } from '../tools/shell-logger.js';

const execAsync = promisify(exec);

interface ExecError extends Error {
  code?: string | number;
  stdout?: string;
  stderr?: string;
}

/**
 * ShellMCPClient - MCP client for executing shell commands
 *
 * Provides a single tool:
 * - RunCommand: Execute bash commands and return output
 */
export class ShellMCPClient extends MCPClient {
  private memoryService: ToolMemoryService;
  private shellLogger: ShellLogger;

  constructor(memoryService?: ToolMemoryService, shellLogger?: ShellLogger) {
    super('shell');
    this.memoryService = memoryService || new ToolMemoryService();
    this.shellLogger = shellLogger || new ShellLogger();
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
              description: `Timeout in milliseconds (default: ${TIMEOUTS.SHELL_DEFAULT})`,
              default: TIMEOUTS.SHELL_DEFAULT,
            },
          },
          required: ['command'],
        },
      },
    ];
  }

  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
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

  private async runCommand(args: Record<string, unknown>): Promise<ToolResult> {
    const command = args.command as string;
    const timeout = (args.timeout as number) || TIMEOUTS.SHELL_DEFAULT;

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

    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout,
        cwd: process.cwd(),
      });

      const duration = Date.now() - startTime;
      // Log successful command execution
      this.shellLogger.logShellCommand(
        command,
        0, // exit code 0 for success
        stdout,
        stderr,
        duration
      );

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
    } catch (error: unknown) {
      const duration = Date.now() - startTime;

      // Type guard for exec error
      const isExecError = (err: unknown): err is ExecError => {
        return err instanceof Error;
      };

      const execError = isExecError(error)
        ? error
        : ({ message: String(error) } as ExecError);

      // Convert code to number if it's a string
      const exitCode =
        typeof execError.code === 'string'
          ? parseInt(execError.code, 10) || -1
          : execError.code || -1;

      // Log failed command execution
      this.shellLogger.logShellCommand(
        command,
        exitCode,
        execError.stdout,
        execError.stderr,
        duration,
        execError.message
      );

      let errorMessage = `Command failed: ${command}\n`;

      if (execError.code === 'ETIMEOUT') {
        errorMessage += `Error: Command timed out after ${timeout}ms`;
      } else if (execError.stdout || execError.stderr) {
        if (execError.stdout) {
          errorMessage += `stdout:\n${execError.stdout}\n\n`;
        }
        if (execError.stderr) {
          errorMessage += `stderr:\n${execError.stderr}\n\n`;
        }
        errorMessage += `Exit code: ${execError.code || 'unknown'}`;
      } else {
        errorMessage += `Error: ${execError.message}`;
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

  /**
   * Store command preference in memory for future executions
   */
  storeCommandPreference(command: string, preference: ToolPreference): void {
    const commandName = extractCommandName(command);
    const memoryKey = `shell:${commandName}`;
    this.memoryService.setPreference(memoryKey, preference);
  }

  /**
   * Get memory service instance for external access
   */
  getMemoryService(): ToolMemoryService {
    return this.memoryService;
  }
}
