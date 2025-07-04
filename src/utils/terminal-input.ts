import * as readline from 'readline';
import chalk from 'chalk';

export interface SuggestionResult {
  displayText: string;
  completionText: string;
}

export interface TerminalInputOptions {
  prompt: string;
  onLine: (line: string) => Promise<void>;
  onSuggestion?: (input: string) => SuggestionResult | null;
  onClose?: () => void;
}

export class TerminalInput {
  private buffer: string = '';
  private cursorPosition: number = 0;
  private currentSuggestion: SuggestionResult | null = null;
  private isRawMode: boolean = false;
  private options: TerminalInputOptions;

  constructor(options: TerminalInputOptions) {
    this.options = options;
  }

  start(): void {
    this.isRawMode = true;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', this.handleKeypress.bind(this));
    process.stdin.on('end', this.handleClose.bind(this));
    
    this.showPrompt();
  }

  stop(): void {
    if (this.isRawMode) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      this.isRawMode = false;
    }
  }

  private handleKeypress(key: string): void {
    const code = key.charCodeAt(0);
    
    switch (code) {
      case 3: // Ctrl+C
        this.handleClose();
        break;
      case 13: // Enter
        this.handleEnter();
        break;
      case 127: // Backspace
        this.handleBackspace();
        break;
      case 9: // Tab
        this.handleTab();
        break;
      case 27: // Escape sequences
        this.handleEscape(key);
        break;
      default:
        if (code >= 32 && code <= 126) { // Printable characters
          this.handleCharacter(key);
        }
    }
  }

  private handleCharacter(char: string): void {
    this.buffer = this.buffer.slice(0, this.cursorPosition) + char + this.buffer.slice(this.cursorPosition);
    this.cursorPosition++;
    this.updateDisplay();
  }

  private handleBackspace(): void {
    if (this.cursorPosition > 0) {
      this.buffer = this.buffer.slice(0, this.cursorPosition - 1) + this.buffer.slice(this.cursorPosition);
      this.cursorPosition--;
      this.updateDisplay();
    }
  }

  private handleEnter(): void {
    this.clearSuggestion();
    process.stdout.write('\r\n');
    
    const line = this.buffer.trim();
    this.buffer = '';
    this.cursorPosition = 0;
    
    this.options.onLine(line).then(() => {
      this.showPrompt();
    });
  }

  private handleTab(): void {
    if (this.currentSuggestion) {
      // Use the completionText instead of displayText
      const completionText = this.currentSuggestion.completionText;
      if (completionText.startsWith(this.buffer)) {
        this.buffer = completionText;
        this.cursorPosition = this.buffer.length;
        this.updateDisplay();
      }
    }
  }

  private handleEscape(key: string): void {
    if (key.length === 1) {
      // Simple escape key - clear suggestions
      this.clearSuggestion();
      this.updateDisplay();
    } else {
      // Handle arrow keys and other escape sequences
      if (key === '\x1b[A') { // Up arrow
        // Could implement history here
      } else if (key === '\x1b[B') { // Down arrow
        // Could implement history here
      } else if (key === '\x1b[C') { // Right arrow
        if (this.cursorPosition < this.buffer.length) {
          this.cursorPosition++;
          this.updateDisplay();
        }
      } else if (key === '\x1b[D') { // Left arrow
        if (this.cursorPosition > 0) {
          this.cursorPosition--;
          this.updateDisplay();
        }
      }
    }
  }

  private handleClose(): void {
    this.stop();
    if (this.options.onClose) {
      this.options.onClose();
    }
    process.exit(0);
  }

  private showPrompt(): void {
    process.stdout.write(this.options.prompt);
  }

  private updateDisplay(): void {
    // Clear the current line
    process.stdout.write('\r');
    readline.clearLine(process.stdout, 0);
    
    // Show prompt and current input
    process.stdout.write(this.options.prompt + this.buffer);
    
    // Get suggestion if available
    if (this.options.onSuggestion) {
      const suggestion = this.options.onSuggestion(this.buffer);
      if (suggestion && suggestion.displayText !== this.buffer) {
        this.currentSuggestion = suggestion;
        // Show the displayText in grey, but only the part after current input
        const displayPart = suggestion.displayText.slice(this.buffer.length);
        process.stdout.write(chalk.gray(displayPart));
      } else {
        this.currentSuggestion = null;
      }
    }
    
    // Position cursor correctly
    const promptLength = this.stripAnsi(this.options.prompt).length;
    const totalPosition = promptLength + this.cursorPosition;
    process.stdout.write(`\r\x1b[${totalPosition + 1}G`);
  }

  private clearSuggestion(): void {
    this.currentSuggestion = null;
  }

  private stripAnsi(str: string): string {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }
}