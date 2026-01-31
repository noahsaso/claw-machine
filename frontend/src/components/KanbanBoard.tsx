import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Column } from './Column'
import { TaskCard } from './TaskCard'
import type { Task, TaskStatus, Worker, Project } from '../types'

interface KanbanBoardProps {
  tasks: Task[]
  workers: Worker[]
  onMoveTask: (taskId: string, status: TaskStatus) => void
  onDeleteTask: (taskId: string) => void
  onEditTask?: (task: Task) => void
  onCreateTask: (title: string, description: string, projectId?: string) => void
  projects?: Project[]
  defaultNewTaskProjectId?: string | null
  onCreateProject?: (path: string) => Promise<Project>
  isLoadingProjects?: boolean
  onViewTaskLogs?: (task: Task) => void
}

const columns: { id: TaskStatus; title: string }[] = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
]

export function KanbanBoard({
  tasks,
  workers,
  onMoveTask,
  onDeleteTask,
  onEditTask,
  onCreateTask,
  projects = [],
  defaultNewTaskProjectId,
  onCreateProject,
  isLoadingProjects,
  onViewTaskLogs,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.id as string
    const task = tasks.find((t) => t.id === taskId)
    // Prevent dragging tasks with workers starting
    if (task?.workerStatus === 'starting') {
      return
    }
    if (task) setActiveTask(task)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const taskId = active.id as string
    const overId = over.id as string

    let targetStatus: TaskStatus | null = null

    // Check if dropping on a column
    if (columns.some((col) => col.id === overId)) {
      targetStatus = overId as TaskStatus
    } else {
      // Check if dropping on another task
      const overTask = tasks.find((t) => t.id === overId)
      if (overTask) {
        targetStatus = overTask.status
      }
    }

    if (targetStatus) {
      // Only call move if status actually changes
      const task = tasks.find((t) => t.id === taskId)
      if (task && task.status !== targetStatus) {
        // Backend handles spawn/close automatically on status change
        onMoveTask(taskId, targetStatus)
      }
    }
  }

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter((t) => t.status === status)
  }

  return (
    <div className="flex flex-col h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 sm:gap-4 flex-1 overflow-x-auto pb-4 -mx-3 px-3 sm:mx-0 sm:px-0">
          {columns.map((column) => (
            <Column
              key={column.id}
              id={column.id}
              title={column.title}
              tasks={getTasksByStatus(column.id)}
              workers={workers}
              onDeleteTask={onDeleteTask}
              onEditTask={onEditTask}
              onMoveToInProgress={
                column.id === 'backlog'
                  ? (taskId) => onMoveTask(taskId, 'in_progress')
                  : undefined
              }
              onCreateTask={column.id === 'backlog' ? onCreateTask : undefined}
              projects={column.id === 'backlog' ? projects : undefined}
              defaultProjectId={
                column.id === 'backlog' ? defaultNewTaskProjectId : undefined
              }
              onCreateProject={
                column.id === 'backlog' ? onCreateProject : undefined
              }
              isLoadingProjects={
                column.id === 'backlog' ? isLoadingProjects : undefined
              }
              onViewTaskLogs={onViewTaskLogs}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <TaskCard
              task={activeTask}
              worker={workers.find((w) => w.currentTask === activeTask.id)}
              onDelete={() => {}}
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
