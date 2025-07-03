import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';

export interface AiyaConfig {
  provider: {
    type: 'ollama';
    baseUrl: string;
    model: string;
  };
  security: {
    allowedExtensions: string[];
    restrictToWorkspace: boolean;
    maxFileSize: number;
  };
  ui: {
    streaming: boolean;
    showTokens: boolean;
    theme: 'auto' | 'light' | 'dark';
  };
  mcp: {
    servers: Array<{
      name: string;
      command: string;
      args?: string[];
      cwd?: string;
    }>;
  };
}

// Flat config format for project files
export interface FlatConfig {
  provider?: string;
  model?: string;
  endpoint?: string;
  workspace?: string;
  max_tokens?: number;
}

const DEFAULT_CONFIG: AiyaConfig = {
  provider: {
    type: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:8b'
  },
  security: {
    allowedExtensions: [
      '.ts', '.js', '.tsx', '.jsx',
      '.py', '.rs', '.go', '.java',
      '.c', '.cpp', '.h', '.hpp',
      '.md', '.txt', '.json', '.yaml', '.yml',
      '.html', '.css', '.scss', '.sass',
      '.sql', '.sh', '.bash'
    ],
    restrictToWorkspace: true,
    maxFileSize: 1024 * 1024 // 1MB
  },
  ui: {
    streaming: true,
    showTokens: true,
    theme: 'auto'
  },
  mcp: {
    servers: []
  }
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
      lineWidth: 80
    });
    
    await fs.writeFile(this.configPath, yamlContent, 'utf8');
  }

  async init(model?: string, baseUrl?: string): Promise<void> {
    const initConfig: Partial<AiyaConfig> = {
      provider: {
        ...DEFAULT_CONFIG.provider,
        ...(model && { model }),
        ...(baseUrl && { baseUrl })
      }
    };

    await this.save(initConfig);
    
    const projectConfigPath = path.join(process.cwd(), '.aiya.yaml');
    
    // Create simplified flat config format for project file
    const projectConfig = {
      provider: 'ollama',
      model: model || DEFAULT_CONFIG.provider.model,
      endpoint: baseUrl || DEFAULT_CONFIG.provider.baseUrl,
      workspace: './',
      max_tokens: 4096
    };

    const yamlContent = yaml.stringify(projectConfig, {
      indent: 2,
      lineWidth: 80
    });

    await fs.writeFile(projectConfigPath, yamlContent, 'utf8');
  }

  getConfig(): AiyaConfig {
    return { ...this.config };
  }

  private async detectProjectConfig(): Promise<void> {
    const cwd = process.cwd();
    const possiblePaths = [
      path.join(cwd, '.aiya.yaml'),
      path.join(cwd, '.aiya.yml'),
      path.join(cwd, 'aiya.config.yaml'),
      path.join(cwd, 'aiya.config.yml')
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
      
      // Handle both flat and nested config formats
      const projectConfig = this.normalizeConfig(rawConfig);
      this.config = this.mergeConfigs(this.config, projectConfig);
    } catch (error) {
      console.warn(`Failed to load project config from ${this.projectConfigPath}: ${error}`);
    }
  }

  private applyEnvironmentOverrides(): void {
    if (process.env.AIYA_MODEL) {
      this.config.provider.model = process.env.AIYA_MODEL;
    }
    
    if (process.env.AIYA_BASE_URL) {
      this.config.provider.baseUrl = process.env.AIYA_BASE_URL;
    }
    
    if (process.env.AIYA_STREAMING) {
      this.config.ui.streaming = process.env.AIYA_STREAMING === 'true';
    }
  }

  private validateConfig(): void {
    if (!this.config.provider.model) {
      throw new Error('Provider model is required');
    }
    
    if (!this.config.provider.baseUrl) {
      throw new Error('Provider baseUrl is required');
    }
    
    if (this.config.security.maxFileSize <= 0) {
      throw new Error('Max file size must be positive');
    }
  }

  private normalizeConfig(rawConfig: any): Partial<AiyaConfig> {
    // If it's already in the nested format, return as-is
    if (rawConfig.provider && typeof rawConfig.provider === 'object') {
      return rawConfig as Partial<AiyaConfig>;
    }
    
    // Handle flat format
    const flatConfig = rawConfig as FlatConfig;
    const normalized: Partial<AiyaConfig> = {};
    
    if (flatConfig.provider || flatConfig.model || flatConfig.endpoint) {
      normalized.provider = {
        type: 'ollama' as const,
        baseUrl: flatConfig.endpoint || DEFAULT_CONFIG.provider.baseUrl,
        model: flatConfig.model || DEFAULT_CONFIG.provider.model
      };
    }
    
    return normalized;
  }

  private mergeConfigs(base: AiyaConfig, override: Partial<AiyaConfig>): AiyaConfig {
    const result = { ...base };
    
    if (override.provider) {
      result.provider = { ...result.provider, ...override.provider };
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
    
    return result;
  }
}