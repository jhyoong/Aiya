# Shell Tool UX Improvement Plan

## Problem Analysis

After investigating the shell tool refactoring, we identified several UX issues that affect the LLM's ability to effectively use the shell tool:

### Key Issues Identified

1. **Missing Directory Context**: The LLM doesn't know what the current working directory is when making tool calls
2. **Confirmation UI Issues**: The confirmation bridge setup is complex and may have callback timing issues during interactive chat
3. **Tool Description Lacks Context**: The tool description doesn't provide the LLM with current directory information
4. **Missing CWD Parameter**: Tool calls like the example below are missing directory context:

```json
{
  "tool_calls": [
    {
      "id": "call_456",
      "name": "shell_ExecuteCommand",
      "arguments": {
        "command": "rm deleteme.txt"
      }
    }
  ]
}
```

## Root Causes

1. **No Current Directory in Tool Description**: The system message doesn't tell the LLM what directory it's working in
2. **Optional CWD Parameter**: The `cwd` parameter is optional but the LLM doesn't know the default
3. **Complex Confirmation Flow**: The UI confirmation bridge has multiple async layers that could timeout or fail
4. **Insufficient Tool Documentation**: The tool schema doesn't provide enough context about working directory behavior

## Old vs New Shell Tool Implementation Impact

### Working Directory Handling Changes

**OLD Implementation (Risk-Based System):**
- Default CWD: Used `this.security.getWorkspaceRoot()` as fallback
- CWD Parameter: `cwd` was optional with basic workspace validation
- Context: Working directory was part of risk assessment calculation
- Tool Description: Basic shell command execution

**NEW Implementation (Category-Based System):**
- Default CWD: Still uses `this.security.getWorkspaceRoot()` as fallback
- CWD Parameter: Same optional parameter structure
- Context: Working directory now part of command categorization context
- Tool Description: "Execute shell commands with security filtering and confirmation"

### The Issue

The refactoring maintained the same tool interface but the LLM lacks context about:
- What the current working directory is
- When to use the `cwd` parameter
- How relative paths are resolved
- What the workspace boundaries are

## Proposed Improvements

### 1. Enhance Tool Description with Working Directory Context

**Current Description:**
```typescript
description: 'Execute shell commands with security filtering and confirmation'
```

**Proposed Enhanced Description:**
```typescript
description: 'Execute shell commands safely within workspace boundaries. Commands run in the project workspace directory unless otherwise specified.'
```

### 2. Improve Tool Parameter Documentation

**Current CWD Parameter:**
```typescript
cwd: {
  type: 'string',
  description: 'Working directory (optional)',
}
```

**Proposed Enhanced CWD Parameter:**
```typescript
cwd: {
  type: 'string',
  description: 'Working directory relative to workspace root (optional). Defaults to workspace root. Use "." for current directory, or specify a relative path within the workspace.',
}
```

### 3. Enhance System Message Generation

Update the `generateToolsSystemMessage()` method to include:
- Current working directory information
- Workspace root context
- Examples of tool usage with directory context

### 4. Add Working Directory Context to Tool Response

Include current working directory in tool responses so the LLM knows where commands executed:

```json
{
  "output": "Command executed successfully",
  "security": { ... },
  "workingDirectory": "/home/user/project",
  "command": "rm deleteme.txt"
}
```

### 5. Simplify Confirmation Flow

**Current Issues:**
- Complex async confirmation bridge
- Potential timeout issues during interactive chat
- Missing debug logging for troubleshooting

**Proposed Improvements:**
- Add comprehensive debug logging
- Implement fallback mechanisms for confirmation failures
- Add retry logic for failed confirmation attempts
- Better error reporting for confirmation system issues

## Implementation Steps

### Phase 1: Tool Description and Documentation (High Priority)

1. **Update shell tool description** to include current working directory context
2. **Enhance tool parameter documentation** with better CWD descriptions and examples
3. **Add workspace boundary information** to tool schema

### Phase 2: System Message Enhancement (Medium Priority)

1. **Improve system message generation** to include working directory information
2. **Add context about shell command execution environment**
3. **Provide guidance about when to use cwd parameter**

### Phase 3: Confirmation System Debugging (Medium Priority)

1. **Add debug logging** to confirmation bridge to identify timeout issues
2. **Implement fallback mechanisms** for confirmation UI failures
3. **Add retry logic** for failed confirmation attempts

### Phase 4: Testing and Validation (Low Priority)

1. **Test improved tool with LLM** to verify better context awareness
2. **Validate that directory context improves tool usage**
3. **Ensure backward compatibility** with existing tool calls

## Expected Outcomes

After implementing these improvements:

1. **Better LLM Context**: The LLM will understand the current working directory
2. **Improved Tool Usage**: More accurate tool calls with appropriate `cwd` parameters
3. **Reduced Confusion**: Clear documentation about workspace boundaries
4. **Better Debugging**: Comprehensive logging for confirmation system issues
5. **Enhanced UX**: More informative responses about command execution context

## Technical Implementation Details

### Tool Schema Enhancement

```typescript
{
  name: 'ExecuteCommand',
  description: 'Execute shell commands safely within workspace boundaries. Commands run in the project workspace directory unless otherwise specified.',
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute',
      },
      cwd: {
        type: 'string',
        description: 'Working directory relative to workspace root (optional). Defaults to workspace root. Use "." for current directory, or specify a relative path within the workspace. Example: "src/components" to run commands in that subdirectory.',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in seconds (optional, default 30)',
      },
    },
    required: ['command'],
    additionalContext: {
      workspaceRoot: '/path/to/workspace',
      currentDirectory: '/path/to/workspace',
      securityLevel: 'workspace-bounded'
    }
  },
}
```

### Enhanced System Message

```
You have access to shell command execution within the project workspace.

Current working directory: /home/user/project
Workspace root: /home/user/project

The shell_ExecuteCommand tool allows you to run commands safely within workspace boundaries:
- Commands execute in the workspace root by default
- Use the 'cwd' parameter to specify a different directory within the workspace
- All paths are relative to the workspace root for security
- Commands are categorized as SAFE, RISKY, DANGEROUS, or BLOCKED
```

### Confirmation System Debug Logging

```typescript
// Add debug logging to confirmation bridge
if (process.env.AIYA_DEBUG_CONFIRMATION) {
  console.log(`[CONFIRMATION] Showing prompt for command: ${options.command}`);
  console.log(`[CONFIRMATION] Working directory: ${options.workingDirectory}`);
  console.log(`[CONFIRMATION] Category: ${options.categorization.category}`);
  console.log(`[CONFIRMATION] Timeout: ${options.timeout}ms`);
}
```

## Migration Strategy

This improvement plan maintains full backward compatibility:

1. **No Breaking Changes**: Existing tool calls continue to work
2. **Enhanced Documentation**: Better descriptions without changing behavior
3. **Additive Improvements**: New context information without changing core functionality
4. **Graceful Degradation**: System works with or without enhanced context

## Success Metrics

1. **Reduced Missing CWD Issues**: Fewer tool calls missing directory context
2. **Improved Tool Call Accuracy**: More appropriate use of `cwd` parameter
3. **Better Error Reporting**: Clear messages about directory-related issues
4. **Enhanced Debugging**: Comprehensive logs for troubleshooting confirmation issues
5. **User Satisfaction**: Improved overall UX with shell tool interactions