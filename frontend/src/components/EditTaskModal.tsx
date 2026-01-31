import { useState, useEffect } from 'react'
import type { Task, Project } from '../types'
import { ProjectSelector } from './ProjectSelector'

interface EditTaskModalProps {
  task: Task
  projects: Project[]
  onSave: (
    taskId: string,
    updates: { title: string; description: string; projectId?: string }
  ) => void
  onClose: () => void
  onCreateProject: (path: string) => Promise<Project>
  onUpdateProject: (id: string, path: string) => Promise<Project>
  onDeleteProject: (id: string) => Promise<void>
  isLoadingProjects?: boolean
}

export function EditTaskModal({
  task,
  projects,
  onSave,
  onClose,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  isLoadingProjects,
}: EditTaskModalProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [projectId, setProjectId] = useState<string | null>(task.projectId)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleSave = async () => {
    if (!title.trim() || !projectId) return

    setIsSaving(true)
    try {
      await onSave(task.id, {
        title: title.trim(),
        description: description.trim(),
        projectId,
      })
      onClose()
    } catch (err) {
      console.error('Failed to save task:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      handleSave()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-t-xl sm:rounded-lg shadow-xl w-full sm:max-w-lg sm:mx-4 border-t sm:border border-slate-700 max-h-[90vh] sm:max-h-none overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Edit Task</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        <div
          className="p-4 space-y-4 flex-1 overflow-y-auto"
          onKeyDown={handleKeyDown}
        >
          <div>
            <label className="block text-sm text-slate-400 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-700 text-slate-100 px-3 py-2 rounded-lg border border-slate-600 focus:outline-none focus:border-indigo-500 text-sm"
              autoFocus
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-700 text-slate-100 px-3 py-2 rounded-lg border border-slate-600 focus:outline-none focus:border-indigo-500 resize-y text-sm"
              rows={6}
              maxLength={2000}
            />
          </div>

          <ProjectSelector
            projects={projects}
            selectedProjectId={projectId}
            onSelectProject={setProjectId}
            onCreateProject={onCreateProject}
            onUpdateProject={onUpdateProject}
            onDeleteProject={onDeleteProject}
            isLoading={isLoadingProjects}
          />
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors text-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !projectId || isSaving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm cursor-pointer"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
