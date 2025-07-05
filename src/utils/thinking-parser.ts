import chalk from 'chalk';

export type ThinkingMode = 'on' | 'brief' | 'off';

export interface ThinkingContent {
  content: string;
  isThinking: boolean;
}

export class ThinkingParser {
  private buffer: string = '';
  private inThinking: boolean = false;
  private thinkingContent: string = '';
  private mode: ThinkingMode;

  constructor(mode: ThinkingMode = 'on') {
    this.mode = mode;
  }

  setMode(mode: ThinkingMode): void {
    this.mode = mode;
  }

  processChunk(chunk: string): ThinkingContent[] {
    this.buffer += chunk;
    const results: ThinkingContent[] = [];

    while (this.buffer.length > 0) {
      if (!this.inThinking) {
        // Look for opening <think> tag
        const thinkStart = this.buffer.indexOf('<think>');
        if (thinkStart === -1) {
          // No thinking tag found, return everything as regular content
          if (this.buffer.length > 0) {
            results.push({
              content: this.buffer,
              isThinking: false
            });
            this.buffer = '';
          }
          break;
        }

        // Process content before <think> tag
        if (thinkStart > 0) {
          results.push({
            content: this.buffer.substring(0, thinkStart),
            isThinking: false
          });
        }

        // Start thinking mode
        this.inThinking = true;
        this.thinkingContent = '';
        this.buffer = this.buffer.substring(thinkStart + 7); // Skip '<think>'
      } else {
        // Look for closing </think> tag
        const thinkEnd = this.buffer.indexOf('</think>');
        if (thinkEnd === -1) {
          // No closing tag yet, accumulate thinking content
          this.thinkingContent += this.buffer;
          this.buffer = '';
          break;
        }

        // Found closing tag, process thinking content
        this.thinkingContent += this.buffer.substring(0, thinkEnd);
        
        // Add formatted thinking content based on mode
        const formattedThinking = this.formatThinking(this.thinkingContent);
        if (formattedThinking) {
          results.push({
            content: formattedThinking,
            isThinking: true
          });
        }

        // Reset thinking state
        this.inThinking = false;
        this.thinkingContent = '';
        this.buffer = this.buffer.substring(thinkEnd + 8); // Skip '</think>'
      }
    }

    return results;
  }

  private formatThinking(content: string): string {
    if (this.mode === 'off') {
      return '';
    }

    const lines = content.trim().split('\n');
    
    if (this.mode === 'brief') {
      // Show only first and last lines with summary
      if (lines.length <= 2) {
        return chalk.dim(chalk.yellow('💭 │ ') + lines[0]);
      }
      
      const firstLine = lines[0]?.trim() || '';
      const lastLine = lines[lines.length - 1]?.trim() || '';
      const summary = chalk.dim(chalk.yellow(`💭 Thinking (${lines.length} lines)`));
      const first = chalk.dim(chalk.yellow('   ├─ ') + firstLine);
      const ellipsis = chalk.dim(chalk.yellow('   ├─ ... (processing steps) ...'));
      const last = chalk.dim(chalk.yellow('   └─ ') + lastLine);
      
      return `${summary}\n${first}\n${ellipsis}\n${last}`;
    }

    // Full thinking mode
    return lines
      .map(line => chalk.dim(chalk.yellow('💭 │ ') + line))
      .join('\n');
  }

  reset(): void {
    this.buffer = '';
    this.inThinking = false;
    this.thinkingContent = '';
  }
}