/**
 * Text Processing Utilities
 *
 * Shared utilities for text manipulation, word boundary detection,
 * and text processing operations used across the text editing components.
 */

/**
 * Determines if a character is considered a word character.
 *
 * Word characters are any characters that are not whitespace or punctuation.
 * This is used for word-wise navigation and operations.
 *
 * @param ch - The character to test, or undefined
 * @returns true if the character is a word character, false otherwise
 */
export function isWordChar(ch: string | undefined): boolean {
  if (ch === undefined) {
    return false;
  }
  return !/[\s,.;!?]/.test(ch);
}

/**
 * Finds the start position of the word at or before the given position.
 * This matches the original TextBuffer wordLeft logic exactly.
 *
 * @param text - The text to search in (as code points array)
 * @param position - The starting position
 * @returns The position of the start of the word
 */
export function findWordStart(text: string[], position: number): number {
  let start = position;
  let onlySpaces = true;

  // Check if we only have spaces before the cursor
  for (let i = 0; i < start; i++) {
    if (isWordChar(text[i])) {
      onlySpaces = false;
      break;
    }
  }

  if (onlySpaces && start > 0) {
    start--;
  } else {
    // Skip non-word characters backwards
    while (start > 0 && !isWordChar(text[start - 1])) start--;
    // Skip word characters backwards to find the start
    while (start > 0 && isWordChar(text[start - 1])) start--;
  }

  return start;
}

/**
 * Finds the end position of the word at or after the given position.
 *
 * @param text - The text to search in (as code points array)
 * @param position - The starting position
 * @returns The position of the end of the word
 */
export function findWordEnd(text: string[], position: number): number {
  let end = position;

  // Skip non-word characters
  while (end < text.length && !isWordChar(text[end])) end++;
  // Skip word characters to find the end
  while (end < text.length && isWordChar(text[end])) end++;

  return end;
}

/**
 * Checks if a position is at a word boundary.
 *
 * @param text - The text to check (as code points array)
 * @param position - The position to check
 * @returns true if the position is at a word boundary
 */
export function isAtWordBoundary(text: string[], position: number): boolean {
  if (position === 0 || position >= text.length) {
    return true;
  }

  const prevChar = text[position - 1];
  const currChar = text[position];

  return isWordChar(prevChar) !== isWordChar(currChar);
}

/**
 * Extracts the word at the given position.
 *
 * @param text - The text to extract from (as code points array)
 * @param position - The position within the word
 * @returns The extracted word, or empty string if no word at position
 */
export function extractWordAt(text: string[], position: number): string {
  if (position < 0 || position >= text.length || !isWordChar(text[position])) {
    return '';
  }

  // Find the actual start of the current word (not navigation start)
  let start = position;
  while (start > 0 && isWordChar(text[start - 1])) {
    start--;
  }

  // Find the end of the current word
  let end = position;
  while (end < text.length && isWordChar(text[end])) {
    end++;
  }

  return text.slice(start, end).join('');
}
