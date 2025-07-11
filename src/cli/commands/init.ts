import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { SetupWizard } from '../../ui/components/setup/SetupWizard.js';

export const initCommand = new Command('init')
  .description('Initialize Aiya configuration for current project')
  .option('--skip-validation', 'Skip connection testing during setup')
  .option(
    '--non-interactive',
    'Run in non-interactive mode (not yet implemented)'
  )
  .action(async options => {
    try {
      // Start the interactive setup wizard
      await runSetupWizard(process.cwd(), options);
    } catch (error) {
      console.error(
        '❌ Setup failed:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      process.exit(1);
    }
  });

interface SetupOptions {
  skipValidation?: boolean;
  nonInteractive?: boolean;
}

async function runSetupWizard(
  projectPath: string,
  _options: SetupOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleComplete = (success: boolean, _configPath?: string) => {
      if (success) {
        resolve();
      } else {
        reject(new Error('Setup was cancelled or failed'));
      }
    };

    const handleError = (error: string) => {
      reject(new Error(error));
    };

    // Render the SetupWizard component
    const { unmount } = render(
      React.createElement(SetupWizard, {
        projectPath,
        onComplete: handleComplete,
        onError: handleError,
      })
    );

    // Handle Ctrl+C gracefully
    const handleInterrupt = () => {
      unmount();
      console.log('\n\n❌ Setup cancelled by user');
      process.exit(0);
    };

    process.on('SIGINT', handleInterrupt);
    process.on('SIGTERM', handleInterrupt);

    // Clean up event listeners when setup completes
    const cleanup = () => {
      process.removeListener('SIGINT', handleInterrupt);
      process.removeListener('SIGTERM', handleInterrupt);
      unmount();
    };

    // Override the onComplete handler to include cleanup
    const originalOnComplete = handleComplete;
    const wrappedOnComplete = (success: boolean, configPath?: string) => {
      cleanup();
      originalOnComplete(success, configPath);
    };

    const originalOnError = handleError;
    const wrappedOnError = (error: string) => {
      cleanup();
      originalOnError(error);
    };

    // Re-render with wrapped handlers
    unmount();
    render(
      React.createElement(SetupWizard, {
        projectPath,
        onComplete: wrappedOnComplete,
        onError: wrappedOnError,
      })
    );
  });
}
