export enum ProviderErrorType {
  CONNECTION_FAILED = 'connection_failed',
  MODEL_NOT_FOUND = 'model_not_found',
  AUTHENTICATION_FAILED = 'authentication_failed',
  RATE_LIMITED = 'rate_limited',
  INVALID_REQUEST = 'invalid_request',
  SERVER_ERROR = 'server_error',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown',
}

export interface ErrorContext {
  provider: string;
  operation: string;
  model?: string;
  endpoint?: string;
  statusCode?: number;
  originalError?: any;
}

export interface ProviderError {
  success: false;
  error: string;
  errorType: ProviderErrorType;
  suggestions: string[];
  context: ErrorContext;
}

export interface ProviderSuccess {
  success: true;
}

export type ProviderResult = ProviderSuccess | ProviderError;

export abstract class BaseProviderErrorHandler {
  /**
   * Classify an error based on the error object and context
   */
  static classifyError(error: any, context: ErrorContext): ProviderErrorType {
    // Check for timeout errors
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      return ProviderErrorType.TIMEOUT;
    }

    // Check for connection errors
    if (
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('connection') ||
      error.message?.includes('Connection refused')
    ) {
      return ProviderErrorType.CONNECTION_FAILED;
    }

    // Check for authentication errors based on HTTP status
    if (
      context.statusCode === 401 ||
      error.message?.includes('401') ||
      error.message?.includes('Unauthorized') ||
      error.message?.includes('Invalid API key')
    ) {
      return ProviderErrorType.AUTHENTICATION_FAILED;
    }

    // Check for rate limiting
    if (
      context.statusCode === 429 ||
      error.message?.includes('rate limit') ||
      error.message?.includes('Too Many Requests')
    ) {
      return ProviderErrorType.RATE_LIMITED;
    }

    // Check for model not found errors
    if (
      error.message?.includes('model') &&
      (error.message?.includes('not found') ||
        error.message?.includes('does not exist') ||
        error.message?.includes('not available'))
    ) {
      return ProviderErrorType.MODEL_NOT_FOUND;
    }

    // Check for invalid request errors
    if (
      context.statusCode === 400 ||
      error.message?.includes('400') ||
      error.message?.includes('Bad Request') ||
      error.message?.includes('Invalid request')
    ) {
      return ProviderErrorType.INVALID_REQUEST;
    }

    // Check for server errors
    if (
      (context.statusCode && context.statusCode >= 500) ||
      error.message?.includes('500') ||
      error.message?.includes('Internal Server Error')
    ) {
      return ProviderErrorType.SERVER_ERROR;
    }

    return ProviderErrorType.UNKNOWN;
  }

  /**
   * Generate generic recovery suggestions based on error type
   */
  static generateGenericSuggestions(
    errorType: ProviderErrorType,
    _context: ErrorContext
  ): string[] {
    switch (errorType) {
      case ProviderErrorType.CONNECTION_FAILED:
        return [
          'Check network connectivity',
          'Verify the endpoint URL is correct',
          'Ensure the service is running',
        ];
      case ProviderErrorType.AUTHENTICATION_FAILED:
        return [
          'Check if the API key is correct',
          'Verify API key permissions',
          'Check account status and billing',
        ];
      case ProviderErrorType.MODEL_NOT_FOUND:
        return [
          'Verify the model name is correct',
          'Check available models',
          'Ensure the model is accessible',
        ];
      case ProviderErrorType.RATE_LIMITED:
        return [
          'Wait before retrying',
          'Check API rate limits',
          'Consider upgrading your plan',
        ];
      case ProviderErrorType.TIMEOUT:
        return [
          'Try again later',
          'Check network stability',
          'Verify service availability',
        ];
      case ProviderErrorType.INVALID_REQUEST:
        return [
          'Check request parameters',
          'Verify API documentation',
          'Ensure proper request format',
        ];
      case ProviderErrorType.SERVER_ERROR:
        return [
          'Try again later',
          'Check service status',
          'Contact support if issue persists',
        ];
      default:
        return [
          'Check logs for more details',
          'Verify configuration',
          'Try again later',
        ];
    }
  }

  /**
   * Create a standardized error response
   */
  static createError(
    errorType: ProviderErrorType,
    message: string,
    context: ErrorContext,
    suggestions: string[] = []
  ): ProviderError {
    const finalSuggestions =
      suggestions.length > 0
        ? suggestions
        : this.generateGenericSuggestions(errorType, context);

    return {
      success: false,
      error: message,
      errorType,
      suggestions: finalSuggestions,
      context,
    };
  }

  /**
   * Create a success response
   */
  static createSuccess(): ProviderSuccess {
    return { success: true };
  }

  /**
   * Standardize any error into a ProviderError format
   */
  static standardizeError(error: any, context: ErrorContext): ProviderError {
    const errorType = this.classifyError(error, context);
    const message =
      error.message || error.toString() || 'Unknown error occurred';

    return this.createError(errorType, message, {
      ...context,
      originalError: error,
    });
  }
}
