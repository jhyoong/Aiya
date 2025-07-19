/**
 * Limits and Capacity Constants
 *
 * Contains all magic numbers related to limits, capacities, maximums,
 * minimums, and size constraints throughout the application.
 */

// Token and context limits
export const TOKENS = {
  /** Default context limit for token counter */
  DEFAULT_CONTEXT_LIMIT: 4096,
  /** Maximum tokens for test configurations */
  TEST_MAX_TOKENS: 8192,
} as const;

// Memory and content limits
export const MEMORY = {
  /** Maximum message history to keep in memory */
  MAX_MESSAGE_HISTORY: 10000,
  /** Maximum streaming content size (500KB) */
  MAX_STREAMING_CONTENT_SIZE: 500 * 1024,
  /** Maximum timeout pool size for cleanup */
  MAX_TIMEOUT_POOL_SIZE: 10,
  /** Memory leak detection threshold in MB */
  MEMORY_LEAK_THRESHOLD_MB: 100,
} as const;

// Search and result limits
export const SEARCH = {
  /** Default maximum search results */
  DEFAULT_MAX_RESULTS: 50,
  /** Alternative maximum search results */
  ALT_MAX_RESULTS: 20,
  /** Small maximum search results for examples */
  SMALL_MAX_RESULTS: 10,
  /** Maximum directory depth for file searches */
  MAX_DIRECTORY_DEPTH: 10,
  /** Default context lines for search results */
  DEFAULT_CONTEXT_LINES: 2,
} as const;

// Iteration and processing limits
export const PROCESSING = {
  /** Maximum iterations to prevent infinite loops */
  MAX_ITERATIONS: 10,
  /** Maximum thread count for parallel processing */
  MAX_THREADS: 4,
  /** Minimum thread count for parallel processing */
  MIN_THREADS: 1,
  /** Maximum buffer size for special processing */
  MAX_BUFFER_SIZE: 1024,
} as const;

// Array and collection limits
export const COLLECTIONS = {
  /** Maximum number of suggestions to show */
  MAX_SUGGESTIONS: 3,
  /** Minimum array length for certain operations */
  MIN_ARRAY_LENGTH: 2,
  /** Standard single item check */
  SINGLE_ITEM: 1,
  /** Empty collection check */
  EMPTY: 0,
} as const;

// File and content size limits
export const FILES = {
  /** Minimum path length for validation */
  MIN_PATH_LENGTH: 2,
  /** Maximum lines to process in thinking parser */
  MAX_THINKING_LINES: 2,
  /** Content size threshold for special handling */
  CONTENT_SIZE_THRESHOLD: 1024,
} as const;

// Viewport and display limits  
export const VIEWPORT = {
  /** Test viewport width options */
  TEST_WIDTHS: [40, 60, 80, 100, 120] as const,
  /** Standard viewport width for performance tests */
  STANDARD_WIDTH: 80,
  /** Alternate viewport width for varied testing */
  ALTERNATE_WIDTH: 60,
} as const;