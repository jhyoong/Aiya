## Shell Execution & Error Capture
Goal: Allow the agent to run commands and learn from outputs
Components:

Shell Tool (MCP)

Execute commands safely
Capture stdout, stderr, and exit codes
Stream output for long-running commands


Error Pattern Recognition

Parse common error formats (TypeScript, ESLint, test failures)
Extract actionable information from errors
Maintain error context for follow-up actions


Design for a general-purpose shell tool:
### **Core Shell Tool (Simplified)**

```typescript
interface ShellTool {
  name: 'shell';
  description: 'Execute shell commands';
  
  async execute(params: {
    command: string;
    cwd?: string;
    timeout?: number;
  }): Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;
}
```

### **Minimal Implementation**

```typescript
class SimpleShellTool implements Tool {
  async execute(params: ShellParams) {
    const { command, cwd = process.cwd(), timeout = 30000 } = params;
    
    // Basic safety check
    if (this.isDangerous(command)) {
      throw new Error('Command rejected for safety reasons');
    }
    
    return new Promise((resolve) => {
      exec(command, { cwd, timeout }, (error, stdout, stderr) => {
        resolve({
          success: !error,
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          exitCode: error?.code || 0
        });
      });
    });
  }
  
  private isDangerous(command: string): boolean {
    const blocked = ['rm -rf /', 'format', ':(){', 'dd if='];
    return blocked.some(pattern => command.includes(pattern));
  }
}
```

## The Key Insight

**Let the LLM handle the intelligence!** Instead of building complex parsers, just give the LLM:
- Raw stdout/stderr
- Exit code
- Let it figure out what went wrong and what to do next

The LLM is already good at:
- Understanding error messages across languages
- Recognizing patterns
- Suggesting fixes

## When to Add Complexity

Start simple, then add features only when you need them:

```typescript
// Level 1: Basic execution (start here)
{ stdout, stderr, exitCode }

// Level 2: Add streaming for long operations (if needed)
{ stdout, stderr, exitCode, onProgress }

// Level 3 and 4 are optional and not a key requirement.
// Level 3: Add basic categorization (if helpful)
{ stdout, stderr, exitCode, errorType: 'build' | 'test' | 'runtime' | 'unknown' }

// Level 4: Language-specific handling (only if truly necessary)
{ stdout, stderr, exitCode, parsedErrors: [...] }
```

## Alternative Approach: Context Hints

Instead of complex parsing, provide simple context:

```typescript
class ContextAwareShellTool {
  async execute(params: ShellParams) {
    const result = await this.runCommand(params);
    
    // Just add simple hints, not full parsing
    return {
      ...result,
      hints: this.getSimpleHints(params.command, result)
    };
  }
  
  private getSimpleHints(command: string, result: ShellResult): string[] {
    const hints = [];
    
    if (result.exitCode !== 0) {
      if (result.stderr.includes('ENOENT')) {
        hints.push('File or command not found');
      }
      if (result.stderr.includes('Permission denied')) {
        hints.push('Permission issue - might need different privileges');
      }
      if (result.stderr.includes('npm ERR!')) {
        hints.push('npm error - check package.json or node_modules');
      }
    }
    
    return hints;
  }
}
```

## Start with a Simple Approach

1. **Language Agnostic**: Works for any project type
2. **Maintainable**: Minimal code to maintain
3. **Flexible**: LLM adapts to new error types without code changes

## Recommended Implementation Path

1. **Start with basic shell execution**
2. **Add safety checks and timeouts**
3. **Add confirmation screen for commands not in the safe or allowed list**
4. **Implement output streaming (if needed)**
5. **Let the LLM handle error interpretation**
6. **Add user configurable settings for command allow/block list**

### Optional
1. **Only add parsing for specific, repeated pain points**

## Main goal
Agent can run build commands, tests, and understand failures.