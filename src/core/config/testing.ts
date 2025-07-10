import { ExtendedProviderConfig } from './manager.js';
import { ConnectionTestResult } from './collectors/base.js';

export class ConnectionTester {
  private static readonly TIMEOUT_MS = 10000; // 10 seconds

  /**
   * Test connection to Ollama provider
   */
  async testOllama(config: ExtendedProviderConfig): Promise<ConnectionTestResult> {
    try {
      // Test /api/tags endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ConnectionTester.TIMEOUT_MS);
      
      const response = await fetch(`${config.baseUrl}/api/tags`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Check if the specified model exists
      const modelExists = data.models?.some((m: any) => m.name === config.model);
      
      if (!modelExists) {
        return {
          success: false,
          error: `Model ${config.model} not found`,
          suggestions: [
            `Run: ollama pull ${config.model}`,
            'Check available models with: ollama list',
            'Verify the model name is correct'
          ]
        };
      }
      
      return { success: true };
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Connection timeout',
          suggestions: [
            'Check if Ollama is running: ollama serve',
            'Verify the endpoint URL is correct',
            'Check network connectivity'
          ]
        };
      }
      
      if (error.message.includes('ECONNREFUSED')) {
        return {
          success: false,
          error: 'Connection refused',
          suggestions: [
            'Start Ollama: ollama serve',
            'Check if port 11434 is available',
            'Verify Ollama installation'
          ]
        };
      }
      
      return {
        success: false,
        error: error.message,
        suggestions: [
          'Check if Ollama is running',
          'Verify the endpoint URL',
          'Check firewall settings'
        ]
      };
    }
  }

  /**
   * Test connection to OpenAI provider
   */
  async testOpenAI(config: ExtendedProviderConfig): Promise<ConnectionTestResult> {
    try {
      if (!config.apiKey) {
        return {
          success: false,
          error: 'API key is required',
          suggestions: [
            'Set OPENAI_API_KEY environment variable',
            'Add apiKey to configuration',
            'Get API key from https://platform.openai.com/api-keys'
          ]
        };
      }
      
      // Test with minimal models endpoint call
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ConnectionTester.TIMEOUT_MS);
      
      const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 401) {
          return {
            success: false,
            error: 'Invalid API key',
            suggestions: [
              'Check if the API key is correct',
              'Verify API key starts with "sk-"',
              'Check OpenAI account billing status'
            ]
          };
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Check if the specified model exists
      const modelExists = data.data?.some((m: any) => m.id === config.model);
      
      if (!modelExists) {
        return {
          success: false,
          error: `Model ${config.model} not found`,
          suggestions: [
            'Check available models in OpenAI dashboard',
            'Verify the model name is correct',
            'Use standard models like "gpt-4" or "gpt-3.5-turbo"'
          ]
        };
      }
      
      return { success: true };
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Connection timeout',
          suggestions: [
            'Check internet connectivity',
            'Verify the API endpoint URL',
            'Try again later'
          ]
        };
      }
      
      return {
        success: false,
        error: error.message,
        suggestions: [
          'Check API key validity',
          'Verify endpoint URL',
          'Check network connectivity'
        ]
      };
    }
  }

  /**
   * Test connection to Gemini provider
   */
  async testGemini(config: ExtendedProviderConfig): Promise<ConnectionTestResult> {
    try {
      if (!config.apiKey) {
        return {
          success: false,
          error: 'API key is required',
          suggestions: [
            'Set GEMINI_API_KEY environment variable',
            'Add apiKey to configuration',
            'Get API key from Google AI Studio'
          ]
        };
      }
      
      // Test with models endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ConnectionTester.TIMEOUT_MS);
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${config.apiKey}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 400 || response.status === 401) {
          return {
            success: false,
            error: 'Invalid API key',
            suggestions: [
              'Check if the API key is correct',
              'Verify API key permissions',
              'Check if Gemini API is enabled'
            ]
          };
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Check if the specified model exists
      const modelExists = data.models?.some((m: any) => 
        m.name.includes(config.model) || m.displayName === config.model
      );
      
      if (!modelExists) {
        return {
          success: false,
          error: `Model ${config.model} not found`,
          suggestions: [
            'Check available models in Google AI Studio',
            'Verify the model name is correct',
            'Use standard models like "gemini-1.5-pro" or "gemini-1.5-flash"'
          ]
        };
      }
      
      return { success: true };
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Connection timeout',
          suggestions: [
            'Check internet connectivity',
            'Try again later'
          ]
        };
      }
      
      return {
        success: false,
        error: error.message,
        suggestions: [
          'Check API key validity',
          'Verify Gemini API is enabled',
          'Check network connectivity'
        ]
      };
    }
  }

  /**
   * Test connection to Anthropic provider
   */
  async testAnthropic(config: ExtendedProviderConfig): Promise<ConnectionTestResult> {
    try {
      if (!config.apiKey) {
        return {
          success: false,
          error: 'API key is required',
          suggestions: [
            'Set ANTHROPIC_API_KEY environment variable',
            'Add apiKey to configuration',
            'Get API key from Anthropic Console'
          ]
        };
      }
      
      // Test with a minimal message
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ConnectionTester.TIMEOUT_MS);
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }]
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 401) {
          return {
            success: false,
            error: 'Invalid API key',
            suggestions: [
              'Check if the API key is correct',
              'Verify API key permissions',
              'Check Anthropic account billing'
            ]
          };
        }
        
        if (response.status === 400) {
          const errorData = await response.json();
          if (errorData.error?.message?.includes('model')) {
            return {
              success: false,
              error: `Model ${config.model} not available`,
              suggestions: [
                'Use standard models like "claude-3-5-sonnet-20241022"',
                'Check available models in Anthropic Console',
                'Verify the model name is correct'
              ]
            };
          }
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return { success: true };
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Connection timeout',
          suggestions: [
            'Check internet connectivity',
            'Try again later'
          ]
        };
      }
      
      return {
        success: false,
        error: error.message,
        suggestions: [
          'Check API key validity',
          'Verify model availability',
          'Check network connectivity'
        ]
      };
    }
  }

  /**
   * Test connection for any provider type
   */
  async testProvider(config: ExtendedProviderConfig): Promise<ConnectionTestResult> {
    switch (config.type) {
      case 'ollama':
        return this.testOllama(config);
      case 'openai':
        return this.testOpenAI(config);
      case 'gemini':
        return this.testGemini(config);
      case 'anthropic':
        return this.testAnthropic(config);
      case 'azure':
        // Azure OpenAI uses similar logic to OpenAI but with different endpoints
        return this.testOpenAI(config);
      case 'bedrock':
        // Bedrock testing would require AWS SDK setup
        return {
          success: false,
          error: 'Bedrock connection testing not implemented yet',
          suggestions: [
            'Configure AWS credentials',
            'Test manually with AWS CLI'
          ]
        };
      default:
        return {
          success: false,
          error: `Unknown provider type: ${config.type}`,
          suggestions: ['Check provider configuration']
        };
    }
  }
}