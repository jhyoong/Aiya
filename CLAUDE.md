# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Build and Development
- `npm run build` - Build TypeScript to JavaScript (output: `dist/`)
- `npm run dev` - Build in watch mode for development
- `npm run typecheck` - Run TypeScript type checking without emit
- `npm start` - Run the built CLI application

### Testing
- `npm run test` - Run all tests in watch mode using Vitest
- `npm run test:run` - Run all tests once
- `npm run test:unit` - Run unit tests only (`tests/unit/`)
- `npm run test:integration` - Run integration tests only (`tests/integration/`)
- `npm run test:coverage` - Run tests with coverage report using c8
- `npm run test:ui` - Run tests with Vitest UI

### Linting
- `npm run lint` - Currently returns "Linting not configured yet"

## Architecture

### High-Level Structure
This is a terminal-based AI assistant CLI built with TypeScript and React/Ink. The application provides multi-provider AI support with secure file operations and a modern terminal interface.

### Core Components

#### CLI Layer (`src/cli/`)
- **CommandExecutor.ts** - Handles command execution and routing
- **CommandRegistry.ts** - Registers and manages available commands
- **commands/** - Individual command implementations:
  - `init.ts` - Initialize configuration
  - `chat.ts` - Start interactive chat session
  - `search.ts` - File search functionality
- **suggestions.ts** - Provides tab completion and command suggestions

#### Core Engine (`src/core/`)

**Provider System (`src/core/providers/`):**
- **Fully Implemented Providers**: Ollama, OpenAI, Gemini (all working)
- **Partially Tested Providers**: Anthropic, Azure OpenAI, Bedrock (implemented but not fully tested)
- **Base Provider Interface**: `base.ts` with standardized streaming, authentication, and capabilities
- **Provider Factory**: `factory.ts` for centralized provider creation
- **Error Handling**: Provider-specific error mappers for each service

**Configuration Management (`src/core/config/`):**
- **CapabilityManager.ts** - Detects and manages provider features
- **ModelRegistry.ts** - Manages available models across providers
- **manager.ts** - Main configuration loading and validation
- **collectors/** - Gather provider information and capabilities

**MCP Integration (`src/core/mcp/`):**
- **base.ts** - Abstract MCP client interface
- **filesystem.ts** - Filesystem operations with workspace restrictions
- **enhanced-filesystem.ts** - Advanced file operations with atomic writes
- Note: MCP infrastructure exists but no actual servers are connected

**Security (`src/core/security/`):**
- **workspace.ts** - File access validation and workspace boundaries

#### UI Layer (`src/ui/`)
- **AiyaApp.tsx** - Main React/Ink application with mode switching
- **components/** - Terminal UI components:
  - `ChatInterface.tsx` - Main chat interaction
  - `CommandInput.tsx` - Command input with suggestions
  - `SearchResults.tsx` - File search results display
  - `StatusBar.tsx` - Provider/model status display
  - `ToolExecution.tsx` - Tool execution progress
  - `setup/` - Complete setup wizard with provider selection and testing
- **hooks/** - Custom React hooks for terminal interactions
- **core/TextBuffer.ts** - Text buffer management for terminal display

### Key Design Patterns

#### Multi-Provider Architecture
- Factory pattern for provider instantiation with 6 supported providers
- Abstract base class ensuring consistent interface across all providers
- Runtime provider switching during conversations via `/model-switch`
- Centralized capability detection and routing

#### Configuration System
- YAML-based configuration with environment variable overrides
- Multi-source hierarchy: project (`.aiya.yaml`) > global (`~/.aiya/config.yaml`) > environment
- Multi-provider configuration with named provider instances
- Security settings for file access restrictions

#### Terminal UI (React/Ink)
- Reactive terminal interface with streaming support
- Command suggestions and tab completion
- Real-time status updates and token tracking
- Modern terminal behaviors with multi-line input support

#### Unified Command System
- **CommandRegistry**: Centralized command registration and management
- **CommandExecutor**: Handles command parsing, validation, and execution
- **Context-Aware Handlers**: Commands access session data and MCP clients through context
- **Suggestion Integration**: Real-time command suggestions and tab completion
- **Error Handling**: Comprehensive validation and error messaging

### Slash Commands (Fully Implemented via CommandRegistry)
The application provides a comprehensive set of slash commands through a unified CommandRegistry system:
- `/read <file>` - Read and display file content using MCP filesystem
- `/add <file>` - Add file to context for next prompt
- `/search <pattern>` - Search for files using MCP filesystem search
- `/model-switch [provider]` - Switch between configured providers with runtime updates
- `/thinking [mode]` - Change thinking display mode (on/brief/off)
- `/tokens` - Show detailed token usage statistics and session info
- `/help [command]` - Show help information for all or specific commands
- `/exit`, `/quit` - Exit application gracefully
- `/clear` - Clear chat history and context
- `/config [action]` - Manage configuration (list providers, show current config)

### Testing Infrastructure
- Comprehensive test suite with 203+ automated tests using Vitest
- Mock providers with realistic behavior simulation
- Unit tests for individual components (`tests/unit/`)
- Integration tests for multi-provider scenarios (`tests/integration/`)
- Coverage reporting with c8 (80% threshold)
- Test utilities and custom assertions

### Current Implementation Status
- **Fully Working**: Ollama, OpenAI, Gemini providers; configuration system; React UI; unified CommandRegistry system
- **Partially Implemented**: MCP server connections; some advanced config management features
- **Infrastructure Ready**: Error handling, security, token tracking, comprehensive testing

### Security Model
- Workspace-restricted file operations through `WorkspaceSecurity` class
- Configurable file extension allowlists
- Path sanitization and validation
- Maximum file size limits
- API key validation per provider