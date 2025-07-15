import {
  MCPClient,
  Tool,
  ToolResult,
  MCPServerInfo,
  MCPError,
} from './base.js';
import { WorkspaceSecurity } from '../security/workspace.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { performance } from 'perf_hooks';
import * as path from 'path';

/**
 * Parameters for shell command execution
 */
export interface ShellExecuteParams {
  command: string;
  cwd?: string;
  timeout?: number;
}

/**
 * Result of shell command execution
 */
export interface ShellExecuteResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

/**
 * Shell Security Error Classes
 */
export class ShellSecurityError extends MCPError {
  constructor(message: string, public securityType: string, cause?: Error) {
    super(message, 403, cause);
    this.name = 'ShellSecurityError';
  }
}

export class ShellCommandBlockedError extends ShellSecurityError {
  constructor(command: string, reason: string) {
    super(`Command blocked: ${command}. Reason: ${reason}`, 'COMMAND_BLOCKED');
    this.name = 'ShellCommandBlockedError';
  }
}

export class ShellPathTraversalError extends ShellSecurityError {
  constructor(path: string) {
    super(`Path traversal attempt detected: ${path}`, 'PATH_TRAVERSAL');
    this.name = 'ShellPathTraversalError';
  }
}

export class ShellInputValidationError extends ShellSecurityError {
  constructor(input: string, reason: string) {
    super(`Input validation failed for: ${input}. Reason: ${reason}`, 'INPUT_VALIDATION');
    this.name = 'ShellInputValidationError';
  }
}

/**
 * Dangerous Command Detection System
 */
export class DangerousCommandDetector {
  private static readonly DANGEROUS_COMMANDS = [
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

  private static readonly DANGEROUS_PATTERNS = [
    // Path traversal patterns
    /\.\.\/+/,
    /\/\.\.\/+/,
    /\.\.\\+/,
    /\\\.\.\\+/,
    
    // System path access
    /^\/etc\//,
    /^\/usr\//,
    /^\/bin\//,
    /^\/sbin\//,
    /^\/var\//,
    /^\/root\//,
    /^\/home\/[^\/]+\//,
    /^~\//,
    
    // Command injection patterns
    /;\s*rm\s/,
    /;\s*sudo\s/,
    /;\s*su\s/,
    /&&\s*rm\s/,
    /\|\s*rm\s/,
    /`.*rm\s/,
    /\$\(.*rm\s/,
    
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

  static isDangerous(command: string): { dangerous: boolean; reason?: string } {
    const normalizedCommand = command.toLowerCase().trim();
    
    // Check exact matches
    for (const dangerousCmd of this.DANGEROUS_COMMANDS) {
      if (normalizedCommand.includes(dangerousCmd.toLowerCase())) {
        return { 
          dangerous: true, 
          reason: `Contains dangerous command: ${dangerousCmd}` 
        };
      }
    }
    
    // Check patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        return { 
          dangerous: true, 
          reason: `Matches dangerous pattern: ${pattern}` 
        };
      }
    }
    
    return { dangerous: false };
  }

  static calculateRiskScore(command: string): number {
    let score = 0;
    const normalizedCommand = command.toLowerCase();
    
    // Base risk factors
    if (normalizedCommand.includes('rm')) score += 30;
    if (normalizedCommand.includes('sudo')) score += 40;
    if (normalizedCommand.includes('chmod')) score += 20;
    if (normalizedCommand.includes('chown')) score += 20;
    if (normalizedCommand.includes('curl') || normalizedCommand.includes('wget')) score += 15;
    if (normalizedCommand.includes('bash') || normalizedCommand.includes('sh')) score += 10;
    if (normalizedCommand.includes('|')) score += 10;
    if (normalizedCommand.includes(';')) score += 10;
    if (normalizedCommand.includes('&')) score += 10;
    if (normalizedCommand.includes('*')) score += 15;
    if (normalizedCommand.includes('..')) score += 25;
    if (normalizedCommand.includes('/etc/') || normalizedCommand.includes('/usr/')) score += 30;
    
    return Math.min(score, 100);
  }
}

/**
 * Command Input Sanitization and Validation System
 */
export class CommandSanitizer {

  private static readonly SHELL_EXPANSION_PATTERNS = [
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

  static validateInput(command: string): { valid: boolean; reason?: string; sanitized?: string } {
    if (!command || typeof command !== 'string') {
      return { valid: false, reason: 'Command must be a non-empty string' };
    }

    if (command.length > 1000) {
      return { valid: false, reason: 'Command exceeds maximum length of 1000 characters' };
    }

    if (command.trim().length === 0) {
      return { valid: false, reason: 'Command cannot be empty or only whitespace' };
    }

    // Check for null bytes or control characters
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(command)) {
      return { valid: false, reason: 'Command contains invalid control characters' };
    }

    // Check for dangerous shell expansion patterns
    for (const pattern of this.SHELL_EXPANSION_PATTERNS) {
      if (pattern.test(command)) {
        return { 
          valid: false, 
          reason: `Command contains dangerous shell expansion pattern: ${pattern}` 
        };
      }
    }

    // Check for command injection patterns
    if (this.containsCommandInjection(command)) {
      return { 
        valid: false, 
        reason: 'Command contains potential command injection patterns' 
      };
    }

    // Sanitize the command
    const sanitized = this.sanitizeCommand(command);
    
    return { valid: true, sanitized };
  }

  static sanitizeCommand(command: string): string {
    let sanitized = command;
    
    // Remove excessive whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    // Remove dangerous Unicode characters
    sanitized = sanitized.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    // Remove potentially dangerous escape sequences
    sanitized = sanitized.replace(/\\x[0-9a-fA-F]{2}/g, '');
    sanitized = sanitized.replace(/\\u[0-9a-fA-F]{4}/g, '');
    sanitized = sanitized.replace(/\\U[0-9a-fA-F]{8}/g, '');
    
    return sanitized;
  }

  private static containsCommandInjection(command: string): boolean {
    // Check for command chaining that could be used for injection
    const chainPatterns = [
      // Command chaining with dangerous commands
      /;\s*rm\s/,
      /;\s*sudo\s/,
      /;\s*su\s/,
      /;\s*chmod\s/,
      /;\s*chown\s/,
      /;\s*curl\s/,
      /;\s*wget\s/,
      
      // Background command execution
      /&\s*rm\s/,
      /&\s*sudo\s/,
      /&\s*curl\s/,
      /&\s*wget\s/,
      
      // Pipe to dangerous commands
      /\|\s*rm\s/,
      /\|\s*sudo\s/,
      /\|\s*bash\s/,
      /\|\s*sh\s/,
      /\|\s*eval\s/,
      
      // Logical operators with dangerous commands
      /&&\s*rm\s/,
      /&&\s*sudo\s/,
      /\|\|\s*rm\s/,
      /\|\|\s*sudo\s/,
    ];

    for (const pattern of chainPatterns) {
      if (pattern.test(command)) {
        return true;
      }
    }

    return false;
  }

  static extractFilePathsFromCommand(command: string): string[] {
    const paths: string[] = [];
    
    // Simple regex to extract potential file paths
    // This is a basic implementation - could be enhanced
    const pathPatterns = [
      // Absolute paths
      /\/[^\s;|&<>]+/g,
      // Relative paths with directory traversal
      /\.\.\/[^\s;|&<>]+/g,
      // Home directory paths
      /~\/[^\s;|&<>]+/g,
      // Current directory paths
      /\.\/[^\s;|&<>]+/g,
    ];

    for (const pattern of pathPatterns) {
      const matches = command.match(pattern);
      if (matches) {
        paths.push(...matches);
      }
    }

    return paths;
  }

  static isSimpleCommand(command: string): boolean {
    // Check if command is a simple command without chaining, pipes, etc.
    const complexPatterns = [
      /[;|&]/,  // Command chaining or pipes
      /[<>]/,   // Redirections
      /[`$]/,   // Command substitution or variable expansion
      /[{}]/,   // Brace expansion
      /[*?]/,   // Glob patterns
    ];

    for (const pattern of complexPatterns) {
      if (pattern.test(command)) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Enhanced Workspace Boundary Enforcement System
 */
export class WorkspaceBoundaryEnforcer {
  private security: WorkspaceSecurity;

  constructor(security: WorkspaceSecurity) {
    this.security = security;
  }

  validateCommandPaths(command: string): { valid: boolean; reason?: string; validatedPaths?: string[] } {
    const extractedPaths = CommandSanitizer.extractFilePathsFromCommand(command);
    const validatedPaths: string[] = [];

    for (const path of extractedPaths) {
      try {
        // Validate each path is within workspace boundaries
        const validatedPath = this.security.validatePath(path);
        validatedPaths.push(validatedPath);
      } catch (error) {
        return {
          valid: false,
          reason: `Path validation failed for '${path}': ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }

    return { valid: true, validatedPaths };
  }

  validateWorkingDirectory(command: string, requestedCwd?: string): { valid: boolean; reason?: string; validatedCwd?: string } {
    let workingDirectory = this.security.getWorkspaceRoot();

    if (requestedCwd) {
      try {
        workingDirectory = this.security.validatePath(requestedCwd);
      } catch (error) {
        return {
          valid: false,
          reason: `Working directory validation failed: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }

    // Check if command tries to change directory outside workspace
    const cdMatches = command.match(/cd\s+([^\s;|&<>]+)/g);
    if (cdMatches) {
      for (const cdMatch of cdMatches) {
        const targetDir = cdMatch.replace(/cd\s+/, '');
        
        try {
          // Resolve the target directory relative to current working directory
          const resolvedPath = this.resolvePath(targetDir, workingDirectory);
          this.security.validatePath(resolvedPath);
        } catch (error) {
          return {
            valid: false,
            reason: `Directory change validation failed for '${targetDir}': ${error instanceof Error ? error.message : String(error)}`
          };
        }
      }
    }

    return { valid: true, validatedCwd: workingDirectory };
  }

  checkPathTraversal(command: string): { safe: boolean; reason?: string } {
    const pathTraversalPatterns = [
      // Directory traversal patterns
      /\.\.\/+/g,
      /\/\.\.\/+/g,
      /\.\.\\+/g,
      /\\\.\.\\+/g,
      
      // Absolute path patterns that might escape workspace
      /\/etc\/+/g,
      /\/usr\/+/g,
      /\/bin\/+/g,
      /\/sbin\/+/g,
      /\/var\/+/g,
      /\/root\/+/g,
      /\/home\/[^\/]+\/+/g,
      /~\/+/g,
      
      // Dangerous file access patterns
      /\/dev\/+/g,
      /\/proc\/+/g,
      /\/sys\/+/g,
      /\/tmp\/+/g,
    ];

    for (const pattern of pathTraversalPatterns) {
      const matches = command.match(pattern);
      if (matches) {
        return {
          safe: false,
          reason: `Path traversal pattern detected: ${matches[0]}`
        };
      }
    }

    return { safe: true };
  }

  enforceWorkspaceBoundary(command: string, workingDirectory: string): { allowed: boolean; reason?: string; sanitizedCommand?: string } {
    // Check for dangerous path patterns
    const pathCheck = this.checkPathTraversal(command);
    if (!pathCheck.safe) {
      return {
        allowed: false,
        reason: pathCheck.reason || 'Path traversal detected'
      };
    }

    // Validate command paths
    const pathValidation = this.validateCommandPaths(command);
    if (!pathValidation.valid) {
      return {
        allowed: false,
        reason: pathValidation.reason || 'Path validation failed'
      };
    }

    // Validate working directory
    const cwdValidation = this.validateWorkingDirectory(command, workingDirectory);
    if (!cwdValidation.valid) {
      return {
        allowed: false,
        reason: cwdValidation.reason || 'Working directory validation failed'
      };
    }

    // Replace relative paths with absolute paths within workspace
    const sanitizedCommand = this.sanitizePathsInCommand(command, workingDirectory);

    return {
      allowed: true,
      sanitizedCommand
    };
  }

  private resolvePath(targetPath: string, basePath: string): string {
    // Handle special cases
    if (targetPath === '.') return basePath;
    if (targetPath === '..') return path.dirname(basePath);
    
    // Handle absolute paths
    if (path.isAbsolute(targetPath)) return targetPath;
    
    // Handle relative paths
    return path.resolve(basePath, targetPath);
  }

  private sanitizePathsInCommand(command: string, workingDirectory: string): string {
    let sanitized = command;
    
    // Replace relative paths with absolute paths within workspace
    const relativePaths = command.match(/\.\/[^\s;|&<>]+/g);
    if (relativePaths) {
      for (const relativePath of relativePaths) {
        const absolutePath = this.resolvePath(relativePath, workingDirectory);
        if (this.security.isPathSafe(absolutePath)) {
          sanitized = sanitized.replace(relativePath, absolutePath);
        }
      }
    }

    return sanitized;
  }

  validateFileOperations(command: string): { allowed: boolean; reason?: string } {
    const fileOperationPatterns = [
      // File creation/modification outside workspace
      /touch\s+\/[^\s;|&<>]+/g,
      /mkdir\s+\/[^\s;|&<>]+/g,
      /cp\s+[^\s;|&<>]+\s+\/[^\s;|&<>]+/g,
      /mv\s+[^\s;|&<>]+\s+\/[^\s;|&<>]+/g,
      /ln\s+[^\s;|&<>]+\s+\/[^\s;|&<>]+/g,
      
      // File deletion outside workspace
      /rm\s+\/[^\s;|&<>]+/g,
      /rmdir\s+\/[^\s;|&<>]+/g,
      
      // File reading outside workspace
      /cat\s+\/[^\s;|&<>]+/g,
      /head\s+\/[^\s;|&<>]+/g,
      /tail\s+\/[^\s;|&<>]+/g,
      /less\s+\/[^\s;|&<>]+/g,
      /more\s+\/[^\s;|&<>]+/g,
      /vim\s+\/[^\s;|&<>]+/g,
      /nano\s+\/[^\s;|&<>]+/g,
      /emacs\s+\/[^\s;|&<>]+/g,
    ];

    for (const pattern of fileOperationPatterns) {
      const matches = command.match(pattern);
      if (matches) {
        for (const match of matches) {
          const paths = match.split(/\s+/).slice(1); // Remove command name
          for (const path of paths) {
            if (!this.security.isPathSafe(path)) {
              return {
                allowed: false,
                reason: `File operation attempted outside workspace: ${match}`
              };
            }
          }
        }
      }
    }

    return { allowed: true };
  }

  getWorkspaceRoot(): string {
    return this.security.getWorkspaceRoot();
  }

  getRelativePath(absolutePath: string): string {
    return this.security.getRelativePathFromWorkspace(absolutePath);
  }
}

/**
 * Shell Tool Configuration Interface
 */
export interface ShellToolConfig {
  allowedCommands: string[];
  blockedCommands: string[];
  requireConfirmation: boolean;
  autoApprovePatterns: string[];
  maxExecutionTime: number;
  allowComplexCommands: boolean;
}

/**
 * Command Whitelist/Blacklist System
 */
export class CommandFilter {
  private config: ShellToolConfig;
  private defaultConfig: ShellToolConfig = {
    allowedCommands: [
      // Basic safe commands
      'echo', 'cat', 'head', 'tail', 'less', 'more',
      'ls', 'dir', 'pwd', 'find', 'grep', 'sort', 'wc',
      'date', 'whoami', 'id', 'uname', 'which', 'where',
      
      // Development commands
      'npm', 'yarn', 'pnpm', 'node', 'python', 'pip',
      'git', 'docker', 'docker-compose',
      'make', 'cmake', 'gcc', 'clang', 'javac', 'java',
      'cargo', 'rustc', 'go', 'dotnet',
      
      // Build and test commands
      'build', 'test', 'lint', 'format', 'compile',
      'jest', 'mocha', 'pytest', 'phpunit', 'rspec',
      
      // File operations (within workspace)
      'touch', 'mkdir', 'cp', 'mv', 'ln',
      'tar', 'gzip', 'gunzip', 'zip', 'unzip',
      
      // Text processing
      'awk', 'sed', 'cut', 'tr', 'diff', 'patch',
    ],
    blockedCommands: [
      // System commands
      'sudo', 'su', 'passwd', 'chpasswd', 'usermod',
      'systemctl', 'service', 'init', 'reboot', 'shutdown',
      'halt', 'poweroff', 'mount', 'umount',
      
      // Destructive commands
      'rm', 'rmdir', 'shred', 'wipe', 'dd',
      'format', 'fdisk', 'parted', 'mkfs',
      
      // Network commands
      'nc', 'netcat', 'telnet', 'ftp', 'ssh', 'scp',
      'rsync', 'curl', 'wget', 'ping', 'nmap',
      
      // Process control
      'kill', 'killall', 'pkill', 'nohup', 'screen', 'tmux',
      
      // System modification
      'chmod', 'chown', 'chgrp', 'setfacl', 'getfacl',
      'crontab', 'at', 'batch',
    ],
    requireConfirmation: true,
    autoApprovePatterns: [
      '^ls($|\\s)',
      '^pwd($|\\s)',
      '^echo($|\\s)',
      '^cat($|\\s)',
      '^head($|\\s)',
      '^tail($|\\s)',
      '^grep($|\\s)',
      '^find($|\\s)',
      '^git status($|\\s)',
      '^npm test($|\\s)',
      '^npm run($|\\s)',
      '^yarn test($|\\s)',
      '^yarn run($|\\s)',
    ],
    maxExecutionTime: 30,
    allowComplexCommands: false,
  };

  constructor(config?: Partial<ShellToolConfig>) {
    this.config = { ...this.defaultConfig, ...config };
  }

  updateConfig(config: Partial<ShellToolConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ShellToolConfig {
    return { ...this.config };
  }

  isCommandAllowed(command: string): { allowed: boolean; reason?: string; requiresConfirmation?: boolean } {
    const normalizedCommand = command.toLowerCase().trim();
    const commandName = this.extractCommandName(normalizedCommand);

    // Check if command is explicitly blocked
    if (this.isCommandBlocked(commandName, normalizedCommand)) {
      return {
        allowed: false,
        reason: `Command '${commandName}' is blocked by security policy`
      };
    }

    // Check for complex commands if not allowed
    if (!this.config.allowComplexCommands && !CommandSanitizer.isSimpleCommand(command)) {
      return {
        allowed: false,
        reason: 'Complex commands with pipes, redirections, or chaining are not allowed'
      };
    }

    // Check if command is explicitly allowed
    if (this.isCommandWhitelisted(commandName, normalizedCommand)) {
      // Check if it matches auto-approve patterns
      if (this.matchesAutoApprovePattern(normalizedCommand)) {
        return { allowed: true, requiresConfirmation: false };
      }
      return { allowed: true, requiresConfirmation: this.config.requireConfirmation };
    }

    // Command not in whitelist - requires confirmation if enabled
    if (this.config.requireConfirmation) {
      return {
        allowed: true,
        requiresConfirmation: true,
        reason: `Command '${commandName}' is not in the allowed list and requires confirmation`
      };
    }

    return { allowed: true, requiresConfirmation: false };
  }

  private extractCommandName(command: string): string {
    // Extract the base command name (first word)
    const parts = command.split(/\s+/);
    return parts[0] || '';
  }

  private isCommandBlocked(commandName: string, fullCommand: string): boolean {
    // Check exact command name matches
    if (this.config.blockedCommands.includes(commandName)) {
      return true;
    }

    // Check if any blocked command is contained in the full command
    for (const blockedCmd of this.config.blockedCommands) {
      if (fullCommand.includes(blockedCmd.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  private isCommandWhitelisted(commandName: string, _fullCommand: string): boolean {
    // Check exact command name matches
    if (this.config.allowedCommands.includes(commandName)) {
      return true;
    }

    // Check if command starts with any allowed command
    for (const allowedCmd of this.config.allowedCommands) {
      if (commandName.startsWith(allowedCmd.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  private matchesAutoApprovePattern(command: string): boolean {
    for (const pattern of this.config.autoApprovePatterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(command)) {
        return true;
      }
    }
    return false;
  }

  addAllowedCommand(command: string): void {
    if (!this.config.allowedCommands.includes(command)) {
      this.config.allowedCommands.push(command);
    }
  }

  removeAllowedCommand(command: string): void {
    const index = this.config.allowedCommands.indexOf(command);
    if (index > -1) {
      this.config.allowedCommands.splice(index, 1);
    }
  }

  addBlockedCommand(command: string): void {
    if (!this.config.blockedCommands.includes(command)) {
      this.config.blockedCommands.push(command);
    }
  }

  removeBlockedCommand(command: string): void {
    const index = this.config.blockedCommands.indexOf(command);
    if (index > -1) {
      this.config.blockedCommands.splice(index, 1);
    }
  }

  addAutoApprovePattern(pattern: string): void {
    if (!this.config.autoApprovePatterns.includes(pattern)) {
      this.config.autoApprovePatterns.push(pattern);
    }
  }

  removeAutoApprovePattern(pattern: string): void {
    const index = this.config.autoApprovePatterns.indexOf(pattern);
    if (index > -1) {
      this.config.autoApprovePatterns.splice(index, 1);
    }
  }

  resetToDefaults(): void {
    this.config = { ...this.defaultConfig };
  }
}

/**
 * Security Event Logging System
 */
export interface ShellSecurityEvent {
  timestamp: Date;
  eventType: 'COMMAND_BLOCKED' | 'COMMAND_ALLOWED' | 'PATH_TRAVERSAL' | 'INPUT_VALIDATION' | 'WORKSPACE_VIOLATION' | 'DANGEROUS_COMMAND' | 'SANITIZATION';
  command: string;
  workingDirectory: string;
  reason?: string | undefined;
  riskScore?: number | undefined;
  userContext?: string | undefined;
  details?: Record<string, any> | undefined;
}

export interface ShellExecutionLog {
  timestamp: Date;
  command: string;
  workingDirectory: string;
  exitCode: number;
  executionTime: number;
  success: boolean;
  errorType?: string | undefined;
  userId?: string | undefined;
  securityEvents: ShellSecurityEvent[];
}

export class ShellSecurityLogger {
  private events: ShellSecurityEvent[] = [];
  private executionLogs: ShellExecutionLog[] = [];
  private maxEvents: number = 1000;
  private maxExecutionLogs: number = 500;

  constructor(maxEvents: number = 1000, maxExecutionLogs: number = 500) {
    this.maxEvents = maxEvents;
    this.maxExecutionLogs = maxExecutionLogs;
  }

  logSecurityEvent(event: Omit<ShellSecurityEvent, 'timestamp'>): void {
    const securityEvent: ShellSecurityEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.events.push(securityEvent);

    // Rotate logs if needed
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Log to console in development/debug mode
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_SHELL_SECURITY) {
      console.log(`[SHELL SECURITY] ${event.eventType}: ${event.command} - ${event.reason || 'No reason provided'}`);
    }
  }

  logExecution(log: Omit<ShellExecutionLog, 'timestamp'>): void {
    const executionLog: ShellExecutionLog = {
      ...log,
      timestamp: new Date(),
    };

    this.executionLogs.push(executionLog);

    // Rotate logs if needed
    if (this.executionLogs.length > this.maxExecutionLogs) {
      this.executionLogs = this.executionLogs.slice(-this.maxExecutionLogs);
    }

    // Log to console in development/debug mode
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_SHELL_SECURITY) {
      console.log(`[SHELL EXECUTION] ${log.command} - Exit Code: ${log.exitCode}, Time: ${log.executionTime}ms`);
    }
  }

  getSecurityEvents(limit?: number): ShellSecurityEvent[] {
    const events = [...this.events].reverse(); // Most recent first
    return limit ? events.slice(0, limit) : events;
  }

  getExecutionLogs(limit?: number): ShellExecutionLog[] {
    const logs = [...this.executionLogs].reverse(); // Most recent first
    return limit ? logs.slice(0, limit) : logs;
  }

  getSecurityEventsByType(eventType: ShellSecurityEvent['eventType'], limit?: number): ShellSecurityEvent[] {
    const filtered = this.events.filter(event => event.eventType === eventType).reverse();
    return limit ? filtered.slice(0, limit) : filtered;
  }

  getFailedExecutions(limit?: number): ShellExecutionLog[] {
    const failed = this.executionLogs.filter(log => !log.success).reverse();
    return limit ? failed.slice(0, limit) : failed;
  }

  getSecuritySummary(): {
    totalEvents: number;
    blockedCommands: number;
    allowedCommands: number;
    pathTraversalAttempts: number;
    inputValidationFailures: number;
    workspaceViolations: number;
    dangerousCommands: number;
    sanitizationActions: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
  } {
    const eventsByType = this.events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalExecutions = this.executionLogs.length;
    const successfulExecutions = this.executionLogs.filter(log => log.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;
    const averageExecutionTime = totalExecutions > 0 
      ? this.executionLogs.reduce((sum, log) => sum + log.executionTime, 0) / totalExecutions 
      : 0;

    return {
      totalEvents: this.events.length,
      blockedCommands: eventsByType.COMMAND_BLOCKED || 0,
      allowedCommands: eventsByType.COMMAND_ALLOWED || 0,
      pathTraversalAttempts: eventsByType.PATH_TRAVERSAL || 0,
      inputValidationFailures: eventsByType.INPUT_VALIDATION || 0,
      workspaceViolations: eventsByType.WORKSPACE_VIOLATION || 0,
      dangerousCommands: eventsByType.DANGEROUS_COMMAND || 0,
      sanitizationActions: eventsByType.SANITIZATION || 0,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime: Math.round(averageExecutionTime),
    };
  }

  exportSecurityReport(): string {
    const summary = this.getSecuritySummary();
    const recentEvents = this.getSecurityEvents(20);
    const recentExecutions = this.getExecutionLogs(20);

    const report = {
      generatedAt: new Date().toISOString(),
      summary,
      recentSecurityEvents: recentEvents,
      recentExecutions,
    };

    return JSON.stringify(report, null, 2);
  }

  clearLogs(): void {
    this.events = [];
    this.executionLogs = [];
  }

  setMaxEvents(maxEvents: number): void {
    this.maxEvents = maxEvents;
    if (this.events.length > maxEvents) {
      this.events = this.events.slice(-maxEvents);
    }
  }

  setMaxExecutionLogs(maxExecutionLogs: number): void {
    this.maxExecutionLogs = maxExecutionLogs;
    if (this.executionLogs.length > maxExecutionLogs) {
      this.executionLogs = this.executionLogs.slice(-maxExecutionLogs);
    }
  }

  // Helper methods for common security events
  logCommandBlocked(command: string, workingDirectory: string, reason: string, riskScore?: number): void {
    this.logSecurityEvent({
      eventType: 'COMMAND_BLOCKED',
      command,
      workingDirectory,
      reason,
      riskScore: riskScore || undefined,
    });
  }

  logCommandAllowed(command: string, workingDirectory: string, reason?: string): void {
    this.logSecurityEvent({
      eventType: 'COMMAND_ALLOWED',
      command,
      workingDirectory,
      reason: reason || undefined,
    });
  }

  logPathTraversal(command: string, workingDirectory: string, reason: string): void {
    this.logSecurityEvent({
      eventType: 'PATH_TRAVERSAL',
      command,
      workingDirectory,
      reason,
    });
  }

  logInputValidation(command: string, workingDirectory: string, reason: string): void {
    this.logSecurityEvent({
      eventType: 'INPUT_VALIDATION',
      command,
      workingDirectory,
      reason,
    });
  }

  logWorkspaceViolation(command: string, workingDirectory: string, reason: string): void {
    this.logSecurityEvent({
      eventType: 'WORKSPACE_VIOLATION',
      command,
      workingDirectory,
      reason,
    });
  }

  logDangerousCommand(command: string, workingDirectory: string, reason: string, riskScore?: number): void {
    this.logSecurityEvent({
      eventType: 'DANGEROUS_COMMAND',
      command,
      workingDirectory,
      reason,
      riskScore: riskScore || undefined,
    });
  }

  logSanitization(command: string, workingDirectory: string, reason: string): void {
    this.logSecurityEvent({
      eventType: 'SANITIZATION',
      command,
      workingDirectory,
      reason,
    });
  }
}

/**
 * ShellMCPClient - MCP client for shell command execution
 * 
 * Phase 3: Complete security integration with comprehensive protection
 * Provides secure shell command execution within workspace boundaries
 */
export class ShellMCPClient extends MCPClient {
  private security: WorkspaceSecurity;
  private boundaryEnforcer: WorkspaceBoundaryEnforcer;
  private commandFilter: CommandFilter;
  private securityLogger: ShellSecurityLogger;

  constructor(security: WorkspaceSecurity, config?: Partial<ShellToolConfig>) {
    super('shell');
    this.security = security;
    this.boundaryEnforcer = new WorkspaceBoundaryEnforcer(security);
    this.commandFilter = new CommandFilter(config);
    this.securityLogger = new ShellSecurityLogger();
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async ping(): Promise<boolean> {
    return this.connected;
  }

  async getServerInfo(): Promise<MCPServerInfo> {
    return {
      name: 'Shell MCP Server',
      version: '1.0.0',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
      },
    };
  }

  async listTools(): Promise<Tool[]> {
    return [
      {
        name: 'ExecuteCommand',
        description: 'Execute shell commands safely within workspace boundaries with comprehensive security protection including dangerous command detection, input sanitization, path traversal prevention, and audit logging',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The shell command to execute (subject to security validation)',
            },
            cwd: {
              type: 'string',
              description: 'Working directory for command execution (default: workspace root, must be within workspace)',
            },
            timeout: {
              type: 'number',
              description: 'Command timeout in seconds (default: 30)',
              minimum: 1,
              maximum: 300,
              default: 30,
            },
          },
          required: ['command'],
        },
      },
    ];
  }

  async callTool(name: string, args: Record<string, any>): Promise<ToolResult> {
    try {
      switch (name) {
        case 'ExecuteCommand':
          return await this.executeCommand(args);
        default:
          return {
            content: [
              {
                type: 'text',
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Shell execution error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async listResources(): Promise<any[]> {
    return [];
  }

  async readResource(_uri: string): Promise<ToolResult> {
    return {
      content: [
        {
          type: 'text',
          text: 'Resources not supported by Shell MCP client',
        },
      ],
      isError: true,
    };
  }

  /**
   * ExecuteCommand tool implementation (Phase 3: comprehensive security integration)
   */
  private async executeCommand(params: any): Promise<ToolResult> {
    const { command, cwd, timeout = 30 } = params as ShellExecuteParams;
    const securityEvents: ShellSecurityEvent[] = [];

    try {
      // 1. Basic parameter validation
      if (!command || typeof command !== 'string') {
        throw new ShellInputValidationError(String(command), 'Command parameter is required and must be a string');
      }

      if (timeout < 1 || timeout > 300) {
        throw new ShellInputValidationError(String(timeout), 'Timeout must be between 1 and 300 seconds');
      }

      // 2. Input validation and sanitization
      const inputValidation = CommandSanitizer.validateInput(command);
      if (!inputValidation.valid) {
        this.securityLogger.logInputValidation(command, this.security.getWorkspaceRoot(), inputValidation.reason!);
        throw new ShellInputValidationError(command, inputValidation.reason!);
      }

      const sanitizedCommand = inputValidation.sanitized!;
      if (sanitizedCommand !== command) {
        this.securityLogger.logSanitization(command, this.security.getWorkspaceRoot(), 'Command input sanitized');
      }

      // 3. Dangerous command detection
      const dangerCheck = DangerousCommandDetector.isDangerous(sanitizedCommand);
      if (dangerCheck.dangerous) {
        const riskScore = DangerousCommandDetector.calculateRiskScore(sanitizedCommand);
        this.securityLogger.logDangerousCommand(sanitizedCommand, this.security.getWorkspaceRoot(), dangerCheck.reason!, riskScore);
        throw new ShellCommandBlockedError(sanitizedCommand, dangerCheck.reason!);
      }

      // 4. Command filtering (whitelist/blacklist)
      const filterCheck = this.commandFilter.isCommandAllowed(sanitizedCommand);
      if (!filterCheck.allowed) {
        this.securityLogger.logCommandBlocked(sanitizedCommand, this.security.getWorkspaceRoot(), filterCheck.reason!);
        throw new ShellCommandBlockedError(sanitizedCommand, filterCheck.reason!);
      }

      // 5. Working directory validation
      let workingDirectory = this.security.getWorkspaceRoot();
      if (cwd) {
        try {
          workingDirectory = await this.security.validateFileAccess(cwd, 'read');
        } catch (error) {
          this.securityLogger.logWorkspaceViolation(sanitizedCommand, cwd, `Invalid working directory: ${error instanceof Error ? error.message : String(error)}`);
          throw new ShellInputValidationError(cwd, `Invalid working directory: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // 6. Workspace boundary enforcement
      const boundaryCheck = this.boundaryEnforcer.enforceWorkspaceBoundary(sanitizedCommand, workingDirectory);
      if (!boundaryCheck.allowed) {
        this.securityLogger.logWorkspaceViolation(sanitizedCommand, workingDirectory, boundaryCheck.reason!);
        throw new ShellPathTraversalError(boundaryCheck.reason!);
      }

      // 7. File operation validation
      const fileOpCheck = this.boundaryEnforcer.validateFileOperations(sanitizedCommand);
      if (!fileOpCheck.allowed) {
        this.securityLogger.logWorkspaceViolation(sanitizedCommand, workingDirectory, fileOpCheck.reason!);
        throw new ShellPathTraversalError(fileOpCheck.reason!);
      }

      // 8. Final command preparation
      const finalCommand = boundaryCheck.sanitizedCommand || sanitizedCommand;
      this.securityLogger.logCommandAllowed(finalCommand, workingDirectory, filterCheck.reason);

      // 9. Execute command with timeout and error handling
      const result = await this.executeCommandWithTimeout(finalCommand, workingDirectory, timeout);

      // 10. Log execution
      this.securityLogger.logExecution({
        command: finalCommand,
        workingDirectory,
        exitCode: result.exitCode,
        executionTime: result.executionTime,
        success: result.success,
        errorType: result.success ? undefined : 'EXECUTION_ERROR' as string | undefined,
        securityEvents,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              command: finalCommand,
              originalCommand: command !== finalCommand ? command : undefined,
              workingDirectory: this.security.getRelativePathFromWorkspace(workingDirectory),
              timeout,
              result,
              security: {
                validated: true,
                sanitized: sanitizedCommand !== command,
                riskScore: DangerousCommandDetector.calculateRiskScore(finalCommand),
                phase: 'Phase 3 - Full Security Integration',
              },
            }, null, 2),
          },
        ],
      };

    } catch (error) {
      // Log security errors
      if (error instanceof ShellSecurityError) {
        this.securityLogger.logExecution({
          command: command,
          workingDirectory: this.security.getWorkspaceRoot(),
          exitCode: -1,
          executionTime: 0,
          success: false,
          errorType: error.securityType,
          securityEvents,
        });
      }

      // Re-throw the error for proper handling
      throw error;
    }
  }

  /**
   * Execute command with timeout handling and structured error response
   */
  private async executeCommandWithTimeout(
    command: string,
    workingDirectory: string,
    timeoutSeconds: number
  ): Promise<ShellExecuteResult> {
    const execAsync = promisify(exec);
    const startTime = performance.now();

    try {
      // Set up AbortController for timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeoutSeconds * 1000);

      // Execute command
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDirectory,
        signal: abortController.signal,
        maxBuffer: 1024 * 1024, // 1MB buffer limit
      });

      clearTimeout(timeoutId);
      const executionTime = performance.now() - startTime;

      return {
        success: true,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: 0,
        executionTime: Math.round(executionTime),
      };
    } catch (error: any) {
      const executionTime = performance.now() - startTime;

      // Handle timeout
      if (error.name === 'AbortError' || error.signal === 'SIGTERM') {
        return {
          success: false,
          stdout: '',
          stderr: `Command timed out after ${timeoutSeconds} seconds`,
          exitCode: -1,
          executionTime: Math.round(executionTime),
        };
      }

      // Handle command not found
      if (error.code === 'ENOENT') {
        return {
          success: false,
          stdout: '',
          stderr: `Command not found: ${command}`,
          exitCode: 127,
          executionTime: Math.round(executionTime),
        };
      }

      // Handle permission denied
      if (error.code === 'EACCES') {
        return {
          success: false,
          stdout: '',
          stderr: `Permission denied: ${command}`,
          exitCode: 126,
          executionTime: Math.round(executionTime),
        };
      }

      // Handle non-zero exit codes (command ran but failed)
      if (error.code && typeof error.code === 'number') {
        return {
          success: false,
          stdout: error.stdout || '',
          stderr: error.stderr || error.message,
          exitCode: error.code,
          executionTime: Math.round(executionTime),
        };
      }

      // Handle other errors
      return {
        success: false,
        stdout: '',
        stderr: error.message || 'Unknown execution error',
        exitCode: 1,
        executionTime: Math.round(executionTime),
      };
    }
  }

  // Security and configuration methods
  updateConfiguration(config: Partial<ShellToolConfig>): void {
    this.commandFilter.updateConfig(config);
  }

  getConfiguration(): ShellToolConfig {
    return this.commandFilter.getConfig();
  }

  getSecuritySummary() {
    return this.securityLogger.getSecuritySummary();
  }

  getSecurityEvents(limit?: number): ShellSecurityEvent[] {
    return this.securityLogger.getSecurityEvents(limit);
  }

  getExecutionLogs(limit?: number): ShellExecutionLog[] {
    return this.securityLogger.getExecutionLogs(limit);
  }

  exportSecurityReport(): string {
    return this.securityLogger.exportSecurityReport();
  }

  clearSecurityLogs(): void {
    this.securityLogger.clearLogs();
  }

  addAllowedCommand(command: string): void {
    this.commandFilter.addAllowedCommand(command);
  }

  addBlockedCommand(command: string): void {
    this.commandFilter.addBlockedCommand(command);
  }

  resetConfigurationToDefaults(): void {
    this.commandFilter.resetToDefaults();
  }
}