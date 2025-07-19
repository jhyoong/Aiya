import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

/**
 * Base Logger Class
 *
 * Consolidates common logging functionality shared across TokenLogger,
 * ToolLogger, and ShellLogger to eliminate code duplication.
 */
export abstract class BaseLogger {
  protected logFile: string;
  protected sessionId: string;
  protected isNewSession: boolean;

  constructor(logFileName: string, sessionId?: string) {
    this.sessionId = sessionId || randomUUID();
    this.isNewSession = !sessionId; // Track if this is a new session or continuing existing one

    // Create logs directory in ~/.aiya/logs/
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const aiyaDir = path.join(homeDir, '.aiya');
    const logsDir = path.join(aiyaDir, 'logs');

    // Ensure directories exist
    this.ensureDirectoriesExist(aiyaDir, logsDir);

    this.logFile = path.join(logsDir, logFileName);
  }

  /**
   * Ensure required directories exist
   */
  private ensureDirectoriesExist(aiyaDir: string, logsDir: string): void {
    if (!fs.existsSync(aiyaDir)) {
      fs.mkdirSync(aiyaDir, { recursive: true });
    }
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Check if this is a new session
   */
  isNewSessionStart(): boolean {
    return this.isNewSession;
  }

  /**
   * Write a log entry to the file
   */
  protected writeLogEntry(logLine: string): void {
    try {
      fs.appendFileSync(this.logFile, logLine + '\n', 'utf8');
    } catch (error) {
      console.error(`Failed to write ${this.getLoggerType()} log:`, error);
    }
  }

  /**
   * Create a standardized timestamp
   */
  protected createTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Log session start event
   */
  logSessionStart(): void {
    const logLine = this.formatSessionEvent('SESSION_START');
    this.writeLogEntry(logLine);
  }

  /**
   * Log session end event
   */
  logSessionEnd(): void {
    const logLine = this.formatSessionEvent('SESSION_END');
    this.writeLogEntry(logLine);
  }

  /**
   * Format a session event log line
   */
  protected formatSessionEvent(
    eventType: string,
    additionalInfo?: string
  ): string {
    const timestamp = this.createTimestamp();
    const info = additionalInfo ? ` ${additionalInfo}` : '';
    return `[${timestamp}] [${this.sessionId}] ${eventType}${info}`;
  }

  /**
   * Create a logger for continuing an existing session
   */
  static continueLoggerSession<T extends BaseLogger>(
    LoggerClass: new (logFileName: string, sessionId?: string) => T,
    logFileName: string,
    existingSessionId: string
  ): T {
    const logger = new LoggerClass(logFileName, existingSessionId);
    logger.isNewSession = false;
    return logger;
  }

  /**
   * Create a logger for a new session
   */
  static createNewLoggerSession<T extends BaseLogger>(
    LoggerClass: new (logFileName: string, sessionId?: string) => T,
    logFileName: string
  ): T {
    return new LoggerClass(logFileName);
  }

  /**
   * Abstract method to get logger type name (for error messages)
   */
  protected abstract getLoggerType(): string;
}
