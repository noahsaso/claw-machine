import type { Worker, Task } from "../types";
import { getTaskById, getTaskByWorkerId } from "../services/db";

/**
 * Find a task assigned to a worker by checking id, with some fallbacks.
 */
export function findTaskForWorker(worker: Worker): Task | null {
  return (
    getTaskByWorkerId(worker.id) ||
    getTaskByWorkerId(worker.name) ||
    (worker.currentTask && getTaskById(worker.currentTask)) ||
    null
  );
}
