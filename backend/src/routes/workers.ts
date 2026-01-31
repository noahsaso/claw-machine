import { Hono } from "hono";
import { listWorkers, closeWorker } from "../services/claudeTeam";
import { getAllTasks, getTaskByWorkerId } from "../services/db";
import { respawnTaskWorker } from "../services/taskOperations";
import { enrichWorkersWithTasks } from "../utils/enrichWorkers";
import { broadcastTasks } from "../index";

const workers = new Hono();

// GET /api/workers - List all workers
workers.get("/", async (c) => {
  const allWorkers = await listWorkers();
  const allTasks = getAllTasks();
  const enrichedWorkers = enrichWorkersWithTasks(allWorkers, allTasks);
  return c.json(enrichedWorkers);
});

// POST /api/workers/:id/close - Close a worker
workers.post("/:id/close", async (c) => {
  const workerId = c.req.param("id");

  // Find the task associated with this worker
  const task = getTaskByWorkerId(workerId);
  
  // If task is in_progress, respawn the worker instead of just closing
  if (task && task.status === "in_progress") {
    const result = await respawnTaskWorker(task.id);
    broadcastTasks();

    if (!result.success) {
      return c.json({ error: result.error || "Failed to respawn worker" }, 500);
    }

    return c.json({
      success: true,
      respawned: true,
      newWorkerId: result.workerId,
      taskId: task.id,
    });
  }

  // Otherwise just close the worker
  const result = await closeWorker(workerId);

  if (!result.success) {
    return c.json({ error: result.error || "Failed to close worker" }, 500);
  }

  return c.json({ success: true });
});

export { workers };
