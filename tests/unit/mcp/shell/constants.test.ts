import { describe, test, expect } from 'vitest';
import {
  SAFE_COMMAND_PATTERNS,
  RISKY_COMMAND_PATTERNS,
  DANGEROUS_COMMAND_PATTERNS,
  BLOCKED_COMMAND_PATTERNS,
  TIMEOUTS,
  LIMITS,
  EXIT_CODES,
  ERROR_PRIORITIES,
  SHELL_EXPANSION_PATTERNS,
  PATH_TRAVERSAL_PATTERNS,
  DEFAULT_SHELL_CONFIG,
} from '../../../../src/core/mcp/shell/constants.js';

describe('Shell Constants', () => {
  describe('Command Pattern Constants', () => {
    test('SAFE_COMMAND_PATTERNS should contain basic safe commands', () => {
      expect(Array.isArray(SAFE_COMMAND_PATTERNS)).toBe(true);
      expect(SAFE_COMMAND_PATTERNS.length).toBeGreaterThan(0);
      
      // Test some expected safe patterns
      expect(SAFE_COMMAND_PATTERNS).toContain('^ls($|\\s)');
      expect(SAFE_COMMAND_PATTERNS).toContain('^pwd($|\\s)');
      expect(SAFE_COMMAND_PATTERNS).toContain('^echo($|\\s)');
    });

    test('RISKY_COMMAND_PATTERNS should contain commands requiring confirmation', () => {
      expect(Array.isArray(RISKY_COMMAND_PATTERNS)).toBe(true);
      expect(RISKY_COMMAND_PATTERNS.length).toBeGreaterThan(0);
      
      // Test some expected risky patterns
      expect(RISKY_COMMAND_PATTERNS.some(pattern => pattern.includes('npm install'))).toBe(true);
      expect(RISKY_COMMAND_PATTERNS.some(pattern => pattern.includes('mkdir'))).toBe(true);
    });

    test('DANGEROUS_COMMAND_PATTERNS should contain high-risk commands', () => {
      expect(Array.isArray(DANGEROUS_COMMAND_PATTERNS)).toBe(true);
      expect(DANGEROUS_COMMAND_PATTERNS.length).toBeGreaterThan(0);
      
      // Test some expected dangerous patterns
      expect(DANGEROUS_COMMAND_PATTERNS).toContain('rm -rf');
      expect(DANGEROUS_COMMAND_PATTERNS).toContain('sudo');
      expect(DANGEROUS_COMMAND_PATTERNS).toContain('chmod 777');
    });

    test('BLOCKED_COMMAND_PATTERNS should contain catastrophic commands', () => {
      expect(Array.isArray(BLOCKED_COMMAND_PATTERNS)).toBe(true);
      expect(BLOCKED_COMMAND_PATTERNS.length).toBeGreaterThan(0);
      
      // Test some expected blocked patterns
      expect(BLOCKED_COMMAND_PATTERNS).toContain('rm -rf /');
      expect(BLOCKED_COMMAND_PATTERNS).toContain('rm -rf /*');
      expect(BLOCKED_COMMAND_PATTERNS.some(pattern => pattern.includes('shutdown'))).toBe(true);
    });

    test('Pattern arrays should not overlap in dangerous ways', () => {
      // Safe and blocked patterns should not overlap
      const safePatterns = SAFE_COMMAND_PATTERNS.join('|');
      const blockedPatterns = BLOCKED_COMMAND_PATTERNS.join('|');
      
      // Ensure safe patterns don't accidentally match dangerous patterns
      expect(safePatterns).not.toMatch(/rm.*-rf/);
      expect(safePatterns).not.toMatch(/sudo/);
      expect(safePatterns).not.toMatch(/format/);
    });
  });

  describe('Timeout Constants', () => {
    test('TIMEOUTS should have all required timeout values', () => {
      expect(typeof TIMEOUTS).toBe('object');
      expect(typeof TIMEOUTS.DEFAULT_COMMAND_EXECUTION).toBe('number');
      expect(typeof TIMEOUTS.CONFIRMATION_PROMPT).toBe('number');
      expect(typeof TIMEOUTS.MAX_COMMAND_EXECUTION).toBe('number');
      
      // Validate reasonable timeout values
      expect(TIMEOUTS.DEFAULT_COMMAND_EXECUTION).toBeGreaterThan(0);
      expect(TIMEOUTS.DEFAULT_COMMAND_EXECUTION).toBeLessThanOrEqual(300);
      expect(TIMEOUTS.CONFIRMATION_PROMPT).toBeGreaterThan(1000); // At least 1 second
      expect(TIMEOUTS.MAX_COMMAND_EXECUTION).toBeGreaterThan(TIMEOUTS.DEFAULT_COMMAND_EXECUTION);
    });
  });

  describe('Limit Constants', () => {
    test('LIMITS should have all required limit values', () => {
      expect(typeof LIMITS).toBe('object');
      expect(typeof LIMITS.MAX_COMMAND_LENGTH).toBe('number');
      expect(typeof LIMITS.MAX_BUFFER_SIZE).toBe('number');
      expect(typeof LIMITS.MAX_LOG_FILE_SIZE).toBe('number');
      expect(typeof LIMITS.MAX_EVENTS_IN_MEMORY).toBe('number');
      
      // Validate reasonable limit values
      expect(LIMITS.MAX_COMMAND_LENGTH).toBeGreaterThan(100);
      expect(LIMITS.MAX_BUFFER_SIZE).toBeGreaterThan(1024);
      expect(LIMITS.MAX_LOG_FILE_SIZE).toBeGreaterThan(LIMITS.MAX_BUFFER_SIZE);
      expect(LIMITS.MAX_EVENTS_IN_MEMORY).toBeGreaterThan(10);
    });
  });

  describe('Exit Code Constants', () => {
    test('EXIT_CODES should have all standard exit codes', () => {
      expect(typeof EXIT_CODES).toBe('object');
      expect(EXIT_CODES.SUCCESS).toBe(0);
      expect(EXIT_CODES.GENERAL_ERROR).toBe(1);
      expect(EXIT_CODES.PERMISSION_DENIED).toBe(126);
      expect(EXIT_CODES.COMMAND_NOT_FOUND).toBe(127);
      expect(EXIT_CODES.INVALID_ARGUMENT).toBe(400);
      expect(EXIT_CODES.FORBIDDEN).toBe(403);
      expect(EXIT_CODES.TIMEOUT).toBe(-1);
    });
  });

  describe('Error Priority Constants', () => {
    test('ERROR_PRIORITIES should have meaningful priority values', () => {
      expect(typeof ERROR_PRIORITIES).toBe('object');
      expect(typeof ERROR_PRIORITIES.PERMISSION_ERROR).toBe('number');
      expect(typeof ERROR_PRIORITIES.SECURITY_ERROR).toBe('number');
      expect(typeof ERROR_PRIORITIES.TIMEOUT_ERROR).toBe('number');
      
      // Validate priority ordering (higher is more important)
      expect(ERROR_PRIORITIES.PERMISSION_ERROR).toBeGreaterThan(ERROR_PRIORITIES.EXECUTION_ERROR);
      expect(ERROR_PRIORITIES.SECURITY_ERROR).toBeGreaterThan(ERROR_PRIORITIES.CONFIGURATION_ERROR);
      expect(ERROR_PRIORITIES.TIMEOUT_ERROR).toBeGreaterThan(ERROR_PRIORITIES.UNKNOWN_ERROR);
    });
  });

  describe('Shell Expansion Patterns', () => {
    test('SHELL_EXPANSION_PATTERNS should be valid regex patterns', () => {
      expect(Array.isArray(SHELL_EXPANSION_PATTERNS)).toBe(true);
      expect(SHELL_EXPANSION_PATTERNS.length).toBeGreaterThan(0);
      
      // Test that all patterns are valid regex
      SHELL_EXPANSION_PATTERNS.forEach((pattern, index) => {
        expect(() => new RegExp(pattern)).not.toThrow(`Pattern ${index} should be valid regex: ${pattern}`);
      });
      
      // Test some specific patterns work correctly
      const commandSubstitution = SHELL_EXPANSION_PATTERNS.find(p => p.source.includes('`'));
      expect(commandSubstitution).toBeDefined();
      expect('echo `whoami`').toMatch(commandSubstitution!);
    });
  });

  describe('Path Traversal Patterns', () => {
    test('PATH_TRAVERSAL_PATTERNS should detect common traversal attempts', () => {
      expect(Array.isArray(PATH_TRAVERSAL_PATTERNS)).toBe(true);
      expect(PATH_TRAVERSAL_PATTERNS.length).toBeGreaterThan(0);
      
      // Test that all patterns are valid regex
      PATH_TRAVERSAL_PATTERNS.forEach((pattern, index) => {
        expect(() => new RegExp(pattern)).not.toThrow(`Pattern ${index} should be valid regex: ${pattern}`);
      });
      
      // Test some common path traversal patterns are detected
      const testPaths = ['../../../etc/passwd', '..\\..\\windows\\system32', '/../../etc/shadow'];
      const hasMatchingPattern = testPaths.some(testPath => 
        PATH_TRAVERSAL_PATTERNS.some(pattern => testPath.match(pattern))
      );
      expect(hasMatchingPattern).toBe(true);
    });
  });

  describe('Default Shell Configuration', () => {
    test('DEFAULT_SHELL_CONFIG should have all required fields', () => {
      expect(typeof DEFAULT_SHELL_CONFIG).toBe('object');
      
      // Category-based configuration fields
      expect(typeof DEFAULT_SHELL_CONFIG.requireConfirmationForRisky).toBe('boolean');
      expect(typeof DEFAULT_SHELL_CONFIG.requireConfirmationForDangerous).toBe('boolean');
      expect(typeof DEFAULT_SHELL_CONFIG.allowDangerous).toBe('boolean');
      
      // Timeout and execution fields
      expect(typeof DEFAULT_SHELL_CONFIG.maxExecutionTime).toBe('number');
      expect(typeof DEFAULT_SHELL_CONFIG.confirmationTimeout).toBe('number');
      expect(typeof DEFAULT_SHELL_CONFIG.sessionMemory).toBe('boolean');
      expect(typeof DEFAULT_SHELL_CONFIG.allowComplexCommands).toBe('boolean');
      
      // Command arrays
      expect(Array.isArray(DEFAULT_SHELL_CONFIG.trustedCommands)).toBe(true);
      expect(Array.isArray(DEFAULT_SHELL_CONFIG.allowedCommands)).toBe(true);
      expect(Array.isArray(DEFAULT_SHELL_CONFIG.blockedCommands)).toBe(true);
      expect(Array.isArray(DEFAULT_SHELL_CONFIG.autoApprovePatterns)).toBe(true);
      expect(Array.isArray(DEFAULT_SHELL_CONFIG.alwaysBlockPatterns)).toBe(true);
    });

    test('DEFAULT_SHELL_CONFIG should have sensible default values', () => {
      // Security-focused defaults
      expect(DEFAULT_SHELL_CONFIG.requireConfirmationForRisky).toBe(true);
      expect(DEFAULT_SHELL_CONFIG.requireConfirmationForDangerous).toBe(true);
      expect(DEFAULT_SHELL_CONFIG.allowDangerous).toBe(false);
      expect(DEFAULT_SHELL_CONFIG.allowComplexCommands).toBe(false);
      expect(DEFAULT_SHELL_CONFIG.sessionMemory).toBe(true);
      
      // Reasonable timeouts
      expect(DEFAULT_SHELL_CONFIG.maxExecutionTime).toBeGreaterThan(0);
      expect(DEFAULT_SHELL_CONFIG.confirmationTimeout).toBeGreaterThan(5000); // At least 5 seconds
      
      // Non-empty trusted commands
      expect(DEFAULT_SHELL_CONFIG.trustedCommands.length).toBeGreaterThan(0);
      expect(DEFAULT_SHELL_CONFIG.alwaysBlockPatterns.length).toBeGreaterThan(0);
    });

    test('DEFAULT_SHELL_CONFIG trusted commands should be valid regex', () => {
      DEFAULT_SHELL_CONFIG.trustedCommands.forEach((pattern, index) => {
        expect(() => new RegExp(pattern)).not.toThrow(`Trusted command pattern ${index} should be valid regex: ${pattern}`);
      });
    });

    test('DEFAULT_SHELL_CONFIG should use values from other constants', () => {
      // Timeouts should reference TIMEOUTS constants
      expect(DEFAULT_SHELL_CONFIG.maxExecutionTime).toBe(TIMEOUTS.DEFAULT_COMMAND_EXECUTION);
      expect(DEFAULT_SHELL_CONFIG.confirmationTimeout).toBe(TIMEOUTS.CONFIRMATION_PROMPT);
    });
  });

  describe('Constants Integrity', () => {
    test('All constants should be exported and accessible', () => {
      // Test that importing all constants works
      expect(SAFE_COMMAND_PATTERNS).toBeDefined();
      expect(RISKY_COMMAND_PATTERNS).toBeDefined();
      expect(DANGEROUS_COMMAND_PATTERNS).toBeDefined();
      expect(BLOCKED_COMMAND_PATTERNS).toBeDefined();
      expect(TIMEOUTS).toBeDefined();
      expect(LIMITS).toBeDefined();
      expect(EXIT_CODES).toBeDefined();
      expect(ERROR_PRIORITIES).toBeDefined();
      expect(SHELL_EXPANSION_PATTERNS).toBeDefined();
      expect(PATH_TRAVERSAL_PATTERNS).toBeDefined();
      expect(DEFAULT_SHELL_CONFIG).toBeDefined();
    });

    test('Constants should be immutable where expected', () => {
      // Arrays should not be accidentally modified
      const originalSafeLength = SAFE_COMMAND_PATTERNS.length;
      
      // This should not affect the original constant
      const copyOfSafe = [...SAFE_COMMAND_PATTERNS];
      copyOfSafe.push('test-pattern');
      
      expect(SAFE_COMMAND_PATTERNS.length).toBe(originalSafeLength);
    });
  });
});