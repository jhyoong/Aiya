/**
 * Centralized Configuration Constants Export
 *
 * This file provides a single entry point for importing all application constants.
 * Import individual constant modules for specific use cases, or use the grouped
 * exports for convenient access to related constants.
 */

// Individual constant module exports
export * from './constants.js';
export * from '../mcp/shell-constants.js';
export * from './ui-constants.js';
export * from './timing-constants.js';
export * from './limits-constants.js';
export * from './threshold-constants.js';
export * from './test-constants.js';

// Grouped exports for convenience
export {
  TERMINAL,
  LAYOUT,
  VISUAL,
  TEXT,
  NAVIGATION,
  BUFFER,
} from './ui-constants.js';

export {
  TIMEOUTS,
  DELAYS,
  TEST_TIMEOUTS,
  NETWORK,
  CLEANUP,
} from './timing-constants.js';

export {
  TOKENS,
  MEMORY,
  SEARCH,
  PROCESSING,
  COLLECTIONS,
  FILES,
  VIEWPORT,
} from './limits-constants.js';

export {
  TOKEN_THRESHOLDS,
  UI_RATIOS,
  COVERAGE,
  MATCHING,
  PERFORMANCE,
  CONTENT,
} from './threshold-constants.js';

export {
  TEST_CONFIG,
  MOCK_SETTINGS,
  TEST_DATA,
  PERFORMANCE_TEST,
  TEST_LIMITS,
  SHELL_TEST,
} from './test-constants.js';

// Existing exports from provider constants
export {
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_CAPABILITIES_DESCRIPTIONS,
  type ProviderType,
} from './constants.js';

// Existing exports from shell constants
export {
  COMMANDS_REQUIRING_APPROVAL,
  extractCommandName,
  requiresApproval,
} from '../mcp/shell-constants.js';
