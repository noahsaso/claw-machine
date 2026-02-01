import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import {
  authHeader,
  createMockTask,
  createMockWorker,
  resetMocks,
  mockDb,
  mockClaudeTeam,
  mockWebsocket,
} from "../__tests__/setup";

// Mock the db module
vi.mock("../services/db", () => ({
  getAllTasks: vi.fn(() => mockDb.getAllTasks()),
  getTaskById: vi.fn((id: string) => mockDb.getTaskById(id)),
  getTaskByWorkerId: vi.fn((workerId: string) =>
    mockDb.getTaskByWorkerId(workerId)
  ),
  updateTask: vi.fn((id: string, input: unknown) =>
    mockDb.updateTask(id, input)
  ),
  getProjectPathById: vi.fn((projectId: string) =>
    mockDb.getProjectPathById(projectId)
  ),
}));

// Mock claudeTeam module
vi.mock("../services/claudeTeam", () => ({
  listWorkers: vi.fn(() => mockClaudeTeam.listWorkers()),
  closeWorker: vi.fn((workerId: string) =>
    mockClaudeTeam.closeWorker(workerId)
  ),
  spawnWorker: vi.fn((args: unknown) => mockClaudeTeam.spawnWorker(args)),
  getWorkerLogs: vi.fn((workerId: string) =>
    mockClaudeTeam.getWorkerLogs(workerId)
  ),
}));

// Mock the broadcast function
vi.mock("../index", () => ({
  broadcastTasks: vi.fn(() => mockWebsocket.broadcastTasks()),
}));

// Import after mocking
import { workers } from "./workers";

describe("Workers Routes", () => {
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

    app.route("/api/workers", workers);
  });

  describe("GET /api/workers", () => {
    it("returns empty array when no workers exist", async () => {
      mockClaudeTeam.listWorkers.mockResolvedValue([]);
      mockDb.getAllTasks.mockReturnValue([]);

      const res = await app.request("/api/workers", {
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual([]);
    });

    it("returns all workers", async () => {
      const worker = createMockWorker({ id: "worker-1", name: "Worker 1" });
      mockClaudeTeam.listWorkers.mockResolvedValue([worker]);
      mockDb.getAllTasks.mockReturnValue([]);

      const res = await app.request("/api/workers", {
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe("worker-1");
    });

    it("enriches workers with task info", async () => {
      const task = createMockTask({
        id: "task-1",
        title: "Test Task",
        assignedWorker: "worker-1",
      });
      const worker = createMockWorker({
        id: "worker-1",
        name: "Worker 1",
        currentTask: null,
      });

      mockClaudeTeam.listWorkers.mockResolvedValue([worker]);
      mockDb.getAllTasks.mockReturnValue([task]);

      const res = await app.request("/api/workers", {
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].currentTask).toBe("task-1");
      expect(body[0].taskTitle).toBe("Test Task");
    });

    it("enriches workers when matched by worker name", async () => {
      const task = createMockTask({
        id: "task-1",
        title: "Test Task",
        assignedWorker: "Worker 1", // Matched by name
      });
      const worker = createMockWorker({
        id: "worker-1",
        name: "Worker 1",
        currentTask: null,
      });

      mockClaudeTeam.listWorkers.mockResolvedValue([worker]);
      mockDb.getAllTasks.mockReturnValue([task]);

      const res = await app.request("/api/workers", {
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body[0].currentTask).toBe("task-1");
      expect(body[0].taskTitle).toBe("Test Task");
    });

    it("enriches workers when matched by currentTask", async () => {
      const task = createMockTask({
        id: "task-1",
        title: "Test Task",
      });
      const worker = createMockWorker({
        id: "worker-1",
        name: "Worker 1",
        currentTask: "task-1", // Already set
      });

      mockClaudeTeam.listWorkers.mockResolvedValue([worker]);
      mockDb.getAllTasks.mockReturnValue([task]);

      const res = await app.request("/api/workers", {
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body[0].currentTask).toBe("task-1");
      expect(body[0].taskTitle).toBe("Test Task");
    });

    it("handles workers without assigned tasks", async () => {
      const worker = createMockWorker({
        id: "worker-1",
        name: "Orphan Worker",
        currentTask: null,
      });

      mockClaudeTeam.listWorkers.mockResolvedValue([worker]);
      mockDb.getAllTasks.mockReturnValue([]);

      const res = await app.request("/api/workers", {
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body[0].currentTask).toBe(null);
      expect(body[0].taskTitle).toBe(null);
    });

    it("requires authentication", async () => {
      const res = await app.request("/api/workers");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/workers/:id/close", () => {
    it("closes a worker not associated with in_progress task", async () => {
      mockDb.getTaskByWorkerId.mockReturnValue(null);
      mockClaudeTeam.closeWorker.mockResolvedValue({ success: true });

      const res = await app.request("/api/workers/worker-1/close", {
        method: "POST",
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mockClaudeTeam.closeWorker).toHaveBeenCalledWith("worker-1");
    });

    it("closes a worker with done task", async () => {
      const task = createMockTask({
        id: "task-1",
        status: "done",
        assignedWorker: "worker-1",
      });
      mockDb.getTaskByWorkerId.mockReturnValue(task);
      mockClaudeTeam.closeWorker.mockResolvedValue({ success: true });

      const res = await app.request("/api/workers/worker-1/close", {
        method: "POST",
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.respawned).toBeUndefined();
    });

    it("respawns worker when associated with in_progress task", async () => {
      const task = createMockTask({
        id: "task-1",
        status: "in_progress",
        assignedWorker: "worker-1",
        projectId: "project-1",
      });

      mockDb.getTaskByWorkerId.mockReturnValue(task);
      mockDb.getTaskById.mockReturnValue(task);
      mockClaudeTeam.getWorkerLogs.mockResolvedValue([]);
      mockClaudeTeam.closeWorker.mockResolvedValue({ success: true });
      mockDb.getProjectPathById.mockReturnValue("/path/to/project");
      mockClaudeTeam.spawnWorker.mockResolvedValue({
        success: true,
        workerId: "new-worker-1",
      });
      mockDb.updateTask.mockReturnValue({
        ...task,
        assignedWorker: "new-worker-1",
        workerStatus: "running",
      });

      const res = await app.request("/api/workers/worker-1/close", {
        method: "POST",
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.respawned).toBe(true);
      expect(body.newWorkerId).toBe("new-worker-1");
      expect(body.taskId).toBe("task-1");
      expect(mockWebsocket.broadcastTasks).toHaveBeenCalled();
    });

    it("returns 500 when close fails", async () => {
      mockDb.getTaskByWorkerId.mockReturnValue(null);
      mockClaudeTeam.closeWorker.mockResolvedValue({
        success: false,
        error: "Failed to close",
      });

      const res = await app.request("/api/workers/worker-1/close", {
        method: "POST",
        headers: authHeader,
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Failed to close");
    });

    it("returns 500 when respawn fails", async () => {
      const task = createMockTask({
        id: "task-1",
        status: "in_progress",
        assignedWorker: "worker-1",
        projectId: "project-1",
      });

      mockDb.getTaskByWorkerId.mockReturnValue(task);
      mockDb.getTaskById.mockReturnValue(task);
      mockClaudeTeam.getWorkerLogs.mockResolvedValue([]);
      mockClaudeTeam.closeWorker.mockResolvedValue({ success: true });
      mockDb.getProjectPathById.mockReturnValue("/path/to/project");
      mockClaudeTeam.spawnWorker.mockResolvedValue({
        success: false,
        error: "Spawn failed",
      });
      mockDb.updateTask.mockReturnValue(task);

      const res = await app.request("/api/workers/worker-1/close", {
        method: "POST",
        headers: authHeader,
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Failed to spawn worker");
    });

    it("requires authentication", async () => {
      const res = await app.request("/api/workers/worker-1/close", {
        method: "POST",
      });
      expect(res.status).toBe(401);
    });
  });
});
