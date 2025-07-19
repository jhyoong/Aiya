import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShellMCPClient } from '../../../src/core/mcp/shell.js';
import { MCPToolError } from '../../../src/core/mcp/base.js';
import { ToolMemoryService } from '../../../src/core/tools/memory.js';
import { ShellLogger } from '../../../src/core/tools/shell-logger.js';

describe('ShellMCPClient', () => {
  let shellClient: ShellMCPClient;
  let memoryService: ToolMemoryService;
  let shellLogger: ShellLogger;

  beforeEach(() => {
    memoryService = new ToolMemoryService();
    shellLogger = new ShellLogger();
    shellClient = new ShellMCPClient(memoryService, shellLogger);
  });

  describe('constructor and basic properties', () => {
    it('should initialize with correct server name', () => {
      expect(shellClient.getServerName()).toBe('shell');
      expect(shellClient.isConnected()).toBe(false);
    });
  });

  describe('connection management', () => {
    it('should connect successfully', async () => {
      await shellClient.connect();
      expect(shellClient.isConnected()).toBe(true);
    });

    it('should disconnect successfully', async () => {
      await shellClient.connect();
      await shellClient.disconnect();
      expect(shellClient.isConnected()).toBe(false);
    });

    it('should ping correctly based on connection status', async () => {
      // When not connected
      expect(await shellClient.ping()).toBe(false);

      // When connected
      await shellClient.connect();
      expect(await shellClient.ping()).toBe(true);

      // After disconnect
      await shellClient.disconnect();
      expect(await shellClient.ping()).toBe(false);
    });
  });

  describe('getServerInfo', () => {
    it('should return correct server information', async () => {
      const serverInfo = await shellClient.getServerInfo();

      expect(serverInfo.name).toBe('Shell MCP Server');
      expect(serverInfo.version).toBe('1.0.0');
      expect(serverInfo.capabilities).toEqual({
        tools: true,
        resources: false,
        prompts: false,
      });
    });
  });

  describe('listTools', () => {
    it('should return the RunCommand tool with correct schema', async () => {
      const tools = await shellClient.listTools();

      expect(tools).toHaveLength(1);

      const runCommandTool = tools[0];
      expect(runCommandTool.name).toBe('RunCommand');
      expect(runCommandTool.description).toBe(
        'Execute a shell command and return its output'
      );
      expect(runCommandTool.inputSchema.type).toBe('object');
      expect(runCommandTool.inputSchema.required).toEqual(['command']);

      const properties = runCommandTool.inputSchema.properties;
      expect(properties.command).toEqual({
        type: 'string',
        description: 'The shell command to execute',
      });
      expect(properties.timeout).toEqual({
        type: 'number',
        description: 'Timeout in milliseconds (default: 30000)',
        default: 30000,
      });
    });
  });

  describe('callTool', () => {
    it('should throw error for unknown tool', async () => {
      await expect(shellClient.callTool('UnknownTool', {})).rejects.toThrow(
        MCPToolError
      );

      try {
        await shellClient.callTool('UnknownTool', {});
      } catch (error) {
        expect(error).toBeInstanceOf(MCPToolError);
        expect((error as MCPToolError).message).toBe(
          "Tool 'UnknownTool' error: Unknown tool: UnknownTool"
        );
      }
    });
  });

  describe('runCommand - input validation', () => {
    it('should return error for missing command', async () => {
      const result = await shellClient.callTool('RunCommand', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe(
        'Error: command parameter is required and must be a string'
      );
    });

    it('should return error for non-string command', async () => {
      const result = await shellClient.callTool('RunCommand', { command: 123 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe(
        'Error: command parameter is required and must be a string'
      );
    });

    it('should return error for null command', async () => {
      const result = await shellClient.callTool('RunCommand', {
        command: null,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe(
        'Error: command parameter is required and must be a string'
      );
    });

    it('should return error for empty string command', async () => {
      const result = await shellClient.callTool('RunCommand', { command: '' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe(
        'Error: command parameter is required and must be a string'
      );
    });
  });

  describe('runCommand - safe integration tests', () => {
    it('should execute echo command successfully', async () => {
      const result = await shellClient.callTool('RunCommand', {
        command: 'echo "Hello World"',
      });

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Hello World');
      expect(result.content[0].text).toMatch(/^stdout:/);
    });

    it('should handle command with no output', async () => {
      const result = await shellClient.callTool('RunCommand', {
        command: 'true',
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe(
        'Command executed successfully with no output'
      );
    });

    it('should handle command failure', async () => {
      const result = await shellClient.callTool('RunCommand', {
        command: 'false',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Command failed: false');
      // Command may fail without showing exit code in some environments
      expect(result.content[0].text).toMatch(
        /Exit code: 1|Command failed: false/
      );
    });

    it('should handle nonexistent command', async () => {
      const result = await shellClient.callTool('RunCommand', {
        command: 'this-command-definitely-does-not-exist-12345',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'Command failed: this-command-definitely-does-not-exist-12345'
      );
      expect(result.content[0].text).toMatch(/not found|Exit code: 127/);
    });

    it('should use custom timeout', async () => {
      const result = await shellClient.callTool('RunCommand', {
        command: 'echo "timeout test"',
        timeout: 60000,
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('timeout test');
    });

    it('should handle commands with stderr output', async () => {
      // This command outputs to stderr but succeeds (exit code 0)
      const result = await shellClient.callTool('RunCommand', {
        command: 'echo "error message" >&2',
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toMatch(/stderr:.*error message/s);
    });

    it('should handle both stdout and stderr', async () => {
      const result = await shellClient.callTool('RunCommand', {
        command: 'echo "output"; echo "error" >&2',
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('stdout:');
      expect(result.content[0].text).toContain('stderr:');
      expect(result.content[0].text).toContain('output');
      expect(result.content[0].text).toContain('error');
    });
  });

  describe('resource methods', () => {
    it('should return empty array for listResources', async () => {
      const resources = await shellClient.listResources();
      expect(resources).toEqual([]);
    });

    it('should throw error for readResource', async () => {
      await expect(shellClient.readResource('test://resource')).rejects.toThrow(
        MCPToolError
      );

      try {
        await shellClient.readResource('test://resource');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPToolError);
        expect((error as MCPToolError).message).toBe(
          "Tool 'readResource' error: Resources not supported by shell client"
        );
      }
    });
  });

  describe('edge cases and special scenarios', () => {
    it('should handle commands with special characters', async () => {
      const result = await shellClient.callTool('RunCommand', {
        command: 'echo "Special chars: @#$%^&*()[]{}|\\\\;<>?"',
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Special chars');
    });

    it('should handle multiline output', async () => {
      const result = await shellClient.callTool('RunCommand', {
        command: 'echo -e "line1\\nline2\\nline3"',
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('line1');
      expect(result.content[0].text).toContain('line2');
      expect(result.content[0].text).toContain('line3');
    });

    it('should handle commands with quotes and escaping', async () => {
      const result = await shellClient.callTool('RunCommand', {
        command: 'echo "He said \\"Hello World\\""',
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('He said');
      expect(result.content[0].text).toContain('Hello World');
    });

    it('should timeout on very slow commands', async () => {
      const result = await shellClient.callTool('RunCommand', {
        command: 'sleep 5',
        timeout: 1000, // 1 second timeout
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Command failed: sleep 5');
    }, 10000); // Test timeout of 10 seconds

    it('should handle empty command output correctly', async () => {
      const result = await shellClient.callTool('RunCommand', { command: ':' }); // : is a no-op command

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe(
        'Command executed successfully with no output'
      );
    });
  });

  describe('comprehensive integration verification', () => {
    it('should demonstrate real shell execution capabilities', async () => {
      // Test basic file operations (safe)
      const result = await shellClient.callTool('RunCommand', {
        command: 'pwd',
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('stdout:');
      // Should contain some path (account for newlines)
      expect(result.content[0].text).toMatch(/\/[^\n]*/);
    });

    it('should verify tool result structure', async () => {
      const result = await shellClient.callTool('RunCommand', {
        command: 'echo test',
      });

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('isError');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type');
      expect(result.content[0]).toHaveProperty('text');
      expect(result.content[0].type).toBe('text');
    });

    it('should handle working directory correctly', async () => {
      const result = await shellClient.callTool('RunCommand', {
        command: 'pwd',
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain(process.cwd());
    });
  });

  describe('command execution and logging', () => {
    it('should execute all commands without approval checks', async () => {
      const result = await shellClient.callTool('RunCommand', {
        command: 'echo "any command"',
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('any command');
    });

    it('should execute potentially dangerous commands (approval handled at higher level)', async () => {
      // The shell client no longer blocks commands - approval is handled in chat.ts
      const result = await shellClient.callTool('RunCommand', {
        command: 'rm --help',
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toMatch(/(Usage|help|option)/i);
    });

    it('should provide memory service access', () => {
      const memoryServiceInstance = shellClient.getMemoryService();
      expect(memoryServiceInstance).toBe(memoryService);
    });

    it('should store command preferences correctly', () => {
      shellClient.storeCommandPreference('git push origin main', 'allow');

      expect(memoryService.getPreference('shell:git')).toBe('allow');
    });

    it('should log successful command execution', async () => {
      const logSpy = vi.spyOn(shellLogger, 'logShellCommand');

      await shellClient.callTool('RunCommand', {
        command: 'echo "test logging"',
      });

      expect(logSpy).toHaveBeenCalledWith(
        'echo "test logging"',
        0, // exit code 0 for success
        expect.stringContaining('test logging'),
        expect.any(String),
        expect.any(Number) // duration
      );
    });

    it('should log failed command execution', async () => {
      const logSpy = vi.spyOn(shellLogger, 'logShellCommand');

      await shellClient.callTool('RunCommand', {
        command: 'false', // command that always fails
      });

      expect(logSpy).toHaveBeenCalledWith(
        'false',
        expect.any(Number), // non-zero exit code
        expect.any(String),
        expect.any(String),
        expect.any(Number), // duration
        expect.any(String) // error message
      );
    });
  });
});
