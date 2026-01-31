import { listWorkers, getWorkerLogs } from "../claudeTeam";
import { updateTask } from "../db";
import { findTaskForWorker } from "../../utils/taskLookup";
import { broadcastTasks } from "../websocket";
import { syncState } from "./state";

/**
 * Stream worker logs for active workers and update task logs.
 * Only fetches logs for workers that are running or idle.
 */
export async function streamLogs(): Promise<void> {
  try {
    const workerList = await listWorkers();

    // Only stream logs for active workers
    const activeWorkers = workerList.filter(
      (w) => w.status === "busy" || w.status === "active" || w.status === "idle"
    );

    let tasksUpdated = false;

    for (const worker of activeWorkers) {
      const workerId = worker.id;

      try {
        const logs = await getWorkerLogs(workerId);
        const lastCount = syncState.getLastLogCount(workerId);

        // Only update if there are new messages
        if (logs.length > lastCount) {
          syncState.setLastLogCount(workerId, logs.length);

          const task = findTaskForWorker(worker);
          if (task) {
            updateTask(task.id, { logs: JSON.stringify(logs) });
            tasksUpdated = true;
          }
        }
      } catch (error) {
        console.debug(`Failed to fetch logs for worker ${workerId}:`, error);
      }
    }

    if (tasksUpdated) {
      broadcastTasks();
    }
  } catch (error) {
    console.debug("Log streaming failed:", error);
  }
}
