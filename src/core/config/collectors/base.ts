import { ExtendedProviderConfig } from '../manager.js';
import {
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_CAPABILITIES_DESCRIPTIONS,
} from '../constants.js';
import { CapabilityManager } from '../CapabilityManager.js';
import type { ProviderModels } from '../models.js';

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  suggestions?: string[];
}

export interface CollectorOptions {
  skipValidation?: boolean;
  existingConfig?: ExtendedProviderConfig;
}

export abstract class BaseProviderCollector {
  protected providerType: ExtendedProviderConfig['type'];
  protected options: CollectorOptions;

  constructor(
    providerType: ExtendedProviderConfig['type'],
    options: CollectorOptions = {}
  ) {
    this.providerType = providerType;
    this.options = options;
  }

  /**
   * Collect configuration from user input
   */
  abstract collectConfig(): Promise<ExtendedProviderConfig>;

  /**
   * Validate the collected configuration
   */
  abstract validateConfig(config: ExtendedProviderConfig): Promise<boolean>;

  /**
   * Test connection to the provider
   */
  abstract testConnection(
    config: ExtendedProviderConfig
  ): Promise<ConnectionTestResult>;

  /**
   * Get available models for the provider
   */
  abstract getAvailableModels(
    config: Partial<ExtendedProviderConfig>
  ): Promise<string[]>;

  /**
   * Get default configuration for the provider
   */
  abstract getDefaultConfig(): Partial<ExtendedProviderConfig>;

  /**
   * Get provider-specific help text
   */
  abstract getHelpText(): string;

  /**
   * Get provider display name
   */
  getDisplayName(): string {
    return PROVIDER_DISPLAY_NAMES[this.providerType] || this.providerType;
  }

  /**
   * Get provider capabilities description
   */
  getCapabilitiesDescription(): string {
    return (
      PROVIDER_CAPABILITIES_DESCRIPTIONS[this.providerType] ||
      'Provider-specific capabilities'
    );
  }

  /**
   * Common validation pattern for collecting config with API key from environment
   */
  protected collectConfigWithApiKey(
    providerType: string,
    envVarName: string
  ): ExtendedProviderConfig {
    const apiKey =
      this.options.existingConfig?.apiKey || process.env[envVarName];
    const existingConfig = {
      ...this.options.existingConfig,
      ...(apiKey && { apiKey }),
    };

    return CapabilityManager.getDefaultConfig(
      providerType as keyof ProviderModels,
      existingConfig
    );
  }

  /**
   * Common validation pattern for basic config fields
   */
  protected validateBasicConfig(config: ExtendedProviderConfig): boolean {
    // Validate required model field
    if (!config.model || config.model.trim().length === 0) {
      return false;
    }
    return true;
  }

  /**
   * Common test connection pattern with validation
   */
  protected async testConnectionWithValidation(
    config: ExtendedProviderConfig,
    testMethod: (
      config: ExtendedProviderConfig
    ) => Promise<ConnectionTestResult>,
    errorSuggestions: string[] = ['Check configuration']
  ): Promise<ConnectionTestResult> {
    if (!this.options.skipValidation) {
      const isValid = await this.validateConfig(config);
      if (!isValid) {
        return {
          success: false,
          error: 'Invalid configuration',
          suggestions: errorSuggestions,
        };
      }
    }

    return testMethod(config);
  }

  /**
   * Common pattern for getting available models
   */
  protected async getModelsFromCapabilityManager(
    providerType: string,
    config: Partial<ExtendedProviderConfig>
  ): Promise<string[]> {
    return await CapabilityManager.getAvailableModelsWithFetching(
      providerType as keyof ProviderModels,
      config
    );
  }

  /**
   * Common pattern for getting default config with API key
   */
  protected getDefaultConfigWithApiKey(
    providerType: string,
    envVarName: string
  ): Partial<ExtendedProviderConfig> {
    const apiKey = process.env[envVarName];
    const defaultConfig = CapabilityManager.getDefaultConfig(
      providerType as keyof ProviderModels
    );

    return {
      ...defaultConfig,
      ...(apiKey && { apiKey }),
    };
  }

  /**
   * Common validation helper for API keys
   */
  protected validateApiKey(apiKey: string, prefix?: string): boolean {
    if (!apiKey || apiKey.trim().length === 0) {
      return false;
    }

    if (prefix && !apiKey.startsWith(prefix)) {
      return false;
    }

    return true;
  }

  /**
   * Common validation helper for URLs
   */
  protected validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Common error handling helper
   */
  protected handleConnectionError(error: any): ConnectionTestResult {
    const errorMessage = error?.message || 'Unknown error occurred';

    if (errorMessage.includes('ECONNREFUSED')) {
      return {
        success: false,
        error: 'Connection refused',
        suggestions: [
          'Check if the service is running',
          'Verify the endpoint URL is correct',
          'Check firewall and network settings',
        ],
      };
    }

    if (errorMessage.includes('ENOTFOUND')) {
      return {
        success: false,
        error: 'Host not found',
        suggestions: [
          'Check if the hostname is correct',
          'Verify DNS resolution',
          'Check internet connectivity',
        ],
      };
    }

    if (errorMessage.includes('401') || errorMessage.includes('403')) {
      return {
        success: false,
        error: 'Authentication failed',
        suggestions: [
          'Check if the API key is correct',
          'Verify API key permissions',
          'Check if the API key is active',
        ],
      };
    }

    return {
      success: false,
      error: errorMessage,
      suggestions: ['Check the error details and try again'],
    };
  }
}
