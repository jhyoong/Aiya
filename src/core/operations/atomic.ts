import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { WorkspaceSecurity } from '../security/workspace.js';

export interface AtomicOperationOptions {
  createBackup?: boolean;
  tempDir?: string;
  timeout?: number;
}

export interface AtomicOperationResult {
  success: boolean;
  filePath: string;
  backupPath: string | undefined;
  tempPath: string | undefined;
  error: string | undefined;
}

export interface RollbackInfo {
  originalPath: string;
  backupPath: string | undefined;
  tempPath: string | undefined;
  operation: 'write' | 'edit' | 'create';
  timestamp: number;
}

export class AtomicFileOperations {
  private security: WorkspaceSecurity;
  private defaultOptions: AtomicOperationOptions = {
    createBackup: true,
    timeout: 30000 // 30 seconds
  };
  private activeOperations = new Map<string, RollbackInfo>();

  constructor(security: WorkspaceSecurity) {
    this.security = security;
  }

  /**
   * Atomically write content to a file using temporary file + swap
   */
  async atomicWrite(
    filePath: string,
    content: string,
    options: AtomicOperationOptions = {}
  ): Promise<AtomicOperationResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const operationId = randomUUID();
    
    try {
      const validatedPath = await this.security.validateFileAccess(filePath, 'write');
      const relativePath = this.security.getRelativePathFromWorkspace(validatedPath);
      
      // Create temporary file
      const tempPath = await this.createTempFile(validatedPath, content);
      
      // Check if original file exists
      const fileExists = await this.fileExists(validatedPath);
      let backupPath: string | undefined;
      
      if (fileExists && mergedOptions.createBackup) {
        backupPath = await this.createBackup(validatedPath);
      }
      
      // Store rollback info
      const rollbackInfo: RollbackInfo = {
        originalPath: validatedPath,
        backupPath,
        tempPath,
        operation: fileExists ? 'write' : 'create',
        timestamp: Date.now()
      };
      this.activeOperations.set(operationId, rollbackInfo);
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(validatedPath), { recursive: true });
      
      // Atomic swap
      await fs.rename(tempPath, validatedPath);
      
      // Clean up rollback info (keep backup if created)
      this.activeOperations.delete(operationId);
      
      return {
        success: true,
        filePath: relativePath,
        backupPath: backupPath ? path.basename(backupPath) : undefined,
        tempPath: undefined, // Temp file was moved
        error: undefined
      };
    } catch (error) {
      // Clean up temp file if it exists
      const rollbackInfo = this.activeOperations.get(operationId);
      if (rollbackInfo?.tempPath) {
        await this.safeUnlink(rollbackInfo.tempPath);
      }
      this.activeOperations.delete(operationId);
      
      return {
        success: false,
        filePath: filePath,
        backupPath: undefined,
        tempPath: undefined,
        error: `Atomic write failed: ${error}`
      };
    }
  }

  /**
   * Atomically edit a file by replacing specific content
   */
  async atomicEdit(
    filePath: string,
    oldContent: string,
    newContent: string,
    options: AtomicOperationOptions = {}
  ): Promise<AtomicOperationResult> {
    try {
      const validatedPath = await this.security.validateFileAccess(filePath, 'write');
      const currentContent = await fs.readFile(validatedPath, 'utf8');
      
      if (!currentContent.includes(oldContent)) {
        return {
          success: false,
          filePath: filePath,
          backupPath: undefined,
          tempPath: undefined,
          error: 'Content to replace not found in file'
        };
      }
      
      const updatedContent = currentContent.replace(oldContent, newContent);
      return await this.atomicWrite(filePath, updatedContent, options);
    } catch (error) {
      return {
        success: false,
        filePath: filePath,
        backupPath: undefined,
        tempPath: undefined,
        error: `Atomic edit failed: ${error}`
      };
    }
  }

  /**
   * Atomically create a new file (fails if file already exists)
   */
  async atomicCreate(
    filePath: string,
    content: string,
    options: AtomicOperationOptions = {}
  ): Promise<AtomicOperationResult> {
    try {
      const validatedPath = await this.security.validateFileAccess(filePath, 'write');
      
      // Check if file already exists
      if (await this.fileExists(validatedPath)) {
        return {
          success: false,
          filePath: filePath,
          backupPath: undefined,
          tempPath: undefined,
          error: 'File already exists'
        };
      }
      
      return await this.atomicWrite(filePath, content, { ...options, createBackup: false });
    } catch (error) {
      return {
        success: false,
        filePath: filePath,
        backupPath: undefined,
        tempPath: undefined,
        error: `Atomic create failed: ${error}`
      };
    }
  }

  /**
   * Rollback an operation using backup
   */
  async rollback(filePath: string): Promise<AtomicOperationResult> {
    try {
      const validatedPath = await this.security.validateFileAccess(filePath, 'write');
      const relativePath = this.security.getRelativePathFromWorkspace(validatedPath);
      
      // Find most recent backup
      const backupPath = await this.findLatestBackup(validatedPath);
      if (!backupPath) {
        return {
          success: false,
          filePath: relativePath,
          backupPath: undefined,
          tempPath: undefined,
          error: 'No backup found for rollback'
        };
      }
      
      // Restore from backup
      await fs.copyFile(backupPath, validatedPath);
      
      return {
        success: true,
        filePath: relativePath,
        backupPath: path.basename(backupPath),
        tempPath: undefined,
        error: undefined
      };
    } catch (error) {
      return {
        success: false,
        filePath: filePath,
        backupPath: undefined,
        tempPath: undefined,
        error: `Rollback failed: ${error}`
      };
    }
  }

  /**
   * Clean up old backups
   */
  async cleanupBackups(filePath: string, keepCount: number = 5): Promise<void> {
    try {
      const validatedPath = await this.security.validateFileAccess(filePath, 'read');
      const backupDir = path.dirname(validatedPath);
      
      const files = await fs.readdir(backupDir);
      const backupFiles = files
        .filter(file => file.startsWith(path.basename(validatedPath) + '.backup.'))
        .map(file => path.join(backupDir, file));
      
      if (backupFiles.length <= keepCount) {
        return;
      }
      
      // Sort by modification time (newest first)
      const backupStats = await Promise.all(
        backupFiles.map(async (file) => ({
          file,
          mtime: (await fs.stat(file)).mtime
        }))
      );
      
      backupStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      
      // Remove old backups
      const toDelete = backupStats.slice(keepCount);
      await Promise.all(toDelete.map(({ file }) => this.safeUnlink(file)));
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Get list of available backups for a file
   */
  async listBackups(filePath: string): Promise<Array<{ path: string; created: Date; size: number }>> {
    try {
      const validatedPath = await this.security.validateFileAccess(filePath, 'read');
      const backupDir = path.dirname(validatedPath);
      const baseName = path.basename(validatedPath);
      
      const files = await fs.readdir(backupDir);
      const backupFiles = files.filter(file => file.startsWith(baseName + '.backup.'));
      
      const backups = await Promise.all(
        backupFiles.map(async (file) => {
          const fullPath = path.join(backupDir, file);
          const stats = await fs.stat(fullPath);
          return {
            path: file,
            created: stats.mtime,
            size: stats.size
          };
        })
      );
      
      return backups.sort((a, b) => b.created.getTime() - a.created.getTime());
    } catch (error) {
      return [];
    }
  }

  private async createTempFile(targetPath: string, content: string): Promise<string> {
    const tempDir = path.dirname(targetPath);
    const tempName = `.tmp_${randomUUID()}_${path.basename(targetPath)}`;
    const tempPath = path.join(tempDir, tempName);
    
    await fs.writeFile(tempPath, content, 'utf8');
    return tempPath;
  }

  private async createBackup(filePath: string): Promise<string> {
    const timestamp = Date.now();
    const backupPath = `${filePath}.backup.${timestamp}`;
    await fs.copyFile(filePath, backupPath);
    return backupPath;
  }

  private async findLatestBackup(filePath: string): Promise<string | null> {
    const backups = await this.listBackups(filePath);
    return backups.length > 0 ? path.join(path.dirname(filePath), backups[0]?.path ?? '') : null;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  private async safeUnlink(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore errors
    }
  }
}