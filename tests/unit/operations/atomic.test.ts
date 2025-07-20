import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { AtomicFileOperations } from '../../../src/core/operations/atomic.js';
import { WorkspaceSecurity } from '../../../src/core/security/workspace.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('AtomicFileOperations (without backup functionality)', () => {
  let atomicOps: AtomicFileOperations;
  let tempDir: string;
  let testFile: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atomic-ops-test-'));

    // Initialize AtomicFileOperations with workspace security
    const security = new WorkspaceSecurity(tempDir);
    atomicOps = new AtomicFileOperations(security);

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

  describe('atomicWrite', () => {
    test('should write file atomically without creating backup', async () => {
      const content = 'Atomic write content';

      const result = await atomicOps.atomicWrite(testFile, content);

      expect(result.success).toBe(true);
      expect(result.filePath).toBe('test.txt');
      expect(result.tempPath).toBeUndefined();
      expect(result.error).toBeUndefined();

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

      // Perform atomic write
      const result = await atomicOps.atomicWrite(testFile, newContent);

      expect(result.success).toBe(true);

      // Verify file was overwritten
      const finalContent = await fs.readFile(testFile, 'utf8');
      expect(finalContent).toBe(newContent);

      // Verify no backup files were created
      const files = await fs.readdir(tempDir);
      const backupFiles = files.filter(f => f.includes('.backup.'));
      expect(backupFiles).toHaveLength(0);
    });

    test('should handle write errors gracefully', async () => {
      // Try to write to an invalid path
      const invalidPath = path.join(tempDir, 'nonexistent', 'deep', 'test.txt');

      const result = await atomicOps.atomicWrite(invalidPath, 'content');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.tempPath).toBeUndefined();
    });
  });

  describe('atomicEdit', () => {
    test('should edit file content atomically', async () => {
      const originalContent = 'Hello World';
      const oldText = 'World';
      const newText = 'Universe';

      // Create initial file
      await fs.writeFile(testFile, originalContent, 'utf8');

      // Perform atomic edit
      const result = await atomicOps.atomicEdit(testFile, oldText, newText);

      expect(result.success).toBe(true);

      // Verify content was edited
      const editedContent = await fs.readFile(testFile, 'utf8');
      expect(editedContent).toBe('Hello Universe');

      // Verify no backup files were created
      const files = await fs.readdir(tempDir);
      const backupFiles = files.filter(f => f.includes('.backup.'));
      expect(backupFiles).toHaveLength(0);
    });

    test('should fail when content to replace is not found', async () => {
      const originalContent = 'Hello World';
      const oldText = 'NotFound';
      const newText = 'Universe';

      // Create initial file
      await fs.writeFile(testFile, originalContent, 'utf8');

      // Attempt atomic edit
      const result = await atomicOps.atomicEdit(testFile, oldText, newText);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Content to replace not found');

      // Verify original content is unchanged
      const unchangedContent = await fs.readFile(testFile, 'utf8');
      expect(unchangedContent).toBe(originalContent);
    });
  });

  describe('atomicCreate', () => {
    test('should create new file atomically', async () => {
      const content = 'New file content';

      const result = await atomicOps.atomicCreate(testFile, content);

      expect(result.success).toBe(true);

      // Verify file was created
      const createdContent = await fs.readFile(testFile, 'utf8');
      expect(createdContent).toBe(content);

      // Verify no backup files were created
      const files = await fs.readdir(tempDir);
      const backupFiles = files.filter(f => f.includes('.backup.'));
      expect(backupFiles).toHaveLength(0);
    });

    test('should fail when file already exists', async () => {
      const content = 'Existing content';

      // Create existing file
      await fs.writeFile(testFile, content, 'utf8');

      // Attempt to create same file
      const result = await atomicOps.atomicCreate(testFile, 'New content');

      expect(result.success).toBe(false);
      expect(result.error).toContain('File already exists');

      // Verify original content is unchanged
      const unchangedContent = await fs.readFile(testFile, 'utf8');
      expect(unchangedContent).toBe(content);
    });
  });

  describe('cleanupActiveOperations', () => {
    test('should clean up active operations', async () => {
      const result = await atomicOps.cleanupActiveOperations(testFile);

      expect(result.success).toBe(true);
      expect(result.filePath).toBe('test.txt');
      expect(result.tempPath).toBeUndefined();
    });

    test('should handle cleanup of non-existent operations', async () => {
      const result = await atomicOps.cleanupActiveOperations(testFile);

      expect(result.success).toBe(true);
      expect(result.error).toContain('No active operations found');
    });
  });
});
