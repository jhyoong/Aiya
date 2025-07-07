# Migration Guide: v1.1 → v1.2

Aiya v1.2 introduces multi-provider support while maintaining full backward compatibility. Existing configurations continue to work unchanged.

## What's New in v1.2

### Multi-Provider Support
- **OpenAI**: GPT-4, GPT-4 Turbo, GPT-3.5-turbo
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus/Sonnet/Haiku  
- **Azure OpenAI**: Enterprise Azure deployments
- **Google Gemini**: Gemini 1.5 Pro/Flash, Gemini 2.0 Flash
- **Enhanced Ollama**: Improved capabilities detection

### New Features
- **Provider Factory**: Automatic provider instantiation
- **Capability Detection**: Auto-detect vision, function calling, thinking
- **Enhanced Configuration**: Extended YAML schema with provider-specific options
- **Environment Variables**: Provider-specific API key management
- **Cost Tracking**: Built-in token cost information

## Migration Steps

### Step 1: Backup Existing Configuration
```bash
# Backup your current config
cp .aiya.yaml .aiya.yaml.backup
cp ~/.aiya/config.yaml ~/.aiya/config.yaml.backup 2>/dev/null || true
```

### Step 2: Update Aiya
```bash
# Update to v1.2
npm update -g aiya-cli

# Verify version
aiya --version  # Should show 1.2.0+
```

### Step 3: Test Existing Configuration
```bash
# Your existing config should work unchanged
aiya chat
```

## Configuration Migration

### v1.1 Format (Still Supported) ✅
```yaml
# .aiya.yaml - v1.1 format continues to work
provider: ollama
model: qwen2.5:8b
endpoint: http://localhost:11434
max_tokens: 4096
```

### v1.2 Format (Recommended) 🎯
```yaml
# .aiya.yaml - v1.2 nested format (recommended)
provider:
  type: ollama
  model: qwen2.5:8b
  baseUrl: http://localhost:11434
  capabilities:
    maxTokens: 4096
    supportsFunctionCalling: true
    supportsStreaming: true

security:
  allowedExtensions: ['.ts', '.js', '.py', '.md']
  restrictToWorkspace: true
  maxFileSize: 1048576

ui:
  streaming: true
  showTokens: true
  thinking: on
```

### Automatic Migration
Aiya automatically converts v1.1 configurations internally:

```yaml
# v1.1 flat format
provider: ollama
model: qwen2.5:8b
endpoint: http://localhost:11434

# Becomes (internally)
provider:
  type: ollama
  model: qwen2.5:8b
  baseUrl: http://localhost:11434
```

## Adding New Providers

### Keep Ollama as Default, Add Others
```yaml
# Primary provider (Ollama)
provider:
  type: ollama
  model: qwen2.5:8b
  baseUrl: http://localhost:11434

# Add named providers for different use cases
providers:
  openai:
    type: openai
    model: gpt-4o
    apiKey: sk-your-openai-key
  
  claude:
    type: anthropic
    model: claude-3-5-sonnet-20241022
    apiKey: sk-ant-your-key
```

### Switch via Environment Variables
```bash
# Keep your .aiya.yaml unchanged
# Switch providers using environment variables

# Use OpenAI for this session
export AIYA_PROVIDER=openai
export AIYA_MODEL=gpt-4o
export OPENAI_API_KEY=sk-your-key
aiya chat

# Switch back to Ollama
unset AIYA_PROVIDER AIYA_MODEL OPENAI_API_KEY
aiya chat
```

## Environment Variable Migration

### New Provider-Specific Variables
```bash
# v1.1 generic variables (still work)
export AIYA_MODEL=qwen2.5:8b
export AIYA_BASE_URL=http://localhost:11434

# v1.2 provider-specific variables (recommended)
export AIYA_PROVIDER=ollama           # New: specify provider type
export OPENAI_API_KEY=sk-...          # New: provider-specific keys
export ANTHROPIC_API_KEY=sk-ant-...
export GEMINI_API_KEY=...
```

### Variable Priority (unchanged)
1. Environment variables (highest)
2. Project `.aiya.yaml`
3. Global `~/.aiya/config.yaml`
4. Default values (lowest)

## Feature Migration

### MCP Tools (No Changes Required)
Your existing MCP tool configurations continue to work unchanged:

```yaml
mcp:
  servers:
    - name: filesystem
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"]
```

### Security Settings (No Changes Required)
```yaml
security:
  allowedExtensions: ['.ts', '.js', '.py']
  restrictToWorkspace: true
  maxFileSize: 1048576
```

### UI Settings (Enhanced)
```yaml
ui:
  streaming: true
  showTokens: true
  theme: auto
  thinking: on    # New: control thinking display (Anthropic)
```

## Testing Migration

### Verify Provider Detection
```bash
aiya chat
# Should show: Provider: Ollama qwen2.5:8b (Functions: ✓, Streaming: ✓)
```

### Test New Providers
```bash
# Test OpenAI (if you have API key)
export AIYA_PROVIDER=openai
export AIYA_MODEL=gpt-3.5-turbo
export OPENAI_API_KEY=sk-your-key
aiya chat

# Test back to Ollama
unset AIYA_PROVIDER AIYA_MODEL OPENAI_API_KEY
aiya chat
```

### Verify MCP Tools
```bash
aiya chat
# In chat: /read some-file.js
# Should work exactly as before
```

## Rollback Plan

If you encounter issues, you can roll back:

### Option 1: Use Explicit v1.1 Format
```yaml
# Force v1.1 format usage
provider: ollama
model: qwen2.5:8b
endpoint: http://localhost:11434
max_tokens: 4096
```

### Option 2: Restore Backups
```bash
cp .aiya.yaml.backup .aiya.yaml
cp ~/.aiya/config.yaml.backup ~/.aiya/config.yaml
```

### Option 3: Downgrade (if necessary)
```bash
npm install -g aiya-cli@1.1.1
```

## Common Migration Issues

### Issue: "Provider type 'ollama' not found"
**Solution**: Update to latest v1.2, providers are auto-registered

### Issue: Authentication errors with new providers
**Solution**: Check API key format and environment variables
```bash
# OpenAI keys start with sk-
export OPENAI_API_KEY=sk-...

# Anthropic keys start with sk-ant-
export ANTHROPIC_API_KEY=sk-ant-...
```

### Issue: Configuration not loading
**Solution**: Check YAML syntax and file permissions
```bash
# Validate YAML syntax
python -c "import yaml; yaml.safe_load(open('.aiya.yaml'))"

# Check permissions
ls -la .aiya.yaml
```

## Performance Notes

### v1.2 Improvements
- ✅ Faster provider switching
- ✅ Better error handling
- ✅ Enhanced streaming performance
- ✅ Automatic capability detection
- ✅ Reduced startup time

### Memory Usage
v1.2 uses slightly more memory due to provider abstractions, but the difference is negligible (<10MB).

## Getting Help

### Documentation
- [Multi-Provider Guide](./multi-provider-guide.md)
- [Quick Setup Guide](./quick-setup.md)

### Community
- [GitHub Issues](https://github.com/jhyoong/Aiya/issues)
- [GitHub Discussions](https://github.com/jhyoong/Aiya/discussions)

### Debug Mode
```bash
export AIYA_VERBOSE=true
aiya chat
```

## Summary

✅ **Zero Breaking Changes**: All v1.1 configurations work unchanged  
✅ **Gradual Migration**: Adopt new features at your own pace  
✅ **Easy Rollback**: Simple rollback options if needed  
✅ **Enhanced Features**: New capabilities without complexity  

Your existing Ollama setup continues to work exactly as before, with new options available when you need them.