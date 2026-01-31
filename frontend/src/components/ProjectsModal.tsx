import { useState, useEffect } from 'react'
import type { Project } from '../types'

interface ProjectsModalProps {
  projects: Project[]
  onClose: () => void
  onCreateProject: (path: string) => Promise<Project>
  onUpdateProject: (id: string, path: string) => Promise<Project>
  onDeleteProject: (id: string) => Promise<void>
}

export function ProjectsModal({
  projects,
  onClose,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
}: ProjectsModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPath, setEditPath] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [newPath, setNewPath] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId || isAdding) {
          setEditingId(null)
          setIsAdding(false)
          setError(null)
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose, editingId, isAdding])

  const handleEdit = (project: Project) => {
    setEditingId(project.id)
    setEditPath(project.path)
    setIsAdding(false)
    setError(null)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditPath('')
    setError(null)
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editPath.trim()) return

    setIsSaving(true)
    setError(null)
    try {
      await onUpdateProject(editingId, editPath.trim())
      setEditingId(null)
      setEditPath('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (deletingId === id) {
      // Confirmed
      setIsSaving(true)
      setError(null)
      try {
        await onDeleteProject(id)
        setDeletingId(null)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to delete project'
        )
      } finally {
        setIsSaving(false)
      }
    } else {
      // First click - ask for confirmation
      setDeletingId(id)
      setTimeout(() => setDeletingId(null), 3000)
    }
  }

  const handleAddProject = async () => {
    if (!newPath.trim()) return

    setIsSaving(true)
    setError(null)
    try {
      await onCreateProject(newPath.trim())
      setNewPath('')
      setIsAdding(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-t-xl sm:rounded-lg shadow-xl w-full sm:max-w-lg sm:mx-4 border-t sm:border border-slate-700 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Manage Projects</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-sm text-red-400">
              {error}
            </div>
          )}

          {projects.length === 0 && !isAdding ? (
            <p className="text-slate-400 text-sm text-center py-8">
              No projects yet. Add one to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="bg-slate-700/50 rounded-lg p-3 border border-slate-600"
                >
                  {editingId === project.id ? (
                    <div>
                      <input
                        type="text"
                        value={editPath}
                        onChange={(e) => setEditPath(e.target.value)}
                        className="w-full bg-slate-700 text-slate-100 px-3 py-2 rounded-lg border border-slate-600 focus:outline-none focus:border-indigo-500 text-sm mb-2"
                        autoFocus
                        disabled={isSaving}
                        placeholder="Enter filesystem path"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          disabled={isSaving || !editPath.trim()}
                          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors text-sm cursor-pointer"
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                          className="bg-slate-600 hover:bg-slate-500 text-slate-300 px-3 py-1.5 rounded-lg transition-colors text-sm cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-100 text-sm truncate">
                            {project.name}
                          </span>
                          {!project.exists && (
                            <span
                              className="flex-shrink-0 px-1.5 py-0.5 bg-yellow-900/50 border border-yellow-700/50 rounded text-xs text-yellow-400"
                              title="Path does not exist"
                            >
                              Missing
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-xs truncate ${project.exists ? 'text-slate-400' : 'text-yellow-400/70'}`}
                        >
                          {project.path}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleEdit(project)}
                          className="text-slate-400 hover:text-indigo-400 p-1.5 transition-colors cursor-pointer"
                          title="Edit project"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          disabled={isSaving}
                          className={`p-1.5 transition-colors cursor-pointer ${
                            deletingId === project.id
                              ? 'text-red-400 hover:text-red-300'
                              : 'text-slate-400 hover:text-red-400'
                          }`}
                          title={
                            deletingId === project.id
                              ? 'Click to confirm'
                              : 'Delete project'
                          }
                        >
                          {deletingId === project.id ? 'Confirm?' : '✕'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isAdding && (
            <div className="mt-4 bg-slate-700/50 rounded-lg p-3 border border-slate-600">
              <label className="block text-xs text-slate-400 mb-1">
                New Project Path
              </label>
              <input
                type="text"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                className="w-full bg-slate-700 text-slate-100 px-3 py-2 rounded-lg border border-slate-600 focus:outline-none focus:border-indigo-500 text-sm mb-2"
                autoFocus
                disabled={isSaving}
                placeholder="Enter filesystem path (e.g. /path/to/project)"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddProject}
                  disabled={isSaving || !newPath.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors text-sm cursor-pointer"
                >
                  {isSaving ? 'Adding...' : 'Add'}
                </button>
                <button
                  onClick={() => {
                    setIsAdding(false)
                    setNewPath('')
                    setError(null)
                  }}
                  disabled={isSaving}
                  className="bg-slate-600 hover:bg-slate-500 text-slate-300 px-3 py-1.5 rounded-lg transition-colors text-sm cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 p-4 border-t border-slate-700">
          {!isAdding && (
            <button
              onClick={() => {
                setIsAdding(true)
                setEditingId(null)
                setError(null)
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-sm cursor-pointer"
            >
              + Add Project
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors text-sm cursor-pointer ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
