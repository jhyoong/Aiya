import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface ToolLogEntry {
  timestamp: string;
  sessionId: string;
  toolName: string;
  args: any;
  result?: any;
  error?: string | undefined;
  duration?: number | undefined;
}

export class ToolLogger {
  private logFile: string;
  private sessionId: string;
  private isNewSession: boolean;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || randomUUID();
    this.isNewSession = !sessionId;

    // Create logs directory in ~/.aiya/logs/
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const aiyaDir = path.join(homeDir, '.aiya');
    const logsDir = path.join(aiyaDir, 'logs');

    // Ensure directories exist
    if (!fs.existsSync(aiyaDir)) {
      fs.mkdirSync(aiyaDir, { recursive: true });
    }
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    this.logFile = path.join(logsDir, 'tools.log');
  }

  getSessionId(): string {
    return this.sessionId;
  }

  logToolExecution(
    toolName: string,
    args: any,
    result?: any,
    error?: string,
    duration?: number
  ): void {
    const entry: ToolLogEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      toolName,
      args,
      result,
      error,
      duration,
    };

    const logLine = this.formatLogEntry(entry);

    try {
      fs.appendFileSync(this.logFile, logLine + '\n', 'utf8');
    } catch (writeError) {
      console.error('Failed to write tool log:', writeError);
    }
  }

  private formatLogEntry(entry: ToolLogEntry): string {
    const errorTag = entry.error ? ` ERROR: ${entry.error}` : '';
    const durationTag = entry.duration ? ` (${entry.duration}ms)` : '';
    const argsStr = this.sanitizeArgs(entry.args);
    return `[${entry.timestamp}] [${entry.sessionId}] ${entry.toolName} ${argsStr}${durationTag}${errorTag}`;
  }

  private sanitizeArgs(args: any): string {
    try {
      // Truncate large arguments to avoid massive log files
      const argsStr = JSON.stringify(args);
      if (argsStr.length > 500) {
        return argsStr.substring(0, 500) + '...[truncated]';
      }
      return argsStr;
    } catch {
      return '[unable to serialize args]';
    }
  }

  logSessionStart(): void {
    const logLine = `[${new Date().toISOString()}] [${this.sessionId}] SESSION_START`;
    try {
      fs.appendFileSync(this.logFile, logLine + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write session start log:', error);
    }
  }

  logSessionEnd(): void {
    const logLine = `[${new Date().toISOString()}] [${this.sessionId}] SESSION_END`;
    try {
      fs.appendFileSync(this.logFile, logLine + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write session end log:', error);
    }
  }

  isNewSessionStart(): boolean {
    return this.isNewSession;
  }

  static continueSession(existingLogger: ToolLogger): ToolLogger {
    const newLogger = new ToolLogger(existingLogger.getSessionId());
    newLogger.isNewSession = false;
    return newLogger;
  }

  static createNewSession(): ToolLogger {
    return new ToolLogger();
  }
}