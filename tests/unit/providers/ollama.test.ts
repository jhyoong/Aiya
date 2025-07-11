import { ProviderTestSuite } from './base-provider-test';
import {
  createMockOllamaProvider,
  OLLAMA_TEST_SCENARIOS,
} from '@tests/mocks/providers/mock-ollama';
import type { MockProvider } from '@tests/mocks/providers/base-mock-provider';
import type { ExtendedProviderConfig } from '@/core/config/manager';
import { TEST_CONFIGS } from '@tests/utils/config-builder';

class OllamaTestSuite extends ProviderTestSuite {
  readonly providerType = 'ollama';
  readonly testConfig = TEST_CONFIGS.ollama.basic;

  createMockProvider(config?: Partial<ExtendedProviderConfig>): MockProvider {
    return createMockOllamaProvider(config);
  }

  protected testProviderSpecificFeatures(
    getProvider: () => MockProvider
  ): void {
    describe('Ollama-Specific Features', () => {
      test('should handle local server connection', async () => {
        const provider = getProvider();
        expect(provider.config.baseUrl).toMatch(/localhost|127\\.0\\.0\\.1/);
      });

      test('should not require API key', () => {
        const provider = getProvider();
        expect(provider.config.apiKey).toBeUndefined();
      });

      test('should handle server offline scenario', async () => {
        const offlineProvider = OLLAMA_TEST_SCENARIOS.offline();
        await expect(
          offlineProvider.chat([{ role: 'user', content: 'test' }])
        ).rejects.toThrow(/connection/i);
      });

      test('should handle model not pulled', async () => {
        const provider =
          OLLAMA_TEST_SCENARIOS.modelMissing('nonexistent:model');
        await expect(provider.listModels()).rejects.toThrow(/not found/i);
      });

      test('should work with custom endpoint', () => {
        const customProvider = OLLAMA_TEST_SCENARIOS.customEndpoint(
          'http://custom:11434'
        );
        expect(customProvider.config.baseUrl).toBe('http://custom:11434');
      });

      test('should support local model management', async () => {
        const provider = this.createMockProvider();
        const models = await provider.listModels();

        // Ollama should have local models available
        expect(models.length).toBeGreaterThan(0);
        models.forEach(model => {
          expect(model.contextLength).toBeGreaterThan(0);
          expect(model.capabilities.functionCalling).toBe(true);
          expect(model.capabilities.vision).toBe(false); // Ollama doesn't support vision
          expect(model.capabilities.thinking).toBe(false); // Ollama doesn't support thinking
        });
      });

      test('should handle slow local inference', async () => {
        const slowProvider = OLLAMA_TEST_SCENARIOS.slow();
        expect(slowProvider).toBeDefined();

        const response = await slowProvider.chat([
          { role: 'user', content: 'Test slow response' },
        ]);

        expect(response.content).toBeDefined();
        expect(response.content.length).toBeGreaterThan(0);
      });

      test('should provide Ollama-specific metrics', () => {
        const provider = this.createMockProvider() as any;
        if (typeof provider.getOllamaMetrics === 'function') {
          const metrics = provider.getOllamaMetrics();

          expect(metrics.modelsAvailable).toBeGreaterThan(0);
          expect(metrics.localConnection).toBe(true);
          expect(metrics.averageModelSize).toBeTruthy();
        }
      });

      test('should support multiple model formats', async () => {
        const provider = this.createMockProvider();
        const models = await provider.listModels();

        // Should support different model formats typical of Ollama
        const modelFormats = models.map(m => m.id.split(':')[0]);
        expect(modelFormats).toContain('qwen3');
        expect(modelFormats).toContain('llama3.2');
      });

      test('should handle concurrent local requests', async () => {
        const provider = this.createMockProvider();

        const promises = Array.from({ length: 3 }, (_, i) =>
          provider.chat([{ role: 'user', content: `Concurrent test ${i}` }])
        );

        const responses = await Promise.all(promises);

        expect(responses).toHaveLength(3);
        responses.forEach(response => {
          expect(response.content).toBeTruthy();
          expect(response.model).toBe(provider.config.model);
        });
      });
    });
  }
}

// Run the test suite
const ollamaTests = new OllamaTestSuite();
ollamaTests.runProviderTests();
