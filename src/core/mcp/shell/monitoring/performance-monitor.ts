/**
 * Shell Performance Monitor
 * 
 * Monitors performance metrics during shell command execution including
 * CPU usage, memory usage, and estimates for file system and network operations.
 */

import { LIMITS } from '../constants.js';

/**
 * Performance metrics collected during monitoring
 */
export interface PerformanceMetrics {
  /** Average CPU usage percentage */
  cpuUsage?: number;
  
  /** Average memory usage in bytes */
  memoryUsage?: number;
  
  /** Network activity metrics */
  networkActivity?: {
    requests: number;
    bytesTransferred: number;
  };
  
  /** File system operation metrics */
  fileSystemOperations?: {
    reads: number;
    writes: number;
    bytesRead: number;
    bytesWritten: number;
  };
}

/**
 * Complete performance snapshot with all collected metrics
 */
export interface PerformanceSnapshot {
  /** Average CPU usage percentage */
  cpuUsage?: number;
  
  /** Average memory usage in bytes */
  memoryUsage?: number;
  
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
 * File operation estimation result
 */
export interface FileOperationEstimate {
  reads: number;
  writes: number;
  bytesRead: number;
  bytesWritten: number;
}

/**
 * Network activity estimation result
 */
export interface NetworkActivityEstimate {
  requests: number;
  bytesTransferred: number;
}

/**
 * Internal metrics storage structure
 */
interface InternalMetrics {
  cpuUsage: number[];
  memoryUsage: number[];
  networkActivity: {
    requests: number;
    bytesTransferred: number;
  };
  fileSystemOperations: {
    reads: number;
    writes: number;
    bytesRead: number;
    bytesWritten: number;
  };
}

/**
 * Monitors shell command performance metrics
 */
export class ShellPerformanceMonitor {
  private monitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | undefined;
  private metrics: InternalMetrics;

  constructor() {
    this.metrics = {
      cpuUsage: [],
      memoryUsage: [],
      networkActivity: {
        requests: 0,
        bytesTransferred: 0,
      },
      fileSystemOperations: {
        reads: 0,
        writes: 0,
        bytesRead: 0,
        bytesWritten: 0,
      },
    };
  }

  /**
   * Start monitoring performance metrics
   */
  startMonitoring(): void {
    if (this.monitoring) {
      return;
    }

    this.monitoring = true;
    this.resetMetrics();

    // Start periodic monitoring using configured interval
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, LIMITS.MONITOR_INTERVAL_MS);
  }

  /**
   * Stop monitoring and return collected metrics
   */
  stopMonitoring(): PerformanceMetrics {
    if (!this.monitoring) {
      return {};
    }

    this.monitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    // Calculate averages and return final metrics
    const avgCpuUsage = this.calculateAverage(this.metrics.cpuUsage);
    const avgMemoryUsage = this.calculateAverage(this.metrics.memoryUsage);

    const result: PerformanceMetrics = {};

    if (avgCpuUsage !== undefined) {
      result.cpuUsage = avgCpuUsage;
    }
    if (avgMemoryUsage !== undefined) {
      result.memoryUsage = avgMemoryUsage;
    }
    
    result.networkActivity = { ...this.metrics.networkActivity };
    result.fileSystemOperations = { ...this.metrics.fileSystemOperations };

    return result;
  }

  /**
   * Get current performance snapshot without stopping monitoring
   */
  getSnapshot(): PerformanceSnapshot {
    const avgCpuUsage = this.calculateAverage(this.metrics.cpuUsage);
    const avgMemoryUsage = this.calculateAverage(this.metrics.memoryUsage);

    const result: PerformanceSnapshot = {
      networkActivity: { ...this.metrics.networkActivity },
      fileSystemOperations: { ...this.metrics.fileSystemOperations },
    };

    if (avgCpuUsage !== undefined) {
      result.cpuUsage = avgCpuUsage;
    }
    if (avgMemoryUsage !== undefined) {
      result.memoryUsage = avgMemoryUsage;
    }

    return result;
  }

  /**
   * Check if currently monitoring
   */
  isMonitoring(): boolean {
    return this.monitoring;
  }

  /**
   * Estimate file system operations from command content and output
   */
  static estimateFileOperations(
    command: string,
    stdout: string,
    _stderr: string
  ): FileOperationEstimate {
    let reads = 0;
    let writes = 0;
    let bytesRead = 0;
    let bytesWritten = 0;

    const lowerCommand = command.toLowerCase();

    // Read operations
    if (lowerCommand.match(/^(cat|head|tail|less|more|grep|find|ls|dir)\s/)) {
      reads = 1;
      bytesRead = stdout.length; // Approximate based on output
    }

    // Write operations
    if (lowerCommand.match(/^(cp|mv|touch|mkdir|echo.*>|.*>\s)/)) {
      writes = 1;
      bytesWritten = command.length; // Very rough estimate
    }

    // Multiple file operations (wildcards likely touch multiple files)
    if (lowerCommand.includes('*') || lowerCommand.includes('?')) {
      reads = Math.max(reads, 10);
      writes = Math.max(writes, 5);
    }

    return {
      reads,
      writes,
      bytesRead,
      bytesWritten,
    };
  }

  /**
   * Estimate network activity from command content and output
   */
  static estimateNetworkActivity(
    command: string,
    stdout: string,
    stderr: string
  ): NetworkActivityEstimate {
    let requests = 0;
    let bytesTransferred = 0;

    const lowerCommand = command.toLowerCase();

    // Network commands
    if (
      lowerCommand.match(
        /^(curl|wget|ping|ssh|scp|rsync|git\s+(pull|push|clone|fetch))\s/
      )
    ) {
      requests = 1;
      bytesTransferred = stdout.length + stderr.length; // Rough estimate
    }

    // Multiple network operations (parallel curl commands)
    if (lowerCommand.includes('curl') && lowerCommand.includes('&')) {
      requests = (lowerCommand.match(/curl/g) || []).length;
    }

    return {
      requests,
      bytesTransferred,
    };
  }

  /**
   * Reset all metrics to initial state
   */
  private resetMetrics(): void {
    this.metrics.cpuUsage = [];
    this.metrics.memoryUsage = [];
    this.metrics.networkActivity = {
      requests: 0,
      bytesTransferred: 0,
    };
    this.metrics.fileSystemOperations = {
      reads: 0,
      writes: 0,
      bytesRead: 0,
      bytesWritten: 0,
    };
  }

  /**
   * Collect current system metrics
   */
  private collectMetrics(): void {
    try {
      // Collect CPU usage
      const cpuUsage = process.cpuUsage();
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to milliseconds
      this.metrics.cpuUsage.push(cpuPercent);

      // Collect memory usage
      const memoryUsage = process.memoryUsage();
      this.metrics.memoryUsage.push(memoryUsage.heapUsed);

      // Note: Network and file system metrics are estimated from command analysis
      // rather than real-time monitoring due to complexity of cross-platform monitoring
    } catch (error) {
      // Silent fail - performance monitoring shouldn't break execution
    }
  }

  /**
   * Calculate average of an array of numbers
   */
  private calculateAverage(values: number[]): number | undefined {
    if (values.length === 0) {
      return undefined;
    }
    
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }
}