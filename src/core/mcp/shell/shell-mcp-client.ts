/**
 * Shell MCP Client - Main client implementation
 * 
 * This is the refactored main shell client that uses the new modular architecture
 * and categorization system instead of complex risk assessment.
 */

import {
  MCPClient,
  Tool,
  ToolResult,
  MCPServerInfo,
} from '../base.js';
import { WorkspaceSecurity } from '../../security/workspace.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { performance } from 'perf_hooks';
import { randomUUID } from 'crypto';
import {
  ShellConfirmationPrompt,
  ConfirmationResponse,
} from '../confirmation.js';

// Import from new modular structure
import { 
  ShellExecuteParams, 
  ShellToolConfig,
  ShellErrorType
} from './types.js';
import { 
  CommandCategory, 
  CommandCategorization, 
  categorizeCommand 
} from './command-categorization.js';
import { TIMEOUTS } from './constants.js';

// Import extracted modules
import { WorkspaceBoundaryEnforcer } from './security/workspace-boundary-enforcer.js';
import { CommandFilter } from './security/command-filter.js';
import { ShellExecutionLogger } from './monitoring/execution-logger.js';
import { ShellExecutionError } from './errors/base-errors.js';

const execAsync = promisify(exec);

/**
 * Shell MCP Client with secure command execution and categorization-based security
 * 
 * Provides secure shell command execution within workspace boundaries using
 * simple pattern-based categorization instead of complex risk scoring.
 */
export class ShellMCPClient extends MCPClient {
  private security: WorkspaceSecurity;
  private boundaryEnforcer: WorkspaceBoundaryEnforcer;
  private commandFilter: CommandFilter;
  private executionLogger: ShellExecutionLogger;
  private sessionId: string;
  private confirmationPrompt: ShellConfirmationPrompt;

  constructor(security: WorkspaceSecurity, config?: Partial<ShellToolConfig>) {
    super('shell');
    this.security = security;
    this.boundaryEnforcer = new WorkspaceBoundaryEnforcer(security);
    this.commandFilter = new CommandFilter(config);
    this.sessionId = randomUUID();
    this.executionLogger = new ShellExecutionLogger(this.sessionId);
    this.confirmationPrompt = new ShellConfirmationPrompt();
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

  /**
   * Get the confirmation prompt instance for UI integration
   */
  getConfirmationPrompt(): ShellConfirmationPrompt {
    return this.confirmationPrompt;
  }

  async listTools(): Promise<Tool[]> {
    return [
      {
        name: 'ExecuteCommand',
        description: 'Execute shell commands with security filtering and confirmation',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The shell command to execute',
            },
            cwd: {
              type: 'string',
              description: 'Working directory (optional)',
            },
            timeout: {
              type: 'number',
              description: 'Timeout in seconds (optional, default 30)',
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
          return await this.executeCommandWithConfirmation(args);
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
   * ExecuteCommand with confirmation checkpoint using new categorization system
   */
  private async executeCommandWithConfirmation(
    params: any
  ): Promise<ToolResult> {
    const { command, cwd } = params as ShellExecuteParams;

    // Get configuration for confirmation behavior
    const config = this.commandFilter.getConfig();

    let workingDirectory = this.security.getWorkspaceRoot();
    if (cwd) {
      try {
        workingDirectory = await this.security.validateFileAccess(cwd, 'read');
      } catch (error) {
        // Continue with default workspace root if cwd validation fails
        // The detailed validation will happen in executeCommand
      }
    }

    try {
      // 1. Command categorization (replaces risk assessment)
      const categorization = categorizeCommand(command);

      // 2. Check if command should be blocked
      if (categorization.category === CommandCategory.BLOCKED) {
        // Log the blocked command attempt for security audit
        this.executionLogger.logSecurityEvent({
          eventType: 'COMMAND_BLOCKED',
          command,
          workingDirectory,
          description: `Command blocked by security policy`,
          reason: `Command blocked by security policy: ${categorization.reason}`,
          category: categorization.category,
          ...(categorization.matchedPattern && { matchedPattern: categorization.matchedPattern }),
        });

        return {
          content: [
            {
              type: 'text',
              text: `Command blocked by security policy: ${command}\nReason: ${categorization.reason}`,
            },
          ],
          isError: true,
        };
      }

      // 3. Check bypass logic for safe commands and trusted patterns
      if (!config.requireConfirmation || this.shouldBypassConfirmation(command, categorization, config)) {
        return await this.executeCommand(params);
      }

      // 4. Prompt for user confirmation for risky/dangerous commands
      const confirmationResponse = await this.confirmationPrompt.promptUser({
        command,
        categorization, // Pass categorization instead of riskAssessment
        workingDirectory,
        timeout: config.confirmationTimeout,
        sessionMemory: config.sessionMemory,
      });

      // 5. Handle user decision
      return await this.handleConfirmationResponse(
        confirmationResponse,
        params,
        config
      );
    } catch (error) {
      // Log confirmation system errors but don't block execution completely
      this.executionLogger.logSecurityEvent({
        eventType: 'COMMAND_BLOCKED',
        command,
        workingDirectory,
        description: `Confirmation system error`,
        reason: `Confirmation system error: ${error instanceof Error ? error.message : String(error)}`,
        category: CommandCategory.RISKY, // Default category for errors
      });

      // Fall back to original executeCommand if confirmation system fails
      return await this.executeCommand(params);
    }
  }

  /**
   * Check if command should bypass confirmation using new categorization system
   */
  private shouldBypassConfirmation(
    command: string, 
    categorization: CommandCategorization, 
    config: ShellToolConfig
  ): boolean {
    // Safe commands always bypass confirmation
    if (categorization.category === CommandCategory.SAFE) {
      return true;
    }

    // Check trusted commands in config
    if (config.trustedCommands?.some(pattern => {
      try {
        return new RegExp(pattern).test(command);
      } catch {
        return false; // Invalid regex, skip
      }
    })) {
      return true;
    }

    // Category-based configuration checks
    if (categorization.category === CommandCategory.RISKY && !config.requireConfirmationForRisky) {
      return true;
    }

    if (categorization.category === CommandCategory.DANGEROUS && !config.requireConfirmationForDangerous) {
      return true;
    }

    return false;
  }

  /**
   * Handle user confirmation response
   */
  private async handleConfirmationResponse(
    response: ConfirmationResponse,
    params: ShellExecuteParams,
    config: ShellToolConfig
  ): Promise<ToolResult> {
    const { command } = params;

    switch (response.action) {
      case 'allow':
        // Execute the command
        return await this.executeCommand(params);
      case 'deny':
        // Log the denied command
        this.executionLogger.logSecurityEvent({
          eventType: 'COMMAND_DENIED',
          command,
          workingDirectory: this.security.getWorkspaceRoot(),
          description: `User denied command execution`,
          reason: 'User denied command execution',
          category: CommandCategory.RISKY, // Default for denied commands
        });
        return {
          content: [
            {
              type: 'text',
              text: `Command execution denied by user: ${command}`,
            },
          ],
          isError: false,
        };
      case 'trust':
        // Add to trusted patterns and execute
        await this.addToTrustedCommands(command, config);
        return await this.executeCommand(params, true);
      case 'block':
        // Add to always-block patterns and deny
        await this.addToBlockedCommands(command, config);
        return {
          content: [
            {
              type: 'text',
              text: `Command blocked and added to block list: ${command}`,
            },
          ],
          isError: true,
        };
      default:
        return {
          content: [
            {
              type: 'text',
              text: `Invalid confirmation response: ${response.action}`,
            },
          ],
          isError: true,
        };
    }
  }

  /**
   * Core command execution logic
   */
  private async executeCommand(
    params: ShellExecuteParams,
    bypassFilter: boolean = false
  ): Promise<ToolResult> {
    const startTime = performance.now();
    const { command, cwd, timeout = TIMEOUTS.DEFAULT_COMMAND_EXECUTION } = params;

    try {
      // Validate timeout parameter
      if (timeout <= 0) {
        throw new ShellExecutionError(
          `Invalid timeout: ${timeout}. Must be greater than 0.`,
          ShellErrorType.INPUT_VALIDATION,
          {
            command,
            workingDirectory: this.security.getWorkspaceRoot(),
            timestamp: new Date(),
            category: CommandCategory.RISKY,
          }
        );
      }

      if (timeout > TIMEOUTS.MAX_COMMAND_EXECUTION) {
        throw new ShellExecutionError(
          `Command failed: timeout exceeds maximum allowed: ${timeout}s > ${TIMEOUTS.MAX_COMMAND_EXECUTION}s`,
          ShellErrorType.INPUT_VALIDATION,
          {
            command,
            workingDirectory: this.security.getWorkspaceRoot(),
            timestamp: new Date(),
            category: CommandCategory.RISKY,
          }
        );
      }

      // Validate workspace access
      let workingDirectory = this.security.getWorkspaceRoot();
      if (cwd) {
        workingDirectory = await this.security.validateFileAccess(cwd, 'read');
      }

      // Apply command filtering unless bypassed
      if (!bypassFilter) {
        const filterResult = await this.commandFilter.filterCommand(command, workingDirectory);
        if (!filterResult.allowed) {
          throw new ShellExecutionError(
            filterResult.reason || 'Command blocked by security policy',
            ShellErrorType.SECURITY_ERROR,
            {
              command,
              workingDirectory,
              timestamp: new Date(),
              category: CommandCategory.DANGEROUS,
            }
          );
        }
      }

      // Enforce workspace boundaries
      await this.boundaryEnforcer.validateCommand(command, workingDirectory);

      // Execute the command
      const result = await execAsync(command, {
        cwd: workingDirectory,
        timeout: timeout * 1000, // Convert to milliseconds
        maxBuffer: 1024 * 1024, // 1MB buffer
      });

      const executionTime = performance.now() - startTime;
      const categorization = categorizeCommand(command);

      // Log successful execution
      this.executionLogger.logExecution({
        command,
        workingDirectory,
        exitCode: 0,
        executionTime,
        success: true,
        stdout: result.stdout,
        stderr: result.stderr,
        categoryAssessment: {
          category: categorization.category,
          ...(categorization.matchedPattern && { matchedPattern: categorization.matchedPattern }),
          manualApprovalRequired: categorization.requiresConfirmation,
          approved: true,
          approvalMethod: 'automatic'
        },
      });

      // Create security information for response
      const securityInfo = {
        validated: true,
        phase: 'Phase 4 - Enhanced Logging and Error Handling',
        category: categorization.category,
        requiresConfirmation: categorization.requiresConfirmation,
        approved: true,
        approvalMethod: 'automatic',
        executionTime: Math.round(executionTime),
        workingDirectory
      };

      // Create response with security information
      const response = {
        output: result.stdout || 'Command executed successfully (no output)',
        security: securityInfo,
        command,
        timestamp: new Date().toISOString(),
        exitCode: 0
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error: any) {
      const executionTime = performance.now() - startTime;
      const categorization = categorizeCommand(command);
      
      // Log failed execution
      this.executionLogger.logExecution({
        command,
        workingDirectory: cwd || this.security.getWorkspaceRoot(),
        exitCode: error.code || -1,
        executionTime,
        success: false,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        categoryAssessment: {
          category: categorization.category,
          ...(categorization.matchedPattern && { matchedPattern: categorization.matchedPattern }),
          manualApprovalRequired: categorization.requiresConfirmation,
          approved: false,
          approvalMethod: 'automatic'
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: `Command failed: ${error.message}\n${error.stderr || ''}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Add command to trusted patterns
   */
  private async addToTrustedCommands(command: string, config: ShellToolConfig): Promise<void> {
    // This would typically save to user configuration
    // For now, we'll add to runtime config
    config.trustedCommands = config.trustedCommands || [];
    config.trustedCommands.push(`^${command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  }

  /**
   * Add command to blocked patterns  
   */
  private async addToBlockedCommands(command: string, config: ShellToolConfig): Promise<void> {
    // This would typically save to user configuration
    // For now, we'll add to runtime config
    config.alwaysBlockPatterns = config.alwaysBlockPatterns || [];
    config.alwaysBlockPatterns.push(`^${command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  }

  /**
   * Get current configuration
   */
  getConfiguration(): ShellToolConfig {
    return this.commandFilter.getConfig();
  }

  /**
   * Update configuration
   */
  updateConfiguration(config: Partial<ShellToolConfig>): void {
    this.commandFilter.updateConfig(config);
  }

  /**
   * Add command to allowed commands
   */
  addAllowedCommand(command: string): void {
    this.commandFilter.addAllowedCommand(command);
  }

  /**
   * Add command to blocked commands
   */
  addBlockedCommand(command: string): void {
    this.commandFilter.addBlockedCommand(command);
  }

  /**
   * Get security summary
   */
  getSecuritySummary() {
    return this.executionLogger.getSecuritySummary();
  }

  /**
   * Get security events
   */
  getSecurityEvents(limit?: number) {
    return this.executionLogger.getSecurityEvents(limit);
  }

  /**
   * Export security report
   */
  exportSecurityReport(): string {
    return this.executionLogger.exportSecurityReport();
  }
}