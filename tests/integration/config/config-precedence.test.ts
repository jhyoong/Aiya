import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager, AiyaConfig } from '../../../src/core/config/manager.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { tmpdir } from 'os';

// Mock dependencies
vi.mock('os');

describe('Configuration Precedence Integration Tests', () => {
  let tempDir: string;
  let globalConfigPath: string;
  let projectConfigPath: string;
  let originalCwd: string;
  let originalEnv: NodeJS.ProcessEnv;
  let originalHomedir: typeof os.homedir;

  beforeEach(async () => {
    // Save original state
    originalCwd = process.cwd();
    originalEnv = { ...process.env };
    originalHomedir = os.homedir;

    // Create temporary directory structure
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'aiya-config-test-'));
    const homeDir = path.join(tempDir, 'home');
    const projectDir = path.join(tempDir, 'project');
    
    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(path.join(homeDir, '.aiya'), { recursive: true });

    globalConfigPath = path.join(homeDir, '.aiya', 'config.yaml');
    projectConfigPath = path.join(projectDir, '.aiya.yaml');

    // Mock os.homedir to return our temp home directory
    vi.mocked(os.homedir).mockReturnValue(homeDir);

    // Change to project directory
    process.cwd = () => projectDir;

    // Clear environment variables
    delete process.env.AIYA_SHELL_CONFIRMATION_THRESHOLD;
    delete process.env.AIYA_SHELL_CONFIRMATION_TIMEOUT;
    delete process.env.AIYA_SHELL_SESSION_MEMORY;
    delete process.env.AIYA_SHELL_REQUIRE_CONFIRMATION;
    delete process.env.AIYA_SHELL_ALLOW_COMPLEX_COMMANDS;
    delete process.env.AIYA_SHELL_MAX_EXECUTION_TIME;
  });

  afterEach(async () => {
    // Restore original state
    process.cwd = () => originalCwd;
    process.env = originalEnv;
    vi.clearAllMocks();

    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Configuration Precedence Order', () => {
    it('should use defaults when no configuration exists', async () => {
      const configManager = new ConfigManager();
      const config = await configManager.load();

      expect(config.shell).toBeDefined();
      expect(config.shell?.confirmationThreshold).toBe(50);
      expect(config.shell?.confirmationTimeout).toBe(30000);
      expect(config.shell?.sessionMemory).toBe(true);
      expect(config.shell?.requireConfirmation).toBe(true);
      expect(config.shell?.allowComplexCommands).toBe(false);
      expect(config.shell?.maxExecutionTime).toBe(30);
    });

    it('should apply global configuration over defaults', async () => {
      const globalConfig: Partial<AiyaConfig> = {
        shell: {
          confirmationThreshold: 75,
          confirmationTimeout: 45000,
          sessionMemory: false,
          requireConfirmation: true,
          allowComplexCommands: true,
          maxExecutionTime: 60,
          allowedCommands: ['ls', 'pwd'],
          blockedCommands: ['sudo', 'rm'],
          autoApprovePatterns: ['^ls'],
          trustedCommands: ['^pwd'],
          alwaysBlockPatterns: ['rm -rf']
        }
      };

      const yaml = await import('yaml');
      await fs.writeFile(globalConfigPath, yaml.stringify(globalConfig));

      const configManager = new ConfigManager();
      const config = await configManager.load();

      expect(config.shell?.confirmationThreshold).toBe(75);
      expect(config.shell?.confirmationTimeout).toBe(45000);
      expect(config.shell?.sessionMemory).toBe(false);
      expect(config.shell?.allowComplexCommands).toBe(true);
      expect(config.shell?.maxExecutionTime).toBe(60);
    });

    it('should apply project configuration over global configuration', async () => {
      const globalConfig: Partial<AiyaConfig> = {
        shell: {
          confirmationThreshold: 75,
          confirmationTimeout: 45000,
          sessionMemory: false,
          requireConfirmation: true,
          allowComplexCommands: true,
          maxExecutionTime: 60,
          allowedCommands: ['ls'],
          blockedCommands: ['sudo'],
          autoApprovePatterns: ['^ls'],
          trustedCommands: ['^ls'],
          alwaysBlockPatterns: ['rm -rf']
        }
      };

      const projectConfig: Partial<AiyaConfig> = {
        shell: {
          confirmationThreshold: 25,
          sessionMemory: true,
          trustedCommands: ['^ls', '^pwd', '^git status'],
          alwaysBlockPatterns: ['rm -rf', 'sudo rm', 'format.*']
        }
      };

      const yaml = await import('yaml');
      await fs.writeFile(globalConfigPath, yaml.stringify(globalConfig));
      await fs.writeFile(projectConfigPath, yaml.stringify(projectConfig));

      const configManager = new ConfigManager();
      const config = await configManager.load();

      // Project config should override global config
      expect(config.shell?.confirmationThreshold).toBe(25); // From project
      expect(config.shell?.sessionMemory).toBe(true); // From project
      expect(config.shell?.trustedCommands).toEqual(['^ls', '^pwd', '^git status']); // From project
      expect(config.shell?.alwaysBlockPatterns).toEqual(['rm -rf', 'sudo rm', 'format.*']); // From project

      // Global config should be preserved for non-overridden fields
      expect(config.shell?.confirmationTimeout).toBe(45000); // From global
      expect(config.shell?.allowComplexCommands).toBe(true); // From global
      expect(config.shell?.maxExecutionTime).toBe(60); // From global
    });

    it('should apply environment variables over all configuration sources', async () => {
      const globalConfig: Partial<AiyaConfig> = {
        shell: {
          confirmationThreshold: 75,
          confirmationTimeout: 45000,
          sessionMemory: false,
          requireConfirmation: true,
          allowComplexCommands: true,
          maxExecutionTime: 60,
          allowedCommands: ['ls'],
          blockedCommands: ['sudo'],
          autoApprovePatterns: ['^ls'],
          trustedCommands: ['^ls'],
          alwaysBlockPatterns: ['rm -rf']
        }
      };

      const projectConfig: Partial<AiyaConfig> = {
        shell: {
          confirmationThreshold: 25,
          sessionMemory: true,
          maxExecutionTime: 45
        }
      };

      // Set environment variables
      process.env.AIYA_SHELL_CONFIRMATION_THRESHOLD = '90';
      process.env.AIYA_SHELL_CONFIRMATION_TIMEOUT = '60000';
      process.env.AIYA_SHELL_SESSION_MEMORY = 'false';
      process.env.AIYA_SHELL_MAX_EXECUTION_TIME = '120';

      const yaml = await import('yaml');
      await fs.writeFile(globalConfigPath, yaml.stringify(globalConfig));
      await fs.writeFile(projectConfigPath, yaml.stringify(projectConfig));

      const configManager = new ConfigManager();
      const config = await configManager.load();

      // Environment variables should override everything
      expect(config.shell?.confirmationThreshold).toBe(90); // From env
      expect(config.shell?.confirmationTimeout).toBe(60000); // From env  
      expect(config.shell?.sessionMemory).toBe(false); // From env
      expect(config.shell?.maxExecutionTime).toBe(120); // From env

      // Non-overridden fields should come from project config
      expect(config.shell?.requireConfirmation).toBe(true); // From global (not in project)
      expect(config.shell?.allowComplexCommands).toBe(true); // From global (not in project)
    });

    it('should handle partial shell configuration in project config', async () => {
      const globalConfig: Partial<AiyaConfig> = {
        provider: {
          type: 'ollama',
          baseUrl: 'http://localhost:11434',
          model: 'llama2'
        },
        shell: {
          confirmationThreshold: 50,
          confirmationTimeout: 30000,
          sessionMemory: true,
          requireConfirmation: true,
          allowComplexCommands: false,
          maxExecutionTime: 30,
          allowedCommands: ['ls', 'pwd', 'echo'],
          blockedCommands: ['sudo', 'rm'],
          autoApprovePatterns: ['^ls', '^pwd'],
          trustedCommands: ['^echo'],
          alwaysBlockPatterns: ['rm -rf']
        }
      };

      // Project config only overrides a few shell fields
      const projectConfig: Partial<AiyaConfig> = {
        shell: {
          confirmationThreshold: 80,
          trustedCommands: ['^ls', '^pwd', '^git status', '^npm test']
        }
      };

      const yaml = await import('yaml');
      await fs.writeFile(globalConfigPath, yaml.stringify(globalConfig));
      await fs.writeFile(projectConfigPath, yaml.stringify(projectConfig));

      const configManager = new ConfigManager();
      const config = await configManager.load();

      // Provider config should be preserved
      expect(config.provider?.type).toBe('ollama');
      expect(config.provider?.model).toBe('llama2');

      // Partial shell overrides
      expect(config.shell?.confirmationThreshold).toBe(80); // From project
      expect(config.shell?.trustedCommands).toEqual(['^ls', '^pwd', '^git status', '^npm test']); // From project

      // Preserved from global
      expect(config.shell?.confirmationTimeout).toBe(30000);
      expect(config.shell?.sessionMemory).toBe(true);
      expect(config.shell?.allowedCommands).toEqual(['ls', 'pwd', 'echo']);
      expect(config.shell?.alwaysBlockPatterns).toEqual(['rm -rf']);
    });

    it('should handle missing shell section in project config', async () => {
      const globalConfig: Partial<AiyaConfig> = {
        shell: {
          confirmationThreshold: 75,
          confirmationTimeout: 45000,
          sessionMemory: false,
          requireConfirmation: true,
          allowComplexCommands: true,
          maxExecutionTime: 60,
          allowedCommands: ['ls'],
          blockedCommands: ['sudo'],
          autoApprovePatterns: ['^ls'],
          trustedCommands: ['^ls'],
          alwaysBlockPatterns: ['rm -rf']
        }
      };

      // Project config with no shell section
      const projectConfig: Partial<AiyaConfig> = {
        ui: {
          streaming: false,
          showTokens: false,
          theme: 'dark' as const,
          thinking: 'brief' as const
        }
      };

      const yaml = await import('yaml');
      await fs.writeFile(globalConfigPath, yaml.stringify(globalConfig));
      await fs.writeFile(projectConfigPath, yaml.stringify(projectConfig));

      const configManager = new ConfigManager();
      const config = await configManager.load();

      // Shell config should come entirely from global
      expect(config.shell?.confirmationThreshold).toBe(75);
      expect(config.shell?.confirmationTimeout).toBe(45000);
      expect(config.shell?.sessionMemory).toBe(false);

      // UI config should be overridden by project
      expect(config.ui?.streaming).toBe(false);
      expect(config.ui?.theme).toBe('dark');
    });
  });

  describe('Configuration Persistence', () => {
    it('should persist shell configuration changes to global config', async () => {
      const configManager = new ConfigManager();
      
      // Load initial config (should be defaults)
      await configManager.load();

      // Save updated shell configuration
      const newShellConfig = {
        shell: {
          confirmationThreshold: 85,
          confirmationTimeout: 50000,
          sessionMemory: false,
          requireConfirmation: true,
          allowComplexCommands: true,
          maxExecutionTime: 90,
          allowedCommands: ['ls', 'pwd', 'git'],
          blockedCommands: ['sudo', 'rm', 'chmod'],
          autoApprovePatterns: ['^ls', '^pwd'],
          trustedCommands: ['^git status'],
          alwaysBlockPatterns: ['rm -rf', 'sudo rm']
        }
      };

      await configManager.save(newShellConfig);

      // Verify the file was written
      const savedContent = await fs.readFile(globalConfigPath, 'utf8');
      expect(savedContent).toBeTruthy();

      // Parse and verify the saved configuration
      const yaml = await import('yaml');
      const parsedConfig = yaml.parse(savedContent);
      
      expect(parsedConfig.shell.confirmationThreshold).toBe(85);
      expect(parsedConfig.shell.confirmationTimeout).toBe(50000);
      expect(parsedConfig.shell.sessionMemory).toBe(false);
      expect(parsedConfig.shell.allowComplexCommands).toBe(true);
      expect(parsedConfig.shell.maxExecutionTime).toBe(90);
      expect(parsedConfig.shell.trustedCommands).toEqual(['^git status']);
    });

    it('should load persisted configuration in new instance', async () => {
      // First instance saves configuration
      const configManager1 = new ConfigManager();
      await configManager1.load();

      const shellConfig = {
        shell: {
          confirmationThreshold: 95,
          sessionMemory: false,
          trustedCommands: ['^ls', '^pwd', '^echo', '^git'],
          alwaysBlockPatterns: ['rm -rf /', 'sudo rm -rf', 'format c:']
        }
      };

      await configManager1.save(shellConfig);

      // Second instance loads the persisted configuration
      const configManager2 = new ConfigManager();
      const config = await configManager2.load();

      expect(config.shell?.confirmationThreshold).toBe(95);
      expect(config.shell?.sessionMemory).toBe(false);
      expect(config.shell?.trustedCommands).toEqual(['^ls', '^pwd', '^echo', '^git']);
      expect(config.shell?.alwaysBlockPatterns).toEqual(['rm -rf /', 'sudo rm -rf', 'format c:']);
    });
  });

  describe('Configuration Migration and Compatibility', () => {
    it('should handle configuration without shell section', async () => {
      const legacyConfig: Partial<AiyaConfig> = {
        provider: {
          type: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4',
          apiKey: 'sk-test'
        },
        security: {
          allowedExtensions: ['.ts', '.js'],
          restrictToWorkspace: true,
          maxFileSize: 1048576
        },
        ui: {
          streaming: true,
          showTokens: true,
          theme: 'auto',
          thinking: 'on'
        }
        // No shell section
      };

      const yaml = await import('yaml');
      await fs.writeFile(globalConfigPath, yaml.stringify(legacyConfig));

      const configManager = new ConfigManager();
      const config = await configManager.load();

      // Should have default shell configuration
      expect(config.shell).toBeDefined();
      expect(config.shell?.confirmationThreshold).toBe(50);
      expect(config.shell?.sessionMemory).toBe(true);

      // Existing config should be preserved
      expect(config.provider?.type).toBe('openai');
      expect(config.ui?.streaming).toBe(true);
    });

    it('should handle mixed valid and invalid environment variables', async () => {
      process.env.AIYA_SHELL_CONFIRMATION_THRESHOLD = '75'; // Valid
      process.env.AIYA_SHELL_CONFIRMATION_TIMEOUT = 'invalid'; // Invalid
      process.env.AIYA_SHELL_SESSION_MEMORY = 'false'; // Valid
      process.env.AIYA_SHELL_MAX_EXECUTION_TIME = '-50'; // Invalid (negative)

      const configManager = new ConfigManager();
      const config = await configManager.load();

      // Valid env vars should be applied
      expect(config.shell?.confirmationThreshold).toBe(75);
      expect(config.shell?.sessionMemory).toBe(false);

      // Invalid env vars should use defaults
      expect(config.shell?.confirmationTimeout).toBe(30000); // Default
      expect(config.shell?.maxExecutionTime).toBe(30); // Default
    });
  });
});