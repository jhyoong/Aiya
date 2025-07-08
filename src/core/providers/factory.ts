import { LLMProvider, ProviderConfig } from './base.js';
import { OllamaProvider } from './ollama.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { AzureOpenAIProvider } from './azure.js';
import { GeminiProvider } from './gemini.js';
import { BedrockProvider } from './bedrock.js';
import { ExtendedProviderConfig } from '../config/manager.js';

export class ProviderFactory {
  private static providers: Map<string, new (config: ProviderConfig) => LLMProvider> = new Map();
  
  static register(type: string, providerClass: new (config: ProviderConfig) => LLMProvider): void {
    this.providers.set(type, providerClass);
  }
  
  static create(config: ExtendedProviderConfig): LLMProvider {
    const ProviderClass = this.providers.get(config.type);
    
    if (!ProviderClass) {
      throw new Error(`Provider type '${config.type}' not found. Available providers: ${Array.from(this.providers.keys()).join(', ')}`);
    }
    
    // Convert ExtendedProviderConfig to base ProviderConfig
    const baseConfig: ProviderConfig = {
      type: config.type,
      model: config.model,
      baseUrl: config.baseUrl,
      ...(config.apiKey && { apiKey: config.apiKey }),
      ...(config.capabilities?.maxTokens && { maxTokens: config.capabilities.maxTokens }),
      ...(config.anthropic?.maxTokens && { maxTokens: config.anthropic.maxTokens }),
      // Include any additional provider-specific config
      ...(config.azure && { azure: config.azure }),
      ...(config.anthropic && { anthropic: config.anthropic }),
      ...(config.gemini && { gemini: config.gemini }),
      ...(config.bedrock && { bedrock: config.bedrock })
    };
    
    return new ProviderClass(baseConfig);
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