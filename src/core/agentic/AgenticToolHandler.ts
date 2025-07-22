import { AgenticOrchestrator, TaskDefinition } from './AgenticOrchestrator.js';
import { ToolCall, ToolResult } from '../providers/base.js';
import { AGENTIC_TOOLS, AgenticTaskDefinition } from './AgenticTools.js';

/**
 * Handler for agentic execution tools that bridges LLM tool calls to AgenticOrchestrator operations
 * 
 * This class provides the runtime implementation for the agentic tools defined in AgenticTools.ts,
 * translating LLM tool calls into appropriate AgenticOrchestrator method calls and formatting
 * responses for LLM consumption.
 */
export class AgenticToolHandler {
  private orchestrator: AgenticOrchestrator;

  constructor(orchestrator: AgenticOrchestrator) {
    this.orchestrator = orchestrator;
  }

  /**
   * Handle a tool call from an LLM and execute the appropriate agentic operation
   */
  async handleToolCall(toolCall: ToolCall): Promise<ToolResult> {
    try {
      switch (toolCall.name) {
        case 'agentic_planTasks':
          return await this.handlePlanTasks(toolCall);
        
        case 'agentic_executeNext':
          return await this.handleExecuteNext(toolCall);
        
        case 'agentic_completeTask':
          return await this.handleCompleteTask(toolCall);
        
        case 'agentic_failTask':
          return await this.handleFailTask(toolCall);
        
        case 'agentic_checkProgress':
          return await this.handleCheckProgress(toolCall);
        
        default:
          return {
            toolCallId: toolCall.id,
            result: `Error: Unknown agentic tool '${toolCall.name}'`,
            isError: true
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        toolCallId: toolCall.id,
        result: `Error executing ${toolCall.name}: ${errorMessage}`,
        isError: true
      };
    }
  }

  /**
   * Create an execution plan from LLM-provided objective and task list
   */
  private async handlePlanTasks(toolCall: ToolCall): Promise<ToolResult> {
    const { objective, tasks, constraints } = toolCall.arguments;

    // Validate required parameters
    if (!objective || typeof objective !== 'string') {
      return {
        toolCallId: toolCall.id,
        result: 'Error: objective parameter is required and must be a string',
        isError: true
      };
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return {
        toolCallId: toolCall.id,
        result: 'Error: tasks parameter is required and must be a non-empty array',
        isError: true
      };
    }

    // Convert LLM task format to AgenticOrchestrator format
    const taskDefinitions: TaskDefinition[] = (tasks as unknown as AgenticTaskDefinition[]).map((task: AgenticTaskDefinition, index: number) => {
      if (!task.title || typeof task.title !== 'string') {
        throw new Error(`Task ${index}: title is required and must be a string`);
      }

      if (!Array.isArray(task.dependsOn)) {
        throw new Error(`Task ${index}: dependsOn must be an array`);
      }

      return {
        title: task.title,
        description: task.description || `Task ${index + 1}: ${task.title}`,
        tool: task.tool || 'shell',
        toolArgs: {}, // LLM will handle tool-specific arguments during execution
        dependencyIndices: task.dependsOn
      };
    });

    // Create execution plan using AgenticOrchestrator
    const plan = await this.orchestrator.planTasks(
      objective,
      taskDefinitions,
      Array.isArray(constraints) ? constraints as unknown as string[] : undefined
    );

    const response = {
      success: true,
      groupId: plan.groupId,
      taskCount: plan.taskCount,
      mainTaskId: plan.mainTaskId,
      message: `Created execution plan with ${plan.taskCount} tasks. Use groupId '${plan.groupId}' to execute tasks.`
    };

    return {
      toolCallId: toolCall.id,
      result: JSON.stringify(response, null, 2),
      isError: false
    };
  }

  /**
   * Get the next task ready for execution from the todo system
   */
  private async handleExecuteNext(toolCall: ToolCall): Promise<ToolResult> {
    const { groupId } = toolCall.arguments;

    if (!groupId || typeof groupId !== 'string') {
      return {
        toolCallId: toolCall.id,
        result: 'Error: groupId parameter is required and must be a string',
        isError: true
      };
    }

    const task = await this.orchestrator.getNextExecutableTask(groupId);

    if (!task) {
      const response = {
        success: true,
        complete: true,
        task: null,
        message: 'All tasks completed! No more tasks to execute.'
      };

      return {
        toolCallId: toolCall.id,
        result: JSON.stringify(response, null, 2),
        isError: false
      };
    }

    // Mark task as running when retrieved
    await this.orchestrator.updateTaskStatus(task.id, 'running');

    const response = {
      success: true,
      complete: false,
      task: {
        taskId: task.id,
        title: task.title,
        description: task.description,
        tool: task.executionConfig?.requiredTool || 'shell',
        toolArgs: task.executionConfig?.toolArgs || {}
      },
      message: `Execute: ${task.title}`
    };

    return {
      toolCallId: toolCall.id,
      result: JSON.stringify(response, null, 2),
      isError: false
    };
  }

  /**
   * Mark a task as successfully completed
   */
  private async handleCompleteTask(toolCall: ToolCall): Promise<ToolResult> {
    const { taskId, result: taskResult } = toolCall.arguments;

    if (!taskId || typeof taskId !== 'string') {
      return {
        toolCallId: toolCall.id,
        result: 'Error: taskId parameter is required and must be a string',
        isError: true
      };
    }

    await this.orchestrator.updateTaskStatus(taskId, 'completed');

    const response = {
      success: true,
      taskId,
      status: 'completed',
      result: taskResult || 'Task completed successfully',
      message: `Task ${taskId} marked as completed`
    };

    return {
      toolCallId: toolCall.id,
      result: JSON.stringify(response, null, 2),
      isError: false
    };
  }

  /**
   * Mark a task as failed with error details
   */
  private async handleFailTask(toolCall: ToolCall): Promise<ToolResult> {
    const { taskId, error, retryable = true } = toolCall.arguments;

    if (!taskId || typeof taskId !== 'string') {
      return {
        toolCallId: toolCall.id,
        result: 'Error: taskId parameter is required and must be a string',
        isError: true
      };
    }

    if (!error || typeof error !== 'string') {
      return {
        toolCallId: toolCall.id,
        result: 'Error: error parameter is required and must be a string',
        isError: true
      };
    }

    await this.orchestrator.updateTaskStatus(taskId, 'failed', error);

    const response = {
      success: true,
      taskId,
      status: 'failed',
      error,
      retryable: Boolean(retryable),
      message: `Task ${taskId} marked as failed: ${error}${retryable ? ' (retryable)' : ' (not retryable)'}`
    };

    return {
      toolCallId: toolCall.id,
      result: JSON.stringify(response, null, 2),
      isError: false
    };
  }

  /**
   * Check execution progress and status of a task group
   */
  private async handleCheckProgress(toolCall: ToolCall): Promise<ToolResult> {
    const { groupId, includeDetails = false } = toolCall.arguments;

    if (!groupId || typeof groupId !== 'string') {
      return {
        toolCallId: toolCall.id,
        result: 'Error: groupId parameter is required and must be a string',
        isError: true
      };
    }

    const progress = await this.orchestrator.getProgress(groupId);

    // Build response based on includeDetails flag
    const response: any = {
      success: true,
      groupId: progress.groupId,
      mainTask: {
        title: progress.mainTask.title,
        status: progress.mainTask.executionStatus?.state || 'pending'
      },
      statistics: progress.statistics,
      isComplete: progress.isComplete,
      hasFailures: progress.hasFailures,
      progressPercentage: Math.round(
        (progress.statistics.completed / progress.statistics.total) * 100
      )
    };

    if (includeDetails) {
      response.tasks = progress.tasks?.map((task: any) => ({
        id: task.id,
        title: task.title,
        status: task.executionStatus?.state || 'pending',
        error: task.executionStatus?.error || null
      })) || [];
    }

    const completedTasks = progress.statistics.completed;
    const totalTasks = progress.statistics.total;
    response.message = progress.isComplete 
      ? `Execution complete! All ${totalTasks} tasks finished successfully.`
      : `Progress: ${completedTasks}/${totalTasks} tasks completed (${response.progressPercentage}%)`;

    if (progress.hasFailures) {
      const failedCount = progress.statistics.failed;
      response.message += ` - ${failedCount} task(s) failed and need attention.`;
    }

    return {
      toolCallId: toolCall.id,
      result: JSON.stringify(response, null, 2),
      isError: false
    };
  }

  /**
   * Get the list of supported agentic tools
   */
  static getSupportedTools(): string[] {
    return AGENTIC_TOOLS.map(tool => tool.name);
  }

  /**
   * Check if a tool call is an agentic tool call
   */
  static isAgenticTool(toolName: string): boolean {
    return AGENTIC_TOOLS.some(tool => tool.name === toolName);
  }

  /**
   * Get the AgenticOrchestrator instance (for testing/debugging)
   */
  getOrchestrator(): AgenticOrchestrator {
    return this.orchestrator;
  }
}