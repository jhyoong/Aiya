# MCP Tool System Architecture

## Overview

The Model Context Protocol (MCP) tool system in Aiya provides a structured way for AI models to interact with the file system, shell commands, and other external resources. It implements a comprehensive set of file operations and shell command execution with security, validation, and advanced functionality.

## Core Architecture

### MCP Client Base Class

#### MCPClient Abstract Class
**Location**: `src/core/mcp/base.ts`

The `MCPClient` abstract class defines the standard interface for all MCP clients:

```typescript
abstract class MCPClient {
  protected serverName: string;
  protected connected: boolean;
  
  // Connection management
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract ping(): Promise<boolean>;
  
  // Server information
  abstract getServerInfo(): Promise<MCPServerInfo>;
  
  // Tool operations
  abstract listTools(): Promise<Tool[]>;
  abstract callTool(name: string, args: Record<string, any>): Promise<ToolResult>;
  
  // Resource operations
  abstract listResources(): Promise<Resource[]>;
  abstract readResource(uri: string): Promise<ToolResult>;
}
```

#### Core Interfaces

**Tool Interface**:
```typescript
interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}
```

**ToolResult Interface**:
```typescript
interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}
```

**MCPServerInfo Interface**:
```typescript
interface MCPServerInfo {
  name: string;
  version: string;
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
}
```

#### Error Handling

**Error Classes**:
- `MCPError` - Base MCP error
- `MCPConnectionError` - Connection failures
- `MCPToolError` - Tool execution errors
- `MCPResourceError` - Resource access errors
- `FileSystemError` - File system operation errors

**FileSystemError**:
```typescript
class FileSystemError extends Error {
  constructor(
    message: string,
    public code: 'PERMISSION_DENIED' | 'FILE_NOT_FOUND' | 'PATH_TRAVERSAL' | 'DISK_FULL',
    public path: string,
    public suggestion?: string
  )
}
```

### MCP Client Implementations

Aiya includes two primary MCP client implementations for different types of operations:

### Filesystem MCP Client

#### FilesystemMCPClient
**Location**: `src/core/mcp/filesystem.ts`

The primary MCP client implementation providing comprehensive file system operations:

**Core Dependencies**:
- `WorkspaceSecurity` - Security validation
- `FileSystemState` - State tracking and rollback
- `FuzzyMatcher` - Fuzzy search capabilities
- `ASTSearcher` - AST-based code search

**Architecture Pattern**: The client follows a **Tool-per-Method** pattern where each file operation is implemented as a separate tool with its own validation, execution, and error handling.

#### Five Core Tools

### 1. ReadFile Tool

**Purpose**: Read file contents with encoding options and line range selection

**Parameters**:
```typescript
{
  path: string;
  encoding?: 'utf8' | 'base64' | 'binary';
  lineRange?: { start: number; end: number };
}
```

**Features**:
- **Binary Detection**: Automatically detects binary files
- **Encoding Support**: UTF-8, Base64, and binary encodings
- **Line Range Selection**: Read specific line ranges
- **Metadata Extraction**: File size, language detection, modification time
- **Security Validation**: Workspace boundary enforcement

**Response Structure**:
```typescript
{
  content: string;
  metadata: {
    size: number;
    lines: number;
    language: string;
    lastModified: Date;
    encoding: string;
    isBinary: boolean;
    lineRange?: { start: number; end: number };
  };
}
```

### 2. WriteFile Tool

**Purpose**: Write content to files with safety features and mode options

**Parameters**:
```typescript
{
  path: string;
  content: string;
  createDirectories?: boolean;
  mode?: 'overwrite' | 'create-only' | 'append';
}
```

**Features**:
- **Atomic Operations**: Temp file + rename for consistency
- **Mode Support**: Overwrite, create-only, and append modes
- **Directory Creation**: Optional parent directory creation
- **Rollback Support**: Reversible operations with state tracking

**Safety Measures**:
- Disk space validation
- Permission checking
- Atomic write operations
- Rollback capability

### 3. EditFile Tool

**Purpose**: Apply targeted edits using replace/insert/delete operations

**Parameters**:
```typescript
{
  path: string;
  edits: Array<{
    type: 'replace' | 'insert' | 'delete';
    search?: {
      pattern: string;
      isRegex?: boolean;
      occurrence?: 'first' | 'last' | 'all' | number;
    };
    position?: {
      line: number;
      column?: number;
    } | 'start' | 'end';
    content?: string;
  }>;
}
```

**Features**:
- **Multiple Edit Types**: Replace, insert, delete operations
- **Pattern Matching**: Literal and regex pattern support
- **Position-based Editing**: Line and column positioning
- **Sequential Processing**: Edits applied in order
- **Rollback Support**: Full operation rollback on failure

**Edit Operation Details**:

**Replace Operations**:
- Literal string replacement
- Regular expression replacement
- Occurrence targeting (first, last, all, specific number)
- Pattern not found error handling

**Insert Operations**:
- Position-based insertion (line/column)
- Special positions (start, end)
- Content insertion with proper formatting

**Delete Operations**:
- Pattern-based deletion
- Position-based deletion
- Line removal capabilities

### 4. SearchFiles Tool

**Purpose**: Search files with multiple search types, context, and confidence scoring

**Parameters**:
```typescript
{
  pattern: string;
  options: {
    includeGlobs?: string[];
    excludeGlobs?: string[];
    maxResults?: number;
    contextLines?: number;
    searchType: 'literal' | 'regex' | 'fuzzy' | 'ast' | 'filename';
  };
}
```

**Search Types**:

**Literal Search**:
- Case-insensitive string matching
- Fast and reliable
- Good for exact text searches

**Regex Search**:
- Full regular expression support
- Pattern validation and error handling
- Multiline pattern support

**Fuzzy Search**:
- Approximate string matching using Fuse.js
- Confidence scoring (0-100)
- Handles typos and variations

**AST Search**:
- Code structure-aware searching
- Language-specific parsing
- Semantic code matching

**Filename Search**:
- Search by filename patterns
- Useful for finding files by name

**Features**:
- **Context Lines**: Include surrounding lines for context
- **Confidence Scoring**: Fuzzy and AST searches include confidence
- **File Filtering**: Include/exclude glob patterns
- **Result Limiting**: Configurable maximum results
- **Security Validation**: Workspace boundary enforcement

### 5. ListDirectory Tool

**Purpose**: List directory contents with smart filtering and LLM-friendly output

**Parameters**:
```typescript
{
  path: string;
  recursive?: boolean;
  maxDepth?: number;
  includeHidden?: boolean;
  sortBy?: 'name' | 'size' | 'modified' | 'type' | 'importance';
  sortOrder?: 'asc' | 'desc';
  filterExtensions?: string[];
  excludePatterns?: string[];
  maxEntries?: number;
  offset?: number;
  mode?: 'full' | 'summary' | 'project-files';
  includeCommonBuildDirs?: boolean;
  quick?: boolean;
}
```

**Features**:
- **Smart Filtering**: Automatic exclusion of build directories
- **Importance Scoring**: Prioritizes important files for LLM consumption
- **Multiple Modes**: Full, summary, and project-files modes
- **Recursive Traversal**: Configurable depth control
- **Performance Optimization**: Timeout protection and result limits
- **Metadata Extraction**: File size, modification time, permissions

**Response Modes**:

**Full Mode**: Complete directory listing with all metadata
**Summary Mode**: Count-based overview with important files highlighted
**Project-Files Mode**: Focuses on development-relevant files

**Smart Exclusions**:
- `node_modules`, `dist`, `build`, `coverage`
- `.git`, `.vscode`, `.idea`
- `__pycache__`, `.pytest_cache`
- Custom exclude patterns

### Shell MCP Client

#### ShellMCPClient
**Location**: `src/core/mcp/shell.ts`

The shell MCP client implementation provides command execution capabilities:

**Core Dependencies**:
- `ToolMemoryService` - Command preference memory
- `ShellLogger` - Comprehensive logging system
- `shell-constants` - Command approval configuration

**Architecture Pattern**: The client follows a **Single Tool** pattern with one primary tool for shell command execution, integrated with approval workflows and comprehensive logging.

#### RunCommand Tool

**Purpose**: Execute shell commands with security approval and comprehensive logging

**Parameters**:
```typescript
{
  command: string;
  timeout?: number; // Default: 30000ms
}
```

**Features**:
- **Command Execution**: Uses Node.js `child_process.exec` for command execution
- **Timeout Management**: Configurable timeout with default 30-second limit
- **Output Handling**: Captures both stdout and stderr with proper formatting
- **Error Handling**: Comprehensive error handling with exit codes
- **Logging Integration**: Full command execution logging via `ShellLogger`
- **Memory Service**: Command preference tracking for approval workflows

**Response Structure**:
```typescript
{
  content: Array<{
    type: 'text';
    text: string; // Combined stdout/stderr or error message
  }>;
  isError: boolean;
}
```

**Security Integration**:
The shell client integrates with the approval system defined in `shell-constants.ts`:

**Commands Requiring Approval**:
- **File Operations**: `rm`, `rmdir`, `mv`, `cp`, `chmod`, `chown`, `dd`
- **System Administration**: `sudo`, `su`, `passwd`, `usermod`, `groupmod`, `mount`, `umount`
- **Network Operations**: `curl`, `wget`, `ssh`, `scp`, `rsync`
- **Package Management**: `apt`, `yum`, `npm`, `yarn`, `pip`, `brew`
- **Process Management**: `kill`, `killall`, `pkill`
- **Git Operations**: `git` (potentially destructive operations)
- **System Control**: `systemctl`, `service`, `crontab`
- **Archive Operations**: `tar`, `zip`, `unzip`

**Approval Flow**:
1. **Command Analysis**: Extract command name from input
2. **Approval Check**: Check if command requires user approval
3. **User Confirmation**: Present approval dialog for dangerous commands
4. **Memory Storage**: Store user preferences (once, always, reject)
5. **Execution**: Execute approved commands with full logging

**Error Handling**:
- **Timeout Errors**: Handle command timeouts with specific error messages
- **Execution Errors**: Capture exit codes, stdout, and stderr
- **Permission Errors**: Handle access denied scenarios
- **Command Not Found**: Handle missing command errors

**Logging Capabilities**:
The shell client provides comprehensive logging through `ShellLogger`:

**Command Execution Logs**:
```typescript
interface ShellLogEntry {
  timestamp: string;
  sessionId: string;
  command: string;
  exitCode?: number;
  stdout?: string; // Truncated to 1000 chars
  stderr?: string; // Truncated to 1000 chars
  duration?: number; // Execution time in ms
  error?: string; // Error message if any
}
```

**Approval Logs**:
```typescript
interface ShellApprovalLogEntry {
  timestamp: string;
  sessionId: string;
  command: string;
  commandType: string;
  approved: boolean;
  choice: string; // 'once', 'always', 'reject'
}
```

**Log File Location**: `~/.aiya/logs/shell.log`

**Memory Service Integration**:
The shell client integrates with the memory service for command preferences:

```typescript
// Store command preference
storeCommandPreference(command: string, preference: ToolPreference): void

// Get memory service for external access
getMemoryService(): ToolMemoryService
```

**Command Preference Types**:
- `once` - Approve this execution only
- `always` - Always approve this command type
- `reject` - Always reject this command type

### Todo MCP Client

#### TodoMCPAdapter
**Location**: `src/core/mcp/todo-adapter.ts`

The todo MCP client implementation provides comprehensive todo management capabilities through integration with the aiya-todo-mcp package:

**Core Dependencies**:
- `aiya-todo-mcp` - External package for todo management functionality
- `TodoManager` - Core todo management with JSON persistence
- Comprehensive validation and error handling

**Architecture Pattern**: The client follows an **Adapter Pattern** where the `TodoMCPAdapter` wraps the external `aiya-todo-mcp` package to work seamlessly with Aiya's custom MCP architecture.

#### Eleven Todo Management Tools

### 1. CreateTodo Tool

**Purpose**: Create new todo tasks with comprehensive metadata

**Parameters**:
```typescript
{
  title: string;
  description?: string;
  tags?: string[];
  groupId?: string;
  verificationMethod?: string;
}
```

**Features**:
- **Title Validation**: Ensures non-empty titles
- **Rich Metadata**: Support for descriptions, tags, and grouping
- **Verification Integration**: Optional verification method assignment
- **Automatic ID Generation**: Sequential ID assignment
- **Timestamp Creation**: Automatic createdAt timestamp
- **Persistence**: Immediate save to JSON file

### 2. ListTodos Tool

**Purpose**: List todo tasks with optional filtering and pagination

**Parameters**:
```typescript
{
  completed?: boolean;
  limit?: number;
  offset?: number;
}
```

**Features**:
- **Completion Filtering**: Filter by completed status
- **Pagination Support**: Limit and offset for large todo lists
- **Efficient Retrieval**: In-memory operations with file persistence

### 3. GetTodo Tool

**Purpose**: Retrieve a specific todo task by ID

**Parameters**:
```typescript
{
  id: string;
}
```

**Features**:
- **ID Validation**: Ensures valid todo ID
- **Not Found Handling**: Clear error messages for missing todos
- **Complete Todo Data**: Returns all todo properties including metadata

### 4. UpdateTodo Tool

**Purpose**: Update existing todo tasks with comprehensive field support

**Parameters**:
```typescript
{
  id: string;
  title?: string;
  description?: string;
  completed?: boolean;
  tags?: string[];
  groupId?: string;
  verificationMethod?: string;
  verificationStatus?: 'pending' | 'verified' | 'failed';
  verificationNotes?: string;
}
```

**Features**:
- **Comprehensive Updates**: Update any todo field including metadata
- **Partial Updates**: Update only specified fields
- **Verification Management**: Update verification status and notes
- **Title Validation**: Ensures non-empty titles when updating
- **Completion Toggle**: Easy task completion management
- **Atomic Operations**: Consistent state updates

### 5. DeleteTodo Tool

**Purpose**: Remove todo tasks by ID

**Parameters**:
```typescript
{
  id: string;
}
```

**Features**:
- **ID Validation**: Ensures valid todo ID
- **Confirmation Response**: Clear success/failure messages
- **Persistent Deletion**: Immediate removal from storage

### 6. SetVerificationMethod Tool

**Purpose**: Set or update verification method for a todo task

**Parameters**:
```typescript
{
  todoId: string;
  method: string;
  notes?: string;
}
```

**Features**:
- **Method Assignment**: Set verification method for todo completion
- **Optional Notes**: Add notes about the verification method
- **ID Validation**: Ensures valid todo ID
- **Atomic Operations**: Consistent state updates

### 7. UpdateVerificationStatus Tool

**Purpose**: Update verification status of a todo task

**Parameters**:
```typescript
{
  todoId: string;
  status: 'pending' | 'verified' | 'failed';
  notes?: string;
}
```

**Features**:
- **Status Management**: Update verification status (pending, verified, failed)
- **Status Notes**: Add notes about verification results
- **Validation**: Ensures valid status values
- **Audit Trail**: Track verification progress

### 8. GetTodosNeedingVerification Tool

**Purpose**: Retrieve todos that require verification

**Parameters**:
```typescript
{
  groupId?: string;
}
```

**Features**:
- **Verification Filtering**: Find todos that need verification
- **Group Filtering**: Optional filtering by group ID
- **Workflow Support**: Enable verification workflows
- **Batch Operations**: Process multiple todos requiring verification

### 9. CreateTaskGroup Tool

**Purpose**: Create coordinated task workflows with dependencies

**Parameters**:
```typescript
{
  mainTask: {
    title: string;
    description?: string;
    tags?: string[];
    verificationMethod?: string;
  };
  subtasks?: Array<{
    title: string;
    description?: string;
    tags?: string[];
    dependencies?: number[];
    verificationMethod?: string;
  }>;
  groupId?: string;
}
```

**Features**:
- **Task Hierarchies**: Create main task with dependent subtasks
- **Dependency Management**: Define task execution order through dependencies
- **Group Organization**: Optional group ID for organizing related task workflows
- **Rich Metadata**: Support for descriptions, tags, and verification methods on all tasks
- **Flexible Structure**: Main task with optional array of subtasks
- **Dependency Validation**: Ensures dependency indices are valid

### 10. GetExecutableTasks Tool

**Purpose**: Find tasks ready for execution based on dependencies

**Parameters**:
```typescript
{
  groupId?: string;
  limit?: number;
}
```

**Features**:
- **Dependency Resolution**: Returns only tasks whose dependencies are completed
- **Group Filtering**: Optional filtering by group ID to focus on specific workflows
- **Result Limiting**: Configurable maximum number of tasks to return
- **Execution Readiness**: Identifies tasks that can be executed immediately
- **Workflow Coordination**: Enables sequential execution of dependent tasks

### 11. UpdateExecutionStatus Tool

**Purpose**: Manage execution states with validation

**Parameters**:
```typescript
{
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
  error?: string;
  result?: string;
}
```

**Features**:
- **State Management**: Track execution progress through defined states
- **Status Validation**: Ensures only valid execution states are set
- **Error Tracking**: Optional error message for failed executions
- **Result Capture**: Optional result data for completed executions
- **State Transitions**: Enables proper workflow state management
- **Audit Trail**: Track execution progress and outcomes

#### Todo Persistence

**Storage Format**:
```json
{
  "todos": [
    {
      "id": "1",
      "title": "Example Todo",
      "description": "A detailed description of the todo task",
      "completed": false,
      "tags": ["work", "urgent"],
      "groupId": "project-alpha",
      "verificationMethod": "automated-test",
      "verificationStatus": "pending",
      "verificationNotes": "Waiting for CI pipeline completion",
      "createdAt": "2025-07-20T12:00:00.000Z",
      "updatedAt": "2025-07-20T12:30:00.000Z"
    }
  ],
  "nextId": 2
}
```

**Key Features**:
- **JSON File Storage**: Persistent storage in `todos.json`
- **Sequential IDs**: Automatic ID generation and management
- **ISO Timestamps**: Standardized date formats (createdAt, updatedAt)
- **Rich Metadata**: Support for descriptions, tags, and grouping
- **Verification System**: Complete verification workflow tracking

#### Integration Benefits

**Adapter Pattern Advantages**:
- **Zero Breaking Changes**: No impact on existing Aiya functionality
- **Seamless Integration**: Works with existing MCP tool architecture
- **Tool Prefixing**: Tools appear as `todo_CreateTodo`, etc.
- **Future Upgrades**: Easy to update underlying aiya-todo-mcp package

**Error Handling**:
- **Comprehensive Validation**: Input parameter validation
- **Clear Error Messages**: Helpful error descriptions
- **Graceful Degradation**: Handles package failures gracefully

### Supporting Components

#### FileSystemState
**Location**: `src/core/mcp/filesystem-state.ts`

Provides state tracking and rollback capabilities:

**Features**:
- **Change Tracking**: Track all file system modifications
- **Rollback Support**: Reverse operations to previous state
- **Snapshot Management**: Create and manage file snapshots
- **Diff Generation**: Generate change summaries

**Key Methods**:
```typescript
class FileSystemState {
  async trackChange(change: Change): Promise<void>;
  async rollbackTo(timestamp: Date): Promise<void>;
  async createSnapshot(path: string, content: string): Promise<FileSnapshot>;
  async getDiff(): Promise<string>;
}
```

**Change Interface**:
```typescript
interface Change {
  tool: string;
  params: any;
  timestamp: Date;
  reversible: boolean;
  reverseOperation?: () => Promise<void>;
}
```

#### FuzzyMatcher
**Location**: `src/core/mcp/fuzzy-matcher.ts`

Provides fuzzy string matching with confidence scoring:

**Features**:
- **Fuse.js Integration**: Advanced fuzzy matching algorithms
- **Confidence Scoring**: 0-100 confidence scale
- **Text Normalization**: Improved matching through normalization
- **Position Detection**: Accurate match position finding

**Configuration Options**:
```typescript
interface FuzzySearchOptions {
  threshold?: number; // 0.0 (exact) to 1.0 (anything)
  minConfidence?: number; // Minimum confidence score
  includeScore?: boolean; // Include detailed scoring
}
```

**Match Results**:
```typescript
interface FuzzyMatch {
  line: number;
  column: number;
  text: string;
  confidence: number;
  context: string;
}
```

#### ASTSearcher
**Location**: `src/core/mcp/ast-searcher.ts`

Provides AST-based code searching:

**Features**:
- **Language Detection**: Automatic language detection
- **AST Parsing**: Parse code into abstract syntax trees
- **Semantic Matching**: Match code patterns semantically
- **Structure-Aware Search**: Understand code structure

**Supported Languages**:
- TypeScript/JavaScript
- Python
- Java
- C/C++
- Go
- Rust
- And more...

### Security Architecture

#### WorkspaceSecurity Integration
**Location**: `src/core/security/workspace.ts`

All file operations are validated through the security layer:

**Security Features**:
- **Workspace Boundary Enforcement**: All operations restricted to workspace
- **Extension Validation**: Configurable allowed file extensions
- **Size Limits**: Maximum file size enforcement
- **Path Validation**: Prevent path traversal attacks
- **Permission Checking**: Validate read/write permissions

**Validation Process**:
1. **Path Resolution**: Resolve and normalize file paths
2. **Boundary Check**: Ensure path is within workspace
3. **Extension Check**: Validate file extension against allowed list
4. **Size Check**: Ensure file size is within limits
5. **Permission Check**: Validate required permissions

#### Security Configuration
```typescript
interface SecurityConfig {
  allowedExtensions: string[];
  restrictToWorkspace: boolean;
  maxFileSize: number;
}
```

### Performance Optimizations

#### Memory Management
- **Bounded Operations**: Limit memory usage for large files
- **Streaming Support**: Process large files in chunks
- **Efficient Traversal**: Optimized directory traversal
- **Result Limiting**: Prevent memory exhaustion

#### Caching Strategy
- **Metadata Caching**: Cache file metadata for performance
- **AST Caching**: Cache parsed ASTs for repeated searches
- **Security Validation Caching**: Cache security checks
- **Language Detection Caching**: Cache language detection results

#### Timeout Protection
- **Operation Timeouts**: Prevent hanging operations
- **Early Termination**: Stop operations that take too long
- **Progress Tracking**: Monitor operation progress
- **Resource Limits**: Enforce memory and CPU limits

### Tool Integration

#### Tool Service Integration
**Location**: `src/core/tools/mcp-tools.ts`

The MCP tools are integrated into the broader tool system:

**Tool Registration**:
```typescript
class MCPToolService {
  async registerTools(client: MCPClient): Promise<void>;
  async executeTools(toolName: string, args: any): Promise<ToolResult>;
  async listAvailableTools(): Promise<Tool[]>;
}
```

**Tool Execution Flow**:
1. **Tool Request**: AI model requests tool execution
2. **Validation**: Parameters validated against schema
3. **Security Check**: Security validation performed
4. **Execution**: Tool logic executed with error handling
5. **Result Processing**: Results formatted and returned
6. **State Tracking**: Changes tracked for rollback

#### Provider Integration
Both filesystem and shell tools are available to all AI providers through the standardized interface:

**Tool Registration**:
- Filesystem tools: `filesystem_ReadFile`, `filesystem_WriteFile`, `filesystem_EditFile`, `filesystem_SearchFiles`, `filesystem_ListDirectory`
- Shell tools: `shell_RunCommand`
- Todo tools: `todo_CreateTodo`, `todo_ListTodos`, `todo_GetTodo`, `todo_UpdateTodo`, `todo_DeleteTodo`, `todo_SetVerificationMethod`, `todo_UpdateVerificationStatus`, `todo_GetTodosNeedingVerification`, `todo_CreateTaskGroup`, `todo_GetExecutableTasks`, `todo_UpdateExecutionStatus`

**Tool Call Flow**:
1. **Provider Request**: AI provider requests tool execution
2. **Tool Service**: Routes to appropriate MCP client (filesystem, shell, or todo)
3. **Security Check**: Validation and approval for sensitive operations
4. **Execution**: Tool executed with full validation and logging
5. **Response**: Results returned to provider
6. **Error Handling**: Errors handled and reported

### Error Handling Strategy

#### Layered Error Handling
1. **Input Validation**: Parameter validation and sanitization
2. **Security Validation**: Workspace and permission checks
3. **File System Errors**: Handle OS-level file errors
4. **Tool Errors**: Handle tool-specific errors
5. **MCP Errors**: Handle protocol-level errors

#### Error Recovery
- **Automatic Rollback**: Failed operations trigger rollback
- **Graceful Degradation**: Partial failures don't break entire operation
- **User Feedback**: Clear error messages with suggestions

#### Error Context
All errors include comprehensive context:
```typescript
interface ErrorContext {
  tool: string;
  operation: string;
  path: string;
  timestamp: Date;
  params: any;
}
```

### Extension Points

#### Adding New Tools
1. **Define Tool Schema**: Add to `listTools()` method
2. **Implement Tool Logic**: Add to `callTool()` method
3. **Add Security Validation**: Integrate with `WorkspaceSecurity`
4. **Add State Tracking**: Integrate with `FileSystemState`
5. **Add Error Handling**: Proper error handling and recovery

#### Adding New Search Types
1. **Create Search Implementation**: Implement search logic
2. **Add to SearchFiles Tool**: Integrate with existing search system
3. **Add Configuration Options**: Extend search options
4. **Add Result Processing**: Handle search results consistently

#### Adding New MCP Clients
1. **Extend MCPClient**: Implement abstract methods
2. **Register with Tool Service**: Add to tool service in chat command initialization
3. **Add Configuration**: Extend configuration system if needed
4. **Add Error Handling**: Implement comprehensive error handling
5. **Add Security Integration**: Implement approval workflows for sensitive operations
6. **Add Logging**: Integrate with logging system for audit trails

### Best Practices

#### Tool Implementation
1. **Validate Early**: Validate all inputs before processing
2. **Fail Fast**: Detect errors early and fail gracefully
3. **Provide Context**: Include helpful error messages
4. **Track Changes**: Enable rollback for all modifications
5. **Use Atomic Operations**: Ensure consistency

#### Security
1. **Validate All Paths**: Never trust user-provided paths
2. **Enforce Boundaries**: Strictly enforce workspace boundaries
3. **Check Permissions**: Validate permissions for all operations
4. **Sanitize Input**: Clean and validate all input parameters
5. **Log Security Events**: Track security-relevant operations

#### Performance
1. **Limit Resources**: Enforce memory and CPU limits
2. **Use Timeouts**: Prevent hanging operations
3. **Cache Appropriately**: Cache expensive operations
4. **Stream Large Data**: Process large files in chunks
5. **Monitor Performance**: Track operation performance

#### Error Handling
1. **Specific Error Types**: Use specific error classes
2. **Include Suggestions**: Provide actionable error messages
3. **Enable Recovery**: Support rollback and recovery
4. **Log Appropriately**: Balance debugging and security
5. **Handle Partial Failures**: Don't fail entire operations