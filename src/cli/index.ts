#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { chatCommand } from './commands/chat.js';
import { searchCommand } from './commands/search.js';

const program = new Command();

program
  .name('aiya')
  .description('AI-powered development assistant with secure file operations')
  .version('1.0.0');

// Add commands
program.addCommand(initCommand);
program.addCommand(chatCommand); // Ink-based chat interface
program.addCommand(searchCommand); // Ink-based search interface

// Global options
program
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--config <path>', 'Path to config file')
  .hook('preAction', (thisCommand) => {
    const options = thisCommand.opts();
    if (options.verbose) {
      process.env.AIYA_VERBOSE = 'true';
    }
    if (options.config) {
      process.env.AIYA_CONFIG_PATH = options.config;
    }
  });

// Error handling
program.exitOverride();

process.on('SIGINT', () => {
  console.log('\nGracefully shutting down...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Parse command line arguments
try {
  program.parse();
} catch (error) {
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}