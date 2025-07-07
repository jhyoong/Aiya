# Quick Setup Guide - Aiya v1.2

Get started with any AI provider in minutes.

## Quick Start

### 1. Initialize Project
```bash
cd your-project
aiya init
```

### 2. Choose Your Provider

#### OpenAI (Recommended for most users)
```bash
# Set environment variables
export OPENAI_API_KEY=sk-your-key-here
export AIYA_PROVIDER=openai
export AIYA_MODEL=gpt-4o

# Or edit .aiya.yaml
cat > .aiya.yaml << EOF
provider:
  type: openai
  model: gpt-4o
  apiKey: sk-your-key-here
EOF
```

#### Anthropic Claude (Best for reasoning)
```bash
# Set environment variables  
export ANTHROPIC_API_KEY=sk-ant-your-key
export AIYA_PROVIDER=anthropic
export AIYA_MODEL=claude-3-5-sonnet-20241022

# Enable thinking mode
export AIYA_THINKING=on
```

#### Local Ollama (Free, private)
```bash
# Install and start Ollama
curl -fsSL https://ollama.ai/install.sh | sh
ollama serve
ollama pull qwen2.5:8b

# Configure Aiya (default)
cat > .aiya.yaml << EOF
provider:
  type: ollama
  model: qwen2.5:8b
  baseUrl: http://localhost:11434
EOF
```

#### Azure OpenAI (Enterprise)
```bash
cat > .aiya.yaml << EOF
provider:
  type: azure
  model: your-deployment-name
  baseUrl: https://your-resource.openai.azure.com
  apiKey: your-azure-key
  azure:
    deploymentName: your-deployment-name
    apiVersion: "2024-02-15-preview"
EOF
```

#### Google Gemini (Large context)
```bash
export GEMINI_API_KEY=your-google-key
export AIYA_PROVIDER=gemini
export AIYA_MODEL=gemini-2.5-pro
```

### 3. Start Chatting
```bash
aiya chat
```

## Common Commands

```bash
# Quick provider switch
export AIYA_PROVIDER=openai && aiya chat
export AIYA_PROVIDER=anthropic && aiya chat

# Check current configuration
cat .aiya.yaml

# Enable verbose logging
export AIYA_VERBOSE=true && aiya chat
```

## API Key Setup

### Get API Keys
- **OpenAI**: [platform.openai.com](https://platform.openai.com/api-keys)
- **Anthropic**: [console.anthropic.com](https://console.anthropic.com/)
- **Google AI**: [aistudio.google.com](https://aistudio.google.com/app/apikey)
- **Azure**: Azure Portal → OpenAI Service

### Secure Storage
```bash
# Add to your shell profile (~/.bashrc, ~/.zshrc)
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GEMINI_API_KEY=...

# Or use a .env file (not recommended for production)
echo "OPENAI_API_KEY=sk-..." >> .env
```

## Model Recommendations

| Use Case | Provider | Model | Why |
|----------|----------|-------|-----|
| General coding | OpenAI | gpt-4o | Best balance of capability and speed |
| Complex reasoning | Anthropic | claude-3-5-sonnet | Superior logical reasoning |
| Fast prototyping | OpenAI | gpt-3.5-turbo | Fast and cost-effective |
| Large context | Gemini | gemini-2.5-pro | 1M token context window with thinking |
| Privacy/Local | Ollama | qwen2.5:8b | Runs locally, no API calls |
| Enterprise | Azure | gpt-4o | Enterprise security and compliance |

## Troubleshooting

### Common Issues
```bash
# Authentication error
export OPENAI_API_KEY=sk-correct-key

# Model not found
export AIYA_MODEL=gpt-4o  # Use correct model name

# Connection error
curl -I https://api.openai.com  # Check connectivity

# Ollama not running
ollama serve
```

### Getting Help
```bash
aiya --help          # CLI help
aiya chat            # Shows provider info in status bar
```

For detailed configuration, see [Multi-Provider Guide](./multi-provider-guide.md).