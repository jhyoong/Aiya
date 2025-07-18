/**
 * Unit tests for error modules
 * Tests base-errors.ts, execution-errors.ts, and security-errors.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ShellExecutionError,
  ShellInputValidationError,
  ShellTimeoutError,
  ShellPermissionError,
  ShellCommandNotFoundError,
  ShellGeneralExecutionError,
} from '../../../../src/core/mcp/shell/errors/base-errors.js';
import {
  ShellConfigurationError,
  ShellUnknownError,
  ShellErrorCategorizer,
} from '../../../../src/core/mcp/shell/errors/execution-errors.js';
import {
  ShellSecurityError,
  ShellCommandBlockedError,
  ShellPathTraversalError,
  ShellWorkspaceViolationError,
  ShellDangerousCommandError,
  ShellCommandInjectionError,
  ShellPrivilegeEscalationError,
  ShellFileSystemRestrictionError,
  ShellNetworkRestrictionError,
} from '../../../../src/core/mcp/shell/errors/security-errors.js';
import { ShellErrorType, ShellErrorContext } from '../../../../src/core/mcp/shell/types.js';

describe('Error Modules', () => {
  let mockContext: ShellErrorContext;

  beforeEach(() => {
    mockContext = {
      command: 'test-command',
      workingDirectory: '/test/directory',
      exitCode: 1,
      executionTime: 1000,
      timestamp: new Date(),
    };
  });

  describe('Base Error Classes', () => {
    describe('ShellExecutionError', () => {
      it('should initialize with correct properties', () => {
        const error = new ShellExecutionError(
          'Test error message',
          ShellErrorType.EXECUTION_ERROR,
          mockContext,
          ['suggestion1', 'suggestion2'],
          true,
          500,
          new Error('original error')
        );

        expect(error.message).toBe('Test error message');
        expect(error.errorType).toBe(ShellErrorType.EXECUTION_ERROR);
        expect(error.context).toEqual(mockContext);
        expect(error.suggestions).toEqual(['suggestion1', 'suggestion2']);
        expect(error.retryable).toBe(true);
        expect(error.code).toBe(500);
        expect(error.cause).toBeInstanceOf(Error);
      });

      it('should convert to JSON correctly', () => {
        const error = new ShellExecutionError(
          'Test error',
          ShellErrorType.EXECUTION_ERROR,
          mockContext,
          ['suggestion1'],
          true,
          500
        );

        const json = error.toJSON();
        expect(json.name).toBe('ShellExecutionError');
        expect(json.message).toBe('Test error');
        expect(json.errorType).toBe(ShellErrorType.EXECUTION_ERROR);
        expect(json.context).toEqual(mockContext);
        expect(json.suggestions).toEqual(['suggestion1']);
        expect(json.retryable).toBe(true);
        expect(json.code).toBe(500);
      });

      it('should generate user-friendly messages', () => {
        const error = new ShellExecutionError(
          'Test error',
          ShellErrorType.EXECUTION_ERROR,
          mockContext,
          ['First suggestion', 'Second suggestion'],
          false
        );

        const friendlyMessage = error.getUserFriendlyMessage();
        expect(friendlyMessage).toContain('Test error');
        expect(friendlyMessage).toContain('Suggestions:');
        expect(friendlyMessage).toContain('1. First suggestion');
        expect(friendlyMessage).toContain('2. Second suggestion');
      });

      it('should indicate retryability correctly', () => {
        const retryableError = new ShellExecutionError(
          'Retryable error',
          ShellErrorType.EXECUTION_ERROR,
          mockContext,
          [],
          true
        );

        const nonRetryableError = new ShellExecutionError(
          'Non-retryable error',
          ShellErrorType.EXECUTION_ERROR,
          mockContext,
          [],
          false
        );

        expect(retryableError.isRetryable()).toBe(true);
        expect(nonRetryableError.isRetryable()).toBe(false);
      });

      it('should determine severity levels correctly', () => {
        const criticalError = new ShellExecutionError(
          'Critical error',
          ShellErrorType.SECURITY_ERROR,
          mockContext
        );

        const highError = new ShellExecutionError(
          'High error',
          ShellErrorType.COMMAND_BLOCKED,
          mockContext
        );

        const mediumError = new ShellExecutionError(
          'Medium error',
          ShellErrorType.TIMEOUT_ERROR,
          mockContext
        );

        const lowError = new ShellExecutionError(
          'Low error',
          ShellErrorType.COMMAND_NOT_FOUND,
          mockContext
        );

        expect(criticalError.getSeverity()).toBe('critical');
        expect(highError.getSeverity()).toBe('high');
        expect(mediumError.getSeverity()).toBe('medium');
        expect(lowError.getSeverity()).toBe('low');
      });
    });

    describe('ShellInputValidationError', () => {
      it('should initialize with correct properties', () => {
        const error = new ShellInputValidationError(
          'invalid input',
          'contains special characters',
          mockContext
        );

        expect(error.name).toBe('ShellInputValidationError');
        expect(error.errorType).toBe(ShellErrorType.INPUT_VALIDATION);
        expect(error.message).toContain('invalid input');
        expect(error.message).toContain('contains special characters');
        expect(error.retryable).toBe(false);
        expect(error.code).toBe(400);
        expect(error.suggestions).toContain('Check command syntax and format');
      });
    });

    describe('ShellTimeoutError', () => {
      it('should initialize with correct properties', () => {
        const error = new ShellTimeoutError('long-running-command', 30, mockContext);

        expect(error.name).toBe('ShellTimeoutError');
        expect(error.errorType).toBe(ShellErrorType.TIMEOUT_ERROR);
        expect(error.message).toContain('timed out after 30 seconds');
        expect(error.message).toContain('long-running-command');
        expect(error.retryable).toBe(true);
        expect(error.code).toBe(-1);
        expect(error.suggestions).toContain('Try running the command with a longer timeout');
      });
    });

    describe('ShellPermissionError', () => {
      it('should initialize with correct properties', () => {
        const originalError = new Error('EACCES: permission denied');
        const error = new ShellPermissionError('restricted-command', mockContext, originalError);

        expect(error.name).toBe('ShellPermissionError');
        expect(error.errorType).toBe(ShellErrorType.PERMISSION_ERROR);
        expect(error.message).toContain('Permission denied');
        expect(error.message).toContain('restricted-command');
        expect(error.retryable).toBe(false);
        expect(error.code).toBe(126);
        expect(error.cause).toBe(originalError);
        expect(error.suggestions).toContain('Check file and directory permissions');
      });
    });

    describe('ShellCommandNotFoundError', () => {
      it('should initialize with correct properties', () => {
        const error = new ShellCommandNotFoundError('missing-command', mockContext);

        expect(error.name).toBe('ShellCommandNotFoundError');
        expect(error.errorType).toBe(ShellErrorType.COMMAND_NOT_FOUND);
        expect(error.message).toContain('Command not found');
        expect(error.message).toContain('missing-command');
        expect(error.retryable).toBe(false);
        expect(error.code).toBe(127);
        expect(error.suggestions).toContain('Check if the command is installed');
      });
    });

    describe('ShellGeneralExecutionError', () => {
      it('should initialize with correct properties', () => {
        const error = new ShellGeneralExecutionError(
          'failing-command',
          1,
          'command failed with error',
          mockContext
        );

        expect(error.name).toBe('ShellGeneralExecutionError');
        expect(error.errorType).toBe(ShellErrorType.EXECUTION_ERROR);
        expect(error.message).toContain('Command failed with exit code 1');
        expect(error.message).toContain('failing-command');
        expect(error.message).toContain('command failed with error');
        expect(error.retryable).toBe(true);
        expect(error.code).toBe(1);
        expect(error.suggestions).toContain('Check the command syntax and arguments');
      });
    });
  });

  describe('Execution Error Classes', () => {
    describe('ShellConfigurationError', () => {
      it('should initialize with correct properties', () => {
        const error = new ShellConfigurationError(
          'timeout',
          'value must be positive',
          mockContext
        );

        expect(error.name).toBe('ShellConfigurationError');
        expect(error.errorType).toBe(ShellErrorType.CONFIGURATION_ERROR);
        expect(error.message).toContain('Configuration error for \'timeout\'');
        expect(error.message).toContain('value must be positive');
        expect(error.retryable).toBe(false);
        expect(error.code).toBe(400);
        expect(error.suggestions).toContain('Check configuration files');
      });
    });

    describe('ShellUnknownError', () => {
      it('should initialize with correct properties', () => {
        const error = new ShellUnknownError('unknown failure', 255, mockContext);

        expect(error.name).toBe('ShellUnknownError');
        expect(error.errorType).toBe(ShellErrorType.UNKNOWN_ERROR);
        expect(error.message).toContain('Unknown error');
        expect(error.message).toContain('unknown failure');
        expect(error.retryable).toBe(false);
        expect(error.code).toBe(255);
        expect(error.suggestions).toContain('Check the command output for specific error details');
      });
    });
  });

  describe('Security Error Classes', () => {
    describe('ShellSecurityError', () => {
      it('should initialize with correct properties', () => {
        const error = new ShellSecurityError(
          'Security violation',
          mockContext,
          'SECURITY_TEST',
          ['Check permissions']
        );

        expect(error.name).toBe('ShellSecurityError');
        expect(error.errorType).toBe(ShellErrorType.SECURITY_ERROR);
        expect(error.message).toBe('Security violation');
        expect(error.context.securityEvent).toBe('SECURITY_TEST');
        expect(error.retryable).toBe(false);
        expect(error.code).toBe(403);
        expect(error.suggestions).toContain('Check permissions');
      });
    });

    describe('ShellCommandBlockedError', () => {
      it('should initialize with correct properties', () => {
        const error = new ShellCommandBlockedError(
          'dangerous-command',
          'command is not allowed',
          mockContext
        );

        expect(error.name).toBe('ShellCommandBlockedError');
        expect(error.errorType).toBe(ShellErrorType.COMMAND_BLOCKED);
        expect(error.message).toContain('Command blocked');
        expect(error.message).toContain('dangerous-command');
        expect(error.message).toContain('command is not allowed');
        expect(error.context.securityEvent).toBe('COMMAND_BLOCKED');
        expect(error.retryable).toBe(false);
        expect(error.code).toBe(403);
        expect(error.suggestions).toContain('Review the command for security risks');
      });
    });

    describe('ShellPathTraversalError', () => {
      it('should initialize with correct properties', () => {
        const error = new ShellPathTraversalError('../../../etc/passwd', mockContext);

        expect(error.name).toBe('ShellPathTraversalError');
        expect(error.errorType).toBe(ShellErrorType.PATH_TRAVERSAL);
        expect(error.message).toContain('Path traversal attempt detected');
        expect(error.message).toContain('../../../etc/passwd');
        expect(error.context.securityEvent).toBe('PATH_TRAVERSAL');
        expect(error.retryable).toBe(false);
        expect(error.code).toBe(403);
        expect(error.suggestions).toContain('Use paths within the workspace directory');
      });
    });

    describe('ShellWorkspaceViolationError', () => {
      it('should initialize with correct properties', () => {
        const error = new ShellWorkspaceViolationError(
          'cat /etc/passwd',
          '/etc/passwd',
          mockContext
        );

        expect(error.name).toBe('ShellWorkspaceViolationError');
        expect(error.errorType).toBe(ShellErrorType.SECURITY_ERROR);
        expect(error.message).toContain('Workspace violation');
        expect(error.message).toContain('cat /etc/passwd');
        expect(error.message).toContain('/etc/passwd');
        expect(error.context.securityEvent).toBe('WORKSPACE_VIOLATION');
        expect(error.suggestions).toContain('Operations must be performed within the workspace directory');
      });
    });

    describe('ShellDangerousCommandError', () => {
      it('should initialize with correct properties', () => {
        const error = new ShellDangerousCommandError(
          'rm -rf /',
          'system destructive command',
          mockContext
        );

        expect(error.name).toBe('ShellDangerousCommandError');
        expect(error.errorType).toBe(ShellErrorType.SECURITY_ERROR);
        expect(error.message).toContain('Dangerous command detected');
        expect(error.message).toContain('rm -rf /');
        expect(error.message).toContain('system destructive command');
        expect(error.context.securityEvent).toBe('DANGEROUS_COMMAND');
        expect(error.suggestions).toContain('Use safer alternatives to accomplish the task');
      });
    });

    describe('ShellCommandInjectionError', () => {
      it('should initialize with correct properties', () => {
        const error = new ShellCommandInjectionError(
          'ls; rm -rf /',
          '; rm -rf /',
          mockContext
        );

        expect(error.name).toBe('ShellCommandInjectionError');
        expect(error.errorType).toBe(ShellErrorType.SECURITY_ERROR);
        expect(error.message).toContain('Potential command injection detected');
        expect(error.message).toContain('ls; rm -rf /');
        expect(error.message).toContain('; rm -rf /');
        expect(error.context.securityEvent).toBe('COMMAND_INJECTION');
        expect(error.suggestions).toContain('Avoid using special characters like ;, |, &, $, `, etc.');
      });
    });

    describe('ShellPrivilegeEscalationError', () => {
      it('should initialize with correct properties', () => {
        const error = new ShellPrivilegeEscalationError('sudo rm file', mockContext);

        expect(error.name).toBe('ShellPrivilegeEscalationError');
        expect(error.errorType).toBe(ShellErrorType.SECURITY_ERROR);
        expect(error.message).toContain('Privilege escalation attempt detected');
        expect(error.message).toContain('sudo rm file');
        expect(error.context.securityEvent).toBe('PRIVILEGE_ESCALATION');
        expect(error.suggestions).toContain('Commands requiring elevated privileges are not allowed');
      });
    });

    describe('ShellFileSystemRestrictionError', () => {
      it('should initialize with correct properties', () => {
        const error = new ShellFileSystemRestrictionError(
          'cat /etc/passwd',
          '/etc/passwd',
          mockContext
        );

        expect(error.name).toBe('ShellFileSystemRestrictionError');
        expect(error.errorType).toBe(ShellErrorType.SECURITY_ERROR);
        expect(error.message).toContain('File system restriction');
        expect(error.message).toContain('cat /etc/passwd');
        expect(error.message).toContain('/etc/passwd');
        expect(error.context.securityEvent).toBe('FILE_SYSTEM_RESTRICTION');
        expect(error.suggestions).toContain('Access to system directories is restricted');
      });
    });

    describe('ShellNetworkRestrictionError', () => {
      it('should initialize with correct properties', () => {
        const error = new ShellNetworkRestrictionError(
          'curl http://malicious.com',
          'external HTTP request',
          mockContext
        );

        expect(error.name).toBe('ShellNetworkRestrictionError');
        expect(error.errorType).toBe(ShellErrorType.SECURITY_ERROR);
        expect(error.message).toContain('Network restriction');
        expect(error.message).toContain('curl http://malicious.com');
        expect(error.message).toContain('external HTTP request');
        expect(error.context.securityEvent).toBe('NETWORK_RESTRICTION');
        expect(error.suggestions).toContain('Network operations may be restricted in this environment');
      });
    });
  });

  describe('ShellErrorCategorizer', () => {
    describe('Error Categorization', () => {
      it('should categorize permission errors correctly', () => {
        const result = ShellErrorCategorizer.categorizeError(
          new Error('permission denied'),
          126,
          '',
          'permission denied: /restricted/file',
          'cat /restricted/file',
          '/workspace',
          1000
        );

        expect(result.errorType).toBe(ShellErrorType.PERMISSION_ERROR);
        expect(result.retryable).toBe(false);
        expect(result.suggestions).toContain('Check file and directory permissions');
        expect(result.context.command).toBe('cat /restricted/file');
        expect(result.context.exitCode).toBe(126);
      });

      it('should categorize command not found errors correctly', () => {
        const result = ShellErrorCategorizer.categorizeError(
          new Error('command not found'),
          127,
          '',
          'missing_command: command not found',
          'missing_command',
          '/workspace',
          500
        );

        expect(result.errorType).toBe(ShellErrorType.COMMAND_NOT_FOUND);
        expect(result.retryable).toBe(false);
        expect(result.suggestions).toContain('Check if the command is installed');
      });

      it('should categorize timeout errors correctly', () => {
        const result = ShellErrorCategorizer.categorizeError(
          new Error('operation timed out'),
          -1,
          '',
          'timeout: operation timed out',
          'long_running_command',
          '/workspace',
          30000
        );

        expect(result.errorType).toBe(ShellErrorType.TIMEOUT_ERROR);
        expect(result.retryable).toBe(true);
        expect(result.suggestions).toContain('Try running the command with a longer timeout');
      });

      it('should categorize path traversal errors correctly', () => {
        const result = ShellErrorCategorizer.categorizeError(
          new Error('path traversal detected'),
          403,
          '',
          'path traversal attempt detected',
          'cat ../../../etc/passwd',
          '/workspace',
          1000
        );

        expect(result.errorType).toBe(ShellErrorType.PATH_TRAVERSAL);
        expect(result.retryable).toBe(false);
        expect(result.suggestions).toContain('Use paths within the workspace directory');
      });

      it('should categorize input validation errors correctly', () => {
        const result = ShellErrorCategorizer.categorizeError(
          new Error('invalid input'),
          400,
          '',
          'invalid command syntax',
          'invalid_command --bad-syntax',
          '/workspace',
          100
        );

        expect(result.errorType).toBe(ShellErrorType.INPUT_VALIDATION);
        expect(result.retryable).toBe(false);
        expect(result.suggestions).toContain('Check command syntax and format');
      });

      it('should categorize command blocked errors correctly', () => {
        const result = ShellErrorCategorizer.categorizeError(
          new Error('command blocked'),
          403,
          '',
          'command blocked by security policy',
          'dangerous_command',
          '/workspace',
          50
        );

        expect(result.errorType).toBe(ShellErrorType.COMMAND_BLOCKED);
        expect(result.retryable).toBe(false);
        expect(result.suggestions).toContain('Review the command for security risks');
      });

      it('should categorize workspace violations correctly', () => {
        const result = ShellErrorCategorizer.categorizeError(
          new Error('workspace violation'),
          403,
          '',
          'workspace boundary violation',
          'access_outside_workspace',
          '/workspace',
          200
        );

        expect(result.errorType).toBe(ShellErrorType.WORKSPACE_VIOLATION);
        expect(result.retryable).toBe(false);
        expect(result.suggestions).toContain('Operations must be performed within the workspace directory');
      });

      it('should categorize configuration errors correctly', () => {
        const result = ShellErrorCategorizer.categorizeError(
          new Error('configuration error'),
          400,
          '',
          'invalid configuration detected',
          'config_command',
          '/workspace',
          100
        );

        expect(result.errorType).toBe(ShellErrorType.CONFIGURATION_ERROR);
        expect(result.retryable).toBe(false);
        expect(result.suggestions).toContain('Check configuration files');
      });

      it('should categorize general execution errors correctly', () => {
        const result = ShellErrorCategorizer.categorizeError(
          new Error('general error'),
          1,
          '',
          'command failed with error',
          'failing_command',
          '/workspace',
          500
        );

        expect(result.errorType).toBe(ShellErrorType.EXECUTION_ERROR);
        expect(result.retryable).toBe(true);
        expect(result.suggestions).toContain('Check the command output for specific error details');
      });

      it('should default to unknown error when no patterns match', () => {
        const result = ShellErrorCategorizer.categorizeError(
          new Error('mysterious error'),
          255,
          '',
          'something went wrong',
          'unknown_command',
          '/workspace',
          1000
        );

        expect(result.errorType).toBe(ShellErrorType.UNKNOWN_ERROR);
        expect(result.retryable).toBe(false);
        expect(result.suggestions).toContain('Check the command output for specific error details');
      });
    });

    describe('Error Instance Creation', () => {
      it('should create appropriate error instances', () => {
        const testCases = [
          {
            error: new Error('permission denied'),
            exitCode: 126,
            stderr: 'permission denied',
            expectedType: ShellPermissionError,
          },
          {
            error: new Error('command not found'),
            exitCode: 127,
            stderr: 'command not found',
            expectedType: ShellCommandNotFoundError,
          },
          {
            error: new Error('timeout'),
            exitCode: -1,
            stderr: 'operation timed out',
            expectedType: ShellTimeoutError,
          },
          {
            error: new Error('path traversal'),
            exitCode: 403,
            stderr: 'path traversal detected',
            expectedType: ShellPathTraversalError,
          },
          {
            error: new Error('invalid input'),
            exitCode: 400,
            stderr: 'invalid command',
            expectedType: ShellInputValidationError,
          },
          {
            error: new Error('command blocked'),
            exitCode: 403,
            stderr: 'command blocked',
            expectedType: ShellCommandBlockedError,
          },
          {
            error: new Error('workspace violation'),
            exitCode: 403,
            stderr: 'workspace violation',
            expectedType: ShellWorkspaceViolationError,
          },
          {
            error: new Error('configuration error'),
            exitCode: 400,
            stderr: 'config error',
            expectedType: ShellConfigurationError,
          },
          {
            error: new Error('unknown error'),
            exitCode: 255,
            stderr: 'something went wrong',
            expectedType: ShellUnknownError,
          },
        ];

        testCases.forEach(({ error, exitCode, stderr, expectedType }) => {
          const categorizedError = ShellErrorCategorizer.createCategorizedError(
            error,
            exitCode,
            '',
            stderr,
            'test-command',
            '/workspace',
            1000
          );

          expect(categorizedError).toBeInstanceOf(expectedType);
        });
      });
    });

    describe('Command Metadata Extraction', () => {
      it('should extract development command metadata', () => {
        const commands = [
          'npm install',
          'yarn build',
          'python script.py',
          'node index.js',
          'cargo build',
        ];

        commands.forEach(command => {
          const metadata = ShellErrorCategorizer.extractCommandMetadata(command);
          expect(metadata.category).toBe('development');
          expect(metadata.tags).toContain('development');
        });
      });

      it('should extract git command metadata', () => {
        const gitCommands = ['git clone', 'git push', 'git pull'];

        gitCommands.forEach(command => {
          const metadata = ShellErrorCategorizer.extractCommandMetadata(command);
          expect(metadata.category).toBe('version-control');
          expect(metadata.tags).toContain('git');
          expect(metadata.tags).toContain('version-control');
        });
      });

      it('should extract docker command metadata', () => {
        const dockerCommands = ['docker build', 'docker-compose up'];

        dockerCommands.forEach(command => {
          const metadata = ShellErrorCategorizer.extractCommandMetadata(command);
          expect(metadata.category).toBe('containerization');
          expect(metadata.tags).toContain('docker');
          expect(metadata.tags).toContain('container');
        });
      });

      it('should extract file system command metadata', () => {
        const readCommands = ['ls -la', 'cat file.txt', 'find . -name "*.txt"'];
        const writeCommands = ['cp file1 file2', 'mv old new', 'rm file'];

        readCommands.forEach(command => {
          const metadata = ShellErrorCategorizer.extractCommandMetadata(command);
          expect(metadata.category).toBe('file-system');
          expect(metadata.tags).toContain('read-only');
        });

        writeCommands.forEach(command => {
          const metadata = ShellErrorCategorizer.extractCommandMetadata(command);
          expect(metadata.category).toBe('file-operations');
          expect(metadata.tags).toContain('write');
        });
      });

      it('should extract network command metadata', () => {
        const networkCommands = ['curl http://example.com', 'wget file.zip', 'ssh user@host'];

        networkCommands.forEach(command => {
          const metadata = ShellErrorCategorizer.extractCommandMetadata(command);
          expect(metadata.category).toBe('network');
          expect(metadata.tags).toContain('network');
        });
      });

      it('should extract file operations', () => {
        const command = 'cp source.txt dest.txt && mv old.txt new.txt';
        const metadata = ShellErrorCategorizer.extractCommandMetadata(command);
        
        expect(metadata.fileOperations.length).toBeGreaterThan(0);
        expect(metadata.fileOperations.some(op => op.includes('cp'))).toBe(true);
        expect(metadata.fileOperations.some(op => op.includes('mv'))).toBe(true);
      });

      it('should extract network operations', () => {
        const command = 'curl http://api.example.com && wget https://file.zip';
        const metadata = ShellErrorCategorizer.extractCommandMetadata(command);
        
        expect(metadata.networkOperations.length).toBeGreaterThan(0);
        expect(metadata.networkOperations.some(op => op.includes('curl'))).toBe(true);
        expect(metadata.networkOperations.some(op => op.includes('wget'))).toBe(true);
      });

      it('should extract environment variables', () => {
        const command = 'echo $HOME && export PATH=$PATH:$HOME/bin';
        const metadata = ShellErrorCategorizer.extractCommandMetadata(command);
        
        expect(metadata.environmentVariables).toContain('HOME');
        expect(metadata.environmentVariables).toContain('PATH');
      });

      it('should handle unknown commands', () => {
        const metadata = ShellErrorCategorizer.extractCommandMetadata('unknown_command --flag');
        expect(metadata.category).toBe('general');
        expect(metadata.tags).toHaveLength(0);
      });
    });

    describe('Error Enhancement', () => {
      it('should enhance suggestions based on context', () => {
        const contextWith127 = { ...mockContext, exitCode: 127 };
        const contextWith126 = { ...mockContext, exitCode: 126 };
        const contextLongRunning = { ...mockContext, executionTime: 35000 };
        const contextNpm = { ...mockContext, command: 'npm install' };
        const contextGit = { ...mockContext, command: 'git push' };

        const result127 = ShellErrorCategorizer.categorizeError(
          new Error('command not found'),
          127,
          '',
          'command not found',
          'missing_command',
          '/workspace',
          1000
        );

        const result126 = ShellErrorCategorizer.categorizeError(
          new Error('permission denied'),
          126,
          '',
          'permission denied',
          'restricted_file',
          '/workspace',
          1000
        );

        const resultLongRunning = ShellErrorCategorizer.categorizeError(
          new Error('operation timed out'),
          -1,
          '',
          'timeout',
          'long_command',
          '/workspace',
          35000
        );

        const resultNpm = ShellErrorCategorizer.categorizeError(
          new Error('npm error'),
          1,
          '',
          'npm error',
          'npm install',
          '/workspace',
          1000
        );

        const resultGit = ShellErrorCategorizer.categorizeError(
          new Error('git error'),
          1,
          '',
          'git error',
          'git push',
          '/workspace',
          1000
        );

        expect(result127.suggestions.some(s => s.includes('installed in your system'))).toBe(true);
        expect(result126.suggestions.some(s => s.includes('executable permissions'))).toBe(true);
        expect(resultLongRunning.suggestions.some(s => s.includes('longer timeout'))).toBe(true);
        expect(resultNpm.suggestions.some(s => s.includes('--verbose'))).toBe(true);
        expect(resultGit.suggestions.some(s => s.includes('git repository'))).toBe(true);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complex error scenarios', () => {
      const complexError = new Error('Permission denied: cannot access /etc/passwd');
      const categorizedError = ShellErrorCategorizer.createCategorizedError(
        complexError,
        126,
        '',
        'permission denied: /etc/passwd',
        'cat /etc/passwd',
        '/workspace',
        1000
      );

      expect(categorizedError).toBeInstanceOf(ShellPermissionError);
      expect(categorizedError.message).toContain('Permission denied');
      expect(categorizedError.context.command).toBe('cat /etc/passwd');
      expect(categorizedError.getSeverity()).toBe('high');
      expect(categorizedError.isRetryable()).toBe(false);
    });

    it('should handle error chains and cause tracking', () => {
      const originalError = new Error('Original system error');
      const categorizedError = ShellErrorCategorizer.createCategorizedError(
        originalError,
        126,
        '',
        'permission denied',
        'restricted_command',
        '/workspace',
        1000,
        originalError
      );

      expect(categorizedError.cause).toBe(originalError);
      expect(categorizedError.context.originalError).toBe(originalError);
    });

    it('should maintain context through error categorization', () => {
      const testContext = {
        command: 'complex_command --with-args',
        workingDirectory: '/specific/workspace',
        exitCode: 1,
        executionTime: 5000,
        timestamp: new Date('2023-01-01T00:00:00Z'),
        timeout: 30,
        userId: 'test-user',
      };

      const categorizedError = ShellErrorCategorizer.createCategorizedError(
        new Error('general error'),
        1,
        'stdout content',
        'stderr content',
        testContext.command,
        testContext.workingDirectory,
        testContext.executionTime
      );

      expect(categorizedError.context.command).toBe(testContext.command);
      expect(categorizedError.context.workingDirectory).toBe(testContext.workingDirectory);
      expect(categorizedError.context.executionTime).toBe(testContext.executionTime);
      expect(categorizedError.context.exitCode).toBe(1);
    });
  });
});