# Shell MCP Tool Implementation Plan

## Main Goal
Implement a Shell MCP tool that allows LLM agents to execute commands in a controlled shell environment within the current working directory, following Aiya's existing MCP architecture patterns.

## Key Deliverables
1. Shell MCP client extending existing `MCPClient` base class
2. Safe command execution with comprehensive security measures
3. Command execution logging system for audit trails
4. User confirmation system for risky commands
5. Integration with existing tool service architecture
6. Documentation and testing coverage

## Architecture Overview
The Shell MCP tool will follow Aiya's existing MCP patterns:
- Extend `MCPClient` abstract base class from `src/core/mcp/base.ts`
- Integrate with `WorkspaceSecurity` for boundary enforcement
- Use structured error handling with custom error classes
- Implement proper logging for command execution history
- Follow the Tool-per-Method pattern used by FilesystemMCPClient

## Phase-by-Phase Implementation

### Phase 1: Basic Shell MCP Client Structure
**Objective**: Create foundational structure following existing MCP patterns

**Tasks**:
- [x] Create `src/core/mcp/shell.ts` extending `MCPClient` base class
- [x] Define shell tool schema with proper TypeScript interfaces
- [x] Implement required abstract methods from `MCPClient`
- [x] Add basic tool registration following existing patterns
- [x] Create shell-specific interfaces and types

**Key Files to Create**:
- `src/core/mcp/shell.ts` - Main shell MCP client
- Shell-specific TypeScript interfaces

**Manual Test Requirements**:
- [x] Tool appears in MCP tool list with correct schema
- [x] Tool registration works without errors
- [x] Basic structure follows existing MCP patterns

**Implementation Issues & Fixes**:
- **Issue**: Shell tool wasn't detected by LLM despite correct implementation
- **Root Cause**: ShellMCPClient was implemented but never instantiated/registered in chat command
- **Fix**: Added ShellMCPClient import, instantiation, and registration in `src/cli/commands/chat.ts`
- **Result**: Tool now appears as `shell_ExecuteCommand` with Phase 1 stub functionality

**Checkpoint**: ✅ **COMPLETED** - User verified shell tool detection works

---

### Phase 2: Core Command Execution
**Objective**: Implement basic command execution with structured output

**Tasks**:
- [x] Implement command execution using Node.js `exec()`
- [x] Return structured output: `{ stdout, stderr, exitCode, success }`
- [x] Add timeout support (default 30 seconds)
- [x] Add working directory control (default to workspace root)
- [x] Handle basic process execution errors
- [x] Add parameter validation for command input

**Key Interfaces**:
```typescript
interface ShellExecuteParams {
  command: string;
  cwd?: string;
  timeout?: number;
}

interface ShellExecuteResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}
```

**Manual Test Requirements**:
- [x] Execute safe commands: `echo hello`, `ls`, `pwd`
- [x] Verify timeout functionality works
- [x] Confirm working directory control
- [x] Test basic error handling

**Implementation Summary**:
Replaced Phase 1 stub with full command execution using `child_process.exec()` with `promisify()` for async support. Added AbortController for timeout handling, comprehensive error handling for ENOENT/EACCES/exit codes, and high-precision execution timing with `performance.now()`. All tests pass including basic commands, timeout scenarios, error handling, and working directory control.

**Checkpoint**: ✅ **COMPLETED** - All core execution functionality working correctly

---

### Phase 3: Safety and Security Integration
**Objective**: Add comprehensive security measures and workspace enforcement

**Tasks**:
- [x] Integrate with existing `WorkspaceSecurity` for boundary enforcement
- [x] Implement dangerous command detection and blocking
- [x] Add workspace-only execution restrictions
- [x] Implement input sanitization and validation
- [x] Add command whitelist/blacklist functionality
- [x] Prevent path traversal and privilege escalation attempts
- [x] Create comprehensive security error classes
- [x] Implement security event logging system
- [x] Create comprehensive unit test suite (36 tests)

**Security Features**:
- Block dangerous commands: `rm -rf /`, `format`, `:(){`, `dd if=`, etc.
- Enforce workspace boundaries for all operations
- Sanitize command inputs
- Validate working directory permissions
- Log all security-related events

**Manual Test Requirements**:
- Try blocked dangerous commands, verify rejection
- Test workspace boundary enforcement
- Attempt path traversal, confirm blocking
- Verify input sanitization works

**Implementation Summary**:
Implemented comprehensive security system with 5 major components: **DangerousCommandDetector** (40+ dangerous patterns), **CommandSanitizer** (injection/expansion prevention), **WorkspaceBoundaryEnforcer** (path traversal prevention), **CommandFilter** (configurable whitelist/blacklist), and **ShellSecurityLogger** (comprehensive audit trails). Added 4 custom security error classes and extensive unit test coverage (36 tests) verifying all security features. All dangerous commands are blocked, path traversal is prevented, command injection is stopped, and comprehensive logging provides audit trails.

**Checkpoint**: ✅ **COMPLETED** - Comprehensive security system with full test coverage

---

### Phase 4: Command Execution Logging and Error Handling
**Objective**: Implement comprehensive logging and robust error handling

**Tasks**:
- [x] Create `ShellExecutionLogger` class for command history tracking
- [x] Log: timestamp, command, cwd, user context, exit code, execution time
- [x] Add `ShellExecutionError` class extending `MCPError`
- [x] Implement error categorization (permission, not found, timeout, etc.)
- [x] Add error context and suggestions
- [x] Create log rotation and management
- [x] Add performance monitoring

**Logging Structure**:
```typescript
interface ShellExecutionLog {
  timestamp: Date;
  command: string;
  cwd: string;
  exitCode: number;
  executionTime: number;
  success: boolean;
  errorType?: string;
  userId?: string;
}
```

**Error Classes**:
- `ShellExecutionError` - Base shell execution error
- `ShellSecurityError` - Security-related errors
- `ShellTimeoutError` - Command timeout errors
- `ShellPermissionError` - Permission-related errors

**Manual Test Requirements**:
- Execute commands and verify logging works
- Test error handling for various failure scenarios
- Confirm log format and structure
- Verify error categorization accuracy

**Implementation Summary**:
Implemented comprehensive Phase 4 logging and error handling system with following components:

**Enhanced Error Hierarchy**:
- `ShellExecutionError` base class extending `MCPError` with comprehensive context
- 11 error types: execution_error, security_error, permission_error, timeout_error, command_not_found, input_validation, workspace_violation, path_traversal, command_blocked, dangerous_command, configuration_error
- `ShellErrorContext` interface with command, working directory, exit code, execution time, risk score, security events, timestamp, user/session IDs

**ShellExecutionLogger**:
- File-based logging following TokenLogger patterns with structured JSON format
- Comprehensive logging: execution results, security events, performance metrics, error details
- Multiple export formats: JSON, CSV, HTML, TEXT reports
- Log rotation with configurable size limits and archive management
- Session-based organization with unique session IDs

**Error Analysis Systems**:
- `ShellErrorCategorizer` for intelligent error classification and context-aware suggestions
- `ShellPerformanceMonitor` for CPU/memory usage tracking and execution metrics
- Integration with existing security logging (SecurityEventLog interface)

**Integration**:
- Full integration with existing shell execution flow in `ShellMCPClient.callTool()`
- Enhanced error responses with structured error information and actionable suggestions
- Backward compatibility with existing test suite (updated to Phase 4 expectations)
- Performance monitoring during command execution with resource usage tracking

All 353 tests pass, including comprehensive unit tests for logging functionality and error handling.

**Checkpoint**: ✅ **COMPLETED** - User approves logging system and error handling

---

### Phase 5: User Confirmation System
**Objective**: Add interactive confirmation for potentially risky commands

**Tasks**:
- [x] Implement configurable allow/block command lists
- [x] Add user confirmation prompts for non-whitelisted commands
- [x] Create settings integration for user preferences
- [x] Add command risk assessment logic
- [x] Implement confirmation bypass for trusted commands
- [x] Add configuration persistence

**Configuration Structure**:
```typescript
interface ShellToolConfig {
  allowedCommands: string[];
  blockedCommands: string[];
  requireConfirmation: boolean;
  autoApprovePatterns: string[];
  maxExecutionTime: number;
  allowComplexCommands: boolean;
  // Phase 5: User Confirmation System fields
  confirmationThreshold: number; // Risk score threshold requiring confirmation (0-100)
  trustedCommands: string[]; // Commands that bypass confirmation
  alwaysBlockPatterns: string[]; // Commands that are always blocked regardless of confirmation
  confirmationTimeout: number; // Timeout for user confirmation prompts (in milliseconds)
  sessionMemory: boolean; // Remember confirmation decisions for the current session
}
```

**Manual Test Requirements**:
- [x] Execute risky commands, verify confirmation prompts
- [x] Test configuration persistence
- [x] Verify bypass functionality for trusted commands
- [x] Test risk assessment accuracy

**Implementation Summary**:
Implemented comprehensive Phase 5 user confirmation system with following components:

**Core Components**:
- `ShellConfirmationPrompt` class with console and UI callback support for interactive prompts
- `SessionMemoryManager` for caching confirmation decisions with performance optimization
- `CommandRiskAssessor` with comprehensive risk scoring (0-100) and category classification
- `CommandFilter` with configurable allow/block lists and Phase 5 configuration support

**Key Features**:
- **Interactive Confirmation Prompts**: Support for Allow/Deny/Trust/Block decisions with timeout
- **Risk Assessment**: Comprehensive scoring based on command patterns, file operations, network access, privilege escalation
- **Session Memory**: Cached decisions with TTL, pattern matching, and performance optimization
- **Configuration Integration**: Full settings integration with validation and persistence
- **Trusted Commands**: Bypass confirmation for low-risk commands via regex patterns
- **Always Block Patterns**: Critical commands blocked regardless of confirmation
- **UI Integration**: Support for both console and React/Ink UI callbacks
- **Performance Monitoring**: <1ms lookup times for session memory decisions

**Testing Coverage**:
- Unit tests: 20 tests for confirmation system components
- Integration tests: 11 tests for configuration integration
- End-to-end tests: 11 tests for full confirmation flow
- Security tests: 58 tests for security integration
- All tests passing with comprehensive coverage

**Configuration Defaults**:
- Confirmation threshold: 50 (0-100 risk score)
- Confirmation timeout: 30 seconds
- Session memory: Enabled
- Trusted commands: ls, pwd, echo, git status, npm test
- Always block patterns: rm -rf /, sudo rm -rf, dd if=/dev/zero, format, shutdown

**Checkpoint**: ✅ **COMPLETED** - All Phase 5 objectives fully implemented and tested

---

### Phase 6: Output Streaming (Optional)
**Objective**: Add real-time output streaming for long-running commands

**Tasks**:
- [ ] Implement streaming using `spawn()` instead of `exec()`
- [ ] Add progress callbacks for real-time output
- [ ] Handle streaming for both stdout and stderr
- [ ] Add streaming cancellation support
- [ ] Implement buffering and rate limiting
- [ ] Add streaming configuration options

**Streaming Interface**:
```typescript
interface StreamingOptions {
  enableStreaming: boolean;
  bufferSize: number;
  maxOutputLength: number;
  onProgress?: (output: string, type: 'stdout' | 'stderr') => void;
}
```

**Manual Test Requirements**:
- Run build commands with streaming output
- Test cancellation functionality
- Verify streaming performance
- Confirm output buffering works

**Checkpoint**: User confirms streaming meets requirements

---

### Phase 7: Integration and Polish
**Objective**: Complete integration and production readiness

**Tasks**:
- [ ] Full integration with existing tool service architecture
- [ ] Add comprehensive documentation
- [ ] Implement performance optimizations
- [ ] Add monitoring and metrics
- [ ] Create unit and integration tests
- [ ] Add configuration validation
- [ ] Performance tuning and optimization

**Integration Points**:
- Tool service registration in `src/core/tools/mcp-tools.ts`
- Configuration integration with existing settings system
- Error reporting integration
- Logging integration with existing log system

**Documentation Requirements**:
- API documentation with examples
- Security guidelines and best practices
- Configuration reference
- Troubleshooting guide

**Manual Test Requirements**:
- End-to-end testing with AI providers
- Performance testing under load
- Security audit and penetration testing
- Integration testing with existing tools

**Checkpoint**: User confirms production readiness

---

## Key Technical Requirements

### Security Requirements
1. All commands must be executed within workspace boundaries
2. Dangerous commands must be blocked by default
3. User confirmation required for potentially risky operations
4. All command executions must be logged for audit purposes
5. Input validation and sanitization mandatory
6. No privilege escalation or system access beyond workspace

### Performance Requirements
1. Command execution timeout (default 30s, configurable)
2. Output size limits to prevent memory exhaustion
3. Concurrent execution limits
4. Streaming support for long-running commands
5. Efficient logging with rotation

### Integration Requirements
1. Follow existing MCP client patterns and interfaces
2. Use existing security and error handling systems
3. Integrate with current tool service architecture
4. Support existing configuration and settings systems
5. Compatible with all AI providers in the system

## Success Criteria
1. Shell tool successfully executes common development commands (build, test, lint)
2. Security measures prevent dangerous operations
3. Command history is properly logged and auditable
4. User confirmation system works for risky commands
5. Integration with existing MCP architecture is seamless
6. Performance meets requirements for typical development workflows
7. Documentation is complete and accessible

## Risk Mitigation
1. **Security Risks**: Comprehensive command filtering and workspace enforcement
2. **Performance Risks**: Timeouts, limits, and streaming for large outputs
3. **Integration Risks**: Follow existing patterns and thorough testing
4. **Usability Risks**: Clear error messages and helpful suggestions
5. **Maintenance Risks**: Clean architecture and comprehensive documentation

## Dependencies
- Node.js `child_process` module for command execution
- Existing `MCPClient` base class and interfaces
- `WorkspaceSecurity` for boundary enforcement
- Existing error handling and logging systems
- Configuration and settings infrastructure