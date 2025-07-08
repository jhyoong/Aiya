import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';

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
  provider: ExtendedProviderConfig;
  providers?: Record<string, ExtendedProviderConfig>; // Named provider configurations
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
  max_tokens?: number;
}

// Flat config format for project files
export interface FlatConfig {
  provider?: string;
  model?: string;
  endpoint?: string;
  workspace?: string;
  max_tokens?: number;
  apiKey?: string;
  azure_deployment?: string;
  azure_api_version?: string;
  anthropic_version?: string;
  gemini_project_id?: string;
  gemini_location?: string;
  aws_region?: string;
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
  aws_session_token?: string;
}

const DEFAULT_CONFIG: AiyaConfig = {
  provider: {
    type: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:8b',
    capabilities: {
      maxTokens: 4096,
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsStreaming: true,
      supportsThinking: false
    }
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
    theme: 'auto',
    thinking: 'on'
  },
  mcp: {
    servers: []
  },
  max_tokens: 4096
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
      max_tokens: 8192
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
    if (process.env.AIYA_PROVIDER) {
      const providerType = process.env.AIYA_PROVIDER.toLowerCase();
      if (['ollama', 'openai', 'anthropic', 'azure', 'gemini', 'bedrock'].includes(providerType)) {
        this.config.provider.type = providerType as ExtendedProviderConfig['type'];
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
    
    if (process.env.ANTHROPIC_API_KEY && this.config.provider.type === 'anthropic') {
      this.config.provider.apiKey = process.env.ANTHROPIC_API_KEY;
    }
    
    if (process.env.AZURE_OPENAI_API_KEY && this.config.provider.type === 'azure') {
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
          ...this.config.provider.bedrock
        };
      }
      
      if (process.env.AWS_ACCESS_KEY_ID) {
        this.config.provider.bedrock = {
          region: this.config.provider.bedrock?.region || 'us-east-1',
          ...this.config.provider.bedrock,
          accessKeyId: process.env.AWS_ACCESS_KEY_ID
        };
      }
      
      if (process.env.AWS_SECRET_ACCESS_KEY) {
        this.config.provider.bedrock = {
          region: this.config.provider.bedrock?.region || 'us-east-1',
          ...this.config.provider.bedrock,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        };
      }
      
      if (process.env.AWS_SESSION_TOKEN) {
        this.config.provider.bedrock = {
          region: this.config.provider.bedrock?.region || 'us-east-1',
          ...this.config.provider.bedrock,
          sessionToken: process.env.AWS_SESSION_TOKEN
        };
      }
    }
    
    if (process.env.AIYA_STREAMING) {
      this.config.ui.streaming = process.env.AIYA_STREAMING === 'true';
    }
    
    if (process.env.AIYA_THINKING) {
      const thinkingMode = process.env.AIYA_THINKING.toLowerCase();
      if (thinkingMode === 'on' || thinkingMode === 'brief' || thinkingMode === 'off') {
        this.config.ui.thinking = thinkingMode as 'on' | 'brief' | 'off';
      }
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
      const providerType = flatConfig.provider?.toLowerCase() as ExtendedProviderConfig['type'] || 'ollama';
      const provider: ExtendedProviderConfig = {
        type: providerType,
        baseUrl: flatConfig.endpoint || DEFAULT_CONFIG.provider.baseUrl,
        model: flatConfig.model || DEFAULT_CONFIG.provider.model
      };
      
      if (flatConfig.apiKey) {
        provider.apiKey = flatConfig.apiKey;
      }
      
      // Handle provider-specific configurations
      if (providerType === 'azure' && (flatConfig.azure_deployment || flatConfig.azure_api_version)) {
        provider.azure = {
          ...(flatConfig.azure_deployment && { deploymentName: flatConfig.azure_deployment }),
          ...(flatConfig.azure_api_version && { apiVersion: flatConfig.azure_api_version })
        };
      }
      
      if (providerType === 'anthropic' && flatConfig.anthropic_version) {
        provider.anthropic = {
          version: flatConfig.anthropic_version
        };
      }
      
      if (providerType === 'gemini' && (flatConfig.gemini_project_id || flatConfig.gemini_location)) {
        provider.gemini = {
          ...(flatConfig.gemini_project_id && { projectId: flatConfig.gemini_project_id }),
          ...(flatConfig.gemini_location && { location: flatConfig.gemini_location })
        };
      }
      
      if (providerType === 'bedrock' && (flatConfig.aws_region || flatConfig.aws_access_key_id || flatConfig.aws_secret_access_key)) {
        provider.bedrock = {
          region: flatConfig.aws_region || 'us-east-1',
          ...(flatConfig.aws_access_key_id && { accessKeyId: flatConfig.aws_access_key_id }),
          ...(flatConfig.aws_secret_access_key && { secretAccessKey: flatConfig.aws_secret_access_key }),
          ...(flatConfig.aws_session_token && { sessionToken: flatConfig.aws_session_token })
        };
      }
      
      normalized.provider = provider;
    }
    
    if (flatConfig.max_tokens !== undefined) {
      normalized.max_tokens = flatConfig.max_tokens;
    }
    
    return normalized;
  }

  private mergeConfigs(base: AiyaConfig, override: Partial<AiyaConfig>): AiyaConfig {
    const result = { ...base };
    
    if (override.provider) {
      result.provider = { ...result.provider, ...override.provider };
      
      // Merge provider-specific configurations
      if (override.provider.azure) {
        result.provider.azure = { ...result.provider.azure, ...override.provider.azure };
      }
      if (override.provider.anthropic) {
        result.provider.anthropic = { ...result.provider.anthropic, ...override.provider.anthropic };
      }
      if (override.provider.gemini) {
        result.provider.gemini = { ...result.provider.gemini, ...override.provider.gemini };
      }
      if (override.provider.bedrock) {
        result.provider.bedrock = { ...result.provider.bedrock, ...override.provider.bedrock };
      }
      if (override.provider.capabilities) {
        result.provider.capabilities = { ...result.provider.capabilities, ...override.provider.capabilities };
      }
    }
    
    if (override.providers) {
      result.providers = { ...result.providers, ...override.providers };
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
    
    if (override.max_tokens !== undefined) {
      result.max_tokens = override.max_tokens;
    }
    
    return result;
  }
}