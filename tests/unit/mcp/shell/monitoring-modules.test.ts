/**
 * Unit tests for monitoring modules
 * Tests execution-logger.ts and performance-monitor.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import { ShellExecutionLogger } from '../../../../src/core/mcp/shell/monitoring/execution-logger.js';
import { ShellPerformanceMonitor, PerformanceMetrics, FileOperationEstimate, NetworkActivityEstimate } from '../../../../src/core/mcp/shell/monitoring/performance-monitor.js';
import { CommandCategory } from '../../../../src/core/mcp/shell/command-categorization.js';
import { ShellLogLevel, ShellLogExportFormat, ShellErrorType } from '../../../../src/core/mcp/shell/types.js';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  statSync: vi.fn(() => ({ size: 1000 })),
  renameSync: vi.fn(),
}));

describe('Monitoring Modules', () => {
  describe('ShellExecutionLogger', () => {
    let logger: ShellExecutionLogger;
    const mockSessionId = 'test-session-123';

    beforeEach(() => {
      vi.clearAllMocks();
      logger = new ShellExecutionLogger(mockSessionId, 100, 50, ShellLogLevel.INFO);
    });

    describe('Constructor and Initialization', () => {
      it('should initialize with correct session ID', () => {
        expect(logger.getSessionId()).toBe(mockSessionId);
      });

      it('should initialize log counts as zero', () => {
        const counts = logger.getLogCounts();
        expect(counts.events).toBe(0);
        expect(counts.executions).toBe(0);
      });

      it('should create log directories when initializing', () => {
        new ShellExecutionLogger('test-session');
        expect(fs.mkdirSync).toHaveBeenCalled();
      });
    });

    describe('Security Event Logging', () => {
      it('should log security events correctly', () => {
        const securityEvent = {
          eventType: 'COMMAND_BLOCKED',
          command: 'rm -rf /',
          reason: 'Dangerous command blocked',
          userId: 'test-user',
          severity: 'high' as const,
        };

        logger.logSecurityEvent(securityEvent);

        const events = logger.getSecurityEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject(securityEvent);
        expect(events[0].timestamp).toBeInstanceOf(Date);
      });

      it('should write security events to file', () => {
        const securityEvent = {
          eventType: 'PATH_TRAVERSAL',
          command: 'cat ../../../etc/passwd',
          reason: 'Path traversal attempt',
          userId: 'test-user',
          severity: 'high' as const,
        };

        logger.logSecurityEvent(securityEvent);

        expect(fs.appendFileSync).toHaveBeenCalledWith(
          expect.stringContaining('shell-security.log'),
          expect.stringContaining('PATH_TRAVERSAL'),
          'utf8'
        );
      });

      it('should rotate security events when limit exceeded', () => {
        const maxEvents = 3;
        const smallLogger = new ShellExecutionLogger('test', maxEvents, 50);

        // Add events beyond limit
        for (let i = 0; i < maxEvents + 2; i++) {
          smallLogger.logSecurityEvent({
            eventType: 'COMMAND_BLOCKED',
            command: `test-command-${i}`,
            reason: 'Test reason',
            userId: 'test-user',
            severity: 'medium',
          });
        }

        const events = smallLogger.getSecurityEvents();
        expect(events).toHaveLength(maxEvents);
        expect(events[0].command).toBe('test-command-4'); // Most recent
      });
    });

    describe('Execution Logging', () => {
      it('should log execution events correctly', () => {
        const executionLog = {
          command: 'ls -la',
          workingDirectory: '/test',
          exitCode: 0,
          executionTime: 150,
          success: true,
          stdout: 'file1.txt\nfile2.txt',
          stderr: '',
          userId: 'test-user',
          categoryAssessment: {
            category: CommandCategory.SAFE,
            reason: 'Safe command',
            requiresConfirmation: false,
            allowExecution: true,
          },
        };

        logger.logExecution(executionLog);

        const executions = logger.getExecutionLogs();
        expect(executions).toHaveLength(1);
        expect(executions[0]).toMatchObject(executionLog);
        expect(executions[0].id).toBeDefined();
        expect(executions[0].sessionId).toBe(mockSessionId);
        expect(executions[0].timestamp).toBeInstanceOf(Date);
      });

      it('should write execution events to file', () => {
        const executionLog = {
          command: 'pwd',
          workingDirectory: '/test',
          exitCode: 0,
          executionTime: 50,
          success: true,
          userId: 'test-user',
          categoryAssessment: {
            category: CommandCategory.SAFE,
            reason: 'Safe command',
            requiresConfirmation: false,
            allowExecution: true,
          },
        };

        logger.logExecution(executionLog);

        expect(fs.appendFileSync).toHaveBeenCalledWith(
          expect.stringContaining('shell-execution.log'),
          expect.stringContaining('pwd'),
          'utf8'
        );
      });

      it('should rotate execution logs when limit exceeded', () => {
        const maxLogs = 3;
        const smallLogger = new ShellExecutionLogger('test', 100, maxLogs);

        // Add logs beyond limit
        for (let i = 0; i < maxLogs + 2; i++) {
          smallLogger.logExecution({
            command: `test-command-${i}`,
            workingDirectory: '/test',
            exitCode: 0,
            executionTime: 100,
            success: true,
            userId: 'test-user',
            categoryAssessment: {
              category: CommandCategory.SAFE,
              reason: 'Safe command',
              requiresConfirmation: false,
              allowExecution: true,
            },
          });
        }

        const logs = smallLogger.getExecutionLogs();
        expect(logs).toHaveLength(maxLogs);
        expect(logs[0].command).toBe('test-command-4'); // Most recent
      });
    });

    describe('Query Functionality', () => {
      beforeEach(() => {
        // Add test data
        const testLogs = [
          {
            command: 'ls -la',
            workingDirectory: '/test',
            exitCode: 0,
            executionTime: 100,
            success: true,
            userId: 'user1',
            categoryAssessment: {
              category: CommandCategory.SAFE,
              reason: 'Safe command',
              requiresConfirmation: false,
              allowExecution: true,
            },
          },
          {
            command: 'rm file.txt',
            workingDirectory: '/test',
            exitCode: 0,
            executionTime: 200,
            success: true,
            userId: 'user2',
            categoryAssessment: {
              category: CommandCategory.DANGEROUS,
              reason: 'Dangerous command',
              requiresConfirmation: true,
              allowExecution: true,
            },
          },
          {
            command: 'invalid_command',
            workingDirectory: '/test',
            exitCode: 1,
            executionTime: 50,
            success: false,
            errorType: ShellErrorType.COMMAND_NOT_FOUND,
            userId: 'user1',
            categoryAssessment: {
              category: CommandCategory.RISKY,
              reason: 'Unknown command',
              requiresConfirmation: true,
              allowExecution: true,
            },
          },
        ];

        testLogs.forEach(log => logger.logExecution(log));
      });

      it('should query by command pattern', () => {
        const results = logger.queryExecutionLogs({
          commandPattern: 'ls',
        });

        expect(results).toHaveLength(1);
        expect(results[0].command).toBe('ls -la');
      });

      it('should query by success status', () => {
        const successfulResults = logger.queryExecutionLogs({
          success: true,
        });

        const failedResults = logger.queryExecutionLogs({
          success: false,
        });

        expect(successfulResults).toHaveLength(2);
        expect(failedResults).toHaveLength(1);
      });

      it('should query by category', () => {
        const dangerousResults = logger.queryExecutionLogs({
          category: CommandCategory.DANGEROUS,
        });

        expect(dangerousResults).toHaveLength(1);
        expect(dangerousResults[0].command).toBe('rm file.txt');
      });

      it('should query by error type', () => {
        const errorResults = logger.queryExecutionLogs({
          errorType: ShellErrorType.COMMAND_NOT_FOUND,
        });

        expect(errorResults).toHaveLength(1);
        expect(errorResults[0].command).toBe('invalid_command');
      });

      it('should query by user ID', () => {
        const user1Results = logger.queryExecutionLogs({
          userId: 'user1',
        });

        expect(user1Results).toHaveLength(2);
      });

      it('should query by execution time range', () => {
        const fastResults = logger.queryExecutionLogs({
          executionTimeRange: { min: 0, max: 150 },
        });

        expect(fastResults).toHaveLength(2);
      });

      it('should apply pagination', () => {
        const page1Results = logger.queryExecutionLogs({
          offset: 0,
          limit: 2,
        });

        const page2Results = logger.queryExecutionLogs({
          offset: 2,
          limit: 2,
        });

        expect(page1Results).toHaveLength(2);
        expect(page2Results).toHaveLength(1);
      });
    });

    describe('Statistics Generation', () => {
      beforeEach(() => {
        // Add test data for statistics
        const testData = [
          { command: 'ls -la', success: true, executionTime: 100, category: CommandCategory.SAFE },
          { command: 'ls -l', success: true, executionTime: 80, category: CommandCategory.SAFE },
          { command: 'rm file.txt', success: true, executionTime: 200, category: CommandCategory.DANGEROUS },
          { command: 'invalid_cmd', success: false, executionTime: 50, category: CommandCategory.RISKY, errorType: ShellErrorType.COMMAND_NOT_FOUND },
        ];

        testData.forEach(data => {
          logger.logExecution({
            command: data.command,
            workingDirectory: '/test',
            exitCode: data.success ? 0 : 1,
            executionTime: data.executionTime,
            success: data.success,
            errorType: data.errorType,
            userId: 'test-user',
            categoryAssessment: {
              category: data.category,
              reason: 'Test reason',
              requiresConfirmation: false,
              allowExecution: true,
            },
          });
        });
      });

      it('should generate correct execution statistics', () => {
        const stats = logger.getExecutionStatistics();

        expect(stats.totalExecutions).toBe(4);
        expect(stats.successfulExecutions).toBe(3);
        expect(stats.failedExecutions).toBe(1);
        expect(stats.successRate).toBe(75);
        expect(stats.averageExecutionTime).toBe(107.5);
      });

      it('should generate top commands statistics', () => {
        const stats = logger.getExecutionStatistics();

        expect(stats.topCommands).toHaveLength(3);
        expect(stats.topCommands[0].command).toBe('ls');
        expect(stats.topCommands[0].count).toBe(2);
        expect(stats.topCommands[0].successRate).toBe(100);
      });

      it('should generate top errors statistics', () => {
        const stats = logger.getExecutionStatistics();

        expect(stats.topErrors).toHaveLength(1);
        expect(stats.topErrors[0].errorType).toBe(ShellErrorType.COMMAND_NOT_FOUND);
        expect(stats.topErrors[0].count).toBe(1);
        expect(stats.topErrors[0].percentage).toBe(100);
      });

      it('should generate category distribution', () => {
        const stats = logger.getExecutionStatistics();

        expect(stats.categoryDistribution[CommandCategory.SAFE]).toBe(2);
        expect(stats.categoryDistribution[CommandCategory.DANGEROUS]).toBe(1);
        expect(stats.categoryDistribution[CommandCategory.RISKY]).toBe(1);
      });

      it('should generate execution time distribution', () => {
        const stats = logger.getExecutionStatistics();

        expect(stats.executionTimeDistribution.fast).toBe(4); // < 1000ms
        expect(stats.executionTimeDistribution.normal).toBe(0); // 1000-10000ms
        expect(stats.executionTimeDistribution.slow).toBe(0); // > 10000ms
      });
    });

    describe('Log Export', () => {
      beforeEach(() => {
        logger.logExecution({
          command: 'test command',
          workingDirectory: '/test',
          exitCode: 0,
          executionTime: 100,
          success: true,
          userId: 'test-user',
          categoryAssessment: {
            category: CommandCategory.SAFE,
            reason: 'Safe command',
            requiresConfirmation: false,
            allowExecution: true,
          },
        });
      });

      it('should export logs as JSON', () => {
        const jsonExport = logger.exportLogs({
          format: ShellLogExportFormat.JSON,
        });

        const parsed = JSON.parse(jsonExport);
        expect(parsed.totalLogs).toBe(1);
        expect(parsed.logs[0].command).toBe('test command');
      });

      it('should export logs as CSV', () => {
        const csvExport = logger.exportLogs({
          format: ShellLogExportFormat.CSV,
        });

        const lines = csvExport.split('\n');
        expect(lines[0]).toContain('id,timestamp,command');
        expect(lines[1]).toContain('test command');
      });

      it('should export logs as TEXT', () => {
        const textExport = logger.exportLogs({
          format: ShellLogExportFormat.TEXT,
        });

        expect(textExport).toContain('SUCCESS');
        expect(textExport).toContain('test command');
        expect(textExport).toContain('100ms');
      });

      it('should export logs as HTML', () => {
        const htmlExport = logger.exportLogs({
          format: ShellLogExportFormat.HTML,
        });

        expect(htmlExport).toContain('<!DOCTYPE html>');
        expect(htmlExport).toContain('test command');
        expect(htmlExport).toContain('Shell Execution Log Report');
      });

      it('should export security report', () => {
        const securityReport = logger.exportSecurityReport();
        const parsed = JSON.parse(securityReport);
        expect(parsed.statistics).toBeDefined();
        expect(parsed.logs).toBeDefined();
      });
    });

    describe('Log Management', () => {
      it('should clear all logs', () => {
        logger.logExecution({
          command: 'test',
          workingDirectory: '/test',
          exitCode: 0,
          executionTime: 100,
          success: true,
          userId: 'test-user',
          categoryAssessment: {
            category: CommandCategory.SAFE,
            reason: 'Safe command',
            requiresConfirmation: false,
            allowExecution: true,
          },
        });

        logger.clearLogs();

        const counts = logger.getLogCounts();
        expect(counts.events).toBe(0);
        expect(counts.executions).toBe(0);
      });

      it('should rotate logs when files are too large', () => {
        vi.mocked(fs.statSync).mockReturnValue({ size: 100000000 } as any);
        vi.mocked(fs.existsSync).mockReturnValue(true);

        logger.rotateLogs();

        expect(fs.renameSync).toHaveBeenCalled();
      });

      it('should handle log rotation errors gracefully', () => {
        vi.mocked(fs.statSync).mockImplementation(() => {
          throw new Error('File system error');
        });

        expect(() => logger.rotateLogs()).not.toThrow();
      });
    });
  });

  describe('ShellPerformanceMonitor', () => {
    let monitor: ShellPerformanceMonitor;

    beforeEach(() => {
      monitor = new ShellPerformanceMonitor();
      vi.clearAllMocks();
    });

    afterEach(() => {
      if (monitor.isMonitoring()) {
        monitor.stopMonitoring();
      }
    });

    describe('Monitoring Control', () => {
      it('should start monitoring', () => {
        expect(monitor.isMonitoring()).toBe(false);
        monitor.startMonitoring();
        expect(monitor.isMonitoring()).toBe(true);
      });

      it('should stop monitoring and return metrics', () => {
        monitor.startMonitoring();
        const metrics = monitor.stopMonitoring();
        
        expect(monitor.isMonitoring()).toBe(false);
        expect(metrics).toBeDefined();
        expect(metrics.networkActivity).toBeDefined();
        expect(metrics.fileSystemOperations).toBeDefined();
      });

      it('should not start monitoring if already monitoring', () => {
        monitor.startMonitoring();
        const firstStart = monitor.isMonitoring();
        monitor.startMonitoring(); // Should not restart
        const secondStart = monitor.isMonitoring();
        
        expect(firstStart).toBe(true);
        expect(secondStart).toBe(true);
      });

      it('should return empty metrics when stopping without starting', () => {
        const metrics = monitor.stopMonitoring();
        expect(metrics).toEqual({});
      });
    });

    describe('Performance Snapshots', () => {
      it('should provide performance snapshots', () => {
        monitor.startMonitoring();
        const snapshot = monitor.getSnapshot();
        
        expect(snapshot.networkActivity).toBeDefined();
        expect(snapshot.fileSystemOperations).toBeDefined();
        expect(snapshot.networkActivity.requests).toBe(0);
        expect(snapshot.fileSystemOperations.reads).toBe(0);
      });

      it('should provide snapshots without starting monitoring', () => {
        const snapshot = monitor.getSnapshot();
        expect(snapshot).toBeDefined();
      });
    });

    describe('File Operation Estimation', () => {
      it('should estimate read operations correctly', () => {
        const readCommands = [
          'cat file.txt',
          'head -n 10 file.txt',
          'tail -f log.txt',
          'less document.txt',
          'more readme.txt',
          'grep pattern file.txt',
          'find . -name "*.txt"',
          'ls -la',
          'dir',
        ];

        readCommands.forEach(cmd => {
          const estimate = ShellPerformanceMonitor.estimateFileOperations(cmd, 'output', '');
          expect(estimate.reads).toBeGreaterThan(0);
          expect(estimate.bytesRead).toBeGreaterThan(0);
        });
      });

      it('should estimate write operations correctly', () => {
        const writeCommands = [
          'cp source.txt dest.txt',
          'mv old.txt new.txt',
          'touch newfile.txt',
          'mkdir newdir',
          'echo "content" > file.txt',
          'command > output.txt',
        ];

        writeCommands.forEach(cmd => {
          const estimate = ShellPerformanceMonitor.estimateFileOperations(cmd, '', '');
          expect(estimate.writes).toBeGreaterThan(0);
          expect(estimate.bytesWritten).toBeGreaterThan(0);
        });
      });

      it('should estimate multiple operations for wildcard commands', () => {
        const wildcardCommands = [
          'ls *.txt',
          'cp *.js backup/',
          'find . -name "*.log"',
        ];

        wildcardCommands.forEach(cmd => {
          const estimate = ShellPerformanceMonitor.estimateFileOperations(cmd, 'output', '');
          expect(estimate.reads).toBeGreaterThanOrEqual(10);
        });
      });

      it('should handle commands with no file operations', () => {
        const noOpCommands = [
          'pwd',
          'date',
          'uptime',
          'whoami',
        ];

        noOpCommands.forEach(cmd => {
          const estimate = ShellPerformanceMonitor.estimateFileOperations(cmd, '', '');
          expect(estimate.reads).toBe(0);
          expect(estimate.writes).toBe(0);
        });
      });
    });

    describe('Network Activity Estimation', () => {
      it('should estimate network operations correctly', () => {
        const networkCommands = [
          'curl http://example.com',
          'wget https://file.zip',
          'ping google.com',
          'ssh user@host',
          'scp file.txt user@host:/path',
          'rsync -av src/ dest/',
          'git pull origin main',
          'git push origin main',
          'git clone https://repo.git',
          'git fetch --all',
        ];

        networkCommands.forEach(cmd => {
          const estimate = ShellPerformanceMonitor.estimateNetworkActivity(cmd, 'output', 'error');
          expect(estimate.requests).toBeGreaterThan(0);
          expect(estimate.bytesTransferred).toBeGreaterThan(0);
        });
      });

      it('should estimate multiple requests for parallel operations', () => {
        const parallelCommand = 'curl http://site1.com & curl http://site2.com & curl http://site3.com';
        const estimate = ShellPerformanceMonitor.estimateNetworkActivity(parallelCommand, '', '');
        
        expect(estimate.requests).toBe(3);
      });

      it('should handle commands with no network activity', () => {
        const localCommands = [
          'ls -la',
          'cat file.txt',
          'mkdir test',
          'echo "hello"',
        ];

        localCommands.forEach(cmd => {
          const estimate = ShellPerformanceMonitor.estimateNetworkActivity(cmd, '', '');
          expect(estimate.requests).toBe(0);
          expect(estimate.bytesTransferred).toBe(0);
        });
      });
    });

    describe('Real-time Monitoring', () => {
      it('should collect metrics during monitoring', async () => {
        monitor.startMonitoring();
        
        // Wait for at least one monitoring cycle
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const metrics = monitor.stopMonitoring();
        
        // Should have collected some CPU and memory metrics
        expect(metrics.cpuUsage).toBeDefined();
        expect(metrics.memoryUsage).toBeDefined();
      });

      it('should handle monitoring errors gracefully', async () => {
        // Mock process.cpuUsage to throw an error
        const originalCpuUsage = process.cpuUsage;
        process.cpuUsage = vi.fn(() => {
          throw new Error('CPU monitoring error');
        });

        monitor.startMonitoring();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(() => monitor.stopMonitoring()).not.toThrow();
        
        // Restore original function
        process.cpuUsage = originalCpuUsage;
      });
    });

    describe('Performance Metrics Calculation', () => {
      it('should calculate average metrics correctly', () => {
        monitor.startMonitoring();
        
        // Simulate some monitoring cycles
        const snapshot1 = monitor.getSnapshot();
        expect(snapshot1).toBeDefined();
        
        const metrics = monitor.stopMonitoring();
        expect(metrics.networkActivity).toEqual({ requests: 0, bytesTransferred: 0 });
        expect(metrics.fileSystemOperations).toEqual({ reads: 0, writes: 0, bytesRead: 0, bytesWritten: 0 });
      });

      it('should handle empty metrics arrays', () => {
        const metrics = monitor.stopMonitoring();
        expect(metrics).toEqual({});
      });
    });

    describe('Static Method Testing', () => {
      it('should correctly estimate file operations with output', () => {
        const estimate = ShellPerformanceMonitor.estimateFileOperations(
          'cat large_file.txt',
          'A'.repeat(1000),
          ''
        );
        
        expect(estimate.reads).toBe(1);
        expect(estimate.bytesRead).toBe(1000);
      });

      it('should correctly estimate network activity with output', () => {
        const estimate = ShellPerformanceMonitor.estimateNetworkActivity(
          'curl http://example.com',
          'response data',
          'error message'
        );
        
        expect(estimate.requests).toBe(1);
        expect(estimate.bytesTransferred).toBe(26); // 'response data' + 'error message'
      });
    });
  });

  describe('Integration Tests', () => {
    let logger: ShellExecutionLogger;
    let monitor: ShellPerformanceMonitor;

    beforeEach(() => {
      logger = new ShellExecutionLogger('integration-test');
      monitor = new ShellPerformanceMonitor();
    });

    afterEach(() => {
      if (monitor.isMonitoring()) {
        monitor.stopMonitoring();
      }
    });

    it('should integrate logger and monitor for command execution', () => {
      const command = 'curl http://example.com';
      const stdout = 'response data';
      const stderr = '';

      monitor.startMonitoring();
      
      const fileEstimate = ShellPerformanceMonitor.estimateFileOperations(command, stdout, stderr);
      const networkEstimate = ShellPerformanceMonitor.estimateNetworkActivity(command, stdout, stderr);
      
      const performanceMetrics = monitor.stopMonitoring();
      
      logger.logExecution({
        command,
        workingDirectory: '/test',
        exitCode: 0,
        executionTime: 500,
        success: true,
        stdout,
        stderr,
        userId: 'test-user',
        categoryAssessment: {
          category: CommandCategory.RISKY,
          reason: 'Network operation',
          requiresConfirmation: true,
          allowExecution: true,
        },
        performanceMetrics: {
          ...performanceMetrics,
          fileSystemOperations: fileEstimate,
          networkActivity: networkEstimate,
        },
      });

      const logs = logger.getExecutionLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].performanceMetrics).toBeDefined();
      expect(logs[0].performanceMetrics?.networkActivity?.requests).toBe(1);
    });

    it('should handle combined monitoring and logging operations', () => {
      const commands = [
        'ls -la',
        'cat file.txt',
        'curl http://api.example.com',
        'mkdir test_dir',
      ];

      commands.forEach((command, index) => {
        monitor.startMonitoring();
        
        const performanceMetrics = monitor.stopMonitoring();
        const fileEstimate = ShellPerformanceMonitor.estimateFileOperations(command, 'output', '');
        const networkEstimate = ShellPerformanceMonitor.estimateNetworkActivity(command, 'output', '');

        logger.logExecution({
          command,
          workingDirectory: '/test',
          exitCode: 0,
          executionTime: 100 + index * 50,
          success: true,
          userId: 'test-user',
          categoryAssessment: {
            category: CommandCategory.SAFE,
            reason: 'Test command',
            requiresConfirmation: false,
            allowExecution: true,
          },
          performanceMetrics: {
            ...performanceMetrics,
            fileSystemOperations: fileEstimate,
            networkActivity: networkEstimate,
          },
        });
      });

      const logs = logger.getExecutionLogs();
      const stats = logger.getExecutionStatistics();
      
      expect(logs).toHaveLength(4);
      expect(stats.totalExecutions).toBe(4);
      expect(stats.averageExecutionTime).toBe(175);
    });
  });
});