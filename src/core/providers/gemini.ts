import { GoogleGenerativeAI, GenerationConfig, Part } from '@google/generative-ai';
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

export class GeminiProvider extends LLMProvider {
  private client: GoogleGenerativeAI;
  private generationConfig: GenerationConfig;

  constructor(config: ProviderConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new ProviderError('Google AI API key is required');
    }
    
    this.client = new GoogleGenerativeAI(config.apiKey);
    
    this.generationConfig = {
      maxOutputTokens: config.maxTokens || config.gemini?.maxTokens || 8192,
      temperature: 0.7,
      topP: 0.8,
      topK: 40
    };
  }

  async chat(messages: Message[]): Promise<Response> {
    try {
      const model = this.client.getGenerativeModel({ 
        model: this.model,
        generationConfig: this.generationConfig
      });
      
      const { history, prompt } = this.convertMessagesToGeminiFormat(messages);
      
      let chatSession;
      if (history.length > 0) {
        chatSession = model.startChat({ history });
        const result = await chatSession.sendMessage(prompt);
        const response = result.response;
        
        return {
          content: response.text(),
          ...(response.usageMetadata?.totalTokenCount && { 
            tokensUsed: response.usageMetadata.totalTokenCount 
          })
        };
      } else {
        const result = await model.generateContent(prompt);
        const response = result.response;
        
        return {
          content: response.text(),
          ...(response.usageMetadata?.totalTokenCount && { 
            tokensUsed: response.usageMetadata.totalTokenCount 
          })
        };
      }
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
      const model = this.client.getGenerativeModel({ 
        model: this.model,
        generationConfig: this.generationConfig
      });
      
      const { history, prompt } = this.convertMessagesToGeminiFormat(messages);
      
      let stream;
      if (history.length > 0) {
        const chatSession = model.startChat({ history });
        const result = await chatSession.sendMessageStream(prompt);
        stream = result.stream;
      } else {
        const result = await model.generateContentStream(prompt);
        stream = result.stream;
      }

      let totalTokens = 0;
      for await (const chunk of stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          yield {
            content: chunkText,
            done: false
          };
        }
        
        // Update token count if available
        if (chunk.usageMetadata?.totalTokenCount) {
          totalTokens = chunk.usageMetadata.totalTokenCount;
        }
      }

      yield {
        content: '',
        done: true,
        tokensUsed: totalTokens
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
    // Rough approximation for Gemini models
    // Gemini uses a different tokenizer, this is an estimate
    return Math.ceil(text.length / 3.8);
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
          supportsThinking: false, // Gemini doesn't have thinking tags
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
      const model = this.client.getGenerativeModel({ model: this.model });
      await model.generateContent('Hi');
      return true;
    } catch {
      return false;
    }
  }

  async listAvailableModels(): Promise<string[]> {
    // Google AI doesn't have a direct models endpoint, return known models
    return [
      'gemini-2.0-flash-exp',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.0-pro'
    ];
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: this.model });
      await model.generateContent('Hi');
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
    return 'v1';
  }

  private convertMessagesToGeminiFormat(messages: Message[]): {
    history: Array<{ role: 'user' | 'model'; parts: Part[] }>;
    prompt: string;
  } {
    const history: Array<{ role: 'user' | 'model'; parts: Part[] }> = [];
    let systemPrompt = '';
    let lastMessage = '';

    // Process messages
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg) continue;
      
      if (msg.role === 'system') {
        systemPrompt += (systemPrompt ? '\n\n' : '') + msg.content;
      } else if (msg.role === 'tool') {
        // Convert tool messages to user messages
        history.push({
          role: 'user',
          parts: [{ text: `Tool result: ${msg.content}` }]
        });
      } else if (msg.role === 'user') {
        if (i === messages.length - 1) {
          // This is the last message, use it as prompt
          lastMessage = msg.content;
        } else {
          history.push({
            role: 'user',
            parts: [{ text: msg.content }]
          });
        }
      } else if (msg.role === 'assistant') {
        history.push({
          role: 'model',
          parts: [{ text: msg.content }]
        });
      }
    }

    // Combine system prompt with the last user message
    const prompt = systemPrompt 
      ? `${systemPrompt}\n\nUser: ${lastMessage}`
      : lastMessage;

    return { history, prompt };
  }

  private getModelCapabilities(model: string): {
    contextLength: number;
    supportsVision: boolean;
    supportsFunctionCalling: boolean;
    costPerToken?: { input: number; output: number };
  } {
    // Known capabilities for Gemini models
    const capabilities: Record<string, any> = {
      'gemini-2.0-flash-exp': {
        contextLength: 1000000,
        supportsVision: true,
        supportsFunctionCalling: true,
        costPerToken: { input: 0.000015, output: 0.00006 }
      },
      'gemini-1.5-pro': {
        contextLength: 2097152,
        supportsVision: true,
        supportsFunctionCalling: true,
        costPerToken: { input: 0.00125, output: 0.005 }
      },
      'gemini-1.5-flash': {
        contextLength: 1048576,
        supportsVision: true,
        supportsFunctionCalling: true,
        costPerToken: { input: 0.000075, output: 0.0003 }
      },
      'gemini-1.0-pro': {
        contextLength: 32768,
        supportsVision: false,
        supportsFunctionCalling: true,
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
      supportsFunctionCalling: true
    };
  }
}