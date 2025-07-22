import { TodoMCPAdapter } from '../mcp/todo-adapter.js';
import { AgenticOrchestrator } from './AgenticOrchestrator.js';
import { TaskTemplates } from './TaskTemplates.js';
import { AgenticErrorHandler } from './AgenticErrorHandler.js';
import type {
  TaskPlan,
  ExecutableTask,
  AgenticProgress,
} from './AgenticOrchestrator.js';
import type { RecoveryStrategy } from './AgenticErrorHandler.js';

/**
 * AgenticService - High-level service for agentic AI execution
 *
 * This service provides a unified interface for agentic execution capabilities,
 * integrating the orchestrator, templates, and error handling with TodoMCPAdapter.
 * It's designed to be used by the main Aiya application and tool systems.
 */
export class AgenticService {
  private todoAdapter: TodoMCPAdapter;
  private orchestrator: AgenticOrchestrator;
  private errorHandler: AgenticErrorHandler;

  constructor(todoAdapter: TodoMCPAdapter) {
    this.todoAdapter = todoAdapter;
    this.orchestrator = new AgenticOrchestrator(todoAdapter);
    this.errorHandler = new AgenticErrorHandler(todoAdapter);
  }

  /**
   * Initialize the agentic service by ensuring TodoMCPAdapter is connected
   */
  async initialize(): Promise<void> {
    if (!this.todoAdapter.isConnected()) {
      await this.todoAdapter.connect();
    }

    // Verify TodoMCPAdapter is ready
    const isReady = await this.orchestrator.isReady();
    if (!isReady) {
      throw new Error('TodoMCPAdapter is not ready for agentic execution');
    }
  }

  /**
   * Create an execution plan from an objective and tasks
   */
  async createExecutionPlan(
    objective: string,
    tasks: Array<{
      title: string;
      description?: string;
      tool?: string;
      dependsOn?: number[];
    }>,
    constraints?: string[]
  ): Promise<TaskPlan> {
    return await this.orchestrator.planTasksFromList(
      objective,
      tasks,
      constraints
    );
  }

  /**
   * Create an execution plan using a template
   */
  async createExecutionPlanFromTemplate(
    objective: string,
    templateKey?: string,
    constraints?: string[]
  ): Promise<TaskPlan> {
    // Auto-detect template if not provided
    const detectedTemplate =
      templateKey || TaskTemplates.detectTemplate(objective);

    if (!detectedTemplate) {
      throw new Error(`No suitable template found for objective: ${objective}`);
    }

    // Generate tasks from template
    const templateResult = TaskTemplates.generateFromTemplate(
      detectedTemplate,
      constraints
    );
    if (!templateResult) {
      throw new Error(`Template '${detectedTemplate}' not found`);
    }

    // Convert template to task definitions
    const taskDefinitions =
      TaskTemplates.templateToTaskDefinitions(templateResult);

    return await this.orchestrator.planTasks(
      objective,
      taskDefinitions,
      constraints
    );
  }

  /**
   * Get the next task ready for execution
   */
  async getNextTask(groupId: string): Promise<ExecutableTask | null> {
    return await this.orchestrator.getNextExecutableTask(groupId);
  }

  /**
   * Mark a task as completed
   */
  async completeTask(taskId: string): Promise<void> {
    return await this.orchestrator.updateTaskStatus(taskId, 'completed');
  }

  /**
   * Mark a task as failed and handle recovery
   */
  async failTask(
    taskId: string,
    error: Error,
    groupId: string,
    currentAttempt?: number
  ): Promise<RecoveryStrategy> {
    // Update task status first
    await this.orchestrator.updateTaskStatus(taskId, 'failed', error.message);

    // Handle the failure and return recovery strategy
    return await this.errorHandler.handleTaskFailure(
      taskId,
      error,
      groupId,
      currentAttempt
    );
  }

  /**
   * Mark a task as running
   */
  async startTask(taskId: string): Promise<void> {
    return await this.orchestrator.updateTaskStatus(taskId, 'running');
  }

  /**
   * Get execution progress for a group
   */
  async getProgress(groupId: string): Promise<AgenticProgress> {
    return await this.orchestrator.getProgress(groupId);
  }

  /**
   * Reset a failed task for retry
   */
  async retryTask(taskId: string, resetDependents?: boolean): Promise<void> {
    return await this.orchestrator.resetTaskForRetry(taskId, resetDependents);
  }

  /**
   * Get comprehensive recovery status for error analysis
   */
  async getRecoveryStatus(groupId: string) {
    return await this.errorHandler.getRecoveryStatus(groupId);
  }

  /**
   * Reset all failed tasks in a group
   */
  async resetAllFailedTasks(groupId: string, resetDependents?: boolean) {
    return await this.errorHandler.resetFailedTasks(groupId, resetDependents);
  }

  /**
   * List available templates
   */
  getAvailableTemplates(): string[] {
    return TaskTemplates.getAvailableTemplates();
  }

  /**
   * Get template information
   */
  getTemplateInfo(templateKey: string) {
    return TaskTemplates.getTemplate(templateKey);
  }

  /**
   * Check if the service is ready for execution
   */
  async isReady(): Promise<boolean> {
    return await this.orchestrator.isReady();
  }

  /**
   * Graceful shutdown - disconnect TodoMCPAdapter
   */
  async shutdown(): Promise<void> {
    if (this.todoAdapter.isConnected()) {
      await this.todoAdapter.disconnect();
    }
  }

  /**
   * Get the underlying TodoMCPAdapter for advanced operations
   */
  getTodoAdapter(): TodoMCPAdapter {
    return this.todoAdapter;
  }

  /**
   * Get the orchestrator for advanced operations
   */
  getOrchestrator(): AgenticOrchestrator {
    return this.orchestrator;
  }

  /**
   * Get the error handler for advanced operations
   */
  getErrorHandler(): AgenticErrorHandler {
    return this.errorHandler;
  }
}
