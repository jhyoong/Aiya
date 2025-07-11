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

export class ConnectionTester {
  private static readonly TIMEOUT_MS = 10000; // 10 seconds

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
   * Test connection to Ollama provider
   */
  async testOllama(
    config: ExtendedProviderConfig
  ): Promise<ConnectionTestResult> {
    try {
      // Test /api/tags endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        ConnectionTester.TIMEOUT_MS
      );

      const response = await fetch(`${config.baseUrl}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Check if the specified model exists
      const modelExists = data.models?.some(
        (m: any) => m.name === config.model
      );

      if (!modelExists) {
        const context: ErrorContext = {
          provider: 'ollama',
          operation: 'connection_test',
          model: config.model,
          endpoint: config.baseUrl,
        };

        const result = OllamaErrorMapper.createOllamaError(
          ProviderErrorType.MODEL_NOT_FOUND,
          `Model ${config.model} not found`,
          context
        );

        return ConnectionTester.convertToConnectionTestResult(result);
      }

      return { success: true };
    } catch (error: any) {
      const context: ErrorContext = {
        provider: 'ollama',
        operation: 'connection_test',
        model: config.model,
        endpoint: config.baseUrl,
      };

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
      if (!config.apiKey) {
        const context: ErrorContext = {
          provider: 'openai',
          operation: 'connection_test',
          model: config.model,
          endpoint: config.baseUrl,
        };

        const result = OpenAIErrorMapper.createOpenAIError(
          ProviderErrorType.AUTHENTICATION_FAILED,
          'API key is required',
          context
        );

        return ConnectionTester.convertToConnectionTestResult(result);
      }

      // Test with minimal models endpoint call
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        ConnectionTester.TIMEOUT_MS
      );

      const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = new Error(
          `HTTP ${response.status}: ${response.statusText}`
        );
        const context: ErrorContext = {
          provider: 'openai',
          operation: 'connection_test',
          model: config.model,
          endpoint: baseUrl,
          statusCode: response.status,
        };

        const result = OpenAIErrorMapper.handleOpenAIError(error, context);
        return ConnectionTester.convertToConnectionTestResult(result);
      }

      const data = await response.json();

      // Check if the specified model exists
      const modelExists = data.data?.some((m: any) => m.id === config.model);

      if (!modelExists) {
        const context: ErrorContext = {
          provider: 'openai',
          operation: 'connection_test',
          model: config.model,
          endpoint: baseUrl,
        };

        const result = OpenAIErrorMapper.createOpenAIError(
          ProviderErrorType.MODEL_NOT_FOUND,
          `Model ${config.model} not found`,
          context
        );

        return ConnectionTester.convertToConnectionTestResult(result);
      }

      return { success: true };
    } catch (error: any) {
      const context: ErrorContext = {
        provider: 'openai',
        operation: 'connection_test',
        model: config.model,
        endpoint: config.baseUrl,
      };

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
      if (!config.apiKey) {
        const context: ErrorContext = {
          provider: 'gemini',
          operation: 'connection_test',
          model: config.model,
          endpoint: 'https://generativelanguage.googleapis.com/v1',
        };

        const result = GeminiErrorMapper.createGeminiError(
          ProviderErrorType.AUTHENTICATION_FAILED,
          'API key is required',
          context
        );

        return ConnectionTester.convertToConnectionTestResult(result);
      }

      // Test with models endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        ConnectionTester.TIMEOUT_MS
      );

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${config.apiKey}`,
        {
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = new Error(
          `HTTP ${response.status}: ${response.statusText}`
        );
        const context: ErrorContext = {
          provider: 'gemini',
          operation: 'connection_test',
          model: config.model,
          endpoint: 'https://generativelanguage.googleapis.com/v1',
          statusCode: response.status,
        };

        const result = GeminiErrorMapper.handleGeminiError(error, context);
        return ConnectionTester.convertToConnectionTestResult(result);
      }

      const data = await response.json();

      // Check if the specified model exists
      const modelExists = data.models?.some(
        (m: any) =>
          m.name.includes(config.model) || m.displayName === config.model
      );

      if (!modelExists) {
        const context: ErrorContext = {
          provider: 'gemini',
          operation: 'connection_test',
          model: config.model,
          endpoint: 'https://generativelanguage.googleapis.com/v1',
        };

        const result = GeminiErrorMapper.createGeminiError(
          ProviderErrorType.MODEL_NOT_FOUND,
          `Model ${config.model} not found`,
          context
        );

        return ConnectionTester.convertToConnectionTestResult(result);
      }

      return { success: true };
    } catch (error: any) {
      const context: ErrorContext = {
        provider: 'gemini',
        operation: 'connection_test',
        model: config.model,
        endpoint: 'https://generativelanguage.googleapis.com/v1',
      };

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
      if (!config.apiKey) {
        const context: ErrorContext = {
          provider: 'anthropic',
          operation: 'connection_test',
          model: config.model,
          endpoint: 'https://api.anthropic.com/v1',
        };

        const result = BaseProviderErrorHandler.createError(
          ProviderErrorType.AUTHENTICATION_FAILED,
          'API key is required',
          context,
          [
            'Set ANTHROPIC_API_KEY environment variable',
            'Add apiKey to configuration',
            'Get API key from Anthropic Console',
          ]
        );

        return ConnectionTester.convertToConnectionTestResult(result);
      }

      // Test with a minimal message
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        ConnectionTester.TIMEOUT_MS
      );

      const response = await fetch('https://api.anthropic.com/v1/messages', {
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

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorType = ProviderErrorType.UNKNOWN;
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        if (response.status === 401) {
          errorType = ProviderErrorType.AUTHENTICATION_FAILED;
          errorMessage = 'Invalid API key';
        } else if (response.status === 400) {
          try {
            const errorData = await response.json();
            if (errorData.error?.message?.includes('model')) {
              errorType = ProviderErrorType.MODEL_NOT_FOUND;
              errorMessage = `Model ${config.model} not available`;
            }
          } catch {
            // Ignore JSON parsing errors
          }
        }

        const context: ErrorContext = {
          provider: 'anthropic',
          operation: 'connection_test',
          model: config.model,
          endpoint: 'https://api.anthropic.com/v1',
          statusCode: response.status,
        };

        const result = BaseProviderErrorHandler.createError(
          errorType,
          errorMessage,
          context
        );
        return ConnectionTester.convertToConnectionTestResult(result);
      }

      return { success: true };
    } catch (error: any) {
      const context: ErrorContext = {
        provider: 'anthropic',
        operation: 'connection_test',
        model: config.model,
        endpoint: 'https://api.anthropic.com/v1',
      };

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
