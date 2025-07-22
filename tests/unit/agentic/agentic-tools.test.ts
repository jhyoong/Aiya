import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgenticToolHandler } from '../../../src/core/agentic/AgenticToolHandler.js';
import { AgenticOrchestrator } from '../../../src/core/agentic/AgenticOrchestrator.js';
import { AGENTIC_TOOLS } from '../../../src/core/agentic/AgenticTools.js';
import { ToolCall } from '../../../src/types/ProviderTypes.js';

// Mock the AgenticOrchestrator
vi.mock('../../../src/core/agentic/AgenticOrchestrator.js', () => {
  const mockOrchestrator = {
    planTasks: vi.fn(),
    getNextExecutableTask: vi.fn(),
    updateTaskStatus: vi.fn(),
    getProgress: vi.fn(),
  };
  return {
    AgenticOrchestrator: vi.fn(() => mockOrchestrator),
  };
});

describe('AgenticToolHandler', () => {
  let toolHandler: AgenticToolHandler;
  let mockOrchestrator: any;

  beforeEach(() => {
    mockOrchestrator = new (AgenticOrchestrator as any)();
    toolHandler = new AgenticToolHandler(mockOrchestrator);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Tool Definition Validation', () => {
    it('should expose all 5 agentic tools', () => {
      expect(AGENTIC_TOOLS).toHaveLength(5);
      expect(AGENTIC_TOOLS.map(tool => tool.name)).toEqual([
        'agentic_planTasks',
        'agentic_executeNext',
        'agentic_completeTask',
        'agentic_failTask',
        'agentic_checkProgress'
      ]);
    });

    it('should have proper tool parameter schemas', () => {
      const planTasksTool = AGENTIC_TOOLS.find(tool => tool.name === 'agentic_planTasks');
      expect(planTasksTool?.parameters.required).toEqual(['objective', 'tasks']);
      expect(planTasksTool?.parameters.properties.objective).toBeDefined();
      expect(planTasksTool?.parameters.properties.tasks).toBeDefined();
    });

    it('should identify agentic tools correctly', () => {
      expect(AgenticToolHandler.isAgenticTool('agentic_planTasks')).toBe(true);
      expect(AgenticToolHandler.isAgenticTool('agentic_executeNext')).toBe(true);
      expect(AgenticToolHandler.isAgenticTool('unknown_tool')).toBe(false);
      expect(AgenticToolHandler.isAgenticTool('filesystem_create')).toBe(false);
    });

    it('should return supported tool list', () => {
      const supportedTools = AgenticToolHandler.getSupportedTools();
      expect(supportedTools).toEqual([
        'agentic_planTasks',
        'agentic_executeNext',
        'agentic_completeTask',
        'agentic_failTask',
        'agentic_checkProgress'
      ]);
    });
  });

  describe('agentic_planTasks', () => {
    it('should create execution plan with valid task list', async () => {
      const mockPlan = {
        groupId: 'test-group-123',
        taskCount: 3,
        mainTaskId: 'main-task-1'
      };

      mockOrchestrator.planTasks.mockResolvedValue(mockPlan);

      const toolCall: ToolCall = {
        id: 'call-1',
        name: 'agentic_planTasks',
        arguments: {
          objective: 'Create a simple web server',
          tasks: [
            {
              title: 'Initialize project',
              description: 'Create package.json',
              tool: 'shell',
              dependsOn: []
            },
            {
              title: 'Install Express',
              description: 'Add Express dependency',
              tool: 'shell',
              dependsOn: [0]
            }
          ],
          constraints: ['Use TypeScript']
        }
      };

      const result = await toolHandler.handleToolCall(toolCall);

      expect(result.isError).toBe(false);
      expect(result.toolCallId).toBe('call-1');
      
      const response = JSON.parse(result.result);
      expect(response.success).toBe(true);
      expect(response.groupId).toBe('test-group-123');
      expect(response.taskCount).toBe(3);
      expect(response.message).toContain('test-group-123');

      expect(mockOrchestrator.planTasks).toHaveBeenCalledWith(
        'Create a simple web server',
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Initialize project',
            description: 'Create package.json',
            tool: 'shell',
            dependencyIndices: []
          }),
          expect.objectContaining({
            title: 'Install Express',
            description: 'Add Express dependency',
            tool: 'shell',
            dependencyIndices: [0]
          })
        ]),
        ['Use TypeScript']
      );
    });

    it('should reject invalid objective parameter', async () => {
      const toolCall: ToolCall = {
        id: 'call-1',
        name: 'agentic_planTasks',
        arguments: {
          tasks: [{ title: 'Test', dependsOn: [] }]
          // Missing objective
        }
      };

      const result = await toolHandler.handleToolCall(toolCall);

      expect(result.isError).toBe(true);
      expect(result.result).toContain('objective parameter is required');
    });

    it('should reject empty task list', async () => {
      const toolCall: ToolCall = {
        id: 'call-1',
        name: 'agentic_planTasks',
        arguments: {
          objective: 'Test objective',
          tasks: []
        }
      };

      const result = await toolHandler.handleToolCall(toolCall);

      expect(result.isError).toBe(true);
      expect(result.result).toContain('tasks parameter is required and must be a non-empty array');
    });

    it('should handle orchestrator errors gracefully', async () => {
      mockOrchestrator.planTasks.mockRejectedValue(new Error('Connection failed'));

      const toolCall: ToolCall = {
        id: 'call-1',
        name: 'agentic_planTasks',
        arguments: {
          objective: 'Test objective',
          tasks: [{ title: 'Test', dependsOn: [] }]
        }
      };

      const result = await toolHandler.handleToolCall(toolCall);

      expect(result.isError).toBe(true);
      expect(result.result).toContain('Error executing agentic_planTasks: Connection failed');
    });
  });

  describe('agentic_executeNext', () => {
    it('should get next executable task', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Initialize project',
        description: 'Create package.json',
        executionConfig: {
          requiredTool: 'shell',
          toolArgs: { command: 'npm init -y' }
        }
      };

      mockOrchestrator.getNextExecutableTask.mockResolvedValue(mockTask);
      mockOrchestrator.updateTaskStatus.mockResolvedValue(undefined);

      const toolCall: ToolCall = {
        id: 'call-1',
        name: 'agentic_executeNext',
        arguments: {
          groupId: 'test-group-123'
        }
      };

      const result = await toolHandler.handleToolCall(toolCall);

      expect(result.isError).toBe(false);
      
      const response = JSON.parse(result.result);
      expect(response.success).toBe(true);
      expect(response.complete).toBe(false);
      expect(response.task.taskId).toBe('task-1');
      expect(response.task.title).toBe('Initialize project');
      expect(response.task.tool).toBe('shell');

      // Should mark task as running
      expect(mockOrchestrator.updateTaskStatus).toHaveBeenCalledWith('task-1', 'running');
    });

    it('should return completion message when no tasks available', async () => {
      mockOrchestrator.getNextExecutableTask.mockResolvedValue(null);

      const toolCall: ToolCall = {
        id: 'call-1',
        name: 'agentic_executeNext',
        arguments: {
          groupId: 'test-group-123'
        }
      };

      const result = await toolHandler.handleToolCall(toolCall);

      expect(result.isError).toBe(false);
      
      const response = JSON.parse(result.result);
      expect(response.success).toBe(true);
      expect(response.complete).toBe(true);
      expect(response.task).toBe(null);
      expect(response.message).toContain('All tasks completed');
    });

    it('should reject missing groupId parameter', async () => {
      const toolCall: ToolCall = {
        id: 'call-1',
        name: 'agentic_executeNext',
        arguments: {}
      };

      const result = await toolHandler.handleToolCall(toolCall);

      expect(result.isError).toBe(true);
      expect(result.result).toContain('groupId parameter is required');
    });
  });

  describe('agentic_completeTask', () => {
    it('should mark task as completed', async () => {
      mockOrchestrator.updateTaskStatus.mockResolvedValue(undefined);

      const toolCall: ToolCall = {
        id: 'call-1',
        name: 'agentic_completeTask',
        arguments: {
          taskId: 'task-1',
          result: 'Project initialized successfully'
        }
      };

      const result = await toolHandler.handleToolCall(toolCall);

      expect(result.isError).toBe(false);
      
      const response = JSON.parse(result.result);
      expect(response.success).toBe(true);
      expect(response.taskId).toBe('task-1');
      expect(response.status).toBe('completed');
      expect(response.result).toBe('Project initialized successfully');

      expect(mockOrchestrator.updateTaskStatus).toHaveBeenCalledWith('task-1', 'completed');
    });

    it('should handle completion without result description', async () => {
      mockOrchestrator.updateTaskStatus.mockResolvedValue(undefined);

      const toolCall: ToolCall = {
        id: 'call-1',
        name: 'agentic_completeTask',
        arguments: {
          taskId: 'task-1'
        }
      };

      const result = await toolHandler.handleToolCall(toolCall);

      expect(result.isError).toBe(false);
      
      const response = JSON.parse(result.result);
      expect(response.result).toBe('Task completed successfully');
    });

    it('should reject missing taskId parameter', async () => {
      const toolCall: ToolCall = {
        id: 'call-1',
        name: 'agentic_completeTask',
        arguments: {}
      };

      const result = await toolHandler.handleToolCall(toolCall);

      expect(result.isError).toBe(true);
      expect(result.result).toContain('taskId parameter is required');
    });
  });

  describe('agentic_failTask', () => {
    it('should mark task as failed with error details', async () => {
      mockOrchestrator.updateTaskStatus.mockResolvedValue(undefined);

      const toolCall: ToolCall = {
        id: 'call-1',
        name: 'agentic_failTask',
        arguments: {
          taskId: 'task-1',
          error: 'Command not found: npm',
          retryable: true
        }
      };

      const result = await toolHandler.handleToolCall(toolCall);

      expect(result.isError).toBe(false);
      
      const response = JSON.parse(result.result);
      expect(response.success).toBe(true);
      expect(response.taskId).toBe('task-1');
      expect(response.status).toBe('failed');
      expect(response.error).toBe('Command not found: npm');
      expect(response.retryable).toBe(true);

      expect(mockOrchestrator.updateTaskStatus).toHaveBeenCalledWith(
        'task-1', 
        'failed', 
        'Command not found: npm'
      );
    });

    it('should default retryable to true', async () => {
      mockOrchestrator.updateTaskStatus.mockResolvedValue(undefined);

      const toolCall: ToolCall = {
        id: 'call-1',
        name: 'agentic_failTask',
        arguments: {
          taskId: 'task-1',
          error: 'Test error'
        }
      };

      const result = await toolHandler.handleToolCall(toolCall);

      expect(result.isError).toBe(false);
      
      const response = JSON.parse(result.result);
      expect(response.retryable).toBe(true);
    });

    it('should reject missing error parameter', async () => {
      const toolCall: ToolCall = {
        id: 'call-1',
        name: 'agentic_failTask',
        arguments: {
          taskId: 'task-1'
          // Missing error
        }
      };

      const result = await toolHandler.handleToolCall(toolCall);

      expect(result.isError).toBe(true);
      expect(result.result).toContain('error parameter is required');
    });
  });

  describe('agentic_checkProgress', () => {
    it('should return progress information', async () => {
      const mockProgress = {
        groupId: 'test-group-123',
        mainTask: {
          title: 'Create web server',
          executionStatus: { state: 'running' }
        },
        statistics: {
          total: 5,
          pending: 1,
          ready: 1, 
          running: 1,
          completed: 2,
          failed: 0
        },
        isComplete: false,
        hasFailures: false,
        tasks: [
          {
            id: 'task-1',
            title: 'Task 1', 
            executionStatus: { state: 'completed' }
          },
          {
            id: 'task-2',
            title: 'Task 2',
            executionStatus: { state: 'running' }
          }
        ]
      };

      mockOrchestrator.getProgress.mockResolvedValue(mockProgress);

      const toolCall: ToolCall = {
        id: 'call-1',
        name: 'agentic_checkProgress',
        arguments: {
          groupId: 'test-group-123',
          includeDetails: true
        }
      };

      const result = await toolHandler.handleToolCall(toolCall);

      expect(result.isError).toBe(false);
      
      const response = JSON.parse(result.result);
      expect(response.success).toBe(true);
      expect(response.groupId).toBe('test-group-123');
      expect(response.mainTask.title).toBe('Create web server');
      expect(response.statistics.total).toBe(5);
      expect(response.statistics.completed).toBe(2);
      expect(response.progressPercentage).toBe(40);
      expect(response.isComplete).toBe(false);
      expect(response.hasFailures).toBe(false);
      expect(response.tasks).toHaveLength(2);
      expect(response.message).toContain('2/5 tasks completed (40%)');
    });

    it('should show completion message for finished execution', async () => {
      const mockProgress = {
        groupId: 'test-group-123',
        mainTask: { title: 'Create web server' },
        statistics: {
          total: 3,
          completed: 3,
          pending: 0,
          ready: 0,
          running: 0,
          failed: 0
        },
        isComplete: true,
        hasFailures: false
      };

      mockOrchestrator.getProgress.mockResolvedValue(mockProgress);

      const toolCall: ToolCall = {
        id: 'call-1',
        name: 'agentic_checkProgress',
        arguments: {
          groupId: 'test-group-123'
        }
      };

      const result = await toolHandler.handleToolCall(toolCall);

      expect(result.isError).toBe(false);
      
      const response = JSON.parse(result.result);
      expect(response.isComplete).toBe(true);
      expect(response.progressPercentage).toBe(100);
      expect(response.message).toContain('Execution complete! All 3 tasks finished successfully');
    });

    it('should include failure information when tasks failed', async () => {
      const mockProgress = {
        groupId: 'test-group-123',
        mainTask: { title: 'Create web server' },
        statistics: {
          total: 4,
          completed: 2,
          pending: 0,
          ready: 0,
          running: 0,
          failed: 2
        },
        isComplete: false,
        hasFailures: true
      };

      mockOrchestrator.getProgress.mockResolvedValue(mockProgress);

      const toolCall: ToolCall = {
        id: 'call-1',
        name: 'agentic_checkProgress',
        arguments: {
          groupId: 'test-group-123'
        }
      };

      const result = await toolHandler.handleToolCall(toolCall);

      expect(result.isError).toBe(false);
      
      const response = JSON.parse(result.result);
      expect(response.hasFailures).toBe(true);
      expect(response.message).toContain('2 task(s) failed and need attention');
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tool names', async () => {
      const toolCall: ToolCall = {
        id: 'call-1',
        name: 'unknown_tool',
        arguments: {}
      };

      const result = await toolHandler.handleToolCall(toolCall);

      expect(result.isError).toBe(true);
      expect(result.result).toContain("Unknown agentic tool 'unknown_tool'");
    });

    it('should handle orchestrator errors in all tools', async () => {
      const error = new Error('Database connection lost');
      mockOrchestrator.getProgress.mockRejectedValue(error);

      const toolCall: ToolCall = {
        id: 'call-1',
        name: 'agentic_checkProgress',
        arguments: {
          groupId: 'test-group'
        }
      };

      const result = await toolHandler.handleToolCall(toolCall);

      expect(result.isError).toBe(true);
      expect(result.result).toContain('Error executing agentic_checkProgress: Database connection lost');
    });
  });

  describe('Class Methods', () => {
    it('should provide orchestrator access', () => {
      const orchestrator = toolHandler.getOrchestrator();
      expect(orchestrator).toBe(mockOrchestrator);
    });
  });
});