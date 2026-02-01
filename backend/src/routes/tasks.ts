import { Hono } from "hono";
import { ZodError } from "zod";
import {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
} from "../services/db";
import {
  handleStatusChange,
  respawnTaskWorker,
} from "../services/taskOperations";
import { CreateTaskSchema, UpdateTaskSchema } from "../schemas";
import { broadcastTasks } from "../index";

const tasks = new Hono();

// GET /api/tasks - List all tasks (optionally filter by project)
tasks.get("/", (c) => {
  const projectId = c.req.query("project_id");
  const allTasks = getAllTasks(projectId || undefined);
  return c.json(allTasks);
});

// GET /api/tasks/:id - Get single task
tasks.get("/:id", (c) => {
  const id = c.req.param("id");
  const task = getTaskById(id);
  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }
  return c.json(task);
});

// POST /api/tasks - Create task
tasks.post("/", async (c) => {
  let body;
  try {
    const rawBody = await c.req.json();
    body = CreateTaskSchema.parse(rawBody);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstError = error.issues[0];
      return c.json({ error: firstError.message }, 400);
    }
    return c.json({ error: "Invalid request body" }, 400);
  }

  // Create the task first (defaults to backlog if no status provided)
  let task = createTask({
    title: body.title,
    description: body.description,
    status: "backlog", // Always create as backlog first
    projectId: body.projectId,
  });

  // If requested status is not backlog, handle the transition
  const requestedStatus = body.status || "backlog";
  if (requestedStatus !== "backlog") {
    const result = await handleStatusChange(task, "backlog", requestedStatus);
    if (!result.ok) {
      // Clean up the created task on failure
      deleteTask(task.id);
      return c.json({ error: result.error }, result.status);
    }

    // Apply status transition updates
    const updatedTask = updateTask(task.id, {
      status: requestedStatus,
      ...result.updates,
    });
    if (!updatedTask) {
      return c.json({ error: "Failed to update task" }, 500);
    }

    task = updatedTask;
  }

  broadcastTasks();
  return c.json(task, 201);
});

// PATCH /api/tasks/:id - Update task
tasks.patch("/:id", async (c) => {
  const id = c.req.param("id");

  let body;
  try {
    const rawBody = await c.req.json();
    body = UpdateTaskSchema.parse(rawBody);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstError = error.issues[0];
      return c.json({ error: firstError.message }, 400);
    }
    return c.json({ error: "Invalid request body" }, 400);
  }

  const existingTask = getTaskById(id);
  if (!existingTask) {
    return c.json({ error: "Task not found" }, 404);
  }

  // Only allow editing title/description for backlog tasks
  const isContentEdit =
    body.title !== undefined || body.description !== undefined;
  if (isContentEdit && existingTask.status !== "backlog") {
    return c.json({ error: "Only backlog tasks can be edited" }, 403);
  }

  const oldStatus = existingTask.status;
  const newStatus = body.status;

  // Handle status transitions
  if (newStatus && newStatus !== oldStatus) {
    const result = await handleStatusChange(existingTask, oldStatus, newStatus);
    if (!result.ok) {
      return c.json({ error: result.error }, result.status);
    }
    // Merge status transition updates into body
    Object.assign(body, result.updates);
  }

  const task = updateTask(id, body);

  broadcastTasks();
  return c.json(task);
});

// POST /api/tasks/:id/respawn - Respawn worker for an in-progress task
tasks.post("/:id/respawn", async (c) => {
  const id = c.req.param("id");

  const result = await respawnTaskWorker(id);

  broadcastTasks();

  if (!result.success) {
    const status =
      result.error === "Task not found"
        ? 404
        : result.error === "Can only respawn workers for in-progress tasks"
        ? 400
        : 500;
    return c.json({ error: result.error }, status);
  }

  return c.json(result);
});

// DELETE /api/tasks/:id - Delete task
tasks.delete("/:id", (c) => {
  const id = c.req.param("id");
  const deleted = deleteTask(id);

  if (!deleted) {
    return c.json({ error: "Task not found" }, 404);
  }

  broadcastTasks();
  return c.json({ success: true });
});

export { tasks };
