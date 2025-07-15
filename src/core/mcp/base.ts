export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
}

export abstract class MCPClient {
  protected serverName: string;
  protected connected: boolean = false;

  constructor(serverName: string) {
    this.serverName = serverName;
  }

  abstract connect(): Promise<void>;

  abstract disconnect(): Promise<void>;

  abstract ping(): Promise<boolean>;

  abstract getServerInfo(): Promise<MCPServerInfo>;

  abstract listTools(): Promise<Tool[]>;

  abstract callTool(
    name: string,
    args: Record<string, any>
  ): Promise<ToolResult>;

  abstract listResources(): Promise<Resource[]>;

  abstract readResource(uri: string): Promise<ToolResult>;

  isConnected(): boolean {
    return this.connected;
  }

  getServerName(): string {
    return this.serverName;
  }
}

export class MCPError extends Error {
  public code?: number | undefined;
  public override cause?: Error | undefined;
  
  constructor(
    message: string,
    code?: number | undefined,
    cause?: Error | undefined
  ) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.cause = cause;
  }
}

export class MCPConnectionError extends MCPError {
  constructor(serverName: string, cause?: Error | undefined) {
    super(`Failed to connect to MCP server: ${serverName}`, undefined, cause);
    this.name = 'MCPConnectionError';
  }
}

export class MCPToolError extends MCPError {
  constructor(toolName: string, message: string, cause?: Error | undefined) {
    super(`Tool '${toolName}' error: ${message}`, undefined, cause);
    this.name = 'MCPToolError';
  }
}

export class MCPResourceError extends MCPError {
  constructor(uri: string, message: string, cause?: Error | undefined) {
    super(`Resource '${uri}' error: ${message}`, undefined, cause);
    this.name = 'MCPResourceError';
  }
}

export class FileSystemError extends Error {
  constructor(
    message: string,
    public code:
      | 'PERMISSION_DENIED'
      | 'FILE_NOT_FOUND'
      | 'PATH_TRAVERSAL'
      | 'DISK_FULL',
    public path: string,
    public suggestion?: string
  ) {
    super(message);
    this.name = 'FileSystemError';
  }
}
