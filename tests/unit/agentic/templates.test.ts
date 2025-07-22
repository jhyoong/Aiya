import { describe, it, expect, afterEach } from 'vitest';
import { TaskTemplates } from '../../../src/core/agentic/TaskTemplates.js';

describe('TaskTemplates TodoMCPAdapter Compatibility', () => {
  afterEach(() => {
    // Reset templates to default state
    TaskTemplates['templates'].clear();
    // Re-register default templates
    const templateClass = TaskTemplates as any;
    templateClass.registerTemplate(
      'rest-api',
      templateClass.createRestApiTemplate()
    );
    templateClass.registerTemplate(
      'react-component',
      templateClass.createReactComponentTemplate()
    );
    templateClass.registerTemplate(
      'file-operations',
      templateClass.createFileOperationsTemplate()
    );
    templateClass.registerTemplate(
      'build-deploy',
      templateClass.createBuildDeployTemplate()
    );
    templateClass.registerTemplate(
      'testing-setup',
      templateClass.createTestingSetupTemplate()
    );
  });

  describe('template registration and discovery', () => {
    it('should list available templates', () => {
      const templates = TaskTemplates.getAvailableTemplates();

      expect(templates).toContain('rest-api');
      expect(templates).toContain('react-component');
      expect(templates).toContain('file-operations');
      expect(templates).toContain('build-deploy');
      expect(templates).toContain('testing-setup');
      expect(templates.length).toBe(5);
    });

    it('should register new templates', () => {
      const customTemplate = {
        name: 'Custom Template',
        description: 'A custom template for testing',
        generateTasks: () => ({
          mainTask: {
            title: 'Custom Main Task',
            tags: ['custom'],
          },
          subtasks: [],
        }),
      };

      TaskTemplates.registerTemplate('custom', customTemplate);

      const templates = TaskTemplates.getAvailableTemplates();
      expect(templates).toContain('custom');

      const retrieved = TaskTemplates.getTemplate('custom');
      expect(retrieved).toBe(customTemplate);
    });

    it('should detect templates from objectives', () => {
      expect(TaskTemplates.detectTemplate('Create a REST API')).toBe(
        'rest-api'
      );
      expect(TaskTemplates.detectTemplate('Build Express API server')).toBe(
        'rest-api'
      );
      expect(TaskTemplates.detectTemplate('Create React component')).toBe(
        'react-component'
      );
      expect(TaskTemplates.detectTemplate('Build JSX component')).toBe(
        'react-component'
      );
      expect(TaskTemplates.detectTemplate('Create file structure')).toBe(
        'file-operations'
      );
      expect(TaskTemplates.detectTemplate('Build and deploy app')).toBe(
        'build-deploy'
      );
      expect(TaskTemplates.detectTemplate('Set up testing framework')).toBe(
        'testing-setup'
      );
      expect(TaskTemplates.detectTemplate('Unknown objective')).toBeNull();
    });
  });

  describe('REST API template TodoMCPAdapter compatibility', () => {
    it('should generate valid CreateTaskGroup structure with dependencies', () => {
      const result = TaskTemplates.generateFromTemplate('rest-api', [
        'express',
        'jwt',
        'mongodb',
      ]);

      expect(result).toBeDefined();
      expect(result?.mainTask).toEqual({
        title: 'Create REST API with authentication',
        description:
          'Build complete REST API using express with jwt auth and mongodb storage',
        tags: ['development', 'api', 'backend'],
      });

      // Check subtask structure is compatible with TodoMCPAdapter
      const subtasks = result?.subtasks || [];
      expect(subtasks.length).toBeGreaterThan(0);

      // First task should have no dependencies
      expect(subtasks[0]).toMatchObject({
        title: 'Initialize Node.js project',
        tags: ['setup', 'nodejs'],
        dependencies: [],
        executionConfig: {
          requiredTool: 'shell',
          toolArgs: { command: 'npm init -y' },
        },
      });

      // Second task should depend on first (index 0)
      expect(subtasks[1]).toMatchObject({
        title: 'Install core dependencies',
        dependencies: [0],
        executionConfig: {
          requiredTool: 'shell',
        },
      });

      // Verify dependency chain integrity
      for (let i = 0; i < subtasks.length; i++) {
        const task = subtasks[i];
        expect(task.dependencies).toBeInstanceOf(Array);

        // All dependency indices should be valid (less than current index)
        for (const depIndex of task.dependencies) {
          expect(depIndex).toBeLessThan(i);
          expect(depIndex).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should handle different constraint combinations', () => {
      const expressResult = TaskTemplates.generateFromTemplate('rest-api', [
        'express',
      ]);
      const fastifyResult = TaskTemplates.generateFromTemplate('rest-api', [
        'fastify',
      ]);

      expect(expressResult?.mainTask.description).toContain('express');
      expect(fastifyResult?.mainTask.description).toContain('fastify');

      // Check that different frameworks result in different install commands
      const expressInstall = expressResult?.subtasks.find(t =>
        t.title.includes('Install')
      )?.executionConfig?.toolArgs?.command;
      const fastifyInstall = fastifyResult?.subtasks.find(t =>
        t.title.includes('Install')
      )?.executionConfig?.toolArgs?.command;

      expect(expressInstall).toContain('express');
      expect(fastifyInstall).toContain('fastify');
    });
  });

  describe('React component template TodoMCPAdapter compatibility', () => {
    it('should generate valid structure with proper tool configurations', () => {
      const result = TaskTemplates.generateFromTemplate('react-component', [
        'styled-components',
        'zustand',
      ]);

      expect(result?.mainTask.title).toBe('Create React component with tests');
      expect(result?.mainTask.tags).toContain('react');

      const subtasks = result?.subtasks || [];

      // Component file creation task
      const createTask = subtasks.find(t =>
        t.title.includes('Create component file')
      );
      expect(createTask).toMatchObject({
        executionConfig: {
          requiredTool: 'filesystem',
          toolArgs: { action: 'create', path: 'Component.tsx' },
        },
      });

      // Test file creation task
      const testTask = subtasks.find(t => t.title.includes('Create test file'));
      expect(testTask).toMatchObject({
        executionConfig: {
          requiredTool: 'filesystem',
          toolArgs: { action: 'create', path: 'Component.test.tsx' },
        },
      });

      // Final validation task should use shell tool
      const finalTask = subtasks[subtasks.length - 1];
      expect(finalTask.executionConfig?.requiredTool).toBe('shell');
    });

    it('should adapt to different styling constraints', () => {
      const cssResult = TaskTemplates.generateFromTemplate('react-component', [
        'css',
      ]);
      const styledResult = TaskTemplates.generateFromTemplate(
        'react-component',
        ['styled-components']
      );

      const cssStyleTask = cssResult?.subtasks.find(t =>
        t.title.includes('styling')
      );
      const styledStyleTask = styledResult?.subtasks.find(t =>
        t.title.includes('styling')
      );

      expect(cssStyleTask?.executionConfig?.toolArgs?.path).toBe(
        'Component.css'
      );
      expect(styledStyleTask?.executionConfig?.toolArgs?.path).toBe(
        'Component.styles.ts'
      );
    });
  });

  describe('Template to TaskDefinition conversion', () => {
    it('should convert template results to AgenticOrchestrator TaskDefinitions', () => {
      const templateResult =
        TaskTemplates.generateFromTemplate('file-operations');
      expect(templateResult).toBeDefined();

      const taskDefinitions = TaskTemplates.templateToTaskDefinitions(
        templateResult!
      );

      expect(taskDefinitions.length).toEqual(templateResult!.subtasks.length);

      // Check conversion structure
      for (let i = 0; i < taskDefinitions.length; i++) {
        const taskDef = taskDefinitions[i];
        const subtask = templateResult!.subtasks[i];

        expect(taskDef).toMatchObject({
          title: subtask.title,
          description: subtask.description,
          tool: subtask.executionConfig?.requiredTool || 'shell',
          toolArgs: subtask.executionConfig?.toolArgs || {},
          dependencyIndices: subtask.dependencies,
        });
      }
    });

    it('should handle tasks without executionConfig', () => {
      const customTemplate = {
        mainTask: { title: 'Test', tags: [] },
        subtasks: [
          {
            title: 'Task without config',
            tags: [],
            dependencies: [],
          },
        ],
      };

      const taskDefinitions =
        TaskTemplates.templateToTaskDefinitions(customTemplate);

      expect(taskDefinitions[0]).toMatchObject({
        title: 'Task without config',
        tool: 'shell',
        toolArgs: {},
        dependencyIndices: [],
      });
    });
  });

  describe('All templates TodoMCPAdapter validation', () => {
    const templateKeys = [
      'rest-api',
      'react-component',
      'file-operations',
      'build-deploy',
      'testing-setup',
    ];

    templateKeys.forEach(templateKey => {
      it(`should generate valid TodoMCPAdapter structure for ${templateKey} template`, () => {
        const result = TaskTemplates.generateFromTemplate(templateKey);

        expect(result).toBeDefined();
        expect(result?.mainTask).toBeDefined();
        expect(result?.mainTask.title).toBeTruthy();
        expect(result?.mainTask.tags).toBeInstanceOf(Array);
        expect(result?.subtasks).toBeInstanceOf(Array);

        // Validate each subtask has required TodoMCPAdapter fields
        for (const subtask of result?.subtasks || []) {
          expect(subtask.title).toBeTruthy();
          expect(subtask.tags).toBeInstanceOf(Array);
          expect(subtask.dependencies).toBeInstanceOf(Array);

          // All dependency indices should be valid
          for (const depIndex of subtask.dependencies) {
            expect(typeof depIndex).toBe('number');
            expect(depIndex).toBeGreaterThanOrEqual(0);
          }

          // ExecutionConfig should be valid if present
          if (subtask.executionConfig) {
            expect(subtask.executionConfig.requiredTool).toBeTruthy();
          }
        }

        // Test conversion to TaskDefinitions works
        const taskDefinitions = TaskTemplates.templateToTaskDefinitions(
          result!
        );
        expect(taskDefinitions.length).toBe(result!.subtasks.length);
      });
    });
  });

  describe('Constraint handling', () => {
    it('should extract constraints correctly', () => {
      const templateClass = TaskTemplates as any;

      expect(
        templateClass.getConstraint(['express', 'jwt'], 'default', [
          'express',
          'fastify',
        ])
      ).toBe('express');
      expect(
        templateClass.getConstraint(['unknown'], 'default', [
          'express',
          'fastify',
        ])
      ).toBe('default');
      expect(templateClass.getConstraint([], 'default')).toBe('default');
    });

    it('should be case insensitive', () => {
      const templateClass = TaskTemplates as any;

      expect(
        templateClass.getConstraint(['EXPRESS'], 'default', [
          'express',
          'fastify',
        ])
      ).toBe('express');
      expect(
        templateClass.getConstraint(['JWT'], 'default', ['jwt', 'session'])
      ).toBe('jwt');
    });
  });

  describe('Error handling', () => {
    it('should handle non-existent templates gracefully', () => {
      const result = TaskTemplates.generateFromTemplate('non-existent');
      expect(result).toBeNull();
    });

    it('should handle empty constraints', () => {
      const result = TaskTemplates.generateFromTemplate('rest-api', []);
      expect(result).toBeDefined();
      expect(result?.mainTask.description).toContain('express'); // default framework
    });
  });
});
