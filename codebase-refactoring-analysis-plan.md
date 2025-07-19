# Comprehensive Codebase Refactoring Analysis Plan

## Overview
This document outlines a systematic approach to analyze every file in the Aiya project for potential refactoring opportunities, code removal, and consolidation. The goal is to identify duplicate code patterns, unused functionality, and opportunities for improved maintainability.

## Project Structure Analysis
Based on .gitignore analysis, files to analyze (excluding ignored directories):
- `src/` - Core source code
- `tests/` - Test files
- `docs/` - Documentation
- Configuration files (package.json, tsconfig.json, etc.)

## Major Refactoring Opportunities Identified

### 1. **DUPLICATE LOGGING INFRASTRUCTURE** - High Priority
**Location:** `src/core/tools/` and `src/core/tokens/`
- **TokenLogger** (`src/core/tokens/logger.ts`)
- **ToolLogger** (`src/core/tools/logger.ts`) 
- **ShellLogger** (`src/core/tools/shell-logger.ts`)

**Duplication Found:**
- All three implement identical session management patterns
- Duplicate directory creation logic (`.aiya/logs/`)
- Repetitive file writing with identical error handling
- Same session lifecycle methods (`logSessionStart()`, `logSessionEnd()`)
- Identical static factory methods (`continueSession()`, `createNewSession()`)

**Refactoring Impact:** Consolidate into a base logging system with specialized extensions.

### 2. **PROVIDER COLLECTOR PATTERN DUPLICATION** - High Priority
**Location:** `src/core/config/collectors/`
- **GeminiCollector**, **OllamaCollector**, **OpenAICollector** all extend **BaseProviderCollector**

**Duplication Found:**
- Nearly identical validation patterns across collectors
- Repetitive `CapabilityManager.getDefaultConfig()` calls
- Duplicate `ConnectionTester` instantiation patterns
- Similar `testConnection()` implementations with same error handling

**Refactoring Impact:** Extract common validation and testing patterns into shared mixins or utilities.

### 3. **ERROR HANDLER PATTERN DUPLICATION** - Medium Priority  
**Location:** `src/core/errors/`
- **GeminiErrorMapper**, **OllamaErrorMapper**, **OpenAIErrorMapper** extend **BaseProviderErrorHandler**

**Duplication Found:**
- Similar error detection methods (`detectAuthenticationError`, `detectModelNotFound`)
- Repetitive suggestion generation patterns
- Duplicate error context enhancement logic
- Similar provider-specific error creation methods

**Refactoring Impact:** Create shared error detection utilities and standardize suggestion patterns.

### 4. **UI STATUS COMPONENT DUPLICATION** - Medium Priority
**Location:** `src/ui/components/`
- **StatusBar** (`src/ui/components/StatusBar.tsx`)
- **SimpleStatusBar** (`src/ui/components/SimpleStatusBar.tsx`)

**Duplication Found:**
- Near-identical props interfaces (status, message, provider, model, tokenUsage)
- Duplicate token usage formatting logic (thousands separator)
- Similar provider/model display patterns
- Redundant status color/icon logic

**Refactoring Impact:** Merge into a single configurable StatusBar component with render mode options.

### 5. **CONFIRMATION DIALOG DUPLICATION** - Medium Priority
**Location:** `src/ui/components/`
- **ToolConfirmationDialog** (`src/ui/components/ToolConfirmationDialog.tsx`)
- **ShellCommandConfirmationDialog** (`src/ui/components/ShellCommandConfirmationDialog.tsx`)

**Duplication Found:**
- Identical choice type definitions (`'allow-once' | 'reject' | 'allow-always'`)
- Same Select component usage patterns
- Similar layout and styling structure
- Duplicate instruction text patterns

**Refactoring Impact:** Create a generic confirmation dialog component with customizable content.

### 6. **TYPE DEFINITION INCONSISTENCIES** - Low Priority
**Location:** `src/types/` vs `src/core/providers/base.ts`

**Duplication Found:**
- **ToolCall**, **ToolResult**, **Message** interfaces defined in both locations
- **ProviderConfig** interfaces overlap between files
- **ModelInfo** interfaces have similar but not identical definitions
- **UsageMetadata** types scattered across multiple files

**Refactoring Impact:** Consolidate all provider-related types into a single authoritative location.

### 7. **UNUSED EXPORTS** - Low Priority
**Location:** Various index.ts files

**Findings:**
- `src/ui/components/index.ts` exports both StatusBar variants
- `src/types/index.ts` uses catch-all exports that may include unused types
- Some error mappers may have unused utility methods

## Comprehensive File-by-File Analysis Todo List

### CLI Directory (`src/cli/`)
- [ ] **CommandExecutor.ts** - Analyze for duplicate command execution patterns
- [ ] **CommandRegistry.ts** - Check for unused command registrations
- [ ] **CommandUtils.ts** - Identify utility function duplication
- [ ] **suggestions.ts** - Review suggestion generation patterns
- [ ] **index.ts** - Verify all exports are used
- [ ] **commands/chat.ts** - Check for chat-specific duplications
- [ ] **commands/definitions.ts** - Analyze command definition patterns
- [ ] **commands/index.ts** - Review command exports
- [ ] **commands/init.ts** - Check initialization logic for redundancy

### Core Configuration (`src/core/config/`)
- [ ] **CapabilityManager.ts** - Analyze capability management patterns
- [ ] **ModelRegistry.ts** - Check model registration for duplicates
- [ ] **generation.ts** - Review generation logic patterns
- [ ] **manager.ts** - Analyze configuration management
- [ ] **models.ts** - Check model definitions for redundancy
- [ ] **testing.ts** - Review testing utilities
- [ ] **collectors/base.ts** - Analyze base collector patterns
- [ ] **collectors/gemini.ts** - Check Gemini-specific implementations
- [ ] **collectors/ollama.ts** - Check Ollama-specific implementations
- [ ] **collectors/openai.ts** - Check OpenAI-specific implementations

### Core Diff (`src/core/diff/`)
- [ ] **preview.ts** - Analyze diff preview functionality

### Core Errors (`src/core/errors/`)
- [ ] **BaseProviderErrorHandler.ts** - Analyze base error handling patterns
- [ ] **GeminiErrorMapper.ts** - Check Gemini error mapping
- [ ] **OllamaErrorMapper.ts** - Check Ollama error mapping
- [ ] **OpenAIErrorMapper.ts** - Check OpenAI error mapping
- [ ] **index.ts** - Review error exports

### Core MCP (`src/core/mcp/`)
- [ ] **ast-searcher.ts** - Analyze AST searching functionality
- [ ] **base.ts** - Check MCP base patterns
- [ ] **filesystem-state.ts** - Review filesystem state management
- [ ] **filesystem.ts** - Check filesystem operations
- [ ] **fuzzy-matcher.ts** - Analyze fuzzy matching logic
- [ ] **shell-constants.ts** - Review shell constants
- [ ] **shell.ts** - Check shell operation patterns

### Core Operations (`src/core/operations/`)
- [ ] **atomic.ts** - Analyze atomic operation patterns
- [ ] **pattern-matching.ts** - Check pattern matching logic
- [ ] **queue.ts** - Review queue implementation

### Core Providers (`src/core/providers/`)
- [ ] **anthropic.ts** - Analyze Anthropic provider implementation
- [ ] **azure.ts** - Check Azure provider patterns
- [ ] **base.ts** - Review base provider patterns
- [ ] **bedrock.ts** - Check Bedrock provider implementation
- [ ] **factory.ts** - Analyze provider factory patterns
- [ ] **gemini.ts** - Check Gemini provider implementation
- [ ] **ollama.ts** - Check Ollama provider implementation
- [ ] **openai.ts** - Check OpenAI provider implementation

### Core Security (`src/core/security/`)
- [ ] **workspace.ts** - Analyze workspace security patterns

### Core Tokens (`src/core/tokens/`)
- [ ] **counter.ts** - Check token counting logic
- [ ] **logger.ts** - Analyze token logging (HIGH PRIORITY - duplication identified)

### Core Tools (`src/core/tools/`)
- [ ] **executor.ts** - Analyze tool execution patterns
- [ ] **logger.ts** - Analyze tool logging (HIGH PRIORITY - duplication identified)
- [ ] **mcp-tools.ts** - Check MCP tools implementation
- [ ] **memory.ts** - Review memory management
- [ ] **shell-logger.ts** - Analyze shell logging (HIGH PRIORITY - duplication identified)

### Types (`src/types/`)
- [ ] **ErrorTypes.ts** - Check for duplicate error type definitions
- [ ] **KeyboardTypes.ts** - Analyze keyboard type definitions
- [ ] **ProviderTypes.ts** - Check provider type duplications
- [ ] **UtilityTypes.ts** - Review utility type definitions
- [ ] **index.ts** - Analyze type exports for unused types

### UI Components (`src/ui/`)
- [ ] **AiyaApp.tsx** - Analyze main app component
- [ ] **components/ChatInterface.tsx** - Check chat interface patterns
- [ ] **components/CommandInput.tsx** - Analyze command input logic
- [ ] **components/SearchResults.tsx** - Check search result patterns
- [ ] **components/ShellCommandConfirmationDialog.tsx** - Analyze dialog (HIGH PRIORITY - duplication identified)
- [ ] **components/SimpleStatusBar.tsx** - Check status bar (HIGH PRIORITY - duplication identified)
- [ ] **components/StartupLoader.tsx** - Analyze startup loading
- [ ] **components/StatusBar.tsx** - Check status bar (HIGH PRIORITY - duplication identified)
- [ ] **components/ToolConfirmationDialog.tsx** - Analyze dialog (HIGH PRIORITY - duplication identified)
- [ ] **components/ToolExecution.tsx** - Check tool execution UI
- [ ] **components/UnifiedInput.tsx** - Analyze unified input patterns
- [ ] **components/index.ts** - Review component exports
- [ ] **components/setup/ConnectionTest.tsx** - Check connection testing UI
- [ ] **components/setup/ProviderConfigForm.tsx** - Analyze config form
- [ ] **components/setup/ProviderSelection.tsx** - Check provider selection
- [ ] **components/setup/SetupWizard.tsx** - Analyze setup wizard
- [ ] **components/setup/WelcomeScreen.tsx** - Check welcome screen
- [ ] **core/TextBuffer.ts** - Analyze text buffer implementation
- [ ] **hooks/useKeypress.ts** - Check keypress hook patterns
- [ ] **hooks/useTerminalSize.ts** - Analyze terminal size hook
- [ ] **utils/memoryManagement.ts** - Check memory management utilities
- [ ] **utils/textProcessing.ts** - Analyze text processing utilities
- [ ] **utils/textUtils.ts** - Check text utility functions
- [ ] **utils/visualLayout.ts** - Analyze visual layout utilities

### Utils (`src/utils/`)
- [ ] **diff.ts** - Analyze diff utilities
- [ ] **file-ops.ts** - Check file operation utilities
- [ ] **thinking-parser.ts** - Analyze thinking parser logic

### Tests (`tests/`)
- [ ] **integration/providers/multi-provider.test.ts** - Check for test redundancy
- [ ] **integration/providers/provider-switching.test.ts** - Analyze provider switching tests
- [ ] **integration/providers/validation.test.ts** - Check validation test patterns
- [ ] **mocks/providers/base-mock-provider.ts** - Analyze mock patterns
- [ ] **mocks/providers/mock-factory.ts** - Check mock factory
- [ ] **mocks/providers/mock-gemini.ts** - Analyze Gemini mocks
- [ ] **mocks/providers/mock-ollama.ts** - Check Ollama mocks
- [ ] **mocks/providers/mock-openai.ts** - Analyze OpenAI mocks
- [ ] **performance/visual-layout-benchmark.test.ts** - Check performance tests
- [ ] **unit/foundation.test.ts** - Analyze foundation tests
- [ ] **unit/mcp/ast-searcher.test.ts** - Check AST searcher tests
- [ ] **unit/mcp/fuzzy-matcher.test.ts** - Analyze fuzzy matcher tests
- [ ] **unit/mcp/shell.test.ts** - Check shell tests
- [ ] **unit/providers/base-provider-test.ts** - Analyze base provider tests
- [ ] **unit/providers/factory.test.ts** - Check factory tests
- [ ] **unit/providers/gemini.test.ts** - Analyze Gemini tests
- [ ] **unit/providers/ollama.test.ts** - Check Ollama tests
- [ ] **unit/providers/openai.test.ts** - Analyze OpenAI tests
- [ ] **unit/tools/executor-memory.test.ts** - Check executor memory tests
- [ ] **unit/tools/memory.test.ts** - Analyze memory tests
- [ ] **unit/ui/text-processing.test.ts** - Check text processing tests
- [ ] **unit/ui/visual-layout.test.ts** - Analyze visual layout tests
- [ ] **utils/assertions.ts** - Check test utility assertions
- [ ] **utils/config-builder.ts** - Analyze config builder utilities
- [ ] **utils/test-setup.ts** - Check test setup utilities

### Documentation (`docs/`)
- [ ] **ARCHITECTURE.md** - Review for outdated architectural decisions
- [ ] **FILE-STRUCTURE.md** - Check file structure documentation accuracy
- [ ] **INIT-PROCESS.md** - Analyze initialization process documentation
- [ ] **MCP-TOOLS.md** - Review MCP tools documentation
- [ ] **PROVIDERS.md** - Check provider documentation
- [ ] **SLASH-COMMANDS.md** - Analyze slash commands documentation
- [ ] **UI-SYSTEM.md** - Review UI system documentation
- [ ] **TODO/TODO.md** - Check TODO list relevance

### Configuration Files
- [ ] **package.json** - Analyze dependencies for unused packages
- [ ] **tsconfig.json** - Check TypeScript configuration
- [ ] **eslint.config.js** - Review ESLint configuration
- [ ] **vitest.config.ts** - Check Vitest configuration

## File Analysis Template

For each file analyzed, document:

```markdown
### [Filename] - Analysis Complete ✅

**File Location:** `path/to/file`
**Analysis Date:** [Date]
**Lines of Code:** [Number]

**Findings:**
- [List any duplicate patterns found]
- [List any unused functions/exports]
- [List any refactoring opportunities]

**Recommendations:**
- [Specific actions to take]
- [Priority level: High/Medium/Low]

**Dependencies:** [Files that import from this file]
**Imports:** [Files this file imports from]

**Status:** ✅ Complete | ⚠️ Needs Refactoring | 🔄 Refactored
```

## Recommended Implementation Order

### Phase 1: High Priority Duplications
1. **Consolidate Logging Infrastructure** (saves ~200 lines)
   - Combine TokenLogger, ToolLogger, ShellLogger
   - Create BaseLogger with specialized extensions
2. **Merge StatusBar Components** (saves ~50 lines)
   - Combine StatusBar and SimpleStatusBar
3. **Unify Confirmation Dialogs** (saves ~40 lines)
   - Merge ToolConfirmationDialog and ShellCommandConfirmationDialog

### Phase 2: Medium Priority Patterns
4. **Extract Provider Collector Commons** (saves ~100 lines)
   - Create shared validation utilities
5. **Standardize Error Handler Patterns** (saves ~80 lines)
   - Extract common error detection patterns

### Phase 3: Low Priority Cleanup
6. **Consolidate Type Definitions** (improves maintainability)
   - Unify scattered type definitions
7. **Clean Up Unused Exports** (reduces bundle size)
   - Remove unused exports from index files

## Success Metrics

- **Code Reduction:** Target 400-500 lines removed
- **Maintainability:** Reduced duplication patterns
- **Test Coverage:** Maintain or improve current coverage
- **Bundle Size:** Reduce final bundle size
- **Developer Experience:** Clearer code organization

## Risk Mitigation

- Run full test suite after each refactoring phase
- Use git branching for each major refactoring
- Document all changes in commit messages
- Verify no breaking changes to public APIs

## Progress Tracking

**Total Files to Analyze:** 89 files
**Files Completed:** 0
**High Priority Issues Found:** 6
**Estimated Code Reduction:** 470+ lines

---

**Note:** This plan will be updated as analysis progresses. Each completed file analysis will be marked with ✅ and findings documented inline.