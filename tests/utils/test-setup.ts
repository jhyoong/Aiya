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

// Environment variable isolation for consistent test environment
const originalEnv = { ...process.env };

// Store all AIYA-related environment variables for cleanup
const AIYA_ENV_VARS = [
  'AIYA_SHELL_CONFIRMATION_THRESHOLD',
  'AIYA_SHELL_CONFIRMATION_TIMEOUT', 
  'AIYA_SHELL_SESSION_MEMORY',
  'AIYA_SHELL_REQUIRE_CONFIRMATION',
  'AIYA_SHELL_ALLOW_COMPLEX_COMMANDS',
  'AIYA_SHELL_MAX_EXECUTION_TIME',
  'AIYA_SHELL_TRUSTED_COMMANDS',
  'AIYA_SHELL_ALWAYS_BLOCK_PATTERNS',
  'AIYA_API_KEY',
  'AIYA_MODEL',
  'AIYA_BASE_URL',
  'AIYA_STREAMING',
] as const;

/**
 * Clear all AIYA-related environment variables to ensure test isolation
 */
function clearAiyaEnvironmentVariables(): void {
  AIYA_ENV_VARS.forEach(varName => {
    delete process.env[varName];
  });
}

/**
 * Set test environment variables with validation
 */
function setTestEnvironmentVariables(vars: Record<string, string>): void {
  Object.entries(vars).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

/**
 * Validate that environment is clean for testing
 */
function validateCleanEnvironment(): void {
  const contamination = AIYA_ENV_VARS.filter(varName => 
    process.env[varName] !== undefined
  );
  
  if (contamination.length > 0) {
    console.warn(
      `[TEST SETUP] Environment contamination detected: ${contamination.join(', ')}`
    );
  }
}

beforeEach(() => {
  // Clear all AIYA environment variables to prevent external contamination
  clearAiyaEnvironmentVariables();
  
  // Validate environment is clean
  validateCleanEnvironment();

  // Clear all mocks
  vi.clearAllMocks();
});

afterEach(() => {
  // Clear any environment variables set during the test
  clearAiyaEnvironmentVariables();
  
  // Restore only the original AIYA environment variables that existed before tests
  AIYA_ENV_VARS.forEach(varName => {
    if (originalEnv[varName] !== undefined) {
      process.env[varName] = originalEnv[varName];
    }
  });
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

// Export environment utilities for use in tests
export { 
  clearAiyaEnvironmentVariables, 
  setTestEnvironmentVariables, 
  validateCleanEnvironment 
};

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
  } catch (error) {
    // Ignore cleanup errors
  }
};
