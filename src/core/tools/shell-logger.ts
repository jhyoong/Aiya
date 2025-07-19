import * as fs from 'fs';
import * as path from 'path';
import { ToolLogger } from './logger.js';

export interface ShellLogEntry {
  timestamp: string;
  sessionId: string;
  command: string;
  exitCode?: number | undefined;
  stdout?: string | undefined;
  stderr?: string | undefined;
  duration?: number | undefined;
  error?: string | undefined;
}

export interface ShellApprovalLogEntry {
  timestamp: string;
  sessionId: string;
  command: string;
  commandType: string;
  approved: boolean;
  choice: string; // 'once', 'always', 'reject'
}

export class ShellLogger extends ToolLogger {
  private shellLogFile: string;

  constructor(sessionId?: string) {
    super(sessionId);

    // Create shell-specific log file
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const logsDir = path.join(homeDir, '.aiya', 'logs');
    this.shellLogFile = path.join(logsDir, 'shell.log');
  }

  logShellCommand(
    command: string,
    exitCode?: number,
    stdout?: string,
    stderr?: string,
    duration?: number,
    error?: string
  ): void {
    const entry: ShellLogEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.getSessionId(),
      command,
      exitCode,
      stdout: this.truncateOutput(stdout),
      stderr: this.truncateOutput(stderr),
      duration,
      error,
    };

    const logLine = this.formatShellLogEntry(entry);

    try {
      fs.appendFileSync(this.shellLogFile, logLine + '\n', 'utf8');
    } catch (writeError) {
      console.error('Failed to write shell log:', writeError);
    }
  }

  logApprovalRequest(command: string, commandType: string): void {
    const logLine = `[${new Date().toISOString()}] [${this.getSessionId()}] APPROVAL_REQUEST ${commandType}: ${command}`;
    try {
      fs.appendFileSync(this.shellLogFile, logLine + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write approval request log:', error);
    }
  }

  logApprovalResult(
    command: string,
    commandType: string,
    approved: boolean,
    choice: string
  ): void {
    const entry: ShellApprovalLogEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.getSessionId(),
      command,
      commandType,
      approved,
      choice,
    };

    const status = approved ? 'APPROVED' : 'REJECTED';
    const logLine = `[${entry.timestamp}] [${entry.sessionId}] APPROVAL_${status} ${entry.commandType}: ${entry.command} (${entry.choice})`;

    try {
      fs.appendFileSync(this.shellLogFile, logLine + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write approval result log:', error);
    }
  }

  private formatShellLogEntry(entry: ShellLogEntry): string {
    const exitCodeTag = entry.exitCode !== undefined ? ` exit:${entry.exitCode}` : '';
    const durationTag = entry.duration ? ` (${entry.duration}ms)` : '';
    const errorTag = entry.error ? ` ERROR: ${entry.error}` : '';
    
    let outputInfo = '';
    if (entry.stdout) {
      outputInfo += ` stdout:[${entry.stdout.length} chars]`;
    }
    if (entry.stderr) {
      outputInfo += ` stderr:[${entry.stderr.length} chars]`;
    }

    return `[${entry.timestamp}] [${entry.sessionId}] SHELL: ${entry.command}${exitCodeTag}${durationTag}${outputInfo}${errorTag}`;
  }

  private truncateOutput(output?: string): string | undefined {
    if (!output) return output;
    
    // Truncate very long output to avoid massive log files
    if (output.length > 1000) {
      return output.substring(0, 1000) + '...[truncated]';
    }
    return output;
  }

  extractCommandType(command: string): string {
    // Extract the base command from the shell command
    const parts = command.trim().split(/\s+/);
    if (parts.length === 0) return 'unknown';
    
    const baseCommand = parts[0];
    if (!baseCommand) return 'unknown';
    
    // Handle common command patterns
    if (baseCommand.includes('/')) {
      // Full path command, extract just the command name
      return path.basename(baseCommand);
    }
    
    return baseCommand;
  }
}