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
  constructor(
    message: string,
    public code?: number,
    public override cause?: Error
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class MCPConnectionError extends MCPError {
  constructor(serverName: string, cause?: Error) {
    super(`Failed to connect to MCP server: ${serverName}`);
    this.name = 'MCPConnectionError';
    this.cause = cause;
  }
}

export class MCPToolError extends MCPError {
  constructor(toolName: string, message: string, cause?: Error) {
    super(`Tool '${toolName}' error: ${message}`);
    this.name = 'MCPToolError';
    this.cause = cause;
  }
}

export class MCPResourceError extends MCPError {
  constructor(uri: string, message: string, cause?: Error) {
    super(`Resource '${uri}' error: ${message}`);
    this.name = 'MCPResourceError';
    this.cause = cause;
  }
}
