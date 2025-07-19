/**
 * Visual Layout Utilities
 *
 * Utilities for handling text layout, word wrapping, and cursor mapping
 * in visual text display contexts. Extracted from TextBuffer.ts for better
 * maintainability and testability.
 */

import stringWidth from 'string-width';
import { toCodePoints, cpLen } from './textUtils.js';
import { VISUAL } from '../../core/config/ui-constants.js';

// Memoization utilities for performance optimization
const CACHE_SIZE_LIMIT = VISUAL.CACHE_SIZE_LIMIT;

interface WrapCacheEntry {
  chunks: VisualChunk[];
  lastAccessed: number;
}

interface LayoutCacheEntry {
  result: {
    visualLines: string[];
    visualCursor: [number, number];
    logicalToVisualMap: Array<Array<[number, number]>>;
    visualToLogicalMap: Array<[number, number]>;
  };
  lastAccessed: number;
}

// Cache for word wrapping results per line + viewport width
const wrapCache = new Map<string, WrapCacheEntry>();

// Cache for full layout calculations
const layoutCache = new Map<string, LayoutCacheEntry>();

/**
 * Generates a cache key from content and viewport parameters.
 */
function generateCacheKey(
  content: string,
  viewportWidth: number,
  cursorPos?: [number, number]
): string {
  const cursorKey = cursorPos ? `_${cursorPos[0]}_${cursorPos[1]}` : '';
  return `${content.length}_${viewportWidth}_${hashString(content)}${cursorKey}`;
}

/**
 * Simple string hash function for cache keys.
 */
function hashString(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Cleans up old cache entries to prevent memory leaks.
 */
function cleanupCache<T extends { lastAccessed: number }>(
  cache: Map<string, T>
): void {
  if (cache.size <= CACHE_SIZE_LIMIT) return;

  const entries = Array.from(cache.entries());
  entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

  // Remove oldest 25% of entries
  const toRemove = Math.floor(entries.length * VISUAL.CACHE_CLEANUP_RATIO);
  for (let i = 0; i < toRemove; i++) {
    const entry = entries[i];
    if (entry) {
      cache.delete(entry[0]);
    }
  }
}

/**
 * Memoized version of processLogicalLine with per-line caching.
 */
function memoizedProcessLogicalLine(
  logLine: string,
  logIndex: number,
  logicalCursor: [number, number],
  viewportWidth: number
): {
  visualChunks: VisualChunk[];
  visualCursor: [number, number] | null;
} {
  const cacheKey = generateCacheKey(logLine, viewportWidth);
  const now = Date.now();

  // Check cache
  const cached = wrapCache.get(cacheKey);
  if (cached) {
    cached.lastAccessed = now;

    // Re-calculate cursor for this specific request (cursor position can vary)
    let visualCursor: [number, number] | null = null;
    for (let i = 0; i < cached.chunks.length; i++) {
      const chunk = cached.chunks[i];
      if (chunk) {
        const cursorMapping = mapCursorToVisual(
          logicalCursor,
          logIndex,
          chunk.startPosInLogicalLine,
          chunk.numCodePoints,
          i // Use local visual line index
        );
        if (cursorMapping) {
          visualCursor = cursorMapping;
          break;
        }
      }
    }

    return { visualChunks: cached.chunks, visualCursor };
  }

  // Not in cache, calculate fresh
  const result = processLogicalLine(
    logLine,
    logIndex,
    logicalCursor,
    viewportWidth
  );

  // Cache the result
  wrapCache.set(cacheKey, {
    chunks: result.visualChunks,
    lastAccessed: now,
  });

  // Cleanup if needed
  cleanupCache(wrapCache);

  return result;
}

export interface WordWrapResult {
  chunk: string;
  numCodePoints: number;
  hasWordBreak: boolean;
}

export interface VisualChunk {
  content: string;
  startPosInLogicalLine: number;
  numCodePoints: number;
  visualLineIndex: number;
}

/**
 * Calculates word wrapping for a single logical line.
 *
 * This function handles the complex logic of breaking text into visual chunks
 * that fit within the viewport width, respecting word boundaries when possible.
 *
 * @param codePointsInLogLine - Array of code points representing the logical line
 * @param viewportWidth - Maximum width for each visual line
 * @param startPosInLogLine - Starting position within the logical line
 * @returns WordWrapResult containing the wrapped chunk information
 */
export function calculateWordWrapping(
  codePointsInLogLine: string[],
  viewportWidth: number,
  startPosInLogLine: number
): WordWrapResult {
  let currentChunk = '';
  let currentChunkVisualWidth = 0;
  let numCodePointsInChunk = 0;
  let lastWordBreakPoint = -1; // Index in codePointsInLogLine for word break
  let numCodePointsAtLastWordBreak = 0;

  // Iterate through code points to build the current visual line (chunk)
  for (let i = startPosInLogLine; i < codePointsInLogLine.length; i++) {
    const char = codePointsInLogLine[i] || '';
    const charVisualWidth = stringWidth(char);

    if (currentChunkVisualWidth + charVisualWidth > viewportWidth) {
      // Character would exceed viewport width
      if (
        lastWordBreakPoint !== -1 &&
        numCodePointsAtLastWordBreak > 0 &&
        startPosInLogLine + numCodePointsAtLastWordBreak < i
      ) {
        // We have a valid word break point to use, and it's not the start of the current segment
        currentChunk = codePointsInLogLine
          .slice(
            startPosInLogLine,
            startPosInLogLine + numCodePointsAtLastWordBreak
          )
          .join('');
        numCodePointsInChunk = numCodePointsAtLastWordBreak;
        return {
          chunk: currentChunk,
          numCodePoints: numCodePointsInChunk,
          hasWordBreak: true,
        };
      } else {
        // No word break, or word break is at the start of this potential chunk, or word break leads to empty chunk.
        // Hard break: take characters up to viewportWidth, or just the current char if it alone is too wide.
        if (numCodePointsInChunk === 0 && charVisualWidth > viewportWidth) {
          // Single character is wider than viewport, take it anyway
          currentChunk = char;
          numCodePointsInChunk = 1;
        } else if (
          numCodePointsInChunk === 0 &&
          charVisualWidth <= viewportWidth
        ) {
          // This case should ideally be caught by the next iteration if the char fits.
          // If it doesn't fit (because currentChunkVisualWidth was already > 0 from a previous char that filled the line),
          // then numCodePointsInChunk would not be 0.
          // This branch means the current char *itself* doesn't fit an empty line, which is handled by the above.
          // If we are here, it means the loop should break and the current chunk (which is empty) is finalized.
        }
      }
      break; // Break from inner loop to finalize this chunk
    }

    currentChunk += char;
    currentChunkVisualWidth += charVisualWidth;
    numCodePointsInChunk++;

    // Check for word break opportunity (space)
    if (char === ' ') {
      lastWordBreakPoint = i; // Store code point index of the space
      // Store the state *before* adding the space, if we decide to break here.
      numCodePointsAtLastWordBreak = numCodePointsInChunk - 1; // Chars *before* the space
    }
  }

  // Handle edge cases for empty chunks
  if (
    numCodePointsInChunk === 0 &&
    startPosInLogLine < codePointsInLogLine.length
  ) {
    // This can happen if the very first character considered for a new visual line is wider than the viewport.
    // In this case, we take that single character.
    const firstChar = codePointsInLogLine[startPosInLogLine] || '';
    currentChunk = firstChar;
    numCodePointsInChunk = 1; // Ensure we advance
  }

  // If after everything, numCodePointsInChunk is still 0 but we haven't processed the whole logical line,
  // it implies an issue, like viewportWidth being 0 or less. Avoid infinite loop.
  if (
    numCodePointsInChunk === 0 &&
    startPosInLogLine < codePointsInLogLine.length
  ) {
    // Force advance by one character to prevent infinite loop if something went wrong
    currentChunk = codePointsInLogLine[startPosInLogLine] || '';
    numCodePointsInChunk = 1;
  }

  return {
    chunk: currentChunk,
    numCodePoints: numCodePointsInChunk,
    hasWordBreak: false,
  };
}

/**
 * Maps logical cursor position to visual cursor coordinates.
 *
 * @param logicalCursor - [row, col] logical cursor position
 * @param logIndex - Current logical line index
 * @param currentPosInLogLine - Current position within the logical line
 * @param numCodePointsInChunk - Number of code points in the current chunk
 * @param visualLineIndex - Index of the current visual line
 * @returns Visual cursor coordinates [row, col] or null if cursor not in this chunk
 */
export function mapCursorToVisual(
  logicalCursor: [number, number],
  logIndex: number,
  currentPosInLogLine: number,
  numCodePointsInChunk: number,
  visualLineIndex: number
): [number, number] | null {
  if (logIndex !== logicalCursor[0]) {
    return null; // Cursor not on this logical line
  }

  const cursorLogCol = logicalCursor[1];

  if (
    cursorLogCol >= currentPosInLogLine &&
    cursorLogCol < currentPosInLogLine + numCodePointsInChunk
  ) {
    return [visualLineIndex, cursorLogCol - currentPosInLogLine];
  } else if (cursorLogCol === currentPosInLogLine + numCodePointsInChunk) {
    return [visualLineIndex, numCodePointsInChunk];
  }

  return null; // Cursor not in this chunk
}

/**
 * Processes a single logical line into visual chunks.
 *
 * @param logLine - The logical line content
 * @param logIndex - Index of the logical line
 * @param logicalCursor - Logical cursor position [row, col]
 * @param viewportWidth - Viewport width for wrapping
 * @returns Array of visual chunks with mapping information
 */
export function processLogicalLine(
  logLine: string,
  logIndex: number,
  logicalCursor: [number, number],
  viewportWidth: number
): {
  visualChunks: VisualChunk[];
  visualCursor: [number, number] | null;
} {
  const visualChunks: VisualChunk[] = [];
  let visualCursor: [number, number] | null = null;
  let visualLineIndex = 0; // This will be updated by the caller

  if (logLine.length === 0) {
    // Handle empty logical line
    const chunk: VisualChunk = {
      content: '',
      startPosInLogicalLine: 0,
      numCodePoints: 0,
      visualLineIndex: visualLineIndex,
    };
    visualChunks.push(chunk);

    if (logIndex === logicalCursor[0] && logicalCursor[1] === 0) {
      visualCursor = [visualLineIndex, 0];
    }

    return { visualChunks, visualCursor };
  }

  // Non-empty logical line
  let currentPosInLogLine = 0; // Tracks position within the current logical line (code point index)
  const codePointsInLogLine = toCodePoints(logLine);

  while (currentPosInLogLine < codePointsInLogLine.length) {
    const wrapResult = calculateWordWrapping(
      codePointsInLogLine,
      viewportWidth,
      currentPosInLogLine
    );

    const chunk: VisualChunk = {
      content: wrapResult.chunk,
      startPosInLogicalLine: currentPosInLogLine,
      numCodePoints: wrapResult.numCodePoints,
      visualLineIndex: visualLineIndex,
    };
    visualChunks.push(chunk);

    // Check if cursor maps to this chunk
    const cursorMapping = mapCursorToVisual(
      logicalCursor,
      logIndex,
      currentPosInLogLine,
      wrapResult.numCodePoints,
      visualLineIndex
    );

    if (cursorMapping) {
      visualCursor = cursorMapping;
    }

    const logicalStartOfThisChunk = currentPosInLogLine;
    currentPosInLogLine += wrapResult.numCodePoints;

    // If the chunk processed did not consume the entire logical line,
    // and the character immediately following the chunk is a space,
    // advance past this space as it acted as a delimiter for word wrapping.
    if (
      logicalStartOfThisChunk + wrapResult.numCodePoints <
        codePointsInLogLine.length &&
      currentPosInLogLine < codePointsInLogLine.length && // Redundant if previous is true, but safe
      codePointsInLogLine[currentPosInLogLine] === ' '
    ) {
      currentPosInLogLine++;
    }

    visualLineIndex++;
  }

  // Check if cursor is at the very end of this logical line
  if (
    logIndex === logicalCursor[0] &&
    logicalCursor[1] === codePointsInLogLine.length // Cursor at end of logical line
  ) {
    const lastChunk = visualChunks[visualChunks.length - 1];
    if (lastChunk) {
      visualCursor = [
        lastChunk.visualLineIndex,
        cpLen(lastChunk.content), // Cursor at end of last visual line for this logical line
      ];
    }
  }

  return { visualChunks, visualCursor };
}

/**
 * Memoized version of calculateVisualLayout with full layout caching.
 *
 * This provides the main performance optimization by caching complete layout
 * calculations based on content hash and viewport dimensions.
 */
export function memoizedCalculateVisualLayout(
  logicalLines: string[],
  logicalCursor: [number, number],
  viewportWidth: number
): {
  visualLines: string[];
  visualCursor: [number, number];
  logicalToVisualMap: Array<Array<[number, number]>>;
  visualToLogicalMap: Array<[number, number]>;
} {
  const allText = logicalLines.join('\n');
  const cacheKey = generateCacheKey(allText, viewportWidth, logicalCursor);
  const now = Date.now();

  // Check full layout cache
  const cached = layoutCache.get(cacheKey);
  if (cached) {
    cached.lastAccessed = now;
    return cached.result;
  }

  // Calculate fresh layout using the regular function
  const visualLines: string[] = [];
  const logicalToVisualMap: Array<Array<[number, number]>> = [];
  const visualToLogicalMap: Array<[number, number]> = [];
  let currentVisualCursor: [number, number] = [0, 0];
  let currentVisualLineIndex = 0;

  logicalLines.forEach((logLine, logIndex) => {
    logicalToVisualMap[logIndex] = [];

    const { visualChunks, visualCursor } = memoizedProcessLogicalLine(
      logLine,
      logIndex,
      logicalCursor,
      viewportWidth
    );

    visualChunks.forEach(chunk => {
      if (chunk) {
        const actualVisualLineIndex = currentVisualLineIndex;

        if (!logicalToVisualMap[logIndex]) {
          logicalToVisualMap[logIndex] = [];
        }
        logicalToVisualMap[logIndex]!.push([
          actualVisualLineIndex,
          chunk.startPosInLogicalLine,
        ]);
        visualToLogicalMap.push([logIndex, chunk.startPosInLogicalLine]);
        visualLines.push(chunk.content);

        currentVisualLineIndex++;
      }
    });

    if (visualCursor) {
      const adjustedVisualRow =
        visualCursor[0] + (currentVisualLineIndex - visualChunks.length);
      currentVisualCursor = [adjustedVisualRow, visualCursor[1]];
    }
  });

  // Handle edge cases
  if (
    logicalLines.length === 0 ||
    (logicalLines.length === 1 && logicalLines[0] === '')
  ) {
    if (visualLines.length === 0) {
      visualLines.push('');
      if (!logicalToVisualMap[0]) logicalToVisualMap[0] = [];
      logicalToVisualMap[0].push([0, 0]);
      visualToLogicalMap.push([0, 0]);
    }
    currentVisualCursor = [0, 0];
  } else if (
    logicalCursor[0] === logicalLines.length - 1 &&
    logicalCursor[1] === cpLen(logicalLines[logicalLines.length - 1] || '') &&
    visualLines.length > 0
  ) {
    const lastVisLineIdx = visualLines.length - 1;
    currentVisualCursor = [
      lastVisLineIdx,
      cpLen(visualLines[lastVisLineIdx] || ''),
    ];
  }

  const result = {
    visualLines,
    visualCursor: currentVisualCursor,
    logicalToVisualMap,
    visualToLogicalMap,
  };

  // Cache the result
  layoutCache.set(cacheKey, {
    result,
    lastAccessed: now,
  });

  // Cleanup if needed
  cleanupCache(layoutCache);

  return result;
}

/**
 * Clears all memoization caches. Useful for testing or memory management.
 */
export function clearLayoutCaches(): void {
  wrapCache.clear();
  layoutCache.clear();
}
