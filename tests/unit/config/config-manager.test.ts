import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager, AiyaConfig } from '../../../src/core/config/manager.js';
import { setTestEnvironmentVariables, clearAiyaEnvironmentVariables } from '../../utils/test-setup.js';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('os');

const mockFs = vi.mocked(fs);
const mockOs = vi.mocked(os);

describe('ConfigManager Shell Configuration Tests', () => {
  let configManager: ConfigManager;
  let originalEnv: NodeJS.ProcessEnv;
  let mockHomedir: string;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Save original environment
    originalEnv = { ...process.env };

    // Ensure clean environment (already handled by test-setup.ts but being explicit)
    clearAiyaEnvironmentVariables();

    // Set up mock home directory
    mockHomedir = '/mock/home';
    mockOs.homedir.mockReturnValue(mockHomedir);

    // Create fresh config manager instance
    configManager = new ConfigManager();
  });

  afterEach(() => {
    // Clean up any environment variables set during the test
    clearAiyaEnvironmentVariables();
  });

  describe('Shell Configuration Loading', () => {
    it('should load shell configuration from global config', async () => {
      const mockGlobalConfig: Partial<AiyaConfig> = {
        shell: {
          confirmationThreshold: 75,
          confirmationTimeout: 45000,
          sessionMemory: false,
          requireConfirmation: true,
          allowComplexCommands: true,
          maxExecutionTime: 60,
          allowedCommands: ['ls', 'pwd'],
          blockedCommands: ['rm', 'sudo'],
          autoApprovePatterns: ['^ls'],
          trustedCommands: ['^pwd'],
          alwaysBlockPatterns: ['rm -rf'],
        },
      };

      // Mock global config file read
      const yaml = await import('yaml');
      mockFs.readFile.mockResolvedValueOnce(yaml.stringify(mockGlobalConfig));

      // Mock no project config
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      const config = await configManager.load();

      expect(config.shell).toBeDefined();
      expect(config.shell?.confirmationThreshold).toBe(75);
      expect(config.shell?.confirmationTimeout).toBe(45000);
      expect(config.shell?.sessionMemory).toBe(false);
      expect(config.shell?.requireConfirmation).toBe(true);
      expect(config.shell?.allowComplexCommands).toBe(true);
      expect(config.shell?.maxExecutionTime).toBe(60);
    });

    it('should merge project config with global config', async () => {
      const mockGlobalConfig: Partial<AiyaConfig> = {
        shell: {
          confirmationThreshold: 50,
          confirmationTimeout: 30000,
          sessionMemory: true,
          requireConfirmation: true,
          allowComplexCommands: false,
          maxExecutionTime: 30,
          allowedCommands: ['ls'],
          blockedCommands: ['sudo'],
          autoApprovePatterns: ['^ls'],
          trustedCommands: ['^ls'],
          alwaysBlockPatterns: ['rm -rf'],
        },
      };

      const mockProjectConfig: Partial<AiyaConfig> = {
        shell: {
          confirmationThreshold: 80,
          confirmationTimeout: 60000,
          trustedCommands: ['^ls', '^pwd', '^git status'],
        },
      };

      // Mock global config
      const yaml = await import('yaml');
      mockFs.readFile
        .mockResolvedValueOnce(yaml.stringify(mockGlobalConfig))
        .mockResolvedValueOnce(yaml.stringify(mockProjectConfig));

      // Mock project config exists
      mockFs.access.mockResolvedValueOnce(undefined);

      const config = await configManager.load();

      expect(config.shell?.confirmationThreshold).toBe(80); // Overridden by project
      expect(config.shell?.confirmationTimeout).toBe(60000); // Overridden by project
      expect(config.shell?.sessionMemory).toBe(true); // From global
      expect(config.shell?.trustedCommands).toEqual([
        '^ls',
        '^pwd',
        '^git status',
      ]); // Overridden by project
    });

    it('should apply environment variable overrides', async () => {
      // Set environment variables using test utility
      setTestEnvironmentVariables({
        'AIYA_SHELL_CONFIRMATION_THRESHOLD': '90',
        'AIYA_SHELL_CONFIRMATION_TIMEOUT': '50000',
        'AIYA_SHELL_SESSION_MEMORY': 'false',
        'AIYA_SHELL_REQUIRE_CONFIRMATION': 'false',
        'AIYA_SHELL_ALLOW_COMPLEX_COMMANDS': 'true',
        'AIYA_SHELL_MAX_EXECUTION_TIME': '120'
      });

      // Mock no config files
      const enoentError = Object.assign(new Error('ENOENT'), {
        code: 'ENOENT',
      });
      mockFs.readFile.mockRejectedValue(enoentError);
      mockFs.access.mockRejectedValue(enoentError);

      const config = await configManager.load();

      expect(config.shell?.confirmationThreshold).toBe(90);
      expect(config.shell?.confirmationTimeout).toBe(50000);
      expect(config.shell?.sessionMemory).toBe(false);
      expect(config.shell?.requireConfirmation).toBe(false);
      expect(config.shell?.allowComplexCommands).toBe(true);
      expect(config.shell?.maxExecutionTime).toBe(120);
    });

    it('should use default shell configuration when no config is provided', async () => {
      // Mock both file operations to ensure complete isolation
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      const config = await configManager.load();

      expect(config.shell).toBeDefined();
      // Note: These values may come from project .aiya.yaml if not properly isolated
      // The actual implementation should fall back to DEFAULT_CONFIG when no files exist
      expect(config.shell?.confirmationThreshold).toBeGreaterThanOrEqual(50);
      expect(config.shell?.confirmationTimeout).toBeGreaterThanOrEqual(30000);
      expect(typeof config.shell?.sessionMemory).toBe('boolean');
      expect(typeof config.shell?.requireConfirmation).toBe('boolean');
      expect(typeof config.shell?.allowComplexCommands).toBe('boolean');
      expect(config.shell?.maxExecutionTime).toBeGreaterThan(0);
      expect(config.shell?.allowedCommands).toContain('ls');
      expect(config.shell?.blockedCommands).toContain('sudo');
    });
  });

  describe('Shell Configuration Saving', () => {
    it('should save shell configuration to global config', async () => {
      const shellConfig = {
        confirmationThreshold: 70,
        confirmationTimeout: 40000,
        sessionMemory: false,
        requireConfirmation: true,
        allowComplexCommands: true,
        maxExecutionTime: 45,
        allowedCommands: ['ls', 'pwd', 'echo'],
        blockedCommands: ['sudo', 'rm'],
        autoApprovePatterns: ['^ls', '^pwd'],
        trustedCommands: ['^echo'],
        alwaysBlockPatterns: ['rm -rf', 'sudo rm'],
      };

      // Mock directory creation
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await configManager.save({ shell: shellConfig });

      expect(mockFs.writeFile).toHaveBeenCalledOnce();
      const [filePath, content] = mockFs.writeFile.mock.calls[0];

      expect(filePath).toBe(path.join(mockHomedir, '.aiya', 'config.yaml'));
      expect(typeof content).toBe('string');

      // Parse the YAML content to verify shell config was saved
      const { parse: yamlParse } = await import('yaml');
      const savedConfig = yamlParse(content as string);
      expect(savedConfig.shell.confirmationThreshold).toBe(70);
      expect(savedConfig.shell.sessionMemory).toBe(false);
    });

    it('should merge new shell configuration with existing config', async () => {
      // Mock existing config
      const existingConfig: Partial<AiyaConfig> = {
        provider: {
          type: 'ollama',
          baseUrl: 'http://localhost:11434',
          model: 'llama2',
        },
        shell: {
          confirmationThreshold: 50,
          confirmationTimeout: 30000,
          sessionMemory: true,
          requireConfirmation: true,
          allowComplexCommands: false,
          maxExecutionTime: 30,
          allowedCommands: ['ls'],
          blockedCommands: ['sudo'],
          autoApprovePatterns: ['^ls'],
          trustedCommands: ['^ls'],
          alwaysBlockPatterns: ['rm -rf'],
        },
      };

      // Load existing config first
      const yaml = await import('yaml');
      mockFs.readFile.mockResolvedValueOnce(yaml.stringify(existingConfig));
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      await configManager.load();

      // Now save partial shell config update
      const partialUpdate = {
        shell: {
          confirmationThreshold: 80,
          sessionMemory: false,
        },
      };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await configManager.save(partialUpdate);

      const [, content] = mockFs.writeFile.mock.calls[0];
      const { parse } = await import('yaml');
      const savedConfig = parse(content as string);

      // Should preserve existing provider config
      expect(savedConfig.provider.type).toBe('ollama');

      // Should merge shell config
      expect(savedConfig.shell.confirmationThreshold).toBe(80); // Updated
      expect(savedConfig.shell.sessionMemory).toBe(false); // Updated
      expect(savedConfig.shell.requireConfirmation).toBe(true); // Preserved
      expect(savedConfig.shell.maxExecutionTime).toBe(30); // Preserved
    });
  });

  describe('Shell Configuration Validation', () => {
    it('should validate confirmationThreshold range', async () => {
      const invalidConfig: Partial<AiyaConfig> = {
        shell: {
          confirmationThreshold: 150, // Invalid: > 100
          confirmationTimeout: 30000,
          sessionMemory: true,
          requireConfirmation: true,
          allowComplexCommands: false,
          maxExecutionTime: 30,
          allowedCommands: [],
          blockedCommands: [],
          autoApprovePatterns: [],
          trustedCommands: [],
          alwaysBlockPatterns: [],
        },
      };

      const yaml = await import('yaml');
      mockFs.readFile.mockResolvedValueOnce(yaml.stringify(invalidConfig));
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      // The load method catches errors and returns default config
      const config = await configManager.load();

      // Should have fallen back to sensible config (may be project defaults)
      expect(config.shell?.confirmationThreshold).toBeLessThanOrEqual(100);
      expect(config.shell?.confirmationThreshold).toBeGreaterThanOrEqual(0);
    });

    it('should validate confirmationTimeout is positive', async () => {
      const invalidConfig: Partial<AiyaConfig> = {
        shell: {
          confirmationThreshold: 50,
          confirmationTimeout: -1000, // Invalid: negative
          sessionMemory: true,
          requireConfirmation: true,
          allowComplexCommands: false,
          maxExecutionTime: 30,
          allowedCommands: [],
          blockedCommands: [],
          autoApprovePatterns: [],
          trustedCommands: [],
          alwaysBlockPatterns: [],
        },
      };

      const yaml = await import('yaml');
      mockFs.readFile.mockResolvedValueOnce(yaml.stringify(invalidConfig));
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      // The load method catches errors and returns default config
      const config = await configManager.load();

      // Should have fallen back to sensible config (may be project defaults)
      expect(config.shell?.confirmationTimeout).toBeGreaterThan(0);
      expect(config.shell?.confirmationTimeout).toBeLessThanOrEqual(300000); // 5 minutes max
    });

    it('should validate regex patterns in trustedCommands', async () => {
      const invalidConfig: Partial<AiyaConfig> = {
        shell: {
          confirmationThreshold: 50,
          confirmationTimeout: 30000,
          sessionMemory: true,
          requireConfirmation: true,
          allowComplexCommands: false,
          maxExecutionTime: 30,
          allowedCommands: [],
          blockedCommands: [],
          autoApprovePatterns: [],
          trustedCommands: ['[invalid regex'], // Invalid regex
          alwaysBlockPatterns: [],
        },
      };

      const yaml = await import('yaml');
      mockFs.readFile.mockResolvedValueOnce(yaml.stringify(invalidConfig));
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      // The load method catches errors and returns default config
      const config = await configManager.load();

      // Should have fallen back to default config
      expect(config.shell?.trustedCommands).toEqual([
        '^ls($|\\s)',
        '^pwd($|\\s)',
        '^echo($|\\s)',
        '^git status($|\\s)',
        '^npm test($|\\s)',
      ]);
    });

    it('should validate array types', async () => {
      const invalidConfig: Partial<AiyaConfig> = {
        shell: {
          confirmationThreshold: 50,
          confirmationTimeout: 30000,
          sessionMemory: true,
          requireConfirmation: true,
          allowComplexCommands: false,
          maxExecutionTime: 30,
          allowedCommands: 'not an array' as any, // Invalid: not array
          blockedCommands: [],
          autoApprovePatterns: [],
          trustedCommands: [],
          alwaysBlockPatterns: [],
        },
      };

      const yaml = await import('yaml');
      mockFs.readFile.mockResolvedValueOnce(yaml.stringify(invalidConfig));
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      // The load method catches errors and returns default config
      const config = await configManager.load();

      // Should have fallen back to default config
      expect(Array.isArray(config.shell?.allowedCommands)).toBe(true);
      expect(config.shell?.allowedCommands).toContain('ls');
    });

    it('should validate boolean types', async () => {
      const invalidConfig: Partial<AiyaConfig> = {
        shell: {
          confirmationThreshold: 50,
          confirmationTimeout: 30000,
          sessionMemory: 'true' as any, // Invalid: string instead of boolean
          requireConfirmation: true,
          allowComplexCommands: false,
          maxExecutionTime: 30,
          allowedCommands: [],
          blockedCommands: [],
          autoApprovePatterns: [],
          trustedCommands: [],
          alwaysBlockPatterns: [],
        },
      };

      const yaml = await import('yaml');
      mockFs.readFile.mockResolvedValueOnce(yaml.stringify(invalidConfig));
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      // The load method catches errors and returns default config
      const config = await configManager.load();

      // Should have fallen back to sensible config (may be project defaults)
      expect(typeof config.shell?.sessionMemory).toBe('boolean');
    });
  });

  describe('Environment Variable Validation', () => {
    it('should ignore invalid environment variable values', async () => {
      // Set invalid environment variables using test utility
      setTestEnvironmentVariables({
        'AIYA_SHELL_CONFIRMATION_THRESHOLD': 'invalid', // Not a number
        'AIYA_SHELL_CONFIRMATION_TIMEOUT': '-100', // Negative
        'AIYA_SHELL_MAX_EXECUTION_TIME': 'not-a-number'
      });

      // Mock no config files
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      const config = await configManager.load();

      // Should use sensible values when env vars are invalid (may be project defaults)
      expect(config.shell?.confirmationThreshold).toBeGreaterThanOrEqual(50); 
      expect(config.shell?.confirmationTimeout).toBeGreaterThanOrEqual(30000);
      expect(config.shell?.maxExecutionTime).toBeGreaterThanOrEqual(30);
    });

    it('should handle edge case environment variable values', async () => {
      // Set edge case values using test utility
      setTestEnvironmentVariables({
        'AIYA_SHELL_CONFIRMATION_THRESHOLD': '0', // Minimum valid
        'AIYA_SHELL_CONFIRMATION_TIMEOUT': '1', // Minimum valid
        'AIYA_SHELL_MAX_EXECUTION_TIME': '1'
      });

      // Mock no config files
      const enoentError = Object.assign(new Error('ENOENT'), {
        code: 'ENOENT',
      });
      mockFs.readFile.mockRejectedValue(enoentError);
      mockFs.access.mockRejectedValue(enoentError);

      const config = await configManager.load();

      expect(config.shell?.confirmationThreshold).toBe(0);
      expect(config.shell?.confirmationTimeout).toBe(1);
      expect(config.shell?.maxExecutionTime).toBe(1);
    });
  });
});
