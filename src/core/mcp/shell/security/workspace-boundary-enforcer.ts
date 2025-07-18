/**
 * Workspace Boundary Enforcer
 * 
 * Enforces workspace boundaries for shell commands, preventing access to files
 * and directories outside the designated workspace root. Validates command paths,
 * working directories, and detects path traversal attempts.
 */

import * as path from 'path';
import { WorkspaceSecurity } from '../../../security/workspace.js';
import { CommandSanitizer } from './command-sanitizer.js';
import { PATH_TRAVERSAL_PATTERNS } from '../constants.js';

/**
 * Result of path validation
 */
export interface PathValidationResult {
  /** Whether the paths are valid */
  valid: boolean;
  
  /** Reason for validation failure */
  reason?: string;
  
  /** List of validated paths within workspace */
  validatedPaths?: string[];
}

/**
 * Result of working directory validation
 */
export interface WorkingDirectoryValidationResult {
  /** Whether the working directory is valid */
  valid: boolean;
  
  /** Reason for validation failure */
  reason?: string;
  
  /** Validated working directory path */
  validatedCwd?: string;
}

/**
 * Result of path traversal check
 */
export interface PathTraversalCheckResult {
  /** Whether the command is safe from path traversal */
  safe: boolean;
  
  /** Reason if unsafe */
  reason?: string;
}

/**
 * Result of workspace boundary enforcement
 */
export interface WorkspaceBoundaryResult {
  /** Whether the command is allowed */
  allowed: boolean;
  
  /** Reason if not allowed */
  reason?: string;
  
  /** Sanitized command with absolute paths */
  sanitizedCommand?: string;
}

/**
 * Result of file operation validation
 */
export interface FileOperationValidationResult {
  /** Whether file operations are allowed */
  allowed: boolean;
  
  /** Reason if not allowed */
  reason?: string;
}

/**
 * Enforces workspace boundaries for shell commands
 */
export class WorkspaceBoundaryEnforcer {
  private security: WorkspaceSecurity;

  constructor(security: WorkspaceSecurity) {
    this.security = security;
  }

  /**
   * Validates that all file paths in a command are within workspace boundaries
   */
  validateCommandPaths(command: string): PathValidationResult {
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
          reason: `Path validation failed for '${path}': ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    return { valid: true, validatedPaths };
  }

  /**
   * Validates working directory and checks for directory changes in command
   */
  validateWorkingDirectory(
    command: string,
    requestedCwd?: string
  ): WorkingDirectoryValidationResult {
    let workingDirectory = this.security.getWorkspaceRoot();

    if (requestedCwd) {
      try {
        workingDirectory = this.security.validatePath(requestedCwd);
      } catch (error) {
        return {
          valid: false,
          reason: `Working directory validation failed: ${error instanceof Error ? error.message : String(error)}`,
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
            reason: `Directory change validation failed for '${targetDir}': ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      }
    }

    return { valid: true, validatedCwd: workingDirectory };
  }

  /**
   * Checks for path traversal attempts in commands using known patterns
   */
  checkPathTraversal(command: string): PathTraversalCheckResult {
    // Extended path traversal patterns including system directories
    const pathTraversalPatterns = [
      ...PATH_TRAVERSAL_PATTERNS,
      
      // Additional system path patterns
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
          reason: `Path traversal pattern detected: ${matches[0]}`,
        };
      }
    }

    return { safe: true };
  }

  /**
   * Enforces workspace boundary for a command with comprehensive validation
   */
  enforceWorkspaceBoundary(
    command: string,
    workingDirectory: string
  ): WorkspaceBoundaryResult {
    // Check for dangerous path patterns
    const pathCheck = this.checkPathTraversal(command);
    if (!pathCheck.safe) {
      return {
        allowed: false,
        reason: pathCheck.reason || 'Path traversal detected',
      };
    }

    // Validate command paths
    const pathValidation = this.validateCommandPaths(command);
    if (!pathValidation.valid) {
      return {
        allowed: false,
        reason: pathValidation.reason || 'Path validation failed',
      };
    }

    // Validate working directory
    const cwdValidation = this.validateWorkingDirectory(
      command,
      workingDirectory
    );
    if (!cwdValidation.valid) {
      return {
        allowed: false,
        reason: cwdValidation.reason || 'Working directory validation failed',
      };
    }

    // Replace relative paths with absolute paths within workspace
    const sanitizedCommand = this.sanitizePathsInCommand(
      command,
      workingDirectory
    );

    return {
      allowed: true,
      sanitizedCommand,
    };
  }

  /**
   * Validates file operations to ensure they stay within workspace
   */
  validateFileOperations(command: string): FileOperationValidationResult {
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
                reason: `File operation attempted outside workspace: ${match}`,
              };
            }
          }
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Gets the workspace root directory
   */
  getWorkspaceRoot(): string {
    return this.security.getWorkspaceRoot();
  }

  /**
   * Gets relative path from workspace root
   */
  getRelativePath(absolutePath: string): string {
    return this.security.getRelativePathFromWorkspace(absolutePath);
  }

  /**
   * Resolves a target path relative to a base path
   */
  private resolvePath(targetPath: string, basePath: string): string {
    // Handle special cases
    if (targetPath === '.') return basePath;
    if (targetPath === '..') return path.dirname(basePath);

    // Handle absolute paths
    if (path.isAbsolute(targetPath)) return targetPath;

    // Handle relative paths
    return path.resolve(basePath, targetPath);
  }

  /**
   * Sanitizes paths in command by replacing relative paths with absolute paths
   */
  private sanitizePathsInCommand(
    command: string,
    workingDirectory: string
  ): string {
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

  /**
   * Validate that a command does not violate workspace boundaries
   */
  async validateCommand(command: string, workingDirectory: string): Promise<void> {
    // Validate the working directory is within workspace
    await this.security.validateFileAccess(workingDirectory, 'read');
    
    // Validate command paths
    const pathValidation = this.validateCommandPaths(command);
    if (!pathValidation.valid) {
      throw new Error(`Workspace boundary violation: ${pathValidation.reason}`);
    }
  }
}