export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  result: string;
  isError?: boolean;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string; // For tool result messages
}

export interface Response {
  content: string;
  tokensUsed?: number;
  finishReason?: 'stop' | 'length' | 'tool_calls';
  toolCalls?: ToolCall[];
}

export interface StreamResponse {
  content: string;
  done: boolean;
  tokensUsed?: number;
  toolCalls?: ToolCall[];
  usage?: any; // OpenAI usage metadata
  usageMetadata?: any; // Gemini usage metadata
}

export interface ModelInfo {
  name: string;
  contextLength: number;
  supportedFeatures: string[];
  capabilities?: {
    supportsVision: boolean;
    supportsFunctionCalling: boolean;
    supportsThinking: boolean;
    costPerToken?: { input: number; output: number };
  };
}

export interface ProviderConfig {
  type: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  maxTokens?: number;
  [key: string]: any; // Allow provider-specific config
}

export abstract class LLMProvider {
  protected config: ProviderConfig;
  protected model: string;
  protected baseUrl: string;
  protected apiKey: string | undefined;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.model = config.model;
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
  }

  abstract chat(messages: Message[]): Promise<Response>;
  
  abstract stream(messages: Message[]): AsyncGenerator<StreamResponse>;
  
  abstract countTokens(text: string): number;
  
  abstract getModel(): string;
  
  abstract getModelInfo(): Promise<ModelInfo>;
  
  abstract supportsStreaming(): boolean;
  
  abstract isHealthy(): Promise<boolean>;
  
  abstract listAvailableModels(): Promise<string[]>;
  
  /**
   * Check if the provider is properly authenticated
   */
  abstract isAuthenticated(): Promise<boolean>;
  
  /**
   * Get provider-specific capabilities
   */
  abstract getCapabilities(): Promise<{
    supportsVision: boolean;
    supportsFunctionCalling: boolean;
    supportsThinking: boolean;
    maxTokens: number;
  }>;
  
  /**
   * Get provider metadata
   */
  getProviderInfo(): { type: string; name: string; version?: string } {
    const version = this.getProviderVersion();
    return {
      type: this.config.type,
      name: this.config.type,
      ...(version && { version })
    };
  }
  
  /**
   * Get provider version (can be overridden)
   */
  protected getProviderVersion(): string | undefined {
    return undefined;
  }
  
  /**
   * Validate API key format (can be overridden)
   */
  protected validateApiKey(apiKey?: string): boolean {
    return apiKey !== undefined && apiKey.length > 0;
  }
}

export class ProviderError extends Error {
  constructor(message: string, public override cause?: Error) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class ModelNotFoundError extends ProviderError {
  constructor(model: string) {
    super(`Model '${model}' not found or not available`);
    this.name = 'ModelNotFoundError';
  }
}

export class ConnectionError extends ProviderError {
  constructor(message: string, cause?: Error) {
    super(`Connection error: ${message}`);
    this.name = 'ConnectionError';
    this.cause = cause;
  }
}