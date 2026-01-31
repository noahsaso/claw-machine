import type { Task } from "../types";
import { WORKTREE_NOTE } from "../config";

/**
 * Build the prompt string for spawning a worker.
 * Includes task details, worktree instructions, and optional previous context.
 */
export function buildWorkerPrompt(task: Task): string {
  const basePrompt = `Task: ${task.title}\n\n${
    task.description || "Complete this task."
  }\n\n${WORKTREE_NOTE}`;

  if (task.workerContext) {
    return `${basePrompt}\n\n--- Previous Context ---\n${task.workerContext}`;
  }

  return basePrompt;
}
