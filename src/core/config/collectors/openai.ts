import { BaseProviderCollector, ConnectionTestResult } from './base.js';
import { ExtendedProviderConfig } from '../manager.js';
import { ConnectionTester } from '../testing.js';
import { CapabilityManager } from '../CapabilityManager.js';

export class OpenAICollector extends BaseProviderCollector {
  private connectionTester: ConnectionTester;

  constructor(options = {}) {
    super('openai', options);
    this.connectionTester = new ConnectionTester();
  }

  async collectConfig(): Promise<ExtendedProviderConfig> {
    const apiKey = this.options.existingConfig?.apiKey || process.env.OPENAI_API_KEY;
    const existingConfig = {
      ...this.options.existingConfig,
      ...(apiKey && { apiKey })
    };
    
    return CapabilityManager.getDefaultConfig('openai', existingConfig);
  }

  async validateConfig(config: ExtendedProviderConfig): Promise<boolean> {
    // Validate required fields
    if (!config.model || config.model.trim().length === 0) {
      return false;
    }

    // API key validation (optional for some custom endpoints)
    if (config.apiKey && !CapabilityManager.validateApiKey('openai', config.apiKey)) {
      return false;
    }

    // Base URL validation (optional, defaults to OpenAI API)
    if (config.baseUrl && !this.validateUrl(config.baseUrl)) {
      return false;
    }

    return true;
  }

  async testConnection(config: ExtendedProviderConfig): Promise<ConnectionTestResult> {
    if (!this.options.skipValidation) {
      const isValid = await this.validateConfig(config);
      if (!isValid) {
        return {
          success: false,
          error: 'Invalid configuration',
          suggestions: ['Check model name and API key format']
        };
      }
    }

    return this.connectionTester.testOpenAI(config);
  }

  async getAvailableModels(config: Partial<ExtendedProviderConfig>): Promise<string[]> {
    return await CapabilityManager.getAvailableModelsWithFetching('openai', config);
  }

  getDefaultConfig(): Partial<ExtendedProviderConfig> {
    const apiKey = process.env.OPENAI_API_KEY;
    const defaultConfig = CapabilityManager.getDefaultConfig('openai');
    
    return {
      ...defaultConfig,
      ...(apiKey && { apiKey })
    };
  }

  getHelpText(): string {
    return CapabilityManager.getHelpText('openai');
  }

  getModelDescriptions(): Record<string, string> {
    return CapabilityManager.getModelDescriptions('openai');
  }

  getContextLengthInfo(): Record<string, number> {
    return CapabilityManager.getContextLengthInfo('openai');
  }

  getCostInfo(): Record<string, {input: number; output: number}> {
    return CapabilityManager.getCostInfo('openai');
  }
}