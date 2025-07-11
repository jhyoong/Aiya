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
 * Unescape a path string that may contain backslash-escaped spaces.
 * This is a simplified version and may need to be expanded for more complex cases.
 */
export function unescapePath(path: string): string {
  // Replace "\\ " with " "
  return path.replace(/\\ /g, ' ');
}
