import {
  MCPClient,
  Tool,
  ToolResult,
  MCPServerInfo,
  FileSystemError,
} from './base.js';
import { WorkspaceSecurity } from '../security/workspace.js';
import { FileSystemState } from './filesystem-state.js';
import { FuzzyMatcher } from './fuzzy-matcher.js';
import { ASTSearcher } from './ast-searcher.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

/**
 * FilesystemMCPClient - MCP client for file operations
 *
 * Provides 5 core tools with enhanced functionality:
 * - ReadFile: Read files with encoding options and line ranges
 * - WriteFile: Write files with backup and atomic operations
 * - EditFile: Apply targeted edits with replace/insert/delete operations
 * - SearchFiles: Search files with literal, regex, fuzzy, and AST patterns
 * - ListDirectory: List directory contents with metadata, filtering, and recursion
 */
export class FilesystemMCPClient extends MCPClient {
  private security: WorkspaceSecurity;
  private state: FileSystemState;
  private fuzzyMatcher: FuzzyMatcher;
  private astSearcher: ASTSearcher;

  constructor(security: WorkspaceSecurity) {
    super('filesystem');
    this.security = security;
    this.state = new FileSystemState();
    this.fuzzyMatcher = new FuzzyMatcher();
    this.astSearcher = new ASTSearcher();
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async ping(): Promise<boolean> {
    return this.connected;
  }

  async getServerInfo(): Promise<MCPServerInfo> {
    return {
      name: 'Filesystem MCP Server',
      version: '2.0.0',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
      },
    };
  }

  async listTools(): Promise<Tool[]> {
    return [
      {
        name: 'ReadFile',
        description:
          'Read file contents with optional encoding and line range selection',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The file path to read',
            },
            encoding: {
              type: 'string',
              enum: ['utf8', 'base64', 'binary'],
              description: 'File encoding (default: utf8)',
              default: 'utf8',
            },
            lineRange: {
              type: 'object',
              properties: {
                start: {
                  type: 'number',
                  description: 'Starting line number (1-based)',
                },
                end: {
                  type: 'number',
                  description: 'Ending line number (1-based)',
                },
              },
              required: ['start', 'end'],
              description: 'Optional line range to extract',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'WriteFile',
        description:
          'Write content to file with safety features and mode options',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The file path to write',
            },
            content: {
              type: 'string',
              description: 'The content to write',
            },
            createDirectories: {
              type: 'boolean',
              description:
                "Create parent directories if they don't exist (default: false)",
              default: false,
            },
            mode: {
              type: 'string',
              enum: ['overwrite', 'create-only', 'append'],
              description: 'Write mode (default: overwrite)',
              default: 'overwrite',
            },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'EditFile',
        description:
          'Apply targeted edits to file using replace/insert/delete operations',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The file path to edit',
            },
            edits: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['replace', 'insert', 'delete'],
                    description: 'Type of edit operation',
                  },
                  search: {
                    type: 'object',
                    properties: {
                      pattern: {
                        type: 'string',
                        description: 'Pattern to search for',
                      },
                      isRegex: {
                        type: 'boolean',
                        description:
                          'Whether pattern is a regular expression (default: false)',
                        default: false,
                      },
                      occurrence: {
                        oneOf: [
                          { type: 'string', enum: ['first', 'last', 'all'] },
                          { type: 'number' },
                        ],
                        description:
                          'Which occurrence to target (default: first)',
                        default: 'first',
                      },
                    },
                    required: ['pattern'],
                  },
                  position: {
                    oneOf: [
                      {
                        type: 'object',
                        properties: {
                          line: {
                            type: 'number',
                            description: 'Line number (1-based)',
                          },
                          column: {
                            type: 'number',
                            description: 'Column number (1-based)',
                            default: 1,
                          },
                        },
                        required: ['line'],
                      },
                      {
                        type: 'string',
                        enum: ['start', 'end'],
                      },
                    ],
                    description: 'Position for insert/delete operations',
                  },
                  content: {
                    type: 'string',
                    description: 'Content for replace/insert operations',
                  },
                },
                required: ['type'],
              },
              description: 'Array of edit operations to apply sequentially',
            },
          },
          required: ['path', 'edits'],
        },
      },
      {
        name: 'SearchFiles',
        description:
          'Search files with multiple search types, context, and confidence scoring',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Search pattern',
            },
            options: {
              type: 'object',
              properties: {
                includeGlobs: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Glob patterns for files to include (default: all files)',
                },
                excludeGlobs: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Glob patterns for files to exclude',
                },
                maxResults: {
                  type: 'number',
                  description:
                    'Maximum number of results to return (default: 100)',
                  default: 100,
                },
                contextLines: {
                  type: 'number',
                  description:
                    'Number of context lines before and after each match (default: 3)',
                  default: 3,
                },
                searchType: {
                  type: 'string',
                  enum: ['literal', 'regex', 'fuzzy', 'ast', 'filename'],
                  description:
                    'Type of search to perform (default: literal). Use "filename" to search for files by name pattern rather than content.',
                  default: 'literal',
                },
              },
              required: ['searchType'],
            },
          },
          required: ['pattern', 'options'],
        },
      },
      {
        name: 'ListDirectory',
        description:
          'List directory contents with smart filtering, performance optimization, and LLM-friendly output',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The directory path to list',
            },
            recursive: {
              type: 'boolean',
              description:
                'Include subdirectories recursively (default: false)',
              default: false,
            },
            maxDepth: {
              type: 'number',
              description:
                'Maximum recursion depth when recursive is true (default: 3)',
              default: 3,
            },
            includeHidden: {
              type: 'boolean',
              description:
                'Include hidden files and directories (default: false)',
              default: false,
            },
            sortBy: {
              type: 'string',
              enum: ['name', 'size', 'modified', 'type', 'importance'],
              description:
                'Sort entries by specified field (default: importance)',
              default: 'importance',
            },
            sortOrder: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Sort order ascending or descending (default: asc)',
              default: 'asc',
            },
            filterExtensions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by file extensions (e.g., [".ts", ".js"])',
            },
            excludePatterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'Additional exclude patterns beyond smart defaults',
            },
            maxEntries: {
              type: 'number',
              description:
                'Maximum number of entries to return (default: 1000)',
              default: 1000,
            },
            offset: {
              type: 'number',
              description:
                'Number of entries to skip for pagination (default: 0)',
              default: 0,
            },
            mode: {
              type: 'string',
              enum: ['full', 'summary', 'project-files'],
              description:
                'Response mode: full (all details), summary (counts only), project-files (important files first) (default: full)',
              default: 'full',
            },
            includeCommonBuildDirs: {
              type: 'boolean',
              description:
                'Include common build/dependency directories like node_modules, dist (default: false)',
              default: false,
            },
            quick: {
              type: 'boolean',
              description:
                'Skip detailed metadata for faster response (default: false)',
              default: false,
            },
          },
          required: ['path'],
        },
      },
    ];
  }

  async callTool(name: string, args: Record<string, any>): Promise<ToolResult> {
    try {
      switch (name) {
        case 'ReadFile':
          return await this.readFile(args);
        case 'WriteFile':
          return await this.writeFile(args);
        case 'EditFile':
          return await this.editFile(args);
        case 'SearchFiles':
          return await this.searchFiles(args);
        case 'ListDirectory':
          return await this.listDirectory(args);
        default:
          return {
            content: [
              {
                type: 'text',
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      if (error instanceof FileSystemError) {
        return {
          content: [
            {
              type: 'text',
              text: `${error.code}: ${error.message}${error.suggestion ? `. ${error.suggestion}` : ''}`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async listResources(): Promise<any[]> {
    return [];
  }

  async readResource(_uri: string): Promise<ToolResult> {
    return {
      content: [
        {
          type: 'text',
          text: 'Resources not supported',
        },
      ],
      isError: true,
    };
  }

  /**
   * Detects programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.rs': 'rust',
      '.go': 'go',
      '.md': 'markdown',
      '.json': 'json',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.php': 'php',
      '.rb': 'ruby',
      '.sh': 'shell',
      '.yml': 'yaml',
      '.yaml': 'yaml',
    };
    return languageMap[ext] || 'text';
  }

  /**
   * ReadFile tool implementation
   */
  private async readFile(params: any): Promise<ToolResult> {
    const { path: filePath, encoding = 'utf8', lineRange } = params;

    try {
      // Validate file path through WorkspaceSecurity
      const validatedPath = await this.security.validateFileAccess(
        filePath,
        'read'
      );

      // Check file exists and get stats
      const stats = await fs.stat(validatedPath);
      if (!stats.isFile()) {
        throw new FileSystemError(
          `Path is not a file: ${filePath}`,
          'FILE_NOT_FOUND',
          filePath,
          'Ensure the path points to a valid file'
        );
      }

      // Detect if file is binary (check for null bytes in first 1024 bytes)
      const buffer = Buffer.alloc(Math.min(1024, stats.size));
      const fileHandle = await fs.open(validatedPath, 'r');
      await fileHandle.read(buffer, 0, buffer.length, 0);
      await fileHandle.close();

      const isBinary = buffer.includes(0);

      // If binary and encoding is utf8, return metadata only
      if (isBinary && encoding === 'utf8') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  content:
                    '[Binary file - use base64 or binary encoding to read content]',
                  metadata: {
                    size: stats.size,
                    lines: 0,
                    language: this.detectLanguage(validatedPath),
                    lastModified: stats.mtime,
                    isBinary: true,
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Read file content with specified encoding
      let content: string;
      if (encoding === 'base64') {
        const rawContent = await fs.readFile(validatedPath);
        content = rawContent.toString('base64');
      } else if (encoding === 'binary') {
        const rawContent = await fs.readFile(validatedPath);
        content = rawContent.toString('binary');
      } else {
        content = await fs.readFile(validatedPath, 'utf8');
      }

      // Calculate line count if content is text
      let lines = 0;
      if (encoding === 'utf8' && !isBinary) {
        lines = content.split('\n').length;
      }

      // Apply line range filtering if specified
      if (lineRange && encoding === 'utf8' && !isBinary) {
        const contentLines = content.split('\n');
        const startLine = Math.max(1, lineRange.start) - 1; // Convert to 0-based
        const endLine = Math.min(contentLines.length, lineRange.end);

        if (startLine >= contentLines.length) {
          throw new FileSystemError(
            `Start line ${lineRange.start} exceeds file length (${contentLines.length} lines)`,
            'FILE_NOT_FOUND',
            filePath,
            `Specify a start line between 1 and ${contentLines.length}`
          );
        }

        content = contentLines.slice(startLine, endLine).join('\n');
      }

      // Return structured result with content and metadata
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                content,
                metadata: {
                  size: stats.size,
                  lines,
                  language: this.detectLanguage(validatedPath),
                  lastModified: stats.mtime,
                  encoding,
                  isBinary: isBinary && encoding !== 'utf8',
                  lineRange: lineRange || null,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }

      if ((error as any).code === 'ENOENT') {
        throw new FileSystemError(
          `File not found: ${filePath}`,
          'FILE_NOT_FOUND',
          filePath,
          'Check that the file path is correct and the file exists'
        );
      }

      if ((error as any).code === 'EACCES') {
        throw new FileSystemError(
          `Permission denied: ${filePath}`,
          'PERMISSION_DENIED',
          filePath,
          'Check file permissions and ensure you have read access'
        );
      }

      throw new FileSystemError(
        `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
        'FILE_NOT_FOUND',
        filePath
      );
    }
  }

  /**
   * WriteFile tool implementation
   */
  private async writeFile(params: any): Promise<ToolResult> {
    const {
      path: filePath,
      content,
      createDirectories = false,
      mode = 'overwrite',
    } = params;

    try {
      // Validate file path through WorkspaceSecurity
      const validatedPath = await this.security.validateFileAccess(
        filePath,
        'write'
      );

      // Check mode requirements
      const fileExists = await fs
        .access(validatedPath)
        .then(() => true)
        .catch(() => false);

      if (mode === 'create-only' && fileExists) {
        throw new FileSystemError(
          `File already exists: ${filePath}`,
          'FILE_NOT_FOUND',
          filePath,
          'Use overwrite mode if you want to replace the existing file'
        );
      }

      // Create parent directories if createDirectories is true
      if (createDirectories) {
        const parentDir = path.dirname(validatedPath);
        try {
          await fs.mkdir(parentDir, { recursive: true });
        } catch (error) {
          throw new FileSystemError(
            `Failed to create parent directories: ${error instanceof Error ? error.message : String(error)}`,
            'PERMISSION_DENIED',
            filePath,
            'Check permissions for creating directories'
          );
        }
      } else {
        // Check parent directory exists
        const parentDir = path.dirname(validatedPath);
        try {
          await fs.access(parentDir);
        } catch {
          throw new FileSystemError(
            `Parent directory does not exist: ${parentDir}`,
            'FILE_NOT_FOUND',
            filePath,
            'Set createDirectories to true or create the parent directory first'
          );
        }
      }

      let originalContent: string | null = null;

      // For rollback purposes, read original content if overwriting
      if (mode === 'overwrite' && fileExists) {
        try {
          originalContent = await fs.readFile(validatedPath, 'utf8');
        } catch (error) {
          // Continue without original content if read fails
          originalContent = null;
        }
      }

      // Prepare content based on mode
      let finalContent: string;
      if (mode === 'append' && fileExists) {
        const existingContent = await fs.readFile(validatedPath, 'utf8');
        finalContent = existingContent + content;
      } else {
        finalContent = content;
      }

      // Write content atomically (temp file + rename)
      const tempPath = `${validatedPath}.tmp.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`;

      try {
        await fs.writeFile(tempPath, finalContent, 'utf8');
        await fs.rename(tempPath, validatedPath);
      } catch (error) {
        // Clean up temp file if it exists
        try {
          await fs.unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }

        if ((error as any).code === 'ENOSPC') {
          throw new FileSystemError(
            `Insufficient disk space to write file: ${filePath}`,
            'DISK_FULL',
            filePath,
            'Free up disk space and try again'
          );
        }

        throw new FileSystemError(
          `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
          'PERMISSION_DENIED',
          filePath,
          'Check file permissions and disk space'
        );
      }

      // Track operation in FileSystemState with reverse operation
      const reverseOperation = async () => {
        if (mode === 'create-only' || (mode === 'overwrite' && !fileExists)) {
          // Delete the created file
          await fs.unlink(validatedPath);
        } else if (mode === 'overwrite' && originalContent !== null) {
          // Restore original content
          await fs.writeFile(validatedPath, originalContent, 'utf8');
        } else if (
          mode === 'append' &&
          fileExists &&
          originalContent !== null
        ) {
          // Restore original content
          await fs.writeFile(validatedPath, originalContent, 'utf8');
        }
      };

      await this.state.trackChange({
        tool: 'WriteFile',
        params: { path: filePath, content, createDirectories, mode },
        timestamp: new Date(),
        reversible: true,
        reverseOperation,
      });

      // Get file stats for response
      const stats = await fs.stat(validatedPath);

      // Return success result with backup information
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                path: filePath,
                mode,
                bytesWritten: Buffer.byteLength(finalContent, 'utf8'),
                metadata: {
                  size: stats.size,
                  lastModified: stats.mtime,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }

      if ((error as any).code === 'ENOENT') {
        throw new FileSystemError(
          `File or directory not found: ${filePath}`,
          'FILE_NOT_FOUND',
          filePath,
          'Check that the path is correct and parent directories exist'
        );
      }

      if ((error as any).code === 'EACCES') {
        throw new FileSystemError(
          `Permission denied: ${filePath}`,
          'PERMISSION_DENIED',
          filePath,
          'Check file and directory permissions'
        );
      }

      throw new FileSystemError(
        `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
        'PERMISSION_DENIED',
        filePath
      );
    }
  }

  /**
   * EditFile tool implementation
   */
  private async editFile(params: any): Promise<ToolResult> {
    const { path: filePath, edits } = params;

    try {
      // Validate file path and read current content
      const validatedPath = await this.security.validateFileAccess(
        filePath,
        'write'
      );

      const fileExists = await fs
        .access(validatedPath)
        .then(() => true)
        .catch(() => false);
      if (!fileExists) {
        throw new FileSystemError(
          `File not found: ${filePath}`,
          'FILE_NOT_FOUND',
          filePath,
          'Ensure the file exists before editing'
        );
      }

      const originalContent = await fs.readFile(validatedPath, 'utf8');
      let currentContent = originalContent;

      // Store original content for rollback purposes

      const appliedEdits: string[] = [];

      // Apply each edit in sequence
      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        const { type, search, position, content: editContent } = edit;

        try {
          switch (type) {
            case 'replace':
              if (!search) {
                throw new Error('Replace operation requires search parameter');
              }
              currentContent = this.applyReplaceEdit(
                currentContent,
                search,
                editContent || ''
              );
              appliedEdits.push(
                `Replace: "${search.pattern}" -> "${editContent || ''}"`
              );
              break;

            case 'insert':
              if (!position) {
                throw new Error('Insert operation requires position parameter');
              }
              currentContent = this.applyInsertEdit(
                currentContent,
                position,
                editContent || ''
              );
              appliedEdits.push(
                `Insert at ${JSON.stringify(position)}: "${editContent || ''}"`
              );
              break;

            case 'delete':
              if (search) {
                currentContent = this.applyDeleteBySearch(
                  currentContent,
                  search
                );
                appliedEdits.push(`Delete by pattern: "${search.pattern}"`);
              } else if (position) {
                currentContent = this.applyDeleteByPosition(
                  currentContent,
                  position
                );
                appliedEdits.push(`Delete at ${JSON.stringify(position)}`);
              } else {
                throw new Error(
                  'Delete operation requires either search or position parameter'
                );
              }
              break;

            default:
              throw new Error(`Unknown edit type: ${type}`);
          }
        } catch (editError) {
          // Rollback: restore original content
          await fs.writeFile(validatedPath, originalContent, 'utf8');
          throw new FileSystemError(
            `Edit ${i + 1} failed: ${editError instanceof Error ? editError.message : String(editError)}`,
            'FILE_NOT_FOUND',
            filePath,
            'Check edit parameters and try again'
          );
        }
      }

      // Write final content atomically
      const tempPath = `${validatedPath}.tmp.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`;

      try {
        await fs.writeFile(tempPath, currentContent, 'utf8');
        await fs.rename(tempPath, validatedPath);
      } catch (error) {
        // Clean up temp file and restore original
        try {
          await fs.unlink(tempPath);
          await fs.writeFile(validatedPath, originalContent, 'utf8');
        } catch {
          // Ignore cleanup errors
        }

        throw new FileSystemError(
          `Failed to write edited file: ${error instanceof Error ? error.message : String(error)}`,
          'PERMISSION_DENIED',
          filePath,
          'Check file permissions and disk space'
        );
      }

      // Track operation for rollback capability
      const reverseOperation = async () => {
        await fs.writeFile(validatedPath, originalContent, 'utf8');
      };

      await this.state.trackChange({
        tool: 'EditFile',
        params: { path: filePath, edits },
        timestamp: new Date(),
        reversible: true,
        reverseOperation,
      });

      // Get file stats for response
      const stats = await fs.stat(validatedPath);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                path: filePath,
                editsApplied: appliedEdits.length,
                edits: appliedEdits,
                metadata: {
                  originalSize: Buffer.byteLength(originalContent, 'utf8'),
                  newSize: stats.size,
                  lastModified: stats.mtime,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }

      if ((error as any).code === 'ENOENT') {
        throw new FileSystemError(
          `File not found: ${filePath}`,
          'FILE_NOT_FOUND',
          filePath,
          'Check that the file path is correct and the file exists'
        );
      }

      if ((error as any).code === 'EACCES') {
        throw new FileSystemError(
          `Permission denied: ${filePath}`,
          'PERMISSION_DENIED',
          filePath,
          'Check file permissions for read and write access'
        );
      }

      throw new FileSystemError(
        `Failed to edit file: ${error instanceof Error ? error.message : String(error)}`,
        'PERMISSION_DENIED',
        filePath
      );
    }
  }

  /**
   * Apply replace edit operation
   */
  private applyReplaceEdit(
    content: string,
    search: any,
    replacement: string
  ): string {
    const { pattern, isRegex = false, occurrence = 'first' } = search;

    if (isRegex) {
      try {
        const regex = new RegExp(pattern, 'g');
        const matches = Array.from(content.matchAll(regex));

        if (matches.length === 0) {
          throw new Error(`Pattern not found: ${pattern}`);
        }

        if (occurrence === 'all') {
          return content.replace(regex, replacement);
        } else if (occurrence === 'first') {
          return content.replace(new RegExp(pattern), replacement);
        } else if (occurrence === 'last') {
          const lastMatch = matches[matches.length - 1];
          if (!lastMatch || lastMatch.index === undefined) {
            throw new Error('Match found but index is undefined');
          }
          const beforeLast = content.substring(0, lastMatch.index);
          const afterLast = content.substring(
            lastMatch.index + lastMatch[0].length
          );
          return beforeLast + replacement + afterLast;
        } else if (typeof occurrence === 'number') {
          if (occurrence < 1 || occurrence > matches.length) {
            throw new Error(
              `Occurrence ${occurrence} not found (found ${matches.length} matches)`
            );
          }
          const targetMatch = matches[occurrence - 1];
          if (!targetMatch || targetMatch.index === undefined) {
            throw new Error('Match found but index is undefined');
          }
          const before = content.substring(0, targetMatch.index);
          const after = content.substring(
            targetMatch.index + targetMatch[0].length
          );
          return before + replacement + after;
        }
      } catch (regexError) {
        throw new Error(
          `Invalid regex pattern: ${regexError instanceof Error ? regexError.message : String(regexError)}`
        );
      }
    } else {
      // Literal string matching
      const indices: number[] = [];
      let index = content.indexOf(pattern);
      while (index !== -1) {
        indices.push(index);
        index = content.indexOf(pattern, index + 1);
      }

      if (indices.length === 0) {
        throw new Error(`Pattern not found: ${pattern}`);
      }

      if (occurrence === 'all') {
        return content.split(pattern).join(replacement);
      } else if (occurrence === 'first') {
        const firstIndex = indices[0];
        return (
          content.substring(0, firstIndex) +
          replacement +
          content.substring(firstIndex + pattern.length)
        );
      } else if (occurrence === 'last') {
        const lastIndex = indices[indices.length - 1];
        return (
          content.substring(0, lastIndex) +
          replacement +
          content.substring(lastIndex + pattern.length)
        );
      } else if (typeof occurrence === 'number') {
        if (occurrence < 1 || occurrence > indices.length) {
          throw new Error(
            `Occurrence ${occurrence} not found (found ${indices.length} matches)`
          );
        }
        const targetIndex = indices[occurrence - 1];
        return (
          content.substring(0, targetIndex) +
          replacement +
          content.substring(targetIndex + pattern.length)
        );
      }
    }

    return content;
  }

  /**
   * Apply insert edit operation
   */
  private applyInsertEdit(
    content: string,
    position: any,
    insertContent: string
  ): string {
    if (position === 'start') {
      return insertContent + content;
    } else if (position === 'end') {
      return content + insertContent;
    } else if (typeof position === 'object' && position.line) {
      const lines = content.split('\n');
      const lineIndex = position.line - 1; // Convert to 0-based

      if (lineIndex < 0 || lineIndex > lines.length) {
        throw new Error(
          `Line ${position.line} is out of range (file has ${lines.length} lines)`
        );
      }

      if (position.column) {
        const line = lines[lineIndex] || '';
        const columnIndex = position.column - 1; // Convert to 0-based

        if (columnIndex < 0 || columnIndex > line.length) {
          throw new Error(
            `Column ${position.column} is out of range for line ${position.line}`
          );
        }

        const newLine =
          line.substring(0, columnIndex) +
          insertContent +
          line.substring(columnIndex);
        lines[lineIndex] = newLine;
      } else {
        // Insert at beginning of line
        lines.splice(lineIndex, 0, insertContent);
      }

      return lines.join('\n');
    }

    throw new Error(`Invalid position format: ${JSON.stringify(position)}`);
  }

  /**
   * Apply delete by search operation
   */
  private applyDeleteBySearch(content: string, search: any): string {
    return this.applyReplaceEdit(content, search, '');
  }

  /**
   * Apply delete by position operation
   */
  private applyDeleteByPosition(content: string, position: any): string {
    if (typeof position === 'object' && position.line) {
      const lines = content.split('\n');
      const lineIndex = position.line - 1; // Convert to 0-based

      if (lineIndex < 0 || lineIndex >= lines.length) {
        throw new Error(
          `Line ${position.line} is out of range (file has ${lines.length} lines)`
        );
      }

      lines.splice(lineIndex, 1);
      return lines.join('\n');
    }

    throw new Error(
      `Invalid position format for delete: ${JSON.stringify(position)}`
    );
  }

  /**
   * SearchFiles tool implementation
   */
  private async searchFiles(params: any): Promise<ToolResult> {
    const { pattern, options } = params;
    const {
      includeGlobs = ['**/*'],
      excludeGlobs = [],
      maxResults = 100,
      contextLines = 3,
      searchType = 'literal',
    } = options;

    try {
      // Get list of files to search using glob patterns and WorkspaceSecurity
      const workspaceRoot = this.security.getWorkspaceRoot();

      // Build include patterns
      const includePatterns = includeGlobs.map((globPattern: string) =>
        path.resolve(
          workspaceRoot,
          globPattern.startsWith('/') ? globPattern.slice(1) : globPattern
        )
      );

      // Get all matching files
      const allFiles: string[] = [];
      for (const includePattern of includePatterns) {
        try {
          const globPattern =
            this.security.createSafeGlobPattern(includePattern);
          const files = await glob(globPattern, {
            ignore: excludeGlobs.map((exclude: string) =>
              path.resolve(
                workspaceRoot,
                exclude.startsWith('/') ? exclude.slice(1) : exclude
              )
            ),
            nodir: true,
          });
          allFiles.push(...files);
        } catch {
          // Continue with other patterns if one fails
        }
      }

      // Remove duplicates and filter through WorkspaceSecurity
      const uniqueFiles = Array.from(new Set(allFiles));
      const validFiles: string[] = [];

      for (const file of uniqueFiles) {
        try {
          await this.security.validateFileAccess(file, 'read');
          validFiles.push(file);
        } catch {
          // Skip files that don't pass security validation
        }
      }

      const results: any[] = [];
      let resultCount = 0;

      // Search each file
      for (const filePath of validFiles) {
        if (resultCount >= maxResults) {
          break;
        }

        try {
          if (searchType === 'filename') {
            // Search by filename
            const fileName = path.basename(filePath);
            const fileMatches = this.searchInFilename(
              fileName,
              pattern,
              searchType
            );

            for (const match of fileMatches) {
              if (resultCount >= maxResults) {
                break;
              }

              const result: any = {
                file: path.relative(workspaceRoot, filePath),
                line: 1, // Filename matches don't have line numbers
                column: match.column,
                match: match.text,
                context: {
                  before: [],
                  after: [],
                },
              };

              results.push(result);
              resultCount++;
            }
          } else {
            // Search by file content
            const content = await fs.readFile(filePath, 'utf8');
            const matches = this.searchInFile(
              content,
              pattern,
              searchType,
              filePath
            );

            for (const match of matches) {
              if (resultCount >= maxResults) {
                break;
              }

              const context = this.extractContext(
                content,
                match.line,
                contextLines
              );

              const result: any = {
                file: path.relative(workspaceRoot, filePath),
                line: match.line,
                column: match.column,
                match: match.text,
                context: context,
              };

              // Add confidence score for fuzzy and AST searches
              if (match.confidence !== undefined) {
                result.confidence = match.confidence;
              }

              results.push(result);
              resultCount++;
            }
          }
        } catch {
          // Skip files that can't be read (binary files, permission issues, etc.)
          continue;
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                pattern,
                searchType,
                filesSearched: validFiles.length,
                matchesFound: results.length,
                maxResults,
                results: results,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }

      throw new FileSystemError(
        `Search failed: ${error instanceof Error ? error.message : String(error)}`,
        'FILE_NOT_FOUND',
        'search',
        'Check search parameters and patterns'
      );
    }
  }

  /**
   * Search for pattern in file content
   */
  private searchInFile(
    content: string,
    pattern: string,
    searchType: string,
    filePath: string
  ): Array<{
    line: number;
    column: number;
    text: string;
    confidence?: number;
  }> {
    switch (searchType) {
      case 'fuzzy':
        return this.performFuzzySearch(content, pattern, filePath);

      case 'ast':
        return this.performASTSearch(content, pattern, filePath);

      case 'regex':
        return this.performRegexSearch(content, pattern);

      default: // 'literal'
        return this.performLiteralSearch(content, pattern);
    }
  }

  /**
   * Perform fuzzy search using FuzzyMatcher
   */
  private performFuzzySearch(
    content: string,
    pattern: string,
    filePath: string
  ): Array<{ line: number; column: number; text: string; confidence: number }> {
    const fuzzyMatches = this.fuzzyMatcher.searchInContent(
      content,
      pattern,
      filePath
    );

    return fuzzyMatches.map(match => ({
      line: match.line,
      column: match.column,
      text: match.text,
      confidence: match.confidence,
    }));
  }

  /**
   * Perform AST-based search using ASTSearcher
   */
  private performASTSearch(
    content: string,
    pattern: string,
    filePath: string
  ): Array<{
    line: number;
    column: number;
    text: string;
    confidence?: number;
  }> {
    const astMatches = this.astSearcher.searchInContent(
      content,
      pattern,
      filePath
    );

    return astMatches.map(match => ({
      line: match.line,
      column: match.column,
      text: match.text,
      // AST matches are exact, so confidence is always 100
      confidence: 100,
    }));
  }

  /**
   * Perform regex search
   */
  private performRegexSearch(
    content: string,
    pattern: string
  ): Array<{ line: number; column: number; text: string }> {
    const matches: Array<{ line: number; column: number; text: string }> = [];
    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      try {
        const regex = new RegExp(pattern, 'gi');
        let match;
        while ((match = regex.exec(line || '')) !== null) {
          matches.push({
            line: lineIndex + 1, // Convert to 1-based
            column: match.index + 1, // Convert to 1-based
            text: match[0],
          });

          // Prevent infinite loop on zero-length matches
          if (match[0].length === 0) {
            regex.lastIndex++;
          }
        }
      } catch (regexError) {
        throw new Error(
          `Invalid regex pattern: ${regexError instanceof Error ? regexError.message : String(regexError)}`
        );
      }
    }

    return matches;
  }

  /**
   * Perform literal search
   */
  private performLiteralSearch(
    content: string,
    pattern: string
  ): Array<{ line: number; column: number; text: string }> {
    const matches: Array<{ line: number; column: number; text: string }> = [];
    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      let searchIndex = 0;
      const currentLine = line || '';

      while (true) {
        const foundIndex = currentLine
          .toLowerCase()
          .indexOf(pattern.toLowerCase(), searchIndex);
        if (foundIndex === -1) {
          break;
        }

        matches.push({
          line: lineIndex + 1, // Convert to 1-based
          column: foundIndex + 1, // Convert to 1-based
          text: currentLine.substring(foundIndex, foundIndex + pattern.length),
        });

        searchIndex = foundIndex + 1;
      }
    }

    return matches;
  }

  /**
   * Search for pattern in filename
   */
  private searchInFilename(
    fileName: string,
    pattern: string,
    _searchType: string
  ): Array<{
    line: number;
    column: number;
    text: string;
  }> {
    const matches: Array<{ line: number; column: number; text: string }> = [];

    // For filename search, we use case-insensitive literal matching by default
    const searchText = fileName.toLowerCase();
    const searchPattern = pattern.toLowerCase();

    let searchIndex = 0;

    while (true) {
      const foundIndex = searchText.indexOf(searchPattern, searchIndex);
      if (foundIndex === -1) {
        break;
      }

      matches.push({
        line: 1, // Filenames are always "line 1"
        column: foundIndex + 1, // Convert to 1-based indexing
        text: fileName.substring(foundIndex, foundIndex + pattern.length),
      });

      searchIndex = foundIndex + 1;
    }

    return matches;
  }

  /**
   * Extract context lines around a match
   */
  private extractContext(
    content: string,
    matchLine: number,
    contextLines: number
  ): { before: string[]; after: string[] } {
    const lines = content.split('\n');
    const lineIndex = matchLine - 1; // Convert to 0-based

    const beforeStart = Math.max(0, lineIndex - contextLines);
    const beforeEnd = lineIndex;
    const afterStart = lineIndex + 1;
    const afterEnd = Math.min(lines.length, lineIndex + 1 + contextLines);

    const before = lines.slice(beforeStart, beforeEnd);
    const after = lines.slice(afterStart, afterEnd);

    return { before, after };
  }

  /**
   * Smart default exclusion patterns for common build/dependency directories
   */
  private static readonly DEFAULT_EXCLUSIONS = [
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.git',
    '.vscode',
    '.idea',
    'vendor',
    'target',
    '__pycache__',
    '.pytest_cache',
    '.mypy_cache',
    '.tox',
    '.venv',
    'venv',
    '.env',
    'bower_components',
    'jspm_packages',
    '.nuxt',
    '.next',
    '.svelte-kit',
    'out',
    'public/build',
    '.parcel-cache',
    '.cache',
    'tmp',
    'temp',
  ];

  /**
   * ListDirectory tool implementation
   */
  private async listDirectory(params: any): Promise<ToolResult> {
    const {
      path: dirPath,
      recursive = false,
      maxDepth = 3,
      includeHidden = false,
      sortBy = 'importance',
      sortOrder = 'asc',
      filterExtensions,
      excludePatterns = [],
      maxEntries = 1000,
      offset = 0,
      mode = 'full',
      includeCommonBuildDirs = false,
      quick = false,
    } = params;

    try {
      // Validate directory path through WorkspaceSecurity
      const validatedPath = await this.security.validateFileAccess(
        dirPath,
        'read'
      );

      // Check if path is actually a directory
      const stats = await fs.stat(validatedPath);
      if (!stats.isDirectory()) {
        throw new FileSystemError(
          `Path is not a directory: ${dirPath}`,
          'FILE_NOT_FOUND',
          dirPath,
          'Ensure the path points to a valid directory'
        );
      }

      // Combine smart defaults with user exclusions
      const effectiveExclusions = includeCommonBuildDirs
        ? excludePatterns
        : [...FilesystemMCPClient.DEFAULT_EXCLUSIONS, ...excludePatterns];

      // Get directory entries with enhanced options and timeout protection
      const startTime = Date.now();
      const timeoutMs = 30000; // 30 second timeout

      const result = await Promise.race([
        this.getDirectoryEntriesEnhanced(validatedPath, {
          recursive,
          maxDepth,
          includeHidden,
          filterExtensions,
          excludePatterns: effectiveExclusions,
          maxEntries,
          offset,
          mode,
          quick,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Directory listing timeout')),
            timeoutMs
          )
        ),
      ]);

      const processingTime = Date.now() - startTime;

      // Sort entries based on mode and sortBy
      this.sortEntriesEnhanced(result.entries, sortBy, sortOrder, mode);

      // Get workspace root for relative paths
      const workspaceRoot = this.security.getWorkspaceRoot();

      // Build response based on mode
      const response = this.buildResponse(
        validatedPath,
        workspaceRoot,
        result,
        params,
        processingTime
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }

      if ((error as any).code === 'ENOENT') {
        throw new FileSystemError(
          `Directory not found: ${dirPath}`,
          'FILE_NOT_FOUND',
          dirPath,
          'Check that the directory path is correct and exists'
        );
      }

      if ((error as any).code === 'EACCES') {
        throw new FileSystemError(
          `Permission denied: ${dirPath}`,
          'PERMISSION_DENIED',
          dirPath,
          'Check directory permissions for read access'
        );
      }

      throw new FileSystemError(
        `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`,
        'FILE_NOT_FOUND',
        dirPath
      );
    }
  }

  /**
   * Enhanced directory traversal with performance optimizations and result limits
   */
  private async getDirectoryEntriesEnhanced(
    dirPath: string,
    options: {
      recursive: boolean;
      maxDepth: number;
      includeHidden: boolean;
      filterExtensions?: string[];
      excludePatterns: string[];
      maxEntries: number;
      offset: number;
      mode: string;
      quick: boolean;
    }
  ): Promise<{
    entries: any[];
    totalFound: number;
    truncated: boolean;
    skippedDirs: string[];
  }> {
    const entries: any[] = [];
    const skippedDirs: string[] = [];
    const workspaceRoot = this.security.getWorkspaceRoot();
    let totalFound = 0;
    let processedCount = 0;
    const startTime = Date.now();

    const processDirectory = async (
      currentDirPath: string,
      currentDepth: number = 0
    ): Promise<void> => {
      // Safety checks for early termination
      if (processedCount >= options.maxEntries + options.offset) {
        return;
      }

      // Memory safety: Check if we're processing too many entries
      if (totalFound > 50000) {
        throw new Error(
          'Directory too large - consider using filters or pagination'
        );
      }

      // Time-based early termination
      if (Date.now() - startTime > 25000) {
        // 25 second processing limit
        throw new Error('Processing timeout - directory too complex');
      }

      try {
        const dirEntries = await fs.readdir(currentDirPath, {
          withFileTypes: true,
        });

        for (const entry of dirEntries) {
          // Early termination check
          if (processedCount >= options.maxEntries + options.offset) {
            break;
          }

          // Skip hidden files if not requested
          if (!options.includeHidden && entry.name.startsWith('.')) {
            continue;
          }

          const fullPath = path.join(currentDirPath, entry.name);
          const relativePath = path.relative(workspaceRoot, fullPath);

          // Check exclude patterns (improved pattern matching)
          if (
            this.shouldExclude(
              entry.name,
              relativePath,
              options.excludePatterns
            )
          ) {
            if (entry.isDirectory()) {
              skippedDirs.push(relativePath);
            }
            continue;
          }

          try {
            // Quick validation without full security check for performance
            if (!options.quick) {
              await this.security.validateFileAccess(fullPath, 'read');
            }

            const isDirectory = entry.isDirectory();
            const isFile = entry.isFile();

            // Filter by extensions for files
            if (
              options.filterExtensions &&
              options.filterExtensions.length > 0
            ) {
              if (isFile) {
                const ext = path.extname(entry.name).toLowerCase();
                if (!options.filterExtensions.includes(ext)) {
                  continue;
                }
              } else {
                // Skip directories when filtering by file extensions
                continue;
              }
            }

            totalFound++;

            // Apply pagination (skip offset entries)
            if (totalFound <= options.offset) {
              continue;
            }

            // Get metadata based on mode
            const entryData = await this.createEntryData(
              entry,
              fullPath,
              relativePath,
              isDirectory,
              isFile,
              options
            );

            entries.push(entryData);
            processedCount++;

            // Recurse into subdirectories if needed
            if (
              isDirectory &&
              options.recursive &&
              currentDepth < options.maxDepth &&
              processedCount < options.maxEntries + options.offset
            ) {
              await processDirectory(fullPath, currentDepth + 1);
            }
          } catch {
            // Skip entries that fail validation or stat
            continue;
          }
        }
      } catch (error) {
        // If we can't read the directory, add to skipped
        const relativePath = path.relative(workspaceRoot, currentDirPath);
        skippedDirs.push(relativePath);
      }
    };

    await processDirectory(dirPath);

    return {
      entries,
      totalFound,
      truncated: totalFound > options.maxEntries,
      skippedDirs,
    };
  }

  /**
   * Improved pattern matching for exclusions
   */
  private shouldExclude(
    fileName: string,
    relativePath: string,
    excludePatterns: string[]
  ): boolean {
    return excludePatterns.some(pattern => {
      // Exact name match
      if (fileName === pattern) {
        return true;
      }

      // Path contains pattern
      if (relativePath.includes(pattern)) {
        return true;
      }

      // Simple glob-like matching for common patterns
      if (pattern.includes('*')) {
        const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
        return new RegExp(regexPattern).test(fileName);
      }

      return false;
    });
  }

  /**
   * Create entry data with performance optimizations
   */
  private async createEntryData(
    entry: any,
    fullPath: string,
    relativePath: string,
    isDirectory: boolean,
    isFile: boolean,
    options: any
  ): Promise<any> {
    const baseData = {
      name: entry.name,
      path: relativePath,
      type: isDirectory ? 'directory' : isFile ? 'file' : 'other',
    };

    // For quick mode or summary mode, return minimal data
    if (options.quick || options.mode === 'summary') {
      return {
        ...baseData,
        extension: isFile ? path.extname(entry.name).toLowerCase() : undefined,
      };
    }

    // For full mode, get detailed metadata
    try {
      const stats = await fs.stat(fullPath);

      return {
        ...baseData,
        size: isFile ? stats.size : undefined,
        modified: stats.mtime,
        permissions: {
          readable: true, // We already validated read access
          writable: !options.quick
            ? await this.checkWriteAccess(fullPath)
            : undefined,
        },
        extension: isFile ? path.extname(entry.name).toLowerCase() : undefined,
        language: isFile ? this.detectLanguage(fullPath) : undefined,
        importance: this.calculateImportance(entry.name, isFile, isDirectory),
      };
    } catch {
      // Fallback to basic data if stat fails
      return {
        ...baseData,
        extension: isFile ? path.extname(entry.name).toLowerCase() : undefined,
        importance: this.calculateImportance(entry.name, isFile, isDirectory),
      };
    }
  }

  /**
   * Calculate file importance for smart sorting
   */
  private calculateImportance(
    fileName: string,
    isFile: boolean,
    isDirectory: boolean
  ): number {
    const name = fileName.toLowerCase();

    // Highest importance: Project metadata files
    if (isFile) {
      if (['readme.md', 'readme.txt', 'readme'].includes(name)) return 100;
      if (
        ['package.json', 'cargo.toml', 'pyproject.toml', 'pom.xml'].includes(
          name
        )
      )
        return 95;
      if (
        [
          'tsconfig.json',
          'jsconfig.json',
          'webpack.config.js',
          'vite.config.js',
        ].includes(name)
      )
        return 90;
      if (name.endsWith('.config.js') || name.endsWith('.config.ts')) return 85;
      if (['license', 'license.txt', 'license.md'].includes(name)) return 80;
      if (name.startsWith('.env') || name === 'dockerfile') return 75;
    }

    // High importance: Source directories
    if (isDirectory) {
      if (['src', 'lib', 'app', 'pages', 'components'].includes(name))
        return 70;
      if (['docs', 'documentation', 'examples'].includes(name)) return 65;
      if (['test', 'tests', '__tests__', 'spec'].includes(name)) return 60;
    }

    // Medium importance: Common files
    if (isFile) {
      if (name.endsWith('.md')) return 55;
      if (
        name.endsWith('.ts') ||
        name.endsWith('.js') ||
        name.endsWith('.tsx') ||
        name.endsWith('.jsx')
      )
        return 50;
      if (
        name.endsWith('.py') ||
        name.endsWith('.java') ||
        name.endsWith('.rs') ||
        name.endsWith('.go')
      )
        return 50;
    }

    // Lower importance: Other files and directories
    if (isDirectory) return 30;
    if (isFile) return 20;

    return 10; // Default
  }

  /**
   * Build response based on mode
   */
  private buildResponse(
    validatedPath: string,
    workspaceRoot: string,
    result: any,
    params: any,
    processingTime: number
  ): any {
    const basePath = path.relative(workspaceRoot, validatedPath);

    const baseResponse = {
      path: basePath,
      mode: params.mode,
      processingTime,
      performance: {
        entriesFound: result.totalFound,
        entriesReturned: result.entries.length,
        truncated: result.truncated,
        skippedDirectories: result.skippedDirs.length,
      },
    };

    switch (params.mode) {
      case 'summary':
        return {
          ...baseResponse,
          summary: {
            totalEntries: result.totalFound,
            directories: result.entries.filter(
              (e: any) => e.type === 'directory'
            ).length,
            files: result.entries.filter((e: any) => e.type === 'file').length,
            importantFiles: result.entries
              .filter((e: any) => e.type === 'file' && (e.importance || 0) > 70)
              .map((e: any) => ({
                name: e.name,
                path: e.path,
                importance: e.importance,
              })),
          },
          pagination: {
            offset: params.offset,
            limit: params.maxEntries,
            hasMore: result.truncated,
          },
        };

      case 'project-files':
        return {
          ...baseResponse,
          projectStructure: {
            importantFiles: result.entries
              .filter((e: any) => (e.importance || 0) > 50)
              .slice(0, 50), // Limit to top 50 important files
            sourceDirectories: result.entries.filter(
              (e: any) => e.type === 'directory' && (e.importance || 0) > 60
            ),
            configFiles: result.entries.filter(
              (e: any) => e.type === 'file' && (e.importance || 0) > 80
            ),
          },
          pagination: {
            offset: params.offset,
            limit: params.maxEntries,
            hasMore: result.truncated,
          },
        };

      default: // 'full'
        return {
          ...baseResponse,
          totalEntries: result.entries.length,
          directories: result.entries.filter((e: any) => e.type === 'directory')
            .length,
          files: result.entries.filter((e: any) => e.type === 'file').length,
          entries: result.entries,
          pagination: {
            offset: params.offset,
            limit: params.maxEntries,
            hasMore: result.truncated,
          },
          warnings:
            result.skippedDirs.length > 0
              ? [
                  `Skipped ${result.skippedDirs.length} directories due to permissions or exclusions`,
                ]
              : [],
        };
    }
  }

  /**
   * Check if we have write access to a path
   */
  private async checkWriteAccess(filePath: string): Promise<boolean> {
    try {
      await this.security.validateFileAccess(filePath, 'write');
      await fs.access(filePath, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Enhanced sorting with importance-based ordering
   */
  private sortEntriesEnhanced(
    entries: any[],
    sortBy: string,
    sortOrder: string,
    _mode: string
  ): void {
    entries.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'importance':
          // Primary sort by importance (higher first), secondary by name
          comparison = (b.importance || 0) - (a.importance || 0);
          if (comparison === 0) {
            comparison = a.name.localeCompare(b.name);
          }
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          // Directories come first, then by size
          if (a.type === 'directory' && b.type !== 'directory') {
            comparison = -1;
          } else if (a.type !== 'directory' && b.type === 'directory') {
            comparison = 1;
          } else {
            comparison = (a.size || 0) - (b.size || 0);
          }
          break;
        case 'modified':
          const aTime = a.modified ? new Date(a.modified).getTime() : 0;
          const bTime = b.modified ? new Date(b.modified).getTime() : 0;
          comparison = aTime - bTime;
          break;
        case 'type':
          // First by type (directory vs file), then by importance, then by name
          if (a.type !== b.type) {
            comparison = a.type.localeCompare(b.type);
          } else {
            comparison = (b.importance || 0) - (a.importance || 0);
            if (comparison === 0) {
              comparison = a.name.localeCompare(b.name);
            }
          }
          break;
        default:
          // Default to importance-based sorting for better LLM experience
          comparison = (b.importance || 0) - (a.importance || 0);
          if (comparison === 0) {
            comparison = a.name.localeCompare(b.name);
          }
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }
}
