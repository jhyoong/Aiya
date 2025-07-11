import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  MockProviderFactory,
  MockTestUtils,
} from '@tests/mocks/providers/mock-factory';
import { TEST_CONFIGS } from '@tests/utils/config-builder';
import { assertValidProviderResponse } from '@tests/utils/assertions';

describe('Provider Switching Integration Tests', () => {
  beforeEach(() => {
    MockProviderFactory.clear();
  });

  afterEach(() => {
    MockProviderFactory.clear();
  });

  describe('Runtime Provider Switching', () => {
    test('should switch between providers mid-conversation', async () => {
      const providers = {
        ollama: MockProviderFactory.create(TEST_CONFIGS.ollama.basic),
        openai: MockProviderFactory.create(TEST_CONFIGS.openai.gpt4),
        gemini: MockProviderFactory.create({
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
        }),
      };

      // Simulate a conversation that switches providers
      const conversationHistory = [];
      let currentProvider = providers.ollama;

      // Phase 1: Start with Ollama
      let response = await currentProvider.chat([
        {
          role: 'user',
          content: "Hello, I'm starting a conversation about AI",
        },
      ]);
      conversationHistory.push(
        {
          role: 'user' as const,
          content: "Hello, I'm starting a conversation about AI",
        },
        { role: 'assistant' as const, content: response.content }
      );

      expect(response.model).toBe('qwen3:8b');
      assertValidProviderResponse(response);

      // Phase 2: Switch to OpenAI
      currentProvider = providers.openai;
      response = await currentProvider.chat([
        ...conversationHistory,
        {
          role: 'user',
          content: 'Now I want to ask about vision capabilities',
        },
      ]);
      conversationHistory.push(
        {
          role: 'user' as const,
          content: 'Now I want to ask about vision capabilities',
        },
        { role: 'assistant' as const, content: response.content }
      );

      expect(response.model).toBe('gpt-4o-mini');
      assertValidProviderResponse(response);

      // Phase 3: Switch to Gemini
      currentProvider = providers.gemini;
      response = await currentProvider.chat([
        ...conversationHistory,
        {
          role: 'user',
          content: 'Can you think through this complex problem step by step?',
        },
      ]);

      expect(response.model).toBe('gemini-2.5-flash');
      assertValidProviderResponse(response);
      expect(response.thinking).toBeTruthy(); // Gemini 2.5+ should provide thinking

      expect(conversationHistory.length).toBe(4); // 2 user + 2 assistant messages
    });

    test('should handle provider switching with state preservation', async () => {
      const providers = [
        MockProviderFactory.create(TEST_CONFIGS.ollama.basic),
        MockProviderFactory.create(TEST_CONFIGS.openai.gpt4),
      ];

      // Track metrics across switches
      const initialMetrics = providers.map(p => p.getMetrics());

      // Use provider 1
      await providers[0].chat([{ role: 'user', content: 'First message' }]);

      // Switch to provider 2
      await providers[1].chat([{ role: 'user', content: 'Second message' }]);

      // Switch back to provider 1
      await providers[0].chat([{ role: 'user', content: 'Third message' }]);

      const finalMetrics = providers.map(p => p.getMetrics());

      // Verify call counts were preserved
      expect(finalMetrics[0].totalCalls).toBe(initialMetrics[0].totalCalls + 2);
      expect(finalMetrics[1].totalCalls).toBe(initialMetrics[1].totalCalls + 1);
    });

    test('should maintain capability awareness during switches', async () => {
      const providers = {
        local: MockProviderFactory.create(TEST_CONFIGS.ollama.basic), // No vision
        cloud: MockProviderFactory.create(TEST_CONFIGS.openai.gpt4), // With vision
      };

      // Test vision request with non-vision provider
      let currentProvider = providers.local;
      expect(currentProvider.supportsVision()).toBe(false);

      const visionRequest = [
        { role: 'user' as const, content: 'Describe this [image]' },
      ];
      let response = await currentProvider.chat(visionRequest);

      // Should respond but without vision-specific content
      assertValidProviderResponse(response);
      expect(response.content).not.toMatch(/I can see|image shows/i);

      // Switch to vision-capable provider
      currentProvider = providers.cloud;
      expect(currentProvider.supportsVision()).toBe(true);

      response = await currentProvider.chat(visionRequest);

      // Should now provide vision-specific response
      assertValidProviderResponse(response);
      expect(response.content).toMatch(/I can see|image/i);
    });
  });

  describe('Failover Scenarios', () => {
    test('should handle primary provider failure with failover', async () => {
      const primaryProvider = MockProviderFactory.create(
        TEST_CONFIGS.openai.gpt4
      );
      const fallbackProvider = MockProviderFactory.create(
        TEST_CONFIGS.ollama.basic
      );

      const message = [{ role: 'user' as const, content: 'Test failover' }];

      // Primary provider works initially
      let response = await primaryProvider.chat(message);
      assertValidProviderResponse(response);
      expect(response.model).toBe('gpt-4o-mini');

      // Simulate primary provider failure
      primaryProvider.simulateError('connection');

      // Should fail now
      await expect(primaryProvider.chat(message)).rejects.toThrow(
        /connection/i
      );

      // Failover to backup provider
      response = await fallbackProvider.chat(message);
      assertValidProviderResponse(response);
      expect(response.model).toBe('qwen3:8b');
    });

    test('should handle authentication failure with provider switch', async () => {
      const authProvider = MockProviderFactory.create({
        type: 'openai' as const,
        model: 'gpt-4o-mini',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-invalid-key',
      });

      const noAuthProvider = MockProviderFactory.create(
        TEST_CONFIGS.ollama.basic
      );

      const message = [
        { role: 'user' as const, content: 'Test auth failover' },
      ];

      // Simulate auth failure
      authProvider.simulateError('authentication');
      await expect(authProvider.chat(message)).rejects.toThrow(
        /authentication/i
      );

      // Switch to provider that doesn't require auth
      const response = await noAuthProvider.chat(message);
      assertValidProviderResponse(response);
      expect(noAuthProvider.config.apiKey).toBeUndefined();
    });

    test('should handle rate limiting with provider rotation', async () => {
      const providers = [
        MockProviderFactory.create(TEST_CONFIGS.openai.gpt4),
        MockProviderFactory.create({
          type: 'openai' as const,
          model: 'gpt-4o-mini',
          baseUrl: 'https://api.perplexity.ai',
          apiKey: 'sk-perplexity-key',
        }),
        MockProviderFactory.create(TEST_CONFIGS.ollama.basic),
      ];

      const message = [
        { role: 'user' as const, content: 'Test rate limiting' },
      ];

      // First provider hits rate limit
      providers[0].simulateError('rate_limit');
      await expect(providers[0].chat(message)).rejects.toThrow(/rate limit/i);

      // Rotate to second provider
      let response = await providers[1].chat(message);
      assertValidProviderResponse(response);

      // Second provider also hits rate limit
      providers[1].simulateError('rate_limit');
      await expect(providers[1].chat(message)).rejects.toThrow(/rate limit/i);

      // Fallback to local provider (no rate limits)
      response = await providers[2].chat(message);
      assertValidProviderResponse(response);
    });
  });

  describe('Load Balancing Simulation', () => {
    test('should distribute load across multiple providers', async () => {
      const providers = [
        MockProviderFactory.create(TEST_CONFIGS.ollama.basic),
        MockProviderFactory.create(TEST_CONFIGS.openai.gpt4),
        MockProviderFactory.create({
          type: 'gemini' as const,
          model: 'gemini-1.5-flash',
          apiKey: 'AIza-test-key',
        }),
      ];

      const requests = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        message: [{ role: 'user' as const, content: `Request ${i + 1}` }],
      }));

      // Simulate round-robin load balancing
      const responses = await Promise.all(
        requests.map(async req => {
          const providerIndex = req.id % providers.length;
          const provider = providers[providerIndex];
          const response = await provider.chat(req.message);
          return {
            requestId: req.id,
            providerType: provider.providerType,
            response,
          };
        })
      );

      expect(responses).toHaveLength(12);

      // Verify load distribution
      const loadDistribution = responses.reduce(
        (acc, resp) => {
          acc[resp.providerType] = (acc[resp.providerType] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      expect(loadDistribution.ollama).toBe(4);
      expect(loadDistribution.openai).toBe(4);
      expect(loadDistribution.gemini).toBe(4);

      // All responses should be valid
      responses.forEach(resp => {
        assertValidProviderResponse(resp.response);
      });
    });

    test('should handle dynamic load balancing based on performance', async () => {
      const providers = MockTestUtils.createMultiProvider([
        TEST_CONFIGS.ollama.basic,
        TEST_CONFIGS.openai.gpt4,
        {
          type: 'gemini' as const,
          model: 'gemini-1.5-flash',
          apiKey: 'AIza-test-key',
        },
      ]);

      // Simulate different performance characteristics
      providers[0].setLatency(50); // Fastest
      providers[1].setLatency(300); // Slowest
      providers[2].setLatency(150); // Medium

      const message = [{ role: 'user' as const, content: 'Performance test' }];

      // Measure response times
      const performanceTests = await Promise.all(
        providers.map(async provider => {
          const response = await provider.chat(message);
          return {
            providerType: provider.providerType,
            response,
          };
        })
      );

      // Verify all providers responded
      expect(performanceTests).toHaveLength(providers.length);
      expect(performanceTests.map(t => t.providerType)).toContain('ollama');
      expect(performanceTests.map(t => t.providerType)).toContain('openai');

      // All should provide valid responses despite different speeds
      performanceTests.forEach(test => {
        assertValidProviderResponse(test.response);
      });
    });
  });

  describe('Configuration Switching', () => {
    test('should switch between different model configurations', async () => {
      const configurations = [
        {
          type: 'openai' as const,
          model: 'gpt-4o-mini',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-test-key',
        },
        {
          type: 'openai' as const,
          model: 'gpt-4o',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-test-key',
        },
        {
          type: 'openai' as const,
          model: 'gpt-4o-mini',
          baseUrl: 'https://api.perplexity.ai',
          apiKey: 'sk-perplexity-key',
        },
      ];

      const providers = configurations.map(config =>
        MockProviderFactory.create(config)
      );
      const message = [
        { role: 'user' as const, content: 'Test different configurations' },
      ];

      const responses = await Promise.all(
        providers.map(async (provider, index) => {
          const response = await provider.chat(message);
          return {
            configIndex: index,
            model: response.model,
            baseUrl: provider.config.baseUrl,
            response,
          };
        })
      );

      // Verify different configurations
      expect(responses[0].model).toBe('gpt-4o-mini');
      expect(responses[0].baseUrl).toBe('https://api.openai.com/v1');

      expect(responses[1].model).toBe('gpt-4o');
      expect(responses[1].baseUrl).toBe('https://api.openai.com/v1');

      expect(responses[2].model).toBe('gpt-4o-mini');
      expect(responses[2].baseUrl).toBe('https://api.perplexity.ai');

      responses.forEach(resp => {
        assertValidProviderResponse(resp.response);
      });
    });

    test('should handle capability-aware routing', async () => {
      const providers = MockTestUtils.createMultiProvider([
        TEST_CONFIGS.ollama.basic, // No vision, no thinking
        TEST_CONFIGS.openai.gpt4, // Vision, no thinking
        {
          type: 'gemini' as const,
          model: 'gemini-2.5-flash',
          apiKey: 'AIza-test-key', // Vision + thinking
          capabilities: {
            maxTokens: 1048576,
            supportsFunctionCalling: true,
            supportsVision: true,
            supportsStreaming: true,
            supportsThinking: true,
          },
        },
      ]);

      const requests = [
        { content: 'Basic question', needsVision: false, needsThinking: false },
        {
          content: 'Describe this [image]',
          needsVision: true,
          needsThinking: false,
        },
        {
          content: 'Think through this complex problem',
          needsVision: false,
          needsThinking: true,
        },
        {
          content: 'Analyze this [image] step by step',
          needsVision: true,
          needsThinking: true,
        },
      ];

      for (const request of requests) {
        // Route to appropriate provider based on capabilities
        let selectedProvider = providers[0]; // Default to Ollama

        if (request.needsVision && request.needsThinking) {
          selectedProvider = providers.find(
            p => p.supportsVision() && p.supportsThinking()
          )!;
        } else if (request.needsVision) {
          selectedProvider = providers.find(p => p.supportsVision())!;
        } else if (request.needsThinking) {
          selectedProvider = providers.find(p => p.supportsThinking())!;
        }

        const response = await selectedProvider.chat([
          { role: 'user', content: request.content },
        ]);

        assertValidProviderResponse(response);

        // Verify appropriate routing
        if (request.needsVision && request.needsThinking) {
          expect(selectedProvider.providerType).toBe('gemini');
        } else if (request.needsVision) {
          expect(['openai', 'gemini']).toContain(selectedProvider.providerType);
        } else if (request.needsThinking) {
          expect(selectedProvider.providerType).toBe('gemini');
        }
      }
    });
  });

  describe('Session Management', () => {
    test('should maintain separate sessions per provider', async () => {
      const providers = MockTestUtils.createMultiProvider([
        TEST_CONFIGS.ollama.basic,
        TEST_CONFIGS.openai.gpt4,
      ]);

      // Each provider maintains its own call history
      await providers[0].chat([{ role: 'user', content: 'Ollama message 1' }]);
      await providers[0].chat([{ role: 'user', content: 'Ollama message 2' }]);
      await providers[1].chat([{ role: 'user', content: 'OpenAI message 1' }]);

      const ollamaHistory = providers[0].getCallHistory();
      const openaiHistory = providers[1].getCallHistory();

      expect(ollamaHistory).toHaveLength(2);
      expect(openaiHistory).toHaveLength(1);

      expect(ollamaHistory[0].args[0][0].content).toBe('Ollama message 1');
      expect(ollamaHistory[1].args[0][0].content).toBe('Ollama message 2');
      expect(openaiHistory[0].args[0][0].content).toBe('OpenAI message 1');
    });

    test('should handle provider cleanup and reinitialization', async () => {
      const config = TEST_CONFIGS.ollama.basic;
      let provider = MockProviderFactory.create(config);

      // Use provider and generate history
      await provider.chat([{ role: 'user', content: 'Test message' }]);
      expect(provider.getMetrics().totalCalls).toBe(1);

      // Clear factory (simulates cleanup)
      MockProviderFactory.clear();

      // Recreate provider with same config
      provider = MockProviderFactory.create(config);
      expect(provider.getMetrics().totalCalls).toBe(0); // Should be fresh instance

      // Should work normally
      const response = await provider.chat([
        { role: 'user', content: 'New session' },
      ]);
      assertValidProviderResponse(response);
      expect(provider.getMetrics().totalCalls).toBe(1);
    });
  });
});
