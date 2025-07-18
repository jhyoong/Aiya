/**
 * Shell MCP Constants
 * 
 * This file contains all hard-coded values extracted from the monolithic shell.ts file.
 * All magic numbers and constant arrays are organized here for better maintainability.
 */

// =============================================================================
// COMMAND CATEGORIZATION PATTERNS
// =============================================================================

/**
 * Safe commands that can execute without confirmation
 * These are read-only operations with minimal system impact
 */
export const SAFE_COMMAND_PATTERNS = [
  '^ls($|\\s)',
  '^pwd($|\\s)',
  '^echo($|\\s)',
  '^cat($|\\s)',
  '^head($|\\s)',
  '^tail($|\\s)',
  '^grep($|\\s)',
  '^find($|\\s)',
  '^git status($|\\s)',
  '^git log($|\\s)',
  '^git diff($|\\s)',
  '^git show($|\\s)',
  '^npm test($|\\s)',
  '^yarn test($|\\s)',
  '^which($|\\s)',
  '^whereis($|\\s)',
  '^file($|\\s)',
  '^stat($|\\s)',
  '^wc($|\\s)',
  '^sort($|\\s)',
  '^uniq($|\\s)',
  '^awk($|\\s)',
  '^sed($|\\s)',
];

/**
 * Risky commands that require confirmation but are generally safe
 * These are common development operations that modify workspace
 */
export const RISKY_COMMAND_PATTERNS = [
  '^npm install',
  '^yarn install',
  '^mkdir($|\\s)',
  '^rmdir($|\\s)',
  '^touch($|\\s)',
  '^cp($|\\s)',
  '^mv($|\\s)',
  '^git add($|\\s)',
  '^git commit($|\\s)',
  '^git push($|\\s)',
  '^git pull($|\\s)',
  '^npm run($|\\s)',
  '^yarn run($|\\s)',
  '^npm build($|\\s)',
  '^yarn build($|\\s)',
  '^chmod(?!.*777)($|\\s)',
  '^ln($|\\s)',
  '^tar($|\\s)',
  '^zip($|\\s)',
  '^unzip($|\\s)',
];

/**
 * Dangerous commands that require confirmation with warnings
 * These operations can cause significant system changes
 */
export const DANGEROUS_COMMAND_PATTERNS = [
  'rm -rf',
  'sudo',
  'chmod 777',
  'chmod -R 777',
  'chown -R',
  'dd if=',
  'systemctl',
  'service',
  'kill -9',
  'killall',
  'pkill',
  'chmod +s',
  'chmod 4',
  'passwd',
  'chpasswd',
  'su -',
  'su root',
];

/**
 * Blocked commands that should never be allowed
 * These operations can cause irreversible system damage
 */
export const BLOCKED_COMMAND_PATTERNS = [
  'rm -rf /',
  'rm -rf /*',
  'sudo rm -rf /',
  'sudo rm -rf /*',
  'format.*',
  'dd if=/dev/zero',
  'dd if=/dev/zero.*of=.*',
  'dd if=/dev/random',
  'dd if=/dev/urandom',
  ':(\\(\\))', // fork bomb
  ':(\\(\\).*\\{.*\\|.*:.*&.*\\}.*:',
  'while true.*do',
  'for\\(\\(;;\\)\\)',
  'mkfs.*',
  'fdisk.*',
  'parted.*',
  'shutdown.*',
  'reboot.*',
  'halt.*',
  'poweroff.*',
  'init 0',
  'init 6',
  'truncate -s 0 /',
  'shred.*/',
  'wipe.*/',
  'srm.*/',
];

// =============================================================================
// TIMEOUTS AND TIMING
// =============================================================================

/**
 * Timeout values in seconds and milliseconds
 */
export const TIMEOUTS = {
  /** Default command execution timeout (seconds) */
  DEFAULT_COMMAND_EXECUTION: 30,
  
  /** Maximum allowed command execution timeout (seconds) */
  MAX_COMMAND_EXECUTION: 300,
  
  /** User confirmation prompt timeout (milliseconds) */
  CONFIRMATION_PROMPT: 30000,
  
  /** Session memory TTL for confirmation decisions (milliseconds) */
  SESSION_MEMORY_TTL: 1800000, // 30 minutes
  
  /** Log rotation check interval (milliseconds) */
  LOG_ROTATION_CHECK: 86400000, // 24 hours
  
  /** Performance monitoring interval (milliseconds) */
  MONITOR_INTERVAL: 100,
};

// =============================================================================
// SIZE AND COUNT LIMITS
// =============================================================================

/**
 * Various size and count limitations
 */
export const LIMITS = {
  /** Maximum command length in characters */
  MAX_COMMAND_LENGTH: 1000,
  
  /** Maximum buffer size for command output */
  MAX_BUFFER_SIZE: 1024 * 1024, // 1MB
  
  /** Maximum log file size before rotation */
  MAX_LOG_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  
  /** Maximum security events kept in memory */
  MAX_EVENTS_IN_MEMORY: 1000,
  
  /** Maximum execution logs kept in memory */
  MAX_EXECUTION_LOGS: 500,
  
  /** Maximum results returned in top statistics */
  MAX_TOP_RESULTS: 10,
  
  /** Performance monitoring interval in milliseconds */
  MONITOR_INTERVAL_MS: 100,
};

// =============================================================================
// EXIT CODES
// =============================================================================

/**
 * Standard exit codes for command execution
 */
export const EXIT_CODES = {
  /** Successful execution */
  SUCCESS: 0,
  
  /** General error */
  GENERAL_ERROR: 1,
  
  /** Permission denied */
  PERMISSION_DENIED: 126,
  
  /** Command not found */
  COMMAND_NOT_FOUND: 127,
  
  /** Invalid argument */
  INVALID_ARGUMENT: 400,
  
  /** Forbidden operation */
  FORBIDDEN: 403,
  
  /** Command timeout */
  TIMEOUT: -1,
};

// =============================================================================
// ERROR CLASSIFICATION PRIORITIES
// =============================================================================

/**
 * Priority values for error pattern matching
 * Higher values indicate higher priority in error classification
 */
export const ERROR_PRIORITIES = {
  PERMISSION_ERROR: 100,
  TIMEOUT_ERROR: 95,
  COMMAND_NOT_FOUND: 90,
  SECURITY_ERROR: 85,
  WORKSPACE_VIOLATION: 85,
  INPUT_VALIDATION: 80,
  EXECUTION_ERROR: 70,
  CONFIGURATION_ERROR: 60,
  UNKNOWN_ERROR: 10,
};

// =============================================================================
// DANGEROUS COMMAND LISTS
// =============================================================================

/**
 * Comprehensive list of dangerous command strings
 * These are exact matches or patterns that indicate dangerous operations
 */
export const DANGEROUS_COMMANDS = [
  // System destruction commands
  'rm -rf /',
  'rm -rf /*',
  'rm -rf ~/',
  'rm -rf *',
  'format',
  'format c:',
  'dd if=/dev/zero',
  'dd if=/dev/random',
  'dd if=/dev/urandom',
  'mkfs',
  'fdisk',
  'parted',

  // Fork bombs and resource exhaustion
  ':(){ :|:& };:',
  ':(){ :|: & };:',
  'while true; do',
  'for((;;))',

  // Network and remote execution
  'curl.*|.*bash',
  'wget.*|.*bash',
  'curl.*|.*sh',
  'wget.*|.*sh',
  'nc -l',
  'netcat -l',

  // System access and privilege escalation
  'sudo',
  'su -',
  'su root',
  'passwd',
  'chpasswd',
  'chmod 777',
  'chmod -R 777',
  'chown -R',
  'sudo rm',
  'sudo systemctl',
  'chown root:root',

  // System configuration
  'systemctl',
  'service',
  'init',
  'reboot',
  'shutdown',
  'halt',
  'poweroff',

  // Dangerous file operations
  'truncate -s 0',
  'shred',
  'wipe',
  'srm',

  // Process manipulation
  'kill -9 1',
  'killall -9',
  'pkill -9',

  // System directories access
  'cd /etc',
  'cd /usr',
  'cd /bin',
  'cd /sbin',
  'cd /var',
  'cd /root',
  'cd /home/',
  'cd ~/',

  // Dangerous redirections
  '> /dev/sda',
  '> /dev/hda',
  '> /etc/',
  '> /usr/',
  '> /bin/',
];

// =============================================================================
// DANGEROUS REGEX PATTERNS
// =============================================================================

/**
 * Regular expression patterns for detecting dangerous operations
 */
export const DANGEROUS_PATTERNS = [
  // Path traversal patterns
  /\.\.\/+/,
  /\/\.\.\/+/,
  /\.\.\\+/,
  /\\\.\.\\+/,
  /\/\.\.\/.*\/etc/,
  /\/\.\.\/.*\/usr/,
  /\/\.\.\/.*\/var/,
  /\.\..*\/etc\/passwd/,
  /\.\..*\/etc\/shadow/,

  // System path access
  /^\/etc\//,
  /^\/usr\//,
  /^\/bin\//,
  /^\/sbin\//,
  /^\/var\//,
  /^\/root\//,
  /^\/home\/[^\/]+\//,
  /^~\//,
  /\/etc\/passwd/,
  /\/etc\/shadow/,
  /\/usr\/bin/,
  /\/var\/log/,
  /\/tmp\/.*malicious/,

  // Command injection patterns
  /;\s*rm\s/,
  /;\s*sudo\s/,
  /;\s*su\s/,
  /&&\s*rm\s/,
  /\|\s*rm\s/,
  /`.*rm\s/,
  /\$\(.*rm\s/,

  // Privilege escalation patterns
  /sudo\s+rm/,
  /sudo\s+systemctl/,
  /sudo\s+chmod/,
  /sudo\s+chown/,
  /chown\s+root:root/,
  /chmod\s+777\s+\/etc/,

  // Dangerous redirections
  />\s*\/dev\/[sh]d[a-z]/,
  />\s*\/etc\//,
  />\s*\/usr\//,
  />\s*\/bin\//,

  // Network command patterns
  /curl\s+.*\|\s*(bash|sh)/,
  /wget\s+.*\|\s*(bash|sh)/,
  /nc\s+-l/,
  /netcat\s+-l/,

  // Fork bomb patterns
  /:\(\)\s*\{.*\|\s*:\s*&\s*\}\s*;:\s*/,
  /while\s+true.*do/,
  /for\s*\(\(;;?\)\)/,
];

// =============================================================================
// SHELL EXPANSION PATTERNS
// =============================================================================

/**
 * Patterns for detecting shell expansion that could be dangerous
 * Used by CommandSanitizer for input validation
 */
export const SHELL_EXPANSION_PATTERNS = [
  // Command substitution
  /`[^`]*`/g,
  /\$\([^)]*\)/g,

  // Variable expansion
  /\$\{[^}]*\}/g,
  /\$[A-Za-z_][A-Za-z0-9_]*/g,

  // Glob patterns that could be dangerous
  /\*\*/g,
  /\?\?+/g,

  // History expansion
  /![^!]*!/g,

  // Process substitution
  /<\([^)]*\)/g,
  />\([^)]*\)/g,
];

// =============================================================================
// PATH TRAVERSAL PATTERNS
// =============================================================================

/**
 * Patterns for detecting path traversal attempts
 */
export const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\/+/g,
  /\/\.\.\/+/g,
  /\.\.\\+/g,
  /\\\.\.\\+/g,
  /\/\.\.\/.*\/etc/,
  /\/\.\.\/.*\/usr/,
  /\/\.\.\/.*\/var/,
  /\.\..*\/etc\/passwd/,
  /\.\..*\/etc\/shadow/,
];

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

/**
 * Default configuration values for the shell tool
 */
export const DEFAULT_SHELL_CONFIG = {
  /** Require confirmation for risky commands */
  requireConfirmationForRisky: true,
  
  /** Require confirmation for dangerous commands */
  requireConfirmationForDangerous: true,
  
  /** Allow dangerous commands (with confirmation) */
  allowDangerous: false,
  
  /** Maximum command execution time in seconds */
  maxExecutionTime: TIMEOUTS.DEFAULT_COMMAND_EXECUTION,
  
  /** Confirmation prompt timeout in milliseconds */
  confirmationTimeout: TIMEOUTS.CONFIRMATION_PROMPT,
  
  /** Enable session memory for confirmation decisions */
  sessionMemory: true,
  
  /** Allow complex commands (pipes, redirects, etc.) */
  allowComplexCommands: false,
  
  /** Commands that are always trusted and bypass confirmation */
  trustedCommands: [
    '^ls($|\\s)',
    '^pwd($|\\s)',
    '^echo($|\\s)',
    '^git status($|\\s)',
    '^npm test($|\\s)',
    '^yarn test($|\\s)',
    '^cat($|\\s)',
    '^head($|\\s)',
    '^tail($|\\s)',
    '^grep($|\\s)',
    '^find($|\\s)',
  ],
  
  /** Always allowed commands (legacy compatibility) */
  allowedCommands: [
    '^ls($|\\s)',
    '^pwd($|\\s)',
    '^echo($|\\s)',
    '^git status($|\\s)',
    '^npm test($|\\s)',
    '^cat($|\\s)',
    '^head($|\\s)',
    '^tail($|\\s)',
    '^grep($|\\s)',
    '^find($|\\s)',
    '^npm run($|\\s)',
    '^yarn test($|\\s)',
    '^yarn run($|\\s)',
  ],
  
  /** Always blocked commands (legacy compatibility) */
  blockedCommands: [
    'rm -rf /',
    'rm -rf /*',
    'sudo rm -rf /',
    'sudo rm -rf /*',
    'format.*',
    'dd if=/dev/zero',
    ':(\\(\\))',
    'shutdown.*',
    'reboot.*',
    'halt.*',
    'poweroff.*',
  ],
  
  /** Auto-approved patterns (legacy compatibility) */
  autoApprovePatterns: [
    '^ls($|\\s)',
    '^pwd($|\\s)',
    '^echo($|\\s)',
    '^git status($|\\s)',
    '^npm test($|\\s)',
  ],
  
  /** Patterns that are always blocked (catastrophic commands) */
  alwaysBlockPatterns: [
    'rm -rf /',
    'rm -rf /*',
    'sudo rm -rf /',
    'format.*',
    ':(\\(\\))',
    'shutdown.*',
    'reboot.*',
    'halt.*',
    'poweroff.*',
  ],
  
  /** Require confirmation for any command */
  requireConfirmation: false,
};

// =============================================================================
// ERROR PATTERN DEFINITIONS
// =============================================================================

/**
 * Error patterns for categorizing command execution errors
 */
export interface ErrorPattern {
  messagePatterns: RegExp[];
  exitCodes: number[];
  errorType: string;
  priority: number;
  suggestions: string[];
}

/**
 * Comprehensive error patterns for intelligent error classification
 */
export const ERROR_PATTERNS: ErrorPattern[] = [
  // Permission errors (highest priority)
  {
    messagePatterns: [
      /permission denied/i,
      /access denied/i,
      /operation not permitted/i,
      /not allowed/i,
    ],
    exitCodes: [EXIT_CODES.PERMISSION_DENIED, EXIT_CODES.FORBIDDEN],
    errorType: 'permission_error',
    priority: ERROR_PRIORITIES.PERMISSION_ERROR,
    suggestions: [
      'Check file permissions',
      'Ensure you have necessary access rights',
      'Consider using sudo if appropriate',
    ],
  },

  // Command not found errors
  {
    messagePatterns: [
      /command not found/i,
      /no such file or directory/i,
      /not found/i,
    ],
    exitCodes: [EXIT_CODES.COMMAND_NOT_FOUND],
    errorType: 'command_not_found',
    priority: ERROR_PRIORITIES.COMMAND_NOT_FOUND,
    suggestions: [
      'Check if the command is installed',
      'Verify the command spelling',
      'Check your PATH environment variable',
    ],
  },

  // Timeout errors
  {
    messagePatterns: [
      /timeout/i,
      /timed out/i,
      /operation timeout/i,
    ],
    exitCodes: [EXIT_CODES.TIMEOUT],
    errorType: 'timeout_error',
    priority: ERROR_PRIORITIES.TIMEOUT_ERROR,
    suggestions: [
      'Increase timeout value',
      'Check if the command is hanging',
      'Consider breaking down complex operations',
    ],
  },

  // Security errors
  {
    messagePatterns: [
      /security violation/i,
      /blocked/i,
      /dangerous/i,
    ],
    exitCodes: [EXIT_CODES.FORBIDDEN],
    errorType: 'security_error',
    priority: ERROR_PRIORITIES.SECURITY_ERROR,
    suggestions: [
      'Review command safety',
      'Use alternative safer commands',
      'Contact administrator if necessary',
    ],
  },

  // Input validation errors
  {
    messagePatterns: [
      /invalid argument/i,
      /invalid option/i,
      /bad argument/i,
    ],
    exitCodes: [EXIT_CODES.INVALID_ARGUMENT],
    errorType: 'input_validation',
    priority: ERROR_PRIORITIES.INPUT_VALIDATION,
    suggestions: [
      'Check command syntax',
      'Verify argument format',
      'Consult command documentation',
    ],
  },

  // Workspace violation errors
  {
    messagePatterns: [
      /workspace violation/i,
      /outside workspace/i,
      /path traversal/i,
    ],
    exitCodes: [EXIT_CODES.FORBIDDEN],
    errorType: 'workspace_violation',
    priority: ERROR_PRIORITIES.WORKSPACE_VIOLATION,
    suggestions: [
      'Ensure operations stay within workspace',
      'Avoid path traversal patterns',
      'Use relative paths from workspace root',
    ],
  },

  // General execution errors
  {
    messagePatterns: [
      /error/i,
      /failed/i,
      /exception/i,
    ],
    exitCodes: [1, 2, 3, 4, 5],
    errorType: 'execution_error',
    priority: ERROR_PRIORITIES.EXECUTION_ERROR,
    suggestions: [
      'Check command output for details',
      'Verify input parameters',
      'Ensure required dependencies are available',
    ],
  },
];