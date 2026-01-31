import { listWorkers, getWorkerLogs } from "../claudeTeam";
import { updateTask, getAllTasks } from "../db";
import { enrichWorkersWithTasks } from "../../utils/enrichWorkers";
import { findTaskForWorker } from "../../utils/taskLookup";
import { broadcast, broadcastTasks } from "../websocket";
import { syncState } from "./state";
import { notifyClawForReview } from "../openclaw";

/**
 * Monitor worker status from claude-team MCP and:
 * - Detect idle transitions
 * - Update task status to "reviewing"
 * - Save worker logs
 * - Notify OpenClaw for review
 * - Broadcast worker updates to WebSocket clients
 */
export async function monitorWorkers(): Promise<void> {
  try {
    const workerList = await listWorkers();

    for (const worker of workerList) {
      const wasIdle = syncState.getPreviousStatus(worker.id) === "idle";
      const isNowIdle = worker.isIdle === true;

      if (isNowIdle) {
        worker.status = "idle";

        // If worker just became idle, update task to "reviewing" status and notify Claw
        if (!wasIdle && !syncState.hasNotified(worker.id)) {
          const task = findTaskForWorker(worker);
          if (task && task.status === "in_progress") {
            console.log(
              `Worker ${worker.name} completed - marking task as reviewing`
            );

            // CRITICAL: Fetch and save logs BEFORE notifying OpenClaw
            const workerId = worker.id;
            try {
              const logs = await getWorkerLogs(workerId);
              if (logs && logs.length > 0) {
                console.log(
                  `Saving ${logs.length} log messages for worker ${worker.name}`
                );
                updateTask(task.id, {
                  workerStatus: "reviewing",
                  logs: JSON.stringify(logs),
                });
              } else {
                updateTask(task.id, { workerStatus: "reviewing" });
              }
            } catch (err) {
              console.error(
                `Failed to fetch logs for worker ${worker.name}:`,
                err
              );
              updateTask(task.id, { workerStatus: "reviewing" });
            }

            broadcastTasks();

            console.log(`Worker ${worker.name} - notifying Claw for review`);
            const success = await notifyClawForReview(worker, task);
            if (success) {
              syncState.markNotified(worker.id);
            } else {
              console.error(
                `Failed to notify Claw for review for worker ${worker.name}`
              );
            }
          }
        }
      } else {
        // Worker is busy again, clear notification flag
        syncState.clearNotified(worker.id);
      }

      // Track current status for next poll
      syncState.setPreviousStatus(worker.id, worker.status);
      syncState.setPreviousStatus(worker.name, worker.status);
    }

    // Enrich workers with task info before broadcast
    const allTasks = getAllTasks();
    const enrichedWorkers = enrichWorkersWithTasks(workerList, allTasks);

    // Only broadcast if state changed
    const currentState = JSON.stringify(enrichedWorkers);
    if (currentState !== syncState.getLastWorkerState()) {
      syncState.setLastWorkerState(currentState);
      broadcast({
        type: "workers_update",
        workers: enrichedWorkers,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.debug(
      "Worker monitoring failed (MCP server may be offline):",
      error
    );
  }
}
