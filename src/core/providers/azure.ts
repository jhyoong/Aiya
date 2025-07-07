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

export class AzureOpenAIProvider extends LLMProvider {
  private client: OpenAI;
  private deploymentName: string;
  private apiVersion: string;

  constructor(config: ProviderConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new ProviderError('Azure OpenAI API key is required');
    }
    
    if (!config.azure?.deploymentName) {
      throw new ProviderError('Azure deployment name is required');
    }
    
    this.deploymentName = config.azure.deploymentName;
    this.apiVersion = config.azure.apiVersion || '2024-02-15-preview';
    
    // Azure OpenAI uses a specific URL format
    const azureUrl = `${config.baseUrl}/openai/deployments/${this.deploymentName}`;
    
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: azureUrl,
      defaultQuery: { 'api-version': this.apiVersion },
      defaultHeaders: {
        'api-key': config.apiKey
      }
    });
  }

  async chat(messages: Message[]): Promise<Response> {
    try {
      const openaiMessages = this.convertMessagesToOpenAIFormat(messages);
      
      const response = await this.client.chat.completions.create({
        model: this.model, // This is actually the deployment name for Azure
        messages: openaiMessages,
        stream: false,
        ...(this.config.maxTokens && { max_tokens: this.config.maxTokens })
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new ProviderError('No response from Azure OpenAI');
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
        if (error.message.includes('deployment') && error.message.includes('not found')) {
          throw new ModelNotFoundError(this.deploymentName);
        }
        if (error.message.includes('api-key') || error.message.includes('authentication')) {
          throw new ProviderError('Invalid Azure OpenAI API key', error);
        }
        if (error.message.includes('network') || error.message.includes('connection')) {
          throw new ConnectionError('Failed to connect to Azure OpenAI API', error);
        }
        throw new ProviderError(`Azure OpenAI chat failed: ${error.message}`, error);
      }
      throw new ProviderError('Unknown error occurred during chat');
    }
  }

  async *stream(messages: Message[]): AsyncGenerator<StreamResponse> {
    try {
      const openaiMessages = this.convertMessagesToOpenAIFormat(messages);
      
      const stream = await this.client.chat.completions.create({
        model: this.model, // This is actually the deployment name for Azure
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
        if (error.message.includes('deployment') && error.message.includes('not found')) {
          throw new ModelNotFoundError(this.deploymentName);
        }
        if (error.message.includes('api-key') || error.message.includes('authentication')) {
          throw new ProviderError('Invalid Azure OpenAI API key', error);
        }
        if (error.message.includes('network') || error.message.includes('connection')) {
          throw new ConnectionError('Failed to connect to Azure OpenAI API', error);
        }
        throw new ProviderError(`Azure OpenAI streaming failed: ${error.message}`, error);
      }
      throw new ProviderError('Unknown error occurred during streaming');
    }
  }

  countTokens(text: string): number {
    // Same approximation as OpenAI: 1 token ≈ 4 characters for GPT models
    return Math.ceil(text.length / 4);
  }

  getModel(): string {
    return this.deploymentName;
  }

  async getModelInfo(): Promise<ModelInfo> {
    try {
      // Azure doesn't expose model info directly, so we need to infer from deployment name
      const baseModel = this.inferBaseModel(this.deploymentName);
      const capabilities = this.getModelCapabilities(baseModel);
      
      return {
        name: this.deploymentName,
        contextLength: capabilities.contextLength,
        supportedFeatures: ['chat', 'streaming', 'function-calling'],
        capabilities: {
          supportsVision: capabilities.supportsVision,
          supportsFunctionCalling: capabilities.supportsFunctionCalling,
          supportsThinking: false, // Azure OpenAI doesn't have thinking tags
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
      await this.client.chat.completions.create({
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
    // Azure doesn't have a models endpoint, return the current deployment
    return [this.deploymentName];
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
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
    const baseModel = this.inferBaseModel(this.deploymentName);
    const capabilities = this.getModelCapabilities(baseModel);
    return {
      supportsVision: capabilities.supportsVision,
      supportsFunctionCalling: capabilities.supportsFunctionCalling,
      supportsThinking: false,
      maxTokens: capabilities.contextLength
    };
  }

  protected override getProviderVersion(): string | undefined {
    return this.apiVersion;
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

  private inferBaseModel(deploymentName: string): string {
    // Try to infer the base model from deployment name
    const name = deploymentName.toLowerCase();
    
    if (name.includes('gpt-4o')) {
      return 'gpt-4o';
    } else if (name.includes('gpt-4-turbo')) {
      return 'gpt-4-turbo';
    } else if (name.includes('gpt-4')) {
      return 'gpt-4';
    } else if (name.includes('gpt-35-turbo') || name.includes('gpt-3.5-turbo')) {
      return 'gpt-3.5-turbo';
    }
    
    // Default fallback
    return 'gpt-3.5-turbo';
  }

  private getModelCapabilities(baseModel: string): {
    contextLength: number;
    supportsVision: boolean;
    supportsFunctionCalling: boolean;
    costPerToken?: { input: number; output: number };
  } {
    // Use the same capabilities as OpenAI models since Azure hosts the same models
    const capabilities: Record<string, any> = {
      'gpt-4o': {
        contextLength: 128000,
        supportsVision: true,
        supportsFunctionCalling: true
      },
      'gpt-4o-mini': {
        contextLength: 128000,
        supportsVision: true,
        supportsFunctionCalling: true
      },
      'gpt-4-turbo': {
        contextLength: 128000,
        supportsVision: true,
        supportsFunctionCalling: true
      },
      'gpt-4': {
        contextLength: 8192,
        supportsVision: false,
        supportsFunctionCalling: true
      },
      'gpt-3.5-turbo': {
        contextLength: 16385,
        supportsVision: false,
        supportsFunctionCalling: true
      }
    };

    const exactMatch = capabilities[baseModel];
    if (exactMatch) {
      return exactMatch;
    }

    // Fallback for unknown models
    for (const [knownModel, config] of Object.entries(capabilities)) {
      if (baseModel.includes(knownModel)) {
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