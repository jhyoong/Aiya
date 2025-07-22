import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgenticOrchestrator } from '../../../src/core/agentic/AgenticOrchestrator.js';
import { TodoMCPAdapter } from '../../../src/core/mcp/todo-adapter.js';
import { MCPToolError } from '../../../src/core/mcp/base.js';

// Mock the TodoMCPAdapter
vi.mock('../../../src/core/mcp/todo-adapter.js', () => {
  const mockTodoAdapter = {
    callTool: vi.fn(),
    ping: vi.fn(),
    isConnected: vi.fn(),
  };
  return {
    TodoMCPAdapter: vi.fn(() => mockTodoAdapter),
  };
});

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123',
}));

describe('AgenticOrchestrator TodoMCPAdapter Integration', () => {
  let orchestrator: AgenticOrchestrator;
  let mockTodoAdapter: any;

  beforeEach(() => {
    mockTodoAdapter = new (TodoMCPAdapter as any)();
    orchestrator = new AgenticOrchestrator(mockTodoAdapter);

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('planTasks', () => {
    it('should create task hierarchy using CreateTaskGroup tool', async () => {
      const mockResult = {
        content: [
          {
            text: JSON.stringify({
              groupId: 'agentic-test-uuid-123',
              mainTask: { id: 'main-task-1', title: 'Test Objective' },
              subtasks: [{ id: 'subtask-1', title: 'Test Task 1' }],
            }),
          },
        ],
      };

      mockTodoAdapter.callTool.mockResolvedValue(mockResult);

      const tasks = [
        {
          title: 'Test Task 1',
          description: 'First test task',
          tool: 'shell',
          toolArgs: { command: 'echo test' },
          dependencyIndices: [],
        },
      ];

      const result = await orchestrator.planTasks('Test Objective', tasks, [
        'constraint1',
      ]);

      expect(mockTodoAdapter.callTool).toHaveBeenCalledWith('CreateTaskGroup', {
        mainTask: {
          title: 'Test Objective',
          description:
            'Agentic execution: Test Objective (Constraints: constraint1)',
          tags: ['agentic', 'ai-execution', 'main-task'],
        },
        subtasks: [
          {
            title: 'Test Task 1',
            description: 'First test task',
            tags: ['agentic', 'ai-execution'],
            dependencies: [],
            executionConfig: {
              requiredTool: 'shell',
              toolArgs: { command: 'echo test' },
            },
          },
        ],
        groupId: 'agentic-test-uuid-123',
      });

      expect(result).toEqual({
        groupId: 'agentic-test-uuid-123',
        taskCount: 2,
        mainTaskId: 'main-task-1',
      });
    });

    it('should handle MCPToolError during task planning', async () => {
      const mockError = new MCPToolError(
        'CreateTaskGroup',
        'Connection failed'
      );
      mockTodoAdapter.callTool.mockRejectedValue(mockError);

      const tasks = [{ title: 'Test', tool: 'shell', dependencyIndices: [] }];

      await expect(orchestrator.planTasks('Test', tasks)).rejects.toThrow(
        'Failed to plan tasks: Connection failed'
      );
    });
  });

  describe('getNextExecutableTask', () => {
    it('should retrieve executable tasks using GetExecutableTasks tool', async () => {
      const mockResult = {
        content: [
          {
            text: JSON.stringify([
              {
                id: 'task-1',
                title: 'Ready Task',
                description: 'Task ready for execution',
                executionConfig: {
                  requiredTool: 'filesystem',
                  toolArgs: { action: 'create' },
                },
              },
            ]),
          },
        ],
      };

      mockTodoAdapter.callTool.mockResolvedValue(mockResult);

      const result = await orchestrator.getNextExecutableTask('test-group');

      expect(mockTodoAdapter.callTool).toHaveBeenCalledWith(
        'GetExecutableTasks',
        {
          groupId: 'test-group',
          limit: 1,
        }
      );

      expect(result).toEqual({
        id: 'task-1',
        title: 'Ready Task',
        description: 'Task ready for execution',
        tool: 'filesystem',
        toolArgs: { action: 'create' },
      });
    });

    it('should return null when no tasks are executable', async () => {
      const mockResult = {
        content: [{ text: JSON.stringify([]) }],
      };

      mockTodoAdapter.callTool.mockResolvedValue(mockResult);

      const result = await orchestrator.getNextExecutableTask('test-group');

      expect(result).toBeNull();
    });

    it('should handle errors when getting executable tasks', async () => {
      mockTodoAdapter.callTool.mockRejectedValue(new Error('Network error'));

      await expect(
        orchestrator.getNextExecutableTask('test-group')
      ).rejects.toThrow(
        'Unexpected error getting executable task: Network error'
      );
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status using UpdateExecutionStatus tool', async () => {
      mockTodoAdapter.callTool.mockResolvedValue({ content: [{ text: 'OK' }] });

      await orchestrator.updateTaskStatus('task-1', 'completed');

      expect(mockTodoAdapter.callTool).toHaveBeenCalledWith(
        'UpdateExecutionStatus',
        {
          taskId: 'task-1',
          status: 'completed',
          error: undefined,
        }
      );
    });

    it('should include error message when status is failed', async () => {
      mockTodoAdapter.callTool.mockResolvedValue({ content: [{ text: 'OK' }] });

      await orchestrator.updateTaskStatus('task-1', 'failed', 'Test error');

      expect(mockTodoAdapter.callTool).toHaveBeenCalledWith(
        'UpdateExecutionStatus',
        {
          taskId: 'task-1',
          status: 'failed',
          error: 'Test error',
        }
      );
    });

    it('should handle MCPToolError during status update', async () => {
      const mockError = new MCPToolError(
        'UpdateExecutionStatus',
        'Update failed'
      );
      mockTodoAdapter.callTool.mockRejectedValue(mockError);

      await expect(
        orchestrator.updateTaskStatus('task-1', 'completed')
      ).rejects.toThrow('Failed to update task status: Update failed');
    });
  });

  describe('getProgress', () => {
    it('should get progress using GetTaskGroupStatus tool', async () => {
      const mockResult = {
        content: [
          {
            text: JSON.stringify({
              groupId: 'test-group',
              mainTask: {
                id: 'main-1',
                title: 'Main Task',
                executionStatus: { state: 'completed' },
              },
              statistics: {
                total: 5,
                pending: 1,
                ready: 1,
                running: 1,
                completed: 2,
                failed: 0,
              },
            }),
          },
        ],
      };

      mockTodoAdapter.callTool.mockResolvedValue(mockResult);

      const result = await orchestrator.getProgress('test-group');

      expect(mockTodoAdapter.callTool).toHaveBeenCalledWith(
        'GetTaskGroupStatus',
        {
          groupId: 'test-group',
        }
      );

      expect(result).toEqual({
        groupId: 'test-group',
        mainTask: {
          id: 'main-1',
          title: 'Main Task',
          completed: true,
        },
        statistics: {
          total: 5,
          pending: 1,
          ready: 1,
          running: 1,
          completed: 2,
          failed: 0,
        },
        completionPercentage: 40,
        isComplete: false,
        hasFailures: false,
      });
    });

    it('should calculate completion percentage correctly', async () => {
      const mockResult = {
        content: [
          {
            text: JSON.stringify({
              groupId: 'test-group',
              mainTask: { id: 'main-1', title: 'Main Task' },
              statistics: {
                total: 4,
                pending: 0,
                ready: 0,
                running: 0,
                completed: 4,
                failed: 0,
              },
            }),
          },
        ],
      };

      mockTodoAdapter.callTool.mockResolvedValue(mockResult);

      const result = await orchestrator.getProgress('test-group');

      expect(result.completionPercentage).toBe(100);
      expect(result.isComplete).toBe(true);
    });
  });

  describe('resetTaskForRetry', () => {
    it('should reset task using ResetTaskExecution tool', async () => {
      mockTodoAdapter.callTool.mockResolvedValue({
        content: [{ text: 'Reset complete' }],
      });

      await orchestrator.resetTaskForRetry('task-1', true);

      expect(mockTodoAdapter.callTool).toHaveBeenCalledWith(
        'ResetTaskExecution',
        {
          todoId: 'task-1',
          resetDependents: true,
        }
      );
    });

    it('should handle reset errors', async () => {
      mockTodoAdapter.callTool.mockRejectedValue(new Error('Reset failed'));

      await expect(orchestrator.resetTaskForRetry('task-1')).rejects.toThrow(
        'Unexpected error resetting task: Reset failed'
      );
    });
  });

  describe('isReady', () => {
    it('should check TodoMCPAdapter readiness using ping', async () => {
      mockTodoAdapter.ping.mockResolvedValue(true);

      const result = await orchestrator.isReady();

      expect(result).toBe(true);
      expect(mockTodoAdapter.ping).toHaveBeenCalled();
    });

    it('should return false if ping fails', async () => {
      mockTodoAdapter.ping.mockRejectedValue(new Error('Ping failed'));

      const result = await orchestrator.isReady();

      expect(result).toBe(false);
    });
  });

  describe('planTasksFromList', () => {
    it('should convert task list to task definitions and plan tasks', async () => {
      const mockResult = {
        content: [
          {
            text: JSON.stringify({
              groupId: 'test-group',
              mainTask: { id: 'main-1', title: 'Test Objective' },
              subtasks: [{ id: 'sub-1', title: 'Task 1' }],
            }),
          },
        ],
      };

      mockTodoAdapter.callTool.mockResolvedValue(mockResult);

      const taskList = [
        {
          title: 'Task 1',
          description: 'First task',
          tool: 'filesystem',
          dependsOn: [],
        },
        {
          title: 'Task 2',
          dependsOn: [0],
        },
      ];

      const result = await orchestrator.planTasksFromList(
        'Test Objective',
        taskList,
        ['constraint1']
      );

      expect(mockTodoAdapter.callTool).toHaveBeenCalledWith('CreateTaskGroup', {
        mainTask: {
          title: 'Test Objective',
          description:
            'Agentic execution: Test Objective (Constraints: constraint1)',
          tags: ['agentic', 'ai-execution', 'main-task'],
        },
        subtasks: [
          {
            title: 'Task 1',
            description: 'First task',
            tags: ['agentic', 'ai-execution'],
            dependencies: [],
            executionConfig: {
              requiredTool: 'filesystem',
              toolArgs: {},
            },
          },
          {
            title: 'Task 2',
            description: undefined,
            tags: ['agentic', 'ai-execution'],
            dependencies: [0],
            executionConfig: {
              requiredTool: 'shell',
              toolArgs: {},
            },
          },
        ],
        groupId: 'agentic-test-uuid-123',
      });

      expect(result.groupId).toBe('test-group');
    });
  });

  describe('generateBasicTaskBreakdown', () => {
    it('should generate task definitions with sequential dependencies', () => {
      const steps = ['Step 1', 'Step 2', 'Step 3'];
      const result = AgenticOrchestrator.generateBasicTaskBreakdown(
        'Test Objective',
        steps
      );

      expect(result).toEqual([
        {
          title: 'Step 1',
          description: 'Step 1: Step 1',
          tool: 'shell',
          dependencyIndices: [],
        },
        {
          title: 'Step 2',
          description: 'Step 2: Step 2',
          tool: 'shell',
          dependencyIndices: [0],
        },
        {
          title: 'Step 3',
          description: 'Step 3: Step 3',
          tool: 'shell',
          dependencyIndices: [1],
        },
      ]);
    });
  });
});
