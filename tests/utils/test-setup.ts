import '@testing-library/jest-dom';
import { vi, expect } from 'vitest';

// Global test setup and configuration

// Mock console methods to reduce noise in tests unless explicitly needed
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock process.env for consistent test environment
const originalEnv = process.env;

beforeEach(() => {
  // Reset environment variables before each test
  process.env = { ...originalEnv };

  // Clear all mocks
  vi.clearAllMocks();
});

afterEach(() => {
  // Restore original environment
  process.env = originalEnv;
});

// Global test utilities - extending Vitest's expect interface
interface CustomMatchers<R = unknown> {
  toBeValidConfig(): R;
  toHaveProvider(provider: string): R;
  toMatchTokenCount(expected: { input: number; output: number }): R;
}

declare global {
  namespace Vi {
    interface Assertion<T = any> extends CustomMatchers<T> {}
    interface AsymmetricMatchersContaining extends CustomMatchers {}
  }
}

// Custom matchers for testing
expect.extend({
  toBeValidConfig(received: any) {
    const isValid =
      received &&
      typeof received === 'object' &&
      received.type &&
      received.model;

    return {
      message: () =>
        `Expected ${JSON.stringify(received)} to be a valid configuration`,
      pass: isValid,
    };
  },

  toHaveProvider(received: any, provider: string) {
    const hasProvider = received?.type === provider;

    return {
      message: () =>
        `Expected configuration to have provider ${provider}, got ${received?.type}`,
      pass: hasProvider,
    };
  },

  toMatchTokenCount(
    received: any,
    expected: { input: number; output: number }
  ) {
    const hasValidTokens =
      received &&
      typeof received.input === 'number' &&
      typeof received.output === 'number' &&
      received.input === expected.input &&
      received.output === expected.output;

    return {
      message: () =>
        `Expected token count to match ${JSON.stringify(expected)}`,
      pass: hasValidTokens,
    };
  },
});

// Test environment configuration
export const TEST_CONFIG = {
  timeout: {
    unit: 5000, // 5 seconds for unit tests
    integration: 15000, // 15 seconds for integration tests
    e2e: 30000, // 30 seconds for e2e tests
  },
  providers: {
    mock: {
      latency: 100, // Mock provider response latency
      errorRate: 0, // Default error rate for mocks
    },
  },
  directories: {
    fixtures: './tests/fixtures',
    mocks: './tests/mocks',
    temp: './tests/temp',
  },
};

// Cleanup function for tests that create temporary files
export const cleanupTestFiles = async () => {
  const fs = await import('fs/promises');
  const path = await import('path');

  try {
    const tempDir = path.resolve(TEST_CONFIG.directories.temp);
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (_error) {
    // Ignore cleanup errors
  }
};
