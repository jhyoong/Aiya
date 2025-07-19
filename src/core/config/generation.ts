import * as yaml from 'yaml';
import { ExtendedProviderConfig, AiyaConfig } from './manager.js';

export interface SetupSession {
  primaryProvider: ExtendedProviderConfig;
  additionalProviders: ExtendedProviderConfig[];
  skipValidation: boolean;
  projectPath: string;
}

export class ConfigurationGenerator {
  /**
   * Generate complete YAML configuration from setup session
   */
  generateYAML(session: SetupSession): string {
    const hasMultipleProviders = session.additionalProviders.length > 0;

    let config: Partial<AiyaConfig>;

    if (hasMultipleProviders) {
      // Multi-provider configuration
      config = this.generateMultiProviderConfig(session);
    } else {
      // Single provider configuration (backward compatible)
      config = this.generateSingleProviderConfig(session);
    }

    return this.formatYAMLWithComments(config, hasMultipleProviders);
  }

  /**
   * Generate single provider configuration
   */
  private generateSingleProviderConfig(
    session: SetupSession
  ): Partial<AiyaConfig> {
    return {
      provider: session.primaryProvider,
      security: this.getDefaultSecurity(),
      ui: this.getDefaultUI(),
      mcp: this.getDefaultMCP(),
      shell: this.getDefaultShell(),
      max_tokens: session.primaryProvider.capabilities?.maxTokens || 8192,
    };
  }

  /**
   * Generate multi-provider configuration
   */
  private generateMultiProviderConfig(
    session: SetupSession
  ): Partial<AiyaConfig> {
    const providers: Record<string, ExtendedProviderConfig> = {};
    const usedNames = new Set<string>();

    // Add primary provider
    const primaryName = this.getProviderName(
      session.primaryProvider,
      usedNames
    );
    providers[primaryName] = session.primaryProvider;
    usedNames.add(primaryName);

    // Add additional providers
    session.additionalProviders.forEach(provider => {
      const name = this.getProviderName(provider, usedNames);
      providers[name] = provider;
      usedNames.add(name);
    });

    return {
      providers,
      current_provider: primaryName,
      security: this.getDefaultSecurity(),
      ui: this.getDefaultUI(),
      mcp: this.getDefaultMCP(),
      shell: this.getDefaultShell(),
      max_tokens: session.primaryProvider.capabilities?.maxTokens || 8192,
    };
  }

  /**
   * Generate unique provider name for multi-provider config
   */
  private getProviderName(
    provider: ExtendedProviderConfig,
    existingNames: Set<string>
  ): string {
    // Extract clean model name for readable identifier
    const cleanModel = provider.model
      .replace(/[^a-zA-Z0-9]/g, '') // Remove special characters
      .toLowerCase()
      .substring(0, 20); // Limit length for readability

    // Create base name combining provider type and model
    const baseName = cleanModel
      ? `${provider.type}-${cleanModel}`
      : provider.type;

    // Handle name conflicts with incremental numbering
    if (!existingNames.has(baseName)) {
      return baseName;
    }

    // Find next available number suffix
    let counter = 1;
    while (existingNames.has(`${baseName}-${counter}`)) {
      counter++;
    }

    return `${baseName}-${counter}`;
  }

  /**
   * Format YAML with helpful comments
   */
  private formatYAMLWithComments(
    config: Partial<AiyaConfig>,
    isMultiProvider: boolean
  ): string {
    const doc = new yaml.Document(config);

    // Add header comment
    const headerComment = this.generateHeaderComment(isMultiProvider);
    doc.commentBefore = headerComment;

    // Set YAML formatting options
    const yamlString = doc.toString({
      indent: 2,
      lineWidth: 80,
      minContentWidth: 20,
      singleQuote: false,
    });

    return this.addInlineComments(yamlString, isMultiProvider);
  }

  /**
   * Generate header comment block
   */
  private generateHeaderComment(isMultiProvider: boolean): string {
    const currentDate = new Date().toISOString().split('T')[0];

    const baseComment = `
# Aiya Configuration File
# Generated on: ${currentDate}
# Documentation: https://github.com/jhyoong/Aiya#configuration

`;

    if (isMultiProvider) {
      return (
        baseComment +
        `# Multi-Provider Setup
# - Use '/model-switch' command to switch between providers during chat
# - Current provider is set by 'current_provider' field
# - Add more providers by extending the 'providers' section

`
      );
    } else {
      return (
        baseComment +
        `# Single Provider Setup
# - To add more providers, run 'aiya init' again
# - Or manually add providers to create a multi-provider setup

`
      );
    }
  }

  /**
   * Add inline comments to YAML string
   */
  private addInlineComments(
    yamlString: string,
    isMultiProvider: boolean
  ): string {
    const lines = yamlString.split('\n');
    const commentedLines = lines.map(line => {
      const trimmed = line.trim();

      // Provider section comments
      if (isMultiProvider && trimmed.startsWith('current_provider:')) {
        return line + '  # Active provider for new chat sessions';
      }

      if (trimmed.startsWith('providers:')) {
        return line + '  # Available AI providers';
      }

      if (trimmed.startsWith('provider:')) {
        return line + '  # Single provider configuration';
      }

      // Security section comments
      if (trimmed.startsWith('security:')) {
        return line + '  # File access and security settings';
      }

      if (trimmed.startsWith('allowedExtensions:')) {
        return line + '  # File types allowed for MCP operations';
      }

      if (trimmed.startsWith('restrictToWorkspace:')) {
        return line + '  # Restrict file access to project directory';
      }

      if (trimmed.startsWith('maxFileSize:')) {
        return line + '  # Maximum file size in bytes (1MB)';
      }

      // UI section comments
      if (trimmed.startsWith('ui:')) {
        return line + '  # User interface preferences';
      }

      if (trimmed.startsWith('streaming:')) {
        return line + '  # Enable streaming responses';
      }

      if (trimmed.startsWith('showTokens:')) {
        return line + '  # Display token usage in status bar';
      }

      if (trimmed.startsWith('thinking:')) {
        return line + '  # Thinking mode: on, brief, off';
      }

      // MCP section comments
      if (trimmed.startsWith('mcp:')) {
        return line + '  # Model Context Protocol settings';
      }

      if (trimmed.startsWith('servers:')) {
        return line + '  # External MCP servers (currently empty)';
      }

      // Shell section comments
      if (trimmed.startsWith('shell:')) {
        return line + '  # Shell command execution and security settings';
      }


      if (trimmed.startsWith('trustedCommands:')) {
        return (
          line + '  # Regex patterns for commands that bypass confirmation'
        );
      }

      if (trimmed.startsWith('alwaysBlockPatterns:')) {
        return (
          line +
          '  # Commands that are always blocked regardless of confirmation'
        );
      }

      if (trimmed.startsWith('confirmationTimeout:')) {
        return line + '  # Timeout for confirmation prompts in milliseconds';
      }

      if (trimmed.startsWith('sessionMemory:')) {
        return line + '  # Remember confirmation decisions for current session';
      }

      if (trimmed.startsWith('requireConfirmation:')) {
        return line + '  # Enable confirmation prompts for risky commands';
      }

      if (trimmed.startsWith('allowComplexCommands:')) {
        return (
          line + '  # Allow complex command patterns (pipes, redirects, etc.)'
        );
      }

      if (trimmed.startsWith('maxExecutionTime:')) {
        return line + '  # Maximum command execution time in seconds';
      }

      if (trimmed.startsWith('allowedCommands:')) {
        return line + '  # Commands allowed for execution';
      }

      if (trimmed.startsWith('blockedCommands:')) {
        return line + '  # Commands that are blocked from execution';
      }

      if (trimmed.startsWith('autoApprovePatterns:')) {
        return (
          line + '  # Patterns for commands that are automatically approved'
        );
      }

      // Provider-specific comments
      if (trimmed.startsWith('type:')) {
        return line + '  # Provider type';
      }

      if (trimmed.startsWith('model:')) {
        return line + '  # AI model name';
      }

      if (trimmed.startsWith('baseUrl:')) {
        return line + '  # API endpoint URL';
      }

      if (trimmed.startsWith('apiKey:')) {
        return line + '  # API key (can use environment variables)';
      }

      if (trimmed.startsWith('max_tokens:')) {
        return line + '  # Default maximum tokens for responses';
      }

      return line;
    });

    return commentedLines.join('\n') + this.generateFooterComment();
  }

  /**
   * Generate footer comment with usage instructions
   */
  private generateFooterComment(): string {
    return `

# Usage Instructions:
# 1. Start chatting: aiya chat
# 2. Search files: aiya search <pattern>
# 3. Get help: aiya --help
#
# Environment Variables:
# - AIYA_API_KEY: Override API key
# - AIYA_MODEL: Override model name
# - AIYA_BASE_URL: Override base URL
# - AIYA_STREAMING: Override streaming setting (true/false)
# - AIYA_SHELL_CONFIRMATION_THRESHOLD: Override confirmation threshold (0-100)
# - AIYA_SHELL_CONFIRMATION_TIMEOUT: Override confirmation timeout (milliseconds)
# - AIYA_SHELL_SESSION_MEMORY: Override session memory setting (true/false)
# - AIYA_SHELL_REQUIRE_CONFIRMATION: Override require confirmation (true/false)
# - AIYA_SHELL_ALLOW_COMPLEX_COMMANDS: Override allow complex commands (true/false)
# - AIYA_SHELL_MAX_EXECUTION_TIME: Override max execution time (seconds)
#
# Chat Commands:
# - /read <file>: Read and display file content
# - /add <file>: Add file to context for next prompt
# - /search <pattern>: Search for files
# - /model-switch: Switch between configured providers
# - /thinking [mode]: Change thinking display mode
# - /tokens: Show token usage statistics
#
# For more information, visit: https://github.com/jhyoong/Aiya
`;
  }

  /**
   * Get default security configuration
   */
  private getDefaultSecurity() {
    return {
      allowedExtensions: [
        '.ts',
        '.js',
        '.tsx',
        '.jsx',
        '.py',
        '.rs',
        '.go',
        '.java',
        '.c',
        '.cpp',
        '.h',
        '.hpp',
        '.md',
        '.txt',
        '.json',
        '.yaml',
        '.yml',
        '.html',
        '.css',
        '.scss',
        '.sass',
        '.sql',
        '.sh',
        '.bash',
      ],
      restrictToWorkspace: true,
      maxFileSize: 1048576, // 1MB
    };
  }

  /**
   * Get default UI configuration
   */
  private getDefaultUI() {
    return {
      streaming: true,
      showTokens: true,
      theme: 'auto' as const,
      thinking: 'on' as const,
    };
  }

  /**
   * Get default MCP configuration
   */
  private getDefaultMCP() {
    return {
      servers: [],
    };
  }

  /**
   * Get default shell configuration
   */
  private getDefaultShell() {
    return {
      allowedCommands: [
        'echo',
        'cat',
        'head',
        'tail',
        'less',
        'more',
        'ls',
        'dir',
        'pwd',
        'find',
        'grep',
        'sort',
        'wc',
        'date',
        'whoami',
        'id',
        'uname',
        'which',
        'where',
        'npm',
        'yarn',
        'pnpm',
        'node',
        'python',
        'pip',
        'git',
        'docker',
        'docker-compose',
        'make',
        'cmake',
        'gcc',
        'clang',
        'javac',
        'java',
        'cargo',
        'rustc',
        'go',
        'dotnet',
        'build',
        'test',
        'lint',
        'format',
        'compile',
        'jest',
        'mocha',
        'pytest',
        'phpunit',
        'rspec',
        'touch',
        'mkdir',
        'cp',
        'mv',
        'ln',
        'tar',
        'gzip',
        'gunzip',
        'zip',
        'unzip',
        'awk',
        'sed',
        'cut',
        'tr',
        'diff',
        'patch',
      ],
      blockedCommands: [
        'sudo',
        'su',
        'passwd',
        'chown',
        'chmod',
        'chgrp',
        'mount',
        'umount',
        'fdisk',
        'mkfs',
        'fsck',
        'parted',
        'dd',
        'shred',
        'rm',
        'rmdir',
        'killall',
        'pkill',
        'kill',
        'halt',
        'shutdown',
        'reboot',
        'poweroff',
        'init',
        'systemctl',
        'service',
        'crontab',
        'at',
        'batch',
      ],
      requireConfirmation: true,
      autoApprovePatterns: [
        '^ls($|\\s)',
        '^pwd($|\\s)',
        '^echo($|\\s)',
        '^cat($|\\s)',
        '^head($|\\s)',
        '^tail($|\\s)',
        '^git status($|\\s)',
        '^npm test($|\\s)',
        '^npm run($|\\s)',
        '^yarn test($|\\s)',
        '^yarn run($|\\s)',
      ],
      maxExecutionTime: 30,
      allowComplexCommands: false,
      trustedCommands: [
        '^ls($|\\s)',
        '^pwd($|\\s)',
        '^echo($|\\s)',
        '^git status($|\\s)',
        '^npm test($|\\s)',
      ],
      alwaysBlockPatterns: [
        'rm -rf /',
        'sudo rm -rf',
        'format.*',
        'dd if=/dev/zero',
        ':(\\(\\))',
      ],
      confirmationTimeout: 30000,
      sessionMemory: true,
      requireConfirmationForRisky: true,
      requireConfirmationForDangerous: true,
      allowDangerous: false,
    };
  }

  /**
   * Generate configuration preview for display
   */
  generatePreview(session: SetupSession): string {
    const hasMultiple = session.additionalProviders.length > 0;

    let preview = '📋 Configuration Preview:\n\n';

    if (hasMultiple) {
      preview += `🔧 Multi-Provider Setup:\n`;
      preview += `   Primary: ${session.primaryProvider.type} - ${session.primaryProvider.model}\n`;

      session.additionalProviders.forEach(provider => {
        preview += `   Additional: ${provider.type} - ${provider.model}\n`;
      });

      preview += `\n💡 Use '/model-switch' to switch between providers during chat\n\n`;
    } else {
      preview += `🔧 Single Provider Setup:\n`;
      preview += `   Provider: ${session.primaryProvider.type}\n`;
      preview += `   Model: ${session.primaryProvider.model}\n`;
      if (session.primaryProvider.baseUrl) {
        preview += `   Endpoint: ${session.primaryProvider.baseUrl}\n`;
      }
      preview += `\n`;
    }

    preview += `⚙️  Features:\n`;
    preview += `   • Streaming responses: enabled\n`;
    preview += `   • Token display: enabled\n`;
    preview += `   • Thinking mode: on\n`;
    preview += `   • File operations: workspace restricted\n`;

    preview += `\n📁 Configuration will be saved to: .aiya.yaml\n`;

    return preview;
  }

  /**
   * Generate backup filename for existing config
   */
  generateBackupFilename(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `.aiya.yaml.backup.${timestamp}`;
  }
}
