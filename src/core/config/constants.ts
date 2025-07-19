/**
 * Provider Configuration Constants
 *
 * Consolidated constants to eliminate duplication across CapabilityManager,
 * ModelRegistry, and BaseProviderCollector.
 */

export const PROVIDER_DISPLAY_NAMES = {
  ollama: 'Ollama - Local AI models',
  openai: 'OpenAI - GPT models',
  gemini: 'Google Gemini - Gemini models',
  anthropic: 'Anthropic - Claude models',
  azure: 'Azure OpenAI - Enterprise GPT',
  bedrock: 'AWS Bedrock - Various models',
} as const;

export const PROVIDER_CAPABILITIES_DESCRIPTIONS = {
  ollama: 'Free, runs locally, good for development',
  openai: 'Paid API, state-of-the-art models, function calling',
  gemini: 'Paid API, large context windows, vision support, thinking mode',
  anthropic: 'Paid API, 200K context, thinking mode',
  azure: 'Enterprise deployment, custom models',
  bedrock: 'AWS managed, multiple model providers',
} as const;

export type ProviderType = keyof typeof PROVIDER_DISPLAY_NAMES;
