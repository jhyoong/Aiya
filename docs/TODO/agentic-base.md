# Aiya Agentic AI Implementation Plan

## Overview
Transform Aiya into an agentic AI system leveraging the enhanced aiya-todo-mcp capabilities, allowing the LLM to autonomously plan and execute complex multi-step tasks.

## Architecture Changes

### 1. New Agentic Layer
```
src/
├── core/
│   ├── agents/                          # NEW: Agentic system
│   │   ├── AgenticOrchestrator.ts      # Main orchestration logic
│   │   ├── TaskExecutor.ts             # Executes tasks using MCP tools
│   │   ├── ProgressMonitor.ts          # Monitors task execution
│   │   └── prompts/                    # Agentic-specific prompts
│   │       ├── TaskPlanningPrompt.ts   # How to plan tasks
│   │       └── ExecutionPrompt.ts      # How to execute tasks
│   ├── tools/
│   │   └── agentic-tools.ts            # NEW: LLM-accessible agentic tools
└── ui/
    └── components/
        ├── AgenticTaskView.tsx          # NEW: Task hierarchy visualization
        └── TaskExecutionPanel.tsx       # NEW: Real-time execution view
```

### 2. Enhanced System Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                      User Input                              │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  LLM with Enhanced Prompt                    │
│  • Knows when to use agentic mode                          │
│  • Has access to agentic tools                             │
│  • Can plan and execute task hierarchies                   │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  CommandExecutor (Enhanced)                  │
│  • Routes agentic tool calls to AgenticOrchestrator        │
│  • Maintains conversation context                           │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    AgenticOrchestrator                       │
│  • Plans tasks using enhanced TodoMCPAdapter                │
│  • Executes tasks via TaskExecutor                         │
│  • Monitors progress and handles failures                   │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Enhanced TodoMCPAdapter (13 tools)              │
│  • Task hierarchy management                                │
│  • Execution state tracking                                 │
│  • Dependency resolution                                    │
└──────────────────────────────────────────────────────────────┘
```

### 3. New LLM-Accessible Tools

```typescript
// src/core/tools/agentic-tools.ts

const agenticTools = [
  {
    name: "agentic_analyzeRequest",
    description: "Analyze if a request needs agentic execution",
    inputSchema: {
      request: { type: "string" },
      context: { type: "object" }
    }
  },
  {
    name: "agentic_planTasks", 
    description: "Create a hierarchical task plan",
    inputSchema: {
      objective: { type: "string" },
      constraints: { type: "array" }
    }
  },
  {
    name: "agentic_executeNext",
    description: "Execute the next ready task",
    inputSchema: {
      groupId: { type: "string" }
    }
  },
  {
    name: "agentic_checkProgress",
    description: "Check execution progress",
    inputSchema: {
      taskId: { type: "string" }
    }
  },
  {
    name: "agentic_handleFailure",
    description: "Handle task execution failure",
    inputSchema: {
      taskId: { type: "string" },
      error: { type: "string" }
    }
  }
];
```

## Implementation Phases

### Phase 1: Core Agentic Infrastructure
**Goal**: Establish the foundation for agentic task execution

#### Implementation Tasks:
1. Create `AgenticOrchestrator` class
   ```typescript
   class AgenticOrchestrator {
     constructor(
       private todoAdapter: TodoMCPAdapter,
       private mpcToolService: MCPToolService,
       private logger: Logger
     ) {}
     
     async planTasks(objective: string): Promise<TaskPlan>;
     async executeTask(taskId: string): Promise<ExecutionResult>;
     async monitorExecution(groupId: string): AsyncIterator<ProgressUpdate>;
   }
   ```

2. Implement basic task planning logic
3. Create `TaskExecutor` for single task execution
4. Add agentic tools to MCPToolService

#### Testing Checkpoint:
```typescript
describe('AgenticOrchestrator', () => {
  it('should create a task plan from objective', async () => {
    const plan = await orchestrator.planTasks('Create a README file');
    expect(plan.tasks).toHaveLength(3); // Plan, Write, Verify
  });

  it('should execute a simple task', async () => {
    const result = await orchestrator.executeTask(taskId);
    expect(result.status).toBe('completed');
  });
});
```

**End Goal**: Basic task planning and execution working with simple single-tool tasks.

### Phase 2: LLM Integration and Prompting
**Goal**: Enable LLM to intelligently use agentic mode

#### Implementation Tasks:
1. Create comprehensive system prompts
   ```typescript
   const AGENTIC_SYSTEM_PROMPT = `
   You have access to agentic execution mode for complex tasks.
   
   Use agentic mode when:
   - Task requires multiple steps
   - Task involves creating/modifying multiple files
   - Task needs verification after completion
   - User asks to "build", "create", "implement" something substantial
   
   For agentic tasks:
   1. First use agentic_analyzeRequest to confirm
   2. Use agentic_planTasks to create a plan
   3. Review plan with user if needed
   4. Use agentic_executeNext repeatedly to execute
   5. Use agentic_checkProgress to monitor
   `;
   ```

2. Update CommandExecutor to handle agentic tools
3. Add context injection for better LLM decisions
4. Implement conversation state management

#### Testing Checkpoint:
```typescript
describe('LLM Agentic Integration', () => {
  it('should recognize when to use agentic mode', async () => {
    const response = await llm.complete('Build a REST API for users');
    expect(response).toContain('agentic_planTasks');
  });

  it('should not use agentic for simple queries', async () => {
    const response = await llm.complete('What is Express.js?');
    expect(response).not.toContain('agentic_');
  });
});
```

**End Goal**: LLM correctly identifies when to use agentic mode and creates appropriate task plans.

### Phase 3: Advanced Task Execution
**Goal**: Handle complex multi-step tasks with dependencies

#### Implementation Tasks:
1. Enhance TaskExecutor with dependency handling
   ```typescript
   class TaskExecutor {
     async executeTaskWithDependencies(taskId: string): Promise<void> {
       // Check dependencies
       const ready = await this.todoAdapter.callTool('GetReadyTasks', {
         groupId: task.groupId
       });
       
       // Execute in order
       for (const task of ready) {
         await this.executeSingleTask(task);
       }
     }
   }
   ```

2. Implement parallel execution for independent tasks
3. Add retry logic for failed tasks
4. Create execution state persistence

#### Testing Checkpoint:
```typescript
describe('Advanced Task Execution', () => {
  it('should execute tasks with dependencies in order', async () => {
    const execution = await orchestrator.executeTaskTree(rootId);
    expect(execution.order).toEqual(['setup', 'install', 'configure']);
  });

  it('should retry failed tasks', async () => {
    const result = await executor.executeWithRetry(failingTaskId);
    expect(result.attempts).toBe(2);
    expect(result.status).toBe('completed');
  });

  it('should execute independent tasks in parallel', async () => {
    const start = Date.now();
    await executor.executeParallel([task1, task2, task3]);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(2000); // Faster than sequential
  });
});
```

**End Goal**: Robust execution engine handling complex task dependencies and failures.

### Phase 4: UI Integration
**Goal**: Provide clear visualization of agentic task execution

#### Implementation Tasks:
1. Create `AgenticTaskView` component
   ```tsx
   const AgenticTaskView: React.FC = () => {
     const [taskTree, setTaskTree] = useState<TaskTree>();
     const [executionState, setExecutionState] = useState<ExecutionState>();
     
     return (
       <Box flexDirection="column">
         <TaskHierarchy tree={taskTree} />
         <ExecutionProgress state={executionState} />
         <TaskControls onPause={pause} onResume={resume} />
       </Box>
     );
   };
   ```

2. Add real-time execution updates
3. Implement task control (pause, resume, cancel)
4. Integrate with existing chat interface

#### Testing Checkpoint:
```typescript
describe('Agentic UI', () => {
  it('should display task hierarchy', () => {
    const { getByText } = render(<AgenticTaskView taskTree={mockTree} />);
    expect(getByText('Build REST API')).toBeInTheDocument();
    expect(getByText('└─ Setup project')).toBeInTheDocument();
  });

  it('should update progress in real-time', async () => {
    const { getByTestId } = render(<AgenticTaskView />);
    await orchestrator.executeTask(taskId);
    expect(getByTestId('progress-bar')).toHaveStyle('width: 50%');
  });
});
```

**End Goal**: Intuitive UI showing task execution progress and allowing user control.

### Phase 5: Error Handling and Recovery
**Goal**: Graceful handling of failures with intelligent recovery

#### Implementation Tasks:
1. Implement comprehensive error handling
   ```typescript
   class AgenticErrorHandler {
     async handleTaskFailure(task: Todo, error: Error): Promise<RecoveryAction> {
       // Analyze error type
       if (error.message.includes('permission denied')) {
         return { action: 'request-permission', context: task };
       }
       
       // Check retry policy
       if (task.executionConfig?.maxRetries > task.executionStatus?.attempts) {
         return { action: 'retry', delay: 1000 };
       }
       
       // Ask user for guidance
       return { action: 'ask-user', error };
     }
   }
   ```

2. Add rollback capabilities for failed task chains
3. Implement user intervention requests
4. Create error recovery strategies

#### Testing Checkpoint:
```typescript
describe('Error Handling', () => {
  it('should rollback on critical failure', async () => {
    const result = await orchestrator.executeWithRollback(taskId);
    expect(result.rolledBack).toBe(true);
    expect(await fileExists('temp-file')).toBe(false);
  });

  it('should request user intervention for permission errors', async () => {
    const handler = new AgenticErrorHandler();
    const action = await handler.handleTaskFailure(task, permissionError);
    expect(action.action).toBe('request-permission');
  });
});
```

**End Goal**: Robust error handling ensuring tasks don't leave system in inconsistent state.

### Phase 6: Performance and Optimization
**Goal**: Optimize for production use with large task chains

#### Implementation Tasks:
1. Implement execution caching
2. Add progress persistence for resume capability
3. Optimize task scheduling algorithm
4. Add resource usage monitoring

#### Testing Checkpoint:
```typescript
describe('Performance', () => {
  it('should handle large task trees efficiently', async () => {
    const tree = createLargeTaskTree(100); // 100 tasks
    const start = Date.now();
    await orchestrator.planTasks(tree);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('should resume interrupted execution', async () => {
    const executionId = await orchestrator.startExecution(taskId);
    await orchestrator.interrupt(executionId);
    
    const resumed = await orchestrator.resume(executionId);
    expect(resumed.skippedCompleted).toBe(5);
  });
});
```

**End Goal**: Production-ready performance with resume capability and efficient resource usage.

## System Prompts Integration

### Provider Configuration Update
```typescript
// src/core/config/manager.ts
const AGENTIC_CONTEXT = {
  tools: agenticTools,
  examples: [
    {
      user: "Create a simple web server",
      assistant: "I'll help you create a web server. This requires multiple steps, so I'll use agentic mode to plan and execute the tasks.",
      uses: ["agentic_planTasks", "agentic_executeNext"]
    }
  ],
  guidelines: AGENTIC_SYSTEM_PROMPT
};
```

## Success Metrics

1. **Phase 1**: Successfully create and execute single-step tasks
2. **Phase 2**: LLM correctly identifies 90%+ of agentic vs non-agentic requests
3. **Phase 3**: Execute complex 10+ step tasks with dependencies
4. **Phase 4**: Users can visualize and control task execution
5. **Phase 5**: 95%+ task completion rate with automatic recovery
6. **Phase 6**: Handle 100+ task chains with <2s planning time

## Risk Mitigation

1. **Backward Compatibility**: All changes are additive, existing functionality unchanged
2. **Gradual Rollout**: Feature flag for agentic mode during development
3. **Comprehensive Logging**: Full audit trail of all agentic operations
4. **User Control**: Always allow user to interrupt/override agentic execution
5. **Resource Limits**: Configurable limits on task chain size and execution time

This plan transforms Aiya into a powerful agentic AI system while maintaining stability through incremental development and comprehensive testing.