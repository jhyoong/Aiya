import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ToolExecutor } from '../../../src/core/tools/executor.js';
import { ToolMemoryService } from '../../../src/core/tools/memory.js';
import { MCPToolService } from '../../../src/core/tools/mcp-tools.js';
import { ToolCall, Message } from '../../../src/core/providers/base.js';

// Mock MCPToolService
vi.mock('../../../src/core/tools/mcp-tools.js', () => ({
  MCPToolService: vi.fn().mockImplementation(() => ({
    detectToolCalls: vi.fn(),
    executeTool: vi.fn(),
  })),
}));

describe('ToolExecutor Memory Integration', () => {
  let toolExecutor: ToolExecutor;
  let memoryService: ToolMemoryService;
  let mockMCPService: MCPToolService;
  let confirmationCallback: ReturnType<typeof vi.fn>;

  const sampleToolCalls: ToolCall[] = [
    { name: 'read-file', arguments: { path: '/test/file.txt' } },
    {
      name: 'write-file',
      arguments: { path: '/test/output.txt', content: 'test' },
    },
  ];

  const sampleMessage: Message = {
    role: 'assistant',
    content: 'I will read and write files for you.',
  };

  beforeEach(() => {
    memoryService = new ToolMemoryService();
    mockMCPService = new MCPToolService([]);
    confirmationCallback = vi.fn();

    toolExecutor = new ToolExecutor(
      mockMCPService,
      false, // verbose = false
      confirmationCallback,
      memoryService
    );

    // Setup default mocks
    vi.mocked(mockMCPService.detectToolCalls).mockReturnValue(sampleToolCalls);
    vi.mocked(mockMCPService.executeTool).mockResolvedValue({
      toolCallId: 'test-id',
      result: 'success',
      isError: false,
    });
  });

  describe('Memory Integration', () => {
    test('should store tool preferences via storeToolPreference method', () => {
      toolExecutor.storeToolPreference('read-file', 'allow');

      expect(memoryService.getPreference('read-file')).toBe('allow');
      expect(memoryService.hasPreference('read-file')).toBe(true);
    });

    test('should provide access to memory service', () => {
      const retrievedMemoryService = toolExecutor.getMemoryService();

      expect(retrievedMemoryService).toBe(memoryService);
    });

    test('should use provided memory service or create new one', () => {
      // Test with provided memory service
      const customMemory = new ToolMemoryService();
      customMemory.setPreference('test-tool', 'allow');

      const executorWithMemory = new ToolExecutor(
        mockMCPService,
        false,
        undefined,
        customMemory
      );
      expect(executorWithMemory.getMemoryService()).toBe(customMemory);
      expect(
        executorWithMemory.getMemoryService().getPreference('test-tool')
      ).toBe('allow');

      // Test without provided memory service (should create new one)
      const executorWithoutMemory = new ToolExecutor(mockMCPService, false);
      expect(executorWithoutMemory.getMemoryService()).toBeInstanceOf(
        ToolMemoryService
      );
      expect(
        executorWithoutMemory.getMemoryService().getPreference('test-tool')
      ).toBeNull();
    });
  });

  describe('Auto-Allow Behavior', () => {
    test('should auto-allow tools with stored "allow" preference', async () => {
      // Store allow preference for both tools
      memoryService.setPreference('read-file', 'allow');
      memoryService.setPreference('write-file', 'allow');

      const result = await toolExecutor.processMessage(sampleMessage);

      // Should execute without calling confirmation callback
      expect(confirmationCallback).not.toHaveBeenCalled();
      expect(result.hasToolCalls).toBe(true);
      expect(result.toolResults).toHaveLength(2);
      expect(vi.mocked(mockMCPService.executeTool)).toHaveBeenCalledTimes(2);
    });

    test('should auto-allow only some tools when partially stored', async () => {
      // Only store preference for one tool
      memoryService.setPreference('read-file', 'allow');
      confirmationCallback.mockResolvedValue(true);

      const result = await toolExecutor.processMessage(sampleMessage);

      // Should ask for confirmation for the tool without stored preference
      expect(confirmationCallback).toHaveBeenCalledWith([
        {
          name: 'write-file',
          arguments: { path: '/test/output.txt', content: 'test' },
        },
      ]);
      expect(result.hasToolCalls).toBe(true);
      expect(result.toolResults).toHaveLength(2);
    });

    test('should execute all tools when user confirms unknown tools', async () => {
      memoryService.setPreference('read-file', 'allow');
      confirmationCallback.mockResolvedValue(true);

      const result = await toolExecutor.processMessage(sampleMessage);

      expect(confirmationCallback).toHaveBeenCalledTimes(1);
      expect(result.hasToolCalls).toBe(true);
      expect(vi.mocked(mockMCPService.executeTool)).toHaveBeenCalledTimes(2);
    });
  });

  describe('Auto-Reject Behavior', () => {
    test('should auto-reject execution when any tool has "reject" preference', async () => {
      memoryService.setPreference('read-file', 'allow');
      memoryService.setPreference('write-file', 'reject');

      const result = await toolExecutor.processMessage(sampleMessage);

      // Should not execute any tools or call confirmation callback
      expect(confirmationCallback).not.toHaveBeenCalled();
      expect(result.hasToolCalls).toBe(false);
      expect(result.toolResults).toHaveLength(0);
      expect(vi.mocked(mockMCPService.executeTool)).not.toHaveBeenCalled();
    });

    test('should reject immediately when first tool has reject preference', async () => {
      // Set reject preference for first tool
      memoryService.setPreference('read-file', 'reject');

      const result = await toolExecutor.processMessage(sampleMessage);

      expect(confirmationCallback).not.toHaveBeenCalled();
      expect(result.hasToolCalls).toBe(false);
      expect(result.toolResults).toHaveLength(0);
      expect(vi.mocked(mockMCPService.executeTool)).not.toHaveBeenCalled();
    });

    test('should reject when any tool in batch has reject preference', async () => {
      memoryService.setPreference('write-file', 'reject'); // Second tool

      const result = await toolExecutor.processMessage(sampleMessage);

      expect(confirmationCallback).not.toHaveBeenCalled();
      expect(result.hasToolCalls).toBe(false);
      expect(vi.mocked(mockMCPService.executeTool)).not.toHaveBeenCalled();
    });
  });

  describe('Mixed Scenarios', () => {
    test('should handle mix of stored and unknown tools correctly', async () => {
      const mixedToolCalls: ToolCall[] = [
        { name: 'allowed-tool', arguments: {} },
        { name: 'unknown-tool', arguments: {} },
        { name: 'another-unknown', arguments: {} },
      ];

      vi.mocked(mockMCPService.detectToolCalls).mockReturnValue(mixedToolCalls);
      memoryService.setPreference('allowed-tool', 'allow');
      confirmationCallback.mockResolvedValue(true);

      const result = await toolExecutor.processMessage(sampleMessage);

      // Should only ask confirmation for unknown tools
      expect(confirmationCallback).toHaveBeenCalledWith([
        { name: 'unknown-tool', arguments: {} },
        { name: 'another-unknown', arguments: {} },
      ]);
      expect(result.hasToolCalls).toBe(true);
    });

    test('should cancel execution when user rejects unknown tools', async () => {
      memoryService.setPreference('read-file', 'allow');
      confirmationCallback.mockResolvedValue(false); // User cancels

      const result = await toolExecutor.processMessage(sampleMessage);

      expect(confirmationCallback).toHaveBeenCalledWith([
        {
          name: 'write-file',
          arguments: { path: '/test/output.txt', content: 'test' },
        },
      ]);
      expect(result.hasToolCalls).toBe(false);
      expect(result.toolResults).toHaveLength(0);
      expect(vi.mocked(mockMCPService.executeTool)).not.toHaveBeenCalled();
    });

    test('should handle empty tool calls array', async () => {
      vi.mocked(mockMCPService.detectToolCalls).mockReturnValue([]);

      const result = await toolExecutor.processMessage(sampleMessage);

      expect(confirmationCallback).not.toHaveBeenCalled();
      expect(result.hasToolCalls).toBe(false);
      expect(result.toolResults).toHaveLength(0);
    });

    test('should handle null tool calls', async () => {
      vi.mocked(mockMCPService.detectToolCalls).mockReturnValue(null);

      const result = await toolExecutor.processMessage(sampleMessage);

      expect(confirmationCallback).not.toHaveBeenCalled();
      expect(result.hasToolCalls).toBe(false);
    });
  });

  describe('No Confirmation Callback', () => {
    test('should execute all tools when no confirmation callback provided', async () => {
      const executorWithoutCallback = new ToolExecutor(
        mockMCPService,
        false,
        undefined, // no callback
        memoryService
      );

      const result =
        await executorWithoutCallback.processMessage(sampleMessage);

      expect(result.hasToolCalls).toBe(true);
      expect(result.toolResults).toHaveLength(2);
      expect(vi.mocked(mockMCPService.executeTool)).toHaveBeenCalledTimes(2);
    });

    test('should respect reject preferences even without confirmation callback', async () => {
      const executorWithoutCallback = new ToolExecutor(
        mockMCPService,
        false,
        undefined,
        memoryService
      );

      memoryService.setPreference('read-file', 'reject');

      const result =
        await executorWithoutCallback.processMessage(sampleMessage);

      expect(result.hasToolCalls).toBe(false);
      expect(result.toolResults).toHaveLength(0);
      expect(vi.mocked(mockMCPService.executeTool)).not.toHaveBeenCalled();
    });
  });

  describe('Non-Assistant Messages', () => {
    test('should not process tool calls for user messages', async () => {
      const userMessage: Message = {
        role: 'user',
        content: 'Please read a file',
      };

      const result = await toolExecutor.processMessage(userMessage);

      expect(vi.mocked(mockMCPService.detectToolCalls)).not.toHaveBeenCalled();
      expect(result.hasToolCalls).toBe(false);
      expect(result.updatedMessage).toBe(userMessage);
    });

    test('should not process tool calls for system messages', async () => {
      const systemMessage: Message = {
        role: 'system',
        content: 'You are a helpful assistant',
      };

      const result = await toolExecutor.processMessage(systemMessage);

      expect(vi.mocked(mockMCPService.detectToolCalls)).not.toHaveBeenCalled();
      expect(result.hasToolCalls).toBe(false);
    });
  });

  describe('Preference Storage During Execution', () => {
    test('should store multiple preferences for different tools', () => {
      toolExecutor.storeToolPreference('tool1', 'allow');
      toolExecutor.storeToolPreference('tool2', 'reject');
      toolExecutor.storeToolPreference('tool3', 'allow');

      expect(memoryService.getPreference('tool1')).toBe('allow');
      expect(memoryService.getPreference('tool2')).toBe('reject');
      expect(memoryService.getPreference('tool3')).toBe('allow');
    });

    test('should overwrite existing preferences', () => {
      toolExecutor.storeToolPreference('changeable-tool', 'allow');
      expect(memoryService.getPreference('changeable-tool')).toBe('allow');

      toolExecutor.storeToolPreference('changeable-tool', 'reject');
      expect(memoryService.getPreference('changeable-tool')).toBe('reject');
    });
  });
});
