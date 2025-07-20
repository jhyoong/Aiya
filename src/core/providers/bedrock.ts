/** This has not yet been fully tested. */
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import {
  LLMProvider,
  Message,
  Response,
  StreamResponse,
  ModelInfo,
  ConnectionError,
  ModelNotFoundError,
  ProviderError,
  ProviderConfig,
} from './base.js';

export class BedrockProvider extends LLMProvider {
  private client: BedrockRuntimeClient;
  private region: string;
  private modelId: string;

  constructor(config: ProviderConfig) {
    super(config);

    this.region = config.bedrock?.region || 'us-east-1';
    this.modelId = config.model;

    // Initialize AWS Bedrock client
    this.client = new BedrockRuntimeClient({
      region: this.region,
      ...(config.bedrock?.accessKeyId &&
        config.bedrock?.secretAccessKey && {
          credentials: {
            accessKeyId: config.bedrock.accessKeyId,
            secretAccessKey: config.bedrock.secretAccessKey,
            ...(config.bedrock.sessionToken && {
              sessionToken: config.bedrock.sessionToken,
            }),
          },
        }),
    });
  }

  async chat(messages: Message[]): Promise<Response> {
    try {
      const requestBody = this.formatRequestBody(messages);

      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
      });

      const response = await this.client.send(command);

      if (!response.body) {
        throw new ProviderError('Empty response body from Bedrock');
      }

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      return this.parseResponse(responseBody);
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes('UnknownOperationException') ||
          error.message.includes('ValidationException')
        ) {
          throw new ModelNotFoundError(this.modelId);
        }
        if (
          error.message.includes('AccessDeniedException') ||
          error.message.includes('UnauthorizedOperation')
        ) {
          throw new ProviderError(
            'AWS authentication failed or insufficient permissions',
            error
          );
        }
        if (
          error.message.includes('network') ||
          error.message.includes('connection')
        ) {
          throw new ConnectionError('Failed to connect to AWS Bedrock', error);
        }
        throw new ProviderError(`Bedrock chat failed: ${error.message}`, error);
      }
      throw new ProviderError('Unknown error occurred during chat');
    }
  }

  async *stream(messages: Message[]): AsyncGenerator<StreamResponse> {
    try {
      const requestBody = this.formatRequestBody(messages);

      const command = new InvokeModelWithResponseStreamCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
      });

      const response = await this.client.send(command);

      if (!response.body) {
        throw new ProviderError('Empty response body from Bedrock streaming');
      }

      const totalTokens = 0;

      for await (const chunk of response.body) {
        if (chunk.chunk?.bytes) {
          const chunkData = JSON.parse(
            new TextDecoder().decode(chunk.chunk.bytes)
          );

          if (this.isClaudeModel()) {
            // Handle Claude streaming response
            if (chunkData.completion) {
              yield {
                content: chunkData.completion,
                done: false,
              };
            }

            if (chunkData.stop_reason) {
              yield {
                content: '',
                done: true,
                tokensUsed: totalTokens,
              };
              return;
            }
          } else {
            // Handle other model types (Titan, etc.)
            if (chunkData.outputText) {
              yield {
                content: chunkData.outputText,
                done: false,
              };
            }

            if (chunkData.completionReason) {
              yield {
                content: '',
                done: true,
                tokensUsed: totalTokens,
              };
              return;
            }
          }
        }
      }

      // Fallback completion
      yield {
        content: '',
        done: true,
        tokensUsed: totalTokens,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes('UnknownOperationException') ||
          error.message.includes('ValidationException')
        ) {
          throw new ModelNotFoundError(this.modelId);
        }
        if (
          error.message.includes('AccessDeniedException') ||
          error.message.includes('UnauthorizedOperation')
        ) {
          throw new ProviderError(
            'AWS authentication failed or insufficient permissions',
            error
          );
        }
        if (
          error.message.includes('network') ||
          error.message.includes('connection')
        ) {
          throw new ConnectionError('Failed to connect to AWS Bedrock', error);
        }
        throw new ProviderError(
          `Bedrock streaming failed: ${error.message}`,
          error
        );
      }
      throw new ProviderError('Unknown error occurred during streaming');
    }
  }

  countTokens(text: string): number {
    if (this.isClaudeModel()) {
      // Claude tokenization estimate
      return Math.ceil(text.length / 3.5);
    } else if (this.isTitanModel()) {
      // Titan tokenization estimate
      return Math.ceil(text.length / 4);
    } else {
      // Generic estimate
      return Math.ceil(text.length / 4);
    }
  }

  getModel(): string {
    return this.modelId;
  }

  async getModelInfo(): Promise<ModelInfo> {
    try {
      const capabilities = this.getModelCapabilities();

      return {
        name: this.modelId,
        contextLength: capabilities.contextLength,
        supportedFeatures: capabilities.supportedFeatures,
        capabilities: {
          supportsVision: capabilities.supportsVision,
          supportsFunctionCalling: capabilities.supportsFunctionCalling,
          supportsThinking: capabilities.supportsThinking,
          maxTokens: capabilities.contextLength,
          supportsStreaming: true,
          ...(capabilities.costPerToken && {
            costPerToken: capabilities.costPerToken,
          }),
        },
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
      const testMessage = [{ role: 'user' as const, content: 'Hi' }];
      const requestBody = this.formatRequestBody(testMessage);

      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
      });

      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async listAvailableModels(): Promise<string[]> {
    // AWS Bedrock models (major ones)
    return [
      // Claude models
      'anthropic.claude-3-5-sonnet-20241022-v2:0',
      'anthropic.claude-3-5-sonnet-20240620-v1:0',
      'anthropic.claude-3-5-haiku-20241022-v1:0',
      'anthropic.claude-3-opus-20240229-v1:0',
      'anthropic.claude-3-sonnet-20240229-v1:0',
      'anthropic.claude-3-haiku-20240307-v1:0',
      'anthropic.claude-v2:1',
      'anthropic.claude-v2',
      // Titan models
      'amazon.titan-text-express-v1',
      'amazon.titan-text-lite-v1',
      'amazon.titan-text-premier-v1:0',
      // Cohere models
      'cohere.command-text-v14',
      'cohere.command-light-text-v14',
      // AI21 models
      'ai21.jamba-1-5-large-v1:0',
      'ai21.jamba-1-5-mini-v1:0',
      'ai21.jamba-instruct-v1:0',
    ];
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const testMessage = [{ role: 'user' as const, content: 'Hi' }];
      const requestBody = this.formatRequestBody(testMessage);

      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
      });

      await this.client.send(command);
      return true;
    } catch (_error) {
      return false;
    }
  }

  async getCapabilities(): Promise<{
    supportsVision: boolean;
    supportsFunctionCalling: boolean;
    supportsThinking: boolean;
    maxTokens: number;
  }> {
    const capabilities = this.getModelCapabilities();
    return {
      supportsVision: capabilities.supportsVision,
      supportsFunctionCalling: capabilities.supportsFunctionCalling,
      supportsThinking: capabilities.supportsThinking,
      maxTokens: capabilities.contextLength,
    };
  }

  private formatRequestBody(messages: Message[]): any {
    if (this.isClaudeModel()) {
      return this.formatClaudeRequest(messages);
    } else if (this.isTitanModel()) {
      return this.formatTitanRequest(messages);
    } else {
      // Default format for other models
      return this.formatGenericRequest(messages);
    }
  }

  private formatClaudeRequest(messages: Message[]): any {
    // Convert messages to Claude's expected format
    const systemMessages: string[] = [];
    const conversationMessages: string[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessages.push(msg.content);
      } else if (msg.role === 'user') {
        conversationMessages.push(`Human: ${msg.content}`);
      } else if (msg.role === 'assistant') {
        conversationMessages.push(`Assistant: ${msg.content}`);
      }
    }

    // Add system messages as context
    const systemContext =
      systemMessages.length > 0 ? systemMessages.join('\n\n') + '\n\n' : '';
    const prompt =
      systemContext + conversationMessages.join('\n\n') + '\n\nAssistant:';

    return {
      prompt,
      max_tokens_to_sample: this.config.maxTokens || 4096,
      temperature: 0.7,
      top_p: 0.9,
      stop_sequences: ['Human:', 'Assistant:'],
    };
  }

  private formatTitanRequest(messages: Message[]): any {
    // Combine all messages into a single input text
    const inputText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    return {
      inputText,
      textGenerationConfig: {
        maxTokenCount: this.config.maxTokens || 4096,
        temperature: 0.7,
        topP: 0.9,
        stopSequences: ['user:', 'assistant:'],
      },
    };
  }

  private formatGenericRequest(messages: Message[]): any {
    // Generic format for other models
    const inputText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    return {
      inputText,
      parameters: {
        max_tokens: this.config.maxTokens || 4096,
        temperature: 0.7,
        top_p: 0.9,
      },
    };
  }

  private parseResponse(responseBody: any): Response {
    const result: Response = {
      content: '',
    };

    if (this.isClaudeModel()) {
      result.content = responseBody.completion || '';
      if (responseBody.stop_reason) {
        const finishReason = this.mapClaudeStopReason(responseBody.stop_reason);
        if (finishReason) {
          result.finishReason = finishReason;
        }
      }
    } else if (this.isTitanModel()) {
      result.content = responseBody.outputText || '';
      if (responseBody.completionReason) {
        const finishReason = this.mapTitanStopReason(
          responseBody.completionReason
        );
        if (finishReason) {
          result.finishReason = finishReason;
        }
      }
    } else {
      // Generic response parsing
      result.content =
        responseBody.outputText ||
        responseBody.completion ||
        responseBody.text ||
        '';
    }

    return result;
  }

  private mapClaudeStopReason(
    reason: string
  ): 'stop' | 'length' | 'tool_calls' | undefined {
    switch (reason) {
      case 'stop_sequence':
        return 'stop';
      case 'max_tokens':
        return 'length';
      default:
        return undefined;
    }
  }

  private mapTitanStopReason(
    reason: string
  ): 'stop' | 'length' | 'tool_calls' | undefined {
    switch (reason) {
      case 'FINISH':
        return 'stop';
      case 'LENGTH':
        return 'length';
      default:
        return undefined;
    }
  }

  private isClaudeModel(): boolean {
    return this.modelId.includes('anthropic.claude');
  }

  private isTitanModel(): boolean {
    return this.modelId.includes('amazon.titan');
  }

  private getModelCapabilities(): {
    contextLength: number;
    supportsVision: boolean;
    supportsFunctionCalling: boolean;
    supportsThinking: boolean;
    supportedFeatures: string[];
    costPerToken?: { input: number; output: number };
  } {
    // Known capabilities for Bedrock models
    if (this.isClaudeModel()) {
      return {
        contextLength: 200000,
        supportsVision: this.modelId.includes('claude-3'),
        supportsFunctionCalling: this.modelId.includes('claude-3'),
        supportsThinking: true,
        supportedFeatures: [
          'chat',
          'streaming',
          'thinking',
          'function-calling',
        ],
        costPerToken: this.getClaudeCostPerToken(),
      };
    } else if (this.isTitanModel()) {
      return {
        contextLength: 32000,
        supportsVision: false,
        supportsFunctionCalling: false,
        supportsThinking: false,
        supportedFeatures: ['chat', 'streaming'],
        costPerToken: { input: 0.0008, output: 0.0016 },
      };
    } else {
      // Default for other models
      return {
        contextLength: this.config.maxTokens || 4096,
        supportsVision: false,
        supportsFunctionCalling: false,
        supportsThinking: false,
        supportedFeatures: ['chat', 'streaming'],
      };
    }
  }

  private getClaudeCostPerToken(): { input: number; output: number } {
    // Bedrock pricing for Claude models (approximate)
    if (this.modelId.includes('claude-3-5-sonnet')) {
      return { input: 0.003, output: 0.015 };
    } else if (this.modelId.includes('claude-3-5-haiku')) {
      return { input: 0.00025, output: 0.00125 };
    } else if (this.modelId.includes('claude-3-opus')) {
      return { input: 0.015, output: 0.075 };
    } else if (this.modelId.includes('claude-3-sonnet')) {
      return { input: 0.003, output: 0.015 };
    } else if (this.modelId.includes('claude-3-haiku')) {
      return { input: 0.00025, output: 0.00125 };
    } else {
      return { input: 0.008, output: 0.024 }; // Claude v2 pricing
    }
  }
}
