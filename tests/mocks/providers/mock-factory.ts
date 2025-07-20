import type { ExtendedProviderConfig } from '@/core/config/manager';
import type { MockProvider } from './base-mock-provider';
import { MockOllamaProvider, createMockOllamaProvider } from './mock-ollama';
import { MockOpenAIProvider, createMockOpenAIProvider } from './mock-openai';
import { MockGeminiProvider, createMockGeminiProvider } from './mock-gemini';

/**
 * Factory for creating mock providers for testing
 */
export class MockProviderFactory {
  private static providers: Map<string, MockProvider> = new Map();

  /**
   * Create a mock provider based on configuration
   */
  static create(config: ExtendedProviderConfig): MockProvider {
    const key = this.getProviderKey(config);

    // Return existing provider if already created for this config
    if (this.providers.has(key)) {
      return this.providers.get(key)!;
    }

    let provider: MockProvider;

    switch (config.type) {
      case 'ollama':
        provider = new MockOllamaProvider(config);
        break;

      case 'openai':
        provider = new MockOpenAIProvider(config);
        break;

      case 'gemini':
        provider = new MockGeminiProvider(config);
        break;

      case 'anthropic':
        // TODO: Implement in future phases
        throw new Error('Anthropic mock provider not implemented yet');

      case 'azure':
        // TODO: Implement in future phases
        throw new Error('Azure mock provider not implemented yet');

      case 'bedrock':
        // TODO: Implement in future phases
        throw new Error('Bedrock mock provider not implemented yet');

      default:
        throw new Error(`Unsupported provider type: ${(config as any).type}`);
    }

    this.providers.set(key, provider);
    return provider;
  }

  /**
   * Create mock provider with predefined scenario
   */
  static async createScenario(
    providerType: string,
    scenario: string,
    ...args: any[]
  ): Promise<MockProvider> {
    switch (providerType) {
      case 'ollama': {
        const { OLLAMA_TEST_SCENARIOS } = await import('./mock-ollama');
        if (!(scenario in OLLAMA_TEST_SCENARIOS)) {
          throw new Error(`Unknown Ollama scenario: ${scenario}`);
        }
        return OLLAMA_TEST_SCENARIOS[scenario](...args);
      }

      case 'openai': {
        const { OPENAI_TEST_SCENARIOS } = await import('./mock-openai');
        if (!(scenario in OPENAI_TEST_SCENARIOS)) {
          throw new Error(`Unknown OpenAI scenario: ${scenario}`);
        }
        return OPENAI_TEST_SCENARIOS[scenario](...args);
      }

      case 'gemini': {
        const { GEMINI_TEST_SCENARIOS } = await import('./mock-gemini');
        if (!(scenario in GEMINI_TEST_SCENARIOS)) {
          throw new Error(`Unknown Gemini scenario: ${scenario}`);
        }
        return GEMINI_TEST_SCENARIOS[scenario](...args);
      }

      default:
        throw new Error(
          `Provider ${providerType} scenarios not implemented yet`
        );
    }
  }

  /**
   * Get all created providers
   */
  static getAllProviders(): MockProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Clear all providers (useful for test cleanup)
   */
  static clear(): void {
    this.providers.clear();
  }

  /**
   * Reset all providers to initial state
   */
  static resetAll(): void {
    this.providers.forEach(provider => provider.reset());
  }

  /**
   * Get provider by configuration
   */
  static get(config: ExtendedProviderConfig): MockProvider | undefined {
    const key = this.getProviderKey(config);
    return this.providers.get(key);
  }

  /**
   * Generate unique key for provider configuration
   */
  private static getProviderKey(config: ExtendedProviderConfig): string {
    const keyParts = [
      config.type,
      config.model,
      config.baseUrl || 'default',
      config.apiKey ? 'authenticated' : 'anonymous',
    ];
    return keyParts.join(':');
  }
}

/**
 * Convenience functions for creating specific mock providers
 */

export function createMockProvider(
  config: ExtendedProviderConfig
): MockProvider {
  return MockProviderFactory.create(config);
}

export function createOllamaMock(
  overrides: Partial<ExtendedProviderConfig> = {}
): MockOllamaProvider {
  return createMockOllamaProvider(overrides);
}

export function createOpenAIMock(
  overrides: Partial<ExtendedProviderConfig> = {}
): MockOpenAIProvider {
  return createMockOpenAIProvider(overrides);
}

export function createGeminiMock(
  overrides: Partial<ExtendedProviderConfig> = {}
): MockGeminiProvider {
  return createMockGeminiProvider(overrides);
}

// TODO: Add convenience functions for other providers in future phases
// export function createAnthropicMock(overrides: Partial<ExtendedProviderConfig> = {}): MockAnthropicProvider
// etc.

/**
 * Test utilities for mock providers
 */
export const MockTestUtils = {
  /**
   * Create multiple providers for multi-provider testing
   */
  createMultiProvider(configs: ExtendedProviderConfig[]): MockProvider[] {
    return configs.map(config => MockProviderFactory.create(config));
  },

  /**
   * Simulate network issues across all providers
   */
  simulateNetworkIssues(
    providers: MockProvider[],
    errorType: 'connection' | 'timeout' = 'connection'
  ): void {
    providers.forEach(provider => provider.simulateError(errorType));
  },

  /**
   * Add latency to all providers
   */
  addLatency(providers: MockProvider[], latencyMs: number): void {
    providers.forEach(provider => provider.setLatency(latencyMs));
  },

  /**
   * Get combined metrics from multiple providers
   */
  getCombinedMetrics(providers: MockProvider[]) {
    const allMetrics = providers.map(provider => provider.getMetrics());

    return {
      totalProviders: providers.length,
      totalCalls: allMetrics.reduce(
        (sum, metrics) => sum + metrics.totalCalls,
        0
      ),
      averageLatency:
        allMetrics.reduce((sum, metrics) => sum + metrics.averageLatency, 0) /
        allMetrics.length,
      overallErrorRate:
        allMetrics.reduce((sum, metrics) => sum + metrics.errorRate, 0) /
        allMetrics.length,
      providerMetrics: allMetrics,
    };
  },

  /**
   * Reset all providers managed by factory
   */
  resetAllProviders(): void {
    MockProviderFactory.resetAll();
  },

  /**
   * Clear all providers (cleanup)
   */
  cleanup(): void {
    MockProviderFactory.clear();
  },
};
