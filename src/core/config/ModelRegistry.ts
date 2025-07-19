/**
 * Unified Model Registry - Single interface for all model operations
 * This class consolidates model information and provides dynamic model discovery
 */

import {
  ProviderModels,
  ModelMetadata,
  ProviderDefaults,
  PROVIDER_REGISTRY,
  getModelMetadata,
  getModelNames,
  getProviderDefaults,
} from './models.js';
import { ExtendedProviderConfig } from './manager.js';

export class ModelRegistry {
  /**
   * Get provider defaults
   */
  static getProviderDefaults(
    providerType: keyof ProviderModels
  ): ProviderDefaults {
    return getProviderDefaults(providerType);
  }

  /**
   * Get model metadata for a specific provider and model
   */
  static getModelMetadata(
    providerType: keyof ProviderModels,
    modelName: string
  ): ModelMetadata | undefined {
    return getModelMetadata(providerType, modelName);
  }

  /**
   * Get available models for a provider (static list)
   */
  static getAvailableModels(providerType: keyof ProviderModels): string[] {
    return getModelNames(providerType);
  }

  /**
   * Get available models with dynamic fetching (enhanced API)
   */
  static async getAvailableModelsWithFetching(
    providerType: keyof ProviderModels,
    config?: Partial<ExtendedProviderConfig>
  ): Promise<string[]> {
    const defaultModels = this.getAvailableModels(providerType);

    if (!config) {
      return defaultModels;
    }

    try {
      switch (providerType) {
        case 'ollama':
          return await this.fetchOllamaModels(config, defaultModels);
        case 'openai':
          return await this.fetchOpenAIModels(config, defaultModels);
        case 'gemini':
          return await this.fetchGeminiModels(config, defaultModels);
        default:
          return defaultModels;
      }
    } catch {
      return defaultModels;
    }
  }

  /**
   * Validate if a model exists for a provider
   */
  static validateModelExists(
    providerType: keyof ProviderModels,
    modelName: string
  ): boolean {
    const metadata = this.getModelMetadata(providerType, modelName);
    return metadata !== undefined;
  }

  /**
   * Get provider registry (all providers and their models)
   */
  static getProviderRegistry() {
    return PROVIDER_REGISTRY;
  }

  /**
   * Get all supported provider types
   */
  static getSupportedProviders(): Array<keyof ProviderModels> {
    return Object.keys(PROVIDER_REGISTRY) as Array<keyof ProviderModels>;
  }

  /**
   * Get provider display information
   */
  static getProviderDisplayInfo(providerType: keyof ProviderModels) {
    const registry = PROVIDER_REGISTRY[providerType];
    if (!registry) {
      throw new Error(`Provider ${providerType} not found in registry`);
    }
    const defaults = registry.defaults;

    return {
      type: providerType,
      displayName: this.getDisplayName(providerType),
      description: this.getCapabilitiesDescription(providerType),
      requiresApiKey: defaults.requiresApiKey,
      defaultModel: defaults.model,
      helpText: defaults.helpText,
    };
  }

  /**
   * Search models by name or description
   */
  static searchModels(
    providerType: keyof ProviderModels,
    searchTerm: string
  ): ModelMetadata[] {
    const registry = PROVIDER_REGISTRY[providerType];
    if (!registry) {
      return [];
    }
    const searchLower = searchTerm.toLowerCase();

    return registry.models.filter(
      model =>
        model.name.toLowerCase().includes(searchLower) ||
        model.description.toLowerCase().includes(searchLower)
    );
  }

  /**
   * Get models by capability
   */
  static getModelsByCapability(
    providerType: keyof ProviderModels,
    capability: keyof ModelMetadata['capabilities']
  ): ModelMetadata[] {
    const registry = PROVIDER_REGISTRY[providerType];
    if (!registry) {
      return [];
    }

    return registry.models.filter(
      model => model.capabilities[capability] === true
    );
  }

  /**
   * Get models within context length range
   */
  static getModelsByContextLength(
    providerType: keyof ProviderModels,
    minLength: number,
    maxLength?: number
  ): ModelMetadata[] {
    const registry = PROVIDER_REGISTRY[providerType];
    if (!registry) {
      return [];
    }

    return registry.models.filter(model => {
      const contextLength = model.contextLength;
      const meetsMin = contextLength >= minLength;
      const meetsMax = maxLength ? contextLength <= maxLength : true;
      return meetsMin && meetsMax;
    });
  }

  /**
   * Get models sorted by cost (cheapest first)
   */
  static getModelsSortedByCost(
    providerType: keyof ProviderModels
  ): ModelMetadata[] {
    const registry = PROVIDER_REGISTRY[providerType];
    if (!registry) {
      return [];
    }

    return [...registry.models].sort((a, b) => {
      const aCost = a.costPerToken?.input || 0;
      const bCost = b.costPerToken?.input || 0;
      return aCost - bCost;
    });
  }

  // Private helper methods

  private static async fetchOllamaModels(
    config: Partial<ExtendedProviderConfig>,
    defaultModels: string[]
  ): Promise<string[]> {
    if (!config.baseUrl) {
      return defaultModels;
    }

    try {
      const response = await fetch(`${config.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return defaultModels;
      }

      const data = await response.json();
      const availableModels = data.models?.map((m: any) => m.name) || [];

      // Combine with defaults, removing duplicates
      return [...new Set([...availableModels, ...defaultModels])];
    } catch {
      return defaultModels;
    }
  }

  private static async fetchOpenAIModels(
    config: Partial<ExtendedProviderConfig>,
    defaultModels: string[]
  ): Promise<string[]> {
    if (!config.apiKey) {
      return defaultModels;
    }

    try {
      const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return defaultModels;
      }

      const data = await response.json();
      const availableModels =
        data.data
          ?.filter(
            (m: any) => m.id.startsWith('gpt-') && !m.id.includes('instruct')
          )
          .map((m: any) => m.id) || [];

      // Combine with defaults, removing duplicates and sorting
      return [...new Set([...availableModels, ...defaultModels])].sort();
    } catch {
      return defaultModels;
    }
  }

  private static async fetchGeminiModels(
    config: Partial<ExtendedProviderConfig>,
    defaultModels: string[]
  ): Promise<string[]> {
    if (!config.apiKey) {
      return defaultModels;
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${config.apiKey}`,
        {
          signal: AbortSignal.timeout(5000),
        }
      );

      if (!response.ok) {
        return defaultModels;
      }

      const data = await response.json();
      const availableModels =
        data.models
          ?.filter((m: any) =>
            m.supportedGenerationMethods?.includes('generateContent')
          )
          .map((m: any) => m.name.split('/').pop()) || [];

      // Combine with defaults, removing duplicates and sorting
      return [...new Set([...availableModels, ...defaultModels])].sort();
    } catch {
      return defaultModels;
    }
  }

  private static getDisplayName(providerType: keyof ProviderModels): string {
    // Import moved to avoid circular dependency
    const { PROVIDER_DISPLAY_NAMES } = require('./constants.js');
    return PROVIDER_DISPLAY_NAMES[providerType] || providerType;
  }

  private static getCapabilitiesDescription(
    providerType: keyof ProviderModels
  ): string {
    // Import moved to avoid circular dependency
    const { PROVIDER_CAPABILITIES_DESCRIPTIONS } = require('./constants.js');
    return (
      PROVIDER_CAPABILITIES_DESCRIPTIONS[providerType] ||
      'Provider-specific capabilities'
    );
  }
}
