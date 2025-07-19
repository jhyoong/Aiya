import { BaseLogger } from '../logging/BaseLogger.js';

export interface TokenLogEntry {
  timestamp: string;
  sessionId: string;
  sent: number;
  received: number;
  provider: string;
  model: string;
  estimated: boolean;
}

export class TokenLogger extends BaseLogger {
  private provider: string;
  private model: string;

  constructor(provider: string, model: string, sessionId?: string) {
    super('tokens.log', sessionId);
    this.provider = provider;
    this.model = model;
  }

  protected getLoggerType(): string {
    return 'token';
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
    this.writeLogEntry(logLine);
  }

  private formatLogEntry(entry: TokenLogEntry): string {
    const estimatedTag = entry.estimated ? ' [estimated]' : '';
    return `[${entry.timestamp}] [${entry.sessionId}] ${entry.provider}:${entry.model} sent: ${entry.sent}, received: ${entry.received}${estimatedTag}`;
  }

  override logSessionStart(): void {
    const providerInfo = `${this.provider}:${this.model}`;
    const logLine = this.formatSessionEvent('SESSION_START', providerInfo);
    this.writeLogEntry(logLine);
  }

  override logSessionEnd(): void {
    const providerInfo = `${this.provider}:${this.model}`;
    const logLine = this.formatSessionEvent('SESSION_END', providerInfo);
    this.writeLogEntry(logLine);
  }

  /**
   * Log a model/provider change within the same session
   */
  logSessionChange(newProvider: string, newModel: string): void {
    const oldProvider = `${this.provider}:${this.model}`;
    const newProviderModel = `${newProvider}:${newModel}`;
    const changeInfo = `${oldProvider} -> ${newProviderModel}`;

    const logLine = this.formatSessionEvent('SESSION_CHANGE', changeInfo);
    this.writeLogEntry(logLine);

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
  override isNewSessionStart(): boolean {
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
