import { Database } from "bun:sqlite";
import type { Task, CreateTaskInput, UpdateTaskInput, Project, CreateProjectInput } from "../types";
import { v4 as uuidv4 } from "uuid";

const db = new Database("data.db");

// Initialize the projects table first (must exist before tasks can reference it)
db.run(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// Initialize the tasks table
db.run(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'backlog' CHECK(status IN ('backlog', 'in_progress', 'done')),
    assigned_worker TEXT,
    worker_context TEXT,
    worker_status TEXT,
    logs TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT
  )
`);

// Common SQL fragments
const TASK_SELECT_COLUMNS = `
  id, title, description, status, assigned_worker as assignedWorker,
  worker_context as workerContext, worker_status as workerStatus,
  project_id as projectId, logs,
  created_at as createdAt, updated_at as updatedAt,
  started_at as startedAt, completed_at as completedAt
`;

// Task repository functions
export function getAllTasks(projectId?: string): Task[] {
  if (projectId) {
    const stmt = db.prepare(`
      SELECT ${TASK_SELECT_COLUMNS}
      FROM tasks
      WHERE project_id = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(projectId) as Task[];
  }
  const stmt = db.prepare(`
    SELECT ${TASK_SELECT_COLUMNS}
    FROM tasks
    ORDER BY created_at DESC
  `);
  return stmt.all() as Task[];
}

export function getTaskById(id: string): Task | null {
  const stmt = db.prepare(`
    SELECT ${TASK_SELECT_COLUMNS}
    FROM tasks
    WHERE id = ?
  `);
  return stmt.get(id) as Task | null;
}

export function createTask(input: CreateTaskInput): Task {
  if (!input.projectId) {
    throw new Error("projectId is required to create a task");
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO tasks (id, title, description, status, project_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    input.title,
    input.description || "",
    input.status || "backlog",
    input.projectId,
    now,
    now
  );
  return getTaskById(id)!;
}

export function updateTask(id: string, input: UpdateTaskInput): Task | null {
  const existing = getTaskById(id);
  if (!existing) return null;

  const updates: string[] = [];
  const values: (string | null)[] = [];

  if (input.title !== undefined) {
    updates.push("title = ?");
    values.push(input.title);
  }
  if (input.description !== undefined) {
    updates.push("description = ?");
    values.push(input.description);
  }
  if (input.status !== undefined) {
    updates.push("status = ?");
    values.push(input.status);
  }
  if (input.assignedWorker !== undefined) {
    updates.push("assigned_worker = ?");
    values.push(input.assignedWorker);
  }
  if (input.workerContext !== undefined) {
    updates.push("worker_context = ?");
    values.push(input.workerContext);
  }
  if (input.workerStatus !== undefined) {
    updates.push("worker_status = ?");
    values.push(input.workerStatus);
  }
  if (input.projectId !== undefined) {
    updates.push("project_id = ?");
    values.push(input.projectId);
  }
  if (input.logs !== undefined) {
    updates.push("logs = ?");
    values.push(input.logs);
  }
  if (input.startedAt !== undefined) {
    updates.push("started_at = ?");
    values.push(input.startedAt);
  }
  if (input.completedAt !== undefined) {
    updates.push("completed_at = ?");
    values.push(input.completedAt);
  }

  if (updates.length === 0) return existing;

  updates.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);

  const stmt = db.prepare(`
    UPDATE tasks SET ${updates.join(", ")} WHERE id = ?
  `);
  stmt.run(...values);

  return getTaskById(id);
}

export function deleteTask(id: string): boolean {
  const stmt = db.prepare("DELETE FROM tasks WHERE id = ?");
  const result = stmt.run(id);
  return result.changes > 0;
}

export function getTaskByWorkerId(workerId: string): Task | null {
  const stmt = db.prepare(`
    SELECT ${TASK_SELECT_COLUMNS}
    FROM tasks
    WHERE assigned_worker = ?
  `);
  return stmt.get(workerId) as Task | null;
}

export function getProjectPathById(projectId: string): string | null {
  return getProjectById(projectId)?.path ?? null;
}

// Project repository functions
export function getAllProjects(): Project[] {
  const stmt = db.prepare(`
    SELECT id, path, name, created_at as createdAt
    FROM projects
    ORDER BY created_at DESC
  `);
  return stmt.all() as Project[];
}

export function getProjectById(id: string): Project | null {
  const stmt = db.prepare(`
    SELECT id, path, name, created_at as createdAt
    FROM projects
    WHERE id = ?
  `);
  return stmt.get(id) as Project | null;
}

export function getProjectByPath(path: string): Project | null {
  const stmt = db.prepare(`
    SELECT id, path, name, created_at as createdAt
    FROM projects
    WHERE path = ?
  `);
  return stmt.get(path) as Project | null;
}

export function createProject(input: CreateProjectInput, name: string): Project {
  const id = uuidv4();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO projects (id, path, name, created_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, input.path, name, now);
  return getProjectById(id)!;
}

export function updateProject(id: string, path: string, name: string): Project | null {
  const existing = getProjectById(id);
  if (!existing) return null;

  const stmt = db.prepare(`
    UPDATE projects SET path = ?, name = ? WHERE id = ?
  `);
  stmt.run(path, name, id);
  return getProjectById(id);
}

export function deleteProject(id: string): boolean {
  const stmt = db.prepare("DELETE FROM projects WHERE id = ?");
  const result = stmt.run(id);
  return result.changes > 0;
}

export { db };
