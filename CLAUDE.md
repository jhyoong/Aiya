# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aiya is a terminal-based AI development assistant (version 1.2.0) built with TypeScript and React/Ink. It provides secure file operations, interactive chat sessions, and integrates with multiple LLM providers including OpenAI, Anthropic Claude, Azure OpenAI, Google Gemini, AWS Bedrock, and Ollama. The tool uses Model Context Protocol (MCP) for file operations and features a modern terminal UI with streaming responses.

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

### Key Patterns

1. **Multi-Provider Architecture**: Factory pattern supporting OpenAI, Anthropic, Azure, Gemini, and Ollama
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
- Model: qwen2.5:8b
- Security: Workspace-restricted with file extension allow-list
- UI: Streaming enabled, token display on

### Multi-Provider Support
- **OpenAI**: GPT-4, GPT-4 Turbo, GPT-3.5-turbo with vision and function calling
- **Anthropic**: Claude 3.5 Sonnet/Haiku with thinking tags and 200K context
- **Azure OpenAI**: Enterprise deployments with custom deployment names
- **Google Gemini**: Gemini 1.5 Pro/Flash with vision and large context windows
- **AWS Bedrock**: Claude, Titan, Cohere models with AWS authentication
- **Ollama**: Local models with full backward compatibility

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

## Version 1.2.0 - Multi-Provider Support ✅

**Completed Features**:
- **✅ Provider Abstraction Layer**: Full interfaces for OpenAI, Anthropic, Azure OpenAI, and Google Gemini
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
- ✅ Support for 6 major AI providers (Ollama, OpenAI, Anthropic, Azure, Gemini, AWS Bedrock)
- ✅ Seamless provider switching via environment variables or configuration
- ✅ Provider-specific optimizations (thinking mode, function calling, vision support)
- ✅ Automatic capability detection and cost tracking
- ✅ AWS Bedrock integration with IAM authentication support

**TODO next in this patch**:
- Double check token count usage implementation, TokenCounter class doesn't seem to be used?
- Switching of models via slash commands.
- - init function to also be updated, with step by step guide on setting up base provider.
- - config slash command to be added to allow users to add supported model providers.
- - Testing of all model providers.
- slash commands a little buggy when backspacing, to investigate.

## Version Planning

**Future Enhancements**:
- Smart provider selection based on task complexity
- Automatic fallback when primary provider fails
- Multi-model conversations and provider comparison mode

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