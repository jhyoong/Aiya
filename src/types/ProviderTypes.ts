/**
 * Provider Type Definitions
 *
 * Comprehensive type definitions for AI provider configurations, capabilities,
 * and responses. This module replaces `any` usage in provider-related code
 * with properly structured and validated types.
 */

import { StructuredError } from './ErrorTypes.js';

/**
 * Base configuration interface that all providers must implement.
 */
export interface BaseProviderConfig {
  /** Provider type identifier */
  type: string;

  /** Model name to use */
  model: string;

  /** Base URL for the provider's API */
  baseUrl: string;

  /** API key for authentication (optional for some providers) */
  apiKey?: string;

  /** Maximum tokens for requests */
  maxTokens?: number;
}

/**
 * OpenAI-specific configuration.
 */
export interface OpenAIConfig extends BaseProviderConfig {
  type: 'openai';
  organization?: string;
  project?: string;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * Anthropic-specific configuration.
 */
export interface AnthropicConfig extends BaseProviderConfig {
  type: 'anthropic';
  anthropic?: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
  };
}

/**
 * Azure OpenAI-specific configuration.
 */
export interface AzureConfig extends BaseProviderConfig {
  type: 'azure';
  azure: {
    resourceName: string;
    deploymentName: string;
    apiVersion: string;
    endpoint?: string;
  };
}

/**
 * Google Gemini-specific configuration.
 */
export interface GeminiConfig extends BaseProviderConfig {
  type: 'gemini';
  gemini?: {
    projectId?: string;
    location?: string;
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    candidateCount?: number;
    stopSequences?: string[];
  };
}

/**
 * AWS Bedrock-specific configuration.
 */
export interface BedrockConfig extends BaseProviderConfig {
  type: 'bedrock';
  bedrock: {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    profile?: string;
    modelId: string;
  };
}

/**
 * Ollama-specific configuration.
 */
export interface OllamaConfig extends BaseProviderConfig {
  type: 'ollama';
  temperature?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  seed?: number;
  numCtx?: number;
}

/**
 * Union type of all provider configurations.
 */
export type ProviderConfig =
  | OpenAIConfig
  | AnthropicConfig
  | AzureConfig
  | GeminiConfig
  | BedrockConfig
  | OllamaConfig;

/**
 * Provider capabilities interface.
 */
export interface ProviderCapabilities {
  /** Whether the provider supports vision/image inputs */
  supportsVision: boolean;

  /** Whether the provider supports function calling */
  supportsFunctionCalling: boolean;

  /** Whether the provider supports thinking/reasoning tokens */
  supportsThinking: boolean;

  /** Maximum context length in tokens */
  maxTokens: number;

  /** Whether streaming is supported */
  supportsStreaming: boolean;

  /** Cost per token (if known) */
  costPerToken?: {
    input: number;
    output: number;
    reasoning?: number;
  };

  /** Additional provider-specific capabilities */
  extensions?: Record<string, boolean | number | string>;
}

/**
 * Structured usage metadata for OpenAI responses.
 */
export interface OpenAIUsageMetadata {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
    audio_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
    audio_tokens?: number;
    accepted_prediction_tokens?: number;
    rejected_prediction_tokens?: number;
  };
}

/**
 * Structured usage metadata for Gemini responses.
 */
export interface GeminiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  cachedContentTokenCount?: number;
}

/**
 * Structured usage metadata for Anthropic responses.
 */
export interface AnthropicUsageMetadata {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * Union type for all usage metadata formats.
 */
export type UsageMetadata =
  | OpenAIUsageMetadata
  | GeminiUsageMetadata
  | AnthropicUsageMetadata;

/**
 * Tool call arguments with proper typing.
 */
export interface ToolArguments {
  [key: string]:
    | string
    | number
    | boolean
    | null
    | ToolArguments
    | ToolArguments[];
}

/**
 * Tool call definition with structured arguments.
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: ToolArguments;
}

/**
 * Tool execution result.
 */
export interface ToolResult {
  toolCallId: string;
  result: string;
  isError?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Message interface with proper typing.
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Provider response with structured usage information.
 */
export interface ProviderResponse {
  content: string;
  tokensUsed?: number;
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  toolCalls?: ToolCall[];
  usage?: UsageMetadata;
  metadata?: Record<string, unknown>;
}

/**
 * Streaming response with structured information.
 */
export interface StreamResponse {
  content: string;
  done: boolean;
  tokensUsed?: number;
  toolCalls?: ToolCall[];
  usage?: UsageMetadata;
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  metadata?: Record<string, unknown>;
}

/**
 * Model information with structured capabilities.
 */
export interface ModelInfo {
  name: string;
  contextLength: number;
  supportedFeatures: string[];
  capabilities: ProviderCapabilities;
  description?: string;
  version?: string;
  deprecated?: boolean;
}

/**
 * Provider health check result.
 */
export interface HealthCheckResult {
  healthy: boolean;
  latencyMs?: number;
  version?: string;
  error?: StructuredError;
  timestamp: Date;
}

/**
 * Provider authentication status.
 */
export interface AuthenticationStatus {
  authenticated: boolean;
  method?: 'api_key' | 'oauth' | 'aws_credentials' | 'service_account';
  expiresAt?: Date;
  scopes?: string[];
  error?: StructuredError;
}

/**
 * Configuration validation result.
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  warnings: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

/**
 * Type guards for provider configurations.
 */
export function isOpenAIConfig(config: ProviderConfig): config is OpenAIConfig {
  return config.type === 'openai';
}

export function isAnthropicConfig(
  config: ProviderConfig
): config is AnthropicConfig {
  return config.type === 'anthropic';
}

export function isAzureConfig(config: ProviderConfig): config is AzureConfig {
  return config.type === 'azure';
}

export function isGeminiConfig(config: ProviderConfig): config is GeminiConfig {
  return config.type === 'gemini';
}

export function isBedrockConfig(
  config: ProviderConfig
): config is BedrockConfig {
  return config.type === 'bedrock';
}

export function isOllamaConfig(config: ProviderConfig): config is OllamaConfig {
  return config.type === 'ollama';
}

/**
 * Type guards for usage metadata.
 */
export function isOpenAIUsage(
  usage: UsageMetadata
): usage is OpenAIUsageMetadata {
  return 'prompt_tokens' in usage && 'completion_tokens' in usage;
}

export function isGeminiUsage(
  usage: UsageMetadata
): usage is GeminiUsageMetadata {
  return 'promptTokenCount' in usage && 'candidatesTokenCount' in usage;
}

export function isAnthropicUsage(
  usage: UsageMetadata
): usage is AnthropicUsageMetadata {
  return 'input_tokens' in usage && 'output_tokens' in usage;
}
