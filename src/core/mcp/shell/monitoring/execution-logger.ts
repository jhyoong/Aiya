/**
 * Shell Execution Logger
 * 
 * Comprehensive logging system for shell command executions and security events.
 * Follows the TokenLogger pattern for file-based logging with rotation.
 * Updated to use category-based classification instead of risk scores.
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { LIMITS } from '../constants.js';
import { CommandCategory } from '../command-categorization.js';
import {
  ShellLogLevel,
  ShellLogQuery,
  ShellLogStatistics,
  ShellLogExportFormat,
  ShellLogExportConfig,
  ShellErrorType,
  ShellExecutionLog,
  ShellSecurityEvent,
} from '../types.js';

/**
 * Enhanced Shell Execution Logger with comprehensive logging capabilities
 */
export class ShellExecutionLogger {
  private logFile: string;
  private securityLogFile: string;
  private events: ShellSecurityEvent[] = [];
  private executionLogs: ShellExecutionLog[] = [];
  private maxEvents: number;
  private maxExecutionLogs: number;
  private sessionId: string;
  private logLevel: ShellLogLevel;

  constructor(
    sessionId: string,
    maxEvents: number = LIMITS.MAX_EVENTS_IN_MEMORY,
    maxExecutionLogs: number = LIMITS.MAX_EXECUTION_LOGS,
    logLevel: ShellLogLevel = ShellLogLevel.INFO
  ) {
    this.sessionId = sessionId;
    this.maxEvents = maxEvents;
    this.maxExecutionLogs = maxExecutionLogs;
    this.logLevel = logLevel;

    // Create logs directory following TokenLogger pattern
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const aiyaDir = path.join(homeDir, '.aiya');
    const logsDir = path.join(aiyaDir, 'logs');

    // Ensure directories exist
    if (!fs.existsSync(aiyaDir)) {
      fs.mkdirSync(aiyaDir, { recursive: true });
    }
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    this.logFile = path.join(logsDir, 'shell-execution.log');
    this.securityLogFile = path.join(logsDir, 'shell-security.log');
  }

  /**
   * Log a security event with enhanced context
   */
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

    // Write to security log file
    this.writeSecurityLogEntry(securityEvent);

    // Log to console in development/debug mode
    if (this.shouldLogToConsole()) {
      console.log(
        `[SHELL SECURITY] ${event.eventType}: ${event.command} - ${event.reason || 'No reason provided'}`
      );
    }
  }

  /**
   * Log a shell execution with comprehensive tracking
   */
  logExecution(
    log: Omit<ShellExecutionLog, 'timestamp' | 'id' | 'sessionId'>
  ): void {
    const executionLog: ShellExecutionLog = {
      ...log,
      id: this.generateExecutionId(),
      sessionId: this.sessionId,
      timestamp: new Date(),
    };

    this.executionLogs.push(executionLog);

    // Rotate logs if needed
    if (this.executionLogs.length > this.maxExecutionLogs) {
      this.executionLogs = this.executionLogs.slice(-this.maxExecutionLogs);
    }

    // Write to execution log file
    this.writeExecutionLogEntry(executionLog);

    // Log to console in development/debug mode
    if (this.shouldLogToConsole()) {
      console.log(
        `[SHELL EXECUTION] ${log.command} - Exit Code: ${log.exitCode}, Time: ${log.executionTime}ms, Category: ${log.categoryAssessment.category || 'unknown'}`
      );
    }
  }

  /**
   * Query execution logs with filtering
   */
  queryExecutionLogs(query: ShellLogQuery): ShellExecutionLog[] {
    let results = [...this.executionLogs];

    // Apply filters
    if (query.dateRange) {
      results = results.filter(
        log =>
          log.timestamp >= query.dateRange!.start &&
          log.timestamp <= query.dateRange!.end
      );
    }

    if (query.commandPattern) {
      const pattern =
        typeof query.commandPattern === 'string'
          ? new RegExp(query.commandPattern, 'i')
          : query.commandPattern;
      results = results.filter(log => pattern.test(log.command));
    }

    if (query.success !== undefined) {
      results = results.filter(log => log.success === query.success);
    }

    if (query.errorType) {
      results = results.filter(log => log.errorType === query.errorType);
    }

    if (query.category) {
      results = results.filter(log => log.categoryAssessment.category === query.category);
    }

    if (query.executionTimeRange) {
      results = results.filter(
        log =>
          log.executionTime >= query.executionTimeRange!.min &&
          log.executionTime <= query.executionTimeRange!.max
      );
    }

    if (query.userId) {
      results = results.filter(log => log.userId === query.userId);
    }

    if (query.sessionId) {
      results = results.filter(log => log.sessionId === query.sessionId);
    }

    // Sort by timestamp (most recent first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || results.length;

    return results.slice(offset, offset + limit);
  }

  /**
   * Get execution statistics with category-based metrics
   */
  getExecutionStatistics(): ShellLogStatistics {
    const totalExecutions = this.executionLogs.length;
    const successfulExecutions = this.executionLogs.filter(
      log => log.success
    ).length;
    const failedExecutions = totalExecutions - successfulExecutions;
    const successRate =
      totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

    const averageExecutionTime =
      totalExecutions > 0
        ? this.executionLogs.reduce((sum, log) => sum + log.executionTime, 0) /
          totalExecutions
        : 0;

    // Calculate top commands
    const commandCounts = this.executionLogs.reduce(
      (acc, log) => {
        const cmd = log.command.split(' ')[0]; // Get base command
        if (cmd && cmd.length > 0) {
          if (!acc[cmd]) {
            acc[cmd] = { count: 0, successful: 0 };
          }
          acc[cmd]!.count++;
          if (log.success) {
            acc[cmd]!.successful++;
          }
        }
        return acc;
      },
      {} as Record<string, { count: number; successful: number }>
    );

    const topCommands = Object.entries(commandCounts)
      .map(([command, stats]) => ({
        command,
        count: stats.count,
        successRate:
          stats.count > 0 ? (stats.successful / stats.count) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate top errors
    const errorCounts = this.executionLogs
      .filter(log => log.errorType)
      .reduce(
        (acc, log) => {
          const errorType = log.errorType!;
          acc[errorType] = (acc[errorType] || 0) + 1;
          return acc;
        },
        {} as Record<ShellErrorType, number>
      );

    const topErrors = Object.entries(errorCounts)
      .map(([errorType, count]) => ({
        errorType: errorType as ShellErrorType,
        count,
        percentage: failedExecutions > 0 ? (count / failedExecutions) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate category distribution (replaces risk score distribution)
    const categoryDistribution = this.executionLogs.reduce(
      (acc, log) => {
        const category = log.categoryAssessment.category || CommandCategory.SAFE;
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      },
      {} as Record<CommandCategory, number>
    );

    // Calculate execution time distribution
    const executionTimeDistribution = this.executionLogs.reduce(
      (acc, log) => {
        const time = log.executionTime;
        if (time < 1000) acc.fast++;
        else if (time <= 10000) acc.normal++;
        else acc.slow++;
        return acc;
      },
      { fast: 0, normal: 0, slow: 0 }
    );

    // Security events summary
    const eventsByType = this.events.reduce(
      (acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const securityEventsSummary = {
      totalEvents: this.events.length,
      blockedCommands: eventsByType['COMMAND_BLOCKED'] || 0,
      pathTraversalAttempts: eventsByType['PATH_TRAVERSAL'] || 0,
      dangerousCommands: eventsByType['DANGEROUS_COMMAND'] || 0,
      workspaceViolations: eventsByType['WORKSPACE_VIOLATION'] || 0,
    };

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate: Math.round(successRate * 100) / 100,
      averageExecutionTime: Math.round(averageExecutionTime),
      topCommands,
      topErrors,
      categoryDistribution,
      executionTimeDistribution,
      securityEventsSummary,
    };
  }

  /**
   * Export logs in various formats
   */
  exportLogs(config: ShellLogExportConfig): string {
    const logs = config.query
      ? this.queryExecutionLogs(config.query)
      : this.executionLogs;

    switch (config.format) {
      case ShellLogExportFormat.JSON:
        return this.exportAsJSON(logs, config);
      case ShellLogExportFormat.CSV:
        return this.exportAsCSV(logs, config);
      case ShellLogExportFormat.TEXT:
        return this.exportAsText(logs, config);
      case ShellLogExportFormat.HTML:
        return this.exportAsHTML(logs, config);
      default:
        return this.exportAsJSON(logs, config);
    }
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.events = [];
    this.executionLogs = [];

    // Clear log files
    try {
      fs.writeFileSync(this.logFile, '');
      fs.writeFileSync(this.securityLogFile, '');
    } catch (error) {
      console.error('Failed to clear log files:', error);
    }
  }

  /**
   * Rotate logs if they get too large
   */
  rotateLogs(): void {
    try {
      // Rotate execution log
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size > LIMITS.MAX_LOG_FILE_SIZE) {
          const backupFile = `${this.logFile}.${Date.now()}.backup`;
          fs.renameSync(this.logFile, backupFile);
        }
      }

      // Rotate security log
      if (fs.existsSync(this.securityLogFile)) {
        const stats = fs.statSync(this.securityLogFile);
        if (stats.size > LIMITS.MAX_LOG_FILE_SIZE) {
          const backupFile = `${this.securityLogFile}.${Date.now()}.backup`;
          fs.renameSync(this.securityLogFile, backupFile);
        }
      }
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get current log counts
   */
  getLogCounts(): { events: number; executions: number } {
    return {
      events: this.events.length,
      executions: this.executionLogs.length,
    };
  }

  // Private helper methods

  private generateExecutionId(): string {
    return randomUUID();
  }

  private shouldLogToConsole(): boolean {
    return (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_SHELL_SECURITY === 'true' ||
      this.logLevel === ShellLogLevel.DEBUG
    );
  }

  private writeExecutionLogEntry(log: ShellExecutionLog): void {
    const logLine = `[${log.timestamp.toISOString()}] [${log.sessionId}] [${log.id}] ${log.command} - Exit: ${log.exitCode}, Time: ${log.executionTime}ms, Success: ${log.success}, Category: ${log.categoryAssessment.category || 'unknown'}`;

    try {
      fs.appendFileSync(this.logFile, logLine + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write execution log:', error);
    }
  }

  private writeSecurityLogEntry(event: ShellSecurityEvent): void {
    const logLine = `[${event.timestamp.toISOString()}] [${this.sessionId}] [${event.eventType}] ${event.command} - ${event.reason || 'No reason'}`;

    try {
      fs.appendFileSync(this.securityLogFile, logLine + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write security log:', error);
    }
  }

  private exportAsJSON(
    logs: ShellExecutionLog[],
    config: ShellLogExportConfig
  ): string {
    const exportData = {
      generatedAt: new Date().toISOString(),
      sessionId: this.sessionId,
      totalLogs: logs.length,
      statistics: this.getExecutionStatistics(),
      logs: logs.map(log => this.sanitizeLogForExport(log, config)),
    };

    return JSON.stringify(exportData, null, 2);
  }

  private exportAsCSV(
    logs: ShellExecutionLog[],
    _config: ShellLogExportConfig
  ): string {
    const headers = [
      'id',
      'timestamp',
      'command',
      'workingDirectory',
      'exitCode',
      'executionTime',
      'success',
      'errorType',
      'category',
    ];

    const rows = logs.map(log => [
      log.id,
      log.timestamp.toISOString(),
      log.command,
      log.workingDirectory,
      log.exitCode,
      log.executionTime,
      log.success,
      log.errorType || '',
      log.categoryAssessment.category || 'unknown',
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private exportAsText(
    logs: ShellExecutionLog[],
    _config: ShellLogExportConfig
  ): string {
    const lines = logs.map(log => {
      const timestamp = log.timestamp.toISOString();
      const status = log.success ? 'SUCCESS' : 'FAILED';
      const error = log.errorType ? ` (${log.errorType})` : '';
      const category = log.categoryAssessment.category ? ` [${log.categoryAssessment.category}]` : '';
      return `[${timestamp}] ${status}${error}${category} - ${log.command} (${log.executionTime}ms)`;
    });

    return lines.join('\n');
  }

  private exportAsHTML(
    logs: ShellExecutionLog[],
    _config: ShellLogExportConfig
  ): string {
    const stats = this.getExecutionStatistics();
    const rows = logs
      .map(log => {
        const status = log.success ? 'success' : 'error';
        const timestamp = log.timestamp.toISOString();
        return `
        <tr class="${status}">
          <td>${timestamp}</td>
          <td><code>${log.command}</code></td>
          <td>${log.workingDirectory}</td>
          <td>${log.exitCode}</td>
          <td>${log.executionTime}ms</td>
          <td>${log.success ? 'Success' : 'Failed'}</td>
          <td>${log.errorType || ''}</td>
          <td><span class="category-${log.categoryAssessment.category}">${log.categoryAssessment.category || 'unknown'}</span></td>
        </tr>
      `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Shell Execution Log Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .stats { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .success { background-color: #d4edda; }
            .error { background-color: #f8d7da; }
            code { background: #f1f1f1; padding: 2px 4px; border-radius: 3px; }
            .category-safe { color: #28a745; font-weight: bold; }
            .category-risky { color: #ffc107; font-weight: bold; }
            .category-dangerous { color: #dc3545; font-weight: bold; }
            .category-blocked { color: #6c757d; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Shell Execution Log Report</h1>
          <div class="stats">
            <h2>Statistics</h2>
            <p>Total Executions: ${stats.totalExecutions}</p>
            <p>Success Rate: ${stats.successRate}%</p>
            <p>Average Execution Time: ${stats.averageExecutionTime}ms</p>
          </div>
          <h2>Execution Log</h2>
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Command</th>
                <th>Directory</th>
                <th>Exit Code</th>
                <th>Time</th>
                <th>Status</th>
                <th>Error Type</th>
                <th>Category</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `;
  }

  private sanitizeLogForExport(
    log: ShellExecutionLog,
    config: ShellLogExportConfig
  ): Partial<ShellExecutionLog> {
    const sanitized: Partial<ShellExecutionLog> = {
      id: log.id,
      timestamp: log.timestamp,
      command: log.command,
      workingDirectory: log.workingDirectory,
      exitCode: log.exitCode,
      executionTime: log.executionTime,
      success: log.success,
      categoryAssessment: log.categoryAssessment,
    };

    if (log.errorType) {
      sanitized.errorType = log.errorType;
    }

    if (config.includeSensitiveData) {
      sanitized.workingDirectory = log.workingDirectory;
      if (log.stdout) {
        sanitized.stdout = log.stdout;
      }
      if (log.stderr) {
        sanitized.stderr = log.stderr;
      }
    }

    if (config.includePerformanceMetrics && log.performanceMetrics) {
      sanitized.performanceMetrics = log.performanceMetrics;
    }

    if (config.includeSecurityEvents && log.securityEvents) {
      sanitized.securityEvents = log.securityEvents;
    }

    return sanitized;
  }
}