import { Hono } from "hono";
import { existsSync } from "fs";
import { basename } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { ZodError } from "zod";

const execAsync = promisify(exec);
import {
  getAllProjects,
  getProjectById,
  getProjectByPath,
  createProject,
  updateProject,
  deleteProject,
} from "../services/db";
import { CreateProjectSchema, UpdateProjectSchema } from "../schemas";

const projects = new Hono();

// GET /api/projects - List all projects
projects.get("/", (c) => {
  const allProjects = getAllProjects();
  // Check if each project path still exists on the filesystem
  const projectsWithExistsCheck = allProjects.map((project) => ({
    ...project,
    exists: existsSync(project.path),
  }));
  return c.json(projectsWithExistsCheck);
});

// POST /api/projects - Create project
projects.post("/", async (c) => {
  let body;
  try {
    const rawBody = await c.req.json();
    body = CreateProjectSchema.parse(rawBody);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstError = error.issues[0];
      return c.json({ error: firstError.message }, 400);
    }
    return c.json({ error: "Invalid request body" }, 400);
  }

  // Validate that the path exists on the filesystem
  if (!existsSync(body.path)) {
    return c.json({ error: "Path does not exist on the filesystem" }, 400);
  }

  // Check if project with this path already exists
  const existingProject = getProjectByPath(body.path);
  if (existingProject) {
    return c.json({ error: "A project with this path already exists" }, 409);
  }

  // Auto-generate name from folder basename
  const name = basename(body.path);

  const project = createProject({ path: body.path }, name);

  return c.json({ ...project, exists: true }, 201);
});

// PATCH /api/projects/:id - Update project
projects.patch("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = getProjectById(id);
  if (!existing) {
    return c.json({ error: "Project not found" }, 404);
  }

  let body;
  try {
    const rawBody = await c.req.json();
    body = UpdateProjectSchema.parse(rawBody);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstError = error.issues[0];
      return c.json({ error: firstError.message }, 400);
    }
    return c.json({ error: "Invalid request body" }, 400);
  }

  // Validate that the path exists on the filesystem
  if (!existsSync(body.path)) {
    return c.json({ error: "Path does not exist on the filesystem" }, 400);
  }

  // Check if another project with this path already exists
  const existingByPath = getProjectByPath(body.path);
  if (existingByPath && existingByPath.id !== id) {
    return c.json({ error: "A project with this path already exists" }, 409);
  }

  // Auto-generate name from folder basename
  const name = basename(body.path);

  const project = updateProject(id, body.path, name);
  if (!project) {
    return c.json({ error: "Failed to update project" }, 500);
  }

  return c.json({ ...project, exists: true });
});

// DELETE /api/projects/:id - Delete project
projects.delete("/:id", (c) => {
  const id = c.req.param("id");

  const existing = getProjectById(id);
  if (!existing) {
    return c.json({ error: "Project not found" }, 404);
  }

  const deleted = deleteProject(id);
  if (!deleted) {
    return c.json({ error: "Failed to delete project" }, 500);
  }

  return c.json({ success: true });
});

// GET /api/projects/:id/branch - Get current checked-out branch
projects.get("/:id/branch", async (c) => {
  const id = c.req.param("id");

  const project = getProjectById(id);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  // Validate that the path still exists
  if (!existsSync(project.path)) {
    return c.json({ error: "Project path does not exist on filesystem" }, 400);
  }

  try {
    const { stdout } = await execAsync(`git -C "${project.path}" branch --show-current`);
    const branch = stdout.trim();
    return c.json({ branch });
  } catch (error) {
    return c.json({ error: "Failed to get current branch" }, 500);
  }
});

export { projects };
