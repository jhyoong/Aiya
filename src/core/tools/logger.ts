import { BaseLogger } from '../logging/BaseLogger.js';

export interface ToolLogEntry {
  timestamp: string;
  sessionId: string;
  toolName: string;
  args: unknown;
  result?: unknown;
  error?: string | undefined;
  duration?: number | undefined;
}

export class ToolLogger extends BaseLogger {
  constructor(sessionId?: string) {
    super('tools.log', sessionId);
  }

  protected getLoggerType(): string {
    return 'tool';
  }

  logToolExecution(
    toolName: string,
    args: unknown,
    result?: unknown,
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
    this.writeLogEntry(logLine);
  }

  private formatLogEntry(entry: ToolLogEntry): string {
    const errorTag = entry.error ? ` ERROR: ${entry.error}` : '';
    const durationTag = entry.duration ? ` (${entry.duration}ms)` : '';
    const argsStr = this.sanitizeArgs(entry.args);
    return `[${entry.timestamp}] [${entry.sessionId}] ${entry.toolName} ${argsStr}${durationTag}${errorTag}`;
  }

  private sanitizeArgs(args: unknown): string {
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

  logVerboseEvent(event: string, details?: string): void {
    const detailsStr = details ? ` ${details}` : '';
    const logLine = this.formatSessionEvent(`VERBOSE: ${event}`, detailsStr);
    this.writeLogEntry(logLine);
  }

  logToolDetection(count: number): void {
    this.logVerboseEvent('TOOL_DETECTION', `Detected ${count} tool call(s)`);
  }

  logAutoDecision(toolName: string, decision: 'allow' | 'reject'): void {
    this.logVerboseEvent(
      'AUTO_DECISION',
      `Tool '${toolName}' auto-${decision}ed due to stored preference`
    );
  }

  logUserCancellation(): void {
    this.logVerboseEvent(
      'USER_CANCELLATION',
      'Tool execution cancelled by user'
    );
  }

  logToolExecutionStart(toolName: string, args: unknown): void {
    const argsStr = this.sanitizeArgs(args);
    this.logVerboseEvent(
      'TOOL_EXECUTION_START',
      `Executing: ${toolName}(${argsStr})`
    );
  }

  logToolExecutionResult(
    toolName: string,
    result: string,
    isError: boolean
  ): void {
    const status = isError ? 'ERROR' : 'SUCCESS';
    const truncatedResult =
      result.length > 100 ? result.substring(0, 100) + '...' : result;
    this.logVerboseEvent(
      'TOOL_EXECUTION_RESULT',
      `${toolName}: ${status} - ${truncatedResult}`
    );
  }

  logPreferenceStorage(toolName: string, preference: string): void {
    this.logVerboseEvent(
      'PREFERENCE_STORAGE',
      `Stored preference for '${toolName}': ${preference}`
    );
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
