import { FilesystemMCPClient } from './filesystem.js';
import { WorkspaceSecurity } from '../security/workspace.js';
import { DiffPreviewSystem } from '../diff/preview.js';
import { AtomicFileOperations } from '../operations/atomic.js';
import { OperationQueue } from '../operations/queue.js';
import { EnhancedPatternMatching } from '../operations/pattern-matching.js';
import { Tool, ToolResult } from './base.js';

export class EnhancedFilesystemMCPClient extends FilesystemMCPClient {
  private diffPreview: DiffPreviewSystem;
  private atomicOps: AtomicFileOperations;
  private operationQueue: OperationQueue;
  private patternMatching: EnhancedPatternMatching;

  constructor(security: WorkspaceSecurity) {
    super(security);
    this.diffPreview = new DiffPreviewSystem(security);
    this.atomicOps = new AtomicFileOperations(security);
    this.patternMatching = new EnhancedPatternMatching(security);
    this.operationQueue = new OperationQueue(
      security,
      this.atomicOps,
      this.diffPreview
    );
  }

  override async listTools(): Promise<Tool[]> {
    const basicTools = await super.listTools();

    const enhancedTools: Tool[] = [
      {
        name: 'preview_diff',
        description: 'Preview changes before applying them to a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to preview changes for',
            },
            content: {
              type: 'string',
              description: 'New content to preview',
            },
            show_line_numbers: {
              type: 'boolean',
              description: 'Show line numbers in diff (default: true)',
            },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'atomic_write',
        description: 'Atomically write content to a file with backup',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to write',
            },
            content: {
              type: 'string',
              description: 'Content to write',
            },
            create_backup: {
              type: 'boolean',
              description: 'Create backup before writing (default: true)',
            },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'atomic_edit',
        description: 'Atomically edit a file by replacing specific content',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to edit',
            },
            old_content: {
              type: 'string',
              description: 'Content to replace',
            },
            new_content: {
              type: 'string',
              description: 'New content to replace with',
            },
          },
          required: ['path', 'old_content', 'new_content'],
        },
      },
      {
        name: 'pattern_replace',
        description:
          'Replace content using regex patterns with advanced options',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to modify',
            },
            pattern: {
              type: 'string',
              description: 'Regex pattern to match',
            },
            replacement: {
              type: 'string',
              description: 'Replacement text',
            },
            preserve_indentation: {
              type: 'boolean',
              description: 'Preserve original indentation (default: true)',
            },
            multiline: {
              type: 'boolean',
              description: 'Enable multiline matching (default: false)',
            },
            case_sensitive: {
              type: 'boolean',
              description: 'Case sensitive matching (default: true)',
            },
          },
          required: ['path', 'pattern', 'replacement'],
        },
      },
      {
        name: 'queue_operation',
        description: 'Add an operation to the execution queue',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['write', 'edit', 'create'],
              description: 'Type of operation',
            },
            path: {
              type: 'string',
              description: 'Path to the file',
            },
            content: {
              type: 'string',
              description: 'Content for write/create operations',
            },
            old_content: {
              type: 'string',
              description: 'Content to replace for edit operations',
            },
            new_content: {
              type: 'string',
              description: 'New content for edit operations',
            },
            dependencies: {
              type: 'array',
              items: { type: 'string' },
              description: 'Operation IDs this operation depends on',
            },
          },
          required: ['operation', 'path'],
        },
      },
      {
        name: 'execute_queue',
        description: 'Execute all queued operations',
        inputSchema: {
          type: 'object',
          properties: {
            preview_first: {
              type: 'boolean',
              description:
                'Preview all operations before executing (default: true)',
            },
          },
        },
      },
      {
        name: 'rollback_file',
        description: 'Rollback a file to its previous backup',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to rollback',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'list_backups',
        description: 'List available backups for a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file',
            },
          },
          required: ['path'],
        },
      },
    ];

    return [...basicTools, ...enhancedTools];
  }

  override async callTool(
    name: string,
    args: Record<string, any>
  ): Promise<ToolResult> {
    try {
      switch (name) {
        case 'preview_diff':
          return await this.previewDiff(
            args.path,
            args.content,
            args.show_line_numbers
          );
        case 'atomic_write':
          return await this.atomicWrite(
            args.path,
            args.content,
            args.create_backup
          );
        case 'atomic_edit':
          return await this.atomicEdit(
            args.path,
            args.old_content,
            args.new_content
          );
        case 'pattern_replace':
          return await this.patternReplace(
            args.path,
            args.pattern,
            args.replacement,
            args
          );
        case 'queue_operation':
          return await this.queueOperation(args);
        case 'execute_queue':
          return await this.executeQueue(args.preview_first);
        case 'rollback_file':
          return await this.rollbackFile(args.path);
        case 'list_backups':
          return await this.listBackups(args.path);
        default:
          return await super.callTool(name, args);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool ${name}: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async previewDiff(
    filePath: string,
    content: string,
    showLineNumbers: boolean = true
  ): Promise<ToolResult> {
    try {
      const preview = await this.diffPreview.previewFileChanges(
        filePath,
        content,
        { showLineNumbers, colorOutput: false }
      );

      return {
        content: [
          {
            type: 'text',
            text: `Preview for ${preview.filePath}:\n\n${preview.preview}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error previewing changes: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async atomicWrite(
    filePath: string,
    content: string,
    createBackup: boolean = true
  ): Promise<ToolResult> {
    try {
      const result = await this.atomicOps.atomicWrite(filePath, content, {
        createBackup,
      });

      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Successfully wrote to ${result.filePath}${result.backupPath ? ` (backup: ${result.backupPath})` : ''}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to write file: ${result.error}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error in atomic write: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async atomicEdit(
    filePath: string,
    oldContent: string,
    newContent: string
  ): Promise<ToolResult> {
    try {
      const result = await this.atomicOps.atomicEdit(
        filePath,
        oldContent,
        newContent
      );

      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Successfully edited ${result.filePath}${result.backupPath ? ` (backup: ${result.backupPath})` : ''}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to edit file: ${result.error}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error in atomic edit: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async patternReplace(
    filePath: string,
    pattern: string,
    replacement: string,
    options: any = {}
  ): Promise<ToolResult> {
    try {
      const validatedPath = await (this as any).security.validateFileAccess(
        filePath,
        'read'
      );
      const content = await (
        await import('fs/promises')
      ).readFile(validatedPath, 'utf8');

      const result = this.patternMatching.replaceMatches(
        content,
        pattern,
        replacement,
        {
          preserveIndentation: options.preserve_indentation !== false,
          multiline: options.multiline === true,
          caseSensitive: options.case_sensitive !== false,
        }
      );

      if (result.replacements > 0) {
        const atomicResult = await this.atomicOps.atomicWrite(
          filePath,
          result.newContent
        );

        if (atomicResult.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Successfully replaced ${result.replacements} matches in ${atomicResult.filePath}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `Pattern matched but write failed: ${atomicResult.error}`,
              },
            ],
            isError: true,
          };
        }
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `No matches found for pattern in ${filePath}`,
            },
          ],
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error in pattern replace: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async queueOperation(args: any): Promise<ToolResult> {
    try {
      let operationId: string;

      switch (args.operation) {
        case 'write':
          operationId = this.operationQueue.addWriteOperation(
            args.path,
            args.content,
            args.dependencies || []
          );
          break;
        case 'edit':
          operationId = this.operationQueue.addEditOperation(
            args.path,
            args.old_content,
            args.new_content,
            args.dependencies || []
          );
          break;
        case 'create':
          operationId = this.operationQueue.addCreateOperation(
            args.path,
            args.content,
            args.dependencies || []
          );
          break;
        default:
          throw new Error(`Unknown operation type: ${args.operation}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: `Queued ${args.operation} operation for ${args.path} (ID: ${operationId})`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error queueing operation: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async executeQueue(
    previewFirst: boolean = true
  ): Promise<ToolResult> {
    try {
      let previewText = '';

      if (previewFirst) {
        const previews = await this.operationQueue.previewAllOperations();
        if (previews.length > 0) {
          previewText = 'Preview of queued operations:\n\n';
          previewText += this.diffPreview.createChangesSummary(previews);
          previewText += '\n\n';
        }
      }

      const result = await this.operationQueue.executeAll();

      let resultText = previewText;
      resultText += `Execution completed:\n`;
      resultText += `  Successful: ${result.completed.length}\n`;
      resultText += `  Failed: ${result.failed.length}\n`;

      if (result.failed.length > 0) {
        resultText += '\nFailed operations:\n';
        result.failed.forEach(op => {
          resultText += `  - ${op.type} ${op.filePath}: ${op.error}\n`;
        });
      }

      if (result.rollbackInfo) {
        resultText += `\nRollback performed:\n`;
        resultText += `  Rolled back: ${result.rollbackInfo.rolledBack.length}\n`;
        resultText += `  Rollback failed: ${result.rollbackInfo.rollbackFailed.length}\n`;
      }

      return {
        content: [
          {
            type: 'text',
            text: resultText,
          },
        ],
        isError: !result.success,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing queue: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async rollbackFile(filePath: string): Promise<ToolResult> {
    try {
      const result = await this.atomicOps.rollback(filePath);

      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Successfully rolled back ${result.filePath}${result.backupPath ? ` from backup: ${result.backupPath}` : ''}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to rollback file: ${result.error}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error in rollback: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async listBackups(filePath: string): Promise<ToolResult> {
    try {
      const backups = await this.atomicOps.listBackups(filePath);

      if (backups.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No backups found for ${filePath}`,
            },
          ],
        };
      }

      let backupList = `Backups for ${filePath}:\n\n`;
      backups.forEach((backup, index) => {
        backupList += `${index + 1}. ${backup.path}\n`;
        backupList += `   Created: ${backup.created.toISOString()}\n`;
        backupList += `   Size: ${backup.size} bytes\n\n`;
      });

      return {
        content: [
          {
            type: 'text',
            text: backupList,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing backups: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }
}
