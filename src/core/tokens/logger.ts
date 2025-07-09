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

  constructor(provider: string, model: string) {
    this.sessionId = randomUUID();
    this.provider = provider;
    this.model = model;
    
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

  logTokenUsage(sent: number, received: number, estimated: boolean = false): void {
    const entry: TokenLogEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      sent,
      received,
      provider: this.provider,
      model: this.model,
      estimated
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
}