import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../../core/config/manager.js';
import { WorkspaceSecurity } from '../../core/security/workspace.js';
import { EnhancedFilesystemMCPClient } from '../../core/mcp/enhanced-filesystem.js';

export const searchCommand = new Command('search')
  .description('Fuzzy search for files in the workspace')
  .argument('<query>', 'Search query')
  .action(async (query) => {
    try {
      const configManager = new ConfigManager();
      const config = await configManager.load();
      
      const security = new WorkspaceSecurity(
        process.cwd(),
        config.security.allowedExtensions,
        config.security.maxFileSize
      );
      
      const mcpClient = new EnhancedFilesystemMCPClient(security);
      await mcpClient.connect();
      
      console.log(chalk.blue('🔍 Searching...'));
      
      await fuzzySearch(mcpClient, query);
      
    } catch (error) {
      console.error(chalk.red('❌ Search failed:'));
      console.error(chalk.red(`   ${error}`));
      process.exit(1);
    }
  });

async function fuzzySearch(mcpClient: EnhancedFilesystemMCPClient, query: string): Promise<void> {
  try {
    // Get all files in the workspace
    const result = await mcpClient.callTool('search_files', { pattern: '**/*' });
    
    if (result.isError) {
      console.error(chalk.red(`Error: ${result.content[0]?.text}`));
      return;
    }
    
    const allFiles = JSON.parse(result.content[0]?.text || '[]') as string[];
    
    // Simple fuzzy matching - check if query chars appear in order
    const matches = allFiles
      .map(file => ({
        file,
        score: calculateFuzzyScore(file, query)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    
    if (matches.length === 0) {
      console.log(chalk.yellow('No files found matching the query'));
      return;
    }
    
    console.log(chalk.green(`📁 Found ${matches.length} file(s):`));
    
    matches.forEach((match, index) => {
      const highlightedFile = highlightQuery(match.file, query);
      console.log(`${chalk.gray(`${(index + 1).toString().padStart(3)}:`)} ${highlightedFile}`);
    });
    
  } catch (error) {
    console.error(chalk.red(`Search error: ${error}`));
  }
}

function calculateFuzzyScore(filename: string, query: string): number {
  const lowerFilename = filename.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  // Exact match gets highest score
  if (lowerFilename.includes(lowerQuery)) {
    return 100;
  }
  
  // Check if all query characters appear in order
  let queryIndex = 0;
  let score = 0;
  
  for (let i = 0; i < lowerFilename.length && queryIndex < lowerQuery.length; i++) {
    if (lowerFilename[i] === lowerQuery[queryIndex]) {
      queryIndex++;
      score += 1;
    }
  }
  
  // Return score only if all query characters were found
  return queryIndex === lowerQuery.length ? score : 0;
}

function highlightQuery(filename: string, query: string): string {
  const lowerFilename = filename.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  // Highlight exact matches
  if (lowerFilename.includes(lowerQuery)) {
    const index = lowerFilename.indexOf(lowerQuery);
    return (
      filename.substring(0, index) +
      chalk.yellow.bold(filename.substring(index, index + query.length)) +
      filename.substring(index + query.length)
    );
  }
  
  // Highlight individual characters
  let result = '';
  let queryIndex = 0;
  
  for (let i = 0; i < filename.length && queryIndex < query.length; i++) {
    if (filename[i]?.toLowerCase() === query[queryIndex]?.toLowerCase()) {
      result += chalk.yellow.bold(filename[i]);
      queryIndex++;
    } else {
      result += chalk.cyan(filename[i]);
    }
  }
  
  // Add remaining characters
  if (result.length < filename.length) {
    result += chalk.cyan(filename.substring(result.length));
  }
  
  return result;
}