export type TaskStatus = 'backlog' | 'in_progress' | 'done'

// Worker status values for tasks
// - "starting": worker is being spawned
// - "running": worker is actively working
// - "reviewing": worker completed, work is being reviewed and merged
// - "closed": worker has been closed
export type TaskWorkerStatus =
  | 'starting'
  | 'running'
  | 'reviewing'
  | 'closed'
  | null

export type MergeStrategy = 'direct' | 'pr' | null

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  assignedWorker?: string | null
  workerStatus?: TaskWorkerStatus
  projectId: string // Required - all tasks must belong to a project
  targetBranch?: string | null // Target branch for merging work
  mergeStrategy?: MergeStrategy // How to merge: direct, pr, or reviewer decides (null)
  logs?: string | null // JSON string of WorkerLogMessage[]
  createdAt: string
  updatedAt: string
  startedAt?: string | null // When task moved to in_progress
  completedAt?: string | null // When task moved to done
  error?: string | null // Error message from client
  isOptimistic?: boolean // True when task is being created (optimistic update)
  isDeleting?: boolean // True when task is being deleted
}

export interface CreateTaskInput {
  title: string
  description: string
  projectId: string
  targetBranch?: string | null
  mergeStrategy?: MergeStrategy
}

export type WorkerStatus = 'spawning' | 'active' | 'busy' | 'idle' | 'closed'

export interface Worker {
  id: string
  name: string
  status: WorkerStatus
  currentTask?: string | null
  taskTitle?: string | null
  createdAt: string
}

export interface WorkerLogMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export interface WebSocketMessage {
  type: 'worker_update' | 'workers_update' | 'task_update' | 'initial_state'
  payload?: unknown
  workers?: Worker[]
  timestamp?: string
}

export interface WorkerUpdatePayload {
  worker: Worker
}

export interface TaskUpdatePayload {
  task: Task
}

export interface InitialStatePayload {
  workers: Worker[]
  tasks: Task[]
}

export interface Project {
  id: string
  name: string
  path: string
  createdAt: string
  exists: boolean // Whether the path exists on the filesystem
}
