import {
  getTaskById,
  updateTask,
  getProjectPathById,
} from "./db";
import {
  closeWorker,
  spawnWorker,
  getWorkerLogs,
} from "./claudeTeam";
import { formatWorkerContext } from "../utils/workerContext";
import { buildWorkerPrompt } from "../utils/promptBuilder";
import type { UpdateTaskInput, Task, TaskStatus } from "../types";

export type RespawnResult =
  | { success: true; workerId: string; taskId: string }
  | { success: false; error: string };

export type StatusChangeResult =
  | { ok: true; updates: UpdateTaskInput }
  | { ok: false; error: string; status: 400 | 404 | 409 };

/**
 * Handle task status transitions. Spawns/closes workers as needed.
 * Called on both task creation and task update.
 */
export async function handleStatusChange(
  task: Task,
  oldStatus: TaskStatus | null,
  newStatus: TaskStatus
): Promise<StatusChangeResult> {
  const updates: UpdateTaskInput = {};

  // No transition needed
  if (oldStatus === newStatus) {
    return { ok: true, updates };
  }

  // Moving TO in_progress → spawn worker
  if (newStatus === "in_progress") {
    // Prevent double-spawn: check if already starting or has a worker
    if (task.workerStatus === "starting") {
      return {
        ok: false,
        error: "Worker already starting for this task",
        status: 409,
      };
    }
    if (task.assignedWorker && task.workerStatus === "running") {
      return {
        ok: false,
        error: "Worker already running for this task",
        status: 409,
      };
    }

    // Set startedAt timestamp
    updates.startedAt = new Date().toISOString();

    // Immediately mark as starting (before async spawn)
    updateTask(task.id, { workerStatus: "starting" });

    const prompt = buildWorkerPrompt(task);
    const projectPath = getProjectPathById(task.projectId);
    if (!projectPath) {
      return { ok: false, error: "Project not found", status: 404 };
    }

    try {
      const result = await spawnWorker({
        taskId: task.id,
        prompt,
        projectPath,
      });
      if (result.success && result.workerId) {
        updates.assignedWorker = result.workerId;
        updates.workerStatus = "running";
      } else if (!result.success) {
        throw new Error(
          result.error || "Failed to spawn worker for unknown reason"
        );
      }
    } catch (err) {
      console.error("Failed to spawn worker:", err);
      // Immediately undo starting status if worker spawning fails
      updateTask(task.id, { workerStatus: null });
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to spawn worker for unknown reason",
        status: 400,
      };
    }
  }

  // Moving FROM in_progress to backlog → close worker, save context
  if (oldStatus === "in_progress" && newStatus === "backlog") {
    if (task.assignedWorker) {
      try {
        const logs = await getWorkerLogs(task.assignedWorker);
        const context = formatWorkerContext(logs);
        if (context) {
          updates.workerContext = context;
        }
        await closeWorker(task.assignedWorker);
      } catch (err) {
        console.error("Failed to close worker:", err);
      }
    }
    updates.assignedWorker = null;
    updates.workerStatus = null;
  }

  // Moving to done → save logs, close worker
  if (newStatus === "done") {
    updates.completedAt = new Date().toISOString();

    if (task.assignedWorker) {
      const hasExistingLogs =
        task.logs && task.logs !== "null" && task.logs !== "[]";
      if (!hasExistingLogs) {
        try {
          const logs = await getWorkerLogs(task.assignedWorker);
          if (logs && logs.length > 0) {
            updates.logs = JSON.stringify(logs);
            console.log(
              `Saved ${logs.length} log messages for task ${task.id} (on done transition)`
            );
          }
        } catch (err) {
          console.error("Failed to fetch worker logs:", err);
        }
      } else {
        console.log(`Logs already saved for task ${task.id}, skipping fetch`);
      }

      try {
        await closeWorker(task.assignedWorker);
      } catch (err) {
        console.error("Failed to close worker:", err);
      }
    }
    updates.assignedWorker = null;
    updates.workerStatus = "closed";
    updates.workerContext = null;
  }

  return { ok: true, updates };
}

/**
 * Respawn a worker for an in-progress task.
 * Saves context from current worker, closes it, and spawns a new one.
 */
export async function respawnTaskWorker(taskId: string): Promise<RespawnResult> {
  const task = getTaskById(taskId);
  if (!task) {
    return { success: false, error: "Task not found" };
  }

  if (task.status !== "in_progress") {
    return { success: false, error: "Can only respawn workers for in-progress tasks" };
  }

  const updates: UpdateTaskInput = {};

  // Step 1: Save current worker context if there's an existing worker
  if (task.assignedWorker) {
    try {
      const logs = await getWorkerLogs(task.assignedWorker);
      const context = formatWorkerContext(logs);
      if (context) {
        updates.workerContext = context;
        console.log(`Saved context from worker ${task.assignedWorker} before respawn`);
      }
    } catch (err) {
      console.error("Failed to fetch worker logs for context:", err);
    }

    // Step 2: Close the current worker and update status
    try {
      await closeWorker(task.assignedWorker);
      console.log(`Closed worker ${task.assignedWorker} for respawn`);
    } catch (err) {
      console.error("Failed to close worker:", err);
    }

    // Mark worker as closed before attempting respawn
    updates.workerStatus = "closed";
    updates.assignedWorker = null;
  }

  // Apply updates (context + closed status) before spawning new worker
  if (Object.keys(updates).length > 0) {
    updateTask(taskId, updates);
  }

  // Refetch task to get updated context
  const updatedTask = getTaskById(taskId);
  if (!updatedTask) {
    return { success: false, error: "Task not found" };
  }

  // Step 3: Spawn a new worker
  updateTask(taskId, { workerStatus: "starting" });

  const prompt = buildWorkerPrompt(updatedTask);
  const projectPath = getProjectPathById(updatedTask.projectId);
  if (!projectPath) {
    updateTask(taskId, { workerStatus: "closed", assignedWorker: null });
    return { success: false, error: "Project not found" };
  }

  try {
    const result = await spawnWorker({
      taskId,
      prompt,
      projectPath,
    });

    if (result.success && result.workerId) {
      updateTask(taskId, {
        assignedWorker: result.workerId,
        workerStatus: "running",
      });

      return {
        success: true,
        workerId: result.workerId,
        taskId,
      };
    } else {
      updateTask(taskId, { workerStatus: "closed", assignedWorker: null });
      return { success: false, error: "Failed to spawn worker" };
    }
  } catch (err) {
    console.error("Failed to spawn worker:", err);
    updateTask(taskId, { workerStatus: "closed", assignedWorker: null });
    return { success: false, error: "Failed to spawn worker" };
  }
}
