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
    if (!this.validateBasicConfig(config)) {
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
    return this.testConnectionWithValidation(
      config,
      this.connectionTester.testOllama.bind(this.connectionTester),
      ['Check model name and base URL']
    );
  }

  async getAvailableModels(
    config: Partial<ExtendedProviderConfig>
  ): Promise<string[]> {
    return this.getModelsFromCapabilityManager('ollama', config);
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
