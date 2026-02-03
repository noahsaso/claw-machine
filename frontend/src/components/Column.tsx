import { useState, useEffect, useCallback } from 'react'
import { useDroppable, useDndMonitor } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { TaskCard } from './TaskCard'
import { ProjectSelector } from './ProjectSelector'
import type { Task, TaskStatus, Worker, Project, MergeStrategy } from '../types'
import { getProjectBranch } from '../api'
import clsx from 'clsx'

interface ColumnProps {
  id: TaskStatus
  title: string
  tasks: Task[]
  workers: Worker[]
  onDeleteTask: (taskId: string) => void
  onEditTask?: (task: Task) => void
  onMoveToInProgress?: (taskId: string) => void
  onCreateTask?: (
    title: string,
    description: string,
    projectId?: string,
    targetBranch?: string | null,
    mergeStrategy?: MergeStrategy
  ) => void
  projects?: Project[]
  defaultProjectId?: string | null
  onCreateProject?: (path: string) => Promise<Project>
  isLoadingProjects?: boolean
  onViewTaskLogs?: (task: Task) => void
  setLastUsedProject: (projectId: string | null) => void
}

const columnColors: Record<TaskStatus, string> = {
  backlog: 'border-slate-500',
  in_progress: 'border-blue-500',
  done: 'border-green-500',
}

const columnBgColors: Record<TaskStatus, string> = {
  backlog: 'bg-slate-500/10',
  in_progress: 'bg-blue-500/10',
  done: 'bg-green-500/10',
}

export function Column({
  id,
  title,
  tasks,
  workers,
  onDeleteTask,
  onEditTask,
  onMoveToInProgress,
  onCreateTask,
  projects = [],
  defaultProjectId,
  onCreateProject,
  isLoadingProjects,
  onViewTaskLogs,
  setLastUsedProject,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const [isCreating, setIsCreating] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  )
  const [targetBranch, setTargetBranch] = useState<string>('')
  const [mergeStrategy, setMergeStrategy] = useState<MergeStrategy>(null)
  const [isFetchingBranch, setIsFetchingBranch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isOverColumn, setIsOverColumn] = useState(false)

  // Track when dragging over this column or any task in this column
  useDndMonitor({
    onDragOver(event) {
      const overId = event.over?.id as string | undefined
      if (!overId) {
        setIsOverColumn(false)
        return
      }
      // Check if over the column itself or any task in this column
      const isOverThisColumn =
        overId === id || tasks.some((t) => t.id === overId)
      setIsOverColumn(isOverThisColumn)
    },
    onDragEnd() {
      setIsOverColumn(false)
    },
    onDragCancel() {
      setIsOverColumn(false)
    },
  })

  const handleSelectProject = useCallback((projectId: string | null) => {
    setLastUsedProject(projectId)
    setSelectedProjectId(projectId)
    if (!projectId) {
      setTargetBranch('')
      setIsFetchingBranch(false)
      return
    }

    setIsFetchingBranch(true)
    getProjectBranch(projectId)
      .then(({ branch }) => {
        setTargetBranch(branch)
      })
      .catch((err) => {
        console.error('Failed to fetch project branch:', err)
        setTargetBranch('')
      })
      .finally(() => {
        setIsFetchingBranch(false)
      })
  }, [setLastUsedProject])

  // Sync selected project with default when opening task creation form
  useEffect(() => {
    if (isCreating && defaultProjectId) {
      setTimeout(() => {
        handleSelectProject(defaultProjectId)
      }, 0)
    }
  }, [isCreating, defaultProjectId, handleSelectProject])

  const getWorkerForTask = (taskId: string) => {
    return workers.find((w) => w.currentTask === taskId)
  }

  // Fuzzy search filter - matches if search terms appear in title or description
  const filteredTasks = tasks.filter((task) => {
    if (!searchQuery.trim()) return true

    const query = searchQuery.toLowerCase()
    const title = task.title.toLowerCase()
    const description = (task.description || '').toLowerCase()
    const searchText = `${title} ${description}`

    // Split query into words and check if all words appear in the task
    const queryWords = query.split(/\s+/).filter((w) => w.length > 0)
    return queryWords.every((word) => searchText.includes(word))
  })

  const handleCreateTask = () => {
    if (newTaskTitle.trim() && onCreateTask) {
      if (!selectedProjectId) {
        alert('Please select a project before creating a task')
        return
      }
      onCreateTask(
        newTaskTitle.trim(),
        newTaskDescription.trim(),
        selectedProjectId,
        targetBranch || null,
        mergeStrategy
      )
      setNewTaskTitle('')
      setNewTaskDescription('')
      setTargetBranch('')
      setMergeStrategy(null)
      setIsCreating(false)
    }
  }

  return (
    <div
      className={clsx(
        `flex flex-col min-w-[260px] sm:min-w-[280px] md:min-w-[300px] max-w-[320px] sm:max-w-[350px] flex-1 rounded-xl border-t-4`,
        columnColors[id],
        columnBgColors[id],
        {
          'ring-2 ring-indigo-500': isOver || isOverColumn,
        }
      )}
    >
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-200">{title}</h2>
          <div className="flex items-center gap-2">
            {onCreateTask && (
              <button
                onClick={() => setIsCreating(true)}
                className="text-slate-400 hover:text-indigo-400 text-lg font-bold transition-colors cursor-pointer"
                title="New Task"
              >
                +
              </button>
            )}
            <span className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded-full">
              {searchQuery ? filteredTasks.length : tasks.length}
            </span>
          </div>
        </div>
        <input
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-700/50 text-slate-100 px-3 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:border-indigo-500 text-xs placeholder-slate-500"
        />
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 p-3 space-y-3 overflow-y-auto min-h-[200px]"
      >
        {isCreating && onCreateTask && (
          <div className="bg-slate-800 p-3 rounded-lg border border-slate-600">
            {onCreateProject && (
              <ProjectSelector
                projects={projects}
                selectedProjectId={selectedProjectId}
                onSelectProject={handleSelectProject}
                onCreateProject={onCreateProject}
                isLoading={isLoadingProjects}
              />
            )}
            <input
              type="text"
              placeholder="Task title"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="w-full bg-slate-700 text-slate-100 px-3 py-2 rounded-lg mb-2 border border-slate-600 focus:outline-none focus:border-indigo-500 text-sm"
              autoFocus
            />
            <textarea
              placeholder="Description (optional)"
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
              className="w-full bg-slate-700 text-slate-100 px-3 py-2 rounded-lg mb-2 border border-slate-600 focus:outline-none focus:border-indigo-500 resize-y text-sm"
              rows={4}
            />
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="main"
                  value={targetBranch}
                  onChange={(e) => setTargetBranch(e.target.value)}
                  disabled={isFetchingBranch}
                  className="w-full bg-slate-700 text-slate-100 px-3 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:border-indigo-500 text-xs disabled:opacity-50"
                  title="Target branch"
                />
              </div>
              <div className="flex-1">
                <select
                  value={mergeStrategy ?? ''}
                  onChange={(e) =>
                    setMergeStrategy(
                      e.target.value === ''
                        ? null
                        : (e.target.value as 'direct' | 'pr')
                    )
                  }
                  className="w-full bg-slate-700 text-slate-100 px-2 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:border-indigo-500 text-xs cursor-pointer"
                  title="Merge strategy"
                >
                  <option value="">Reviewer decides</option>
                  <option value="direct">Direct merge</option>
                  <option value="pr">Create PR</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateTask}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors text-sm cursor-pointer"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreating(false)
                  setNewTaskTitle('')
                  setNewTaskDescription('')
                }}
                className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors text-sm cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <SortableContext
          items={filteredTasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              worker={getWorkerForTask(task.id)}
              onDelete={onDeleteTask}
              onEdit={onEditTask}
              onMoveToInProgress={onMoveToInProgress}
              onViewTaskLogs={onViewTaskLogs}
            />
          ))}
        </SortableContext>

        {filteredTasks.length === 0 && !isCreating && (
          <div className="flex items-center justify-center h-24 text-slate-500 text-sm border-2 border-dashed border-slate-700 rounded-lg">
            {searchQuery ? 'No matching tasks' : 'Drop tasks here'}
          </div>
        )}
      </div>
    </div>
  )
}
