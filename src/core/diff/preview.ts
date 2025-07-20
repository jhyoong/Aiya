import * as fs from 'fs/promises';
import * as path from 'path';
import { DiffGenerator } from '../../utils/diff.js';
import { WorkspaceSecurity } from '../security/workspace.js';

export interface DiffPreviewOptions {
  contextLines?: number;
  showLineNumbers?: boolean;
  colorOutput?: boolean;
  showStats?: boolean;
}

export interface PreviewResult {
  filePath: string;
  hasChanges: boolean;
  preview: string;
  stats: {
    additions: number;
    deletions: number;
    changes: number;
  };
}

export class DiffPreviewSystem {
  private security: WorkspaceSecurity;

  constructor(security: WorkspaceSecurity) {
    this.security = security;
  }

  /**
   * Preview changes before applying them to a file
   */
  async previewFileChanges(
    filePath: string,
    newContent: string,
    _options: DiffPreviewOptions = {}
  ): Promise<PreviewResult> {
    try {
      const validatedPath = await this.security.validateFileAccess(
        filePath,
        'read'
      );
      const relativePath =
        this.security.getRelativePathFromWorkspace(validatedPath);

      let currentContent = '';
      try {
        currentContent = await fs.readFile(validatedPath, 'utf8');
      } catch (_error) {
        // File doesn't exist, treat as empty
        currentContent = '';
      }

      const diff = DiffGenerator.generateDiff(currentContent, newContent);
      const hasChanges = diff.stats.additions > 0 || diff.stats.deletions > 0;

      let preview = '';
      if (hasChanges) {
        preview = DiffGenerator.previewChanges(
          currentContent,
          newContent,
          relativePath
        );
      } else {
        preview = `No changes detected in ${relativePath}`;
      }

      return {
        filePath: relativePath,
        hasChanges,
        preview,
        stats: diff.stats,
      };
    } catch (error) {
      throw new Error(`Failed to preview changes for ${filePath}: ${error}`);
    }
  }

  /**
   * Preview changes for multiple files
   */
  async previewBatchChanges(
    changes: Array<{ filePath: string; newContent: string }>,
    options: DiffPreviewOptions = {}
  ): Promise<PreviewResult[]> {
    const results: PreviewResult[] = [];

    for (const change of changes) {
      try {
        const result = await this.previewFileChanges(
          change.filePath,
          change.newContent,
          options
        );
        results.push(result);
      } catch (error) {
        results.push({
          filePath: change.filePath,
          hasChanges: false,
          preview: `Error previewing changes: ${error}`,
          stats: { additions: 0, deletions: 0, changes: 0 },
        });
      }
    }

    return results;
  }

  /**
   * Preview edit operations (replace specific content)
   */
  async previewEditOperation(
    filePath: string,
    oldContent: string,
    newContent: string,
    options: DiffPreviewOptions = {}
  ): Promise<PreviewResult> {
    try {
      const validatedPath = await this.security.validateFileAccess(
        filePath,
        'read'
      );
      const relativePath =
        this.security.getRelativePathFromWorkspace(validatedPath);

      const currentContent = await fs.readFile(validatedPath, 'utf8');

      if (!currentContent.includes(oldContent)) {
        return {
          filePath: relativePath,
          hasChanges: false,
          preview: `Content to replace not found in ${relativePath}`,
          stats: { additions: 0, deletions: 0, changes: 0 },
        };
      }

      const updatedContent = currentContent.replace(oldContent, newContent);
      return await this.previewFileChanges(filePath, updatedContent, options);
    } catch (error) {
      throw new Error(
        `Failed to preview edit operation for ${filePath}: ${error}`
      );
    }
  }

  /**
   * Generate a unified diff format for external tools
   */
  async generateUnifiedDiff(
    filePath: string,
    newContent: string,
    options: { oldPath?: string; newPath?: string } = {}
  ): Promise<string> {
    try {
      const validatedPath = await this.security.validateFileAccess(
        filePath,
        'read'
      );
      const relativePath =
        this.security.getRelativePathFromWorkspace(validatedPath);

      let currentContent = '';
      try {
        currentContent = await fs.readFile(validatedPath, 'utf8');
      } catch (_error) {
        // File doesn't exist, treat as empty
        currentContent = '';
      }

      const oldPath = options.oldPath || `a/${relativePath}`;
      const newPath = options.newPath || `b/${relativePath}`;

      return DiffGenerator.createUnifiedDiff(
        currentContent,
        newContent,
        oldPath,
        newPath
      );
    } catch (error) {
      throw new Error(
        `Failed to generate unified diff for ${filePath}: ${error}`
      );
    }
  }

  /**
   * Create a summary of changes across multiple files
   */
  createChangesSummary(previews: PreviewResult[]): string {
    const changedFiles = previews.filter(p => p.hasChanges);
    const totalStats = changedFiles.reduce(
      (acc, p) => ({
        additions: acc.additions + p.stats.additions,
        deletions: acc.deletions + p.stats.deletions,
        changes: acc.changes + p.stats.changes,
      }),
      { additions: 0, deletions: 0, changes: 0 }
    );

    if (changedFiles.length === 0) {
      return 'No changes detected';
    }

    let summary = `Changes Summary:\n`;
    summary += `  Files changed: ${changedFiles.length}\n`;
    summary += `  Lines added: ${totalStats.additions}\n`;
    summary += `  Lines removed: ${totalStats.deletions}\n`;
    summary += `  Total changes: ${totalStats.changes}\n\n`;

    summary += `Files:\n`;
    changedFiles.forEach(file => {
      summary += `  ${file.filePath} (+${file.stats.additions} -${file.stats.deletions})\n`;
    });

    return summary;
  }

  /**
   * Validate that a preview can be applied safely
   */
  async validatePreviewApplication(
    preview: PreviewResult
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      const validatedPath = await this.security.validateFileAccess(
        preview.filePath,
        'write'
      );

      // Check if file exists and is writable
      try {
        await fs.access(validatedPath, fs.constants.F_OK | fs.constants.W_OK);
      } catch (_error) {
        // File doesn't exist - check if directory is writable
        const dir = path.dirname(validatedPath);
        try {
          await fs.access(dir, fs.constants.W_OK);
        } catch {
          return { valid: false, reason: 'Directory is not writable' };
        }
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, reason: `Security validation failed: ${error}` };
    }
  }
}
