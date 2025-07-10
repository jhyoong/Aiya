import { ExtendedProviderConfig } from '../manager.js';

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

  constructor(providerType: ExtendedProviderConfig['type'], options: CollectorOptions = {}) {
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
  abstract testConnection(config: ExtendedProviderConfig): Promise<ConnectionTestResult>;

  /**
   * Get available models for the provider
   */
  abstract getAvailableModels(config: Partial<ExtendedProviderConfig>): Promise<string[]>;

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
    const displayNames = {
      ollama: 'Ollama - Local AI models',
      openai: 'OpenAI - GPT models',
      gemini: 'Google Gemini - Gemini models',
      anthropic: 'Anthropic - Claude models',
      azure: 'Azure OpenAI - Enterprise GPT',
      bedrock: 'AWS Bedrock - Various models'
    };
    return displayNames[this.providerType] || this.providerType;
  }

  /**
   * Get provider capabilities description
   */
  getCapabilitiesDescription(): string {
    const capabilities = {
      ollama: 'Free, runs locally, good for development',
      openai: 'Paid API, state-of-the-art models, function calling',
      gemini: 'Paid API, large context windows, vision support',
      anthropic: 'Paid API, 200K context, thinking mode',
      azure: 'Enterprise deployment, custom models',
      bedrock: 'AWS managed, multiple model providers'
    };
    return capabilities[this.providerType] || 'Provider-specific capabilities';
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
          'Check firewall and network settings'
        ]
      };
    }
    
    if (errorMessage.includes('ENOTFOUND')) {
      return {
        success: false,
        error: 'Host not found',
        suggestions: [
          'Check if the hostname is correct',
          'Verify DNS resolution',
          'Check internet connectivity'
        ]
      };
    }
    
    if (errorMessage.includes('401') || errorMessage.includes('403')) {
      return {
        success: false,
        error: 'Authentication failed',
        suggestions: [
          'Check if the API key is correct',
          'Verify API key permissions',
          'Check if the API key is active'
        ]
      };
    }
    
    return {
      success: false,
      error: errorMessage,
      suggestions: ['Check the error details and try again']
    };
  }
}