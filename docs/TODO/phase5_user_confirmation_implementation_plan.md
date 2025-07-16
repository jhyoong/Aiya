# Phase 5: User Confirmation System - Detailed Implementation Plan

**Created**: 2025-07-16  
**Status**: In Progress - Risk Assessment System Completed  
**Total Tasks**: 8 phases across 3 implementation sub-phases

## Executive Summary

Phase 5 implements an interactive user confirmation system for shell commands, building on the robust security infrastructure from Phases 1-4. The system will assess command risk, prompt users for potentially dangerous operations, and persist user preferences. This phase enhances usability while maintaining security through intelligent risk assessment and user-controlled command approval.

## Current Status

### ✅ Completed Components
- **CommandRiskAssessor class**: Comprehensive risk scoring algorithm (0-100 scale)
- **Risk Categories**: SAFE, LOW, MEDIUM, HIGH, CRITICAL command classifications
- **ShellToolConfig interface extensions**: Added confirmation threshold, trusted commands, timeout settings
- **Risk Assessment Logic**: 6 assessment categories (complexity, filesystem, network, system, privilege, data access)

### ✅ Recently Completed
- **Task 1 - CommandFilter Default Configuration**: Added Phase 5 fields to defaultConfig with validation (2025-07-16)

### ✅ Recently Completed
- **Task 2 - AiyaConfig Integration**: Complete integration of shell configuration with main config system (2025-07-16)

### 🔄 In Progress
- **Confirmation Interface**: User prompt component with async readline

### ⏳ Pending Tasks
- **Confirmation Interface**: User prompt component with async readline
- **Bypass Logic**: Session memory and trusted command patterns
- **Integration Testing**: End-to-end testing and optimization

## Technical Architecture Overview

### 1. Risk Assessment Engine
**Component**: `CommandRiskAssessor` ✅ **COMPLETED**

**Risk Scoring Algorithm**:
- **Base Score**: Uses existing `DangerousCommandDetector` patterns
- **Complexity Assessment**: Command chaining, redirections, loops (+5-20 points)
- **Filesystem Impact**: File operations, permissions, mass operations (+10-30 points)
- **Network Risk**: Downloads, services, data exfiltration (+10-25 points)
- **System Modification**: Package management, services (+10-25 points)
- **Privilege Escalation**: sudo, su, setuid operations (+30-40 points)
- **Data Access**: System directories, sensitive files (+15-30 points)

**Risk Categories**:
- **SAFE (0-25)**: Basic commands (ls, pwd, echo)
- **LOW (26-50)**: Development commands (npm install, git status)
- **MEDIUM (51-75)**: Build/test commands (npm run build, pytest)
- **HIGH (76-90)**: System modification (chmod, mkdir, rm non-recursive)
- **CRITICAL (91-100)**: Dangerous operations (rm -rf, sudo, format)

**Risk Context Generation**:
- Command type classification (Package Management, Version Control, etc.)
- Potential impact assessment by risk category
- Contextual mitigation suggestions based on risk factors

### 2. Configuration System
**Components**: Extended `ShellToolConfig` interface ✅ **PARTIALLY COMPLETED**

**New Configuration Fields**:
```typescript
interface ShellToolConfig {
  // Existing fields...
  confirmationThreshold: number;     // Risk score requiring confirmation (0-100)
  trustedCommands: string[];         // Regex patterns for trusted commands
  alwaysBlockPatterns: string[];     // Commands always blocked regardless of confirmation
  confirmationTimeout: number;       // Timeout for prompts (milliseconds)
  sessionMemory: boolean;            // Remember decisions for current session
}
```

**Default Configuration Values**:
- `confirmationThreshold: 50` (MEDIUM risk and above requires confirmation)
- `trustedCommands: []` (User-configured trusted patterns)
- `alwaysBlockPatterns: ['rm -rf /', 'sudo rm -rf', 'format.*']` (Critical patterns)
- `confirmationTimeout: 30000` (30 seconds)
- `sessionMemory: true` (Remember session decisions)

### 3. Confirmation Interface 
**Component**: `ShellConfirmationPrompt` ⏳ **PENDING**

**Interface Requirements**:
- **Async Prompting**: Non-blocking readline interface compatible with Aiya's React/Ink UI
- **Rich Context Display**:
  - Command and working directory
  - Risk level with color coding
  - Risk factors and potential impact
  - Mitigation suggestions
- **User Response Options**:
  - `A` - Allow (execute once)
  - `D` - Deny (block execution)
  - `T` - Trust (add to trusted patterns)
  - `B` - Block (add to always-block patterns)
  - `S` - Show details (expanded risk analysis)
- **Timeout Handling**: Auto-deny after configured timeout for security
- **Session Memory**: Remember decisions within current session

**Integration Points**:
- Uses existing `useKeypress` hook patterns from `/src/ui/hooks/useKeypress.ts`
- Follows React/Ink component patterns from existing UI components
- Integrates with existing error handling and logging systems

### 4. Bypass Logic System
**Component**: `ConfirmationBypassManager` ⏳ **PENDING**

**Bypass Mechanisms**:
- **Trusted Command Patterns**: User-configured regex patterns for safe commands
- **Session Memory**: Cache approval decisions for current session
- **Auto-approve Patterns**: Enhanced auto-approval for known safe operations
- **Risk Threshold Bypass**: Commands below threshold skip confirmation

**Session Memory Implementation**:
```typescript
interface SessionDecision {
  commandPattern: string;
  decision: 'allow' | 'deny' | 'trust';
  timestamp: Date;
  riskScore: number;
}
```

## Implementation Tasks Breakdown

### 🔄 Phase 5A: Configuration System Completion
**Current Status**: In Progress

#### Task 1: Update CommandFilter Default Configuration ✅ **COMPLETED (2025-07-16)**
**Location**: `/src/core/mcp/shell.ts` - `CommandFilter.defaultConfig`
**Requirements**:
- Add default values for all new Phase 5 fields
- Ensure backward compatibility with existing configurations
- Add validation for new configuration fields

**Completion Summary**:
- ✅ Added all Phase 5 fields to `defaultConfig` with appropriate default values
- ✅ Implemented comprehensive validation in constructor and `updateConfig` method
- ✅ Added validation for `confirmationThreshold` (0-100 range)
- ✅ Added validation for `confirmationTimeout` (positive values)
- ✅ Added validation for `trustedCommands` and `alwaysBlockPatterns` arrays
- ✅ Added regex pattern validation for command patterns
- ✅ Created extensive unit tests (14 new test cases)
- ✅ Created integration tests (11 test cases)
- ✅ Fixed minor TypeScript compilation issue (unused parameter warning)
- ✅ All tests passing (316/316 unit tests, 52/52 integration tests)
- ✅ Maintained backward compatibility with existing configurations

**Implementation Details**:
```typescript
private defaultConfig: ShellToolConfig = {
  // Existing fields...
  confirmationThreshold: 50,
  trustedCommands: [
    '^ls($|\\s)',
    '^pwd($|\\s)', 
    '^echo($|\\s)',
    '^git status($|\\s)',
    '^npm test($|\\s)'
  ],
  alwaysBlockPatterns: [
    'rm -rf /',
    'sudo rm -rf',
    'format.*',
    'dd if=/dev/zero',
    ':(\\(\\))'
  ],
  confirmationTimeout: 30000,
  sessionMemory: true
};
```

#### Task 2: AiyaConfig Integration ✅ **COMPLETED (2025-07-16)**
**Location**: `/src/core/config/manager.ts` - `AiyaConfig` interface
**Requirements**:
- Add shell confirmation settings to main config structure
- Integrate with existing config save/load mechanisms
- Support project-level vs global configuration precedence

**Implementation Details**:
```typescript
interface AiyaConfig {
  // Existing fields...
  shell?: {
    confirmation: {
      enabled: boolean;
      threshold: number;
      timeout: number;
      sessionMemory: boolean;
      trustedCommands: string[];
      alwaysBlockPatterns: string[];
    };
  };
}
```

**Integration Points**:
- `ConfigManager.load()` - Load shell confirmation settings
- `ConfigManager.save()` - Persist confirmation preferences
- Project-level `.aiya.yaml` support for team-shared confirmation settings

### ⏳ Phase 5B: Confirmation Interface Implementation
**Target**: Create interactive user confirmation system

#### Task 3: ShellConfirmationPrompt Component ⏳
**Location**: New file `/src/core/mcp/confirmation.ts`
**Requirements**:
- Async readline-based prompt interface
- Rich command context display with risk visualization
- Multiple user response options (Allow/Deny/Trust/Block/Details)
- Timeout handling with auto-deny security feature
- Integration with existing UI patterns

**Component Interface**:
```typescript
interface ConfirmationPromptOptions {
  command: string;
  riskAssessment: CommandRiskAssessment;
  workingDirectory: string;
  timeout: number;
}

interface ConfirmationResponse {
  decision: 'allow' | 'deny' | 'trust' | 'block';
  rememberDecision: boolean;
  timedOut: boolean;
}

class ShellConfirmationPrompt {
  async promptUser(options: ConfirmationPromptOptions): Promise<ConfirmationResponse>;
}
```

#### Task 4: Confirmation Display Formatting ⏳
**Requirements**:
- Color-coded risk level display (SAFE=green, CRITICAL=red)
- Formatted command context with working directory
- Risk factors list with clear descriptions
- Mitigation suggestions formatted as actionable items
- User options with keyboard shortcuts

**Display Format Example**:
```
🔍 COMMAND CONFIRMATION REQUIRED

Command: rm -rf ./temp/
Working Directory: /home/user/project
Risk Level: HIGH (Score: 78)

Risk Factors:
• File deletion operation
• Wildcard operation affecting multiple files

Potential Impact:
• Significant file system changes
• Files will be permanently deleted

Suggestions:
• Consider backing up affected files first
• Use ls to verify which files will be affected

Options:
  [A] Allow once    [D] Deny    [T] Trust pattern    [B] Block pattern    [S] Show details

Choice (timeout in 30s): _
```

### ⏳ Phase 5C: Integration and Persistence
**Target**: Complete integration with existing systems

#### Task 5: callTool Method Integration ⏳
**Location**: `/src/core/mcp/shell.ts` - `ShellMCPClient.callTool()`
**Requirements**:
- Integrate risk assessment before command execution
- Add confirmation checkpoint for risky commands
- Implement bypass logic for trusted commands
- Update error handling for user denials
- Maintain existing functionality for approved commands

**Integration Flow**:
1. **Pre-execution**: Risk assessment using `CommandRiskAssessor`
2. **Bypass Check**: Check trusted patterns and session memory
3. **Confirmation**: Prompt user if risk threshold exceeded
4. **Decision Handling**: Allow/deny based on user response
5. **Session Update**: Cache decision if session memory enabled
6. **Execution**: Proceed with existing execution flow if approved

#### Task 6: Session Memory Manager ⏳
**Location**: New class in `/src/core/mcp/confirmation.ts`
**Requirements**:
- In-memory storage of user decisions for current session
- Pattern matching for similar commands
- Decision expiration and cleanup
- Integration with confirmation prompt

**Implementation**:
```typescript
class SessionMemoryManager {
  private decisions: Map<string, SessionDecision> = new Map();
  
  checkPreviousDecision(command: string): SessionDecision | null;
  recordDecision(command: string, decision: SessionDecision): void;
  clearExpiredDecisions(): void;
  clearAllDecisions(): void;
}
```

#### Task 7: Configuration Persistence ⏳
**Location**: Integration with existing `ConfigManager`
**Requirements**:
- Save trusted command patterns to user config
- Save always-block patterns to prevent repeated prompts
- Project-level configuration for team settings
- Configuration validation and migration
- Backward compatibility with existing configurations

#### Task 8: Integration Testing and Optimization ⏳
**Requirements**:
- Unit tests for risk assessment accuracy
- Integration tests with existing shell execution flow
- Performance testing for risk assessment (< 10ms target)
- User experience testing for confirmation prompts
- Security testing for bypass mechanisms

## Manual Testing Checkpoints

### Checkpoint 5A: Risk Assessment Verification
**User Verification Required Before Proceeding**:
- [ ] Execute safe commands (`ls`, `pwd`, `echo`) - confirm no prompts appear
- [ ] Execute low-risk commands (`git status`, `npm test`) - verify appropriate behavior
- [ ] Execute medium-risk commands (`npm install`, `mkdir`) - verify prompts appear
- [ ] Execute high-risk commands (`rm file.txt`, `chmod`) - confirm detailed prompts
- [ ] Execute critical commands (`rm -rf`, `sudo`) - verify blocking or critical prompts
- [ ] Test risk scoring accuracy across 20+ different command types
- [ ] Verify risk assessment performance (< 10ms per command assessment)
- [ ] Confirm risk factors and suggestions are accurate and helpful

**Success Criteria**:
- Risk assessment categorizes 95%+ of common commands correctly
- Performance target of < 10ms per assessment met
- Risk factors provide meaningful context to users
- Mitigation suggestions are actionable and helpful

### Checkpoint 5B: Confirmation Interface Testing
**User Verification Required Before Proceeding**:
- [ ] Confirm prompt displays all required information clearly
- [ ] Test all user response options work correctly (A/D/T/B/S)
- [ ] Verify timeout functionality (auto-deny after 30 seconds)
- [ ] Test bypass logic for trusted commands (no prompts for safe operations)
- [ ] Confirm session memory prevents repeat prompts for same commands
- [ ] Test confirmation prompt integrates properly with existing UI
- [ ] Verify prompt readability and user experience
- [ ] Test error handling for invalid user inputs

**Success Criteria**:
- Prompts provide sufficient context for informed decisions
- All user response options function correctly
- Session memory reduces prompt fatigue effectively
- Timeout security feature works reliably
- Integration with existing UI is seamless

### Checkpoint 5C: Configuration & Integration
**User Verification Required Before Proceeding**:
- [ ] Verify configuration saves/loads correctly across sessions
- [ ] Test project-level vs global configuration precedence works
- [ ] Confirm trusted command patterns work as expected
- [ ] Test always-block patterns prevent execution correctly
- [ ] Verify integration with existing MCP tool architecture
- [ ] Test backward compatibility with existing configurations
- [ ] Confirm performance impact is minimal (< 100ms overhead)
- [ ] Verify all logging and error handling works correctly

**Success Criteria**:
- Configuration persistence works reliably
- Project-level settings override global settings appropriately
- Trusted patterns reduce unnecessary prompts
- Integration doesn't break existing functionality
- Performance overhead is acceptable for user experience

## Security Considerations

### Security Measures Implemented
1. **Default Deny**: Unknown/high-risk commands require explicit user approval
2. **Timeout Protection**: Auto-deny prevents indefinite hanging prompts
3. **Audit Trail**: All confirmation decisions logged for security review
4. **Config Validation**: Prevent privilege escalation through configuration manipulation
5. **Pattern Restrictions**: Limit trusted command patterns to prevent security bypass abuse
6. **Critical Command Blocking**: Automatically block extremely dangerous operations

### Risk Mitigation Strategies
1. **Performance Risk**: 
   - Cache risk assessments for repeated commands
   - Optimize pattern matching algorithms
   - Set strict performance targets (< 10ms assessment time)

2. **Usability Risk**: 
   - Smart defaults for common development workflows
   - Session memory to prevent prompt fatigue
   - Context-aware prompts with actionable suggestions
   - Clear risk explanations for user education

3. **Security Risk**: 
   - Conservative risk scoring (prefer false positives over false negatives)
   - Comprehensive logging of all security decisions
   - Regular security audit capabilities
   - Restrict trusted pattern scope to prevent abuse

4. **Integration Risk**: 
   - Extensive testing with existing MCP tools
   - Backward compatibility maintenance
   - Gradual rollout capability
   - Fallback mechanisms for prompt failures

## Success Criteria

### Technical Success Metrics
- [ ] Risk assessment accuracy: 95%+ correct categorization of common commands
- [ ] Performance: < 10ms risk assessment time, < 100ms total confirmation overhead
- [ ] Configuration persistence: 100% reliability across session restarts
- [ ] Security: Zero confirmed bypass vulnerabilities in trusted command logic
- [ ] Integration: Full compatibility with existing shell MCP architecture
- [ ] Error handling: Graceful degradation when confirmation system fails

### User Experience Success Metrics
- [ ] User comprehension: Users can make informed decisions from prompt context
- [ ] Efficiency: Trusted command patterns reduce confirmation prompts by 80%+
- [ ] Discoverability: Configuration options are intuitive and well-documented
- [ ] Session continuity: Session memory eliminates 90%+ of repeated prompts
- [ ] Error guidance: Error messages provide clear, actionable next steps
- [ ] Response time: User prompts respond within 100ms of display

### Integration Success Metrics
- [ ] Architecture consistency: Follows existing Aiya MCP patterns and conventions
- [ ] Configuration compatibility: Seamless integration with existing config system
- [ ] Backward compatibility: Existing shell tool usage unaffected
- [ ] Performance impact: No degradation for pre-approved commands
- [ ] Test coverage: 90%+ code coverage with comprehensive unit and integration tests
- [ ] Documentation: Complete API documentation and user guides

## Implementation Priority and Dependencies

### High Priority (Phase 5A - Configuration Completion)
1. ~~**Update CommandFilter default configuration**: Immediate - required for basic functionality~~ ✅ **COMPLETED**
2. **AiyaConfig integration**: High - needed for configuration persistence

### Medium Priority (Phase 5B - Core Functionality)
3. **ShellConfirmationPrompt component**: High - core user interaction functionality
4. **callTool method integration**: High - required for confirmation system activation
5. **Session memory manager**: Medium - improves user experience significantly

### Low Priority (Phase 5C - Polish and Optimization)
6. **Configuration persistence enhancements**: Medium - team configuration features
7. **Advanced bypass logic**: Low - optimization for power users
8. **Comprehensive testing and optimization**: High - required before production deployment

### Dependencies
- **Prerequisite**: Phases 1-4 completion (✅ Complete)
- **UI Framework**: Existing React/Ink infrastructure and `useKeypress` hook
- **Configuration**: Existing `ConfigManager` and YAML config system
- **Security**: Existing `WorkspaceSecurity` and logging infrastructure
- **Testing**: Existing test framework and patterns

## Development Notes

### Architecture Decisions
1. **Risk Assessment Placement**: Integrated directly into shell MCP client for performance
2. **Configuration Strategy**: Extend existing config system rather than create separate system
3. **UI Integration**: Build on existing React/Ink patterns for consistency
4. **Session Management**: In-memory storage for simplicity and security
5. **Bypass Logic**: Regex-based patterns for flexibility and user control

### Performance Considerations
- Risk assessment must complete in < 10ms to avoid user experience degradation
- Session memory storage should be limited to prevent memory leaks
- Configuration persistence should be async to avoid blocking UI
- Prompt display should be non-blocking to maintain responsiveness

### Security Considerations
- All user decisions must be logged for audit purposes
- Trusted patterns must be carefully validated to prevent security bypass
- Default configuration must be conservative (prefer security over convenience)
- Timeout handling must be reliable to prevent indefinite blocking

## Next Steps

1. **Complete Configuration Integration** (Current Task)
   - ~~Update CommandFilter defaultConfig with Phase 5 fields~~ ✅ **COMPLETED**
   - Integrate shell confirmation settings with AiyaConfig interface
   - Test configuration save/load functionality

2. **Implement Confirmation Interface**
   - Create ShellConfirmationPrompt component with async readline
   - Implement rich context display with risk visualization
   - Add timeout handling and user response processing

3. **Integrate with Call Tool**
   - Add confirmation checkpoint to ShellMCPClient.callTool()
   - Implement bypass logic and session memory
   - Update error handling for confirmation denials

4. **Testing and Optimization**
   - Create comprehensive test suite for all confirmation functionality
   - Performance testing and optimization
   - User experience testing and refinement

5. **Documentation and Deployment**
   - Update user documentation with confirmation system usage
   - Create configuration examples and best practices guide
   - Plan gradual rollout strategy

---

**Document Version**: 1.1  
**Last Updated**: 2025-07-16  
**Next Review**: Upon completion of Phase 5A tasks

---

## Task 1 Completion Log (2025-07-16)

### Implementation Summary
Successfully completed Task 1: Update CommandFilter Default Configuration with full Phase 5 field integration and comprehensive validation.

### Key Achievements
- **Configuration Extension**: Added all 5 Phase 5 fields to `CommandFilter.defaultConfig`
- **Validation Framework**: Implemented robust validation for all new configuration fields
- **Test Coverage**: Created 25 new test cases (14 unit + 11 integration)
- **Backward Compatibility**: Maintained full compatibility with existing configurations
- **Quality Assurance**: All tests passing, no regressions detected

### Files Modified
- `/src/core/mcp/shell.ts` - Updated defaultConfig and added validation
- `/tests/unit/mcp/shell-security.test.ts` - Added Phase 5 configuration tests
- `/tests/integration/mcp/shell-config-integration.test.ts` - New integration test suite

### Issues Resolved
- Fixed TypeScript compilation warning for unused parameter in `assessDataAccess` method
- Separated test validations to prevent test interference due to sequential validation execution

### Next Priority
Task 2: AiyaConfig Integration - Ready to proceed with main configuration system integration.

---

## Task 2 Completion Log (2025-07-16)

### Implementation Summary
Successfully completed Task 2: AiyaConfig Integration with full shell configuration integration into the main configuration system.

### Key Achievements
- **AiyaConfig Extension**: Added complete shell configuration section to main config interface
- **Configuration Precedence**: Implemented proper precedence order (defaults → global → project → environment)
- **Environment Variables**: Added comprehensive AIYA_SHELL_* environment variable support
- **YAML Generation**: Updated ConfigurationGenerator to include shell section with inline comments
- **CLI Integration**: Modified chat.ts to use ConfigManager shell configuration instead of hardcoded values
- **Validation**: Added comprehensive validation for all shell configuration fields
- **Testing**: Created extensive unit tests and integration tests for configuration precedence

### Files Modified
- `/src/core/config/manager.ts` - Extended AiyaConfig interface and added shell configuration support
- `/src/core/config/generation.ts` - Updated YAML generation to include shell section
- `/src/cli/commands/chat.ts` - Modified to use ConfigManager shell configuration
- `/tests/unit/config/config-manager.test.ts` - New comprehensive unit tests
- `/tests/integration/config/config-precedence.test.ts` - New integration tests
- `/.aiya.yaml` - Updated project configuration to include shell section

### Technical Implementation
- **Interface Extension**: Added shell configuration section to AiyaConfig with all ShellToolConfig fields
- **Merge Logic**: Enhanced configuration merging to properly handle shell configuration precedence
- **Environment Support**: Added parsing for AIYA_SHELL_CONFIRMATION_THRESHOLD, AIYA_SHELL_SESSION_MEMORY, etc.
- **YAML Comments**: Added inline documentation for all shell configuration fields
- **Validation**: Comprehensive validation including regex pattern validation and range checks

### Manual Testing Verified
- ✅ Default configuration loads correctly with shell section
- ✅ Environment variables override configuration properly
- ✅ Configuration precedence works as expected
- ✅ Configuration persistence functional
- ✅ YAML generation includes shell section
- ✅ Build compiles without errors

### Next Priority
Task 3: ShellConfirmationPrompt component - Ready to proceed with user interaction interface implementation.