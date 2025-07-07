# Aiya

Artificial Intelligence: Your Assistant (AIYA). A modern? terminal tool for AI-assisted development with reactive interface and context management.

**Version 1.1.1** - Enhanced terminal UI with modern terminal behaviors and improved user experience.

[![npm version](https://badge.fury.io/js/aiya-cli.svg)](https://badge.fury.io/js/aiya-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Modern? Terminal UI**: Built with React/Ink for clean, responsive terminal interface
- **Reactive Interface**: Slash command suggestions with smart tab completion and autocomplete
- **Interactive Chat Sessions**: AI conversations with streaming responses and thinking display
- **Context Management**: Add files to conversation context with visual feedback
- **Secure File Operations**: Workspace-restricted file access with configurable security
- **Fuzzy File Search**: Quick file discovery within your workspace
- **Project-aware Configuration**: YAML-based configuration with environment variable support

## Prerequisites

- Node.js 18 or higher
- Ollama running locally with a tool-compatible model (e.g., qwen2.5:8b, qwen3:8b)

[!NOTE] Support for other endpoints is still a work in progress. Currently only supports Ollama.

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

1. Initialize Aiya in your project:
```bash
aiya init --model qwen3:8b
```

2. Start an interactive chat session:
```bash
aiya chat
```

3. Search for files:
```bash
aiya search chat
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
```
*Note: This depends on your context window size*

### `aiya search <query>`
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

Example `.aiya.yaml`:
```yaml
provider: ollama
model: qwen3:8b
endpoint: http://localhost:11434
workspace: ./
max_tokens: 32768
```

For advanced configuration, you can also use the nested format:
```yaml
provider:
  type: ollama
  baseUrl: http://192.1xx.xxx.xxx:11434
  model: qwen3:8b

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
- Configurable file extension allow-lists prevent access to sensitive files
- Path sanitization prevents directory traversal attacks
- Automatic backup creation for file modifications

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
```

## Architecture

Aiya is built with a modular architecture designed for extensibility:

- **Terminal UI**: React/Ink-based modern terminal interface with streaming support
- **Providers**: Abstraction layer for different LLM services (currently Ollama, extensible to OpenAI/Anthropic)
- **MCP Integration**: Model Context Protocol for secure file operations
- **Context Management**: Session-based file context with automatic cleanup
- **Basic Security Layer**: Workspace-restricted file access and validation
- **CLI Interface**: Commander.js-based command structure with global options

## Changelog

- **Version 1.1.1** - Enhanced terminal UI with modern terminal behaviors and improved user experience.
- **Version 1.0.0** - Basic terminal tool with Ollama support and filesystem MCP tooling.

## License

MIT
