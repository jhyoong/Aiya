import { describe, it, expect, beforeEach } from 'vitest';
import { ASTSearcher } from '../../../src/core/mcp/ast-searcher.js';

describe('ASTSearcher', () => {
  let astSearcher: ASTSearcher;

  beforeEach(() => {
    astSearcher = new ASTSearcher();
  });

  describe('constructor and options', () => {
    it('should initialize with default options', () => {
      const options = astSearcher.getOptions();
      expect(options.fileTypes).toEqual(['.ts', '.tsx', '.js', '.jsx']);
      expect(options.maxDepth).toBe(50);
      expect(options.includeComments).toBe(false);
    });

    it('should accept custom options', () => {
      const customSearcher = new ASTSearcher({
        fileTypes: ['.ts', '.js'],
        maxDepth: 100,
        includeComments: true,
      });

      const options = customSearcher.getOptions();
      expect(options.fileTypes).toEqual(['.ts', '.js']);
      expect(options.maxDepth).toBe(100);
      expect(options.includeComments).toBe(true);
    });

    it('should update options dynamically', () => {
      astSearcher.updateOptions({
        fileTypes: ['.tsx'],
        maxDepth: 25,
      });

      const options = astSearcher.getOptions();
      expect(options.fileTypes).toEqual(['.tsx']);
      expect(options.maxDepth).toBe(25);
      expect(options.includeComments).toBe(false); // Should retain original value
    });
  });

  describe('file support', () => {
    it('should support TypeScript files', () => {
      expect(astSearcher.isFileSupported('test.ts')).toBe(true);
      expect(astSearcher.isFileSupported('test.tsx')).toBe(true);
    });

    it('should support JavaScript files', () => {
      expect(astSearcher.isFileSupported('test.js')).toBe(true);
      expect(astSearcher.isFileSupported('test.jsx')).toBe(true);
    });

    it('should not support unsupported file types', () => {
      expect(astSearcher.isFileSupported('test.py')).toBe(false);
      expect(astSearcher.isFileSupported('test.java')).toBe(false);
      expect(astSearcher.isFileSupported('test.txt')).toBe(false);
    });

    it('should handle case-insensitive extensions', () => {
      expect(astSearcher.isFileSupported('test.TS')).toBe(true);
      expect(astSearcher.isFileSupported('test.JS')).toBe(true);
    });

    it('should get supported extensions list', () => {
      const extensions = astSearcher.getSupportedExtensions();
      expect(extensions).toContain('.ts');
      expect(extensions).toContain('.tsx');
      expect(extensions).toContain('.js');
      expect(extensions).toContain('.jsx');
    });
  });

  describe('function declarations', () => {
    it('should find regular function declarations', () => {
      const content = `
function calculateSum(a, b) {
  return a + b;
}
      `.trim();

      const results = astSearcher.searchInContent(
        content,
        'function calculateSum',
        'test.js'
      );

      expect(results).toHaveLength(1);
      expect(results[0].nodeType).toBe('FunctionDeclaration');
      expect(results[0].text).toContain('calculateSum');
      expect(results[0].metadata?.name).toBe('calculateSum');
      expect(results[0].metadata?.paramCount).toBe(2);
    });

    it('should find async function declarations', () => {
      const content = `
async function fetchData() {
  return await fetch('/api/data');
}
      `.trim();

      const results = astSearcher.searchInContent(
        content,
        'function fetchData',
        'test.js'
      );

      expect(results).toHaveLength(1);
      expect(results[0].metadata?.name).toBe('fetchData');
      expect(results[0].metadata?.isAsync).toBe(true);
    });

    it('should find arrow functions', () => {
      const content = `
const processData = (data) => {
  return data.map(item => item.value);
};
      `.trim();

      const results = astSearcher.searchInContent(
        content,
        'function',
        'test.js'
      );

      expect(results.length).toBeGreaterThan(0);
      const arrowFunction = results.find(
        r => r.nodeType === 'ArrowFunctionExpression'
      );
      expect(arrowFunction).toBeDefined();
    });

    it('should find generator functions', () => {
      const content = `
function* numberGenerator() {
  yield 1;
  yield 2;
  yield 3;
}
      `.trim();

      const results = astSearcher.searchInContent(
        content,
        'function numberGenerator',
        'test.js'
      );

      expect(results).toHaveLength(1);
      expect(results[0].metadata?.name).toBe('numberGenerator');
      expect(results[0].metadata?.isGenerator).toBe(true);
    });
  });

  describe('class declarations', () => {
    it('should find class declarations', () => {
      const content = `
class UserService {
  constructor(apiUrl) {
    this.apiUrl = apiUrl;
  }
  
  async getUser(id) {
    return fetch(\`\${this.apiUrl}/users/\${id}\`);
  }
}
      `.trim();

      const results = astSearcher.searchInContent(
        content,
        'class UserService',
        'test.js'
      );

      expect(results).toHaveLength(1);
      expect(results[0].nodeType).toBe('ClassDeclaration');
      expect(results[0].metadata?.name).toBe('UserService');
      expect(results[0].metadata?.hasSuper).toBe(false);
    });

    it('should find class with inheritance', () => {
      const content = `
class AdminService extends UserService {
  constructor(apiUrl, adminKey) {
    super(apiUrl);
    this.adminKey = adminKey;
  }
}
      `.trim();

      const results = astSearcher.searchInContent(
        content,
        'class AdminService',
        'test.js'
      );

      expect(results).toHaveLength(1);
      expect(results[0].metadata?.name).toBe('AdminService');
      expect(results[0].metadata?.hasSuper).toBe(true);
    });
  });

  describe('import declarations', () => {
    it('should find import statements', () => {
      const content = `
import React from 'react';
import { useState, useEffect } from 'react';
import * as utils from './utils';
      `.trim();

      const results = astSearcher.searchInContent(
        content,
        'import',
        'test.jsx'
      );

      expect(results.length).toBeGreaterThanOrEqual(3);

      // Check default import
      const defaultImport = results.find(r =>
        r.metadata?.specifiers?.some(
          (spec: any) => spec.type === 'default' && spec.name === 'React'
        )
      );
      expect(defaultImport).toBeDefined();
      expect(defaultImport?.metadata?.source).toBe('react');

      // Check named imports
      const namedImport = results.find(r =>
        r.metadata?.specifiers?.some((spec: any) => spec.name === 'useState')
      );
      expect(namedImport).toBeDefined();

      // Check namespace import
      const namespaceImport = results.find(r =>
        r.metadata?.specifiers?.some(
          (spec: any) => spec.type === 'namespace' && spec.name === 'utils'
        )
      );
      expect(namespaceImport).toBeDefined();
    });
  });

  describe('variable declarations', () => {
    it('should find const declarations', () => {
      const content = `
const API_URL = 'https://api.example.com';
const config = { timeout: 5000 };
      `.trim();

      const results = astSearcher.searchInContent(content, 'const', 'test.js');

      expect(results.length).toBeGreaterThanOrEqual(2);

      const apiUrlDecl = results.find(r =>
        r.metadata?.declarations?.some((decl: any) => decl.name === 'API_URL')
      );
      expect(apiUrlDecl).toBeDefined();
      expect(apiUrlDecl?.metadata?.kind).toBe('const');
    });

    it('should find let declarations', () => {
      const content = `
let counter = 0;
let isActive = true;
      `.trim();

      const results = astSearcher.searchInContent(content, 'let', 'test.js');

      expect(results.length).toBeGreaterThanOrEqual(2);
      results.forEach(result => {
        expect(result.metadata?.kind).toBe('let');
      });
    });

    it('should find var declarations', () => {
      const content = `
var globalVar = 'test';
var tempValue;
      `.trim();

      const results = astSearcher.searchInContent(content, 'var', 'test.js');

      expect(results.length).toBeGreaterThanOrEqual(2);
      results.forEach(result => {
        expect(result.metadata?.kind).toBe('var');
      });
    });
  });

  describe('TypeScript-specific constructs', () => {
    it('should find interface declarations', () => {
      const content = `
interface User {
  id: number;
  name: string;
  email?: string;
}

interface AdminUser extends User {
  permissions: string[];
}
      `.trim();

      const results = astSearcher.searchInContent(
        content,
        'interface',
        'test.ts'
      );

      expect(results.length).toBeGreaterThanOrEqual(2);

      const userInterface = results.find(r => r.metadata?.name === 'User');
      expect(userInterface).toBeDefined();
      expect(userInterface?.nodeType).toBe('TSInterfaceDeclaration');
      expect(userInterface?.metadata?.hasExtends).toBe(false);

      const adminInterface = results.find(
        r => r.metadata?.name === 'AdminUser'
      );
      expect(adminInterface).toBeDefined();
      expect(adminInterface?.metadata?.hasExtends).toBe(true);
    });

    it('should find type alias declarations', () => {
      const content = `
type Status = 'pending' | 'completed' | 'failed';
type UserRole = 'admin' | 'user' | 'guest';
      `.trim();

      const results = astSearcher.searchInContent(content, 'type', 'test.ts');

      expect(results.length).toBeGreaterThanOrEqual(2);

      const statusType = results.find(r => r.metadata?.name === 'Status');
      expect(statusType).toBeDefined();
      expect(statusType?.nodeType).toBe('TSTypeAliasDeclaration');
    });
  });

  describe('pattern matching', () => {
    it('should match specific function names', () => {
      const content = `
function processData() { return true; }
function calculateSum() { return 0; }
function processFile() { return null; }
      `.trim();

      const results = astSearcher.searchInContent(
        content,
        'function processData',
        'test.js'
      );

      expect(results).toHaveLength(1);
      expect(results[0].metadata?.name).toBe('processData');
    });

    it('should match generic patterns', () => {
      const content = `
function test() {}
class Test {}
const test = 123;
      `.trim();

      const results = astSearcher.searchInContent(
        content,
        'function',
        'test.js'
      );

      // Should find function declaration but not class or variable
      const functionResults = results.filter(
        r => r.nodeType === 'FunctionDeclaration'
      );
      expect(functionResults).toHaveLength(1);
    });
  });

  describe('position accuracy', () => {
    it('should accurately report line and column positions', () => {
      const content = `
function first() {}

class Second {
  method() {}
}
      `.trim();

      const results = astSearcher.searchInContent(
        content,
        'function',
        'test.js'
      );

      expect(results.length).toBeGreaterThan(0);

      // Function should be on line 1
      const functionResult = results.find(
        r => r.nodeType === 'FunctionDeclaration'
      );
      expect(functionResult?.line).toBe(1);
      expect(functionResult?.column).toBe(1);
    });

    it('should provide accurate context', () => {
      const content = `
const value = 123;
function testFunc() {
  return value * 2;
}
      `.trim();

      const results = astSearcher.searchInContent(
        content,
        'function',
        'test.js'
      );

      const functionResult = results.find(
        r => r.nodeType === 'FunctionDeclaration'
      );
      expect(functionResult?.context).toBe('function testFunc() {');
    });
  });

  describe('error handling', () => {
    it('should handle invalid TypeScript syntax gracefully', () => {
      const content = 'function invalid syntax here {{{ broken';

      // Should not throw, just return empty results
      const results = astSearcher.searchInContent(
        content,
        'function',
        'test.ts'
      );
      expect(results).toHaveLength(0);
    });

    it('should handle empty content', () => {
      const results = astSearcher.searchInContent('', 'function', 'test.js');
      expect(results).toHaveLength(0);
    });

    it('should return empty results for unsupported files', () => {
      const content = 'def some_function(): return True';
      const results = astSearcher.searchInContent(
        content,
        'function',
        'test.py'
      );
      expect(results).toHaveLength(0);
    });
  });

  describe('complex code structures', () => {
    it('should handle nested functions and classes', () => {
      const content = `
class OuterClass {
  method() {
    function innerFunction() {
      return true;
    }
    return innerFunction();
  }
}
      `.trim();

      const results = astSearcher.searchInContent(
        content,
        'function',
        'test.js'
      );

      // Should find both the method and inner function
      expect(results.length).toBeGreaterThan(0);

      const innerFunc = results.find(
        r =>
          r.nodeType === 'FunctionDeclaration' &&
          r.metadata?.name === 'innerFunction'
      );
      expect(innerFunc).toBeDefined();
    });

    it('should handle modern JavaScript/TypeScript features', () => {
      const content = `
const MyComponent: React.FC<Props> = ({ children }) => {
  const [state, setState] = useState(false);
  
  useEffect(() => {
    console.log('Component mounted');
  }, []);
  
  return <div>{children}</div>;
};
      `.trim();

      const results = astSearcher.searchInContent(
        content,
        'function',
        'test.tsx'
      );

      // Should find arrow functions
      expect(results.length).toBeGreaterThan(0);
      const arrowFunctions = results.filter(
        r => r.nodeType === 'ArrowFunctionExpression'
      );
      expect(arrowFunctions.length).toBeGreaterThan(0);
    });
  });

  describe('performance and limits', () => {
    it('should respect maxDepth setting', () => {
      const shallowSearcher = new ASTSearcher({ maxDepth: 2 });

      // Create deeply nested structure
      const content = `
class Level1 {
  method1() {
    class Level2 {
      method2() {
        function level3() {
          function level4() {
            return true;
          }
        }
      }
    }
  }
}
      `.trim();

      const results = shallowSearcher.searchInContent(
        content,
        'function',
        'test.js'
      );

      // With shallow depth, should find fewer nested functions
      expect(results.length).toBeLessThan(4);
    });
  });
});
