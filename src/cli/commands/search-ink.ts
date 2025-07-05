import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { ConfigManager } from '../../core/config/manager.js';
import { WorkspaceSecurity } from '../../core/security/workspace.js';
import { EnhancedFilesystemMCPClient } from '../../core/mcp/enhanced-filesystem.js';
import { SearchResults } from '../../ui/components/SearchResults.js';

interface SearchResult {
  file: string;
  line: number;
  content: string;
  context?: string[];
}

export const searchInkCommand = new Command('search')
  .description('Fuzzy search for files in the workspace')
  .argument('<query>', 'Search query')
  .action(async (query: string) => {
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
      
      // Perform the search
      const results = await performSearch(mcpClient, query);
      
      // Render the interactive search results
      const { unmount } = render(
        React.createElement(SearchResults, {
          results,
          title: `Search results for "${query}"`,
          onSelect: (result: SearchResult) => {
            unmount();
            console.log(`\nSelected: ${result.file}`);
            console.log(`Content: ${result.content}`);
            process.exit(0);
          },
          onExit: () => {
            unmount();
            console.log('\nSearch cancelled.');
            process.exit(0);
          }
        })
      );
      
    } catch (error) {
      console.error('❌ Search failed:', error);
      process.exit(1);
    }
  });

async function performSearch(mcpClient: EnhancedFilesystemMCPClient, query: string): Promise<SearchResult[]> {
  try {
    // Get all files in the workspace
    const result = await mcpClient.callTool('search_files', { pattern: '**/*' });
    
    if (result.isError) {
      throw new Error(result.content[0]?.text || 'Search failed');
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
    
    // Convert to SearchResult format
    return matches.map((match, index) => ({
      file: match.file,
      line: 1,
      content: `Match score: ${match.score}`,
      context: [
        `File ${index + 1} of ${matches.length}`,
        `Score: ${match.score}/100`
      ]
    }));
    
  } catch (error) {
    throw new Error(`Search error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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