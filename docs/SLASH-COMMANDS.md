# Slash Commands Documentation

## Overview

Slash commands in Aiya provide quick access to file operations, configuration management, and utility functions during chat sessions. Commands are executed by typing `/` followed by the command name and arguments.

## How Slash Commands Work

### Basic Usage
- **Format**: `/command [arguments]`
- **Execution**: Press Enter to execute
- **Suggestions**: Type `/` to see available commands
- **Completion**: Press Tab to complete partial commands

### Command Processing Flow
1. User types command starting with `/`
2. Command is parsed and validated
3. Parameters are checked against requirements
4. Command handler executes with chat context
5. Results are displayed in chat interface

## Available Commands

### File Operations

#### `/read <file_path>`
Read and display file content in the terminal.

**Usage**:
```
/read package.json
/read src/components/Button.tsx
/read docs/api.md
```

**Features**:
- Displays file content with syntax highlighting
- Shows file metadata (size, language, last modified)
- Supports various file encodings
- Restricted to workspace directory

#### `/add <file_path>`
Add file content to conversation context for the next prompt.

**Usage**:
```
/add src/utils.ts
/add package.json
/add docs/README.md
```

**Features**:
- Silently adds file to context
- Multiple files can be added
- Files remain in context until cleared
- Content is included in next AI prompt

#### `/search <pattern> [--flags]`
Search for files by name or content with advanced options.

**Basic Usage (Filename Search)**:
```
/search component
/search utils.ts
/search "Button"
```

**Advanced Usage (Content Search)**:
```
/search "import React" --searchType literal --maxResults 10
/search error --includeGlobs "*.ts" "*.js" --excludeGlobs "*.test.*"
/search "class.*Component" --searchType regex --contextLines 3
```

**Search Types**:
- `literal`: Exact text matching (default for content)
- `regex`: Regular expression patterns
- `fuzzy`: Approximate matching with confidence scores
- `filename`: Search by filename (default mode)

**Flags**:
- `--searchType`: Type of search (literal, regex, fuzzy, filename)
- `--maxResults`: Maximum number of results (default: 100)
- `--contextLines`: Context lines around matches (default: 3)
- `--includeGlobs`: File patterns to include (e.g., "*.ts" "*.js")
- `--excludeGlobs`: File patterns to exclude (e.g., "*.test.*")

### Configuration Management

#### `/model-switch [provider]`
Switch between configured AI providers or models.

**Usage**:
```
/model-switch                    # Show available providers
/model-switch ollama-qwen3       # Switch to specific provider
/model-switch openai-gpt4o       # Switch to OpenAI GPT-4o
```

**Features**:
- Lists available providers when no argument provided
- Switches active provider for current session
- Updates token counter for new provider
- Validates provider configuration

#### `/config [action]`
Manage Aiya configuration settings.

**Usage**:
```
/config                          # Show current configuration
/config list                     # List all configuration options
```

**Features**:
- Display current configuration
- Show available configuration options
- Validates configuration settings

### Utility Commands

#### `/tokens`
Display token usage statistics for current session.

**Usage**:
```
/tokens
```

**Information Shown**:
- Total tokens used in session
- Tokens per message
- Current provider token limits
- Cost estimation (if available)

#### `/thinking [mode]`
Control AI thinking display mode.

**Usage**:
```
/thinking                        # Show current mode
/thinking on                     # Show full thinking process
/thinking brief                  # Show brief thinking summary
/thinking off                    # Hide thinking output
```

**Modes**:
- `on`: Display full thinking process
- `brief`: Show condensed thinking summary
- `off`: Hide thinking output entirely

#### `/help [command]`
Show help information for commands.

**Usage**:
```
/help                           # Show all commands
/help read                      # Help for specific command
/help model-switch              # Detailed command help
```

**Aliases**: `h`, `?`

**Features**:
- Lists all available commands
- Shows detailed usage for specific commands
- Includes examples and parameter descriptions

#### `/clear`
Clear chat history and added file context.

**Usage**:
```
/clear
```

**Aliases**: `cls`

**Features**:
- Removes all chat messages
- Clears added file context
- Resets token counter
- Provides fresh start for conversation

#### `/exit`
Exit the application gracefully.

**Usage**:
```
/exit
```

**Aliases**: `quit`, `q`

**Features**:
- Graceful application shutdown
- Saves session state
- Cleans up resources

## Command Features

### Suggestions and Autocomplete
- **Real-time suggestions**: Command suggestions appear as you type
- **Tab completion**: Press Tab to complete partial commands
- **Fuzzy matching**: Supports approximate command matching
- **Usage hints**: Shows command syntax in suggestions

### Parameter Validation
- **Required parameters**: Commands validate required arguments
- **Type checking**: Parameters are validated by type
- **Configuration requirements**: Some commands require project setup
- **Error messages**: Clear error messages with suggestions

### Security Features
- **Workspace restrictions**: File operations limited to workspace
- **Path validation**: Prevents path traversal attacks
- **Input sanitization**: User input is sanitized and validated
- **Permission checks**: File access permissions are validated

## Command Integration

### Chat Context
Commands have access to:
- Current chat session
- Message history
- Token counter
- Added files context
- Configuration settings

### MCP Tool Integration
File operations and command execution use MCP (Model Context Protocol) tools:
- **ReadFile**: Secure file reading with metadata
- **SearchFiles**: Advanced search with multiple algorithms
- **ListDirectory**: Directory listing with filtering
- **RunCommand**: Shell command execution with approval workflow
- **Security validation**: All operations through security layer
- **Command approval**: Dangerous shell commands require user approval

### Provider Integration
Commands work with all configured providers:
- **Multi-provider support**: Commands work across different AI providers
- **Provider switching**: Runtime provider switching capability
- **Token counting**: Provider-specific token counting
- **Configuration validation**: Provider-specific validation

## Error Handling

### Common Errors
- **File not found**: File does not exist or is not accessible
- **Permission denied**: Insufficient permissions for file operation
- **Invalid syntax**: Command syntax is incorrect
- **Missing configuration**: Command requires project configuration
- **Provider unavailable**: Selected provider is not available

### Error Recovery
- **Helpful suggestions**: Error messages include suggestions
- **Validation feedback**: Real-time validation feedback
- **Graceful degradation**: Partial failures don't break session
- **User guidance**: Clear instructions for fixing errors

## Tips for Effective Use

### File Operations
- Use `/add` to include relevant files before asking questions
- Use `/search` to find files quickly
- Use `/read` to examine specific files
- Combine multiple `/add` commands for complex questions

### Search Optimization
- Use filename search for finding files by name
- Use content search with `--searchType literal` for exact matches
- Use regex search for pattern matching
- Use fuzzy search for approximate matching

### Session Management
- Use `/tokens` to monitor usage
- Use `/clear` to start fresh when needed
- Use `/thinking` to control AI output verbosity
- Use `/model-switch` to try different providers

### Configuration
- Run `aiya init` before using configuration commands
- Use `/config` to verify settings
- Use `/model-switch` to test different providers
- Check `/help` for command-specific guidance

## Command Categories

### Core Commands
Essential functionality for file operations and search:
- `/read`, `/add`, `/search`

### Configuration Commands
Provider and settings management:
- `/model-switch`, `/config`

### Utility Commands
Session management and information:
- `/tokens`, `/thinking`, `/help`, `/clear`, `/exit`

This command system provides a comprehensive interface for interacting with files, managing configuration, and controlling the AI conversation experience.