/**
 * Error Type Definitions
 * 
 * Structured error handling types that replace `any` usage throughout the application.
 * This module provides comprehensive error classification, context, and handling patterns.
 */

/**
 * Comprehensive error classification for all provider operations.
 */
export enum ProviderErrorType {
  CONNECTION_FAILED = 'connection_failed',
  MODEL_NOT_FOUND = 'model_not_found',
  AUTHENTICATION_FAILED = 'authentication_failed',
  RATE_LIMITED = 'rate_limited',
  INVALID_REQUEST = 'invalid_request',
  SERVER_ERROR = 'server_error',
  TIMEOUT = 'timeout',
  INVALID_RESPONSE = 'invalid_response',
  CONFIGURATION_ERROR = 'configuration_error',
  NETWORK_ERROR = 'network_error',
  UNKNOWN = 'unknown',
}

/**
 * Standard HTTP error codes for API interactions.
 */
export enum HttpStatusCode {
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  TIMEOUT = 408,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}

/**
 * Structured error context that replaces any types in error handling.
 */
export interface ErrorContext {
  /** The provider where the error occurred */
  provider: string;
  
  /** The operation that was being performed */
  operation: string;
  
  /** The model being used (if applicable) */
  model?: string;
  
  /** The API endpoint that was called */
  endpoint?: string;
  
  /** HTTP status code (if applicable) */
  statusCode?: HttpStatusCode;
  
  /** Request ID for tracing (if available) */
  requestId?: string;
  
  /** Timestamp when the error occurred */
  timestamp: Date;
  
  /** Additional metadata specific to the error */
  metadata?: Record<string, string | number | boolean>;
  
  /** Original error object for debugging */
  originalError?: unknown;
}

/**
 * Base interface for all structured errors.
 */
export interface BaseError {
  /** Human-readable error message */
  message: string;
  
  /** Error classification type */
  type: ProviderErrorType;
  
  /** Error context information */
  context: ErrorContext;
  
  /** Suggested actions for resolving the error */
  suggestions: string[];
  
  /** Whether this error is retryable */
  retryable: boolean;
  
  /** Unique error code for programmatic handling */
  code?: string;
}

/**
 * Network-related error details.
 */
export interface NetworkError extends BaseError {
  type: ProviderErrorType.NETWORK_ERROR | ProviderErrorType.CONNECTION_FAILED | ProviderErrorType.TIMEOUT;
  networkDetails: {
    /** DNS resolution status */
    dnsResolved: boolean;
    /** Connection establishment time (if successful) */
    connectionTime?: number;
    /** Request timeout duration */
    timeoutMs: number;
  };
}

/**
 * Authentication-related error details.
 */
export interface AuthenticationError extends BaseError {
  type: ProviderErrorType.AUTHENTICATION_FAILED;
  authDetails: {
    /** Type of authentication that failed */
    authType: 'api_key' | 'oauth' | 'basic' | 'bearer';
    /** Whether the credentials are present */
    credentialsPresent: boolean;
    /** Whether the credentials format is valid */
    credentialsValid: boolean;
  };
}

/**
 * Rate limiting error details.
 */
export interface RateLimitError extends BaseError {
  type: ProviderErrorType.RATE_LIMITED;
  rateLimitDetails: {
    /** Number of requests allowed per period */
    limit: number;
    /** Number of requests remaining */
    remaining: number;
    /** When the rate limit resets */
    resetAt: Date;
    /** Suggested retry delay in milliseconds */
    retryAfterMs: number;
  };
}

/**
 * Configuration error details.
 */
export interface ConfigurationError extends BaseError {
  type: ProviderErrorType.CONFIGURATION_ERROR;
  configDetails: {
    /** The configuration field that has an issue */
    field: string;
    /** The current value (sanitized) */
    currentValue?: string;
    /** Expected value format or range */
    expectedFormat: string;
    /** Validation error details */
    validationError: string;
  };
}

/**
 * Union type of all structured error types.
 */
export type StructuredError = 
  | NetworkError 
  | AuthenticationError 
  | RateLimitError 
  | ConfigurationError 
  | BaseError;

/**
 * Result type that replaces any usage in provider responses.
 */
export interface ProviderResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: StructuredError;
}

/**
 * Success result wrapper.
 */
export interface SuccessResult<T> extends ProviderResult<T> {
  success: true;
  data: T;
  error?: never;
}

/**
 * Error result wrapper.
 */
export interface ErrorResult extends ProviderResult<never> {
  success: false;
  data?: never;
  error: StructuredError;
}

/**
 * Type guard to check if an unknown value is a structured error.
 */
export function isStructuredError(value: unknown): value is StructuredError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    'type' in value &&
    'context' in value &&
    typeof (value as any).message === 'string' &&
    Object.values(ProviderErrorType).includes((value as any).type)
  );
}

/**
 * Type guard to check if a result is a success.
 */
export function isSuccessResult<T>(result: ProviderResult<T>): result is SuccessResult<T> {
  return result.success === true;
}

/**
 * Type guard to check if a result is an error.
 */
export function isErrorResult<T>(result: ProviderResult<T>): result is ErrorResult {
  return result.success === false;
}

/**
 * Error classification patterns for converting unknown errors to structured errors.
 */
export interface ErrorPattern {
  /** Regex or string patterns to match in error messages */
  messagePatterns: (string | RegExp)[];
  
  /** Error type to assign when pattern matches */
  errorType: ProviderErrorType;
  
  /** Whether this error type is retryable */
  retryable: boolean;
  
  /** Default suggestions for this error type */
  suggestions: string[];
}

/**
 * Default error patterns for common error scenarios.
 */
export const DEFAULT_ERROR_PATTERNS: ErrorPattern[] = [
  {
    messagePatterns: [/ECONNREFUSED/, /connection refused/i, /connect timeout/i],
    errorType: ProviderErrorType.CONNECTION_FAILED,
    retryable: true,
    suggestions: ['Check if the service is running', 'Verify the base URL is correct', 'Check network connectivity']
  },
  {
    messagePatterns: [/timeout/i, /ETIMEDOUT/, /request timeout/i],
    errorType: ProviderErrorType.TIMEOUT,
    retryable: true,
    suggestions: ['Retry the request', 'Check network stability', 'Consider increasing timeout values']
  },
  {
    messagePatterns: [/unauthorized/i, /invalid.*api.*key/i, /authentication/i],
    errorType: ProviderErrorType.AUTHENTICATION_FAILED,
    retryable: false,
    suggestions: ['Check your API key', 'Verify authentication credentials', 'Ensure proper permissions']
  },
  {
    messagePatterns: [/rate.*limit/i, /too many requests/i, /quota.*exceeded/i],
    errorType: ProviderErrorType.RATE_LIMITED,
    retryable: true,
    suggestions: ['Wait before retrying', 'Check rate limit status', 'Consider upgrading your plan']
  },
  {
    messagePatterns: [/model.*not.*found/i, /model.*does not exist/i],
    errorType: ProviderErrorType.MODEL_NOT_FOUND,
    retryable: false,
    suggestions: ['Check the model name', 'Verify model availability', 'Use a different model']
  },
];