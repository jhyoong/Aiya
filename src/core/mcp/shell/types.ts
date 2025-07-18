/**
 * TypeScript interfaces and types for the Shell MCP system
 * 
 * This file contains all interface definitions used throughout the shell module,
 * with risk-based fields removed and category-based fields added.
 */

import { CommandCategory } from './command-categorization.js';

// =============================================================================
// CORE SHELL INTERFACES
// =============================================================================

/**
 * Parameters for shell command execution
 */
export interface ShellExecuteParams {
  /** The command to execute */
  command: string;
  
  /** Working directory (optional, defaults to workspace root) */
  cwd?: string;
  
  /** Timeout in seconds (optional, defaults to 30) */
  timeout?: number;
}

/**
 * Result of shell command execution
 */
export interface ShellExecuteResult {
  /** Whether the command executed successfully */
  success: boolean;
  
  /** Standard output from the command */
  stdout: string;
  
  /** Standard error output from the command */
  stderr: string;
  
  /** Command exit code */
  exitCode: number;
  
  /** Execution time in milliseconds */
  executionTime: number;
}

// =============================================================================
// ERROR HANDLING TYPES
// =============================================================================

/**
 * Shell Error Types for comprehensive error classification
 */
export enum ShellErrorType {
  EXECUTION_ERROR = 'execution_error',
  SECURITY_ERROR = 'security_error',
  PERMISSION_ERROR = 'permission_error',
  TIMEOUT_ERROR = 'timeout_error',
  COMMAND_NOT_FOUND = 'command_not_found',
  INPUT_VALIDATION = 'input_validation',
  WORKSPACE_VIOLATION = 'workspace_violation',
  PATH_TRAVERSAL = 'path_traversal',
  COMMAND_BLOCKED = 'command_blocked',
  DANGEROUS_COMMAND = 'dangerous_command',
  CONFIGURATION_ERROR = 'configuration_error',
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * Shell Error Context for comprehensive error tracking
 * Updated to use category instead of riskScore
 */
export interface ShellErrorContext {
  /** The command that caused the error */
  command: string;
  
  /** Working directory where command was executed */
  workingDirectory: string;
  
  /** Command timeout (if applicable) */
  timeout?: number;
  
  /** Command exit code (if applicable) */
  exitCode?: number;
  
  /** Command execution time (if applicable) */
  executionTime?: number;
  
  /** Command category instead of risk score */
  category?: CommandCategory;
  
  /** Pattern that matched for categorization */
  matchedPattern?: string;
  
  /** Security event description */
  securityEvent?: string;
  
  /** When the error occurred */
  timestamp: Date;
  
  /** User identifier (if available) */
  userId?: string;
  
  /** Session identifier */
  sessionId?: string;
  
  /** Original error that caused this */
  originalError?: unknown;
}

// =============================================================================
// CONFIGURATION INTERFACES
// =============================================================================

/**
 * Shell Tool Configuration
 * Simplified to remove risk-based scoring in favor of category-based decisions
 */
export interface ShellToolConfig {
  /** Commands that are always allowed without confirmation */
  allowedCommands: string[];
  
  /** Commands that are always blocked */
  blockedCommands: string[];
  
  /** Patterns that are always blocked (catastrophic commands) */
  alwaysBlockPatterns: string[];
  
  /** Patterns that are auto-approved (legacy compatibility) */
  autoApprovePatterns: string[];
  
  /** Maximum execution time in seconds */
  maxExecutionTime: number;
  
  /** Allow complex commands (pipes, redirects, etc.) */
  allowComplexCommands: boolean;
  
  /** Require confirmation for any command */
  requireConfirmation: boolean;
  
  // New category-based configuration (replaces confirmationThreshold)
  /** Require confirmation for risky commands */
  requireConfirmationForRisky: boolean;
  
  /** Require confirmation for dangerous commands */
  requireConfirmationForDangerous: boolean;
  
  /** Allow dangerous commands (with confirmation) */
  allowDangerous: boolean;
  
  /** Commands that bypass confirmation (trusted patterns) */
  trustedCommands: string[];
  
  /** Timeout for user confirmation prompts (milliseconds) */
  confirmationTimeout: number;
  
  /** Remember confirmation decisions for the session */
  sessionMemory: boolean;
}

// =============================================================================
// SECURITY EVENT INTERFACES
// =============================================================================

/**
 * Security event for logging and monitoring
 * Updated to use category instead of riskScore
 */
export interface ShellSecurityEvent {
  /** Unique event identifier */
  id: string;
  
  /** When the event occurred */
  timestamp: Date;
  
  /** Type of security event */
  eventType: 'COMMAND_BLOCKED' | 'COMMAND_DENIED' | 'DANGEROUS_COMMAND' | 'PATH_TRAVERSAL' | 
             'WORKSPACE_VIOLATION' | 'USER_CONFIRMATION' | 'TRUSTED_BYPASS';
  
  /** The command that triggered the event */
  command: string;
  
  /** Working directory */
  workingDirectory: string;
  
  /** Event description */
  description: string;
  
  /** Additional reason */
  reason?: string;
  
  /** Command category instead of risk score */
  category?: CommandCategory;
  
  /** Pattern that matched for categorization */
  matchedPattern?: string;
  
  /** User context */
  userContext?: string;
  
  /** Session identifier */
  sessionId?: string;
  
  /** User identifier */
  userId?: string;
}

// =============================================================================
// EXECUTION LOGGING INTERFACES
// =============================================================================

/**
 * Execution log entry for audit trails
 * Updated to use category-based assessment instead of risk scores
 */
export interface ShellExecutionLog {
  /** Unique log entry identifier */
  id: string;
  
  /** When the command was executed */
  timestamp: Date;
  
  /** The executed command */
  command: string;
  
  /** Working directory */
  workingDirectory: string;
  
  /** Command exit code */
  exitCode: number;
  
  /** Execution time in milliseconds */
  executionTime: number;
  
  /** Whether execution was successful */
  success: boolean;
  
  /** Standard output (truncated if necessary) */
  stdout?: string;
  
  /** Standard error output */
  stderr?: string;
  
  /** Error type if execution failed */
  errorType?: ShellErrorType;
  
  /** Session identifier */
  sessionId: string;
  
  /** User identifier */
  userId?: string;
  
  /** Category-based assessment instead of risk assessment */
  categoryAssessment: {
    /** Command category */
    category: CommandCategory;
    
    /** Pattern that matched */
    matchedPattern?: string;
    
    /** Whether manual approval was required */
    manualApprovalRequired: boolean;
    
    /** Whether the command was approved */
    approved: boolean;
    
    /** Approval method */
    approvalMethod?: 'automatic' | 'user_confirmation' | 'trusted_command';
  };
  
  /** Performance metrics */
  performanceMetrics?: {
    /** CPU usage percentage */
    cpuUsage?: number;
    
    /** Memory usage in bytes */
    memoryUsage?: number;
    
    /** Network activity */
    networkActivity?: {
      requests: number;
      bytesTransferred: number;
    };
    
    /** File system operations */
    fileSystemOperations?: {
      reads: number;
      writes: number;
      bytesRead: number;
      bytesWritten: number;
    };
  };
  
  /** Security events during execution */
  securityEvents?: ShellSecurityEvent[];
}

// =============================================================================
// LOGGING AND MONITORING INTERFACES
// =============================================================================

/**
 * Log Level enumeration for filtering
 */
export enum ShellLogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  SECURITY = 'security',
}

/**
 * Log Query interface for filtering logs
 * Updated to support category-based filtering instead of risk scores
 */
export interface ShellLogQuery {
  /** Filter by date range */
  dateRange?: {
    start: Date;
    end: Date;
  };
  
  /** Filter by command pattern */
  commandPattern?: string;
  
  /** Filter by success status */
  success?: boolean;
  
  /** Filter by error type */
  errorType?: ShellErrorType;
  
  /** Filter by user ID */
  userId?: string;
  
  /** Filter by session ID */
  sessionId?: string;
  
  /** Filter by single category */
  category?: CommandCategory;
  
  /** Filter by multiple categories */
  categories?: CommandCategory[];
  
  /** Filter by execution time range (milliseconds) */
  executionTimeRange?: {
    min: number;
    max: number;
  };
  
  /** Maximum number of results */
  limit?: number;
  
  /** Offset for pagination */
  offset?: number;
}

/**
 * Log Statistics interface for reporting
 * Updated to use category-based metrics instead of risk scores
 */
export interface ShellLogStatistics {
  /** Total number of executions */
  totalExecutions: number;
  
  /** Number of successful executions */
  successfulExecutions: number;
  
  /** Number of failed executions */
  failedExecutions: number;
  
  /** Success rate percentage */
  successRate: number;
  
  /** Average execution time */
  averageExecutionTime: number;
  
  /** Top commands by frequency */
  topCommands: Array<{
    command: string;
    count: number;
    successRate: number;
  }>;
  
  /** Top error types */
  topErrors: Array<{
    errorType: string;
    count: number;
    percentage: number;
  }>;
  
  /** Category distribution instead of risk score distribution */
  categoryDistribution: {
    [CommandCategory.SAFE]: number;
    [CommandCategory.RISKY]: number;
    [CommandCategory.DANGEROUS]: number;
    [CommandCategory.BLOCKED]: number;
  };
  
  /** Execution time distribution */
  executionTimeDistribution: {
    fast: number; // < 1s
    normal: number; // 1-10s
    slow: number; // > 10s
  };
  
  /** Security events summary */
  securityEventsSummary: {
    totalEvents: number;
    blockedCommands: number;
    pathTraversalAttempts: number;
    dangerousCommands: number;
    workspaceViolations: number;
  };
}

// =============================================================================
// EXPORT INTERFACES
// =============================================================================

/**
 * Export format options
 */
export enum ShellLogExportFormat {
  JSON = 'json',
  CSV = 'csv',
  HTML = 'html',
  TEXT = 'text',
}

/**
 * Export configuration
 */
export interface ShellLogExportConfig {
  /** Export format */
  format: ShellLogExportFormat;
  
  /** Optional query to filter logs */
  query?: ShellLogQuery;
  
  /** Include security events */
  includeSecurityEvents?: boolean;
  
  /** Include performance metrics */
  includePerformanceMetrics?: boolean;
  
  /** Include sensitive data in export */
  includeSensitiveData?: boolean;
  
  /** Fields to include (if not specified, all fields included) */
  fields?: string[];
  
  /** Maximum number of records to export */
  maxRecords?: number;
}

// =============================================================================
// PATTERN AND VALIDATION INTERFACES
// =============================================================================

/**
 * Error pattern for intelligent error classification
 */
export interface ErrorPattern {
  /** Regex patterns that match error messages */
  messagePatterns: RegExp[];
  
  /** Optional patterns for stderr matching */
  stderrPatterns?: RegExp[];
  
  /** Exit codes associated with this error type */
  exitCodes: number[];
  
  /** Error type identifier */
  errorType: string;
  
  /** Priority for error classification (higher = more specific) */
  priority: number;
  
  /** Whether this error is retryable */
  retryable: boolean;
  
  /** Suggested solutions for this error */
  suggestions: string[];
}

/**
 * Command validation result
 */
export interface CommandValidationResult {
  /** Whether the command is valid */
  valid: boolean;
  
  /** Reason for validation failure */
  reason?: string;
  
  /** Sanitized version of the command */
  sanitized?: string;
  
  /** Command category */
  category?: CommandCategory;
  
  /** Validation warnings */
  warnings?: string[];
}

// =============================================================================
// PERFORMANCE MONITORING INTERFACES
// =============================================================================

/**
 * Performance metrics for command execution
 */
export interface PerformanceMetrics {
  /** CPU usage statistics */
  cpuUsage: number[];
  
  /** Memory usage statistics */
  memoryUsage: number[];
  
  /** Network activity metrics */
  networkActivity: {
    requests: number;
    bytesTransferred: number;
  };
  
  /** File system operation metrics */
  fileSystemOperations: {
    reads: number;
    writes: number;
    bytesRead: number;
    bytesWritten: number;
  };
}

/**
 * Performance summary statistics
 */
export interface PerformanceSummary {
  /** Average CPU usage percentage */
  averageCpuUsage: number;
  
  /** Peak CPU usage percentage */
  peakCpuUsage: number;
  
  /** Average memory usage in bytes */
  averageMemoryUsage: number;
  
  /** Peak memory usage in bytes */
  peakMemoryUsage: number;
  
  /** Total network requests */
  totalNetworkRequests: number;
  
  /** Total bytes transferred */
  totalBytesTransferred: number;
  
  /** Total file system operations */
  totalFileSystemOperations: number;
}

// =============================================================================
// CONFIRMATION SYSTEM INTERFACES
// =============================================================================

/**
 * User confirmation response
 */
export interface ConfirmationResponse {
  /** Whether the user approved the command */
  approved: boolean;
  
  /** User's decision */
  decision: 'allow' | 'deny' | 'trust' | 'block';
  
  /** Whether to remember this decision */
  remember?: boolean;
  
  /** Response timestamp */
  timestamp: Date;
  
  /** Additional user comment */
  comment?: string;
}

/**
 * Session memory entry for confirmation decisions
 */
export interface SessionMemoryEntry {
  /** Command pattern */
  pattern: string;
  
  /** User decision */
  decision: 'allow' | 'deny' | 'trust' | 'block';
  
  /** When the decision was made */
  timestamp: Date;
  
  /** TTL for this entry */
  expiresAt: Date;
  
  /** Number of times this decision was used */
  useCount: number;
}