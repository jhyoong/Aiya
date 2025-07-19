# Phase 6 Cleanup Plan: Test Files and Documentation Update

## Overview

This document outlines the plan for completing the shell refactoring Phase 6 cleanup by updating test files and documentation to use the new category-based system instead of the old risk assessment system.

## Current Status

✅ **COMPLETED:**
- Removed CommandRiskAssessor class (~500 lines)
- Removed CommandRiskCategory enum and CommandRiskAssessment interface
- Eliminated confirmationThreshold from all configuration files
- Updated all core interfaces to use category-based system
- Fixed TypeScript compilation errors - build passes successfully

🔄 **REMAINING WORK:**
- Update test files to use new category system
- Update documentation to reflect new architecture
- Verify all tests pass after updates

## New Category System Reference

### Core Components
```typescript
// New categorization system
enum CommandCategory {
  SAFE = 'safe',
  RISKY = 'risky', 
  DANGEROUS = 'dangerous',
  BLOCKED = 'blocked'
}

interface CommandCategorization {
  category: CommandCategory;
  matchedPattern?: string;
  reason: string;
  requiresConfirmation: boolean;
  allowExecution: boolean;
}

// New function replaces CommandRiskAssessor
categorizeCommand(command: string): CommandCategorization
```

### Updated Interfaces
```typescript
// Old (REMOVED)
interface ConfirmationPromptOptions {
  riskAssessment: CommandRiskAssessment;
  // ...
}

// New (CURRENT)
interface ConfirmationPromptOptions {
  categorization: CommandCategorization;
  // ...
}

// Old (REMOVED)
interface ShellExecutionLog {
  riskAssessment: {
    riskScore: number;
    riskFactors: string[];
    // ...
  };
}

// New (CURRENT)
interface ShellExecutionLog {
  categoryAssessment: {
    category: string;
    matchedPattern?: string;
    manualApprovalRequired: boolean;
    approved: boolean;
  };
}
```

## Test Files Update Plan

### Priority 1: Critical Test Files (MUST FIX)

#### 1. `/tests/unit/mcp/shell-confirmation.test.ts`
**Status**: 8 failing tests due to missing imports and interfaces

**Required Changes:**
```typescript
// OLD (Remove these imports)
import { CommandRiskAssessment, CommandRiskCategory } from '../../../src/core/mcp/shell.js';

// NEW (Add these imports)
import { CommandCategorization, CommandCategory } from '../../../src/core/mcp/shell/index.js';
import { categorizeCommand } from '../../../src/core/mcp/shell/index.js';
```

**Mock Object Updates:**
```typescript
// OLD (Lines 56-75)
const mockRiskAssessment: CommandRiskAssessment = {
  riskScore: 75,
  category: CommandRiskCategory.HIGH,
  riskFactors: ['Dangerous command'],
  requiresConfirmation: true,
  shouldBlock: false,
  context: { ... }
};

// NEW (Replace with)
const mockCategorization: CommandCategorization = {
  category: CommandCategory.DANGEROUS,
  matchedPattern: 'rm -rf',
  reason: 'Dangerous command detected',
  requiresConfirmation: true,
  allowExecution: true
};
```

**Test Updates:**
```typescript
// OLD (Lines 270-291)
const options: ConfirmationPromptOptions = {
  riskAssessment: mockRiskAssessment,
  // ...
};

// NEW (Replace with)
const options: ConfirmationPromptOptions = {
  categorization: mockCategorization,
  // ...
};
```

**Risk Category Tests (Lines 357-416):**
- Replace `CommandRiskCategory.SAFE/LOW/MEDIUM/HIGH/CRITICAL` with `CommandCategory.SAFE/RISKY/DANGEROUS/BLOCKED`
- Update test expectations to match new 4-category system
- Replace risk scoring tests with categorization tests

#### 2. `/tests/performance/confirmation-system-performance.test.ts`
**Status**: 11 failing tests due to CommandRiskAssessor usage

**Required Changes:**
```typescript
// OLD (Remove)
// CommandRiskAssessor has been replaced with categorizeCommand function
// import { categorizeCommand } from '../../src/core/mcp/shell/index.js';
let riskAssessor: CommandRiskAssessor;
riskAssessor = new CommandRiskAssessor(defaultConfig);

// NEW (Add)
import { categorizeCommand } from '../../src/core/mcp/shell/command-categorization.js';
// Remove riskAssessor variable entirely
```

**Performance Test Updates:**
```typescript
// OLD (Lines 136-148)
const assessment = riskAssessor.assessRisk(command);

// NEW (Replace with)
const categorization = categorizeCommand(command);
```

**Session Decision Updates:**
```typescript
// OLD (Lines 54-55, 76-77)
sessionMemory.recordDecision(command, 'allow', 30); // riskScore

// NEW (Replace with)
sessionMemory.recordDecision(command, 'allow'); // Remove riskScore parameter
```

### Priority 2: Configuration Test Files (MEDIUM)

#### 3. `/tests/unit/mcp/shell-security.test.ts`
**Status**: Contains confirmationThreshold references

**Required Changes:**
```typescript
// OLD configuration tests (Lines 25-30, 287-404)
expect(config.confirmationThreshold).toBe(50);

// NEW (Replace with category-based configuration)
expect(config.requireConfirmationForRisky).toBe(true);
expect(config.requireConfirmationForDangerous).toBe(true);
expect(config.allowDangerous).toBe(false);
```

#### 4. `/tests/integration/mcp/shell-config-integration.test.ts`
**Status**: 4 failing tests expecting confirmationThreshold

**Required Changes:**
- Remove validation tests for confirmationThreshold
- Add validation tests for new boolean confirmation settings
- Update configuration loading expectations

### Priority 3: Other Test Files (LOW)

#### 5. Performance and Integration Tests
**Files to Review:**
- `/tests/performance/*.test.ts` - Check for risk assessment usage
- `/tests/integration/*.test.ts` - Update configuration expectations

**Common Changes:**
- Replace `riskScore` with `category` in log assertions
- Update mock configurations to remove confirmationThreshold
- Replace risk assessment expectations with categorization

## Documentation Update Plan

### Priority 1: Core Documentation (HIGH)

#### 1. `/docs/MCP-TOOLS.md`
**Lines 394-416: Risk Assessment Documentation**

**OLD Section (Remove):**
```markdown
## Risk Assessment System

The shell tool uses a comprehensive risk assessment system that evaluates commands on a scale of 0-100:

### Risk Categories
- **SAFE (0-25)**: Basic commands like `ls`, `pwd`, `echo`
- **LOW (26-50)**: Development commands like `npm install`, `git status`
- **MEDIUM (51-75)**: Build/test commands like `npm run build`, `pytest`
- **HIGH (76-90)**: System modification like `chmod`, `mkdir`, `rm`
- **CRITICAL (91-100)**: Dangerous operations like `rm -rf`, `sudo`, `format`

### Configuration
```yaml
shell:
  confirmationThreshold: 50  # Require confirmation for commands scoring 50+
```

**NEW Section (Add):**
```markdown
## Command Categorization System

The shell tool uses a simple pattern-based categorization system with four clear categories:

### Categories
- **SAFE**: Execute without confirmation (`ls`, `pwd`, `echo`, `git status`)
- **RISKY**: Require confirmation (`npm install`, `mkdir`, `chmod`)
- **DANGEROUS**: Require confirmation with warning (`rm`, `sudo` commands)
- **BLOCKED**: Never allow (`rm -rf /`, `format`, fork bombs)

### Configuration
```yaml
shell:
  requireConfirmationForRisky: true     # Require confirmation for risky commands
  requireConfirmationForDangerous: true # Require confirmation for dangerous commands
  allowDangerous: false                 # Allow dangerous commands (if false, blocks them)
  trustedCommands:                      # Commands that bypass confirmation
    - '^ls($|\\s)'
    - '^pwd($|\\s)'
    - '^echo($|\\s)'
```

### Category Decision Logic
Commands are categorized by pattern matching:
1. **Blocked patterns** checked first (auto-block)
2. **Dangerous patterns** checked second (require confirmation)
3. **Safe patterns** checked third (allow without confirmation)
4. **Default to risky** for unknown commands (require confirmation)
```

#### 2. `/docs/ARCHITECTURE.md`
**Update needed**: Security flow diagrams and decision logic

**Changes:**
- Replace risk scoring flowcharts with categorization decision tree
- Update security component documentation
- Replace risk assessment references with categorization system

### Priority 2: Configuration Examples (MEDIUM)

#### 3. `/README.md`
**Line 174: Configuration example**

**OLD:**
```yaml
shell:
  confirmationThreshold: 50
```

**NEW:**
```yaml
shell:
  requireConfirmationForRisky: true
  requireConfirmationForDangerous: true
  allowDangerous: false
```

#### 4. `/tests/manual_test_shell_config.md`
**Multiple references to confirmationThreshold**

**Required Changes:**
- Update test procedures to use new configuration options
- Replace risk score testing with category testing
- Update expected behavior descriptions

### Priority 3: Historical Documentation (LOW)

#### 5. `/docs/shell-refactoring-plan.md`
**Status**: Contains historical references (can be kept for reference)

**Option 1**: Keep as historical record
**Option 2**: Add section documenting Phase 6 completion and final architecture

## Implementation Steps

### Phase 1: Fix Critical Test Files (Required for build)
1. **Update shell-confirmation.test.ts** (30 min)
   - Replace imports and interfaces
   - Update mock objects
   - Fix risk category tests

2. **Update confirmation-system-performance.test.ts** (20 min)
   - Replace CommandRiskAssessor with categorizeCommand
   - Remove riskScore references
   - Update performance expectations

### Phase 2: Update Configuration Tests (Required for full test suite)
3. **Update shell-security.test.ts** (15 min)
   - Replace confirmationThreshold tests
   - Add new boolean configuration tests

4. **Update shell-config-integration.test.ts** (15 min)
   - Remove threshold validation tests
   - Add category-based validation tests

### Phase 3: Update Documentation
5. **Update MCP-TOOLS.md** (20 min)
   - Replace risk assessment section
   - Add categorization system documentation
   - Update configuration examples

6. **Update README.md** (5 min)
   - Fix configuration example

7. **Update other documentation** (10 min)
   - Update ARCHITECTURE.md
   - Update manual test procedures

### Phase 4: Final Verification
8. **Run full test suite** (5 min)
   - Verify all tests pass
   - Check for any remaining references

9. **Review documentation** (5 min)
   - Ensure consistency across all docs
   - Verify examples work correctly

## Success Criteria

### Functional Requirements
- [ ] All tests pass without errors
- [ ] No references to old risk assessment system in tests
- [ ] Performance tests use new categorization system
- [ ] Configuration tests validate new boolean settings

### Documentation Requirements
- [ ] MCP-TOOLS.md reflects new categorization system
- [ ] Configuration examples show new options
- [ ] No references to confirmationThreshold in user-facing docs
- [ ] Architecture documentation is updated

### Code Quality Requirements
- [ ] No deprecated imports or interfaces in test files
- [ ] Test coverage maintains >90% for new categorization system
- [ ] Mock objects use new interface structure
- [ ] Performance tests verify new system efficiency

## Risk Mitigation

### Potential Issues
1. **Test complexity**: Some tests may need significant restructuring
   - **Mitigation**: Start with simpler imports/interface updates first

2. **Performance regression**: New categorization might perform differently
   - **Mitigation**: Update performance expectations based on new system

3. **Documentation inconsistency**: Missing references during update
   - **Mitigation**: Search for all old terms before concluding

### Rollback Plan
- All changes are in test files and documentation
- No production code changes required
- Can revert individual files if needed
- Core system remains stable throughout

## Estimated Timeline

| Phase | Tasks | Estimated Time | Priority |
|-------|-------|----------------|----------|
| 1 | Critical test files | 50 minutes | HIGH |
| 2 | Configuration tests | 30 minutes | HIGH |
| 3 | Documentation updates | 35 minutes | MEDIUM |
| 4 | Final verification | 10 minutes | HIGH |
| **Total** | **Complete cleanup** | **~2 hours** | |

## Conclusion

This plan provides a systematic approach to completing the Phase 6 cleanup by updating all test files and documentation to use the new category-based system. The changes are isolated to test files and documentation, ensuring no impact on the production system while maintaining accuracy and preventing user confusion.

The cleanup will result in:
- ✅ Clean test suite with no deprecated references
- ✅ Accurate documentation reflecting current architecture
- ✅ Consistent category-based approach throughout
- ✅ Complete removal of old risk assessment system