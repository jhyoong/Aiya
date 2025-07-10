# Phase 2: Provider Testing Framework Implementation Guide

## Overview

This guide provides detailed implementation instructions for Phase 2 of the Aiya testing infrastructure, focusing on comprehensive testing for the 3 main AI providers: **Ollama**, **OpenAI**, and **Gemini**. This phase builds on the foundation established in Phase 1 and creates a robust provider testing framework.

## Table of Contents

1. [Phase 2 Objectives](#phase-2-objectives)
2. [Implementation Strategy](#implementation-strategy)
3. [Technical Implementation](#technical-implementation)
4. [Provider Test Suites](#provider-test-suites)
5. [Mock Provider Implementations](#mock-provider-implementations)
6. [Integration Testing](#integration-testing)
7. [Validation & Quality Gates](#validation--quality-gates)
8. [Success Criteria](#success-criteria)

## Phase 2 Objectives

### Primary Goals
- **Comprehensive Provider Testing**: Create complete test suites for Ollama, OpenAI, and Gemini providers
- **Mock Provider System**: Implement realistic mock providers for reliable testing
- **Provider Integration**: Test provider factory, switching, and configuration loading
- **Error Handling**: Validate error scenarios and recovery mechanisms
- **Token Accuracy**: Ensure accurate token counting across all providers

### Deliverables
1. **Abstract Provider Test Suite** - Base testing framework for all providers
2. **Mock Provider Implementations** - Complete mocks for 3 main providers
3. **Provider-Specific Test Suites** - Comprehensive tests for each provider
4. **Integration Test Framework** - Multi-provider scenario testing

### Expected Outcomes
- >90% test coverage for all 3 main providers
- Realistic mock providers generating accurate responses
- Comprehensive error handling validation
- Accurate token counting verification
- Provider switching and configuration testing

## Implementation Strategy

### Development Approach
1. **Abstract First**: Build base test suite and mock infrastructure
2. **Provider by Provider**: Implement and validate each provider individually
3. **Integration Testing**: Test provider interactions and switching
4. **Validation**: Comprehensive testing of all scenarios

### File Organization
```
tests/
├── unit/providers/           # Provider unit tests
│   ├── base-provider-test.ts # Abstract test suite
│   ├── ollama.test.ts       # Ollama provider tests
│   ├── openai.test.ts       # OpenAI provider tests
│   ├── gemini.test.ts       # Gemini provider tests
│   └── factory.test.ts      # Provider factory tests
├── mocks/providers/         # Mock provider implementations
│   ├── base-mock-provider.ts # Base mock (already exists)
│   ├── mock-ollama.ts       # Ollama mock (already exists)
│   ├── mock-openai.ts       # OpenAI mock (new)
│   ├── mock-gemini.ts       # Gemini mock (new)
│   └── mock-factory.ts      # Factory updates (enhance existing)
├── integration/providers/   # Provider integration tests
│   ├── multi-provider.test.ts # Multi-provider scenarios
│   ├── provider-switching.test.ts # Runtime switching
│   └── configuration.test.ts # Config loading tests
└── fixtures/providers/      # Test data and responses
    ├── ollama/             # Ollama test data
    ├── openai/             # OpenAI test data
    └── gemini/             # Gemini test data
```

## Technical Implementation

### Step 1: Abstract Provider Test Suite

Create the base test framework that all provider tests will extend.

#### 1.1 Create Base Provider Test Suite

```typescript
// tests/unit/providers/base-provider-test.ts
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import type { ExtendedProviderConfig } from '@/core/config/manager'
import type { MockProvider } from '@tests/mocks/providers/base-mock-provider'
import { assertValidProviderResponse, assertValidTokenUsage } from '@tests/utils/assertions'

export abstract class ProviderTestSuite {
  abstract readonly providerType: string
  abstract readonly testConfig: ExtendedProviderConfig
  abstract createMockProvider(config?: Partial<ExtendedProviderConfig>): MockProvider

  /**
   * Run comprehensive provider tests
   */
  runProviderTests(): void {
    describe(`${this.providerType} Provider Tests`, () => {
      let provider: MockProvider

      beforeEach(() => {
        provider = this.createMockProvider()
      })

      afterEach(() => {
        provider.reset()
      })

      this.testProviderBasics(provider)
      this.testAuthentication(provider)
      this.testModelOperations(provider)
      this.testChatFunctionality(provider)
      this.testStreamingSupport(provider)
      this.testCapabilityDetection(provider)
      this.testErrorHandling(provider)
      this.testTokenCounting(provider)
      this.testProviderSpecificFeatures(provider)
    })
  }

  /**
   * Test basic provider functionality
   */
  protected testProviderBasics(provider: MockProvider): void {
    describe('Provider Basics', () => {
      test('should have correct provider type', () => {
        expect(provider.providerType).toBe(this.providerType)
      })

      test('should have valid configuration', () => {
        expect(provider.config).toBeDefined()
        expect(provider.config.type).toBe(this.providerType)
        expect(provider.config.model).toBeTruthy()
      })

      test('should support basic operations', () => {
        expect(typeof provider.chat).toBe('function')
        expect(typeof provider.streamChat).toBe('function')
        expect(typeof provider.listModels).toBe('function')
        expect(typeof provider.getModel).toBe('function')
      })
    })
  }

  /**
   * Test authentication scenarios
   */
  protected testAuthentication(provider: MockProvider): void {
    describe('Authentication', () => {
      test('should handle valid authentication', async () => {
        const models = await provider.listModels()
        expect(Array.isArray(models)).toBe(true)
      })

      test('should handle authentication failures', async () => {
        provider.simulateError('authentication')
        await expect(provider.listModels()).rejects.toThrow(/authentication/i)
      })

      if (this.requiresApiKey()) {
        test('should validate API key format', () => {
          const config = provider.config
          if (config.apiKey) {
            expect(this.isValidApiKeyFormat(config.apiKey)).toBe(true)
          }
        })
      }
    })
  }

  /**
   * Test model operations
   */
  protected testModelOperations(provider: MockProvider): void {
    describe('Model Operations', () => {
      test('should list available models', async () => {
        const models = await provider.listModels()
        expect(Array.isArray(models)).toBe(true)
        expect(models.length).toBeGreaterThan(0)
        
        models.forEach(model => {
          expect(model.id).toBeTruthy()
          expect(model.name).toBeTruthy()
          expect(typeof model.contextLength).toBe('number')
          expect(model.capabilities).toBeDefined()
        })
      })

      test('should get specific model', async () => {
        const modelId = provider.config.model
        const model = await provider.getModel(modelId)
        
        expect(model.id).toBe(modelId)
        expect(model.name).toBeTruthy()
        expect(typeof model.contextLength).toBe('number')
      })

      test('should handle model not found', async () => {
        await expect(
          provider.getModel('nonexistent-model')
        ).rejects.toThrow(/not found/i)
      })
    })
  }

  /**
   * Test chat functionality
   */
  protected testChatFunctionality(provider: MockProvider): void {
    describe('Chat Functionality', () => {
      test('should handle basic chat', async () => {
        const messages = [{ role: 'user' as const, content: 'Hello' }]
        const response = await provider.chat(messages)
        
        assertValidProviderResponse(response)
        expect(response.content).toBeTruthy()
        expect(response.model).toBe(provider.config.model)
      })

      test('should handle multi-turn conversation', async () => {
        const messages = [
          { role: 'user' as const, content: 'What is TypeScript?' },
          { role: 'assistant' as const, content: 'TypeScript is a programming language...' },
          { role: 'user' as const, content: 'Can you give an example?' }
        ]
        
        const response = await provider.chat(messages)
        assertValidProviderResponse(response)
        expect(response.content.length).toBeGreaterThan(10)
      })

      test('should handle empty input', async () => {
        const messages = [{ role: 'user' as const, content: '' }]
        const response = await provider.chat(messages)
        
        assertValidProviderResponse(response)
        expect(response.content).toBeTruthy()
      })

      test('should handle large context', async () => {
        const largeContent = 'x'.repeat(1000)
        const messages = [{ role: 'user' as const, content: largeContent }]
        
        const response = await provider.chat(messages)
        assertValidProviderResponse(response)
      })
    })
  }

  /**
   * Test streaming support
   */
  protected testStreamingSupport(provider: MockProvider): void {
    describe('Streaming Support', () => {
      test('should support streaming', () => {
        expect(provider.supportsStreaming()).toBe(true)
      })

      test('should stream chat responses', async () => {
        const messages = [{ role: 'user' as const, content: 'Tell me a story' }]
        const chunks: any[] = []
        
        for await (const chunk of provider.streamChat(messages)) {
          chunks.push(chunk)
        }
        
        expect(chunks.length).toBeGreaterThan(2)
        expect(chunks[0].type).toBe('start')
        expect(chunks[chunks.length - 1].type).toBe('end')
        
        const contentChunks = chunks.filter(c => c.type === 'content')
        expect(contentChunks.length).toBeGreaterThan(0)
      })

      test('should handle streaming errors', async () => {
        provider.simulateError('timeout')
        const messages = [{ role: 'user' as const, content: 'Test' }]
        
        const chunks: any[] = []
        try {
          for await (const chunk of provider.streamChat(messages)) {
            chunks.push(chunk)
          }
        } catch (error) {
          expect(error).toBeDefined()
        }
      })
    })
  }

  /**
   * Test capability detection
   */
  protected testCapabilityDetection(provider: MockProvider): void {
    describe('Capability Detection', () => {
      test('should report correct capabilities', () => {
        const capabilities = provider.config.capabilities
        expect(capabilities).toBeDefined()
        
        expect(typeof provider.supportsVision()).toBe('boolean')
        expect(typeof provider.supportsFunctionCalling()).toBe('boolean')
        expect(typeof provider.supportsThinking()).toBe('boolean')
        expect(typeof provider.supportsStreaming()).toBe('boolean')
      })

      test('should have consistent capability reporting', () => {
        const config = provider.config.capabilities
        
        expect(provider.supportsVision()).toBe(config?.supportsVision ?? false)
        expect(provider.supportsFunctionCalling()).toBe(config?.supportsFunctionCalling ?? false)
        expect(provider.supportsThinking()).toBe(config?.supportsThinking ?? false)
        expect(provider.supportsStreaming()).toBe(config?.supportsStreaming ?? true)
      })
    })
  }

  /**
   * Test error handling
   */
  protected testErrorHandling(provider: MockProvider): void {
    describe('Error Handling', () => {
      test('should handle connection errors', async () => {
        provider.simulateError('connection')
        await expect(provider.chat([{ role: 'user', content: 'test' }]))
          .rejects.toThrow(/connection/i)
      })

      test('should handle rate limiting', async () => {
        provider.simulateError('rate_limit')
        await expect(provider.chat([{ role: 'user', content: 'test' }]))
          .rejects.toThrow(/rate limit/i)
      })

      test('should handle context too long', async () => {
        provider.simulateError('context_too_long')
        await expect(provider.chat([{ role: 'user', content: 'test' }]))
          .rejects.toThrow(/context/i)
      })

      test('should recover from errors', async () => {
        provider.simulateError('timeout')
        await expect(provider.chat([{ role: 'user', content: 'test' }]))
          .rejects.toThrow()
        
        provider.clearError()
        const response = await provider.chat([{ role: 'user', content: 'test' }])
        assertValidProviderResponse(response)
      })
    })
  }

  /**
   * Test token counting
   */
  protected testTokenCounting(provider: MockProvider): void {
    describe('Token Counting', () => {
      test('should provide token usage', async () => {
        const messages = [{ role: 'user' as const, content: 'Count my tokens' }]
        const response = await provider.chat(messages)
        
        expect(response.usage).toBeDefined()
        assertValidTokenUsage(response.usage!)
      })

      test('should have reasonable token counts', async () => {
        const shortMessage = [{ role: 'user' as const, content: 'Hi' }]
        const longMessage = [{ role: 'user' as const, content: 'x'.repeat(100) }]
        
        const shortResponse = await provider.chat(shortMessage)
        const longResponse = await provider.chat(longMessage)
        
        expect(longResponse.usage!.input!).toBeGreaterThan(shortResponse.usage!.input!)
      })

      test('should track token usage over time', async () => {
        const initialMetrics = provider.getMetrics()
        
        await provider.chat([{ role: 'user', content: 'Test 1' }])
        await provider.chat([{ role: 'user', content: 'Test 2' }])
        
        const finalMetrics = provider.getMetrics()
        expect(finalMetrics.totalCalls).toBe(initialMetrics.totalCalls + 2)
      })
    })
  }

  /**
   * Provider-specific tests (override in subclasses)
   */
  protected testProviderSpecificFeatures(provider: MockProvider): void {
    // Override in provider-specific test suites
  }

  /**
   * Helper methods (override as needed)
   */
  protected requiresApiKey(): boolean {
    return this.providerType !== 'ollama'
  }

  protected isValidApiKeyFormat(apiKey: string): boolean {
    switch (this.providerType) {
      case 'openai':
        return apiKey.startsWith('sk-')
      case 'anthropic':
        return apiKey.startsWith('sk-ant-')
      case 'gemini':
        return apiKey.startsWith('AIza')
      default:
        return true
    }
  }
}
```

### Step 2: Mock Provider Implementations

#### 2.1 Create OpenAI Mock Provider

```typescript
// tests/mocks/providers/mock-openai.ts
import { BaseMockProvider, type MockMessage, type MockChatResponse, type MockStreamChunk, type MockModel } from './base-mock-provider'
import type { ExtendedProviderConfig } from '@/core/config/manager'

export class MockOpenAIProvider extends BaseMockProvider {
  private static readonly OPENAI_MODELS: MockModel[] = [
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      contextLength: 128000,
      capabilities: {
        vision: true,
        functionCalling: true,
        thinking: false
      }
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      contextLength: 128000,
      capabilities: {
        vision: true,
        functionCalling: true,
        thinking: false
      }
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      contextLength: 128000,
      capabilities: {
        vision: true,
        functionCalling: true,
        thinking: false
      }
    }
  ]

  constructor(config: ExtendedProviderConfig) {
    super(config, 'openai')
    
    this.setResponsePattern({
      style: 'conversational',
      averageLength: 180,
      errorProbability: 0.01
    })
  }

  async chat(messages: MockMessage[]): Promise<MockChatResponse> {
    return this.recordCall('chat', [messages], async () => {
      this.validateApiKey()
      
      const lastMessage = messages[messages.length - 1]
      let content = this.generateResponseContent(lastMessage.content)
      
      // Simulate vision capabilities
      if (this.supportsVision() && this.containsImageContent(lastMessage.content)) {
        content = this.generateVisionResponse(lastMessage.content)
      }
      
      const usage = this.calculateOpenAITokenUsage(
        messages.map(m => m.content).join(' '),
        content
      )

      return {
        content,
        usage,
        model: this.config.model,
        timestamp: new Date().toISOString()
      }
    })
  }

  async *streamChat(messages: MockMessage[]): AsyncIterable<MockStreamChunk> {
    this.validateApiKey()
    
    const response = await this.chat(messages)
    
    yield { type: 'start' }
    
    // Simulate token-based streaming (OpenAI style)
    const tokens = response.content.split(/(\s+)/)
    for (let i = 0; i < tokens.length; i++) {
      await this.delay(30)
      
      yield {
        type: 'content',
        delta: tokens[i],
        content: tokens.slice(0, i + 1).join('')
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
      return MockOpenAIProvider.OPENAI_MODELS
    })
  }

  async getModel(modelId: string): Promise<MockModel> {
    return this.recordCall('getModel', [modelId], async () => {
      this.validateApiKey()
      
      const model = MockOpenAIProvider.OPENAI_MODELS.find(m => m.id === modelId)
      if (!model) {
        throw this.createError('model_not_found')
      }
      
      return model
    })
  }

  /**
   * OpenAI-specific functionality
   */
  private validateApiKey(): void {
    if (!this.config.apiKey) {
      throw this.createError('authentication')
    }
    
    if (!this.config.apiKey.startsWith('sk-')) {
      throw this.createError('authentication')
    }
  }

  private containsImageContent(content: string): boolean {
    return /\[image\]|\[img\]|image:|data:image\//.test(content.toLowerCase())
  }

  private generateVisionResponse(content: string): string {
    const visionPrefixes = [
      'I can see in this image',
      'The image shows',
      'Looking at this image, I observe',
      'This appears to be an image of'
    ]
    
    const prefix = visionPrefixes[Math.floor(Math.random() * visionPrefixes.length)]
    return `${prefix} ${this.generateResponseContent(content)}`
  }

  private calculateOpenAITokenUsage(input: string, output: string): MockChatResponse['usage'] {
    // More accurate token calculation for OpenAI (roughly 0.75 tokens per character)
    const inputTokens = Math.ceil(input.length * 0.75 / 4)
    const outputTokens = Math.ceil(output.length * 0.75 / 4)

    return {
      input: inputTokens,
      output: outputTokens,
      promptTokens: inputTokens,
      completionTokens: outputTokens
    }
  }

  /**
   * Simulate OpenAI-specific errors
   */
  simulateInsufficientQuota(): void {
    this.simulateError('rate_limit')
  }

  simulateInvalidApiKey(): void {
    this.config.apiKey = 'invalid-key'
  }

  /**
   * Get OpenAI-specific metrics
   */
  getOpenAIMetrics() {
    const baseMetrics = this.getMetrics()
    
    return {
      ...baseMetrics,
      modelsAvailable: MockOpenAIProvider.OPENAI_MODELS.length,
      visionSupported: this.supportsVision(),
      apiKeyValid: this.config.apiKey?.startsWith('sk-') ?? false
    }
  }
}

export function createMockOpenAIProvider(overrides: Partial<ExtendedProviderConfig> = {}): MockOpenAIProvider {
  const defaultConfig: ExtendedProviderConfig = {
    type: 'openai',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-test-key-123',
    capabilities: {
      maxTokens: 128000,
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsThinking: false
    },
    costPerToken: { input: 0.00015, output: 0.0006 }
  }

  const config = { ...defaultConfig, ...overrides }
  return new MockOpenAIProvider(config)
}

export const OPENAI_TEST_SCENARIOS = {
  healthy: () => createMockOpenAIProvider(),
  
  withVision: () => createMockOpenAIProvider({
    model: 'gpt-4o',
    capabilities: { supportsVision: true }
  }),
  
  invalidApiKey: () => {
    const provider = createMockOpenAIProvider({ apiKey: 'invalid-key' })
    provider.simulateInvalidApiKey()
    return provider
  },
  
  quotaExceeded: () => {
    const provider = createMockOpenAIProvider()
    provider.simulateInsufficientQuota()
    return provider
  },
  
  customEndpoint: (baseUrl: string) => createMockOpenAIProvider({ baseUrl })
}
```

#### 2.2 Create Gemini Mock Provider

```typescript
// tests/mocks/providers/mock-gemini.ts
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
    const sentences = response.content.split(/([.!?]+\s*)/)
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
```

### Step 3: Update Mock Factory

Enhance the existing mock factory to support all 3 providers:

```typescript
// Add to tests/mocks/providers/mock-factory.ts
import { MockOpenAIProvider, createMockOpenAIProvider } from './mock-openai'
import { MockGeminiProvider, createMockGeminiProvider } from './mock-gemini'

// Update the create method to support all providers
export class MockProviderFactory {
  // ... existing code ...

  static create(config: ExtendedProviderConfig): MockProvider {
    const key = this.getProviderKey(config)
    
    if (this.providers.has(key)) {
      return this.providers.get(key)!
    }

    let provider: MockProvider

    switch (config.type) {
      case 'ollama':
        provider = new MockOllamaProvider(config)
        break
      
      case 'openai':
        provider = new MockOpenAIProvider(config)
        break
      
      case 'gemini':
        provider = new MockGeminiProvider(config)
        break
      
      case 'anthropic':
      case 'azure':
      case 'bedrock':
        throw new Error(`Provider ${config.type} will be implemented in future phases`)
      
      default:
        throw new Error(`Unsupported provider type: ${(config as any).type}`)
    }

    this.providers.set(key, provider)
    return provider
  }

  static createScenario(providerType: string, scenario: string, ...args: any[]): MockProvider {
    switch (providerType) {
      case 'ollama':
        const { OLLAMA_TEST_SCENARIOS } = require('./mock-ollama')
        return OLLAMA_TEST_SCENARIOS[scenario](...args)
      
      case 'openai':
        const { OPENAI_TEST_SCENARIOS } = require('./mock-openai')
        return OPENAI_TEST_SCENARIOS[scenario](...args)
      
      case 'gemini':
        const { GEMINI_TEST_SCENARIOS } = require('./mock-gemini')
        return GEMINI_TEST_SCENARIOS[scenario](...args)
      
      default:
        throw new Error(`Provider ${providerType} scenarios not implemented`)
    }
  }
}

// Add convenience functions
export function createOpenAIMock(overrides: Partial<ExtendedProviderConfig> = {}): MockOpenAIProvider {
  return createMockOpenAIProvider(overrides)
}

export function createGeminiMock(overrides: Partial<ExtendedProviderConfig> = {}): MockGeminiProvider {
  return createMockGeminiProvider(overrides)
}
```

## Provider Test Suites

### Step 4: Implement Provider-Specific Tests

#### 4.1 Ollama Provider Tests

```typescript
// tests/unit/providers/ollama.test.ts
import { ProviderTestSuite } from './base-provider-test'
import { createMockOllamaProvider, OLLAMA_TEST_SCENARIOS } from '@tests/mocks/providers/mock-ollama'
import type { MockProvider } from '@tests/mocks/providers/base-mock-provider'
import type { ExtendedProviderConfig } from '@/core/config/manager'
import { TEST_CONFIGS } from '@tests/utils/config-builder'

class OllamaTestSuite extends ProviderTestSuite {
  readonly providerType = 'ollama'
  readonly testConfig = TEST_CONFIGS.ollama.basic

  createMockProvider(config?: Partial<ExtendedProviderConfig>): MockProvider {
    return createMockOllamaProvider(config)
  }

  protected testProviderSpecificFeatures(provider: MockProvider): void {
    describe('Ollama-Specific Features', () => {
      test('should handle local server connection', async () => {
        expect(provider.config.baseUrl).toMatch(/localhost|127\.0\.0\.1/)
      })

      test('should not require API key', () => {
        expect(provider.config.apiKey).toBeUndefined()
      })

      test('should handle server offline scenario', async () => {
        const offlineProvider = OLLAMA_TEST_SCENARIOS.offline()
        await expect(offlineProvider.chat([{ role: 'user', content: 'test' }]))
          .rejects.toThrow(/connection/i)
      })

      test('should handle model not pulled', async () => {
        const provider = OLLAMA_TEST_SCENARIOS.modelMissing('nonexistent:model')
        await expect(provider.listModels()).rejects.toThrow(/not found/i)
      })

      test('should work with custom endpoint', () => {
        const customProvider = OLLAMA_TEST_SCENARIOS.customEndpoint('http://custom:11434')
        expect(customProvider.config.baseUrl).toBe('http://custom:11434')
      })
    })
  }
}

// Run the test suite
const ollamaTests = new OllamaTestSuite()
ollamaTests.runProviderTests()
```

#### 4.2 OpenAI Provider Tests

```typescript
// tests/unit/providers/openai.test.ts
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

  protected testProviderSpecificFeatures(provider: MockProvider): void {
    describe('OpenAI-Specific Features', () => {
      test('should require valid API key format', () => {
        expect(provider.config.apiKey).toMatch(/^sk-/)
      })

      test('should support vision capabilities', () => {
        if (provider.supportsVision()) {
          expect(['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo']).toContain(provider.config.model)
        }
      })

      test('should handle vision input', async () => {
        if (provider.supportsVision()) {
          const messages = [{ role: 'user' as const, content: 'Describe this [image]' }]
          const response = await provider.chat(messages)
          
          expect(response.content).toMatch(/image/i)
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
        const messages = [{ role: 'user' as const, content: 'Test message for tokens' }]
        const response = await provider.chat(messages)
        
        // OpenAI should provide exact token counts
        expect(response.usage?.promptTokens).toBeDefined()
        expect(response.usage?.completionTokens).toBeDefined()
        expect(response.usage?.input).toBeDefined()
        expect(response.usage?.output).toBeDefined()
      })
    })
  }
}

// Run the test suite
const openaiTests = new OpenAITestSuite()
openaiTests.runProviderTests()
```

#### 4.3 Gemini Provider Tests

```typescript
// tests/unit/providers/gemini.test.ts
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

  protected testProviderSpecificFeatures(provider: MockProvider): void {
    describe('Gemini-Specific Features', () => {
      test('should require valid API key format', () => {
        expect(provider.config.apiKey).toMatch(/^AIza/)
      })

      test('should support massive context windows', () => {
        const contextLength = provider.config.capabilities?.maxTokens
        expect(contextLength).toBeGreaterThan(500000) // Should be >500K tokens
      })

      test('should support thinking mode for 2.5+ models', async () => {
        if (provider.config.model.includes('2.5')) {
          const messages = [{ role: 'user' as const, content: 'Solve this complex problem step by step' }]
          const response = await provider.chat(messages)
          
          if (provider.supportsThinking()) {
            expect(response.thinking).toBeDefined()
            expect(response.thinking).toBeTruthy()
          }
        }
      })

      test('should handle vision input', async () => {
        if (provider.supportsVision()) {
          const messages = [{ role: 'user' as const, content: 'Analyze this [image]' }]
          const response = await provider.chat(messages)
          
          expect(response.content).toMatch(/image|visual/i)
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
      })

      test('should stream with thinking content', async () => {
        if (provider.supportsThinking()) {
          const messages = [{ role: 'user' as const, content: 'Think through this problem' }]
          const chunks: any[] = []
          
          for await (const chunk of provider.streamChat(messages)) {
            chunks.push(chunk)
          }
          
          const thinkingChunks = chunks.filter(c => c.type === 'thinking')
          if (provider.config.model.includes('2.5')) {
            expect(thinkingChunks.length).toBeGreaterThan(0)
          }
        }
      })
    })
  }
}

// Run the test suite
const geminiTests = new GeminiTestSuite()
geminiTests.runProviderTests()
```

### Step 5: Provider Factory Tests

```typescript
// tests/unit/providers/factory.test.ts
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
  })

  describe('Test Scenarios', () => {
    test('should create Ollama scenarios', () => {
      const healthy = MockProviderFactory.createScenario('ollama', 'healthy')
      const offline = MockProviderFactory.createScenario('ollama', 'offline')
      
      expect(healthy.providerType).toBe('ollama')
      expect(offline.providerType).toBe('ollama')
    })

    test('should create OpenAI scenarios', () => {
      const healthy = MockProviderFactory.createScenario('openai', 'healthy')
      const invalidKey = MockProviderFactory.createScenario('openai', 'invalidApiKey')
      
      expect(healthy.providerType).toBe('openai')
      expect(invalidKey.providerType).toBe('openai')
    })

    test('should create Gemini scenarios', () => {
      const healthy = MockProviderFactory.createScenario('gemini', 'healthy')
      const thinking = MockProviderFactory.createScenario('gemini', 'withThinking')
      
      expect(healthy.providerType).toBe('gemini')
      expect(thinking.providerType).toBe('gemini')
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
  })
})
```

## Integration Testing

### Step 6: Multi-Provider Integration Tests

```typescript
// tests/integration/providers/multi-provider.test.ts
import { describe, test, expect, beforeEach } from 'vitest'
import { MockProviderFactory, MockTestUtils } from '@tests/mocks/providers/mock-factory'
import { TEST_CONFIGS } from '@tests/utils/config-builder'
import { assertValidProviderResponse } from '@tests/utils/assertions'

describe('Multi-Provider Integration Tests', () => {
  beforeEach(() => {
    MockProviderFactory.clear()
  })

  describe('Provider Combinations', () => {
    test('should handle all three providers simultaneously', async () => {
      const configs = [
        TEST_CONFIGS.ollama.basic,
        TEST_CONFIGS.openai.gpt4,
        {
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
      ]
      
      const providers = MockTestUtils.createMultiProvider(configs)
      expect(providers).toHaveLength(3)
      
      // Test that each provider works independently
      const messages = [{ role: 'user' as const, content: 'Hello from all providers' }]
      
      for (const provider of providers) {
        const response = await provider.chat(messages)
        assertValidProviderResponse(response)
        expect(response.model).toBeTruthy()
      }
    })

    test('should handle provider-specific capabilities', async () => {
      const providers = MockTestUtils.createMultiProvider([
        TEST_CONFIGS.ollama.basic,
        TEST_CONFIGS.openai.gpt4
      ])
      
      const [ollama, openai] = providers
      
      // Ollama should not support vision
      expect(ollama.supportsVision()).toBe(false)
      
      // OpenAI should support vision
      expect(openai.supportsVision()).toBe(true)
      
      // Both should support function calling
      expect(ollama.supportsFunctionCalling()).toBe(true)
      expect(openai.supportsFunctionCalling()).toBe(true)
    })

    test('should handle different error scenarios', async () => {
      const providers = MockTestUtils.createMultiProvider([
        TEST_CONFIGS.ollama.basic,
        TEST_CONFIGS.openai.gpt4
      ])
      
      // Simulate network issues for all providers
      MockTestUtils.simulateNetworkIssues(providers, 'connection')
      
      for (const provider of providers) {
        await expect(
          provider.chat([{ role: 'user', content: 'test' }])
        ).rejects.toThrow(/connection/i)
      }
    })
  })

  describe('Performance Comparisons', () => {
    test('should compare response times across providers', async () => {
      const providers = MockTestUtils.createMultiProvider([
        TEST_CONFIGS.ollama.basic,
        TEST_CONFIGS.openai.gpt4
      ])
      
      // Set different latencies
      providers[0].setLatency(100) // Ollama (local)
      providers[1].setLatency(500) // OpenAI (API)
      
      const messages = [{ role: 'user' as const, content: 'Performance test' }]
      const startTime = Date.now()
      
      const responses = await Promise.all(
        providers.map(provider => provider.chat(messages))
      )
      
      const totalTime = Date.now() - startTime
      
      expect(responses).toHaveLength(2)
      expect(totalTime).toBeGreaterThan(500) // Should take at least as long as the slowest
      
      responses.forEach(response => {
        assertValidProviderResponse(response)
      })
    })

    test('should provide combined metrics', async () => {
      const providers = MockTestUtils.createMultiProvider([
        TEST_CONFIGS.ollama.basic,
        TEST_CONFIGS.openai.gpt4
      ])
      
      // Make some calls
      const messages = [{ role: 'user' as const, content: 'Metrics test' }]
      await Promise.all(providers.map(p => p.chat(messages)))
      await Promise.all(providers.map(p => p.listModels()))
      
      const combinedMetrics = MockTestUtils.getCombinedMetrics(providers)
      
      expect(combinedMetrics.totalProviders).toBe(2)
      expect(combinedMetrics.totalCalls).toBe(4) // 2 chat + 2 listModels
      expect(combinedMetrics.providerMetrics).toHaveLength(2)
    })
  })

  describe('Provider Switching Simulation', () => {
    test('should simulate provider switching workflow', async () => {
      const providers = [
        MockProviderFactory.create(TEST_CONFIGS.ollama.basic),
        MockProviderFactory.create(TEST_CONFIGS.openai.gpt4)
      ]
      
      let currentProvider = providers[0]
      const conversation = []
      
      // Start with Ollama
      let response = await currentProvider.chat([
        { role: 'user', content: 'Start conversation with Ollama' }
      ])
      conversation.push({ provider: 'ollama', response: response.content })
      
      // Switch to OpenAI
      currentProvider = providers[1]
      response = await currentProvider.chat([
        { role: 'user', content: 'Continue with OpenAI' }
      ])
      conversation.push({ provider: 'openai', response: response.content })
      
      expect(conversation).toHaveLength(2)
      expect(conversation[0].provider).toBe('ollama')
      expect(conversation[1].provider).toBe('openai')
      expect(conversation[0].response).toBeTruthy()
      expect(conversation[1].response).toBeTruthy()
    })
  })
})
```

## Validation & Quality Gates

### Step 7: Test Coverage and Quality Validation

Create a comprehensive validation suite to ensure all success criteria are met:

```typescript
// tests/integration/providers/validation.test.ts
import { describe, test, expect } from 'vitest'
import { MockProviderFactory } from '@tests/mocks/providers/mock-factory'
import { TEST_CONFIGS, TestConfigBuilder } from '@tests/utils/config-builder'
import { assertValidProviderResponse, assertValidTokenUsage } from '@tests/utils/assertions'

describe('Provider Testing Validation', () => {
  describe('Coverage Validation', () => {
    test('should test all required provider methods', () => {
      const requiredMethods = [
        'chat',
        'streamChat', 
        'listModels',
        'getModel',
        'supportsVision',
        'supportsFunctionCalling',
        'supportsThinking',
        'supportsStreaming'
      ]
      
      const providers = [
        MockProviderFactory.create(TEST_CONFIGS.ollama.basic),
        MockProviderFactory.create(TEST_CONFIGS.openai.gpt4),
        MockProviderFactory.create(TestConfigBuilder.create()
          .withProvider('gemini')
          .withModel('gemini-2.5-flash')
          .withApiKey('AIza-test')
          .build())
      ]
      
      providers.forEach(provider => {
        requiredMethods.forEach(method => {
          expect(typeof (provider as any)[method]).toBe('function')
        })
      })
    })

    test('should validate provider capabilities matrix', () => {
      const testMatrix = [
        { type: 'ollama', vision: false, thinking: false, functions: true },
        { type: 'openai', vision: true, thinking: false, functions: true },
        { type: 'gemini', vision: true, thinking: true, functions: true }
      ]
      
      testMatrix.forEach(({ type, vision, thinking, functions }) => {
        const config = TestConfigBuilder.create()
          .withProvider(type as any)
          .withModel('test-model')
          .build()
        
        if (type !== 'ollama') {
          config.apiKey = type === 'gemini' ? 'AIza-test' : 'sk-test'
        }
        
        const provider = MockProviderFactory.create(config)
        
        expect(provider.supportsVision()).toBe(vision)
        expect(provider.supportsThinking()).toBe(thinking)
        expect(provider.supportsFunctionCalling()).toBe(functions)
      })
    })
  })

  describe('Response Quality Validation', () => {
    test('should generate realistic responses across providers', async () => {
      const providers = [
        MockProviderFactory.create(TEST_CONFIGS.ollama.basic),
        MockProviderFactory.create(TEST_CONFIGS.openai.gpt4)
      ]
      
      const testPrompts = [
        'What is TypeScript?',
        'Explain recursion',
        'Write a simple function',
        'Describe the weather'
      ]
      
      for (const provider of providers) {
        for (const prompt of testPrompts) {
          const response = await provider.chat([
            { role: 'user', content: prompt }
          ])
          
          assertValidProviderResponse(response)
          expect(response.content.length).toBeGreaterThan(20)
          expect(response.content.length).toBeLessThan(1000)
        }
      }
    })

    test('should provide accurate token counting', async () => {
      const providers = [
        MockProviderFactory.create(TEST_CONFIGS.ollama.basic),
        MockProviderFactory.create(TEST_CONFIGS.openai.gpt4)
      ]
      
      const shortPrompt = 'Hi'
      const longPrompt = 'x'.repeat(200)
      
      for (const provider of providers) {
        const shortResponse = await provider.chat([
          { role: 'user', content: shortPrompt }
        ])
        const longResponse = await provider.chat([
          { role: 'user', content: longPrompt }
        ])
        
        assertValidTokenUsage(shortResponse.usage!)
        assertValidTokenUsage(longResponse.usage!)
        
        // Long prompt should use more tokens
        expect(longResponse.usage!.input!).toBeGreaterThan(shortResponse.usage!.input!)
      }
    })
  })

  describe('Error Handling Validation', () => {
    test('should handle all error types gracefully', async () => {
      const errorTypes = ['connection', 'authentication', 'rate_limit', 'model_not_found', 'timeout']
      const provider = MockProviderFactory.create(TEST_CONFIGS.ollama.basic)
      
      for (const errorType of errorTypes) {
        provider.simulateError(errorType as any)
        
        await expect(
          provider.chat([{ role: 'user', content: 'test' }])
        ).rejects.toThrow()
        
        provider.clearError()
      }
    })

    test('should recover from errors', async () => {
      const provider = MockProviderFactory.create(TEST_CONFIGS.ollama.basic)
      
      // Simulate error
      provider.simulateError('timeout')
      await expect(
        provider.chat([{ role: 'user', content: 'test' }])
      ).rejects.toThrow()
      
      // Clear error and retry
      provider.clearError()
      const response = await provider.chat([{ role: 'user', content: 'test' }])
      assertValidProviderResponse(response)
    })
  })

  describe('Performance Validation', () => {
    test('should meet latency requirements', async () => {
      const provider = MockProviderFactory.create(TEST_CONFIGS.ollama.basic)
      provider.setLatency(100)
      
      const startTime = Date.now()
      await provider.chat([{ role: 'user', content: 'Performance test' }])
      const elapsed = Date.now() - startTime
      
      expect(elapsed).toBeGreaterThanOrEqual(100)
      expect(elapsed).toBeLessThan(200) // Some overhead is acceptable
    })

    test('should handle concurrent requests', async () => {
      const provider = MockProviderFactory.create(TEST_CONFIGS.ollama.basic)
      
      const promises = Array.from({ length: 5 }, (_, i) => 
        provider.chat([{ role: 'user', content: `Concurrent test ${i}` }])
      )
      
      const responses = await Promise.all(promises)
      
      expect(responses).toHaveLength(5)
      responses.forEach(response => {
        assertValidProviderResponse(response)
      })
    })
  })
})
```

## Success Criteria

### Phase 2 Completion Checklist

#### ✅ **Comprehensive Provider Testing**
- [ ] All 3 main providers (Ollama, OpenAI, Gemini) have complete test suites
- [ ] >90% test coverage for each provider implementation
- [ ] All provider methods tested (chat, stream, listModels, getModel)
- [ ] Capability detection working correctly
- [ ] Authentication testing comprehensive

#### ✅ **Mock Provider System**
- [ ] Realistic mock implementations for all 3 providers
- [ ] Provider-specific response patterns implemented
- [ ] Error simulation working for all error types
- [ ] Streaming simulation accurate
- [ ] Token counting simulation provider-specific

#### ✅ **Integration Testing**
- [ ] Multi-provider scenarios tested
- [ ] Provider switching workflows validated
- [ ] Configuration loading tested
- [ ] Provider factory working correctly
- [ ] Cross-provider comparisons implemented

#### ✅ **Quality Validation**
- [ ] All tests passing consistently
- [ ] Error handling comprehensive
- [ ] Performance requirements met
- [ ] Response quality validation
- [ ] Token accuracy verified

### Expected Test Metrics
- **Total Tests**: ~150+ new tests added
- **Test Coverage**: >90% for provider implementations
- **Test Execution Time**: <2 minutes for all provider tests
- **Mock Accuracy**: >95% realistic behavior simulation

### Next Phase Preparation
Upon completion of Phase 2, the following will be ready for Phase 3:
- Solid provider testing foundation
- Comprehensive mock system
- Integration testing framework
- Quality validation processes

This establishes the foundation for Phase 3 (Configuration & Validation Testing) and subsequent phases.

---

**Implementation Notes:**
- Focus on one provider at a time for development
- Test each provider thoroughly before moving to the next
- Use the abstract test suite to ensure consistency
- Validate all success criteria before marking phase complete
- Document any issues or deviations from the plan