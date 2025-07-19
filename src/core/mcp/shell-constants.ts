/**
 * Shell command constants for approval requirements
 */

/**
 * Commands that require user approval before execution
 * Based on first word matching (e.g., "rm -rf file" matches "rm")
 */
export const COMMANDS_REQUIRING_APPROVAL = [
  // File system operations (destructive)
  'rm',
  'rmdir',
  'mv',
  'cp',
  'chmod',
  'chown',
  'dd',

  // System administration
  'sudo',
  'su',
  'passwd',
  'usermod',
  'groupmod',
  'mount',
  'umount',

  // Network operations
  'curl',
  'wget',
  'ssh',
  'scp',
  'rsync',

  // Package management
  'apt',
  'apt-get',
  'yum',
  'dnf',
  'brew',
  'npm',
  'yarn',
  'pip',
  'pip3',

  // Process management
  'kill',
  'killall',
  'pkill',

  // Git operations (potentially destructive)
  'git',

  // System control
  'systemctl',
  'service',
  'crontab',

  // Archive operations
  'tar',
  'zip',
  'unzip',
] as const;

/**
 * Extract the command name from a shell command string
 */
export function extractCommandName(command: string): string {
  return command.trim().split(/\s+/)[0] || '';
}

/**
 * Check if a command requires approval
 */
export function requiresApproval(command: string): boolean {
  const commandName = extractCommandName(command);
  return COMMANDS_REQUIRING_APPROVAL.includes(commandName as any);
}
