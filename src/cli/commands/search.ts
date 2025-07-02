import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../../core/config/manager.js';
import { WorkspaceSecurity } from '../../core/security/workspace.js';
import { FilesystemMCPClient } from '../../core/mcp/filesystem.js';

export const searchCommand = new Command('search')
  .description('Search for files and content in the workspace')
  .argument('<pattern>', 'Search pattern (glob pattern for files)')
  .option('-c, --content <text>', 'Search for files containing this text')
  .option('-t, --type <type>', 'Search type: "file" (names) or "content" (file contents)', 'file')
  .option('--max-results <num>', 'Maximum number of results to show', '50')
  .option('--no-relative', 'Show absolute paths instead of relative')
  .action(async (pattern, options) => {
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
      
      console.log(chalk.blue('🔍 Searching...'));
      
      if (options.type === 'content' || options.content) {
        await searchContent(mcpClient, pattern, options.content || pattern, options);
      } else {
        await searchFiles(mcpClient, pattern, options.content, options);
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Search failed:'));
      console.error(chalk.red(`   ${error}`));
      process.exit(1);
    }
  });

async function searchFiles(
  mcpClient: FilesystemMCPClient, 
  pattern: string, 
  contentFilter?: string,
  options?: any
): Promise<void> {
  try {
    const result = await mcpClient.callTool('search_files', { 
      pattern, 
      content: contentFilter 
    });
    
    if (result.isError) {
      console.error(chalk.red(`Error: ${result.content[0]?.text}`));
      return;
    }
    
    const files = JSON.parse(result.content[0]?.text || '[]') as string[];
    const maxResults = parseInt(options?.maxResults || '50');
    const displayFiles = files.slice(0, maxResults);
    
    if (files.length === 0) {
      console.log(chalk.yellow('No files found matching the pattern'));
      return;
    }
    
    console.log(chalk.green(`📁 Found ${files.length} file(s):`));
    if (files.length > maxResults) {
      console.log(chalk.gray(`   (showing first ${maxResults} results)`));
    }
    
    displayFiles.forEach((file, index) => {
      const fileIcon = getFileIcon(file);
      const displayPath = options?.relative !== false ? file : file;
      console.log(`${chalk.gray(`${(index + 1).toString().padStart(3)}:`)} ${fileIcon} ${chalk.cyan(displayPath)}`);
    });
    
    if (contentFilter) {
      console.log(chalk.gray(`\n🔍 Files containing: "${contentFilter}"`));
    }
    
  } catch (error) {
    console.error(chalk.red(`File search error: ${error}`));
  }
}

async function searchContent(
  mcpClient: FilesystemMCPClient,
  pattern: string,
  searchText: string,
  options?: any
): Promise<void> {
  try {
    // First get matching files
    const fileResult = await mcpClient.callTool('search_files', { 
      pattern,
      content: searchText 
    });
    
    if (fileResult.isError) {
      console.error(chalk.red(`Error: ${fileResult.content[0]?.text}`));
      return;
    }
    
    const files = JSON.parse(fileResult.content[0]?.text || '[]') as string[];
    const maxResults = parseInt(options?.maxResults || '50');
    
    if (files.length === 0) {
      console.log(chalk.yellow(`No files found containing "${searchText}"`));
      return;
    }
    
    console.log(chalk.green(`📝 Found "${searchText}" in ${files.length} file(s):`));
    if (files.length > maxResults) {
      console.log(chalk.gray(`   (showing first ${maxResults} results)`));
    }
    console.log();
    
    // Show content matches for each file
    for (const file of files.slice(0, maxResults)) {
      await showContentMatches(mcpClient, file, searchText);
      console.log(); // Add spacing between files
    }
    
  } catch (error) {
    console.error(chalk.red(`Content search error: ${error}`));
  }
}

async function showContentMatches(
  mcpClient: FilesystemMCPClient,
  filePath: string,
  searchText: string
): Promise<void> {
  try {
    const result = await mcpClient.callTool('read_file', { path: filePath });
    
    if (result.isError) {
      console.log(chalk.red(`   ❌ ${filePath}: ${result.content[0]?.text}`));
      return;
    }
    
    const content = result.content[0]?.text || '';
    const lines = content.split('\n');
    const matches: Array<{ lineNum: number; line: string }> = [];
    
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(searchText.toLowerCase())) {
        matches.push({ lineNum: index + 1, line: line.trim() });
      }
    });
    
    if (matches.length === 0) {
      return;
    }
    
    const fileIcon = getFileIcon(filePath);
    console.log(`${fileIcon} ${chalk.cyan(filePath)} ${chalk.gray(`(${matches.length} match${matches.length > 1 ? 'es' : ''})`)}`);
    
    // Show up to 3 matches per file
    matches.slice(0, 3).forEach(match => {
      const lineNumStr = match.lineNum.toString().padStart(4);
      const highlightedLine = highlightSearchText(match.line, searchText);
      console.log(`   ${chalk.gray(lineNumStr + ':')} ${highlightedLine}`);
    });
    
    if (matches.length > 3) {
      console.log(chalk.gray(`   ... and ${matches.length - 3} more match${matches.length - 3 > 1 ? 'es' : ''}`));
    }
    
  } catch (error) {
    console.log(chalk.red(`   ❌ ${filePath}: Error reading file`));
  }
}

function getFileIcon(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  const iconMap: Record<string, string> = {
    'js': '📄',
    'ts': '📘',
    'tsx': '📘',
    'jsx': '📄',
    'py': '🐍',
    'rs': '🦀',
    'go': '🐹',
    'java': '☕',
    'c': '📄',
    'cpp': '📄',
    'h': '📄',
    'hpp': '📄',
    'md': '📝',
    'txt': '📄',
    'json': '📋',
    'yaml': '📋',
    'yml': '📋',
    'html': '🌐',
    'css': '🎨',
    'scss': '🎨',
    'sass': '🎨',
    'sql': '🗃️',
    'sh': '⚡',
    'bash': '⚡'
  };
  
  return iconMap[ext || ''] || '📄';
}

function highlightSearchText(line: string, searchText: string): string {
  const regex = new RegExp(`(${escapeRegex(searchText)})`, 'gi');
  return line.replace(regex, chalk.yellow.bold('$1'));
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}