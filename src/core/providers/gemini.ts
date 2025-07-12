import { GoogleGenAI } from '@google/genai';
import {
  LLMProvider,
  Message,
  Response,
  StreamResponse,
  ModelInfo,
  ConnectionError,
  ModelNotFoundError,
  ProviderError,
  ProviderConfig,
} from './base.js';
import { CapabilityManager } from '../config/CapabilityManager.js';
import { GeminiErrorMapper, ErrorContext } from '../errors/index.js';

interface ThinkingConfig {
  thinkingBudget?: number;
  includeThoughts?: boolean;
}

interface GenerationConfig {
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

export class GeminiProvider extends LLMProvider {
  private client: GoogleGenAI;
  private generationConfig: GenerationConfig;
  private thinkingConfig?: ThinkingConfig;

  constructor(config: ProviderConfig) {
    super(config);

    if (!config.apiKey) {
      throw new ProviderError('Google AI API key is required');
    }

    this.client = new GoogleGenAI({ apiKey: config.apiKey });

    this.generationConfig = {
      maxOutputTokens: config.maxTokens || config.gemini?.maxTokens || 8192,
      temperature: 0.7,
      topP: 0.8,
      topK: 40,
    };

    // Configure thinking mode for 2.5 models
    if (this.model.includes('2.5')) {
      this.thinkingConfig = {
        thinkingBudget: config.gemini?.thinkingBudget || -1, // Dynamic thinking by default
        includeThoughts: config.gemini?.includeThoughts || false,
      };
    }
  }

  /**
   * Handle errors using the standardized error mapper
   */
  private handleError(error: any, operation: string): never {
    const context: ErrorContext = {
      provider: 'gemini',
      operation,
      model: this.model,
      endpoint: 'https://generativelanguage.googleapis.com/v1',
      timestamp: new Date(),
    };

    const result = GeminiErrorMapper.handleGeminiError(error, context);

    // Convert standardized error to provider-specific error type
    if (result.success) {
      throw new ProviderError('Unknown error occurred');
    }

    switch (result.errorType) {
      case 'model_not_found':
        throw new ModelNotFoundError(this.model);
      case 'authentication_failed':
        throw new ProviderError(result.error, error);
      case 'connection_failed':
        throw new ConnectionError(result.error, error);
      default:
        throw new ProviderError(result.error, error);
    }
  }

  async chat(messages: Message[]): Promise<Response> {
    try {
      const { contents } = this.convertMessagesToGeminiFormat(messages);

      const config = {
        ...this.generationConfig,
        ...(this.thinkingConfig && { thinkingConfig: this.thinkingConfig }),
      };

      const response = await this.client.models.generateContent({
        model: this.model,
        contents: contents,
        config: config,
      });

      return {
        content: response.text || '',
        ...(response.usageMetadata?.totalTokenCount && {
          tokensUsed: response.usageMetadata.totalTokenCount,
        }),
      };
    } catch (error) {
      this.handleError(error, 'chat');
    }
  }

  async *stream(messages: Message[]): AsyncGenerator<StreamResponse> {
    try {
      const { contents } = this.convertMessagesToGeminiFormat(messages);

      const config = {
        ...this.generationConfig,
        ...(this.thinkingConfig && { thinkingConfig: this.thinkingConfig }),
      };

      const response = await this.client.models.generateContentStream({
        model: this.model,
        contents: contents,
        config: config,
      });

      let totalTokens = 0;
      let usageMetadata: any = null;
      for await (const chunk of response) {
        const chunkText = chunk.text;
        if (chunkText) {
          yield {
            content: chunkText,
            done: false,
          };
        }

        // Update token count if available
        if (chunk.usageMetadata?.totalTokenCount) {
          totalTokens = chunk.usageMetadata.totalTokenCount;
          usageMetadata = chunk.usageMetadata;
        }
      }

      yield {
        content: '',
        done: true,
        tokensUsed: totalTokens,
        usageMetadata: usageMetadata, // Include full usage metadata
      };
    } catch (error) {
      this.handleError(error, 'stream');
    }
  }

  countTokens(text: string): number {
    // Pre-request token estimation for planning and context management
    // Based on Gemini documentation: "A token is equivalent to about 4 characters"
    // Actual token counts are provided in API responses via usageMetadata
    return Math.ceil(text.length / 4);
  }

  getModel(): string {
    return this.model;
  }

  async getModelInfo(): Promise<ModelInfo> {
    try {
      const capabilities = CapabilityManager.getCapabilities(
        'gemini',
        this.model
      );

      return {
        name: this.model,
        contextLength: capabilities.maxTokens,
        supportedFeatures: ['chat', 'streaming', 'vision'],
        capabilities: {
          supportsVision: capabilities.supportsVision,
          supportsFunctionCalling: capabilities.supportsFunctionCalling,
          supportsThinking: capabilities.supportsThinking,
        },
      };
    } catch (error) {
      throw new ProviderError(`Failed to get model info: ${error}`);
    }
  }

  supportsStreaming(): boolean {
    return true;
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.models.generateContent({
        model: this.model,
        contents: 'Hi',
      });
      return true;
    } catch {
      return false;
    }
  }

  async listAvailableModels(): Promise<string[]> {
    // Google AI doesn't have a direct models endpoint, return known models
    return CapabilityManager.getAvailableModels('gemini');
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      await this.client.models.generateContent({
        model: this.model,
        contents: 'Hi',
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async getCapabilities(): Promise<{
    supportsVision: boolean;
    supportsFunctionCalling: boolean;
    supportsThinking: boolean;
    maxTokens: number;
  }> {
    const capabilities = CapabilityManager.getCapabilities(
      'gemini',
      this.model
    );
    return {
      supportsVision: capabilities.supportsVision,
      supportsFunctionCalling: capabilities.supportsFunctionCalling,
      supportsThinking: capabilities.supportsThinking,
      maxTokens: capabilities.maxTokens,
    };
  }

  protected override getProviderVersion(): string | undefined {
    return 'v1';
  }

  private convertMessagesToGeminiFormat(messages: Message[]): {
    contents: string;
  } {
    let systemPrompt = '';
    let conversationContent = '';

    // Process messages
    for (const msg of messages) {
      if (!msg) continue;

      if (msg.role === 'system') {
        systemPrompt += (systemPrompt ? '\n\n' : '') + msg.content;
      } else if (msg.role === 'tool') {
        // Convert tool messages to user context
        conversationContent += `\n\nTool result: ${msg.content}`;
      } else if (msg.role === 'user') {
        conversationContent += `\n\nUser: ${msg.content}`;
      } else if (msg.role === 'assistant') {
        conversationContent += `\n\nAssistant: ${msg.content}`;
      }
    }

    // Combine system prompt with conversation
    const contents = systemPrompt
      ? `${systemPrompt}${conversationContent}`
      : conversationContent.trim();

    return { contents };
  }
}
