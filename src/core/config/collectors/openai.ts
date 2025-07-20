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
    return this.collectConfigWithApiKey('openai', 'OPENAI_API_KEY');
  }

  async validateConfig(config: ExtendedProviderConfig): Promise<boolean> {
    if (!this.validateBasicConfig(config)) {
      return false;
    }

    // API key validation (optional for some custom endpoints)
    if (
      config.apiKey &&
      !CapabilityManager.validateApiKey('openai', config.apiKey)
    ) {
      return false;
    }

    // Base URL validation (optional, defaults to OpenAI API)
    if (config.baseUrl && !this.validateUrl(config.baseUrl)) {
      return false;
    }

    return true;
  }

  async testConnection(
    config: ExtendedProviderConfig
  ): Promise<ConnectionTestResult> {
    return this.testConnectionWithValidation(
      config,
      this.connectionTester.testOpenAI.bind(this.connectionTester),
      ['Check model name and API key format']
    );
  }

  async getAvailableModels(
    config: Partial<ExtendedProviderConfig>
  ): Promise<string[]> {
    return this.getModelsFromCapabilityManager('openai', config);
  }

  getDefaultConfig(): Partial<ExtendedProviderConfig> {
    return this.getDefaultConfigWithApiKey('openai', 'OPENAI_API_KEY');
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

  getCostInfo(): Record<string, { input: number; output: number }> {
    return CapabilityManager.getCostInfo('openai');
  }
}
