import { useState, useCallback, useEffect } from 'react'
import type { Project } from '../types'
import { apiFetch } from '../api'

const LAST_USED_PROJECT_KEY = 'claw-machine-last-used-project'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null) // For filtering view (null = show all)
  const [lastUsedProjectId, setLastUsedProjectIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_USED_PROJECT_KEY)
    } catch {
      return null
    }
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await apiFetch('/api/projects')
      if (!response.ok) throw new Error('Failed to fetch projects')
      const data = await response.json()
      setProjects(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects')
      setProjects([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createProject = useCallback(async (path: string) => {
    const name = path.split('/').pop() || path
    const response = await apiFetch('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name, path }),
    })
    if (!response.ok) throw new Error('Failed to create project')
    const project = await response.json()
    setProjects((prev) => [...prev, project])
    return project
  }, [])

  const updateProject = useCallback(async (id: string, path: string) => {
    const name = path.split('/').pop() || path
    const response = await apiFetch(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, path }),
    })
    if (!response.ok) throw new Error('Failed to update project')
    const project = await response.json()
    setProjects((prev) => prev.map((p) => (p.id === id ? project : p)))
    return project
  }, [])

  const deleteProject = useCallback(async (id: string) => {
    const response = await apiFetch(`/api/projects/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('Failed to delete project')
    setProjects((prev) => prev.filter((p) => p.id !== id))
    // Clear filter if deleted project was selected
    setFilterProjectId((prev) => (prev === id ? null : prev))
  }, [])

  const setFilter = useCallback((projectId: string | null) => {
    setFilterProjectId(projectId)
  }, [])

  const setLastUsedProject = useCallback((projectId: string | null) => {
    setLastUsedProjectIdState(projectId)
    try {
      if (projectId) {
        localStorage.setItem(LAST_USED_PROJECT_KEY, projectId)
      } else {
        localStorage.removeItem(LAST_USED_PROJECT_KEY)
      }
    } catch {
      // localStorage may be unavailable
    }
  }, [])

  const filteredProject = projects.find((p) => p.id === filterProjectId) || null

  // Default for new tasks: use filter if active, then last used project, otherwise first project
  // Validate that the stored project still exists
  const validLastUsedProjectId = lastUsedProjectId && projects.some((p) => p.id === lastUsedProjectId)
    ? lastUsedProjectId
    : null
  const defaultNewTaskProjectId =
    filterProjectId || validLastUsedProjectId || (projects.length > 0 ? projects[0].id : null)

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  return {
    projects,
    filterProjectId,
    filteredProject,
    defaultNewTaskProjectId,
    isLoading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    setFilter,
    setLastUsedProject,
  }
}
