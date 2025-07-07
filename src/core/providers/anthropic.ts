import Anthropic from '@anthropic-ai/sdk';
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

export class AnthropicProvider extends LLMProvider {
  private client: Anthropic;

  constructor(config: ProviderConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new ProviderError('Anthropic API key is required');
    }
    
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl === 'https://api.anthropic.com' ? undefined : config.baseUrl
    });
  }

  async chat(messages: Message[]): Promise<Response> {
    try {
      const { system, messages: anthropicMessages } = this.convertMessagesToAnthropicFormat(messages);
      
      const requestOptions: Anthropic.Messages.MessageCreateParams = {
        model: this.model,
        messages: anthropicMessages,
        max_tokens: this.config.maxTokens || this.config.anthropic?.maxTokens || 4096,
        ...(system && { system })
      };

      const response = await this.client.messages.create(requestOptions);

      const textContent = response.content
        .filter((content): content is Anthropic.TextBlock => content.type === 'text')
        .map(content => content.text)
        .join('');

      const result: Response = {
        content: textContent
      };

      if (response.usage.output_tokens || response.usage.input_tokens) {
        result.tokensUsed = (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0);
      }

      if (response.stop_reason) {
        const finishReason = this.mapStopReason(response.stop_reason);
        if (finishReason) {
          result.finishReason = finishReason;
        }
      }

      return result;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('model') && error.message.includes('not found')) {
          throw new ModelNotFoundError(this.model);
        }
        if (error.message.includes('authentication') || error.message.includes('api_key')) {
          throw new ProviderError('Invalid Anthropic API key', error);
        }
        if (error.message.includes('network') || error.message.includes('connection')) {
          throw new ConnectionError('Failed to connect to Anthropic API', error);
        }
        throw new ProviderError(`Anthropic chat failed: ${error.message}`, error);
      }
      throw new ProviderError('Unknown error occurred during chat');
    }
  }

  async *stream(messages: Message[]): AsyncGenerator<StreamResponse> {
    try {
      const { system, messages: anthropicMessages } = this.convertMessagesToAnthropicFormat(messages);
      
      const requestOptions: Anthropic.Messages.MessageCreateParams = {
        model: this.model,
        messages: anthropicMessages,
        max_tokens: this.config.maxTokens || this.config.anthropic?.maxTokens || 4096,
        stream: true,
        ...(system && { system })
      };

      const stream = this.client.messages.stream(requestOptions);

      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      for await (const chunk of stream) {
        switch (chunk.type) {
          case 'content_block_delta':
            if (chunk.delta.type === 'text_delta') {
              yield {
                content: chunk.delta.text,
                done: false
              };
            }
            break;

          case 'message_start':
            if (chunk.message.usage) {
              totalInputTokens = chunk.message.usage.input_tokens || 0;
            }
            break;

          case 'message_delta':
            if (chunk.usage) {
              totalOutputTokens = chunk.usage.output_tokens || 0;
            }
            break;

          case 'message_stop':
            yield {
              content: '',
              done: true,
              tokensUsed: totalInputTokens + totalOutputTokens
            };
            return;
        }
      }

      // Fallback if no message_stop event
      yield {
        content: '',
        done: true,
        tokensUsed: totalInputTokens + totalOutputTokens
      };

    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('model') && error.message.includes('not found')) {
          throw new ModelNotFoundError(this.model);
        }
        if (error.message.includes('authentication') || error.message.includes('api_key')) {
          throw new ProviderError('Invalid Anthropic API key', error);
        }
        if (error.message.includes('network') || error.message.includes('connection')) {
          throw new ConnectionError('Failed to connect to Anthropic API', error);
        }
        throw new ProviderError(`Anthropic streaming failed: ${error.message}`, error);
      }
      throw new ProviderError('Unknown error occurred during streaming');
    }
  }

  countTokens(text: string): number {
    // Rough approximation for Claude models
    // Claude uses a different tokenizer but this is a reasonable estimate
    return Math.ceil(text.length / 3.5);
  }

  getModel(): string {
    return this.model;
  }

  async getModelInfo(): Promise<ModelInfo> {
    try {
      const capabilities = this.getModelCapabilities(this.model);
      
      return {
        name: this.model,
        contextLength: capabilities.contextLength,
        supportedFeatures: ['chat', 'streaming', 'thinking', 'function-calling'],
        capabilities: {
          supportsVision: capabilities.supportsVision,
          supportsFunctionCalling: capabilities.supportsFunctionCalling,
          supportsThinking: true, // Claude supports thinking tags
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
      // Simple health check by making a minimal request
      await this.client.messages.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1
      });
      return true;
    } catch {
      return false;
    }
  }

  async listAvailableModels(): Promise<string[]> {
    // Anthropic doesn't have a models endpoint, so return known models
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ];
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1
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
    const capabilities = this.getModelCapabilities(this.model);
    return {
      supportsVision: capabilities.supportsVision,
      supportsFunctionCalling: capabilities.supportsFunctionCalling,
      supportsThinking: true, // Claude supports thinking
      maxTokens: capabilities.contextLength
    };
  }

  protected override getProviderVersion(): string | undefined {
    return this.config.anthropic?.version || '2023-06-01';
  }

  private convertMessagesToAnthropicFormat(messages: Message[]): {
    system?: string;
    messages: Anthropic.Messages.MessageParam[];
  } {
    const systemMessages: string[] = [];
    const conversationMessages: Anthropic.Messages.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessages.push(msg.content);
      } else if (msg.role === 'tool') {
        // Convert tool messages to user messages with context
        conversationMessages.push({
          role: 'user',
          content: `Tool result: ${msg.content}`
        });
      } else {
        conversationMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        });
      }
    }

    const result: { system?: string; messages: Anthropic.Messages.MessageParam[] } = {
      messages: conversationMessages
    };

    if (systemMessages.length > 0) {
      result.system = systemMessages.join('\n\n');
    }

    return result;
  }

  private mapStopReason(reason: string): 'stop' | 'length' | 'tool_calls' | undefined {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
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
    // Known capabilities for Claude models
    const capabilities: Record<string, any> = {
      'claude-3-5-sonnet': {
        contextLength: 200000,
        supportsVision: true,
        supportsFunctionCalling: true,
        costPerToken: { input: 0.003, output: 0.015 }
      },
      'claude-3-5-haiku': {
        contextLength: 200000,
        supportsVision: true,
        supportsFunctionCalling: true,
        costPerToken: { input: 0.00025, output: 0.00125 }
      },
      'claude-3-opus': {
        contextLength: 200000,
        supportsVision: true,
        supportsFunctionCalling: true,
        costPerToken: { input: 0.015, output: 0.075 }
      },
      'claude-3-sonnet': {
        contextLength: 200000,
        supportsVision: true,
        supportsFunctionCalling: true,
        costPerToken: { input: 0.003, output: 0.015 }
      },
      'claude-3-haiku': {
        contextLength: 200000,
        supportsVision: true,
        supportsFunctionCalling: true,
        costPerToken: { input: 0.00025, output: 0.00125 }
      }
    };

    // Find best match
    for (const [knownModel, config] of Object.entries(capabilities)) {
      if (model.includes(knownModel)) {
        return config;
      }
    }

    // Default fallback
    return {
      contextLength: this.config.maxTokens || this.config.anthropic?.maxTokens || 200000,
      supportsVision: true,
      supportsFunctionCalling: true
    };
  }
}