/**
 * Centralized capability management for all AI providers
 * This class eliminates duplication by providing a single source for provider capabilities
 */

import {
  ProviderDefaults,
  ProviderCapabilities,
  getProviderDefaults,
  getProviderCapabilities,
  getModelMetadata,
  getModelCapabilities,
  getModelNames,
  createDefaultConfig,
  ProviderModels,
} from './models.js';
import { ExtendedProviderConfig } from './manager.js';

export class CapabilityManager {
  /**
   * Get default configuration for a provider
   */
  static getDefaultConfig(
    providerType: keyof ProviderModels,
    existingConfig?: Partial<ExtendedProviderConfig>
  ): ExtendedProviderConfig {
    const defaults = getProviderDefaults(providerType);
    const defaultConfig = createDefaultConfig(providerType);

    const config: ExtendedProviderConfig = {
      type: providerType as ExtendedProviderConfig['type'],
      model: existingConfig?.model || defaults.model,
      baseUrl: existingConfig?.baseUrl || defaults.baseUrl || '',
      capabilities: {
        maxTokens: defaults.capabilities.maxTokens,
        supportsFunctionCalling: defaults.capabilities.supportsFunctionCalling,
        supportsVision: defaults.capabilities.supportsVision,
        supportsStreaming: defaults.capabilities.supportsStreaming,
        supportsThinking: defaults.capabilities.supportsThinking,
      },
      ...defaultConfig,
    };

    // Apply existing configuration overrides
    if (existingConfig) {
      Object.assign(config, existingConfig);
    }

    // Ensure capabilities are always present
    if (!config.capabilities) {
      config.capabilities = {
        maxTokens: defaults.capabilities.maxTokens,
        supportsFunctionCalling: defaults.capabilities.supportsFunctionCalling,
        supportsVision: defaults.capabilities.supportsVision,
        supportsStreaming: defaults.capabilities.supportsStreaming,
        supportsThinking: defaults.capabilities.supportsThinking,
      };
    }

    return config;
  }

  /**
   * Get capabilities for a specific provider and model
   */
  static getCapabilities(
    providerType: keyof ProviderModels,
    modelName?: string
  ): ProviderCapabilities {
    if (modelName) {
      // Get model-specific capabilities
      const modelCapabilities = getModelCapabilities(providerType, modelName);
      return {
        supportsFunctionCalling: modelCapabilities.supportsFunctionCalling,
        supportsVision: modelCapabilities.supportsVision,
        supportsStreaming: modelCapabilities.supportsStreaming,
        supportsThinking: modelCapabilities.supportsThinking,
        maxTokens: modelCapabilities.contextLength,
      };
    }

    // Fall back to provider defaults
    return getProviderCapabilities(providerType);
  }

  /**
   * Get provider-specific defaults
   */
  static getProviderDefaults(
    providerType: keyof ProviderModels
  ): ProviderDefaults {
    return getProviderDefaults(providerType);
  }

  /**
   * Get help text for a provider
   */
  static getHelpText(providerType: keyof ProviderModels): string {
    return getProviderDefaults(providerType).helpText;
  }

  /**
   * Get context length options for a provider
   */
  static getContextLengthOptions(
    providerType: keyof ProviderModels
  ): Array<{ label: string; value: number }> {
    const defaults = getProviderDefaults(providerType);

    if (defaults.contextLengthOptions) {
      return defaults.contextLengthOptions;
    }

    // Default context length options if none specified
    return [
      { label: '4K tokens (Standard)', value: 4096 },
      { label: '8K tokens (Extended)', value: 8192 },
      { label: '16K tokens (Large)', value: 16384 },
      { label: '32K tokens (Very Large)', value: 32768 },
    ];
  }

  /**
   * Get model descriptions for a provider
   */
  static getModelDescriptions(
    providerType: keyof ProviderModels
  ): Record<string, string> {
    const models = this.getAvailableModels(providerType);
    const descriptions: Record<string, string> = {};

    models.forEach(modelName => {
      const metadata = getModelMetadata(providerType, modelName);
      descriptions[modelName] =
        metadata?.description || `${modelName} - No description available`;
    });

    return descriptions;
  }

  /**
   * Get context length information for models
   */
  static getContextLengthInfo(
    providerType: keyof ProviderModels
  ): Record<string, number> {
    const models = this.getAvailableModels(providerType);
    const contextLengths: Record<string, number> = {};

    models.forEach(modelName => {
      const capabilities = getModelCapabilities(providerType, modelName);
      contextLengths[modelName] = capabilities.contextLength;
    });

    return contextLengths;
  }

  /**
   * Get cost information for models
   */
  static getCostInfo(
    providerType: keyof ProviderModels
  ): Record<string, { input: number; output: number }> {
    const models = this.getAvailableModels(providerType);
    const costs: Record<string, { input: number; output: number }> = {};

    models.forEach(modelName => {
      const metadata = getModelMetadata(providerType, modelName);
      if (metadata?.costPerToken) {
        costs[modelName] = metadata.costPerToken;
      }
    });

    return costs;
  }

  /**
   * Get available models for a provider
   */
  static getAvailableModels(providerType: keyof ProviderModels): string[] {
    // Delegate to ModelRegistry for unified model access
    return getModelNames(providerType);
  }

  /**
   * Get available models with dynamic fetching
   */
  static async getAvailableModelsWithFetching(
    providerType: keyof ProviderModels,
    _config?: Partial<ExtendedProviderConfig>
  ): Promise<string[]> {
    // This will delegate to ModelRegistry in the future
    // For now, use the static list
    return this.getAvailableModels(providerType);
  }

  /**
   * Validate if API key is required for a provider
   */
  static requiresApiKey(providerType: keyof ProviderModels): boolean {
    return getProviderDefaults(providerType).requiresApiKey;
  }

  /**
   * Get API key prefix for validation
   */
  static getApiKeyPrefix(
    providerType: keyof ProviderModels
  ): string | undefined {
    return getProviderDefaults(providerType).apiKeyPrefix;
  }

  /**
   * Validate API key format for a provider
   */
  static validateApiKey(
    providerType: keyof ProviderModels,
    apiKey: string
  ): boolean {
    if (!apiKey || apiKey.trim().length === 0) {
      return false;
    }

    const prefix = this.getApiKeyPrefix(providerType);
    if (prefix && !apiKey.startsWith(prefix)) {
      return false;
    }

    return true;
  }

  /**
   * Get provider display name
   */
  static getDisplayName(providerType: keyof ProviderModels): string {
    const displayNames = {
      ollama: 'Ollama - Local AI models',
      openai: 'OpenAI - GPT models',
      gemini: 'Google Gemini - Gemini models',
    };
    return displayNames[providerType] || providerType;
  }

  /**
   * Get provider capabilities description
   */
  static getCapabilitiesDescription(
    providerType: keyof ProviderModels
  ): string {
    const capabilities = {
      ollama: 'Free, runs locally, good for development',
      openai: 'Paid API, state-of-the-art models, function calling',
      gemini: 'Paid API, large context windows, vision support, thinking mode',
    };
    return capabilities[providerType] || 'Provider-specific capabilities';
  }

  /**
   * Create configuration with merged capabilities
   */
  static createConfigWithCapabilities(
    providerType: keyof ProviderModels,
    modelName: string,
    overrides: Partial<ExtendedProviderConfig> = {}
  ): ExtendedProviderConfig {
    const baseConfig = this.getDefaultConfig(providerType);
    const modelCapabilities = this.getCapabilities(providerType, modelName);

    return {
      ...baseConfig,
      model: modelName,
      capabilities: modelCapabilities,
      ...overrides,
    };
  }

  /**
   * Get thinking-specific options for providers that support it
   */
  static getThinkingOptions(
    providerType: keyof ProviderModels
  ): Array<{ label: string; value: boolean }> | null {
    const capabilities = this.getCapabilities(providerType);

    if (!capabilities.supportsThinking) {
      return null;
    }

    return [
      { label: 'Enable thinking mode (shows reasoning process)', value: true },
      { label: 'Disable thinking mode (faster responses)', value: false },
    ];
  }

  /**
   * Get thinking budget options for providers that support it
   */
  static getThinkingBudgetOptions(
    providerType: keyof ProviderModels
  ): Array<{ label: string; value: number }> | null {
    const capabilities = this.getCapabilities(providerType);

    if (!capabilities.supportsThinking) {
      return null;
    }

    return [
      { label: '10K tokens (Light thinking)', value: 10000 },
      { label: '20K tokens (Standard thinking)', value: 20000 },
      { label: '50K tokens (Deep thinking)', value: 50000 },
    ];
  }
}
