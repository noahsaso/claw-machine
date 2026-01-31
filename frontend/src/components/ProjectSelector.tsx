import { useState } from 'react'
import type { Project } from '../types'

interface ProjectSelectorProps {
  projects: Project[]
  selectedProjectId: string | null
  onSelectProject: (projectId: string | null) => void
  onCreateProject: (path: string) => Promise<Project>
  onUpdateProject?: (id: string, path: string) => Promise<Project>
  onDeleteProject?: (id: string) => Promise<void>
  isLoading?: boolean
}

export function ProjectSelector({
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  isLoading,
}: ProjectSelectorProps) {
  const [isAddingProject, setIsAddingProject] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [newProjectPath, setNewProjectPath] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAddProject = async () => {
    if (!newProjectPath.trim()) return

    setIsCreating(true)
    setError(null)
    try {
      const project = await onCreateProject(newProjectPath.trim())
      onSelectProject(project.id)
      setNewProjectPath('')
      setIsAddingProject(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add project')
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdateProject = async () => {
    if (!editingProject || !newProjectPath.trim() || !onUpdateProject) return

    setIsCreating(true)
    setError(null)
    try {
      await onUpdateProject(editingProject.id, newProjectPath.trim())
      setNewProjectPath('')
      setEditingProject(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!editingProject || !onDeleteProject) return

    setIsDeleting(true)
    setError(null)
    try {
      await onDeleteProject(editingProject.id)
      setNewProjectPath('')
      setEditingProject(null)
      // If the deleted project was selected, clear selection
      if (selectedProjectId === editingProject.id) {
        onSelectProject(
          projects.length > 1
            ? projects.find((p) => p.id !== editingProject.id)?.id || null
            : null
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSelectChange = (value: string) => {
    if (value === '__add__') {
      setIsAddingProject(true)
      setEditingProject(null)
      setNewProjectPath('')
    } else if (value.startsWith('__edit__:')) {
      const projectId = value.replace('__edit__:', '')
      const project = projects.find((p) => p.id === projectId)
      if (project) {
        setEditingProject(project)
        setNewProjectPath(project.path)
        setIsAddingProject(false)
      }
    } else {
      onSelectProject(value)
    }
  }

  const handleCancel = () => {
    setIsAddingProject(false)
    setEditingProject(null)
    setNewProjectPath('')
    setError(null)
  }

  if (isAddingProject || editingProject) {
    return (
      <div className="mb-3">
        <label className="block text-xs text-slate-400 mb-1">
          {editingProject ? 'Edit Project' : 'Add Project'}
        </label>
        <input
          type="text"
          placeholder="Enter filesystem path (e.g. /path/to/project)"
          value={newProjectPath}
          onChange={(e) => setNewProjectPath(e.target.value)}
          className="w-full bg-slate-700 text-slate-100 px-3 py-2 rounded-lg border border-slate-600 focus:outline-none focus:border-indigo-500 text-sm mb-2"
          autoFocus
          disabled={isCreating || isDeleting}
        />
        {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={editingProject ? handleUpdateProject : handleAddProject}
            disabled={isCreating || isDeleting || !newProjectPath.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors text-sm cursor-pointer"
          >
            {isCreating ? 'Saving...' : editingProject ? 'Save' : 'Add'}
          </button>
          {editingProject && onDeleteProject && (
            <button
              onClick={handleDeleteProject}
              disabled={isCreating || isDeleting}
              className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors text-sm cursor-pointer"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
          <button
            onClick={handleCancel}
            disabled={isCreating || isDeleting}
            className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors text-sm cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-3">
      <label className="block text-xs text-slate-400 mb-1">Project</label>
      <div className="flex gap-2">
        <select
          value={selectedProjectId || ''}
          onChange={(e) => handleSelectChange(e.target.value)}
          className="flex-1 bg-slate-700 text-slate-100 px-3 py-2 rounded-lg border border-slate-600 focus:outline-none focus:border-indigo-500 text-sm cursor-pointer"
          disabled={isLoading}
        >
          <option value="" disabled>
            Select a project...
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.exists === false ? '⚠ ' : ''}
              {project.name}
            </option>
          ))}
          <option value="__add__">+ Add Project...</option>
        </select>
        {selectedProjectId && onUpdateProject && (
          <button
            onClick={() => handleSelectChange(`__edit__:${selectedProjectId}`)}
            className="bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200 px-2.5 py-2 rounded-lg border border-slate-600 transition-colors text-sm cursor-pointer"
            title="Edit project"
          >
            ✎
          </button>
        )}
      </div>
    </div>
  )
}
