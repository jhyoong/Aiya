import { parse } from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/typescript-estree';
import * as path from 'path';

export interface ASTMatch {
  line: number;
  column: number;
  text: string;
  nodeType: string;
  context: string; // Full line containing the match
  metadata?: Record<string, unknown>; // Additional context like function name, class name, etc.
}

export interface ASTSearchOptions {
  fileTypes?: string[]; // File extensions to support, default: ['.ts', '.tsx', '.js', '.jsx']
  maxDepth?: number; // Maximum AST traversal depth, default: 50
  includeComments?: boolean; // Include comment nodes in search, default: false
}

/**
 * ASTSearcher - Provides Abstract Syntax Tree-based code structure search
 *
 * Uses TypeScript's AST parser to find code patterns like function declarations,
 * class definitions, imports, variable declarations, etc.
 */
export class ASTSearcher {
  private options: Required<ASTSearchOptions>;
  private supportedExtensions: Set<string>;

  constructor(options: ASTSearchOptions = {}) {
    this.options = {
      fileTypes: options.fileTypes ?? ['.ts', '.tsx', '.js', '.jsx'],
      maxDepth: options.maxDepth ?? 50,
      includeComments: options.includeComments ?? false,
    };

    this.supportedExtensions = new Set(this.options.fileTypes);
  }

  /**
   * Check if file type is supported for AST parsing
   */
  isFileSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.has(ext);
  }

  /**
   * Search for AST patterns in file content
   */
  searchInContent(
    content: string,
    pattern: string,
    filePath: string
  ): ASTMatch[] {
    if (!this.isFileSupported(filePath)) {
      return [];
    }

    try {
      // Parse the content into an AST
      const ast = this.parseContent(content, filePath);
      if (!ast) {
        return [];
      }

      // Search for patterns in the AST
      const matches = this.searchInAST(ast, pattern, content);

      return matches.sort((a, b) => {
        // Sort by line number
        return a.line - b.line;
      });
    } catch (error) {
      // If parsing fails, return empty results rather than throwing
      console.warn(`AST parsing failed for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Parse content into TypeScript AST
   */
  private parseContent(
    content: string,
    filePath: string
  ): TSESTree.Program | null {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const isTypeScript = ext === '.ts' || ext === '.tsx';
      const isJSX = ext === '.tsx' || ext === '.jsx';

      return parse(content, {
        loc: true,
        range: true,
        comments: this.options.includeComments,
        tokens: false,
        ecmaVersion: 'latest',
        sourceType: 'module',
        jsx: isJSX,
        ...(isTypeScript && {
          errorOnUnknownASTType: false,
          errorOnTypeScriptSyntacticAndSemanticIssues: false,
        }),
      });
    } catch (_error) {
      return null;
    }
  }

  /**
   * Search for patterns in the AST
   */
  private searchInAST(
    ast: TSESTree.Program,
    pattern: string,
    content: string
  ): ASTMatch[] {
    const lines = content.split('\n');
    const matches: ASTMatch[] = [];
    const searchPatterns = this.parseSearchPattern(pattern);

    const traverse = (node: TSESTree.Node, depth = 0): void => {
      if (depth > this.options.maxDepth) {
        return;
      }

      // Check if current node matches any search patterns
      for (const searchPattern of searchPatterns) {
        const match = this.matchNodeAgainstPattern(node, searchPattern, lines);
        if (match) {
          matches.push(match);
        }
      }

      // Recursively traverse child nodes
      for (const key in node) {
        const value = (node as unknown as Record<string, unknown>)[key];
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === 'object' && 'type' in item) {
              traverse(item as TSESTree.Node, depth + 1);
            }
          }
        } else if (value && typeof value === 'object' && 'type' in value) {
          traverse(value as TSESTree.Node, depth + 1);
        }
      }
    };

    traverse(ast);
    return matches;
  }

  /**
   * Parse search pattern into structured search criteria
   */
  private parseSearchPattern(pattern: string): SearchPattern[] {
    const patterns: SearchPattern[] = [];

    // Normalize pattern
    const normalizedPattern = pattern.toLowerCase().trim();

    // Function patterns
    if (normalizedPattern.includes('function')) {
      patterns.push({
        type: 'function',
        nodeTypes: [
          'FunctionDeclaration',
          'FunctionExpression',
          'ArrowFunctionExpression',
        ],
        namePattern: this.extractNamePattern(normalizedPattern, 'function'),
      });
    }

    // Class patterns
    if (normalizedPattern.includes('class')) {
      patterns.push({
        type: 'class',
        nodeTypes: ['ClassDeclaration'],
        namePattern: this.extractNamePattern(normalizedPattern, 'class'),
      });
    }

    // Import patterns
    if (normalizedPattern.includes('import')) {
      patterns.push({
        type: 'import',
        nodeTypes: ['ImportDeclaration'],
        namePattern: this.extractNamePattern(normalizedPattern, 'import'),
      });
    }

    // Variable patterns
    if (
      normalizedPattern.includes('const') ||
      normalizedPattern.includes('let') ||
      normalizedPattern.includes('var')
    ) {
      patterns.push({
        type: 'variable',
        nodeTypes: ['VariableDeclaration'],
        namePattern: this.extractNamePattern(
          normalizedPattern,
          '(?:const|let|var)'
        ),
      });
    }

    // Interface patterns (TypeScript)
    if (normalizedPattern.includes('interface')) {
      patterns.push({
        type: 'interface',
        nodeTypes: ['TSInterfaceDeclaration'],
        namePattern: this.extractNamePattern(normalizedPattern, 'interface'),
      });
    }

    // Type patterns (TypeScript)
    if (normalizedPattern.includes('type')) {
      patterns.push({
        type: 'type',
        nodeTypes: ['TSTypeAliasDeclaration'],
        namePattern: this.extractNamePattern(normalizedPattern, 'type'),
      });
    }

    // If no specific patterns found, search for generic node type
    if (patterns.length === 0) {
      patterns.push({
        type: 'generic',
        nodeTypes: [normalizedPattern],
        namePattern: null,
      });
    }

    return patterns;
  }

  /**
   * Extract name pattern from search string
   */
  private extractNamePattern(pattern: string, keyword: string): string | null {
    const regex = new RegExp(`${keyword}\\s+([\\w_$][\\w\\d_$]*)`, 'i');
    const match = pattern.match(regex);
    return match && match[1] ? match[1] : null;
  }

  /**
   * Check if AST node matches the search pattern
   */
  private matchNodeAgainstPattern(
    node: TSESTree.Node,
    pattern: SearchPattern,
    lines: string[]
  ): ASTMatch | null {
    // Check if node type matches
    if (!pattern.nodeTypes.includes(node.type)) {
      return null;
    }

    // Get node location
    if (!node.loc || !node.loc.start) {
      return null;
    }

    const line = node.loc.start.line;
    const column = node.loc.start.column + 1; // Convert to 1-based
    const context = lines[line - 1] || '';

    // Extract node information
    const nodeInfo = this.extractNodeInfo(node);

    // Check name pattern if specified
    if (pattern.namePattern && typeof nodeInfo.name === 'string') {
      const nameMatch = nodeInfo.name
        .toLowerCase()
        .includes(pattern.namePattern.toLowerCase());
      if (!nameMatch) {
        return null;
      }
    }

    // Extract matched text from the line
    const text = this.extractMatchedText(context, nodeInfo, pattern);

    return {
      line,
      column,
      text,
      nodeType: node.type,
      context,
      metadata: {
        ...nodeInfo,
        patternType: pattern.type,
      },
    };
  }

  /**
   * Extract relevant information from AST node
   */
  private extractNodeInfo(node: TSESTree.Node): Record<string, unknown> {
    const info: Record<string, unknown> = {};

    switch (node.type) {
      case 'FunctionDeclaration': {
        const funcNode = node as TSESTree.FunctionDeclaration;
        info.name = funcNode.id?.name || '<anonymous>';
        info.isAsync = funcNode.async;
        info.isGenerator = funcNode.generator;
        info.paramCount = funcNode.params.length;
        break;
      }

      case 'ClassDeclaration': {
        const classNode = node as TSESTree.ClassDeclaration;
        info.name = classNode.id?.name || '<anonymous>';
        info.hasSuper = !!classNode.superClass;
        break;
      }

      case 'ImportDeclaration': {
        const importNode = node as TSESTree.ImportDeclaration;
        info.source = importNode.source.value;
        info.specifiers = importNode.specifiers.map(spec => {
          if (spec.type === 'ImportDefaultSpecifier') {
            return { type: 'default', name: spec.local.name };
          } else if (spec.type === 'ImportNamespaceSpecifier') {
            return { type: 'namespace', name: spec.local.name };
          } else {
            return { type: 'named', name: spec.local.name };
          }
        });
        break;
      }

      case 'VariableDeclaration': {
        const varNode = node as TSESTree.VariableDeclaration;
        info.kind = varNode.kind;
        info.declarations = varNode.declarations.map(decl => {
          const id = decl.id;
          if (id.type === 'Identifier') {
            return { name: id.name };
          }
          return { name: '<complex>' };
        });
        break;
      }

      case 'TSInterfaceDeclaration': {
        const interfaceNode = node as TSESTree.TSInterfaceDeclaration;
        info.name = interfaceNode.id.name;
        info.hasExtends =
          interfaceNode.extends && interfaceNode.extends.length > 0;
        break;
      }

      case 'TSTypeAliasDeclaration': {
        const typeNode = node as TSESTree.TSTypeAliasDeclaration;
        info.name = typeNode.id.name;
        break;
      }
    }

    return info;
  }

  /**
   * Extract the matched text from the context line
   */
  private extractMatchedText(
    context: string,
    nodeInfo: Record<string, unknown>,
    pattern: SearchPattern
  ): string {
    // Try to extract a meaningful portion of the line
    const trimmed = context.trim();

    // For functions, try to get the function signature
    if (pattern.type === 'function' && nodeInfo.name) {
      const funcMatch = trimmed.match(
        new RegExp(`.*\\b${nodeInfo.name}\\b.*?\\{?`, 'i')
      );
      if (funcMatch) {
        return funcMatch[0].replace(/\s*\{$/, '').trim();
      }
    }

    // For classes, get the class declaration
    if (pattern.type === 'class' && nodeInfo.name) {
      const classMatch = trimmed.match(
        new RegExp(`.*\\bclass\\s+${nodeInfo.name}\\b.*?\\{?`, 'i')
      );
      if (classMatch) {
        return classMatch[0].replace(/\s*\{$/, '').trim();
      }
    }

    // For imports, get the import statement
    if (pattern.type === 'import') {
      const importMatch = trimmed.match(/^import\s+.*?from\s+.*?['"];?/i);
      if (importMatch) {
        return importMatch[0];
      }
    }

    // Fallback: return up to first 100 characters of the line
    return trimmed.length > 100 ? trimmed.substring(0, 100) + '...' : trimmed;
  }

  /**
   * Update search options
   */
  updateOptions(newOptions: ASTSearchOptions): void {
    this.options = {
      ...this.options,
      ...newOptions,
    };

    if (newOptions.fileTypes) {
      this.supportedExtensions = new Set(newOptions.fileTypes);
    }
  }

  /**
   * Get current options
   */
  getOptions(): Required<ASTSearchOptions> {
    return { ...this.options };
  }

  /**
   * Get supported file extensions
   */
  getSupportedExtensions(): string[] {
    return Array.from(this.supportedExtensions);
  }
}

interface SearchPattern {
  type: string;
  nodeTypes: string[];
  namePattern: string | null;
}
