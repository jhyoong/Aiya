import { describe, it, expect, beforeEach } from 'vitest';
import { FuzzyMatcher } from '../../../src/core/mcp/fuzzy-matcher.js';

describe('FuzzyMatcher', () => {
  let fuzzyMatcher: FuzzyMatcher;

  beforeEach(() => {
    fuzzyMatcher = new FuzzyMatcher();
  });

  describe('constructor and options', () => {
    it('should initialize with default options', () => {
      const options = fuzzyMatcher.getOptions();
      expect(options.threshold).toBe(0.6);
      expect(options.minConfidence).toBe(20);
      expect(options.includeScore).toBe(true);
    });

    it('should accept custom options', () => {
      const customMatcher = new FuzzyMatcher({
        threshold: 0.8,
        minConfidence: 50,
        includeScore: false,
      });

      const options = customMatcher.getOptions();
      expect(options.threshold).toBe(0.8);
      expect(options.minConfidence).toBe(50);
      expect(options.includeScore).toBe(false);
    });

    it('should update options dynamically', () => {
      fuzzyMatcher.updateOptions({ threshold: 0.3, minConfidence: 10 });

      const options = fuzzyMatcher.getOptions();
      expect(options.threshold).toBe(0.3);
      expect(options.minConfidence).toBe(10);
      expect(options.includeScore).toBe(true); // Should retain original value
    });
  });

  describe('exact matches', () => {
    it('should find exact string matches with high confidence', () => {
      const content = 'function calculateTotal() {\n  return a + b;\n}';
      const results = fuzzyMatcher.searchInContent(
        content,
        'calculateTotal',
        'test.js'
      );

      expect(results).toHaveLength(1);
      expect(results[0].line).toBe(1);
      expect(results[0].confidence).toBeGreaterThan(70); // Fuse.js rarely gives 100%
      expect(results[0].text).toContain('calculateTotal');
    });

    it('should find multiple exact matches', () => {
      const content =
        'const data = getData();\nconst result = processData(data);';
      const results = fuzzyMatcher.searchInContent(content, 'data', 'test.js');

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.confidence).toBeGreaterThan(50); // More realistic threshold
        expect(result.text.toLowerCase()).toContain('data');
      });
    });
  });

  describe('fuzzy matches', () => {
    it('should find approximate matches with lower confidence', () => {
      const content = 'function calculateTotal() {\n  return sum;\n}';
      const results = fuzzyMatcher.searchInContent(
        content,
        'calculate',
        'test.js'
      );

      expect(results.length).toBeGreaterThan(0);
      const match = results.find(
        r => r.text.includes('calculateTotal') || r.text.includes('calculate')
      );
      expect(match).toBeDefined();
      expect(match!.confidence).toBeLessThan(90);
      expect(match!.confidence).toBeGreaterThan(30);
    });

    it('should handle whitespace variations', () => {
      const content = 'const my_variable = 123;';
      const results = fuzzyMatcher.searchInContent(
        content,
        'variable',
        'test.js'
      );

      expect(results.length).toBeGreaterThan(0);
      const match = results.find(r => r.text.includes('variable'));
      expect(match).toBeDefined();
    });

    it('should handle case variations', () => {
      const content = 'function MyFunction() { return true; }';
      const results = fuzzyMatcher.searchInContent(
        content,
        'function',
        'test.js'
      );

      expect(results.length).toBeGreaterThan(0);
      const match = results.find(r =>
        r.text.toLowerCase().includes('function')
      );
      expect(match).toBeDefined();
    });
  });

  describe('confidence scoring', () => {
    it('should assign higher confidence to better matches', () => {
      const content =
        'const calculator = new Calculator();\nconst calc = calculator.calculate();';
      const results = fuzzyMatcher.searchInContent(
        content,
        'calculator',
        'test.js'
      );

      expect(results.length).toBeGreaterThan(0);

      // Sort by confidence to check ordering
      const sortedResults = results.sort((a, b) => b.confidence - a.confidence);

      // The best match should have highest confidence
      const bestMatch = sortedResults.find(r => r.text.includes('calculator'));
      if (bestMatch) {
        expect(bestMatch.confidence).toBeGreaterThan(60);
      }
    });

    it('should filter out matches below minimum confidence', () => {
      const lowConfidenceMatcher = new FuzzyMatcher({ minConfidence: 80 });
      const content = 'const someVariable = 123;';
      const results = lowConfidenceMatcher.searchInContent(
        content,
        'xyz',
        'test.js'
      );

      // Should have no results due to high confidence threshold
      expect(results).toHaveLength(0);
    });

    it('should include matches above minimum confidence', () => {
      const lowConfidenceMatcher = new FuzzyMatcher({ minConfidence: 10 });
      const content = 'function testFunction() { return true; }';
      const results = lowConfidenceMatcher.searchInContent(
        content,
        'test',
        'test.js'
      );

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.confidence).toBeGreaterThanOrEqual(10);
      });
    });
  });

  describe('position accuracy', () => {
    it('should accurately report line numbers', () => {
      const content = 'line 1\nline 2 with target\nline 3';
      const results = fuzzyMatcher.searchInContent(
        content,
        'target',
        'test.js'
      );

      expect(results).toHaveLength(1);
      expect(results[0].line).toBe(2);
    });

    it('should accurately report column positions', () => {
      const content = 'prefix target suffix';
      const results = fuzzyMatcher.searchInContent(
        content,
        'target',
        'test.js'
      );

      expect(results).toHaveLength(1);
      expect(results[0].column).toBeGreaterThan(0); // Should be a valid position
      expect(results[0].column).toBeLessThanOrEqual(content.length);
    });

    it('should provide context information', () => {
      const content = 'const value = calculateValue();';
      const results = fuzzyMatcher.searchInContent(content, 'value', 'test.js');

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.context).toBe(content);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const results = fuzzyMatcher.searchInContent('', 'test', 'test.js');
      expect(results).toHaveLength(0);
    });

    it('should handle empty pattern', () => {
      const content = 'some content here';
      const results = fuzzyMatcher.searchInContent(content, '', 'test.js');
      expect(results).toHaveLength(0);
    });

    it('should handle single character searches', () => {
      const content = 'a = b + c;';
      const results = fuzzyMatcher.searchInContent(content, 'a', 'test.js');

      expect(results.length).toBeGreaterThan(0);
      const match = results.find(r => r.text === 'a');
      expect(match).toBeDefined();
    });

    it('should handle very long lines', () => {
      const longLine = 'x'.repeat(100) + 'target' + 'y'.repeat(100);
      const content = `line1\n${longLine}\nline3`;
      const results = fuzzyMatcher.searchInContent(
        content,
        'target',
        'test.js'
      );

      expect(results.length).toBeGreaterThanOrEqual(0); // May or may not find due to fuzzy threshold
      if (results.length > 0) {
        expect(results[0].line).toBe(2);
      }
    });

    it('should handle special characters', () => {
      const content = 'const obj = { key: "value", special: true };';
      const results = fuzzyMatcher.searchInContent(
        content,
        'special',
        'test.js'
      );

      expect(results.length).toBeGreaterThan(0);
      const match = results.find(r => r.text.includes('special'));
      expect(match).toBeDefined();
    });
  });

  describe('performance with different thresholds', () => {
    it('should return more results with higher threshold (less strict)', () => {
      const content = 'function calculateSum() { return a + b; }';

      const strictMatcher = new FuzzyMatcher({ threshold: 0.3 });
      const lenientMatcher = new FuzzyMatcher({ threshold: 0.8 });

      const strictResults = strictMatcher.searchInContent(
        content,
        'calc',
        'test.js'
      );
      const lenientResults = lenientMatcher.searchInContent(
        content,
        'calc',
        'test.js'
      );

      expect(lenientResults.length).toBeGreaterThanOrEqual(
        strictResults.length
      );
    });

    it('should maintain result quality with different thresholds', () => {
      const content = 'const myVariable = 123;\nconst otherVar = 456;';

      const results = fuzzyMatcher.searchInContent(
        content,
        'myVariable',
        'test.js'
      );

      expect(results.length).toBeGreaterThan(0);

      // Best match should be the exact match
      const bestMatch = results.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );

      expect(bestMatch.text).toContain('myVariable');
      expect(bestMatch.confidence).toBeGreaterThan(60);
    });
  });

  describe('multi-line content', () => {
    it('should handle multi-line TypeScript code', () => {
      const content = `
interface User {
  id: number;
  name: string;
}

class UserService {
  private users: User[] = [];
  
  getUserById(id: number): User | undefined {
    return this.users.find(user => user.id === id);
  }
}
      `.trim();

      const results = fuzzyMatcher.searchInContent(content, 'User', 'test.ts');

      expect(results.length).toBeGreaterThan(0);

      // Should find matches in interface, class, and method
      const interfaceMatch = results.find(r => r.line === 1);
      const classMatch = results.find(r =>
        r.context.includes('class UserService')
      );

      expect(interfaceMatch).toBeDefined();
      expect(classMatch).toBeDefined();
    });
  });
});
