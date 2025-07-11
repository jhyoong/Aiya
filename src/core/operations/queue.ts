import { randomUUID } from 'crypto';
import { WorkspaceSecurity } from '../security/workspace.js';
import { AtomicFileOperations, AtomicOperationResult } from './atomic.js';
import { DiffPreviewSystem, PreviewResult } from '../diff/preview.js';

export interface Operation {
  id: string;
  type: 'write' | 'edit' | 'create' | 'delete';
  filePath: string;
  content: string | undefined;
  oldContent: string | undefined;
  newContent: string | undefined;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  result: AtomicOperationResult | undefined;
  error: string | undefined;
  timestamp: number;
}

export interface OperationQueueOptions {
  maxConcurrency?: number;
  enableRollback?: boolean;
  autoCleanup?: boolean;
  timeoutMs?: number;
}

export interface QueueExecutionResult {
  success: boolean;
  completed: Operation[];
  failed: Operation[];
  rollbackInfo:
    | {
        rolledBack: Operation[];
        rollbackFailed: Operation[];
      }
    | undefined;
}

export class OperationQueue {
  private atomicOps: AtomicFileOperations;
  private diffPreview: DiffPreviewSystem;
  private operations = new Map<string, Operation>();
  private executionOrder: string[] = [];
  private isExecuting = false;
  private options: OperationQueueOptions;

  constructor(
    _security: WorkspaceSecurity,
    atomicOps: AtomicFileOperations,
    diffPreview: DiffPreviewSystem,
    options: OperationQueueOptions = {}
  ) {
    this.atomicOps = atomicOps;
    this.diffPreview = diffPreview;
    this.options = {
      maxConcurrency: 1, // Sequential by default for safety
      enableRollback: true,
      autoCleanup: true,
      timeoutMs: 300000, // 5 minutes
      ...options,
    };
  }

  /**
   * Add a write operation to the queue
   */
  addWriteOperation(
    filePath: string,
    content: string,
    dependencies: string[] = []
  ): string {
    const operation: Operation = {
      id: randomUUID(),
      type: 'write',
      filePath,
      content,
      oldContent: undefined,
      newContent: undefined,
      dependencies,
      status: 'pending',
      result: undefined,
      error: undefined,
      timestamp: Date.now(),
    };

    this.operations.set(operation.id, operation);
    this.executionOrder.push(operation.id);
    return operation.id;
  }

  /**
   * Add an edit operation to the queue
   */
  addEditOperation(
    filePath: string,
    oldContent: string,
    newContent: string,
    dependencies: string[] = []
  ): string {
    const operation: Operation = {
      id: randomUUID(),
      type: 'edit',
      filePath,
      content: undefined,
      oldContent,
      newContent,
      dependencies,
      status: 'pending',
      result: undefined,
      error: undefined,
      timestamp: Date.now(),
    };

    this.operations.set(operation.id, operation);
    this.executionOrder.push(operation.id);
    return operation.id;
  }

  /**
   * Add a create operation to the queue
   */
  addCreateOperation(
    filePath: string,
    content: string,
    dependencies: string[] = []
  ): string {
    const operation: Operation = {
      id: randomUUID(),
      type: 'create',
      filePath,
      content,
      oldContent: undefined,
      newContent: undefined,
      dependencies,
      status: 'pending',
      result: undefined,
      error: undefined,
      timestamp: Date.now(),
    };

    this.operations.set(operation.id, operation);
    this.executionOrder.push(operation.id);
    return operation.id;
  }

  /**
   * Remove an operation from the queue (only if not executed)
   */
  removeOperation(operationId: string): boolean {
    const operation = this.operations.get(operationId);
    if (!operation || operation.status !== 'pending') {
      return false;
    }

    this.operations.delete(operationId);
    this.executionOrder = this.executionOrder.filter(id => id !== operationId);
    return true;
  }

  /**
   * Get operation status
   */
  getOperation(operationId: string): Operation | undefined {
    return this.operations.get(operationId);
  }

  /**
   * Get all operations
   */
  getAllOperations(): Operation[] {
    return Array.from(this.operations.values());
  }

  /**
   * Get operations by status
   */
  getOperationsByStatus(status: Operation['status']): Operation[] {
    return Array.from(this.operations.values()).filter(
      op => op.status === status
    );
  }

  /**
   * Preview all operations in the queue
   */
  async previewAllOperations(): Promise<PreviewResult[]> {
    const previews: PreviewResult[] = [];

    for (const operationId of this.executionOrder) {
      const operation = this.operations.get(operationId);
      if (!operation || operation.status !== 'pending') continue;

      try {
        let preview: PreviewResult;

        switch (operation.type) {
          case 'write':
          case 'create':
            preview = await this.diffPreview.previewFileChanges(
              operation.filePath,
              operation.content || '',
              { showLineNumbers: true, colorOutput: true }
            );
            break;
          case 'edit':
            preview = await this.diffPreview.previewEditOperation(
              operation.filePath,
              operation.oldContent || '',
              operation.newContent || '',
              { showLineNumbers: true, colorOutput: true }
            );
            break;
          default:
            continue;
        }

        previews.push(preview);
      } catch (error) {
        previews.push({
          filePath: operation.filePath,
          hasChanges: false,
          preview: `Error previewing operation: ${error}`,
          stats: { additions: 0, deletions: 0, changes: 0 },
        });
      }
    }

    return previews;
  }

  /**
   * Execute all operations in the queue
   */
  async executeAll(): Promise<QueueExecutionResult> {
    if (this.isExecuting) {
      throw new Error('Queue is already executing');
    }

    this.isExecuting = true;
    const completed: Operation[] = [];
    const failed: Operation[] = [];

    try {
      // Resolve execution order based on dependencies
      const sortedOperations = this.resolveDependencies();

      // Execute operations
      for (const operationId of sortedOperations) {
        const operation = this.operations.get(operationId);
        if (!operation) continue;

        operation.status = 'running';

        try {
          const result = await this.executeOperation(operation);
          operation.result = result;

          if (result.success) {
            operation.status = 'completed';
            completed.push(operation);
          } else {
            operation.status = 'failed';
            operation.error = result.error;
            failed.push(operation);

            // Stop execution on failure if rollback is enabled
            if (this.options.enableRollback) {
              break;
            }
          }
        } catch (error) {
          operation.status = 'failed';
          operation.error = `Execution failed: ${error}`;
          failed.push(operation);

          if (this.options.enableRollback) {
            break;
          }
        }
      }

      // Handle rollback if needed
      let rollbackInfo: QueueExecutionResult['rollbackInfo'];
      if (failed.length > 0 && this.options.enableRollback) {
        rollbackInfo = await this.rollbackOperations(completed);
      }

      return {
        success: failed.length === 0,
        completed,
        failed,
        rollbackInfo,
      };
    } finally {
      this.isExecuting = false;

      if (this.options.autoCleanup) {
        this.cleanup();
      }
    }
  }

  /**
   * Rollback completed operations
   */
  async rollbackOperations(operations: Operation[]): Promise<{
    rolledBack: Operation[];
    rollbackFailed: Operation[];
  }> {
    const rolledBack: Operation[] = [];
    const rollbackFailed: Operation[] = [];

    // Rollback in reverse order
    for (const operation of operations.reverse()) {
      try {
        const result = await this.atomicOps.rollback(operation.filePath);

        if (result.success) {
          operation.status = 'rolled_back';
          rolledBack.push(operation);
        } else {
          rollbackFailed.push(operation);
        }
      } catch (error) {
        rollbackFailed.push(operation);
      }
    }

    return { rolledBack, rollbackFailed };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.operations.clear();
    this.executionOrder = [];
  }

  /**
   * Remove completed and failed operations
   */
  cleanup(): void {
    const toRemove = Array.from(this.operations.values())
      .filter(op => op.status === 'completed' || op.status === 'failed')
      .map(op => op.id);

    toRemove.forEach(id => {
      this.operations.delete(id);
    });

    this.executionOrder = this.executionOrder.filter(
      id => !toRemove.includes(id)
    );
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    rolledBack: number;
  } {
    const operations = Array.from(this.operations.values());

    return {
      total: operations.length,
      pending: operations.filter(op => op.status === 'pending').length,
      running: operations.filter(op => op.status === 'running').length,
      completed: operations.filter(op => op.status === 'completed').length,
      failed: operations.filter(op => op.status === 'failed').length,
      rolledBack: operations.filter(op => op.status === 'rolled_back').length,
    };
  }

  private async executeOperation(
    operation: Operation
  ): Promise<AtomicOperationResult> {
    switch (operation.type) {
      case 'write':
        return await this.atomicOps.atomicWrite(
          operation.filePath,
          operation.content || ''
        );
      case 'edit':
        return await this.atomicOps.atomicEdit(
          operation.filePath,
          operation.oldContent || '',
          operation.newContent || ''
        );
      case 'create':
        return await this.atomicOps.atomicCreate(
          operation.filePath,
          operation.content || ''
        );
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private resolveDependencies(): string[] {
    const resolved: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (operationId: string) => {
      if (visiting.has(operationId)) {
        throw new Error(
          `Circular dependency detected involving operation ${operationId}`
        );
      }

      if (visited.has(operationId)) {
        return;
      }

      const operation = this.operations.get(operationId);
      if (!operation) {
        return;
      }

      visiting.add(operationId);

      // Visit dependencies first
      for (const depId of operation.dependencies) {
        if (this.operations.has(depId)) {
          visit(depId);
        }
      }

      visiting.delete(operationId);
      visited.add(operationId);
      resolved.push(operationId);
    };

    // Visit all operations
    for (const operationId of this.executionOrder) {
      if (!visited.has(operationId)) {
        visit(operationId);
      }
    }

    return resolved;
  }
}
