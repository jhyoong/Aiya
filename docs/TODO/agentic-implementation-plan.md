# Aiya Agentic AI Implementation Plan

## Executive Summary

This plan outlines the transformation of Aiya into an agentic AI system that can autonomously plan and execute complex multi-step tasks. The implementation leverages aiya-todo-mcp v0.4.0 for task management and introduces a new agentic layer that enables the LLM to break down complex requests into executable task hierarchies.

## Current State Assessment

### Existing Infrastructure
- **TodoMCPAdapter**: Partially integrated (11/13 tools implemented)
- **MCPToolService**: Manages tool exposure to LLMs
- **CommandExecutor**: Routes tool calls from LLM responses
- **Base MCP Architecture**: Established pattern for tool integration

### Missing Components
- 2 TodoMCPAdapter tools: `getTaskGroupStatus`, `resetTaskExecution`
- Entire agentic infrastructure layer
- LLM-accessible agentic tools
- UI components for task visualization
- System prompts for agentic mode

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User Request                         │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    LLM with Agentic Tools                   │
│  • Analyzes requests for agentic execution needs            │
│  • Creates task plans using agentic_planTasks               │
│  • Executes tasks via agentic_executeNext                   │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Agentic Tool Layer                       │
│  • agentic_analyzeRequest                                   │
│  • agentic_planTasks                                        │
│  • agentic_executeNext                                      │
│  • agentic_checkProgress                                    │
│  • agentic_handleFailure                                    │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   AgenticOrchestrator                       │
│  • Plans task hierarchies                                   │
│  • Manages execution flow                                   │
│  • Handles errors and recovery                              │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     TodoMCPAdapter                          │
│  • 13 tools for task management                             │
│  • Execution state tracking                                 │
│  • Dependency resolution                                    │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase A: Complete TodoMCPAdapter Integration

**Main Goal**: Ensure TodoMCPAdapter has full feature parity with aiya-todo-mcp v0.4.0

**Action Items**:
1. Add `getTaskGroupStatus` tool implementation
   ```typescript
   // In TodoMCPAdapter class
   - Add tool definition in listTools()
   - Create validateGetTaskGroupStatusParams()
   - Implement getTaskGroupStatus() method
   ```

2. Add `resetTaskExecution` tool implementation
   ```typescript
   // In TodoMCPAdapter class
   - Add tool definition in listTools()
   - Create validateResetTaskExecutionParams()
   - Implement resetTaskExecution() method
   ```

3. Update TypeScript interfaces to match v0.4.0
   ```typescript
   interface GetTaskGroupStatusParams {
     groupId: string;
   }
   
   interface ResetTaskExecutionParams {
     todoId: string;
     resetDependents?: boolean;
   }
   ```

4. Test the complete adapter integration

**Testing Checkpoint**:
```typescript
// Test file: todo-adapter.test.ts
describe('TodoMCPAdapter v0.4.0 Compatibility', () => {
  it('should expose all 13 tools', async () => {
    const tools = await adapter.listTools();
    expect(tools).toHaveLength(13);
    expect(tools.map(t => t.name)).toContain('getTaskGroupStatus');
    expect(tools.map(t => t.name)).toContain('resetTaskExecution');
  });

  it('should get task group status correctly', async () => {
    const result = await adapter.callTool('getTaskGroupStatus', {
      groupId: 'test-group'
    });
    expect(result.content[0].text).toContain('pending');
  });

  it('should reset failed task execution', async () => {
    const result = await adapter.callTool('resetTaskExecution', {
      todoId: 'failed-task-id',
      resetDependents: true
    });
    expect(result.isError).toBe(false);
  });
});
```

### Phase B: Core Agentic Infrastructure

**Main Goal**: Build the foundational classes for agentic task orchestration

**Action Items**:
1. Create directory structure
   ```bash
   src/core/agents/
   ├── AgenticOrchestrator.ts
   ├── TaskExecutor.ts
   ├── ProgressMonitor.ts
   ├── types.ts
   └── prompts/
       ├── TaskPlanningPrompt.ts
       └── ExecutionPrompt.ts
   ```

2. Implement `AgenticOrchestrator.ts`
   ```typescript
   export class AgenticOrchestrator {
     constructor(
       private todoAdapter: TodoMCPAdapter,
       private toolService: MCPToolService,
       private logger: Logger
     ) {}
     
     async analyzeRequest(request: string, context: any): Promise<AgenticAnalysis>
     async planTasks(objective: string, constraints?: string[]): Promise<TaskPlan>
     async executeTask(taskId: string): Promise<ExecutionResult>
     async monitorExecution(groupId: string): AsyncIterator<ProgressUpdate>
     async handleFailure(taskId: string, error: Error): Promise<RecoveryAction>
   }
   ```

3. Implement `TaskExecutor.ts`
   ```typescript
   export class TaskExecutor {
     constructor(
       private todoAdapter: TodoMCPAdapter,
       private toolService: MCPToolService
     ) {}
     
     async executeSingleTask(taskId: string): Promise<TaskResult>
     async executeWithDependencies(taskId: string): Promise<TaskResult[]>
     async executeParallel(taskIds: string[]): Promise<TaskResult[]>
   }
   ```

4. Implement `ProgressMonitor.ts`
   ```typescript
   export class ProgressMonitor {
     constructor(private todoAdapter: TodoMCPAdapter) {}
     
     async *monitorGroup(groupId: string): AsyncIterator<GroupProgress>
     async getTaskProgress(taskId: string): Promise<TaskProgress>
     subscribeToUpdates(callback: (update: ProgressUpdate) => void): () => void
   }
   ```

5. Define core types in `types.ts`
   ```typescript
   export interface TaskPlan {
     id: string;
     objective: string;
     mainTask: PlannedTask;
     subtasks: PlannedTask[];
     estimatedDuration?: number;
     requiredTools: string[];
   }
   
   export interface ExecutionResult {
     taskId: string;
     status: 'completed' | 'failed' | 'partial';
     output?: any;
     error?: Error;
     duration: number;
   }
   ```

**Testing Checkpoint**:
```typescript
describe('AgenticOrchestrator Core', () => {
  it('should analyze if request needs agentic execution', async () => {
    const analysis = await orchestrator.analyzeRequest(
      'Create a REST API with authentication'
    );
    expect(analysis.needsAgentic).toBe(true);
    expect(analysis.estimatedSteps).toBeGreaterThan(3);
  });

  it('should create a valid task plan', async () => {
    const plan = await orchestrator.planTasks('Create a README file');
    expect(plan.mainTask).toBeDefined();
    expect(plan.subtasks).toHaveLength(3); // Plan, Write, Verify
    expect(plan.requiredTools).toContain('filesystem');
  });

  it('should execute a simple task', async () => {
    const result = await orchestrator.executeTask('task-123');
    expect(result.status).toBe('completed');
    expect(result.duration).toBeGreaterThan(0);
  });
});
```

### Phase C: LLM-Accessible Agentic Tools

**Main Goal**: Create tools that enable the LLM to use agentic capabilities

**Action Items**:
1. Create `src/core/tools/agentic-tools.ts`
   ```typescript
   export const agenticTools: LLMTool[] = [
     {
       name: 'agentic_analyzeRequest',
       description: 'Analyze if a request requires agentic execution',
       parameters: {
         type: 'object',
         properties: {
           request: {
             type: 'string',
             description: 'The user request to analyze'
           },
           context: {
             type: 'object',
             description: 'Additional context about the conversation'
           }
         },
         required: ['request']
       }
     },
     // ... other 4 tools
   ];
   ```

2. Create `AgenticToolHandler.ts` to process agentic tool calls
   ```typescript
   export class AgenticToolHandler {
     constructor(private orchestrator: AgenticOrchestrator) {}
     
     async handleToolCall(name: string, args: any): Promise<ToolResult> {
       switch(name) {
         case 'agentic_analyzeRequest':
           return this.handleAnalyzeRequest(args);
         case 'agentic_planTasks':
           return this.handlePlanTasks(args);
         // ... other cases
       }
     }
   }
   ```

3. Integrate with MCPToolService
   ```typescript
   // In MCPToolService or similar
   async getAvailableTools(): Promise<LLMTool[]> {
     const mcpTools = await this.getMCPTools();
     const agenticTools = await this.getAgenticTools();
     return [...mcpTools, ...agenticTools];
   }
   ```

4. Update CommandExecutor to route agentic tool calls
   ```typescript
   // In CommandExecutor
   if (toolCall.name.startsWith('agentic_')) {
     return await this.agenticToolHandler.handleToolCall(
       toolCall.name,
       toolCall.arguments
     );
   }
   ```

**Testing Checkpoint**:
```typescript
describe('Agentic Tools Integration', () => {
  it('should expose agentic tools to LLM', async () => {
    const tools = await toolService.getAvailableTools();
    const agenticTools = tools.filter(t => t.name.startsWith('agentic_'));
    expect(agenticTools).toHaveLength(5);
  });

  it('should handle agentic_planTasks call', async () => {
    const result = await handler.handleToolCall('agentic_planTasks', {
      objective: 'Build a todo app',
      constraints: ['Use TypeScript', 'Include tests']
    });
    expect(result.content[0].text).toContain('mainTask');
  });

  it('should execute tasks through agentic tools', async () => {
    const planResult = await handler.handleToolCall('agentic_planTasks', {
      objective: 'Create config file'
    });
    const plan = JSON.parse(planResult.content[0].text);
    
    const execResult = await handler.handleToolCall('agentic_executeNext', {
      groupId: plan.groupId
    });
    expect(execResult.isError).toBe(false);
  });
});
```

### Phase D: System Prompts and LLM Integration

**Main Goal**: Enable the LLM to intelligently use agentic mode

**Action Items**:
1. Create comprehensive system prompts
   ```typescript
   // src/core/agents/prompts/AgenticSystemPrompt.ts
   export const AGENTIC_SYSTEM_PROMPT = `
   You have access to agentic execution capabilities for complex tasks.
   
   When to use agentic mode:
   - Tasks requiring multiple coordinated steps
   - Creating or modifying multiple files
   - Tasks needing verification after completion
   - Requests to "build", "create", or "implement" substantial features
   
   Agentic workflow:
   1. Use agentic_analyzeRequest to assess complexity
   2. If agentic needed, use agentic_planTasks to create plan
   3. Review plan with user if substantial (>5 tasks)
   4. Execute using agentic_executeNext iteratively
   5. Monitor with agentic_checkProgress
   6. Handle failures with agentic_handleFailure
   
   Always explain what you're doing when using agentic mode.
   `;
   ```

2. Create task planning prompts
   ```typescript
   // src/core/agents/prompts/TaskPlanningPrompt.ts
   export const TASK_PLANNING_PROMPT = `
   When creating task plans:
   - Break down complex objectives into atomic, executable tasks
   - Identify dependencies between tasks
   - Estimate which tools each task will need
   - Include verification steps for critical operations
   - Keep task titles clear and actionable
   `;
   ```

3. Update provider configuration
   ```typescript
   // In provider config
   const enhancedSystemPrompt = `
   ${baseSystemPrompt}
   
   ${AGENTIC_SYSTEM_PROMPT}
   
   ${TASK_PLANNING_PROMPT}
   `;
   ```

4. Add context injection for better decisions
   ```typescript
   // In conversation handler
   const context = {
     recentTools: this.getRecentToolUsage(),
     projectContext: await this.detectProjectContext(),
     userPreferences: this.getUserPreferences()
   };
   ```

**Testing Checkpoint**:
```typescript
describe('LLM Agentic Awareness', () => {
  it('should recognize agentic-appropriate requests', async () => {
    const response = await llm.complete(
      'Build a REST API with user authentication'
    );
    expect(response).toContain('agentic_analyzeRequest');
    expect(response).toContain('create a plan');
  });

  it('should not use agentic for simple requests', async () => {
    const response = await llm.complete(
      'What is the capital of France?'
    );
    expect(response).not.toContain('agentic_');
  });

  it('should explain agentic actions to user', async () => {
    const response = await llm.complete(
      'Create a new React component with tests'
    );
    expect(response).toMatch(/I'll use agentic mode|break this down into tasks/i);
  });
});
```

### Phase E: UI Components for Task Visualization

**Main Goal**: Provide clear visual feedback for agentic task execution

**Action Items**:
1. Create UI component structure
   ```bash
   src/ui/components/agentic/
   ├── AgenticTaskView.tsx
   ├── TaskExecutionPanel.tsx
   ├── TaskHierarchy.tsx
   ├── ExecutionProgress.tsx
   └── TaskControls.tsx
   ```

2. Implement `AgenticTaskView.tsx`
   ```tsx
   export const AgenticTaskView: React.FC<AgenticTaskViewProps> = ({
     taskPlan,
     executionState,
     onControl
   }) => {
     return (
       <Box flexDirection="column" borderStyle="round" borderColor="cyan">
         <Text bold color="cyan">🤖 Agentic Execution</Text>
         <TaskHierarchy plan={taskPlan} state={executionState} />
         <ExecutionProgress progress={executionState.progress} />
         <TaskControls 
           onPause={() => onControl('pause')}
           onResume={() => onControl('resume')}
           onCancel={() => onControl('cancel')}
         />
       </Box>
     );
   };
   ```

3. Implement real-time updates
   ```typescript
   // In chat component
   useEffect(() => {
     if (agenticExecution) {
       const unsubscribe = progressMonitor.subscribeToUpdates((update) => {
         setExecutionState(prev => ({
           ...prev,
           tasks: updateTaskStatus(prev.tasks, update)
         }));
       });
       return unsubscribe;
     }
   }, [agenticExecution]);
   ```

4. Add task control functionality
   ```typescript
   const handleTaskControl = async (action: 'pause' | 'resume' | 'cancel') => {
     switch(action) {
       case 'pause':
         await orchestrator.pauseExecution(currentGroupId);
         break;
       case 'resume':
         await orchestrator.resumeExecution(currentGroupId);
         break;
       case 'cancel':
         await orchestrator.cancelExecution(currentGroupId);
         break;
     }
   };
   ```

**Testing Checkpoint**:
```typescript
describe('Agentic UI Components', () => {
  it('should render task hierarchy', () => {
    const { getByText } = render(
      <AgenticTaskView taskPlan={mockPlan} executionState={mockState} />
    );
    expect(getByText('🤖 Agentic Execution')).toBeInTheDocument();
    expect(getByText('Build REST API')).toBeInTheDocument();
  });

  it('should update progress in real-time', async () => {
    const { getByTestId } = render(<ExecutionProgress progress={0.5} />);
    expect(getByTestId('progress-bar')).toHaveStyle('width: 50%');
  });

  it('should handle control actions', async () => {
    const onControl = jest.fn();
    const { getByText } = render(
      <TaskControls onPause={onControl} />
    );
    fireEvent.click(getByText('Pause'));
    expect(onControl).toHaveBeenCalledWith('pause');
  });
});
```

### Phase F: Error Handling and Recovery

**Main Goal**: Ensure robust error handling and graceful recovery

**Action Items**:
1. Implement comprehensive error handling
   ```typescript
   // src/core/agents/ErrorHandler.ts
   export class AgenticErrorHandler {
     async handleTaskFailure(
       task: Todo,
       error: Error,
       context: ExecutionContext
     ): Promise<RecoveryAction> {
       const errorType = this.classifyError(error);
       
       switch(errorType) {
         case 'permission':
           return this.handlePermissionError(task, error);
         case 'tool_failure':
           return this.handleToolFailure(task, error);
         case 'timeout':
           return this.handleTimeout(task, error);
         default:
           return this.handleGenericError(task, error);
       }
     }
     
     async rollbackTaskGroup(groupId: string): Promise<RollbackResult> {
       // Implementation for rolling back partially completed task groups
     }
   }
   ```

2. Add retry mechanisms
   ```typescript
   // In TaskExecutor
   async executeWithRetry(
     taskId: string,
     maxRetries: number = 3
   ): Promise<ExecutionResult> {
     for (let attempt = 1; attempt <= maxRetries; attempt++) {
       try {
         return await this.executeSingleTask(taskId);
       } catch (error) {
         if (attempt === maxRetries) throw error;
         await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
       }
     }
   }
   ```

3. Implement user intervention requests
   ```typescript
   // In AgenticOrchestrator
   async requestUserIntervention(
     issue: InterventionRequest
   ): Promise<UserResponse> {
     // Pause execution
     await this.pauseExecution(issue.groupId);
     
     // Present issue to user
     this.uiCallback({
       type: 'intervention_needed',
       issue,
       options: this.generateInterventionOptions(issue)
     });
     
     // Wait for user response
     return await this.waitForUserResponse(issue.id);
   }
   ```

**Testing Checkpoint**:
```typescript
describe('Error Handling and Recovery', () => {
  it('should classify and handle different error types', async () => {
    const handler = new AgenticErrorHandler();
    const action = await handler.handleTaskFailure(
      mockTask,
      new Error('Permission denied'),
      mockContext
    );
    expect(action.type).toBe('request_permission');
  });

  it('should retry failed tasks with backoff', async () => {
    const executor = new TaskExecutor();
    jest.spyOn(executor, 'executeSingleTask')
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce({ status: 'completed' });
    
    const result = await executor.executeWithRetry('task-123');
    expect(result.status).toBe('completed');
  });

  it('should rollback on critical failures', async () => {
    const result = await orchestrator.executeWithRollback('group-123');
    expect(result.rollbackPerformed).toBe(true);
    expect(result.cleanedUpTasks).toHaveLength(3);
  });
});
```

### Phase G: Performance Optimization and Production Readiness

**Main Goal**: Optimize for production use with large task chains

**Action Items**:
1. Implement execution caching
   ```typescript
   // src/core/agents/ExecutionCache.ts
   export class ExecutionCache {
     async cacheTaskResult(taskId: string, result: any): Promise<void>
     async getCachedResult(taskId: string): Promise<any | null>
     async invalidateGroupCache(groupId: string): Promise<void>
   }
   ```

2. Add progress persistence
   ```typescript
   // src/core/agents/persistence/ExecutionPersistence.ts
   export class ExecutionPersistence {
     async saveExecutionState(state: ExecutionState): Promise<void>
     async loadExecutionState(groupId: string): Promise<ExecutionState | null>
     async listInterruptedExecutions(): Promise<ExecutionSummary[]>
   }
   ```

3. Optimize task scheduling
   ```typescript
   // src/core/agents/TaskScheduler.ts
   export class TaskScheduler {
     async scheduleOptimal(tasks: Todo[]): Promise<SchedulePlan> {
       // Analyze dependencies and resource requirements
       // Create optimal execution order
       // Identify parallelization opportunities
     }
   }
   ```

4. Add monitoring and metrics
   ```typescript
   // src/core/agents/metrics/AgenticMetrics.ts
   export class AgenticMetrics {
     recordTaskExecution(task: string, duration: number, status: string): void
     recordPlanCreation(complexity: number, taskCount: number): void
     getExecutionStats(): ExecutionStatistics
   }
   ```

**Testing Checkpoint**:
```typescript
describe('Performance and Production', () => {
  it('should handle large task chains efficiently', async () => {
    const largePlan = createLargeTaskPlan(100);
    const start = Date.now();
    const result = await orchestrator.planTasks(largePlan);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000); // Under 1 second
  });

  it('should resume interrupted executions', async () => {
    // Simulate interruption
    const execution = await orchestrator.startExecution('group-123');
    await orchestrator.interrupt(execution.id);
    
    // Resume
    const resumed = await orchestrator.resumeExecution(execution.id);
    expect(resumed.skippedCompleted).toBe(5);
    expect(resumed.remainingTasks).toBe(3);
  });

  it('should use cache for repeated operations', async () => {
    const spy = jest.spyOn(toolService, 'callTool');
    
    await executor.executeSingleTask('cached-task');
    await executor.executeSingleTask('cached-task'); // Same task
    
    expect(spy).toHaveBeenCalledTimes(1); // Only called once
  });
});
```

## Success Criteria

### Phase Completion Metrics
- **Phase A**: All 13 TodoMCPAdapter tools working correctly
- **Phase B**: Core agentic classes handle basic task orchestration
- **Phase C**: LLM successfully uses all 5 agentic tools
- **Phase D**: LLM correctly identifies 90%+ of agentic use cases
- **Phase E**: UI provides clear, real-time task execution feedback
- **Phase F**: 95%+ task completion rate with automatic recovery
- **Phase G**: Handle 100+ task chains with <2s planning time

### Overall Success Indicators
1. **Functionality**: Complex multi-step tasks execute reliably
2. **Performance**: Responsive UI with minimal latency
3. **Reliability**: Graceful error handling and recovery
4. **Usability**: Clear visual feedback and user control
5. **Maintainability**: Well-tested, modular codebase

## Risk Mitigation

1. **Backward Compatibility**
   - All changes are additive
   - Existing tools continue to work unchanged
   - Feature flag for gradual rollout

2. **Testing Strategy**
   - Unit tests for each component
   - Integration tests for tool chains
   - End-to-end tests for complete workflows
   - Performance benchmarks

3. **User Safety**
   - Always allow interruption of execution
   - Clear confirmation for destructive operations
   - Audit trail of all actions
   - Rollback capabilities

4. **Resource Management**
   - Configurable limits on task chain size
   - Timeout controls
   - Memory usage monitoring
   - Concurrent execution limits

## Next Steps

1. Review and approve this implementation plan
2. Set up development branch for agentic features
3. Begin Phase A implementation
4. Establish regular check-ins for progress review
5. Prepare demo scenarios for testing

This plan provides a clear, actionable path to implementing agentic AI capabilities in Aiya while maintaining system stability and user safety.