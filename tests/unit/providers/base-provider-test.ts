import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import type { ExtendedProviderConfig } from '@/core/config/manager';
import type { MockProvider } from '@tests/mocks/providers/base-mock-provider';
import {
  assertValidProviderResponse,
  assertValidTokenUsage,
} from '@tests/utils/assertions';

export abstract class ProviderTestSuite {
  abstract readonly providerType: string;
  abstract readonly testConfig: ExtendedProviderConfig;
  abstract createMockProvider(
    config?: Partial<ExtendedProviderConfig>
  ): MockProvider;

  /**
   * Run comprehensive provider tests
   */
  runProviderTests(): void {
    describe(`${this.providerType} Provider Tests`, () => {
      let provider: MockProvider;

      beforeEach(() => {
        provider = this.createMockProvider();
      });

      afterEach(() => {
        provider?.reset();
      });

      this.testProviderBasics(() => provider);
      this.testAuthentication(() => provider);
      this.testModelOperations(() => provider);
      this.testChatFunctionality(() => provider);
      this.testStreamingSupport(() => provider);
      this.testCapabilityDetection(() => provider);
      this.testErrorHandling(() => provider);
      this.testTokenCounting(() => provider);
      this.testProviderSpecificFeatures(() => provider);
    });
  }

  /**
   * Test basic provider functionality
   */
  protected testProviderBasics(getProvider: () => MockProvider): void {
    describe('Provider Basics', () => {
      test('should have correct provider type', () => {
        const provider = getProvider();
        expect(provider.providerType).toBe(this.providerType);
      });

      test('should have valid configuration', () => {
        const provider = getProvider();
        expect(provider.config).toBeDefined();
        expect(provider.config.type).toBe(this.providerType);
        expect(provider.config.model).toBeTruthy();
      });

      test('should support basic operations', () => {
        const provider = getProvider();
        expect(typeof provider.chat).toBe('function');
        expect(typeof provider.streamChat).toBe('function');
        expect(typeof provider.listModels).toBe('function');
        expect(typeof provider.getModel).toBe('function');
      });
    });
  }

  /**
   * Test authentication scenarios
   */
  protected testAuthentication(getProvider: () => MockProvider): void {
    describe('Authentication', () => {
      test('should handle valid authentication', async () => {
        const provider = getProvider();
        const models = await provider.listModels();
        expect(Array.isArray(models)).toBe(true);
      });

      test('should handle authentication failures', async () => {
        const provider = getProvider();
        provider.simulateError('authentication');
        await expect(provider.listModels()).rejects.toThrow(/authentication/i);
      });

      if (this.requiresApiKey()) {
        test('should validate API key format', () => {
          const provider = getProvider();
          const config = provider.config;
          if (config.apiKey) {
            expect(this.isValidApiKeyFormat(config.apiKey)).toBe(true);
          }
        });
      }
    });
  }

  /**
   * Test model operations
   */
  protected testModelOperations(getProvider: () => MockProvider): void {
    describe('Model Operations', () => {
      test('should list available models', async () => {
        const provider = getProvider();
        const models = await provider.listModels();
        expect(Array.isArray(models)).toBe(true);
        expect(models.length).toBeGreaterThan(0);

        models.forEach(model => {
          expect(model.id).toBeTruthy();
          expect(model.name).toBeTruthy();
          expect(typeof model.contextLength).toBe('number');
          expect(model.capabilities).toBeDefined();
        });
      });

      test('should get specific model', async () => {
        const provider = getProvider();
        const modelId = provider.config.model;
        const model = await provider.getModel(modelId);

        expect(model.id).toBe(modelId);
        expect(model.name).toBeTruthy();
        expect(typeof model.contextLength).toBe('number');
      });

      test('should handle model not found', async () => {
        const provider = getProvider();
        await expect(provider.getModel('nonexistent-model')).rejects.toThrow(
          /not found/i
        );
      });
    });
  }

  /**
   * Test chat functionality
   */
  protected testChatFunctionality(getProvider: () => MockProvider): void {
    describe('Chat Functionality', () => {
      test('should handle basic chat', async () => {
        const provider = getProvider();
        const messages = [{ role: 'user' as const, content: 'Hello' }];
        const response = await provider.chat(messages);

        assertValidProviderResponse(response);
        expect(response.content).toBeTruthy();
        expect(response.model).toBe(provider.config.model);
      });

      test('should handle multi-turn conversation', async () => {
        const provider = getProvider();
        const messages = [
          { role: 'user' as const, content: 'What is TypeScript?' },
          {
            role: 'assistant' as const,
            content: 'TypeScript is a programming language...',
          },
          { role: 'user' as const, content: 'Can you give an example?' },
        ];

        const response = await provider.chat(messages);
        assertValidProviderResponse(response);
        expect(response.content.length).toBeGreaterThan(10);
      });

      test('should handle empty input', async () => {
        const provider = getProvider();
        const messages = [{ role: 'user' as const, content: '' }];
        const response = await provider.chat(messages);

        assertValidProviderResponse(response);
        expect(response.content).toBeTruthy();
      });

      test('should handle large context', async () => {
        const provider = getProvider();
        const largeContent = 'x'.repeat(1000);
        const messages = [{ role: 'user' as const, content: largeContent }];

        const response = await provider.chat(messages);
        assertValidProviderResponse(response);
      });
    });
  }

  /**
   * Test streaming support
   */
  protected testStreamingSupport(getProvider: () => MockProvider): void {
    describe('Streaming Support', () => {
      test('should support streaming', () => {
        const provider = getProvider();
        expect(provider.supportsStreaming()).toBe(true);
      });

      test('should stream chat responses', async () => {
        const provider = getProvider();
        const messages = [
          { role: 'user' as const, content: 'Tell me a story' },
        ];
        const chunks: any[] = [];

        for await (const chunk of provider.streamChat(messages)) {
          chunks.push(chunk);
        }

        expect(chunks.length).toBeGreaterThan(2);
        expect(chunks[0].type).toBe('start');
        expect(chunks[chunks.length - 1].type).toBe('end');

        const contentChunks = chunks.filter(c => c.type === 'content');
        expect(contentChunks.length).toBeGreaterThan(0);
      });

      test('should handle streaming errors', async () => {
        const provider = getProvider();
        provider.simulateError('timeout');
        const messages = [{ role: 'user' as const, content: 'Test' }];

        const chunks: any[] = [];
        try {
          for await (const chunk of provider.streamChat(messages)) {
            chunks.push(chunk);
          }
        } catch (error) {
          expect(error).toBeDefined();
        }
      });
    });
  }

  /**
   * Test capability detection
   */
  protected testCapabilityDetection(getProvider: () => MockProvider): void {
    describe('Capability Detection', () => {
      test('should report correct capabilities', () => {
        const provider = getProvider();
        const capabilities = provider.config.capabilities;
        expect(capabilities).toBeDefined();

        expect(typeof provider.supportsVision()).toBe('boolean');
        expect(typeof provider.supportsFunctionCalling()).toBe('boolean');
        expect(typeof provider.supportsThinking()).toBe('boolean');
        expect(typeof provider.supportsStreaming()).toBe('boolean');
      });

      test('should have consistent capability reporting', () => {
        const provider = getProvider();
        const config = provider.config.capabilities;

        expect(provider.supportsVision()).toBe(config?.supportsVision ?? false);
        expect(provider.supportsFunctionCalling()).toBe(
          config?.supportsFunctionCalling ?? false
        );
        expect(provider.supportsThinking()).toBe(
          config?.supportsThinking ?? false
        );
        expect(provider.supportsStreaming()).toBe(
          config?.supportsStreaming ?? true
        );
      });
    });
  }

  /**
   * Test error handling
   */
  protected testErrorHandling(getProvider: () => MockProvider): void {
    describe('Error Handling', () => {
      test('should handle connection errors', async () => {
        const provider = getProvider();
        provider.simulateError('connection');
        await expect(
          provider.chat([{ role: 'user', content: 'test' }])
        ).rejects.toThrow(/connection/i);
      });

      test('should handle rate limiting', async () => {
        const provider = getProvider();
        provider.simulateError('rate_limit');
        await expect(
          provider.chat([{ role: 'user', content: 'test' }])
        ).rejects.toThrow(/rate limit/i);
      });

      test('should handle context too long', async () => {
        const provider = getProvider();
        provider.simulateError('context_too_long');
        await expect(
          provider.chat([{ role: 'user', content: 'test' }])
        ).rejects.toThrow(/context/i);
      });

      test('should recover from errors', async () => {
        const provider = getProvider();
        provider.simulateError('timeout');
        await expect(
          provider.chat([{ role: 'user', content: 'test' }])
        ).rejects.toThrow();

        provider.clearError();
        const response = await provider.chat([
          { role: 'user', content: 'test' },
        ]);
        assertValidProviderResponse(response);
      });
    });
  }

  /**
   * Test token counting
   */
  protected testTokenCounting(getProvider: () => MockProvider): void {
    describe('Token Counting', () => {
      test('should provide token usage', async () => {
        const provider = getProvider();
        const messages = [
          { role: 'user' as const, content: 'Count my tokens' },
        ];
        const response = await provider.chat(messages);

        expect(response.usage).toBeDefined();
        assertValidTokenUsage(response.usage!);
      });

      test('should have reasonable token counts', async () => {
        const provider = getProvider();
        const shortMessage = [{ role: 'user' as const, content: 'Hi' }];
        const longMessage = [
          { role: 'user' as const, content: 'x'.repeat(100) },
        ];

        const shortResponse = await provider.chat(shortMessage);
        const longResponse = await provider.chat(longMessage);

        expect(longResponse.usage!.input!).toBeGreaterThan(
          shortResponse.usage!.input!
        );
      });

      test('should track token usage over time', async () => {
        const provider = getProvider();
        const initialMetrics = provider.getMetrics();

        await provider.chat([{ role: 'user', content: 'Test 1' }]);
        await provider.chat([{ role: 'user', content: 'Test 2' }]);

        const finalMetrics = provider.getMetrics();
        expect(finalMetrics.totalCalls).toBe(initialMetrics.totalCalls + 2);
      });
    });
  }

  /**
   * Provider-specific tests (override in subclasses)
   */
  protected testProviderSpecificFeatures(
    getProvider: () => MockProvider
  ): void {
    // Override in provider-specific test suites
  }

  /**
   * Helper methods (override as needed)
   */
  protected requiresApiKey(): boolean {
    return this.providerType !== 'ollama';
  }

  protected isValidApiKeyFormat(apiKey: string): boolean {
    switch (this.providerType) {
      case 'openai':
        return apiKey.startsWith('sk-');
      case 'anthropic':
        return apiKey.startsWith('sk-ant-');
      case 'gemini':
        return apiKey.startsWith('AIza');
      default:
        return true;
    }
  }
}
