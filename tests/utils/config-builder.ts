import type { ExtendedProviderConfig } from '@/core/config/manager';

/**
 * Test configuration builder utility for creating test configurations
 */
export class TestConfigBuilder {
  private config: Partial<ExtendedProviderConfig> = {};

  /**
   * Create a new test configuration builder
   */
  static create(): TestConfigBuilder {
    return new TestConfigBuilder();
  }

  /**
   * Set the provider type
   */
  withProvider(type: ExtendedProviderConfig['type']): TestConfigBuilder {
    this.config.type = type;
    return this;
  }

  /**
   * Set the model
   */
  withModel(model: string): TestConfigBuilder {
    this.config.model = model;
    return this;
  }

  /**
   * Set the base URL
   */
  withBaseUrl(baseUrl: string): TestConfigBuilder {
    this.config.baseUrl = baseUrl;
    return this;
  }

  /**
   * Set the API key
   */
  withApiKey(apiKey: string): TestConfigBuilder {
    this.config.apiKey = apiKey;
    return this;
  }

  /**
   * Set capabilities
   */
  withCapabilities(
    capabilities: Partial<ExtendedProviderConfig['capabilities']>
  ): TestConfigBuilder {
    this.config.capabilities = {
      ...this.config.capabilities,
      ...capabilities,
    };
    return this;
  }

  /**
   * Set cost per token
   */
  withCostPerToken(input: number, output: number): TestConfigBuilder {
    this.config.costPerToken = { input, output };
    return this;
  }

  /**
   * Build and return the configuration
   */
  build(): ExtendedProviderConfig {
    if (!this.config.type) {
      throw new Error('Provider type is required');
    }
    if (!this.config.model) {
      throw new Error('Model is required');
    }

    // Set defaults based on provider type
    const defaults = this.getProviderDefaults(this.config.type);

    return {
      ...defaults,
      ...this.config,
      capabilities: {
        ...defaults.capabilities,
        ...this.config.capabilities,
      },
    } as ExtendedProviderConfig;
  }

  /**
   * Build multiple configurations for testing
   */
  buildMultiple(count: number): ExtendedProviderConfig[] {
    const configs: ExtendedProviderConfig[] = [];
    for (let i = 0; i < count; i++) {
      configs.push(this.build());
    }
    return configs;
  }

  /**
   * Get default configuration for a provider type
   */
  private getProviderDefaults(
    type: ExtendedProviderConfig['type']
  ): Partial<ExtendedProviderConfig> {
    switch (type) {
      case 'ollama':
        return {
          baseUrl: 'http://localhost:11434',
          capabilities: {
            maxTokens: 4096,
            supportsFunctionCalling: true,
            supportsVision: false,
            supportsStreaming: true,
            supportsThinking: false,
          },
        };

      case 'openai':
        return {
          baseUrl: 'https://api.openai.com/v1',
          capabilities: {
            maxTokens: 128000,
            supportsFunctionCalling: true,
            supportsVision: true,
            supportsStreaming: true,
            supportsThinking: false,
          },
          costPerToken: { input: 0.00015, output: 0.0006 },
        };

      case 'anthropic':
        return {
          capabilities: {
            maxTokens: 200000,
            supportsFunctionCalling: true,
            supportsVision: true,
            supportsStreaming: true,
            supportsThinking: true,
          },
          costPerToken: { input: 0.003, output: 0.015 },
        };

      case 'azure':
        return {
          capabilities: {
            maxTokens: 128000,
            supportsFunctionCalling: true,
            supportsVision: true,
            supportsStreaming: true,
            supportsThinking: false,
          },
        };

      case 'gemini':
        return {
          capabilities: {
            maxTokens: 1048576,
            supportsFunctionCalling: true,
            supportsVision: true,
            supportsStreaming: true,
            supportsThinking: true,
          },
          costPerToken: { input: 0.00125, output: 0.005 },
        };

      case 'bedrock':
        return {
          capabilities: {
            maxTokens: 200000,
            supportsFunctionCalling: true,
            supportsVision: true,
            supportsStreaming: true,
            supportsThinking: true,
          },
        };

      default:
        return {};
    }
  }
}

/**
 * Predefined test configurations for common scenarios
 */
export const TEST_CONFIGS = {
  ollama: {
    basic: TestConfigBuilder.create()
      .withProvider('ollama')
      .withModel('qwen2.5:8b')
      .build(),

    withCustomEndpoint: TestConfigBuilder.create()
      .withProvider('ollama')
      .withModel('llama3.2:3b')
      .withBaseUrl('http://custom-ollama:11434')
      .build(),
  },

  openai: {
    gpt4: TestConfigBuilder.create()
      .withProvider('openai')
      .withModel('gpt-4o-mini')
      .withApiKey('sk-test-key-123')
      .build(),

    gpt4Vision: TestConfigBuilder.create()
      .withProvider('openai')
      .withModel('gpt-4o')
      .withApiKey('sk-test-key-123')
      .withCapabilities({ supportsVision: true })
      .build(),
  },

  anthropic: {
    claude: TestConfigBuilder.create()
      .withProvider('anthropic')
      .withModel('claude-3-5-sonnet-20241022')
      .withApiKey('sk-ant-test-key-123')
      .build(),
  },

  multiProvider: [
    TestConfigBuilder.create()
      .withProvider('ollama')
      .withModel('qwen2.5:8b')
      .build(),
    TestConfigBuilder.create()
      .withProvider('openai')
      .withModel('gpt-4o-mini')
      .withApiKey('sk-test-key-123')
      .build(),
  ],
};

/**
 * Generate invalid configurations for error testing
 */
export const INVALID_CONFIGS = {
  missingProvider: {
    model: 'test-model',
  },

  missingModel: {
    type: 'ollama' as const,
  },

  invalidProvider: {
    type: 'invalid-provider' as any,
    model: 'test-model',
  },

  malformedApiKey: {
    type: 'openai' as const,
    model: 'gpt-4o-mini',
    apiKey: 'invalid-key-format',
  },
};
