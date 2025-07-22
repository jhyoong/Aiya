import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgenticErrorHandler } from '../../../src/core/agentic/AgenticErrorHandler.js';
import { TodoMCPAdapter } from '../../../src/core/mcp/todo-adapter.js';
import { MCPToolError } from '../../../src/core/mcp/base.js';

// Mock the TodoMCPAdapter
vi.mock('../../../src/core/mcp/todo-adapter.js', () => {
  const mockTodoAdapter = {
    callTool: vi.fn(),
  };
  return {
    TodoMCPAdapter: vi.fn(() => mockTodoAdapter),
  };
});

describe('AgenticErrorHandler TodoMCPAdapter Integration', () => {
  let errorHandler: AgenticErrorHandler;
  let mockTodoAdapter: any;

  beforeEach(() => {
    mockTodoAdapter = new (TodoMCPAdapter as any)();
    errorHandler = new AgenticErrorHandler(mockTodoAdapter, 3, 100); // 3 retries, 100ms delay

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('handleTaskFailure', () => {
    it('should handle retryable errors using ResetTaskExecution tool', async () => {
      // Mock network error (retryable)
      const networkError = new Error('network timeout');
      mockTodoAdapter.callTool.mockResolvedValue({
        content: [{ text: 'Reset complete' }],
      });

      const result = await errorHandler.handleTaskFailure(
        'task-1',
        networkError,
        'group-1',
        0
      );

      expect(mockTodoAdapter.callTool).toHaveBeenCalledWith(
        'ResetTaskExecution',
        {
          todoId: 'task-1',
          resetDependents: false,
        }
      );

      expect(result).toMatchObject({
        action: 'retry',
        taskId: 'task-1',
        retryCount: 1,
      });
    });

    it('should not retry after max attempts', async () => {
      const networkError = new Error('connection failed');

      // Mock GetTaskGroupStatus to return no independent tasks
      mockTodoAdapter.callTool
        .mockResolvedValueOnce({ content: [{ text: 'Reset complete' }] }) // First call for reset
        .mockResolvedValueOnce({
          content: [
            {
              text: JSON.stringify({
                tasks: [
                  { id: 'task-1', dependencies: [] },
                  { id: 'task-2', dependencies: ['task-1'] }, // depends on failed task
                ],
              }),
            },
          ],
        })
        .mockResolvedValueOnce({
          content: [{ text: JSON.stringify([]) }], // No executable tasks
        });

      const result = await errorHandler.handleTaskFailure(
        'task-1',
        networkError,
        'group-1',
        3
      );

      expect(result.action).toBe('user_intervention');
      expect(result.message).toContain('requires user intervention');
    });

    it('should continue with other tasks when possible', async () => {
      const configError = new Error('invalid configuration');

      // Mock task group with independent tasks
      mockTodoAdapter.callTool
        .mockResolvedValueOnce({
          content: [
            {
              text: JSON.stringify({
                tasks: [
                  { id: 'task-1', dependencies: [] },
                  { id: 'task-2', dependencies: [] }, // independent task
                  { id: 'task-3', dependencies: ['task-1'] }, // depends on failed task
                ],
              }),
            },
          ],
        })
        .mockResolvedValueOnce({
          content: [{ text: JSON.stringify([{ id: 'task-2' }]) }], // task-2 is executable
        });

      const result = await errorHandler.handleTaskFailure(
        'task-1',
        configError,
        'group-1'
      );

      expect(result.action).toBe('continue_others');
      expect(result.message).toContain('other independent tasks can continue');
    });

    it('should abort group for critical failures', async () => {
      const criticalError = new Error('out of memory');

      const result = await errorHandler.handleTaskFailure(
        'task-1',
        criticalError,
        'group-1'
      );

      expect(result.action).toBe('user_intervention'); // Memory errors require intervention
      expect(result.suggestedActions).toContain('free up system resources');
    });

    it('should handle MCPToolError during reset', async () => {
      const networkError = new Error('connection timeout');
      const resetError = new MCPToolError('ResetTaskExecution', 'Reset failed');

      mockTodoAdapter.callTool.mockRejectedValue(resetError);

      const result = await errorHandler.handleTaskFailure(
        'task-1',
        networkError,
        'group-1',
        0
      );

      expect(result.action).toBe('user_intervention');
      expect(result.message).toContain('Failed to reset task for retry');
    });
  });

  describe('error classification', () => {
    it('should classify network errors as retryable', async () => {
      const networkErrors = [
        new Error('network timeout'),
        new Error('connection refused'),
        new Error('ECONNREFUSED'),
      ];

      for (const error of networkErrors) {
        mockTodoAdapter.callTool.mockResolvedValue({
          content: [{ text: 'Reset complete' }],
        });

        const result = await errorHandler.handleTaskFailure(
          'task-1',
          error,
          'group-1',
          0
        );
        expect(result.action).toBe('retry');
      }
    });

    it('should classify configuration errors as non-retryable', async () => {
      const configError = new Error('invalid config');

      // Mock empty task list for group status
      mockTodoAdapter.callTool
        .mockResolvedValueOnce({
          content: [{ text: JSON.stringify({ tasks: [] }) }],
        })
        .mockResolvedValueOnce({ content: [{ text: JSON.stringify([]) }] });

      const result = await errorHandler.handleTaskFailure(
        'task-1',
        configError,
        'group-1'
      );

      expect(result.action).toBe('user_intervention');
      expect(result.suggestedActions).toContain('review configuration files');
    });

    it('should handle MCPToolError classification', async () => {
      const mcpError = new MCPToolError('TestTool', 'server connection failed');

      mockTodoAdapter.callTool.mockResolvedValue({
        content: [{ text: 'Reset complete' }],
      });

      const result = await errorHandler.handleTaskFailure(
        'task-1',
        mcpError,
        'group-1',
        0
      );

      expect(result.action).toBe('retry'); // Server errors should be retryable
    });
  });

  describe('getRecoveryStatus', () => {
    it('should analyze group recovery status using GetTaskGroupStatus', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          executionStatus: { state: 'completed' },
        },
        {
          id: 'task-2',
          title: 'Task 2',
          executionStatus: { state: 'failed', lastError: 'network timeout' },
          dependencies: [],
        },
        {
          id: 'task-3',
          title: 'Task 3',
          executionStatus: { state: 'failed', lastError: 'invalid config' },
          dependencies: [],
        },
        {
          id: 'task-4',
          title: 'Task 4',
          executionStatus: { state: 'pending' },
          dependencies: ['task-2'], // blocked by failed task
        },
      ];

      mockTodoAdapter.callTool.mockResolvedValue({
        content: [{ text: JSON.stringify({ tasks: mockTasks }) }],
      });

      const result = await errorHandler.getRecoveryStatus('group-1');

      expect(result.hasFailures).toBe(true);
      expect(result.failedTasks).toHaveLength(2);
      expect(result.failedTasks[0]).toMatchObject({
        id: 'task-2',
        title: 'Task 2',
        error: 'network timeout',
      });
      expect(result.recoverableTasks).toBe(1); // network timeout is retryable
      expect(result.recommendations).toContain('1 failed tasks can be retried');
    });

    it('should handle no failures', async () => {
      mockTodoAdapter.callTool.mockResolvedValue({
        content: [{ text: JSON.stringify({ tasks: [] }) }],
      });

      const result = await errorHandler.getRecoveryStatus('group-1');

      expect(result.hasFailures).toBe(false);
      expect(result.failedTasks).toHaveLength(0);
      expect(result.recommendations).toContain('No failures detected');
    });
  });

  describe('resetFailedTasks', () => {
    it('should reset all failed tasks using batch operations', async () => {
      // Mock recovery status with failed tasks
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Failed Task 1',
          executionStatus: { state: 'failed', lastError: 'error 1' },
        },
        {
          id: 'task-2',
          title: 'Failed Task 2',
          executionStatus: { state: 'failed', lastError: 'error 2' },
        },
      ];

      // First call for getRecoveryStatus
      mockTodoAdapter.callTool
        .mockResolvedValueOnce({
          content: [{ text: JSON.stringify({ tasks: mockTasks }) }],
        })
        // Then calls for each reset
        .mockResolvedValue({ content: [{ text: 'Reset complete' }] });

      const result = await errorHandler.resetFailedTasks('group-1', true);

      expect(result.resetCount).toBe(2);
      expect(result.errors).toHaveLength(0);

      expect(mockTodoAdapter.callTool).toHaveBeenCalledWith(
        'ResetTaskExecution',
        {
          todoId: 'task-1',
          resetDependents: true,
        }
      );
      expect(mockTodoAdapter.callTool).toHaveBeenCalledWith(
        'ResetTaskExecution',
        {
          todoId: 'task-2',
          resetDependents: true,
        }
      );
    });

    it('should handle individual reset failures', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          executionStatus: { state: 'failed' },
        },
      ];

      mockTodoAdapter.callTool
        .mockResolvedValueOnce({
          content: [{ text: JSON.stringify({ tasks: mockTasks }) }],
        })
        .mockRejectedValue(new Error('Reset failed'));

      const result = await errorHandler.resetFailedTasks('group-1');

      expect(result.resetCount).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to reset task Task 1');
    });
  });

  describe('canContinueWithOtherTasks', () => {
    it('should detect independent executable tasks', async () => {
      const mockTasks = [
        { id: 'task-1', dependencies: [] }, // failed task
        { id: 'task-2', dependencies: [] }, // independent
        { id: 'task-3', dependencies: ['task-1'] }, // depends on failed
      ];

      mockTodoAdapter.callTool
        .mockResolvedValueOnce({
          content: [{ text: JSON.stringify({ tasks: mockTasks }) }],
        })
        .mockResolvedValueOnce({
          content: [{ text: JSON.stringify([{ id: 'task-2' }]) }],
        });

      const handler = errorHandler as any;
      const result = await handler.canContinueWithOtherTasks(
        'task-1',
        'group-1'
      );

      expect(result).toBe(true);
    });

    it('should return false when no independent tasks available', async () => {
      const mockTasks = [
        { id: 'task-1', dependencies: [] }, // failed task
        { id: 'task-2', dependencies: ['task-1'] }, // depends on failed
      ];

      mockTodoAdapter.callTool
        .mockResolvedValueOnce({
          content: [{ text: JSON.stringify({ tasks: mockTasks }) }],
        })
        .mockResolvedValueOnce({
          content: [{ text: JSON.stringify([]) }], // no executable tasks
        });

      const handler = errorHandler as any;
      const result = await handler.canContinueWithOtherTasks(
        'task-1',
        'group-1'
      );

      expect(result).toBe(false);
    });
  });

  describe('retry configuration', () => {
    it('should respect configured retry limits and delays', async () => {
      // Create handler with custom settings
      const customHandler = new AgenticErrorHandler(mockTodoAdapter, 2, 50);

      const retryableError = new Error('connection timeout');
      mockTodoAdapter.callTool.mockResolvedValue({
        content: [{ text: 'Reset complete' }],
      });

      // Should retry with attempt 1
      let result = await customHandler.handleTaskFailure(
        'task-1',
        retryableError,
        'group-1',
        0
      );
      expect(result.action).toBe('retry');

      // Should retry with attempt 2 (at limit)
      result = await customHandler.handleTaskFailure(
        'task-1',
        retryableError,
        'group-1',
        1
      );
      expect(result.action).toBe('retry');

      // Mock empty task list for GetTaskGroupStatus (no independent tasks)
      mockTodoAdapter.callTool
        .mockResolvedValueOnce({
          content: [{ text: JSON.stringify({ tasks: [] }) }],
        })
        .mockResolvedValueOnce({ content: [{ text: JSON.stringify([]) }] });

      // Should not retry after max attempts (2)
      result = await customHandler.handleTaskFailure(
        'task-1',
        retryableError,
        'group-1',
        2
      );
      expect(result.action).toBe('user_intervention');
    });

    it('should allow updating retry configuration', () => {
      errorHandler.setRetryConfiguration(5, 200);

      // Verify new settings are applied (test through internal state)
      const handler = errorHandler as any;
      expect(handler.maxRetryAttempts).toBe(5);
      expect(handler.retryDelay).toBe(200);
    });
  });

  describe('suggested actions generation', () => {
    it('should provide context-appropriate suggestions', async () => {
      const testCases = [
        {
          error: new Error('ENOENT: file not found'),
          expectedActions: [
            'Verify file paths exist',
            'Check file permissions',
          ],
        },
        {
          error: new Error('network timeout'),
          expectedActions: [
            'Check network connectivity',
            'Verify server endpoints',
          ],
        },
        {
          error: new Error('invalid configuration'),
          expectedActions: [
            'Review configuration files',
            'Validate configuration syntax',
          ],
        },
        {
          error: new MCPToolError('TestTool', 'connection failed'),
          expectedActions: [
            'Check TodoMCPAdapter connection',
            'Verify MCP server is running',
          ],
        },
      ];

      for (const { error, expectedActions } of testCases) {
        // Mock empty tasks for continue check
        mockTodoAdapter.callTool
          .mockResolvedValueOnce({
            content: [{ text: JSON.stringify({ tasks: [] }) }],
          })
          .mockResolvedValueOnce({ content: [{ text: JSON.stringify([]) }] });

        const result = await errorHandler.handleTaskFailure(
          'task-1',
          error,
          'group-1',
          5 // High attempt count to force classification actions instead of retry
        );

        expect(result.suggestedActions).toBeDefined();
        for (const expectedAction of expectedActions) {
          expect(
            result.suggestedActions?.some(action =>
              action.includes(expectedAction.toLowerCase())
            )
          ).toBe(true);
        }
      }
    });
  });
});
