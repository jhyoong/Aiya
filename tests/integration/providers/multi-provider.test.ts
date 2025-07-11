import { describe, test, expect, beforeEach } from 'vitest';
import {
  MockProviderFactory,
  MockTestUtils,
} from '@tests/mocks/providers/mock-factory';
import { TEST_CONFIGS } from '@tests/utils/config-builder';
import { assertValidProviderResponse } from '@tests/utils/assertions';

describe('Multi-Provider Integration Tests', () => {
  beforeEach(() => {
    MockProviderFactory.clear();
  });

  describe('Provider Combinations', () => {
    test('should handle all three providers simultaneously', async () => {
      const configs = [
        TEST_CONFIGS.ollama.basic,
        TEST_CONFIGS.openai.gpt4,
        {
          type: 'gemini' as const,
          model: 'gemini-2.5-flash',
          apiKey: 'AIza-test-key',
          capabilities: {
            maxTokens: 1048576,
            supportsFunctionCalling: true,
            supportsVision: true,
            supportsStreaming: true,
            supportsThinking: true,
          },
        },
      ];

      const providers = MockTestUtils.createMultiProvider(configs);
      expect(providers).toHaveLength(3);

      // Test that each provider works independently
      const messages = [
        { role: 'user' as const, content: 'Hello from all providers' },
      ];

      for (const provider of providers) {
        const response = await provider.chat(messages);
        assertValidProviderResponse(response);
        expect(response.model).toBeTruthy();
      }
    });

    test('should handle provider-specific capabilities', async () => {
      const providers = MockTestUtils.createMultiProvider([
        TEST_CONFIGS.ollama.basic,
        TEST_CONFIGS.openai.gpt4,
      ]);

      const [ollama, openai] = providers;

      // Ollama should not support vision
      expect(ollama.supportsVision()).toBe(false);

      // OpenAI should support vision
      expect(openai.supportsVision()).toBe(true);

      // Both should support function calling
      expect(ollama.supportsFunctionCalling()).toBe(true);
      expect(openai.supportsFunctionCalling()).toBe(true);
    });

    test('should handle different error scenarios', async () => {
      const providers = MockTestUtils.createMultiProvider([
        TEST_CONFIGS.ollama.basic,
        TEST_CONFIGS.openai.gpt4,
      ]);

      // Simulate network issues for all providers
      MockTestUtils.simulateNetworkIssues(providers, 'connection');

      for (const provider of providers) {
        await expect(
          provider.chat([{ role: 'user', content: 'test' }])
        ).rejects.toThrow(/connection/i);
      }
    });

    test('should support cross-provider capability comparisons', async () => {
      const configs = [
        TEST_CONFIGS.ollama.basic,
        TEST_CONFIGS.openai.gpt4,
        {
          type: 'gemini' as const,
          model: 'gemini-2.5-flash',
          apiKey: 'AIza-test-key',
          capabilities: {
            maxTokens: 1048576,
            supportsFunctionCalling: true,
            supportsVision: true,
            supportsStreaming: true,
            supportsThinking: true,
          },
        },
      ];

      const providers = MockTestUtils.createMultiProvider(configs);

      const capabilityMatrix = providers.map(provider => ({
        type: provider.providerType,
        vision: provider.supportsVision(),
        thinking: provider.supportsThinking(),
        functions: provider.supportsFunctionCalling(),
        streaming: provider.supportsStreaming(),
      }));

      // Verify expected capability matrix
      const ollama = capabilityMatrix.find(p => p.type === 'ollama');
      const openai = capabilityMatrix.find(p => p.type === 'openai');
      const gemini = capabilityMatrix.find(p => p.type === 'gemini');

      expect(ollama).toEqual({
        type: 'ollama',
        vision: false,
        thinking: false,
        functions: true,
        streaming: true,
      });

      expect(openai).toEqual({
        type: 'openai',
        vision: true,
        thinking: false,
        functions: true,
        streaming: true,
      });

      expect(gemini).toEqual({
        type: 'gemini',
        vision: true,
        thinking: true,
        functions: true,
        streaming: true,
      });
    });
  });

  describe('Performance Comparisons', () => {
    test('should compare response times across providers', async () => {
      const providers = MockTestUtils.createMultiProvider([
        TEST_CONFIGS.ollama.basic,
        TEST_CONFIGS.openai.gpt4,
      ]);

      // Set different latencies
      providers[0].setLatency(100); // Ollama (local)
      providers[1].setLatency(500); // OpenAI (API)

      const messages = [{ role: 'user' as const, content: 'Performance test' }];
      const startTime = Date.now();

      const responses = await Promise.all(
        providers.map(provider => provider.chat(messages))
      );

      const totalTime = Date.now() - startTime;

      expect(responses).toHaveLength(2);
      expect(totalTime).toBeGreaterThan(500); // Should take at least as long as the slowest

      responses.forEach(response => {
        assertValidProviderResponse(response);
      });
    });

    test('should provide combined metrics', async () => {
      const providers = MockTestUtils.createMultiProvider([
        TEST_CONFIGS.ollama.basic,
        TEST_CONFIGS.openai.gpt4,
      ]);

      // Make some calls
      const messages = [{ role: 'user' as const, content: 'Metrics test' }];
      await Promise.all(providers.map(p => p.chat(messages)));
      await Promise.all(providers.map(p => p.listModels()));

      const combinedMetrics = MockTestUtils.getCombinedMetrics(providers);

      expect(combinedMetrics.totalProviders).toBe(2);
      expect(combinedMetrics.totalCalls).toBe(4); // 2 chat + 2 listModels
      expect(combinedMetrics.providerMetrics).toHaveLength(2);
    });

    test('should handle load balancing scenarios', async () => {
      const providers = MockTestUtils.createMultiProvider([
        TEST_CONFIGS.ollama.basic,
        TEST_CONFIGS.openai.gpt4,
        {
          type: 'gemini' as const,
          model: 'gemini-1.5-flash',
          apiKey: 'AIza-test-key',
        },
      ]);

      // Set different latencies to simulate different response times
      providers[0].setLatency(50); // Fast local
      providers[1].setLatency(300); // Medium API
      providers[2].setLatency(150); // Fast API

      // Simulate multiple requests
      const requests = Array.from({ length: 9 }, (_, i) => ({
        provider: providers[i % 3],
        message: `Request ${i + 1}`,
      }));

      const startTime = Date.now();
      const responses = await Promise.all(
        requests.map(req =>
          req.provider.chat([{ role: 'user', content: req.message }])
        )
      );
      const totalTime = Date.now() - startTime;

      expect(responses).toHaveLength(9);
      responses.forEach(response => {
        assertValidProviderResponse(response);
      });

      // Should complete faster than if all requests went to slowest provider
      expect(totalTime).toBeLessThan(900); // 3 requests * 300ms
    });
  });

  describe('Provider Switching Simulation', () => {
    test('should simulate provider switching workflow', async () => {
      const providers = [
        MockProviderFactory.create(TEST_CONFIGS.ollama.basic),
        MockProviderFactory.create(TEST_CONFIGS.openai.gpt4),
      ];

      let currentProvider = providers[0];
      const conversation = [];

      // Start with Ollama
      let response = await currentProvider.chat([
        { role: 'user', content: 'Start conversation with Ollama' },
      ]);
      conversation.push({ provider: 'ollama', response: response.content });

      // Switch to OpenAI
      currentProvider = providers[1];
      response = await currentProvider.chat([
        { role: 'user', content: 'Continue with OpenAI' },
      ]);
      conversation.push({ provider: 'openai', response: response.content });

      expect(conversation).toHaveLength(2);
      expect(conversation[0].provider).toBe('ollama');
      expect(conversation[1].provider).toBe('openai');
      expect(conversation[0].response).toBeTruthy();
      expect(conversation[1].response).toBeTruthy();
    });

    test('should maintain context across provider switches', async () => {
      const providers = MockTestUtils.createMultiProvider([
        TEST_CONFIGS.ollama.basic,
        TEST_CONFIGS.openai.gpt4,
      ]);

      const conversationHistory = [
        { role: 'user' as const, content: 'My name is Alice' },
        {
          role: 'assistant' as const,
          content: 'Hello Alice! Nice to meet you.',
        },
        { role: 'user' as const, content: 'What is my name?' },
      ];

      // Test with both providers using the same conversation history
      const responses = await Promise.all(
        providers.map(provider => provider.chat(conversationHistory))
      );

      responses.forEach(response => {
        assertValidProviderResponse(response);
        // Both should provide a reasonable response (though exact content may vary)
        expect(response.content.length).toBeGreaterThan(5);
      });
    });
  });

  describe('Capability-Specific Testing', () => {
    test('should test vision capabilities across supporting providers', async () => {
      const visionCapableProviders = MockTestUtils.createMultiProvider([
        TEST_CONFIGS.openai.gpt4,
        {
          type: 'gemini' as const,
          model: 'gemini-2.5-flash',
          apiKey: 'AIza-test-key',
          capabilities: {
            maxTokens: 1048576,
            supportsFunctionCalling: true,
            supportsVision: true,
            supportsStreaming: true,
            supportsThinking: true,
          },
        },
      ]).filter(p => p.supportsVision());

      expect(visionCapableProviders).toHaveLength(2);

      const visionMessages = [
        { role: 'user' as const, content: 'Describe this [image]' },
      ];

      for (const provider of visionCapableProviders) {
        const response = await provider.chat(visionMessages);
        assertValidProviderResponse(response);
        expect(response.content).toMatch(/image/i);
      }
    });

    test('should test thinking capabilities', async () => {
      const providers = MockTestUtils.createMultiProvider([
        TEST_CONFIGS.ollama.basic,
        TEST_CONFIGS.openai.gpt4,
        {
          type: 'gemini' as const,
          model: 'gemini-2.5-flash',
          apiKey: 'AIza-test-key',
          capabilities: {
            maxTokens: 1048576,
            supportsFunctionCalling: true,
            supportsVision: true,
            supportsStreaming: true,
            supportsThinking: true,
          },
        },
      ]);

      const thinkingProviders = providers.filter(p => p.supportsThinking());
      const nonThinkingProviders = providers.filter(p => !p.supportsThinking());

      expect(thinkingProviders).toHaveLength(1); // Only Gemini 2.5+
      expect(nonThinkingProviders).toHaveLength(2); // Ollama and OpenAI

      const complexPrompt = [
        {
          role: 'user' as const,
          content: 'Think step by step about this problem',
        },
      ];

      // Test thinking provider
      for (const provider of thinkingProviders) {
        const response = await provider.chat(complexPrompt);
        assertValidProviderResponse(response);
        expect(response.thinking).toBeTruthy();
      }

      // Test non-thinking providers
      for (const provider of nonThinkingProviders) {
        const response = await provider.chat(complexPrompt);
        assertValidProviderResponse(response);
        expect(response.thinking).toBeUndefined();
      }
    });

    test('should test streaming consistency across providers', async () => {
      const providers = MockTestUtils.createMultiProvider([
        TEST_CONFIGS.ollama.basic,
        TEST_CONFIGS.openai.gpt4,
        {
          type: 'gemini' as const,
          model: 'gemini-2.5-flash',
          apiKey: 'AIza-test-key',
          capabilities: {
            maxTokens: 1048576,
            supportsFunctionCalling: true,
            supportsVision: true,
            supportsStreaming: true,
            supportsThinking: true,
          },
        },
      ]);

      const streamingMessage = [
        { role: 'user' as const, content: 'Stream this response' },
      ];

      for (const provider of providers) {
        expect(provider.supportsStreaming()).toBe(true);

        const chunks: any[] = [];
        for await (const chunk of provider.streamChat(streamingMessage)) {
          chunks.push(chunk);
        }

        expect(chunks.length).toBeGreaterThan(2);
        expect(chunks[0].type).toBe('start');
        expect(chunks[chunks.length - 1].type).toBe('end');
      }
    });
  });

  describe('Error Resilience Testing', () => {
    test('should handle partial provider failures', async () => {
      const providers = MockTestUtils.createMultiProvider([
        TEST_CONFIGS.ollama.basic,
        TEST_CONFIGS.openai.gpt4,
        {
          type: 'gemini' as const,
          model: 'gemini-2.5-flash',
          apiKey: 'AIza-test-key',
          capabilities: {
            maxTokens: 1048576,
            supportsFunctionCalling: true,
            supportsVision: true,
            supportsStreaming: true,
            supportsThinking: true,
          },
        },
      ]);

      // Simulate failure in middle provider
      providers[1].simulateError('connection');

      const messages = [{ role: 'user' as const, content: 'Test resilience' }];
      const results = await Promise.allSettled(
        providers.map(provider => provider.chat(messages))
      );

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');

      // Working providers should still provide valid responses
      const successfulResponses = results
        .filter(
          (result): result is PromiseFulfilledResult<any> =>
            result.status === 'fulfilled'
        )
        .map(result => result.value);

      expect(successfulResponses).toHaveLength(2);
      successfulResponses.forEach(response => {
        assertValidProviderResponse(response);
      });
    });

    test('should handle authentication failures gracefully', async () => {
      const providers = MockTestUtils.createMultiProvider([
        TEST_CONFIGS.ollama.basic, // No auth required
        {
          type: 'openai' as const,
          model: 'gpt-4o-mini',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'invalid-key', // Invalid key
        },
      ]);

      // Simulate auth failure for OpenAI
      providers[1].simulateError('authentication');

      const messages = [{ role: 'user' as const, content: 'Test auth' }];

      // Ollama should work (no auth required)
      const ollamaResponse = await providers[0].chat(messages);
      assertValidProviderResponse(ollamaResponse);

      // OpenAI should fail
      await expect(providers[1].chat(messages)).rejects.toThrow(
        /authentication/i
      );
    });
  });
});
