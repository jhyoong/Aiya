# Multi-Provider Configuration Guide - Aiya v1.2

Aiya v1.2 introduces comprehensive support for multiple AI providers, allowing you to seamlessly switch between OpenAI, Anthropic Claude, Azure OpenAI, Google Gemini, and Ollama models. This guide covers configuration, provider switching, and advanced features.

## Table of Contents
- [Overview](#overview)
- [Configuration Formats](#configuration-formats)
- [Provider-Specific Setup](#provider-specific-setup)
- [Environment Variables](#environment-variables)
- [Provider Switching](#provider-switching)
- [Advanced Features](#advanced-features)
- [Troubleshooting](#troubleshooting)

## Overview

### Supported Providers
- **Ollama** - Local models (qwen2.5, llama3, etc.)
- **OpenAI** - GPT-4, GPT-4 Turbo, GPT-3.5-turbo
- **Anthropic** - Claude 3.5 Sonnet, Claude 3 Opus/Sonnet/Haiku
- **Azure OpenAI** - Enterprise Azure deployments
- **Google Gemini** - Gemini 1.5 Pro/Flash, Gemini 2.0 Flash

### Key Features
- **Automatic Provider Detection**: Aiya detects provider capabilities (vision, function calling, thinking)
- **Unified Configuration**: Single configuration format across all providers
- **Seamless Switching**: Change providers without workflow disruption
- **Cost Tracking**: Built-in token cost information
- **Authentication Management**: Secure API key handling

## Configuration Formats

Aiya supports both **nested** (recommended) and **flat** configuration formats.

### Nested Format (Recommended)

```yaml
# .aiya.yaml
provider:
  type: openai
  model: gpt-4o
  baseUrl: https://api.openai.com/v1
  apiKey: sk-your-key-here
  capabilities:
    maxTokens: 128000
    supportsFunctionCalling: true
    supportsVision: true

security:
  allowedExtensions: ['.ts', '.js', '.py', '.md']
  restrictToWorkspace: true
  maxFileSize: 1048576

ui:
  streaming: true
  showTokens: true
  thinking: on
```

### Flat Format (Legacy Support)

```yaml
# .aiya.yaml
provider: openai
model: gpt-4o
endpoint: https://api.openai.com/v1
apiKey: sk-your-key-here
max_tokens: 8192
```

## Provider-Specific Setup

### OpenAI Configuration

```yaml
provider:
  type: openai
  model: gpt-4o                    # or gpt-4, gpt-3.5-turbo
  baseUrl: https://api.openai.com/v1
  apiKey: sk-your-openai-key
```

**Required:**
- `apiKey`: Your OpenAI API key from platform.openai.com

**Supported Models:**
- `gpt-4o` - Latest multimodal model (vision support)
- `gpt-4o-mini` - Fast, cost-effective model
- `gpt-4-turbo` - Previous generation with vision
- `gpt-4` - Standard GPT-4 model
- `gpt-3.5-turbo` - Fast, cost-effective option

### Anthropic (Claude) Configuration

```yaml
provider:
  type: anthropic
  model: claude-3-5-sonnet-20241022
  baseUrl: https://api.anthropic.com
  apiKey: sk-ant-your-key
  anthropic:
    maxTokens: 8192
    version: "2023-06-01"
```

**Required:**
- `apiKey`: Your Anthropic API key from console.anthropic.com

**Supported Models:**
- `claude-3-5-sonnet-20241022` - Latest Claude model
- `claude-3-5-haiku-20241022` - Fast, efficient model
- `claude-3-opus-20240229` - Most capable model
- `claude-3-sonnet-20240229` - Balanced performance

**Special Features:**
- **Thinking Tags**: Claude's internal reasoning is displayed when available
- **Large Context**: Up to 200K tokens context window

### Azure OpenAI Configuration

```yaml
provider:
  type: azure
  model: gpt-4o
  baseUrl: https://your-resource.openai.azure.com
  apiKey: your-azure-api-key
  azure:
    deploymentName: your-gpt4-deployment
    apiVersion: "2024-02-15-preview"
```

**Required:**
- `apiKey`: Your Azure OpenAI API key
- `baseUrl`: Your Azure OpenAI resource endpoint
- `azure.deploymentName`: Your specific deployment name

**Setup Steps:**
1. Create Azure OpenAI resource in Azure Portal
2. Deploy your chosen model (e.g., GPT-4)
3. Get your endpoint URL and API key
4. Use deployment name as the model identifier

### Google Gemini Configuration

```yaml
provider:
  type: gemini
  model: gemini-2.5-pro
  baseUrl: https://generativelanguage.googleapis.com
  apiKey: your-google-ai-key
  gemini:
    projectId: your-project-id      # Optional, for Vertex AI
    location: us-central1           # Optional, for Vertex AI
    thinkingBudget: -1              # Optional, -1 for dynamic, 0 to disable
    includeThoughts: false          # Optional, show thinking summaries
```

**Required:**
- `apiKey`: Your Google AI API key from aistudio.google.com

**Supported Models:**
- `gemini-2.5-pro` - Latest model with thinking support
- `gemini-2.5-flash` - Fast model with thinking support
- `gemini-2.5-flash-lite-preview-06-17` - Lite model with thinking support
- `gemini-1.5-pro` - Most capable, large context (2M tokens)
- `gemini-1.5-flash` - Fast, efficient model
- `gemini-1.0-pro` - Original Gemini model

### AWS Bedrock Provider Configuration

```yaml
provider:
  type: bedrock
  model: anthropic.claude-3-sonnet-20240229-v1:0
  baseUrl: https://bedrock-runtime.us-east-1.amazonaws.com
  bedrock:
    region: us-east-1
    accessKeyId: AKIA...  # Optional - uses AWS credential chain if not provided
    secretAccessKey: xxx  # Optional - uses AWS credential chain if not provided
```

**Environment Variables**:
- `AWS_REGION` - AWS region for Bedrock
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_SESSION_TOKEN` - AWS session token (for temporary credentials)

**Supported Models**:
- Claude: `anthropic.claude-3-5-sonnet-20241022-v2:0`, `anthropic.claude-3-haiku-20240307-v1:0`, etc.
- Titan: `amazon.titan-text-express-v1`, `amazon.titan-text-premier-v1:0`
- Cohere: `cohere.command-text-v14`
- AI21: `ai21.jamba-1-5-large-v1:0`

### Ollama Configuration (Local)

```yaml
provider:
  type: ollama
  model: qwen2.5:8b
  baseUrl: http://localhost:11434
```

**Setup:**
1. Install Ollama from ollama.ai
2. Pull your desired model: `ollama pull qwen2.5:8b`
3. Ensure Ollama is running on localhost:11434

## Environment Variables

Override configuration with environment variables for secure API key management:

### Universal Variables
```bash
export AIYA_PROVIDER=openai        # Provider type
export AIYA_MODEL=gpt-4o          # Model name
export AIYA_BASE_URL=https://...   # API endpoint
export AIYA_API_KEY=your-key       # Generic API key
```

### Provider-Specific Variables
```bash
# OpenAI
export OPENAI_API_KEY=sk-...

# Anthropic
export ANTHROPIC_API_KEY=sk-ant-...

# Azure OpenAI
export AZURE_OPENAI_API_KEY=...

# Google Gemini
export GEMINI_API_KEY=...
```

### Configuration Priority
1. Environment variables (highest)
2. Project `.aiya.yaml`
3. Global `~/.aiya/config.yaml`
4. Default values (lowest)

## Provider Switching

### Quick Switch with Environment Variables

```bash
# Switch to OpenAI
export AIYA_PROVIDER=openai
export AIYA_MODEL=gpt-4o
aiya chat

# Switch to Claude
export AIYA_PROVIDER=anthropic
export AIYA_MODEL=claude-3-5-sonnet-20241022
aiya chat

# Switch to local Ollama
export AIYA_PROVIDER=ollama
export AIYA_MODEL=qwen2.5:8b
aiya chat
```

### Multi-Provider Configuration

Define multiple providers in one config file:

```yaml
# Default provider
provider:
  type: ollama
  model: qwen2.5:8b
  baseUrl: http://localhost:11434

# Named provider configurations
providers:
  gpt4:
    type: openai
    model: gpt-4o
    apiKey: sk-your-openai-key
  
  claude:
    type: anthropic
    model: claude-3-5-sonnet-20241022
    apiKey: sk-ant-your-key
  
  gemini:
    type: gemini
    model: gemini-1.5-pro
    apiKey: your-google-key
```

### Project-Specific Providers

Different projects can use different providers:

```bash
# AI Research Project
cd ~/ai-research
echo "provider: anthropic
model: claude-3-opus-20240229" > .aiya.yaml

# Web Development Project  
cd ~/web-app
echo "provider: openai
model: gpt-3.5-turbo" > .aiya.yaml

# Local Development
cd ~/local-dev
echo "provider: ollama
model: codellama:7b" > .aiya.yaml
```

## Advanced Features

### Capability Detection

Aiya automatically detects and displays provider capabilities:

```bash
# Check provider capabilities
aiya chat
# Shows: Provider: OpenAI GPT-4o (Vision: ✓, Functions: ✓, Streaming: ✓)
```

### Cost Tracking

Built-in token cost information for commercial providers:

```yaml
provider:
  type: openai
  model: gpt-4o
  costPerToken:
    input: 0.0025   # $0.0025 per 1K input tokens
    output: 0.01    # $0.01 per 1K output tokens
```

### Thinking Mode (Anthropic & Gemini)

Claude's and Gemini's internal reasoning can be displayed:

```bash
# Enable thinking display
export AIYA_THINKING=on     # Show full thinking
export AIYA_THINKING=brief  # Show summarized thinking  
export AIYA_THINKING=off    # Hide thinking (default)
```

**Gemini Thinking Configuration:**
```yaml
provider:
  type: gemini
  model: gemini-2.5-pro
  gemini:
    thinkingBudget: -1      # -1 for dynamic, 0-24576 for fixed budget
    includeThoughts: true   # Show thinking summaries
```

### Function Calling Support

All providers support tool/function calling with MCP:

```yaml
mcp:
  servers:
    - name: filesystem
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed"]
```

### Vision Support

Models with vision capabilities can process images:

**Supported Models:**
- OpenAI: GPT-4o, GPT-4o-mini, GPT-4-turbo
- Anthropic: All Claude 3+ models
- Gemini: All 1.5+ models

**Thinking Support:**
- Anthropic: All Claude 3+ models
- Gemini: 2.5+ models (Pro, Flash, Flash-Lite)

### Streaming Configuration

Control response streaming per provider:

```yaml
ui:
  streaming: true          # Enable streaming
  showTokens: true         # Display token counts
  theme: auto             # UI theme
```

## Troubleshooting

### Common Issues

#### Authentication Errors
```bash
# Check API key validity
aiya chat
# Error: Invalid OpenAI API key

# Solutions:
export OPENAI_API_KEY=sk-correct-key
# or update .aiya.yaml with correct apiKey
```

#### Model Not Found
```bash
# Error: Model 'gpt-5' not found

# Check available models for provider:
# OpenAI: gpt-4o, gpt-4, gpt-3.5-turbo
# Anthropic: claude-3-5-sonnet-20241022, etc.
# Update model name in configuration
```

#### Connection Issues
```bash
# For Ollama
ollama serve  # Ensure Ollama is running

# For cloud providers
curl -I https://api.openai.com  # Check connectivity
```

#### Configuration Conflicts
```bash
# Clear environment variables
unset AIYA_PROVIDER AIYA_MODEL AIYA_API_KEY

# Check effective configuration
cat .aiya.yaml
```

### Provider-Specific Troubleshooting

#### Azure OpenAI
- Ensure deployment name matches `azure.deploymentName`
- Check API version compatibility
- Verify resource endpoint URL format

#### Gemini
- Confirm API key from AI Studio (not Cloud Console)
- Check model availability in your region
- Verify quota limits

#### Anthropic
- Ensure API key starts with `sk-ant-`
- Check usage limits and billing
- Verify model name format with date suffix

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
export AIYA_VERBOSE=true
aiya chat
```

## Migration from v1.1

### Automatic Migration

Existing v1.1 configurations are automatically supported:

```yaml
# v1.1 format (still works)
provider: ollama
model: qwen2.5:8b
endpoint: http://localhost:11434
```

### Recommended Upgrade

Update to v1.2 nested format for full features:

```yaml
# v1.2 format (recommended)
provider:
  type: ollama
  model: qwen2.5:8b
  baseUrl: http://localhost:11434
  capabilities:
    maxTokens: 4096
    supportsFunctionCalling: true
```

### Configuration Validation

Aiya validates configurations on startup and provides helpful error messages for invalid settings.

---

For additional support, visit the [Aiya GitHub repository](https://github.com/jhyoong/Aiya) or check the [troubleshooting guide](https://github.com/jhyoong/Aiya/wiki/Troubleshooting).