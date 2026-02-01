import { describe, it, expect } from "vitest";
import { enrichWorkersWithTasks } from "./enrichWorkers";
import type { Worker, Task } from "../types";

describe("enrichWorkersWithTasks", () => {
  const createWorker = (overrides: Partial<Worker> = {}): Worker => ({
    id: "worker-1",
    name: "Worker 1",
    status: "idle",
    currentTask: null,
    ...overrides,
  });

  const createTask = (overrides: Partial<Task> = {}): Task => ({
    id: "task-1",
    title: "Test Task",
    description: "Description",
    status: "in_progress",
    assignedWorker: null,
    projectId: "project-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });

  it("returns empty array for empty workers", () => {
    const result = enrichWorkersWithTasks([], []);
    expect(result).toEqual([]);
  });

  it("returns workers unchanged when no tasks", () => {
    const workers = [createWorker()];
    const result = enrichWorkersWithTasks(workers, []);

    expect(result).toHaveLength(1);
    expect(result[0].currentTask).toBeNull();
    expect(result[0].taskTitle).toBeNull();
  });

  it("matches worker by id to task assignedWorker", () => {
    const workers = [createWorker({ id: "worker-1" })];
    const tasks = [createTask({ id: "task-1", title: "My Task", assignedWorker: "worker-1" })];

    const result = enrichWorkersWithTasks(workers, tasks);

    expect(result[0].currentTask).toBe("task-1");
    expect(result[0].taskTitle).toBe("My Task");
  });

  it("matches worker by name to task assignedWorker", () => {
    const workers = [createWorker({ id: "worker-1", name: "Prince" })];
    const tasks = [createTask({ id: "task-1", title: "Named Task", assignedWorker: "Prince" })];

    const result = enrichWorkersWithTasks(workers, tasks);

    expect(result[0].currentTask).toBe("task-1");
    expect(result[0].taskTitle).toBe("Named Task");
  });

  it("matches worker by currentTask to task id", () => {
    const workers = [createWorker({ id: "worker-1", currentTask: "task-1" })];
    const tasks = [createTask({ id: "task-1", title: "Current Task" })];

    const result = enrichWorkersWithTasks(workers, tasks);

    expect(result[0].currentTask).toBe("task-1");
    expect(result[0].taskTitle).toBe("Current Task");
  });

  it("handles multiple workers with different tasks", () => {
    const workers = [
      createWorker({ id: "worker-1" }),
      createWorker({ id: "worker-2", name: "Worker 2" }),
    ];
    const tasks = [
      createTask({ id: "task-1", title: "Task 1", assignedWorker: "worker-1" }),
      createTask({ id: "task-2", title: "Task 2", assignedWorker: "worker-2" }),
    ];

    const result = enrichWorkersWithTasks(workers, tasks);

    expect(result[0].currentTask).toBe("task-1");
    expect(result[0].taskTitle).toBe("Task 1");
    expect(result[1].currentTask).toBe("task-2");
    expect(result[1].taskTitle).toBe("Task 2");
  });

  it("preserves existing currentTask when no matching task found", () => {
    const workers = [createWorker({ id: "worker-1", currentTask: "orphan-task" })];
    const tasks: Task[] = [];

    const result = enrichWorkersWithTasks(workers, tasks);

    expect(result[0].currentTask).toBe("orphan-task");
    expect(result[0].taskTitle).toBeNull();
  });

  it("preserves other worker properties", () => {
    const workers = [
      createWorker({
        id: "worker-1",
        status: "busy",
        worktreePath: "/path/to/worktree",
        projectPath: "/path/to/project",
        isIdle: false,
      }),
    ];
    const tasks: Task[] = [];

    const result = enrichWorkersWithTasks(workers, tasks);

    expect(result[0].status).toBe("busy");
    expect(result[0].worktreePath).toBe("/path/to/worktree");
    expect(result[0].projectPath).toBe("/path/to/project");
    expect(result[0].isIdle).toBe(false);
  });
});
