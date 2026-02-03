import { useState, useEffect, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, Worker } from '../types'
import clsx from 'clsx'

function formatTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface TaskCardProps {
  task: Task
  worker?: Worker
  onDelete: (taskId: string) => void
  onEdit?: (task: Task) => void
  onMoveToInProgress?: (taskId: string) => void
  onViewTaskLogs?: (task: Task) => void
}

export function TaskCard({
  task,
  worker,
  onDelete,
  onEdit,
  onMoveToInProgress,
  onViewTaskLogs,
}: TaskCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const confirmTimeoutRef = useRef<number | null>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: task.isOptimistic || task.isDeleting })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Reset confirm state after 3 seconds of inactivity
  useEffect(() => {
    if (confirmingDelete) {
      confirmTimeoutRef.current = window.setTimeout(() => {
        setConfirmingDelete(false)
      }, 3000)
    }
    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current)
      }
    }
  }, [confirmingDelete])

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirmingDelete) {
      onDelete(task.id)
      setConfirmingDelete(false)
    } else {
      setConfirmingDelete(true)
    }
  }

  const handleCardClick = () => {
    // Only open logs modal if there's an active worker or task has logs
    if (onViewTaskLogs && (worker || task.logs)) {
      onViewTaskLogs(task)
    }
  }

  const isClickable = onViewTaskLogs && (worker || task.logs)

  const statusColors: Record<string, string> = {
    spawning: 'bg-yellow-500',
    active: 'bg-green-500',
    busy: 'bg-blue-500',
    idle: 'bg-gray-500',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(task.isOptimistic || task.isDeleting ? {} : listeners)}
      onClick={task.isOptimistic || task.isDeleting ? undefined : handleCardClick}
      className={clsx(
        'bg-slate-700 rounded-lg p-4 shadow-lg border border-slate-600',
        {
          'opacity-50 shadow-2xl': isDragging,
          'hover:border-indigo-500 hover:bg-slate-650 transition-colors':
            isClickable && !task.isOptimistic && !task.isDeleting,
          'cursor-grab active:cursor-grabbing': !task.isOptimistic && !task.isDeleting,
          'opacity-70 cursor-default': task.isOptimistic || task.isDeleting,
        }
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-slate-100 text-sm">{task.title}</h3>
        {!task.isOptimistic && !task.isDeleting && (
          <div className="flex items-center gap-1">
            {onEdit && task.status === 'backlog' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(task)
                }}
                className="text-slate-400 hover:text-indigo-400 text-xs cursor-pointer transition-colors"
                title="Edit task"
              >
                ✎
              </button>
            )}
            <button
              onClick={handleDeleteClick}
              className={clsx(
                'transition-colors text-xs cursor-pointer',
                confirmingDelete
                  ? 'text-red-400 hover:text-red-300 font-medium'
                  : 'text-slate-400 hover:text-red-400'
              )}
            >
              {confirmingDelete ? 'Confirm?' : '✕'}
            </button>
          </div>
        )}
      </div>

      {task.description && (
        <div className="mb-3">
          <p
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className={clsx(
              'text-slate-400 text-xs cursor-pointer transition-opacity hover:opacity-80',
              !isExpanded && 'line-clamp-2'
            )}
          >
            {task.description}
          </p>
        </div>
      )}

      {task.error && (
        <div className="mb-3 px-2 py-1.5 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-400">
          {task.error}
        </div>
      )}

      {/* Timestamp display */}
      {task.status === 'in_progress' && task.startedAt && (
        <div className="mb-2 text-xs text-slate-500">
          Started {formatTimestamp(task.startedAt)}
        </div>
      )}
      {task.status === 'done' && task.completedAt && (
        <div className="mb-2 text-xs text-slate-500">
          Completed {formatTimestamp(task.completedAt)}
        </div>
      )}

      <div className="flex items-center justify-between">
        {task.isDeleting ? (
          <div className="flex items-center gap-2 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs text-red-400">Deleting...</span>
          </div>
        ) : task.isOptimistic ? (
          <div className="flex items-center gap-2 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-xs text-indigo-400">Creating...</span>
          </div>
        ) : task.workerStatus === 'reviewing' ? (
          <div className="flex items-center gap-2 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs text-blue-400">
              Reviewing & merging...
            </span>
          </div>
        ) : worker ? (
          <div className="flex items-center gap-2 group">
            <span
              className={clsx(
                'w-2 h-2 rounded-full',
                statusColors[worker.status] || 'bg-gray-500'
              )}
            />
            <span className="text-xs text-slate-400">{worker.name}</span>
            {onViewTaskLogs && (
              <span className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                (click for logs)
              </span>
            )}
          </div>
        ) : task.status === 'done' ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-400">✓ Complete</span>
            {onViewTaskLogs && task.logs && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onViewTaskLogs(task)
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                Logs
              </button>
            )}
          </div>
        ) : task.status === 'in_progress' ? (
          <div className="flex items-center gap-2 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-xs text-yellow-400">Spawning worker...</span>
          </div>
        ) : task.status === 'backlog' && onMoveToInProgress ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onMoveToInProgress(task.id)
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1 rounded transition-colors font-medium cursor-pointer"
          >
            Start
          </button>
        ) : null}
      </div>
    </div>
  )
}
