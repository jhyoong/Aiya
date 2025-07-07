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
      if (error instanceof Error) {
        if (error.message.includes('model') && error.message.includes('does not exist')) {
          throw new ModelNotFoundError(this.model);
        }
        if (error.message.includes('API key')) {
          throw new ProviderError('Invalid OpenAI API key', error);
        }
        if (error.message.includes('network') || error.message.includes('connection')) {
          throw new ConnectionError('Failed to connect to OpenAI API', error);
        }
        throw new ProviderError(`OpenAI chat failed: ${error.message}`, error);
      }
      throw new ProviderError('Unknown error occurred during chat');
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
            tokensUsed: totalTokens
          };
          break;
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('model') && error.message.includes('does not exist')) {
          throw new ModelNotFoundError(this.model);
        }
        if (error.message.includes('API key')) {
          throw new ProviderError('Invalid OpenAI API key', error);
        }
        if (error.message.includes('network') || error.message.includes('connection')) {
          throw new ConnectionError('Failed to connect to OpenAI API', error);
        }
        throw new ProviderError(`OpenAI streaming failed: ${error.message}`, error);
      }
      throw new ProviderError('Unknown error occurred during streaming');
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
      // Get model information - OpenAI doesn't have a direct API for this
      // so we'll use known model capabilities
      const capabilities = this.getModelCapabilities(this.model);
      
      return {
        name: this.model,
        contextLength: capabilities.contextLength,
        supportedFeatures: ['chat', 'streaming', 'function-calling'],
        capabilities: {
          supportsVision: capabilities.supportsVision,
          supportsFunctionCalling: capabilities.supportsFunctionCalling,
          supportsThinking: false, // OpenAI doesn't have thinking tags like Claude
          ...(capabilities.costPerToken && { costPerToken: capabilities.costPerToken })
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
    const capabilities = this.getModelCapabilities(this.model);
    return {
      supportsVision: capabilities.supportsVision,
      supportsFunctionCalling: capabilities.supportsFunctionCalling,
      supportsThinking: false,
      maxTokens: capabilities.contextLength
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

  private getModelCapabilities(model: string): {
    contextLength: number;
    supportsVision: boolean;
    supportsFunctionCalling: boolean;
    costPerToken?: { input: number; output: number };
  } {
    // Known capabilities for popular OpenAI models
    const capabilities: Record<string, any> = {
      'gpt-4o': {
        contextLength: 128000,
        supportsVision: true,
        supportsFunctionCalling: true,
        costPerToken: { input: 0.0025, output: 0.01 }
      },
      'gpt-4o-mini': {
        contextLength: 128000,
        supportsVision: true,
        supportsFunctionCalling: true,
        costPerToken: { input: 0.00015, output: 0.0006 }
      },
      'gpt-4-turbo': {
        contextLength: 128000,
        supportsVision: true,
        supportsFunctionCalling: true,
        costPerToken: { input: 0.01, output: 0.03 }
      },
      'gpt-4': {
        contextLength: 8192,
        supportsVision: false,
        supportsFunctionCalling: true,
        costPerToken: { input: 0.03, output: 0.06 }
      },
      'gpt-3.5-turbo': {
        contextLength: 16385,
        supportsVision: false,
        supportsFunctionCalling: true,
        costPerToken: { input: 0.0015, output: 0.002 }
      }
    };

    // Find exact match or partial match
    const exactMatch = capabilities[model];
    if (exactMatch) {
      return exactMatch;
    }

    // Fallback for unknown models
    for (const [knownModel, config] of Object.entries(capabilities)) {
      if (model.includes(knownModel)) {
        return config;
      }
    }

    // Default fallback
    return {
      contextLength: this.config.maxTokens || 4096,
      supportsVision: false,
      supportsFunctionCalling: true
    };
  }
}