/**
 * Centralized model definitions for all AI providers
 * This file serves as the single source of truth for model metadata
 */

import type { ExtendedProviderConfig } from './manager.js';

export interface ModelMetadata {
  name: string;
  description: string;
  contextLength: number;
  capabilities: {
    supportsFunctionCalling: boolean;
    supportsVision: boolean;
    supportsStreaming: boolean;
    supportsThinking: boolean;
  };
  costPerToken?: {
    input: number;
    output: number;
  };
}

export interface ProviderCapabilities {
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsThinking: boolean;
  maxTokens: number;
}

export interface ProviderDefaults {
  baseUrl?: string;
  model: string;
  capabilities: ProviderCapabilities;
  contextLengthOptions?: Array<{ label: string; value: number }>;
  helpText: string;
  requiresApiKey: boolean;
  apiKeyPrefix?: string;
}

export interface ProviderModels {
  ollama: ModelMetadata[];
  openai: ModelMetadata[];
  gemini: ModelMetadata[];
  anthropic: ModelMetadata[];
  azure: ModelMetadata[];
  bedrock: ModelMetadata[];
}

export interface ProviderRegistry {
  [providerType: string]: {
    models: ModelMetadata[];
    defaults: ProviderDefaults;
  };
}

// Ollama model definitions
export const OLLAMA_MODELS: ModelMetadata[] = [
  {
    name: 'qwen3:8b',
    description: 'Balanced performance and speed, good for general use',
    contextLength: 8192,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsStreaming: true,
      supportsThinking: false,
    },
  },
  {
    name: 'devstral:latest',
    description: 'Medium sized model for coding',
    contextLength: 8192,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsStreaming: true,
      supportsThinking: false,
    },
  },
  {
    name: 'qwen2.5-coder:14b',
    description: 'Specialized for code generation and analysis',
    contextLength: 8192,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsStreaming: true,
      supportsThinking: false,
    },
  },
];

// OpenAI model definitions
export const OPENAI_MODELS: ModelMetadata[] = [
  {
    name: 'gpt-4o',
    description:
      'Latest multimodal model with vision, best overall performance',
    contextLength: 128000,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsThinking: false,
    },
    costPerToken: {
      input: 0.005,
      output: 0.015,
    },
  },
  {
    name: 'gpt-4o-mini',
    description: 'Faster and more cost-effective version of GPT-4o',
    contextLength: 128000,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsThinking: false,
    },
    costPerToken: {
      input: 0.00015,
      output: 0.0006,
    },
  },
  {
    name: 'gpt-4-turbo',
    description: 'High performance with 128K context, good balance',
    contextLength: 128000,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsThinking: false,
    },
    costPerToken: {
      input: 0.01,
      output: 0.03,
    },
  },
  {
    name: 'gpt-4',
    description: 'High-quality responses, 8K context window',
    contextLength: 8192,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsStreaming: true,
      supportsThinking: false,
    },
    costPerToken: {
      input: 0.03,
      output: 0.06,
    },
  },
  {
    name: 'gpt-3.5-turbo',
    description: 'Fast and affordable, 4K context window',
    contextLength: 4096,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsStreaming: true,
      supportsThinking: false,
    },
    costPerToken: {
      input: 0.001,
      output: 0.002,
    },
  },
  {
    name: 'gpt-3.5-turbo-16k',
    description: 'Extended context version of GPT-3.5 Turbo',
    contextLength: 16384,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsStreaming: true,
      supportsThinking: false,
    },
    costPerToken: {
      input: 0.003,
      output: 0.004,
    },
  },
];

// Gemini model definitions
export const GEMINI_MODELS: ModelMetadata[] = [
  {
    name: 'gemini-2.0-flash-exp',
    description: 'Fastest model with thinking mode, experimental features',
    contextLength: 1000000,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsThinking: true,
    },
    costPerToken: {
      input: 0.000075,
      output: 0.0003,
    },
  },
  {
    name: 'gemini-2.5-pro',
    description: 'Latest Gemini model with enhanced capabilities',
    contextLength: 1048576,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsThinking: true,
    },
    costPerToken: {
      input: 0.00125,
      output: 0.005,
    },
  },
  {
    name: 'gemini-2.5-flash',
    description: 'Balanced performance and speed with thinking mode',
    contextLength: 1048576,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsThinking: true,
    },
    costPerToken: {
      input: 0.000075,
      output: 0.0003,
    },
  },
  {
    name: 'gemini-2.5-flash-lite-preview-06-17',
    description: 'Lightweight version with thinking capabilities',
    contextLength: 1000000,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsThinking: true,
    },
    costPerToken: {
      input: 0.0000375,
      output: 0.00015,
    },
  },
  {
    name: 'gemini-1.5-pro',
    description: 'High-quality responses, 1M context window, multimodal',
    contextLength: 2097152,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsThinking: false,
    },
    costPerToken: {
      input: 0.00125,
      output: 0.005,
    },
  },
  {
    name: 'gemini-1.5-flash',
    description: 'Balanced performance and speed, good for most tasks',
    contextLength: 1048576,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsThinking: false,
    },
    costPerToken: {
      input: 0.000075,
      output: 0.0003,
    },
  },
  {
    name: 'gemini-1.5-flash-8b',
    description: 'Lightweight and fast, cost-effective option',
    contextLength: 1048576,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsThinking: false,
    },
    costPerToken: {
      input: 0.0000375,
      output: 0.00015,
    },
  },
  {
    name: 'gemini-1.0-pro',
    description: 'Previous generation model, stable and reliable',
    contextLength: 32768,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsStreaming: true,
      supportsThinking: false,
    },
    costPerToken: {
      input: 0.0005,
      output: 0.0015,
    },
  },
];

// Anthropic model definitions
export const ANTHROPIC_MODELS: ModelMetadata[] = [
  {
    name: 'claude-3-5-sonnet-20241022',
    description: 'Most intelligent model, best for complex reasoning',
    contextLength: 200000,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsThinking: false,
    },
    costPerToken: {
      input: 0.003,
      output: 0.015,
    },
  },
  {
    name: 'claude-3-5-haiku-20241022',
    description: 'Fastest model, great for quick tasks',
    contextLength: 200000,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsThinking: false,
    },
    costPerToken: {
      input: 0.001,
      output: 0.005,
    },
  },
];

// Azure model definitions (same as OpenAI but deployed on Azure)
export const AZURE_MODELS: ModelMetadata[] = [
  {
    name: 'gpt-4o',
    description: 'Azure-deployed GPT-4o with enterprise features',
    contextLength: 128000,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsThinking: false,
    },
  },
  {
    name: 'gpt-4o-mini',
    description: 'Azure-deployed GPT-4o-mini, cost-effective',
    contextLength: 128000,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsThinking: false,
    },
  },
];

// AWS Bedrock model definitions
export const BEDROCK_MODELS: ModelMetadata[] = [
  {
    name: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    description: 'Claude 3.5 Sonnet on AWS Bedrock',
    contextLength: 200000,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsThinking: false,
    },
  },
  {
    name: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    description: 'Claude 3.5 Haiku on AWS Bedrock',
    contextLength: 200000,
    capabilities: {
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsThinking: false,
    },
  },
];

// Combined model definitions
export const MODEL_DEFINITIONS: ProviderModels = {
  ollama: OLLAMA_MODELS,
  openai: OPENAI_MODELS,
  gemini: GEMINI_MODELS,
  anthropic: ANTHROPIC_MODELS,
  azure: AZURE_MODELS,
  bedrock: BEDROCK_MODELS,
};

// Utility functions
export function getModelMetadata(
  providerType: keyof ProviderModels,
  modelName: string
): ModelMetadata | undefined {
  return MODEL_DEFINITIONS[providerType].find(
    model => model.name === modelName
  );
}

export function getModelNames(providerType: keyof ProviderModels): string[] {
  return MODEL_DEFINITIONS[providerType].map(model => model.name);
}

export function getModelCapabilities(
  providerType: keyof ProviderModels,
  modelName: string
) {
  const metadata = getModelMetadata(providerType, modelName);
  if (!metadata) {
    // Return default capabilities for unknown models
    return {
      contextLength: 8192,
      supportsVision: false,
      supportsFunctionCalling: true,
      supportsThinking: false,
      supportsStreaming: true,
    };
  }

  return {
    contextLength: metadata.contextLength,
    supportsVision: metadata.capabilities.supportsVision,
    supportsFunctionCalling: metadata.capabilities.supportsFunctionCalling,
    supportsThinking: metadata.capabilities.supportsThinking,
    supportsStreaming: metadata.capabilities.supportsStreaming,
    ...(metadata.costPerToken && { costPerToken: metadata.costPerToken }),
  };
}

export function getModelDescription(
  providerType: keyof ProviderModels,
  modelName: string
): string {
  const metadata = getModelMetadata(providerType, modelName);
  return metadata?.description || `${modelName} - No description available`;
}

export function getDefaultModel(providerType: keyof ProviderModels): string {
  const defaults = {
    ollama: 'qwen3:8b',
    openai: 'gpt-4o',
    gemini: 'gemini-2.0-flash-exp',
    anthropic: 'claude-3-5-sonnet-20241022',
    azure: 'gpt-4o',
    bedrock: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  };

  return defaults[providerType];
}

// Provider-specific defaults
export const PROVIDER_DEFAULTS: Record<keyof ProviderModels, ProviderDefaults> =
  {
    ollama: {
      baseUrl: 'http://localhost:11434',
      model: 'qwen3:8b',
      capabilities: {
        supportsFunctionCalling: true,
        supportsVision: false,
        supportsStreaming: true,
        supportsThinking: false,
        maxTokens: 8192,
      },
      contextLengthOptions: [
        { label: '4K tokens (Standard)', value: 4096 },
        { label: '8K tokens (Extended)', value: 8192 },
        { label: '16K tokens (Large)', value: 16384 },
        { label: '32K tokens (Very Large)', value: 32768 },
        { label: '64K tokens (Maximum)', value: 65536 },
      ],
      helpText: `Ollama Configuration Help:

• Model: The name of the model to use (e.g., qwen3:8b, llama3.1:8b)
• Base URL: The Ollama server endpoint (default: http://localhost:11434)
• Context Length: Maximum number of tokens for context window

Prerequisites:
1. Install Ollama: https://ollama.ai/
2. Start Ollama server: ollama serve
3. Pull a model: ollama pull qwen3:8b

Popular models:
• qwen3:8b - Balanced performance and speed
• llama3.1:8b - Good general-purpose model
• codegemma:7b - Optimized for code generation
• mistral:7b - Fast and efficient

Troubleshooting:
• If connection fails, ensure Ollama is running
• Use 'ollama list' to see available models
• Use 'ollama pull <model>' to download models`,
      requiresApiKey: false,
    },

    openai: {
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      capabilities: {
        supportsFunctionCalling: true,
        supportsVision: true,
        supportsStreaming: true,
        supportsThinking: false,
        maxTokens: 128000,
      },
      helpText: `OpenAI Configuration Help:

• Model: The GPT model to use (e.g., gpt-4o, gpt-4-turbo)
• API Key: Your OpenAI API key (starts with sk-)
• Base URL: API endpoint (default: https://api.openai.com/v1)

Prerequisites:
1. Create OpenAI account: https://platform.openai.com/
2. Generate API key: https://platform.openai.com/api-keys
3. Add billing method to your account

Environment Variables:
• OPENAI_API_KEY: Set your API key as environment variable

OpenAI-Compatible Providers:
• During setup, you can choose custom endpoints for:
  - Perplexity AI (https://api.perplexity.ai)
  - Together AI (https://api.together.xyz/v1)
  - Local OpenAI-compatible servers
  - Other OpenAI API compatible services

Popular models:
• gpt-4o - Latest multimodal model, best performance
• gpt-4o-mini - Fast and cost-effective
• gpt-4-turbo - Good balance of capability and speed
• gpt-4 - High-quality responses, slower inference
• gpt-3.5-turbo - Fast and affordable

Troubleshooting:
• Ensure API key is valid and starts with 'sk-'
• Check billing status in OpenAI dashboard
• Verify model availability in your region
• For custom endpoints, ensure they are OpenAI API compatible`,
      requiresApiKey: true,
      apiKeyPrefix: 'sk-',
    },

    gemini: {
      model: 'gemini-2.0-flash-exp',
      capabilities: {
        supportsFunctionCalling: true,
        supportsVision: true,
        supportsStreaming: true,
        supportsThinking: true,
        maxTokens: 1000000,
      },
      helpText: `Google Gemini Configuration Help:

• Model: The Gemini model to use (e.g., gemini-2.0-flash-exp, gemini-1.5-pro)
• API Key: Your Google AI Studio API key
• Project ID: Google Cloud project ID (optional)
• Location: Google Cloud region (default: us-central1)

Prerequisites:
1. Create Google AI Studio account: https://aistudio.google.com/
2. Generate API key: https://aistudio.google.com/app/apikey
3. (Optional) Set up Google Cloud project for advanced features

Environment Variables:
• GEMINI_API_KEY: Set your API key as environment variable

Popular models:
• gemini-2.0-flash-exp - Fastest model with thinking capabilities
• gemini-1.5-pro - High-quality responses, large context window
• gemini-1.5-flash - Balanced performance and speed
• gemini-1.5-flash-8b - Lightweight and fast

Features:
• Thinking Mode: Shows reasoning process (2.0 models)
• Vision Support: Can analyze images and documents
• Large Context: Up to 1M tokens context window
• Function Calling: Supports tool use and API calls

Troubleshooting:
• Ensure API key is valid
• Check if Gemini API is enabled
• Verify model availability in your region`,
      requiresApiKey: true,
    },

    anthropic: {
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-3-5-sonnet-20241022',
      capabilities: {
        supportsFunctionCalling: true,
        supportsVision: true,
        supportsStreaming: true,
        supportsThinking: false,
        maxTokens: 200000,
      },
      helpText: `Anthropic Configuration Help:

• Model: Claude model to use (e.g., claude-3-5-sonnet-20241022)
• API Key: Your Anthropic API key (starts with sk-ant-)
• Base URL: API endpoint (default: https://api.anthropic.com)

Prerequisites:
1. Create Anthropic account: https://console.anthropic.com/
2. Generate API key: https://console.anthropic.com/settings/keys
3. Add billing method to your account

Environment Variables:
• ANTHROPIC_API_KEY: Set your API key as environment variable

Popular models:
• claude-3-5-sonnet-20241022 - Most intelligent model
• claude-3-5-haiku-20241022 - Fastest model

Troubleshooting:
• Ensure API key is valid and starts with 'sk-ant-'
• Check billing status in Anthropic console`,
      requiresApiKey: true,
      apiKeyPrefix: 'sk-ant-',
    },

    azure: {
      model: 'gpt-4o',
      capabilities: {
        supportsFunctionCalling: true,
        supportsVision: true,
        supportsStreaming: true,
        supportsThinking: false,
        maxTokens: 128000,
      },
      helpText: `Azure OpenAI Configuration Help:

• Model: Azure-deployed model (e.g., gpt-4o, gpt-4o-mini)
• API Key: Your Azure OpenAI API key
• Base URL: Azure OpenAI endpoint URL
• Deployment Name: Azure deployment name for the model

Prerequisites:
1. Create Azure account: https://azure.microsoft.com/
2. Set up Azure OpenAI service
3. Deploy models in Azure OpenAI Studio

Environment Variables:
• AZURE_OPENAI_API_KEY: Set your API key as environment variable

Troubleshooting:
• Ensure API key and endpoint are correct
• Verify model deployment is active
• Check subscription quotas`,
      requiresApiKey: true,
    },

    bedrock: {
      model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      capabilities: {
        supportsFunctionCalling: true,
        supportsVision: true,
        supportsStreaming: true,
        supportsThinking: false,
        maxTokens: 200000,
      },
      helpText: `AWS Bedrock Configuration Help:

• Model: Bedrock model ARN (e.g., anthropic.claude-3-5-sonnet-20241022-v2:0)
• Region: AWS region (e.g., us-east-1)
• Access Key ID: AWS access key
• Secret Access Key: AWS secret key

Prerequisites:
1. Create AWS account: https://aws.amazon.com/
2. Enable Bedrock service
3. Request model access in Bedrock console

Environment Variables:
• AWS_ACCESS_KEY_ID: AWS access key
• AWS_SECRET_ACCESS_KEY: AWS secret key
• AWS_REGION: AWS region

Troubleshooting:
• Ensure AWS credentials are configured
• Verify model access is granted
• Check region availability`,
      requiresApiKey: true,
    },
  };

// Create the unified provider registry
export const PROVIDER_REGISTRY: ProviderRegistry = {
  ollama: {
    models: OLLAMA_MODELS,
    defaults: PROVIDER_DEFAULTS.ollama,
  },
  openai: {
    models: OPENAI_MODELS,
    defaults: PROVIDER_DEFAULTS.openai,
  },
  gemini: {
    models: GEMINI_MODELS,
    defaults: PROVIDER_DEFAULTS.gemini,
  },
  anthropic: {
    models: ANTHROPIC_MODELS,
    defaults: PROVIDER_DEFAULTS.anthropic,
  },
  azure: {
    models: AZURE_MODELS,
    defaults: PROVIDER_DEFAULTS.azure,
  },
  bedrock: {
    models: BEDROCK_MODELS,
    defaults: PROVIDER_DEFAULTS.bedrock,
  },
};

// Enhanced utility functions
export function getProviderDefaults(
  providerType: keyof ProviderModels
): ProviderDefaults {
  return PROVIDER_DEFAULTS[providerType];
}

export function getProviderCapabilities(
  providerType: keyof ProviderModels
): ProviderCapabilities {
  return PROVIDER_DEFAULTS[providerType].capabilities;
}

export function createDefaultConfig(
  providerType: keyof ProviderModels
): Partial<ExtendedProviderConfig> {
  const defaults = PROVIDER_DEFAULTS[providerType];
  const config: Partial<ExtendedProviderConfig> = {
    type: providerType,
    model: defaults.model,
    capabilities: defaults.capabilities,
  };

  if (defaults.baseUrl) {
    config.baseUrl = defaults.baseUrl;
  }

  return config;
}
