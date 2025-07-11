import { BaseProviderCollector, ConnectionTestResult } from './base.js';
import { ExtendedProviderConfig } from '../manager.js';
import { ConnectionTester } from '../testing.js';
import { CapabilityManager } from '../CapabilityManager.js';

export class OllamaCollector extends BaseProviderCollector {
  private connectionTester: ConnectionTester;

  constructor(options = {}) {
    super('ollama', options);
    this.connectionTester = new ConnectionTester();
  }

  async collectConfig(): Promise<ExtendedProviderConfig> {
    return CapabilityManager.getDefaultConfig(
      'ollama',
      this.options.existingConfig
    );
  }

  async validateConfig(config: ExtendedProviderConfig): Promise<boolean> {
    // Validate required fields
    if (!config.model || config.model.trim().length === 0) {
      return false;
    }

    if (!config.baseUrl || !this.validateUrl(config.baseUrl)) {
      return false;
    }

    return true;
  }

  async testConnection(
    config: ExtendedProviderConfig
  ): Promise<ConnectionTestResult> {
    if (!this.options.skipValidation) {
      const isValid = await this.validateConfig(config);
      if (!isValid) {
        return {
          success: false,
          error: 'Invalid configuration',
          suggestions: ['Check model name and base URL'],
        };
      }
    }

    return this.connectionTester.testOllama(config);
  }

  async getAvailableModels(
    config: Partial<ExtendedProviderConfig>
  ): Promise<string[]> {
    return await CapabilityManager.getAvailableModelsWithFetching(
      'ollama',
      config
    );
  }

  getDefaultConfig(): Partial<ExtendedProviderConfig> {
    return CapabilityManager.getDefaultConfig('ollama');
  }

  getHelpText(): string {
    return CapabilityManager.getHelpText('ollama');
  }

  getContextLengthOptions(): Array<{ label: string; value: number }> {
    return CapabilityManager.getContextLengthOptions('ollama');
  }

  getModelDescriptions(): Record<string, string> {
    return CapabilityManager.getModelDescriptions('ollama');
  }
}
