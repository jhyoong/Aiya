import { BaseProviderCollector, ConnectionTestResult } from './base.js';
import { ExtendedProviderConfig } from '../manager.js';
import { ConnectionTester } from '../testing.js';
import { CapabilityManager } from '../CapabilityManager.js';

export class GeminiCollector extends BaseProviderCollector {
  private connectionTester: ConnectionTester;

  constructor(options = {}) {
    super('gemini', options);
    this.connectionTester = new ConnectionTester();
  }

  async collectConfig(): Promise<ExtendedProviderConfig> {
    const config = this.collectConfigWithApiKey('gemini', 'GEMINI_API_KEY');

    // Add Gemini-specific configurations
    if (!config.gemini) {
      config.gemini = {
        location: this.options.existingConfig?.gemini?.location || 'us-central1',
        maxTokens: 8192,
        thinkingBudget: 20000,
        includeThoughts: true,
      };
    }

    return config;
  }

  async validateConfig(config: ExtendedProviderConfig): Promise<boolean> {
    if (!this.validateBasicConfig(config)) {
      return false;
    }

    // API key is required for Gemini
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      return false;
    }

    return true;
  }

  async testConnection(
    config: ExtendedProviderConfig
  ): Promise<ConnectionTestResult> {
    return this.testConnectionWithValidation(
      config,
      this.connectionTester.testGemini.bind(this.connectionTester),
      ['Check model name and API key']
    );
  }

  async getAvailableModels(
    config: Partial<ExtendedProviderConfig>
  ): Promise<string[]> {
    return this.getModelsFromCapabilityManager('gemini', config);
  }

  getDefaultConfig(): Partial<ExtendedProviderConfig> {
    const defaultConfig = this.getDefaultConfigWithApiKey('gemini', 'GEMINI_API_KEY');

    return {
      ...defaultConfig,
      gemini: {
        location: 'us-central1',
        maxTokens: 8192,
        thinkingBudget: 20000,
        includeThoughts: true,
      },
    };
  }

  getHelpText(): string {
    return CapabilityManager.getHelpText('gemini');
  }

  getModelDescriptions(): Record<string, string> {
    return CapabilityManager.getModelDescriptions('gemini');
  }

  getContextLengthInfo(): Record<string, number> {
    return CapabilityManager.getContextLengthInfo('gemini');
  }

  getThinkingOptions(): Array<{ label: string; value: boolean }> {
    return CapabilityManager.getThinkingOptions('gemini') || [];
  }

  getThinkingBudgetOptions(): Array<{ label: string; value: number }> {
    return CapabilityManager.getThinkingBudgetOptions('gemini') || [];
  }

  getLocationOptions(): Array<{ label: string; value: string }> {
    return [
      { label: 'US Central (us-central1)', value: 'us-central1' },
      { label: 'US East (us-east1)', value: 'us-east1' },
      { label: 'Europe West (europe-west1)', value: 'europe-west1' },
      { label: 'Asia Pacific (asia-southeast1)', value: 'asia-southeast1' },
    ];
  }
}
