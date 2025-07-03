import chalk from 'chalk';

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'context';
  content: string;
  lineNumber: {
    old: number;
    new: number;
  };
}

export interface DiffHunk {
  oldStart: number;
  oldLength: number;
  newStart: number;
  newLength: number;
  lines: DiffLine[];
}

export interface DiffResult {
  hunks: DiffHunk[];
  stats: {
    additions: number;
    deletions: number;
    changes: number;
  };
}

export class DiffGenerator {
  
  static generateDiff(oldContent: string, newContent: string): DiffResult {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    const diffLines = this.buildSimpleDiff(oldLines, newLines);
    const hunks = this.groupIntoHunks(diffLines);
    
    return {
      hunks,
      stats: this.calculateStats(diffLines)
    };
  }

  static formatDiff(diff: DiffResult, options: {
    showLineNumbers?: boolean;
    colorOutput?: boolean;
  } = {}): string {
    const {
      showLineNumbers = true,
      colorOutput = true
    } = options;

    let output = '';
    
    // Add stats header
    const { additions, deletions } = diff.stats;
    const statsLine = `+${additions} -${deletions}`;
    output += colorOutput ? chalk.gray(statsLine) : statsLine;
    output += '\n';
    
    for (const hunk of diff.hunks) {
      // Add hunk header
      const hunkHeader = `@@ -${hunk.oldStart},${hunk.oldLength} +${hunk.newStart},${hunk.newLength} @@`;
      output += colorOutput ? chalk.cyan(hunkHeader) : hunkHeader;
      output += '\n';
      
      // Add hunk lines
      for (const line of hunk.lines) {
        let prefix = '';
        let content = line.content;
        let color = (text: string) => text;
        
        switch (line.type) {
          case 'added':
            prefix = '+';
            color = colorOutput ? chalk.green : (text: string) => text;
            break;
          case 'removed':
            prefix = '-';
            color = colorOutput ? chalk.red : (text: string) => text;
            break;
          case 'unchanged':
          case 'context':
            prefix = ' ';
            color = colorOutput ? chalk.gray : (text: string) => text;
            break;
        }
        
        let lineNumberPart = '';
        if (showLineNumbers) {
          const oldNum = line.lineNumber.old.toString().padStart(4);
          const newNum = line.lineNumber.new.toString().padStart(4);
          lineNumberPart = colorOutput 
            ? `${chalk.gray(oldNum)} ${chalk.gray(newNum)} `
            : `${oldNum} ${newNum} `;
        }
        
        output += `${lineNumberPart}${color(prefix + content)}\n`;
      }
    }
    
    return output;
  }

  static createUnifiedDiff(
    oldContent: string, 
    newContent: string, 
    oldPath: string = 'a/file', 
    newPath: string = 'b/file'
  ): string {
    const diff = this.generateDiff(oldContent, newContent);
    
    let output = '';
    output += `--- ${oldPath}\n`;
    output += `+++ ${newPath}\n`;
    output += this.formatDiff(diff, { showLineNumbers: false, colorOutput: false });
    
    return output;
  }

  static previewChanges(
    oldContent: string, 
    newContent: string, 
    filePath: string
  ): string {
    const diff = this.generateDiff(oldContent, newContent);
    
    if (diff.stats.additions === 0 && diff.stats.deletions === 0) {
      return chalk.gray('No changes detected');
    }
    
    let output = '';
    output += chalk.blue(`Changes to ${filePath}:\n`);
    output += chalk.gray(`   +${diff.stats.additions} -${diff.stats.deletions}\n\n`);
    output += this.formatDiff(diff, { showLineNumbers: true, colorOutput: true });
    
    return output;
  }

  private static buildSimpleDiff(oldLines: string[], newLines: string[]): DiffLine[] {
    const diffLines: DiffLine[] = [];
    const maxLength = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLength; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];
      
      if (oldLine !== undefined && newLine !== undefined) {
        if (oldLine === newLine) {
          diffLines.push({
            type: 'unchanged',
            content: oldLine,
            lineNumber: { old: i + 1, new: i + 1 }
          });
        } else {
          // Line changed - show as remove + add
          diffLines.push({
            type: 'removed',
            content: oldLine,
            lineNumber: { old: i + 1, new: i + 1 }
          });
          diffLines.push({
            type: 'added',
            content: newLine,
            lineNumber: { old: i + 1, new: i + 1 }
          });
        }
      } else if (oldLine !== undefined) {
        // Line was removed
        diffLines.push({
          type: 'removed',
          content: oldLine,
          lineNumber: { old: i + 1, new: 0 }
        });
      } else if (newLine !== undefined) {
        // Line was added
        diffLines.push({
          type: 'added',
          content: newLine,
          lineNumber: { old: 0, new: i + 1 }
        });
      }
    }
    
    return diffLines;
  }

  private static groupIntoHunks(diffLines: DiffLine[]): DiffHunk[] {
    if (diffLines.length === 0) return [];
    
    const hunks: DiffHunk[] = [];
    let currentHunk: DiffHunk | null = null;
    
    for (let i = 0; i < diffLines.length; i++) {
      const line = diffLines[i];
      if (!line) continue;
      
      if (line.type === 'added' || line.type === 'removed') {
        if (!currentHunk) {
          // Start new hunk
          const contextStart = Math.max(0, i - 3);
          const startOldLine = Math.max(1, line.lineNumber.old - 3);
          const startNewLine = Math.max(1, line.lineNumber.new - 3);
          
          currentHunk = {
            oldStart: startOldLine,
            oldLength: 0,
            newStart: startNewLine,
            newLength: 0,
            lines: []
          };
          
          // Add context lines before
          for (let j = contextStart; j < i; j++) {
            const contextLine = diffLines[j];
            if (contextLine && contextLine.type === 'unchanged') {
              currentHunk.lines.push({
                type: 'context',
                content: contextLine.content,
                lineNumber: contextLine.lineNumber
              });
              currentHunk.oldLength++;
              currentHunk.newLength++;
            }
          }
        }
        
        currentHunk.lines.push(line);
        
        if (line.type === 'removed') {
          currentHunk.oldLength++;
        } else {
          currentHunk.newLength++;
        }
      } else if (currentHunk && line.type === 'unchanged') {
        // Add unchanged line to current hunk
        currentHunk.lines.push({ 
          type: 'context',
          content: line.content,
          lineNumber: line.lineNumber
        });
        currentHunk.oldLength++;
        currentHunk.newLength++;
        
        // Check if we should close the hunk (if many unchanged lines follow)
        let unchangedCount = 1;
        for (let j = i + 1; j < diffLines.length && diffLines[j]?.type === 'unchanged'; j++) {
          unchangedCount++;
        }
        
        if (unchangedCount > 6) {
          // Add a few more context lines and close hunk
          for (let j = i + 1; j < Math.min(diffLines.length, i + 4); j++) {
            const contextLine = diffLines[j];
            if (contextLine && contextLine.type === 'unchanged') {
              currentHunk.lines.push({
                type: 'context',
                content: contextLine.content,
                lineNumber: contextLine.lineNumber
              });
              currentHunk.oldLength++;
              currentHunk.newLength++;
            }
          }
          
          hunks.push(currentHunk);
          currentHunk = null;
          i += 3; // Skip the context lines we just added
        }
      }
    }
    
    // Close any remaining hunk
    if (currentHunk) {
      hunks.push(currentHunk);
    }
    
    return hunks;
  }

  private static calculateStats(diffLines: DiffLine[]): { additions: number; deletions: number; changes: number } {
    let additions = 0;
    let deletions = 0;
    
    for (const line of diffLines) {
      if (line.type === 'added') {
        additions++;
      } else if (line.type === 'removed') {
        deletions++;
      }
    }
    
    return {
      additions,
      deletions,
      changes: additions + deletions
    };
  }
}