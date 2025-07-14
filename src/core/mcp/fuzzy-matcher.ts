import Fuse from 'fuse.js';

export interface FuzzyMatch {
  line: number;
  column: number;
  text: string;
  confidence: number; // 0-100 scale
  context: string; // Full line containing the match
}

export interface FuzzySearchOptions {
  threshold?: number; // 0.0 (exact) to 1.0 (anything), default 0.6
  minConfidence?: number; // Minimum confidence score 0-100, default 20
  includeScore?: boolean; // Include Fuse.js score in results
}

/**
 * FuzzyMatcher - Provides fuzzy string matching with confidence scoring
 *
 * Uses Fuse.js for approximate string matching with configurable sensitivity.
 * Returns matches with confidence scores on a 0-100 scale.
 */
export class FuzzyMatcher {
  private options: Required<FuzzySearchOptions>;

  constructor(options: FuzzySearchOptions = {}) {
    this.options = {
      threshold: options.threshold ?? 0.6,
      minConfidence: options.minConfidence ?? 20,
      includeScore: options.includeScore ?? true,
    };
  }

  /**
   * Search for fuzzy matches in file content
   */
  searchInContent(
    content: string,
    pattern: string,
    _filePath: string
  ): FuzzyMatch[] {
    const lines = content.split('\n');
    const matches: FuzzyMatch[] = [];

    // Prepare data for Fuse.js - each line with metadata
    const searchData = lines.map((line, index) => ({
      content: line,
      lineNumber: index + 1,
      normalizedContent: this.normalizeForSearch(line),
    }));

    // Configure Fuse.js for fuzzy matching
    const fuse = new Fuse(searchData, {
      keys: ['normalizedContent'],
      threshold: this.options.threshold,
      includeScore: this.options.includeScore,
      includeMatches: true,
      minMatchCharLength: Math.max(1, Math.floor(pattern.length * 0.3)),
      findAllMatches: true,
    });

    // Perform fuzzy search
    const fuseResults = fuse.search(this.normalizeForSearch(pattern));

    for (const result of fuseResults) {
      const { item } = result;
      const score = result.score ?? 0;

      // Convert Fuse.js score (0=perfect, 1=worst) to confidence (100=perfect, 0=worst)
      const confidence = Math.round((1 - score) * 100);

      // Skip matches below minimum confidence
      if (confidence < this.options.minConfidence) {
        continue;
      }

      // Find the best match position within the line
      const matchPosition = this.findBestMatchPosition(
        item.content,
        pattern,
        result.matches?.[0]
      );

      matches.push({
        line: item.lineNumber,
        column: matchPosition.column,
        text: matchPosition.matchedText,
        confidence,
        context: item.content,
      });
    }

    return matches.sort((a, b) => {
      // Sort by confidence (highest first), then by line number
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }
      return a.line - b.line;
    });
  }

  /**
   * Normalize text for better fuzzy matching
   */
  private normalizeForSearch(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .replace(/[^\w\s]/g, ''); // Remove punctuation for better matching
  }

  /**
   * Find the best match position within a line
   */
  private findBestMatchPosition(
    line: string,
    pattern: string,
    fuseMatch?: any
  ): { column: number; matchedText: string } {
    // Try simple substring match first for better results
    const normalizedLine = line.toLowerCase();
    const normalizedPattern = pattern.toLowerCase();

    // Check for exact substring match
    const exactIndex = normalizedLine.indexOf(normalizedPattern);
    if (exactIndex !== -1) {
      return {
        column: exactIndex + 1, // Convert to 1-based
        matchedText: line.substring(exactIndex, exactIndex + pattern.length),
      };
    }

    // If Fuse.js provided match indices, use them
    if (fuseMatch?.indices && fuseMatch.indices.length > 0) {
      const [startIndex, endIndex] = fuseMatch.indices[0];

      // Use the normalized match indices directly on the original line
      const matchLength = Math.min(
        endIndex - startIndex + 1,
        line.length - startIndex
      );

      return {
        column: startIndex + 1, // Convert to 1-based
        matchedText: line.substring(startIndex, startIndex + matchLength),
      };
    }

    // Fallback: use simple fuzzy matching
    const bestMatch = this.findBestSubstringMatch(line, pattern);
    return {
      column: bestMatch.start + 1, // Convert to 1-based
      matchedText: bestMatch.text,
    };
  }

  /**
   * Find best substring match using simple algorithm
   */
  private findBestSubstringMatch(
    text: string,
    pattern: string
  ): { start: number; text: string } {
    const normalizedText = text.toLowerCase();
    const normalizedPattern = pattern.toLowerCase();

    // Try exact match first
    const index = normalizedText.indexOf(normalizedPattern);
    if (index !== -1) {
      return {
        start: index,
        text: text.substring(index, index + pattern.length),
      };
    }

    // Try to find the best word that contains part of the pattern
    const words = text.split(/\s+/);
    let bestMatch = { start: 0, text: words[0] || pattern };
    let bestScore = 0;
    let currentIndex = 0;

    for (const word of words) {
      const wordIndex = text.indexOf(word, currentIndex);
      const score = this.calculateSimpleSimilarity(
        word.toLowerCase(),
        normalizedPattern
      );

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { start: wordIndex, text: word };
      }

      currentIndex = wordIndex + word.length;
    }

    // If no good word match, fall back to pattern-length substring
    if (bestScore < 0.3) {
      return {
        start: 0,
        text: text.substring(0, Math.min(pattern.length, text.length)),
      };
    }

    return bestMatch;
  }

  /**
   * Calculate simple similarity between two strings
   */
  private calculateSimpleSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;

    let matches = 0;
    const minLength = Math.min(str1.length, str2.length);

    for (let i = 0; i < minLength; i++) {
      if (str1[i] === str2[i]) {
        matches++;
      }
    }

    return matches / maxLength;
  }

  /**
   * Update search options
   */
  updateOptions(newOptions: FuzzySearchOptions): void {
    this.options = {
      ...this.options,
      ...newOptions,
    };
  }

  /**
   * Get current options
   */
  getOptions(): Required<FuzzySearchOptions> {
    return { ...this.options };
  }
}
