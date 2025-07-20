/**
 * Test-Specific Constants
 *
 * Contains all magic numbers used specifically in tests, mocks,
 * and testing configurations throughout the test suite.
 */

// Test configuration values
export const TEST_CONFIG = {
  /** Maximum tokens for test provider configurations */
  MAX_TOKENS: 8192,
  /** Test timeout configuration in milliseconds */
  TIMEOUT: 5000,
  /** Extended test timeout for complex operations */
  EXTENDED_TIMEOUT: 10000,
  /** Version string for CLI tests */
  CLI_VERSION: '1.0.0',
} as const;

// Mock provider delays and settings
export const MOCK_SETTINGS = {
  /** Delay between chunks for Gemini mock streaming */
  GEMINI_CHUNK_DELAY: 100,
  /** Delay between chunks for Ollama mock streaming */
  OLLAMA_CHUNK_DELAY: 50,
  /** Delay between chunks for OpenAI mock streaming */
  OPENAI_CHUNK_DELAY: 30,
  /** General mock operation delay */
  GENERAL_DELAY: 100,
} as const;

// Test data and expectations
export const TEST_DATA = {
  /** Expected minimum number of chunks in streaming tests */
  MIN_CHUNKS: 2,
  /** Expected minimum content chunks */
  MIN_CONTENT_CHUNKS: 0,
  /** Expected history length after operations */
  EXPECTED_HISTORY_LENGTH: 3,
  /** Single provider count expectation */
  SINGLE_PROVIDER: 1,
  /** No providers expectation */
  NO_PROVIDERS: 0,
} as const;

// Performance test parameters
export const PERFORMANCE_TEST = {
  /** Standard viewport widths for testing */
  VIEWPORT_WIDTHS: [40, 60, 80, 100, 120] as const,
  /** Standard viewport width for most tests */
  STANDARD_WIDTH: 80,
  /** Alternative width for variation testing */
  ALT_WIDTH: 60,
  /** Baseline width for performance comparisons */
  BASELINE_WIDTH: 40,
  /** Extended width for stress testing */
  EXTENDED_WIDTH: 120,
  /** Medium width for balanced testing */
  MEDIUM_WIDTH: 100,
} as const;

// Test thresholds and limits
export const TEST_LIMITS = {
  /** Minimum expected test execution time variance */
  MIN_TIME_VARIANCE: 0,
  /** Expected number of visual lines threshold */
  MIN_VISUAL_LINES: 0,
  /** Test iteration count for stress testing */
  STRESS_ITERATIONS: 20,
  /** Test data width variation base */
  WIDTH_VARIATION_BASE: 60,
  /** Test data width variation range */
  WIDTH_VARIATION_RANGE: 20,
} as const;

// Shell and command test values
export const SHELL_TEST = {
  /** Short timeout for quick shell operations */
  QUICK_TIMEOUT: 1000,
  /** Long timeout for extended shell operations */
  LONG_TIMEOUT: 60000,
  /** Test command that should timeout */
  TIMEOUT_COMMAND: 'sleep 5',
  /** Expected timeout for shell test command */
  EXPECTED_TIMEOUT: 1000,
} as const;
