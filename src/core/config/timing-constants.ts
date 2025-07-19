/**
 * Timing and Timeout Constants
 *
 * Contains all timing-related magic numbers including timeouts, delays,
 * intervals, and duration settings throughout the application.
 */

// Standard timeout durations (in milliseconds)
export const TIMEOUTS = {
  /** Standard short timeout for API calls (5 seconds) */
  SHORT: 5000,
  /** Standard medium timeout for operations (10 seconds) */
  MEDIUM: 10000,
  /** Standard long timeout for complex operations (30 seconds) */
  LONG: 30000,
  /** Extended timeout for queue operations (5 minutes) */
  QUEUE: 300000,
  /** Default shell command timeout when none specified */
  SHELL_DEFAULT: 30000,
} as const;

// UI and interaction delays
export const DELAYS = {
  /** Short delay for UI state updates */
  UI_SHORT: 50,
  /** Medium delay for component transitions */
  UI_MEDIUM: 100,
  /** Long delay for user feedback */
  UI_LONG: 800,
  /** Delay before showing loading states */
  LOADING_SHOW: 1500,
  /** Delay before enabling skip options in setup */
  SKIP_OPTION_SHOW: 3000,
  /** Auto-continue delay for welcome screen */
  WELCOME_AUTO_CONTINUE: 2000,
  /** Delay between chunks in mock streaming */
  MOCK_CHUNK_DELAY: 30,
  /** Delay for mock Ollama operations */
  MOCK_OLLAMA_DELAY: 50,
  /** Delay for mock Gemini operations */
  MOCK_GEMINI_DELAY: 100,
} as const;

// Test and configuration timeouts
export const TEST_TIMEOUTS = {
  /** Integration test timeout (30 seconds) */
  INTEGRATION: 30000,
  /** Hook setup/teardown timeout (10 seconds) */
  HOOK: 10000,
  /** Unit test timeout for async operations */
  UNIT_ASYNC: 5000,
  /** Extended test timeout for complex operations */
  EXTENDED: 10000,
  /** Shell command test timeout (1 second) */
  SHELL_QUICK: 1000,
  /** Long running shell test timeout (60 seconds) */
  SHELL_LONG: 60000,
} as const;

// Connection and network timeouts
export const NETWORK = {
  /** AbortSignal timeout for API requests */
  ABORT_SIGNAL: 5000,
  /** Default connection timeout for providers */
  CONNECTION: 5000,
  /** Timeout for model registry operations */
  MODEL_REGISTRY: 5000,
  /** Filesystem operation timeout */
  FILESYSTEM: 30000,
} as const;

// Memory and cleanup intervals
export const CLEANUP = {
  /** Interval for memory leak detection checks */
  MEMORY_CHECK_INTERVAL: 10000,
  /** Minimum checks before reporting memory leaks */
  MIN_CHECKS_BEFORE_REPORT: 10,
} as const;