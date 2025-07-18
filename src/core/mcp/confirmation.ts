import * as readline from 'readline';
import { CommandCategorization, CommandCategory } from './shell/index.js';
import chalk from 'chalk';

/**
 * Options for the confirmation prompt
 */
export interface ConfirmationPromptOptions {
  /** The command to be executed */
  command: string;
  /** Command categorization details */
  categorization: CommandCategorization;
  /** Current working directory */
  workingDirectory: string;
  /** Timeout in milliseconds for the prompt */
  timeout: number;
  /** Whether session memory is enabled */
  sessionMemory?: boolean;
}

/**
 * Response from the confirmation prompt
 */
export interface ConfirmationResponse {
  /** User's action */
  action: 'allow' | 'deny' | 'trust' | 'block';
  /** Whether to remember this decision for the session */
  rememberDecision: boolean;
  /** Whether the prompt timed out */
  timedOut: boolean;
}

/**
 * Session decision cache entry
 */
export interface SessionDecision {
  /** Command pattern that was decided on */
  commandPattern: string;
  /** The action taken */
  action: 'allow' | 'deny' | 'trust';
  /** When the decision was made */
  timestamp: Date;
  /** Category of the original command */
  category: CommandCategory;
}

/**
 * Manages session memory for confirmation decisions
 * 
 * This class provides in-memory caching of user confirmation decisions to reduce
 * prompt fatigue during a single session. It supports both exact command matching
 * and regex pattern matching for flexible command recognition.
 * 
 * Key Features:
 * - Performance optimized lookups (typically <1ms)
 * - Automatic cleanup of expired decisions (30 minute TTL)
 * - Capacity management (max 100 decisions)
 * - Pattern-based matching for similar commands
 * - Security audit logging for decision usage
 */
export class SessionMemoryManager {
  private decisions: Map<string, SessionDecision> = new Map();
  private readonly maxDecisions = 100;
  private readonly decisionTtl = 30 * 60 * 1000; // 30 minutes

  /**
   * Check if there's a previous decision for this command
   * 
   * This method performs efficient lookup of cached decisions using:
   * 1. Exact string matching for direct command matches
   * 2. Regex pattern matching for flexible command recognition
   * 3. Performance monitoring with debug logging
   * 4. Automatic cleanup of expired decisions
   * 
   * Performance: Typically <1ms lookup time, target <5ms
   * 
   * @param command - The command to check for previous decisions
   * @returns SessionDecision if found, null otherwise
   */
  checkPreviousDecision(command: string): SessionDecision | null {
    const startTime = performance.now();
    
    // Clean up expired decisions first
    this.clearExpiredDecisions();

    // Check for exact match first
    if (this.decisions.has(command)) {
      const decision = this.decisions.get(command)!;
      const lookupTime = performance.now() - startTime;
      
      // Log performance for debugging in development mode
      if (
        process.env.NODE_ENV === 'development' ||
        process.env.DEBUG_SHELL_SECURITY
      ) {
        console.log(
          `[SHELL CONFIRMATION] Session memory exact match lookup: ${lookupTime.toFixed(2)}ms for command: ${command}`
        );
      }
      
      return decision;
    }

    // Check for pattern matches
    for (const [pattern, decision] of this.decisions) {
      try {
        if (new RegExp(pattern).test(command)) {
          const lookupTime = performance.now() - startTime;
          
          // Log performance for debugging in development mode
          if (
            process.env.NODE_ENV === 'development' ||
            process.env.DEBUG_SHELL_SECURITY
          ) {
            console.log(
              `[SHELL CONFIRMATION] Session memory pattern match lookup: ${lookupTime.toFixed(2)}ms for command: ${command}, pattern: ${pattern}`
            );
          }
          
          return decision;
        }
      } catch {
        // Invalid regex, skip
        continue;
      }
    }

    const lookupTime = performance.now() - startTime;
    
    // Log performance for debugging in development mode
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_SHELL_SECURITY
    ) {
      console.log(
        `[SHELL CONFIRMATION] Session memory no match lookup: ${lookupTime.toFixed(2)}ms for command: ${command}`
      );
    }

    return null;
  }

  /**
   * Record a new decision
   */
  recordDecision(command: string, decision: SessionDecision): void {
    // Remove oldest decision if at capacity
    if (this.decisions.size >= this.maxDecisions) {
      const oldest = this.decisions.keys().next().value;
      if (oldest) {
        this.decisions.delete(oldest);
      }
    }

    this.decisions.set(command, decision);
  }

  /**
   * Clear expired decisions
   */
  clearExpiredDecisions(): void {
    const now = Date.now();
    for (const [command, decision] of this.decisions) {
      if (now - decision.timestamp.getTime() > this.decisionTtl) {
        this.decisions.delete(command);
      }
    }
  }

  /**
   * Clear all decisions
   */
  clearAllDecisions(): void {
    this.decisions.clear();
  }

  /**
   * Get the number of cached decisions
   */
  getDecisionCount(): number {
    return this.decisions.size;
  }

  /**
   * Performance test method - measure lookup performance with sample data
   */
  measureLookupPerformance(): { 
    averageExactMatch: number; 
    averagePatternMatch: number; 
    averageNoMatch: number; 
  } {
    // Create sample decisions for testing
    const sampleDecisions: [string, SessionDecision][] = [
      ['ls -la', { commandPattern: 'ls -la', action: 'allow', timestamp: new Date(), category: CommandCategory.SAFE }],
      ['^git.*', { commandPattern: '^git.*', action: 'allow', timestamp: new Date(), category: CommandCategory.SAFE }],
      ['^npm.*test', { commandPattern: '^npm.*test', action: 'allow', timestamp: new Date(), category: CommandCategory.RISKY }],
      ['cp file.txt backup.txt', { commandPattern: 'cp file.txt backup.txt', action: 'trust', timestamp: new Date(), category: CommandCategory.RISKY }],
    ];
    
    // Save current state
    const originalDecisions = new Map(this.decisions);
    
    // Add sample decisions
    sampleDecisions.forEach(([pattern, decision]) => {
      this.decisions.set(pattern, decision);
    });
    
    // Test exact matches
    const exactMatchTimes: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      this.checkPreviousDecision('ls -la');
      exactMatchTimes.push(performance.now() - start);
    }
    
    // Test pattern matches
    const patternMatchTimes: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      this.checkPreviousDecision('git status');
      patternMatchTimes.push(performance.now() - start);
    }
    
    // Test no matches
    const noMatchTimes: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      this.checkPreviousDecision('unknown-command-xyz');
      noMatchTimes.push(performance.now() - start);
    }
    
    // Restore original state
    this.decisions = originalDecisions;
    
    // Calculate averages
    const average = (times: number[]) => times.reduce((a, b) => a + b, 0) / times.length;
    
    return {
      averageExactMatch: average(exactMatchTimes),
      averagePatternMatch: average(patternMatchTimes),
      averageNoMatch: average(noMatchTimes),
    };
  }
}

/**
 * Get risk color based on category
 */
function getCategoryColor(category: CommandCategory): string {
  switch (category) {
    case CommandCategory.SAFE:
      return 'green';
    case CommandCategory.RISKY:
      return 'yellow';
    case CommandCategory.DANGEROUS:
      return 'red';
    case CommandCategory.BLOCKED:
      return 'magenta';
    default:
      return 'white';
  }
}

/**
 * Format the confirmation prompt display
 */
function formatConfirmationPrompt(
  options: ConfirmationPromptOptions,
  timeLeft: number,
  showDetails: boolean = false
): string {
  const lines: string[] = [];

  // Header
  lines.push(chalk.cyan.bold('🔍 COMMAND CONFIRMATION REQUIRED'));
  lines.push('');

  // Command details
  lines.push(`${chalk.white.bold('Command:')} ${chalk.cyan(options.command)}`);
  lines.push(
    `${chalk.white.bold('Working Directory:')} ${chalk.gray(options.workingDirectory)}`
  );

  const categoryColor = getCategoryColor(options.categorization.category);
  const categoryText = `${options.categorization.category.toUpperCase()}`;

  // Apply color based on category
  let coloredCategoryText: string;
  switch (categoryColor) {
    case 'green':
      coloredCategoryText = chalk.green.bold(categoryText);
      break;
    case 'yellow':
      coloredCategoryText = chalk.yellow.bold(categoryText);
      break;
    case 'red':
      coloredCategoryText = chalk.red.bold(categoryText);
      break;
    case 'magenta':
      coloredCategoryText = chalk.magenta.bold(categoryText);
      break;
    default:
      coloredCategoryText = chalk.white.bold(categoryText);
      break;
  }

  lines.push(`${chalk.white.bold('Category:')} ${coloredCategoryText}`);
  lines.push('');

  // Categorization reason
  lines.push(chalk.white.bold('Reason:'));
  lines.push(chalk.yellow(`• ${options.categorization.reason}`));
  if (options.categorization.matchedPattern) {
    lines.push(chalk.gray(`• Matched pattern: ${options.categorization.matchedPattern}`));
  }
  lines.push('');

  // Additional details if requested
  if (showDetails) {
    lines.push(chalk.white.bold('Additional Details:'));
    lines.push(
      `${chalk.gray.bold('Requires Confirmation:')} ${chalk.gray(options.categorization.requiresConfirmation ? 'Yes' : 'No')}`
    );
    lines.push(
      `${chalk.gray.bold('Allow Execution:')} ${chalk.gray(options.categorization.allowExecution ? 'Yes' : 'No')}`
    );
    lines.push('');
  }

  // Options
  lines.push(chalk.white.bold('Options:'));
  lines.push(chalk.green('  [A] Allow once'));
  lines.push(chalk.red('  [D] Deny'));
  lines.push(chalk.blue('  [T] Trust pattern'));
  lines.push(chalk.magenta('  [B] Block pattern'));
  lines.push(chalk.cyan('  [S] Show details'));
  lines.push('');

  // Timeout countdown
  lines.push(chalk.yellow(`Choice (timeout in ${timeLeft}s): `));

  return lines.join('\n');
}

/**
 * Callback type for UI integration
 */
export type ConfirmationUICallback = (
  options: ConfirmationPromptOptions
) => Promise<ConfirmationResponse>;

/**
 * Main confirmation prompt class
 */
export class ShellConfirmationPrompt {
  private sessionMemory: SessionMemoryManager;
  private uiCallback: ConfirmationUICallback | null = null;

  constructor() {
    this.sessionMemory = new SessionMemoryManager();
  }

  /**
   * Register a UI callback for handling confirmation prompts
   * This allows the React/Ink UI to handle the confirmation instead of raw console
   */
  setUICallback(callback: ConfirmationUICallback): void {
    this.uiCallback = callback;
  }

  /**
   * Clear the UI callback (fallback to console mode)
   */
  clearUICallback(): void {
    this.uiCallback = null;
  }

  /**
   * Prompt the user for confirmation with session memory integration
   * 
   * This method implements the core confirmation flow with enhanced features:
   * 1. Configuration-aware session memory (respects sessionMemory setting)
   * 2. Automatic decision caching and retrieval
   * 3. Performance monitoring and audit logging
   * 4. Fallback from React/Ink UI to console mode
   * 
   * Session Memory Flow:
   * - If enabled and previous decision exists, return cached decision
   * - Otherwise, prompt user and optionally cache the new decision
   * 
   * @param options - Confirmation prompt configuration including sessionMemory setting
   * @returns Promise resolving to user's confirmation response
   */
  async promptUser(
    options: ConfirmationPromptOptions
  ): Promise<ConfirmationResponse> {
    // Check session memory first (only if enabled in configuration)
    const sessionMemoryEnabled = options.sessionMemory !== false; // Default to enabled if not specified
    
    if (sessionMemoryEnabled) {
      const previousDecision = this.sessionMemory.checkPreviousDecision(
        options.command
      );
      if (previousDecision) {
        // Log that we're using a cached decision for audit purposes
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.DEBUG_SHELL_SECURITY
        ) {
          console.log(
            `[SHELL CONFIRMATION] Using cached session decision for command: ${options.command} - Action: ${previousDecision.action} (Category: ${previousDecision.category}, Age: ${Math.floor((Date.now() - previousDecision.timestamp.getTime()) / 1000)}s)`
          );
        }

        return {
          action: previousDecision.action,
          rememberDecision: true,
          timedOut: false,
        };
      }
    }

    // Use UI callback if available (React/Ink integration)
    if (this.uiCallback) {
      try {
        const response = await this.uiCallback(options);

        // Record decision in session memory if requested and session memory is enabled
        if (response.rememberDecision && !response.timedOut && sessionMemoryEnabled) {
          this.sessionMemory.recordDecision(options.command, {
            commandPattern: options.command,
            action: response.action as 'allow' | 'deny' | 'trust',
            timestamp: new Date(),
            category: options.categorization.category,
          });
        }

        return response;
      } catch (error) {
        console.error('Error in UI callback, falling back to console:', error);
        // Fall through to console implementation
      }
    }

    // Fallback to console implementation
    return this.promptUserConsole(options, sessionMemoryEnabled);
  }

  /**
   * Console-based confirmation prompt (fallback implementation)
   */
  private async promptUserConsole(
    options: ConfirmationPromptOptions,
    sessionMemoryEnabled: boolean = true
  ): Promise<ConfirmationResponse> {
    return new Promise<ConfirmationResponse>(resolve => {
      let timeLeft = Math.ceil(options.timeout / 1000);
      let showDetails = false;
      let isResolved = false;

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const handleResponse = (response: ConfirmationResponse) => {
        if (isResolved) return;
        isResolved = true;

        // Record decision in session memory if requested and session memory is enabled
        if (response.rememberDecision && !response.timedOut && sessionMemoryEnabled) {
          this.sessionMemory.recordDecision(options.command, {
            commandPattern: options.command,
            action: response.action as 'allow' | 'deny' | 'trust',
            timestamp: new Date(),
            category: options.categorization.category,
          });
        }

        // Clean up and resolve
        cleanup();
        resolve(response);
      };

      const updateDisplay = () => {
        // Clear screen and show prompt
        console.clear();
        console.log(formatConfirmationPrompt(options, timeLeft, showDetails));
      };

      const handleKeypress = (key: string) => {
        if (isResolved) return;

        const keyLower = key.toLowerCase();

        switch (keyLower) {
          case 'a':
            handleResponse({
              action: 'allow',
              rememberDecision: false,
              timedOut: false,
            });
            break;
          case 'd':
            handleResponse({
              action: 'deny',
              rememberDecision: false,
              timedOut: false,
            });
            break;
          case 't':
            handleResponse({
              action: 'trust',
              rememberDecision: true,
              timedOut: false,
            });
            break;
          case 'b':
            handleResponse({
              action: 'block',
              rememberDecision: true,
              timedOut: false,
            });
            break;
          case 's':
            showDetails = !showDetails;
            updateDisplay();
            break;
          default:
            // Invalid key, update display to show current state
            updateDisplay();
            break;
        }
      };

      const cleanup = () => {
        try {
          clearInterval(countdownInterval);
          clearTimeout(timeoutHandle);
          rl.close();
        } catch (error) {
          // Ignore cleanup errors
        }
      };

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        handleResponse({
          action: 'deny',
          rememberDecision: false,
          timedOut: true,
        });
      }, options.timeout);

      // Set up countdown interval
      const countdownInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
          clearInterval(countdownInterval);
          return;
        }
        updateDisplay();
      }, 1000);

      // Set up keyboard input
      rl.on('line', input => {
        handleKeypress(input.trim());
      });

      // Enable raw mode for single character input
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.on('data', data => {
          const key = data.toString();
          // Handle Ctrl+C
          if (key === '\u0003') {
            handleResponse({
              action: 'deny',
              rememberDecision: false,
              timedOut: false,
            });
            return;
          }
          handleKeypress(key);
        });
      }

      // Initial display
      updateDisplay();
    });
  }

  /**
   * Clear all session memory
   */
  clearSessionMemory(): void {
    this.sessionMemory.clearAllDecisions();
  }

  /**
   * Get session memory statistics
   */
  getSessionMemoryStats(): { decisionCount: number } {
    return {
      decisionCount: this.sessionMemory.getDecisionCount(),
    };
  }
}
