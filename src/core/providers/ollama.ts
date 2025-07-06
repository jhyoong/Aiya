import { Ollama } from 'ollama';
import { 
  LLMProvider, 
  Message, 
  Response, 
  StreamResponse, 
  ModelInfo, 
  ConnectionError, 
  ModelNotFoundError,
  ProviderError
} from './base.js';

export class OllamaProvider extends LLMProvider {
  private client: Ollama;
  private configuredMaxTokens: number | undefined;

  constructor(model: string, baseUrl: string = 'http://localhost:11434', maxTokens?: number) {
    super(model, baseUrl);
    this.client = new Ollama({ host: baseUrl });
    this.configuredMaxTokens = maxTokens;
  }

  async chat(messages: Message[]): Promise<Response> {
    try {
      // Convert messages to Ollama format, handling tool messages
      const ollamaMessages = this.convertMessagesToOllamaFormat(messages);
      
      const response = await this.client.chat({
        model: this.model,
        messages: ollamaMessages,
        stream: false,
        ...this.buildOllamaOptions()
      });

      return {
        content: response.message.content,
        tokensUsed: response.eval_count,
        ...(response.done && { finishReason: 'stop' as const })
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('model') && error.message.includes('not found')) {
          throw new ModelNotFoundError(this.model);
        }
        if (error.message.includes('connection') || error.message.includes('ECONNREFUSED')) {
          throw new ConnectionError('Failed to connect to Ollama server', error);
        }
        throw new ProviderError(`Ollama chat failed: ${error.message}`, error);
      }
      throw new ProviderError('Unknown error occurred during chat');
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
        ...this.buildOllamaOptions()
      });

      for await (const chunk of stream) {
        yield {
          content: chunk.message.content,
          done: chunk.done,
          tokensUsed: chunk.eval_count
        };
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('model') && error.message.includes('not found')) {
          throw new ModelNotFoundError(this.model);
        }
        if (error.message.includes('connection') || error.message.includes('ECONNREFUSED')) {
          throw new ConnectionError('Failed to connect to Ollama server', error);
        }
        throw new ProviderError(`Ollama streaming failed: ${error.message}`, error);
      }
      throw new ProviderError('Unknown error occurred during streaming');
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
      
      return {
        name: this.model,
        contextLength: this.extractContextLength(modelInfo),
        supportedFeatures: ['chat', 'streaming']
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
      throw new ConnectionError('Failed to list available models', error as Error);
    }
  }

  private extractContextLength(modelInfo: any): number {
    // If max_tokens is configured, use that as override
    if (this.configuredMaxTokens !== undefined) {
      return this.configuredMaxTokens;
    }
    
    const defaultContextLength = 4096;
    
    try {
      if (modelInfo.parameters?.includes('context_length')) {
        const match = modelInfo.parameters.match(/context_length\s+(\d+)/);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
      
      if (modelInfo.model_info?.['llama.context_length']) {
        return modelInfo.model_info['llama.context_length'];
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
          num_ctx: this.configuredMaxTokens
        }
      };
    }
    return {};
  }

  /**
   * Convert our message format to Ollama format, handling tool messages
   */
  private convertMessagesToOllamaFormat(messages: Message[]): Array<{ role: string; content: string }> {
    return messages.map(msg => {
      // Handle tool messages by converting them to user messages with context
      if (msg.role === 'tool') {
        return {
          role: 'user',
          content: `Tool result: ${msg.content}`
        };
      }
      
      // For assistant messages with tool calls, include the tool call info
      if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        return {
          role: msg.role,
          content: msg.content // The content already contains the tool call JSON
        };
      }
      
      return {
        role: msg.role,
        content: msg.content
      };
    });
  }
}