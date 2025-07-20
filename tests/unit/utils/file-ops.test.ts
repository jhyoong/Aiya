import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { FileOperations } from '../../../src/utils/file-ops.js';
import { WorkspaceSecurity } from '../../../src/core/security/workspace.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('FileOperations (without backup functionality)', () => {
  let fileOps: FileOperations;
  let tempDir: string;
  let testFile: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-ops-test-'));

    // Initialize FileOperations with workspace security
    const security = new WorkspaceSecurity(tempDir);
    fileOps = new FileOperations(security);

    testFile = path.join(tempDir, 'test.txt');
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('writeFile', () => {
    test('should write file without creating backup', async () => {
      const content = 'Hello, World!';

      await fileOps.writeFile(testFile, content);

      // Verify file was written
      const writtenContent = await fs.readFile(testFile, 'utf8');
      expect(writtenContent).toBe(content);

      // Verify no backup files were created
      const files = await fs.readdir(tempDir);
      const backupFiles = files.filter(f => f.includes('.backup.'));
      expect(backupFiles).toHaveLength(0);
    });

    test('should overwrite existing file without creating backup', async () => {
      const originalContent = 'Original content';
      const newContent = 'New content';

      // Create initial file
      await fs.writeFile(testFile, originalContent, 'utf8');

      // Overwrite with new content
      await fileOps.writeFile(testFile, newContent);

      // Verify file was overwritten
      const finalContent = await fs.readFile(testFile, 'utf8');
      expect(finalContent).toBe(newContent);

      // Verify no backup files were created
      const files = await fs.readdir(tempDir);
      const backupFiles = files.filter(f => f.includes('.backup.'));
      expect(backupFiles).toHaveLength(0);
    });

    test('should write atomically when atomic option is true', async () => {
      const content = 'Atomic write test';

      await fileOps.writeFile(testFile, content, { atomic: true });

      // Verify file was written
      const writtenContent = await fs.readFile(testFile, 'utf8');
      expect(writtenContent).toBe(content);

      // Verify no temp files remain
      const files = await fs.readdir(tempDir);
      const tempFiles = files.filter(f => f.includes('.tmp.'));
      expect(tempFiles).toHaveLength(0);
    });

    test('should create directory when ensureDir is true', async () => {
      const nestedFile = path.join(tempDir, 'nested', 'deep', 'test.txt');
      const content = 'Nested file content';

      await fileOps.writeFile(nestedFile, content, { ensureDir: true });

      // Verify file was written in nested directory
      const writtenContent = await fs.readFile(nestedFile, 'utf8');
      expect(writtenContent).toBe(content);

      // Verify directory structure was created
      await expect(
        fs.access(path.dirname(nestedFile))
      ).resolves.toBeUndefined();
    });
  });

  describe('readFile', () => {
    test('should read file contents', async () => {
      const content = 'Test file content';
      await fs.writeFile(testFile, content, 'utf8');

      const readContent = await fileOps.readFile(testFile);
      expect(readContent).toBe(content);
    });

    test('should throw error for non-existent file', async () => {
      const nonExistentFile = path.join(tempDir, 'does-not-exist.txt');

      await expect(fileOps.readFile(nonExistentFile)).rejects.toThrow();
    });

    test('should respect maxSize option', async () => {
      const largeContent = 'x'.repeat(1000);
      await fs.writeFile(testFile, largeContent, 'utf8');

      await expect(
        fileOps.readFile(testFile, { maxSize: 500 })
      ).rejects.toThrow(/exceeds maximum allowed size/);
    });
  });
});
