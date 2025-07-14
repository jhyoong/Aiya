import {
  ProviderErrorType,
  ErrorContext,
  isStructuredError,
  DEFAULT_ERROR_PATTERNS,
} from '../../types/ErrorTypes.js';

// Re-export types for backward compatibility
export { ProviderErrorType, ErrorContext } from '../../types/ErrorTypes.js';

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
  static classifyError(
    error: unknown,
    context: ErrorContext
  ): ProviderErrorType {
    // If it's already a structured error, return its type
    if (isStructuredError(error)) {
      return error.type;
    }
    // Use structured error classification patterns
    const errorMessage = this.extractErrorMessage(error);

    for (const pattern of DEFAULT_ERROR_PATTERNS) {
      if (this.matchesPattern(errorMessage, pattern.messagePatterns)) {
        return pattern.errorType;
      }
    }

    // Additional status code-based classification
    if (context.statusCode) {
      switch (context.statusCode) {
        case 400:
          return ProviderErrorType.INVALID_REQUEST;
        case 401:
        case 403:
          return ProviderErrorType.AUTHENTICATION_FAILED;
        case 404:
          return ProviderErrorType.MODEL_NOT_FOUND;
        case 408:
        case 504:
          return ProviderErrorType.TIMEOUT;
        case 429:
          return ProviderErrorType.RATE_LIMITED;
        case 500:
        case 502:
        case 503:
          return ProviderErrorType.SERVER_ERROR;
        default:
          return ProviderErrorType.UNKNOWN;
      }
    }

    return ProviderErrorType.UNKNOWN;
  }

  /**
   * Extract error message from unknown error object
   */
  private static extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof (error as any).message === 'string'
    ) {
      return (error as any).message;
    }
    return String(error);
  }

  /**
   * Check if error message matches any of the patterns
   */
  private static matchesPattern(
    message: string,
    patterns: (string | RegExp)[]
  ): boolean {
    return patterns.some(pattern => {
      if (typeof pattern === 'string') {
        return message.toLowerCase().includes(pattern.toLowerCase());
      }
      return pattern.test(message);
    });
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
