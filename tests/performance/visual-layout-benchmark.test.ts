/**
 * Performance benchmark for visual layout optimizations
 * 
 * Tests the performance improvements from the Phase 1.1 refactoring
 * by comparing the memoized version against a hypothetical non-memoized version.
 */

import { describe, it, expect } from 'vitest';
import { 
  memoizedCalculateVisualLayout,
  clearLayoutCaches,
} from '../../src/ui/utils/visualLayout.js';

describe('Visual Layout Performance Benchmark', () => {
  const generateLargeText = (lines: number, wordsPerLine: number): string[] => {
    const words = ['hello', 'world', 'test', 'performance', 'optimization', 'benchmark', 'visual', 'layout'];
    const result: string[] = [];
    
    for (let i = 0; i < lines; i++) {
      const line = Array.from({ length: wordsPerLine }, (_, j) => 
        words[(i + j) % words.length]
      ).join(' ');
      result.push(line);
    }
    
    return result;
  };

  it('should show performance improvement with memoization', () => {
    clearLayoutCaches();
    
    const logicalLines = generateLargeText(100, 20); // 100 lines with 20 words each
    const logicalCursor: [number, number] = [50, 10];
    const viewportWidth = 80;

    // First call - should cache the result
    const start1 = performance.now();
    const result1 = memoizedCalculateVisualLayout(logicalLines, logicalCursor, viewportWidth);
    const time1 = performance.now() - start1;

    // Second call with same parameters - should use cache
    const start2 = performance.now();
    const result2 = memoizedCalculateVisualLayout(logicalLines, logicalCursor, viewportWidth);
    const time2 = performance.now() - start2;

    // Results should be identical
    expect(result1).toEqual(result2);
    
    // Second call should be significantly faster (at least 5x faster)
    expect(time2).toBeLessThan(time1 / 5);
    
    console.log(`First call: ${time1.toFixed(2)}ms`);
    console.log(`Second call: ${time2.toFixed(2)}ms`);
    console.log(`Performance improvement: ${(time1 / time2).toFixed(1)}x faster`);
  });

  it('should handle different viewport sizes efficiently', () => {
    clearLayoutCaches();
    
    const logicalLines = generateLargeText(50, 15);
    const logicalCursor: [number, number] = [25, 5];
    
    const viewportSizes = [40, 60, 80, 100, 120];
    const times: number[] = [];

    viewportSizes.forEach(width => {
      const start = performance.now();
      const result = memoizedCalculateVisualLayout(logicalLines, logicalCursor, width);
      const time = performance.now() - start;
      times.push(time);
      
      expect(result.visualLines.length).toBeGreaterThan(0);
      expect(result.visualCursor).toBeDefined();
    });

    console.log('Viewport size performance:');
    viewportSizes.forEach((width, i) => {
      console.log(`  ${width}px: ${times[i].toFixed(2)}ms`);
    });
    
    // All calls should complete within reasonable time
    times.forEach(time => {
      expect(time).toBeLessThan(100); // Should be under 100ms
    });
  });

  it('should handle rapid cursor movements efficiently', () => {
    clearLayoutCaches();
    
    const logicalLines = generateLargeText(20, 10);
    const viewportWidth = 80;
    
    const cursorPositions: [number, number][] = [
      [0, 0], [0, 5], [0, 10], [1, 0], [1, 8], [2, 3], [3, 12], [4, 1], [5, 9]
    ];

    const times: number[] = [];

    cursorPositions.forEach(cursor => {
      const start = performance.now();
      const result = memoizedCalculateVisualLayout(logicalLines, cursor, viewportWidth);
      const time = performance.now() - start;
      times.push(time);
      
      expect(result.visualCursor).toBeDefined();
    });

    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`Average cursor movement time: ${averageTime.toFixed(2)}ms`);
    
    // Cursor movements should be very fast
    expect(averageTime).toBeLessThan(10);
  });

  it('should handle text wrapping scenarios efficiently', () => {
    clearLayoutCaches();
    
    // Create text with various line lengths to test wrapping
    const logicalLines = [
      'This is a very long line that will definitely need to be wrapped when the viewport is narrow',
      'Short line',
      'Another extremely long line with many words that should also wrap nicely in the viewport',
      'Medium length line that might wrap',
      'A',
      '', // Empty line
      'Final long line to test the wrapping behavior across multiple different scenarios and edge cases'
    ];
    
    const logicalCursor: [number, number] = [2, 30];
    const narrowViewport = 25; // Force wrapping

    const start = performance.now();
    const result = memoizedCalculateVisualLayout(logicalLines, logicalCursor, narrowViewport);
    const time = performance.now() - start;

    console.log(`Text wrapping time: ${time.toFixed(2)}ms`);
    console.log(`Visual lines created: ${result.visualLines.length}`);
    
    // Should create more visual lines than logical lines due to wrapping
    expect(result.visualLines.length).toBeGreaterThan(logicalLines.length);
    
    // Should complete within reasonable time
    expect(time).toBeLessThan(50);
    
    // Cursor should be mapped correctly
    expect(result.visualCursor).toBeDefined();
    expect(result.visualCursor[0]).toBeGreaterThanOrEqual(0);
    expect(result.visualCursor[1]).toBeGreaterThanOrEqual(0);
  });

  it('should maintain performance with cache cleanup', () => {
    clearLayoutCaches();
    
    // Create many different cache entries to trigger cleanup
    const baselines: number[] = [];
    const afterCleanupTimes: number[] = [];
    
    // Fill cache with many entries
    for (let i = 0; i < 50; i++) {
      const lines = generateLargeText(5, 8);
      const cursor: [number, number] = [i % 5, i % 8];
      const width = 60 + (i % 20); // Vary viewport width
      
      const start = performance.now();
      memoizedCalculateVisualLayout(lines, cursor, width);
      const time = performance.now() - start;
      
      if (i < 10) {
        baselines.push(time);
      } else if (i >= 40) {
        afterCleanupTimes.push(time);
      }
    }
    
    const avgBaseline = baselines.reduce((a, b) => a + b, 0) / baselines.length;
    const avgAfterCleanup = afterCleanupTimes.reduce((a, b) => a + b, 0) / afterCleanupTimes.length;
    
    console.log(`Baseline performance: ${avgBaseline.toFixed(2)}ms`);
    console.log(`After cache cleanup: ${avgAfterCleanup.toFixed(2)}ms`);
    
    // Performance should remain consistent even after cache cleanup
    expect(avgAfterCleanup).toBeLessThan(avgBaseline * 2); // Within 2x of baseline
  });
});