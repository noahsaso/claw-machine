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
  // Track optimistic task IDs (temporary IDs used during creation)
  const optimisticTaskIdsRef = useRef<Set<string>>(new Set())

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
      // Generate a temporary ID for optimistic update
      const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const now = new Date().toISOString()

      // Create optimistic task
      const optimisticTask: Task = {
        id: tempId,
        title,
        description,
        status: 'backlog',
        projectId: projectId || '',
        targetBranch,
        mergeStrategy,
        createdAt: now,
        updatedAt: now,
        isOptimistic: true,
      }

      // Track this optimistic task ID
      optimisticTaskIdsRef.current.add(tempId)

      // Add optimistic task immediately
      setTasks((prev) => [...prev, optimisticTask])

      try {
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

        // Remove optimistic task ID from tracking
        optimisticTaskIdsRef.current.delete(tempId)

        // Replace optimistic task with real task (or handle WebSocket already adding it)
        setTasks((prev) => {
          // Remove the optimistic task
          const withoutOptimistic = prev.filter((t) => t.id !== tempId)
          // Check if real task already exists (from WebSocket)
          const exists = withoutOptimistic.some((t) => t.id === task.id)
          if (exists) {
            return withoutOptimistic.map((t) => (t.id === task.id ? task : t))
          }
          return [...withoutOptimistic, task]
        })
        return task
      } catch (err) {
        // Remove optimistic task on error
        optimisticTaskIdsRef.current.delete(tempId)
        setTasks((prev) => prev.filter((t) => t.id !== tempId))
        throw err
      }
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
    // Mark task as deleting immediately
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isDeleting: true } : t))
    )

    try {
      const response = await apiFetch(`/api/tasks/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete task')
      // Remove the task after successful deletion
      setTasks((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      // Revert isDeleting on error
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isDeleting: false } : t))
      )
      throw err
    }
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
    const optimisticStatuses = optimisticStatusRef.current
    const optimisticTaskIds = optimisticTaskIdsRef.current

    setTasks((prev) => {
      // Keep any optimistic tasks that are still pending
      const optimisticTasks = prev.filter(
        (t) => t.isOptimistic && optimisticTaskIds.has(t.id)
      )

      // Apply optimistic statuses to incoming tasks
      let mergedTasks =
        optimisticStatuses.size === 0
          ? newTasks
          : newTasks.map((t) =>
              optimisticStatuses.has(t.id)
                ? { ...t, status: optimisticStatuses.get(t.id)! }
                : t
            )

      // Add back optimistic tasks
      if (optimisticTasks.length > 0) {
        mergedTasks = [...mergedTasks, ...optimisticTasks]
      }

      return mergedTasks
    })
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
