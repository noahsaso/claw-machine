import { useCallback, useState, useRef, useEffect } from 'react'
import {
  KanbanBoard,
  WorkerPanel,
  ProjectFilter,
  ProjectsModal,
  LogModal,
  EditTaskModal,
} from './components'
import { useWebSocket, useTasks, useWorkers, useProjects } from './hooks'
import {
  isAuthenticated,
  setPassword,
  validatePassword,
  getWebSocketUrl,
  clearPassword,
} from './api'
import type { WebSocketMessage, TaskUpdatePayload, Worker, Task } from './types'
import clsx from 'clsx'

interface WorkersUpdateMessage {
  type: 'workers_update'
  workers: Array<{
    id: string
    name: string
    status: string
    currentTask: string | null
  }>
}

interface TasksUpdateMessage {
  type: 'tasks_update'
  tasks: Task[]
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [password, setPasswordValue] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const valid = await validatePassword(password)
    if (valid) {
      setPassword(password)
      onLogin()
    } else {
      setError('Invalid password')
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="bg-slate-800 p-8 rounded-lg shadow-xl w-96">
        <h1 className="text-2xl font-bold text-white mb-6">Claw Machine</h1>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPasswordValue(e.target.value)}
            placeholder="Enter password"
            className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-blue-500 focus:outline-none mb-4"
            autoFocus
          />
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 bg-blue-600 text-white rounded cursor-pointer hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Checking...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Dashboard() {
  const {
    tasks,
    pendingMoves,
    createTask,
    updateTask,
    moveTask,
    deleteTask,
    updateTaskFromWebSocket,
    setTasksFromWebSocket,
    refetch: refetchTasks,
  } = useTasks()
  const { workers, closeWorker, setWorkersFromWebSocket } = useWorkers()
  const {
    projects,
    defaultNewTaskProjectId,
    filterProjectId,
    setFilter,
    createProject,
    updateProject,
    deleteProject,
    isLoading: isLoadingProjects,
  } = useProjects()

  // Selected task for log modal
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  // Task editing state
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // Projects modal state
  const [showProjectsModal, setShowProjectsModal] = useState(false)

  // Mobile sidebar state
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)

  // Track tasks in a ref for access in WebSocket callback without causing re-subscriptions
  const tasksRef = useRef(tasks)
  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage | WorkersUpdateMessage | TasksUpdateMessage) => {
      switch (message.type) {
        case 'task_update':
          updateTaskFromWebSocket((message.payload as TaskUpdatePayload).task)
          break
        case 'tasks_update': {
          const tasksMsg = message as TasksUpdateMessage
          setTasksFromWebSocket(tasksMsg.tasks)
          // Update selectedTask if it's in the updated tasks list (to refresh logs)
          if (selectedTask) {
            const updatedTask = tasksMsg.tasks.find(
              (t) => t.id === selectedTask.id
            )
            if (updatedTask) {
              setSelectedTask(updatedTask)
            }
          }
          break
        }
        case 'workers_update': {
          const workersMsg = message as WorkersUpdateMessage
          const mappedWorkers: Worker[] = workersMsg.workers.map((w) => ({
            id: w.id,
            name: w.name,
            status: w.status as Worker['status'],
            currentTask: w.currentTask || undefined,
            createdAt: new Date().toISOString(),
          }))
          setWorkersFromWebSocket(mappedWorkers)

          // Check if any spawning tasks now have a worker - if so, refetch tasks to sync state
          const spawningTasks = tasksRef.current.filter(
            (t) => t.workerStatus === 'starting'
          )
          if (spawningTasks.length > 0) {
            const hasNewlySpawnedWorker = spawningTasks.some((task) =>
              mappedWorkers.some((w) => w.currentTask === task.id)
            )
            if (hasNewlySpawnedWorker) {
              refetchTasks()
            }
          }
          break
        }
      }
    },
    [
      updateTaskFromWebSocket,
      setTasksFromWebSocket,
      setWorkersFromWebSocket,
      refetchTasks,
      selectedTask,
    ]
  )

  const wsUrl = getWebSocketUrl()
  const { isConnected } = useWebSocket(wsUrl, {
    onMessage: handleWebSocketMessage,
  })

  const handleCloseWorker = async (workerId: string) => {
    try {
      await closeWorker(workerId)
    } catch (err) {
      console.error('Failed to close worker:', err)
    }
  }

  const handleLogout = () => {
    clearPassword()
    window.location.reload()
  }

  const handleViewTaskLogs = (task: Task) => {
    setSelectedTask(task)
  }

  const handleCloseLogModal = () => {
    setSelectedTask(null)
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
  }

  const handleSaveTask = async (
    taskId: string,
    updates: { title: string; description: string; projectId?: string }
  ) => {
    await updateTask(taskId, updates)
  }

  return (
    <div className="min-h-screen bg-slate-900 p-3 sm:p-4 md:p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4">
          <div className="flex items-center justify-between gap-4 w-full sm:w-auto">
            <h1 className="text-lg sm:text-xl font-bold text-white">
              Claw Machine
            </h1>
            {/* Mobile worker panel toggle */}
            <button
              onClick={() => setShowMobileSidebar(!showMobileSidebar)}
              className="lg:hidden flex items-center gap-2 text-sm text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 cursor-pointer"
            >
              <span className="text-lg">🤖</span>
              <span>{workers.length}</span>
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <ProjectFilter
              projects={projects}
              filterProjectId={filterProjectId}
              onFilterChange={setFilter}
              isLoading={isLoadingProjects}
            />
            <button
              onClick={() => setShowProjectsModal(true)}
              className="text-slate-400 hover:text-white p-1.5 transition-colors cursor-pointer"
              title="Manage projects"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path
                  fillRule="evenodd"
                  d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-400 hover:text-white whitespace-nowrap cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="h-[calc(100vh-120px)] sm:h-[calc(100vh-100px)] flex gap-4 lg:gap-6">
          <div className="flex-1 min-w-0">
            <KanbanBoard
              tasks={
                filterProjectId
                  ? tasks.filter((t) => t.projectId === filterProjectId)
                  : tasks
              }
              workers={workers}
              onMoveTask={moveTask}
              onDeleteTask={deleteTask}
              onEditTask={handleEditTask}
              onCreateTask={createTask}
              projects={projects}
              defaultNewTaskProjectId={defaultNewTaskProjectId}
              onCreateProject={createProject}
              isLoadingProjects={isLoadingProjects}
              onViewTaskLogs={handleViewTaskLogs}
            />
          </div>
          {/* Desktop sidebar */}
          <div className="hidden lg:block w-80 flex-shrink-0">
            <WorkerPanel
              workers={workers}
              tasks={tasks}
              pendingMoves={pendingMoves}
              onCloseWorker={handleCloseWorker}
              onViewTaskLogs={handleViewTaskLogs}
              isConnected={isConnected}
            />
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {showMobileSidebar && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setShowMobileSidebar(false)}
        >
          <div
            className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-slate-900 border-l border-slate-700 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <h2 className="font-bold text-slate-200">Workers</h2>
                <div className="flex items-center gap-1.5">
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
              <button
                onClick={() => setShowMobileSidebar(false)}
                className="text-slate-400 hover:text-white text-xl cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="h-[calc(100%-60px)]">
              <WorkerPanel
                workers={workers}
                tasks={tasks}
                pendingMoves={pendingMoves}
                onCloseWorker={handleCloseWorker}
                onViewTaskLogs={(task) => {
                  setShowMobileSidebar(false)
                  handleViewTaskLogs(task)
                }}
                isConnected={isConnected}
                hideHeader
              />
            </div>
          </div>
        </div>
      )}

      {/* Task Log Modal */}
      {selectedTask && (
        <LogModal task={selectedTask} onClose={handleCloseLogModal} />
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          projects={projects}
          onSave={handleSaveTask}
          onClose={() => setEditingTask(null)}
          onCreateProject={createProject}
          onUpdateProject={updateProject}
          onDeleteProject={deleteProject}
          isLoadingProjects={isLoadingProjects}
        />
      )}

      {/* Projects Modal */}
      {showProjectsModal && (
        <ProjectsModal
          projects={projects}
          onClose={() => setShowProjectsModal(false)}
          onCreateProject={createProject}
          onUpdateProject={updateProject}
          onDeleteProject={deleteProject}
        />
      )}
    </div>
  )
}

function App() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated())

  if (!authenticated) {
    return <LoginScreen onLogin={() => setAuthenticated(true)} />
  }

  return <Dashboard />
}

export default App
