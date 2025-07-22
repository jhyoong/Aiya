# Aiya

Artificial Intelligence: Your Assistant (AIYA). A modern(?) terminal tool for AI-assisted development with multi-provider support.

**Version 1.5.1** - Enhanced todo management with verification workflow.

[![npm version](https://badge.fury.io/js/aiya-cli.svg)](https://badge.fury.io/js/aiya-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- Aiya.. this is just a budget version of all the other fancy LLM tools out there. Building this just for myself to test Ollama models.

## Prerequisites

- Node.js 20 or higher
- At least one AI provider:
  - **Ollama**: Local models (qwen2.5-coder:7b, qwen3:8b, etc.)
  - **OpenAI**: API key for GPT-4, GPT-4 Turbo, etc.
  - **Google Gemini**: API key for Gemini 1.5 Pro/Flash models

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

## Global Options

These options are available on all commands:
- `--verbose, -v` - Enable verbose logging for debugging
- `--config <path>` - Specify custom config file path

## Commands

### `aiya init`
Initialize Aiya configuration for the current project through an interactive setup wizard that guides you through provider configuration and connection testing.

### `aiya chat`
Start an interactive chat session with the AI featuring a modern terminal interface built with React/Ink.

#### Terminal Interface Features

#### Chat Commands
- **Command Suggestions**: Type `/` to see available commands with grey text hints. Press Tab to quickly select commands.
- `/read <file>` - Read and display file content in the terminal
- `/add <file>` - Add file content to context for the next prompt (silent)
- `/search <pattern>` - Search for files by name (default) or content with options
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

### Search Examples with `/search`

The `/search` command supports two modes:

**Filename Search (Default):**
```bash
💬 You: /search component     # Finds files with "component" in filename
💬 You: /search utils.ts      # Finds files with "utils.ts" in filename
```

**Content Search (Advanced):**
```bash
💬 You: /search "import React" --searchType literal --maxResults 5
💬 You: /search error --includeGlobs "*.ts" "*.js" --excludeGlobs "*.test.*"
💬 You: /search "class.*Component" --searchType regex --contextLines 3
```
Refer to [slash-commands](/docs/SLASH-COMMANDS.md) for more details.

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

### Example `.aiya.yaml` 
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
Refer to [init process](/docs/INIT-PROCESS.md) for more details.

## MCP Tool System

Aiya includes a built-in Model Context Protocol (MCP) tool system that enables file operations:

### Available Tools

#### Core File Operations
- **ReadFile**: Read file contents with encoding options and line range selection
- **WriteFile**: Write content to file with safety features and mode options (overwrite/create-only/append)
- **EditFile**: Apply targeted edits using replace/insert/delete operations with fuzzy matching
- **SearchFiles**: Search files with literal and regex patterns, including context lines

#### Shell Operations
- **RunCommand**: Execute bash commands with timeout protection and secure output capture

#### Todo Management
- **CreateTodo**: Create new todo tasks with titles and descriptions
- **ListTodos**: List todos with filtering by completion status and pagination
- **GetTodo**: Retrieve specific todo by ID
- **UpdateTodo**: Update todo titles and completion status
- **DeleteTodo**: Remove todos by ID

### Tool Usage
The AI model can automatically call these tools when needed during chat sessions. Tools are invoked using JSON function calls and provide secure, workspace-restricted file access. Advanced tools support features like atomic operations, regex patterns, batch processing for complex file manipulation tasks, shell command execution for development workflows, and persistent todo management for task tracking.

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

- **Version 1.5.1** - Enhanced todo management with verification workflow.
- **Version 1.5.0** - Todo management integration with MCP tools.
- **Version 1.4.2** - Refactoring and documentation update.
- **Version 1.4.1** - Added user confirmation check before executing tools.
- **Version 1.4.0** - Added shell command execution capabilities to the MCP tools.
- **Version 1.3.0** - Reworked MCP tools system with improved file operations and better error handling. Also added more documentation.
- **Version 1.2.0** - Multi-provider support (Ollama, OpenAI, Gemini), runtime provider switching, unified CommandRegistry system, development quality setup (ESLint/Prettier), vitest setup, and improved setup wizard.
- **Version 1.1.1** - Enhanced terminal UI with modern terminal behaviors and improved user experience.
- **Version 1.0.0** - Basic terminal tool with Ollama support and filesystem MCP tooling.

## License

MIT
