import { TodoMCPAdapter } from '../mcp/todo-adapter.js';
import { MCPToolError } from '../mcp/base.js';

export interface RecoveryStrategy {
  action: 'retry' | 'continue_others' | 'user_intervention' | 'abort_group';
  taskId?: string;
  message?: string;
  retryCount?: number;
  suggestedActions?: string[];
}

export interface ErrorClassification {
  type: 'transient' | 'configuration' | 'dependency' | 'fatal';
  retryable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
}

/**
 * AgenticErrorHandler - Manages error recovery and failure scenarios in agentic execution
 *
 * This class provides:
 * 1. Error classification to determine appropriate recovery strategies
 * 2. Task retry logic using TodoMCPAdapter's ResetTaskExecution
 * 3. Dependency cascade failure handling
 * 4. User intervention recommendations
 * 5. Group-level recovery decisions
 */
export class AgenticErrorHandler {
  private todoAdapter: TodoMCPAdapter;
  private maxRetryAttempts: number;
  private retryDelay: number;

  constructor(
    todoAdapter: TodoMCPAdapter,
    maxRetryAttempts: number = 3,
    retryDelay: number = 1000
  ) {
    this.todoAdapter = todoAdapter;
    this.maxRetryAttempts = maxRetryAttempts;
    this.retryDelay = retryDelay;
  }

  /**
   * Handle a task failure and determine recovery strategy
   * Uses TodoMCPAdapter tools to analyze and recover from failures
   */
  async handleTaskFailure(
    taskId: string,
    error: Error,
    groupId: string,
    currentAttempt: number = 0
  ): Promise<RecoveryStrategy> {
    try {
      // Classify the error to determine recovery approach
      const errorClassification = this.classifyError(error);

      // Check if task is retryable and within retry limits
      if (
        errorClassification.retryable &&
        currentAttempt < this.maxRetryAttempts
      ) {
        return await this.handleRetryableError(
          taskId,
          error,
          currentAttempt + 1
        );
      }

      // Check if we can continue with other independent tasks
      const canContinueWithOthers = await this.canContinueWithOtherTasks(
        taskId,
        groupId
      );

      if (canContinueWithOthers) {
        return {
          action: 'continue_others',
          message: `Task "${taskId}" failed but other independent tasks can continue`,
          suggestedActions: [
            'monitor remaining task execution',
            'address failed task separately',
            'consider manual intervention for failed task',
          ],
        };
      }

      // Determine if this is a critical failure that should abort the group
      if (errorClassification.severity === 'critical') {
        return {
          action: 'abort_group',
          message: `Critical failure in task "${taskId}": ${error.message}`,
          suggestedActions: [
            'review error logs',
            'fix underlying issue',
            'restart execution plan',
          ],
        };
      }

      // Default to user intervention
      return {
        action: 'user_intervention',
        taskId,
        message: `Task "${taskId}" requires user intervention: ${error.message}`,
        suggestedActions: this.generateSuggestedActions(errorClassification),
      };
    } catch (handlerError) {
      // If error handling itself fails, return safe default
      return {
        action: 'user_intervention',
        taskId,
        message: `Error handling failed: ${handlerError}. Original error: ${error.message}`,
        suggestedActions: ['Review system logs', 'Contact support'],
      };
    }
  }

  /**
   * Handle retryable errors using TodoMCPAdapter's ResetTaskExecution
   */
  private async handleRetryableError(
    taskId: string,
    error: Error,
    attemptNumber: number
  ): Promise<RecoveryStrategy> {
    try {
      // Add delay before retry (exponential backoff)
      const delay = this.retryDelay * Math.pow(2, attemptNumber - 1);
      await this.sleep(delay);

      // Reset the task for retry using TodoMCPAdapter
      await this.todoAdapter.callTool('ResetTaskExecution', {
        todoId: taskId,
        resetDependents: false, // Only reset this task, not dependents
      });

      return {
        action: 'retry',
        taskId,
        retryCount: attemptNumber,
        message: `Retrying task "${taskId}" (attempt ${attemptNumber}/${this.maxRetryAttempts})`,
        suggestedActions: [
          'monitor retry execution',
          'check if error persists after retry',
          'consider manual intervention if retries fail',
        ],
      };
    } catch (resetError) {
      // If reset fails, escalate to user intervention
      return {
        action: 'user_intervention',
        taskId,
        message: `Failed to reset task for retry: ${resetError}. Original error: ${error.message}`,
        suggestedActions: [
          'check todomcpadapter connection',
          'manual task reset',
        ],
      };
    }
  }

  /**
   * Check if other tasks in the group can continue despite this failure
   * Uses GetTaskGroupStatus to analyze dependency relationships
   */
  private async canContinueWithOtherTasks(
    failedTaskId: string,
    groupId: string
  ): Promise<boolean> {
    try {
      const result = await this.todoAdapter.callTool('GetTaskGroupStatus', {
        groupId,
      });

      const statusData = JSON.parse(result.content[0]?.text || '{}');
      const allTasks = statusData.tasks || [];

      // Find tasks that don't depend on the failed task
      allTasks.filter((task: any) => {
        // Skip the failed task itself
        if (task.id === failedTaskId) return false;

        // Skip already completed or running tasks
        if (['completed', 'running'].includes(task.executionStatus?.state)) {
          return false;
        }

        // Check if task depends on the failed task
        const dependencies = task.dependencies || [];
        return !dependencies.includes(failedTaskId);
      });

      // Check if any independent tasks are ready to execute
      const executableResult = await this.todoAdapter.callTool(
        'GetExecutableTasks',
        { groupId, limit: 10 }
      );
      const executableTasks = JSON.parse(
        executableResult.content[0]?.text || '[]'
      );

      // Return true if there are executable tasks that aren't blocked by the failure
      return executableTasks.length > 0;
    } catch (_error) {
      // If we can't determine status, err on the side of caution
      return false;
    }
  }

  /**
   * Classify error to determine appropriate handling strategy
   */
  private classifyError(error: Error): ErrorClassification {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name?.toLowerCase() || '';

    // MCP Tool errors (check first before network classification)
    if (error instanceof MCPToolError) {
      // Some MCP errors might be retryable (server temporarily down)
      const retryable =
        errorMessage.includes('server') || errorMessage.includes('connection');
      return {
        type: retryable ? 'transient' : 'fatal',
        retryable,
        severity: retryable ? 'medium' : 'high',
        category: 'mcp',
      };
    }

    // Network/connection errors (retryable)
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('econnrefused') ||
      errorName.includes('network')
    ) {
      return {
        type: 'transient',
        retryable: true,
        severity: 'medium',
        category: 'network',
      };
    }

    // File system errors (not retryable - need user intervention)
    if (
      errorMessage.includes('enoent') ||
      errorMessage.includes('file not found') ||
      errorMessage.includes('permission denied') ||
      errorMessage.includes('eacces')
    ) {
      return {
        type: 'dependency',
        retryable: false,
        severity: 'high',
        category: 'filesystem',
      };
    }

    // Configuration errors (not retryable)
    if (
      errorMessage.includes('config') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('malformed') ||
      errorMessage.includes('syntax error')
    ) {
      return {
        type: 'configuration',
        retryable: false,
        severity: 'high',
        category: 'configuration',
      };
    }

    // Resource errors
    if (
      errorMessage.includes('out of memory') ||
      errorMessage.includes('disk full')
    ) {
      // Resource errors need user intervention but aren't group-critical
      return {
        type: 'fatal',
        retryable: false,
        severity: 'high',
        category: 'resource',
      };
    }

    if (errorMessage.includes('resource temporarily unavailable')) {
      // Temporary resource issues can be retried
      return {
        type: 'transient',
        retryable: true,
        severity: 'high',
        category: 'resource',
      };
    }

    // Default classification for unknown errors
    return {
      type: 'fatal',
      retryable: false,
      severity: 'critical',
      category: 'unknown',
    };
  }

  /**
   * Generate suggested actions based on error classification
   */
  private generateSuggestedActions(
    classification: ErrorClassification
  ): string[] {
    const actions: string[] = [];

    switch (classification.category) {
      case 'network':
        actions.push('check network connectivity');
        actions.push('verify server endpoints are accessible');
        actions.push('consider increasing timeout values');
        break;

      case 'filesystem':
        actions.push('verify file paths exist');
        actions.push('check file permissions');
        actions.push('ensure required directories are created');
        break;

      case 'configuration':
        actions.push('review configuration files');
        actions.push('validate configuration syntax');
        actions.push('check environment variables');
        break;

      case 'mcp':
        actions.push('check todomcpadapter connection');
        actions.push('verify mcp server is running');
        actions.push('review mcp tool parameters');
        break;

      case 'resource':
        actions.push('free up system resources');
        actions.push('close unnecessary processes');
        actions.push('consider running with fewer parallel tasks');
        break;

      default:
        actions.push('review error logs for details');
        actions.push('check system requirements');
        actions.push('contact support if issue persists');
    }

    // Add common actions for high severity errors
    if (
      classification.severity === 'high' ||
      classification.severity === 'critical'
    ) {
      actions.push('consider pausing execution to investigate');
      actions.push('backup current progress before continuing');
    }

    return actions;
  }

  /**
   * Get comprehensive error recovery status for a group
   * Uses GetTaskGroupStatus to provide detailed recovery information
   */
  async getRecoveryStatus(groupId: string): Promise<{
    hasFailures: boolean;
    failedTasks: Array<{ id: string; title: string; error: string }>;
    recoverableTasks: number;
    blockedTasks: number;
    recommendations: string[];
  }> {
    try {
      const result = await this.todoAdapter.callTool('GetTaskGroupStatus', {
        groupId,
      });

      const statusData = JSON.parse(result.content[0]?.text || '{}');
      const allTasks = statusData.tasks || [];

      const failedTasks = allTasks.filter(
        (task: any) => task.executionStatus?.state === 'failed'
      );

      const hasFailures = failedTasks.length > 0;

      // Analyze recoverability
      let recoverableTasks = 0;
      let blockedTasks = 0;

      for (const task of failedTasks) {
        const errorMessage = task.executionStatus?.lastError || '';
        const classification = this.classifyError(new Error(errorMessage));

        if (classification.retryable) {
          recoverableTasks++;
        } else {
          // Count how many tasks are blocked by this failure
          const dependentTasks = allTasks.filter((t: any) =>
            t.dependencies?.includes(task.id)
          );
          blockedTasks += dependentTasks.length;
        }
      }

      // Generate recommendations
      const recommendations: string[] = [];
      if (recoverableTasks > 0) {
        recommendations.push(`${recoverableTasks} failed tasks can be retried`);
      }
      if (blockedTasks > 0) {
        recommendations.push(
          `${blockedTasks} tasks are blocked by failures and may need manual intervention`
        );
      }
      if (failedTasks.length === 0) {
        recommendations.push('No failures detected');
      }

      return {
        hasFailures,
        failedTasks: failedTasks.map((task: any) => ({
          id: task.id,
          title: task.title,
          error: task.executionStatus?.lastError || 'Unknown error',
        })),
        recoverableTasks,
        blockedTasks,
        recommendations,
      };
    } catch (error) {
      throw new Error(`Failed to get recovery status: ${error}`);
    }
  }

  /**
   * Reset all failed tasks in a group for batch retry
   * Uses ResetTaskExecution with resetDependents option
   */
  async resetFailedTasks(
    groupId: string,
    resetDependents: boolean = true
  ): Promise<{ resetCount: number; errors: string[] }> {
    try {
      const recoveryStatus = await this.getRecoveryStatus(groupId);
      const errors: string[] = [];
      let resetCount = 0;

      for (const failedTask of recoveryStatus.failedTasks) {
        try {
          await this.todoAdapter.callTool('ResetTaskExecution', {
            todoId: failedTask.id,
            resetDependents,
          });
          resetCount++;
        } catch (resetError) {
          errors.push(
            `Failed to reset task ${failedTask.title}: ${resetError}`
          );
        }
      }

      return { resetCount, errors };
    } catch (error) {
      throw new Error(`Batch reset failed: ${error}`);
    }
  }

  /**
   * Utility method for sleep/delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Configure retry behavior
   */
  setRetryConfiguration(maxAttempts: number, baseDelay: number): void {
    this.maxRetryAttempts = maxAttempts;
    this.retryDelay = baseDelay;
  }
}
