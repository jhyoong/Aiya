import { Ollama } from 'ollama';
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
import { OllamaErrorMapper, ErrorContext } from '../errors/index.js';

// Ollama-specific type definitions
interface OllamaModelInfo {
  parameters?: string;
  model_info?:
    | Map<string, unknown>
    | {
        'llama.context_length'?: number;
        [key: string]: unknown;
      };
  [key: string]: unknown;
}

export class OllamaProvider extends LLMProvider {
  private client: Ollama;
  private configuredMaxTokens: number | undefined;

  constructor(config: ProviderConfig) {
    super(config);
    this.client = new Ollama({ host: config.baseUrl });
    this.configuredMaxTokens = config.maxTokens;
  }

  /**
   * Handle errors using the standardized error mapper
   */
  private handleError(error: unknown, operation: string): never {
    const context: ErrorContext = {
      provider: 'ollama',
      operation,
      model: this.model,
      endpoint: this.baseUrl,
      timestamp: new Date(),
    };

    const result = OllamaErrorMapper.handleOllamaError(error, context);

    // Convert standardized error to provider-specific error type
    if (result.success) {
      throw new ProviderError('Unknown error occurred');
    }

    switch (result.errorType) {
      case 'model_not_found':
        throw new ModelNotFoundError(this.model);
      case 'connection_failed':
        throw new ConnectionError(
          result.error,
          error instanceof Error ? error : undefined
        );
      default:
        throw new ProviderError(
          result.error,
          error instanceof Error ? error : undefined
        );
    }
  }

  async chat(messages: Message[]): Promise<Response> {
    try {
      // Convert messages to Ollama format, handling tool messages
      const ollamaMessages = this.convertMessagesToOllamaFormat(messages);

      const response = await this.client.chat({
        model: this.model,
        messages: ollamaMessages,
        stream: false,
        ...this.buildOllamaOptions(),
      });

      return {
        content: response.message.content,
        tokensUsed: response.eval_count,
        ...(response.done && { finishReason: 'stop' as const }),
      };
    } catch (error) {
      this.handleError(error, 'chat');
    }
  }

  async *stream(messages: Message[]): AsyncGenerator<StreamResponse> {
    try {
      // Convert messages to Ollama format, handling tool messages
      const ollamaMessages = this.convertMessagesToOllamaFormat(messages);

      const stream = await this.client.chat({
        model: this.model,
        messages: ollamaMessages,
        stream: true,
        ...this.buildOllamaOptions(),
      });

      for await (const chunk of stream) {
        yield {
          content: chunk.message.content,
          done: chunk.done,
          tokensUsed: chunk.eval_count,
        };
      }
    } catch (error) {
      this.handleError(error, 'stream');
    }
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  getModel(): string {
    return this.model;
  }

  async getModelInfo(): Promise<ModelInfo> {
    try {
      const modelInfo = await this.client.show({ model: this.model });
      const contextLength = this.extractContextLength(
        modelInfo as unknown as OllamaModelInfo
      );

      return {
        name: this.model,
        contextLength,
        supportedFeatures: ['chat', 'streaming'],
        capabilities: {
          supportsVision: false, // Ollama generally doesn't support vision
          supportsFunctionCalling: false, // Ollama doesn't support function calling
          supportsThinking: false, // Ollama doesn't support thinking tokens
          maxTokens: contextLength,
          supportsStreaming: true,
        },
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new ModelNotFoundError(this.model);
      }
      throw new ProviderError(`Failed to get model info: ${error}`);
    }
  }

  supportsStreaming(): boolean {
    return true;
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.list();
      return true;
    } catch {
      return false;
    }
  }

  async listAvailableModels(): Promise<string[]> {
    try {
      const response = await this.client.list();
      return response.models.map(model => model.name);
    } catch (error) {
      throw new ConnectionError(
        'Failed to list available models',
        error as Error
      );
    }
  }

  async isAuthenticated(): Promise<boolean> {
    // Ollama doesn't require authentication
    return true;
  }

  async getCapabilities(): Promise<{
    supportsVision: boolean;
    supportsFunctionCalling: boolean;
    supportsThinking: boolean;
    maxTokens: number;
  }> {
    const modelInfo = await this.client.show({ model: this.model });
    const contextLength = this.extractContextLength(
      modelInfo as unknown as OllamaModelInfo
    );

    return {
      supportsVision: false,
      supportsFunctionCalling: false,
      supportsThinking: false,
      maxTokens: contextLength,
    };
  }

  protected override getProviderVersion(): string | undefined {
    return '1.0'; // Could be enhanced to fetch actual Ollama version
  }

  private extractContextLength(modelInfo: OllamaModelInfo): number {
    // If max_tokens is configured, use that as override
    if (this.configuredMaxTokens !== undefined) {
      return this.configuredMaxTokens;
    }

    const defaultContextLength = 4096;

    try {
      if (modelInfo.parameters?.includes('context_length')) {
        const match = modelInfo.parameters.match(/context_length\s+(\d+)/);
        if (match && match[1]) {
          return parseInt(match[1], 10);
        }
      }

      if (modelInfo.model_info) {
        // Handle both Map and object types
        if (modelInfo.model_info instanceof Map) {
          const contextLength = modelInfo.model_info.get(
            'llama.context_length'
          );
          if (typeof contextLength === 'number') {
            return contextLength;
          }
        } else if (modelInfo.model_info['llama.context_length']) {
          const contextLength = modelInfo.model_info['llama.context_length'];
          if (typeof contextLength === 'number') {
            return contextLength;
          }
        }
      }

      return defaultContextLength;
    } catch {
      return defaultContextLength;
    }
  }

  /**
   * Build Ollama options including context window configuration
   */
  private buildOllamaOptions(): { options?: { num_ctx?: number } } {
    if (this.configuredMaxTokens !== undefined) {
      return {
        options: {
          num_ctx: this.configuredMaxTokens,
        },
      };
    }
    return {};
  }

  /**
   * Convert our message format to Ollama format, handling tool messages
   */
  private convertMessagesToOllamaFormat(
    messages: Message[]
  ): Array<{ role: string; content: string }> {
    return messages.map(msg => {
      // Handle tool messages by converting them to user messages with context
      if (msg.role === 'tool') {
        return {
          role: 'user',
          content: `Tool result: ${msg.content}`,
        };
      }

      // For assistant messages with tool calls, include the tool call info
      if (
        msg.role === 'assistant' &&
        msg.toolCalls &&
        msg.toolCalls.length > 0
      ) {
        return {
          role: msg.role,
          content: msg.content, // The content already contains the tool call JSON
        };
      }

      return {
        role: msg.role,
        content: msg.content,
      };
    });
  }
}
