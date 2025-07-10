import { BaseMockProvider, type MockMessage, type MockChatResponse, type MockStreamChunk, type MockModel } from './base-mock-provider'
import type { ExtendedProviderConfig } from '@/core/config/manager'

export class MockGeminiProvider extends BaseMockProvider {
  private static readonly GEMINI_MODELS: MockModel[] = [
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      contextLength: 1048576,
      capabilities: {
        vision: true,
        functionCalling: true,
        thinking: true
      }
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      contextLength: 2097152,
      capabilities: {
        vision: true,
        functionCalling: true,
        thinking: false
      }
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      contextLength: 1048576,
      capabilities: {
        vision: true,
        functionCalling: true,
        thinking: false
      }
    }
  ]

  constructor(config: ExtendedProviderConfig) {
    super(config, 'gemini')
    
    this.setResponsePattern({
      style: 'analytical',
      averageLength: 220,
      includeThinking: true,
      errorProbability: 0.02
    })
  }

  async chat(messages: MockMessage[]): Promise<MockChatResponse> {
    return this.recordCall('chat', [messages], async () => {
      this.validateApiKey()
      
      const lastMessage = messages[messages.length - 1]
      let content = this.generateResponseContent(lastMessage.content)
      let thinking = ''
      
      // Generate thinking content for 2.5+ models
      if (this.supportsThinking() && this.config.model.includes('2.5')) {
        thinking = this.generateThinkingContent(lastMessage.content)
      }
      
      // Simulate vision capabilities
      if (this.supportsVision() && this.containsImageContent(lastMessage.content)) {
        content = this.generateVisionResponse(lastMessage.content)
      }
      
      const usage = this.calculateGeminiTokenUsage(
        messages.map(m => m.content).join(' '),
        content
      )

      const response: MockChatResponse = {
        content,
        usage,
        model: this.config.model,
        timestamp: new Date().toISOString()
      }
      
      if (thinking) {
        response.thinking = thinking
      }
      
      return response
    })
  }

  async *streamChat(messages: MockMessage[]): AsyncIterable<MockStreamChunk> {
    this.validateApiKey()
    
    const response = await this.chat(messages)
    
    yield { type: 'start' }
    
    // Send thinking first if available
    if (response.thinking) {
      yield {
        type: 'thinking',
        content: response.thinking
      }
    }
    
    // Simulate sentence-based streaming (Gemini style)
    const sentences = response.content.split(/([.!?]+\\s*)/)
    for (let i = 0; i < sentences.length; i += 2) {
      await this.delay(100)
      
      const sentence = sentences[i] + (sentences[i + 1] || '')
      yield {
        type: 'content',
        delta: sentence,
        content: sentences.slice(0, i + 2).join('')
      }
    }
    
    yield {
      type: 'end',
      usage: response.usage
    }
  }

  async listModels(): Promise<MockModel[]> {
    return this.recordCall('listModels', [], async () => {
      this.validateApiKey()
      return MockGeminiProvider.GEMINI_MODELS
    })
  }

  async getModel(modelId: string): Promise<MockModel> {
    return this.recordCall('getModel', [modelId], async () => {
      this.validateApiKey()
      
      const model = MockGeminiProvider.GEMINI_MODELS.find(m => m.id === modelId)
      if (!model) {
        throw this.createError('model_not_found')
      }
      
      return model
    })
  }

  /**
   * Gemini-specific functionality
   */
  private validateApiKey(): void {
    if (!this.config.apiKey) {
      throw this.createError('authentication')
    }
    
    if (!this.config.apiKey.startsWith('AIza')) {
      throw this.createError('authentication')
    }
  }

  private containsImageContent(content: string): boolean {
    return /\[image\]|\[img\]|image:|data:image\//.test(content.toLowerCase())
  }

  private generateVisionResponse(content: string): string {
    const visionPrefixes = [
      'Analyzing this image, I can see',
      'The visual content shows',
      'Examining the image reveals',
      'This image depicts'
    ]
    
    const prefix = visionPrefixes[Math.floor(Math.random() * visionPrefixes.length)]
    return `${prefix} ${this.generateResponseContent(content)}`
  }

  private calculateGeminiTokenUsage(input: string, output: string): MockChatResponse['usage'] {
    // Gemini token calculation (roughly 1 token per character)
    const inputTokens = Math.ceil(input.length / 4)
    const outputTokens = Math.ceil(output.length / 4)

    return {
      input: inputTokens,
      output: outputTokens,
      promptTokens: inputTokens,
      completionTokens: outputTokens
    }
  }

  /**
   * Simulate Gemini-specific errors
   */
  simulateInvalidApiKey(): void {
    this.config.apiKey = 'invalid-key'
  }

  simulateContextTooLong(): void {
    this.simulateError('context_too_long')
  }

  /**
   * Get Gemini-specific metrics
   */
  getGeminiMetrics() {
    const baseMetrics = this.getMetrics()
    
    return {
      ...baseMetrics,
      modelsAvailable: MockGeminiProvider.GEMINI_MODELS.length,
      maxContextLength: Math.max(...MockGeminiProvider.GEMINI_MODELS.map(m => m.contextLength)),
      thinkingSupported: this.supportsThinking(),
      apiKeyValid: this.config.apiKey?.startsWith('AIza') ?? false
    }
  }
}

export function createMockGeminiProvider(overrides: Partial<ExtendedProviderConfig> = {}): MockGeminiProvider {
  const defaultConfig: ExtendedProviderConfig = {
    type: 'gemini',
    model: 'gemini-2.5-flash',
    apiKey: 'AIza-test-key-123',
    capabilities: {
      maxTokens: 1048576,
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsThinking: true
    },
    costPerToken: { input: 0.00125, output: 0.005 }
  }

  const config = { ...defaultConfig, ...overrides }
  return new MockGeminiProvider(config)
}

export const GEMINI_TEST_SCENARIOS = {
  healthy: () => createMockGeminiProvider(),
  
  withThinking: () => createMockGeminiProvider({
    model: 'gemini-2.5-flash'
  }),
  
  largeContext: () => createMockGeminiProvider({
    model: 'gemini-1.5-pro',
    capabilities: { maxTokens: 2097152 }
  }),
  
  invalidApiKey: () => {
    const provider = createMockGeminiProvider({ apiKey: 'invalid-key' })
    provider.simulateInvalidApiKey()
    return provider
  },
  
  contextTooLong: () => {
    const provider = createMockGeminiProvider()
    provider.simulateContextTooLong()
    return provider
  }
}