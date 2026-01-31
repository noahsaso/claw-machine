/**
 * SyncState encapsulates all mutable state used by the worker monitor and log streamer.
 * This provides clear ownership, easier testing, and prevents scattered global variables.
 */
export class SyncState {
  // Last serialized worker state for change detection
  private lastWorkerState: string = "";

  // Track previous status per worker for detecting idle transitions
  private previousWorkerStatuses = new Map<string, string>();

  // Workers we've already notified OpenClaw about (prevents duplicate notifications)
  private notifiedWorkers = new Set<string>();

  // Last log count per worker for incremental log streaming
  private lastLogCounts = new Map<string, number>();

  // --- Worker state methods ---

  getLastWorkerState(): string {
    return this.lastWorkerState;
  }

  setLastWorkerState(state: string): void {
    this.lastWorkerState = state;
  }

  // --- Previous worker status methods ---

  getPreviousStatus(workerId: string): string | undefined {
    return this.previousWorkerStatuses.get(workerId);
  }

  setPreviousStatus(workerId: string, status: string): void {
    this.previousWorkerStatuses.set(workerId, status);
  }

  // --- Notification tracking methods ---

  hasNotified(workerId: string): boolean {
    return this.notifiedWorkers.has(workerId);
  }

  markNotified(workerId: string): void {
    this.notifiedWorkers.add(workerId);
  }

  clearNotified(workerId: string): void {
    this.notifiedWorkers.delete(workerId);
  }

  // --- Log count methods ---

  getLastLogCount(workerId: string): number {
    return this.lastLogCounts.get(workerId) || 0;
  }

  setLastLogCount(workerId: string, count: number): void {
    this.lastLogCounts.set(workerId, count);
  }
}

// Singleton instance
export const syncState = new SyncState();
