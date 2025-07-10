import OpenAI from 'openai';
import { 
  LLMProvider, 
  Message, 
  Response, 
  StreamResponse, 
  ModelInfo, 
  ConnectionError, 
  ModelNotFoundError,
  ProviderError,
  ProviderConfig
} from './base.js';
import { CapabilityManager } from '../config/CapabilityManager.js';
import { OpenAIErrorMapper, ErrorContext } from '../errors/index.js';

export class OpenAIProvider extends LLMProvider {
  private client: OpenAI;

  constructor(config: ProviderConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new ProviderError('OpenAI API key is required');
    }
    
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl === 'https://api.openai.com/v1' ? undefined : config.baseUrl
    });
  }

  /**
   * Handle errors using the standardized error mapper
   */
  private handleError(error: any, operation: string): never {
    const context: ErrorContext = {
      provider: 'openai',
      operation,
      model: this.model,
      endpoint: this.baseUrl
    };

    const result = OpenAIErrorMapper.handleOpenAIError(error, context);
    
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
      const openaiMessages = this.convertMessagesToOpenAIFormat(messages);
      
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: openaiMessages,
        stream: false,
        ...(this.config.maxTokens && { max_tokens: this.config.maxTokens })
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new ProviderError('No response from OpenAI');
      }

      const result: Response = {
        content: choice.message?.content || ''
      };
      
      if (response.usage?.total_tokens) {
        result.tokensUsed = response.usage.total_tokens;
      }
      
      const finishReason = this.mapFinishReason(choice.finish_reason);
      if (finishReason) {
        result.finishReason = finishReason;
      }
      
      return result;
    } catch (error) {
      this.handleError(error, 'chat');
    }
  }

  async *stream(messages: Message[]): AsyncGenerator<StreamResponse> {
    try {
      const openaiMessages = this.convertMessagesToOpenAIFormat(messages);
      
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: openaiMessages,
        stream: true,
        ...(this.config.maxTokens && { max_tokens: this.config.maxTokens })
      });

      let totalTokens = 0;
      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (choice?.delta?.content) {
          yield {
            content: choice.delta.content,
            done: false
          };
        }
        
        if (choice?.finish_reason) {
          // Try to get token usage from the final chunk
          if (chunk.usage) {
            totalTokens = chunk.usage.total_tokens;
          }
          
          yield {
            content: '',
            done: true,
            tokensUsed: totalTokens,
            usage: chunk.usage // Include full usage metadata
          };
          break;
        }
      }
    } catch (error) {
      this.handleError(error, 'stream');
    }
  }

  countTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for GPT models
    // This could be enhanced with tiktoken library for accurate counting
    return Math.ceil(text.length / 4);
  }

  getModel(): string {
    return this.model;
  }

  async getModelInfo(): Promise<ModelInfo> {
    try {
      // Get model information using centralized capabilities
      const capabilities = CapabilityManager.getCapabilities('openai', this.model);
      
      return {
        name: this.model,
        contextLength: capabilities.maxTokens,
        supportedFeatures: ['chat', 'streaming', 'function-calling'],
        capabilities: {
          supportsVision: capabilities.supportsVision,
          supportsFunctionCalling: capabilities.supportsFunctionCalling,
          supportsThinking: capabilities.supportsThinking
        }
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
      // Simple health check by listing models
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  async listAvailableModels(): Promise<string[]> {
    try {
      const response = await this.client.models.list();
      return response.data
        .filter(model => model.id.includes('gpt')) // Filter to GPT models
        .map(model => model.id)
        .sort();
    } catch (error) {
      throw new ConnectionError('Failed to list available models', error as Error);
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      await this.client.models.list();
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
    const capabilities = CapabilityManager.getCapabilities('openai', this.model);
    return {
      supportsVision: capabilities.supportsVision,
      supportsFunctionCalling: capabilities.supportsFunctionCalling,
      supportsThinking: capabilities.supportsThinking,
      maxTokens: capabilities.maxTokens
    };
  }

  protected override getProviderVersion(): string | undefined {
    return 'v1'; // OpenAI API version
  }

  private convertMessagesToOpenAIFormat(messages: Message[]): Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> {
    return messages.map(msg => {
      switch (msg.role) {
        case 'system':
          return { role: 'system', content: msg.content };
        case 'user':
          return { role: 'user', content: msg.content };
        case 'assistant':
          return { role: 'assistant', content: msg.content };
        case 'tool':
          // Convert tool messages to user messages with context
          return { role: 'user', content: `Tool result: ${msg.content}` };
        default:
          return { role: 'user', content: msg.content };
      }
    });
  }

  private mapFinishReason(reason: string | null): 'stop' | 'length' | 'tool_calls' | undefined {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'function_call':
      case 'tool_calls':
        return 'tool_calls';
      default:
        return undefined;
    }
  }

}