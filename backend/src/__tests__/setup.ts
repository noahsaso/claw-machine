import { vi } from "vitest";
import type { Task, Project, Worker, WorkerLog, MergeStrategy } from "../types";

// Mock data factories
export function createMockProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    path: "/path/to/project",
    name: "project",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Test Task",
    description: "Test description",
    status: "backlog",
    assignedWorker: null,
    projectId: "project-1",
    targetBranch: null,
    mergeStrategy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function createMockWorker(overrides: Partial<Worker> = {}): Worker {
  return {
    id: "worker-1",
    name: "Worker 1",
    status: "idle",
    currentTask: null,
    ...overrides,
  };
}

export function createMockWorkerLog(
  overrides: Partial<WorkerLog> = {}
): WorkerLog {
  return {
    role: "assistant",
    content: "Test log content",
    ...overrides,
  };
}

// Mock implementations storage
export const mockDb = {
  getAllTasks: vi.fn<(projectId?: string) => Task[]>(() => []),
  getTaskById: vi.fn<(id: string) => Task | null>(() => null),
  createTask: vi.fn<(input: unknown) => Task>(() => createMockTask()),
  updateTask: vi.fn<(id: string, input: unknown) => Task | null>(() => null),
  deleteTask: vi.fn<(id: string) => boolean>(() => false),
  getTaskByWorkerId: vi.fn<(workerId: string) => Task | null>(() => null),
  getAllProjects: vi.fn<() => Project[]>(() => []),
  getProjectById: vi.fn<(id: string) => Project | null>(() => null),
  getProjectByPath: vi.fn<(path: string) => Project | null>(() => null),
  createProject: vi.fn<(input: unknown, name: string) => Project>(() =>
    createMockProject()
  ),
  updateProject: vi.fn<
    (id: string, path: string, name: string) => Project | null
  >(() => null),
  deleteProject: vi.fn<(id: string) => boolean>(() => false),
  getProjectPathById: vi.fn<(projectId: string) => string | null>(() => null),
};

export const mockClaudeTeam = {
  listWorkers: vi.fn<() => Promise<Worker[]>>(async () => []),
  spawnWorker: vi.fn<
    (args: unknown) => Promise<{
      success: boolean;
      workerId?: string;
      error?: string;
    }>
  >(async () => ({
    success: true,
    workerId: "new-worker-1",
  })),
  closeWorker: vi.fn<
    (workerId: string) => Promise<{ success: boolean; error?: string }>
  >(async () => ({ success: true })),
  getWorkerLogs: vi.fn<(workerId: string) => Promise<WorkerLog[]>>(
    async () => []
  ),
};

export const mockWebsocket = {
  broadcast: vi.fn(),
  broadcastTasks: vi.fn(),
  addClient: vi.fn(),
  removeClient: vi.fn(),
  getClientCount: vi.fn(() => 0),
  getInitialState: vi.fn(async () => ({
    tasks: [] as Task[],
    workers: [] as Worker[],
  })),
};

export const mockFs = {
  existsSync: vi.fn<(path: string) => boolean>(() => true),
};

// Reset all mocks between tests
export function resetMocks() {
  Object.values(mockDb).forEach((mock) => mock.mockReset());
  Object.values(mockClaudeTeam).forEach((mock) => mock.mockReset());
  Object.values(mockWebsocket).forEach((mock) => mock.mockReset());
  Object.values(mockFs).forEach((mock) => mock.mockReset());

  // Restore default return values
  mockDb.getAllTasks.mockReturnValue([]);
  mockDb.getTaskById.mockReturnValue(null);
  mockDb.createTask.mockReturnValue(createMockTask());
  mockDb.updateTask.mockReturnValue(null);
  mockDb.deleteTask.mockReturnValue(false);
  mockDb.getTaskByWorkerId.mockReturnValue(null);
  mockDb.getAllProjects.mockReturnValue([]);
  mockDb.getProjectById.mockReturnValue(null);
  mockDb.getProjectByPath.mockReturnValue(null);
  mockDb.createProject.mockReturnValue(createMockProject());
  mockDb.updateProject.mockReturnValue(null);
  mockDb.deleteProject.mockReturnValue(false);
  mockDb.getProjectPathById.mockReturnValue(null);

  mockClaudeTeam.listWorkers.mockResolvedValue([]);
  mockClaudeTeam.spawnWorker.mockResolvedValue({
    success: true,
    workerId: "new-worker-1",
  });
  mockClaudeTeam.closeWorker.mockResolvedValue({ success: true });
  mockClaudeTeam.getWorkerLogs.mockResolvedValue([]);

  mockWebsocket.broadcast.mockReturnValue(undefined);
  mockWebsocket.broadcastTasks.mockReturnValue(undefined);
  mockWebsocket.getClientCount.mockReturnValue(0);
  mockWebsocket.getInitialState.mockResolvedValue({ tasks: [], workers: [] });

  mockFs.existsSync.mockReturnValue(true);
}

// Auth helper
export const AUTH_PASSWORD = "claw-machine-2026";
export const authHeader = { Authorization: `Bearer ${AUTH_PASSWORD}` };
