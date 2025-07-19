# Shell Command Approval & Logging Implementation Plan

## Problem Statement

### Current Issue
The shell tool approval system has a critical flaw:
- When user selects "Always Allow" for the shell tool, it stores preference for the generic "RunCommand" tool
- This bypasses ALL shell command approval checks, including dangerous commands like `rm`, `curl`, `sudo`
- Individual command approval logic exists but is never reached due to tool-level bypass

### Secondary Issue
Lack of comprehensive logging for tool executions and shell commands makes debugging and auditing difficult.

## Goals & Success Metrics

### Primary Goals
1. **Fix Approval System**: Each shell command type (rm, curl, git, etc.) should have individual approval
2. **Add Tool Logging**: Log all tool invocations and results for debugging/auditing
3. **Add Shell Logging**: Specialized logging for shell commands with execution details

### Success Metrics
- [ ] User can approve `rm` commands but still get prompted for `curl` commands
- [ ] Tool execution logs are created in `~/.aiya/logs/tools.log`
- [ ] Shell command logs are created in `~/.aiya/logs/shell.log`
- [ ] All existing tests pass
- [ ] New tests verify individual command approval works correctly

## Technical Solution

### Architecture Changes

#### 1. Two-Tier Approval System
- **Tool Level**: Most tools use existing approval system
- **Shell Level**: Shell tool gets special handling with command-specific approval
- **Memory Structure**: Store as `shell:commandName` instead of just tool name

#### 2. Logging Infrastructure
- **Tool Logger**: General-purpose tool execution logging
- **Shell Logger**: Specialized shell command logging with command details
- **Session Management**: Similar to token logger with session IDs

### Implementation Tasks

#### High Priority Tasks

1. **Create General Tool Logger** (`src/core/tools/logger.ts`)
   - Interface: `ToolLogEntry` with timestamp, sessionId, toolName, args, result, error
   - Class: `ToolLogger` similar to `TokenLogger` pattern
   - Log file: `~/.aiya/logs/tools.log`
   - Methods: `logToolExecution`, `logSessionStart`, `logSessionEnd`

2. **Create Shell Command Logger** (`src/core/tools/shell-logger.ts`)
   - Interface: `ShellLogEntry` with command, exitCode, stdout, stderr, duration
   - Class: `ShellLogger` extending or composing with general logger
   - Log file: `~/.aiya/logs/shell.log`
   - Methods: `logShellCommand`, `logApprovalRequest`, `logApprovalResult`

3. **Create Shell Confirmation Dialog** (`src/ui/components/ShellCommandConfirmationDialog.tsx`)
   - Props: `command: string`, `onChoice: (choice: ShellConfirmationChoice) => void`
   - Display: Show actual command being executed (not just "RunCommand")
   - Choices: Allow Once, Allow Always for this command type, Reject
   - Styling: Similar to existing ToolConfirmationDialog but command-focused

4. **Refactor ShellMCPClient** (`src/core/mcp/shell.ts`)
   - Remove: All approval logic from `runCommand` method
   - Add: Shell logger integration for command logging
   - Keep: Simple command execution with logging
   - Simplify: Back to basic shell execution client

5. **Modify Chat Command Handler** (`src/cli/commands/chat.ts`)
   - Add: Special case handling for shell tool confirmation
   - Create: Custom confirmation callback for shell commands
   - Integrate: Shell command approval with memory service
   - Route: Shell tools to command-specific approval, others to tool approval

#### Medium Priority Tasks

6. **Integrate Tool Logging** (`src/core/tools/executor.ts`)
   - Add: ToolLogger instance to ToolExecutor
   - Log: Every tool call before and after execution
   - Include: Tool name, arguments, results, execution time
   - Handle: Error logging and session management

7. **Testing & Validation**
   - Test: Individual command approval (rm vs curl vs git)
   - Test: Logging functionality for both tool and shell loggers
   - Test: Memory persistence across sessions
   - Verify: All existing functionality still works

### File Structure

```
src/core/tools/
├── executor.ts          # Modified: Add tool logging
├── logger.ts            # New: General tool execution logger
├── shell-logger.ts      # New: Shell-specific logger
└── memory.ts            # Existing: No changes needed

src/core/mcp/
├── shell.ts             # Modified: Remove approval, add logging
└── shell-constants.ts   # Existing: No changes needed

src/ui/components/
├── ShellCommandConfirmationDialog.tsx  # New: Shell-specific UI
└── ToolConfirmationDialog.tsx          # Existing: No changes needed

src/cli/commands/
└── chat.ts              # Modified: Add shell confirmation handling

~/.aiya/logs/
├── tools.log            # New: General tool execution log
├── shell.log            # New: Shell command execution log
└── tokens.log           # Existing: No changes needed
```

## Implementation Strategy

### Phase 1: Logging Infrastructure
1. Create tool logger (based on token logger pattern)
2. Create shell logger (specialized for commands)
3. Test logging functionality independently

### Phase 2: Approval System Fix
1. Remove approval from ShellMCPClient
2. Create shell confirmation dialog
3. Modify chat command for shell-specific handling
4. Test approval flow with different commands

### Phase 3: Integration & Testing
1. Integrate tool logging into executor
2. Add shell logging to shell client
3. Comprehensive testing of approval and logging
4. Performance and error handling verification

## Key Technical Decisions

### Memory Key Format
- **Current**: `toolName` (e.g., "RunCommand")
- **New**: `shell:commandName` (e.g., "shell:rm", "shell:curl")
- **Benefit**: Individual command approval without tool-level bypass

### Logging Pattern
- **Follow**: Existing token logger patterns for consistency
- **Location**: `~/.aiya/logs/` directory (same as tokens)
- **Format**: Structured logs with timestamps and session IDs

### UI/UX Approach
- **Shell Dialog**: Show actual command, not generic tool name
- **Options**: Command-specific "Always Allow" vs tool-level
- **Consistency**: Maintain existing UI patterns and keyboard navigation

## Risk Mitigation

### Backward Compatibility
- Existing tool approval preferences remain intact
- New shell preferences use different key format
- Graceful fallback if logging fails

### Performance Considerations
- Async logging to avoid blocking command execution
- Log rotation/cleanup strategy (future consideration)
- Minimal overhead for approval checks

### Error Handling
- Logging failures don't break tool execution
- Clear error messages for approval failures
- Fallback behavior for missing confirmation callbacks