import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { 
  MCPClient, 
  Tool, 
  ToolResult, 
  Resource, 
  MCPServerInfo,
  MCPError,
  MCPToolError,
  MCPResourceError
} from './base.js';
import { WorkspaceSecurity } from '../security/workspace.js';

export class FilesystemMCPClient extends MCPClient {
  private security: WorkspaceSecurity;

  constructor(security: WorkspaceSecurity) {
    super('filesystem');
    this.security = security;
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
      name: 'filesystem',
      version: '1.0.0',
      capabilities: {
        tools: true,
        resources: true,
        prompts: false
      }
    };
  }

  async listTools(): Promise<Tool[]> {
    return [
      {
        name: 'read_file',
        description: 'Read the contents of a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to read'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'write_file',
        description: 'Write content to a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to write'
            },
            content: {
              type: 'string',
              description: 'Content to write to the file'
            }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'list_directory',
        description: 'List files and directories in a directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the directory to list'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'search_files',
        description: 'Search for files using glob patterns',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Glob pattern to search for files'
            },
            content: {
              type: 'string',
              description: 'Optional: Search for files containing this text'
            }
          },
          required: ['pattern']
        }
      },
      {
        name: 'edit_file',
        description: 'Edit a file by replacing specific content',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to edit'
            },
            old_content: {
              type: 'string',
              description: 'Content to replace'
            },
            new_content: {
              type: 'string',
              description: 'New content to replace with'
            }
          },
          required: ['path', 'old_content', 'new_content']
        }
      }
    ];
  }

  async callTool(name: string, args: Record<string, any>): Promise<ToolResult> {
    try {
      switch (name) {
        case 'read_file':
          return await this.readFile(args.path);
        case 'write_file':
          return await this.writeFile(args.path, args.content);
        case 'list_directory':
          return await this.listDirectory(args.path);
        case 'search_files':
          return await this.searchFiles(args.pattern, args.content);
        case 'edit_file':
          return await this.editFile(args.path, args.old_content, args.new_content);
        default:
          throw new MCPToolError(name, `Unknown tool: ${name}`);
      }
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }
      throw new MCPToolError(name, `Tool execution failed: ${error}`);
    }
  }

  async listResources(): Promise<Resource[]> {
    try {
      const workspaceRoot = this.security.getWorkspaceRoot();
      const pattern = path.join(workspaceRoot, '**/*');
      const files = await glob(pattern, { 
        ignore: ['**/node_modules/**', '**/.*/**'],
        nodir: true 
      });

      return files.map(file => ({
        uri: `file://${file}`,
        name: path.relative(workspaceRoot, file),
        mimeType: this.getMimeType(file)
      }));
    } catch (error) {
      throw new MCPResourceError('*', `Failed to list resources: ${error}`);
    }
  }

  async readResource(uri: string): Promise<ToolResult> {
    try {
      if (!uri.startsWith('file://')) {
        throw new MCPResourceError(uri, 'Only file:// URIs are supported');
      }

      const filePath = uri.replace('file://', '');
      return await this.readFile(filePath);
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }
      throw new MCPResourceError(uri, `Failed to read resource: ${error}`);
    }
  }

  private async readFile(filePath: string): Promise<ToolResult> {
    try {
      const validatedPath = await this.security.validateFileAccess(filePath, 'read');
      const content = await fs.readFile(validatedPath, 'utf8');
      
      return {
        content: [{
          type: 'text',
          text: content
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error reading file: ${error}`
        }],
        isError: true
      };
    }
  }

  private async writeFile(filePath: string, content: string): Promise<ToolResult> {
    try {
      const validatedPath = await this.security.validateFileAccess(filePath, 'write');
      
      // Create backup if file exists
      let backupCreated = false;
      try {
        await fs.access(validatedPath);
        const backupPath = `${validatedPath}.backup.${Date.now()}`;
        await fs.copyFile(validatedPath, backupPath);
        backupCreated = true;
      } catch {
        // File doesn't exist, no backup needed
      }

      // Write new content
      await fs.mkdir(path.dirname(validatedPath), { recursive: true });
      await fs.writeFile(validatedPath, content, 'utf8');

      return {
        content: [{
          type: 'text',
          text: `Successfully wrote to ${filePath}${backupCreated ? ' (backup created)' : ''}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error writing file: ${error}`
        }],
        isError: true
      };
    }
  }

  private async listDirectory(dirPath: string): Promise<ToolResult> {
    try {
      const validatedPath = this.security.validatePath(dirPath);
      const entries = await fs.readdir(validatedPath, { withFileTypes: true });

      const result = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(validatedPath, entry.name);
          const stats = await fs.stat(fullPath);
          const relativePath = this.security.getRelativePathFromWorkspace(fullPath);
          
          return {
            name: entry.name,
            path: relativePath,
            type: entry.isDirectory() ? 'directory' : 'file',
            size: entry.isFile() ? stats.size : undefined,
            modified: stats.mtime.toISOString()
          };
        })
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error listing directory: ${error}`
        }],
        isError: true
      };
    }
  }

  private async searchFiles(pattern: string, contentSearch?: string): Promise<ToolResult> {
    try {
      let safePattern = this.security.createSafeGlobPattern(pattern);
      
      // If pattern doesn't contain ** and starts with *, make it recursive
      if (safePattern.startsWith('*') && !safePattern.includes('**')) {
        safePattern = '**/' + safePattern;
      }
      
      const workspaceRoot = this.security.getWorkspaceRoot();
      const fullPattern = path.join(workspaceRoot, safePattern);
      
      let files = await glob(fullPattern, { 
        nodir: true,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**']
      });

      // Filter by allowed extensions
      const allowedExts = this.security.getAllowedExtensions();
      if (allowedExts.length > 0) {
        files = files.filter(file => {
          const ext = path.extname(file).toLowerCase();
          return allowedExts.includes(ext);
        });
      }

      // Content search if specified
      if (contentSearch) {
        const matchingFiles = [];
        for (const file of files) {
          try {
            const content = await fs.readFile(file, 'utf8');
            if (content.includes(contentSearch)) {
              matchingFiles.push(file);
            }
          } catch {
            // Skip files that can't be read
          }
        }
        files = matchingFiles;
      }

      const relativePaths = files.map(file => 
        this.security.getRelativePathFromWorkspace(file)
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(relativePaths, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error searching files: ${error}`
        }],
        isError: true
      };
    }
  }

  private async editFile(filePath: string, oldContent: string, newContent: string): Promise<ToolResult> {
    try {
      const validatedPath = await this.security.validateFileAccess(filePath, 'write');
      const currentContent = await fs.readFile(validatedPath, 'utf8');

      if (!currentContent.includes(oldContent)) {
        return {
          content: [{
            type: 'text',
            text: `Content to replace not found in file: ${filePath}`
          }],
          isError: true
        };
      }

      const updatedContent = currentContent.replace(oldContent, newContent);
      
      // Create backup
      const backupPath = `${validatedPath}.backup.${Date.now()}`;
      await fs.copyFile(validatedPath, backupPath);

      // Write updated content
      await fs.writeFile(validatedPath, updatedContent, 'utf8');

      return {
        content: [{
          type: 'text',
          text: `Successfully edited ${filePath} (backup created at ${path.basename(backupPath)})`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error editing file: ${error}`
        }],
        isError: true
      };
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.json': 'application/json',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.py': 'text/x-python',
      '.rs': 'text/x-rustsrc',
      '.go': 'text/x-go',
      '.java': 'text/x-java',
      '.c': 'text/x-c',
      '.cpp': 'text/x-c++',
      '.h': 'text/x-c-header',
      '.yaml': 'application/x-yaml',
      '.yml': 'application/x-yaml'
    };

    return mimeMap[ext] || 'text/plain';
  }
}