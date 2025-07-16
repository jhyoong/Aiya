import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ShellConfirmationPrompt,
  SessionMemoryManager,
  ConfirmationPromptOptions,
  ConfirmationResponse,
  SessionDecision,
} from '../../../src/core/mcp/confirmation.js';
import {
  CommandRiskAssessment,
  CommandRiskCategory,
} from '../../../src/core/mcp/shell.js';

// Mock React and Ink components for testing
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

describe('ShellConfirmationPrompt', () => {
  let prompt: ShellConfirmationPrompt;
  let mockRiskAssessment: CommandRiskAssessment;
  let mockOptions: ConfirmationPromptOptions;

  beforeEach(() => {
    prompt = new ShellConfirmationPrompt();

    mockRiskAssessment = {
      riskScore: 75,
      category: CommandRiskCategory.HIGH,
      riskFactors: ['File deletion operation', 'Potential data loss'],
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

    mockOptions = {
      command: 'rm -rf ./temp/',
      riskAssessment: mockRiskAssessment,
      workingDirectory: '/home/user/project',
      timeout: 30000,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with empty session memory', () => {
      const newPrompt = new ShellConfirmationPrompt();
      const stats = newPrompt.getSessionMemoryStats();
      expect(stats.decisionCount).toBe(0);
    });
  });

  describe('Session Memory Management', () => {
    test('should clear session memory', () => {
      prompt.clearSessionMemory();
      const stats = prompt.getSessionMemoryStats();
      expect(stats.decisionCount).toBe(0);
    });

    test('should get session memory statistics', () => {
      const stats = prompt.getSessionMemoryStats();
      expect(stats).toHaveProperty('decisionCount');
      expect(typeof stats.decisionCount).toBe('number');
    });
  });

  describe('Prompt User', () => {
    test('should return a promise', () => {
      const result = prompt.promptUser(mockOptions);
      expect(result).toBeInstanceOf(Promise);
    });

    test('should handle timeout properly', async () => {
      // Mock a very short timeout
      const shortTimeoutOptions = {
        ...mockOptions,
        timeout: 1, // 1ms timeout
      };

      const result = await prompt.promptUser(shortTimeoutOptions);
      expect(result.decision).toBe('deny');
      expect(result.timedOut).toBe(true);
      expect(result.rememberDecision).toBe(false);
    });
  });
});

describe('SessionMemoryManager', () => {
  let sessionMemory: SessionMemoryManager;
  let mockDecision: SessionDecision;

  beforeEach(() => {
    sessionMemory = new SessionMemoryManager();
    mockDecision = {
      commandPattern: 'ls -la',
      decision: 'allow',
      timestamp: new Date(),
      riskScore: 25,
    };
  });

  describe('Decision Management', () => {
    test('should record and retrieve decisions', () => {
      sessionMemory.recordDecision('ls -la', mockDecision);
      const retrieved = sessionMemory.checkPreviousDecision('ls -la');

      expect(retrieved).toBeDefined();
      expect(retrieved!.decision).toBe('allow');
      expect(retrieved!.commandPattern).toBe('ls -la');
    });

    test('should return null for non-existent decisions', () => {
      const result = sessionMemory.checkPreviousDecision(
        'non-existent-command'
      );
      expect(result).toBeNull();
    });

    test('should handle pattern matching', () => {
      // Record a decision with a regex pattern
      const regexDecision: SessionDecision = {
        commandPattern: '^ls($|\\s)',
        decision: 'allow',
        timestamp: new Date(),
        riskScore: 25,
      };

      sessionMemory.recordDecision('^ls($|\\s)', regexDecision);

      // Should match commands that start with 'ls'
      const result = sessionMemory.checkPreviousDecision('ls -la');
      expect(result).toBeDefined();
      expect(result!.decision).toBe('allow');
    });

    test('should handle invalid regex patterns gracefully', () => {
      const invalidRegexDecision: SessionDecision = {
        commandPattern: '[invalid-regex',
        decision: 'allow',
        timestamp: new Date(),
        riskScore: 25,
      };

      sessionMemory.recordDecision('[invalid-regex', invalidRegexDecision);

      // Should not throw error and should return null
      const result = sessionMemory.checkPreviousDecision('test-command');
      expect(result).toBeNull();
    });

    test('should clear expired decisions', () => {
      // Create an old decision
      const oldDecision: SessionDecision = {
        commandPattern: 'old-command',
        decision: 'allow',
        timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        riskScore: 25,
      };

      sessionMemory.recordDecision('old-command', oldDecision);

      // Record a recent decision
      sessionMemory.recordDecision('new-command', mockDecision);

      // Clear expired decisions
      sessionMemory.clearExpiredDecisions();

      // Old decision should be gone, new one should remain
      expect(sessionMemory.checkPreviousDecision('old-command')).toBeNull();
      expect(sessionMemory.checkPreviousDecision('new-command')).toBeDefined();
    });

    test('should clear all decisions', () => {
      sessionMemory.recordDecision('command1', mockDecision);
      sessionMemory.recordDecision('command2', mockDecision);

      expect(sessionMemory.getDecisionCount()).toBe(2);

      sessionMemory.clearAllDecisions();

      expect(sessionMemory.getDecisionCount()).toBe(0);
    });

    test('should limit number of decisions', () => {
      // Record more decisions than the limit (100)
      for (let i = 0; i < 105; i++) {
        const decision: SessionDecision = {
          commandPattern: `command-${i}`,
          decision: 'allow',
          timestamp: new Date(),
          riskScore: 25,
        };
        sessionMemory.recordDecision(`command-${i}`, decision);
      }

      // Should not exceed the limit
      expect(sessionMemory.getDecisionCount()).toBeLessThanOrEqual(100);

      // Oldest decisions should be removed
      expect(sessionMemory.checkPreviousDecision('command-0')).toBeNull();
      expect(sessionMemory.checkPreviousDecision('command-104')).toBeDefined();
    });
  });

  describe('Decision Count', () => {
    test('should return correct decision count', () => {
      expect(sessionMemory.getDecisionCount()).toBe(0);

      sessionMemory.recordDecision('command1', mockDecision);
      expect(sessionMemory.getDecisionCount()).toBe(1);

      sessionMemory.recordDecision('command2', mockDecision);
      expect(sessionMemory.getDecisionCount()).toBe(2);
    });
  });
});

describe('ConfirmationPromptOptions Interface', () => {
  test('should have all required properties', () => {
    const options: ConfirmationPromptOptions = {
      command: 'test command',
      riskAssessment: {
        riskScore: 50,
        category: CommandRiskCategory.MEDIUM,
        riskFactors: ['test factor'],
        requiresConfirmation: true,
        shouldBlock: false,
        context: {
          commandType: 'test',
          potentialImpact: ['test impact'],
          mitigationSuggestions: ['test suggestion'],
        },
      },
      workingDirectory: '/test/dir',
      timeout: 30000,
    };

    expect(options).toHaveProperty('command');
    expect(options).toHaveProperty('riskAssessment');
    expect(options).toHaveProperty('workingDirectory');
    expect(options).toHaveProperty('timeout');
  });
});

describe('ConfirmationResponse Interface', () => {
  test('should have all required properties', () => {
    const response: ConfirmationResponse = {
      decision: 'allow',
      rememberDecision: true,
      timedOut: false,
    };

    expect(response).toHaveProperty('decision');
    expect(response).toHaveProperty('rememberDecision');
    expect(response).toHaveProperty('timedOut');
  });

  test('should accept all valid decision types', () => {
    const decisions: ConfirmationResponse['decision'][] = [
      'allow',
      'deny',
      'trust',
      'block',
    ];

    decisions.forEach(decision => {
      const response: ConfirmationResponse = {
        decision,
        rememberDecision: false,
        timedOut: false,
      };

      expect(response.decision).toBe(decision);
    });
  });
});

describe('SessionDecision Interface', () => {
  test('should have all required properties', () => {
    const decision: SessionDecision = {
      commandPattern: 'test-pattern',
      decision: 'allow',
      timestamp: new Date(),
      riskScore: 42,
    };

    expect(decision).toHaveProperty('commandPattern');
    expect(decision).toHaveProperty('decision');
    expect(decision).toHaveProperty('timestamp');
    expect(decision).toHaveProperty('riskScore');
  });

  test('should accept all valid decision types', () => {
    const decisions: SessionDecision['decision'][] = ['allow', 'deny', 'trust'];

    decisions.forEach(decisionType => {
      const decision: SessionDecision = {
        commandPattern: 'test-pattern',
        decision: decisionType,
        timestamp: new Date(),
        riskScore: 42,
      };

      expect(decision.decision).toBe(decisionType);
    });
  });
});

describe('Risk Assessment Integration', () => {
  test('should handle all risk categories', () => {
    const categories = [
      CommandRiskCategory.SAFE,
      CommandRiskCategory.LOW,
      CommandRiskCategory.MEDIUM,
      CommandRiskCategory.HIGH,
      CommandRiskCategory.CRITICAL,
    ];

    categories.forEach(category => {
      const assessment: CommandRiskAssessment = {
        riskScore: 50,
        category,
        riskFactors: ['test factor'],
        requiresConfirmation: true,
        shouldBlock: false,
        context: {
          commandType: 'test',
          potentialImpact: ['test impact'],
          mitigationSuggestions: ['test suggestion'],
        },
      };

      const options: ConfirmationPromptOptions = {
        command: 'test command',
        riskAssessment: assessment,
        workingDirectory: '/test/dir',
        timeout: 30000,
      };

      expect(options.riskAssessment.category).toBe(category);
    });
  });

  test('should handle empty risk factors and suggestions', () => {
    const assessment: CommandRiskAssessment = {
      riskScore: 25,
      category: CommandRiskCategory.SAFE,
      riskFactors: [],
      requiresConfirmation: false,
      shouldBlock: false,
      context: {
        commandType: 'Safe Command',
        potentialImpact: [],
        mitigationSuggestions: [],
      },
    };

    const options: ConfirmationPromptOptions = {
      command: 'ls',
      riskAssessment: assessment,
      workingDirectory: '/test/dir',
      timeout: 30000,
    };

    expect(options.riskAssessment.riskFactors).toEqual([]);
    expect(options.riskAssessment.context.potentialImpact).toEqual([]);
    expect(options.riskAssessment.context.mitigationSuggestions).toEqual([]);
  });
});
