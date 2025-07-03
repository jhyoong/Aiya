# Aiya

Artificial Intelligence: Your Assistant (AIYA). A simple terminal tool for code editing which connects to local models.

## Features

- Interactive chat sessions with AI models via Ollama
- Secure file operations restricted to workspace boundaries
- Fuzzy search for files in the workspace
- Project-aware configuration management
- Streaming responses for real-time interaction

## Prerequisites

- Node.js 18 or higher
- Ollama running locally with a tool-compatible model (e.g., qwen3:8b)

## Installation

```bash
npm install -g aiya-cli
```

Or run from source:

```bash
git clone <repository>
cd aiya
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
Start an interactive chat session with the AI.


Chat commands:
- `/read <file>` - Read and display file content
- `/search <pattern>` - Search for files
- `/tokens` - Show token usage statistics
- `help` - Show available commands
- `clear` - Clear conversation history
- `exit` or `quit` - End the session

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
model: codellama:7b
endpoint: http://localhost:11434
workspace: ./
max_tokens: 4096
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
```

## MCP Tool System

Aiya includes a built-in Model Context Protocol (MCP) tool system that enables file operations:

### Available Tools
- **File Operations**: Read, write, and edit files within the workspace
- **Directory Listing**: Browse directory contents
- **File Search**: Fuzzy search for files in the workspace

### Tool Usage
The AI model can automatically call these tools when needed during chat sessions. Tools are invoked using JSON function calls and provide secure, workspace-restricted file access.

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

Aiya is built with a modular architecture:

- **Providers**: Abstraction layer for different LLM services (currently Ollama)
- **MCP Integration**: Model Context Protocol for secure file operations
- **Basic Security Layer**: Workspace-restricted file access and validation
- **CLI Interface**: Commander.js-based command structure with interactive features

## License

MIT