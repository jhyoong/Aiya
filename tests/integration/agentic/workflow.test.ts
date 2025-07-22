import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgenticService } from '../../../src/core/agentic/AgenticService.js';
import { TodoMCPAdapter } from '../../../src/core/mcp/todo-adapter.js';
// Integration tests using real TodoMCPAdapter

// Integration tests using real TodoMCPAdapter and TodoManager
describe('AgenticService TodoMCPAdapter Integration', () => {
  let agenticService: AgenticService;
  let todoAdapter: TodoMCPAdapter;

  beforeEach(async () => {
    // Use real TodoMCPAdapter for integration testing
    todoAdapter = new TodoMCPAdapter();
    await todoAdapter.connect();

    agenticService = new AgenticService(todoAdapter);
    await agenticService.initialize();

    // Clear any existing todos
    const todoManager = todoAdapter.getTodoManager();
    const allTodos = todoManager.getAllTodos();
    for (const todo of allTodos) {
      await todoManager.deleteTodo({ id: todo.id });
    }
  });

  afterEach(async () => {
    if (agenticService) {
      await agenticService.shutdown();
    }
  });

  describe('End-to-end agentic workflow execution', () => {
    it('should execute complete task planning and execution cycle', async () => {
      // 1. Create execution plan
      const tasks = [
        {
          title: 'Initialize project',
          description: 'Create project structure',
          tool: 'shell',
          dependsOn: [],
        },
        {
          title: 'Install dependencies',
          description: 'Install required packages',
          tool: 'shell',
          dependsOn: [0],
        },
        {
          title: 'Create main file',
          description: 'Create application entry point',
          tool: 'filesystem',
          dependsOn: [1],
        },
      ];

      const plan = await agenticService.createExecutionPlan(
        'Create Node.js project',
        tasks,
        ['express', 'typescript']
      );

      expect(plan.groupId).toBeTruthy();
      expect(plan.taskCount).toBe(4); // 3 subtasks + 1 main task

      // 2. Verify initial progress
      let progress = await agenticService.getProgress(plan.groupId);
      expect(progress.statistics.total).toBe(4);
      expect(progress.statistics.pending).toBeGreaterThan(0);
      expect(progress.completionPercentage).toBe(0);
      expect(progress.isComplete).toBe(false);

      // 3. Execute tasks in dependency order
      let executedTasks = 0;
      const maxIterations = 10; // Prevent infinite loops

      for (let i = 0; i < maxIterations; i++) {
        const nextTask = await agenticService.getNextTask(plan.groupId);

        if (!nextTask) {
          break; // No more tasks ready
        }

        // Mark task as running
        await agenticService.startTask(nextTask.id);

        // Simulate task execution success
        await agenticService.completeTask(nextTask.id);
        executedTasks++;

        // Check progress after each task
        progress = await agenticService.getProgress(plan.groupId);
        expect(progress.statistics.completed).toBe(executedTasks);
      }

      // 4. Verify final completion
      const finalProgress = await agenticService.getProgress(plan.groupId);
      expect(finalProgress.isComplete).toBe(true);
      expect(finalProgress.completionPercentage).toBe(100);
      expect(finalProgress.statistics.completed).toBe(
        finalProgress.statistics.total
      );
      expect(executedTasks).toBeGreaterThan(0);
    });

    it('should handle task failures and recovery', async () => {
      const tasks = [
        {
          title: 'Task 1',
          tool: 'shell',
          dependsOn: [],
        },
        {
          title: 'Task 2',
          tool: 'shell',
          dependsOn: [0],
        },
      ];

      const plan = await agenticService.createExecutionPlan(
        'Test Failure Handling',
        tasks
      );

      // Get first task
      const firstTask = await agenticService.getNextTask(plan.groupId);
      expect(firstTask).toBeTruthy();

      // Start and fail the first task
      await agenticService.startTask(firstTask!.id);
      const networkError = new Error('connection timeout');

      const recoveryStrategy = await agenticService.failTask(
        firstTask!.id,
        networkError,
        plan.groupId,
        0 // First attempt
      );

      expect(recoveryStrategy.action).toBe('retry');
      expect(recoveryStrategy.taskId).toBe(firstTask!.id);

      // Verify recovery status
      const recoveryStatus = await agenticService.getRecoveryStatus(
        plan.groupId
      );
      expect(recoveryStatus.hasFailures).toBe(true);
      expect(recoveryStatus.failedTasks).toHaveLength(1);
      expect(recoveryStatus.recoverableTasks).toBe(1);

      // Reset failed task
      await agenticService.retryTask(firstTask!.id);

      // Verify task can be executed again
      const retriedTask = await agenticService.getNextTask(plan.groupId);
      expect(retriedTask?.id).toBe(firstTask!.id);
      expect(retriedTask?.title).toBe('Task 1');
    });
  });

  describe('Template-based execution', () => {
    it('should create and execute plan from template', async () => {
      const plan = await agenticService.createExecutionPlanFromTemplate(
        'Create file structure',
        'file-operations'
      );

      expect(plan.groupId).toBeTruthy();
      expect(plan.taskCount).toBeGreaterThan(1);

      // Verify template detection works
      const autoDetectedPlan =
        await agenticService.createExecutionPlanFromTemplate(
          'Create React component with tests'
        );

      expect(autoDetectedPlan.groupId).toBeTruthy();

      // The objectives should result in different templates
      expect(plan.groupId).not.toBe(autoDetectedPlan.groupId);
    });

    it('should provide template information', () => {
      const templates = agenticService.getAvailableTemplates();
      expect(templates).toContain('rest-api');
      expect(templates).toContain('react-component');
      expect(templates).toContain('file-operations');

      const restApiTemplate = agenticService.getTemplateInfo('rest-api');
      expect(restApiTemplate).toBeDefined();
      expect(restApiTemplate?.name).toBe('REST API Creation');
    });
  });

  describe('Error recovery operations', () => {
    it('should perform batch reset of failed tasks', async () => {
      const tasks = [
        { title: 'Task 1', tool: 'shell', dependsOn: [] },
        { title: 'Task 2', tool: 'shell', dependsOn: [] },
        { title: 'Task 3', tool: 'shell', dependsOn: [0] },
      ];

      const plan = await agenticService.createExecutionPlan(
        'Batch Failure Test',
        tasks
      );

      // Execute and fail multiple tasks
      const task1 = await agenticService.getNextTask(plan.groupId);
      const task2 = await agenticService.getNextTask(plan.groupId);

      if (task1) {
        await agenticService.startTask(task1.id);
        await agenticService.failTask(
          task1.id,
          new Error('error 1'),
          plan.groupId
        );
      }

      if (task2) {
        await agenticService.startTask(task2.id);
        await agenticService.failTask(
          task2.id,
          new Error('error 2'),
          plan.groupId
        );
      }

      // Perform batch reset
      const resetResult = await agenticService.resetAllFailedTasks(
        plan.groupId,
        false
      );
      expect(resetResult.resetCount).toBe(2);
      expect(resetResult.errors).toHaveLength(0);

      // Verify tasks are available again
      const retriedTask = await agenticService.getNextTask(plan.groupId);
      expect(retriedTask).toBeTruthy();
    });
  });

  describe('Service lifecycle', () => {
    it('should properly initialize and check readiness', async () => {
      const readiness = await agenticService.isReady();
      expect(readiness).toBe(true);

      // Verify TodoMCPAdapter access
      const adapter = agenticService.getTodoAdapter();
      expect(adapter).toBe(todoAdapter);

      const orchestrator = agenticService.getOrchestrator();
      expect(orchestrator).toBeDefined();

      const errorHandler = agenticService.getErrorHandler();
      expect(errorHandler).toBeDefined();
    });

    it('should handle shutdown gracefully', async () => {
      expect(todoAdapter.isConnected()).toBe(true);

      await agenticService.shutdown();

      expect(todoAdapter.isConnected()).toBe(false);
    });
  });

  describe('Progress tracking with real TodoMCPAdapter', () => {
    it('should provide accurate real-time progress updates', async () => {
      const tasks = [
        { title: 'Step 1', tool: 'shell', dependsOn: [] },
        { title: 'Step 2', tool: 'shell', dependsOn: [0] },
        { title: 'Step 3', tool: 'shell', dependsOn: [1] },
        { title: 'Step 4', tool: 'shell', dependsOn: [2] },
      ];

      const plan = await agenticService.createExecutionPlan(
        'Progress Test',
        tasks
      );

      // Track progress through execution
      const progressSnapshots = [];

      // Initial state
      let progress = await agenticService.getProgress(plan.groupId);
      progressSnapshots.push({ ...progress });
      expect(progress.completionPercentage).toBe(0);

      // Execute tasks one by one
      for (let i = 0; i < 4; i++) {
        // 4 subtasks (main task doesn't need execution)
        const nextTask = await agenticService.getNextTask(plan.groupId);
        if (nextTask) {
          await agenticService.startTask(nextTask.id);

          progress = await agenticService.getProgress(plan.groupId);
          expect(progress.statistics.running).toBe(1);

          await agenticService.completeTask(nextTask.id);

          progress = await agenticService.getProgress(plan.groupId);
          progressSnapshots.push({ ...progress });

          // Verify completion percentage increases
          const expectedPercentage = Math.round(((i + 1) / 5) * 100); // 5 total tasks
          expect(progress.completionPercentage).toBe(expectedPercentage);
        }
      }

      // Final state
      const finalProgress = progressSnapshots[progressSnapshots.length - 1];
      expect(finalProgress.isComplete).toBe(true);
      expect(finalProgress.completionPercentage).toBe(100);
      expect(finalProgress.hasFailures).toBe(false);

      // Verify progress increased monotonically
      for (let i = 1; i < progressSnapshots.length; i++) {
        expect(
          progressSnapshots[i].completionPercentage
        ).toBeGreaterThanOrEqual(progressSnapshots[i - 1].completionPercentage);
      }
    });
  });

  describe('Complex dependency chains', () => {
    it('should handle complex task dependencies correctly', async () => {
      const tasks = [
        { title: 'Foundation', tool: 'shell', dependsOn: [] }, // Task 0
        { title: 'Build A', tool: 'shell', dependsOn: [0] }, // Task 1 -> 0
        { title: 'Build B', tool: 'shell', dependsOn: [0] }, // Task 2 -> 0
        { title: 'Integrate A+B', tool: 'shell', dependsOn: [1, 2] }, // Task 3 -> 1,2
        { title: 'Test', tool: 'shell', dependsOn: [3] }, // Task 4 -> 3
        { title: 'Deploy', tool: 'shell', dependsOn: [4] }, // Task 5 -> 4
      ];

      const plan = await agenticService.createExecutionPlan(
        'Complex Dependencies',
        tasks
      );

      const executionOrder = [];

      // Execute tasks and track order
      while (true) {
        const nextTask = await agenticService.getNextTask(plan.groupId);
        if (!nextTask) break;

        executionOrder.push(nextTask.title);
        await agenticService.startTask(nextTask.id);
        await agenticService.completeTask(nextTask.id);
      }

      // Verify execution order respects dependencies
      expect(executionOrder).toContain('Foundation');
      expect(executionOrder).toContain('Build A');
      expect(executionOrder).toContain('Build B');
      expect(executionOrder).toContain('Integrate A+B');
      expect(executionOrder).toContain('Test');
      expect(executionOrder).toContain('Deploy');

      // Foundation should be first
      expect(executionOrder[0]).toBe('Foundation');

      // Build A and Build B should come after Foundation but before Integration
      const foundationIndex = executionOrder.indexOf('Foundation');
      const buildAIndex = executionOrder.indexOf('Build A');
      const buildBIndex = executionOrder.indexOf('Build B');
      const integrateIndex = executionOrder.indexOf('Integrate A+B');

      expect(buildAIndex).toBeGreaterThan(foundationIndex);
      expect(buildBIndex).toBeGreaterThan(foundationIndex);
      expect(integrateIndex).toBeGreaterThan(buildAIndex);
      expect(integrateIndex).toBeGreaterThan(buildBIndex);

      // Test should come after Integration
      const testIndex = executionOrder.indexOf('Test');
      expect(testIndex).toBeGreaterThan(integrateIndex);

      // Deploy should be last
      expect(executionOrder[executionOrder.length - 1]).toBe('Deploy');
    });
  });
});
