# Aiya Architecture Documentation

## Overview

Aiya is a modern terminal-based CLI tool for AI-assisted development built with TypeScript, React, and Ink. The architecture follows a layered approach with clear separation of concerns, supporting multiple AI providers, secure file operations, and an interactive terminal interface.

## Core Architecture Principles

- **Multi-Provider Support**: Seamless integration with various AI providers (Ollama, OpenAI, Anthropic, etc.)
- **Security First**: Workspace-restricted file operations with validation
- **Modular Design**: Clear separation between CLI, Core, and UI layers
- **Extensible**: Plugin-like architecture for commands and tools
- **Type Safety**: Full TypeScript implementation with strict typing

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLI Layer                              │
├─────────────────────────────────────────────────────────────┤
│  index.ts → CommandRegistry → CommandExecutor              │
│  (Entry Point)   (Registry)      (Execution)               │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Core Layer                              │
├─────────────────────────────────────────────────────────────┤
│  ConfigManager ← → ProviderFactory ← → LLM Providers       │
│  (Configuration)    (Factory)           (AI Models)        │
│                                                             │
│  MCPToolService ← → FilesystemMCPClient ← → Security       │
│  (Tool Service)     (File Operations)        (Validation)  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      UI Layer                               │
├─────────────────────────────────────────────────────────────┤
│  AiyaApp → ChatInterface → UnifiedInput → Components       │
│  (Router)   (Chat Logic)   (Input Handler)  (UI Elements)  │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── cli/                    # Command-line interface layer
│   ├── index.ts           # Main CLI entry point
│   ├── CommandRegistry.ts # Command registration system
│   ├── CommandExecutor.ts # Command execution logic
│   ├── CommandUtils.ts    # Command utilities
│   ├── suggestions.ts     # Command suggestions
│   └── commands/          # Individual command implementations
├── core/                  # Core business logic
│   ├── config/           # Configuration management
│   ├── providers/        # AI provider implementations
│   ├── mcp/             # Model Context Protocol tools
│   │   ├── filesystem.ts # File system operations client
│   │   ├── shell.ts     # Shell command execution client
│   │   └── base.ts      # Base MCP client interface
│   ├── security/        # Security and validation
│   ├── operations/      # File operations
│   ├── tokens/          # Token counting and logging
│   ├── errors/          # Error handling
│   └── tools/           # Tool execution
├── ui/                   # Terminal user interface
│   ├── AiyaApp.tsx      # Main application component
│   ├── components/      # UI components
│   ├── core/           # UI core utilities
│   ├── hooks/          # Custom React hooks
│   └── utils/          # UI utility functions
├── types/               # TypeScript type definitions
└── utils/              # General utilities
```

## Key Components

### CLI Layer

#### index.ts - Main Entry Point
- **Purpose**: Bootstrap the CLI application
- **Responsibilities**:
  - Initialize Commander.js program
  - Register global options (`--verbose`, `--config`)
  - Set up environment variables
  - Handle process lifecycle and errors
- **Pattern**: Command Pattern with Commander.js

#### CommandRegistry.ts - Command Registration System
- **Purpose**: Central registry for managing chat commands
- **Responsibilities**:
  - Register commands with metadata and validation
  - Provide command lookup and help generation
  - Validate command parameters and arguments
- **Pattern**: Registry Pattern + Static Factory

#### CommandExecutor.ts - Command Execution Logic
- **Purpose**: Execute commands with proper validation and context
- **Responsibilities**:
  - Parse and validate command input
  - Manage execution context and session state
  - Handle tool execution and file operations
  - Provide error handling and logging
- **Pattern**: Command Pattern + Context Pattern

### Core Layer

#### ConfigManager - Configuration Management
- **Purpose**: Manage application configuration across multiple sources
- **Responsibilities**:
  - Load hierarchical configuration (global → project → environment)
  - Support both single and multi-provider configurations
  - Handle provider switching and validation
  - Manage configuration persistence
- **Pattern**: Builder Pattern + Factory Pattern

#### ProviderFactory - AI Provider Factory
- **Purpose**: Create and validate LLM provider instances
- **Responsibilities**:
  - Register provider implementations
  - Validate provider configurations
  - Create provider instances with proper setup
  - Handle provider-specific requirements
- **Pattern**: Factory Pattern + Registry Pattern

#### FilesystemMCPClient - File Operations
- **Purpose**: Provide comprehensive file system operations through MCP
- **Responsibilities**:
  - Implement 5 core tools: ReadFile, WriteFile, EditFile, SearchFiles, ListDirectory
  - Integrate with workspace security validation
  - Support advanced search capabilities (fuzzy, AST, regex)
  - Provide atomic operations and rollback capabilities
- **Pattern**: Strategy Pattern + Command Pattern + Facade Pattern

#### ShellMCPClient - Shell Command Execution
- **Purpose**: Execute shell commands through the MCP framework
- **Responsibilities**:
  - Implement RunCommand tool for shell command execution
  - Handle command timeout and error management
  - Integrate with approval system for dangerous commands
  - Provide comprehensive logging and memory tracking
- **Pattern**: Command Pattern + Observer Pattern

#### WorkspaceSecurity - Security Layer
- **Purpose**: Ensure secure file operations within workspace boundaries
- **Responsibilities**:
  - Validate file access permissions
  - Enforce workspace restrictions
  - Check file extensions and size limits
  - Provide secure glob patterns
- **Pattern**: Validator Pattern + Guard Pattern

### UI Layer

#### AiyaApp.tsx - Main UI Component
- **Purpose**: Root UI component managing application modes
- **Responsibilities**:
  - Mode management (chat, search, command, tool)
  - Component routing based on current mode
  - Status management and terminal size handling
  - Coordinate between different interfaces
- **Pattern**: State Machine Pattern + Observer Pattern

#### ChatInterface.tsx - Chat Interface
- **Purpose**: Handle chat interactions with streaming support
- **Responsibilities**:
  - Message state management with bounded arrays
  - Streaming content handling with size limits
  - Provider switching logic
  - Memory management for long conversations
- **Pattern**: Observer Pattern + Memory Management Pattern

#### UnifiedInput.tsx - Input Handler
- **Purpose**: Handle user input with command suggestions and validation
- **Responsibilities**:
  - Process user input and commands
  - Provide command suggestions and auto-completion
  - Handle special commands (slash commands)
  - Manage input state and history
- **Pattern**: Command Pattern + Strategy Pattern

## Data Flow

### Configuration Flow
1. `ConfigManager` loads configuration from multiple sources
2. `ProviderFactory` validates and creates provider instances
3. Providers are registered and available for use
4. Runtime provider switching updates active configuration

### Command Flow
1. User input → `UnifiedInput` → `CommandExecutor`
2. `CommandExecutor` validates against `CommandRegistry`
3. Commands execute with proper context and error handling
4. Results flow back through UI components

### File Operations Flow
1. Commands request file operations → `MCPToolService`
2. `MCPToolService` → `FilesystemMCPClient`
3. `FilesystemMCPClient` validates through `WorkspaceSecurity`
4. Operations execute with atomic guarantees and rollback support

### UI Update Flow
1. State changes trigger React re-renders
2. Streaming updates flow through bounded message arrays
3. Status updates propagate through component hierarchy
4. Memory management prevents resource exhaustion

## Design Patterns Used

### Creational Patterns
- **Factory Pattern**: Provider creation and configuration
- **Builder Pattern**: Configuration building with defaults
- **Registry Pattern**: Command and provider registration

### Structural Patterns
- **Facade Pattern**: Simplified interfaces for complex operations
- **Adapter Pattern**: Provider interface adaptation
- **Composite Pattern**: UI component composition

### Behavioral Patterns
- **Command Pattern**: CLI commands and file operations
- **Strategy Pattern**: Search strategies and execution strategies
- **Observer Pattern**: UI updates and message streaming
- **State Machine Pattern**: Mode management and processing states

## Security Architecture

### Multi-Layer Security
1. **Workspace Validation**: All file operations restricted to workspace
2. **Extension Filtering**: Configurable allowed file extensions
3. **Size Limits**: Maximum file size enforcement
4. **Path Validation**: Secure path resolution and validation
5. **Access Control**: Read/write permission validation

### Security Flow
```
File Operation Request
        ↓
WorkspaceSecurity.validateFileAccess()
        ↓
Path Resolution & Validation
        ↓
Extension & Size Checking
        ↓
Permission Validation
        ↓
Approved Operation
```

## Extension Points

### Adding New Providers
1. Implement `LLMProvider` interface
2. Register in `ProviderFactory`
3. Add configuration to `ExtendedProviderConfig`
4. Update validation logic

### Adding New Commands
1. Implement command handler
2. Register in `CommandRegistry`
3. Add to command definitions
4. Update UI components if needed

### Adding New Tools
1. Add tool schema to MCP client's `listTools()` method
2. Implement tool logic in client's `callTool()` method
3. Add security validation where appropriate
4. Include rollback capabilities for stateful operations
5. Register client with `MCPToolService` for integration

## Performance Considerations

### Memory Management
- Bounded message arrays in chat interface
- Streaming content with size limits
- Efficient file operations with chunking
- Memory-conscious directory traversal

### Resource Optimization
- Lazy loading of provider instances
- Efficient configuration caching
- Minimal dependency loading
- Optimized terminal rendering

### Scalability
- Modular architecture for easy extension
- Separation of concerns for maintainability
- Plugin-like command system
- Configurable resource limits

## Testing Strategy

### Unit Testing
- Individual component testing with mocks
- Provider factory testing with mock providers
- Configuration management testing
- File operation testing with temporary files

### Integration Testing
- Multi-provider scenario testing
- End-to-end command execution testing
- Configuration loading and validation testing
- Security boundary testing

### Performance Testing
- Memory usage monitoring
- Large file operation testing
- Concurrent operation testing
- UI responsiveness testing