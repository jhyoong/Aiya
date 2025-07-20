/**
 * In-session memory service for tool execution preferences
 */
export type ToolPreference = 'allow' | 'reject';

export class ToolMemoryService {
  private preferences: Map<string, ToolPreference> = new Map();

  /**
   * Get stored preference for a tool
   */
  getPreference(toolName: string): ToolPreference | null {
    return this.preferences.get(toolName) || null;
  }

  /**
   * Store preference for a tool
   */
  setPreference(toolName: string, preference: ToolPreference): void {
    this.preferences.set(toolName, preference);
  }

  /**
   * Check if tool has a stored preference
   */
  hasPreference(toolName: string): boolean {
    return this.preferences.has(toolName);
  }

  /**
   * Clear all stored preferences
   */
  clearAll(): void {
    this.preferences.clear();
  }

  /**
   * Clear specific preference for a tool
   */
  clearPreference(toolName: string): void {
    this.preferences.delete(toolName);
  }

  /**
   * Get all stored preferences (for debugging)
   */
  getAllPreferences(): Record<string, ToolPreference> {
    return Object.fromEntries(this.preferences);
  }
}
