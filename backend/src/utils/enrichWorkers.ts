import type { Worker, Task } from "../types";

/**
 * Enriches workers with their assigned task info.
 * Matches workers to tasks by comparing worker id/name/annotation with task's assignedWorker field.
 */
export function enrichWorkersWithTasks(
  workers: Worker[],
  tasks: Task[]
): Worker[] {
  return workers.map((worker) => {
    const assignedTask = tasks.find(
      (t) =>
        t.assignedWorker === worker.id ||
        t.assignedWorker === worker.name ||
        t.id === worker.currentTask
    );
    return {
      ...worker,
      currentTask: assignedTask?.id || worker.currentTask,
      taskTitle: assignedTask?.title || null,
    };
  });
}
