import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { ConfigManager } from '../../core/config/manager.js';
import { WorkspaceSecurity } from '../../core/security/workspace.js';
import { FilesystemMCPClient } from '../../core/mcp/filesystem.js';
import { SearchResults } from '../../ui/components/SearchResults.js';

interface SearchResult {
  file: string;
  line: number;
  content: string;
  context?: string[];
}

export const searchCommand = new Command('search')
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

      const mcpClient = new FilesystemMCPClient(security);
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
          },
        })
      );
    } catch (error) {
      console.error('❌ Search failed:', error);
      process.exit(1);
    }
  });

async function performSearch(
  mcpClient: FilesystemMCPClient,
  query: string
): Promise<SearchResult[]> {
  try {
    // Search for the query pattern in file contents using SearchFiles tool
    const result = await mcpClient.callTool('SearchFiles', {
      pattern: query,
      options: {
        searchType: 'literal',
        includeGlobs: ['**/*'],
        maxResults: 50,
      },
    });

    if (result.isError) {
      throw new Error(result.content[0]?.text || 'Search failed');
    }

    const searchResponse = JSON.parse(result.content[0]?.text || '{}');
    const searchResults = searchResponse.results || [];

    // Convert SearchFiles results to our SearchResult format
    return searchResults.map((match: any, index: number) => ({
      file: match.file,
      line: match.line || 1,
      content: match.match || `File match: ${match.file}`,
      context: match.context?.before?.concat(match.context?.after || []) || [
        `Result ${index + 1} of ${searchResults.length}`,
      ],
    }));
  } catch (error) {
    throw new Error(
      `Search error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
