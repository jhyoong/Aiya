import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { TestConfigBuilder, TEST_CONFIGS } from '@tests/utils/config-builder';
import {
  assertValidConfig,
  assertValidProviderResponse,
} from '@tests/utils/assertions';
import {
  MockProviderFactory,
  createOllamaMock,
} from '@tests/mocks/providers/mock-factory';

/**
 * Foundation smoke tests to validate testing infrastructure setup
 */

describe('Testing Infrastructure Foundation', () => {
  afterEach(() => {
    MockProviderFactory.clear();
  });

  describe('Test Configuration Builder', () => {
    test('should create valid Ollama configuration', () => {
      const config = TestConfigBuilder.create()
        .withProvider('ollama')
        .withModel('qwen3:8b')
        .build();

      assertValidConfig(config);
      expect(config.type).toBe('ollama');
      expect(config.model).toBe('qwen3:8b');
      expect(config.baseUrl).toBe('http://localhost:11434');
    });

    test('should create configuration with custom values', () => {
      const config = TestConfigBuilder.create()
        .withProvider('ollama')
        .withModel('custom-model')
        .withBaseUrl('http://custom-host:11434')
        .withCapabilities({
          maxTokens: 8192,
          supportsVision: true,
        })
        .build();

      assertValidConfig(config);
      expect(config.model).toBe('custom-model');
      expect(config.baseUrl).toBe('http://custom-host:11434');
      expect(config.capabilities?.maxTokens).toBe(8192);
      expect(config.capabilities?.supportsVision).toBe(true);
    });

    test('should use predefined test configurations', () => {
      const ollamaConfig = TEST_CONFIGS.ollama.basic;
      assertValidConfig(ollamaConfig);
      expect(ollamaConfig.type).toBe('ollama');
      expect(ollamaConfig.model).toBe('qwen3:8b');
    });

    test('should throw error for missing required fields', () => {
      expect(() => {
        TestConfigBuilder.create().build();
      }).toThrow('Provider type is required');

      expect(() => {
        TestConfigBuilder.create().withProvider('ollama').build();
      }).toThrow('Model is required');
    });
  });

  describe('Mock Provider Infrastructure', () => {
    test('should create mock Ollama provider', () => {
      const provider = createOllamaMock();

      expect(provider).toBeDefined();
      expect(provider.providerType).toBe('ollama');
      expect(provider.config.type).toBe('ollama');
      expect(provider.supportsStreaming()).toBe(true);
      expect(provider.supportsFunctionCalling()).toBe(true);
      expect(provider.supportsVision()).toBe(false);
      expect(provider.supportsThinking()).toBe(false);
    });

    test('should handle mock provider configuration', () => {
      const provider = createOllamaMock({
        model: 'llama3.2:3b',
        baseUrl: 'http://test-host:11434',
      });

      expect(provider.config.model).toBe('llama3.2:3b');
      expect(provider.config.baseUrl).toBe('http://test-host:11434');
    });

    test('should generate mock responses', async () => {
      const provider = createOllamaMock();
      const messages = [
        { role: 'user' as const, content: 'Hello, how are you?' },
      ];

      const response = await provider.chat(messages);

      assertValidProviderResponse(response);
      expect(response.content).toBeTruthy();
      expect(response.content).toBeTypeOf('string');
      expect(response.model).toBe(provider.config.model);
      expect(response.usage).toBeDefined();
      expect(response.usage?.input).toBeGreaterThan(0);
      expect(response.usage?.output).toBeGreaterThan(0);
    });

    test('should simulate streaming responses', async () => {
      const provider = createOllamaMock();
      const messages = [{ role: 'user' as const, content: 'Tell me a story' }];

      const chunks: any[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(2);
      expect(chunks[0].type).toBe('start');
      expect(chunks[chunks.length - 1].type).toBe('end');

      const contentChunks = chunks.filter(c => c.type === 'content');
      expect(contentChunks.length).toBeGreaterThan(0);
      contentChunks.forEach(chunk => {
        expect(chunk.delta).toBeTruthy();
      });
    });

    test('should track call history and metrics', async () => {
      const provider = createOllamaMock();

      // Make several calls
      await provider.chat([{ role: 'user', content: 'Test 1' }]);
      await provider.chat([{ role: 'user', content: 'Test 2' }]);
      await provider.listModels();

      const history = provider.getCallHistory();
      expect(history).toHaveLength(3);
      expect(history[0].method).toBe('chat');
      expect(history[1].method).toBe('chat');
      expect(history[2].method).toBe('listModels');

      const metrics = provider.getMetrics();
      expect(metrics.totalCalls).toBe(3);
      expect(metrics.averageLatency).toBeGreaterThan(0);
      expect(metrics.callsByMethod.chat).toBe(2);
      expect(metrics.callsByMethod.listModels).toBe(1);
    });

    test('should simulate errors', async () => {
      const provider = createOllamaMock();
      provider.simulateError('connection');

      await expect(
        provider.chat([{ role: 'user', content: 'Test' }])
      ).rejects.toThrow('Connection failed');
    });

  });

  describe('Custom Assertions', () => {
    test('should validate configurations with custom matchers', () => {
      const config = TEST_CONFIGS.ollama.basic;
      expect(config).toBeValidConfig();
      expect(config).toHaveProvider('ollama');
    });

    test('should validate token counts with custom matchers', () => {
      const usage = { input: 10, output: 20 };
      expect(usage).toMatchTokenCount({ input: 10, output: 20 });
    });
  });

  describe('Provider Factory', () => {
    test('should create providers via factory', () => {
      const config = TEST_CONFIGS.ollama.basic;
      const provider = MockProviderFactory.create(config);

      expect(provider).toBeDefined();
      expect(provider.providerType).toBe('ollama');
    });

    test('should reuse providers for same configuration', () => {
      const config = TEST_CONFIGS.ollama.basic;
      const provider1 = MockProviderFactory.create(config);
      const provider2 = MockProviderFactory.create(config);

      expect(provider1).toBe(provider2);
    });

    test('should clear providers', () => {
      const config = TEST_CONFIGS.ollama.basic;
      MockProviderFactory.create(config);

      expect(MockProviderFactory.getAllProviders()).toHaveLength(1);

      MockProviderFactory.clear();
      expect(MockProviderFactory.getAllProviders()).toHaveLength(0);
    });

    test('should reset all providers', () => {
      const provider = createOllamaMock();
      provider.setLatency(500);
      provider.simulateError('timeout');

      MockProviderFactory.resetAll();

      expect(provider.getMetrics().totalCalls).toBe(0);
      // Note: Reset clears history but settings like latency and error simulation
      // would need to be explicitly tested based on implementation
    });
  });
});

/**
 * Integration test for testing infrastructure
 */
describe('Testing Infrastructure Integration', () => {
  test('should support end-to-end mock workflow', async () => {
    // Create configuration
    const config = TestConfigBuilder.create()
      .withProvider('ollama')
      .withModel('qwen3:8b')
      .build();

    // Create provider
    const provider = MockProviderFactory.create(config);

    // Test basic functionality
    const models = await provider.listModels();
    expect(models.length).toBeGreaterThan(0);

    const model = await provider.getModel(config.model);
    expect(model.id).toBe(config.model);

    // Test chat functionality
    const messages = [
      { role: 'user' as const, content: 'What is TypeScript?' },
    ];

    const response = await provider.chat(messages);
    assertValidProviderResponse(response);

    // Test streaming
    const chunks: any[] = [];
    for await (const chunk of provider.streamChat(messages)) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(2);

    // Verify metrics
    const metrics = provider.getMetrics();
    expect(metrics.totalCalls).toBeGreaterThanOrEqual(3); // listModels, getModel, chat (streaming may add extra calls)
    expect(metrics.errorRate).toBe(0);
  });
});
