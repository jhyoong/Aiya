import { describe, it, expect, beforeEach } from 'vitest';
import { TodoMCPAdapter } from '../../../src/core/mcp/todo-adapter.js';

describe('TodoMCPAdapter', () => {
  let adapter: TodoMCPAdapter;

  beforeEach(() => {
    adapter = new TodoMCPAdapter();
  });

  describe('Constructor and Basic Properties', () => {
    it('should create an instance without errors', () => {
      expect(adapter).toBeInstanceOf(TodoMCPAdapter);
    });

    it('should not be connected initially', () => {
      expect(adapter.connected).toBe(false);
    });

    it('should return false for ping when not connected', async () => {
      const result = await adapter.ping();
      expect(result).toBe(false);
    });
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      await adapter.connect();
      expect(adapter.connected).toBe(true);
    });

    it('should return true for ping when connected', async () => {
      await adapter.connect();
      const result = await adapter.ping();
      expect(result).toBe(true);
    });

    it('should disconnect successfully', async () => {
      await adapter.connect();
      await adapter.disconnect();
      expect(adapter.connected).toBe(false);
    });
  });

  describe('Server Info', () => {
    it('should return correct server info', async () => {
      const serverInfo = await adapter.getServerInfo();
      expect(serverInfo).toEqual({
        name: 'Todo MCP Server',
        version: '1.0.0',
        capabilities: {
          tools: true,
          resources: false,
          prompts: false,
        },
      });
    });
  });

  describe('Tool Listing', () => {
    it('should list all expected tools', async () => {
      const tools = await adapter.listTools();
      const toolNames = tools.map(tool => tool.name);

      expect(toolNames).toContain('CreateTodo');
      expect(toolNames).toContain('ListTodos');
      expect(toolNames).toContain('GetTodo');
      expect(toolNames).toContain('UpdateTodo');
      expect(toolNames).toContain('DeleteTodo');
      expect(toolNames).toContain('SetVerificationMethod');
      expect(toolNames).toContain('UpdateVerificationStatus');
      expect(toolNames).toContain('GetTodosNeedingVerification');
    });

    it('should have correct CreateTodo tool schema', async () => {
      const tools = await adapter.listTools();
      const createTodo = tools.find(tool => tool.name === 'CreateTodo');

      expect(createTodo).toBeDefined();
      expect(createTodo?.inputSchema.properties).toHaveProperty('title');
      expect(createTodo?.inputSchema.properties).toHaveProperty('description');
      expect(createTodo?.inputSchema.properties).toHaveProperty('tags');
      expect(createTodo?.inputSchema.properties).toHaveProperty('groupId');
      expect(createTodo?.inputSchema.properties).toHaveProperty(
        'verificationMethod'
      );
      expect(createTodo?.inputSchema.required).toEqual(['title']);
    });

    it('should have correct UpdateTodo tool schema', async () => {
      const tools = await adapter.listTools();
      const updateTodo = tools.find(tool => tool.name === 'UpdateTodo');

      expect(updateTodo).toBeDefined();
      expect(updateTodo?.inputSchema.properties).toHaveProperty('id');
      expect(updateTodo?.inputSchema.properties).toHaveProperty('title');
      expect(updateTodo?.inputSchema.properties).toHaveProperty('description');
      expect(updateTodo?.inputSchema.properties).toHaveProperty('completed');
      expect(updateTodo?.inputSchema.properties).toHaveProperty('tags');
      expect(updateTodo?.inputSchema.properties).toHaveProperty('groupId');
      expect(updateTodo?.inputSchema.properties).toHaveProperty(
        'verificationMethod'
      );
      expect(updateTodo?.inputSchema.properties).toHaveProperty(
        'verificationStatus'
      );
      expect(updateTodo?.inputSchema.properties).toHaveProperty(
        'verificationNotes'
      );
      expect(updateTodo?.inputSchema.required).toEqual(['id']);
    });

    it('should have correct verification tool schemas', async () => {
      const tools = await adapter.listTools();

      const setVerification = tools.find(
        tool => tool.name === 'SetVerificationMethod'
      );
      expect(setVerification).toBeDefined();
      expect(setVerification?.inputSchema.required).toEqual([
        'todoId',
        'method',
      ]);

      const updateStatus = tools.find(
        tool => tool.name === 'UpdateVerificationStatus'
      );
      expect(updateStatus).toBeDefined();
      expect(updateStatus?.inputSchema.required).toEqual(['todoId', 'status']);

      const getNeedingVerification = tools.find(
        tool => tool.name === 'GetTodosNeedingVerification'
      );
      expect(getNeedingVerification).toBeDefined();
      expect(getNeedingVerification?.inputSchema.required).toEqual([]);
    });
  });

  describe('Tool Execution - Validation', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it('should validate CreateTodo parameters correctly', async () => {
      // Test missing title
      await expect(adapter.callTool('CreateTodo', {})).rejects.toThrow(
        'Title is required and must be a string'
      );

      // Test invalid title type
      await expect(
        adapter.callTool('CreateTodo', { title: 123 })
      ).rejects.toThrow('Title is required and must be a string');

      // Test invalid tags type
      await expect(
        adapter.callTool('CreateTodo', { title: 'Test', tags: 'not-array' })
      ).rejects.toThrow('Tags must be an array of strings');

      // Test invalid tags content
      await expect(
        adapter.callTool('CreateTodo', { title: 'Test', tags: [123] })
      ).rejects.toThrow('Tags must be an array of strings');
    });

    it('should validate UpdateTodo parameters correctly', async () => {
      // Test missing id
      await expect(adapter.callTool('UpdateTodo', {})).rejects.toThrow(
        'ID is required and must be a string'
      );

      // Test invalid verificationStatus
      await expect(
        adapter.callTool('UpdateTodo', {
          id: 'test-id',
          verificationStatus: 'invalid-status',
        })
      ).rejects.toThrow(
        'VerificationStatus must be one of: pending, verified, failed'
      );
    });

    it('should validate SetVerificationMethod parameters correctly', async () => {
      // Test missing todoId
      await expect(
        adapter.callTool('SetVerificationMethod', { method: 'test' })
      ).rejects.toThrow('TodoId is required and must be a string');

      // Test missing method
      await expect(
        adapter.callTool('SetVerificationMethod', { todoId: 'test-id' })
      ).rejects.toThrow('Method is required and must be a string');
    });

    it('should validate UpdateVerificationStatus parameters correctly', async () => {
      // Test missing todoId
      await expect(
        adapter.callTool('UpdateVerificationStatus', { status: 'pending' })
      ).rejects.toThrow('TodoId is required and must be a string');

      // Test invalid status
      await expect(
        adapter.callTool('UpdateVerificationStatus', {
          todoId: 'test-id',
          status: 'invalid',
        })
      ).rejects.toThrow(
        'Status is required and must be one of: pending, verified, failed'
      );
    });

    it('should throw error for unknown tool', async () => {
      await expect(adapter.callTool('UnknownTool', {})).rejects.toThrow(
        'Unknown tool: UnknownTool'
      );
    });

    it('should throw error when not initialized', async () => {
      const uninitializedAdapter = new TodoMCPAdapter();
      await expect(
        uninitializedAdapter.callTool('CreateTodo', { title: 'Test' })
      ).rejects.toThrow('Todo server not initialized');
    });
  });

  describe('Resource Handling', () => {
    it('should return empty resources list', async () => {
      const resources = await adapter.listResources();
      expect(resources).toEqual([]);
    });

    it('should throw error for resource reading', async () => {
      await expect(adapter.readResource('test-uri')).rejects.toThrow(
        'Resource not found: test-uri'
      );
    });
  });

  describe('TodoManager Access', () => {
    it('should provide access to TodoManager', () => {
      const todoManager = adapter.getTodoManager();
      expect(todoManager).toBeDefined();
      expect(typeof todoManager.createTodo).toBe('function');
      expect(typeof todoManager.updateTodo).toBe('function');
      expect(typeof todoManager.deleteTodo).toBe('function');
      expect(typeof todoManager.setVerificationMethod).toBe('function');
      expect(typeof todoManager.updateVerificationStatus).toBe('function');
      expect(typeof todoManager.getTodosNeedingVerification).toBe('function');
    });
  });
});
