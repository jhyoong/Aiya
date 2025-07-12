/**
 * Utility Type Definitions
 * 
 * Shared utility types and type helpers used throughout the application.
 * This module provides reusable type patterns and eliminates the need for
 * `any` types in common scenarios.
 */

/**
 * Makes all properties of a type optional, recursively.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Makes specific properties of a type required.
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Makes specific properties of a type optional.
 */
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Creates a type where all properties are strings (useful for environment variables).
 */
export type StringRecord = Record<string, string>;

/**
 * Creates a type for configuration objects with unknown additional properties.
 */
export type ConfigObject<T = Record<string, unknown>> = T & {
  [key: string]: string | number | boolean | null | undefined | ConfigObject;
};

/**
 * Type for JSON-serializable values (replaces `any` in JSON contexts).
 */
export type JsonValue = 
  | string 
  | number 
  | boolean 
  | null 
  | JsonObject 
  | JsonArray;

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface JsonArray extends Array<JsonValue> {}

/**
 * Type for callback functions with unknown parameters (safer than Function).
 */
export type CallbackFunction<T extends unknown[] = unknown[], R = unknown> = (...args: T) => R;

/**
 * Type for event handlers.
 */
export type EventHandler<T = unknown> = (event: T) => void;

/**
 * Type for async operations that may fail.
 */
export type AsyncResult<T, E = Error> = Promise<
  | { success: true; data: T }
  | { success: false; error: E }
>;

/**
 * Type for validation functions.
 */
export type Validator<T> = (value: unknown) => value is T;

/**
 * Type for transformation functions.
 */
export type Transformer<T, U> = (input: T) => U;

/**
 * Type for objects that can be cleaned up.
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Type for objects with cleanup methods.
 */
export interface Cleanupable {
  cleanup(): void;
}

/**
 * Type for time-based values (milliseconds).
 */
export type Milliseconds = number;

/**
 * Type for size-based values (bytes).
 */
export type Bytes = number;

/**
 * Type for percentage values (0-100).
 */
export type Percentage = number;

/**
 * Type for ID strings.
 */
export type ID = string;

/**
 * Type for timestamp values.
 */
export type Timestamp = number | Date;

/**
 * Type for version strings.
 */
export type Version = string;

/**
 * Type for URL strings.
 */
export type URL = string;

/**
 * Type for file paths.
 */
export type FilePath = string;

/**
 * Type for directory paths.
 */
export type DirectoryPath = string;

/**
 * Generic cache entry type.
 */
export interface CacheEntry<T> {
  value: T;
  timestamp: Timestamp;
  expiresAt?: Timestamp;
  accessCount: number;
  lastAccessed: Timestamp;
}

/**
 * Generic queue item type.
 */
export interface QueueItem<T> {
  id: ID;
  data: T;
  priority: number;
  createdAt: Timestamp;
  attempts: number;
  maxAttempts: number;
}

/**
 * Generic pagination parameters.
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset?: number;
}

/**
 * Generic pagination result.
 */
export interface PaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Generic search parameters.
 */
export interface SearchParams {
  query: string;
  filters?: Record<string, unknown>;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  pagination?: PaginationParams;
}

/**
 * Generic search result.
 */
export interface SearchResult<T> {
  items: T[];
  total: number;
  query: string;
  executionTime: Milliseconds;
  facets?: Record<string, Array<{ value: string; count: number }>>;
}

/**
 * Type for environment configuration.
 */
export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  [key: string]: string;
}

/**
 * Type for feature flags.
 */
export type FeatureFlags = Record<string, boolean>;

/**
 * Type for metrics and telemetry data.
 */
export interface MetricsData {
  name: string;
  value: number;
  unit: string;
  timestamp: Timestamp;
  tags?: Record<string, string>;
  metadata?: JsonObject;
}

/**
 * Type for log entries.
 */
export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Timestamp;
  context?: Record<string, unknown>;
  error?: Error;
  requestId?: ID;
}

/**
 * Type guard utility functions.
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isFunction(value: unknown): value is CallbackFunction {
  return typeof value === 'function';
}

export function isNull(value: unknown): value is null {
  return value === null;
}

export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type for safe unknown object access.
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

/**
 * Type for safe property access with type checking.
 */
export function getTypedProperty<T>(
  obj: unknown,
  key: string,
  typeGuard: (value: unknown) => value is T
): T | undefined {
  if (hasProperty(obj, key)) {
    const value = obj[key];
    return typeGuard(value) ? value : undefined;
  }
  return undefined;
}