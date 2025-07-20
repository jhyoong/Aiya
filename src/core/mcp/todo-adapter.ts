import {
  MCPClient,
  Tool,
  ToolResult,
  MCPServerInfo,
  MCPToolError,
  Resource,
} from './base.js';

// Import the aiya-todo-mcp package
import {
  createTodoManager,
  CreateTodoRequest,
  UpdateTodoRequest,
  DeleteTodoRequest,
  ListTodosRequest,
  SetVerificationMethodRequest,
  UpdateVerificationStatusRequest,
  GetTodosNeedingVerificationRequest,
  TodoManager,
} from 'aiya-todo-mcp';

interface CreateTodoParams {
  title: string;
  description?: string;
  tags?: string[];
  groupId?: string;
  verificationMethod?: string;
}

interface UpdateTodoParams {
  id: string;
  title?: string;
  description?: string;
  completed?: boolean;
  tags?: string[];
  groupId?: string;
  verificationMethod?: string;
  verificationStatus?: 'pending' | 'verified' | 'failed';
  verificationNotes?: string;
}

interface GetTodoParams {
  id: string;
}

interface DeleteTodoParams {
  id: string;
}

interface ListTodosParams {
  completed?: boolean;
  limit?: number;
  offset?: number;
}

interface SetVerificationMethodParams {
  todoId: string;
  method: string;
  notes?: string;
}

interface UpdateVerificationStatusParams {
  todoId: string;
  status: 'pending' | 'verified' | 'failed';
  notes?: string;
}

interface GetTodosNeedingVerificationParams {
  groupId?: string;
}

/**
 * TodoMCPAdapter - Adapter for aiya-todo-mcp package
 *
 * Wraps the aiya-todo-mcp client to work with Aiya's MCP architecture.
 * Provides todo management tools that integrate seamlessly with Aiya's tool system.
 */
export class TodoMCPAdapter extends MCPClient {
  private todoManager: TodoManager;
  private isInitialized: boolean = false;

  constructor() {
    super('todo');
    this.todoManager = createTodoManager();
  }

  async connect(): Promise<void> {
    try {
      // Initialize the todo manager
      await this.todoManager.initialize();

      this.isInitialized = true;
      this.connected = true;
    } catch (error) {
      throw new Error(`Failed to connect to todo manager: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    // TodoManager doesn't need explicit cleanup
    this.isInitialized = false;
    this.connected = false;
  }

  async ping(): Promise<boolean> {
    return this.connected && this.isInitialized;
  }

  async getServerInfo(): Promise<MCPServerInfo> {
    return {
      name: 'Todo MCP Server',
      version: '1.0.0',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
      },
    };
  }

  async listTools(): Promise<Tool[]> {
    return [
      {
        name: 'CreateTodo',
        description: 'Create a new todo task',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'The title of the todo task',
            },
            description: {
              type: 'string',
              description: 'Optional description for the todo task',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional tags for categorizing the todo task',
            },
            groupId: {
              type: 'string',
              description: 'Optional group ID for organizing related todos',
            },
            verificationMethod: {
              type: 'string',
              description: 'Optional verification method for the todo task',
            },
          },
          required: ['title'],
        },
      },
      {
        name: 'ListTodos',
        description: 'List todo tasks with optional filtering',
        inputSchema: {
          type: 'object',
          properties: {
            completed: {
              type: 'boolean',
              description: 'Filter by completion status (optional)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of todos to return (optional)',
              default: 50,
            },
            offset: {
              type: 'number',
              description: 'Number of todos to skip (optional)',
              default: 0,
            },
          },
          required: [],
        },
      },
      {
        name: 'GetTodo',
        description: 'Get a specific todo task by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The ID of the todo task to retrieve',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'UpdateTodo',
        description: 'Update an existing todo task',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The ID of the todo task to update',
            },
            title: {
              type: 'string',
              description: 'New title for the todo task (optional)',
            },
            description: {
              type: 'string',
              description: 'New description for the todo task (optional)',
            },
            completed: {
              type: 'boolean',
              description: 'Mark the todo as completed or not (optional)',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Update tags for the todo task (optional)',
            },
            groupId: {
              type: 'string',
              description: 'Update group ID for the todo task (optional)',
            },
            verificationMethod: {
              type: 'string',
              description:
                'Update verification method for the todo task (optional)',
            },
            verificationStatus: {
              type: 'string',
              enum: ['pending', 'verified', 'failed'],
              description: 'Update verification status (optional)',
            },
            verificationNotes: {
              type: 'string',
              description: 'Update verification notes (optional)',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'DeleteTodo',
        description: 'Delete a todo task by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The ID of the todo task to delete',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'SetVerificationMethod',
        description: 'Set verification method for a todo task',
        inputSchema: {
          type: 'object',
          properties: {
            todoId: {
              type: 'string',
              description: 'The ID of the todo task',
            },
            method: {
              type: 'string',
              description: 'The verification method to set',
            },
            notes: {
              type: 'string',
              description: 'Optional notes about the verification method',
            },
          },
          required: ['todoId', 'method'],
        },
      },
      {
        name: 'UpdateVerificationStatus',
        description: 'Update verification status of a todo task',
        inputSchema: {
          type: 'object',
          properties: {
            todoId: {
              type: 'string',
              description: 'The ID of the todo task',
            },
            status: {
              type: 'string',
              enum: ['pending', 'verified', 'failed'],
              description: 'The verification status to set',
            },
            notes: {
              type: 'string',
              description: 'Optional notes about the verification status',
            },
          },
          required: ['todoId', 'status'],
        },
      },
      {
        name: 'GetTodosNeedingVerification',
        description: 'Get todos that need verification',
        inputSchema: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              description: 'Optional group ID to filter todos',
            },
          },
          required: [],
        },
      },
    ];
  }

  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    if (!this.isInitialized) {
      throw new MCPToolError(name, 'Todo server not initialized');
    }

    try {
      switch (name) {
        case 'CreateTodo':
          return await this.createTodo(this.validateCreateTodoParams(args));
        case 'ListTodos':
          return await this.listTodos(this.validateListTodosParams(args));
        case 'GetTodo':
          return await this.getTodo(this.validateGetTodoParams(args));
        case 'UpdateTodo':
          return await this.updateTodo(this.validateUpdateTodoParams(args));
        case 'DeleteTodo':
          return await this.deleteTodo(this.validateDeleteTodoParams(args));
        case 'SetVerificationMethod':
          return await this.setVerificationMethod(
            this.validateSetVerificationMethodParams(args)
          );
        case 'UpdateVerificationStatus':
          return await this.updateVerificationStatus(
            this.validateUpdateVerificationStatusParams(args)
          );
        case 'GetTodosNeedingVerification':
          return await this.getTodosNeedingVerification(
            this.validateGetTodosNeedingVerificationParams(args)
          );
        default:
          throw new MCPToolError(name, `Unknown tool: ${name}`);
      }
    } catch (error) {
      throw new MCPToolError(name, `Tool execution failed: ${error}`);
    }
  }

  async listResources(): Promise<Resource[]> {
    // Todo adapter doesn't provide resources
    return [];
  }

  async readResource(uri: string): Promise<ToolResult> {
    throw new Error(`Resource not found: ${uri}`);
  }

  // Validation methods
  private validateCreateTodoParams(
    args: Record<string, unknown>
  ): CreateTodoParams {
    if (!args.title || typeof args.title !== 'string') {
      throw new Error('Title is required and must be a string');
    }
    const params: CreateTodoParams = { title: args.title };

    if (args.description !== undefined) {
      if (typeof args.description !== 'string') {
        throw new Error('Description must be a string');
      }
      params.description = args.description;
    }

    if (args.tags !== undefined) {
      if (
        !Array.isArray(args.tags) ||
        !args.tags.every(tag => typeof tag === 'string')
      ) {
        throw new Error('Tags must be an array of strings');
      }
      params.tags = args.tags;
    }

    if (args.groupId !== undefined) {
      if (typeof args.groupId !== 'string') {
        throw new Error('GroupId must be a string');
      }
      params.groupId = args.groupId;
    }

    if (args.verificationMethod !== undefined) {
      if (typeof args.verificationMethod !== 'string') {
        throw new Error('VerificationMethod must be a string');
      }
      params.verificationMethod = args.verificationMethod;
    }

    return params;
  }

  private validateListTodosParams(
    args: Record<string, unknown>
  ): ListTodosParams {
    const params: ListTodosParams = {};
    if (args.completed !== undefined) {
      if (typeof args.completed !== 'boolean') {
        throw new Error('Completed must be a boolean');
      }
      params.completed = args.completed;
    }
    if (args.limit !== undefined) {
      if (typeof args.limit !== 'number') {
        throw new Error('Limit must be a number');
      }
      params.limit = args.limit;
    }
    if (args.offset !== undefined) {
      if (typeof args.offset !== 'number') {
        throw new Error('Offset must be a number');
      }
      params.offset = args.offset;
    }
    return params;
  }

  private validateGetTodoParams(args: Record<string, unknown>): GetTodoParams {
    if (!args.id || typeof args.id !== 'string') {
      throw new Error('ID is required and must be a string');
    }
    return { id: args.id };
  }

  private validateUpdateTodoParams(
    args: Record<string, unknown>
  ): UpdateTodoParams {
    if (!args.id || typeof args.id !== 'string') {
      throw new Error('ID is required and must be a string');
    }
    const params: UpdateTodoParams = { id: args.id };

    if (args.title !== undefined) {
      if (typeof args.title !== 'string') {
        throw new Error('Title must be a string');
      }
      params.title = args.title;
    }

    if (args.description !== undefined) {
      if (typeof args.description !== 'string') {
        throw new Error('Description must be a string');
      }
      params.description = args.description;
    }

    if (args.completed !== undefined) {
      if (typeof args.completed !== 'boolean') {
        throw new Error('Completed must be a boolean');
      }
      params.completed = args.completed;
    }

    if (args.tags !== undefined) {
      if (
        !Array.isArray(args.tags) ||
        !args.tags.every(tag => typeof tag === 'string')
      ) {
        throw new Error('Tags must be an array of strings');
      }
      params.tags = args.tags;
    }

    if (args.groupId !== undefined) {
      if (typeof args.groupId !== 'string') {
        throw new Error('GroupId must be a string');
      }
      params.groupId = args.groupId;
    }

    if (args.verificationMethod !== undefined) {
      if (typeof args.verificationMethod !== 'string') {
        throw new Error('VerificationMethod must be a string');
      }
      params.verificationMethod = args.verificationMethod;
    }

    if (args.verificationStatus !== undefined) {
      if (
        typeof args.verificationStatus !== 'string' ||
        !['pending', 'verified', 'failed'].includes(args.verificationStatus)
      ) {
        throw new Error(
          'VerificationStatus must be one of: pending, verified, failed'
        );
      }
      params.verificationStatus = args.verificationStatus as
        | 'pending'
        | 'verified'
        | 'failed';
    }

    if (args.verificationNotes !== undefined) {
      if (typeof args.verificationNotes !== 'string') {
        throw new Error('VerificationNotes must be a string');
      }
      params.verificationNotes = args.verificationNotes;
    }

    return params;
  }

  private validateDeleteTodoParams(
    args: Record<string, unknown>
  ): DeleteTodoParams {
    if (!args.id || typeof args.id !== 'string') {
      throw new Error('ID is required and must be a string');
    }
    return { id: args.id };
  }

  private validateSetVerificationMethodParams(
    args: Record<string, unknown>
  ): SetVerificationMethodParams {
    if (!args.todoId || typeof args.todoId !== 'string') {
      throw new Error('TodoId is required and must be a string');
    }
    if (!args.method || typeof args.method !== 'string') {
      throw new Error('Method is required and must be a string');
    }
    const params: SetVerificationMethodParams = {
      todoId: args.todoId,
      method: args.method,
    };

    if (args.notes !== undefined) {
      if (typeof args.notes !== 'string') {
        throw new Error('Notes must be a string');
      }
      params.notes = args.notes;
    }

    return params;
  }

  private validateUpdateVerificationStatusParams(
    args: Record<string, unknown>
  ): UpdateVerificationStatusParams {
    if (!args.todoId || typeof args.todoId !== 'string') {
      throw new Error('TodoId is required and must be a string');
    }
    if (
      !args.status ||
      typeof args.status !== 'string' ||
      !['pending', 'verified', 'failed'].includes(args.status)
    ) {
      throw new Error(
        'Status is required and must be one of: pending, verified, failed'
      );
    }
    const params: UpdateVerificationStatusParams = {
      todoId: args.todoId,
      status: args.status as 'pending' | 'verified' | 'failed',
    };

    if (args.notes !== undefined) {
      if (typeof args.notes !== 'string') {
        throw new Error('Notes must be a string');
      }
      params.notes = args.notes;
    }

    return params;
  }

  private validateGetTodosNeedingVerificationParams(
    args: Record<string, unknown>
  ): GetTodosNeedingVerificationParams {
    const params: GetTodosNeedingVerificationParams = {};

    if (args.groupId !== undefined) {
      if (typeof args.groupId !== 'string') {
        throw new Error('GroupId must be a string');
      }
      params.groupId = args.groupId;
    }

    return params;
  }

  // Private methods for tool implementations
  private async createTodo(params: CreateTodoParams): Promise<ToolResult> {
    try {
      const request: CreateTodoRequest = { title: params.title };
      if (params.description !== undefined)
        request.description = params.description;
      if (params.tags !== undefined) request.tags = params.tags;
      if (params.groupId !== undefined) request.groupId = params.groupId;
      if (params.verificationMethod !== undefined)
        request.verificationMethod = params.verificationMethod;

      const result = await this.todoManager.createTodo(request);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating todo: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async listTodos(params: ListTodosParams): Promise<ToolResult> {
    try {
      const request: ListTodosRequest = {};
      if (params.completed !== undefined) {
        request.completed = params.completed;
      }

      let result = this.todoManager.listTodos(request);

      // Apply limit and offset if specified
      if (params.offset !== undefined) {
        result = result.slice(params.offset);
      }
      if (params.limit !== undefined) {
        result = result.slice(0, params.limit);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing todos: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async getTodo(params: GetTodoParams): Promise<ToolResult> {
    try {
      const result = this.todoManager.getTodo(params.id);

      if (!result) {
        return {
          content: [
            {
              type: 'text',
              text: `Todo with id '${params.id}' not found`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting todo: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async updateTodo(params: UpdateTodoParams): Promise<ToolResult> {
    try {
      const request: UpdateTodoRequest = { id: params.id };
      if (params.title !== undefined) request.title = params.title;
      if (params.description !== undefined)
        request.description = params.description;
      if (params.completed !== undefined) request.completed = params.completed;
      if (params.tags !== undefined) request.tags = params.tags;
      if (params.groupId !== undefined) request.groupId = params.groupId;
      if (params.verificationMethod !== undefined)
        request.verificationMethod = params.verificationMethod;
      if (params.verificationStatus !== undefined)
        request.verificationStatus = params.verificationStatus;
      if (params.verificationNotes !== undefined)
        request.verificationNotes = params.verificationNotes;

      const result = await this.todoManager.updateTodo(request);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error updating todo: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async deleteTodo(params: DeleteTodoParams): Promise<ToolResult> {
    try {
      const request: DeleteTodoRequest = { id: params.id };
      const result = await this.todoManager.deleteTodo(request);

      return {
        content: [
          {
            type: 'text',
            text: result ? 'Todo deleted successfully' : 'Todo not found',
          },
        ],
        isError: !result,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error deleting todo: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async setVerificationMethod(
    params: SetVerificationMethodParams
  ): Promise<ToolResult> {
    try {
      const request: SetVerificationMethodRequest = {
        todoId: params.todoId,
        method: params.method,
      };
      if (params.notes !== undefined) request.notes = params.notes;

      const result = await this.todoManager.setVerificationMethod(request);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error setting verification method: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async updateVerificationStatus(
    params: UpdateVerificationStatusParams
  ): Promise<ToolResult> {
    try {
      const request: UpdateVerificationStatusRequest = {
        todoId: params.todoId,
        status: params.status,
      };
      if (params.notes !== undefined) request.notes = params.notes;

      const result = await this.todoManager.updateVerificationStatus(request);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error updating verification status: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async getTodosNeedingVerification(
    params: GetTodosNeedingVerificationParams
  ): Promise<ToolResult> {
    try {
      const request: GetTodosNeedingVerificationRequest = {};
      if (params.groupId !== undefined) request.groupId = params.groupId;

      const result = this.todoManager.getTodosNeedingVerification(request);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting todos needing verification: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  // Getter for todo manager access (following shell client pattern)
  getTodoManager(): TodoManager {
    return this.todoManager;
  }
}
