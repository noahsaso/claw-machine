import { useState, useCallback, useEffect, useRef } from 'react'
import type { Task, TaskStatus, MergeStrategy } from '../types'
import { apiFetch } from '../api'

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingMoves, setPendingMoves] = useState<Set<string>>(new Set())
  // Track optimistic statuses so WebSocket updates don't overwrite them
  const optimisticStatusRef = useRef<Map<string, TaskStatus>>(new Map())

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await apiFetch('/api/tasks')
      if (!response.ok) throw new Error('Failed to fetch tasks')
      const data = await response.json()
      setTasks(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createTask = useCallback(
    async (
      title: string,
      description: string,
      projectId?: string,
      targetBranch?: string | null,
      mergeStrategy?: MergeStrategy
    ) => {
      const response = await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          projectId,
          targetBranch,
          mergeStrategy,
        }),
      })
      if (!response.ok) throw new Error('Failed to create task')
      const task = await response.json()
      // De-duplicate: WebSocket may have already added this task
      setTasks((prev) => {
        const exists = prev.some((t) => t.id === task.id)
        if (exists) {
          return prev.map((t) => (t.id === task.id ? task : t))
        }
        return [...prev, task]
      })
      return task
    },
    []
  )

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    const response = await apiFetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
    if (!response.ok) throw new Error('Failed to update task')
    const updatedTask = await response.json()
    setTasks((prev) => prev.map((t) => (t.id === id ? updatedTask : t)))
    return updatedTask
  }, [])

  const moveTask = useCallback(
    async (id: string, status: TaskStatus) => {
      // Check if move is already pending
      if (pendingMoves.has(id)) {
        console.log('Move already pending for task:', id)
        return null
      }

      // Capture original status for revert
      const originalTask = tasks.find((t) => t.id === id)
      const originalStatus = originalTask?.status

      // Optimistic update - move card immediately and clear any previous error
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status, error: null } : t))
      )

      // Track optimistic status so WebSocket doesn't overwrite it
      optimisticStatusRef.current.set(id, status)

      // Mark as pending
      setPendingMoves((prev) => new Set(prev).add(id))

      try {
        const response = await apiFetch(`/api/tasks/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        })
        if (!response.ok) {
          const responseError =
            (await response
              .json()
              .then((data) => data?.error)
              .catch(() => null)) || 'Failed to move task'
          throw new Error(responseError)
        }
        const updatedTask = await response.json()
        setTasks((prev) => prev.map((t) => (t.id === id ? updatedTask : t)))
        return updatedTask
      } catch (err) {
        // Revert optimistic update and set error on task
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to move task'
        console.error('Move failed, reverting:', err)
        setTasks((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: originalStatus ?? t.status,
                  error: errorMessage,
                }
              : t
          )
        )
        throw err
      } finally {
        // Clear pending state and optimistic status
        optimisticStatusRef.current.delete(id)
        setPendingMoves((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    },
    [pendingMoves, tasks]
  )

  const deleteTask = useCallback(async (id: string) => {
    const response = await apiFetch(`/api/tasks/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('Failed to delete task')
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const updateTaskFromWebSocket = useCallback((task: Task) => {
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === task.id)
      if (exists) {
        return prev.map((t) => (t.id === task.id ? task : t))
      }
      return [...prev, task]
    })
  }, [])

  const setTasksFromWebSocket = useCallback((newTasks: Task[]) => {
    // Preserve optimistic statuses for pending moves
    const optimistic = optimisticStatusRef.current
    if (optimistic.size === 0) {
      setTasks(newTasks)
    } else {
      setTasks(
        newTasks.map((t) =>
          optimistic.has(t.id) ? { ...t, status: optimistic.get(t.id)! } : t
        )
      )
    }
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  return {
    tasks,
    isLoading,
    error,
    pendingMoves,
    createTask,
    updateTask,
    moveTask,
    deleteTask,
    updateTaskFromWebSocket,
    setTasksFromWebSocket,
    refetch: fetchTasks,
  }
}
