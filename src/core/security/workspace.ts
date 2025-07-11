import * as path from 'path';
import * as fs from 'fs/promises';

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class WorkspaceSecurity {
  private workspaceRoot: string;
  private allowedExtensions: Set<string>;
  private maxFileSize: number;

  constructor(
    workspaceRoot: string = process.cwd(),
    allowedExtensions: string[] = [],
    maxFileSize: number = 1024 * 1024
  ) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.allowedExtensions = new Set(allowedExtensions);
    this.maxFileSize = maxFileSize;
  }

  validatePath(targetPath: string): string {
    if (!targetPath || typeof targetPath !== 'string') {
      throw new SecurityError('Invalid path provided');
    }

    // Resolve the path to get absolute path
    const resolvedPath = path.resolve(targetPath);

    // Check if path is within workspace
    if (!this.isWithinWorkspace(resolvedPath)) {
      throw new SecurityError(
        `Path '${targetPath}' is outside workspace boundary`
      );
    }

    return resolvedPath;
  }

  validateFileExtension(filePath: string): void {
    if (this.allowedExtensions.size === 0) {
      return; // No restrictions if no extensions specified
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!this.allowedExtensions.has(ext)) {
      throw new SecurityError(`File extension '${ext}' is not allowed`);
    }
  }

  async validateFileSize(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      if (stats.size > this.maxFileSize) {
        throw new SecurityError(
          `File size (${stats.size} bytes) exceeds maximum allowed size (${this.maxFileSize} bytes)`
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist yet, that's okay for write operations
        return;
      }
      throw error;
    }
  }

  async validateFileAccess(
    filePath: string,
    mode: 'read' | 'write'
  ): Promise<string> {
    const validatedPath = this.validatePath(filePath);
    this.validateFileExtension(validatedPath);

    if (mode === 'read') {
      try {
        await fs.access(validatedPath, fs.constants.R_OK);
      } catch {
        throw new SecurityError(
          `File '${filePath}' is not readable or does not exist`
        );
      }
    }

    await this.validateFileSize(validatedPath);
    return validatedPath;
  }

  sanitizePath(inputPath: string): string {
    // Remove potentially dangerous characters and sequences
    const sanitized = inputPath
      .replace(/\.\./g, '') // Remove directory traversal
      .replace(/[<>:"|?*]/g, '') // Remove invalid filename characters
      .replace(/^\/+/, '') // Remove leading slashes
      .trim();

    // Ensure path doesn't start with system directories
    const dangerousPrefixes = ['/etc', '/usr', '/bin', '/sbin', '/var', '/tmp'];
    for (const prefix of dangerousPrefixes) {
      if (sanitized.startsWith(prefix)) {
        throw new SecurityError(
          `Path cannot start with system directory: ${prefix}`
        );
      }
    }

    return sanitized;
  }

  createSafeGlobPattern(pattern: string): string {
    // Sanitize glob pattern to prevent directory traversal
    const sanitized = pattern
      .replace(/\.\.\//g, '') // Remove directory traversal in glob
      .replace(/\/\.\.\//g, '/') // Remove directory traversal with slashes
      .replace(/^\.\.\//g, ''); // Remove leading directory traversal

    // Ensure pattern is relative to workspace
    if (path.isAbsolute(sanitized)) {
      const relativePath = path.relative(this.workspaceRoot, sanitized);
      if (relativePath.startsWith('..')) {
        throw new SecurityError(
          'Glob pattern cannot reference paths outside workspace'
        );
      }
      return relativePath;
    }

    return sanitized;
  }

  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  getAllowedExtensions(): string[] {
    return Array.from(this.allowedExtensions);
  }

  getMaxFileSize(): number {
    return this.maxFileSize;
  }

  updateSettings(allowedExtensions?: string[], maxFileSize?: number): void {
    if (allowedExtensions) {
      this.allowedExtensions = new Set(allowedExtensions);
    }
    if (maxFileSize !== undefined) {
      this.maxFileSize = maxFileSize;
    }
  }

  private isWithinWorkspace(targetPath: string): boolean {
    const relativePath = path.relative(this.workspaceRoot, targetPath);

    // If relative path starts with '..', it's outside the workspace
    return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  }

  isPathSafe(targetPath: string): boolean {
    try {
      this.validatePath(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  getRelativePathFromWorkspace(targetPath: string): string {
    const validatedPath = this.validatePath(targetPath);
    return path.relative(this.workspaceRoot, validatedPath);
  }
}
