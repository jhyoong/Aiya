import * as crypto from 'crypto';

export interface FileSnapshot {
  path: string;
  content: string;
  hash: string;
  timestamp: Date;
}

export interface Change {
  tool: string;
  params: Record<string, unknown>;
  timestamp: Date;
  reversible: boolean;
  reverseOperation?: () => Promise<void>;
}

export class FileSystemState {
  private fileSnapshots: Map<string, FileSnapshot> = new Map();
  private pendingChanges: Change[] = [];

  async trackChange(change: Change): Promise<void> {
    this.pendingChanges.push(change);
  }

  async rollbackTo(timestamp: Date): Promise<void> {
    // Filter changes to those after the target timestamp
    const changesToRevert = this.pendingChanges.filter(
      change => change.timestamp > timestamp && change.reversible
    );

    // Execute reverse operations in reverse chronological order
    for (let i = changesToRevert.length - 1; i >= 0; i--) {
      const change = changesToRevert[i];
      if (change && change.reverseOperation) {
        await change.reverseOperation();
      }
    }

    // Remove reverted changes from the pending list
    this.pendingChanges = this.pendingChanges.filter(
      change => change.timestamp <= timestamp
    );
  }

  async getDiff(): Promise<string> {
    const diffLines: string[] = [];

    for (const change of this.pendingChanges) {
      diffLines.push(
        `[${change.timestamp.toISOString()}] ${change.tool}: ${JSON.stringify(change.params)}`
      );
    }

    return diffLines.join('\n');
  }

  async createSnapshot(path: string, content: string): Promise<FileSnapshot> {
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const snapshot: FileSnapshot = {
      path,
      content,
      hash,
      timestamp: new Date(),
    };

    this.fileSnapshots.set(path, snapshot);
    return snapshot;
  }

  async getSnapshot(path: string): Promise<FileSnapshot | undefined> {
    return this.fileSnapshots.get(path);
  }

  // Additional utility methods
  clearPendingChanges(): void {
    this.pendingChanges = [];
  }

  getPendingChanges(): readonly Change[] {
    return [...this.pendingChanges];
  }

  hasSnapshot(path: string): boolean {
    return this.fileSnapshots.has(path);
  }

  removeSnapshot(path: string): boolean {
    return this.fileSnapshots.delete(path);
  }

  getSnapshotCount(): number {
    return this.fileSnapshots.size;
  }

  getPendingChangeCount(): number {
    return this.pendingChanges.length;
  }
}
