import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { ConfigurationGenerator } from './generation.js';

export interface ProviderCapabilities {
  maxTokens: number;
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsThinking: boolean;
}

export interface ExtendedProviderConfig {
  type: 'ollama' | 'openai' | 'anthropic' | 'azure' | 'gemini' | 'bedrock';
  baseUrl: string;
  model: string;
  apiKey?: string;
  capabilities?: ProviderCapabilities;
  costPerToken?: { input: number; output: number };
  // Provider-specific configurations
  azure?: {
    deploymentName?: string;
    apiVersion?: string;
  };
  anthropic?: {
    maxTokens?: number;
    version?: string;
  };
  gemini?: {
    projectId?: string;
    location?: string;
    maxTokens?: number;
    thinkingBudget?: number;
    includeThoughts?: boolean;
  };
  bedrock?: {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    modelId?: string;
  };
}

export interface AiyaConfig {
  provider?: ExtendedProviderConfig; // Single provider config
  providers?: Record<string, ExtendedProviderConfig>; // Named provider configurations
  current_provider?: string; // Active provider name when using multiple providers
  security: {
    allowedExtensions: string[];
    restrictToWorkspace: boolean;
    maxFileSize: number;
  };
  ui: {
    streaming: boolean;
    showTokens: boolean;
    theme: 'auto' | 'light' | 'dark';
    thinking: 'on' | 'brief' | 'off';
  };
  mcp: {
    servers: Array<{
      name: string;
      command: string;
      args?: string[];
      cwd?: string;
    }>;
  };
  shell?: {
    allowedCommands: string[];
    blockedCommands: string[];
    requireConfirmation: boolean;
    autoApprovePatterns: string[];
    maxExecutionTime: number;
    allowComplexCommands: boolean;
    confirmationThreshold: number;
    trustedCommands: string[];
    alwaysBlockPatterns: string[];
    confirmationTimeout: number;
    sessionMemory: boolean;
  };
  max_tokens?: number;
}

const DEFAULT_PROVIDER: ExtendedProviderConfig = {
  type: 'ollama',
  baseUrl: 'http://localhost:11434',
  model: 'qwen3:8b',
  capabilities: {
    maxTokens: 4096,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsThinking: false,
  },
};

const DEFAULT_CONFIG: AiyaConfig = {
  provider: DEFAULT_PROVIDER,
  security: {
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
    maxFileSize: 1024 * 1024, // 1MB
  },
  ui: {
    streaming: true,
    showTokens: true,
    theme: 'auto',
    thinking: 'on',
  },
  mcp: {
    servers: [],
  },
  shell: {
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
    confirmationThreshold: 50,
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
  },
  max_tokens: 4096,
};

export class ConfigManager {
  private config: AiyaConfig;
  private configPath: string;
  private projectConfigPath?: string;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.configPath = path.join(os.homedir(), '.aiya', 'config.yaml');
  }

  async load(): Promise<AiyaConfig> {
    try {
      await this.detectProjectConfig();
      await this.loadGlobalConfig();
      await this.loadProjectConfig();
      this.applyEnvironmentOverrides();
      this.validateConfig();
      return this.config;
    } catch (error) {
      console.warn(`Failed to load config: ${error}. Using defaults.`);
      return DEFAULT_CONFIG;
    }
  }

  async save(config: Partial<AiyaConfig>): Promise<void> {
    this.config = this.mergeConfigs(this.config, config);

    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    const yamlContent = yaml.stringify(this.config, {
      indent: 2,
      lineWidth: 80,
    });

    await fs.writeFile(this.configPath, yamlContent, 'utf8');
  }

  async init(model?: string, baseUrl?: string): Promise<void> {
    const initConfig: Partial<AiyaConfig> = {
      provider: {
        ...DEFAULT_PROVIDER,
        ...(model && { model }),
        ...(baseUrl && { baseUrl }),
      },
    };

    await this.save(initConfig);

    const projectConfigPath = path.join(process.cwd(), '.aiya.yaml');

    // Use ConfigurationGenerator for consistent format
    const configGenerator = new ConfigurationGenerator();
    const session = {
      primaryProvider: {
        ...DEFAULT_PROVIDER,
        ...(model && { model }),
        ...(baseUrl && { baseUrl }),
      },
      additionalProviders: [],
      skipValidation: false,
      projectPath: process.cwd(),
    };

    const yamlContent = configGenerator.generateYAML(session);
    await fs.writeFile(projectConfigPath, yamlContent, 'utf8');
  }

  getConfig(): AiyaConfig {
    return { ...this.config };
  }

  getCurrentProvider(): ExtendedProviderConfig {
    // If using multiple providers, get the current one
    if (this.config.providers && this.config.current_provider) {
      const provider = this.config.providers[this.config.current_provider];
      if (provider) {
        return provider;
      }
    }

    // Fallback to single provider or default
    return this.config.provider || DEFAULT_PROVIDER;
  }

  getAvailableProviders(): string[] {
    const providers: string[] = [];

    // Add named providers first
    if (this.config.providers) {
      providers.push(...Object.keys(this.config.providers));
    }

    // Only add 'default' if no named providers exist
    if (this.config.provider && !this.config.providers) {
      providers.push('default');
    }

    return providers;
  }

  getProviderConfig(name: string): ExtendedProviderConfig | null {
    // In multi-provider mode, use named providers only
    if (this.config.providers && this.config.providers[name]) {
      return this.config.providers[name];
    }

    // Only use 'default' if no named providers exist
    if (name === 'default' && this.config.provider && !this.config.providers) {
      return this.config.provider;
    }

    return null;
  }

  async switchProvider(providerName: string): Promise<boolean> {
    // Validate provider exists
    const providerConfig = this.getProviderConfig(providerName);
    if (!providerConfig) {
      return false;
    }

    // Update current provider
    if (providerName === 'default' && !this.config.providers) {
      // Using single provider, clear current_provider
      delete this.config.current_provider;
    } else {
      // Using named provider
      this.config.current_provider = providerName;
    }

    return true;
  }

  validateProvider(name: string): boolean {
    return this.getProviderConfig(name) !== null;
  }

  private async detectProjectConfig(): Promise<void> {
    const cwd = process.cwd();
    const possiblePaths = [
      path.join(cwd, '.aiya.yaml'),
      path.join(cwd, '.aiya.yml'),
      path.join(cwd, 'aiya.config.yaml'),
      path.join(cwd, 'aiya.config.yml'),
    ];

    for (const configPath of possiblePaths) {
      try {
        await fs.access(configPath);
        this.projectConfigPath = configPath;
        break;
      } catch {
        // File doesn't exist, continue
      }
    }
  }

  private async loadGlobalConfig(): Promise<void> {
    try {
      const content = await fs.readFile(this.configPath, 'utf8');
      const globalConfig = yaml.parse(content) as Partial<AiyaConfig>;
      this.config = this.mergeConfigs(DEFAULT_CONFIG, globalConfig);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // Global config doesn't exist, use defaults
    }
  }

  private async loadProjectConfig(): Promise<void> {
    if (!this.projectConfigPath) return;

    try {
      const content = await fs.readFile(this.projectConfigPath, 'utf8');
      const rawConfig = yaml.parse(content);

      // Parse as nested config format only
      const projectConfig = rawConfig as Partial<AiyaConfig>;
      this.config = this.mergeConfigs(this.config, projectConfig);
    } catch (error) {
      console.warn(
        `Failed to load project config from ${this.projectConfigPath}: ${error}`
      );
    }
  }

  private applyEnvironmentOverrides(): void {
    // Ensure we have a provider to override
    if (!this.config.provider) {
      this.config.provider = { ...DEFAULT_PROVIDER };
    }

    if (process.env.AIYA_PROVIDER) {
      const providerType = process.env.AIYA_PROVIDER.toLowerCase();
      if (
        [
          'ollama',
          'openai',
          'anthropic',
          'azure',
          'gemini',
          'bedrock',
        ].includes(providerType)
      ) {
        this.config.provider.type =
          providerType as ExtendedProviderConfig['type'];
      }
    }

    if (process.env.AIYA_MODEL) {
      this.config.provider.model = process.env.AIYA_MODEL;
    }

    if (process.env.AIYA_BASE_URL) {
      this.config.provider.baseUrl = process.env.AIYA_BASE_URL;
    }

    if (process.env.AIYA_API_KEY) {
      this.config.provider.apiKey = process.env.AIYA_API_KEY;
    }

    if (process.env.OPENAI_API_KEY && this.config.provider.type === 'openai') {
      this.config.provider.apiKey = process.env.OPENAI_API_KEY;
    }

    if (
      process.env.ANTHROPIC_API_KEY &&
      this.config.provider.type === 'anthropic'
    ) {
      this.config.provider.apiKey = process.env.ANTHROPIC_API_KEY;
    }

    if (
      process.env.AZURE_OPENAI_API_KEY &&
      this.config.provider.type === 'azure'
    ) {
      this.config.provider.apiKey = process.env.AZURE_OPENAI_API_KEY;
    }

    if (process.env.GEMINI_API_KEY && this.config.provider.type === 'gemini') {
      this.config.provider.apiKey = process.env.GEMINI_API_KEY;
    }

    // AWS Bedrock environment variables
    if (this.config.provider.type === 'bedrock') {
      if (process.env.AWS_REGION) {
        this.config.provider.bedrock = {
          region: process.env.AWS_REGION,
          ...this.config.provider.bedrock,
        };
      }

      if (process.env.AWS_ACCESS_KEY_ID) {
        this.config.provider.bedrock = {
          region: this.config.provider.bedrock?.region || 'us-east-1',
          ...this.config.provider.bedrock,
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        };
      }

      if (process.env.AWS_SECRET_ACCESS_KEY) {
        this.config.provider.bedrock = {
          region: this.config.provider.bedrock?.region || 'us-east-1',
          ...this.config.provider.bedrock,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        };
      }

      if (process.env.AWS_SESSION_TOKEN) {
        this.config.provider.bedrock = {
          region: this.config.provider.bedrock?.region || 'us-east-1',
          ...this.config.provider.bedrock,
          sessionToken: process.env.AWS_SESSION_TOKEN,
        };
      }
    }

    if (process.env.AIYA_STREAMING) {
      this.config.ui.streaming = process.env.AIYA_STREAMING === 'true';
    }

    if (process.env.AIYA_THINKING) {
      const thinkingMode = process.env.AIYA_THINKING.toLowerCase();
      if (
        thinkingMode === 'on' ||
        thinkingMode === 'brief' ||
        thinkingMode === 'off'
      ) {
        this.config.ui.thinking = thinkingMode as 'on' | 'brief' | 'off';
      }
    }

    // Shell configuration environment overrides
    if (!this.config.shell) {
      this.config.shell = {
        allowedCommands: [],
        blockedCommands: [],
        requireConfirmation: true,
        autoApprovePatterns: [],
        maxExecutionTime: 30,
        allowComplexCommands: false,
        confirmationThreshold: 50,
        trustedCommands: [],
        alwaysBlockPatterns: [],
        confirmationTimeout: 30000,
        sessionMemory: true,
      };
    }

    if (process.env.AIYA_SHELL_CONFIRMATION_THRESHOLD) {
      const threshold = parseInt(
        process.env.AIYA_SHELL_CONFIRMATION_THRESHOLD,
        10
      );
      if (!isNaN(threshold) && threshold >= 0 && threshold <= 100) {
        this.config.shell.confirmationThreshold = threshold;
      }
    }

    if (process.env.AIYA_SHELL_CONFIRMATION_TIMEOUT) {
      const timeout = parseInt(process.env.AIYA_SHELL_CONFIRMATION_TIMEOUT, 10);
      if (!isNaN(timeout) && timeout > 0) {
        this.config.shell.confirmationTimeout = timeout;
      }
    }

    if (process.env.AIYA_SHELL_SESSION_MEMORY) {
      this.config.shell.sessionMemory =
        process.env.AIYA_SHELL_SESSION_MEMORY === 'true';
    }

    if (process.env.AIYA_SHELL_REQUIRE_CONFIRMATION) {
      this.config.shell.requireConfirmation =
        process.env.AIYA_SHELL_REQUIRE_CONFIRMATION === 'true';
    }

    if (process.env.AIYA_SHELL_ALLOW_COMPLEX_COMMANDS) {
      this.config.shell.allowComplexCommands =
        process.env.AIYA_SHELL_ALLOW_COMPLEX_COMMANDS === 'true';
    }

    if (process.env.AIYA_SHELL_MAX_EXECUTION_TIME) {
      const maxTime = parseInt(process.env.AIYA_SHELL_MAX_EXECUTION_TIME, 10);
      if (!isNaN(maxTime) && maxTime > 0) {
        this.config.shell.maxExecutionTime = maxTime;
      }
    }
  }

  private validateConfig(): void {
    const currentProvider = this.getCurrentProvider();

    if (!currentProvider.model) {
      throw new Error('Provider model is required');
    }

    // Only validate baseUrl for providers that require it
    if (
      this.requiresBaseUrl(currentProvider.type) &&
      !currentProvider.baseUrl
    ) {
      throw new Error(
        `Provider baseUrl is required for ${currentProvider.type}`
      );
    }

    if (this.config.security.maxFileSize <= 0) {
      throw new Error('Max file size must be positive');
    }

    // Validate shell configuration if present
    if (this.config.shell) {
      this.validateShellConfig();
    }
  }

  private validateShellConfig(): void {
    if (!this.config.shell) return;

    // Validate confirmationThreshold
    if (
      this.config.shell.confirmationThreshold < 0 ||
      this.config.shell.confirmationThreshold > 100
    ) {
      throw new Error(
        `Invalid confirmationThreshold: ${this.config.shell.confirmationThreshold}. Must be between 0 and 100.`
      );
    }

    // Validate confirmationTimeout
    if (this.config.shell.confirmationTimeout <= 0) {
      throw new Error(
        `Invalid confirmationTimeout: ${this.config.shell.confirmationTimeout}. Must be greater than 0.`
      );
    }

    // Validate maxExecutionTime
    if (this.config.shell.maxExecutionTime <= 0) {
      throw new Error(
        `Invalid maxExecutionTime: ${this.config.shell.maxExecutionTime}. Must be greater than 0.`
      );
    }

    // Validate array fields
    if (!Array.isArray(this.config.shell.allowedCommands)) {
      throw new Error('allowedCommands must be an array');
    }

    if (!Array.isArray(this.config.shell.blockedCommands)) {
      throw new Error('blockedCommands must be an array');
    }

    if (!Array.isArray(this.config.shell.autoApprovePatterns)) {
      throw new Error('autoApprovePatterns must be an array');
    }

    if (!Array.isArray(this.config.shell.trustedCommands)) {
      throw new Error('trustedCommands must be an array');
    }

    if (!Array.isArray(this.config.shell.alwaysBlockPatterns)) {
      throw new Error('alwaysBlockPatterns must be an array');
    }

    // Validate boolean fields
    if (typeof this.config.shell.requireConfirmation !== 'boolean') {
      throw new Error('requireConfirmation must be a boolean');
    }

    if (typeof this.config.shell.allowComplexCommands !== 'boolean') {
      throw new Error('allowComplexCommands must be a boolean');
    }

    if (typeof this.config.shell.sessionMemory !== 'boolean') {
      throw new Error('sessionMemory must be a boolean');
    }

    // Validate regex patterns in trustedCommands
    this.config.shell.trustedCommands.forEach((pattern, index) => {
      try {
        new RegExp(pattern);
      } catch (error) {
        throw new Error(
          `Invalid regex pattern in trustedCommands[${index}]: ${pattern}`
        );
      }
    });

    // Validate regex patterns in alwaysBlockPatterns
    this.config.shell.alwaysBlockPatterns.forEach((pattern, index) => {
      try {
        new RegExp(pattern);
      } catch (error) {
        throw new Error(
          `Invalid regex pattern in alwaysBlockPatterns[${index}]: ${pattern}`
        );
      }
    });

    // Validate regex patterns in autoApprovePatterns
    this.config.shell.autoApprovePatterns.forEach((pattern, index) => {
      try {
        new RegExp(pattern);
      } catch (error) {
        throw new Error(
          `Invalid regex pattern in autoApprovePatterns[${index}]: ${pattern}`
        );
      }
    });
  }

  private requiresBaseUrl(providerType: string): boolean {
    // Ollama always requires baseUrl (host URL)
    // OpenAI requires baseUrl for custom endpoints (but has default)
    // Gemini, Anthropic, Azure, Bedrock don't need baseUrl
    return providerType === 'ollama';
  }

  private mergeConfigs(
    base: AiyaConfig,
    override: Partial<AiyaConfig>
  ): AiyaConfig {
    const result = { ...base };

    if (override.provider) {
      result.provider = { ...result.provider, ...override.provider };

      // Merge provider-specific configurations
      if (override.provider.azure) {
        result.provider.azure = {
          ...result.provider.azure,
          ...override.provider.azure,
        };
      }
      if (override.provider.anthropic) {
        result.provider.anthropic = {
          ...result.provider.anthropic,
          ...override.provider.anthropic,
        };
      }
      if (override.provider.gemini) {
        result.provider.gemini = {
          ...result.provider.gemini,
          ...override.provider.gemini,
        };
      }
      if (override.provider.bedrock) {
        result.provider.bedrock = {
          ...result.provider.bedrock,
          ...override.provider.bedrock,
        };
      }
      if (override.provider.capabilities) {
        result.provider.capabilities = {
          ...result.provider.capabilities,
          ...override.provider.capabilities,
        };
      }
    }

    if (override.providers) {
      result.providers = { ...result.providers, ...override.providers };
    }

    if (override.current_provider !== undefined) {
      result.current_provider = override.current_provider;
    }

    if (override.security) {
      result.security = { ...result.security, ...override.security };
    }

    if (override.ui) {
      result.ui = { ...result.ui, ...override.ui };
    }

    if (override.mcp) {
      result.mcp = { ...result.mcp, ...override.mcp };
    }

    if (override.shell) {
      result.shell = { ...result.shell, ...override.shell };
    }

    if (override.max_tokens !== undefined) {
      result.max_tokens = override.max_tokens;
    }

    return result;
  }
}
