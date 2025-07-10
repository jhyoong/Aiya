# Aiya Testing Infrastructure Implementation Plan

## Executive Summary

This document outlines the comprehensive implementation plan for establishing a robust automated testing framework for Aiya CLI v1.2.0. The plan transforms the current manual testing approach into a fully automated testing system with coverage for all 6 AI providers, UI components, configuration management, and core system functionality.

## Table of Contents

1. [Project Context](#project-context)
2. [Current State Analysis](#current-state-analysis)
3. [Testing Architecture Design](#testing-architecture-design)
4. [Implementation Phases](#implementation-phases)
5. [Technical Specifications](#technical-specifications)
6. [Risk Assessment](#risk-assessment)
7. [Success Metrics](#success-metrics)
8. [Resource Requirements](#resource-requirements)
9. [Appendices](#appendices)

## Project Context

### Aiya Architecture Overview
Aiya is a terminal-based AI development assistant built with:
- **Core Language**: TypeScript with strict configuration
- **UI Framework**: React/Ink for terminal interfaces
- **CLI Framework**: Commander.js
- **Configuration**: YAML with environment variable overrides
- **Provider Support**: 3 AI providers (Ollama, OpenAI, Gemini)
- **File Operations**: Model Context Protocol (MCP) for secure file handling
- **Input System**: Custom keyboard handling with Unicode support

### Testing Scope
**Files to Test**: 60+ TypeScript files across:
- Provider implementations (3 main providers)
- UI components (React/Ink)
- Configuration management
- MCP tools and file operations
- CLI commands and interfaces
- Security and workspace boundaries
- Token counting and logging

## Current State Analysis

### Existing Testing Infrastructure
- **Current Approach**: Manual testing scenarios
- **Documentation**: 
  - `tests/integration/basic-workflow.md` - Core workflow tests
  - `tests/integration/input-system-validation.md` - Input system validation
  - `tests/integration/multi-provider-manual-testing-guide.md` - Provider testing
- **Test Script**: Placeholder pointing to manual testing
- **Coverage**: Manual scenarios only, no automation

### Key Challenges Identified
1. **Provider Complexity**: 3 different main AI providers with varying capabilities
2. **Terminal UI Testing**: React/Ink components require specialized testing
3. **Custom Input System**: Unique keyboard handling needs validation
4. **File System Security**: MCP operations need sandbox testing
5. **Configuration Variety**: Multiple formats and override mechanisms
6. **External Dependencies**: Real API services for integration testing

### Gaps in Current Testing
- No unit tests for core functionality
- No integration tests for provider switching
- No UI component testing
- No configuration validation testing
- No performance benchmarking
- No regression testing framework

## Testing Architecture Design

### Framework Selection

#### Primary Testing Stack
- **Vitest**: Modern, fast testing framework with native TypeScript support
  - Chosen for: Speed, TypeScript integration, ESM support, built-in mocking
  - Alternative considered: Jest (more mature but slower with TypeScript)

- **Testing Library**: UI component testing utilities
  - Chosen for: React/Ink compatibility, accessibility-focused testing
  - Custom adapter needed for Ink terminal components

- **MSW (Mock Service Worker)**: API mocking for provider tests
  - Chosen for: Realistic network-level mocking, provider API simulation
  - Handles all 6 AI provider APIs with realistic responses

#### Supporting Tools
- **Playwright**: End-to-end testing for terminal applications
- **c8**: Code coverage reporting
- **@testing-library/jest-dom**: Custom matchers for DOM testing

### Testing Hierarchy

```
tests/
├── unit/                    # Unit tests for individual modules
│   ├── providers/          # Provider implementation tests
│   ├── config/             # Configuration management tests
│   ├── mcp/                # MCP tools tests
│   ├── security/           # Security and workspace tests
│   └── utils/              # Utility function tests
├── integration/            # Integration tests for component interaction
│   ├── workflows/          # Complete user workflow tests
│   ├── provider-switching/ # Multi-provider scenario tests
│   ├── file-operations/    # MCP integration tests
│   └── configuration/      # Config loading and validation tests
├── ui/                     # UI component tests
│   ├── components/         # Individual React/Ink component tests
│   ├── hooks/              # Custom hook tests
│   └── integration/        # UI integration tests
├── e2e/                    # End-to-end tests
│   ├── commands/           # CLI command tests
│   ├── scenarios/          # Complete user scenarios
│   └── performance/        # Performance and load tests
├── mocks/                  # Mock implementations
│   ├── providers/          # Mock AI provider implementations
│   ├── filesystem/         # Mock file system operations
│   └── api/                # API response mocks
├── fixtures/               # Test data and configurations
│   ├── configs/            # Sample configuration files
│   ├── responses/          # Captured provider responses
│   └── files/              # Test files for MCP operations
└── utils/                  # Testing utilities and helpers
    ├── test-setup.ts       # Global test configuration
    ├── provider-factory.ts # Test provider creation
    ├── config-builder.ts   # Test configuration builder
    └── assertions.ts       # Custom assertion helpers
```

## Implementation Phases

### Phase 1: Foundation & Setup (2-3 weeks)

#### Objectives
Establish the testing infrastructure foundation and basic framework components.

#### Deliverables
1. **Testing Framework Configuration**
   - Vitest installation and configuration
   - TypeScript integration
   - ESM module support
   - Source map support for debugging

2. **Package.json Updates**
   - Replace placeholder test scripts
   - Add development dependencies
   - Configure test execution commands
   - Set up coverage reporting

3. **Basic Test Utilities**
   - Test setup and teardown helpers
   - Configuration builders for tests
   - Mock data factories
   - Custom assertion utilities

4. **CI/CD Pipeline Foundation**
   - GitHub Actions workflow setup
   - Test execution on pull requests
   - Basic coverage reporting
   - Failure notifications

#### Technical Tasks

**T1.1: Install Testing Dependencies**
```bash
npm install --save-dev vitest @vitest/ui c8 @testing-library/react @testing-library/jest-dom msw
```

**T1.2: Create Vitest Configuration**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/']
    }
  }
})
```

**T1.3: Update Package.json Scripts**
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch"
  }
}
```

**T1.4: Create Test Utilities Structure**
- `tests/utils/test-setup.ts` - Global test configuration
- `tests/utils/provider-factory.ts` - Provider instance creation
- `tests/utils/config-builder.ts` - Configuration generation
- `tests/utils/assertions.ts` - Custom matchers

#### Success Criteria
- [ ] `npm test` executes successfully
- [ ] Coverage reports generate properly
- [ ] Test utilities can create mock configurations
- [ ] CI/CD pipeline runs tests automatically
- [ ] Basic smoke test passes

### Phase 2: Provider Testing Framework (3-4 weeks)

#### Objectives
Implement comprehensive testing for all 3 main AI providers with mock implementations and real API testing capabilities.

#### Deliverables
1. **Abstract Provider Test Suite**
   - Base test class for all providers
   - Common test scenarios
   - Standardized provider testing interface
   - Shared assertion helpers

2. **Mock Provider Implementations**
   - Complete mock for each provider (Ollama, OpenAI, Gemini)
   - Realistic response simulation
   - Error condition simulation
   - Streaming response mocking

3. **Provider-Specific Test Suites**
   - Authentication testing
   - Model capability detection
   - Response parsing validation
   - Error handling verification
   - Token counting accuracy

4. **Integration Test Framework**
   - Provider factory testing
   - Provider switching scenarios
   - Configuration loading validation
   - Real API integration tests (optional)

#### Technical Implementation

**T2.1: Abstract Provider Test Suite**
```typescript
// tests/unit/providers/base-provider-test.ts
export abstract class ProviderTestSuite {
  abstract providerType: string;
  abstract testConfig: ExtendedProviderConfig;
  
  abstract testConnection(): Promise<void>;
  abstract testModelList(): Promise<void>;
  abstract testChat(): Promise<void>;
  abstract testStreaming(): Promise<void>;
  abstract testErrorHandling(): Promise<void>;
  abstract testTokenCounting(): Promise<void>;
  abstract testCapabilityDetection(): Promise<void>;
}
```

**T2.2: Mock Provider Structure**
```typescript
// tests/mocks/providers/mock-ollama.ts
export class MockOllamaProvider {
  constructor(private config: OllamaConfig) {}
  
  async listModels(): Promise<Model[]> {
    return MOCK_OLLAMA_MODELS;
  }
  
  async chat(messages: Message[]): Promise<ChatResponse> {
    return this.generateMockResponse(messages);
  }
  
  simulateError(errorType: 'connection' | 'auth' | 'model_not_found') {
    // Error simulation logic
  }
}
```

**T2.3: Provider Test Implementation Matrix**
| Provider | Auth Test | Model List | Chat | Streaming | Vision | Function Calls | Thinking |
|----------|-----------|------------|------|-----------|--------|----------------|----------|
| Ollama   | ✓         | ✓          | ✓    | ✓         | -      | ✓              | -        |
| OpenAI   | ✓         | ✓          | ✓    | ✓         | ✓      | ✓              | -        |
| Gemini   | ✓         | ✓          | ✓    | ✓         | ✓      | ✓              | ✓        |

*Depends on underlying model

#### Success Criteria
- [ ] All 3 main providers have comprehensive test coverage >90%
- [ ] Mock providers generate realistic responses
- [ ] Authentication failures are properly handled
- [ ] Provider capabilities are correctly detected
- [ ] Streaming responses work correctly
- [ ] Error scenarios are properly tested
- [ ] Token counting accuracy is validated

### Phase 3: Configuration & Validation Testing (2-3 weeks)

#### Objectives
Implement comprehensive testing for configuration management, validation, and loading mechanisms.

#### Deliverables
1. **Configuration Format Testing**
   - Flat YAML configuration validation
   - Nested YAML configuration validation
   - Environment variable override testing
   - Configuration hierarchy testing

2. **Validation Test Suite**
   - Schema validation testing
   - Provider-specific validation
   - Error message validation
   - Default value generation testing

3. **Migration Testing**
   - Configuration format migration
   - Backward compatibility testing
   - Version upgrade scenarios
   - Data preservation validation

4. **Environment Testing**
   - Environment variable precedence
   - Multi-environment configurations
   - Configuration file discovery
   - Global vs project configuration

#### Technical Implementation

**T3.1: Configuration Test Scenarios**
```typescript
// tests/unit/config/configuration-tests.ts
describe('Configuration Management', () => {
  describe('Format Support', () => {
    test('loads flat YAML configuration');
    test('loads nested YAML configuration');
    test('handles malformed YAML gracefully');
    test('validates required fields');
  });
  
  describe('Environment Variables', () => {
    test('environment variables override config files');
    test('provider-specific environment variables');
    test('validation with environment overrides');
  });
});
```

**T3.2: Validation Test Matrix**
| Configuration Type | Valid Cases | Invalid Cases | Error Messages |
|-------------------|-------------|---------------|----------------|
| Ollama Config     | ✓           | ✓             | ✓              |
| OpenAI Config     | ✓           | ✓             | ✓              |
| Multi-Provider    | ✓           | ✓             | ✓              |
| Environment Vars  | ✓           | ✓             | ✓              |

#### Success Criteria
- [ ] All configuration formats load correctly
- [ ] Environment variables properly override config files
- [ ] Invalid configurations fail with helpful error messages
- [ ] Configuration migrations preserve data correctly
- [ ] Default configurations are generated properly

### Phase 4: Core System Testing (3-4 weeks)

#### Objectives
Test core system components including MCP tools, file operations, security boundaries, and token management.

#### Deliverables
1. **MCP Tools Testing**
   - File operation testing (read, write, search)
   - Tool execution validation
   - Error handling testing
   - Security boundary testing

2. **Token Management Testing**
   - Token counting accuracy
   - Usage logging validation
   - Session management testing
   - Provider-specific token handling

3. **Security Testing**
   - Workspace boundary enforcement
   - File access validation
   - Path traversal prevention
   - Extension filtering testing

4. **File Operations Testing**
   - Atomic operations testing
   - Queue management testing
   - Pattern matching validation
   - Diff generation testing

#### Technical Implementation

**T4.1: MCP Tools Test Suite**
```typescript
// tests/unit/mcp/mcp-tools-tests.ts
describe('MCP Tools', () => {
  describe('File Operations', () => {
    test('read_file respects workspace boundaries');
    test('write_file creates atomic operations');
    test('search_files uses correct patterns');
    test('list_directory filters by extensions');
  });
  
  describe('Security', () => {
    test('prevents path traversal attacks');
    test('enforces file extension allowlist');
    test('respects workspace root boundaries');
  });
});
```

**T4.2: Token Management Testing**
```typescript
// tests/unit/tokens/token-counter-tests.ts
describe('Token Counter', () => {
  test('counts tokens accurately for OpenAI');
  test('estimates tokens for Ollama');
  test('extracts usage from Gemini responses');
  test('logs token usage with session IDs');
  test('resets counters on provider switch');
});
```

#### Success Criteria
- [ ] File operations respect security boundaries
- [ ] Token counting is accurate for all providers
- [ ] MCP tools work correctly with all providers
- [ ] Security validations prevent unauthorized access
- [ ] Error handling is robust and informative

### Phase 5: UI Component Testing (2-3 weeks)

#### Objectives
Implement testing for React/Ink UI components, input handling, and terminal interface functionality.

#### Deliverables
1. **React/Ink Testing Framework**
   - Custom testing utilities for Ink components
   - Render testing for terminal components
   - State management testing
   - Event handling validation

2. **Input System Testing**
   - Keyboard input handling
   - Bracketed paste mode testing
   - Multiline input validation
   - Command processing testing

3. **UI Component Test Suite**
   - Chat interface testing
   - Status bar testing
   - Command suggestion testing
   - Error display testing

4. **Integration Testing**
   - Component interaction testing
   - State synchronization testing
   - Event flow validation
   - Performance testing

#### Technical Implementation

**T5.1: Ink Testing Setup**
```typescript
// tests/utils/ink-test-utils.ts
export function renderInkComponent(component: React.ReactElement) {
  const { rerender, unmount, lastFrame } = render(component);
  return {
    rerender,
    unmount,
    getOutput: () => lastFrame(),
    findText: (text: string) => lastFrame().includes(text)
  };
}
```

**T5.2: Input System Testing**
```typescript
// tests/ui/hooks/useKeypress.test.ts
describe('useKeypress Hook', () => {
  test('handles basic keyboard input');
  test('processes bracketed paste correctly');
  test('handles multiline input');
  test('processes escape sequences');
  test('manages raw mode correctly');
});
```

#### Success Criteria
- [ ] All UI components render correctly
- [ ] Input handling works with custom keyboard logic
- [ ] Chat interface properly displays messages
- [ ] Status bar updates correctly reflect system state
- [ ] Command processing works reliably

### Phase 6: Integration Testing (2-3 weeks)

#### Objectives
Test complete workflows, multi-provider scenarios, and system integration points.

#### Deliverables
1. **End-to-End Workflow Testing**
   - Complete init → chat → file operations workflow
   - Provider switching scenarios
   - Configuration updates during sessions
   - Error recovery testing

2. **Multi-Provider Integration**
   - Provider switching preservation
   - Chat history management
   - Token counter synchronization
   - Configuration validation

3. **Command Execution Testing**
   - Slash command processing
   - MCP tool integration
   - Error handling workflows
   - Session state management

4. **System Integration Testing**
   - Component interaction validation
   - Data flow testing
   - Event propagation testing
   - State consistency validation

#### Technical Implementation

**T6.1: Workflow Testing Framework**
```typescript
// tests/integration/workflows/complete-workflow.test.ts
describe('Complete User Workflows', () => {
  test('first-time setup to chat workflow');
  test('multi-provider switching workflow');
  test('file operations workflow');
  test('error recovery workflow');
});
```

**T6.2: Integration Test Scenarios**
| Scenario | Components Tested | Success Criteria |
|----------|-------------------|------------------|
| Init Flow | CLI, Config, UI | Config created, UI starts |
| Chat Flow | UI, Provider, MCP | Messages sent/received |
| File Ops | MCP, Security, UI | Files read/written safely |
| Switching | Provider, UI, Tokens | History preserved |

#### Success Criteria
- [ ] Complete user workflows work end-to-end
- [ ] Provider switching preserves chat history
- [ ] Commands execute correctly in all scenarios
- [ ] Session state is properly managed
- [ ] Integration points work reliably

### Phase 7: Performance & Load Testing (2-3 weeks)

#### Objectives
Implement performance testing, monitoring, and optimization validation.

#### Deliverables
1. **Performance Benchmarking**
   - Provider response time measurement
   - Memory usage monitoring
   - Startup time benchmarking
   - UI responsiveness testing

2. **Load Testing Framework**
   - Concurrent request handling
   - Large context processing
   - Memory leak detection
   - Resource usage monitoring

3. **Optimization Validation**
   - Performance regression detection
   - Resource usage limits
   - Response time thresholds
   - Memory usage patterns

4. **Monitoring Integration**
   - Performance metrics collection
   - Automated alerting
   - Trend analysis
   - Optimization recommendations

#### Technical Implementation

**T7.1: Performance Test Suite**
```typescript
// tests/performance/provider-performance.test.ts
describe('Provider Performance', () => {
  test('measures response times for each provider');
  test('monitors memory usage during long chats');
  test('validates startup time under load');
  test('detects memory leaks in sessions');
});
```

**T7.2: Load Testing Scenarios**
| Test Type | Scenario | Metrics | Thresholds |
|-----------|----------|---------|------------|
| Response Time | Provider API calls | ms | <2000ms |
| Memory Usage | Long chat sessions | MB | <500MB |
| Startup | Cold start | ms | <1000ms |
| Concurrency | Multiple providers | requests/s | >10 |

#### Success Criteria
- [ ] Performance baselines are established
- [ ] Memory leaks are detected and prevented
- [ ] Large context handling is efficient
- [ ] Response times meet acceptable thresholds
- [ ] Load testing reveals no critical bottlenecks

### Phase 8: Advanced Testing & Maintenance (2-3 weeks)

#### Objectives
Implement advanced testing features, maintenance automation, and comprehensive documentation.

#### Deliverables
1. **Regression Testing Framework**
   - Automated regression detection
   - Version comparison testing
   - Breaking change identification
   - Compatibility validation

2. **Test Maintenance Automation**
   - Test data updates
   - Mock response updates
   - Coverage monitoring
   - Test result analysis

3. **Documentation & Guidelines**
   - Testing best practices
   - Contributor guidelines
   - Test writing standards
   - Maintenance procedures

4. **Monitoring & Alerting**
   - Test failure notifications
   - Performance degradation alerts
   - Coverage decrease warnings
   - Integration failure alerts

#### Technical Implementation

**T8.1: Regression Testing**
```typescript
// tests/regression/compatibility.test.ts
describe('Regression Testing', () => {
  test('validates backward compatibility');
  test('detects breaking API changes');
  test('verifies feature preservation');
  test('checks performance regressions');
});
```

**T8.2: Maintenance Automation**
- Automated test data updates
- Mock response synchronization
- Coverage report generation
- Test health monitoring

#### Success Criteria
- [ ] Regression tests catch breaking changes
- [ ] Test maintenance is automated
- [ ] Documentation is comprehensive
- [ ] Monitoring alerts on failures
- [ ] Test suite is self-maintaining

## Technical Specifications

### Testing Framework Configuration

#### Vitest Configuration
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/utils/test-setup.ts'],
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.d.ts',
        '**/index.ts' // re-exports only
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 10000  // 10 seconds for setup/teardown
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests')
    }
  }
})
```

#### Package.json Dependencies
```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@vitest/ui": "^1.0.0",
    "c8": "^8.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "msw": "^2.0.0",
    "playwright": "^1.40.0",
    "@types/testing-library__jest-dom": "^6.0.0"
  }
}
```

### Mock Provider Specifications

#### Mock Provider Interface
```typescript
// tests/mocks/providers/base-mock-provider.ts
export interface MockProvider {
  config: ExtendedProviderConfig;
  
  // Core functionality
  chat(messages: Message[]): Promise<ChatResponse>;
  streamChat(messages: Message[]): AsyncIterable<ChatChunk>;
  listModels(): Promise<Model[]>;
  getModel(modelId: string): Promise<Model>;
  
  // Capability simulation
  supportsVision(): boolean;
  supportsFunctionCalling(): boolean;
  supportsThinking(): boolean;
  supportsStreaming(): boolean;
  
  // Error simulation
  simulateError(type: ErrorType): void;
  setLatency(ms: number): void;
  setResponsePattern(pattern: ResponsePattern): void;
  
  // State management
  reset(): void;
  getCallHistory(): ProviderCall[];
  getMetrics(): ProviderMetrics;
}
```

#### Response Generation Framework
```typescript
// tests/mocks/providers/response-generator.ts
export class ResponseGenerator {
  static generateChatResponse(
    provider: ProviderType,
    messages: Message[],
    options: GenerationOptions = {}
  ): ChatResponse {
    const lastMessage = messages[messages.length - 1];
    const responseText = this.generateRealisticResponse(
      lastMessage.content,
      provider,
      options
    );
    
    return {
      content: responseText,
      usage: this.generateUsageStats(messages, responseText, provider),
      model: options.model || this.getDefaultModel(provider),
      timestamp: new Date().toISOString()
    };
  }
  
  static generateStreamingResponse(
    response: ChatResponse
  ): AsyncIterable<ChatChunk> {
    // Streaming simulation logic
  }
}
```

### Test Data Management

#### Fixture Organization
```
tests/fixtures/
├── configs/
│   ├── valid/
│   │   ├── ollama-basic.yaml
│   │   ├── openai-complete.yaml
│   │   ├── multi-provider.yaml
│   │   └── nested-format.yaml
│   ├── invalid/
│   │   ├── missing-required.yaml
│   │   ├── malformed.yaml
│   │   └── invalid-provider.yaml
│   └── environments/
│       ├── development.env
│       ├── testing.env
│       └── production.env
├── responses/
│   ├── ollama/
│   │   ├── chat-responses.json
│   │   ├── model-list.json
│   │   └── error-responses.json
│   ├── openai/
│   │   ├── gpt4-responses.json
│   │   ├── vision-responses.json
│   │   └── function-call-responses.json
│   └── [other providers...]
├── files/
│   ├── test-workspace/
│   │   ├── package.json
│   │   ├── README.md
│   │   └── src/
│   ├── large-files/
│   │   ├── large-text.txt (1MB+)
│   │   └── very-large.txt (10MB+)
│   └── security-tests/
│       ├── allowed-extensions/
│       └── restricted-paths/
└── conversations/
    ├── basic-chat.json
    ├── multi-turn.json
    ├── with-files.json
    └── provider-switching.json
```

#### Dynamic Test Data Generation
```typescript
// tests/utils/data-generators.ts
export class TestDataGenerator {
  static generateRandomConversation(
    length: number,
    providers: ProviderType[] = ['ollama']
  ): Conversation {
    const messages: Message[] = [];
    let currentProvider = providers[0];
    
    for (let i = 0; i < length; i++) {
      if (Math.random() < 0.1 && providers.length > 1) {
        // 10% chance to switch providers
        currentProvider = this.randomChoice(providers);
      }
      
      messages.push({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: this.generateRandomMessage(i % 2 === 0 ? 'user' : 'assistant'),
        provider: currentProvider,
        timestamp: new Date(Date.now() - (length - i) * 60000).toISOString()
      });
    }
    
    return { messages, metadata: { totalTokens: 0, providers: [...new Set(providers)] } };
  }
  
  static generateProviderConfig(
    type: ProviderType,
    overrides: Partial<ExtendedProviderConfig> = {}
  ): ExtendedProviderConfig {
    const baseConfig = this.getProviderDefaults(type);
    return { ...baseConfig, ...overrides };
  }
}
```

### CI/CD Pipeline Specification

#### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18, 20]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run type checking
      run: npm run typecheck
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Run coverage
      run: npm run test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
    
    - name: Run E2E tests
      run: npm run test:e2e
      env:
        CI: true

  performance:
    runs-on: ubuntu-latest
    needs: test
    
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run performance tests
      run: npm run test:performance
    
    - name: Upload performance results
      uses: actions/upload-artifact@v3
      with:
        name: performance-results
        path: ./performance-results.json
```

## Risk Assessment

### High-Risk Areas

#### 1. Provider API Dependencies
**Risk**: Real API dependencies for integration testing
**Impact**: High - Tests may fail due to external service issues
**Mitigation**:
- Comprehensive mock implementations
- Optional real API testing with feature flags
- Fallback to mock testing in CI/CD
- Rate limiting and quota management

#### 2. Terminal UI Testing Complexity
**Risk**: React/Ink components difficult to test
**Impact**: Medium - UI bugs may not be caught
**Mitigation**:
- Custom testing utilities for Ink
- Snapshot testing for terminal output
- Manual testing checklist for UI changes
- Progressive enhancement of UI testing

#### 3. Custom Input System Testing
**Risk**: Unique keyboard handling hard to simulate
**Impact**: Medium - Input bugs may escape testing
**Mitigation**:
- Mock stdin/stdout for input simulation
- Event-driven testing approach
- Comprehensive manual testing
- Real terminal testing in CI

#### 4. File System Operation Testing
**Risk**: File system operations need sandboxing
**Impact**: Medium - Security or data loss risks
**Mitigation**:
- Temporary test directories
- Mock file system operations
- Permission validation
- Cleanup automation

### Medium-Risk Areas

#### 1. Test Maintenance Overhead
**Risk**: Large test suite becomes hard to maintain
**Impact**: Medium - Developer productivity impact
**Mitigation**:
- Automated test maintenance
- Clear testing guidelines
- Regular test review and cleanup
- Focused test coverage

#### 2. Performance Test Reliability
**Risk**: Performance tests may be flaky
**Impact**: Medium - False positives/negatives
**Mitigation**:
- Statistical analysis of performance data
- Trend-based alerting vs absolute thresholds
- Multiple test runs for reliability
- Environment consistency

#### 3. Configuration Testing Complexity
**Risk**: Many configuration combinations to test
**Impact**: Medium - Config bugs may escape
**Mitigation**:
- Parameterized tests for combinations
- Property-based testing
- Configuration validation framework
- Systematic test matrix

### Low-Risk Areas

#### 1. Mock Provider Accuracy
**Risk**: Mocks may not reflect real provider behavior
**Impact**: Low - May miss provider-specific issues
**Mitigation**:
- Regular mock updates from real responses
- Periodic validation against real APIs
- Provider-specific test scenarios
- Community feedback integration

#### 2. Test Execution Time
**Risk**: Large test suite may be slow
**Impact**: Low - Developer experience impact
**Mitigation**:
- Parallel test execution
- Test categorization (unit vs integration)
- Selective test running
- Performance optimization

## Success Metrics

### Code Quality Metrics

#### Coverage Targets
- **Overall Code Coverage**: >80%
- **Critical Path Coverage**: >95%
- **Provider Coverage**: >90% per provider
- **UI Component Coverage**: >85%
- **Configuration Coverage**: >95%

#### Quality Gates
- **Test Execution Time**: <5 minutes for full suite
- **Unit Test Time**: <30 seconds
- **Integration Test Time**: <2 minutes
- **Performance Test Time**: <3 minutes

#### Regression Detection
- **Critical Bug Detection**: <24 hours
- **Performance Regression**: <5% degradation
- **Breaking Change Detection**: 100% for public APIs
- **Configuration Compatibility**: 100% backward compatibility

### Development Velocity Metrics

#### Productivity Improvements
- **Manual Testing Reduction**: >70%
- **Bug Detection Improvement**: >90% caught before production
- **Code Review Efficiency**: >50% faster reviews
- **Release Confidence**: >95% confidence in releases

#### Maintenance Efficiency
- **Test Maintenance Time**: <10% of development time
- **Automated Test Updates**: >80% of test maintenance automated
- **Documentation Currency**: >95% documentation up-to-date
- **Contributor Onboarding**: <2 hours to understand testing

### System Reliability Metrics

#### Stability Measurements
- **Test Flakiness**: <1% flaky test rate
- **CI/CD Success Rate**: >98%
- **Test Environment Reliability**: >99% uptime
- **Mock Provider Accuracy**: >95% behavior match

#### Performance Baselines
- **Provider Response Time**: <2000ms average
- **Memory Usage**: <500MB peak during testing
- **Startup Time**: <1000ms cold start
- **File Operations**: <100ms average

## Resource Requirements

### Human Resources

#### Core Team Requirements
- **Senior Test Engineer** (1 FTE) - Lead testing infrastructure development
- **QA Engineer** (0.5 FTE) - Design test scenarios and validation
- **DevOps Engineer** (0.5 FTE) - CI/CD pipeline and test environment setup
- **Technical Writer** (0.25 FTE) - Testing documentation

#### Skillset Requirements
- **Testing Frameworks**: Vitest, Testing Library, MSW experience
- **TypeScript/Node.js**: Advanced proficiency
- **React/Ink**: UI component testing experience
- **CI/CD**: GitHub Actions, automated testing pipelines
- **API Testing**: REST API testing, mock implementations

### Infrastructure Requirements

#### Development Environment
- **Local Testing**: Node.js 20+, TypeScript 5+
- **CI/CD Platform**: GitHub Actions with sufficient minutes
- **Coverage Reporting**: Codecov or similar service
- **Performance Monitoring**: Performance tracking service

#### Test Environment Requirements
- **Isolated Test Databases**: Separate test data storage
- **Mock Services**: Containerized mock provider implementations
- **File System Sandboxing**: Temporary directories for file operations
- **Network Isolation**: Controlled test networking

### Timeline & Budget

#### Phase Timeline Summary
| Phase | Duration | Effort (weeks) | Dependencies |
|-------|----------|----------------|--------------|
| Phase 1: Foundation | 2-3 weeks | 2.5 | None |
| Phase 2: Providers | 3-4 weeks | 3.5 | Phase 1 |
| Phase 3: Configuration | 2-3 weeks | 2.5 | Phase 1, 2 |
| Phase 4: Core System | 3-4 weeks | 3.5 | Phase 1, 2 |
| Phase 5: UI Components | 2-3 weeks | 2.5 | Phase 1 |
| Phase 6: Integration | 2-3 weeks | 2.5 | Phase 2, 4, 5 |
| Phase 7: Performance | 2-3 weeks | 2.5 | Phase 6 |
| Phase 8: Advanced | 2-3 weeks | 2.5 | All previous |
| **Total** | **18-24 weeks** | **22 weeks** | Sequential + Parallel |

#### Critical Path Analysis
- **Longest Path**: Phase 1 → Phase 2 → Phase 6 → Phase 7 → Phase 8 (14 weeks)
- **Parallel Opportunities**: Phase 3, 4, 5 can run partially in parallel
- **Risk Buffer**: 2-6 weeks added for unknown challenges
- **Milestone Dependencies**: Each phase builds on previous foundations

#### Resource Allocation
- **Weeks 1-3**: Focus on foundation and provider framework
- **Weeks 4-10**: Parallel work on core systems and UI testing
- **Weeks 11-16**: Integration and performance testing
- **Weeks 17-22**: Advanced features and maintenance automation

## Appendices

### Appendix A: Current Manual Test Scenarios

#### Basic Workflow Tests (from basic-workflow.md)
1. **Project Initialization**: `aiya init --model qwen2.5:8b`
2. **File Search**: `aiya search "*.ts"`
3. **Content Search**: `aiya search --content "import"`
4. **Chat Session**: Interactive session with slash commands
5. **Configuration Loading**: Custom `.aiya.yaml` validation
6. **Security Validation**: Workspace boundary testing
7. **Error Handling**: No Ollama connection handling

#### Input System Validation (from input-system-validation.md)
1. **Basic Text Entry**: Single line, Unicode, long lines
2. **Key Navigation**: Arrow keys, Home/End, word-wise navigation
3. **Enhanced Enter Handling**: Regular Enter vs Shift+Enter
4. **Paste Functionality**: Single line, multiline, special characters
5. **Command System**: Slash commands, tab completion
6. **Edge Cases**: Large content, terminal compatibility

#### Multi-Provider Testing (from multi-provider-manual-testing-guide.md)
1. **Ollama Provider**: Local model testing, function calling
2. **OpenAI Provider**: GPT models, vision support, cost tracking
3. **Anthropic Provider**: Claude models, thinking mode, large context
4. **Azure OpenAI**: Enterprise deployments, deployment names
5. **Google Gemini**: Gemini models, thinking mode, massive context
6. **AWS Bedrock**: Multi-model platform, IAM authentication

### Appendix B: Testing Framework Comparison

#### Framework Evaluation Matrix
| Framework | TypeScript | Speed | ESM Support | Mocking | UI Testing | Score |
|-----------|------------|-------|-------------|---------|------------|-------|
| Vitest | Excellent | Fast | Native | Built-in | Good | 9/10 |
| Jest | Good | Slow | Complex | Excellent | Excellent | 7/10 |
| Mocha | Fair | Medium | Manual | Manual | Fair | 6/10 |
| Playwright | Good | Medium | Good | Good | Excellent | 8/10 |

#### Selection Rationale
- **Vitest**: Chosen for unit and integration tests due to speed and TypeScript support
- **Testing Library**: Chosen for UI components due to React/Ink compatibility
- **MSW**: Chosen for API mocking due to realistic network simulation
- **Playwright**: Chosen for E2E tests due to terminal application support

### Appendix C: File Coverage Analysis

#### Core Files Requiring Testing (60+ files)
```
Critical Path Files (High Priority):
├── src/core/providers/ (6 files)
│   ├── factory.ts - Provider instantiation
│   ├── base.ts - Provider interface
│   ├── ollama.ts - Ollama implementation
│   ├── openai.ts - OpenAI implementation
│   ├── anthropic.ts - Anthropic implementation
│   ├── gemini.ts - Gemini implementation
│   ├── azure.ts - Azure implementation
│   └── bedrock.ts - Bedrock implementation
├── src/core/config/ (8 files)
│   ├── manager.ts - Configuration management
│   ├── models.ts - Model definitions
│   ├── CapabilityManager.ts - Capability management
│   ├── ModelRegistry.ts - Model registry
│   └── collectors/ (4 files) - Provider collectors
├── src/ui/components/ (6 files)
│   ├── ChatInterface.tsx - Main chat UI
│   ├── StatusBar.tsx - Status display
│   ├── UnifiedInput.tsx - Input handling
│   └── other components
├── src/core/mcp/ (4 files)
│   ├── filesystem.ts - File operations
│   ├── enhanced-filesystem.ts - Advanced operations
│   └── other MCP tools
└── src/cli/commands/ (6 files)
    ├── init.ts - Initialization
    ├── chat.ts - Chat command
    ├── search.ts - Search command
    └── other commands

Supporting Files (Medium Priority):
├── src/core/tokens/ (2 files)
├── src/core/security/ (1 file)
├── src/core/operations/ (3 files)
├── src/utils/ (4 files)
└── src/ui/hooks/ (3 files)

Utility Files (Lower Priority):
├── Various utility and helper files
└── Type definitions and interfaces
```

### Appendix D: Mock Provider Specifications

#### Realistic Response Patterns
```typescript
// Mock response patterns for different providers
const MOCK_PATTERNS = {
  ollama: {
    responseStyle: 'technical',
    averageLength: 150,
    streamingChunks: 'word-based',
    capabilities: ['function-calling'],
    errorPatterns: ['connection-refused', 'model-not-found']
  },
  openai: {
    responseStyle: 'conversational',
    averageLength: 200,
    streamingChunks: 'token-based',
    capabilities: ['vision', 'function-calling'],
    errorPatterns: ['rate-limit', 'invalid-api-key', 'insufficient-quota']
  },
  anthropic: {
    responseStyle: 'analytical',
    averageLength: 250,
    streamingChunks: 'sentence-based',
    capabilities: ['vision', 'function-calling', 'thinking'],
    errorPatterns: ['authentication-failed', 'context-too-long']
  }
  // ... other providers
};
```

#### Token Usage Simulation
```typescript
// Realistic token usage patterns
const TOKEN_PATTERNS = {
  ollama: {
    method: 'estimation',
    accuracy: 'approximate',
    inputRatio: 1.0, // 1 token per word average
    outputRatio: 1.0,
    overhead: 0 // No API overhead
  },
  openai: {
    method: 'api-reported',
    accuracy: 'exact',
    inputRatio: 0.75, // More efficient encoding
    outputRatio: 0.75,
    overhead: 10 // API overhead tokens
  }
  // ... provider-specific patterns
};
```

### Appendix E: Performance Benchmarks

#### Expected Performance Targets
```typescript
const PERFORMANCE_TARGETS = {
  responseTime: {
    ollama: { target: 1000, max: 2000 }, // Local model
    openai: { target: 1500, max: 3000 }, // API call
    anthropic: { target: 1800, max: 3500 }, // API call
    azure: { target: 1600, max: 3200 }, // Enterprise API
    gemini: { target: 1400, max: 2800 }, // Google API
    bedrock: { target: 2000, max: 4000 } // AWS overhead
  },
  memoryUsage: {
    baseline: 50, // MB
    perProvider: 10, // MB per provider
    maxTotal: 500, // MB maximum
    chatHistory: 1, // MB per 100 messages
    fileOperations: 5 // MB per operation
  },
  startupTime: {
    coldStart: 1000, // ms
    warmStart: 300, // ms
    configLoad: 100, // ms
    providerInit: 200 // ms per provider
  }
};
```

This comprehensive implementation plan provides the foundation for building a robust, maintainable testing infrastructure that will significantly improve code quality, development velocity, and system reliability for Aiya CLI.