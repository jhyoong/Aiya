# Shell Tool Documentation

## Overview

The Shell Tool provides secure command execution capabilities within the Aiya system. It implements a sophisticated security architecture with command categorization, user confirmation prompts, and comprehensive audit logging to ensure safe interaction with the shell environment.

## Architecture

### Core Components

The Shell Tool is built on a modular architecture that replaces the previous monolithic implementation:

```
src/core/mcp/shell/
├── constants.ts                    # All configuration constants
├── types.ts                       # TypeScript interfaces and types
├── index.ts                       # Barrel exports
├── shell-mcp-client.ts            # Main client implementation
├── command-categorization.ts      # Pattern-based command categorization
├── security/
│   ├── dangerous-command-detector.ts
│   ├── command-sanitizer.ts
│   ├── workspace-boundary-enforcer.ts
│   └── command-filter.ts
├── monitoring/
│   ├── performance-monitor.ts
│   └── execution-logger.ts
└── errors/
    ├── base-errors.ts
    ├── security-errors.ts
    └── execution-errors.ts
```

### Main Shell Client

**Location**: `src/core/mcp/shell/shell-mcp-client.ts`

The `ShellMCPClient` extends the base `MCPClient` and provides the `ExecuteCommand` tool with comprehensive security measures.

**Tool Interface**:
```typescript
{
  name: "execute_command";
  description: "Execute shell commands safely within workspace boundaries";
  inputSchema: {
    type: "object";
    properties: {
      command: { type: "string", description: "The shell command to execute" };
      cwd?: { type: "string", description: "Working directory (defaults to workspace root)" };
      timeout?: { type: "number", description: "Timeout in seconds (default: 30)" };
    };
    required: ["command"];
  };
}
```

## Command Security System

### Command Categorization

The system uses pattern-based categorization instead of complex risk scoring:

```typescript
enum CommandCategory {
  SAFE = 'safe',        // Execute without confirmation
  RISKY = 'risky',      // Require confirmation
  DANGEROUS = 'dangerous', // Require confirmation with warning
  BLOCKED = 'blocked'   // Never allow execution
}
```

### Command Categories

**SAFE Commands** - Execute immediately without confirmation:
- `ls`, `pwd`, `echo`, `cat`, `head`, `tail`
- `git status`, `git log`, `git diff`
- Read-only operations that don't modify the system

**RISKY Commands** - Require user confirmation:
- `npm install`, `yarn install`, `pip install`
- `mkdir`, `rmdir`, `mv`, `cp`
- `git push`, `git pull`, `git merge`
- Commands that modify files or state

**DANGEROUS Commands** - Require confirmation with explicit warning:
- `rm -rf`, `sudo` commands, `chmod 777`
- `systemctl`, `service`, system control commands
- `dd`, `format`, disk operations
- Commands that can cause significant system damage

**BLOCKED Commands** - Never allowed regardless of confirmation:
- `rm -rf /`, `rm -rf /*` (system destruction)
- `:(){ :|: & };:` (fork bombs)
- `shutdown`, `reboot`, `halt`, `poweroff`
- `dd if=/dev/zero` (disk wiping)

### Decision Logic

Commands are categorized using this hierarchy:

1. **Check blocked patterns first** → Auto-block execution
2. **Check dangerous patterns** → Require confirmation with warning
3. **Check safe patterns** → Allow immediate execution
4. **Default to risky** → Require standard confirmation for unknown commands

## Security Features

### Workspace Boundary Enforcement

**Location**: `src/core/mcp/shell/security/workspace-boundary-enforcer.ts`

All command execution is restricted to the project workspace:

- **Working Directory Validation**: Ensures `cwd` is within workspace
- **Path Traversal Prevention**: Blocks `../` and absolute path attacks
- **Symbolic Link Protection**: Validates symlink targets
- **Command Analysis**: Scans commands for path references

### Command Sanitization

**Location**: `src/core/mcp/shell/security/command-sanitizer.ts`

Input sanitization and validation:

- **Shell Expansion Prevention**: Blocks dangerous expansions like `$(command)`
- **Special Character Filtering**: Sanitizes potentially dangerous characters
- **Command Injection Prevention**: Validates command structure
- **Input Length Limits**: Enforces maximum command length

### Dangerous Command Detection

**Location**: `src/core/mcp/shell/security/dangerous-command-detector.ts`

Pattern-based detection of dangerous operations:

- **System Destruction Patterns**: `rm -rf /`, `format`, etc.
- **Network Access Patterns**: `curl`, `wget`, `ssh`
- **Privilege Escalation**: `sudo`, `su`, `chmod +s`
- **Process Manipulation**: `kill -9`, `killall`

### Command Filtering

**Location**: `src/core/mcp/shell/security/command-filter.ts`

Configuration-based command filtering:

- **Category-based Filtering**: Allow/block based on command category
- **Pattern Whitelist/Blacklist**: Custom allowed/blocked patterns
- **Trusted Command Bypass**: Commands that always bypass confirmation
- **Always Block Patterns**: Commands that are never allowed

## User Confirmation System

### Confirmation Prompts

When risky or dangerous commands are detected, the system presents interactive prompts:

**Prompt Options**:
- **Allow**: Execute the command once
- **Deny**: Block the command execution
- **Trust**: Add command pattern to trusted list (bypass future confirmations)
- **Block**: Add command pattern to blocked list (never allow)

**Session Memory**: 
- Decisions are cached for 30 minutes to avoid repeated prompts
- Memory can be disabled via configuration
- Cached decisions expire automatically

### Confirmation Interface

```typescript
interface ConfirmationResponse {
  action: 'allow' | 'deny' | 'trust' | 'block';
  remember?: boolean;
  reason?: string;
}
```

## Configuration

### Shell Tool Configuration

```typescript
interface ShellToolConfig {
  // Category-based confirmation settings
  requireConfirmationForRisky: boolean;     // Default: true
  requireConfirmationForDangerous: boolean; // Default: true
  allowDangerous: boolean;                  // Default: false
  
  // Execution settings
  maxExecutionTime: number;                 // Default: 30 seconds
  confirmationTimeout: number;              // Default: 30000ms (30 seconds)
  
  // Session and trust settings
  sessionMemory: boolean;                   // Default: true
  trustedCommands: string[];                // Custom trusted patterns
  alwaysBlockPatterns: string[];            // Custom blocked patterns
  
  // Advanced settings
  allowComplexCommands: boolean;            // Default: false
  workspaceOnly: boolean;                   // Default: true
}
```

### Default Configuration

```typescript
const DEFAULT_SHELL_CONFIG = {
  requireConfirmationForRisky: true,
  requireConfirmationForDangerous: true,
  allowDangerous: false,
  maxExecutionTime: 30,
  confirmationTimeout: 30000,
  sessionMemory: true,
  allowComplexCommands: false,
  trustedCommands: [
    '^ls($|\\s)', '^pwd($|\\s)', '^echo($|\\s)',
    '^git status($|\\s)', '^npm test($|\\s)'
  ]
};
```

## Execution and Response

### Command Execution Flow

1. **Input Validation**: Validate command parameters and structure
2. **Security Analysis**: Categorize command and check security policies
3. **Confirmation Process**: Present user prompts if required
4. **Workspace Validation**: Ensure execution within workspace boundaries
5. **Command Execution**: Execute with timeout and monitoring
6. **Result Processing**: Format output and log execution details

### Response Structure

```typescript
interface ShellExecuteResult {
  success: boolean;           // Whether command executed successfully
  stdout: string;            // Standard output from command
  stderr: string;            // Standard error from command
  exitCode: number;          // Process exit code
  executionTime: number;     // Execution time in milliseconds
}
```

### Error Handling

The shell tool provides comprehensive error handling with specific error types:

**Error Categories**:
- `EXECUTION_ERROR`: General command execution failures
- `SECURITY_ERROR`: Security policy violations
- `PERMISSION_ERROR`: File system permission issues
- `TIMEOUT_ERROR`: Command execution timeouts
- `COMMAND_NOT_FOUND`: Invalid or missing commands
- `WORKSPACE_VIOLATION`: Attempts to operate outside workspace
- `COMMAND_BLOCKED`: Blocked command patterns
- `DANGEROUS_COMMAND`: Dangerous command without confirmation

**Error Context**: All errors include comprehensive context information:
```typescript
interface ShellErrorContext {
  command: string;
  workingDirectory: string;
  timeout?: number;
  exitCode?: number;
  executionTime?: number;
  securityEvent?: string;
  timestamp: Date;
  sessionId?: string;
}
```

## Monitoring and Logging

### Performance Monitoring

**Location**: `src/core/mcp/shell/monitoring/performance-monitor.ts`

Tracks execution performance and resource usage:

- **Execution Time Tracking**: Monitor command execution duration
- **Memory Usage Monitoring**: Track memory consumption
- **Performance Metrics**: Collect statistics on command performance
- **Resource Limits**: Enforce memory and CPU limits

### Execution Logging

**Location**: `src/core/mcp/shell/monitoring/execution-logger.ts`

Comprehensive audit logging of all shell operations:

```typescript
interface ShellExecutionLog {
  timestamp: Date;
  command: string;
  cwd: string;
  exitCode: number;
  executionTime: number;
  success: boolean;
  categoryAssessment: CommandCategorization;
  securityEvents: string[];
  sessionId: string;
  userId?: string;
}
```

**Export Formats**:
- **JSON**: Machine-readable format for analysis
- **CSV**: Spreadsheet-compatible format
- **HTML**: Human-readable format with syntax highlighting
- **TEXT**: Plain text format for logs

### Security Event Logging

Security-relevant events are logged separately:

```typescript
interface ShellSecurityEvent {
  id: string;
  timestamp: Date;
  eventType: 'BLOCKED_COMMAND' | 'CONFIRMATION_REQUIRED' | 'POLICY_VIOLATION';
  description: string;
  command: string;
  category: CommandCategory;
  userId?: string;
  sessionId: string;
  resolution: 'ALLOWED' | 'BLOCKED' | 'TIMEOUT';
}
```

## Usage Examples

### Safe Commands (Auto-approved)

```bash
# Directory operations
ls -la
pwd
echo "Hello World"

# Git operations (read-only)
git status
git log --oneline
git diff

# File viewing
cat package.json
head -n 10 README.md
tail -f logs/app.log
```

### Risky Commands (Require confirmation)

```bash
# Package management
npm install express
yarn add react
pip install requests

# File operations
mkdir new-directory
cp file.txt backup.txt
mv old-name.txt new-name.txt

# Git operations (modifying)
git push origin main
git pull origin main
git merge feature-branch
```

### Dangerous Commands (Require explicit confirmation)

```bash
# Potentially destructive operations
rm -rf node_modules
chmod 777 sensitive-file.txt
sudo apt install package

# System operations
systemctl restart service
service nginx reload
```

### Blocked Commands (Never allowed)

```bash
# System destruction (automatically blocked)
rm -rf /
rm -rf /*
format C:

# Fork bombs (automatically blocked)
:(){ :|: & };:

# System shutdown (automatically blocked)
shutdown now
reboot
halt
```

## Best Practices

### For Users

1. **Review Prompts Carefully**: Always read confirmation prompts before approving
2. **Use Trusted Commands**: Build a list of commonly used safe commands
3. **Avoid Broad Permissions**: Don't set overly permissive configurations
4. **Monitor Logs**: Regularly review execution logs for suspicious activity
5. **Workspace Awareness**: Keep commands within the project workspace

### For Developers

1. **Pattern Management**: Regularly review and update command patterns
2. **Security Policies**: Implement appropriate security policies for your environment
3. **Logging Analysis**: Use logs to identify and improve security policies
4. **Error Handling**: Implement proper error handling for shell operations
5. **Testing**: Test shell operations in safe environments before production

### Security Considerations

1. **Principle of Least Privilege**: Only allow necessary commands
2. **Defense in Depth**: Multiple layers of security validation
3. **Audit Everything**: Comprehensive logging of all operations
4. **Regular Updates**: Keep security patterns updated with new threats
5. **User Education**: Train users on safe shell operation practices

## Integration

### MCP Protocol Integration

The Shell Tool integrates with the Model Context Protocol (MCP) system:

- **Tool Registration**: Automatically registered with MCP tool service
- **Standardized Interface**: Follows MCP tool specification
- **Error Propagation**: MCP-compatible error handling
- **Result Formatting**: Consistent with MCP response format

### AI Provider Integration

Available to all AI providers through the standardized tool interface:

1. **Tool Discovery**: AI can discover shell capabilities through tool listing
2. **Parameter Validation**: Automatic validation of tool parameters
3. **Security Integration**: Transparent security enforcement
4. **Result Processing**: Formatted results for AI consumption

## Migration and Compatibility

### Configuration Migration

For users migrating from the old risk-based system:

```typescript
// Old configuration (deprecated)
interface OldShellConfig {
  confirmationThreshold: number; // 0-100 risk score
}

// New configuration (current)
interface ShellToolConfig {
  requireConfirmationForRisky: boolean;
  requireConfirmationForDangerous: boolean;
  allowDangerous: boolean;
}
```

Migration helper automatically converts old configurations to the new format.

### API Compatibility

The public API remains backward compatible:

- **Tool Interface**: Same parameter structure
- **Response Format**: Same response structure
- **Error Types**: Consistent error handling
- **Configuration**: Graceful migration of old configurations

## Troubleshooting

### Common Issues

**Command Blocked Unexpectedly**:
- Check command against dangerous patterns
- Review current security configuration
- Add to trusted commands if safe

**Confirmation Prompts Not Appearing**:
- Verify confirmation system is enabled
- Check session memory settings
- Ensure proper UI integration

**Workspace Violations**:
- Verify working directory is within workspace
- Check for absolute paths in commands
- Review path traversal attempts

**Performance Issues**:
- Check execution timeouts
- Review command complexity
- Monitor resource usage

### Debugging

**Enable Debug Logging**:
```typescript
const config = {
  debug: true,
  logLevel: 'DEBUG'
};
```

**Review Security Events**:
Check security event logs for blocked commands and policy violations.

**Performance Analysis**:
Use performance monitoring data to identify slow or resource-intensive commands.

## Future Enhancements

### Planned Features

1. **Machine Learning Integration**: ML-based command risk assessment
2. **Advanced Pattern Matching**: More sophisticated pattern recognition
3. **Command Suggestions**: AI-powered command suggestions and corrections
4. **Collaborative Security**: Shared security policies across teams
5. **Integration APIs**: Enhanced integration with external security tools

### Extension Points

The modular architecture supports easy extension:

1. **Custom Security Modules**: Add custom security validation
2. **New Command Categories**: Extend categorization system
3. **Additional Monitoring**: Add custom performance monitoring
4. **Export Formats**: Add new log export formats
5. **Configuration Sources**: Support additional configuration sources