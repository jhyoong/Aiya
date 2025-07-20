import { ExtendedProviderConfig } from './manager.js';
import { ConnectionTestResult } from './collectors/base.js';
import {
  OllamaErrorMapper,
  OpenAIErrorMapper,
  GeminiErrorMapper,
  BaseProviderErrorHandler,
  ProviderResult,
  ErrorContext,
  ProviderErrorType,
} from '../errors/index.js';
import { isObject, hasProperty } from '../../types/UtilityTypes.js';
import { TIMEOUTS } from './timing-constants.js';

export class ConnectionTester {
  private static readonly TIMEOUT_MS = TIMEOUTS.MEDIUM;

  /**
   * Convert ProviderResult to ConnectionTestResult for backward compatibility
   */
  private static convertToConnectionTestResult(
    result: ProviderResult
  ): ConnectionTestResult {
    if (result.success) {
      return { success: true };
    }

    return {
      success: false,
      error: result.error,
      suggestions: result.suggestions,
    };
  }

  /**
   * Create AbortController with timeout for HTTP requests
   */
  private static createTimeoutController(): {
    controller: AbortController;
    cleanup: () => void;
  } {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      ConnectionTester.TIMEOUT_MS
    );

    return {
      controller,
      cleanup: () => clearTimeout(timeoutId),
    };
  }

  /**
   * Create standardized error context
   */
  private static createErrorContext(
    provider: string,
    config: ExtendedProviderConfig,
    endpoint?: string,
    statusCode?: number
  ): ErrorContext {
    return {
      provider,
      operation: 'connection_test',
      model: config.model,
      endpoint: endpoint || config.baseUrl,
      ...(statusCode && { statusCode }),
      timestamp: new Date(),
    };
  }

  /**
   * Validate API key and create error if missing
   */
  private static validateApiKey(
    config: ExtendedProviderConfig,
    provider: string,
    endpoint: string
  ): ProviderResult | null {
    if (!config.apiKey) {
      const context = ConnectionTester.createErrorContext(
        provider,
        config,
        endpoint
      );

      switch (provider) {
        case 'openai':
          return OpenAIErrorMapper.createOpenAIError(
            ProviderErrorType.AUTHENTICATION_FAILED,
            'API key is required',
            context
          );
        case 'gemini':
          return GeminiErrorMapper.createGeminiError(
            ProviderErrorType.AUTHENTICATION_FAILED,
            'API key is required',
            context
          );
        case 'anthropic':
          return BaseProviderErrorHandler.createError(
            ProviderErrorType.AUTHENTICATION_FAILED,
            'API key is required',
            context,
            [
              'Set ANTHROPIC_API_KEY environment variable',
              'Add apiKey to configuration',
              'Get API key from Anthropic Console',
            ]
          );
      }
    }
    return null;
  }

  /**
   * Handle HTTP response errors with provider-specific error mapping
   */
  private static handleHttpError(
    response: Response,
    provider: string,
    config: ExtendedProviderConfig,
    endpoint: string
  ): ProviderResult {
    const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
    const context = ConnectionTester.createErrorContext(
      provider,
      config,
      endpoint,
      response.status
    );

    switch (provider) {
      case 'ollama':
        return OllamaErrorMapper.handleOllamaError(error, context);
      case 'openai':
        return OpenAIErrorMapper.handleOpenAIError(error, context);
      case 'gemini':
        return GeminiErrorMapper.handleGeminiError(error, context);
      case 'anthropic':
        return BaseProviderErrorHandler.standardizeError(error, context);
      default:
        return BaseProviderErrorHandler.standardizeError(error, context);
    }
  }

  /**
   * Create model not found error for provider
   */
  private static createModelNotFoundError(
    provider: string,
    config: ExtendedProviderConfig,
    endpoint: string
  ): ProviderResult {
    const context = ConnectionTester.createErrorContext(
      provider,
      config,
      endpoint
    );
    const message = `Model ${config.model} not found`;

    switch (provider) {
      case 'ollama':
        return OllamaErrorMapper.createOllamaError(
          ProviderErrorType.MODEL_NOT_FOUND,
          message,
          context
        );
      case 'openai':
        return OpenAIErrorMapper.createOpenAIError(
          ProviderErrorType.MODEL_NOT_FOUND,
          message,
          context
        );
      case 'gemini':
        return GeminiErrorMapper.createGeminiError(
          ProviderErrorType.MODEL_NOT_FOUND,
          message,
          context
        );
      default:
        return BaseProviderErrorHandler.createError(
          ProviderErrorType.MODEL_NOT_FOUND,
          message,
          context
        );
    }
  }

  /**
   * Test connection to Ollama provider
   */
  async testOllama(
    config: ExtendedProviderConfig
  ): Promise<ConnectionTestResult> {
    if (!config.baseUrl) {
      return {
        success: false,
        error: 'Base URL is required for Ollama connection testing',
        suggestions: ['Please provide a valid Ollama server URL'],
      };
    }

    try {
      const { controller, cleanup } =
        ConnectionTester.createTimeoutController();

      const response = await fetch(`${config.baseUrl}/api/tags`, {
        signal: controller.signal,
      });

      cleanup();

      if (!response.ok) {
        const result = ConnectionTester.handleHttpError(
          response,
          'ollama',
          config,
          config.baseUrl
        );
        return ConnectionTester.convertToConnectionTestResult(result);
      }

      const data = await response.json();

      // Check if the specified model exists
      const modelExists =
        Array.isArray(data.models) &&
        data.models.some(
          (m: unknown) =>
            isObject(m) && hasProperty(m, 'name') && m.name === config.model
        );

      if (!modelExists) {
        const result = ConnectionTester.createModelNotFoundError(
          'ollama',
          config,
          config.baseUrl
        );
        return ConnectionTester.convertToConnectionTestResult(result);
      }

      return { success: true };
    } catch (error: unknown) {
      const context = ConnectionTester.createErrorContext('ollama', config);
      const result = OllamaErrorMapper.handleOllamaError(error, context);
      return ConnectionTester.convertToConnectionTestResult(result);
    }
  }

  /**
   * Test connection to OpenAI provider
   */
  async testOpenAI(
    config: ExtendedProviderConfig
  ): Promise<ConnectionTestResult> {
    try {
      const baseUrl = config.baseUrl || 'https://api.openai.com/v1';

      // Validate API key
      const apiKeyError = ConnectionTester.validateApiKey(
        config,
        'openai',
        baseUrl
      );
      if (apiKeyError) {
        return ConnectionTester.convertToConnectionTestResult(apiKeyError);
      }

      const { controller, cleanup } =
        ConnectionTester.createTimeoutController();

      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      cleanup();

      if (!response.ok) {
        const result = ConnectionTester.handleHttpError(
          response,
          'openai',
          config,
          baseUrl
        );
        return ConnectionTester.convertToConnectionTestResult(result);
      }

      const data = await response.json();

      // Check if the specified model exists
      const modelExists =
        Array.isArray(data.data) &&
        data.data.some(
          (m: unknown) =>
            isObject(m) && hasProperty(m, 'id') && m.id === config.model
        );

      if (!modelExists) {
        const result = ConnectionTester.createModelNotFoundError(
          'openai',
          config,
          baseUrl
        );
        return ConnectionTester.convertToConnectionTestResult(result);
      }

      return { success: true };
    } catch (error: unknown) {
      const context = ConnectionTester.createErrorContext('openai', config);
      const result = OpenAIErrorMapper.handleOpenAIError(error, context);
      return ConnectionTester.convertToConnectionTestResult(result);
    }
  }

  /**
   * Test connection to Gemini provider
   */
  async testGemini(
    config: ExtendedProviderConfig
  ): Promise<ConnectionTestResult> {
    try {
      const endpoint = 'https://generativelanguage.googleapis.com/v1';

      // Validate API key
      const apiKeyError = ConnectionTester.validateApiKey(
        config,
        'gemini',
        endpoint
      );
      if (apiKeyError) {
        return ConnectionTester.convertToConnectionTestResult(apiKeyError);
      }

      const { controller, cleanup } =
        ConnectionTester.createTimeoutController();

      const response = await fetch(`${endpoint}/models?key=${config.apiKey}`, {
        signal: controller.signal,
      });

      cleanup();

      if (!response.ok) {
        const result = ConnectionTester.handleHttpError(
          response,
          'gemini',
          config,
          endpoint
        );
        return ConnectionTester.convertToConnectionTestResult(result);
      }

      const data = await response.json();

      // Check if the specified model exists
      const modelExists = data.models?.some((m: unknown) => {
        if (!isObject(m)) return false;
        const hasName = hasProperty(m, 'name') && typeof m.name === 'string';
        const hasDisplayName =
          hasProperty(m, 'displayName') && typeof m.displayName === 'string';
        return (
          (hasName && (m.name as string).includes(config.model)) ||
          (hasDisplayName && (m.displayName as string) === config.model)
        );
      });

      if (!modelExists) {
        const result = ConnectionTester.createModelNotFoundError(
          'gemini',
          config,
          endpoint
        );
        return ConnectionTester.convertToConnectionTestResult(result);
      }

      return { success: true };
    } catch (error: unknown) {
      const context = ConnectionTester.createErrorContext(
        'gemini',
        config,
        'https://generativelanguage.googleapis.com/v1'
      );
      const result = GeminiErrorMapper.handleGeminiError(error, context);
      return ConnectionTester.convertToConnectionTestResult(result);
    }
  }

  /**
   * Test connection to Anthropic provider
   */
  async testAnthropic(
    config: ExtendedProviderConfig
  ): Promise<ConnectionTestResult> {
    try {
      const endpoint = 'https://api.anthropic.com/v1';

      // Validate API key
      const apiKeyError = ConnectionTester.validateApiKey(
        config,
        'anthropic',
        endpoint
      );
      if (apiKeyError) {
        return ConnectionTester.convertToConnectionTestResult(apiKeyError);
      }

      const { controller, cleanup } =
        ConnectionTester.createTimeoutController();

      const response = await fetch(`${endpoint}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        }),
        signal: controller.signal,
      });

      cleanup();

      if (!response.ok) {
        // Handle specific Anthropic error cases
        if (response.status === 400) {
          try {
            const errorData = await response.json();
            if (errorData.error?.message?.includes('model')) {
              const result = ConnectionTester.createModelNotFoundError(
                'anthropic',
                config,
                endpoint
              );
              return ConnectionTester.convertToConnectionTestResult(result);
            }
          } catch {
            // Ignore JSON parsing errors
          }
        }

        const result = ConnectionTester.handleHttpError(
          response,
          'anthropic',
          config,
          endpoint
        );
        return ConnectionTester.convertToConnectionTestResult(result);
      }

      return { success: true };
    } catch (error: unknown) {
      const context = ConnectionTester.createErrorContext(
        'anthropic',
        config,
        'https://api.anthropic.com/v1'
      );
      const result = BaseProviderErrorHandler.standardizeError(error, context);
      return ConnectionTester.convertToConnectionTestResult(result);
    }
  }

  /**
   * Test connection for any provider type
   */
  async testProvider(
    config: ExtendedProviderConfig
  ): Promise<ConnectionTestResult> {
    switch (config.type) {
      case 'ollama':
        return this.testOllama(config);
      case 'openai':
        return this.testOpenAI(config);
      case 'gemini':
        return this.testGemini(config);
      case 'anthropic':
        return this.testAnthropic(config);
      case 'azure':
        // Azure OpenAI uses similar logic to OpenAI but with different endpoints
        return this.testOpenAI(config);
      case 'bedrock':
        // Bedrock testing would require AWS SDK setup
        return {
          success: false,
          error: 'Bedrock connection testing not implemented yet',
          suggestions: [
            'Configure AWS credentials',
            'Test manually with AWS CLI',
          ],
        };
      default:
        return {
          success: false,
          error: `Unknown provider type: ${config.type}`,
          suggestions: ['Check provider configuration'],
        };
    }
  }
}
