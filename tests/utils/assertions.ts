import { expect } from 'vitest';
import type { ExtendedProviderConfig } from '@/core/config/manager';

/**
 * Custom assertion helpers for testing
 */

/**
 * Assert that a configuration is valid
 */
export function assertValidConfig(
  config: any
): asserts config is ExtendedProviderConfig {
  expect(config).toBeTruthy();
  expect(config).toBeTypeOf('object');
  expect(config.type).toBeTruthy();
  expect(config.model).toBeTruthy();

  // Provider-specific validations
  switch (config.type) {
    case 'ollama':
      expect(config.baseUrl).toBeTruthy();
      expect(config.baseUrl).toMatch(/^https?:\/\//);
      break;

    case 'openai':
    case 'anthropic':
      if (config.apiKey) {
        expect(config.apiKey).toMatch(/^sk-/);
      }
      break;

    case 'azure':
      expect(config.baseUrl).toBeTruthy();
      expect(config.baseUrl).toMatch(/\.openai\.azure\.com/);
      break;

    case 'gemini':
      if (config.apiKey) {
        expect(config.apiKey).toMatch(/^AIza/);
      }
      break;
  }
}

/**
 * Assert that a provider response has the expected structure
 */
export function assertValidProviderResponse(response: any) {
  expect(response).toBeTruthy();
  expect(response).toBeTypeOf('object');
  expect(response.content).toBeTruthy();
  expect(response.content).toBeTypeOf('string');

  if (response.usage) {
    expect(response.usage).toBeTypeOf('object');
    expect(response.usage.promptTokens || response.usage.input).toBeTypeOf(
      'number'
    );
    expect(response.usage.completionTokens || response.usage.output).toBeTypeOf(
      'number'
    );
  }
}

/**
 * Assert that a streaming response chunk is valid
 */
export function assertValidStreamChunk(chunk: any) {
  expect(chunk).toBeTruthy();
  expect(chunk).toBeTypeOf('object');

  // Chunk should have either content or be a control chunk
  if (chunk.content !== undefined) {
    expect(chunk.content).toBeTypeOf('string');
  }

  // Check for control chunks (start, end, error)
  if (chunk.type) {
    expect(['start', 'content', 'end', 'error']).toContain(chunk.type);
  }
}

/**
 * Assert that token usage is valid
 */
export function assertValidTokenUsage(usage: any) {
  expect(usage).toBeTruthy();
  expect(usage).toBeTypeOf('object');

  // Should have input/output or prompt/completion tokens
  const hasInputOutput =
    typeof usage.input === 'number' && typeof usage.output === 'number';
  const hasPromptCompletion =
    typeof usage.promptTokens === 'number' &&
    typeof usage.completionTokens === 'number';

  expect(hasInputOutput || hasPromptCompletion).toBe(true);

  if (hasInputOutput) {
    expect(usage.input).toBeGreaterThanOrEqual(0);
    expect(usage.output).toBeGreaterThanOrEqual(0);
  }

  if (hasPromptCompletion) {
    expect(usage.promptTokens).toBeGreaterThanOrEqual(0);
    expect(usage.completionTokens).toBeGreaterThanOrEqual(0);
  }
}

/**
 * Assert that an error has the expected structure
 */
export function assertValidError(error: any, expectedType?: string) {
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBeTruthy();
  expect(error.message).toBeTypeOf('string');

  if (expectedType) {
    expect(error.constructor.name).toBe(expectedType);
  }
}

/**
 * Assert that a file operation result is valid
 */
export function assertValidFileOperation(result: any) {
  expect(result).toBeTruthy();
  expect(result).toBeTypeOf('object');
  expect(result.success).toBeTypeOf('boolean');

  if (!result.success) {
    expect(result.error).toBeTruthy();
    expect(result.error).toBeTypeOf('string');
  }
}

/**
 * Assert that a workspace path is safe
 */
export function assertSafeWorkspacePath(path: string, workspaceRoot: string) {
  expect(path).toBeTruthy();
  expect(path).toBeTypeOf('string');

  // Path should not contain directory traversal attempts
  expect(path).not.toMatch(/\.\.\//);
  expect(path).not.toMatch(/\.\.\\/);

  // Path should be within workspace (absolute path check)
  const pathModule = require('path');

  const resolvedPath = pathModule.resolve(path);
  const resolvedWorkspace = pathModule.resolve(workspaceRoot);

  expect(resolvedPath.startsWith(resolvedWorkspace)).toBe(true);
}

/**
 * Assert that capabilities match expected values
 */
export function assertCapabilities(
  capabilities: any,
  expected: Partial<ExtendedProviderConfig['capabilities']>
) {
  expect(capabilities).toBeTruthy();
  expect(capabilities).toBeTypeOf('object');

  for (const [key, value] of Object.entries(expected)) {
    expect(capabilities[key]).toBe(value);
  }
}

/**
 * Assert that a chat session is valid
 */
export function assertValidChatSession(session: any) {
  expect(session).toBeTruthy();
  expect(session).toBeTypeOf('object');
  expect(session.id).toBeTruthy();
  expect(session.messages).toBeInstanceOf(Array);
  expect(session.provider).toBeTruthy();
  expect(session.model).toBeTruthy();

  // Check message structure
  session.messages.forEach((message: any) => {
    expect(message.role).toMatch(/^(user|assistant|system)$/);
    expect(message.content).toBeTypeOf('string');
    expect(message.timestamp).toBeTruthy();
  });
}

/**
 * Time-bounded assertion for async operations
 */
// Note: Timing-based assertions disabled to avoid flaky tests
/*
export async function assertWithinTime<T>(
  operation: () => Promise<T>,
  maxTimeMs: number,
  errorMessage?: string
): Promise<T> {
  const start = Date.now();
  const result = await operation();
  const elapsed = Date.now() - start;

  expect(elapsed).toBeLessThanOrEqual(maxTimeMs);

  return result;
}
*/

/**
 * Assert that two configurations are equivalent
 */
export function assertConfigsEqual(actual: any, expected: any) {
  expect(actual.type).toBe(expected.type);
  expect(actual.model).toBe(expected.model);

  if (expected.baseUrl) {
    expect(actual.baseUrl).toBe(expected.baseUrl);
  }

  if (expected.apiKey) {
    expect(actual.apiKey).toBe(expected.apiKey);
  }

  if (expected.capabilities) {
    assertCapabilities(actual.capabilities, expected.capabilities);
  }
}
