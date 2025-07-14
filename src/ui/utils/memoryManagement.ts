/**
 * Memory management utilities for preventing memory leaks and managing resources
 */

// Default configuration constants
export const MEMORY_LIMITS = {
  MAX_MESSAGE_HISTORY: 10000, // Increased from 100 to allow much longer chat history
  MAX_STREAMING_CONTENT_SIZE: 500 * 1024, // Increased from 50KB to 500KB for longer content
  MAX_TIMEOUT_POOL_SIZE: 10,
  CLEANUP_INTERVAL_MS: 30000, // 30 seconds
} as const;

// Timeout management utilities
export class TimeoutManager {
  private timeouts = new Set<NodeJS.Timeout>();
  private maxSize: number;

  constructor(maxSize = MEMORY_LIMITS.MAX_TIMEOUT_POOL_SIZE) {
    this.maxSize = maxSize;
  }

  create(callback: () => void, delay: number): NodeJS.Timeout {
    // Clear oldest timeout if we're at capacity
    if (this.timeouts.size >= this.maxSize) {
      const oldest = this.timeouts.values().next().value;
      if (oldest) {
        this.clear(oldest);
      }
    }

    const timeout = setTimeout(() => {
      this.timeouts.delete(timeout);
      callback();
    }, delay);

    this.timeouts.add(timeout);
    return timeout;
  }

  clear(timeout: NodeJS.Timeout): void {
    if (this.timeouts.has(timeout)) {
      clearTimeout(timeout);
      this.timeouts.delete(timeout);
    }
  }

  clearAll(): void {
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();
  }

  getActiveCount(): number {
    return this.timeouts.size;
  }
}

// Memory usage monitoring
export class MemoryMonitor {
  private static instance: MemoryMonitor | null = null;
  private listeners = new Set<(usage: NodeJS.MemoryUsage) => void>();
  private monitoringInterval: NodeJS.Timeout | null = null;

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  startMonitoring(intervalMs = MEMORY_LIMITS.CLEANUP_INTERVAL_MS): void {
    if (this.monitoringInterval) return;

    this.monitoringInterval = setInterval(() => {
      const usage = process.memoryUsage();
      this.listeners.forEach(listener => {
        try {
          listener(usage);
        } catch (error) {
          console.warn('[MemoryMonitor] Listener error:', error);
        }
      });
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  addListener(listener: (usage: NodeJS.MemoryUsage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getCurrentUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }
}

// Bounded array that automatically removes old entries
export class BoundedArray<T> {
  private items: T[] = [];
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = Math.max(1, maxSize);
  }

  push(item: T): void {
    this.items.push(item);
    while (this.items.length > this.maxSize) {
      this.items.shift();
    }
  }

  getAll(): readonly T[] {
    return this.items;
  }

  getLast(count: number): readonly T[] {
    return this.items.slice(-count);
  }

  clear(): void {
    this.items = [];
  }

  get length(): number {
    return this.items.length;
  }

  get isFull(): boolean {
    return this.items.length >= this.maxSize;
  }
}

// Content size limiter for streaming content
export class ContentSizeLimiter {
  private content: string = '';
  private readonly maxSize: number;

  constructor(maxSize = MEMORY_LIMITS.MAX_STREAMING_CONTENT_SIZE) {
    this.maxSize = maxSize;
  }

  append(chunk: string): void {
    this.content += chunk;
    if (this.content.length > this.maxSize) {
      // Keep the last part of the content, with some buffer
      const keepSize = Math.floor(this.maxSize * 0.8);
      this.content = '...' + this.content.slice(-keepSize);
    }
  }

  getContent(): string {
    return this.content;
  }

  clear(): void {
    this.content = '';
  }

  get size(): number {
    return this.content.length;
  }

  get isNearLimit(): boolean {
    return this.content.length > this.maxSize * 0.9;
  }
}

// Subscription manager for handling async subscriptions
export class SubscriptionManager {
  private subscriptions = new Set<() => void>();

  add(unsubscribe: () => void): void {
    this.subscriptions.add(unsubscribe);
  }

  remove(unsubscribe: () => void): void {
    this.subscriptions.delete(unsubscribe);
  }

  unsubscribeAll(): void {
    this.subscriptions.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('[SubscriptionManager] Unsubscribe error:', error);
      }
    });
    this.subscriptions.clear();
  }

  get count(): number {
    return this.subscriptions.size;
  }
}

// Resource cleanup helper
export class ResourceCleanup {
  private cleanupTasks = new Set<() => void>();

  addTask(cleanup: () => void): void {
    this.cleanupTasks.add(cleanup);
  }

  removeTask(cleanup: () => void): void {
    this.cleanupTasks.delete(cleanup);
  }

  cleanup(): void {
    this.cleanupTasks.forEach(task => {
      try {
        task();
      } catch (error) {
        console.warn('[ResourceCleanup] Cleanup task error:', error);
      }
    });
    this.cleanupTasks.clear();
  }

  get taskCount(): number {
    return this.cleanupTasks.size;
  }
}

// Utility function to create a cleanup function that runs multiple cleanups
export function createCleanupFunction(
  ...cleanupFns: (() => void)[]
): () => void {
  return () => {
    cleanupFns.forEach(fn => {
      try {
        fn();
      } catch (error) {
        console.warn('[Cleanup] Error during cleanup:', error);
      }
    });
  };
}

// Memory leak detection utility (development mode)
export function detectMemoryLeaks(thresholdMB = 100): () => void {
  const initialUsage = process.memoryUsage();
  let checkCount = 0;

  const check = () => {
    checkCount++;
    const currentUsage = process.memoryUsage();
    const heapUsedMB = currentUsage.heapUsed / 1024 / 1024;
    const initialHeapUsedMB = initialUsage.heapUsed / 1024 / 1024;
    const growth = heapUsedMB - initialHeapUsedMB;

    if (growth > thresholdMB && checkCount > 10) {
      console.warn(
        `[MemoryLeak] Potential memory leak detected: ` +
          `${growth.toFixed(2)}MB growth (threshold: ${thresholdMB}MB)`
      );
      console.warn('Current usage:', {
        heapUsed: `${heapUsedMB.toFixed(2)}MB`,
        heapTotal: `${(currentUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
        external: `${(currentUsage.external / 1024 / 1024).toFixed(2)}MB`,
      });
    }
  };

  const interval = setInterval(check, 30000); // Check every 30 seconds
  return () => clearInterval(interval);
}
