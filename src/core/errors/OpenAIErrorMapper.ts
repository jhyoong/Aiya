import {
  BaseProviderErrorHandler,
  ProviderErrorType,
  ErrorContext,
  ProviderError,
  ProviderResult,
  ErrorInput,
  safeGetMessage,
  safeGetStatusCode,
} from './BaseProviderErrorHandler.js';

export class OpenAIErrorMapper extends BaseProviderErrorHandler {
  /**
   * Detect OpenAI-specific authentication errors
   */
  static detectAuthenticationError(
    error: ErrorInput,
    statusCode?: number
  ): boolean {
    const message = safeGetMessage(error);
    return (
      statusCode === 401 ||
      message?.includes('401') ||
      message?.includes('Unauthorized') ||
      message?.includes('Invalid API key') ||
      message?.includes('authentication') ||
      false
    );
  }

  /**
   * Detect OpenAI-specific rate limiting errors
   */
  static detectRateLimitError(error: ErrorInput, statusCode?: number): boolean {
    const message = safeGetMessage(error);
    return (
      statusCode === 429 ||
      message?.includes('429') ||
      message?.includes('rate limit') ||
      message?.includes('Too Many Requests') ||
      false
    );
  }

  /**
   * Detect OpenAI-specific model not found errors
   */
  static detectModelNotFound(error: ErrorInput, statusCode?: number): boolean {
    const message = safeGetMessage(error);
    return (
      statusCode === 404 ||
      message?.includes('404') ||
      (message?.includes('model') &&
        (message?.includes('not found') ||
          message?.includes('does not exist'))) ||
      false
    );
  }

  /**
   * Detect OpenAI-specific billing/quota errors
   */
  static detectBillingError(error: ErrorInput): boolean {
    const message = safeGetMessage(error);
    return (
      message?.includes('billing') ||
      message?.includes('quota') ||
      message?.includes('insufficient') ||
      message?.includes('exceeded') ||
      false
    );
  }

  /**
   * Generate OpenAI-specific recovery suggestions
   */
  static generateRecoverySuggestions(
    errorType: ProviderErrorType,
    _context: ErrorContext
  ): string[] {
    switch (errorType) {
      case ProviderErrorType.AUTHENTICATION_FAILED:
        return [
          'Check if the API key is correct',
          'Verify API key starts with "sk-"',
          'Set OPENAI_API_KEY environment variable',
          'Check OpenAI account billing status',
          'Verify API key permissions',
        ];

      case ProviderErrorType.MODEL_NOT_FOUND:
        return [
          'Check available models in OpenAI dashboard',
          'Verify the model name is correct',
          'Use standard models like "gpt-4" or "gpt-3.5-turbo"',
          'Check if you have access to the requested model',
          'Verify model availability in your region',
        ];

      case ProviderErrorType.RATE_LIMITED:
        return [
          'Wait before retrying the request',
          'Check your OpenAI rate limits',
          'Consider upgrading your OpenAI plan',
          'Implement exponential backoff',
          'Spread requests over time',
        ];

      case ProviderErrorType.CONNECTION_FAILED:
        return [
          'Check internet connectivity',
          'Verify the API endpoint URL',
          'Check if OpenAI services are operational',
          'Try using a different network',
          'Verify firewall settings',
        ];

      case ProviderErrorType.TIMEOUT:
        return [
          'Try again with a shorter timeout',
          'Check network stability',
          'Verify OpenAI service status',
          'Consider using a simpler prompt',
          'Check your connection speed',
        ];

      case ProviderErrorType.INVALID_REQUEST:
        return [
          'Check request parameters',
          'Verify prompt format and length',
          'Check OpenAI API documentation',
          'Ensure proper JSON formatting',
          'Verify model-specific requirements',
        ];

      case ProviderErrorType.SERVER_ERROR:
        return [
          'Try again later',
          'Check OpenAI status page',
          'Verify service availability',
          'Contact OpenAI support if issue persists',
          'Check for service outages',
        ];

      default:
        return [
          'Check OpenAI API documentation',
          'Verify API key and permissions',
          'Check network connectivity',
          'Try again later',
        ];
    }
  }

  /**
   * Create OpenAI-specific error with context
   */
  static createOpenAIError(
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
        provider: 'openai',
      },
      suggestions
    );
  }

  /**
   * Handle OpenAI-specific error classification and response
   */
  static handleOpenAIError(
    error: ErrorInput,
    context: ErrorContext
  ): ProviderResult {
    // Enhanced context with OpenAI-specific information
    const openaiContext: ErrorContext = {
      ...context,
      provider: 'openai',
    };

    // Extract status code from error if available
    const statusCode = safeGetStatusCode(error) || context.statusCode;

    // OpenAI-specific error detection
    if (this.detectAuthenticationError(error, statusCode)) {
      return this.createOpenAIError(
        ProviderErrorType.AUTHENTICATION_FAILED,
        'OpenAI API authentication failed',
        { ...openaiContext, ...(statusCode ? { statusCode } : {}) }
      );
    }

    if (this.detectRateLimitError(error, statusCode)) {
      return this.createOpenAIError(
        ProviderErrorType.RATE_LIMITED,
        'OpenAI API rate limit exceeded',
        { ...openaiContext, ...(statusCode ? { statusCode } : {}) }
      );
    }

    if (this.detectModelNotFound(error, statusCode)) {
      return this.createOpenAIError(
        ProviderErrorType.MODEL_NOT_FOUND,
        `OpenAI model ${context.model} not found`,
        { ...openaiContext, ...(statusCode ? { statusCode } : {}) }
      );
    }

    if (this.detectBillingError(error)) {
      return this.createOpenAIError(
        ProviderErrorType.AUTHENTICATION_FAILED,
        'OpenAI billing or quota issue',
        { ...openaiContext, ...(statusCode ? { statusCode } : {}) },
        [
          'Check OpenAI account billing status',
          'Verify payment method is valid',
          'Check usage limits and quotas',
          'Contact OpenAI support for billing issues',
        ]
      );
    }

    // Fall back to generic error handling
    const errorType = this.classifyError(error, {
      ...openaiContext,
      ...(statusCode ? { statusCode } : {}),
    });
    const message = safeGetMessage(error) || 'Unknown OpenAI error occurred';

    return this.createOpenAIError(errorType, message, {
      ...openaiContext,
      ...(statusCode ? { statusCode } : {}),
    });
  }
}
