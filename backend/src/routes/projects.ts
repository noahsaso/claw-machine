import { Hono } from "hono";
import { existsSync } from "fs";
import { basename } from "path";
import {
  getAllProjects,
  getProjectById,
  getProjectByPath,
  createProject,
  updateProject,
  deleteProject,
} from "../services/db";
import type { CreateProjectInput } from "../types";

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
  const body = await c.req.json<CreateProjectInput>();

  if (!body.path || typeof body.path !== "string") {
    return c.json({ error: "Path is required" }, 400);
  }

  const trimmedPath = body.path.trim();
  if (trimmedPath.length === 0) {
    return c.json({ error: "Path cannot be empty" }, 400);
  }

  // Validate that the path exists on the filesystem
  if (!existsSync(trimmedPath)) {
    return c.json({ error: "Path does not exist on the filesystem" }, 400);
  }

  // Check if project with this path already exists
  const existingProject = getProjectByPath(trimmedPath);
  if (existingProject) {
    return c.json({ error: "A project with this path already exists" }, 409);
  }

  // Auto-generate name from folder basename
  const name = basename(trimmedPath);

  const project = createProject({ path: trimmedPath }, name);

  return c.json({ ...project, exists: true }, 201);
});

// PATCH /api/projects/:id - Update project
projects.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ path?: string }>();

  const existing = getProjectById(id);
  if (!existing) {
    return c.json({ error: "Project not found" }, 404);
  }

  if (!body.path || typeof body.path !== "string") {
    return c.json({ error: "Path is required" }, 400);
  }

  const trimmedPath = body.path.trim();
  if (trimmedPath.length === 0) {
    return c.json({ error: "Path cannot be empty" }, 400);
  }

  // Validate that the path exists on the filesystem
  if (!existsSync(trimmedPath)) {
    return c.json({ error: "Path does not exist on the filesystem" }, 400);
  }

  // Check if another project with this path already exists
  const existingByPath = getProjectByPath(trimmedPath);
  if (existingByPath && existingByPath.id !== id) {
    return c.json({ error: "A project with this path already exists" }, 409);
  }

  // Auto-generate name from folder basename
  const name = basename(trimmedPath);

  const project = updateProject(id, trimmedPath, name);
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

export { projects };
