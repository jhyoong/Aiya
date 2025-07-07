import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../../core/config/manager.js';
import { OllamaProvider } from '../../core/providers/ollama.js';

export const initCommand = new Command('init')
  .description('Initialize Aiya configuration for current project')
  .option('-m, --model <model>', 'Specify the model to use', 'qwen2.5:8b')
  .option('--base-url <url>', 'Ollama base URL', 'http://localhost:11434')
  .option('--check-connection', 'Check connection to Ollama server')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🚀 Initializing Aiya...'));
      
      const configManager = new ConfigManager();
      
      // Check Ollama connection if requested
      if (options.checkConnection) {
        console.log(chalk.yellow('🔍 Checking Ollama connection...'));
        await checkOllamaConnection(options.model, options.baseUrl);
      }
      
      // Initialize configuration
      await configManager.init(options.model, options.baseUrl);
      
      console.log(chalk.green('Aiya initialized successfully!'));
      console.log(chalk.gray(`   Model: ${options.model}`));
      console.log(chalk.gray(`   Endpoint: ${options.baseUrl}`));
      console.log(chalk.gray(`   Config created: .aiya.yaml`));
      
      // Show next steps
      console.log(chalk.blue('\nNext steps:'));
      console.log(chalk.gray('   • Run `aiya chat` to start a conversation'));
      console.log(chalk.gray('   • Run `aiya search <pattern>` to search files'));
      console.log(chalk.gray('   • Edit .aiya.yaml to customize settings'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize Aiya:'));
      console.error(chalk.red(`   ${error}`));
      process.exit(1);
    }
  });

async function checkOllamaConnection(model: string, baseUrl: string): Promise<void> {
  try {
    const provider = new OllamaProvider({ type: 'ollama', model, baseUrl });
    
    // Check if Ollama is healthy
    const isHealthy = await provider.isHealthy();
    if (!isHealthy) {
      throw new Error('Ollama server is not responding');
    }
    
    // Check if model is available
    const availableModels = await provider.listAvailableModels();
    if (!availableModels.includes(model)) {
      console.log(chalk.yellow(`⚠️  Model '${model}' not found. Available models:`));
      availableModels.forEach(m => console.log(chalk.gray(`   • ${m}`)));
      console.log(chalk.yellow(`\nTo pull the model, run: ollama pull ${model}`));
      throw new Error(`Model '${model}' is not available`);
    }
    
    console.log(chalk.green('Ollama connection successful'));
    console.log(chalk.gray(`   Model '${model}' is available`));
    
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        throw new Error('Could not connect to Ollama server. Make sure Ollama is running.');
      }
      throw error;
    }
    throw new Error('Unknown error occurred while checking Ollama connection');
  }
}