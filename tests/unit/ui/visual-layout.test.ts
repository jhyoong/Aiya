/**
 * Unit tests for visual layout utilities
 *
 * Tests the extracted word wrapping, cursor mapping, and line processing functions
 * to ensure they maintain the same behavior as the original calculateVisualLayout.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateWordWrapping,
  mapCursorToVisual,
  processLogicalLine,
  memoizedCalculateVisualLayout,
  clearLayoutCaches,
} from '../../../src/ui/utils/visualLayout.js';
import { toCodePoints } from '../../../src/ui/utils/textUtils.js';

describe('Visual Layout Utilities', () => {
  beforeEach(() => {
    // Clear caches before each test to ensure clean state
    clearLayoutCaches();
  });

  describe('calculateWordWrapping', () => {
    it('should wrap text that exceeds viewport width', () => {
      const text = 'This is a long line that should be wrapped';
      const codePoints = toCodePoints(text);
      const viewportWidth = 20;

      const result = calculateWordWrapping(codePoints, viewportWidth, 0);

      expect(result.chunk).toBe('This is a long line');
      expect(result.numCodePoints).toBe(19);
      expect(result.hasWordBreak).toBe(true);
    });

    it('should handle single words longer than viewport', () => {
      const text = 'supercalifragilisticexpialidocious';
      const codePoints = toCodePoints(text);
      const viewportWidth = 10;

      const result = calculateWordWrapping(codePoints, viewportWidth, 0);

      expect(result.chunk).toBe('supercalif');
      expect(result.numCodePoints).toBe(10);
      expect(result.hasWordBreak).toBe(false);
    });

    it('should handle empty lines', () => {
      const codePoints: string[] = [];
      const viewportWidth = 80;

      const result = calculateWordWrapping(codePoints, viewportWidth, 0);

      expect(result.chunk).toBe('');
      expect(result.numCodePoints).toBe(0);
      expect(result.hasWordBreak).toBe(false);
    });

    it('should handle Unicode characters correctly', () => {
      const text = '🌟⭐✨💫🎆🎇🌌'; // Wide Unicode characters
      const codePoints = toCodePoints(text);
      const viewportWidth = 10;

      const result = calculateWordWrapping(codePoints, viewportWidth, 0);

      expect(result.numCodePoints).toBeGreaterThan(0);
      expect(result.chunk.length).toBeGreaterThan(0);
    });

    it('should respect word boundaries', () => {
      const text = 'hello world foo bar';
      const codePoints = toCodePoints(text);
      const viewportWidth = 12; // Should fit "hello world " but not "foo"

      const result = calculateWordWrapping(codePoints, viewportWidth, 0);

      expect(result.chunk).toBe('hello world');
      expect(result.hasWordBreak).toBe(true);
    });

    it('should handle starting position correctly', () => {
      const text = 'prefix hello world suffix';
      const codePoints = toCodePoints(text);
      const viewportWidth = 12;
      const startPos = 7; // Start at "hello"

      const result = calculateWordWrapping(codePoints, viewportWidth, startPos);

      expect(result.chunk).toBe('hello world');
      expect(result.numCodePoints).toBe(11);
    });
  });

  describe('mapCursorToVisual', () => {
    it('should map cursor within chunk correctly', () => {
      const logicalCursor: [number, number] = [0, 5];
      const logIndex = 0;
      const currentPosInLogLine = 0;
      const numCodePointsInChunk = 10;
      const visualLineIndex = 0;

      const result = mapCursorToVisual(
        logicalCursor,
        logIndex,
        currentPosInLogLine,
        numCodePointsInChunk,
        visualLineIndex
      );

      expect(result).toEqual([0, 5]);
    });

    it('should map cursor at end of chunk correctly', () => {
      const logicalCursor: [number, number] = [0, 10];
      const logIndex = 0;
      const currentPosInLogLine = 0;
      const numCodePointsInChunk = 10;
      const visualLineIndex = 0;

      const result = mapCursorToVisual(
        logicalCursor,
        logIndex,
        currentPosInLogLine,
        numCodePointsInChunk,
        visualLineIndex
      );

      expect(result).toEqual([0, 10]);
    });

    it('should return null for cursor not in chunk', () => {
      const logicalCursor: [number, number] = [0, 15];
      const logIndex = 0;
      const currentPosInLogLine = 0;
      const numCodePointsInChunk = 10;
      const visualLineIndex = 0;

      const result = mapCursorToVisual(
        logicalCursor,
        logIndex,
        currentPosInLogLine,
        numCodePointsInChunk,
        visualLineIndex
      );

      expect(result).toBeNull();
    });

    it('should return null for cursor on different logical line', () => {
      const logicalCursor: [number, number] = [1, 5];
      const logIndex = 0;
      const currentPosInLogLine = 0;
      const numCodePointsInChunk = 10;
      const visualLineIndex = 0;

      const result = mapCursorToVisual(
        logicalCursor,
        logIndex,
        currentPosInLogLine,
        numCodePointsInChunk,
        visualLineIndex
      );

      expect(result).toBeNull();
    });
  });

  describe('processLogicalLine', () => {
    it('should process empty line correctly', () => {
      const logLine = '';
      const logIndex = 0;
      const logicalCursor: [number, number] = [0, 0];
      const viewportWidth = 80;

      const result = processLogicalLine(
        logLine,
        logIndex,
        logicalCursor,
        viewportWidth
      );

      expect(result.visualChunks).toHaveLength(1);
      expect(result.visualChunks[0].content).toBe('');
      expect(result.visualCursor).toEqual([0, 0]);
    });

    it('should process single line that fits in viewport', () => {
      const logLine = 'Hello world';
      const logIndex = 0;
      const logicalCursor: [number, number] = [0, 6];
      const viewportWidth = 80;

      const result = processLogicalLine(
        logLine,
        logIndex,
        logicalCursor,
        viewportWidth
      );

      expect(result.visualChunks).toHaveLength(1);
      expect(result.visualChunks[0].content).toBe('Hello world');
      expect(result.visualCursor).toEqual([0, 6]);
    });

    it('should process line that needs wrapping', () => {
      const logLine =
        'This is a very long line that definitely needs to be wrapped';
      const logIndex = 0;
      const logicalCursor: [number, number] = [0, 30];
      const viewportWidth = 20;

      const result = processLogicalLine(
        logLine,
        logIndex,
        logicalCursor,
        viewportWidth
      );

      expect(result.visualChunks.length).toBeGreaterThan(1);
      expect(result.visualCursor).toBeDefined();
    });

    it('should handle cursor at end of line', () => {
      const logLine = 'Hello world';
      const logIndex = 0;
      const logicalCursor: [number, number] = [0, 11]; // End of line
      const viewportWidth = 80;

      const result = processLogicalLine(
        logLine,
        logIndex,
        logicalCursor,
        viewportWidth
      );

      expect(result.visualCursor).toEqual([0, 11]);
    });

    it('should handle cursor on different logical line', () => {
      const logLine = 'Hello world';
      const logIndex = 0;
      const logicalCursor: [number, number] = [1, 5]; // Different line
      const viewportWidth = 80;

      const result = processLogicalLine(
        logLine,
        logIndex,
        logicalCursor,
        viewportWidth
      );

      expect(result.visualCursor).toBeNull();
    });
  });

  describe('memoizedCalculateVisualLayout', () => {
    it('should handle empty text', () => {
      const logicalLines: string[] = [];
      const logicalCursor: [number, number] = [0, 0];
      const viewportWidth = 80;

      const result = memoizedCalculateVisualLayout(
        logicalLines,
        logicalCursor,
        viewportWidth
      );

      expect(result.visualLines).toHaveLength(1);
      expect(result.visualLines[0]).toBe('');
      expect(result.visualCursor).toEqual([0, 0]);
    });

    it('should handle single empty line', () => {
      const logicalLines = [''];
      const logicalCursor: [number, number] = [0, 0];
      const viewportWidth = 80;

      const result = memoizedCalculateVisualLayout(
        logicalLines,
        logicalCursor,
        viewportWidth
      );

      expect(result.visualLines).toHaveLength(1);
      expect(result.visualLines[0]).toBe('');
      expect(result.visualCursor).toEqual([0, 0]);
    });

    it('should handle multiple lines without wrapping', () => {
      const logicalLines = ['Hello', 'world', 'test'];
      const logicalCursor: [number, number] = [1, 3];
      const viewportWidth = 80;

      const result = memoizedCalculateVisualLayout(
        logicalLines,
        logicalCursor,
        viewportWidth
      );

      expect(result.visualLines).toHaveLength(3);
      expect(result.visualLines).toEqual(['Hello', 'world', 'test']);
      expect(result.visualCursor).toEqual([1, 3]);
    });

    it('should handle lines with wrapping', () => {
      const logicalLines = [
        'This is a very long first line that will be wrapped',
        'Short line',
        'Another very long line that definitely needs wrapping as well',
      ];
      const logicalCursor: [number, number] = [0, 25];
      const viewportWidth = 20;

      const result = memoizedCalculateVisualLayout(
        logicalLines,
        logicalCursor,
        viewportWidth
      );

      expect(result.visualLines.length).toBeGreaterThan(3);
      expect(result.visualCursor).toBeDefined();
      expect(result.visualCursor[0]).toBeGreaterThanOrEqual(0);
    });

    it('should maintain mapping consistency', () => {
      const logicalLines = ['Hello world', 'Test line'];
      const logicalCursor: [number, number] = [1, 5];
      const viewportWidth = 80;

      const result = memoizedCalculateVisualLayout(
        logicalLines,
        logicalCursor,
        viewportWidth
      );

      expect(result.logicalToVisualMap).toHaveLength(2);
      expect(result.visualToLogicalMap).toHaveLength(result.visualLines.length);

      // Check that every visual line has a corresponding logical mapping
      result.visualToLogicalMap.forEach(([logLine, logCol]) => {
        expect(logLine).toBeGreaterThanOrEqual(0);
        expect(logLine).toBeLessThan(logicalLines.length);
        expect(logCol).toBeGreaterThanOrEqual(0);
      });
    });

    it('should cache results correctly', () => {
      const logicalLines = ['Hello world', 'Test line'];
      const logicalCursor: [number, number] = [0, 5];
      const viewportWidth = 80;

      // First call
      const result1 = memoizedCalculateVisualLayout(
        logicalLines,
        logicalCursor,
        viewportWidth
      );

      // Second call with same parameters should return cached result
      const result2 = memoizedCalculateVisualLayout(
        logicalLines,
        logicalCursor,
        viewportWidth
      );

      expect(result1).toEqual(result2);
    });

    it('should handle cursor at end of text', () => {
      const logicalLines = ['Hello world'];
      const logicalCursor: [number, number] = [0, 11]; // End of text
      const viewportWidth = 80;

      const result = memoizedCalculateVisualLayout(
        logicalLines,
        logicalCursor,
        viewportWidth
      );

      expect(result.visualCursor).toEqual([0, 11]);
    });

    it('should handle Unicode text correctly', () => {
      const logicalLines = ['Hello 世界', '🌟⭐✨'];
      const logicalCursor: [number, number] = [1, 1];
      const viewportWidth = 80;

      const result = memoizedCalculateVisualLayout(
        logicalLines,
        logicalCursor,
        viewportWidth
      );

      expect(result.visualLines).toHaveLength(2);
      expect(result.visualCursor).toBeDefined();
    });
  });

  describe('cache behavior', () => {
    it('should clear caches when requested', () => {
      const logicalLines = ['Hello world'];
      const logicalCursor: [number, number] = [0, 5];
      const viewportWidth = 80;

      // Prime the cache
      memoizedCalculateVisualLayout(logicalLines, logicalCursor, viewportWidth);

      // Clear caches
      clearLayoutCaches();

      // Should still work after clearing
      const result = memoizedCalculateVisualLayout(
        logicalLines,
        logicalCursor,
        viewportWidth
      );
      expect(result).toBeDefined();
      expect(result.visualLines).toEqual(['Hello world']);
    });

    it('should handle cache size limits gracefully', () => {
      // This test ensures the cache cleanup mechanism works
      // by creating many different cache entries
      for (let i = 0; i < 50; i++) {
        const logicalLines = [`Test line ${i}`];
        const logicalCursor: [number, number] = [0, 5];
        const viewportWidth = 80 + i; // Different viewport to create different cache entries

        const result = memoizedCalculateVisualLayout(
          logicalLines,
          logicalCursor,
          viewportWidth
        );
        expect(result).toBeDefined();
      }

      // Should still work after creating many cache entries
      const finalResult = memoizedCalculateVisualLayout(
        ['Final test'],
        [0, 0],
        80
      );
      expect(finalResult.visualLines).toEqual(['Final test']);
    });
  });
});
