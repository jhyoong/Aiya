/**
 * Shell MCP Module - Barrel Exports
 * 
 * This file provides a clean public API for the Shell MCP system by exporting
 * all necessary components from the modular architecture.
 */

// =============================================================================
// MAIN CLIENT
// =============================================================================

export { ShellMCPClient } from './shell-mcp-client.js';

// =============================================================================
// CORE TYPES AND INTERFACES
// =============================================================================

export type {
  ShellExecuteParams,
  ShellExecuteResult,
  ShellErrorContext,
  ShellSecurityEvent,
  ShellExecutionLog,
  ShellToolConfig,
} from './types.js';

export { ShellErrorType } from './types.js';

// =============================================================================
// COMMAND CATEGORIZATION
// =============================================================================

export { 
  CommandCategory,
  categorizeCommand,
  type CommandCategorization,
} from './command-categorization.js';

// =============================================================================
// CONSTANTS
// =============================================================================

export {
  SAFE_COMMAND_PATTERNS,
  RISKY_COMMAND_PATTERNS,
  DANGEROUS_COMMAND_PATTERNS,
  BLOCKED_COMMAND_PATTERNS,
  TIMEOUTS,
  LIMITS,
  EXIT_CODES,
  ERROR_PRIORITIES,
  SHELL_EXPANSION_PATTERNS,
  PATH_TRAVERSAL_PATTERNS,
  DEFAULT_SHELL_CONFIG,
} from './constants.js';

// =============================================================================
// SECURITY MODULES
// =============================================================================

export { DangerousCommandDetector } from './security/dangerous-command-detector.js';
export { CommandSanitizer } from './security/command-sanitizer.js';
export { WorkspaceBoundaryEnforcer } from './security/workspace-boundary-enforcer.js';
export { CommandFilter } from './security/command-filter.js';

// =============================================================================
// MONITORING MODULES
// =============================================================================

export { ShellPerformanceMonitor } from './monitoring/performance-monitor.js';
export { ShellExecutionLogger } from './monitoring/execution-logger.js';

// =============================================================================
// ERROR HANDLING MODULES
// =============================================================================

export { 
  ShellExecutionError,
} from './errors/base-errors.js';

export {
  ShellSecurityError,
  ShellWorkspaceViolationError,
  ShellPathTraversalError,
  ShellCommandBlockedError,
} from './errors/security-errors.js';

export {
  ShellPermissionError,
  ShellTimeoutError,
  ShellCommandNotFoundError,
  ShellInputValidationError,
} from './errors/base-errors.js';

export {
  ShellErrorCategorizer,
} from './errors/execution-errors.js';