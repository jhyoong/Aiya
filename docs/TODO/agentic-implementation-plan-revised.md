# Aiya Agentic AI Implementation Plan - Revised

## Executive Summary

This plan outlines the transformation of Aiya into an agentic AI system that uses `aiya-todo-mcp` as its execution engine. The key insight is that **the todo system manages the AI's own execution plan**, tracking what the AI needs to do, what it has done, and what it should do next.

## Core Concept: Todo System as AI Execution Manager

The `aiya-todo-mcp` package provides a complete task management system with:
- Hierarchical task structures
- Dependency management
- Execution state tracking (pending → running → completed/failed)
- Task ordering and readiness detection

**We use this to manage the AI's multi-step execution plans:**
- Each user request becomes a "main task" with subtasks
- Each subtask is an atomic action the AI needs to perform
- Dependencies ensure correct execution order
- The AI queries the todo system to know what to execute next

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│              User: "Build a REST API with auth"             │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    LLM with Agentic Tools                   │
│  1. Calls agentic_planTasks to create execution plan        │
│  2. Calls agentic_executeNext to get next task              │
│  3. Executes task using appropriate tools (filesystem, etc) │
│  4. Updates progress and repeats until complete             │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Agentic Tool Layer                       │
│  Maps high-level agentic operations to TodoMCP calls:       │
│  • agentic_planTasks      → CreateTaskGroup                 │
│  • agentic_executeNext    → GetExecutableTasks +            │
│                             UpdateExecutionStatus           │
│  • agentic_checkProgress  → GetTaskGroupStatus              │
│  • agentic_handleFailure  → ResetTaskExecution              │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     TodoMCPAdapter                          │
│  Manages the AI's execution state as todo tasks:            │
│  • Each AI action becomes a todo with dependencies          │
│  • Tracks what's pending/running/completed/failed           │
│  • Ensures correct execution order via dependencies         │
│  • Enables resume/retry through execution states            │
└─────────────────────────────────────────────────────────────┘
```

## How It Works: Complete Example Flow

### User Request: "Create a REST API with authentication"

#### Step 1: LLM Analyzes Request
```typescript
// LLM recognizes this needs multiple steps and calls:
agentic_analyzeRequest({
  request: "Create a REST API with authentication",
  context: { projectType: "node" }
})
// Returns: { needsAgentic: true, estimatedSteps: 7 }
```

#### Step 2: LLM Creates Execution Plan
```typescript
// LLM calls agentic_planTasks, which internally uses TodoMCPAdapter:
agentic_planTasks({
  objective: "Create a REST API with authentication",
  constraints: ["Use Express", "JWT for auth"]
})

// This creates a task group in the todo system:
TodoMCPAdapter.CreateTaskGroup({
  mainTask: {
    title: "Create REST API with authentication",
    description: "Build complete REST API with JWT auth"
  },
  subtasks: [
    {
      title: "Initialize Node.js project",
      description: "Create package.json with npm init",
      dependencies: [] // No dependencies, can start immediately
    },
    {
      title: "Install dependencies",
      description: "Install express, jsonwebtoken, bcrypt",
      dependencies: [0] // Depends on project being initialized
    },
    {
      title: "Create server file",
      description: "Create index.js with Express setup",
      dependencies: [1] // Depends on dependencies installed
    },
    {
      title: "Implement auth endpoints",
      description: "Add /login and /register endpoints",
      dependencies: [2] // Depends on server file
    },
    {
      title: "Add auth middleware",
      description: "Create JWT verification middleware",
      dependencies: [2] // Also depends on server file
    },
    {
      title: "Create protected routes",
      description: "Add example protected endpoints",
      dependencies: [3, 4] // Depends on both auth endpoints AND middleware
    },
    {
      title: "Test the API",
      description: "Verify all endpoints work",
      dependencies: [5] // Depends on routes being complete
    }
  ],
  groupId: "agentic-rest-api-1234"
})
```

#### Step 3: LLM Executes Tasks in Order
```typescript
// LLM repeatedly calls agentic_executeNext to get next task:
agentic_executeNext({ groupId: "agentic-rest-api-1234" })

// First call returns (via GetExecutableTasks):
{
  taskId: "task-001",
  title: "Initialize Node.js project",
  description: "Create package.json with npm init",
  requiredTool: "shell"
}

// LLM executes the task:
shell_execute({ command: "npm init -y" })

// LLM updates task status:
agentic_updateTaskStatus({ 
  taskId: "task-001", 
  status: "completed" 
})

// Next call to agentic_executeNext returns:
{
  taskId: "task-002",
  title: "Install dependencies",
  description: "Install express, jsonwebtoken, bcrypt",
  requiredTool: "shell"
}

// And so on...
```

#### Step 4: Todo System Tracks Everything
At any point, calling `GetTaskGroupStatus` shows:
```
Group: agentic-rest-api-1234
├─ [✓] Create REST API with authentication
│  ├─ [✓] Initialize Node.js project
│  ├─ [✓] Install dependencies  
│  ├─ [►] Create server file (currently executing)
│  ├─ [░] Implement auth endpoints (blocked by dependency)
│  ├─ [░] Add auth middleware (blocked by dependency)
│  ├─ [░] Create protected routes (blocked by dependencies)
│  └─ [░] Test the API (blocked by dependency)

Progress: 2/7 tasks completed (28.6%)
```

## Implementation Phases

### Phase A: Complete TodoMCPAdapter Integration ✅ COMPLETED

**Main Goal**: Ensure TodoMCPAdapter has full feature parity with aiya-todo-mcp v0.4.0

**✅ Completed Action Items**:
1. ✅ Updated all packages to latest compatible versions (Aiya v2.0.0-alpha.1)
2. ✅ Added missing tools to TodoMCPAdapter:
   - `GetTaskGroupStatus`: Essential for progress monitoring  
   - `ResetTaskExecution`: Essential for error recovery
3. ✅ Complete integration with all 13 tools tested (431/431 tests passing)

**Summary**: TodoMCPAdapter now has full feature parity with aiya-todo-mcp v0.4.0, providing all 13 tools needed for agentic execution with comprehensive test coverage and error recovery capabilities.

### Phase B: Core Agentic Infrastructure ✅ COMPLETED

**Main Goal**: Build the layer that translates between LLM objectives and todo task management

**✅ Completed Action Items**:

1. **Create AgenticOrchestrator.ts** - The bridge between LLM and Todo system
```typescript
export class AgenticOrchestrator {
  constructor(private todoAdapter: TodoMCPAdapter) {}
  
  /**
   * Creates a task breakdown and registers it in the todo system
   */
  async planTasks(objective: string, constraints?: string[]): Promise<TaskPlan> {
    // 1. Generate task breakdown (using templates or LLM)
    const tasks = await this.generateTaskBreakdown(objective, constraints);
    
    // 2. Create task group in todo system
    const result = await this.todoAdapter.callTool('CreateTaskGroup', {
      mainTask: {
        title: objective,
        tags: ['agentic', 'ai-execution']
      },
      subtasks: tasks.map(task => ({
        title: task.title,
        description: task.description,
        dependencies: task.dependencyIndices,
        executionConfig: {
          requiredTool: task.tool,
          toolArgs: task.toolArgs
        }
      }))
    });
    
    return {
      groupId: result.groupId,
      taskCount: tasks.length,
      mainTaskId: result.mainTask.id
    };
  }
  
  /**
   * Gets next task from todo system that's ready to execute
   */
  async getNextExecutableTask(groupId: string): Promise<ExecutableTask | null> {
    const result = await this.todoAdapter.callTool('GetExecutableTasks', {
      groupId: groupId,
      limit: 1
    });
    
    if (result.length === 0) return null;
    
    const todo = result[0];
    return {
      id: todo.id,
      title: todo.title,
      description: todo.description,
      tool: todo.executionConfig?.requiredTool,
      toolArgs: todo.executionConfig?.toolArgs
    };
  }
  
  /**
   * Updates task status in todo system after execution
   */
  async updateTaskStatus(
    taskId: string, 
    status: 'completed' | 'failed',
    error?: string
  ): Promise<void> {
    await this.todoAdapter.callTool('UpdateExecutionStatus', {
      taskId: taskId,
      status: status,
      error: error
    });
  }
}
```

2. **Create TaskTemplates.ts** - Predefined task breakdowns
```typescript
export const TASK_TEMPLATES = {
  'rest-api': (constraints: string[]) => [
    {
      title: 'Initialize project',
      tool: 'shell',
      toolArgs: { command: 'npm init -y' },
      dependencyIndices: []
    },
    {
      title: 'Install dependencies',
      tool: 'shell',
      toolArgs: { command: 'npm install express' },
      dependencyIndices: [0]
    },
    // ... more tasks
  ],
  
  'react-component': (constraints: string[]) => [
    {
      title: 'Create component file',
      tool: 'filesystem',
      toolArgs: { action: 'create', path: 'Component.tsx' },
      dependencyIndices: []
    },
    // ... more tasks
  ]
};
```

**Testing Checkpoint**:
```typescript
describe('AgenticOrchestrator Todo Integration', () => {
  it('should create task hierarchy in todo system', async () => {
    const plan = await orchestrator.planTasks('Create REST API');
    
    // Verify task group was created
    const status = await todoAdapter.callTool('GetTaskGroupStatus', {
      groupId: plan.groupId
    });
    expect(status.mainTask.title).toBe('Create REST API');
    expect(status.statistics.total).toBeGreaterThan(1);
  });

  it('should get executable tasks in dependency order', async () => {
    const plan = await orchestrator.planTasks('Build feature');
    
    // First task should have no dependencies
    const task1 = await orchestrator.getNextExecutableTask(plan.groupId);
    expect(task1.title).toContain('Initialize');
    
    // Mark first task complete
    await orchestrator.updateTaskStatus(task1.id, 'completed');
    
    // Next task should be one that depended on first
    const task2 = await orchestrator.getNextExecutableTask(plan.groupId);
    expect(task2.title).toContain('Install');
  });
});
```

**Summary**: Phase B successfully implemented the core agentic infrastructure that bridges LLM objectives with TodoMCPAdapter task management. The implementation includes:

1. ✅ **AgenticOrchestrator**: Complete bridge between LLM and TodoMCPAdapter with `planTasks()`, `getNextExecutableTask()`, and `updateTaskStatus()` methods
2. ✅ **TaskTemplates**: Comprehensive template system with 5 built-in templates (rest-api, react-component, file-operations, build-deploy, testing-setup) and auto-detection
3. ✅ **AgenticService**: High-level service layer providing unified interface for agentic execution
4. ✅ **AgenticErrorHandler**: Sophisticated error recovery with classification, retry logic, and TodoMCPAdapter integration
5. ✅ **Full test coverage**: Both unit tests (mocked) and integration tests (real TodoMCPAdapter) covering all key workflows
6. ✅ **Proper error handling**: MCPToolError handling throughout with meaningful error messages
7. ✅ **Dependency management**: Full support for task dependencies via TodoMCPAdapter's dependency system

The implementation exceeds the original plan requirements and provides a robust foundation for Phase C.

### Phase C: LLM-Accessible Agentic Tools ✅ COMPLETED

**Main Goal**: Create tools that enable the LLM to use the todo system for execution

**Action Items**:

1. **Define Agentic Tools** that map to todo operations:
```typescript
export const agenticTools: LLMTool[] = [
  {
    name: 'agentic_planTasks',
    description: `Create an execution plan for a complex task. 
                  This breaks down your objective into steps and tracks them in the todo system.
                  Returns a groupId to use for execution.`,
    parameters: {
      type: 'object',
      properties: {
        objective: {
          type: 'string',
          description: 'What you want to accomplish'
        },
        tasks: {
          type: 'array',
          description: 'List of tasks you plan to do',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              tool: { type: 'string', description: 'Which tool this task needs' },
              dependsOn: { 
                type: 'array', 
                items: { type: 'number' },
                description: 'Indices of tasks this depends on'
              }
            }
          }
        }
      },
      required: ['objective', 'tasks']
    }
  },
  
  {
    name: 'agentic_executeNext',
    description: `Get the next task to execute from your plan.
                  Returns null when all tasks are complete.`,
    parameters: {
      type: 'object',
      properties: {
        groupId: { type: 'string' }
      },
      required: ['groupId']
    }
  },
  
  {
    name: 'agentic_completeTask',
    description: 'Mark a task as completed after successful execution',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        result: { type: 'string', description: 'Brief result summary' }
      },
      required: ['taskId']
    }
  },
  
  {
    name: 'agentic_failTask',
    description: 'Mark a task as failed if execution encountered an error',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        error: { type: 'string' }
      },
      required: ['taskId', 'error']
    }
  },
  
  {
    name: 'agentic_checkProgress',
    description: 'Check execution progress of your task plan',
    parameters: {
      type: 'object',
      properties: {
        groupId: { type: 'string' }
      },
      required: ['groupId']
    }
  }
];
```

2. **Implement AgenticToolHandler**:
```typescript
export class AgenticToolHandler {
  constructor(private orchestrator: AgenticOrchestrator) {}
  
  async handleToolCall(name: string, args: any): Promise<ToolResult> {
    switch(name) {
      case 'agentic_planTasks':
        // Convert LLM's task list into todo task group
        const plan = await this.orchestrator.planTasksFromList(
          args.objective,
          args.tasks
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              groupId: plan.groupId,
              message: `Created plan with ${args.tasks.length} tasks. Use groupId '${plan.groupId}' to execute.`
            })
          }]
        };
        
      case 'agentic_executeNext':
        const task = await this.orchestrator.getNextExecutableTask(args.groupId);
        if (!task) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                complete: true,
                message: 'All tasks completed!'
              })
            }]
          };
        }
        
        // Mark as running
        await this.orchestrator.updateTaskStatus(task.id, 'running');
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              taskId: task.id,
              title: task.title,
              description: task.description,
              tool: task.tool,
              toolArgs: task.toolArgs,
              message: `Execute: ${task.title}`
            })
          }]
        };
        
      // ... other cases
    }
  }
}
```

**Testing Checkpoint**:
```typescript
describe('Agentic Tools Todo Integration', () => {
  it('should allow LLM to create and execute task plans', async () => {
    // LLM creates a plan
    const planResult = await handler.handleToolCall('agentic_planTasks', {
      objective: 'Create config file',
      tasks: [
        { title: 'Create file', tool: 'filesystem', dependsOn: [] },
        { title: 'Write content', tool: 'filesystem', dependsOn: [0] },
        { title: 'Validate', tool: 'shell', dependsOn: [1] }
      ]
    });
    
    const { groupId } = JSON.parse(planResult.content[0].text);
    
    // LLM gets first task
    const task1Result = await handler.handleToolCall('agentic_executeNext', {
      groupId: groupId
    });
    const task1 = JSON.parse(task1Result.content[0].text);
    expect(task1.title).toBe('Create file');
    
    // LLM completes first task
    await handler.handleToolCall('agentic_completeTask', {
      taskId: task1.taskId
    });
    
    // LLM gets next task
    const task2Result = await handler.handleToolCall('agentic_executeNext', {
      groupId: groupId
    });
    const task2 = JSON.parse(task2Result.content[0].text);
    expect(task2.title).toBe('Write content');
  });
});
```

**✅ Completed Action Items**:

1. ✅ **Created AgenticTools.ts**: Comprehensive LLM tool definitions with proper JSON Schema validation
   - `agentic_planTasks`: Multi-step task planning with dependency management
   - `agentic_executeNext`: Dependency-ordered task execution
   - `agentic_completeTask`: Task completion with result tracking
   - `agentic_failTask`: Error handling with retry capabilities
   - `agentic_checkProgress`: Real-time progress monitoring

2. ✅ **Implemented AgenticToolHandler.ts**: Complete bridge between LLM and AgenticOrchestrator
   - Full parameter validation and error handling
   - Structured JSON responses for LLM consumption
   - Integration with existing AgenticOrchestrator API
   - Support for task state transitions and dependency resolution

3. ✅ **Updated MCPToolService Integration**: Seamless tool registry integration
   - Extended MCPToolService to include agentic tools alongside MCP tools
   - Factory functions for easy service creation with agentic support
   - Updated CLI chat command to use agentic-enabled tool service
   - Proper tool routing between MCP and agentic handlers

4. ✅ **Comprehensive Testing**: Full test coverage ensuring reliability
   - **Unit Tests**: 23/23 tests passing covering all tool scenarios
   - **Integration Tests**: End-to-end LLM workflow testing
   - **Build Verification**: TypeScript compilation and type safety
   - **Manual Verification**: Confirmed LLM detection of all 5 agentic tools

**Summary**: Phase C successfully enables LLMs to perform complex multi-step workflows using the TodoMCPAdapter as an execution engine. The implementation provides a robust, well-tested foundation for agentic AI execution with proper dependency management, error recovery, and progress tracking. All agentic tools are now accessible to LLMs through the standard tool calling interface.

**LLM Tool Count**: **19 total tools** (14 existing MCP tools + 5 new agentic tools)

### Phase D: System Prompts and LLM Integration

**Main Goal**: Teach the LLM how to use the agentic execution system

**Action Items**:

1. **Create Agentic System Prompt**:
```typescript
export const AGENTIC_SYSTEM_PROMPT = `
You have access to an agentic execution system that helps you complete multi-step tasks.

## When to Use Agentic Mode

Use agentic execution when:
- The task requires multiple coordinated steps
- You need to track progress across multiple operations
- The task involves creating/modifying multiple files
- You need to ensure steps happen in the correct order

## How to Use Agentic Mode

1. **Plan Your Tasks**
   Use agentic_planTasks to create an execution plan:
   - Break down the objective into atomic, single-tool tasks
   - Each task should do ONE thing with ONE tool
   - Specify dependencies between tasks
   
   Example:
   agentic_planTasks({
     objective: "Create a React component with tests",
     tasks: [
       {
         title: "Create component file",
         description: "Create Button.tsx",
         tool: "filesystem",
         dependsOn: []
       },
       {
         title: "Write component code",
         description: "Implement Button component",
         tool: "filesystem",
         dependsOn: [0]
       },
       {
         title: "Create test file",
         description: "Create Button.test.tsx",
         tool: "filesystem",
         dependsOn: [0]
       },
       {
         title: "Write tests",
         description: "Implement component tests",
         tool: "filesystem",
         dependsOn: [2]
       }
     ]
   })

2. **Execute Tasks**
   Repeatedly call agentic_executeNext to get and execute tasks:
   - You'll receive one task at a time
   - Execute it using the specified tool
   - Mark it complete or failed before getting the next task
   
3. **Track Progress**
   Use agentic_checkProgress to see overall status
   
## Important Notes

- Tasks with unmet dependencies won't be returned by executeNext
- Always complete or fail a task before requesting the next one
- The system ensures tasks execute in the correct order
- If a task fails, dependent tasks will be blocked
`;
```

2. **Add Examples to System Context**:
```typescript
export const AGENTIC_EXAMPLES = [
  {
    user: "Create a simple web server",
    assistant: `I'll create a simple web server for you. This requires multiple steps, so I'll use agentic execution to track progress.

Let me plan out the tasks:`,
    tool_calls: [
      {
        name: "agentic_planTasks",
        args: {
          objective: "Create a simple web server",
          tasks: [
            {
              title: "Initialize npm project",
              description: "Create package.json",
              tool: "shell",
              dependsOn: []
            },
            {
              title: "Install Express",
              description: "Add Express dependency",
              tool: "shell",
              dependsOn: [0]
            },
            {
              title: "Create server file",
              description: "Create index.js with basic server",
              tool: "filesystem",
              dependsOn: [1]
            }
          ]
        }
      }
    ]
  }
];
```

### Phase E: UI Components for Task Visualization

**Main Goal**: Show users the AI's execution progress in real-time

**Action Items**:

1. **Create AgenticExecutionView**:
```tsx
export const AgenticExecutionView: React.FC<{ groupId: string }> = ({ groupId }) => {
  const [status, setStatus] = useState<TaskGroupStatus>(null);
  
  useEffect(() => {
    const interval = setInterval(async () => {
      // Poll todo system for updates
      const result = await todoAdapter.callTool('GetTaskGroupStatus', { groupId });
      setStatus(result);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [groupId]);
  
  if (!status) return <Text>Loading...</Text>;
  
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan">
      <Text bold color="cyan">
        🤖 Agentic Execution: {status.mainTask.title}
      </Text>
      
      <Box marginTop={1}>
        <Text>
          Progress: {status.statistics.completed}/{status.statistics.total} tasks
        </Text>
        <ProgressBar 
          value={status.statistics.completed} 
          total={status.statistics.total} 
        />
      </Box>
      
      <Box marginTop={1} flexDirection="column">
        {status.tasks.map(task => (
          <TaskItem key={task.id} task={task} />
        ))}
      </Box>
    </Box>
  );
};
```

2. **Create TaskItem Component**:
```tsx
const TaskItem: React.FC<{ task: Todo }> = ({ task }) => {
  const getStatusIcon = () => {
    switch(task.executionStatus?.state) {
      case 'completed': return '✓';
      case 'running': return '►';
      case 'failed': return '✗';
      case 'pending': return '░';
      default: return ' ';
    }
  };
  
  const getStatusColor = () => {
    switch(task.executionStatus?.state) {
      case 'completed': return 'green';
      case 'running': return 'yellow';
      case 'failed': return 'red';
      default: return 'gray';
    }
  };
  
  return (
    <Text color={getStatusColor()}>
      [{getStatusIcon()}] {task.title}
      {task.executionStatus?.state === 'failed' && 
        <Text color="red"> - {task.executionStatus.error}</Text>
      }
    </Text>
  );
};
```

### Phase F: Error Handling and Recovery

**Main Goal**: Enable graceful recovery from failures using todo system

**Action Items**:

1. **Implement Failure Recovery**:
```typescript
export class AgenticErrorHandler {
  constructor(private todoAdapter: TodoMCPAdapter) {}
  
  async handleTaskFailure(
    taskId: string,
    error: Error,
    groupId: string
  ): Promise<RecoveryStrategy> {
    // Check if retryable
    if (this.isRetryableError(error)) {
      // Reset task for retry
      await this.todoAdapter.callTool('ResetTaskExecution', {
        todoId: taskId,
        resetDependents: false
      });
      
      return { action: 'retry', taskId };
    }
    
    // Check if we can continue with other tasks
    const status = await this.todoAdapter.callTool('GetTaskGroupStatus', {
      groupId: groupId
    });
    
    const hasIndependentTasks = status.tasks.some(
      task => task.executionStatus?.state === 'ready' &&
              !task.dependencies?.includes(taskId)
    );
    
    if (hasIndependentTasks) {
      return { action: 'continue_others' };
    }
    
    // Need user intervention
    return { 
      action: 'user_intervention',
      message: `Task "${task.title}" failed: ${error.message}`
    };
  }
}
```

### Phase G: Performance and Production Optimization

**Main Goal**: Optimize for large-scale task execution

**Action Items**:

1. **Add Execution Analytics**:
```typescript
export class AgenticMetrics {
  async recordExecution(groupId: string) {
    const status = await this.todoAdapter.callTool('GetTaskGroupStatus', {
      groupId: groupId
    });
    
    // Track metrics
    this.metrics.push({
      timestamp: Date.now(),
      totalTasks: status.statistics.total,
      duration: this.calculateDuration(status),
      successRate: status.statistics.completed / status.statistics.total,
      parallelizationFactor: this.calculateParallelization(status)
    });
  }
}
```

## Success Criteria

### Per-Phase Success Metrics
- **Phase A**: All 13 todo tools integrated and tested
- **Phase B**: AgenticOrchestrator successfully creates and manages task groups
- **Phase C**: LLM can create plans and execute tasks via agentic tools
- **Phase D**: LLM correctly uses agentic mode for appropriate requests
- **Phase E**: UI clearly shows execution progress in real-time
- **Phase F**: 95%+ task completion rate with automatic recovery
- **Phase G**: Handle 100+ task chains efficiently

### Key Differentiators from Original Plan
1. **Todo-Centric Design**: Everything revolves around using todo system for execution tracking
2. **Clear Tool Mapping**: Each agentic tool maps directly to todo operations
3. **Dependency Management**: Leverages todo system's dependency tracking
4. **State Persistence**: Todo system provides built-in execution state persistence
5. **Progress Visibility**: Real-time progress through todo status queries

This revised plan makes it crystal clear that the agentic system is built on top of the todo task management system, using it as the execution engine for all multi-step AI operations.