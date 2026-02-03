import { z } from "zod";

// Task status enum
export const TaskStatusSchema = z.enum(["backlog", "in_progress", "done"]);

// Worker status for tasks
export const TaskWorkerStatusSchema = z
  .enum(["starting", "running", "reviewing", "closed"])
  .nullable();

// Merge strategy for tasks
export const MergeStrategySchema = z.enum(["direct", "pr"]).nullable();

// CreateTask schema
export const CreateTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: TaskStatusSchema.optional(),
  projectId: z.string().min(1, "Project selection is required"),
  targetBranch: z.string().nullable().optional(),
  mergeStrategy: MergeStrategySchema.optional(),
});

// UpdateTask schema
export const UpdateTaskSchema = z.object({
  title: z.string().min(1, "Title cannot be empty").optional(),
  description: z.string().optional(),
  status: TaskStatusSchema.optional(),
  assignedWorker: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  workerContext: z.string().nullable().optional(),
  workerStatus: TaskWorkerStatusSchema.optional(),
  logs: z.string().nullable().optional(),
  targetBranch: z.string().nullable().optional(),
  mergeStrategy: MergeStrategySchema.optional(),
  startedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
});

// CreateProject schema
export const CreateProjectSchema = z.object({
  path: z
    .string()
    .min(1, "Path is required")
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, "Path cannot be empty"),
});

// UpdateProject schema
export const UpdateProjectSchema = z.object({
  path: z
    .string()
    .min(1, "Path is required")
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, "Path cannot be empty"),
});

// Type exports inferred from schemas
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
