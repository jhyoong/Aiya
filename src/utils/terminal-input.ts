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
  private terminalWidth: number = 80;
  private updateTimeout: NodeJS.Timeout | null = null;
  private lastLinesUsed: number = 1;

  constructor(options: TerminalInputOptions) {
    this.options = options;
  }

  start(): void {
    this.isRawMode = true;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    // Get initial terminal width
    this.updateTerminalWidth();
    
    process.stdin.on('data', this.handleKeypress.bind(this));
    process.stdin.on('end', this.handleClose.bind(this));
    
    // Listen for terminal resize events
    process.stdout.on('resize', this.handleResize.bind(this));
    
    this.showPrompt();
  }

  stop(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }
    
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
        } else if (key.length > 1) {
          // Handle pasted content (multiple characters at once)
          this.handlePaste(key);
        }
    }
  }

  private handleCharacter(char: string): void {
    this.buffer = this.buffer.slice(0, this.cursorPosition) + char + this.buffer.slice(this.cursorPosition);
    this.cursorPosition++;
    this.debouncedUpdateDisplay();
  }

  private handleBackspace(): void {
    if (this.cursorPosition > 0) {
      this.buffer = this.buffer.slice(0, this.cursorPosition - 1) + this.buffer.slice(this.cursorPosition);
      this.cursorPosition--;
      this.debouncedUpdateDisplay();
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
          this.updateDisplay(); // Use immediate update for navigation
        }
      } else if (key === '\x1b[D') { // Left arrow
        if (this.cursorPosition > 0) {
          this.cursorPosition--;
          this.updateDisplay(); // Use immediate update for navigation
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
    // Cancel any pending debounced updates
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }
    
    // Calculate lines needed
    const promptLength = this.stripAnsi(this.options.prompt).length;
    const totalLength = promptLength + this.buffer.length;
    const linesNeeded = Math.max(1, Math.ceil(totalLength / this.terminalWidth));
    
    // Clear based on the maximum of current lines needed or previously used lines
    const linesToClear = Math.max(linesNeeded, this.lastLinesUsed);
    
    // Clear all lines that might contain our content
    for (let i = 0; i < linesToClear; i++) {
      if (i > 0) {
        process.stdout.write('\x1b[A'); // Move up one line
      }
      process.stdout.write('\r');
      readline.clearLine(process.stdout, 0);
    }
    
    // Move back to start position
    process.stdout.write('\r');
    
    // Show prompt and current input
    process.stdout.write(this.options.prompt + this.buffer);
    
    // Get suggestion if available
    let suggestionLength = 0;
    if (this.options.onSuggestion) {
      const suggestion = this.options.onSuggestion(this.buffer);
      if (suggestion && suggestion.displayText !== this.buffer) {
        this.currentSuggestion = suggestion;
        // Show the displayText in grey, but only the part after current input
        const displayPart = suggestion.displayText.slice(this.buffer.length);
        process.stdout.write(chalk.gray(displayPart));
        suggestionLength = displayPart.length;
      } else {
        this.currentSuggestion = null;
      }
    }
    
    // Update the lines used for next time (including suggestion)
    const totalDisplayLength = promptLength + this.buffer.length + suggestionLength;
    this.lastLinesUsed = Math.max(1, Math.ceil(totalDisplayLength / this.terminalWidth));
    
    // Position cursor correctly with multi-line support
    const cursorTotalPosition = promptLength + this.cursorPosition;
    const cursorLine = Math.floor(cursorTotalPosition / this.terminalWidth);
    const cursorColumn = cursorTotalPosition % this.terminalWidth;
    
    // Move to correct line
    const currentLine = Math.floor((promptLength + this.buffer.length) / this.terminalWidth);
    const lineDiff = currentLine - cursorLine;
    
    if (lineDiff > 0) {
      process.stdout.write(`\x1b[${lineDiff}A`); // Move up
    } else if (lineDiff < 0) {
      process.stdout.write(`\x1b[${-lineDiff}B`); // Move down
    }
    
    // Move to correct column
    process.stdout.write(`\r\x1b[${cursorColumn + 1}G`);
  }

  private clearSuggestion(): void {
    this.currentSuggestion = null;
  }

  private stripAnsi(str: string): string {
    // More comprehensive ANSI escape sequence removal
    return str.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
  }

  private updateTerminalWidth(): void {
    this.terminalWidth = process.stdout.columns || 80;
  }

  private handleResize(): void {
    this.updateTerminalWidth();
    // Redraw the display with new terminal width
    this.updateDisplay();
  }

  private debouncedUpdateDisplay(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    
    this.updateTimeout = setTimeout(() => {
      this.updateDisplay();
      this.updateTimeout = null;
    }, 10); // Small delay to prevent rapid successive updates
  }

  private handlePaste(text: string): void {
    // Filter out non-printable characters except for printable ASCII
    const cleanText = text.split('').filter(char => {
      const code = char.charCodeAt(0);
      return code >= 32 && code <= 126;
    }).join('');
    
    if (cleanText) {
      this.buffer = this.buffer.slice(0, this.cursorPosition) + cleanText + this.buffer.slice(this.cursorPosition);
      this.cursorPosition += cleanText.length;
      this.updateDisplay(); // Use immediate update for paste
    }
  }
}