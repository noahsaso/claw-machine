import { CONTENT_TRUNCATE_LENGTH, CONTEXT_MESSAGE_LIMIT } from "../config";
import type { WorkerLog } from "../types";

/**
 * Format worker logs into a context string for task resumption.
 * Takes the last N messages and formats them as "[role]: content".
 */
export function formatWorkerContext(logs: WorkerLog[]): string | null {
  if (!logs || logs.length === 0) {
    return null;
  }

  return logs
    .slice(-CONTEXT_MESSAGE_LIMIT)
    .map((log) => {
      const content =
        typeof log.content === "string"
          ? log.content.slice(0, CONTENT_TRUNCATE_LENGTH)
          : JSON.stringify(log.content).slice(0, CONTENT_TRUNCATE_LENGTH);
      return `[${log.role}]: ${content}`;
    })
    .join("\n");
}
