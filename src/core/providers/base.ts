import {
  Message,
  ModelInfo,
  ProviderResponse,
  StreamResponse,
  ToolCall,
  ToolResult,
  BaseProviderConfig,
  ProviderConfig as TypedProviderConfig,
} from '../../types/ProviderTypes.js';

// Extended ProviderConfig for backward compatibility with existing provider implementations
export interface ProviderConfig extends BaseProviderConfig {
  // Provider-specific configurations with proper typing
  azure?: {
    deploymentName?: string;
    apiVersion?: string;
  };
  anthropic?: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
    version?: string;
  };
  gemini?: {
    projectId?: string;
    location?: string;
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    candidateCount?: number;
    stopSequences?: string[];
    maxTokens?: number;
    thinkingBudget?: number;
    includeThoughts?: boolean;
  };
  bedrock?: {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    modelId?: string;
  };
}

// Re-export types for backward compatibility
export type Response = ProviderResponse;
export {
  Message,
  ModelInfo,
  StreamResponse,
  ToolCall,
  ToolResult,
  TypedProviderConfig,
};

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
      ...(version && { version }),
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
  constructor(
    message: string,
    public override cause?: Error
  ) {
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
