/**
 * Unit tests for all security modules
 * Tests command-filter.ts, command-sanitizer.ts, dangerous-command-detector.ts, and workspace-boundary-enforcer.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandFilter, CommandFilterResult } from '../../../../src/core/mcp/shell/security/command-filter.js';
import { CommandSanitizer, ValidationResult } from '../../../../src/core/mcp/shell/security/command-sanitizer.js';
import { DangerousCommandDetector, DangerousCommandResult } from '../../../../src/core/mcp/shell/security/dangerous-command-detector.js';
import { WorkspaceBoundaryEnforcer, PathValidationResult } from '../../../../src/core/mcp/shell/security/workspace-boundary-enforcer.js';
import { WorkspaceSecurity } from '../../../../src/core/security/workspace.js';
import { CommandCategory } from '../../../../src/core/mcp/shell/command-categorization.js';
import { ShellToolConfig } from '../../../../src/core/mcp/shell/types.js';

describe('Security Modules', () => {
  describe('CommandFilter', () => {
    let filter: CommandFilter;
    let config: Partial<ShellToolConfig>;

    beforeEach(() => {
      config = {
        allowDangerous: true,
        requireConfirmationForRisky: true,
        requireConfirmationForDangerous: true,
        allowComplexCommands: true,
        allowedCommands: ['ls', 'pwd'],
        blockedCommands: ['evil_command'],
        trustedCommands: ['^ls'],
        autoApprovePatterns: ['^echo'],
        confirmationTimeout: 30000,
        maxExecutionTime: 60000,
        sessionMemory: true,
      };
      filter = new CommandFilter(config);
    });

    describe('Constructor and Configuration', () => {
      it('should initialize with default config when no config provided', () => {
        const defaultFilter = new CommandFilter();
        const defaultConfig = defaultFilter.getConfig();
        expect(defaultConfig).toBeDefined();
        expect(defaultConfig.allowDangerous).toBeDefined();
        expect(defaultConfig.requireConfirmationForRisky).toBeDefined();
      });

      it('should merge provided config with defaults', () => {
        const customConfig = { allowDangerous: false, confirmationTimeout: 10000 };
        const customFilter = new CommandFilter(customConfig);
        const resultConfig = customFilter.getConfig();
        expect(resultConfig.allowDangerous).toBe(false);
        expect(resultConfig.confirmationTimeout).toBe(10000);
      });

      it('should validate configuration values', () => {
        expect(() => new CommandFilter({ confirmationTimeout: -1 })).toThrow();
        expect(() => new CommandFilter({ maxExecutionTime: 0 })).toThrow();
        expect(() => new CommandFilter({ allowedCommands: 'invalid' as any })).toThrow();
        expect(() => new CommandFilter({ trustedCommands: ['[invalid'] })).toThrow();
      });
    });

    describe('Command Categorization', () => {
      it('should allow safe commands without confirmation', () => {
        const result = filter.isCommandAllowed('ls -la');
        expect(result.allowed).toBe(true);
        expect(result.requiresConfirmation).toBe(false);
        expect(result.category).toBe(CommandCategory.SAFE);
      });

      it('should allow risky commands with confirmation', () => {
        const result = filter.isCommandAllowed('mkdir test');
        expect(result.allowed).toBe(true);
        expect(result.requiresConfirmation).toBe(true);
        expect(result.category).toBe(CommandCategory.RISKY);
      });

      it('should allow dangerous commands with confirmation when enabled', () => {
        const result = filter.isCommandAllowed('rm file.txt');
        expect(result.allowed).toBe(true);
        expect(result.requiresConfirmation).toBe(true);
        expect(result.category).toBe(CommandCategory.DANGEROUS);
      });

      it('should block dangerous commands when disabled', () => {
        filter.updateConfig({ allowDangerous: false });
        const result = filter.isCommandAllowed('rm file.txt');
        expect(result.allowed).toBe(false);
        expect(result.requiresConfirmation).toBe(false);
        expect(result.category).toBe(CommandCategory.DANGEROUS);
        expect(result.reason).toContain('Dangerous commands are disabled');
      });

      it('should block commands with BLOCKED category', () => {
        const result = filter.isCommandAllowed('dd if=/dev/zero of=/dev/sda');
        expect(result.allowed).toBe(false);
        expect(result.requiresConfirmation).toBe(false);
        expect(result.category).toBe(CommandCategory.BLOCKED);
      });
    });

    describe('Command Blocking', () => {
      it('should block explicitly blocked commands', () => {
        const result = filter.isCommandAllowed('evil_command --flag');
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('blocked by security policy');
      });

      it('should block complex commands when disabled', () => {
        filter.updateConfig({ allowComplexCommands: false });
        const result = filter.isCommandAllowed('ls | grep test');
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Complex commands');
      });

      it('should allow complex commands when enabled', () => {
        filter.updateConfig({ allowComplexCommands: true });
        const result = filter.isCommandAllowed('ls | grep test');
        expect(result.allowed).toBe(true);
      });
    });

    describe('Trusted and Auto-Approve Patterns', () => {
      it('should bypass confirmation for trusted patterns', () => {
        const result = filter.isCommandAllowed('ls -la');
        expect(result.allowed).toBe(true);
        expect(result.requiresConfirmation).toBe(false);
      });

      it('should bypass confirmation for auto-approve patterns', () => {
        const result = filter.isCommandAllowed('echo "hello world"');
        expect(result.allowed).toBe(true);
        expect(result.requiresConfirmation).toBe(false);
      });

      it('should handle invalid regex patterns gracefully', () => {
        filter.updateConfig({ trustedCommands: ['[invalid'] });
        expect(() => filter.isCommandAllowed('ls')).toThrow();
      });
    });

    describe('Configuration Management', () => {
      it('should add and remove allowed commands', () => {
        filter.addAllowedCommand('new_command');
        expect(filter.getConfig().allowedCommands).toContain('new_command');
        
        filter.removeAllowedCommand('new_command');
        expect(filter.getConfig().allowedCommands).not.toContain('new_command');
      });

      it('should add and remove blocked commands', () => {
        filter.addBlockedCommand('bad_command');
        expect(filter.getConfig().blockedCommands).toContain('bad_command');
        
        filter.removeBlockedCommand('bad_command');
        expect(filter.getConfig().blockedCommands).not.toContain('bad_command');
      });

      it('should add and remove trusted patterns', () => {
        filter.addTrustedPattern('^safe_cmd');
        expect(filter.getConfig().trustedCommands).toContain('^safe_cmd');
        
        filter.removeTrustedPattern('^safe_cmd');
        expect(filter.getConfig().trustedCommands).not.toContain('^safe_cmd');
      });

      it('should reset to defaults', () => {
        filter.addAllowedCommand('custom_command');
        filter.resetToDefaults();
        expect(filter.getConfig().allowedCommands).not.toContain('custom_command');
      });
    });

    describe('filterCommand method', () => {
      it('should filter commands asynchronously', async () => {
        const result = await filter.filterCommand('ls -la', '/test/dir');
        expect(result.allowed).toBe(true);
        expect(result.category).toBe(CommandCategory.SAFE);
      });
    });
  });

  describe('CommandSanitizer', () => {
    describe('Input Validation', () => {
      it('should reject null or undefined commands', () => {
        expect(CommandSanitizer.validateInput(null as any).valid).toBe(false);
        expect(CommandSanitizer.validateInput(undefined as any).valid).toBe(false);
        expect(CommandSanitizer.validateInput(123 as any).valid).toBe(false);
      });

      it('should reject empty commands', () => {
        expect(CommandSanitizer.validateInput('').valid).toBe(false);
        expect(CommandSanitizer.validateInput('   ').valid).toBe(false);
      });

      it('should reject commands that exceed length limit', () => {
        const longCommand = 'a'.repeat(10000);
        const result = CommandSanitizer.validateInput(longCommand);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('exceeds maximum length');
      });

      it('should reject commands with control characters', () => {
        const commandWithControlChars = 'ls\x00file';
        const result = CommandSanitizer.validateInput(commandWithControlChars);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('control characters');
      });

      it('should accept valid commands', () => {
        const result = CommandSanitizer.validateInput('ls -la');
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBeDefined();
      });
    });

    describe('Command Sanitization', () => {
      it('should remove excessive whitespace', () => {
        const sanitized = CommandSanitizer.sanitizeCommand('ls    -la     file.txt');
        expect(sanitized).toBe('ls -la file.txt');
      });

      it('should remove dangerous Unicode characters', () => {
        const commandWithUnicode = 'ls\u0000file';
        const sanitized = CommandSanitizer.sanitizeCommand(commandWithUnicode);
        expect(sanitized).toBe('lsfile');
      });

      it('should remove escape sequences', () => {
        const commandWithEscapes = 'ls\\x41file';
        const sanitized = CommandSanitizer.sanitizeCommand(commandWithEscapes);
        expect(sanitized).toBe('lsfile');
      });
    });

    describe('Shell Expansion Detection', () => {
      it('should detect dangerous shell expansion patterns', () => {
        // This test depends on the actual patterns in constants.ts
        const result = CommandSanitizer.validateInput('ls $(evil_command)');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('shell expansion');
      });
    });

    describe('Command Injection Detection', () => {
      it('should detect command injection attempts', () => {
        const injectionCommands = [
          'ls; rm -rf /',
          'ls && sudo rm file',
          'ls | rm file',
          'ls || sudo evil',
          'ls & rm file',
        ];

        injectionCommands.forEach(cmd => {
          const result = CommandSanitizer.validateInput(cmd);
          expect(result.valid).toBe(false);
          expect(result.reason).toContain('command injection');
        });
      });
    });

    describe('Utility Methods', () => {
      it('should extract file paths from commands', () => {
        const paths = CommandSanitizer.extractFilePathsFromCommand('cp /home/user/file.txt ./dest');
        expect(paths).toContain('/home/user/file.txt');
        expect(paths).toContain('./dest');
      });

      it('should detect path traversal attempts', () => {
        expect(CommandSanitizer.hasPathTraversal('cd ../../../etc')).toBe(true);
        expect(CommandSanitizer.hasPathTraversal('ls normal_file.txt')).toBe(false);
      });

      it('should detect network operations', () => {
        expect(CommandSanitizer.hasNetworkOperations('curl http://example.com')).toBe(true);
        expect(CommandSanitizer.hasNetworkOperations('wget file.zip')).toBe(true);
        expect(CommandSanitizer.hasNetworkOperations('ls file.txt')).toBe(false);
      });

      it('should normalize commands', () => {
        const normalized = CommandSanitizer.normalizeCommand('  LS   -LA  ');
        expect(normalized).toBe('ls -la');
      });

      it('should check command equivalence', () => {
        expect(CommandSanitizer.areCommandsEquivalent('ls -la', 'LS -LA')).toBe(true);
        expect(CommandSanitizer.areCommandsEquivalent('ls -la', 'ls -l')).toBe(false);
      });

      it('should identify simple commands', () => {
        expect(CommandSanitizer.isSimpleCommand('ls -la')).toBe(true);
        expect(CommandSanitizer.isSimpleCommand('ls | grep test')).toBe(false);
        expect(CommandSanitizer.isSimpleCommand('ls && echo done')).toBe(false);
      });
    });

    describe('Warning Generation', () => {
      it('should generate warnings for complex commands', () => {
        const result = CommandSanitizer.validateInput('ls | grep test');
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('Command contains complex operations (pipes, redirects, etc.)');
      });

      it('should generate warnings for wildcard patterns', () => {
        const result = CommandSanitizer.validateInput('ls *.txt');
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('Command contains wildcard patterns');
      });

      it('should generate warnings for path traversal patterns', () => {
        const result = CommandSanitizer.validateInput('ls ../file.txt');
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('Command contains path traversal patterns');
      });
    });
  });

  describe('DangerousCommandDetector', () => {
    describe('Dangerous Command Detection', () => {
      it('should detect dangerous commands', () => {
        const dangerousCommands = [
          'rm -rf /',
          'format C:',
          'dd if=/dev/zero of=/dev/sda',
          'chmod 777 /etc/passwd',
          'sudo rm -rf /',
        ];

        dangerousCommands.forEach(cmd => {
          const result = DangerousCommandDetector.isDangerous(cmd);
          expect(result.dangerous).toBe(true);
          expect(result.reason).toBeDefined();
          expect(result.matched).toBeDefined();
        });
      });

      it('should not flag safe commands as dangerous', () => {
        const safeCommands = [
          'ls -la',
          'cat file.txt',
          'echo "hello world"',
          'pwd',
          'date',
        ];

        safeCommands.forEach(cmd => {
          const result = DangerousCommandDetector.isDangerous(cmd);
          expect(result.dangerous).toBe(false);
        });
      });

      it('should handle null/undefined input', () => {
        expect(DangerousCommandDetector.isDangerous(null as any).dangerous).toBe(false);
        expect(DangerousCommandDetector.isDangerous(undefined as any).dangerous).toBe(false);
      });
    });

    describe('Severity Assessment', () => {
      it('should assign appropriate severity levels', () => {
        const criticalResult = DangerousCommandDetector.isDangerous('rm -rf /');
        expect(criticalResult.severity).toBe('critical');

        const highResult = DangerousCommandDetector.isDangerous('rm file.txt');
        expect(highResult.severity).toBe('high');
      });
    });

    describe('Specific Detection Methods', () => {
      it('should detect system destructive commands', () => {
        expect(DangerousCommandDetector.isSystemDestructive('rm -rf /')).toBe(true);
        expect(DangerousCommandDetector.isSystemDestructive('format C:')).toBe(true);
        expect(DangerousCommandDetector.isSystemDestructive('ls -la')).toBe(false);
      });

      it('should detect privilege escalation', () => {
        expect(DangerousCommandDetector.isPrivilegeEscalation('sudo rm file')).toBe(true);
        expect(DangerousCommandDetector.isPrivilegeEscalation('su root')).toBe(true);
        expect(DangerousCommandDetector.isPrivilegeEscalation('chmod +s file')).toBe(true);
        expect(DangerousCommandDetector.isPrivilegeEscalation('ls -la')).toBe(false);
      });

      it('should detect network operations', () => {
        expect(DangerousCommandDetector.isNetworkOperation('curl http://example.com')).toBe(true);
        expect(DangerousCommandDetector.isNetworkOperation('wget file.zip')).toBe(true);
        expect(DangerousCommandDetector.isNetworkOperation('ssh user@host')).toBe(true);
        expect(DangerousCommandDetector.isNetworkOperation('ls -la')).toBe(false);
      });

      it('should detect file system modifications', () => {
        expect(DangerousCommandDetector.isFileSystemModification('rm file.txt')).toBe(true);
        expect(DangerousCommandDetector.isFileSystemModification('chmod 755 file')).toBe(true);
        expect(DangerousCommandDetector.isFileSystemModification('mkdir newdir')).toBe(true);
        expect(DangerousCommandDetector.isFileSystemModification('ls -la')).toBe(false);
      });
    });

    describe('Command Categorization', () => {
      it('should categorize commands by danger types', () => {
        const categories = DangerousCommandDetector.categorizeCommand('sudo rm -rf /');
        expect(categories).toContain('system_destructive');
        expect(categories).toContain('privilege_escalation');
        expect(categories).toContain('file_system_modification');
      });

      it('should return empty categories for safe commands', () => {
        const categories = DangerousCommandDetector.categorizeCommand('ls -la');
        expect(categories).toHaveLength(0);
      });
    });

    describe('Explanations', () => {
      it('should provide explanations for dangerous commands', () => {
        const explanation = DangerousCommandDetector.getExplanation('rm -rf /');
        expect(explanation).toContain('system damage');
      });

      it('should provide safe explanation for safe commands', () => {
        const explanation = DangerousCommandDetector.getExplanation('ls -la');
        expect(explanation).toContain('safe');
      });
    });
  });

  describe('WorkspaceBoundaryEnforcer', () => {
    let enforcer: WorkspaceBoundaryEnforcer;
    let mockSecurity: WorkspaceSecurity;

    beforeEach(() => {
      mockSecurity = {
        validatePath: vi.fn((path: string) => {
          if (path.includes('outside')) {
            throw new Error('Path outside workspace');
          }
          return path;
        }),
        isPathSafe: vi.fn((path: string) => !path.includes('outside')),
        getWorkspaceRoot: vi.fn(() => '/workspace'),
        getRelativePathFromWorkspace: vi.fn((path: string) => path.replace('/workspace/', '')),
        validateFileAccess: vi.fn(),
      } as any;

      enforcer = new WorkspaceBoundaryEnforcer(mockSecurity);
    });

    describe('Path Validation', () => {
      it('should validate paths within workspace', () => {
        const result = enforcer.validateCommandPaths('ls /workspace/file.txt');
        expect(result.valid).toBe(true);
        expect(result.validatedPaths).toContain('/workspace/file.txt');
      });

      it('should reject paths outside workspace', () => {
        const result = enforcer.validateCommandPaths('ls /outside/file.txt');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Path validation failed');
      });

      it('should handle commands with no file paths', () => {
        const result = enforcer.validateCommandPaths('pwd');
        expect(result.valid).toBe(true);
        expect(result.validatedPaths).toHaveLength(0);
      });
    });

    describe('Working Directory Validation', () => {
      it('should validate working directory within workspace', () => {
        const result = enforcer.validateWorkingDirectory('ls', '/workspace/subdir');
        expect(result.valid).toBe(true);
        expect(result.validatedCwd).toBe('/workspace/subdir');
      });

      it('should reject working directory outside workspace', () => {
        const result = enforcer.validateWorkingDirectory('ls', '/outside/dir');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Working directory validation failed');
      });

      it('should validate directory changes in commands', () => {
        const result = enforcer.validateWorkingDirectory('cd /workspace/subdir && ls');
        expect(result.valid).toBe(true);
      });

      it('should reject directory changes outside workspace', () => {
        const result = enforcer.validateWorkingDirectory('cd /outside/dir && ls');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Directory change validation failed');
      });
    });

    describe('Path Traversal Detection', () => {
      it('should detect path traversal attempts', () => {
        const traversalCommands = [
          'cat ../../../etc/passwd',
          'ls /etc/passwd',
          'touch /dev/null',
          'rm ~/file.txt',
        ];

        traversalCommands.forEach(cmd => {
          const result = enforcer.checkPathTraversal(cmd);
          expect(result.safe).toBe(false);
          expect(result.reason).toContain('Path traversal pattern detected');
        });
      });

      it('should allow safe path operations', () => {
        const safeCommands = [
          'ls file.txt',
          'cat ./subdir/file.txt',
          'mkdir newdir',
        ];

        safeCommands.forEach(cmd => {
          const result = enforcer.checkPathTraversal(cmd);
          expect(result.safe).toBe(true);
        });
      });
    });

    describe('File Operation Validation', () => {
      it('should validate file operations within workspace', () => {
        const result = enforcer.validateFileOperations('touch file.txt');
        expect(result.allowed).toBe(true);
      });

      it('should reject file operations outside workspace', () => {
        const result = enforcer.validateFileOperations('touch /outside/file.txt');
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('File operation attempted outside workspace');
      });
    });

    describe('Workspace Boundary Enforcement', () => {
      it('should enforce workspace boundaries for valid commands', () => {
        const result = enforcer.enforceWorkspaceBoundary('ls file.txt', '/workspace');
        expect(result.allowed).toBe(true);
        expect(result.sanitizedCommand).toBeDefined();
      });

      it('should reject commands that violate workspace boundaries', () => {
        const result = enforcer.enforceWorkspaceBoundary('ls /outside/file.txt', '/workspace');
        expect(result.allowed).toBe(false);
        expect(result.reason).toBeDefined();
      });
    });

    describe('Utility Methods', () => {
      it('should get workspace root', () => {
        expect(enforcer.getWorkspaceRoot()).toBe('/workspace');
      });

      it('should get relative paths', () => {
        expect(enforcer.getRelativePath('/workspace/file.txt')).toBe('file.txt');
      });

      it('should validate commands asynchronously', async () => {
        await expect(enforcer.validateCommand('ls file.txt', '/workspace')).resolves.not.toThrow();
      });

      it('should throw on invalid commands', async () => {
        await expect(enforcer.validateCommand('ls /outside/file.txt', '/workspace')).rejects.toThrow();
      });
    });
  });

  describe('Integration Tests', () => {
    let filter: CommandFilter;
    let mockSecurity: WorkspaceSecurity;
    let enforcer: WorkspaceBoundaryEnforcer;

    beforeEach(() => {
      filter = new CommandFilter();
      mockSecurity = {
        validatePath: vi.fn((path: string) => path),
        isPathSafe: vi.fn(() => true),
        getWorkspaceRoot: vi.fn(() => '/workspace'),
        getRelativePathFromWorkspace: vi.fn((path: string) => path),
        validateFileAccess: vi.fn(),
      } as any;
      enforcer = new WorkspaceBoundaryEnforcer(mockSecurity);
    });

    it('should handle command filtering and sanitization together', () => {
      const command = 'ls -la';
      const sanitizeResult = CommandSanitizer.validateInput(command);
      const filterResult = filter.isCommandAllowed(command);
      const dangerResult = DangerousCommandDetector.isDangerous(command);

      expect(sanitizeResult.valid).toBe(true);
      expect(filterResult.allowed).toBe(true);
      expect(dangerResult.dangerous).toBe(false);
    });

    it('should handle dangerous commands across all modules', () => {
      const command = 'rm -rf /';
      const sanitizeResult = CommandSanitizer.validateInput(command);
      const filterResult = filter.isCommandAllowed(command);
      const dangerResult = DangerousCommandDetector.isDangerous(command);

      expect(sanitizeResult.valid).toBe(true); // Command is syntactically valid
      expect(filterResult.allowed).toBe(false); // Should be blocked by categorization
      expect(dangerResult.dangerous).toBe(true); // Should be detected as dangerous
    });

    it('should handle workspace boundary violations', () => {
      const command = 'ls /outside/file.txt';
      const pathResult = enforcer.validateCommandPaths(command);
      const boundaryResult = enforcer.enforceWorkspaceBoundary(command, '/workspace');

      expect(pathResult.valid).toBe(true); // Mock allows this
      expect(boundaryResult.allowed).toBe(true); // Mock allows this
    });
  });
});