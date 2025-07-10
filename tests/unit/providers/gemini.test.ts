import { ProviderTestSuite } from './base-provider-test'
import { createMockGeminiProvider, GEMINI_TEST_SCENARIOS } from '@tests/mocks/providers/mock-gemini'
import type { MockProvider } from '@tests/mocks/providers/base-mock-provider'
import type { ExtendedProviderConfig } from '@/core/config/manager'
import { TEST_CONFIGS } from '@tests/utils/config-builder'

class GeminiTestSuite extends ProviderTestSuite {
  readonly providerType = 'gemini'
  readonly testConfig = TEST_CONFIGS.gemini?.claude || this.createTestConfig()

  createMockProvider(config?: Partial<ExtendedProviderConfig>): MockProvider {
    return createMockGeminiProvider(config)
  }

  private createTestConfig(): ExtendedProviderConfig {
    return {
      type: 'gemini',
      model: 'gemini-2.5-flash',
      apiKey: 'AIza-test-key-123',
      capabilities: {
        maxTokens: 1048576,
        supportsFunctionCalling: true,
        supportsVision: true,
        supportsStreaming: true,
        supportsThinking: true
      }
    }
  }

  protected testProviderSpecificFeatures(getProvider: () => MockProvider): void {
    describe('Gemini-Specific Features', () => {
      test('should require valid API key format', () => {
        expect(getProvider().config.apiKey).toMatch(/^AIza/)
      })

      test('should support massive context windows', () => {
        const contextLength = getProvider().config.capabilities?.maxTokens
        expect(contextLength).toBeGreaterThan(500000) // Should be >500K tokens
      })

      test('should support thinking mode for 2.5+ models', async () => {
        if (getProvider().config.model.includes('2.5')) {
          const messages = [{ role: 'user' as const, content: 'Solve this complex problem step by step' }]
          const response = await getProvider().chat(messages)
          
          if (getProvider().supportsThinking()) {
            expect(response.thinking).toBeDefined()
            expect(response.thinking).toBeTruthy()
            expect(response.thinking).toContain('analyze')
          }
        }
      })

      test('should handle vision input', async () => {
        if (getProvider().supportsVision()) {
          const messages = [{ role: 'user' as const, content: 'Analyze this [image]' }]
          const response = await getProvider().chat(messages)
          
          expect(response.content).toMatch(/image|visual|analyzing/i)
        }
      })

      test('should handle invalid API key', async () => {
        const invalidProvider = GEMINI_TEST_SCENARIOS.invalidApiKey()
        await expect(invalidProvider.chat([{ role: 'user', content: 'test' }]))
          .rejects.toThrow(/authentication/i)
      })

      test('should handle large context efficiently', async () => {
        const largeProvider = GEMINI_TEST_SCENARIOS.largeContext()
        const largeContent = 'x'.repeat(10000)
        const messages = [{ role: 'user' as const, content: largeContent }]
        
        const response = await largeProvider.chat(messages)
        expect(response.content).toBeTruthy()
        expect(response.usage?.input).toBeGreaterThan(1000) // Should count many tokens
      })

      test('should stream with thinking content', async () => {
        if (getProvider().supportsThinking()) {
          const messages = [{ role: 'user' as const, content: 'Think through this problem' }]
          const chunks: any[] = []
          
          for await (const chunk of getProvider().streamChat(messages)) {
            chunks.push(chunk)
          }
          
          const thinkingChunks = chunks.filter(c => c.type === 'thinking')
          if (getProvider().config.model.includes('2.5')) {
            expect(thinkingChunks.length).toBeGreaterThan(0)
            thinkingChunks.forEach(chunk => {
              expect(chunk.content).toBeTruthy()
            })
          }
        }
      })

      test('should use sentence-based streaming', async () => {
        const messages = [{ role: 'user' as const, content: 'Tell me about artificial intelligence. It\'s fascinating. How does it work?' }]
        const chunks: any[] = []
        
        for await (const chunk of getProvider().streamChat(messages)) {
          chunks.push(chunk)
        }
        
        const contentChunks = chunks.filter(c => c.type === 'content')
        
        // Gemini should stream in larger sentence chunks, not individual tokens
        expect(contentChunks.length).toBeLessThan(20) // Fewer chunks than token-based streaming
        expect(contentChunks.length).toBeGreaterThan(0) // At least one content chunk
        
        // Verify sentence-like deltas
        contentChunks.forEach(chunk => {
          if (chunk.delta) {
            expect(chunk.delta.length).toBeGreaterThan(5) // Sentences are longer than individual tokens
          }
        })
      })

      test('should provide Gemini-specific metrics', () => {
        const provider = this.createMockProvider() as any
        if (typeof provider.getGeminiMetrics === 'function') {
          const metrics = provider.getGeminiMetrics()
          
          expect(metrics.modelsAvailable).toBeGreaterThan(0)
          expect(metrics.maxContextLength).toBeGreaterThan(1000000) // Should be >1M tokens
          expect(metrics.thinkingSupported).toBe(true)
          expect(metrics.apiKeyValid).toBe(true)
        }
      })

      test('should support different model generations', async () => {
        const models = await getProvider().listModels()
        
        // Should have different Gemini model versions
        const modelIds = models.map(m => m.id)
        expect(modelIds).toContain('gemini-2.5-flash')
        expect(modelIds).toContain('gemini-1.5-pro')
        expect(modelIds).toContain('gemini-1.5-flash')
        
        // Verify model capabilities
        const flash25 = models.find(m => m.id === 'gemini-2.5-flash')
        const pro15 = models.find(m => m.id === 'gemini-1.5-pro')
        
        if (flash25) {
          expect(flash25.capabilities.thinking).toBe(true) // 2.5+ supports thinking
          expect(flash25.contextLength).toBeGreaterThan(1000000)
        }
        
        if (pro15) {
          expect(pro15.capabilities.thinking).toBe(false) // 1.5 doesn't support thinking
          expect(pro15.contextLength).toBeGreaterThan(1000000)
        }
      })

      test('should handle context length errors', async () => {
        const provider = GEMINI_TEST_SCENARIOS.contextTooLong()
        await expect(provider.chat([{ role: 'user', content: 'test' }]))
          .rejects.toThrow(/context/i)
      })

      test('should support multimodal capabilities', async () => {
        if (getProvider().supportsVision()) {
          const multimodalMessages = [{ 
            role: 'user' as const, 
            content: 'Describe this image and explain the code: [image] print("hello world")' 
          }]
          
          const response = await getProvider().chat(multimodalMessages)
          
          expect(response.content).toMatch(/(image|visual|code|print)/i)
          expect(response.content.length).toBeGreaterThan(50) // Should provide detailed analysis
        }
      })

      test('should validate API key format variations', () => {
        const validKeys = ['AIza123abc', 'AIzaSyTest123', 'AIzaAbCdEf']
        const invalidKeys = ['sk-test', 'api-key', 'gemini-key']
        
        validKeys.forEach(key => {
          const provider = createMockGeminiProvider({ apiKey: key })
          expect(provider.config.apiKey).toMatch(/^AIza/)
        })
        
        invalidKeys.forEach(key => {
          const provider = createMockGeminiProvider({ apiKey: key })
          provider.simulateError('authentication')
          expect(async () => {
            await provider.chat([{ role: 'user', content: 'test' }])
          }).rejects.toThrow()
        })
      })

      test('should handle thinking workflow correctly', async () => {
        const thinkingProvider = GEMINI_TEST_SCENARIOS.withThinking()
        const complexPrompt = 'Solve this step by step: What is the optimal solution for this complex algorithmic problem?'
        
        const response = await thinkingProvider.chat([{ role: 'user', content: complexPrompt }])
        
        if (response.thinking) {
          expect(response.thinking).toContain('analyze')
          expect(response.thinking.length).toBeGreaterThan(20)
          expect(response.content).toBeTruthy()
          expect(response.content).not.toBe(response.thinking) // Content should be different from thinking
        }
      })

      test('should support ultra-large contexts', async () => {
        const largeProvider = GEMINI_TEST_SCENARIOS.largeContext()
        
        // Test with very large input
        const ultraLargeContent = 'Context: ' + 'word '.repeat(50000) // ~200K characters
        const messages = [{ role: 'user' as const, content: ultraLargeContent }]
        
        const response = await largeProvider.chat(messages)
        expect(response.content).toBeTruthy()
        
        // Should handle large context gracefully
        expect(response.usage?.input).toBeGreaterThan(10000) // Many tokens consumed
        expect(response.model).toBe('gemini-1.5-pro') // Large context model
      })
    })
  }
}

// Run the test suite
const geminiTests = new GeminiTestSuite()
geminiTests.runProviderTests()