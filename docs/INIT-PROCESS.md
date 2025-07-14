# Aiya Initialization Process Documentation

## Overview

The `aiya init` command provides an interactive setup wizard that guides users through configuring Aiya for their project. It creates a `.aiya.yaml` configuration file with either single-provider or multi-provider setup based on user choices.

## Command Usage

```bash
aiya init [options]
```

### Available Options

- `--skip-validation`: Skip connection testing during setup
- `--non-interactive`: Run in non-interactive mode (not yet implemented)

## Setup Stages

The initialization process follows a state machine with the following stages:

### 1. Welcome (Stage 1/5)
- **Purpose**: Introduce the setup wizard and explain the process
- **User Action**: Press Enter to continue
- **Next Stage**: Provider Selection

### 2. Provider Selection (Stage 2/5)
- **Purpose**: Choose the primary AI provider
- **Available Options**:
  - Ollama (Local LLM server)
  - OpenAI (GPT models)
  - Anthropic (Claude models)
  - Azure OpenAI
  - Google Gemini
  - AWS Bedrock
- **User Action**: Select provider using arrow keys and Enter
- **Next Stage**: Provider Configuration

### 3. Provider Configuration (Stage 3/5)
- **Purpose**: Configure provider-specific settings
- **Dynamic Form Fields**: Based on selected provider type
- **Common Fields**:
  - Model name/selection
  - API key (if required)
  - Base URL (for custom endpoints)
- **Validation**: Real-time validation of required fields
- **User Actions**: 
  - Fill in configuration values
  - Navigate with Tab/Shift+Tab
  - Submit with Enter or go back with Escape
- **Next Stage**: Connection Test

### 4. Connection Test (Stage 4/5)
- **Purpose**: Verify the provider configuration works
- **Process**:
  - Attempts to connect to the provider
  - Sends a test message to validate functionality
  - Displays success/failure status
- **User Options**:
  - Wait for automatic success detection
  - Skip test with 's' key (sets `skipValidation: true`)
- **Next Stage**: Multi-Provider Prompt

### 5. Multi-Provider Prompt (Stage 5/5)
- **Purpose**: Decide whether to add additional providers
- **User Options**:
  - `[y]` Add another provider → Additional Provider Selection
  - `[n]` Finish setup with current configuration → Summary
  - `[s]` Save current configuration and exit → Save and Exit

## Additional Provider Flow

If user chooses to add more providers, the process includes additional stages:

### Additional Provider Selection
- **Purpose**: Choose additional AI providers
- **Options**: Same provider list as primary selection
- **Special Option**: Save and Exit button to stop adding providers
- **Next Stage**: Additional Provider Configuration

### Additional Provider Configuration
- **Purpose**: Configure the additional provider
- **Process**: Same as primary provider configuration
- **Duplicate Handling**: Replaces existing configurations with same type/model/URL
- **Next Stage**: Additional Connection Test

### Additional Connection Test
- **Purpose**: Test the additional provider
- **Process**: Same as primary connection test
- **Next Stage**: Returns to Multi-Provider Prompt

## Decision Logic

### Provider Name Generation (Multi-Provider)
The system generates unique provider names using this logic:

1. **Base Name**: Combines provider type and clean model name
   - Remove special characters from model name
   - Limit to 20 characters for readability
   - Format: `{provider-type}-{clean-model-name}`

2. **Conflict Resolution**: If name exists, append incremental number
   - Example: `ollama-qwen3`, `ollama-qwen3-1`, `ollama-qwen3-2`

3. **Fallback**: If no model name available, use provider type only

### Configuration Structure Decision
The system chooses between two configuration formats:

- **Single Provider**: When no additional providers are configured
  - Uses backward-compatible structure with `provider` field
  - Simpler for basic setups

- **Multi-Provider**: When additional providers are configured
  - Uses `providers` object with named configurations
  - Includes `current_provider` field pointing to primary provider

## Configuration Examples

### Single Provider Configuration

```yaml
# Aiya Configuration File
# Generated on: 2024-01-15
# Documentation: https://github.com/jhyoong/Aiya#configuration

# Single Provider Setup
# - To add more providers, run 'aiya init' again
# - Or manually add providers to create a multi-provider setup

provider:  # Single provider configuration
  type: ollama  # Provider type
  model: qwen3:8b  # AI model name
  baseUrl: http://localhost:11434  # API endpoint URL
  capabilities:
    maxTokens: 4096
    supportsFunctionCalling: true
    supportsVision: false
    supportsStreaming: true
    supportsThinking: false

security:  # File access and security settings
  allowedExtensions:  # File types allowed for MCP operations
    - .ts
    - .js
    - .tsx
    - .jsx
    - .py
    - .rs
    - .go
    - .java
    - .c
    - .cpp
    - .h
    - .hpp
    - .md
    - .txt
    - .json
    - .yaml
    - .yml
    - .html
    - .css
    - .scss
    - .sass
    - .sql
    - .sh
    - .bash
  restrictToWorkspace: true  # Restrict file access to project directory
  maxFileSize: 1048576  # Maximum file size in bytes (1MB)

ui:  # User interface preferences
  streaming: true  # Enable streaming responses
  showTokens: true  # Display token usage in status bar
  theme: auto
  thinking: on  # Thinking mode: on, brief, off

mcp:  # Model Context Protocol settings
  servers: []  # External MCP servers (currently empty)

max_tokens: 4096  # Default maximum tokens for responses

# Usage Instructions:
# 1. Start chatting: aiya chat
# 2. Search files: aiya search <pattern>
# 3. Get help: aiya --help
#
# Environment Variables:
# - AIYA_API_KEY: Override API key
# - AIYA_MODEL: Override model name
# - AIYA_BASE_URL: Override base URL
# - AIYA_STREAMING: Override streaming setting (true/false)
#
# Chat Commands:
# - /read <file>: Read and display file content
# - /add <file>: Add file to context for next prompt
# - /search <pattern>: Search for files
# - /model-switch: Switch between configured providers
# - /thinking [mode]: Change thinking display mode
# - /tokens: Show token usage statistics
#
# For more information, visit: https://github.com/jhyoong/Aiya
```

### Multi-Provider Configuration

```yaml
# Aiya Configuration File
# Generated on: 2024-01-15
# Documentation: https://github.com/jhyoong/Aiya#configuration

# Multi-Provider Setup
# - Use '/model-switch' command to switch between providers during chat
# - Current provider is set by 'current_provider' field
# - Add more providers by extending the 'providers' section

providers:  # Available AI providers
  ollama-qwen3:  # Provider configuration name
    type: ollama  # Provider type
    model: qwen3:8b  # AI model name
    baseUrl: http://localhost:11434  # API endpoint URL
    capabilities:
      maxTokens: 4096
      supportsFunctionCalling: true
      supportsVision: false
      supportsStreaming: true
      supportsThinking: false
  
  openai-gpt4omini:  # Provider configuration name
    type: openai  # Provider type
    model: gpt-4o-mini  # AI model name
    baseUrl: https://api.openai.com/v1  # API endpoint URL
    apiKey: ${OPENAI_API_KEY}  # API key (can use environment variables)
    capabilities:
      maxTokens: 128000
      supportsFunctionCalling: true
      supportsVision: true
      supportsStreaming: true
      supportsThinking: false
    costPerToken:
      input: 0.00015
      output: 0.0006

current_provider: ollama-qwen3  # Active provider for new chat sessions

security:  # File access and security settings
  allowedExtensions:  # File types allowed for MCP operations
    - .ts
    - .js
    - .tsx
    - .jsx
    - .py
    - .rs
    - .go
    - .java
    - .c
    - .cpp
    - .h
    - .hpp
    - .md
    - .txt
    - .json
    - .yaml
    - .yml
    - .html
    - .css
    - .scss
    - .sass
    - .sql
    - .sh
    - .bash
  restrictToWorkspace: true  # Restrict file access to project directory
  maxFileSize: 1048576  # Maximum file size in bytes (1MB)

ui:  # User interface preferences
  streaming: true  # Enable streaming responses
  showTokens: true  # Display token usage in status bar
  theme: auto
  thinking: on  # Thinking mode: on, brief, off

mcp:  # Model Context Protocol settings
  servers: []  # External MCP servers (currently empty)

max_tokens: 4096  # Default maximum tokens for responses

# Usage Instructions:
# 1. Start chatting: aiya chat
# 2. Search files: aiya search <pattern>
# 3. Get help: aiya --help
#
# Environment Variables:
# - AIYA_API_KEY: Override API key
# - AIYA_MODEL: Override model name
# - AIYA_BASE_URL: Override base URL
# - AIYA_STREAMING: Override streaming setting (true/false)
#
# Chat Commands:
# - /read <file>: Read and display file content
# - /add <file>: Add file to context for next prompt
# - /search <pattern>: Search for files
# - /model-switch: Switch between configured providers
# - /thinking [mode]: Change thinking display mode
# - /tokens: Show token usage statistics
#
# For more information, visit: https://github.com/jhyoong/Aiya
```

## Key Components

### SetupWizard Component
- **Location**: `src/ui/components/setup/SetupWizard.tsx`
- **Purpose**: Main orchestrator of the setup process
- **State Management**: Uses React state machine pattern
- **Progress Tracking**: Shows "Step X/5" progress indicator

### ConfigurationGenerator
- **Location**: `src/core/config/generation.ts`
- **Purpose**: Generates YAML configuration files
- **Features**:
  - Smart provider name generation
  - Inline comments for user guidance
  - Header and footer documentation blocks
  - Format selection based on provider count

### Individual Setup Components
- **WelcomeScreen**: Introduction and instructions
- **ProviderSelection**: Provider type selection interface
- **ProviderConfigForm**: Dynamic configuration forms per provider
- **ConnectionTest**: Provider validation and testing

## Error Handling

### Connection Test Failures
- **Retry**: User can modify configuration and retry
- **Skip**: User can skip validation with 's' key
- **Back**: User can go back to modify provider settings

### Configuration Conflicts
- **Duplicate Providers**: Automatically replaced in additional providers
- **Invalid Settings**: Real-time validation prevents invalid configurations
- **Network Issues**: Graceful handling with retry options

### File System Operations
- **Backup Creation**: Existing `.aiya.yaml` is backed up before overwrite
- **Atomic Writes**: Configuration is written atomically to prevent corruption
- **Permission Errors**: Clear error messages for file system issues

## Exit Points

### Successful Completion
- **Auto-exit**: Automatically exits after 3 seconds on completion screen
- **Manual exit**: User can press Ctrl+C at any time

### Cancellation
- **Ctrl+C**: Graceful cancellation with cleanup
- **Back Navigation**: Users can navigate back through stages
- **Save and Exit**: Partial configuration can be saved at any point

## Security Considerations

### Default Security Settings
- **Workspace Restriction**: File access limited to project directory
- **File Extension Filtering**: Only common development file types allowed
- **Size Limits**: Maximum file size of 1MB to prevent abuse
- **API Key Protection**: Environment variable substitution recommended

### Validation Safeguards
- **Provider Testing**: Connection validation before saving
- **Configuration Validation**: Schema validation for all settings
- **Path Sanitization**: Secure handling of file paths and URLs

## Performance Optimizations

### Memory Management
- **Component Cleanup**: Proper unmounting and event listener cleanup
- **State Efficiency**: Minimal state updates and re-renders
- **Resource Cleanup**: Cleanup on process termination signals

### User Experience
- **Responsive UI**: Smooth transitions between stages
- **Clear Feedback**: Progress indicators and status messages
- **Keyboard Navigation**: Full keyboard accessibility
- **Error Recovery**: Clear paths to recover from errors