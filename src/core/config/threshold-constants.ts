/**
 * Threshold and Percentage Constants
 *
 * Contains all percentage-based thresholds, ratios, confidence levels,
 * and comparison values used throughout the application.
 */

// Token management thresholds
export const TOKEN_THRESHOLDS = {
  /** Suggest truncation when token usage exceeds this ratio (80%) */
  TRUNCATION_SUGGESTION: 0.8,
  /** Target token usage ratio for context management (70%) */
  TARGET_USAGE: 0.7,
  /** Memory danger zone threshold (90%) */
  MEMORY_DANGER: 0.9,
} as const;

// UI and layout ratios
export const UI_RATIOS = {
  /** Terminal width fraction for input components */
  TERMINAL_WIDTH_FRACTION: 0.9,
  /** Cache cleanup ratio - remove 25% of entries */
  CACHE_CLEANUP_RATIO: 0.25,
  /** Memory pool warning threshold (80%) */
  MEMORY_POOL_WARNING: 0.8,
} as const;

// Test coverage thresholds
export const COVERAGE = {
  /** Minimum branch coverage percentage */
  BRANCHES: 80,
  /** Minimum function coverage percentage */
  FUNCTIONS: 80,
  /** Minimum line coverage percentage */
  LINES: 80,
  /** Minimum statement coverage percentage */
  STATEMENTS: 80,
} as const;

// Fuzzy matching and search thresholds
export const MATCHING = {
  /** Default fuzzy matching threshold */
  DEFAULT_THRESHOLD: 0.6,
  /** High confidence fuzzy matching threshold */
  HIGH_THRESHOLD: 0.8,
  /** Low confidence fuzzy matching threshold */
  LOW_THRESHOLD: 0.3,
  /** Default minimum confidence level */
  DEFAULT_MIN_CONFIDENCE: 20,
  /** High minimum confidence level */
  HIGH_MIN_CONFIDENCE: 50,
  /** Low minimum confidence level */
  LOW_MIN_CONFIDENCE: 10,
} as const;

// Performance and optimization thresholds
export const PERFORMANCE = {
  /** Memory growth threshold for leak detection (MB) */
  MEMORY_GROWTH_THRESHOLD: 100,
  /** Minimum check count before memory leak warning */
  MIN_CHECKS_THRESHOLD: 10,
  /** Buffer size warning threshold */
  BUFFER_WARNING_SIZE: 1024,
} as const;

// String and content analysis thresholds
export const CONTENT = {
  /** Edit distance threshold for suggestions */
  EDIT_DISTANCE_THRESHOLD: 2,
  /** Minimum string length for certain operations */
  MIN_STRING_LENGTH: 2,
  /** Maximum string length for special handling */
  MAX_STRING_LENGTH: 50,
} as const;