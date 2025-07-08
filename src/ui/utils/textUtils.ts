/**
 * Text utility functions for proper Unicode handling
 */

/**
 * Convert string to array of code points for proper Unicode handling
 */
export function toCodePoints(str: string): string[] {
  return Array.from(str);
}

/**
 * Get the length of a string in code points
 */
export function cpLen(str: string): number {
  return toCodePoints(str).length;
}

/**
 * Slice a string by code points
 */
export function cpSlice(str: string, start: number, end?: number): string {
  const codePoints = toCodePoints(str);
  return codePoints.slice(start, end).join('');
}

/**
 * Escape a path string for safe file system operations
 */
export function unescapePath(path: string): string {
  return path.replace(/\\ /g, ' ');
}