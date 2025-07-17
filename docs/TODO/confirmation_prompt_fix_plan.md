# Fix Plan: Confirmation Prompt Not Appearing

**Created**: 2025-07-16  
**Issue**: Confirmation prompt system is not displaying prompts to users during manual testing  
**Status**: Ready for implementation

## Problem Analysis

The confirmation prompt is not appearing because the `ShellConfirmationPrompt` implementation uses raw console operations that don't work in Aiya's React/Ink UI environment.

**Root Cause**: UI Framework Mismatch
- Current implementation uses `console.clear()`, `console.log()`, `readline.createInterface()`
- Aiya uses React/Ink UI with `useKeypress` hook and `useStdin` from Ink
- Raw console operations don't integrate with React/Ink rendering system

**Evidence from Manual Testing**:
- Command `rm deleteMe.txt` resulted in "timed out waiting for confirmation"
- This indicates the confirmation system detected the risky command
- The prompt was triggered but the UI didn't appear to the user
- The 30-second timeout expired, resulting in automatic denial

## Technical Details

### Current Implementation Issues
1. **Console Operations**: `console.clear()` and `console.log()` don't work with React/Ink
2. **Readline Interface**: `readline.createInterface()` conflicts with Ink's stdin handling
3. **Raw Mode**: `process.stdin.setRawMode(true)` interferes with Ink's input system
4. **Display Updates**: Countdown timer and display updates don't integrate with React rendering

### Aiya's UI Architecture
- Uses React/Ink for terminal UI rendering
- Input handling via `useKeypress` hook and `useStdin` from Ink
- Chat interface manages display state and user interactions
- Console output is captured and displayed within React components

## Proposed Fixes

### Fix 1: Temporary Console Integration (Quick Fix)
**Priority**: High  
**Effort**: Low  

**Approach**: Modify the confirmation prompt to work better with Aiya's console output
- Remove `console.clear()` calls that might interfere with Aiya's UI
- Use `process.stderr.write()` instead of `console.log()` for prompt display
- Add better error handling and debug logging
- Ensure proper cleanup of readline interface
- Use non-blocking prompt display

**Implementation Steps**:
1. Replace `console.clear()` with targeted output clearing
2. Use `process.stderr.write()` for prompt display to avoid React/Ink interference
3. Add debug logging to trace prompt display and user input
4. Improve readline interface cleanup
5. Add fallback mechanisms for UI conflicts

### Fix 2: React/Ink Component Integration (Proper Fix)
**Priority**: High  
**Effort**: High  

**Approach**: Create a proper React/Ink component for confirmations
- Create a `ConfirmationPrompt` React component using Ink
- Use `useKeypress` hook for keyboard input handling
- Integrate with Aiya's existing UI state management
- Display prompt as an overlay or modal within the chat interface

**Implementation Steps**:
1. Create React/Ink `ConfirmationPrompt` component
2. Integrate with existing `useKeypress` hook patterns
3. Add state management for prompt visibility and user responses
4. Create modal/overlay display within chat interface
5. Update `ShellConfirmationPrompt` to use React component
6. Test integration with chat flow

## Recommended Implementation Order

1. **Fix 1 (Quick)**: Console integration improvements - can be done immediately
3. **Fix 2 (Proper)**: React/Ink component - long-term solution

## Testing Strategy

### Manual Testing Scenarios
- Test with various risky commands (`rm`, `chmod`, `sudo`)
- Verify prompt appears and responds to user input (A/D/T/B/S)
- Test timeout functionality (30-second auto-deny)
- Ensure no UI interference with normal chat flow
- Test configuration bypass option

### Automated Testing
- Unit tests for prompt display logic
- Integration tests for user response handling
- UI component tests for React/Ink integration
- Performance tests for prompt response time


## Risk Assessment

### Implementation Risks
- **UI Conflicts**: React/Ink integration may introduce new display issues
- **Input Handling**: Keyboard input conflicts between prompt and chat interface
- **Performance**: Prompt display might slow down command execution
- **User Experience**: Complex prompts might confuse users

### Mitigation Strategies
- Add comprehensive error handling and logging
- Provide clear user documentation
- Maintain backward compatibility with existing configurations

## Success Criteria

### Technical Success
- [ ] Confirmation prompts appear consistently for risky commands
- [ ] User input (A/D/T/B/S) is properly captured and processed
- [ ] Timeout functionality works correctly (30-second auto-deny)
- [ ] No interference with normal chat interface operation
- [ ] Configuration bypass option functions properly

### User Experience Success
- [ ] Prompts are clearly visible and readable
- [ ] User can easily understand available options
- [ ] Response time is acceptable (prompt appears within 100ms)
- [ ] No disruption to normal command execution flow
- [ ] Clear feedback on user decisions

## Documentation Updates

### User Documentation
- Update shell tool documentation with confirmation system details
- Add configuration examples for trusted/blocked commands
- Create troubleshooting guide for prompt issues
- Document security implications of bypass options

### Developer Documentation
- Update API documentation for confirmation system
- Add integration guide for React/Ink components
- Document testing procedures for UI components
- Create architecture guide for prompt system

## Next Steps

Ask the user to choose which fix to attempt: 
1. Implement Fix 1 (Console Integration) to resolve urgent issue
2. Implement Fix 2 (React/Ink Component) for proper solution

## File Locations

### Implementation Files
- `/src/core/mcp/confirmation.ts` - Main confirmation prompt implementation
- `/src/core/mcp/shell.ts` - Shell MCP client with confirmation integration
- `/src/ui/components/` - React/Ink component location for Fix 2

### Configuration Files
- `/src/core/config/manager.ts` - Configuration system integration
- `/.aiya.yaml` - Project configuration file
- `/docs/TODO/phase5_user_confirmation_implementation_plan.md` - Original implementation plan

### Test Files
- `/tests/unit/mcp/shell-security.test.ts` - Unit tests for confirmation system
- `/tests/integration/mcp/shell-confirmation-integration.test.ts` - Integration tests

---

**Document Version**: 1.0  
**Last Updated**: 2025-07-16  
**Next Review**: After Fix 1 implementation and testing