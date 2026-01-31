import { useState, useEffect, useRef } from 'react'
import clsx from 'clsx'
import type { Worker, Task } from '../types'

interface WorkerPanelProps {
  workers: Worker[]
  tasks: Task[]
  pendingMoves?: Set<string>
  onCloseWorker: (workerId: string) => Promise<void>
  onViewTaskLogs: (task: Task) => void
  isConnected: boolean
  hideHeader?: boolean
}

const statusColors: Record<string, { bg: string; text: string }> = {
  spawning: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  active: { bg: 'bg-green-500/20', text: 'text-green-400' },
  busy: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  idle: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
}

const taskStatusColors: Record<string, string> = {
  backlog: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  done: 'bg-green-500',
}

export function WorkerPanel({
  workers,
  tasks,
  pendingMoves,
  onCloseWorker,
  onViewTaskLogs,
  isConnected,
  hideHeader = false,
}: WorkerPanelProps) {
  const [confirmingClose, setConfirmingClose] = useState<string | null>(null)
  const [closingWorkers, setClosingWorkers] = useState<Set<string>>(new Set())
  const confirmTimeoutRef = useRef<number | null>(null)

  // Reset confirm state after 3 seconds of inactivity
  useEffect(() => {
    if (confirmingClose) {
      confirmTimeoutRef.current = window.setTimeout(() => {
        setConfirmingClose(null)
      }, 3000)
    }
    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current)
      }
    }
  }, [confirmingClose])

  const handleCloseClick = async (workerId: string) => {
    if (closingWorkers.has(workerId)) return

    if (confirmingClose === workerId) {
      setConfirmingClose(null)
      setClosingWorkers((prev) => new Set(prev).add(workerId))
      try {
        await onCloseWorker(workerId)
      } finally {
        setClosingWorkers((prev) => {
          const next = new Set(prev)
          next.delete(workerId)
          return next
        })
      }
    } else {
      setConfirmingClose(workerId)
    }
  }

  // Get tasks with workers starting (from backend state)
  // Filter out tasks that already have a worker in the workers list (worker has spawned)
  const spawningTasks = tasks.filter((t) => {
    if (t.workerStatus !== 'starting') return false
    // Check if a worker already exists for this task
    const hasWorker = workers.some((w) => w.currentTask === t.id)
    return !hasWorker
  })

  return (
    <div
      className={clsx(
        'h-full flex flex-col',
        !hideHeader && 'bg-slate-800 rounded-xl border border-slate-700'
      )}
    >
      {!hideHeader && (
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-200">Workers</h2>
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  'w-2 h-2 rounded-full',
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                )}
              />
              <span className="text-xs text-slate-400">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Show spawning indicators */}
        {spawningTasks.map((task) => (
          <div
            key={`spawning-${task.id}`}
            className="bg-slate-700/50 rounded-lg border border-yellow-500/50 overflow-hidden animate-pulse"
          >
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-yellow-400 animate-spin">⏳</span>
                <span className="font-medium text-slate-200 text-sm">
                  Spawning worker...
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                Task: {task.title}
              </p>
            </div>
          </div>
        ))}

        {workers.length === 0 && spawningTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-500 text-sm">
            <span className="text-2xl mb-2">🤖</span>
            <span>No active workers</span>
            <span className="text-xs mt-1">
              Drag a task to In Progress to spawn a worker
            </span>
          </div>
        ) : (
          workers.map((worker) => {
            const colors = statusColors[worker.status] || statusColors.idle
            const task = tasks.find((t) => t.id === worker.currentTask)
            // Check if worker is closing due to task being dragged to backlog
            const isClosingFromDrag =
              task && task.status === 'backlog' && pendingMoves?.has(task.id)
            const isClosing = closingWorkers.has(worker.id) || isClosingFromDrag

            return (
              <div
                key={worker.id}
                className={clsx(
                  'bg-slate-700/50 rounded-lg border overflow-hidden',
                  isClosing ? 'border-yellow-500/50' : 'border-slate-600'
                )}
              >
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200 text-sm">
                        {worker.name}
                      </span>
                      {isClosing ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                          closing
                        </span>
                      ) : (
                        <span
                          className={clsx(
                            'text-xs px-2 py-0.5 rounded-full',
                            colors.bg,
                            colors.text
                          )}
                        >
                          {worker.status}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleCloseClick(worker.id)}
                      disabled={isClosing}
                      className={clsx(
                        'transition-colors text-xs cursor-pointer',
                        isClosing
                          ? 'text-yellow-400 cursor-wait'
                          : confirmingClose === worker.id
                            ? 'text-red-400 hover:text-red-300 font-medium'
                            : 'text-slate-400 hover:text-red-400'
                      )}
                      title={
                        isClosing
                          ? 'Closing...'
                          : confirmingClose === worker.id
                            ? 'Click to confirm'
                            : 'Close worker'
                      }
                    >
                      {isClosing
                        ? 'Closing...'
                        : confirmingClose === worker.id
                          ? 'Confirm?'
                          : '✕'}
                    </button>
                  </div>

                  {task && (
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={clsx(
                          'w-2 h-2 rounded-full',
                          taskStatusColors[task.status] || 'bg-gray-500'
                        )}
                      />
                      <span className="text-xs text-slate-400 truncate">
                        {task.title}
                      </span>
                    </div>
                  )}

                  {task && (
                    <button
                      onClick={() => onViewTaskLogs(task)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                    >
                      View Logs
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
