/**
 * Unit tests for text processing utilities
 * 
 * Tests the word manipulation and text processing functions
 * to ensure proper word boundary detection and text operations.
 */

import { describe, it, expect } from 'vitest';
import {
  isWordChar,
  findWordStart,
  findWordEnd,
  isAtWordBoundary,
  extractWordAt,
} from '../../../src/ui/utils/textProcessing.js';
import { toCodePoints } from '../../../src/ui/utils/textUtils.js';

describe('Text Processing Utilities', () => {
  describe('isWordChar', () => {
    it('should return true for alphabetic characters', () => {
      expect(isWordChar('a')).toBe(true);
      expect(isWordChar('Z')).toBe(true);
      expect(isWordChar('m')).toBe(true);
    });

    it('should return true for numeric characters', () => {
      expect(isWordChar('0')).toBe(true);
      expect(isWordChar('9')).toBe(true);
      expect(isWordChar('5')).toBe(true);
    });

    it('should return true for underscore', () => {
      expect(isWordChar('_')).toBe(true);
    });

    it('should return false for whitespace', () => {
      expect(isWordChar(' ')).toBe(false);
      expect(isWordChar('\t')).toBe(false);
      expect(isWordChar('\n')).toBe(false);
    });

    it('should return false for punctuation', () => {
      expect(isWordChar(',')).toBe(false);
      expect(isWordChar('.')).toBe(false);
      expect(isWordChar(';')).toBe(false);
      expect(isWordChar('!')).toBe(false);
      expect(isWordChar('?')).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isWordChar(undefined)).toBe(false);
    });

    it('should handle Unicode characters', () => {
      expect(isWordChar('α')).toBe(true); // Greek letter
      expect(isWordChar('中')).toBe(true); // Chinese character
      expect(isWordChar('🌟')).toBe(true); // Emoji (not whitespace/punctuation)
    });
  });

  describe('findWordStart', () => {
    it('should find start of word in middle of text', () => {
      const text = toCodePoints('hello world test');
      const position = 8; // Middle of 'world'
      
      const start = findWordStart(text, position);
      
      expect(start).toBe(6); // Start of 'world'
    });

    it('should handle position at start of word', () => {
      const text = toCodePoints('hello world test');
      const position = 6; // Start of 'world'
      
      const start = findWordStart(text, position);
      
      expect(start).toBe(0); // Should go to start of previous word 'hello'
    });

    it('should handle position in whitespace', () => {
      const text = toCodePoints('hello   world');
      const position = 7; // In the spaces
      
      const start = findWordStart(text, position);
      
      expect(start).toBe(0); // Start of 'hello'
    });

    it('should handle position at beginning of text', () => {
      const text = toCodePoints('hello world');
      const position = 0;
      
      const start = findWordStart(text, position);
      
      expect(start).toBe(0);
    });

    it('should handle text with only spaces before position', () => {
      const text = toCodePoints('   hello');
      const position = 3; // At start of 'hello'
      
      const start = findWordStart(text, position);
      
      expect(start).toBe(2); // Should go back by one space
    });

    it('should handle mixed punctuation and words', () => {
      const text = toCodePoints('hello, world!');
      const position = 9; // Middle of 'world'
      
      const start = findWordStart(text, position);
      
      expect(start).toBe(7); // Start of 'world'
    });
  });

  describe('findWordEnd', () => {
    it('should find end of word in middle of text', () => {
      const text = toCodePoints('hello world test');
      const position = 8; // Middle of 'world'
      
      const end = findWordEnd(text, position);
      
      expect(end).toBe(11); // End of 'world'
    });

    it('should handle position at end of word', () => {
      const text = toCodePoints('hello world test');
      const position = 11; // End of 'world'
      
      const end = findWordEnd(text, position);
      
      expect(end).toBe(16); // End of 'test'
    });

    it('should handle position in whitespace', () => {
      const text = toCodePoints('hello   world test');
      const position = 7; // In the spaces
      
      const end = findWordEnd(text, position);
      
      expect(end).toBe(13); // End of 'world'
    });

    it('should handle position at end of text', () => {
      const text = toCodePoints('hello world');
      const position = 10; // Last character
      
      const end = findWordEnd(text, position);
      
      expect(end).toBe(11); // End of text
    });

    it('should handle mixed punctuation and words', () => {
      const text = toCodePoints('hello, world!');
      const position = 2; // Middle of 'hello'
      
      const end = findWordEnd(text, position);
      
      expect(end).toBe(5); // End of 'hello'
    });

    it('should handle position on punctuation', () => {
      const text = toCodePoints('hello, world');
      const position = 5; // On the comma
      
      const end = findWordEnd(text, position);
      
      expect(end).toBe(12); // End of 'world'
    });
  });

  describe('isAtWordBoundary', () => {
    it('should return true at start of text', () => {
      const text = toCodePoints('hello world');
      
      expect(isAtWordBoundary(text, 0)).toBe(true);
    });

    it('should return true at end of text', () => {
      const text = toCodePoints('hello world');
      
      expect(isAtWordBoundary(text, text.length)).toBe(true);
    });

    it('should return true between word and space', () => {
      const text = toCodePoints('hello world');
      
      expect(isAtWordBoundary(text, 5)).toBe(true); // Between 'hello' and ' '
    });

    it('should return true between space and word', () => {
      const text = toCodePoints('hello world');
      
      expect(isAtWordBoundary(text, 6)).toBe(true); // Between ' ' and 'world'
    });

    it('should return false in middle of word', () => {
      const text = toCodePoints('hello world');
      
      expect(isAtWordBoundary(text, 2)).toBe(false); // Middle of 'hello'
      expect(isAtWordBoundary(text, 8)).toBe(false); // Middle of 'world'
    });

    it('should return false in middle of whitespace', () => {
      const text = toCodePoints('hello   world');
      
      expect(isAtWordBoundary(text, 6)).toBe(false); // Middle of spaces
      expect(isAtWordBoundary(text, 7)).toBe(false); // Middle of spaces
    });

    it('should handle punctuation boundaries', () => {
      const text = toCodePoints('hello, world!');
      
      expect(isAtWordBoundary(text, 5)).toBe(true); // Between 'hello' and ','
      expect(isAtWordBoundary(text, 6)).toBe(false); // Between ',' and ' ' - both non-word chars
      expect(isAtWordBoundary(text, 12)).toBe(true); // Between 'world' and '!'
    });
  });

  describe('extractWordAt', () => {
    it('should extract word from middle of text', () => {
      const text = toCodePoints('hello world test');
      const position = 8; // Middle of 'world'
      
      const word = extractWordAt(text, position);
      
      expect(word).toBe('world');
    });

    it('should extract word at start of text', () => {
      const text = toCodePoints('hello world test');
      const position = 2; // Middle of 'hello'
      
      const word = extractWordAt(text, position);
      
      expect(word).toBe('hello');
    });

    it('should extract word at end of text', () => {
      const text = toCodePoints('hello world test');
      const position = 14; // Middle of 'test'
      
      const word = extractWordAt(text, position);
      
      expect(word).toBe('test');
    });

    it('should return empty string for position in whitespace', () => {
      const text = toCodePoints('hello world test');
      const position = 5; // Space between 'hello' and 'world'
      
      const word = extractWordAt(text, position);
      
      expect(word).toBe('');
    });

    it('should return empty string for position on punctuation', () => {
      const text = toCodePoints('hello, world!');
      const position = 5; // Comma
      
      const word = extractWordAt(text, position);
      
      expect(word).toBe('');
    });

    it('should return empty string for invalid position', () => {
      const text = toCodePoints('hello world');
      
      expect(extractWordAt(text, -1)).toBe('');
      expect(extractWordAt(text, text.length)).toBe('');
      expect(extractWordAt(text, text.length + 5)).toBe('');
    });

    it('should handle single character words', () => {
      const text = toCodePoints('a b c');
      
      expect(extractWordAt(text, 0)).toBe('a'); // Position 0 is 'a'
      expect(extractWordAt(text, 2)).toBe('b'); // Position 2 is 'b'  
      expect(extractWordAt(text, 4)).toBe('c'); // Position 4 is 'c'
    });

    it('should handle words with numbers and underscores', () => {
      const text = toCodePoints('var_name123 another_var');
      const position = 5; // Middle of 'var_name123'
      
      const word = extractWordAt(text, position);
      
      expect(word).toBe('var_name123');
    });

    it('should handle Unicode words', () => {
      const text = toCodePoints('hello 世界 world');
      const position = 7; // Middle of '世界'
      
      const word = extractWordAt(text, position);
      
      expect(word).toBe('世界');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty text arrays', () => {
      const text: string[] = [];
      
      expect(findWordStart(text, 0)).toBe(0);
      expect(findWordEnd(text, 0)).toBe(0);
      expect(isAtWordBoundary(text, 0)).toBe(true);
      expect(extractWordAt(text, 0)).toBe('');
    });

    it('should handle single character text', () => {
      const text = toCodePoints('a');
      
      expect(findWordStart(text, 0)).toBe(0);
      expect(findWordEnd(text, 0)).toBe(1);
      expect(isAtWordBoundary(text, 0)).toBe(true);
      expect(isAtWordBoundary(text, 1)).toBe(true);
      expect(extractWordAt(text, 0)).toBe('a');
    });

    it('should handle text with only whitespace', () => {
      const text = toCodePoints('   ');
      
      expect(findWordStart(text, 1)).toBe(0);
      expect(findWordEnd(text, 1)).toBe(3);
      expect(extractWordAt(text, 1)).toBe('');
    });

    it('should handle text with only punctuation', () => {
      const text = toCodePoints('...');
      
      expect(extractWordAt(text, 1)).toBe('');
      expect(isAtWordBoundary(text, 0)).toBe(true);
      expect(isAtWordBoundary(text, 1)).toBe(false);
    });

    it('should handle mixed Unicode and ASCII', () => {
      const text = toCodePoints('hello世界world');
      const position = 7; // Middle of '世界'
      
      const word = extractWordAt(text, position);
      
      expect(word).toBe('hello世界world');
    });
  });
});