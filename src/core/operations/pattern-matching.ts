import { WorkspaceSecurity } from '../security/workspace.js';

export interface PatternMatchOptions {
  preserveIndentation?: boolean;
  normalizeWhitespace?: boolean;
  multiline?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  contextLines?: number;
}

export interface MatchResult {
  match: string;
  startIndex: number;
  endIndex: number;
  lineNumber: number;
  columnNumber: number;
  indentation: string;
  context: {
    before: string[];
    after: string[];
  };
}

export interface ReplacementResult {
  originalContent: string;
  newContent: string;
  matches: MatchResult[];
  replacements: number;
}

export class EnhancedPatternMatching {
  private defaultOptions: PatternMatchOptions = {
    preserveIndentation: true,
    normalizeWhitespace: false,
    multiline: false,
    caseSensitive: true,
    wholeWord: false,
    contextLines: 0,
  };

  constructor(_security: WorkspaceSecurity) {
    // Security instance available for future use
  }

  /**
   * Find all matches of a pattern in content
   */
  findMatches(
    content: string,
    pattern: string | RegExp,
    options: PatternMatchOptions = {}
  ): MatchResult[] {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const lines = content.split('\n');
    const matches: MatchResult[] = [];

    // Convert string patterns to RegExp
    const regex = this.createRegex(pattern, mergedOptions);

    if (mergedOptions.multiline) {
      // Multi-line matching
      const globalRegex = new RegExp(regex.source, regex.flags + 'g');
      let match;

      while ((match = globalRegex.exec(content)) !== null) {
        const matchResult = this.createMatchResult(
          content,
          match,
          mergedOptions
        );
        matches.push(matchResult);
      }
    } else {
      // Line-by-line matching
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        const globalRegex = new RegExp(regex.source, regex.flags + 'g');
        let match;

        while ((match = globalRegex.exec(line)) !== null) {
          const lineStartIndex = this.getLineStartIndex(content, i);
          const absoluteStartIndex = lineStartIndex + (match.index ?? 0);
          const absoluteEndIndex = absoluteStartIndex + (match[0]?.length ?? 0);

          const matchResult: MatchResult = {
            match: match[0] ?? '',
            startIndex: absoluteStartIndex,
            endIndex: absoluteEndIndex,
            lineNumber: i + 1,
            columnNumber: (match.index ?? 0) + 1,
            indentation: this.extractIndentation(line),
            context: this.extractContext(
              lines,
              i,
              mergedOptions.contextLines || 0
            ),
          };

          matches.push(matchResult);
        }
      }
    }

    return matches;
  }

  /**
   * Replace all matches of a pattern with replacement text
   */
  replaceMatches(
    content: string,
    pattern: string | RegExp,
    replacement: string | ((match: MatchResult) => string),
    options: PatternMatchOptions = {}
  ): ReplacementResult {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const matches = this.findMatches(content, pattern, mergedOptions);

    if (matches.length === 0) {
      return {
        originalContent: content,
        newContent: content,
        matches: [],
        replacements: 0,
      };
    }

    let newContent = content;
    let offset = 0;

    for (const match of matches) {
      const replacementText =
        typeof replacement === 'function' ? replacement(match) : replacement;

      const processedReplacement = this.processReplacement(
        replacementText,
        match,
        mergedOptions
      );

      const adjustedStart = match.startIndex + offset;
      const adjustedEnd = match.endIndex + offset;

      newContent =
        newContent.substring(0, adjustedStart) +
        processedReplacement +
        newContent.substring(adjustedEnd);

      offset += processedReplacement.length - match.match.length;
    }

    return {
      originalContent: content,
      newContent,
      matches,
      replacements: matches.length,
    };
  }

  /**
   * Replace content with indentation preservation
   */
  replaceWithIndentation(
    content: string,
    pattern: string | RegExp,
    replacement: string,
    options: PatternMatchOptions = {}
  ): ReplacementResult {
    const mergedOptions = {
      ...this.defaultOptions,
      ...options,
      preserveIndentation: true,
    };

    return this.replaceMatches(
      content,
      pattern,
      match => {
        return this.applyIndentation(replacement, match.indentation || '');
      },
      mergedOptions
    );
  }

  /**
   * Multi-line replacement with context awareness
   */
  replaceMultilineWithContext(
    content: string,
    pattern: string | RegExp,
    replacement: string,
    options: PatternMatchOptions = {}
  ): ReplacementResult {
    const mergedOptions = {
      ...this.defaultOptions,
      ...options,
      multiline: true,
      preserveIndentation: true,
    };

    return this.replaceMatches(
      content,
      pattern,
      match => {
        const baseIndentation = this.extractIndentation(
          content.substring(match.startIndex, match.endIndex).split('\n')[0] ||
            ''
        );

        return this.applyIndentation(replacement, baseIndentation);
      },
      mergedOptions
    );
  }

  /**
   * Smart replacement that preserves code structure
   */
  smartReplace(
    content: string,
    pattern: string | RegExp,
    replacement: string,
    options: PatternMatchOptions = {}
  ): ReplacementResult {
    const mergedOptions = {
      ...this.defaultOptions,
      ...options,
      preserveIndentation: true,
      normalizeWhitespace: true,
    };

    return this.replaceMatches(
      content,
      pattern,
      match => {
        // Extract context for smart replacement
        const lines = content.split('\n');
        const lineIndex = match.lineNumber - 1;

        // Determine if we're in a code block
        const isCodeBlock = this.isInCodeBlock(lines, lineIndex);

        // Apply appropriate formatting
        if (isCodeBlock) {
          return this.applyIndentation(replacement, match.indentation || '');
        } else {
          return this.normalizeWhitespace(replacement);
        }
      },
      mergedOptions
    );
  }

  /**
   * Validate pattern safety
   */
  validatePattern(pattern: string | RegExp): {
    valid: boolean;
    reason?: string;
  } {
    try {
      const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);

      // Check for potentially dangerous patterns
      if (this.isDangerousPattern(regex)) {
        return {
          valid: false,
          reason: 'Pattern may cause excessive backtracking',
        };
      }

      return { valid: true };
    } catch (_error) {
      return { valid: false, reason: `Invalid pattern: ${_error}` };
    }
  }

  private createRegex(
    pattern: string | RegExp,
    options: PatternMatchOptions
  ): RegExp {
    if (pattern instanceof RegExp) {
      return pattern;
    }

    let flags = '';
    if (!options.caseSensitive) flags += 'i';
    if (options.multiline) flags += 'm';

    let processedPattern = pattern;

    if (options.wholeWord) {
      processedPattern = `\\b${processedPattern}\\b`;
    }

    return new RegExp(processedPattern, flags);
  }

  private createMatchResult(
    content: string,
    regexMatch: RegExpExecArray,
    options: PatternMatchOptions
  ): MatchResult {
    const lines = content.split('\n');
    const lineNumber = this.getLineNumber(content, regexMatch.index);
    const columnNumber = this.getColumnNumber(content, regexMatch.index);

    return {
      match: regexMatch[0] ?? '',
      startIndex: regexMatch.index ?? 0,
      endIndex: (regexMatch.index ?? 0) + (regexMatch[0]?.length ?? 0),
      lineNumber,
      columnNumber,
      indentation: this.extractIndentation(lines[lineNumber - 1] ?? ''),
      context: this.extractContext(
        lines,
        lineNumber - 1,
        options.contextLines || 0
      ),
    };
  }

  private getLineStartIndex(content: string, lineIndex: number): number {
    const lines = content.split('\n');
    let index = 0;

    for (let i = 0; i < lineIndex; i++) {
      index += (lines[i] ?? '').length + 1; // +1 for newline
    }

    return index;
  }

  private getLineNumber(content: string, index: number | undefined): number {
    const beforeMatch = content.substring(0, index ?? 0);
    return beforeMatch.split('\n').length;
  }

  private getColumnNumber(content: string, index: number | undefined): number {
    const beforeMatch = content.substring(0, index ?? 0);
    const lines = beforeMatch.split('\n');
    return (lines[lines.length - 1] ?? '').length + 1;
  }

  private extractIndentation(line: string): string {
    const match = line.match(/^(\s*)/);
    return (match && match[1]) || '';
  }

  private extractContext(
    lines: string[],
    lineIndex: number,
    contextLines: number
  ): {
    before: string[];
    after: string[];
  } {
    const start = Math.max(0, lineIndex - contextLines);
    const end = Math.min(lines.length - 1, lineIndex + contextLines);

    return {
      before: lines.slice(start, lineIndex),
      after: lines.slice(lineIndex + 1, end + 1),
    };
  }

  private processReplacement(
    replacement: string,
    match: MatchResult,
    options: PatternMatchOptions
  ): string {
    let processedReplacement = replacement;

    if (options.preserveIndentation) {
      processedReplacement = this.applyIndentation(
        processedReplacement,
        match.indentation || ''
      );
    }

    if (options.normalizeWhitespace) {
      processedReplacement = this.normalizeWhitespace(processedReplacement);
    }

    return processedReplacement;
  }

  private applyIndentation(text: string, indentation: string): string {
    const lines = text.split('\n');

    return lines
      .map((line, index) => {
        // Don't indent empty lines
        if (line.trim() === '') return line;

        // First line keeps original indentation if it has any
        if (index === 0 && line.match(/^\s/)) {
          return line;
        }

        // Apply base indentation to all lines
        return indentation + line;
      })
      .join('\n');
  }

  private normalizeWhitespace(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\s*\n\s*/g, '\n') // Remove spaces around newlines
      .trim();
  }

  private isInCodeBlock(lines: string[], lineIndex: number): boolean {
    // Simple heuristic: if line starts with whitespace, assume code block
    return (lines[lineIndex] ?? '').match(/^\s+/) !== null;
  }

  private isDangerousPattern(regex: RegExp): boolean {
    const dangerousPatterns = [
      /\(\?!/, // Negative lookahead
      /\(\?</, // Negative lookbehind
      /\*\*\+/, // Nested quantifiers
      /\+\+/, // Consecutive quantifiers
      /\{\d+,\}/, // Large ranges
    ];

    return dangerousPatterns.some(pattern => pattern.test(regex.source));
  }
}
