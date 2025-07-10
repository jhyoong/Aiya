export { CommandRegistry, CommandDefinition, CommandHandler, CommandCategory } from '../CommandRegistry.js';
export { registerDefaultCommands, getCommandDefinition, CORE_COMMANDS } from './definitions.js';
export { SuggestionEngine } from '../suggestions.js';
export { CommandExecutor, CommandContext, ExecutionResult } from '../CommandExecutor.js';
export { CommandUtils, ArgumentDefinition, ParsedArguments } from '../CommandUtils.js';
import { registerDefaultCommands } from './definitions.js';

/**
 * Initialize the command system
 * This should be called early in the application startup
 */
export function initializeCommandSystem(): void {
  // Register default commands
  registerDefaultCommands();
}