Manual Testing Steps for Task 2: AiyaConfig Integration

  🎯 Testing Objectives

  Verify that shell configuration integrates properly with the main AiyaConfig system with correct precedence and persistence.

  📋 Manual Test Cases

  Test 1: Default Configuration Loading

  Purpose: Verify default shell configuration loads correctly

  Steps:
  1. Backup existing .aiya.yaml (if any): cp .aiya.yaml .aiya.yaml.backup
  2. Remove any existing global config: rm -rf ~/.aiya/
  3. Clear shell environment variables:
  unset AIYA_SHELL_CONFIRMATION_THRESHOLD
  unset AIYA_SHELL_CONFIRMATION_TIMEOUT
  unset AIYA_SHELL_SESSION_MEMORY
  4. Run: node -e "import('./dist/core/config/manager.js').then(({ConfigManager}) => { const c = new ConfigManager(); c.load().then(r => console.log('Default shell config:', JSON.stringify(r.shell, null, 2))); })"

  Expected Results:
  - requireConfirmationForRisky: true
  - confirmationTimeout: 30000
  - sessionMemory: true
  - requireConfirmation: true
  - allowComplexCommands: false
  - trustedCommands array with 5 default patterns

  ---
  Test 2: Environment Variable Overrides

  Purpose: Verify environment variables override defaults correctly

  Steps:
  1. Set environment variables:
  export AIYA_SHELL_CONFIRMATION_THRESHOLD=75
  export AIYA_SHELL_CONFIRMATION_TIMEOUT=45000
  export AIYA_SHELL_SESSION_MEMORY=false
  export AIYA_SHELL_REQUIRE_CONFIRMATION=false
  export AIYA_SHELL_ALLOW_COMPLEX_COMMANDS=true
  export AIYA_SHELL_MAX_EXECUTION_TIME=60
  2. Run config test again (same command as Test 1)
  3. Clear environment variables: unset AIYA_SHELL_*

  Expected Results:
  - requireConfirmationForRisky: false
  - confirmationTimeout: 45000
  - sessionMemory: false
  - requireConfirmation: false
  - allowComplexCommands: true
  - maxExecutionTime: 60

  ---
  Test 3: Project Configuration Override

  Purpose: Verify project-level .aiya.yaml overrides global settings

  Steps:
  1. Create a test project directory: mkdir ~/test-aiya-config && cd ~/test-aiya-config
  2. Create .aiya.yaml with shell overrides:
  shell:
    requireConfirmationForRisky: true
    sessionMemory: false
    trustedCommands:
      - ^test-command
      - ^custom-pattern
  3. Run config test from this directory
  4. Clean up: cd ~ && rm -rf ~/test-aiya-config

  Expected Results:
  - requireConfirmationForRisky: true (from project config)
  - sessionMemory: false (from project config)
  - trustedCommands should include ^test-command and ^custom-pattern
  - Other fields should use defaults

  ---
  Test 4: Configuration Precedence Order

  Purpose: Verify precedence: defaults → global → project → environment

  Steps:
  1. Create global config: mkdir -p ~/.aiya && echo 'shell:\n  requireConfirmationForRisky: false\n  sessionMemory: true' > ~/.aiya/config.yaml
  2. Create project config: echo 'shell:\n  requireConfirmationForRisky: true\n  confirmationTimeout: 25000' > .aiya.yaml
  3. Set environment variable: export AIYA_SHELL_REQUIRE_CONFIRMATION_FOR_RISKY=false
  4. Run config test
  5. Clean up: rm -rf ~/.aiya .aiya.yaml && unset AIYA_SHELL_REQUIRE_CONFIRMATION_FOR_RISKY

  Expected Results:
  - requireConfirmationForRisky: false (environment wins)
  - confirmationTimeout: 25000 (project config)
  - sessionMemory: true (global config)

  ---
  Test 5: Configuration Persistence

  Purpose: Verify configuration can be saved and loaded

  Steps:
  1. Run save test:
  node -e "
  import('./dist/core/config/manager.js').then(({ConfigManager}) => {
    const c = new ConfigManager();
    c.save({
      shell: {
        requireConfirmationForRisky: false,
        sessionMemory: false,
        trustedCommands: ['^saved-command']
      }
    }).then(() => console.log('Config saved'));
  })
  "
  2. Verify saved config loads:
  node -e "
  import('./dist/core/config/manager.js').then(({ConfigManager}) => {
    const c = new ConfigManager();
    c.load().then(r => console.log('Loaded config:', r.shell.requireConfirmationForRisky, r.shell.sessionMemory));
  })
  "
  3. Clean up: rm -rf ~/.aiya

  Expected Results:
  - First command: "Config saved" message
  - Second command: Shows 85 false (saved values)

  ---
  Test 6: YAML Generation Integration

  Purpose: Verify new projects get shell configuration in generated YAML

  Steps:
  1. Create test directory: mkdir ~/test-yaml-gen && cd ~/test-yaml-gen
  2. Run init with shell config generation:
  node -e "
  import('./dist/core/config/generation.js').then(({ConfigurationGenerator}) => {
    const gen = new ConfigurationGenerator();
    const session = {
      primaryProvider: {type: 'ollama', baseUrl: 'http://localhost:11434', model: 'test'},
      additionalProviders: [],
      skipValidation: false,
      projectPath: process.cwd()
    };
    console.log(gen.generateYAML(session));
  })
  "
  3. Clean up: cd ~ && rm -rf ~/test-yaml-gen

  Expected Results:
  - Generated YAML should contain a shell: section
  - Should include shell configuration comments
  - Should include environment variable documentation for AIYA_SHELL_* variables

  ---
  Test 7: Shell Client Integration

  Purpose: Verify shell client uses configuration from ConfigManager

  Steps:
  1. Create test script to check shell client config usage:
  node -e "
  import('./dist/core/config/manager.js').then(({ConfigManager}) => {
    const c = new ConfigManager();
    c.load().then(config => {
      console.log('Shell config will be passed to ShellMCPClient:');
      console.log('- requireConfirmationForRisky:', config.shell.requireConfirmationForRisky);
      console.log('- maxExecutionTime:', config.shell.maxExecutionTime);
      console.log('- trustedCommands count:', config.shell.trustedCommands.length);
    });
  })
  "

  Expected Results:
  - Shows shell configuration that would be passed to ShellMCPClient
  - Values should match expected defaults or overrides

  ---
  Test 8: Configuration Validation

  Purpose: Verify invalid configuration falls back to defaults

  Steps:
  1. Create invalid global config:
  mkdir -p ~/.aiya
  echo 'shell:\n  requireConfirmationForRisky: 150\n  confirmationTimeout: -1000' > ~/.aiya/config.yaml
  2. Run config test
  3. Clean up: rm -rf ~/.aiya

  Expected Results:
  - Should not crash
  - Should fall back to default values (threshold: 50, timeout: 30000)
  - Should show warning about failed config load

  ---
  ✅ Success Criteria

  All tests should pass with these outcomes:
  - Default configuration loads correctly
  - Environment variables override defaults
  - Project configuration overrides global configuration
  - Configuration precedence works: env → project → global → defaults
  - Configuration persistence works (save/load cycle)
  - YAML generation includes shell section with proper comments
  - Shell client receives configuration from ConfigManager
  - Invalid configurations fall back to defaults gracefully

  🔧 Test Environment Setup

  - Run tests from the main Aiya project directory: /home/minijh/Aiya
  - Ensure TypeScript is compiled: npm run build
  - Clean slate: Remove any existing ~/.aiya/ directory before testing

  📝 Test Notes

  - Environment variables set in one test may affect subsequent tests
  - Use unset AIYA_SHELL_* to clear environment variables between tests
  - The project already has shell configuration in .aiya.yaml - this will be used as the project config source