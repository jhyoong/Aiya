# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aiya is a terminal-based AI development assistant (version 1.2.0) built with TypeScript and React/Ink. It provides secure file operations, interactive chat sessions, and integrates with multiple LLM providers including Ollama, OpenAI, Google Gemini. AWS Bedrock, Anthropic Claude and Azure OpenAI are also supported but not yet tested. The tool uses Model Context Protocol (MCP) for file operations and features a modern terminal UI with streaming responses and comprehensive token tracking.

## Development Commands

### Build and Development
- `npm run build` - Compile TypeScript to dist/
- `npm run dev` - Watch mode compilation
- `npm run typecheck` - Type checking without output
- `npm run start` - Run the compiled CLI

### Testing
- `npm run test` - Shows integration test info (manual testing framework)
- Manual testing scenarios in `tests/integration/basic-workflow.md`

### Linting
- `npm run lint` - Currently not configured

## Architecture

### Input System Architecture

The terminal input system has a custom input handling method:

**Core Components**:
- **`useKeypress` Hook** (`src/ui/hooks/useKeypress.ts`): Custom hook providing raw stdin access via Node's `readline` module
- **`TextBuffer`** (`src/ui/core/TextBuffer.ts`): Sophisticated text editing engine with Unicode support, visual line wrapping, and comprehensive editing operations
- **`UnifiedInput`** (`src/ui/components/UnifiedInput.tsx`): Terminal UI component that bridges `useKeypress` and `TextBuffer`

**Key Features**:
- **Raw Mode Input**: Direct stdin access eliminates Ink's input limitations
- **Bracketed Paste Support**: Proper paste detection and handling
- **Unicode-Aware**: Code point-based text manipulation for proper Unicode support
- **Visual Line Wrapping**: Handles long lines with proper cursor positioning
- **Comprehensive Key Support**: All navigation, editing, and special keys work correctly
- **Undo/Redo**: Full editing history with 100-operation limit

**Input Flow**:
```
Raw Stdin → useKeypress Hook → UnifiedInput → TextBuffer → Visual Update
```

**Previous Issues Resolved**:
- ✅ Eliminated raw mode dependency issues
- ✅ Fixed backspace behavior (now removes characters to the left)
- ✅ Fixed home/end key navigation
- ✅ Fixed slash command input handling
- ✅ Eliminated immediate exit on startup

### Core Components

**CLI Layer** (`src/cli/`)
- `index.ts` - Main CLI entry point using Commander.js
- `commands/` - Command implementations (init, chat, search)
- `suggestions.ts` - Slash command suggestion engine

**UI Layer** (`src/ui/`)
- `AiyaApp.tsx` - Main React/Ink application component
- `components/` - Terminal UI components (ChatInterface, StatusBar, etc.)
- `hooks/` - React hooks for enhanced input handling

**Core System** (`src/core/`)
- `providers/` - Multi-provider abstraction (base.ts, factory.ts, ollama.ts, openai.ts, anthropic.ts, azure.ts, gemini.ts, bedrock.ts)
- `mcp/` - Model Context Protocol implementation for file operations
- `config/` - Configuration management with YAML support and multi-provider schema
- `operations/` - File operations (atomic, pattern-matching, queue)
- `security/` - Workspace security and file access control
- `tools/` - MCP tool execution system
- `tokens/` - Token counting and usage logging system

### Key Patterns

1. **Multi-Provider Architecture**: Factory pattern supporting OpenAI, Gemini, and Ollama.
2. **Provider Factory**: Runtime provider instantiation with automatic capability detection
3. **MCP Integration**: File operations through Model Context Protocol
4. **Security-First**: Workspace-restricted file access with allow-lists
5. **Configuration Hierarchy**: Project (.aiya.yaml) -> Global (~/.aiya/config.yaml) -> Environment variables
6. **Reactive UI**: React/Ink components with streaming response support

## Configuration

### Project Configuration
- Create `.aiya.yaml` in project root via `aiya init`
- Supports both flat and nested YAML formats
- Environment variable overrides (AIYA_MODEL, AIYA_BASE_URL, etc.)

### Default Settings
- Provider: Ollama (http://localhost:11434)
- Model: qwen3:8b
- Security: Workspace-restricted with file extension allow-list
- UI: Streaming enabled, token display on

### Multi-Provider Support
- **Fully Supported**:
  - **OpenAI**: GPT-4, GPT-4 Turbo, GPT-3.5-turbo with vision and function calling
  - **Ollama**: Local models with full backward compatibility
  - **Google Gemini**: Gemini 1.5 Pro/Flash with vision and large context windows
- **Added support but not tested and not in priority**:
  - **Anthropic**: Claude 3.5 Sonnet/Haiku with thinking tags and 200K context
  - **Azure OpenAI**: Enterprise deployments with custom deployment names
  - **AWS Bedrock**: Claude, Titan, Cohere models with AWS authentication


## MCP Tool System

Built-in tools for file operations:
- Basic I/O: `read_file`, `write_file`, `list_directory`
- Search: `search_files` with glob patterns
- Advanced: `preview_diff`, `atomic_write`, `pattern_replace`
- Batch: `queue_operation`, `execute_queue`

## Security Model

- All file operations restricted to workspace directory
- Configurable file extension allow-lists
- Path sanitization prevents directory traversal
- Automatic backup creation for modifications

## Token Counting System

### Architecture
- **TokenCounter** (`src/core/tokens/counter.ts`): Core token counting logic with provider-specific extraction
- **TokenLogger** (`src/core/tokens/logger.ts`): Persistent logging system with session management

### Features
- **Accurate Token Tracking**: Provider-specific token extraction for maximum precision
- **Session Management**: Unique session IDs for each chat session
- **Persistent Logging**: All token usage logged to `~/.aiya/logs/tokens.log`
- **Real-time Display**: Status bar shows current and total token usage
- **Provider Support**:
  - **OpenAI**: Uses `prompt_tokens` and `completion_tokens` from API responses
  - **Gemini**: Uses `promptTokenCount` and `candidatesTokenCount` from usage metadata  
  - **Ollama**: Estimation via `countTokens()` method (marked as estimated)

### Display Format
```
[Tokens: sent 100 (1200), received 500 (5010)]
```
- First number: tokens for current message
- Number in parentheses: session total

### Log Format
```
[2024-07-09T10:30:15.123Z] [session-uuid] ollama:qwen3:8b sent: 42, received: 156 [estimated]
[2024-07-09T10:30:15.124Z] [session-uuid] SESSION_START ollama:qwen3:8b
[2024-07-09T10:30:45.567Z] [session-uuid] SESSION_END ollama:qwen3:8b
```

## Version 1.2.0 - Multi-Provider Support ✅

**Completed Features**:
- **✅ Provider Abstraction Layer**: Full interfaces for OpenAI, and Google Gemini
- **✅ Capability Detection System**: Auto-detection of model features (vision, function calling, thinking, context windows)
- **✅ Unified Configuration**: Single configuration format supporting all providers with backward compatibility
- **✅ Provider Factory**: Runtime provider instantiation and registration system
- **✅ Enhanced Authentication**: Secure API key handling with environment variable support

**Implemented Providers**:
```typescript
interface ExtendedProviderConfig {
  type: 'ollama' | 'openai' | 'anthropic' | 'azure' | 'gemini' | 'bedrock';
  model: string;
  baseUrl: string;
  apiKey?: string;
  capabilities?: ProviderCapabilities;
  costPerToken?: { input: number; output: number };
  // Provider-specific configurations
  azure?: { deploymentName?: string; apiVersion?: string };
  anthropic?: { maxTokens?: number; version?: string };
  gemini?: { projectId?: string; location?: string };
  bedrock?: { region: string; accessKeyId?: string; secretAccessKey?: string; sessionToken?: string; };
}
```

**Success Criteria Achieved**:
- ✅ Support for 3 major AI providers (Ollama, OpenAI, Gemini)
- ✅ Seamless provider switching via environment variables or configuration
- ✅ Provider-specific optimizations (thinking mode, function calling, vision support)
- ✅ Automatic capability detection and cost tracking
- ✅ AWS Bedrock integration with IAM authentication support
- ✅ Comprehensive token counting and usage logging system

**✅ Completed in this update**:
- ✅ **Enhanced Token Counting System**: Fully integrated TokenCounter class with session-based tracking
- ✅ **Token Usage Logging**: Persistent logging to `~/.aiya/logs/tokens.log` with session IDs and timestamps
- ✅ **Provider-Specific Token Extraction**: Accurate token counting for OpenAI and Gemini, estimation for Ollama
- ✅ **Updated Token Display**: New format showing `[Tokens: sent X (total), received Y (total)]`
- ✅ **Status Bar Integration**: Real-time token usage display in terminal UI

**TODO next in this patch**:
- Switching of models via slash commands.
- - init function to also be updated, with step by step guide on setting up base provider.
- - config slash command to be added to allow users to add supported model providers.
- - Testing of all 3 model providers.
- ✅ ~~slash commands a little buggy when backspacing, to investigate~~ - FIXED: Implemented proper useKeypress hook for raw stdin access
- `exit` and `quit` and `/exit` and `/quit` to gracefully exit the app.
- Multi-line pastes to be handled properly and not trigger the chat input until the user presses enter.
- `aiya init` to default to a guided setup. init command should guide the user with a simple flow.
- - Asks for main provider between Ollama, OpenAI, or Gemini -> Asks for API key (optional for Ollama and OpenAI) -> Asks for custom endpoint only for Ollama and OpenAI, optional as well -> If Ollama or custom OpenAI, ask for context window size from 4k to 64k. Once done, ask again if any more providers to add.
- `aiya chat` to prompt user to init if no config file found.

## Version Planning

**Future Enhancements**:
- Automatic fallback when primary provider fails

## Development Notes

- TypeScript with strict configuration
- ES2022 target with ESNext modules
- React/Ink for terminal UI
- Commander.js for CLI structure
- YAML configuration with environment overrides
- No formal linting configured yet

Do not use emojis.

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
ALWAYS check with the user before creating documentation files (*.md) or README files. Only edit documentation files if explicitly requested by the User.
NEVER place time estimates in plans.