import { LLMProvider } from '../providers/base.js';
import { TokenLogger } from './logger.js';
import { EventEmitter } from 'events';

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface MessageTokenUsage {
  sent: number;
  received: number;
  estimated: boolean;
}

export interface SessionStats {
  totalTokens: number;
  messagesCount: number;
  averageTokensPerMessage: number;
  estimatedCost?: number;
}

export class TokenCounter extends EventEmitter {
  private provider: LLMProvider;
  private sessionUsage: TokenUsage = { input: 0, output: 0, total: 0 };
  private messageHistory: MessageTokenUsage[] = [];
  private contextLimit: number;
  private logger: TokenLogger;

  constructor(
    provider: LLMProvider,
    providerType: string,
    model: string,
    contextLimit?: number
  ) {
    super();
    this.provider = provider;
    this.contextLimit = contextLimit || 4096;
    this.logger = new TokenLogger(providerType, model);
    this.logger.logSessionStart();
  }

  countText(text: string): number {
    return this.provider.countTokens(text);
  }

  countMessages(messages: Array<{ role: string; content: string }>): number {
    let totalTokens = 0;

    for (const message of messages) {
      // Add tokens for role prefix (rough estimate)
      const rolePrefix = `${message.role}: `;
      totalTokens += this.countText(rolePrefix + message.content);

      // Add small overhead for message formatting
      totalTokens += 4; // Rough estimate for message overhead
    }

    return totalTokens;
  }

  trackTokenUsage(
    inputTokens: number,
    outputTokens: number,
    estimated: boolean = false
  ): MessageTokenUsage {
    this.sessionUsage.input += inputTokens;
    this.sessionUsage.output += outputTokens;
    this.sessionUsage.total += inputTokens + outputTokens;

    const messageUsage: MessageTokenUsage = {
      sent: inputTokens,
      received: outputTokens,
      estimated,
    };

    this.messageHistory.push(messageUsage);
    this.logger.logTokenUsage(inputTokens, outputTokens, estimated);

    // Emit event to notify React components of token update
    this.emit('tokenUpdate', {
      messageUsage,
      sessionUsage: this.getUsage(),
    });

    return messageUsage;
  }

  getSessionStats(): SessionStats {
    const averageTokens =
      this.messageHistory.length > 0
        ? this.sessionUsage.total / this.messageHistory.length
        : 0;

    const stats: SessionStats = {
      totalTokens: this.sessionUsage.total,
      messagesCount: this.messageHistory.length,
      averageTokensPerMessage: Math.round(averageTokens),
    };

    const cost = this.estimateCost(this.sessionUsage.total);
    if (cost !== undefined) {
      stats.estimatedCost = cost;
    }

    return stats;
  }

  getUsage(): TokenUsage {
    return { ...this.sessionUsage };
  }

  resetSession(): void {
    this.logger.logSessionEnd();
    this.sessionUsage = { input: 0, output: 0, total: 0 };
    this.messageHistory = [];
    this.logger.logSessionStart();
  }

  getSessionId(): string {
    return this.logger.getSessionId();
  }

  getLastMessageUsage(): MessageTokenUsage | null {
    return this.messageHistory.length > 0
      ? this.messageHistory[this.messageHistory.length - 1] || null
      : null;
  }

  getContextLength(): number {
    return this.getContextLimit();
  }

  formatTokenDisplay(): string {
    const lastMessage = this.getLastMessageUsage();
    if (!lastMessage) {
      return `[Tokens: sent 0 (${this.sessionUsage.input}), received 0 (${this.sessionUsage.output})]`;
    }

    return `[Tokens: sent ${lastMessage.sent} (${this.sessionUsage.input}), received ${lastMessage.received} (${this.sessionUsage.output})]`;
  }

  endSession(): void {
    this.logger.logSessionEnd();
  }

  /**
   * Extract token usage from provider-specific response data
   * Returns input/output tokens if available, otherwise estimates
   */
  extractTokenUsage(
    response: any,
    userMessage: string
  ): { input: number; output: number; estimated: boolean } {
    // Try to extract provider-specific token usage
    if (response?.usage) {
      // OpenAI/Azure format
      if (response.usage.prompt_tokens && response.usage.completion_tokens) {
        return {
          input: response.usage.prompt_tokens,
          output: response.usage.completion_tokens,
          estimated: false,
        };
      }
      // Anthropic format
      if (response.usage.input_tokens && response.usage.output_tokens) {
        return {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
          estimated: false,
        };
      }
    }

    // Gemini format
    if (response?.usageMetadata) {
      return {
        input: response.usageMetadata.promptTokenCount || 0,
        output: response.usageMetadata.candidatesTokenCount || 0,
        estimated: false,
      };
    }

    // Fallback to estimation for Ollama or when metadata is unavailable
    const inputTokens = this.countText(userMessage);
    const outputTokens = response?.tokensUsed
      ? Math.max(0, response.tokensUsed - inputTokens)
      : response?.content
        ? this.countText(response.content)
        : 0;

    return {
      input: inputTokens,
      output: outputTokens,
      estimated: true,
    };
  }

  checkContextLimit(messages: Array<{ role: string; content: string }>): {
    withinLimit: boolean;
    tokenCount: number;
    contextLimit: number;
    suggestTruncation?: boolean;
  } {
    const tokenCount = this.countMessages(messages);
    const contextLimit = this.getContextLimit();
    const withinLimit = tokenCount <= contextLimit;

    return {
      withinLimit,
      tokenCount,
      contextLimit,
      suggestTruncation: tokenCount > contextLimit * 0.8, // Suggest truncation at 80%
    };
  }

  truncateMessages(
    messages: Array<{ role: string; content: string }>,
    maxTokens?: number
  ): Array<{ role: string; content: string }> {
    const targetTokens = maxTokens || Math.floor(this.getContextLimit() * 0.7);
    const truncated = [...messages];

    // Always keep system message if present
    const systemMessage = truncated.find(m => m.role === 'system');
    const workingMessages = truncated.filter(m => m.role !== 'system');

    // Remove oldest messages until we're under the limit
    while (
      this.countMessages(workingMessages) > targetTokens &&
      workingMessages.length > 2
    ) {
      workingMessages.shift();
    }

    // Reconstruct with system message first
    const result = systemMessage
      ? [systemMessage, ...workingMessages]
      : workingMessages;

    return result;
  }

  private getContextLimit(): number {
    return this.contextLimit;
  }

  private estimateCost(_tokens: number): number | undefined {
    // Basic cost estimation - would be provider-specific in real implementation
    // For Ollama (local), there's no API cost
    return undefined;
  }

  getEfficiencyMetrics(): {
    avgTokensPerMessage: number;
    compressionRatio: number;
    contextUtilization: number;
  } {
    const stats = this.getSessionStats();
    const contextLimit = this.getContextLimit();

    return {
      avgTokensPerMessage: stats.averageTokensPerMessage,
      compressionRatio:
        this.sessionUsage.output > 0
          ? this.sessionUsage.input / this.sessionUsage.output
          : 0,
      contextUtilization: stats.totalTokens / contextLimit,
    };
  }

  createTokenBudget(totalBudget: number): {
    inputBudget: number;
    outputBudget: number;
    reserveBudget: number;
  } {
    // Allocate budget: 60% input, 30% output, 10% reserve
    return {
      inputBudget: Math.floor(totalBudget * 0.6),
      outputBudget: Math.floor(totalBudget * 0.3),
      reserveBudget: Math.floor(totalBudget * 0.1),
    };
  }
}
