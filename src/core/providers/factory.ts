import { LLMProvider, ProviderConfig } from './base.js';
import { OllamaProvider } from './ollama.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { AzureOpenAIProvider } from './azure.js';
import { GeminiProvider } from './gemini.js';
import { BedrockProvider } from './bedrock.js';
import { ExtendedProviderConfig } from '../config/manager.js';
import { ConfigValidationResult } from '../../types/ProviderTypes.js';

export class ProviderFactory {
  private static providers: Map<
    string,
    new (config: ProviderConfig) => LLMProvider
  > = new Map();

  static register(
    type: string,
    providerClass: new (config: ProviderConfig) => LLMProvider
  ): void {
    this.providers.set(type, providerClass);
  }

  static create(config: ExtendedProviderConfig): LLMProvider {
    const ProviderClass = this.providers.get(config.type);

    if (!ProviderClass) {
      throw new Error(
        `Provider type '${config.type}' not found. Available providers: ${Array.from(this.providers.keys()).join(', ')}`
      );
    }

    // Validate configuration before processing
    const validationResult = this.validateConfig(config);
    if (!validationResult.valid) {
      const errorMessages = validationResult.errors
        .map(err => `${err.field}: ${err.message}`)
        .join(', ');
      throw new Error(`Invalid provider configuration: ${errorMessages}`);
    }

    // Convert ExtendedProviderConfig to base ProviderConfig with proper validation
    const baseConfig: ProviderConfig = this.convertToBaseConfig(config);

    return new ProviderClass(baseConfig);
  }

  /**
   * Validates provider configuration structure and required fields.
   */
  static validateConfig(
    config: ExtendedProviderConfig
  ): ConfigValidationResult {
    const errors: Array<{ field: string; message: string; code: string }> = [];
    const warnings: Array<{ field: string; message: string; code: string }> =
      [];

    // Basic validation - only validate truly required fields
    if (!config.type) {
      errors.push({
        field: 'type',
        message: 'Provider type is required',
        code: 'REQUIRED',
      });
    }

    if (!config.model) {
      errors.push({
        field: 'model',
        message: 'Model name is required',
        code: 'REQUIRED',
      });
    }

    // baseUrl is not always required - some providers have defaults
    // Empty string baseUrl is acceptable (means use provider defaults)

    // Provider-specific validation - only validate truly critical fields that would cause runtime failures
    switch (config.type) {
      case 'bedrock':
        // Bedrock absolutely requires region for AWS client initialization
        if (!config.bedrock?.region) {
          errors.push({
            field: 'bedrock.region',
            message: 'AWS region is required for Bedrock',
            code: 'REQUIRED',
          });
        }
        break;

      // For other providers, let them handle their own validation in constructors
      // This preserves existing behavior and allows for more flexible configurations
      default:
        // No additional validation - providers can handle their own requirements
        break;
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Converts ExtendedProviderConfig to base ProviderConfig with type safety.
   */
  private static convertToBaseConfig(
    config: ExtendedProviderConfig
  ): ProviderConfig {
    const baseConfig: ProviderConfig = {
      type: config.type,
      model: config.model,
      baseUrl: config.baseUrl || '', // Provide default empty string if not specified
      ...(config.apiKey && { apiKey: config.apiKey }),
      ...(config.capabilities?.maxTokens && {
        maxTokens: config.capabilities.maxTokens,
      }),
      ...(config.anthropic?.maxTokens && {
        maxTokens: config.anthropic.maxTokens,
      }),
    };

    // Add provider-specific configurations with type safety
    const extendedConfig = baseConfig as ProviderConfig;
    if (config.azure) {
      extendedConfig.azure = config.azure;
    }
    if (config.anthropic) {
      extendedConfig.anthropic = config.anthropic;
    }
    if (config.gemini) {
      extendedConfig.gemini = config.gemini;
    }
    if (config.bedrock) {
      extendedConfig.bedrock = config.bedrock;
    }

    return extendedConfig;
  }

  static getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  static isProviderRegistered(type: string): boolean {
    return this.providers.has(type);
  }
}

// Register default providers
ProviderFactory.register('ollama', OllamaProvider);
ProviderFactory.register('openai', OpenAIProvider);
ProviderFactory.register('anthropic', AnthropicProvider);
ProviderFactory.register('azure', AzureOpenAIProvider);
ProviderFactory.register('gemini', GeminiProvider);
ProviderFactory.register('bedrock', BedrockProvider);
