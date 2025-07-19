import { describe, test, expect, beforeEach } from 'vitest';
import {
  ToolMemoryService,
  ToolPreference,
} from '../../../src/core/tools/memory.js';

describe('ToolMemoryService', () => {
  let memoryService: ToolMemoryService;

  beforeEach(() => {
    memoryService = new ToolMemoryService();
  });

  describe('Basic Functionality', () => {
    test('should start with empty preferences', () => {
      expect(memoryService.hasPreference('any-tool')).toBe(false);
      expect(memoryService.getPreference('any-tool')).toBeNull();
      expect(memoryService.getAllPreferences()).toEqual({});
    });

    test('should store and retrieve tool preferences', () => {
      memoryService.setPreference('read-file', 'allow');

      expect(memoryService.hasPreference('read-file')).toBe(true);
      expect(memoryService.getPreference('read-file')).toBe('allow');
    });

    test('should store multiple tool preferences', () => {
      memoryService.setPreference('read-file', 'allow');
      memoryService.setPreference('write-file', 'reject');
      memoryService.setPreference('run-command', 'allow');

      expect(memoryService.getPreference('read-file')).toBe('allow');
      expect(memoryService.getPreference('write-file')).toBe('reject');
      expect(memoryService.getPreference('run-command')).toBe('allow');
    });

    test('should return null for unknown tools', () => {
      memoryService.setPreference('known-tool', 'allow');

      expect(memoryService.getPreference('unknown-tool')).toBeNull();
      expect(memoryService.hasPreference('unknown-tool')).toBe(false);
    });

    test('should overwrite existing preferences', () => {
      memoryService.setPreference('file-tool', 'allow');
      expect(memoryService.getPreference('file-tool')).toBe('allow');

      memoryService.setPreference('file-tool', 'reject');
      expect(memoryService.getPreference('file-tool')).toBe('reject');
    });
  });

  describe('Preference Types', () => {
    test('should handle "allow" preference', () => {
      memoryService.setPreference('test-tool', 'allow');
      expect(memoryService.getPreference('test-tool')).toBe('allow');
    });

    test('should handle "reject" preference', () => {
      memoryService.setPreference('test-tool', 'reject');
      expect(memoryService.getPreference('test-tool')).toBe('reject');
    });
  });

  describe('Clear Operations', () => {
    test('should clear all preferences', () => {
      memoryService.setPreference('tool1', 'allow');
      memoryService.setPreference('tool2', 'reject');
      memoryService.setPreference('tool3', 'allow');

      expect(Object.keys(memoryService.getAllPreferences())).toHaveLength(3);

      memoryService.clearAll();

      expect(memoryService.getAllPreferences()).toEqual({});
      expect(memoryService.hasPreference('tool1')).toBe(false);
      expect(memoryService.hasPreference('tool2')).toBe(false);
      expect(memoryService.hasPreference('tool3')).toBe(false);
    });

    test('should handle clear operation on empty service', () => {
      expect(() => memoryService.clearAll()).not.toThrow();
      expect(memoryService.getAllPreferences()).toEqual({});
    });
  });

  describe('getAllPreferences', () => {
    test('should return all stored preferences', () => {
      memoryService.setPreference('read-file', 'allow');
      memoryService.setPreference('write-file', 'reject');
      memoryService.setPreference('run-command', 'allow');

      const allPreferences = memoryService.getAllPreferences();

      expect(allPreferences).toEqual({
        'read-file': 'allow',
        'write-file': 'reject',
        'run-command': 'allow',
      });
    });

    test('should return empty object when no preferences stored', () => {
      expect(memoryService.getAllPreferences()).toEqual({});
    });

    test('should return a copy of preferences (not reference)', () => {
      memoryService.setPreference('test-tool', 'allow');

      const preferences1 = memoryService.getAllPreferences();
      const preferences2 = memoryService.getAllPreferences();

      // Modify one copy
      preferences1['new-tool'] = 'reject';

      // Original should be unchanged
      expect(preferences2).not.toHaveProperty('new-tool');
      expect(memoryService.hasPreference('new-tool')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle tool names with special characters', () => {
      const toolNames = [
        'tool-with-dashes',
        'tool_with_underscores',
        'tool.with.dots',
        'tool with spaces',
        'UPPERCASE_TOOL',
        'Tool-With-Mixed_Case.dots',
      ];

      toolNames.forEach(toolName => {
        memoryService.setPreference(toolName, 'allow');
        expect(memoryService.getPreference(toolName)).toBe('allow');
        expect(memoryService.hasPreference(toolName)).toBe(true);
      });
    });

    test('should handle empty string tool name', () => {
      memoryService.setPreference('', 'allow');
      expect(memoryService.getPreference('')).toBe('allow');
      expect(memoryService.hasPreference('')).toBe(true);
    });

    test('should be case sensitive for tool names', () => {
      memoryService.setPreference('ReadFile', 'allow');
      memoryService.setPreference('readfile', 'reject');
      memoryService.setPreference('READFILE', 'allow');

      expect(memoryService.getPreference('ReadFile')).toBe('allow');
      expect(memoryService.getPreference('readfile')).toBe('reject');
      expect(memoryService.getPreference('READFILE')).toBe('allow');
    });
  });

  describe('Session Persistence', () => {
    test('should maintain preferences across multiple operations', () => {
      // Setup preferences
      memoryService.setPreference('tool1', 'allow');
      memoryService.setPreference('tool2', 'reject');

      // Perform various operations
      expect(memoryService.hasPreference('tool1')).toBe(true);
      expect(memoryService.hasPreference('tool3')).toBe(false);
      memoryService.setPreference('tool3', 'allow');

      // Verify all preferences are still intact
      expect(memoryService.getPreference('tool1')).toBe('allow');
      expect(memoryService.getPreference('tool2')).toBe('reject');
      expect(memoryService.getPreference('tool3')).toBe('allow');

      const allPrefs = memoryService.getAllPreferences();
      expect(Object.keys(allPrefs)).toHaveLength(3);
    });

    test('should handle rapid succession of operations', () => {
      // Rapidly set and check preferences
      for (let i = 0; i < 100; i++) {
        const toolName = `tool-${i}`;
        const preference: ToolPreference = i % 2 === 0 ? 'allow' : 'reject';

        memoryService.setPreference(toolName, preference);
        expect(memoryService.getPreference(toolName)).toBe(preference);
      }

      // Verify all 100 preferences are stored
      expect(Object.keys(memoryService.getAllPreferences())).toHaveLength(100);
    });
  });
});
