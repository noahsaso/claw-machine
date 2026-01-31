// Task types
export type TaskStatus = "backlog" | "in_progress" | "done";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignedWorker: string | null;
  projectId: string; // Required - all tasks must belong to a project
  workerContext?: string | null;
  workerStatus?: TaskWorkerStatus;
  logs?: string | null; // JSON string of WorkerLog[]
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null; // When task moved to in_progress
  completedAt?: string | null; // When task moved to done
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  projectId: string; // Required - all tasks must belong to a project
}

// Worker status values for tasks
// - "starting": worker is being spawned
// - "running": worker is actively working
// - "reviewing": worker completed, work is being reviewed and merged
// - "closed": worker has been closed
export type TaskWorkerStatus = "starting" | "running" | "reviewing" | "closed" | null;

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  assignedWorker?: string | null;
  projectId?: string | null;
  workerContext?: string | null;
  workerStatus?: TaskWorkerStatus;
  logs?: string | null; // JSON string of WorkerLog[]
  startedAt?: string | null;
  completedAt?: string | null;
}

// Worker types (from claude-team)
export type WorkerStatus = "spawning" | "active" | "busy" | "idle" | "closed";

export interface Worker {
  id: string;
  name: string;
  annotation?: string; // Should be `task-{taskId}`
  status: WorkerStatus;
  currentTask: string | null;
  taskTitle?: string | null;
  worktreePath?: string;
  projectPath?: string;
  isIdle?: boolean;
}

export interface WorkerLog {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

// Project types
export interface Project {
  id: string;
  path: string;
  name: string;
  createdAt: string;
}

export interface CreateProjectInput {
  path: string;
}
