# Input System Validation Checklist

This document provides a comprehensive checklist for testing the enhanced input system functionality in Aiya v1.2.0.

## Test Environment Setup

1. Ensure you're running in a terminal that supports bracketed paste mode
2. Have text samples ready for testing (multiline text, code blocks, special characters)
3. Test across different terminal emulators if possible (Terminal.app, iTerm2, Windows Terminal, etc.)

## Core Input Functionality

### ✅ Basic Text Entry
- [ ] Single line text input works correctly
- [ ] Unicode characters display properly (emojis, special symbols)
- [ ] Long lines wrap correctly in the terminal
- [ ] Cursor positioning is accurate during text editing

### ✅ Key Navigation
- [ ] Arrow keys navigate correctly (left, right, up, down)
- [ ] Home/End keys move to line beginning/end
- [ ] Word-wise navigation (Ctrl+Left/Right, Alt+Left/Right)
- [ ] Backspace removes characters to the left
- [ ] Delete key functionality (if supported)

### ✅ Enhanced Enter Key Handling
- [ ] **Regular Enter**: Submits the message/command
- [ ] **Shift+Enter**: Inserts a newline without submitting
- [ ] Multiple newlines can be inserted with repeated Shift+Enter
- [ ] Cursor positioning after newline insertion is correct

## Paste Functionality

### ✅ Bracketed Paste Mode
- [ ] Terminal shows bracketed paste is enabled (no escape sequences visible)
- [ ] Paste operations are detected correctly
- [ ] No terminal warnings or escape sequences appear during paste

### ✅ Single Line Paste
- [ ] Copy/paste single line text works correctly
- [ ] Pasted text appears at cursor position
- [ ] No auto-submission occurs after paste
- [ ] Special characters in pasted text are preserved

### ✅ Multiline Paste
- [ ] **Critical**: Multiline paste does NOT auto-submit
- [ ] All lines are pasted correctly preserving line breaks
- [ ] Cursor ends up at the end of pasted content
- [ ] Very long multiline pastes (100+ lines) work correctly
- [ ] Mixed content (text + code) pastes correctly

### ✅ Special Paste Scenarios
- [ ] Code blocks with indentation paste correctly
- [ ] Text with special characters (quotes, backslashes) works
- [ ] Empty lines within pasted content are preserved
- [ ] Paste at beginning/middle/end of existing text works
- [ ] Paste while text is selected (if selection is implemented)

## Command System Integration

### ✅ Slash Commands
- [ ] Slash commands can be typed normally
- [ ] Tab completion works for commands
- [ ] Command suggestions appear correctly
- [ ] Multiline text can include slash-like content without interference

### ✅ Command Execution
- [ ] Commands submit correctly with Enter
- [ ] Commands with multiline content work (e.g., `/add` with file content)
- [ ] Error messages for invalid commands display correctly

## Edge Cases

### ✅ Large Content Handling
- [ ] Very long single lines (1000+ characters) work
- [ ] Very large multiline content (1MB+) handles gracefully
- [ ] Performance remains acceptable with large content

### ✅ Terminal Compatibility
- [ ] Works in macOS Terminal.app
- [ ] Works in iTerm2
- [ ] Works in Windows Terminal (if testing on Windows)
- [ ] Works in Linux terminal emulators
- [ ] Works over SSH connections

### ✅ Error Recovery
- [ ] Invalid escape sequences don't break input
- [ ] Terminal resize during input works correctly
- [ ] Ctrl+C cancellation works properly
- [ ] Recovery from paste failures is graceful

## Validation Commands

Use these commands to test the input system:

```bash
# Test basic functionality
echo "Test single line input"

# Test multiline with Shift+Enter
# Type: Line 1 [Shift+Enter] Line 2 [Shift+Enter] Line 3 [Enter to submit]

# Test paste by copying this multiline text:
# Line 1
# Line 2 with special chars: @#$%^&*()
# Line 3
#   Indented line
# Final line

# Test slash commands
/help
/tokens
/thinking on
```

## Expected Behavior Summary

1. **Enter Key**: Always submits unless it's Shift+Enter
2. **Shift+Enter**: Always inserts newline, never submits
3. **Paste Operations**: Never auto-submit, always just insert content
4. **Bracketed Paste**: No visible escape sequences, clean paste experience
5. **Multiline Handling**: Full support for editing multiline content before submission

## Common Issues to Watch For

- ❌ Auto-submission on paste
- ❌ Terminal escape sequences visible to user
- ❌ Corrupted paste content (missing lines, wrong characters)
- ❌ Shift+Enter not working (submits instead of newline)
- ❌ Poor performance with large content
- ❌ Cursor positioning issues after paste

## Test Results

Document any issues found during testing:

### Issues Found
- [ ] Issue 1: [Description]
- [ ] Issue 2: [Description]

### Successful Tests
- [ ] All basic input functionality works
- [ ] Shift+Enter newlines work correctly
- [ ] Multiline paste works without auto-submission
- [ ] Bracketed paste mode functions properly
- [ ] No performance issues with large content

## Sign-off

- [ ] All critical functionality tested and working
- [ ] No blocking issues identified
- [ ] Input system ready for production use

**Tested by**: [Name]  
**Date**: [Date]  
**Terminal**: [Terminal emulator and version]  
**OS**: [Operating system and version]