import {
  BaseProviderErrorHandler,
  ProviderErrorType,
  ErrorContext,
  ProviderError,
  ProviderResult,
  ErrorInput,
  safeGetMessage,
} from './BaseProviderErrorHandler.js';

export class OllamaErrorMapper extends BaseProviderErrorHandler {
  /**
   * Detect Ollama-specific model not found errors
   */
  static detectModelNotFound(error: ErrorInput): boolean {
    const message = safeGetMessage(error);
    return (
      (message?.includes('model') &&
        (message?.includes('not found') ||
          message?.includes('does not exist') ||
          message?.includes('not available'))) ||
      false
    );
  }

  /**
   * Detect Ollama-specific connection errors
   */
  static detectConnectionError(error: ErrorInput): boolean {
    const message = safeGetMessage(error);
    return (
      message?.includes('ECONNREFUSED') ||
      message?.includes('connection') ||
      message?.includes('Connection refused') ||
      message?.includes('fetch failed') ||
      false
    );
  }

  /**
   * Detect Ollama server not running errors
   */
  static detectServerNotRunning(error: ErrorInput): boolean {
    const message = safeGetMessage(error);
    return (
      (message?.includes('ECONNREFUSED') && message?.includes('11434')) || false
    );
  }

  /**
   * Generate Ollama-specific recovery suggestions
   */
  static generateRecoverySuggestions(
    errorType: ProviderErrorType,
    context: ErrorContext
  ): string[] {
    switch (errorType) {
      case ProviderErrorType.MODEL_NOT_FOUND:
        return [
          `Run: ollama pull ${context.model}`,
          'Check available models with: ollama list',
          'Verify the model name is correct',
          'Check if the model is spelled correctly',
        ];

      case ProviderErrorType.CONNECTION_FAILED: {
        const suggestions = [
          'Check if Ollama is running: ollama serve',
          'Verify the server URL is correct',
          'Check firewall and network connectivity',
        ];

        if (context.endpoint?.includes('11434')) {
          suggestions.unshift('Start Ollama server: ollama serve');
          suggestions.push('Check if port 11434 is available');
        }

        return suggestions;
      }

      case ProviderErrorType.TIMEOUT:
        return [
          'Check if Ollama server is responsive',
          'Verify network connectivity to Ollama server',
          'Try using a smaller model if available',
          'Check Ollama server logs for issues',
        ];

      case ProviderErrorType.SERVER_ERROR:
        return [
          'Check Ollama server logs',
          'Restart Ollama server: ollama serve',
          'Verify model is properly loaded',
          'Check system resources (RAM, disk space)',
        ];

      default:
        return [
          'Check Ollama documentation',
          'Verify Ollama installation',
          'Check server logs for details',
          'Try restarting Ollama server',
        ];
    }
  }

  /**
   * Create Ollama-specific error with context
   */
  static createOllamaError(
    errorType: ProviderErrorType,
    message: string,
    context: ErrorContext,
    customSuggestions?: string[]
  ): ProviderError {
    const suggestions =
      customSuggestions || this.generateRecoverySuggestions(errorType, context);

    return this.createError(
      errorType,
      message,
      {
        ...context,
        provider: 'ollama',
      },
      suggestions
    );
  }

  /**
   * Handle Ollama-specific error classification and response
   */
  static handleOllamaError(
    error: ErrorInput,
    context: ErrorContext
  ): ProviderResult {
    // Enhanced context with Ollama-specific information
    const ollamaContext: ErrorContext = {
      ...context,
      provider: 'ollama',
    };

    // Ollama-specific error detection
    if (this.detectServerNotRunning(error)) {
      return this.createOllamaError(
        ProviderErrorType.CONNECTION_FAILED,
        'Ollama server is not running',
        ollamaContext,
        [
          'Start Ollama server: ollama serve',
          'Check if port 11434 is available',
          'Verify Ollama installation',
        ]
      );
    }

    if (this.detectModelNotFound(error)) {
      return this.createOllamaError(
        ProviderErrorType.MODEL_NOT_FOUND,
        `Model ${context.model} not found`,
        ollamaContext
      );
    }

    if (this.detectConnectionError(error)) {
      return this.createOllamaError(
        ProviderErrorType.CONNECTION_FAILED,
        'Failed to connect to Ollama server',
        ollamaContext
      );
    }

    // Fall back to generic error handling
    const errorType = this.classifyError(error, ollamaContext);
    const message = safeGetMessage(error) || 'Unknown Ollama error occurred';

    return this.createOllamaError(errorType, message, ollamaContext);
  }
}
