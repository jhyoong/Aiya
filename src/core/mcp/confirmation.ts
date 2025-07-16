import * as readline from 'readline';
import { CommandRiskAssessment, CommandRiskCategory } from './shell.js';
import chalk from 'chalk';

/**
 * Options for the confirmation prompt
 */
export interface ConfirmationPromptOptions {
  /** The command to be executed */
  command: string;
  /** Risk assessment details */
  riskAssessment: CommandRiskAssessment;
  /** Current working directory */
  workingDirectory: string;
  /** Timeout in milliseconds for the prompt */
  timeout: number;
}

/**
 * Response from the confirmation prompt
 */
export interface ConfirmationResponse {
  /** User's decision */
  decision: 'allow' | 'deny' | 'trust' | 'block';
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
  /** The decision made */
  decision: 'allow' | 'deny' | 'trust';
  /** When the decision was made */
  timestamp: Date;
  /** Risk score of the original command */
  riskScore: number;
}

/**
 * Manages session memory for confirmation decisions
 */
export class SessionMemoryManager {
  private decisions: Map<string, SessionDecision> = new Map();
  private readonly maxDecisions = 100;
  private readonly decisionTtl = 30 * 60 * 1000; // 30 minutes

  /**
   * Check if there's a previous decision for this command
   */
  checkPreviousDecision(command: string): SessionDecision | null {
    // Clean up expired decisions first
    this.clearExpiredDecisions();

    // Check for exact match first
    if (this.decisions.has(command)) {
      return this.decisions.get(command)!;
    }

    // Check for pattern matches
    for (const [pattern, decision] of this.decisions) {
      try {
        if (new RegExp(pattern).test(command)) {
          return decision;
        }
      } catch {
        // Invalid regex, skip
        continue;
      }
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
}

/**
 * Get risk color based on category
 */
function getRiskColor(category: CommandRiskCategory): string {
  switch (category) {
    case CommandRiskCategory.SAFE:
      return 'green';
    case CommandRiskCategory.LOW:
      return 'yellow';
    case CommandRiskCategory.MEDIUM:
      return 'orange';
    case CommandRiskCategory.HIGH:
      return 'red';
    case CommandRiskCategory.CRITICAL:
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

  const riskColor = getRiskColor(options.riskAssessment.category);
  const riskText = `${options.riskAssessment.category.toUpperCase()} (Score: ${options.riskAssessment.riskScore})`;

  // Apply color based on risk category
  let coloredRiskText: string;
  switch (riskColor) {
    case 'green':
      coloredRiskText = chalk.green.bold(riskText);
      break;
    case 'yellow':
      coloredRiskText = chalk.yellow.bold(riskText);
      break;
    case 'orange':
      coloredRiskText = chalk.hex('#FFA500').bold(riskText); // Orange color
      break;
    case 'red':
      coloredRiskText = chalk.red.bold(riskText);
      break;
    case 'magenta':
      coloredRiskText = chalk.magenta.bold(riskText);
      break;
    default:
      coloredRiskText = chalk.white.bold(riskText);
      break;
  }

  lines.push(`${chalk.white.bold('Risk Level:')} ${coloredRiskText}`);
  lines.push('');

  // Risk factors
  if (options.riskAssessment.riskFactors.length > 0) {
    lines.push(chalk.white.bold('Risk Factors:'));
    options.riskAssessment.riskFactors.forEach(factor => {
      lines.push(chalk.yellow(`• ${factor}`));
    });
    lines.push('');
  }

  // Potential impact
  if (options.riskAssessment.context.potentialImpact.length > 0) {
    lines.push(chalk.white.bold('Potential Impact:'));
    options.riskAssessment.context.potentialImpact.forEach(impact => {
      lines.push(chalk.red(`• ${impact}`));
    });
    lines.push('');
  }

  // Suggestions
  if (options.riskAssessment.context.mitigationSuggestions.length > 0) {
    lines.push(chalk.white.bold('Suggestions:'));
    options.riskAssessment.context.mitigationSuggestions.forEach(suggestion => {
      lines.push(chalk.green(`• ${suggestion}`));
    });
    lines.push('');
  }

  // Additional details if requested
  if (showDetails) {
    lines.push(chalk.white.bold('Additional Details:'));
    lines.push(
      `${chalk.gray.bold('Command Type:')} ${chalk.gray(options.riskAssessment.context.commandType)}`
    );
    lines.push(
      `${chalk.gray.bold('Requires Confirmation:')} ${chalk.gray(options.riskAssessment.requiresConfirmation ? 'Yes' : 'No')}`
    );
    lines.push(
      `${chalk.gray.bold('Should Block:')} ${chalk.gray(options.riskAssessment.shouldBlock ? 'Yes' : 'No')}`
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
 * Main confirmation prompt class
 */
export class ShellConfirmationPrompt {
  private sessionMemory: SessionMemoryManager;

  constructor() {
    this.sessionMemory = new SessionMemoryManager();
  }

  /**
   * Prompt the user for confirmation
   */
  async promptUser(
    options: ConfirmationPromptOptions
  ): Promise<ConfirmationResponse> {
    // Check session memory first
    const previousDecision = this.sessionMemory.checkPreviousDecision(
      options.command
    );
    if (previousDecision) {
      return {
        decision: previousDecision.decision,
        rememberDecision: true,
        timedOut: false,
      };
    }

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

        // Record decision in session memory if requested
        if (response.rememberDecision && !response.timedOut) {
          this.sessionMemory.recordDecision(options.command, {
            commandPattern: options.command,
            decision: response.decision as 'allow' | 'deny' | 'trust',
            timestamp: new Date(),
            riskScore: options.riskAssessment.riskScore,
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
              decision: 'allow',
              rememberDecision: false,
              timedOut: false,
            });
            break;
          case 'd':
            handleResponse({
              decision: 'deny',
              rememberDecision: false,
              timedOut: false,
            });
            break;
          case 't':
            handleResponse({
              decision: 'trust',
              rememberDecision: true,
              timedOut: false,
            });
            break;
          case 'b':
            handleResponse({
              decision: 'block',
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
          decision: 'deny',
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
              decision: 'deny',
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
