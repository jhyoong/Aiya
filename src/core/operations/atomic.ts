import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { WorkspaceSecurity } from '../security/workspace.js';

export interface AtomicOperationOptions {
  tempDir?: string;
  timeout?: number;
}

export interface AtomicOperationResult {
  success: boolean;
  filePath: string;
  tempPath: string | undefined;
  error: string | undefined;
}

export interface RollbackInfo {
  originalPath: string;
  tempPath: string | undefined;
  operation: 'write' | 'edit' | 'create';
  timestamp: number;
}

export class AtomicFileOperations {
  private security: WorkspaceSecurity;
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
    // Use options with defaults
    const tempDir = options.tempDir;
    const operationId = randomUUID();

    try {
      const validatedPath = await this.security.validateFileAccess(
        filePath,
        'write'
      );
      const relativePath =
        this.security.getRelativePathFromWorkspace(validatedPath);

      // Create temporary file
      const tempPath = await this.createTempFile(validatedPath, content, tempDir);

      // Check if original file exists
      const fileExists = await this.fileExists(validatedPath);

      // Store rollback info
      const rollbackInfo: RollbackInfo = {
        originalPath: validatedPath,
        tempPath,
        operation: fileExists ? 'write' : 'create',
        timestamp: Date.now(),
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
        tempPath: undefined, // Temp file was moved
        error: undefined,
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
        tempPath: undefined,
        error: `Atomic write failed: ${error}`,
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
      const validatedPath = await this.security.validateFileAccess(
        filePath,
        'write'
      );
      const currentContent = await fs.readFile(validatedPath, 'utf8');

      if (!currentContent.includes(oldContent)) {
        return {
          success: false,
          filePath: filePath,
          tempPath: undefined,
          error: 'Content to replace not found in file',
        };
      }

      const updatedContent = currentContent.replace(oldContent, newContent);
      return await this.atomicWrite(filePath, updatedContent, options);
    } catch (error) {
      return {
        success: false,
        filePath: filePath,
        tempPath: undefined,
        error: `Atomic edit failed: ${error}`,
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
      const validatedPath = await this.security.validateFileAccess(
        filePath,
        'write'
      );

      // Check if file already exists
      if (await this.fileExists(validatedPath)) {
        return {
          success: false,
          filePath: filePath,
          tempPath: undefined,
          error: 'File already exists',
        };
      }

      return await this.atomicWrite(filePath, content, options);
    } catch (error) {
      return {
        success: false,
        filePath: filePath,
        tempPath: undefined,
        error: `Atomic create failed: ${error}`,
      };
    }
  }

  /**
   * Clean up active operations for a file
   */
  async cleanupActiveOperations(
    filePath: string
  ): Promise<AtomicOperationResult> {
    try {
      const validatedPath = await this.security.validateFileAccess(
        filePath,
        'write'
      );
      const relativePath =
        this.security.getRelativePathFromWorkspace(validatedPath);

      // Find and clean up any active operations for this file
      let cleanedUp = false;
      for (const [
        operationId,
        rollbackInfo,
      ] of this.activeOperations.entries()) {
        if (rollbackInfo.originalPath === validatedPath) {
          if (rollbackInfo.tempPath) {
            await this.safeUnlink(rollbackInfo.tempPath);
          }
          this.activeOperations.delete(operationId);
          cleanedUp = true;
        }
      }

      return {
        success: true,
        filePath: relativePath,
        tempPath: undefined,
        error: cleanedUp ? undefined : 'No active operations found for file',
      };
    } catch (error) {
      return {
        success: false,
        filePath: filePath,
        tempPath: undefined,
        error: `Cleanup failed: ${error}`,
      };
    }
  }

  private async createTempFile(
    targetPath: string,
    content: string,
    customTempDir?: string
  ): Promise<string> {
    const tempDir = customTempDir || path.dirname(targetPath);
    const tempName = `.tmp_${randomUUID()}_${path.basename(targetPath)}`;
    const tempPath = path.join(tempDir, tempName);

    await fs.writeFile(tempPath, content, 'utf8');
    return tempPath;
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
