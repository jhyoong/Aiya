import { TaskDefinition } from './AgenticOrchestrator.js';

export interface TaskTemplate {
  name: string;
  description: string;
  constraints?: string[];
  generateTasks: (constraints?: string[]) => TaskTemplateResult;
}

export interface TaskTemplateResult {
  mainTask: {
    title: string;
    description?: string;
    tags: string[];
  };
  subtasks: Array<{
    title: string;
    description?: string;
    tags: string[];
    dependencies: number[];
    executionConfig?: {
      requiredTool: string;
      toolArgs?: Record<string, unknown>;
    };
  }>;
}

/**
 * TaskTemplates - Predefined task breakdowns for common development workflows
 *
 * Generates TodoMCPAdapter-compatible task structures with proper dependency chains.
 * Each template produces a complete task group definition suitable for CreateTaskGroup tool.
 */
export class TaskTemplates {
  private static templates: Map<string, TaskTemplate> = new Map();

  static {
    // Register all built-in templates
    this.registerTemplate('rest-api', this.createRestApiTemplate());
    this.registerTemplate(
      'react-component',
      this.createReactComponentTemplate()
    );
    this.registerTemplate(
      'file-operations',
      this.createFileOperationsTemplate()
    );
    this.registerTemplate('build-deploy', this.createBuildDeployTemplate());
    this.registerTemplate('testing-setup', this.createTestingSetupTemplate());
  }

  /**
   * Register a new template
   */
  static registerTemplate(key: string, template: TaskTemplate): void {
    this.templates.set(key, template);
  }

  /**
   * Get available template keys
   */
  static getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Get template by key
   */
  static getTemplate(key: string): TaskTemplate | undefined {
    return this.templates.get(key);
  }

  /**
   * Generate tasks from template
   */
  static generateFromTemplate(
    templateKey: string,
    constraints?: string[]
  ): TaskTemplateResult | null {
    const template = this.templates.get(templateKey);
    if (!template) {
      return null;
    }
    return template.generateTasks(constraints);
  }

  /**
   * Auto-detect template based on objective text
   */
  static detectTemplate(objective: string): string | null {
    const lower = objective.toLowerCase();

    if (
      lower.includes('rest api') ||
      lower.includes('api server') ||
      lower.includes('express')
    ) {
      return 'rest-api';
    }
    if (
      lower.includes('react component') ||
      lower.includes('tsx') ||
      lower.includes('jsx')
    ) {
      return 'react-component';
    }
    if (
      lower.includes('file') ||
      lower.includes('directory') ||
      lower.includes('folder')
    ) {
      return 'file-operations';
    }
    if (lower.includes('build') && lower.includes('deploy')) {
      return 'build-deploy';
    }
    if (lower.includes('test') || lower.includes('testing')) {
      return 'testing-setup';
    }

    return null;
  }

  /**
   * REST API Creation Template
   */
  private static createRestApiTemplate(): TaskTemplate {
    return {
      name: 'REST API Creation',
      description: 'Complete REST API development workflow with Express.js',
      constraints: ['framework', 'auth-type', 'database'],
      generateTasks: (constraints = []): TaskTemplateResult => {
        const framework = this.getConstraint(constraints, 'express', [
          'express',
          'fastify',
          'koa',
        ]);
        const authType = this.getConstraint(constraints, 'jwt', [
          'jwt',
          'session',
          'basic',
        ]);
        const database = this.getConstraint(constraints, 'json', [
          'mongodb',
          'postgres',
          'json',
          'memory',
        ]);

        return {
          mainTask: {
            title: 'Create REST API with authentication',
            description: `Build complete REST API using ${framework} with ${authType} auth and ${database} storage`,
            tags: ['development', 'api', 'backend'],
          },
          subtasks: [
            {
              title: 'Initialize Node.js project',
              description: 'Create package.json and basic project structure',
              tags: ['setup', 'nodejs'],
              dependencies: [],
              executionConfig: {
                requiredTool: 'shell',
                toolArgs: { command: 'npm init -y' },
              },
            },
            {
              title: 'Install core dependencies',
              description: `Install ${framework}, ${authType === 'jwt' ? 'jsonwebtoken, ' : ''}bcrypt`,
              tags: ['dependencies', 'npm'],
              dependencies: [0],
              executionConfig: {
                requiredTool: 'shell',
                toolArgs: {
                  command: `npm install ${framework}${authType === 'jwt' ? ' jsonwebtoken' : ''} bcrypt${database === 'mongodb' ? ' mongoose' : database === 'postgres' ? ' pg' : ''}`,
                },
              },
            },
            {
              title: 'Create server entry point',
              description: `Create main server file with ${framework} setup`,
              tags: ['server', 'core'],
              dependencies: [1],
              executionConfig: {
                requiredTool: 'filesystem',
                toolArgs: { action: 'create', path: 'server.js' },
              },
            },
            {
              title: 'Implement authentication endpoints',
              description: `Add /register and /login endpoints with ${authType} auth`,
              tags: ['auth', 'endpoints'],
              dependencies: [2],
              executionConfig: {
                requiredTool: 'filesystem',
                toolArgs: { action: 'create', path: 'routes/auth.js' },
              },
            },
            {
              title: 'Create authentication middleware',
              description: `Implement ${authType} verification middleware`,
              tags: ['middleware', 'auth'],
              dependencies: [2],
              executionConfig: {
                requiredTool: 'filesystem',
                toolArgs: { action: 'create', path: 'middleware/auth.js' },
              },
            },
            {
              title: 'Add protected API routes',
              description:
                'Create example protected endpoints using auth middleware',
              tags: ['routes', 'protected'],
              dependencies: [3, 4],
              executionConfig: {
                requiredTool: 'filesystem',
                toolArgs: { action: 'create', path: 'routes/api.js' },
              },
            },
            {
              title: 'Test API endpoints',
              description: 'Verify all endpoints work correctly',
              tags: ['testing', 'validation'],
              dependencies: [5],
              executionConfig: {
                requiredTool: 'shell',
                toolArgs: {
                  command:
                    'npm test || curl -X POST http://localhost:3000/register',
                },
              },
            },
          ],
        };
      },
    };
  }

  /**
   * React Component Template
   */
  private static createReactComponentTemplate(): TaskTemplate {
    return {
      name: 'React Component Development',
      description: 'Complete React component with TypeScript and tests',
      constraints: ['styling', 'state-management'],
      generateTasks: (constraints = []): TaskTemplateResult => {
        const styling = this.getConstraint(constraints, 'css', [
          'css',
          'styled-components',
          'tailwind',
        ]);
        const stateManagement = this.getConstraint(constraints, 'useState', [
          'useState',
          'redux',
          'zustand',
        ]);

        return {
          mainTask: {
            title: 'Create React component with tests',
            description: `Build complete React component with ${styling} styling and ${stateManagement} state management`,
            tags: ['development', 'frontend', 'react'],
          },
          subtasks: [
            {
              title: 'Create component file',
              description: 'Create main component TypeScript file',
              tags: ['component', 'typescript'],
              dependencies: [],
              executionConfig: {
                requiredTool: 'filesystem',
                toolArgs: { action: 'create', path: 'Component.tsx' },
              },
            },
            {
              title: 'Implement component logic',
              description: `Add component implementation with ${stateManagement}`,
              tags: ['implementation', 'logic'],
              dependencies: [0],
              executionConfig: {
                requiredTool: 'filesystem',
                toolArgs: { action: 'edit', path: 'Component.tsx' },
              },
            },
            {
              title: 'Add component styling',
              description: `Implement ${styling} styles`,
              tags: ['styling', 'css'],
              dependencies: [0],
              executionConfig: {
                requiredTool: 'filesystem',
                toolArgs: {
                  action: 'create',
                  path:
                    styling === 'css' ? 'Component.css' : 'Component.styles.ts',
                },
              },
            },
            {
              title: 'Create test file',
              description: 'Create component test file',
              tags: ['testing', 'jest'],
              dependencies: [0],
              executionConfig: {
                requiredTool: 'filesystem',
                toolArgs: { action: 'create', path: 'Component.test.tsx' },
              },
            },
            {
              title: 'Write component tests',
              description: 'Implement comprehensive component tests',
              tags: ['testing', 'implementation'],
              dependencies: [3],
              executionConfig: {
                requiredTool: 'filesystem',
                toolArgs: { action: 'edit', path: 'Component.test.tsx' },
              },
            },
            {
              title: 'Run tests and validate',
              description: 'Execute tests and ensure component works correctly',
              tags: ['validation', 'testing'],
              dependencies: [1, 2, 4],
              executionConfig: {
                requiredTool: 'shell',
                toolArgs: { command: 'npm test Component.test.tsx' },
              },
            },
          ],
        };
      },
    };
  }

  /**
   * File Operations Template
   */
  private static createFileOperationsTemplate(): TaskTemplate {
    return {
      name: 'File System Operations',
      description: 'File and directory manipulation workflow',
      generateTasks: (): TaskTemplateResult => ({
        mainTask: {
          title: 'Perform file system operations',
          description: 'Execute coordinated file and directory operations',
          tags: ['filesystem', 'operations'],
        },
        subtasks: [
          {
            title: 'Create directory structure',
            description: 'Create necessary directories',
            tags: ['directories', 'setup'],
            dependencies: [],
            executionConfig: {
              requiredTool: 'shell',
              toolArgs: { command: 'mkdir -p src/components src/utils tests' },
            },
          },
          {
            title: 'Create base files',
            description: 'Create initial files',
            tags: ['files', 'creation'],
            dependencies: [0],
            executionConfig: {
              requiredTool: 'filesystem',
              toolArgs: { action: 'create', path: 'src/index.js' },
            },
          },
          {
            title: 'Copy configuration files',
            description: 'Copy template configuration files',
            tags: ['config', 'copy'],
            dependencies: [0],
            executionConfig: {
              requiredTool: 'shell',
              toolArgs: { command: 'cp .env.example .env' },
            },
          },
          {
            title: 'Set file permissions',
            description: 'Set appropriate file permissions',
            tags: ['permissions', 'security'],
            dependencies: [1, 2],
            executionConfig: {
              requiredTool: 'shell',
              toolArgs: { command: 'chmod +x src/index.js' },
            },
          },
        ],
      }),
    };
  }

  /**
   * Build and Deploy Template
   */
  private static createBuildDeployTemplate(): TaskTemplate {
    return {
      name: 'Build and Deploy',
      description: 'Complete build and deployment pipeline',
      generateTasks: (): TaskTemplateResult => ({
        mainTask: {
          title: 'Build and deploy application',
          description: 'Execute complete build and deployment pipeline',
          tags: ['build', 'deploy', 'cicd'],
        },
        subtasks: [
          {
            title: 'Run tests',
            description: 'Execute complete test suite',
            tags: ['testing', 'validation'],
            dependencies: [],
            executionConfig: {
              requiredTool: 'shell',
              toolArgs: { command: 'npm test' },
            },
          },
          {
            title: 'Build application',
            description: 'Create production build',
            tags: ['build', 'production'],
            dependencies: [0],
            executionConfig: {
              requiredTool: 'shell',
              toolArgs: { command: 'npm run build' },
            },
          },
          {
            title: 'Run security audit',
            description: 'Check for security vulnerabilities',
            tags: ['security', 'audit'],
            dependencies: [1],
            executionConfig: {
              requiredTool: 'shell',
              toolArgs: { command: 'npm audit' },
            },
          },
          {
            title: 'Deploy to staging',
            description: 'Deploy to staging environment',
            tags: ['deploy', 'staging'],
            dependencies: [2],
            executionConfig: {
              requiredTool: 'shell',
              toolArgs: { command: 'npm run deploy:staging' },
            },
          },
        ],
      }),
    };
  }

  /**
   * Testing Setup Template
   */
  private static createTestingSetupTemplate(): TaskTemplate {
    return {
      name: 'Testing Framework Setup',
      description: 'Complete testing framework configuration',
      generateTasks: (): TaskTemplateResult => ({
        mainTask: {
          title: 'Set up testing framework',
          description: 'Configure complete testing environment',
          tags: ['testing', 'setup', 'framework'],
        },
        subtasks: [
          {
            title: 'Install testing dependencies',
            description: 'Install Jest and testing utilities',
            tags: ['dependencies', 'jest'],
            dependencies: [],
            executionConfig: {
              requiredTool: 'shell',
              toolArgs: {
                command:
                  'npm install --save-dev jest @testing-library/jest-dom',
              },
            },
          },
          {
            title: 'Create Jest configuration',
            description: 'Set up Jest configuration file',
            tags: ['config', 'jest'],
            dependencies: [0],
            executionConfig: {
              requiredTool: 'filesystem',
              toolArgs: { action: 'create', path: 'jest.config.js' },
            },
          },
          {
            title: 'Create test utilities',
            description: 'Set up shared test utilities',
            tags: ['utilities', 'helpers'],
            dependencies: [1],
            executionConfig: {
              requiredTool: 'filesystem',
              toolArgs: { action: 'create', path: 'tests/utils/test-utils.js' },
            },
          },
          {
            title: 'Run initial test',
            description: 'Verify testing framework works',
            tags: ['validation', 'testing'],
            dependencies: [2],
            executionConfig: {
              requiredTool: 'shell',
              toolArgs: { command: 'npm test -- --passWithNoTests' },
            },
          },
        ],
      }),
    };
  }

  /**
   * Utility to extract constraint values
   */
  private static getConstraint(
    constraints: string[],
    defaultValue: string,
    allowedValues?: string[]
  ): string {
    if (!allowedValues) return defaultValue;

    const found = constraints.find(c =>
      allowedValues.includes(c.toLowerCase())
    );
    return found?.toLowerCase() || defaultValue;
  }

  /**
   * Convert template result to TaskDefinition array (for AgenticOrchestrator)
   */
  static templateToTaskDefinitions(
    template: TaskTemplateResult
  ): TaskDefinition[] {
    return template.subtasks.map(subtask => ({
      title: subtask.title,
      description: subtask.description || '',
      tool: subtask.executionConfig?.requiredTool || 'shell',
      toolArgs: subtask.executionConfig?.toolArgs || {},
      dependencyIndices: subtask.dependencies,
    }));
  }
}
