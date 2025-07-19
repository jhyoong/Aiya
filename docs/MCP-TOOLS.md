# MCP Tool System Architecture

## Overview

The Model Context Protocol (MCP) tool system in Aiya provides a structured way for AI models to interact with the file system, execute shell commands, and access other external resources. It implements comprehensive file operations and secure command execution with validation, security measures, and advanced functionality.

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

#### Six Core Tools

The MCP system provides two main client implementations:

1. **FilesystemMCPClient** - Five file operation tools
2. **ShellMCPClient** - One command execution tool

### Filesystem Tools (FilesystemMCPClient)

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
- **Backup Creation**: Automatic backup before overwriting
- **Mode Support**: Overwrite, create-only, and append modes
- **Directory Creation**: Optional parent directory creation
- **Rollback Support**: Reversible operations with state tracking

**Safety Measures**:
- Disk space validation
- Permission checking
- Backup creation before overwriting
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
- **Backup Creation**: Automatic backup before editing

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

---

## Shell MCP Client

### 6. ExecuteCommand Tool

**Location**: `src/core/mcp/shell/` (modular architecture)

**Purpose**: Execute shell commands safely within workspace boundaries with comprehensive security measures

**Documentation**: For detailed information about the Shell Tool including architecture, security features, configuration, and usage examples, see the dedicated [Shell Tool Documentation](./SHELL-TOOL.md).

**Key Features**:
- **Pattern-Based Security**: Simple command categorization (SAFE/RISKY/DANGEROUS/BLOCKED)
- **User Confirmation System**: Interactive prompts for risky operations with session memory
- **Workspace Boundary Enforcement**: All operations restricted to project workspace
- **Comprehensive Monitoring**: Full audit trail and performance monitoring
- **Modular Architecture**: Clean separation of security, monitoring, and error handling

**Response Structure**:
```typescript
{
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}
```

**Quick Configuration Example**:
```typescript
interface ShellToolConfig {
  requireConfirmationForRisky: boolean;     // Default: true
  requireConfirmationForDangerous: boolean; // Default: true
  allowDangerous: boolean;                  // Default: false
  maxExecutionTime: number;                 // Default: 30 seconds
  sessionMemory: boolean;                   // Default: true
}
```

---

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
Tools are available to all AI providers through the standardized interface:

**Tool Call Flow**:
1. **Provider Request**: AI provider requests tool execution
2. **Tool Service**: Routes to appropriate MCP client
3. **Execution**: Tool executed with full validation
4. **Response**: Results returned to provider
5. **Error Handling**: Errors handled and reported

### Error Handling Strategy

#### Layered Error Handling
1. **Input Validation**: Parameter validation and sanitization
2. **Security Validation**: Workspace and permission checks
3. **File System Errors**: Handle OS-level file errors
4. **Tool Errors**: Handle tool-specific errors
5. **MCP Errors**: Handle protocol-level errors

#### Error Recovery
- **Automatic Rollback**: Failed operations trigger rollback
- **Backup Restoration**: Restore from backups on failure
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
2. **Register with Tool Service**: Add to tool service
3. **Add Configuration**: Extend configuration system
4. **Add Error Handling**: Implement error handling

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