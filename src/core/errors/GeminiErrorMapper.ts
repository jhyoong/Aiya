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

export class GeminiErrorMapper extends BaseProviderErrorHandler {
  /**
   * Detect Gemini-specific authentication errors
   */
  static detectAuthenticationError(
    error: ErrorInput,
    statusCode?: number
  ): boolean {
    const message = safeGetMessage(error);
    return (
      statusCode === 400 ||
      statusCode === 401 ||
      message?.includes('400') ||
      message?.includes('401') ||
      message?.includes('Invalid API key') ||
      message?.includes('API key not valid') ||
      message?.includes('authentication') ||
      false
    );
  }

  /**
   * Detect Gemini-specific API disabled errors
   */
  static detectAPIDisabledError(error: ErrorInput): boolean {
    const message = safeGetMessage(error);
    return (
      message?.includes('API has not been used') ||
      message?.includes('API is not enabled') ||
      message?.includes('Generative AI API') ||
      message?.includes('enable the API') ||
      false
    );
  }

  /**
   * Detect Gemini-specific model not found errors
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
   * Detect Gemini-specific quota/billing errors
   */
  static detectQuotaError(error: ErrorInput, statusCode?: number): boolean {
    const message = safeGetMessage(error);
    return (
      statusCode === 429 ||
      message?.includes('429') ||
      message?.includes('quota') ||
      message?.includes('rate limit') ||
      message?.includes('Too Many Requests') ||
      false
    );
  }

  /**
   * Detect Gemini-specific content filtering errors
   */
  static detectContentFilterError(error: ErrorInput): boolean {
    const message = safeGetMessage(error);
    return (
      (message?.includes('content') &&
        (message?.includes('blocked') ||
          message?.includes('filtered') ||
          message?.includes('safety') ||
          message?.includes('harmful'))) ||
      false
    );
  }

  /**
   * Generate Gemini-specific recovery suggestions
   */
  static generateRecoverySuggestions(
    errorType: ProviderErrorType,
    _context: ErrorContext
  ): string[] {
    switch (errorType) {
      case ProviderErrorType.AUTHENTICATION_FAILED:
        return [
          'Check if the API key is correct',
          'Verify API key permissions',
          'Set GEMINI_API_KEY environment variable',
          'Get API key from Google AI Studio',
          'Check if Gemini API is enabled in your project',
        ];

      case ProviderErrorType.MODEL_NOT_FOUND:
        return [
          'Check available models in Google AI Studio',
          'Verify the model name is correct',
          'Use standard models like "gemini-1.5-pro" or "gemini-1.5-flash"',
          'Check if you have access to the requested model',
          'Verify model naming convention',
        ];

      case ProviderErrorType.RATE_LIMITED:
        return [
          'Wait before retrying the request',
          'Check your Gemini API quota',
          'Consider upgrading your plan',
          'Implement request throttling',
          'Spread requests over time',
        ];

      case ProviderErrorType.CONNECTION_FAILED:
        return [
          'Check internet connectivity',
          'Verify Google AI services are operational',
          'Try using a different network',
          'Check firewall settings',
          'Verify DNS resolution',
        ];

      case ProviderErrorType.TIMEOUT:
        return [
          'Try again with a shorter timeout',
          'Check network stability',
          'Verify Google AI service status',
          'Consider using a simpler prompt',
          'Check connection speed',
        ];

      case ProviderErrorType.INVALID_REQUEST:
        return [
          'Check request parameters',
          'Verify prompt format and length',
          'Check Gemini API documentation',
          'Ensure proper JSON formatting',
          'Verify content meets safety guidelines',
        ];

      case ProviderErrorType.SERVER_ERROR:
        return [
          'Try again later',
          'Check Google AI status page',
          'Verify service availability',
          'Contact Google support if issue persists',
          'Check for service outages',
        ];

      default:
        return [
          'Check Gemini API documentation',
          'Verify API key and permissions',
          'Check network connectivity',
          'Try again later',
        ];
    }
  }

  /**
   * Create Gemini-specific error with context
   */
  static createGeminiError(
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
        provider: 'gemini',
      },
      suggestions
    );
  }

  /**
   * Handle Gemini-specific error classification and response
   */
  static handleGeminiError(
    error: ErrorInput,
    context: ErrorContext
  ): ProviderResult {
    // Enhanced context with Gemini-specific information
    const geminiContext: ErrorContext = {
      ...context,
      provider: 'gemini',
    };

    // Extract status code from error if available
    const statusCode = safeGetStatusCode(error) || context.statusCode;

    // Gemini-specific error detection
    if (this.detectAPIDisabledError(error)) {
      return this.createGeminiError(
        ProviderErrorType.AUTHENTICATION_FAILED,
        'Gemini API is not enabled',
        { ...geminiContext, ...(statusCode ? { statusCode } : {}) },
        [
          'Enable Gemini API in Google Cloud Console',
          'Check if API is enabled for your project',
          'Verify billing is set up correctly',
          'Follow Google AI Studio setup guide',
        ]
      );
    }

    if (this.detectAuthenticationError(error, statusCode)) {
      return this.createGeminiError(
        ProviderErrorType.AUTHENTICATION_FAILED,
        'Gemini API authentication failed',
        { ...geminiContext, ...(statusCode ? { statusCode } : {}) }
      );
    }

    if (this.detectQuotaError(error, statusCode)) {
      return this.createGeminiError(
        ProviderErrorType.RATE_LIMITED,
        'Gemini API quota exceeded',
        { ...geminiContext, ...(statusCode ? { statusCode } : {}) }
      );
    }

    if (this.detectModelNotFound(error)) {
      return this.createGeminiError(
        ProviderErrorType.MODEL_NOT_FOUND,
        `Gemini model ${context.model} not found`,
        { ...geminiContext, ...(statusCode ? { statusCode } : {}) }
      );
    }

    if (this.detectContentFilterError(error)) {
      return this.createGeminiError(
        ProviderErrorType.INVALID_REQUEST,
        'Content was blocked by Gemini safety filters',
        { ...geminiContext, ...(statusCode ? { statusCode } : {}) },
        [
          'Review content for harmful material',
          'Adjust safety settings if appropriate',
          'Rephrase the prompt to be less sensitive',
          'Check Gemini content policies',
        ]
      );
    }

    // Fall back to generic error handling
    const errorType = this.classifyError(error, {
      ...geminiContext,
      ...(statusCode ? { statusCode } : {}),
    });
    const message = safeGetMessage(error) || 'Unknown Gemini error occurred';

    return this.createGeminiError(errorType, message, {
      ...geminiContext,
      ...(statusCode ? { statusCode } : {}),
    });
  }
}
