# Tool Confirmation Prompt Implementation Plan

## Overview
Add a confirmation dialog using `@inkjs/ui` Select component that appears before tool execution to prevent accidental execution of potentially dangerous commands. This follows existing project patterns and leverages the already available UI components.

## Current Architecture Analysis

### Tool Execution Flow
1. User sends message in `ChatInterface.tsx`
2. `handleMessage`/`handleMessageStream` in `chat.ts` processes the message  
3. Assistant generates response (potentially with tool calls in JSON format)
4. `ToolExecutor.processMessage()` automatically detects and executes tool calls
5. Follow-up responses are generated after tool execution

### Key Integration Points
- **ChatInterface.tsx** - React UI with Ink for terminal rendering
- **chat.ts** - Message handling and streaming logic  
- **ToolExecutor** - Tool detection and execution logic
- **@inkjs/ui Select** - Already available for consistent UI patterns
- **MCPToolService** - Tool call detection via `detectToolCalls()`

### Existing Tool Call Detection
- Tools are called via JSON format: `{"tool_calls": [{"id": "call_123", "name": "tool_name", "arguments": {"param": "value"}}]}`
- `mcpService.detectToolCalls()` parses JSON blocks from assistant responses
- `ToolCall` interface: `{id: string, name: string, arguments: ToolArguments}`

## Implementation Strategy

### 1. Create Tool Confirmation Dialog Component
**File**: `src/ui/components/ToolConfirmationDialog.tsx`

**Purpose**: Display tool calls and provide confirmation options using `@inkjs/ui` Select component

**Features**:
- Use `Select` component following `ProviderSelection.tsx` patterns
- Display each tool call with name and formatted arguments
- Show descriptions for clarity
- Options: "Execute Tools", "Cancel"
- Keyboard navigation (arrow keys, Enter)

**Interface**:
```tsx
interface ToolConfirmationDialogProps {
  toolCalls: ToolCall[];
  onConfirm: () => void;
  onCancel: () => void;
}
```

**UI Design**:
```
⚠️  The assistant wants to execute the following tools:

┌─────────────────────────────────────────────┐
│ • RunCommand                                │
│   Command: "ls -la /important/directory"    │
│                                             │
│ • ReadFile                                  │  
│   File: "/etc/passwd"                       │
└─────────────────────────────────────────────┘

▸ Execute Tools
  Cancel
```

**Implementation Details**:
- Import `Select` from `@inkjs/ui`
- Use `Box`, `Text` from `ink` for layout
- Format tool arguments in readable way
- Handle selection via `onChange` callback
- Follow existing component patterns from setup components

### 2. Extend ChatInterface State Management  
**File**: `src/ui/components/ChatInterface.tsx`

**New State Variables**:
- `status` enum: Add `'waiting-for-tool-confirmation'`
- `pendingToolCalls: ToolCall[] | null`
- `toolConfirmationResolver: ((confirmed: boolean) => void) | null`

**State Flow Changes**:
- Show `ToolConfirmationDialog` when `status === 'waiting-for-tool-confirmation'`
- Hide normal `UnifiedInput` during confirmation
- Handle confirmation/cancellation responses
- Resume normal flow after user decision

**Integration**:
- Add confirmation callback prop to `ChatInterface`
- Coordinate between UI state and chat logic
- Maintain existing streaming and non-streaming support

### 3. Modify Chat Command Logic
**File**: `src/cli/commands/chat.ts`

**Functions to Update**:
- `handleMessageStream()` - Add confirmation step for streaming mode
- `handleMessage()` - Add confirmation step for non-streaming mode

**Changes**:
1. After assistant response completes, check for tool calls using `mcpService.detectToolCalls()`
2. If tool calls found, pause execution and request confirmation
3. Add confirmation callback to coordinate with UI
4. Only proceed with `toolExecutor.processMessage()` if confirmed
5. If cancelled, skip tool execution and continue normally

**Implementation Details**:
- Use Promise-based coordination between chat logic and UI
- Maintain tool call detection logic from existing code
- Support both streaming and non-streaming modes
- Preserve existing error handling

### 4. Update ToolExecutor with Confirmation Support
**File**: `src/core/tools/executor.ts`

**Constructor Changes**:
```tsx
constructor(
  mcpService: MCPToolService, 
  verbose: boolean = false,
  confirmationCallback?: (toolCalls: ToolCall[]) => Promise<boolean>
) {
  this.mcpService = mcpService;
  this.verbose = verbose;
  this.confirmationCallback = confirmationCallback;
}
```

**processMessage() Changes**:
1. After detecting tool calls (line ~35), call confirmation callback if provided
2. Wait for confirmation promise to resolve
3. Skip tool execution if user cancels
4. Proceed normally if confirmed
5. Return appropriate response based on confirmation result

**Backwards Compatibility**:
- Make confirmation callback optional
- Existing code without callback works unchanged
- Default behavior: execute tools immediately (current behavior)

### 5. Add Configuration Option
**File**: Configuration system (`.aiya.yaml`)

**New Setting**:
```yaml
tools:
  requireConfirmation: true  # Default: true for security
```

**Integration**:
- Read setting in chat command initialization
- Pass confirmation requirement to ToolExecutor
- Allow users to disable confirmation for trusted environments

### 6. ChatWrapper Integration
**File**: `src/cli/commands/chat.ts` (ChatWrapper component)

**Changes**:
- Add confirmation callback prop to ChatInterface
- Implement confirmation logic that coordinates with UI state
- Use Promise-based communication for clean async handling

## Detailed Implementation Steps

### Step 1: Create ToolConfirmationDialog Component

```tsx
// src/ui/components/ToolConfirmationDialog.tsx
import React from 'react';
import { Box, Text } from 'ink';
import { Select } from '@inkjs/ui';
import { ToolCall } from '../../core/providers/base.js';

interface ToolConfirmationDialogProps {
  toolCalls: ToolCall[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const ToolConfirmationDialog: React.FC<ToolConfirmationDialogProps> = ({
  toolCalls,
  onConfirm,
  onCancel,
}) => {
  const formatArguments = (args: any): string => {
    return Object.entries(args)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(', ');
  };

  const handleSelect = (value: string) => {
    if (value === 'confirm') {
      onConfirm();
    } else {
      onCancel();
    }
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="yellow">
          ⚠️  The assistant wants to execute the following tools:
        </Text>
      </Box>

      <Box 
        borderStyle="round" 
        borderColor="yellow" 
        paddingX={2} 
        paddingY={1} 
        marginBottom={1}
      >
        {toolCalls.map((tool, index) => (
          <Box key={index} flexDirection="column" marginBottom={index < toolCalls.length - 1 ? 1 : 0}>
            <Text bold color="cyan">• {tool.name}</Text>
            <Text dimColor>  {formatArguments(tool.arguments)}</Text>
          </Box>
        ))}
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>Use arrow keys to navigate, Enter to select</Text>
      </Box>

      <Select
        options={[
          { label: 'Execute Tools', value: 'confirm' },
          { label: 'Cancel', value: 'cancel' },
        ]}
        onChange={handleSelect}
      />
    </Box>
  );
};
```

### Step 2: Update ChatInterface State

```tsx
// Add to src/ui/components/ChatInterface.tsx

// Update status type
const [status, setStatus] = useState<
  'idle' | 'processing' | 'error' | 'success' | 'waiting-for-tool-confirmation'
>('idle');

// Add new state variables
const [pendingToolCalls, setPendingToolCalls] = useState<ToolCall[] | null>(null);
const [toolConfirmationResolver, setToolConfirmationResolver] = useState<
  ((confirmed: boolean) => void) | null
>(null);

// Add confirmation callback prop
interface ChatInterfaceProps {
  // ... existing props
  onToolConfirmationRequest?: (toolCalls: ToolCall[]) => Promise<boolean>;
}

// Handle tool confirmation
const handleToolConfirmation = async (toolCalls: ToolCall[]): Promise<boolean> => {
  return new Promise((resolve) => {
    setPendingToolCalls(toolCalls);
    setToolConfirmationResolver(() => resolve);
    setStatus('waiting-for-tool-confirmation');
  });
};

const handleConfirmTools = () => {
  if (toolConfirmationResolver) {
    toolConfirmationResolver(true);
    setToolConfirmationResolver(null);
    setPendingToolCalls(null);
    setStatus('processing');
  }
};

const handleCancelTools = () => {
  if (toolConfirmationResolver) {
    toolConfirmationResolver(false);
    setToolConfirmationResolver(null);
    setPendingToolCalls(null);
    setStatus('idle');
  }
};

// Update render logic
return (
  <Box flexDirection='column'>
    {/* Existing message display */}
    
    {status === 'waiting-for-tool-confirmation' && pendingToolCalls ? (
      <ToolConfirmationDialog
        toolCalls={pendingToolCalls}
        onConfirm={handleConfirmTools}
        onCancel={handleCancelTools}
      />
    ) : status !== 'processing' ? (
      <UnifiedInput
        // ... existing props
      />
    ) : null}
    
    {/* Existing status bar */}
  </Box>
);
```

### Step 3: Update Chat Command Logic

```tsx
// Modify src/cli/commands/chat.ts

// Update ChatWrapper to pass confirmation callback
const ChatWrapper: React.FC<ChatWrapperProps> = props => {
  // ... existing code

  const handleToolConfirmationRequest = async (toolCalls: ToolCall[]): Promise<boolean> => {
    // This will be called by the chat logic when tools are detected
    // The ChatInterface will handle the UI and return the user's decision
    // Implementation will be coordinated through React state
  };

  return React.createElement(ChatInterface, {
    ...props,
    onToolConfirmationRequest: handleToolConfirmationRequest,
    // ... other props
  });
};

// Update handleMessageStream function
async function* handleMessageStream(
  input: string,
  session: ChatSession,
  mcpClient: FilesystemMCPClient,
  confirmationCallback?: (toolCalls: ToolCall[]) => Promise<boolean>
): AsyncGenerator<...> {
  // ... existing code until tool processing

  // Process tool calls if available
  if (session.toolExecutor) {
    let currentMessage = assistantMessage;
    let iterationCount = 0;
    const maxIterations = 10;

    while (iterationCount < maxIterations) {
      // Check for tool calls BEFORE processing
      const detectedToolCalls = session.toolService.detectToolCalls(currentMessage.content);
      
      if (detectedToolCalls && detectedToolCalls.length > 0 && confirmationCallback) {
        const confirmed = await confirmationCallback(detectedToolCalls);
        if (!confirmed) {
          // User cancelled - add message without tool execution
          session.messages.push(currentMessage);
          yield { content: '\n\n🚫 Tool execution cancelled by user', done: false };
          break;
        }
      }

      const { updatedMessage, toolResults, hasToolCalls } =
        await session.toolExecutor.processMessage(currentMessage);

      // ... rest of existing logic
    }
  }
  
  // ... rest of function
}
```

### Step 4: Update ToolExecutor

```tsx
// Modify src/core/tools/executor.ts

export class ToolExecutor {
  private mcpService: MCPToolService;
  private verbose: boolean;
  private confirmationCallback?: (toolCalls: ToolCall[]) => Promise<boolean>;

  constructor(
    mcpService: MCPToolService, 
    verbose: boolean = false,
    confirmationCallback?: (toolCalls: ToolCall[]) => Promise<boolean>
  ) {
    this.mcpService = mcpService;
    this.verbose = verbose;
    this.confirmationCallback = confirmationCallback;
  }

  async processMessage(message: Message): Promise<{
    updatedMessage: Message;
    toolResults: Message[];
    hasToolCalls: boolean;
  }> {
    // ... existing code until tool call detection

    if (!toolCalls || toolCalls.length === 0) {
      return {
        updatedMessage: message,
        toolResults: [],
        hasToolCalls: false,
      };
    }

    // NEW: Request confirmation if callback provided
    if (this.confirmationCallback) {
      const confirmed = await this.confirmationCallback(toolCalls);
      if (!confirmed) {
        // User cancelled - return message without tool execution
        return {
          updatedMessage: message,
          toolResults: [],
          hasToolCalls: false,
        };
      }
    }

    // ... rest of existing execution logic
  }
}
```

### Step 5: Add Configuration Support

```yaml
# Add to .aiya.yaml template/default config
tools:
  requireConfirmation: true
```

```tsx
// Update configuration loading in chat.ts
const toolExecutor = new ToolExecutor(
  toolService,
  process.env.AIYA_VERBOSE === 'true',
  config.tools?.requireConfirmation ? confirmationCallback : undefined
);
```

## Testing Plan

### Test Cases
1. **Safe Commands**: `echo "hello"`, `pwd`, `ls`
   - Should show confirmation dialog
   - Should execute when confirmed
   - Should not execute when cancelled

2. **Dangerous Commands**: `rm -rf /`, `sudo commands`
   - Should show confirmation dialog with clear warning
   - Should not execute when cancelled

3. **Multiple Tools**: Multiple tool calls in single response
   - Should show all tools in confirmation dialog
   - Should execute all or none based on user choice

4. **Configuration**: 
   - Test with `requireConfirmation: true` (default)
   - Test with `requireConfirmation: false` (bypass confirmation)

5. **Streaming vs Non-streaming**: 
   - Test both modes work correctly
   - Confirm UI state management works in both cases

6. **Edge Cases**:
   - No tool calls (normal flow)
   - Invalid tool calls (error handling)
   - User cancellation mid-stream

## Detailed Todo List

### High Priority Implementation Tasks

1. **Create ToolConfirmationDialog Component** ✅ COMPLETED
   - [x] Create `src/ui/components/ToolConfirmationDialog.tsx`
   - [x] Import required dependencies (`Select` from `@inkjs/ui`, `Box`, `Text` from `ink`)
   - [x] Implement tool call display formatting
   - [x] Add Select component with "Execute Tools" and "Cancel" options
   - [x] Handle selection callbacks (onConfirm, onCancel)
   - [x] Style component with borders and proper spacing

2. **Update ChatInterface State Management** ✅ COMPLETED
   - [x] Add `'waiting-for-tool-confirmation'` to status enum
   - [x] Add `pendingToolCalls` state variable
   - [x] Add `toolConfirmationResolver` state variable  
   - [x] Add `onToolConfirmationRequest` prop to interface
   - [x] Implement `handleToolConfirmation` function
   - [x] Implement `handleConfirmTools` and `handleCancelTools` functions
   - [x] Update render logic to show confirmation dialog
   - [x] Hide UnifiedInput during confirmation state

3. **Modify Chat Command Logic** ✅ COMPLETED
   - [x] Update `handleMessageStream` function signature
   - [x] Add tool call detection before `toolExecutor.processMessage()`
   - [x] Implement confirmation request logic in streaming mode
   - [x] Update `handleMessage` function for non-streaming mode
   - [x] Add confirmation callback to ChatWrapper props
   - [x] Implement Promise-based coordination between UI and logic
   - [x] Handle user cancellation scenarios
   - [x] Maintain existing error handling

4. **Update ToolExecutor with Confirmation Support** ✅ COMPLETED
   - [x] Add `confirmationCallback` parameter to constructor
   - [x] Make confirmation callback optional for backwards compatibility
   - [x] Modify `processMessage` to call confirmation before execution
   - [x] Handle confirmation promise resolution
   - [x] Skip tool execution if user cancels
   - [x] Return appropriate response for cancelled tools
   - [x] Maintain existing verbose logging

5. **Add Configuration Option** ✅ COMPLETED
   - [x] Add `tools.requireConfirmation` to config schema
   - [x] Set default value to `true` for security
   - [x] Update config loading in chat command
   - [x] Pass confirmation requirement to ToolExecutor
   - [x] Add config validation
   - [x] Update documentation

6. **Testing and Validation** ✅ COMPLETED
   - [x] Test with safe commands (echo, pwd, ls)
   - [x] Test with dangerous commands (rm, sudo)
   - [x] Test with multiple tool calls
   - [x] Test configuration on/off
   - [x] Test streaming vs non-streaming modes
   - [x] Test edge cases (no tools, invalid tools)
   - [x] Test user cancellation scenarios
   - [x] Verify UI state management
   - [x] Test keyboard navigation in confirmation dialog

### Implementation Order

1. **Phase 1**: Core Component Creation
   - ToolConfirmationDialog component
   - Basic UI and interaction handling

2. **Phase 2**: State Management Integration  
   - ChatInterface state updates
   - React state coordination

3. **Phase 3**: Logic Integration
   - Chat command modifications
   - ToolExecutor updates
   - Promise-based coordination

4. **Phase 4**: Configuration and Polish
   - Configuration option
   - Testing and validation
   - Documentation updates

### Success Criteria

- ✅ Confirmation dialog appears when tools are detected
- ✅ User can choose to execute or cancel tools
- ✅ Tools execute only when confirmed
- ✅ UI state properly managed during confirmation
- ✅ Both streaming and non-streaming modes work
- ✅ Configuration option allows bypassing confirmation
- ✅ Existing functionality unchanged when confirmation disabled
- ✅ Proper error handling and edge case management

## Implementation Status: ✅ COMPLETE

All core functionality has been successfully implemented and tested:

### Files Created/Modified:
- `src/ui/components/ToolConfirmationDialog.tsx` - New confirmation dialog component
- `src/ui/components/ChatInterface.tsx` - Updated with confirmation state management
- `src/ui/components/SimpleStatusBar.tsx` - Added support for confirmation status
- `src/core/tools/executor.ts` - Added confirmation callback support
- `src/core/config/manager.ts` - Added tools configuration interface
- `src/cli/commands/chat.ts` - Integrated confirmation flow
- `.aiya.yaml` - Added tools.requireConfirmation configuration

### Key Features Implemented:
1. **Interactive Confirmation Dialog**: Uses @inkjs/ui Select component for consistent UX
2. **Tool Information Display**: Shows tool names and formatted arguments clearly
3. **State Management**: Proper React state handling for confirmation flow
4. **Configuration Support**: `tools.requireConfirmation` setting (default: true)
5. **Backwards Compatibility**: Can be disabled via configuration
6. **Error Handling**: Graceful handling of user cancellation
7. **TypeScript Support**: Full type safety throughout implementation

### Security Benefits:
- Prevents accidental execution of dangerous commands
- User can review tool calls before execution
- Clear display of tool arguments for transparency
- Configurable for trusted environments

## Technical Notes

### Key Dependencies
- `@inkjs/ui` v2.0.0 (already installed)
- `ink` v6.0.1 (already installed)
- `react` v19.1.0 (already installed)

### Integration Patterns
- Follow existing `ProviderSelection.tsx` component patterns
- Use Promise-based async coordination
- Maintain backwards compatibility
- Preserve existing error handling

### Security Considerations
- Default to requiring confirmation for safety
- Clear display of tool arguments to user
- Prevent accidental dangerous command execution
- Allow configuration for trusted environments

This implementation plan provides comprehensive coverage of the tool confirmation feature while maintaining compatibility with existing code and following established patterns in the codebase.