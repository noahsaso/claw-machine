import { useState, useCallback, useEffect } from 'react'
import type { Project } from '../types'
import { apiFetch } from '../api'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null) // For filtering view (null = show all)
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

  const filteredProject = projects.find((p) => p.id === filterProjectId) || null

  // Default for new tasks: use filter if active, otherwise first project
  const defaultNewTaskProjectId =
    filterProjectId || (projects.length > 0 ? projects[0].id : null)

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
  }
}
