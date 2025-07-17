import { describe, test, expect, beforeEach } from 'vitest';
import { ShellMCPClient, CommandFilter } from '../../../src/core/mcp/shell.js';
import { WorkspaceSecurity } from '../../../src/core/security/workspace.js';
import * as path from 'path';
import * as os from 'os';

describe('Shell Configuration Integration Tests', () => {
  let client: ShellMCPClient;
  let workspaceRoot: string;

  beforeEach(() => {
    // Use a temporary directory for tests
    workspaceRoot = path.join(os.tmpdir(), 'aiya-integration-test');
    const security = new WorkspaceSecurity(
      workspaceRoot,
      ['.txt', '.js', '.ts'],
      1024 * 1024
    );

    client = new ShellMCPClient(security);
  });

  describe('Phase 5 Configuration Integration', () => {
    test('should load default Phase 5 configuration values', () => {
      const config = client.getConfiguration();

      // Verify all Phase 5 fields are present with correct defaults
      expect(config.confirmationThreshold).toBe(50);
      expect(config.confirmationTimeout).toBe(30000);
      expect(config.sessionMemory).toBe(true);
      expect(Array.isArray(config.trustedCommands)).toBe(true);
      expect(Array.isArray(config.alwaysBlockPatterns)).toBe(true);

      // Verify default trusted commands include expected patterns
      expect(config.trustedCommands).toContain('^ls($|\\s)');
      expect(config.trustedCommands).toContain('^pwd($|\\s)');
      expect(config.trustedCommands).toContain('^echo($|\\s)');

      // Verify default block patterns include dangerous commands
      expect(config.alwaysBlockPatterns).toContain('rm -rf /');
      expect(config.alwaysBlockPatterns).toContain('sudo rm -rf');
      expect(config.alwaysBlockPatterns).toContain('dd if=/dev/zero');
    });

    test('should validate confirmationThreshold on update', () => {
      expect(() => {
        client.updateConfiguration({
          confirmationThreshold: 150,
        });
      }).toThrow(
        'Invalid confirmationThreshold: 150. Must be between 0 and 100.'
      );
    });

    test('should validate confirmationTimeout on update', () => {
      expect(() => {
        client.updateConfiguration({
          confirmationTimeout: -1000,
        });
      }).toThrow('Invalid confirmationTimeout: -1000. Must be greater than 0.');
    });

    test('should validate trustedCommands on update', () => {
      expect(() => {
        client.updateConfiguration({
          trustedCommands: ['[invalid regex'],
        });
      }).toThrow('Invalid regex pattern in trustedCommands[0]: [invalid regex');
    });

    test('should validate alwaysBlockPatterns on update', () => {
      expect(() => {
        client.updateConfiguration({
          alwaysBlockPatterns: ['[invalid regex'],
        });
      }).toThrow(
        'Invalid regex pattern in alwaysBlockPatterns[0]: [invalid regex'
      );
    });

    test('should successfully update valid Phase 5 configuration', () => {
      const newConfig = {
        confirmationThreshold: 75,
        confirmationTimeout: 45000,
        sessionMemory: false,
        trustedCommands: ['^ls($|\\s)', '^pwd($|\\s)', '^git status($|\\s)'],
        alwaysBlockPatterns: ['rm -rf /', 'sudo rm -rf', 'format.*'],
      };

      // Update should succeed
      expect(() => {
        client.updateConfiguration(newConfig);
      }).not.toThrow();

      // Verify configuration was updated
      const updatedConfig = client.getConfiguration();
      expect(updatedConfig.confirmationThreshold).toBe(75);
      expect(updatedConfig.confirmationTimeout).toBe(45000);
      expect(updatedConfig.sessionMemory).toBe(false);
      expect(updatedConfig.trustedCommands).toEqual(newConfig.trustedCommands);
      expect(updatedConfig.alwaysBlockPatterns).toEqual(
        newConfig.alwaysBlockPatterns
      );
    });

    test('should maintain backward compatibility with existing configuration', () => {
      // Test that existing configuration fields still work
      const existingConfig = {
        allowedCommands: ['ls', 'pwd', 'echo'],
        blockedCommands: ['rm', 'sudo'],
        requireConfirmation: false,
        autoApprovePatterns: ['^ls($|\\s)'],
        maxExecutionTime: 60,
        allowComplexCommands: true,
      };

      expect(() => {
        client.updateConfiguration(existingConfig);
      }).not.toThrow();

      const config = client.getConfiguration();
      expect(config.allowedCommands).toEqual(existingConfig.allowedCommands);
      expect(config.blockedCommands).toEqual(existingConfig.blockedCommands);
      expect(config.requireConfirmation).toBe(false);
      expect(config.maxExecutionTime).toBe(60);
      expect(config.allowComplexCommands).toBe(true);

      // Phase 5 fields should still have default values
      expect(config.confirmationThreshold).toBe(50);
      expect(config.confirmationTimeout).toBe(30000);
      expect(config.sessionMemory).toBe(true);
    });

    test('should validate Phase 5 configuration in CommandFilter directly', () => {
      // Test that CommandFilter validates Phase 5 fields independently
      expect(() => {
        new CommandFilter({
          confirmationThreshold: 25,
          confirmationTimeout: 15000,
          sessionMemory: true,
          trustedCommands: ['^ls($|\\s)', '^pwd($|\\s)'],
          alwaysBlockPatterns: ['rm -rf /', 'sudo rm -rf'],
        });
      }).not.toThrow();

      expect(() => {
        new CommandFilter({
          confirmationThreshold: 200, // Invalid
          confirmationTimeout: 15000,
          sessionMemory: true,
          trustedCommands: ['^ls($|\\s)'],
          alwaysBlockPatterns: ['rm -rf /'],
        });
      }).toThrow(
        'Invalid confirmationThreshold: 200. Must be between 0 and 100.'
      );
    });

    test('should handle partial configuration updates for Phase 5 fields', () => {
      // Update only confirmationThreshold
      client.updateConfiguration({
        confirmationThreshold: 80,
      });

      let config = client.getConfiguration();
      expect(config.confirmationThreshold).toBe(80);
      // Other Phase 5 fields should remain default
      expect(config.confirmationTimeout).toBe(30000);
      expect(config.sessionMemory).toBe(true);

      // Update only trustedCommands
      client.updateConfiguration({
        trustedCommands: [
          '^ls($|\\s)',
          '^pwd($|\\s)',
          '^echo($|\\s)',
          '^git status($|\\s)',
        ],
      });

      config = client.getConfiguration();
      expect(config.confirmationThreshold).toBe(80); // Should remain from previous update
      expect(config.trustedCommands).toHaveLength(4);
      expect(config.trustedCommands).toContain('^git status($|\\s)');
    });

    test('should preserve Phase 5 configuration across multiple updates', () => {
      // Set initial Phase 5 configuration
      client.updateConfiguration({
        confirmationThreshold: 60,
        sessionMemory: false,
      });

      // Update non-Phase 5 configuration
      client.updateConfiguration({
        maxExecutionTime: 120,
        allowComplexCommands: true,
      });

      // Phase 5 configuration should be preserved
      const config = client.getConfiguration();
      expect(config.confirmationThreshold).toBe(60);
      expect(config.sessionMemory).toBe(false);
      expect(config.maxExecutionTime).toBe(120);
      expect(config.allowComplexCommands).toBe(true);
    });

    test('should validate regex patterns in Phase 5 configuration during integration', () => {
      // Valid regex patterns should work
      expect(() => {
        client.updateConfiguration({
          trustedCommands: [
            '^ls($|\\s)',
            '^pwd($|\\s)',
            '^echo\\s+.*',
            '^git\\s+(status|log|diff)($|\\s)',
          ],
        });
      }).not.toThrow();

      // Invalid regex patterns should fail
      expect(() => {
        client.updateConfiguration({
          alwaysBlockPatterns: [
            'rm -rf /',
            '[invalid regex pattern',
            'sudo rm -rf',
          ],
        });
      }).toThrow(
        'Invalid regex pattern in alwaysBlockPatterns[1]: [invalid regex pattern'
      );
    });
  });
});
