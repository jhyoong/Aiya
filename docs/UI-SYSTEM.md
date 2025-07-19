# UI System Architecture

## Overview

The Aiya UI system is built with React and Ink to provide a modern, interactive terminal interface. It implements a sophisticated text editing system with visual line wrapping, keyboard input handling, and component-based architecture optimized for terminal environments.

## Core Architecture

### Technology Stack

**Primary Technologies**:
- **React**: Component-based UI framework
- **Ink**: React for terminal interfaces
- **TypeScript**: Type safety and development experience
- **Chalk**: Terminal color and styling

**Key Libraries**:
- **Fuse.js**: Fuzzy search capabilities
- **string-width**: Proper Unicode width handling
- **strip-ansi**: ANSI escape sequence processing

### Component Hierarchy

```
AiyaApp (Root)
├── ChatInterface (Main chat UI)
│   ├── UnifiedInput (Input handling)
│   ├── SimpleStatusBar (Status display)
│   ├── ToolExecution (Tool execution UI)
│   └── ShellCommandConfirmationDialog (Shell command approval)
├── SearchResults (Search result display)
├── SetupWizard (Initial setup)
│   ├── WelcomeScreen
│   ├── ProviderSelection
│   ├── ProviderConfigForm
│   └── ConnectionTest
└── StartupLoader (Loading screen)
```

## Core Components

### AiyaApp - Application Root
**Location**: `src/ui/AiyaApp.tsx`

The main application component that manages global state and routing:

**Key Responsibilities**:
- **Mode Management**: Switch between chat, search, setup, and tool modes
- **Global State**: Manage application-wide state
- **Component Routing**: Render appropriate components based on mode
- **Terminal Size**: Handle terminal resizing and layout

**State Management**:
```typescript
interface AppState {
  mode: 'chat' | 'search' | 'setup' | 'tool';
  config: AiyaConfig;
  terminalSize: { width: number; height: number };
  providers: ProviderInfo[];
  currentProvider: string;
}
```

**Design Patterns**:
- **State Machine**: Mode transitions with clear state management
- **Observer Pattern**: Terminal size and configuration changes
- **Composition**: Composed of specialized child components

### ChatInterface - Main Chat UI
**Location**: `src/ui/components/ChatInterface.tsx`

The primary interface for AI chat interactions:

**Key Features**:
- **Message Management**: Handle chat message history with memory management
- **Streaming Support**: Real-time message streaming with chunked processing
- **Provider Switching**: Runtime provider switching capabilities
- **Memory Management**: Bounded arrays and content limiting
- **Shell Command Integration**: Approval workflow for dangerous shell commands

**Message State Management**:
```typescript
interface MessageState {
  messages: Message[];
  streamingContent: string;
  isProcessing: boolean;
  processingState: 'idle' | 'processing' | 'error' | 'success';
}
```

**Performance Optimizations**:
- **Bounded Arrays**: Limit message history to prevent memory growth
- **Content Limiting**: Truncate long messages for display
- **Streaming Optimization**: Efficient real-time content updates
- **Memory Cleanup**: Automatic cleanup of old messages

### UnifiedInput - Advanced Input Handling
**Location**: `src/ui/components/UnifiedInput.tsx`

Sophisticated input component with text editing capabilities:

**Key Features**:
- **Multi-line Support**: Handle complex multi-line text input
- **Keyboard Shortcuts**: Full keyboard navigation and editing
- **Suggestion System**: Command suggestions with tab completion
- **Paste Handling**: Robust paste operation support
- **Visual Feedback**: Real-time visual feedback and cursor positioning

**Input Handling**:
```typescript
interface InputHandling {
  // Basic text operations
  onSubmit: (text: string) => void;
  onTab: () => void;
  onEscape: () => void;
  onCancel: () => void;
  
  // Advanced features
  suggestionEngine: SuggestionEngine;
  textBuffer: TextBuffer;
  keyboardNavigation: KeyboardHandler;
}
```

**Key Patterns**:
- **Command Pattern**: Input commands with validation
- **Strategy Pattern**: Different input handling strategies
- **Observer Pattern**: Real-time input feedback

### ShellCommandConfirmationDialog - Command Approval UI
**Location**: `src/ui/components/ShellCommandConfirmationDialog.tsx`

Security-focused dialog for approving potentially dangerous shell commands:

**Key Features**:
- **Command Analysis**: Visual display of command and command type
- **Risk Assessment**: Color-coded danger levels (red for dangerous, yellow for caution)
- **User Choice Options**: Allow once, allow always, or reject
- **Visual Feedback**: Clear visual indicators for command safety level
- **Keyboard Navigation**: Full keyboard accessibility with arrow key navigation

**Approval Interface**:
```typescript
interface ShellCommandConfirmationDialogProps {
  command: string;           // Full command to execute
  commandType: string;       // Base command name (e.g., 'rm', 'sudo')
  onChoice: (choice: ShellConfirmationChoice) => void;
}

type ShellConfirmationChoice = 'allow-once' | 'reject' | 'allow-always';
```

**Security Features**:
- **Dangerous Command Detection**: Highlights high-risk commands (rm, sudo, curl, etc.)
- **Visual Risk Indicators**: Red borders and warning icons for dangerous commands
- **Clear Command Display**: Shows both command type and full command text
- **User Education**: Warning messages about potential system impact

**Design Patterns**:
- **Modal Pattern**: Blocking dialog that requires user decision
- **Security Gate Pattern**: Prevents execution without explicit approval
- **Progressive Disclosure**: Shows appropriate level of detail based on risk

### TextBuffer - Advanced Text Editing
**Location**: `src/ui/core/TextBuffer.ts`

Comprehensive text editing system with terminal-optimized features:

**Core Features**:
- **Unicode Support**: Full Unicode character handling
- **Visual Line Wrapping**: Automatic line wrapping for terminal width
- **Cursor Management**: Sophisticated cursor positioning and movement
- **Undo/Redo System**: Complete undo/redo functionality
- **External Editor Integration**: Launch external editors for complex editing

**Architecture Components**:

#### State Management
```typescript
interface TextBufferState {
  lines: string[];              // Logical lines of text
  cursorRow: number;            // Current cursor row
  cursorCol: number;            // Current cursor column
  preferredCol: number | null;  // Preferred column for vertical movement
  undoStack: UndoHistoryEntry[];
  redoStack: UndoHistoryEntry[];
  viewportWidth: number;        // Terminal width for wrapping
}
```

#### Visual Layout System
The TextBuffer implements a sophisticated visual layout system:

**Logical vs Visual Lines**:
- **Logical Lines**: Original text lines as typed
- **Visual Lines**: Lines as displayed with wrapping
- **Cursor Mapping**: Bidirectional mapping between logical and visual positions

**Layout Calculation**:
```typescript
interface VisualLayout {
  visualLines: string[];                    // Wrapped lines for display
  visualCursor: [number, number];           // Visual cursor position
  logicalToVisualMap: Array<Array<[number, number]>>; // Mapping logical to visual
  visualToLogicalMap: Array<[number, number]>;        // Mapping visual to logical
}
```

#### Text Operations
Comprehensive text editing operations:

**Basic Operations**:
- `insert(text: string)` - Insert text at cursor
- `backspace()` - Delete character before cursor
- `delete()` - Delete character at cursor
- `move(direction: Direction)` - Move cursor

**Advanced Operations**:
- `deleteWordLeft()` - Delete word before cursor
- `deleteWordRight()` - Delete word after cursor
- `killLineRight()` - Delete to end of line
- `killLineLeft()` - Delete to start of line

**Range Operations**:
- `replaceRange()` - Replace text in range
- `replaceRangeByOffset()` - Replace by character offset

### useKeypress Hook - Input Event Handling
**Location**: `src/ui/hooks/useKeypress.ts`

Custom hook for advanced keyboard input handling:

**Key Features**:
- **Bracketed Paste Support**: Handle large paste operations
- **Shift+Enter Detection**: Distinguish between Enter and Shift+Enter
- **Escape Sequence Handling**: Process terminal escape sequences
- **Timeout Management**: Handle input timing and sequences

**Paste Handling**:
```typescript
interface PasteHandling {
  bracketedPasteMode: boolean;    // Terminal bracketed paste support
  pasteBuffer: Buffer;            // Accumulate paste data
  pasteDetection: boolean;        // Detect paste operations
  sequenceTimeout: number;        // Timeout for key sequences
}
```

**Key Sequence Detection**:
- **Shift+Enter**: Multiple detection methods for terminal compatibility
- **Escape Sequences**: Handle complex escape sequences
- **Timing-based**: Use timeouts for sequence detection

## Supporting Systems

### Suggestion Engine
**Location**: `src/cli/suggestions.ts`

Provides intelligent command suggestions:

**Features**:
- **Command Completion**: Auto-complete slash commands
- **Contextual Suggestions**: Context-aware suggestions
- **Fuzzy Matching**: Approximate command matching
- **Learning System**: Adapt to user patterns

**Suggestion Types**:
```typescript
interface SuggestionResult {
  displayText: string;      // Text to display to user
  completionText: string;   // Text to complete input
  confidence: number;       // Confidence score 0-100
  category: string;         // Suggestion category
}
```

### Memory Management
**Location**: `src/ui/utils/memoryManagement.ts`

Sophisticated memory management for long-running terminal applications:

**Key Features**:
- **Resource Cleanup**: Automatic cleanup of resources
- **Timeout Management**: Manage timeouts and intervals
- **Bounded Collections**: Prevent memory growth
- **Garbage Collection**: Trigger cleanup when needed

**Cleanup Patterns**:
```typescript
class ResourceCleanup {
  private cleanupTasks: Array<() => void> = [];
  
  register(cleanup: () => void): void;
  cleanup(): void;
  cleanupAndReset(): void;
}
```

### Text Processing Utilities
**Location**: `src/ui/utils/textProcessing.ts`

Advanced text processing for terminal display:

**Key Features**:
- **Unicode Handling**: Proper Unicode character processing
- **Width Calculation**: Accurate terminal width calculation
- **Text Wrapping**: Intelligent text wrapping algorithms
- **ANSI Processing**: Handle ANSI escape sequences

**Text Processing Functions**:
```typescript
// Unicode and width handling
function toCodePoints(str: string): string[];
function cpLen(str: string): number;
function cpSlice(str: string, start: number, end?: number): string;

// Text analysis
function isWordChar(char: string): boolean;
function stripUnsafeCharacters(str: string): string;
function calculateTextWidth(text: string): number;
```

### Visual Layout System
**Location**: `src/ui/utils/visualLayout.ts`

Optimized visual layout calculation:

**Key Features**:
- **Memoization**: Cache layout calculations for performance
- **Line Wrapping**: Intelligent line wrapping for terminal width
- **Cursor Mapping**: Efficient cursor position mapping
- **Performance Optimization**: Optimized for frequent recalculation

**Layout Processing**:
```typescript
interface LayoutChunk {
  content: string;
  startPosInLogicalLine: number;
  endPosInLogicalLine: number;
  visualLineIndex: number;
}

function processLogicalLine(
  logicalLine: string,
  logicalLineIndex: number,
  cursor: [number, number],
  viewportWidth: number
): {
  visualChunks: LayoutChunk[];
  visualCursor: [number, number] | null;
}
```

## State Management

### Component State
Each component manages its own state using React hooks:

**useState**: Local component state
**useReducer**: Complex state with actions (TextBuffer)
**useCallback**: Memoized functions for performance
**useMemo**: Memoized computations for expensive operations
**useEffect**: Side effects and cleanup

### Global State
Application-wide state is managed through:

**Props Threading**: Pass state through component hierarchy
**Context API**: Shared state for theme, configuration
**Custom Hooks**: Reusable state logic
**External State**: Configuration and provider state

### State Patterns

**Reducer Pattern** (TextBuffer):
```typescript
type TextBufferAction = 
  | { type: 'insert'; payload: string }
  | { type: 'move'; payload: { dir: Direction } }
  | { type: 'undo' }
  | { type: 'redo' };

function textBufferReducer(
  state: TextBufferState,
  action: TextBufferAction
): TextBufferState;
```

**Observer Pattern** (Terminal size):
```typescript
const [terminalSize, setTerminalSize] = useState<TerminalSize>();

useEffect(() => {
  const handleResize = () => {
    setTerminalSize(getTerminalSize());
  };
  
  process.stdout.on('resize', handleResize);
  return () => process.stdout.off('resize', handleResize);
}, []);
```

## Performance Optimizations

### Rendering Optimizations
- **Memoization**: Memoize expensive computations
- **Conditional Rendering**: Render only necessary components
- **Virtualization**: Virtual scrolling for large content
- **Debouncing**: Debounce frequent updates

### Memory Management
- **Bounded Arrays**: Limit message and history size
- **Resource Cleanup**: Automatic cleanup of resources
- **Garbage Collection**: Trigger cleanup when needed
- **Weak References**: Use weak references where appropriate

### Input Handling
- **Event Batching**: Batch rapid input events
- **Timeout Management**: Efficient timeout handling
- **Sequence Detection**: Optimize key sequence detection
- **Paste Optimization**: Efficient paste handling

## Styling and Theming

### Chalk Integration
Color and styling using Chalk:

```typescript
// Color definitions
const colors = {
  primary: chalk.cyan,
  secondary: chalk.yellow,
  error: chalk.red,
  success: chalk.green,
  muted: chalk.gray,
};

// Usage in components
<Text color="cyan">Primary text</Text>
<Text color="yellow">Secondary text</Text>
```

### Theme System
Basic theme support:

```typescript
interface Theme {
  colors: {
    primary: string;
    secondary: string;
    error: string;
    success: string;
    muted: string;
  };
  borders: {
    style: 'single' | 'double' | 'round';
    color: string;
  };
}
```

## Error Handling

### Component Error Boundaries
React error boundaries for graceful error handling:

```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error and show fallback UI
  }
}
```

### Input Validation
Comprehensive input validation:

```typescript
interface InputValidation {
  validateCommand(command: string): ValidationResult;
  sanitizeInput(input: string): string;
  handleInputError(error: InputError): void;
}
```

### Error Recovery
Graceful error recovery:

```typescript
// Automatic recovery from input errors
const handleInputError = (error: Error) => {
  // Log error
  console.error('Input error:', error);
  
  // Reset input state
  resetInputState();
  
  // Show user-friendly error message
  showErrorMessage('Input error occurred. Please try again.');
};
```

## Testing Strategy

### Component Testing
- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test component interactions
- **Visual Tests**: Test terminal rendering
- **Input Tests**: Test keyboard input handling

### Test Utilities
```typescript
// Test utilities for UI components
function renderComponent(component: React.ReactElement) {
  return render(component);
}

function simulateKeypress(key: string) {
  // Simulate keyboard input
}

function assertTerminalOutput(expected: string) {
  // Assert terminal output matches expected
}
```

### Mock Dependencies
Mock external dependencies for testing:

```typescript
// Mock Ink components
jest.mock('ink', () => ({
  Box: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  useInput: jest.fn(),
  useStdin: jest.fn(),
}));
```

## Best Practices

### Component Design
1. **Single Responsibility**: Each component has one clear purpose
2. **Composition**: Build complex UI from simple components
3. **Props Interface**: Clear and type-safe props interfaces
4. **State Management**: Appropriate state management patterns
5. **Performance**: Optimize for terminal rendering

### Input Handling
1. **Debouncing**: Debounce rapid input events
2. **Validation**: Validate all user input
3. **Error Handling**: Graceful error recovery
4. **Accessibility**: Support keyboard navigation
5. **Feedback**: Provide immediate user feedback

### Memory Management
1. **Cleanup**: Always clean up resources
2. **Bounded Collections**: Limit collection sizes
3. **Weak References**: Use weak references appropriately
4. **Monitoring**: Monitor memory usage
5. **Optimization**: Optimize for long-running processes

### Terminal Optimization
1. **Efficient Rendering**: Minimize terminal updates
2. **Color Usage**: Use colors effectively
3. **Layout**: Optimize for terminal constraints
4. **Responsiveness**: Handle terminal resizing
5. **Performance**: Optimize for terminal performance

## Extension Points

### Adding New Components
1. **Component Interface**: Define clear props interface
2. **State Management**: Choose appropriate state pattern
3. **Styling**: Use consistent styling patterns
4. **Input Handling**: Implement appropriate input handling
5. **Testing**: Add comprehensive tests

### Custom Input Handlers
1. **Keyboard Mapping**: Map keyboard inputs to actions
2. **Validation**: Validate input before processing
3. **Error Handling**: Handle input errors gracefully
4. **Feedback**: Provide user feedback
5. **Documentation**: Document input behavior

### Theme Customization
1. **Color Schemes**: Define custom color schemes
2. **Layout Options**: Customize layout options
3. **Typography**: Customize text styling
4. **Borders**: Customize border styles
5. **Animations**: Add terminal animations

## Future Enhancements

### Potential Improvements
1. **Advanced Theming**: More sophisticated theme system
2. **Accessibility**: Enhanced accessibility features
3. **Performance**: Further performance optimizations
4. **Input Methods**: Support for more input methods
5. **Layout System**: More flexible layout system

### Integration Points
1. **External Editors**: Enhanced external editor integration
2. **Plugin System**: Support for UI plugins
3. **Custom Components**: Easy custom component creation
4. **API Integration**: Better API integration patterns
5. **Data Visualization**: Terminal data visualization