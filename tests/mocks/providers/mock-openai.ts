import {
  BaseMockProvider,
  type MockMessage,
  type MockChatResponse,
  type MockStreamChunk,
  type MockModel,
} from './base-mock-provider';
import type { ExtendedProviderConfig } from '@/core/config/manager';

export class MockOpenAIProvider extends BaseMockProvider {
  private static readonly OPENAI_MODELS: MockModel[] = [
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      contextLength: 128000,
      capabilities: {
        vision: true,
        functionCalling: true,
        thinking: false,
      },
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      contextLength: 128000,
      capabilities: {
        vision: true,
        functionCalling: true,
        thinking: false,
      },
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      contextLength: 128000,
      capabilities: {
        vision: true,
        functionCalling: true,
        thinking: false,
      },
    },
  ];

  constructor(config: ExtendedProviderConfig) {
    super(config, 'openai');

    this.setResponsePattern({
      style: 'conversational',
      averageLength: 180,
      errorProbability: 0.01,
    });
  }

  async chat(messages: MockMessage[]): Promise<MockChatResponse> {
    return this.recordCall('chat', [messages], async () => {
      this.validateApiKey();

      const lastMessage = messages[messages.length - 1];
      let content = this.generateResponseContent(lastMessage.content);

      // Simulate vision capabilities
      if (
        this.supportsVision() &&
        this.containsImageContent(lastMessage.content)
      ) {
        content = this.generateVisionResponse(lastMessage.content);
      }

      const usage = this.calculateOpenAITokenUsage(
        messages.map(m => m.content).join(' '),
        content
      );

      return {
        content,
        usage,
        model: this.config.model,
        timestamp: new Date().toISOString(),
      };
    });
  }

  async *streamChat(messages: MockMessage[]): AsyncIterable<MockStreamChunk> {
    this.validateApiKey();

    const response = await this.chat(messages);

    yield { type: 'start' };

    // Simulate token-based streaming (OpenAI style)
    const tokens = response.content.split(/(\\s+)/);
    for (let i = 0; i < tokens.length; i++) {
      await this.delay(30);

      yield {
        type: 'content',
        delta: tokens[i],
        content: tokens.slice(0, i + 1).join(''),
      };
    }

    yield {
      type: 'end',
      usage: response.usage,
    };
  }

  async listModels(): Promise<MockModel[]> {
    return this.recordCall('listModels', [], async () => {
      this.validateApiKey();
      return MockOpenAIProvider.OPENAI_MODELS;
    });
  }

  async getModel(modelId: string): Promise<MockModel> {
    return this.recordCall('getModel', [modelId], async () => {
      this.validateApiKey();

      const model = MockOpenAIProvider.OPENAI_MODELS.find(
        m => m.id === modelId
      );
      if (!model) {
        throw this.createError('model_not_found');
      }

      return model;
    });
  }

  /**
   * OpenAI-specific functionality
   */
  private validateApiKey(): void {
    if (!this.config.apiKey) {
      throw this.createError('authentication');
    }

    if (!this.config.apiKey.startsWith('sk-')) {
      throw this.createError('authentication');
    }
  }

  private containsImageContent(content: string): boolean {
    return /\[image\]|\[img\]|image:|data:image\//.test(content.toLowerCase());
  }

  private generateVisionResponse(content: string): string {
    const visionPrefixes = [
      'I can see in this image',
      'The image shows',
      'Looking at this image, I observe',
      'This appears to be an image of',
    ];

    const prefix =
      visionPrefixes[Math.floor(Math.random() * visionPrefixes.length)];
    return `${prefix} ${this.generateResponseContent(content)}`;
  }

  private calculateOpenAITokenUsage(
    input: string,
    output: string
  ): MockChatResponse['usage'] {
    // More accurate token calculation for OpenAI (roughly 0.75 tokens per character)
    const inputTokens = Math.ceil((input.length * 0.75) / 4);
    const outputTokens = Math.ceil((output.length * 0.75) / 4);

    return {
      input: inputTokens,
      output: outputTokens,
      promptTokens: inputTokens,
      completionTokens: outputTokens,
    };
  }

  /**
   * Simulate OpenAI-specific errors
   */
  simulateInsufficientQuota(): void {
    this.simulateError('rate_limit');
  }

  simulateInvalidApiKey(): void {
    this.config.apiKey = 'invalid-key';
  }

  /**
   * Get OpenAI-specific metrics
   */
  getOpenAIMetrics() {
    const baseMetrics = this.getMetrics();

    return {
      ...baseMetrics,
      modelsAvailable: MockOpenAIProvider.OPENAI_MODELS.length,
      visionSupported: this.supportsVision(),
      apiKeyValid: this.config.apiKey?.startsWith('sk-') ?? false,
    };
  }
}

export function createMockOpenAIProvider(
  overrides: Partial<ExtendedProviderConfig> = {}
): MockOpenAIProvider {
  const defaultConfig: ExtendedProviderConfig = {
    type: 'openai',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-test-key-123',
    capabilities: {
      maxTokens: 128000,
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsThinking: false,
    },
    costPerToken: { input: 0.00015, output: 0.0006 },
  };

  const config = { ...defaultConfig, ...overrides };
  return new MockOpenAIProvider(config);
}

export const OPENAI_TEST_SCENARIOS = {
  healthy: () => createMockOpenAIProvider(),

  withVision: () =>
    createMockOpenAIProvider({
      model: 'gpt-4o',
      capabilities: { supportsVision: true },
    }),

  invalidApiKey: () => {
    const provider = createMockOpenAIProvider({ apiKey: 'invalid-key' });
    provider.simulateInvalidApiKey();
    return provider;
  },

  quotaExceeded: () => {
    const provider = createMockOpenAIProvider();
    provider.simulateInsufficientQuota();
    return provider;
  },

  customEndpoint: (baseUrl: string) => createMockOpenAIProvider({ baseUrl }),
};
