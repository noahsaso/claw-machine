import { describe, it, expect } from "vitest";
import { buildWorkerPrompt } from "./promptBuilder";
import { WORKTREE_NOTE } from "../config";
import type { Task } from "../types";

describe("buildWorkerPrompt", () => {
  const createTask = (overrides: Partial<Task> = {}): Task => ({
    id: "task-1",
    title: "Test Task",
    description: "Task description",
    status: "in_progress",
    assignedWorker: null,
    projectId: "project-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });

  it("builds basic prompt with title and description", () => {
    const task = createTask({
      title: "Implement feature",
      description: "Add login functionality",
    });

    const prompt = buildWorkerPrompt(task);

    expect(prompt).toContain("Task: Implement feature");
    expect(prompt).toContain("Add login functionality");
    expect(prompt).toContain(WORKTREE_NOTE);
  });

  it("uses default description when description is empty", () => {
    const task = createTask({
      title: "Quick fix",
      description: "",
    });

    const prompt = buildWorkerPrompt(task);

    expect(prompt).toContain("Task: Quick fix");
    expect(prompt).toContain("Complete this task.");
    expect(prompt).toContain(WORKTREE_NOTE);
  });

  it("uses default description when description is undefined", () => {
    const task = createTask({
      title: "Quick fix",
    });
    // @ts-expect-error Testing undefined description
    task.description = undefined;

    const prompt = buildWorkerPrompt(task);

    expect(prompt).toContain("Complete this task.");
  });

  it("includes previous context when workerContext is set", () => {
    const task = createTask({
      title: "Continue task",
      description: "Keep working",
      workerContext: "[assistant]: I was working on the feature\n[user]: Please continue",
    });

    const prompt = buildWorkerPrompt(task);

    expect(prompt).toContain("Task: Continue task");
    expect(prompt).toContain("Keep working");
    expect(prompt).toContain(WORKTREE_NOTE);
    expect(prompt).toContain("--- Previous Context ---");
    expect(prompt).toContain("[assistant]: I was working on the feature");
    expect(prompt).toContain("[user]: Please continue");
  });

  it("does not include context section when workerContext is null", () => {
    const task = createTask({
      workerContext: null,
    });

    const prompt = buildWorkerPrompt(task);

    expect(prompt).not.toContain("--- Previous Context ---");
  });

  it("does not include context section when workerContext is empty string", () => {
    const task = createTask({
      workerContext: "",
    });

    const prompt = buildWorkerPrompt(task);

    expect(prompt).not.toContain("--- Previous Context ---");
  });

  it("maintains correct prompt structure order", () => {
    const task = createTask({
      title: "Ordered Task",
      description: "Description here",
      workerContext: "Previous context",
    });

    const prompt = buildWorkerPrompt(task);

    const titleIndex = prompt.indexOf("Task: Ordered Task");
    const descriptionIndex = prompt.indexOf("Description here");
    const worktreeIndex = prompt.indexOf(WORKTREE_NOTE);
    const contextIndex = prompt.indexOf("--- Previous Context ---");

    // Title comes first
    expect(titleIndex).toBeLessThan(descriptionIndex);
    // Description comes after title
    expect(descriptionIndex).toBeLessThan(worktreeIndex);
    // Worktree note comes before context
    expect(worktreeIndex).toBeLessThan(contextIndex);
  });
});
