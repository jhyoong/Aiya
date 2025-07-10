import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { MockProviderFactory } from '@tests/mocks/providers/mock-factory'
import { TEST_CONFIGS } from '@tests/utils/config-builder'

describe('Provider Factory Tests', () => {
  afterEach(() => {
    MockProviderFactory.clear()
  })

  describe('Provider Creation', () => {
    test('should create Ollama provider', () => {
      const provider = MockProviderFactory.create(TEST_CONFIGS.ollama.basic)
      expect(provider.providerType).toBe('ollama')
      expect(provider.config.type).toBe('ollama')
    })

    test('should create OpenAI provider', () => {
      const provider = MockProviderFactory.create(TEST_CONFIGS.openai.gpt4)
      expect(provider.providerType).toBe('openai')
      expect(provider.config.type).toBe('openai')
    })

    test('should create Gemini provider', () => {
      const config = {
        type: 'gemini' as const,
        model: 'gemini-2.5-flash',
        apiKey: 'AIza-test-key',
        capabilities: {
          maxTokens: 1048576,
          supportsFunctionCalling: true,
          supportsVision: true,
          supportsStreaming: true,
          supportsThinking: true
        }
      }
      
      const provider = MockProviderFactory.create(config)
      expect(provider.providerType).toBe('gemini')
      expect(provider.config.type).toBe('gemini')
    })

    test('should reuse existing providers', () => {
      const config = TEST_CONFIGS.ollama.basic
      const provider1 = MockProviderFactory.create(config)
      const provider2 = MockProviderFactory.create(config)
      
      expect(provider1).toBe(provider2)
    })

    test('should create different providers for different configs', () => {
      const provider1 = MockProviderFactory.create(TEST_CONFIGS.ollama.basic)
      const provider2 = MockProviderFactory.create(TEST_CONFIGS.openai.gpt4)
      
      expect(provider1).not.toBe(provider2)
      expect(provider1.providerType).toBe('ollama')
      expect(provider2.providerType).toBe('openai')
    })

    test('should throw error for unsupported provider types', () => {
      const invalidConfig = {
        type: 'invalid-provider' as any,
        model: 'test-model'
      }
      
      expect(() => MockProviderFactory.create(invalidConfig))
        .toThrow(/Unsupported provider type/)
    })

    test('should throw error for unimplemented providers', () => {
      const anthropicConfig = {
        type: 'anthropic' as const,
        model: 'claude-3-5-sonnet',
        apiKey: 'sk-ant-test'
      }
      
      expect(() => MockProviderFactory.create(anthropicConfig))
        .toThrow(/not implemented yet/)
    })
  })

  describe('Test Scenarios', () => {
    test('should create Ollama scenarios', async () => {
      const healthy = await MockProviderFactory.createScenario('ollama', 'healthy')
      const offline = await MockProviderFactory.createScenario('ollama', 'offline')
      
      expect(healthy.providerType).toBe('ollama')
      expect(offline.providerType).toBe('ollama')
    })

    test('should create OpenAI scenarios', async () => {
      const healthy = await MockProviderFactory.createScenario('openai', 'healthy')
      const invalidKey = await MockProviderFactory.createScenario('openai', 'invalidApiKey')
      
      expect(healthy.providerType).toBe('openai')
      expect(invalidKey.providerType).toBe('openai')
    })

    test('should create Gemini scenarios', async () => {
      const healthy = await MockProviderFactory.createScenario('gemini', 'healthy')
      const thinking = await MockProviderFactory.createScenario('gemini', 'withThinking')
      
      expect(healthy.providerType).toBe('gemini')
      expect(thinking.providerType).toBe('gemini')
    })

    test('should handle custom scenario parameters', async () => {
      const customEndpoint = await MockProviderFactory.createScenario('ollama', 'customEndpoint', 'http://test:11434')
      expect(customEndpoint.config.baseUrl).toBe('http://test:11434')
      
      const openaiCustom = await MockProviderFactory.createScenario('openai', 'customEndpoint', 'https://api.perplexity.ai')
      expect(openaiCustom.config.baseUrl).toBe('https://api.perplexity.ai')
    })

    test('should throw error for unknown scenarios', async () => {
      await expect(MockProviderFactory.createScenario('ollama', 'unknownScenario'))
        .rejects.toThrow(/Unknown Ollama scenario/)
      
      await expect(MockProviderFactory.createScenario('openai', 'unknownScenario'))
        .rejects.toThrow(/Unknown OpenAI scenario/)
      
      await expect(MockProviderFactory.createScenario('gemini', 'unknownScenario'))
        .rejects.toThrow(/Unknown Gemini scenario/)
    })

    test('should throw error for unimplemented provider scenarios', async () => {
      await expect(MockProviderFactory.createScenario('anthropic', 'healthy'))
        .rejects.toThrow(/scenarios not implemented yet/)
    })
  })

  describe('Factory Management', () => {
    test('should track all created providers', () => {
      MockProviderFactory.create(TEST_CONFIGS.ollama.basic)
      MockProviderFactory.create(TEST_CONFIGS.openai.gpt4)
      
      const providers = MockProviderFactory.getAllProviders()
      expect(providers).toHaveLength(2)
    })

    test('should clear all providers', () => {
      MockProviderFactory.create(TEST_CONFIGS.ollama.basic)
      MockProviderFactory.create(TEST_CONFIGS.openai.gpt4)
      
      expect(MockProviderFactory.getAllProviders()).toHaveLength(2)
      
      MockProviderFactory.clear()
      expect(MockProviderFactory.getAllProviders()).toHaveLength(0)
    })

    test('should reset all providers', () => {
      const provider = MockProviderFactory.create(TEST_CONFIGS.ollama.basic)
      provider.setLatency(1000)
      
      MockProviderFactory.resetAll()
      
      // Provider should be reset (this tests the reset functionality)
      expect(provider.getMetrics().totalCalls).toBe(0)
    })

    test('should get provider by configuration', () => {
      const config = TEST_CONFIGS.ollama.basic
      const provider = MockProviderFactory.create(config)
      
      const retrieved = MockProviderFactory.get(config)
      expect(retrieved).toBe(provider)
    })

    test('should return undefined for non-existent provider', () => {
      const nonExistentConfig = {
        type: 'ollama' as const,
        model: 'non-existent-model',
        baseUrl: 'http://nowhere:11434'
      }
      
      const retrieved = MockProviderFactory.get(nonExistentConfig)
      expect(retrieved).toBeUndefined()
    })
  })

  describe('Provider Key Generation', () => {
    test('should generate unique keys for different configurations', () => {
      const config1 = TEST_CONFIGS.ollama.basic
      const config2 = TEST_CONFIGS.ollama.withCustomEndpoint
      const config3 = TEST_CONFIGS.openai.gpt4
      
      const provider1 = MockProviderFactory.create(config1)
      const provider2 = MockProviderFactory.create(config2)
      const provider3 = MockProviderFactory.create(config3)
      
      expect(provider1).not.toBe(provider2) // Different base URLs
      expect(provider1).not.toBe(provider3) // Different provider types
      expect(provider2).not.toBe(provider3) // Different everything
    })

    test('should distinguish authenticated vs anonymous providers', () => {
      const anonymousConfig = {
        type: 'ollama' as const,
        model: 'test-model',
        baseUrl: 'http://localhost:11434'
      }
      
      const authenticatedConfig = {
        type: 'openai' as const,
        model: 'gpt-4o-mini',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test-key'
      }
      
      const provider1 = MockProviderFactory.create(anonymousConfig)
      const provider2 = MockProviderFactory.create(authenticatedConfig)
      
      expect(provider1).not.toBe(provider2)
      expect(provider1.config.apiKey).toBeUndefined()
      expect(provider2.config.apiKey).toBeTruthy()
    })
  })

  describe('Concurrent Provider Operations', () => {
    test('should handle concurrent provider creation', () => {
      const configs = [
        TEST_CONFIGS.ollama.basic,
        TEST_CONFIGS.openai.gpt4,
        {
          type: 'gemini' as const,
          model: 'gemini-2.5-flash',
          apiKey: 'AIza-test-key'
        }
      ]
      
      const providers = configs.map(config => MockProviderFactory.create(config))
      
      expect(providers).toHaveLength(3)
      expect(providers[0].providerType).toBe('ollama')
      expect(providers[1].providerType).toBe('openai')
      expect(providers[2].providerType).toBe('gemini')
    })

    test('should handle concurrent scenario creation', async () => {
      const scenarios = await Promise.all([
        MockProviderFactory.createScenario('ollama', 'healthy'),
        MockProviderFactory.createScenario('openai', 'healthy'),
        MockProviderFactory.createScenario('gemini', 'healthy')
      ])
      
      expect(scenarios).toHaveLength(3)
      scenarios.forEach(provider => {
        expect(provider.providerType).toMatch(/ollama|openai|gemini/)
      })
    })
  })

  describe('Provider Capability Validation', () => {
    test('should create providers with correct capabilities', () => {
      const ollamaProvider = MockProviderFactory.create(TEST_CONFIGS.ollama.basic)
      const openaiProvider = MockProviderFactory.create(TEST_CONFIGS.openai.gpt4)
      const geminiProvider = MockProviderFactory.create({
        type: 'gemini' as const,
        model: 'gemini-2.5-flash',
        apiKey: 'AIza-test-key',
        capabilities: {
          maxTokens: 1048576,
          supportsFunctionCalling: true,
          supportsVision: true,
          supportsStreaming: true,
          supportsThinking: true
        }
      })
      
      // Verify Ollama capabilities
      expect(ollamaProvider.supportsVision()).toBe(false)
      expect(ollamaProvider.supportsThinking()).toBe(false)
      expect(ollamaProvider.supportsFunctionCalling()).toBe(true)
      expect(ollamaProvider.supportsStreaming()).toBe(true)
      
      // Verify OpenAI capabilities
      expect(openaiProvider.supportsVision()).toBe(true)
      expect(openaiProvider.supportsThinking()).toBe(false)
      expect(openaiProvider.supportsFunctionCalling()).toBe(true)
      expect(openaiProvider.supportsStreaming()).toBe(true)
      
      // Verify Gemini capabilities
      expect(geminiProvider.supportsVision()).toBe(true)
      expect(geminiProvider.supportsThinking()).toBe(true)
      expect(geminiProvider.supportsFunctionCalling()).toBe(true)
      expect(geminiProvider.supportsStreaming()).toBe(true)
    })

    test('should handle capability overrides', () => {
      const customProvider = MockProviderFactory.create({
        type: 'ollama' as const,
        model: 'test-model',
        baseUrl: 'http://localhost:11434',
        capabilities: {
          maxTokens: 8192,
          supportsFunctionCalling: false, // Override default
          supportsVision: true, // Override default
          supportsStreaming: true,
          supportsThinking: false
        }
      })
      
      expect(customProvider.supportsFunctionCalling()).toBe(false)
      expect(customProvider.supportsVision()).toBe(true) // Overridden from false to true
    })
  })
})