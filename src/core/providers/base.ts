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
}

export interface ModelInfo {
  name: string;
  contextLength: number;
  supportedFeatures: string[];
}

export abstract class LLMProvider {
  protected model: string;
  protected baseUrl: string | undefined;

  constructor(model: string, baseUrl?: string) {
    this.model = model;
    this.baseUrl = baseUrl;
  }

  abstract chat(messages: Message[]): Promise<Response>;
  
  abstract stream(messages: Message[]): AsyncGenerator<StreamResponse>;
  
  abstract countTokens(text: string): number;
  
  abstract getModel(): string;
  
  abstract getModelInfo(): Promise<ModelInfo>;
  
  abstract supportsStreaming(): boolean;
  
  abstract isHealthy(): Promise<boolean>;
  
  abstract listAvailableModels(): Promise<string[]>;
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