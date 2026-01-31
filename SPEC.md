# Claw Machine - Specification

A web-based kanban board for orchestrating Claude Code workers via claude-team.

Built entirely by OpenClaw and Claude Opus 4.5 using this kanban interface itself.

## Overview

Claw Machine is a full-stack task management application that lets you visually manage tasks and automatically spawn Claude Code workers to complete them. Think Trello/Linear but with AI workers that actually do the work.

## Core Features

### Kanban Board

- **Three-column workflow**: Backlog → In Progress → Done
- **Drag-and-drop**: Uses @dnd-kit for smooth card movement
- **Task metadata**: Title, description, timestamps (created/started/completed)
- **Project association**: Every task belongs to a project
- **Real-time sync**: WebSocket updates broadcast to all connected clients
- **Mobile responsive**: Adaptive layout with mobile sidebar

### Worker Management

- **Automatic spawning**: Moving task to "In Progress" spawns a Claude Code worker
- **Worker panel**: Real-time display of all active workers with status badges
- **Status indicators**: spawning → active → busy → idle → closed
- **Git worktrees**: Each worker runs in an isolated git worktree
- **Log streaming**: Incremental worker conversation logs every 3 seconds
- **Smart cleanup**: Workers auto-close when tasks move to Done or Backlog
- **Context preservation**: Save conversation history when pausing tasks

### Task Lifecycle States

**Task Status** (user-facing columns):

- `backlog` - Not started
- `in_progress` - Worker actively working
- `done` - Completed

**Worker Status** (internal tracking):

- `starting` - Worker spawn in progress
- `running` - Worker active and working
- `reviewing` - Worker idle, awaiting human review
- `closed` - Worker shut down

### Claude-Team Integration

- **MCP Client**: Uses @modelcontextprotocol/sdk with StreamableHTTPClientTransport
- **Connection**: `http://127.0.0.1:8766/mcp`
- **Tools used**:
  - `spawn_workers` - Create workers with git worktrees
  - `list_workers` - Get all workers with idle status
  - `read_worker_logs` - Fetch conversation history
  - `close_workers` - Terminate workers

### Project Management

- **Multi-project support**: Tasks organized by filesystem paths
- **Project selector**: Filter tasks by project or view all
- **Default selection**: Smart project selection for new tasks
- **Path validation**: Ensures project paths exist on filesystem
- **Auto-naming**: Uses directory basename as project name

### OpenClaw Integration

- **Review notifications**: Sends wake events to OpenClaw gateway when workers go idle
- **Message format**: Includes task details, worktree path, API instructions
- **Review workflow**: Provides CLI commands for reviewing git diffs and updating tasks
- **Session keys**: Uses project ID for agent session grouping

## Tech Stack

### Backend

- **Runtime**: Bun 1.2+
- **Framework**: Hono 4.6+
- **Database**: SQLite (bun:sqlite)
- **MCP SDK**: @modelcontextprotocol/sdk 1.12+
- **WebSocket**: Native Bun WebSocket support
- **Process Management**: PM2 for production

### Frontend

- **Framework**: React 19.2 + TypeScript 5.9
- **Build Tool**: Vite 7.2
- **Styling**: Tailwind CSS 4.1
- **Drag & Drop**: @dnd-kit/core 6.3
- **State Management**: Custom hooks (useTasks, useWorkers, useProjects, useWebSocket)

### Infrastructure

- **Authentication**: Bearer token password protection
- **CORS**: Configured for multi-origin access
- **Polling**: Worker status (2s), worker logs (3s)
- **Database Migrations**: Automatic column additions on startup

## API Endpoints

### Tasks

```
GET    /api/tasks?project_id=<id>  - List tasks (optional project filter)
GET    /api/tasks/:id               - Get single task
POST   /api/tasks                   - Create task (requires title, projectId; spawns worker if status: "in_progress")
PATCH  /api/tasks/:id               - Update task (auto-spawns/closes workers)
POST   /api/tasks/:id/respawn       - Respawn worker for in-progress task
DELETE /api/tasks/:id               - Delete task
```

**Status Transitions** (handled by PATCH and POST):

- `backlog → in_progress`: Spawns worker with git worktree
- `in_progress → backlog`: Closes worker, saves context
- `in_progress → done`: Saves logs, closes worker
- `* → done`: Sets completedAt timestamp

**Respawn** (POST /api/tasks/:id/respawn):

- Only works for in_progress tasks
- Saves current worker's context (last 5 log messages)
- Closes current worker (sets workerStatus: "closed")
- Spawns new worker with saved context included in prompt

### Workers

```
GET    /api/workers              - List all workers (enriched with task info)
POST   /api/workers/:id/close    - Close a worker manually
```

### Projects

```
GET    /api/projects             - List all projects
POST   /api/projects             - Create project (requires path)
```

### WebSocket

```
WS     /ws                       - Real-time updates
```

**Message types**:

- `tasks_update` - Full task list sync
- `workers_update` - Full worker list with task enrichment
- `ping/pong` - Keep-alive

### Health Check

```
GET    /health                   - Unauthenticated health check
```

## Directory Structure

```
claw-machine/
├── backend/
│   ├── src/
│   │   ├── config.ts              # Configuration constants
│   │   ├── types.ts               # TypeScript types
│   │   ├── index.ts               # Main server entry point
│   │   ├── routes/
│   │   │   ├── tasks.ts           # Task CRUD + worker spawn/respawn
│   │   │   ├── workers.ts         # Worker list + close
│   │   │   └── projects.ts        # Project CRUD
│   │   ├── services/
│   │   │   ├── claudeTeam.ts      # MCP client + worker operations
│   │   │   ├── db.ts              # SQLite database + migrations
│   │   │   ├── websocket.ts       # WebSocket management
│   │   │   ├── openclaw.ts        # OpenClaw notifications
│   │   │   └── sync/
│   │   │       ├── index.ts       # Re-exports
│   │   │       ├── state.ts       # SyncState class
│   │   │       ├── workerMonitor.ts # Worker status monitoring
│   │   │       └── logStreamer.ts # Log streaming
│   │   └── utils/
│   │       ├── enrichWorkers.ts   # Worker-task enrichment
│   │       └── taskLookup.ts      # Find task for worker
│   ├── package.json
│   └── data.db                    # SQLite database file (auto-created)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── KanbanBoard.tsx    # Main board with drag-and-drop
│   │   │   ├── Column.tsx         # Board column with task list
│   │   │   ├── TaskCard.tsx       # Individual task card
│   │   │   ├── WorkerPanel.tsx    # Worker list sidebar
│   │   │   ├── LogModal.tsx       # Worker log viewer
│   │   │   ├── EditTaskModal.tsx  # Task editor
│   │   │   ├── ProjectSelector.tsx # Project dropdown
│   │   │   └── ProjectFilter.tsx  # Project filter widget
│   │   ├── hooks/
│   │   │   ├── useTasks.ts        # Task API + state management
│   │   │   ├── useWorkers.ts      # Worker API + state management
│   │   │   ├── useProjects.ts     # Project API + state management
│   │   │   └── useWebSocket.ts    # WebSocket connection
│   │   ├── types/
│   │   │   └── index.ts           # TypeScript types
│   │   ├── api.ts                 # API client + auth helpers
│   │   ├── App.tsx                # Main app + login screen
│   │   └── main.tsx               # React entry point
│   └── package.json
├── ecosystem.config.js            # PM2 configuration
├── README.md                      # Main documentation
└── SPEC.md                        # This file
```

## Database Schema

### tasks

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'backlog' CHECK(status IN ('backlog', 'in_progress', 'done')),
  assigned_worker TEXT,
  worker_status TEXT,
  worker_context TEXT,
  logs TEXT,
  project_id TEXT REFERENCES projects(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
)
```

### projects

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
)
```

## MCP Integration Details

### Connection Management

- Uses StreamableHTTPClientTransport for HTTP-based MCP
- Single client instance with connection pooling
- Automatic reconnection on errors
- Client reset on tool call failures

### Worker Spawning

```javascript
{
  name: "spawn_workers",
  arguments: {
    workers: [{
      project_path: "/path/to/project",
      annotation: "task-{task-id}",
      prompt: "Task: {title}\n\n{description}",
      use_worktree: true,
      skip_permissions: true
    }],
    layout: "auto"
  }
}
```

### Log Fetching

```javascript
{
  name: "read_worker_logs",
  arguments: {
    session_id: "worker-id"
  }
}
```

Returns conversation history with role/content/timestamp. Backend strips claude-team session markers automatically.

### Worker Lifecycle

1. Task moved to in_progress (or created with `status: "in_progress"`)
2. Backend marks `workerStatus: "starting"`
3. MCP `spawn_workers` called with git worktree
4. Worker ID stored as `assignedWorker`
5. Poll every 2s for idle status
6. When idle detected:
   - Fetch and cache logs
   - Set `workerStatus: "reviewing"`
   - Notify OpenClaw gateway
7. User reviews and either:
   - Moves to done: Close worker, clear `assignedWorker`, set `workerStatus: "closed"`
   - Moves to backlog: Close worker, save context, clear `assignedWorker`
   - Calls respawn: Save context, close worker, spawn new worker with context

## Real-Time Updates

### Worker Status Polling (2s interval)

- Calls `list_workers` MCP tool
- Detects idle → reviewing transitions
- Broadcasts state changes via WebSocket
- Triggers OpenClaw notifications on completion

### Worker Log Polling (3s interval)

- Polls active/busy/idle workers only
- Tracks last log count per worker
- Only broadcasts when new logs appear
- Incremental streaming for efficiency

### WebSocket Broadcasting

- Maintains set of connected clients
- Broadcasts on state changes only (diffing)
- Sends initial state on client connect
- Auto-cleanup on client disconnect

## Authentication

- Password-based Bearer token authentication
- Default password: `claw-machine-2026`
- Set via `AUTH_PASSWORD` environment variable
- Frontend stores in localStorage
- All endpoints except `/health` require auth
- CORS allows all origins (password protects access)

## OpenClaw Integration

When worker goes idle, backend POSTs to OpenClaw gateway:

```javascript
POST ${OPENCLAW_GATEWAY_URL}/hooks/agent
Authorization: Bearer ${OPENCLAW_TOKEN}

{
  "name": "[Reviewer] ${task.title}",
  "sessionKey": "${task.projectId}",
  "agentId": "reviewer",
  "wakeMode": "now",
  "message": "Worker ${worker.name} completed task..."
}
```

Message includes:

- Task details (ID, title, description)
- Worker info (ID, name, worktree path)
- CLI instructions for reviewing (mcporter commands)
- API curl command for marking task done

## Error Handling

- MCP connection failures logged but not fatal (server may be offline)
- Worker spawn failures revert `workerStatus` to null
- WebSocket send failures remove client from set
- Database migrations use try/catch for idempotency
- Task edits restricted to backlog status only

## Performance Optimizations

- Polling only broadcasts on state changes (JSON diffing)
- Log polling tracks last count to avoid redundant fetches
- WebSocket used for real-time updates instead of polling from frontend
- SQLite indexes on common query fields
- Incremental log streaming reduces bandwidth
