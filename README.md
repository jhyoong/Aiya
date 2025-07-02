# Aiya

AI-powered development assistant with secure file operations and local LLM integration.

## Features

- Interactive chat sessions with AI models via Ollama
- Secure file operations restricted to workspace boundaries
- File and content search with glob pattern support
- Project-aware configuration management
- Streaming responses for real-time interaction

## Prerequisites

- Node.js 18 or higher
- Ollama running locally with a compatible model (e.g., qwen2.5:8b)

## Installation

```bash
npm install -g aiya
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
aiya init --model qwen2.5:8b
```

2. Start an interactive chat session:
```bash
aiya chat
```

3. Search for files or content:
```bash
aiya search "*.ts"
aiya search --content "import" "src/**"
```

## Commands

### `aiya init [options]`
Initialize Aiya configuration for the current project.

Options:
- `-m, --model <model>` - Specify the Ollama model to use (default: qwen2.5:8b)
- `--base-url <url>` - Ollama server endpoint (default: http://localhost:11434)
- `--check-connection` - Verify connection to Ollama server

### `aiya chat [options]`
Start an interactive chat session with the AI.

Options:
- `-f, --file <path>` - Include file content in context
- `-c, --context <pattern>` - Include files matching pattern in context
- `--no-stream` - Disable streaming responses

Chat commands:
- `/read <file>` - Read and display file content
- `/search <pattern>` - Search for files
- `/tokens` - Show token usage statistics
- `help` - Show available commands
- `exit` - End the session

### `aiya search <pattern> [options]`
Search for files and content in the workspace.

Options:
- `-c, --content <text>` - Search for files containing specific text
- `-t, --type <type>` - Search type: "file" or "content"
- `--max-results <num>` - Maximum number of results (default: 50)

## Configuration

Aiya uses YAML configuration files with the following hierarchy:
1. Project-level: `.aiya.yaml` in current directory
2. Global: `~/.aiya/config.yaml`
3. Environment variables

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
  baseUrl: http://localhost:11434
  model: qwen2.5:8b

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

## Security

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
- **Security Layer**: Workspace-restricted file access and validation
- **CLI Interface**: Commander.js-based command structure with interactive features

## License

MIT