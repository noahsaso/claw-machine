import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import {
  authHeader,
  createMockTask,
  createMockProject,
  resetMocks,
  mockDb,
  mockClaudeTeam,
  mockWebsocket,
} from "../__tests__/setup";
import type { Task, UpdateTaskInput } from "../types";

// Mock the db module
vi.mock("../services/db", () => ({
  getAllTasks: vi.fn((projectId?: string) => mockDb.getAllTasks(projectId)),
  getTaskById: vi.fn((id: string) => mockDb.getTaskById(id)),
  createTask: vi.fn((input: unknown) => mockDb.createTask(input)),
  updateTask: vi.fn((id: string, input: unknown) =>
    mockDb.updateTask(id, input)
  ),
  deleteTask: vi.fn((id: string) => mockDb.deleteTask(id)),
  getProjectPathById: vi.fn((projectId: string) =>
    mockDb.getProjectPathById(projectId)
  ),
}));

// Mock claudeTeam module
vi.mock("../services/claudeTeam", () => ({
  spawnWorker: vi.fn((args: unknown) => mockClaudeTeam.spawnWorker(args)),
  closeWorker: vi.fn((workerId: string) =>
    mockClaudeTeam.closeWorker(workerId)
  ),
  getWorkerLogs: vi.fn((workerId: string) =>
    mockClaudeTeam.getWorkerLogs(workerId)
  ),
}));

// Mock the broadcast function (imported from index.ts)
vi.mock("../index", () => ({
  broadcastTasks: vi.fn(() => mockWebsocket.broadcastTasks()),
}));

// Import after mocking
import { tasks } from "./tasks";

describe("Tasks Routes", () => {
  let app: Hono;

  beforeEach(() => {
    resetMocks();
    app = new Hono();

    // Add auth middleware
    app.use("*", async (c, next) => {
      const authHeader = c.req.header("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return c.json({ error: "Missing authorization" }, 401);
      }
      const token = authHeader.slice(7);
      if (token !== "claw-machine-2026") {
        return c.json({ error: "Invalid password" }, 401);
      }
      return next();
    });

    app.route("/api/tasks", tasks);
  });

  describe("GET /api/tasks", () => {
    it("returns empty array when no tasks exist", async () => {
      mockDb.getAllTasks.mockReturnValue([]);

      const res = await app.request("/api/tasks", {
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual([]);
    });

    it("returns all tasks", async () => {
      const task = createMockTask();
      mockDb.getAllTasks.mockReturnValue([task]);

      const res = await app.request("/api/tasks", {
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe(task.id);
    });

    it("filters tasks by project_id", async () => {
      const task = createMockTask({ projectId: "project-1" });
      mockDb.getAllTasks.mockImplementation((projectId?: string) => {
        if (projectId === "project-1") return [task];
        return [];
      });

      const res = await app.request("/api/tasks?project_id=project-1", {
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(mockDb.getAllTasks).toHaveBeenCalledWith("project-1");
    });

    it("requires authentication", async () => {
      const res = await app.request("/api/tasks");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/tasks/:id", () => {
    it("returns a single task", async () => {
      const task = createMockTask({ id: "task-123" });
      mockDb.getTaskById.mockReturnValue(task);

      const res = await app.request("/api/tasks/task-123", {
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("task-123");
    });

    it("returns 404 when task not found", async () => {
      mockDb.getTaskById.mockReturnValue(null);

      const res = await app.request("/api/tasks/nonexistent", {
        headers: authHeader,
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Task not found");
    });

    it("requires authentication", async () => {
      const res = await app.request("/api/tasks/task-123");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/tasks", () => {
    it("creates a backlog task successfully", async () => {
      const newTask = createMockTask({
        id: "new-task",
        title: "New Task",
        status: "backlog",
      });
      mockDb.createTask.mockReturnValue(newTask);

      const res = await app.request("/api/tasks", {
        method: "POST",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "New Task",
          description: "Description",
          projectId: "project-1",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.title).toBe("New Task");
      expect(body.status).toBe("backlog");
      expect(mockWebsocket.broadcastTasks).toHaveBeenCalled();
    });

    it("creates and spawns worker when status is in_progress", async () => {
      const backlogTask = createMockTask({
        id: "new-task",
        title: "New Task",
        status: "backlog",
      });
      const inProgressTask = createMockTask({
        id: "new-task",
        title: "New Task",
        status: "in_progress",
        assignedWorker: "new-worker-1",
        workerStatus: "running",
      });

      mockDb.createTask.mockReturnValue(backlogTask);
      mockDb.getProjectPathById.mockReturnValue("/path/to/project");
      mockClaudeTeam.spawnWorker.mockResolvedValue({
        success: true,
        workerId: "new-worker-1",
      });
      mockDb.updateTask.mockReturnValue(inProgressTask);

      const res = await app.request("/api/tasks", {
        method: "POST",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "New Task",
          projectId: "project-1",
          status: "in_progress",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.status).toBe("in_progress");
      expect(body.assignedWorker).toBe("new-worker-1");
      expect(mockClaudeTeam.spawnWorker).toHaveBeenCalled();
    });

    it("returns 400 when title is missing", async () => {
      const res = await app.request("/api/tasks", {
        method: "POST",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: "Description",
          projectId: "project-1",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when projectId is missing", async () => {
      const res = await app.request("/api/tasks", {
        method: "POST",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Title",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 when project not found for in_progress task", async () => {
      const backlogTask = createMockTask({
        id: "new-task",
        status: "backlog",
      });
      mockDb.createTask.mockReturnValue(backlogTask);
      mockDb.getProjectPathById.mockReturnValue(null);
      mockDb.deleteTask.mockReturnValue(true);

      const res = await app.request("/api/tasks", {
        method: "POST",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "New Task",
          projectId: "nonexistent-project",
          status: "in_progress",
        }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Project not found");
      // Should clean up the created task
      expect(mockDb.deleteTask).toHaveBeenCalledWith("new-task");
    });

    it("cleans up task on spawn failure", async () => {
      const backlogTask = createMockTask({
        id: "new-task",
        status: "backlog",
      });
      mockDb.createTask.mockReturnValue(backlogTask);
      mockDb.getProjectPathById.mockReturnValue("/path/to/project");
      mockClaudeTeam.spawnWorker.mockResolvedValue({
        success: false,
        error: "Failed to spawn",
      });
      mockDb.deleteTask.mockReturnValue(true);

      const res = await app.request("/api/tasks", {
        method: "POST",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "New Task",
          projectId: "project-1",
          status: "in_progress",
        }),
      });

      expect(res.status).toBe(400);
      expect(mockDb.deleteTask).toHaveBeenCalledWith("new-task");
    });

    it("requires authentication", async () => {
      const res = await app.request("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Task",
          projectId: "project-1",
        }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /api/tasks/:id", () => {
    it("updates task title for backlog task", async () => {
      const existing = createMockTask({ id: "task-1", status: "backlog" });
      const updated = createMockTask({
        id: "task-1",
        status: "backlog",
        title: "Updated Title",
      });
      mockDb.getTaskById.mockReturnValue(existing);
      mockDb.updateTask.mockReturnValue(updated);

      const res = await app.request("/api/tasks/task-1", {
        method: "PATCH",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "Updated Title" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.title).toBe("Updated Title");
      expect(mockWebsocket.broadcastTasks).toHaveBeenCalled();
    });

    it("returns 403 when trying to edit non-backlog task content", async () => {
      const existing = createMockTask({ id: "task-1", status: "in_progress" });
      mockDb.getTaskById.mockReturnValue(existing);

      const res = await app.request("/api/tasks/task-1", {
        method: "PATCH",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "Updated Title" }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("Only backlog tasks can be edited");
    });

    it("allows status changes for in_progress tasks", async () => {
      const existing = createMockTask({
        id: "task-1",
        status: "in_progress",
        assignedWorker: "worker-1",
      });
      const updated = createMockTask({
        id: "task-1",
        status: "done",
        assignedWorker: null,
        workerStatus: "closed",
      });
      mockDb.getTaskById.mockReturnValue(existing);
      mockClaudeTeam.getWorkerLogs.mockResolvedValue([]);
      mockClaudeTeam.closeWorker.mockResolvedValue({ success: true });
      mockDb.updateTask.mockReturnValue(updated);

      const res = await app.request("/api/tasks/task-1", {
        method: "PATCH",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "done" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("done");
    });

    it("spawns worker when moving to in_progress", async () => {
      const existing = createMockTask({ id: "task-1", status: "backlog" });
      const updated = createMockTask({
        id: "task-1",
        status: "in_progress",
        assignedWorker: "new-worker-1",
        workerStatus: "running",
      });
      mockDb.getTaskById.mockReturnValue(existing);
      mockDb.getProjectPathById.mockReturnValue("/path/to/project");
      mockClaudeTeam.spawnWorker.mockResolvedValue({
        success: true,
        workerId: "new-worker-1",
      });
      mockDb.updateTask.mockReturnValue(updated);

      const res = await app.request("/api/tasks/task-1", {
        method: "PATCH",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "in_progress" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("in_progress");
      expect(body.assignedWorker).toBe("new-worker-1");
      expect(mockClaudeTeam.spawnWorker).toHaveBeenCalled();
    });

    it("closes worker and saves context when moving to backlog", async () => {
      const existing = createMockTask({
        id: "task-1",
        status: "in_progress",
        assignedWorker: "worker-1",
      });
      const updated = createMockTask({
        id: "task-1",
        status: "backlog",
        assignedWorker: null,
        workerStatus: null,
      });
      mockDb.getTaskById.mockReturnValue(existing);
      mockClaudeTeam.getWorkerLogs.mockResolvedValue([
        { role: "assistant", content: "Working on task" },
      ]);
      mockClaudeTeam.closeWorker.mockResolvedValue({ success: true });
      mockDb.updateTask.mockReturnValue(updated);

      const res = await app.request("/api/tasks/task-1", {
        method: "PATCH",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "backlog" }),
      });

      expect(res.status).toBe(200);
      expect(mockClaudeTeam.closeWorker).toHaveBeenCalledWith("worker-1");
      expect(mockClaudeTeam.getWorkerLogs).toHaveBeenCalledWith("worker-1");
    });

    it("returns 404 when task not found", async () => {
      mockDb.getTaskById.mockReturnValue(null);

      const res = await app.request("/api/tasks/nonexistent", {
        method: "PATCH",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "Updated" }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Task not found");
    });

    it("returns 400 when validation fails", async () => {
      mockDb.getTaskById.mockReturnValue(createMockTask({ status: "backlog" }));

      const res = await app.request("/api/tasks/task-1", {
        method: "PATCH",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "" }), // Empty title not allowed
      });

      expect(res.status).toBe(400);
    });

    it("returns 409 when worker already starting", async () => {
      const existing = createMockTask({
        id: "task-1",
        status: "backlog",
        workerStatus: "starting",
      });
      mockDb.getTaskById.mockReturnValue(existing);

      const res = await app.request("/api/tasks/task-1", {
        method: "PATCH",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "in_progress" }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe("Worker already starting for this task");
    });

    it("returns 409 when worker already running", async () => {
      const existing = createMockTask({
        id: "task-1",
        status: "backlog",
        assignedWorker: "worker-1",
        workerStatus: "running",
      });
      mockDb.getTaskById.mockReturnValue(existing);

      const res = await app.request("/api/tasks/task-1", {
        method: "PATCH",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "in_progress" }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe("Worker already running for this task");
    });

    it("requires authentication", async () => {
      const res = await app.request("/api/tasks/task-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/tasks/:id/respawn", () => {
    it("respawns worker for in_progress task", async () => {
      const task = createMockTask({
        id: "task-1",
        status: "in_progress",
        assignedWorker: "old-worker",
      });
      mockDb.getTaskById.mockReturnValue(task);
      mockClaudeTeam.getWorkerLogs.mockResolvedValue([]);
      mockClaudeTeam.closeWorker.mockResolvedValue({ success: true });
      mockDb.getProjectPathById.mockReturnValue("/path/to/project");
      mockClaudeTeam.spawnWorker.mockResolvedValue({
        success: true,
        workerId: "new-worker",
      });
      // mockDb.updateTask is called multiple times, return updated task
      mockDb.updateTask.mockImplementation(() => ({
        ...task,
        assignedWorker: "new-worker",
        workerStatus: "running",
      }));

      const res = await app.request("/api/tasks/task-1/respawn", {
        method: "POST",
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.workerId).toBe("new-worker");
      expect(mockClaudeTeam.closeWorker).toHaveBeenCalledWith("old-worker");
      expect(mockClaudeTeam.spawnWorker).toHaveBeenCalled();
      expect(mockWebsocket.broadcastTasks).toHaveBeenCalled();
    });

    it("returns 404 when task not found", async () => {
      mockDb.getTaskById.mockReturnValue(null);

      const res = await app.request("/api/tasks/nonexistent/respawn", {
        method: "POST",
        headers: authHeader,
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Task not found");
    });

    it("returns 400 when task is not in_progress", async () => {
      mockDb.getTaskById.mockReturnValue(
        createMockTask({ id: "task-1", status: "backlog" })
      );

      const res = await app.request("/api/tasks/task-1/respawn", {
        method: "POST",
        headers: authHeader,
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Can only respawn workers for in-progress tasks");
    });

    it("returns 500 when spawn fails", async () => {
      const task = createMockTask({
        id: "task-1",
        status: "in_progress",
        assignedWorker: "old-worker",
      });
      mockDb.getTaskById.mockReturnValue(task);
      mockClaudeTeam.getWorkerLogs.mockResolvedValue([]);
      mockClaudeTeam.closeWorker.mockResolvedValue({ success: true });
      mockDb.getProjectPathById.mockReturnValue("/path/to/project");
      mockClaudeTeam.spawnWorker.mockResolvedValue({
        success: false,
        error: "Spawn failed",
      });
      mockDb.updateTask.mockReturnValue(task);

      const res = await app.request("/api/tasks/task-1/respawn", {
        method: "POST",
        headers: authHeader,
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Failed to spawn worker");
    });

    it("requires authentication", async () => {
      const res = await app.request("/api/tasks/task-1/respawn", {
        method: "POST",
      });
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/tasks/:id", () => {
    it("deletes a task successfully", async () => {
      mockDb.deleteTask.mockReturnValue(true);

      const res = await app.request("/api/tasks/task-1", {
        method: "DELETE",
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mockWebsocket.broadcastTasks).toHaveBeenCalled();
    });

    it("returns 404 when task not found", async () => {
      mockDb.deleteTask.mockReturnValue(false);

      const res = await app.request("/api/tasks/nonexistent", {
        method: "DELETE",
        headers: authHeader,
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Task not found");
    });

    it("requires authentication", async () => {
      const res = await app.request("/api/tasks/task-1", {
        method: "DELETE",
      });
      expect(res.status).toBe(401);
    });
  });
});
