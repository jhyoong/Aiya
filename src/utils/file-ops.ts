import * as fs from 'fs/promises';
import * as path from 'path';
import { WorkspaceSecurity } from '../core/security/workspace.js';

export interface FileInfo {
  path: string;
  size: number;
  modified: Date;
  type: 'file' | 'directory';
  extension?: string;
  encoding?: string;
}

export interface ReadOptions {
  encoding?: BufferEncoding;
  maxSize?: number;
  detectEncoding?: boolean;
}

export interface WriteOptions {
  encoding?: BufferEncoding;
  ensureDir?: boolean;
  atomic?: boolean;
}

export class FileOperations {
  private security: WorkspaceSecurity;

  constructor(security: WorkspaceSecurity) {
    this.security = security;
  }

  async readFile(filePath: string, options: ReadOptions = {}): Promise<string> {
    const validatedPath = await this.security.validateFileAccess(
      filePath,
      'read'
    );

    const {
      encoding = 'utf8',
      maxSize = this.security.getMaxFileSize(),
      detectEncoding = false,
    } = options;

    // Check file size
    const stats = await fs.stat(validatedPath);
    if (stats.size > maxSize) {
      throw new Error(
        `File size (${stats.size}) exceeds maximum allowed size (${maxSize})`
      );
    }

    // Read file with encoding detection if requested
    if (detectEncoding) {
      const buffer = await fs.readFile(validatedPath);
      const detectedEncoding = this.detectEncoding(buffer);
      return buffer.toString(detectedEncoding as BufferEncoding);
    }

    return await fs.readFile(validatedPath, encoding);
  }

  async writeFile(
    filePath: string,
    content: string,
    options: WriteOptions = {}
  ): Promise<void> {
    const validatedPath = await this.security.validateFileAccess(
      filePath,
      'write'
    );

    const { encoding = 'utf8', ensureDir = true, atomic = true } = options;

    // Ensure directory exists
    if (ensureDir) {
      const dir = path.dirname(validatedPath);
      await fs.mkdir(dir, { recursive: true });
    }

    // File will be written atomically if atomic option is enabled

    // Atomic write using temporary file
    if (atomic) {
      const tempPath = `${validatedPath}.tmp.${Date.now()}`;
      try {
        await fs.writeFile(tempPath, content, encoding);
        await fs.rename(tempPath, validatedPath);
      } catch (error) {
        // Clean up temp file on error
        try {
          await fs.unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }
        throw error;
      }
    } else {
      await fs.writeFile(validatedPath, content, encoding);
    }
  }

  async getFileInfo(filePath: string): Promise<FileInfo> {
    const validatedPath = this.security.validatePath(filePath);
    const stats = await fs.stat(validatedPath);

    const fileInfo: FileInfo = {
      path: this.security.getRelativePathFromWorkspace(validatedPath),
      size: stats.size,
      modified: stats.mtime,
      type: stats.isDirectory() ? 'directory' : 'file',
    };

    if (stats.isFile()) {
      fileInfo.extension = path.extname(validatedPath);
      fileInfo.encoding = await this.detectFileEncoding(validatedPath);
    }

    return fileInfo;
  }

  async listDirectory(dirPath: string): Promise<FileInfo[]> {
    const validatedPath = this.security.validatePath(dirPath);
    const entries = await fs.readdir(validatedPath, { withFileTypes: true });

    const fileInfos: FileInfo[] = [];

    for (const entry of entries) {
      const fullPath = path.join(validatedPath, entry.name);

      try {
        const stats = await fs.stat(fullPath);
        const relativePath =
          this.security.getRelativePathFromWorkspace(fullPath);

        const fileInfo: FileInfo = {
          path: relativePath,
          size: stats.size,
          modified: stats.mtime,
          type: entry.isDirectory() ? 'directory' : 'file',
        };

        if (entry.isFile()) {
          fileInfo.extension = path.extname(entry.name);
          fileInfo.encoding = await this.detectFileEncoding(fullPath);
        }

        fileInfos.push(fileInfo);
      } catch {
        // Skip files that can't be accessed
        continue;
      }
    }

    return fileInfos.sort((a, b) => {
      // Directories first, then files
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.path.localeCompare(b.path);
    });
  }

  async copyFile(sourcePath: string, destPath: string): Promise<void> {
    const validatedSource = await this.security.validateFileAccess(
      sourcePath,
      'read'
    );
    const validatedDest = await this.security.validateFileAccess(
      destPath,
      'write'
    );

    // Ensure destination directory exists
    const destDir = path.dirname(validatedDest);
    await fs.mkdir(destDir, { recursive: true });

    await fs.copyFile(validatedSource, validatedDest);
  }

  async moveFile(sourcePath: string, destPath: string): Promise<void> {
    const validatedSource = await this.security.validateFileAccess(
      sourcePath,
      'read'
    );
    const validatedDest = await this.security.validateFileAccess(
      destPath,
      'write'
    );

    // Ensure destination directory exists
    const destDir = path.dirname(validatedDest);
    await fs.mkdir(destDir, { recursive: true });

    await fs.rename(validatedSource, validatedDest);
  }

  async deleteFile(filePath: string): Promise<void> {
    const validatedPath = await this.security.validateFileAccess(
      filePath,
      'write'
    );
    await fs.unlink(validatedPath);
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const validatedPath = this.security.validatePath(filePath);
      await fs.access(validatedPath);
      return true;
    } catch {
      return false;
    }
  }

  async createDirectory(dirPath: string): Promise<void> {
    const validatedPath = this.security.validatePath(dirPath);
    await fs.mkdir(validatedPath, { recursive: true });
  }

  async watchFile(
    filePath: string,
    callback: (eventType: string, filename: string) => void
  ): Promise<() => void> {
    const validatedPath = await this.security.validateFileAccess(
      filePath,
      'read'
    );

    const { watch } = await import('fs');
    const watcher = watch(validatedPath, (eventType, filename) => {
      callback(eventType || 'change', filename || path.basename(validatedPath));
    });

    return () => {
      watcher.close();
    };
  }

  private detectEncoding(buffer: Buffer): string {
    // Simple encoding detection - in a real implementation you'd use a library like 'chardet'

    // Check for BOM
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xef &&
      buffer[1] === 0xbb &&
      buffer[2] === 0xbf
    ) {
      return 'utf8';
    }

    if (buffer.length >= 2) {
      if (buffer[0] === 0xff && buffer[1] === 0xfe) {
        return 'utf16le';
      }
      if (buffer[0] === 0xfe && buffer[1] === 0xff) {
        return 'utf16be';
      }
    }

    // Check if it's valid UTF-8
    try {
      buffer.toString('utf8');
      return 'utf8';
    } catch {
      return 'binary';
    }
  }

  private async detectFileEncoding(filePath: string): Promise<string> {
    try {
      const buffer = await fs.readFile(filePath);
      if (buffer.length > 1024) {
        // Only read first 1KB for encoding detection
        return this.detectEncoding(buffer.subarray(0, 1024));
      }
      return this.detectEncoding(buffer);
    } catch {
      return 'utf8'; // Default fallback
    }
  }

  getWorkspaceRoot(): string {
    return this.security.getWorkspaceRoot();
  }

  isPathSafe(filePath: string): boolean {
    return this.security.isPathSafe(filePath);
  }

  getRelativePath(filePath: string): string {
    return this.security.getRelativePathFromWorkspace(filePath);
  }
}
