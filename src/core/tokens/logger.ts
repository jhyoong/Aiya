import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface TokenLogEntry {
  timestamp: string;
  sessionId: string;
  sent: number;
  received: number;
  provider: string;
  model: string;
  estimated: boolean;
}

export class TokenLogger {
  private logFile: string;
  private sessionId: string;
  private provider: string;
  private model: string;
  private isNewSession: boolean;

  constructor(provider: string, model: string, sessionId?: string) {
    this.sessionId = sessionId || randomUUID();
    this.provider = provider;
    this.model = model;
    this.isNewSession = !sessionId; // Track if this is a new session or continuing existing one

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

    this.logFile = path.join(logsDir, 'tokens.log');
  }

  getSessionId(): string {
    return this.sessionId;
  }

  logTokenUsage(
    sent: number,
    received: number,
    estimated: boolean = false
  ): void {
    const entry: TokenLogEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      sent,
      received,
      provider: this.provider,
      model: this.model,
      estimated,
    };

    const logLine = this.formatLogEntry(entry);

    try {
      fs.appendFileSync(this.logFile, logLine + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write token log:', error);
    }
  }

  private formatLogEntry(entry: TokenLogEntry): string {
    const estimatedTag = entry.estimated ? ' [estimated]' : '';
    return `[${entry.timestamp}] [${entry.sessionId}] ${entry.provider}:${entry.model} sent: ${entry.sent}, received: ${entry.received}${estimatedTag}`;
  }

  logSessionStart(): void {
    const logLine = `[${new Date().toISOString()}] [${this.sessionId}] SESSION_START ${this.provider}:${this.model}`;
    try {
      fs.appendFileSync(this.logFile, logLine + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write session start log:', error);
    }
  }

  logSessionEnd(): void {
    const logLine = `[${new Date().toISOString()}] [${this.sessionId}] SESSION_END ${this.provider}:${this.model}`;
    try {
      fs.appendFileSync(this.logFile, logLine + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write session end log:', error);
    }
  }

  /**
   * Log a model/provider change within the same session
   */
  logSessionChange(newProvider: string, newModel: string): void {
    const oldProvider = `${this.provider}:${this.model}`;
    const newProviderModel = `${newProvider}:${newModel}`;

    const logLine = `[${new Date().toISOString()}] [${this.sessionId}] SESSION_CHANGE ${oldProvider} -> ${newProviderModel}`;
    try {
      fs.appendFileSync(this.logFile, logLine + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write session change log:', error);
    }

    // Update the current provider and model
    this.provider = newProvider;
    this.model = newModel;
  }

  /**
   * Update provider and model without logging (for internal state management)
   */
  updateProviderModel(provider: string, model: string): void {
    this.provider = provider;
    this.model = model;
  }

  /**
   * Get current provider
   */
  getCurrentProvider(): string {
    return this.provider;
  }

  /**
   * Get current model
   */
  getCurrentModel(): string {
    return this.model;
  }

  /**
   * Check if this is a new session
   */
  isNewSessionStart(): boolean {
    return this.isNewSession;
  }

  /**
   * Create a new TokenLogger for the same session with a different provider/model
   * This preserves the session ID while switching models
   */
  static continueSession(
    existingLogger: TokenLogger,
    newProvider: string,
    newModel: string
  ): TokenLogger {
    const newLogger = new TokenLogger(
      newProvider,
      newModel,
      existingLogger.getSessionId()
    );
    // Mark this as continuing an existing session, not a new one
    newLogger.isNewSession = false;
    return newLogger;
  }

  /**
   * Create a new TokenLogger for a fresh session
   */
  static createNewSession(provider: string, model: string): TokenLogger {
    return new TokenLogger(provider, model);
  }
}
