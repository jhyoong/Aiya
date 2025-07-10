import { ProviderTestSuite } from './base-provider-test'
import { createMockOpenAIProvider, OPENAI_TEST_SCENARIOS } from '@tests/mocks/providers/mock-openai'
import type { MockProvider } from '@tests/mocks/providers/base-mock-provider'
import type { ExtendedProviderConfig } from '@/core/config/manager'
import { TEST_CONFIGS } from '@tests/utils/config-builder'

class OpenAITestSuite extends ProviderTestSuite {
  readonly providerType = 'openai'
  readonly testConfig = TEST_CONFIGS.openai.gpt4

  createMockProvider(config?: Partial<ExtendedProviderConfig>): MockProvider {
    return createMockOpenAIProvider(config)
  }

  protected testProviderSpecificFeatures(getProvider: () => MockProvider): void {
    describe('OpenAI-Specific Features', () => {
      test('should require valid API key format', () => {
        const provider = getProvider()
        expect(provider.config.apiKey).toMatch(/^sk-/)
      })

      test('should support vision capabilities', () => {
        const provider = getProvider()
        if (provider.supportsVision()) {
          expect(['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo']).toContain(provider.config.model)
        }
      })

      test('should handle vision input', async () => {
        const provider = getProvider()
        if (provider.supportsVision()) {
          const messages = [{ role: 'user' as const, content: 'Describe this [image]' }]
          const response = await provider.chat(messages)
          
          expect(response.content).toMatch(/image/i)
          expect(response.content).toMatch(/image|visual|shows/i)
        }
      })

      test('should handle invalid API key', async () => {
        const invalidProvider = OPENAI_TEST_SCENARIOS.invalidApiKey()
        await expect(invalidProvider.chat([{ role: 'user', content: 'test' }]))
          .rejects.toThrow(/authentication/i)
      })

      test('should handle quota exceeded', async () => {
        const quotaProvider = OPENAI_TEST_SCENARIOS.quotaExceeded()
        await expect(quotaProvider.chat([{ role: 'user', content: 'test' }]))
          .rejects.toThrow(/rate limit/i)
      })

      test('should support custom endpoints', () => {
        const customProvider = OPENAI_TEST_SCENARIOS.customEndpoint('https://api.perplexity.ai')
        expect(customProvider.config.baseUrl).toBe('https://api.perplexity.ai')
      })

      test('should have accurate token counting', async () => {
        const provider = getProvider()
        const messages = [{ role: 'user' as const, content: 'Test message for tokens' }]
        const response = await provider.chat(messages)
        
        // OpenAI should provide exact token counts
        expect(response.usage?.promptTokens).toBeDefined()
        expect(response.usage?.completionTokens).toBeDefined()
        expect(response.usage?.input).toBeDefined()
        expect(response.usage?.output).toBeDefined()
        
        // OpenAI uses more sophisticated token counting
        expect(response.usage!.input).toBeGreaterThan(0)
        expect(response.usage!.output).toBeGreaterThan(0)
      })

      test('should support token-based streaming', async () => {
        const provider = getProvider()
        const messages = [{ role: 'user' as const, content: 'Stream this response token by token' }]
        const chunks: any[] = []
        
        for await (const chunk of provider.streamChat(messages)) {
          chunks.push(chunk)
        }
        
        const contentChunks = chunks.filter(c => c.type === 'content')
        expect(contentChunks.length).toBeGreaterThan(0) // OpenAI should stream content
        
        // Verify progressive content building
        contentChunks.forEach((chunk, index) => {
          expect(chunk.delta).toBeTruthy()
          if (index > 0) {
            expect(chunk.content.length).toBeGreaterThanOrEqual(contentChunks[index - 1].content.length)
          }
        })
      })

      test('should provide OpenAI-specific metrics', () => {
        const provider = this.createMockProvider() as any
        if (typeof provider.getOpenAIMetrics === 'function') {
          const metrics = provider.getOpenAIMetrics()
          
          expect(metrics.modelsAvailable).toBeGreaterThan(0)
          expect(metrics.visionSupported).toBe(true)
          expect(metrics.apiKeyValid).toBe(true)
        }
      })

      test('should support different model variants', async () => {
        const provider = getProvider()
        const models = await provider.listModels()
        
        // Should have GPT-4 variants
        const modelIds = models.map(m => m.id)
        expect(modelIds).toContain('gpt-4o')
        expect(modelIds).toContain('gpt-4o-mini')
        expect(modelIds).toContain('gpt-4-turbo')
        
        // All models should support vision and function calling
        models.forEach(model => {
          expect(model.capabilities.vision).toBe(true)
          expect(model.capabilities.functionCalling).toBe(true)
          expect(model.capabilities.thinking).toBe(false) // OpenAI doesn't support thinking tags
          expect(model.contextLength).toBe(128000) // Common OpenAI context length
        })
      })

      test('should handle vision-specific responses', async () => {
        const visionProvider = OPENAI_TEST_SCENARIOS.withVision()
        const messages = [{ 
          role: 'user' as const, 
          content: 'What do you see in this image: [image]' 
        }]
        
        const response = await visionProvider.chat(messages)
        
        expect(response.content).toMatch(/(image|see|looking|appears)/i)
        expect(response.content.length).toBeGreaterThan(20)
      })

      test('should handle API rate limiting gracefully', async () => {
        const provider = this.createMockProvider()
        provider.simulateError('rate_limit')
        
        await expect(provider.chat([{ role: 'user', content: 'test' }]))
          .rejects.toThrow(/rate limit|quota/i)
        
        // Should recover after clearing error
        provider.clearError()
        const response = await provider.chat([{ role: 'user', content: 'recovery test' }])
        expect(response.content).toBeTruthy()
      })

      test('should validate different API key formats', () => {
        const validKeys = ['sk-test123', 'sk-abc123def456', 'sk-1234567890']
        const invalidKeys = ['api-key', 'test-key', '123456']
        
        validKeys.forEach(key => {
          const provider = createMockOpenAIProvider({ apiKey: key })
          expect(provider.config.apiKey).toMatch(/^sk-/)
        })
        
        invalidKeys.forEach(key => {
          const provider = createMockOpenAIProvider({ apiKey: key })
          provider.simulateError('authentication')
          expect(async () => {
            await provider.chat([{ role: 'user', content: 'test' }])
          }).rejects.toThrow()
        })
      })

      test('should support custom OpenAI-compatible endpoints', async () => {
        const endpoints = [
          'https://api.perplexity.ai',
          'https://api.together.xyz/v1',
          'http://localhost:8080/v1'
        ]
        
        endpoints.forEach(endpoint => {
          const provider = OPENAI_TEST_SCENARIOS.customEndpoint(endpoint)
          expect(provider.config.baseUrl).toBe(endpoint)
        })
      })
    })
  }
}

// Run the test suite
const openaiTests = new OpenAITestSuite()
openaiTests.runProviderTests()