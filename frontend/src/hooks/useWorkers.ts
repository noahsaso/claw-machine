import { useState, useCallback, useEffect } from 'react'
import type { Worker } from '../types'
import { apiFetch } from '../api'

export function useWorkers() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWorkers = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await apiFetch('/api/workers')
      if (!response.ok) throw new Error('Failed to fetch workers')
      const data = await response.json()
      const mappedWorkers = data.map(
        (w: {
          id: string
          name: string
          status: string
          currentTask?: string | null
        }) => ({
          id: w.id,
          name: w.name,
          status: w.status as Worker['status'],
          currentTask: w.currentTask || undefined,
          createdAt: new Date().toISOString(),
        })
      )
      setWorkers(mappedWorkers.filter((w: Worker) => w.status !== 'closed'))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workers')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const closeWorker = useCallback(async (id: string) => {
    const response = await apiFetch(`/api/workers/${id}/close`, {
      method: 'POST',
    })
    if (!response.ok) throw new Error('Failed to close worker')
    setWorkers((prev) => prev.filter((w) => w.id !== id))
  }, [])

  const updateWorkerFromWebSocket = useCallback((worker: Worker) => {
    setWorkers((prev) => {
      const exists = prev.some((w) => w.id === worker.id)
      if (worker.status === 'closed') {
        return prev.filter((w) => w.id !== worker.id)
      }
      if (exists) {
        return prev.map((w) => (w.id === worker.id ? worker : w))
      }
      return [...prev, worker]
    })
  }, [])

  const setWorkersFromWebSocket = useCallback((newWorkers: Worker[]) => {
    // Filter out closed workers and update state
    setWorkers(newWorkers.filter((w) => w.status !== 'closed'))
  }, [])

  useEffect(() => {
    fetchWorkers()
  }, [fetchWorkers])

  return {
    workers,
    isLoading,
    error,
    closeWorker,
    updateWorkerFromWebSocket,
    setWorkersFromWebSocket,
    refetch: fetchWorkers,
  }
}
