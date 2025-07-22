import { LLMTool } from '../tools/mcp-tools.js';

/**
 * Tool parameter validation types for agentic execution
 */
export interface AgenticTaskDefinition {
  title: string;
  description?: string;
  tool?: string;
  dependsOn?: number[];
}

/**
 * Agentic tool definitions that enable LLM-driven multi-step task execution
 * These tools provide a high-level interface for LLMs to plan, execute, and track
 * complex workflows using the TodoMCPAdapter as the execution engine.
 */
export const AGENTIC_TOOLS: LLMTool[] = [
  {
    name: 'agentic_planTasks',
    description: `Create an execution plan for a complex multi-step task. 
                  This breaks down your objective into ordered subtasks and tracks them in the todo system.
                  Use this when you need to coordinate multiple steps that must happen in sequence.
                  Returns a groupId to use for task execution and progress tracking.`,
    parameters: {
      type: 'object',
      properties: {
        objective: {
          type: 'string',
          description: 'The high-level goal you want to accomplish (e.g., "Create a REST API with authentication")'
        },
        tasks: {
          type: 'array',
          description: 'Ordered list of atomic tasks needed to complete the objective',
          items: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Short, clear task title'
              },
              description: {
                type: 'string',
                description: 'Detailed description of what this task accomplishes'
              },
              tool: {
                type: 'string',
                description: 'Primary tool needed for this task (e.g., "shell", "filesystem")',
                default: 'shell'
              },
              dependsOn: {
                type: 'array',
                items: { type: 'number' },
                description: 'Array of task indices this task depends on (0-based). Empty array means no dependencies.'
              }
            },
            required: ['title', 'dependsOn']
          }
        },
        constraints: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional constraints or requirements for the execution (e.g., ["Use Express", "JWT for auth"])'
        }
      },
      required: ['objective', 'tasks']
    }
  },

  {
    name: 'agentic_executeNext',
    description: `Get the next task that's ready to execute from your execution plan.
                  Tasks are returned in dependency order - you'll only get tasks whose dependencies are complete.
                  Returns null when all tasks are finished. Always call this before executing any task.`,
    parameters: {
      type: 'object',
      properties: {
        groupId: {
          type: 'string',
          description: 'The execution plan ID returned by agentic_planTasks'
        }
      },
      required: ['groupId']
    }
  },

  {
    name: 'agentic_completeTask',
    description: `Mark a task as successfully completed after execution.
                  This updates the todo system and may make dependent tasks ready to execute.
                  Always call this after successfully completing a task from agentic_executeNext.`,
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID returned by agentic_executeNext'
        },
        result: {
          type: 'string',
          description: 'Brief summary of what was accomplished (optional but recommended for tracking)'
        }
      },
      required: ['taskId']
    }
  },

  {
    name: 'agentic_failTask',
    description: `Mark a task as failed when execution encounters an unrecoverable error.
                  This blocks dependent tasks and triggers error recovery processes.
                  Use this when a task cannot be completed due to errors.`,
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID returned by agentic_executeNext'
        },
        error: {
          type: 'string',
          description: 'Description of the error that caused the failure'
        },
        retryable: {
          type: 'boolean',
          description: 'Whether this task can be retried after fixing the underlying issue',
          default: true
        }
      },
      required: ['taskId', 'error']
    }
  },

  {
    name: 'agentic_checkProgress',
    description: `Check the execution progress and status of your task plan.
                  Returns completion statistics, current task states, and overall progress.
                  Use this to understand how much work remains and identify any issues.`,
    parameters: {
      type: 'object',
      properties: {
        groupId: {
          type: 'string',
          description: 'The execution plan ID returned by agentic_planTasks'
        },
        includeDetails: {
          type: 'boolean',
          description: 'Include detailed information about individual task states',
          default: false
        }
      },
      required: ['groupId']
    }
  }
];

/**
 * System prompt guidance for LLMs on using agentic tools effectively
 */
export const AGENTIC_SYSTEM_PROMPT = `
## Agentic Execution Mode

You have access to agentic execution tools that help you complete complex multi-step tasks systematically.

### When to Use Agentic Mode

Use agentic execution when:
- The task requires multiple coordinated steps (3+ operations)
- You need to track progress across multiple operations
- Steps must happen in a specific order due to dependencies
- The task involves creating/modifying multiple files or systems
- Error recovery and retry logic would be beneficial

### How to Use Agentic Mode

1. **Plan Your Tasks** with \`agentic_planTasks\`:
   - Break down the objective into atomic, single-tool operations
   - Each task should accomplish ONE clear thing
   - Specify dependencies between tasks (which must complete before others can start)
   - Be specific about which tool each task needs

2. **Execute Tasks in Order**:
   - Use \`agentic_executeNext\` to get the next ready task
   - Execute the task using the specified tool
   - Mark success with \`agentic_completeTask\` OR failure with \`agentic_failTask\`
   - Repeat until \`agentic_executeNext\` returns null (all tasks complete)

3. **Track Progress** with \`agentic_checkProgress\`:
   - Monitor overall completion status
   - Identify stuck or failed tasks
   - Get detailed task state information when needed

### Important Notes

- Tasks with unmet dependencies won't be returned by \`executeNext\`
- Always complete or fail a task before requesting the next one
- The system automatically handles dependency ordering
- Failed tasks block their dependents until resolved
- Use clear, descriptive task titles and descriptions

### Example Usage

\`\`\`
// 1. Create execution plan
agentic_planTasks({
  objective: "Create a React component with tests",
  tasks: [
    {
      title: "Create component file",
      description: "Create Button.tsx in components directory",
      tool: "filesystem",
      dependsOn: []
    },
    {
      title: "Implement Button component",
      description: "Write TypeScript React component with props interface",
      tool: "filesystem", 
      dependsOn: [0]
    },
    {
      title: "Create test file",
      description: "Create Button.test.tsx for component testing",
      tool: "filesystem",
      dependsOn: [0]
    },
    {
      title: "Write component tests",
      description: "Implement unit tests using testing-library",
      tool: "filesystem",
      dependsOn: [2, 1]
    }
  ]
})

// 2. Execute tasks in dependency order
while (true) {
  const task = agentic_executeNext({ groupId: "plan-id" });
  if (!task) break; // All tasks complete
  
  // Execute using appropriate tool
  // Then mark as complete or failed
  agentic_completeTask({ taskId: task.taskId, result: "Component created" });
}
\`\`\`
`;