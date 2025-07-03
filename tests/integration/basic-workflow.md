# Basic Workflow Integration Tests

## Test Scenario 1: Project Initialization

1. **Setup**: Start in a clean directory
2. **Run**: `aiya init --model qwen2.5:8b`
3. **Expected**: 
   - Creates `.aiya.yaml` in current directory
   - No errors if Ollama is not running (warning is acceptable)
   - Success message displayed

## Test Scenario 2: File Search

1. **Setup**: Project with TypeScript files
2. **Run**: `aiya search "*.ts"`
3. **Expected**:
   - Lists all TypeScript files in project
   - Shows relative paths from workspace root
   - Respects security boundaries (only workspace files)

## Test Scenario 3: Content Search

1. **Setup**: Project with code files
2. **Run**: `aiya search --content "import"`
3. **Expected**:
   - Lists files containing "import"
   - Shows context with highlighted matches
   - Respects allowed file extensions

## Test Scenario 4: Chat Session (with Ollama)

**Prerequisites**: Ollama running with qwen2.5:8b model

1. **Setup**: Initialized project
2. **Run**: `aiya chat`
3. **Actions**:
   - Send a simple message
   - Try `/read package.json`
   - Try `/search *.ts`
   - Exit with `exit`
4. **Expected**:
   - Interactive session starts
   - Slash commands work
   - File operations respect security
   - Clean exit

## Test Scenario 5: Configuration Loading

1. **Setup**: Project with custom `.aiya.yaml`
2. **Content**:
   ```yaml
   provider:
     model: "custom-model"
   security:
     allowedExtensions: [".js", ".ts"]
   ```
3. **Run**: Any aiya command
4. **Expected**:
   - Uses custom configuration
   - Respects file extension restrictions

## Test Scenario 6: Security Validation

1. **Setup**: Try to access files outside workspace
2. **Run**: `aiya search "../../../etc/*"`
3. **Expected**:
   - Security error or empty results
   - No access to system files
   - Workspace boundary respected

## Test Scenario 7: Error Handling

1. **Setup**: No Ollama running
2. **Run**: `aiya chat`
3. **Expected**:
   - Clear error message about connection
   - Graceful failure
   - Helpful suggestions

## Manual Testing Checklist

- [ ] `aiya --help` shows usage information
- [ ] `aiya init` creates configuration files
- [ ] `aiya search` finds files and content
- [ ] `aiya chat` starts interactive session (with Ollama)
- [ ] Configuration files are respected
- [ ] Security boundaries are enforced
- [ ] Error messages are helpful
- [ ] All commands exit cleanly