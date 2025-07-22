import { TodoMCPAdapter } from '../mcp/todo-adapter.js';
import { MCPToolError } from '../mcp/base.js';
import { v4 as uuid } from 'uuid';

export interface TaskPlan {
  groupId: string;
  taskCount: number;
  mainTaskId: string;
}

export interface ExecutableTask {
  id: string;
  title: string;
  description?: string;
  tool?: string;
  toolArgs?: Record<string, unknown>;
}

export interface TaskDefinition {
  title: string;
  description?: string;
  tool?: string;
  toolArgs?: Record<string, unknown>;
  dependencyIndices: number[];
}

export interface AgenticProgress {
  groupId: string;
  mainTask: {
    id: string;
    title: string;
    completed: boolean;
  };
  statistics: {
    total: number;
    pending: number;
    ready: number;
    running: number;
    completed: number;
    failed: number;
  };
  completionPercentage: number;
  isComplete: boolean;
  hasFailures: boolean;
}

/**
 * AgenticOrchestrator - The bridge between LLM objectives and TodoMCPAdapter task management
 *
 * This class enables agentic AI execution by:
 * 1. Converting high-level objectives into structured task breakdowns
 * 2. Managing task dependencies and execution order via TodoMCPAdapter
 * 3. Providing progress tracking and error recovery
 * 4. Ensuring all operations use TodoMCPAdapter for state consistency
 */
export class AgenticOrchestrator {
  private todoAdapter: TodoMCPAdapter;

  constructor(todoAdapter: TodoMCPAdapter) {
    this.todoAdapter = todoAdapter;
  }

  /**
   * Creates a task breakdown and registers it in the todo system
   * Uses CreateTaskGroup tool to establish task hierarchy with dependencies
   */
  async planTasks(
    objective: string,
    tasks: TaskDefinition[],
    constraints?: string[]
  ): Promise<TaskPlan> {
    try {
      // Generate a unique group ID for this execution plan
      const groupId = `agentic-${uuid()}`;

      // Convert task definitions to TodoMCPAdapter format
      const subtasks = tasks.map(task => {
        const subtask: any = {
          title: task.title,
          tags: ['agentic', 'ai-execution'],
          dependencies: task.dependencyIndices,
          executionConfig: {
            requiredTool: task.tool,
            toolArgs: task.toolArgs,
          },
        };
        if (task.description !== undefined) {
          subtask.description = task.description;
        }
        return subtask;
      });

      // Create task group using TodoMCPAdapter
      const result = await this.todoAdapter.callTool('CreateTaskGroup', {
        mainTask: {
          title: objective,
          description: `Agentic execution: ${objective}${
            constraints ? ` (Constraints: ${constraints.join(', ')})` : ''
          }`,
          tags: ['agentic', 'ai-execution', 'main-task'],
        },
        subtasks,
        groupId,
      });

      // Parse the result to extract task information
      const createdData = JSON.parse(result.content[0]?.text || '{}');

      return {
        groupId,
        taskCount: subtasks.length + 1, // +1 for main task
        mainTaskId: createdData.mainTask.id,
      };
    } catch (error) {
      if (error instanceof MCPToolError) {
        // Extract the actual error message from MCPToolError format: "Tool 'name' error: message"
        const actualMessage = error.message.split(': ').slice(1).join(': ');
        throw new Error(`Failed to plan tasks: ${actualMessage}`);
      }
      throw new Error(`Unexpected error during task planning: ${error}`);
    }
  }

  /**
   * Gets next task from todo system that's ready to execute
   * Uses GetExecutableTasks to find tasks with resolved dependencies
   */
  async getNextExecutableTask(groupId: string): Promise<ExecutableTask | null> {
    try {
      const result = await this.todoAdapter.callTool('GetExecutableTasks', {
        groupId,
        limit: 1,
      });

      const executableTasks = JSON.parse(result.content[0]?.text || '[]');

      if (!Array.isArray(executableTasks) || executableTasks.length === 0) {
        return null; // No tasks ready for execution
      }

      const todo = executableTasks[0];
      return {
        id: todo.id,
        title: todo.title,
        description: todo.description,
        tool: todo.executionConfig?.requiredTool,
        toolArgs: todo.executionConfig?.toolArgs,
      };
    } catch (error) {
      if (error instanceof MCPToolError) {
        throw new Error(`Failed to get next executable task: ${error.message}`);
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Unexpected error getting executable task: ${errorMessage}`);
    }
  }

  /**
   * Updates task status in todo system after execution
   * Uses UpdateExecutionStatus to manage task state transitions
   */
  async updateTaskStatus(
    taskId: string,
    status: 'pending' | 'ready' | 'running' | 'completed' | 'failed',
    error?: string
  ): Promise<void> {
    try {
      await this.todoAdapter.callTool('UpdateExecutionStatus', {
        taskId,
        status,
        error,
      });
    } catch (mcpError) {
      if (mcpError instanceof MCPToolError) {
        // Extract the actual error message from MCPToolError format: "Tool 'name' error: message"
        const actualMessage = mcpError.message.split(': ').slice(1).join(': ');
        throw new Error(`Failed to update task status: ${actualMessage}`);
      }
      throw new Error(`Unexpected error updating task status: ${mcpError}`);
    }
  }

  /**
   * Gets comprehensive progress information for a task group
   * Uses GetTaskGroupStatus to provide detailed progress metrics
   */
  async getProgress(groupId: string): Promise<AgenticProgress> {
    try {
      const result = await this.todoAdapter.callTool('GetTaskGroupStatus', {
        groupId,
      });

      const statusData = JSON.parse(result.content[0]?.text || '{}');

      const completionPercentage =
        statusData.statistics.total > 0
          ? Math.round(
              (statusData.statistics.completed / statusData.statistics.total) *
                100
            )
          : 0;

      const isComplete =
        statusData.statistics.completed === statusData.statistics.total &&
        statusData.statistics.total > 0;

      const hasFailures = statusData.statistics.failed > 0;

      return {
        groupId,
        mainTask: {
          id: statusData.mainTask?.id || '',
          title: statusData.mainTask?.title || 'Unknown',
          completed:
            statusData.mainTask?.executionStatus?.state === 'completed',
        },
        statistics: statusData.statistics,
        completionPercentage,
        isComplete,
        hasFailures,
      };
    } catch (error) {
      if (error instanceof MCPToolError) {
        throw new Error(`Failed to get progress: ${error.message}`);
      }
      throw new Error(`Unexpected error getting progress: ${error}`);
    }
  }

  /**
   * Resets a failed task for retry using TodoMCPAdapter's recovery tools
   * Uses ResetTaskExecution to enable task retry scenarios
   */
  async resetTaskForRetry(
    taskId: string,
    resetDependents: boolean = false
  ): Promise<void> {
    try {
      await this.todoAdapter.callTool('ResetTaskExecution', {
        todoId: taskId,
        resetDependents,
      });
    } catch (error) {
      if (error instanceof MCPToolError) {
        throw new Error(`Failed to reset task: ${error.message}`);
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Unexpected error resetting task: ${errorMessage}`);
    }
  }

  /**
   * Utility method to check if TodoMCPAdapter is connected and ready
   */
  async isReady(): Promise<boolean> {
    try {
      return await this.todoAdapter.ping();
    } catch {
      return false;
    }
  }

  /**
   * Creates a simple task breakdown from objectives (for when templates aren't used)
   * This is a utility method that provides basic task generation
   */
  static generateBasicTaskBreakdown(
    _objective: string,
    steps: string[]
  ): TaskDefinition[] {
    return steps.map((step, index) => ({
      title: step,
      description: `Step ${index + 1}: ${step}`,
      tool: 'shell', // Default tool, should be overridden based on actual needs
      dependencyIndices: index > 0 ? [index - 1] : [], // Each step depends on the previous
    }));
  }

  /**
   * Convenience method that combines planning and execution startup
   */
  async planTasksFromList(
    objective: string,
    taskList: Array<{
      title: string;
      description?: string;
      tool?: string;
      dependsOn?: number[];
    }>,
    constraints?: string[]
  ): Promise<TaskPlan> {
    const tasks: TaskDefinition[] = taskList.map(task => {
      const taskDef: TaskDefinition = {
        title: task.title,
        tool: task.tool || 'shell',
        toolArgs: {},
        dependencyIndices: task.dependsOn || [],
      };
      if (task.description !== undefined) {
        taskDef.description = task.description;
      }
      return taskDef;
    });

    return this.planTasks(objective, tasks, constraints);
  }
}
