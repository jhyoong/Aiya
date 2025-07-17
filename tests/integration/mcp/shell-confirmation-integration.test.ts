import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ShellConfirmationPrompt,
  ConfirmationPromptOptions,
} from '../../../src/core/mcp/confirmation.js';
import {
  ShellMCPClient,
  CommandRiskAssessment,
  CommandRiskCategory,
} from '../../../src/core/mcp/shell.js';
import { WorkspaceSecurity } from '../../../src/core/security/workspace.js';
import * as path from 'path';
import * as os from 'os';

// Mock React and Ink for integration tests
vi.mock('react', () => ({
  default: {
    useCallback: vi.fn(fn => fn),
    useEffect: vi.fn(),
    useState: vi.fn(() => [null, vi.fn()]),
    useRef: vi.fn(() => ({ current: null })),
    FC: vi.fn(),
  },
  useCallback: vi.fn(fn => fn),
  useEffect: vi.fn(),
  useState: vi.fn(() => [null, vi.fn()]),
  useRef: vi.fn(() => ({ current: null })),
}));

vi.mock('ink', () => ({
  Box: vi.fn(({ children }) => children),
  Text: vi.fn(({ children }) => children),
  render: vi.fn(() => ({
    rerender: vi.fn(),
    unmount: vi.fn(),
    clear: vi.fn(),
  })),
}));

vi.mock('../../../src/ui/hooks/useKeypress.js', () => ({
  useKeypress: vi.fn(),
}));

vi.mock('../../../src/ui/utils/memoryManagement.js', () => ({
  TimeoutManager: vi.fn(() => ({
    create: vi.fn((callback, delay) => setTimeout(callback, delay)),
    clear: vi.fn(timeout => clearTimeout(timeout)),
    clearAll: vi.fn(),
  })),
}));

describe('Shell Confirmation Integration Tests', () => {
  let client: ShellMCPClient;
  let confirmationPrompt: ShellConfirmationPrompt;
  let workspaceRoot: string;
  let security: WorkspaceSecurity;

  beforeEach(() => {
    // Set up test environment
    workspaceRoot = path.join(
      os.tmpdir(),
      'aiya-confirmation-integration-test'
    );
    security = new WorkspaceSecurity(
      workspaceRoot,
      ['.txt', '.js', '.ts'],
      1024 * 1024
    );

    client = new ShellMCPClient(security);
    confirmationPrompt = new ShellConfirmationPrompt();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration Integration', () => {
    test('should integrate with shell configuration system', () => {
      const config = client.getConfiguration();

      // Verify confirmation-related configuration is available
      expect(config.confirmationThreshold).toBeDefined();
      expect(config.confirmationTimeout).toBeDefined();
      expect(config.sessionMemory).toBeDefined();
      expect(config.trustedCommands).toBeDefined();
      expect(config.alwaysBlockPatterns).toBeDefined();

      // Verify defaults match expected values
      expect(config.confirmationThreshold).toBe(50);
      expect(config.confirmationTimeout).toBe(30000);
      expect(config.sessionMemory).toBe(true);
    });

    test('should use configuration values for prompt options', () => {
      const config = client.getConfiguration();

      // Mock risk assessment
      const riskAssessment: CommandRiskAssessment = {
        riskScore: 75,
        category: CommandRiskCategory.HIGH,
        riskFactors: ['File deletion operation'],
        requiresConfirmation: true,
        shouldBlock: false,
        context: {
          commandType: 'File Management',
          potentialImpact: ['Files will be permanently deleted'],
          mitigationSuggestions: [
            'Use ls to verify which files will be affected',
          ],
        },
      };

      const options: ConfirmationPromptOptions = {
        command: 'rm -rf ./temp/',
        riskAssessment,
        workingDirectory: workspaceRoot,
        timeout: config.confirmationTimeout,
      };

      expect(options.timeout).toBe(config.confirmationTimeout);
    });
  });

  describe('Risk Assessment Integration', () => {
    test('should work with different risk categories', async () => {
      const testCases = [
        {
          category: CommandRiskCategory.SAFE,
          score: 20,
          command: 'ls -la',
        },
        {
          category: CommandRiskCategory.LOW,
          score: 35,
          command: 'git status',
        },
        {
          category: CommandRiskCategory.MEDIUM,
          score: 60,
          command: 'npm install',
        },
        {
          category: CommandRiskCategory.HIGH,
          score: 80,
          command: 'chmod 755 file.txt',
        },
        {
          category: CommandRiskCategory.CRITICAL,
          score: 95,
          command: 'rm -rf /',
        },
      ];

      for (const testCase of testCases) {
        const riskAssessment: CommandRiskAssessment = {
          riskScore: testCase.score,
          category: testCase.category,
          riskFactors: [`Risk level: ${testCase.category}`],
          requiresConfirmation: testCase.score >= 50,
          shouldBlock: testCase.score >= 90,
          context: {
            commandType: 'Test Command',
            potentialImpact: [`Impact for ${testCase.category} command`],
            mitigationSuggestions: [
              `Suggestion for ${testCase.category} command`,
            ],
          },
        };

        const options: ConfirmationPromptOptions = {
          command: testCase.command,
          riskAssessment,
          workingDirectory: workspaceRoot,
          timeout: 1, // Short timeout for testing
        };

        // Should not throw error for any risk category
        const result = await confirmationPrompt.promptUser(options);
        expect(result).toBeDefined();
        expect(result.decision).toBe('deny'); // Due to timeout
        expect(result.timedOut).toBe(true);
      }
    });
  });

  describe('Session Memory Integration', () => {
    test('should remember decisions across multiple prompts', async () => {
      const riskAssessment: CommandRiskAssessment = {
        riskScore: 60,
        category: CommandRiskCategory.MEDIUM,
        riskFactors: ['Test operation'],
        requiresConfirmation: true,
        shouldBlock: false,
        context: {
          commandType: 'Test Command',
          potentialImpact: ['Test impact'],
          mitigationSuggestions: ['Test suggestion'],
        },
      };

      const options: ConfirmationPromptOptions = {
        command: 'test-command',
        riskAssessment,
        workingDirectory: workspaceRoot,
        timeout: 1,
      };

      // First prompt should timeout to deny
      const firstResult = await confirmationPrompt.promptUser(options);
      expect(firstResult.timedOut).toBe(true);
      expect(firstResult.decision).toBe('deny');

      // Manually record an allow decision for testing
      confirmationPrompt['sessionMemory'].recordDecision('test-command', {
        commandPattern: 'test-command',
        decision: 'allow',
        timestamp: new Date(),
        riskScore: 60,
      });

      // Second prompt should use cached decision
      const secondResult = await confirmationPrompt.promptUser(options);
      expect(secondResult.decision).toBe('allow');
      expect(secondResult.timedOut).toBe(false);
      expect(secondResult.rememberDecision).toBe(true);
    });

    test('should clear session memory properly', () => {
      const initialStats = confirmationPrompt.getSessionMemoryStats();
      expect(initialStats.decisionCount).toBe(0);

      // Record a decision
      confirmationPrompt['sessionMemory'].recordDecision('test-command', {
        commandPattern: 'test-command',
        decision: 'allow',
        timestamp: new Date(),
        riskScore: 50,
      });

      let stats = confirmationPrompt.getSessionMemoryStats();
      expect(stats.decisionCount).toBe(1);

      // Clear session memory
      confirmationPrompt.clearSessionMemory();

      stats = confirmationPrompt.getSessionMemoryStats();
      expect(stats.decisionCount).toBe(0);
    });
  });

  describe('Timeout Integration', () => {
    test('should handle timeout configuration from shell config', async () => {
      // Update shell configuration
      client.updateConfiguration({
        confirmationTimeout: 500, // 0.5 second timeout
      });

      const config = client.getConfiguration();
      expect(config.confirmationTimeout).toBe(500);

      const riskAssessment: CommandRiskAssessment = {
        riskScore: 75,
        category: CommandRiskCategory.HIGH,
        riskFactors: ['High risk operation'],
        requiresConfirmation: true,
        shouldBlock: false,
        context: {
          commandType: 'High Risk Command',
          potentialImpact: ['Significant impact'],
          mitigationSuggestions: ['Be careful'],
        },
      };

      const options: ConfirmationPromptOptions = {
        command: 'high-risk-command',
        riskAssessment,
        workingDirectory: workspaceRoot,
        timeout: config.confirmationTimeout,
      };

      const startTime = Date.now();
      const result = await confirmationPrompt.promptUser(options);
      const endTime = Date.now();

      expect(result.decision).toBe('deny');
      expect(result.timedOut).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Trusted Commands Integration', () => {
    test('should respect trusted command patterns', () => {
      const config = client.getConfiguration();

      // Verify trusted commands are configured
      expect(config.trustedCommands).toContain('^ls($|\\s)');
      expect(config.trustedCommands).toContain('^pwd($|\\s)');
      expect(config.trustedCommands).toContain('^echo($|\\s)');

      // These would be used by the integration logic to bypass confirmation
      const trustedCommands = ['ls', 'pwd', 'echo hello'];
      const untrustedCommands = [
        'rm -rf',
        'sudo apt-get',
        'curl http://example.com',
      ];

      trustedCommands.forEach(cmd => {
        const shouldTrust = config.trustedCommands.some(pattern => {
          try {
            return new RegExp(pattern).test(cmd);
          } catch {
            return false;
          }
        });
        expect(shouldTrust).toBe(true);
      });

      untrustedCommands.forEach(cmd => {
        const shouldTrust = config.trustedCommands.some(pattern => {
          try {
            return new RegExp(pattern).test(cmd);
          } catch {
            return false;
          }
        });
        expect(shouldTrust).toBe(false);
      });
    });
  });

  describe('Block Patterns Integration', () => {
    test('should respect always-block patterns', () => {
      const config = client.getConfiguration();

      // Verify block patterns are configured
      expect(config.alwaysBlockPatterns).toContain('rm -rf /');
      expect(config.alwaysBlockPatterns).toContain('sudo rm -rf /');
      expect(config.alwaysBlockPatterns).toContain('dd if=/dev/zero');

      // These would be blocked regardless of confirmation
      const blockedCommands = [
        'rm -rf /',
        'sudo rm -rf /home',
        'dd if=/dev/zero of=/dev/sda',
      ];
      const allowedCommands = ['ls -la', 'echo hello', 'git status'];

      blockedCommands.forEach(cmd => {
        const shouldBlock = config.alwaysBlockPatterns.some(pattern => {
          try {
            return new RegExp(pattern).test(cmd);
          } catch {
            return cmd.includes(pattern);
          }
        });
        expect(shouldBlock).toBe(true);
      });

      allowedCommands.forEach(cmd => {
        const shouldBlock = config.alwaysBlockPatterns.some(pattern => {
          try {
            return new RegExp(pattern).test(cmd);
          } catch {
            return cmd.includes(pattern);
          }
        });
        expect(shouldBlock).toBe(false);
      });
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle invalid risk assessments gracefully', async () => {
      const invalidRiskAssessment: CommandRiskAssessment = {
        riskScore: -1, // Invalid score
        category: CommandRiskCategory.SAFE,
        riskFactors: [],
        requiresConfirmation: true,
        shouldBlock: false,
        context: {
          commandType: 'Invalid Command',
          potentialImpact: [],
          mitigationSuggestions: [],
        },
      };

      const options: ConfirmationPromptOptions = {
        command: 'invalid-command',
        riskAssessment: invalidRiskAssessment,
        workingDirectory: workspaceRoot,
        timeout: 1,
      };

      // Should not throw error even with invalid risk assessment
      const result = await confirmationPrompt.promptUser(options);
      expect(result).toBeDefined();
      expect(result.decision).toBe('deny');
      expect(result.timedOut).toBe(true);
    });

    test('should handle empty command gracefully', async () => {
      const riskAssessment: CommandRiskAssessment = {
        riskScore: 50,
        category: CommandRiskCategory.MEDIUM,
        riskFactors: [],
        requiresConfirmation: true,
        shouldBlock: false,
        context: {
          commandType: 'Empty Command',
          potentialImpact: [],
          mitigationSuggestions: [],
        },
      };

      const options: ConfirmationPromptOptions = {
        command: '', // Empty command
        riskAssessment,
        workingDirectory: workspaceRoot,
        timeout: 1,
      };

      const result = await confirmationPrompt.promptUser(options);
      expect(result).toBeDefined();
      expect(result.decision).toBe('deny');
      expect(result.timedOut).toBe(true);
    });
  });

  describe('Performance Integration', () => {
    test('should handle multiple concurrent prompts', async () => {
      const riskAssessment: CommandRiskAssessment = {
        riskScore: 60,
        category: CommandRiskCategory.MEDIUM,
        riskFactors: ['Concurrent test'],
        requiresConfirmation: true,
        shouldBlock: false,
        context: {
          commandType: 'Concurrent Command',
          potentialImpact: ['Test impact'],
          mitigationSuggestions: ['Test suggestion'],
        },
      };

      const promises = [];
      for (let i = 0; i < 5; i++) {
        const options: ConfirmationPromptOptions = {
          command: `concurrent-command-${i}`,
          riskAssessment,
          workingDirectory: workspaceRoot,
          timeout: 1,
        };
        promises.push(confirmationPrompt.promptUser(options));
      }

      const results = await Promise.all(promises);

      // All should complete without errors
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.decision).toBe('deny');
        expect(result.timedOut).toBe(true);
      });
    });
  });
});
