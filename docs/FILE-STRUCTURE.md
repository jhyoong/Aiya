# File Structure Documentation

## Overview

This document provides a comprehensive breakdown of the Aiya project file structure, detailing the purpose and responsibilities of each directory and key files.

## Root Directory Structure

```
Aiya/
├── src/                    # Source code
├── tests/                  # Test files
├── docs/                   # Documentation
├── dist/                   # Built output (generated)
├── node_modules/           # Dependencies (generated)
├── coverage/               # Test coverage reports (generated)
├── memory/                 # Development notes and examples
├── package.json            # Project configuration
├── tsconfig.json          # TypeScript configuration
├── vitest.config.ts       # Test configuration
├── eslint.config.js       # ESLint configuration
├── README.md              # Project overview
├── LICENSE                # MIT license
└── CLAUDE.md              # Claude Code guidance
```

## Source Code Structure (`src/`)

### CLI Layer (`src/cli/`)

The command-line interface layer handles CLI operations and command registration.

```
src/cli/
├── index.ts               # Main CLI entry point - sets up Commander.js
├── CommandRegistry.ts     # Central command registration system
├── CommandExecutor.ts     # Command execution and validation logic
├── CommandUtils.ts        # CLI utility functions
├── suggestions.ts         # Command suggestion engine
└── commands/              # Individual command implementations
    ├── index.ts          # Command exports
    ├── init.ts           # Initialize project configuration
    └── chat.ts           # Start chat interface
```

**Key Files**:

- **`index.ts`**: Bootstrap CLI application, register commands, handle global options
- **`CommandRegistry.ts`**: Registry pattern for managing chat commands with validation
- **`CommandExecutor.ts`**: Execute commands with proper context and error handling
- **`commands/init.ts`**: Interactive setup wizard for project initialization
- **`commands/chat.ts`**: Launch the main chat interface

### Core Layer (`src/core/`)

The core business logic layer containing providers, configuration, and tools.

#### Configuration (`src/core/config/`)

```
src/core/config/
├── manager.ts             # Main configuration manager
├── CapabilityManager.ts   # Provider capability definitions
├── ModelRegistry.ts       # Model information registry
├── generation.ts          # Configuration file generation
├── models.ts             # Model definitions and metadata
├── testing.ts            # Test configuration utilities
└── collectors/           # Provider-specific configuration collectors
    ├── base.ts           # Base collector interface
    ├── ollama.ts         # Ollama configuration collector
    ├── openai.ts         # OpenAI configuration collector
    └── gemini.ts         # Gemini configuration collector
```

**Key Files**:

- **`manager.ts`**: Hierarchical configuration management with multi-provider support
- **`CapabilityManager.ts`**: Centralized provider capability information
- **`generation.ts`**: Generate configuration files with proper formatting

#### Providers (`src/core/providers/`)

```
src/core/providers/
├── base.ts               # Abstract base provider class and interfaces
├── factory.ts            # Provider factory with registration system
├── ollama.ts             # Ollama local model provider
├── openai.ts             # OpenAI API provider
├── anthropic.ts          # Anthropic Claude provider
├── gemini.ts             # Google Gemini provider
├── azure.ts              # Azure OpenAI provider
└── bedrock.ts            # AWS Bedrock provider
```

**Key Files**:

- **`base.ts`**: Abstract LLMProvider class defining standard interface
- **`factory.ts`**: Factory pattern for creating and validating provider instances
- **Provider implementations**: Each provider handles specific AI service integration

#### MCP Tools (`src/core/mcp/`)

```
src/core/mcp/
├── base.ts                    # MCP client base class and interfaces
├── filesystem.ts              # Main filesystem MCP client with 5 core tools
├── filesystem-state.ts        # State tracking and rollback system
├── fuzzy-matcher.ts           # Fuzzy search implementation
├── ast-searcher.ts            # AST-based code search
├── shell/                     # Modular shell MCP client for command execution
│   ├── constants.ts           # All configuration constants
│   ├── types.ts              # TypeScript interfaces and types
│   ├── index.ts              # Barrel exports
│   ├── shell-mcp-client.ts   # Main client implementation
│   ├── command-categorization.ts # Pattern-based command categorization
│   ├── security/             # Security modules (4 components)
│   ├── monitoring/           # Monitoring modules (2 components)
│   └── errors/               # Error modules (3 components)
├── IMPLEMENTATION_PLAN.md     # MCP implementation planning
├── PHASE_2_PLAN.md           # Phase 2 development plan
└── TOOL_REVAMP.md            # Tool system revamp documentation
```

**Key Files**:

- **`filesystem.ts`**: Primary MCP client with ReadFile, WriteFile, EditFile, SearchFiles, ListDirectory tools
- **`shell/`**: Modular shell MCP client with ExecuteCommand tool featuring pattern-based security categorization
- **`fuzzy-matcher.ts`**: Fuse.js-based fuzzy matching with confidence scoring
- **`filesystem-state.ts`**: Change tracking and rollback capabilities for file operations

#### Security (`src/core/security/`)

```
src/core/security/
└── workspace.ts          # Workspace security validation and file access control
```

**Key Files**:

- **`workspace.ts`**: Enforce workspace boundaries, validate file access, security checks

#### Additional Core Components

```
src/core/
├── errors/               # Error handling and mapping
│   ├── index.ts         # Error exports
│   ├── BaseProviderErrorHandler.ts  # Base error handling
│   ├── OllamaErrorMapper.ts         # Ollama-specific error mapping
│   ├── OpenAIErrorMapper.ts         # OpenAI-specific error mapping
│   └── GeminiErrorMapper.ts         # Gemini-specific error mapping
├── operations/           # File operations
│   ├── atomic.ts        # Atomic file operations
│   ├── pattern-matching.ts  # Pattern matching utilities
│   └── queue.ts         # Operation queue management
├── tokens/              # Token counting and logging
│   ├── counter.ts       # Token counting utilities
│   └── logger.ts        # Token usage logging
└── tools/               # Tool execution
    ├── executor.ts      # Tool execution engine
    └── mcp-tools.ts     # MCP tool service integration
```

### UI Layer (`src/ui/`)

The terminal user interface layer built with React and Ink.

#### Main Components (`src/ui/`)

```
src/ui/
├── AiyaApp.tsx              # Main application root component
└── components/              # UI components
    ├── index.ts            # Component exports
    ├── ChatInterface.tsx   # Primary chat interface
    ├── UnifiedInput.tsx    # Advanced input handling component
    ├── SearchResults.tsx   # Search results display
    ├── SimpleStatusBar.tsx # Simple status information
    ├── StatusBar.tsx       # Advanced status bar
    ├── StartupLoader.tsx   # Application startup loader
    ├── ToolExecution.tsx   # Tool execution visualization
    └── setup/              # Setup wizard components
        ├── index.ts        # Setup component exports
        ├── SetupWizard.tsx # Main setup wizard
        ├── WelcomeScreen.tsx   # Welcome screen
        ├── ProviderSelection.tsx  # Provider selection
        ├── ProviderConfigForm.tsx # Provider configuration
        └── ConnectionTest.tsx     # Connection testing
```

**Key Files**:

- **`AiyaApp.tsx`**: Root component managing application modes and routing
- **`ChatInterface.tsx`**: Main chat UI with streaming support and memory management
- **`UnifiedInput.tsx`**: Sophisticated input component with multi-line support and suggestions

#### Core UI Utilities (`src/ui/core/`)

```
src/ui/core/
└── TextBuffer.ts         # Advanced text editing system with visual line wrapping
```

**Key Files**:

- **`TextBuffer.ts`**: Comprehensive text editing with Unicode support, undo/redo, and visual layout

#### Hooks (`src/ui/hooks/`)

```
src/ui/hooks/
├── useKeypress.ts        # Advanced keyboard input handling
└── useTerminalSize.ts    # Terminal size detection and handling
```

**Key Files**:

- **`useKeypress.ts`**: Custom hook for handling keyboard input, paste operations, and key sequences

#### Utilities (`src/ui/utils/`)

```
src/ui/utils/
├── textUtils.ts          # Unicode text processing utilities
├── textProcessing.ts     # Text analysis and processing functions
├── visualLayout.ts       # Visual layout calculation for terminal display
└── memoryManagement.ts   # Memory management and resource cleanup
```

**Key Files**:

- **`textUtils.ts`**: Unicode-aware text manipulation functions
- **`visualLayout.ts`**: Efficient text wrapping and layout calculation
- **`memoryManagement.ts`**: Resource cleanup and memory management patterns

### Type Definitions (`src/types/`)

```
src/types/
├── index.ts              # Type exports
├── ErrorTypes.ts         # Error-related type definitions
├── KeyboardTypes.ts      # Keyboard input type definitions
├── ProviderTypes.ts      # Provider-related type definitions
└── UtilityTypes.ts       # General utility type definitions
```

**Key Files**:

- **`ProviderTypes.ts`**: Comprehensive provider interface definitions
- **`KeyboardTypes.ts`**: Keyboard input and event type definitions

### Utilities (`src/utils/`)

```
src/utils/
├── index.ts              # Utility exports
├── diff.ts               # Text diff utilities
├── file-ops.ts           # File operation utilities
└── thinking-parser.ts    # AI thinking output parsing
```

## Test Structure (`tests/`)

```
tests/
├── unit/                 # Unit tests
│   ├── foundation.test.ts    # Basic functionality tests
│   ├── providers/           # Provider-specific tests
│   │   ├── base-provider-test.ts   # Base provider testing
│   │   ├── factory.test.ts         # Provider factory tests
│   │   ├── ollama.test.ts         # Ollama provider tests
│   │   ├── openai.test.ts         # OpenAI provider tests
│   │   └── gemini.test.ts         # Gemini provider tests
│   ├── mcp/                # MCP tool tests
│   │   ├── fuzzy-matcher.test.ts  # Fuzzy search tests
│   │   └── ast-searcher.test.ts   # AST search tests
│   └── ui/                 # UI component tests
│       ├── text-processing.test.ts  # Text processing tests
│       └── visual-layout.test.ts    # Visual layout tests
├── integration/          # Integration tests
│   └── providers/        # Multi-provider integration tests
│       ├── multi-provider.test.ts     # Multi-provider scenarios
│       ├── provider-switching.test.ts # Provider switching tests
│       └── validation.test.ts         # Configuration validation tests
├── performance/          # Performance tests
│   └── visual-layout-benchmark.test.ts # Layout performance benchmarks
├── mocks/               # Test mocks
│   └── providers/       # Mock provider implementations
│       ├── base-mock-provider.ts   # Base mock provider
│       ├── mock-factory.ts         # Mock factory
│       ├── mock-ollama.ts         # Mock Ollama provider
│       ├── mock-openai.ts         # Mock OpenAI provider
│       └── mock-gemini.ts         # Mock Gemini provider
└── utils/               # Test utilities
    ├── test-setup.ts    # Test environment setup
    ├── config-builder.ts # Test configuration builder
    └── assertions.ts    # Custom test assertions
```

## Documentation (`docs/`)

```
docs/
├── TODO.md              # Development TODO list
├── ARCHITECTURE.md      # High-level architecture overview
├── PROVIDERS.md         # Provider system detailed documentation
├── MCP-TOOLS.md         # MCP tool system documentation
├── UI-SYSTEM.md         # UI system architecture documentation
└── FILE-STRUCTURE.md    # This file
```

## Configuration Files

### Build and Development Configuration

- **`package.json`**: Project metadata, dependencies, and npm scripts
- **`tsconfig.json`**: TypeScript compiler configuration with strict settings
- **`vitest.config.ts`**: Test runner configuration with coverage settings
- **`eslint.config.js`**: Code linting rules and configuration

### Runtime Configuration

- **`.aiya.yaml`**: Project-specific configuration (generated)
- **`~/.aiya/config.yaml`**: Global user configuration (generated)

## Development Memory (`memory/`)

```
memory/
├── CLAUDE.md.old        # Previous Claude guidance
├── examples/            # Development examples and prototypes
├── old/                # Archived development notes
└── various planning and progress files
```

## Generated Directories

### Build Output (`dist/`)
- Compiled TypeScript output
- Ready-to-run JavaScript files
- Type definition files (.d.ts)

### Test Coverage (`coverage/`)
- HTML coverage reports
- Coverage data files
- Per-file coverage information

## Key File Responsibilities

### Configuration Management
- **`src/core/config/manager.ts`**: Central configuration with hierarchical loading
- **`src/core/config/CapabilityManager.ts`**: Provider capability definitions
- **`src/core/config/generation.ts`**: Generate properly formatted configuration files

### Provider System
- **`src/core/providers/base.ts`**: Standard provider interface and error types
- **`src/core/providers/factory.ts`**: Provider creation with validation
- **Individual providers**: Service-specific implementations with error handling

### MCP Tool System
- **`src/core/mcp/filesystem.ts`**: Core file operations with security validation
- **`src/core/mcp/shell/`**: Secure shell command execution with pattern-based categorization and user confirmation
- **`src/core/mcp/fuzzy-matcher.ts`**: Advanced fuzzy search with confidence scoring
- **`src/core/security/workspace.ts`**: Workspace boundary enforcement

### UI System
- **`src/ui/AiyaApp.tsx`**: Application routing and global state management
- **`src/ui/components/ChatInterface.tsx`**: Chat functionality with streaming
- **`src/ui/core/TextBuffer.ts`**: Advanced text editing with visual layout
- **`src/ui/hooks/useKeypress.ts`**: Terminal input handling

### Testing Infrastructure
- **`tests/mocks/`**: Mock implementations for testing
- **`tests/utils/`**: Test utilities and setup
- **`vitest.config.ts`**: Test configuration with coverage

## Navigation Tips

### Finding Specific Functionality

**Provider Operations**: Look in `src/core/providers/`
**File Operations**: Check `src/core/mcp/filesystem.ts`
**Shell Command Execution**: Check `src/core/mcp/shell/` (modular architecture)
**Configuration**: Examine `src/core/config/manager.ts`
**UI Components**: Browse `src/ui/components/`
**Text Editing**: See `src/ui/core/TextBuffer.ts`
**Command Handling**: Check `src/cli/commands/`
**Error Handling**: Look in `src/core/errors/`
**Type Definitions**: Browse `src/types/`

### Common Development Tasks

**Adding a New Provider**:
1. Create provider class in `src/core/providers/`
2. Register in `src/core/providers/factory.ts`
3. Add error handling in `src/core/errors/`
4. Add tests in `tests/unit/providers/`

**Adding a New MCP Tool**:
1. Add tool schema to `src/core/mcp/filesystem.ts`
2. Implement tool logic in the same file
3. Add security validation
4. Add tests in `tests/unit/mcp/`

**Adding a UI Component**:
1. Create component in `src/ui/components/`
2. Add to component exports in `src/ui/components/index.ts`
3. Add tests in `tests/unit/ui/`
4. Update parent components as needed

**Modifying Configuration**:
1. Update interfaces in `src/core/config/manager.ts`
2. Update generation logic in `src/core/config/generation.ts`
3. Add validation in `src/core/providers/factory.ts`
4. Update tests in `tests/integration/providers/`

This file structure is designed for maintainability, testability, and clear separation of concerns while supporting the complex requirements of a multi-provider AI terminal application.