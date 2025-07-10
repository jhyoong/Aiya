import type { ExtendedProviderConfig } from '@/core/config/manager'

/**
 * Types for mock provider system
 */

export interface MockMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
}

export interface MockChatResponse {
  content: string
  usage?: {
    input?: number
    output?: number
    promptTokens?: number
    completionTokens?: number
  }
  model: string
  timestamp: string
  thinking?: string
}

export interface MockStreamChunk {
  type: 'start' | 'content' | 'thinking' | 'end' | 'error'
  content?: string
  delta?: string
  usage?: MockChatResponse['usage']
  error?: string
}

export interface MockModel {
  id: string
  name: string
  contextLength: number
  capabilities: {
    vision: boolean
    functionCalling: boolean
    thinking: boolean
  }
}

export interface ProviderCall {
  method: string
  timestamp: string
  args: any[]
  response?: any
  error?: any
  duration: number
}

export interface ProviderMetrics {
  totalCalls: number
  averageLatency: number
  errorRate: number
  callsByMethod: Record<string, number>
}

export type ErrorType = 
  | 'connection'
  | 'authentication'
  | 'rate_limit'
  | 'model_not_found'
  | 'context_too_long'
  | 'api_error'
  | 'timeout'

export interface ResponsePattern {
  style: 'technical' | 'conversational' | 'analytical' | 'creative'
  averageLength: number
  includeThinking?: boolean
  errorProbability?: number
}

/**
 * Base mock provider interface
 */
export interface MockProvider {
  readonly config: ExtendedProviderConfig
  readonly providerType: string
  
  // Core functionality
  chat(messages: MockMessage[]): Promise<MockChatResponse>
  streamChat(messages: MockMessage[]): AsyncIterable<MockStreamChunk>
  listModels(): Promise<MockModel[]>
  getModel(modelId: string): Promise<MockModel>
  
  // Capability simulation
  supportsVision(): boolean
  supportsFunctionCalling(): boolean
  supportsThinking(): boolean
  supportsStreaming(): boolean
  
  // Configuration
  setLatency(ms: number): void
  setErrorRate(rate: number): void
  setResponsePattern(pattern: ResponsePattern): void
  
  // Error simulation
  simulateError(type: ErrorType): void
  clearError(): void
  
  // State management
  reset(): void
  getCallHistory(): ProviderCall[]
  getMetrics(): ProviderMetrics
}

/**
 * Abstract base implementation for mock providers
 */
export abstract class BaseMockProvider implements MockProvider {
  protected callHistory: ProviderCall[] = []
  protected latency: number = 100
  protected errorRate: number = 0
  protected forcedError: ErrorType | null = null
  protected responsePattern: ResponsePattern = {
    style: 'conversational',
    averageLength: 150,
    errorProbability: 0
  }

  constructor(
    public readonly config: ExtendedProviderConfig,
    public readonly providerType: string
  ) {}

  abstract chat(messages: MockMessage[]): Promise<MockChatResponse>
  abstract streamChat(messages: MockMessage[]): AsyncIterable<MockStreamChunk>
  abstract listModels(): Promise<MockModel[]>
  abstract getModel(modelId: string): Promise<MockModel>

  supportsVision(): boolean {
    return this.config.capabilities?.supportsVision ?? false
  }

  supportsFunctionCalling(): boolean {
    return this.config.capabilities?.supportsFunctionCalling ?? false
  }

  supportsThinking(): boolean {
    return this.config.capabilities?.supportsThinking ?? false
  }

  supportsStreaming(): boolean {
    return this.config.capabilities?.supportsStreaming ?? true
  }

  setLatency(ms: number): void {
    this.latency = ms
  }

  setErrorRate(rate: number): void {
    this.errorRate = Math.max(0, Math.min(1, rate))
  }

  setResponsePattern(pattern: ResponsePattern): void {
    this.responsePattern = pattern
  }

  simulateError(type: ErrorType): void {
    this.forcedError = type
  }

  clearError(): void {
    this.forcedError = null
  }

  reset(): void {
    this.callHistory = []
    this.latency = 100
    this.errorRate = 0
    this.forcedError = null
    this.responsePattern = {
      style: 'conversational',
      averageLength: 150,
      errorProbability: 0
    }
  }

  getCallHistory(): ProviderCall[] {
    return [...this.callHistory]
  }

  getMetrics(): ProviderMetrics {
    if (this.callHistory.length === 0) {
      return {
        totalCalls: 0,
        averageLatency: 0,
        errorRate: 0,
        callsByMethod: {}
      }
    }

    const totalCalls = this.callHistory.length
    const averageLatency = this.callHistory.reduce((sum, call) => sum + call.duration, 0) / totalCalls
    const errorCalls = this.callHistory.filter(call => call.error).length
    const errorRate = errorCalls / totalCalls

    const callsByMethod: Record<string, number> = {}
    this.callHistory.forEach(call => {
      callsByMethod[call.method] = (callsByMethod[call.method] || 0) + 1
    })

    return {
      totalCalls,
      averageLatency,
      errorRate,
      callsByMethod
    }
  }

  /**
   * Helper method to record method calls
   */
  protected async recordCall<T>(
    method: string,
    args: any[],
    operation: () => Promise<T>
  ): Promise<T> {
    const start = Date.now()
    const call: ProviderCall = {
      method,
      timestamp: new Date().toISOString(),
      args,
      duration: 0
    }

    try {
      // Simulate latency
      if (this.latency > 0) {
        await this.delay(this.latency)
      }

      // Check for forced errors
      if (this.forcedError) {
        throw this.createError(this.forcedError)
      }

      // Check for random errors
      if (Math.random() < this.errorRate) {
        const randomErrors: ErrorType[] = ['api_error', 'timeout', 'rate_limit']
        const errorType = randomErrors[Math.floor(Math.random() * randomErrors.length)]
        throw this.createError(errorType)
      }

      const result = await operation()
      call.response = result
      call.duration = Date.now() - start
      this.callHistory.push(call)
      
      return result
    } catch (error) {
      call.error = error
      call.duration = Date.now() - start
      this.callHistory.push(call)
      throw error
    }
  }

  /**
   * Create appropriate error for error type
   */
  protected createError(type: ErrorType): Error {
    switch (type) {
      case 'connection':
        return new Error(`Connection failed to ${this.config.baseUrl || 'provider'}`)
      case 'authentication':
        return new Error('Authentication failed - invalid API key')
      case 'rate_limit':
        return new Error('Rate limit exceeded - please try again later')
      case 'model_not_found':
        return new Error(`Model ${this.config.model} not found`)
      case 'context_too_long':
        return new Error('Context length exceeds model limit')
      case 'api_error':
        return new Error('API error occurred')
      case 'timeout':
        return new Error('Request timed out')
      default:
        return new Error(`Unknown error: ${type}`)
    }
  }

  /**
   * Delay helper for simulating latency
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Generate realistic response content based on pattern
   */
  protected generateResponseContent(prompt: string): string {
    const patterns = {
      technical: [
        'To implement this functionality, you would need to',
        'The technical approach involves',
        'Here\'s a step-by-step solution:',
        'The algorithm works by'
      ],
      conversational: [
        'I\'d be happy to help with that!',
        'That\'s an interesting question.',
        'Let me explain this concept.',
        'Here\'s what I think about that:'
      ],
      analytical: [
        'Let\'s break this down systematically.',
        'Analyzing this problem, we can see',
        'The key factors to consider are',
        'From a logical perspective'
      ],
      creative: [
        'Imagine a world where',
        'Once upon a time',
        'Picture this scenario:',
        'Let\'s explore the possibilities'
      ]
    }

    const starters = patterns[this.responsePattern.style] || patterns.conversational
    const starter = starters[Math.floor(Math.random() * starters.length)]
    
    // Generate content that varies in length based on pattern
    const baseLength = this.responsePattern.averageLength
    const variation = Math.floor(Math.random() * (baseLength * 0.5))
    const targetLength = baseLength + variation - (baseLength * 0.25)
    
    let content = starter
    const fillerPhrases = [
      ' Furthermore, ',
      ' Additionally, ',
      ' In other words, ',
      ' For example, ',
      ' This means that ',
      ' Consequently, '
    ]
    
    while (content.length < targetLength) {
      const filler = fillerPhrases[Math.floor(Math.random() * fillerPhrases.length)]
      content += filler + 'this demonstrates the key principles involved in the solution.'
    }
    
    return content.trim()
  }

  /**
   * Generate thinking content for providers that support it
   */
  protected generateThinkingContent(prompt: string): string {
    if (!this.supportsThinking()) {
      return ''
    }

    return `I need to analyze this request carefully. The user is asking about ${prompt.slice(0, 50)}... Let me think through the best approach to provide a helpful response.`
  }

  /**
   * Calculate token usage based on content
   */
  protected calculateTokenUsage(input: string, output: string): MockChatResponse['usage'] {
    // Simple token estimation (roughly 1 token per 4 characters)
    const inputTokens = Math.ceil(input.length / 4)
    const outputTokens = Math.ceil(output.length / 4)

    return {
      input: inputTokens,
      output: outputTokens,
      promptTokens: inputTokens,
      completionTokens: outputTokens
    }
  }
}