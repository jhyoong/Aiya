# Provider System Architecture

## Overview

The Aiya provider system is a modular architecture that enables seamless integration with multiple AI/LLM providers. It provides a unified interface for interacting with different AI services while maintaining provider-specific optimizations and error handling.

## Core Components

### Base Provider Architecture

#### LLMProvider Abstract Class
**Location**: `src/core/providers/base.ts`

The `LLMProvider` abstract class defines the standard interface that all providers must implement:

```typescript
abstract class LLMProvider {
  // Core chat functionality
  abstract chat(messages: Message[]): Promise<Response>;
  abstract stream(messages: Message[]): AsyncGenerator<StreamResponse>;
  
  // Model information and capabilities
  abstract getModel(): string;
  abstract getModelInfo(): Promise<ModelInfo>;
  abstract getCapabilities(): Promise<ProviderCapabilities>;
  
  // Health and authentication
  abstract isHealthy(): Promise<boolean>;
  abstract isAuthenticated(): Promise<boolean>;
  
  // Utility methods
  abstract countTokens(text: string): number;
  abstract listAvailableModels(): Promise<string[]>;
  abstract supportsStreaming(): boolean;
}
```

#### Key Interfaces

**Message Interface**:
```typescript
interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}
```

**Response Interface**:
```typescript
interface Response {
  content: string;
  tokensUsed?: number;
  finishReason?: 'stop' | 'length' | 'tool_calls';
  toolCalls?: ToolCall[];
}
```

**StreamResponse Interface**:
```typescript
interface StreamResponse {
  content: string;
  done: boolean;
  tokensUsed?: number;
  toolCalls?: ToolCall[];
  usage?: UsageMetadata;
}
```

#### Provider Configuration

**ProviderConfig Interface**:
```typescript
interface ProviderConfig {
  type: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  maxTokens?: number;
  
  // Provider-specific configurations
  azure?: { deploymentName?: string; apiVersion?: string; };
  anthropic?: { maxTokens?: number; temperature?: number; };
  gemini?: { projectId?: string; location?: string; };
  bedrock?: { region: string; accessKeyId?: string; };
}
```

### Provider Factory System

#### ProviderFactory Class
**Location**: `src/core/providers/factory.ts`

The `ProviderFactory` is responsible for creating and validating provider instances:

**Key Methods**:
- `create(config: ExtendedProviderConfig): LLMProvider` - Creates provider instances
- `validateConfig(config: ExtendedProviderConfig): ConfigValidationResult` - Validates configuration
- `register(type: string, providerClass: Constructor)` - Registers provider classes
- `getAvailableProviders(): string[]` - Lists available provider types

**Design Patterns**:
- **Factory Pattern**: Creates provider instances based on configuration
- **Registry Pattern**: Registers and manages provider classes
- **Validation Pattern**: Validates configuration before creation

### Individual Provider Implementations

#### OllamaProvider
**Location**: `src/core/providers/ollama.ts`

**Characteristics**:
- **Local Model Support**: Connects to local Ollama server
- **No Authentication**: Doesn't require API keys
- **Context Window Configuration**: Supports custom context lengths
- **Model Management**: Can list and manage local models

**Key Features**:
- Automatic model detection and context length extraction
- Tool message conversion to user messages with context
- Configurable context window through `num_ctx` parameter
- Health checks via model listing

**Error Handling**:
- Uses `OllamaErrorMapper` for standardized error handling
- Specific handling for model not found and connection errors
- Graceful fallback for missing model information

#### OpenAIProvider
**Location**: `src/core/providers/openai.ts`

**Characteristics**:
- **API Key Required**: Requires valid OpenAI API key
- **Function Calling Support**: Supports OpenAI function calling
- **Streaming Support**: Full streaming response support
- **Model Filtering**: Filters to GPT models only

**Key Features**:
- Automatic API key validation
- Custom base URL support for OpenAI-compatible endpoints
- Token usage tracking from API responses
- Comprehensive finish reason mapping

**Error Handling**:
- Uses `OpenAIErrorMapper` for standardized error handling
- Authentication failure detection
- Model availability validation
- Rate limiting and quota error handling

#### Other Providers

**AnthropicProvider** (`src/core/providers/anthropic.ts`):
- Claude model support
- Message preprocessing for Anthropic format
- Thinking mode support
- Custom token limits

**GeminiProvider** (`src/core/providers/gemini.ts`):
- Google Gemini model support
- Project and location configuration
- Vision capabilities
- Custom generation parameters

**AzureOpenAIProvider** (`src/core/providers/azure.ts`):
- Azure OpenAI service integration
- Deployment-specific configuration
- Custom API versions
- Enterprise authentication

**BedrockProvider** (`src/core/providers/bedrock.ts`):
- AWS Bedrock service integration
- IAM authentication
- Regional configuration
- Multiple model support

### Configuration Management

#### ConfigManager Integration
**Location**: `src/core/config/manager.ts`

The `ConfigManager` handles provider configuration with support for:

**Multi-Provider Configuration**:
```yaml
providers:
  local-ollama:
    type: ollama
    model: qwen3:8b
    baseUrl: http://localhost:11434
  
  openai-gpt4:
    type: openai
    model: gpt-4o-mini
    apiKey: sk-...
  
  anthropic-claude:
    type: anthropic
    model: claude-3-5-sonnet-20241022
    apiKey: sk-ant-...

defaultProvider: local-ollama
```

**Single Provider Configuration**:
```yaml
provider:
  type: ollama
  model: qwen3:8b
  baseUrl: http://localhost:11434
```

**Environment Variable Support**:
- `AIYA_PROVIDER` - Override provider type
- `AIYA_MODEL` - Override model name
- `AIYA_BASE_URL` - Override base URL
- `AIYA_API_KEY` - Override API key
- Provider-specific environment variables (e.g., `OPENAI_API_KEY`)

#### Capability Management
**Location**: `src/core/config/CapabilityManager.ts`

The `CapabilityManager` provides centralized capability information:

```typescript
interface ProviderCapabilities {
  maxTokens: number;
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsThinking: boolean;
}
```

**Key Methods**:
- `getCapabilities(provider: string, model: string): ProviderCapabilities`
- `supportsFeature(provider: string, model: string, feature: string): boolean`
- `getModelList(provider: string): string[]`

### Error Handling System

#### Standardized Error Mapping
**Location**: `src/core/errors/`

Each provider has its own error mapper that converts provider-specific errors to standardized error types:

**Base Error Types**:
- `ProviderError` - Generic provider error
- `ModelNotFoundError` - Model not available
- `ConnectionError` - Network/connection issues
- `AuthenticationError` - Authentication failures
- `RateLimitError` - Rate limiting issues
- `QuotaError` - Quota exceeded

**Error Mapping Process**:
1. Provider-specific error occurs
2. Error mapper analyzes error details
3. Standardized error type is determined
4. User-friendly error message is generated
5. Suggestions for resolution are provided

#### Error Context
```typescript
interface ErrorContext {
  provider: string;
  operation: string;
  model: string;
  endpoint: string;
  timestamp: Date;
}
```

### Provider Switching

#### Runtime Provider Switching
The system supports switching between providers during runtime:

**Via Configuration**:
```typescript
const configManager = new ConfigManager();
await configManager.switchProvider('openai-gpt4');
```

**Via Chat Command**:
```bash
/model-switch
# Shows available providers
# User selects provider
# System switches active provider
```

**Provider Validation**:
- Configuration validation before switching
- Health checks for new provider
- Authentication verification
- Model availability confirmation

### Tool Integration

#### Tool Call Support
Providers that support function calling can handle tool calls:

**Tool Call Flow**:
1. User message includes tool request
2. Provider processes and returns tool calls
3. Tool executor runs the requested tools (file operations, shell commands)
4. Security approval required for dangerous shell commands
5. Tool results are sent back to provider
6. Provider generates final response

**Tool Call Conversion**:
- Different providers handle tool calls differently
- Base provider class provides standard interface
- Provider-specific implementations handle conversion

### Performance Optimizations

#### Token Counting
Each provider implements token counting for usage tracking:
- **Ollama**: Approximate counting (length/4)
- **OpenAI**: Built-in usage tracking from API
- **Anthropic**: Provider-specific counting
- **Gemini**: Custom counting algorithm

#### Connection Management
- Connection pooling for HTTP providers
- Keep-alive connections for streaming
- Timeout handling and retry logic
- Circuit breaker pattern for failed connections

#### Caching
- Model information caching
- Capability information caching
- Configuration caching
- Health status caching

### Security Considerations

#### API Key Management
- Secure storage of API keys
- Environment variable fallbacks
- Key validation before use
- No logging of sensitive information

#### Input Validation
- Message content validation
- Parameter sanitization
- Model name validation
- URL validation for custom endpoints

#### Rate Limiting
- Built-in rate limiting for providers
- Exponential backoff for retries
- Queue management for concurrent requests
- Usage tracking and quotas

### Extension Points

#### Adding New Providers
1. **Create Provider Class**: Extend `LLMProvider`
2. **Implement Required Methods**: All abstract methods must be implemented
3. **Add Configuration**: Update `ProviderConfig` interface
4. **Register Provider**: Add to `ProviderFactory`
5. **Add Error Mapping**: Create provider-specific error mapper
6. **Update Capabilities**: Add to `CapabilityManager`

#### Example New Provider:
```typescript
export class CustomProvider extends LLMProvider {
  constructor(config: ProviderConfig) {
    super(config);
    // Provider-specific initialization
  }
  
  async chat(messages: Message[]): Promise<Response> {
    // Implementation
  }
  
  // ... other required methods
}

// Register the provider
ProviderFactory.register('custom', CustomProvider);
```

### Testing Strategy

#### Unit Testing
- Mock provider implementations
- Configuration validation testing
- Error handling testing
- Capability management testing

#### Integration Testing
- Real provider connections (with test credentials)
- Multi-provider switching scenarios
- Error recovery testing
- Performance benchmarking

#### Mock Providers
**Location**: `tests/mocks/providers/`

Mock providers for testing:
- `MockOllamaProvider`
- `MockOpenAIProvider`
- `MockAnthropicProvider`
- `MockGeminiProvider`

## Best Practices

### Provider Implementation
1. **Follow Interface Contract**: Implement all required methods
2. **Handle Errors Gracefully**: Use standardized error mapping
3. **Validate Configuration**: Check required parameters
4. **Support Streaming**: Implement async generators properly
5. **Track Usage**: Provide accurate token counting
6. **Document Capabilities**: Clearly specify what the provider supports

### Configuration Management
1. **Use Hierarchical Config**: Support project and global configurations
2. **Provide Defaults**: Sensible defaults for all parameters
3. **Validate Early**: Check configuration at startup
4. **Support Environment Variables**: Allow override via environment
5. **Secure API Keys**: Never log or expose sensitive information

### Error Handling
1. **Use Specific Error Types**: Provide meaningful error classifications
2. **Include Context**: Provide enough information for debugging
3. **Suggest Solutions**: Help users resolve issues
4. **Log Appropriately**: Balance debugging info with security
5. **Fail Fast**: Detect issues early and fail gracefully