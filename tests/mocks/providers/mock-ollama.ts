import {
  BaseMockProvider,
  type MockMessage,
  type MockChatResponse,
  type MockStreamChunk,
  type MockModel,
} from './base-mock-provider';
import type { ExtendedProviderConfig } from '@/core/config/manager';

/**
 * Mock implementation of Ollama provider for testing
 */
export class MockOllamaProvider extends BaseMockProvider {
  private static readonly OLLAMA_MODELS: MockModel[] = [
    {
      id: 'qwen2.5:8b',
      name: 'Qwen 2.5 8B',
      contextLength: 32768,
      capabilities: {
        vision: false,
        functionCalling: true,
        thinking: false,
      },
    },
    {
      id: 'llama3.2:3b',
      name: 'Llama 3.2 3B',
      contextLength: 8192,
      capabilities: {
        vision: false,
        functionCalling: true,
        thinking: false,
      },
    },
    {
      id: 'codellama:7b',
      name: 'Code Llama 7B',
      contextLength: 16384,
      capabilities: {
        vision: false,
        functionCalling: true,
        thinking: false,
      },
    },
  ];

  constructor(config: ExtendedProviderConfig) {
    super(config, 'ollama');

    // Set Ollama-specific response pattern
    this.setResponsePattern({
      style: 'technical',
      averageLength: 120,
      errorProbability: 0.02,
    });
  }

  async chat(messages: MockMessage[]): Promise<MockChatResponse> {
    return this.recordCall('chat', [messages], async () => {
      const lastMessage = messages[messages.length - 1];
      const prompt = lastMessage.content;

      const content = this.generateResponseContent(prompt);
      const usage = this.calculateTokenUsage(
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
    const response = await this.chat(messages);

    // Simulate streaming by breaking response into chunks
    yield { type: 'start' };

    const words = response.content.split(' ');
    for (let i = 0; i < words.length; i++) {
      await this.delay(50); // Small delay between chunks

      const delta = words[i] + (i < words.length - 1 ? ' ' : '');
      yield {
        type: 'content',
        delta,
        content: words.slice(0, i + 1).join(' '),
      };
    }

    yield {
      type: 'end',
      usage: response.usage,
    };
  }

  async listModels(): Promise<MockModel[]> {
    return this.recordCall('listModels', [], async () => {
      // Simulate some models being available
      return MockOllamaProvider.OLLAMA_MODELS.filter(
        model =>
          // Randomly make some models unavailable to test error handling
          Math.random() > 0.1
      );
    });
  }

  async getModel(modelId: string): Promise<MockModel> {
    return this.recordCall('getModel', [modelId], async () => {
      const model = MockOllamaProvider.OLLAMA_MODELS.find(
        m => m.id === modelId
      );

      if (!model) {
        throw this.createError('model_not_found');
      }

      return model;
    });
  }

  /**
   * Simulate Ollama-specific behavior
   */
  simulateOllamaDown(): void {
    this.simulateError('connection');
  }

  simulateModelNotPulled(modelId: string): void {
    // Override the model ID and simulate model not found
    this.config.model = modelId;
    this.simulateError('model_not_found');
  }

  /**
   * Get Ollama-specific metrics
   */
  getOllamaMetrics() {
    const baseMetrics = this.getMetrics();

    return {
      ...baseMetrics,
      modelsAvailable: MockOllamaProvider.OLLAMA_MODELS.length,
      averageModelSize: '4.5GB', // Mock value
      localConnection: true,
    };
  }
}

/**
 * Factory function to create configured mock Ollama provider
 */
export function createMockOllamaProvider(
  overrides: Partial<ExtendedProviderConfig> = {}
): MockOllamaProvider {
  const defaultConfig: ExtendedProviderConfig = {
    type: 'ollama',
    model: 'qwen2.5:8b',
    baseUrl: 'http://localhost:11434',
    capabilities: {
      maxTokens: 32768,
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsStreaming: true,
      supportsThinking: false,
    },
  };

  const config = { ...defaultConfig, ...overrides };
  return new MockOllamaProvider(config);
}

/**
 * Predefined mock scenarios for testing
 */
export const OLLAMA_TEST_SCENARIOS = {
  // Normal operation
  healthy: () => {
    const provider = createMockOllamaProvider();
    provider.setLatency(100);
    return provider;
  },

  // High latency scenario
  slow: () => {
    const provider = createMockOllamaProvider();
    provider.setLatency(2000);
    return provider;
  },

  // Ollama service down
  offline: () => {
    const provider = createMockOllamaProvider();
    provider.simulateOllamaDown();
    return provider;
  },

  // Model not available
  modelMissing: (modelId: string = 'nonexistent:model') => {
    const provider = createMockOllamaProvider({ model: modelId });
    provider.simulateModelNotPulled(modelId);
    return provider;
  },

  // Custom endpoint
  customEndpoint: (baseUrl: string) => {
    return createMockOllamaProvider({ baseUrl });
  },
};
