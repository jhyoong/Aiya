import { BaseProviderErrorHandler, ProviderErrorType, ErrorContext, ProviderError, ProviderResult } from './BaseProviderErrorHandler.js';

export class GeminiErrorMapper extends BaseProviderErrorHandler {
  /**
   * Detect Gemini-specific authentication errors
   */
  static detectAuthenticationError(error: any, statusCode?: number): boolean {
    return statusCode === 400 || statusCode === 401 || 
           error.message?.includes('400') || 
           error.message?.includes('401') ||
           error.message?.includes('Invalid API key') ||
           error.message?.includes('API key not valid') ||
           error.message?.includes('authentication');
  }

  /**
   * Detect Gemini-specific API disabled errors
   */
  static detectAPIDisabledError(error: any): boolean {
    return error.message?.includes('API has not been used') ||
           error.message?.includes('API is not enabled') ||
           error.message?.includes('Generative AI API') ||
           error.message?.includes('enable the API');
  }

  /**
   * Detect Gemini-specific model not found errors
   */
  static detectModelNotFound(error: any): boolean {
    return error.message?.includes('model') && 
           (error.message?.includes('not found') || 
            error.message?.includes('does not exist') ||
            error.message?.includes('not available'));
  }

  /**
   * Detect Gemini-specific quota/billing errors
   */
  static detectQuotaError(error: any, statusCode?: number): boolean {
    return statusCode === 429 || 
           error.message?.includes('429') || 
           error.message?.includes('quota') ||
           error.message?.includes('rate limit') ||
           error.message?.includes('Too Many Requests');
  }

  /**
   * Detect Gemini-specific content filtering errors
   */
  static detectContentFilterError(error: any): boolean {
    return error.message?.includes('content') && 
           (error.message?.includes('blocked') || 
            error.message?.includes('filtered') ||
            error.message?.includes('safety') ||
            error.message?.includes('harmful'));
  }

  /**
   * Generate Gemini-specific recovery suggestions
   */
  static generateRecoverySuggestions(errorType: ProviderErrorType, _context: ErrorContext): string[] {
    switch (errorType) {
      case ProviderErrorType.AUTHENTICATION_FAILED:
        return [
          'Check if the API key is correct',
          'Verify API key permissions',
          'Set GEMINI_API_KEY environment variable',
          'Get API key from Google AI Studio',
          'Check if Gemini API is enabled in your project'
        ];
      
      case ProviderErrorType.MODEL_NOT_FOUND:
        return [
          'Check available models in Google AI Studio',
          'Verify the model name is correct',
          'Use standard models like "gemini-1.5-pro" or "gemini-1.5-flash"',
          'Check if you have access to the requested model',
          'Verify model naming convention'
        ];
      
      case ProviderErrorType.RATE_LIMITED:
        return [
          'Wait before retrying the request',
          'Check your Gemini API quota',
          'Consider upgrading your plan',
          'Implement request throttling',
          'Spread requests over time'
        ];
      
      case ProviderErrorType.CONNECTION_FAILED:
        return [
          'Check internet connectivity',
          'Verify Google AI services are operational',
          'Try using a different network',
          'Check firewall settings',
          'Verify DNS resolution'
        ];
      
      case ProviderErrorType.TIMEOUT:
        return [
          'Try again with a shorter timeout',
          'Check network stability',
          'Verify Google AI service status',
          'Consider using a simpler prompt',
          'Check connection speed'
        ];
      
      case ProviderErrorType.INVALID_REQUEST:
        return [
          'Check request parameters',
          'Verify prompt format and length',
          'Check Gemini API documentation',
          'Ensure proper JSON formatting',
          'Verify content meets safety guidelines'
        ];
      
      case ProviderErrorType.SERVER_ERROR:
        return [
          'Try again later',
          'Check Google AI status page',
          'Verify service availability',
          'Contact Google support if issue persists',
          'Check for service outages'
        ];
      
      default:
        return [
          'Check Gemini API documentation',
          'Verify API key and permissions',
          'Check network connectivity',
          'Try again later'
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
    const suggestions = customSuggestions || this.generateRecoverySuggestions(errorType, context);
    
    return this.createError(errorType, message, {
      ...context,
      provider: 'gemini'
    }, suggestions);
  }

  /**
   * Handle Gemini-specific error classification and response
   */
  static handleGeminiError(error: any, context: ErrorContext): ProviderResult {
    // Enhanced context with Gemini-specific information
    const geminiContext: ErrorContext = {
      ...context,
      provider: 'gemini'
    };

    // Extract status code from error if available
    const statusCode = error.status || error.statusCode || context.statusCode;

    // Gemini-specific error detection
    if (this.detectAPIDisabledError(error)) {
      return this.createGeminiError(
        ProviderErrorType.AUTHENTICATION_FAILED,
        'Gemini API is not enabled',
        { ...geminiContext, statusCode },
        [
          'Enable Gemini API in Google Cloud Console',
          'Check if API is enabled for your project',
          'Verify billing is set up correctly',
          'Follow Google AI Studio setup guide'
        ]
      );
    }

    if (this.detectAuthenticationError(error, statusCode)) {
      return this.createGeminiError(
        ProviderErrorType.AUTHENTICATION_FAILED,
        'Gemini API authentication failed',
        { ...geminiContext, statusCode }
      );
    }

    if (this.detectQuotaError(error, statusCode)) {
      return this.createGeminiError(
        ProviderErrorType.RATE_LIMITED,
        'Gemini API quota exceeded',
        { ...geminiContext, statusCode }
      );
    }

    if (this.detectModelNotFound(error)) {
      return this.createGeminiError(
        ProviderErrorType.MODEL_NOT_FOUND,
        `Gemini model ${context.model} not found`,
        { ...geminiContext, statusCode }
      );
    }

    if (this.detectContentFilterError(error)) {
      return this.createGeminiError(
        ProviderErrorType.INVALID_REQUEST,
        'Content was blocked by Gemini safety filters',
        { ...geminiContext, statusCode },
        [
          'Review content for harmful material',
          'Adjust safety settings if appropriate',
          'Rephrase the prompt to be less sensitive',
          'Check Gemini content policies'
        ]
      );
    }

    // Fall back to generic error handling
    const errorType = this.classifyError(error, { ...geminiContext, statusCode });
    const message = error.message || 'Unknown Gemini error occurred';
    
    return this.createGeminiError(errorType, message, { ...geminiContext, statusCode });
  }
}