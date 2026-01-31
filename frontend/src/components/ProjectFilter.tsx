import type { Project } from '../types'

interface ProjectFilterProps {
  projects: Project[]
  filterProjectId: string | null
  onFilterChange: (projectId: string | null) => void
  isLoading?: boolean
}

export function ProjectFilter({
  projects,
  filterProjectId,
  onFilterChange,
  isLoading,
}: ProjectFilterProps) {
  return (
    <div className="flex items-center gap-2 flex-1 sm:flex-initial">
      <label className="text-sm text-slate-400 hidden sm:inline">Filter:</label>
      <select
        value={filterProjectId || '__all__'}
        onChange={(e) =>
          onFilterChange(e.target.value === '__all__' ? null : e.target.value)
        }
        className="bg-slate-700 text-slate-100 px-3 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:border-indigo-500 text-sm w-full sm:w-auto"
        disabled={isLoading}
      >
        <option value="__all__">All Projects</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.exists === false ? '⚠ ' : ''}
            {project.name}
          </option>
        ))}
      </select>
    </div>
  )
}
