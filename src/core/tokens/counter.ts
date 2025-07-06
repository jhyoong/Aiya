import { LLMProvider } from '../providers/base.js';

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface SessionStats {
  totalTokens: number;
  messagesCount: number;
  averageTokensPerMessage: number;
  estimatedCost?: number;
}

export class TokenCounter {
  private provider: LLMProvider;
  private sessionUsage: TokenUsage = { input: 0, output: 0, total: 0 };
  private messageHistory: number[] = [];
  private contextLimit: number;

  constructor(provider: LLMProvider, contextLimit?: number) {
    this.provider = provider;
    this.contextLimit = contextLimit || 4096;
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

  trackTokenUsage(inputTokens: number, outputTokens: number): void {
    this.sessionUsage.input += inputTokens;
    this.sessionUsage.output += outputTokens;
    this.sessionUsage.total += inputTokens + outputTokens;
    
    this.messageHistory.push(inputTokens + outputTokens);
  }

  getSessionStats(): SessionStats {
    const averageTokens = this.messageHistory.length > 0 
      ? this.sessionUsage.total / this.messageHistory.length 
      : 0;

    const stats: SessionStats = {
      totalTokens: this.sessionUsage.total,
      messagesCount: this.messageHistory.length,
      averageTokensPerMessage: Math.round(averageTokens)
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
    this.sessionUsage = { input: 0, output: 0, total: 0 };
    this.messageHistory = [];
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
      suggestTruncation: tokenCount > contextLimit * 0.8 // Suggest truncation at 80%
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
    let workingMessages = truncated.filter(m => m.role !== 'system');
    
    // Remove oldest messages until we're under the limit
    while (this.countMessages(workingMessages) > targetTokens && workingMessages.length > 2) {
      workingMessages.shift();
    }
    
    // Reconstruct with system message first
    const result = systemMessage ? [systemMessage, ...workingMessages] : workingMessages;
    
    return result;
  }

  formatTokenDisplay(tokenCount: number, showCost: boolean = false): string {
    const formatted = tokenCount.toLocaleString();
    
    if (showCost) {
      const cost = this.estimateCost(tokenCount);
      return cost ? `${formatted} tokens (~$${cost.toFixed(4)})` : `${formatted} tokens`;
    }
    
    return `${formatted} tokens`;
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
      compressionRatio: this.sessionUsage.output > 0 
        ? this.sessionUsage.input / this.sessionUsage.output 
        : 0,
      contextUtilization: stats.totalTokens / contextLimit
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
      reserveBudget: Math.floor(totalBudget * 0.1)
    };
  }
}