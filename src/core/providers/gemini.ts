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
  ProviderConfig
} from './base.js';

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
      topK: 40
    };

    // Configure thinking mode for 2.5 models
    if (this.model.includes('2.5')) {
      this.thinkingConfig = {
        thinkingBudget: config.gemini?.thinkingBudget || -1, // Dynamic thinking by default
        includeThoughts: config.gemini?.includeThoughts || false
      };
    }
  }

  async chat(messages: Message[]): Promise<Response> {
    try {
      const { contents } = this.convertMessagesToGeminiFormat(messages);
      
      const config = {
        ...this.generationConfig,
        ...(this.thinkingConfig && { thinkingConfig: this.thinkingConfig })
      };
      
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: contents,
        config: config
      });
      
      return {
        content: response.text || '',
        ...(response.usageMetadata?.totalTokenCount && { 
          tokensUsed: response.usageMetadata.totalTokenCount 
        })
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('model') && error.message.includes('not found')) {
          throw new ModelNotFoundError(this.model);
        }
        if (error.message.includes('API_KEY') || error.message.includes('authentication')) {
          throw new ProviderError('Invalid Google AI API key', error);
        }
        if (error.message.includes('network') || error.message.includes('connection')) {
          throw new ConnectionError('Failed to connect to Google AI API', error);
        }
        throw new ProviderError(`Gemini chat failed: ${error.message}`, error);
      }
      throw new ProviderError('Unknown error occurred during chat');
    }
  }

  async *stream(messages: Message[]): AsyncGenerator<StreamResponse> {
    try {
      const { contents } = this.convertMessagesToGeminiFormat(messages);
      
      const config = {
        ...this.generationConfig,
        ...(this.thinkingConfig && { thinkingConfig: this.thinkingConfig })
      };
      
      const response = await this.client.models.generateContentStream({
        model: this.model,
        contents: contents,
        config: config
      });

      let totalTokens = 0;
      let usageMetadata: any = null;
      for await (const chunk of response) {
        const chunkText = chunk.text;
        if (chunkText) {
          yield {
            content: chunkText,
            done: false
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
        usageMetadata: usageMetadata // Include full usage metadata
      };

    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('model') && error.message.includes('not found')) {
          throw new ModelNotFoundError(this.model);
        }
        if (error.message.includes('API_KEY') || error.message.includes('authentication')) {
          throw new ProviderError('Invalid Google AI API key', error);
        }
        if (error.message.includes('network') || error.message.includes('connection')) {
          throw new ConnectionError('Failed to connect to Google AI API', error);
        }
        throw new ProviderError(`Gemini streaming failed: ${error.message}`, error);
      }
      throw new ProviderError('Unknown error occurred during streaming');
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
      const capabilities = this.getModelCapabilities(this.model);
      
      return {
        name: this.model,
        contextLength: capabilities.contextLength,
        supportedFeatures: ['chat', 'streaming', 'vision'],
        capabilities: {
          supportsVision: capabilities.supportsVision,
          supportsFunctionCalling: capabilities.supportsFunctionCalling,
          supportsThinking: capabilities.supportsThinking,
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
      await this.client.models.generateContent({
        model: this.model,
        contents: 'Hi'
      });
      return true;
    } catch {
      return false;
    }
  }

  async listAvailableModels(): Promise<string[]> {
    // Google AI doesn't have a direct models endpoint, return known models
    return [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite-preview-06-17',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.0-pro'
    ];
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      await this.client.models.generateContent({
        model: this.model,
        contents: 'Hi'
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
      supportsThinking: capabilities.supportsThinking,
      maxTokens: capabilities.contextLength
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

  private getModelCapabilities(model: string): {
    contextLength: number;
    supportsVision: boolean;
    supportsFunctionCalling: boolean;
    supportsThinking: boolean;
    costPerToken?: { input: number; output: number };
  } {
    // Known capabilities for Gemini models
    const capabilities: Record<string, any> = {
      'gemini-2.5-pro': {
        contextLength: 1048576,
        supportsVision: true,
        supportsFunctionCalling: true,
        supportsThinking: true,
        costPerToken: { input: 0.00125, output: 0.005 }
      },
      'gemini-2.5-flash': {
        contextLength: 1048576,
        supportsVision: true,
        supportsFunctionCalling: true,
        supportsThinking: true,
        costPerToken: { input: 0.000075, output: 0.0003 }
      },
      'gemini-2.5-flash-lite-preview-06-17': {
        contextLength: 1000000,
        supportsVision: true,
        supportsFunctionCalling: true,
        supportsThinking: true,
        costPerToken: { input: 0.0000375, output: 0.00015 }
      },
      'gemini-1.5-pro': {
        contextLength: 2097152,
        supportsVision: true,
        supportsFunctionCalling: true,
        supportsThinking: false,
        costPerToken: { input: 0.00125, output: 0.005 }
      },
      'gemini-1.5-flash': {
        contextLength: 1048576,
        supportsVision: true,
        supportsFunctionCalling: true,
        supportsThinking: false,
        costPerToken: { input: 0.000075, output: 0.0003 }
      },
      'gemini-1.0-pro': {
        contextLength: 32768,
        supportsVision: false,
        supportsFunctionCalling: true,
        supportsThinking: false,
        costPerToken: { input: 0.0005, output: 0.0015 }
      }
    };

    // Find exact match or partial match
    const exactMatch = capabilities[model];
    if (exactMatch) {
      return exactMatch;
    }

    // Fallback for unknown models
    for (const [knownModel, config] of Object.entries(capabilities)) {
      if (model.includes(knownModel.replace('gemini-', ''))) {
        return config;
      }
    }

    // Default fallback
    return {
      contextLength: this.config.maxTokens || 32768,
      supportsVision: true,
      supportsFunctionCalling: true,
      supportsThinking: model.includes('2.5')
    };
  }
}