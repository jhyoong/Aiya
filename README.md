# Aiya

Artificial Intelligence: Your Assistant (AIYA). A modern(?) terminal tool for AI-assisted development with multi-provider support.

**Version 1.2.0** - Multi-provider support and init function flow added.

[![npm version](https://badge.fury.io/js/aiya-cli.svg)](https://badge.fury.io/js/aiya-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Multi-Provider Support**: Ideally, seamless integration with Ollama, OpenAI, and Google Gemini
- **Reactive Interface**: Slash command suggestions with smart tab completion and autocomplete
- **Interactive Chat Sessions**: AI conversations with streaming responses and thinking display
- **Context Management**: Add files to conversation context with visual feedback
- **Secure File Operations**: Workspace-restricted file access with configurable security
- **Simple Model Configuration**: YAML-based configuration with environment variable support

## Prerequisites

- Node.js 20 or higher
- At least one AI provider:
  - **Ollama**: Local models (qwen2.5-coder:7b, qwen3:8b, etc.)
  - **OpenAI**: API key for GPT-4, GPT-4 Turbo, etc.
  - **Google Gemini**: API key for Gemini 1.5 Pro/Flash models

**Multi-Provider Support**: Aiya now supports multiple AI providers with seamless switching between them during conversations.

## Installation

```bash
npm install -g aiya-cli
```

Or run from source:

```bash
git clone https://github.com/jhyoong/Aiya.git
cd Aiya
npm install
npm run build
```

## Quick Start

1. Initialize Aiya in your project (interactive setup):
```bash
aiya init
```

2. Start an interactive chat session:
```bash
aiya chat
```

3. Search for files (will probably remove this):
```bash
aiya search something
aiya search config
```

## Global Options

These options are available on all commands:
- `--verbose, -v` - Enable verbose logging for debugging
- `--config <path>` - Specify custom config file path

## Commands

### `aiya init [options]`
Initialize Aiya configuration for the current project.

Options:
- `-m, --model <model>` - Specify the Ollama model to use (default: qwen3:8b)
- `--base-url <url>` - Ollama server endpoint (default: http://localhost:11434)
- `--check-connection` - Verify connection to Ollama server

### `aiya chat`
Start an interactive chat session with the AI featuring a modern terminal interface built with React/Ink.

#### Terminal Interface Features

#### Chat Commands
- **Command Suggestions**: Type `/` to see available commands with grey text hints. Press Tab to quickly select commands.
- `/read <file>` - Read and display file content in the terminal
- `/add <file>` - Add file content to context for the next prompt (silent)
- `/search <pattern>` - Search for files matching the pattern
- `/tokens` - Show token usage statistics for the current session
- `/thinking` - Toggle thinking mode display (on/off/auto)
- `/model-switch` - Switch between configured AI providers mid-conversation
- `help` - Show available commands and usage
- `clear` - Clear conversation history and added file context
- `exit` or `quit` - End the chat session

#### Usage Examples
```bash
# Type '/' to see suggestions
💬 You: /
# Shows: /read <file_path> in grey text

# Type '/r' and press Tab to complete
💬 You: /r<Tab>
# Completes to: /read

# Add files to context silently
💬 You: /add src/utils.ts
Added src/utils.ts to context for the next prompt

💬 You: /add package.json
Added package.json to context for the next prompt

💬 You: Can you help optimize this utility function?
# AI receives both files plus your question

# Switch providers mid-conversation
💬 You: /model-switch
Available providers: ollama-qwen3, openai-gpt4o, gemini-flash
💬 You: /model-switch openai-gpt4o
Switched to OpenAI GPT-4o-mini
```
> [!NOTE]
> Performance depends on your config settings and for local models, context window size

### `aiya search <query>`
> [!NOTE]
> Will probably remove this next - to be integrated into slash command instead.
Fuzzy search for files in the workspace.

The search uses simple fuzzy matching - it finds files where the query characters appear in order within the filename. Exact matches are ranked higher than partial matches.

## Configuration

Aiya uses YAML configuration files with the following hierarchy:
1. Project-level: `.aiya.yaml` in current directory
2. Global: `~/.aiya/config.yaml`
3. Environment variables

### Environment Variables

You can override configuration using environment variables:
- `AIYA_MODEL` - Override model selection
- `AIYA_BASE_URL` - Override server endpoint
- `AIYA_STREAMING` - Enable/disable streaming (true/false)
- `AIYA_VERBOSE` - Enable verbose logging (true/false)
- `AIYA_CONFIG_PATH` - Custom config file path

Example `.aiya.yaml` (single provider):
```yaml
provider: ollama
model: qwen3:8b
endpoint: http://localhost:11434
workspace: ./
max_tokens: 32768
```

Multi-provider configuration example:
```yaml
providers:
  ollama-qwen3:
    type: ollama
    model: qwen3:8b
    baseUrl: http://localhost:11434
  openai-gpt4o:
    type: openai
    model: gpt-4o-mini
    apiKey: your-openai-api-key
  gemini-flash:
    type: gemini
    model: gemini-1.5-flash
    apiKey: your-gemini-api-key

defaultProvider: ollama-qwen3

security:
  allowedExtensions:
    - .ts
    - .js
    - .py
    - .md
  restrictToWorkspace: true
  maxFileSize: 1048576

ui:
  streaming: true
  showTokens: true
  thinking: 'auto'
```

## MCP Tool System

Aiya includes a built-in Model Context Protocol (MCP) tool system that enables file operations:

### Available Tools

#### Basic File Operations
- **File I/O**: `read_file`, `write_file` - Read and write files within the workspace
- **Directory Listing**: `list_directory` - Browse directory contents
- **File Search**: `search_files` - Search for files using glob patterns

#### Advanced File Manipulation
- **Preview Changes**: `preview_diff` - Preview file changes before applying them
- **Atomic Operations**: `atomic_write`, `atomic_edit` - Safe file operations with automatic backup
- **Pattern Replacement**: `pattern_replace` - Regex-based content replacement with advanced options
- **File Recovery**: `rollback_file` - Rollback files to previous backup versions

#### Queue Management
- **Batch Operations**: `queue_operation` - Queue multiple file operations for batch processing
- **Queue Execution**: `execute_queue` - Execute all queued operations with optional preview

### Tool Usage
The AI model can automatically call these tools when needed during chat sessions. Tools are invoked using JSON function calls and provide secure, workspace-restricted file access. Advanced tools support features like atomic operations, regex patterns, and batch processing for complex file manipulation tasks.

## Basic Security

- All file operations are restricted to the current workspace directory
- Automatic backup creation for file modifications (needs refining)

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run type checking
npm run typecheck

# Run in development mode
npm run dev

# Run tests
npm run test              # All tests (watch mode)
npm run test:run          # All tests (single run)
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:coverage     # Tests with coverage report

# Code quality and formatting
npm run lint              # Run ESLint on source code
npm run lint:fix          # Auto-fix ESLint issues
npm run format            # Format code with Prettier
npm run format:check      # Check code formatting
```

## Changelog

- **Version 1.2.0** - Multi-provider support (Ollama, OpenAI, Gemini), runtime provider switching, unified CommandRegistry system, development quality setup (ESLint/Prettier), vitest setup, and improved setup wizard.
- **Version 1.1.1** - Enhanced terminal UI with modern terminal behaviors and improved user experience.
- **Version 1.0.0** - Basic terminal tool with Ollama support and filesystem MCP tooling.

## License

MIT
