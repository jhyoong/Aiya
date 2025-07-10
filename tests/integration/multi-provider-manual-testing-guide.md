# Aiya Multi-Provider Manual Testing Guide

## Overview

This guide provides comprehensive testing instructions for all 6 model providers supported by Aiya v1.2.0:
- **Ollama** (Local models)
- **OpenAI** (GPT models)
- **Anthropic** (Claude models)
- **Azure OpenAI** (Enterprise GPT)
- **Google Gemini** (Gemini models)
- **AWS Bedrock** (Multi-model platform)

## Prerequisites

### System Requirements
- Node.js 20.0.0 or higher
- Aiya CLI built and installed (`npm run build`)
- Access to at least one model provider

### Build Aiya
```bash
npm run build
npm run start -- --help  # Verify installation
```

## Provider Configuration & Testing

### 1. Ollama Provider Testing

#### Prerequisites
- Ollama installed and running locally
- At least one model pulled (e.g., `ollama pull qwen2.5:8b`)

#### Configuration

**Option A: Flat Configuration (.aiya.yaml)**
```yaml
provider: ollama
model: qwen2.5:8b
endpoint: http://localhost:11434
workspace: ./
max_tokens: 4096
```

**Option B: Nested Configuration (.aiya.yaml)**
```yaml
provider:
  type: ollama
  baseUrl: http://localhost:11434
  model: qwen2.5:8b
  capabilities:
    maxTokens: 4096
    supportsFunctionCalling: true
    supportsVision: false
    supportsStreaming: true
    supportsThinking: false
```

**Option C: Environment Variables**
```bash
export AIYA_PROVIDER=ollama
export AIYA_MODEL=qwen2.5:8b
export AIYA_BASE_URL=http://localhost:11434
```

#### Test Scenarios

**TC1.1: Basic Chat**
```bash
aiya chat
```
- **Input**: "Hello, how are you?"
- **Expected**: Model responds with greeting
- **Verify**: Streaming response, token count displayed

**TC1.2: Function Calling**
```bash
aiya chat
```
- **Input**: "/read package.json"
- **Expected**: File content displayed
- **Verify**: MCP tool execution works

**TC1.3: File Operations**
```bash
aiya chat
```
- **Input**: "/search *.ts"
- **Expected**: TypeScript files listed
- **Verify**: File search respects workspace boundaries

**TC1.4: Model Information**
```bash
aiya chat
```
- **Input**: "/model"
- **Expected**: Model info showing qwen2.5:8b, context length, capabilities
- **Verify**: No vision support, function calling enabled

**TC1.5: Health Check**
- **Setup**: Stop Ollama service
- **Run**: `aiya chat`
- **Expected**: Connection error with helpful message
- **Verify**: Graceful error handling

#### Expected Outputs
- **Streaming**: Real-time response chunks
- **Token Count**: Approximate count (length/4 algorithm)
- **No Vision**: Vision commands should fail gracefully
- **Function Calling**: MCP tools should work
- **Context**: Model-specific context length detected

---

### 2. OpenAI Provider Testing

#### Prerequisites
- Valid OpenAI API key
- Active OpenAI account with credits

#### Configuration

**Option A: Flat Configuration (.aiya.yaml)**
```yaml
provider: openai
model: gpt-4o-mini
endpoint: https://api.openai.com/v1
apiKey: sk-your-openai-key-here
workspace: ./
max_tokens: 4096
```

**Option B: Nested Configuration (.aiya.yaml)**
```yaml
provider:
  type: openai
  baseUrl: https://api.openai.com/v1
  model: gpt-4o-mini
  apiKey: sk-your-openai-key-here
  capabilities:
    maxTokens: 128000
    supportsFunctionCalling: true
    supportsVision: true
    supportsStreaming: true
    supportsThinking: false
  costPerToken:
    input: 0.00015
    output: 0.0006
```

**Option C: Environment Variables**
```bash
export AIYA_PROVIDER=openai
export AIYA_MODEL=gpt-4o-mini
export OPENAI_API_KEY=sk-your-openai-key-here
```

#### Test Scenarios

**TC2.1: Basic Chat**
```bash
aiya chat
```
- **Input**: "Explain recursion in programming"
- **Expected**: Detailed explanation with examples
- **Verify**: High-quality response, token usage tracking

**TC2.2: Vision Support (gpt-4o models)**
```bash
aiya chat
```
- **Input**: "Describe this image: [paste image or provide URL]"
- **Expected**: Detailed image description
- **Verify**: Vision capabilities work (requires vision-capable model)

**TC2.3: Function Calling**
```bash
aiya chat
```
- **Input**: "/read src/core/providers/openai.ts"
- **Expected**: File content displayed
- **Verify**: Function calling integrated with MCP

**TC2.4: Cost Tracking**
```bash
aiya chat
```
- **Input**: "Write a short poem"
- **Expected**: Poem generated with cost information
- **Verify**: Input/output token costs calculated

**TC2.5: Model Validation**
```bash
aiya chat
```
- **Setup**: Invalid model name in config
- **Expected**: "Model not found" error
- **Verify**: Proper error handling

#### Expected Outputs
- **Streaming**: Smooth streaming responses
- **Token Count**: Precise token usage (returned by API)
- **Vision**: Image analysis (gpt-4o models)
- **Cost**: Per-token cost calculation
- **Quality**: High-quality responses

---

### 3. Anthropic Provider Testing

#### Prerequisites
- Valid Anthropic API key (starts with `sk-ant-`)
- Active Anthropic account

#### Configuration

**Option A: Flat Configuration (.aiya.yaml)**
```yaml
provider: anthropic
model: claude-3-5-sonnet-20241022
endpoint: https://api.anthropic.com
apiKey: sk-ant-your-anthropic-key-here
workspace: ./
max_tokens: 4096
anthropic_version: "2023-06-01"
```

**Option B: Nested Configuration (.aiya.yaml)**
```yaml
provider:
  type: anthropic
  baseUrl: https://api.anthropic.com
  model: claude-3-5-sonnet-20241022
  apiKey: sk-ant-your-anthropic-key-here
  anthropic:
    maxTokens: 4096
    version: "2023-06-01"
  capabilities:
    maxTokens: 200000
    supportsFunctionCalling: true
    supportsVision: true
    supportsStreaming: true
    supportsThinking: true
  costPerToken:
    input: 0.003
    output: 0.015
```

**Option C: Environment Variables**
```bash
export AIYA_PROVIDER=anthropic
export AIYA_MODEL=claude-3-5-sonnet-20241022
export ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
```

#### Test Scenarios

**TC3.1: Basic Chat**
```bash
aiya chat
```
- **Input**: "Explain the concept of machine learning"
- **Expected**: Comprehensive explanation
- **Verify**: Anthropic-quality response

**TC3.2: Thinking Mode**
```bash
aiya chat
```
- **Input**: "Solve this logic puzzle: A man lives on the 20th floor..."
- **Expected**: Thinking process displayed, then solution
- **Verify**: Thinking tags parsed and displayed

**TC3.3: Vision Support**
```bash
aiya chat
```
- **Input**: "Analyze this screenshot: [image]"
- **Expected**: Detailed image analysis
- **Verify**: Vision capabilities work

**TC3.4: Large Context**
```bash
aiya chat
```
- **Input**: "/read [large-file.txt]" (paste large content)
- **Expected**: Processes large context (up to 200K tokens)
- **Verify**: Large context handling

**TC3.5: Function Calling**
```bash
aiya chat
```
- **Input**: "/search --content 'provider'"
- **Expected**: File search results
- **Verify**: Tool calling works

#### Expected Outputs
- **Thinking**: `<thinking>` tags displayed during reasoning
- **Vision**: Image analysis capabilities
- **Context**: Large context window (200K tokens)
- **Quality**: High-quality, nuanced responses
- **Streaming**: Smooth streaming with thinking

---

### 4. Azure OpenAI Provider Testing

#### Prerequisites
- Azure OpenAI service deployed
- Valid API key and resource endpoint
- Deployment created (e.g., "gpt-4o-mini")

#### Configuration

**Option A: Flat Configuration (.aiya.yaml)**
```yaml
provider: azure
model: gpt-4o-mini
endpoint: https://your-resource.openai.azure.com
apiKey: your-azure-key-here
workspace: ./
max_tokens: 4096
azure_deployment: gpt-4o-mini
azure_api_version: "2024-02-15-preview"
```

**Option B: Nested Configuration (.aiya.yaml)**
```yaml
provider:
  type: azure
  baseUrl: https://your-resource.openai.azure.com
  model: gpt-4o-mini
  apiKey: your-azure-key-here
  azure:
    deploymentName: gpt-4o-mini
    apiVersion: "2024-02-15-preview"
  capabilities:
    maxTokens: 128000
    supportsFunctionCalling: true
    supportsVision: true
    supportsStreaming: true
    supportsThinking: false
```

**Option C: Environment Variables**
```bash
export AIYA_PROVIDER=azure
export AIYA_MODEL=gpt-4o-mini
export AIYA_BASE_URL=https://your-resource.openai.azure.com
export AZURE_OPENAI_API_KEY=your-azure-key-here
```

#### Test Scenarios

**TC4.1: Basic Chat**
```bash
aiya chat
```
- **Input**: "What is Azure OpenAI?"
- **Expected**: Explanation of Azure OpenAI
- **Verify**: Azure endpoint working

**TC4.2: Deployment Name Inference**
```bash
aiya chat
```
- **Input**: "/model"
- **Expected**: Shows deployment name and base model
- **Verify**: Deployment name correctly inferred

**TC4.3: Vision Support**
```bash
aiya chat
```
- **Input**: "Describe this image: [image]"
- **Expected**: Image description (if vision-capable deployment)
- **Verify**: Vision works through Azure

**TC4.4: Function Calling**
```bash
aiya chat
```
- **Input**: "/read README.md"
- **Expected**: File content displayed
- **Verify**: Function calling through Azure

**TC4.5: Error Handling**
```bash
aiya chat
```
- **Setup**: Invalid deployment name
- **Expected**: "Deployment not found" error
- **Verify**: Azure-specific error handling

#### Expected Outputs
- **Deployment**: Uses specified deployment name
- **Capabilities**: Inherits from base OpenAI model
- **Streaming**: Azure streaming works
- **Authentication**: Azure API key authentication
- **URLs**: Correct Azure endpoint construction

---

### 5. Google Gemini Provider Testing

#### Prerequisites
- Google AI API key
- Access to Gemini models

#### Configuration

**Option A: Flat Configuration (.aiya.yaml)**
```yaml
provider: gemini
model: gemini-2.5-flash
endpoint: https://generativelanguage.googleapis.com
apiKey: AIza-your-gemini-key-here
workspace: ./
max_tokens: 4096
gemini_project_id: your-project-id
gemini_location: us-central1
```

**Option B: Nested Configuration (.aiya.yaml)**
```yaml
provider:
  type: gemini
  baseUrl: https://generativelanguage.googleapis.com
  model: gemini-2.5-flash
  apiKey: AIza-your-gemini-key-here
  gemini:
    projectId: your-project-id
    location: us-central1
    thinkingBudget: -1
    includeThoughts: true
  capabilities:
    maxTokens: 1048576
    supportsFunctionCalling: true
    supportsVision: true
    supportsStreaming: true
    supportsThinking: true
  costPerToken:
    input: 0.00125
    output: 0.005
```

**Option C: Environment Variables**
```bash
export AIYA_PROVIDER=gemini
export AIYA_MODEL=gemini-2.5-flash
export GEMINI_API_KEY=AIza-your-gemini-key-here
```

#### Test Scenarios

**TC5.1: Basic Chat**
```bash
aiya chat
```
- **Input**: "Explain quantum computing"
- **Expected**: Detailed explanation
- **Verify**: Gemini-quality response

**TC5.2: Thinking Mode (2.5+ models)**
```bash
aiya chat
```
- **Input**: "Plan a trip to Japan for 2 weeks"
- **Expected**: Thinking process shown, then detailed plan
- **Verify**: Thinking mode works on 2.5+ models

**TC5.3: Vision Support**
```bash
aiya chat
```
- **Input**: "What's in this image? [image]"
- **Expected**: Detailed image analysis
- **Verify**: Vision capabilities work

**TC5.4: Large Context**
```bash
aiya chat
```
- **Input**: "/read [very-large-file.txt]"
- **Expected**: Processes very large context (up to 1M+ tokens)
- **Verify**: Massive context window handling

**TC5.5: Function Calling**
```bash
aiya chat
```
- **Input**: "/search --content 'gemini'"
- **Expected**: Search results
- **Verify**: Function calling works

#### Expected Outputs
- **Thinking**: Thinking summaries for 2.5+ models
- **Context**: Massive context windows (1M+ tokens)
- **Vision**: Advanced image analysis
- **Quality**: Google's latest AI capabilities
- **Streaming**: Smooth streaming responses

---

### 6. AWS Bedrock Provider Testing

#### Prerequisites
- AWS account with Bedrock access
- AWS credentials configured
- Model access enabled (Claude, Titan, etc.)

#### Configuration

**Option A: Flat Configuration (.aiya.yaml)**
```yaml
provider: bedrock
model: anthropic.claude-3-5-sonnet-20241022-v2:0
workspace: ./
max_tokens: 4096
aws_region: us-east-1
aws_access_key_id: your-access-key
aws_secret_access_key: your-secret-key
```

**Option B: Nested Configuration (.aiya.yaml)**
```yaml
provider:
  type: bedrock
  model: anthropic.claude-3-5-sonnet-20241022-v2:0
  bedrock:
    region: us-east-1
    accessKeyId: your-access-key
    secretAccessKey: your-secret-key
  capabilities:
    maxTokens: 200000
    supportsFunctionCalling: true
    supportsVision: true
    supportsStreaming: true
    supportsThinking: true
```

**Option C: Environment Variables**
```bash
export AIYA_PROVIDER=bedrock
export AIYA_MODEL=anthropic.claude-3-5-sonnet-20241022-v2:0
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
```

**Option D: IAM Role (No explicit credentials)**
```yaml
provider:
  type: bedrock
  model: anthropic.claude-3-5-sonnet-20241022-v2:0
  bedrock:
    region: us-east-1
```

#### Test Scenarios

**TC6.1: Claude Models**
```bash
aiya chat
```
- **Input**: "Explain AWS Bedrock"
- **Expected**: Detailed explanation
- **Verify**: Claude model through Bedrock

**TC6.2: Titan Models**
```bash
# Update config to use Titan
aiya chat
```
- **Input**: "Write a summary of machine learning"
- **Expected**: Titan-generated response
- **Verify**: Different model family works

**TC6.3: IAM Role Authentication**
```bash
# Configure IAM role, remove explicit credentials
aiya chat
```
- **Input**: "Hello"
- **Expected**: Successful authentication via IAM
- **Verify**: Credential chain works

**TC6.4: Regional Testing**
```bash
# Test different regions
aiya chat
```
- **Input**: "Test message"
- **Expected**: Works in different AWS regions
- **Verify**: Regional deployment works

**TC6.5: Streaming**
```bash
aiya chat
```
- **Input**: "Write a long story"
- **Expected**: Streaming response
- **Verify**: Bedrock streaming works

#### Expected Outputs
- **Multi-Model**: Different model families (Claude, Titan, Cohere)
- **Authentication**: AWS credential chain support
- **Regional**: Works across AWS regions
- **Streaming**: Bedrock streaming support
- **Capabilities**: Model-specific capabilities

---

## Feature Matrix Testing

### Vision Support Testing

**Prerequisites**: Provider with vision-capable model

**Test Cases**:
1. **Image URL**: "Describe this image: https://example.com/image.jpg"
2. **Local Image**: Paste image in terminal
3. **Screenshot**: Take and analyze screenshot
4. **Multiple Images**: Analyze multiple images

**Expected Results**:
- **OpenAI**: gpt-4o, gpt-4o-mini support vision
- **Anthropic**: All Claude 3+ models support vision
- **Azure**: Vision-capable deployments work
- **Gemini**: All 1.5+ models support vision
- **Bedrock**: Depends on underlying model (Claude = yes)
- **Ollama**: Generally no vision support

### Function Calling Testing

**Test Commands**:
```bash
/read package.json
/search *.ts
/search --content "provider"
/model
/help
```

**Expected Results**:
- All providers should support MCP tool execution
- File operations should work consistently
- Search should respect workspace boundaries
- Model info should show provider-specific details

### Thinking Mode Testing

**Prerequisites**: Provider with thinking support

**Test Cases**:
1. **Logic Puzzle**: "Solve this riddle: ..."
2. **Planning**: "Plan a software architecture for..."
3. **Math Problem**: "Solve this complex equation..."

**Expected Results**:
- **Anthropic**: Thinking tags displayed
- **Gemini**: Thinking summaries (2.5+ models)
- **Others**: No thinking mode

### Streaming Testing

**Test Cases**:
1. **Long Response**: "Write a 1000-word essay on..."
2. **Code Generation**: "Write a complete React component..."
3. **Story**: "Tell me a long story about..."

**Expected Results**:
- All providers should stream responses
- Token counts should update in real-time
- No significant delays or buffering

## Troubleshooting Guide

### Common Issues

#### 1. Authentication Errors

**Ollama**:
- Error: "Connection refused"
- Solution: Ensure Ollama is running (`ollama serve`)

**OpenAI**:
- Error: "Invalid API key"
- Solution: Verify API key starts with `sk-` and has credits

**Anthropic**:
- Error: "Authentication failed"
- Solution: Verify API key starts with `sk-ant-`

**Azure**:
- Error: "Deployment not found"
- Solution: Check deployment name and resource endpoint

**Gemini**:
- Error: "API_KEY_INVALID"
- Solution: Verify API key starts with `AIza`

**Bedrock**:
- Error: "AccessDeniedException"
- Solution: Check AWS credentials and Bedrock permissions

#### 2. Model Not Found

**All Providers**:
- Verify model name spelling
- Check model availability in region
- Ensure model access permissions

#### 3. Configuration Issues

**Flat vs Nested Config**:
- Both formats supported
- Environment variables override config files
- Check YAML syntax

#### 4. Network Issues

**Proxy Environments**:
- Configure HTTP_PROXY/HTTPS_PROXY
- Check firewall rules
- Verify endpoint URLs

### Debugging Commands

```bash
# Check configuration
aiya chat
/model

# Test connectivity
aiya chat
/help

# Verify file operations
aiya chat
/read package.json

# Check workspace
aiya chat
/search *.md
```

## Test Completion Checklist

### Per Provider
- [ ] Basic chat functionality
- [ ] Authentication working
- [ ] Model information correct
- [ ] File operations working
- [ ] Streaming responses
- [ ] Error handling graceful
- [ ] Configuration loading
- [ ] Environment variables
- [ ] Token counting
- [ ] Cost calculation (commercial providers)

### Feature Matrix
- [ ] Vision support (capable models)
- [ ] Function calling (all providers)
- [ ] Thinking mode (Anthropic, Gemini 2.5+)
- [ ] Streaming (all providers)
- [ ] Large context (Anthropic, Gemini)
- [ ] Multiple model families (Bedrock)

### Error Scenarios
- [ ] Invalid API keys
- [ ] Network connectivity issues
- [ ] Model not found
- [ ] Configuration errors
- [ ] Rate limiting
- [ ] Service unavailable

## Testing Notes

1. **Test with fresh terminal sessions** to ensure environment variables are loaded
2. **Use different models** within each provider to verify model-specific features
3. **Test both streaming and non-streaming** modes
4. **Verify token counting accuracy** across providers
5. **Check error messages** are helpful and actionable
6. **Test workspace security** boundaries
7. **Verify configuration hierarchy** (env vars > project > global > defaults)

## Reporting Issues

When reporting issues, include:
- Provider and model used
- Configuration file contents
- Error messages
- Steps to reproduce
- Expected vs actual behavior
- System environment (OS, Node version)

This comprehensive testing guide ensures all aspects of the multi-provider architecture work correctly and consistently across all supported providers.