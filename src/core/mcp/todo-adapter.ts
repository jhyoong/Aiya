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
  TodoManager,
} from 'aiya-todo-mcp';

interface CreateTodoParams {
  title: string;
}

interface UpdateTodoParams {
  id: string;
  title?: string;
  completed?: boolean;
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
    return { title: args.title };
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
    if (args.completed !== undefined) {
      if (typeof args.completed !== 'boolean') {
        throw new Error('Completed must be a boolean');
      }
      params.completed = args.completed;
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

  // Private methods for tool implementations
  private async createTodo(params: CreateTodoParams): Promise<ToolResult> {
    try {
      const request: CreateTodoRequest = { title: params.title };
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
      if (params.completed !== undefined) request.completed = params.completed;

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

  // Getter for todo manager access (following shell client pattern)
  getTodoManager(): TodoManager {
    return this.todoManager;
  }
}
