# Claw Machine

A web-based kanban board for orchestrating Claude Code workers via claude-team
and OpenClaw. Built mostly by OpenClaw and Claude Opus 4.5 using the kanban
interface itself (meta!).

## Overview

Claw Machine is a full-stack task management application that lets you visually
manage tasks and automatically spawn Claude Code workers to complete them. Think
Trello/Linear but with AI workers that actually do the work. An OpenClaw agent
(with per-project sessions) is used as the reviewer and merger once tasks are
complete.

## Installation & Setup

### Prerequisites

- Bun (>= 1.0)
- claude-team MCP server running on `http://127.0.0.1:8766/mcp`
- PM2 (optional, for production)
- OpenClaw (for automated code review and merging)

### Backend Setup

```bash
cd backend
bun install
bun run dev  # Development mode with hot reload
# or
bun run start  # Production mode
```

### Frontend Setup

```bash
cd frontend
bun install
bun run dev  # Development server on port 5173
# or
bun run build  # Production build
```

### OpenClaw Integration Setup

To set up automated code review notifications when workers complete tasks:

#### 1. Install the claude-team Skill

```bash
# Install the claude-team skill for OpenClaw
npx clawhub@latest install claude-team
```

Then go ask your main OpenClaw agent to make sure the claude-team skill is setup
(it probably needs to set up the claude-team MCP server and install some stuff).

#### 2. Configure the Reviewer Agent

Edit your `~/.openclaw/openclaw.json` to add the `reviewer` agent, enable hooks,
and set the gateway hooks API token.

It should look something like this:

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "sandbox": {
          "mode": "off"
        }
      },
      {
        "id": "reviewer",
        "sandbox": {
          "mode": "off"
        }
      }
    ]
  },
  "hooks": {
    "enabled": true,
    "token": "<your-gateway-token>"
  }
}
```

**Important:**

- The `main` agent must be included to keep the default main agent separate
- The `reviewer` agent will receive notifications when workers complete tasks
- Generate a secure random token for `hooks.token`

### Environment Variables

**Backend** (`backend/.env`):

```bash
PORT=18800                    # API server port
HOST=0.0.0.0                  # Bind address
AUTH_PASSWORD=your-password # Auth password (default: claw-machine-2026)
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789  # OpenClaw gateway
OPENCLAW_TOKEN=your-token     # OpenClaw auth token
CLAUDE_TEAM_MCP_URL=http://127.0.0.1:8766/mcp # claude-team MCP server
```

**Frontend** (`frontend/.env`):

```bash
VITE_API_URL=http://localhost:18800  # Backend API URL
```

### Production Deployment with PM2

```bash
# From project root
pm2 start ecosystem.config.js

# View logs
pm2 logs

# Restart services
pm2 reload claw-machine-backend
pm2 reload claw-machine-frontend

# Stop services
pm2 stop claw-machine-backend claw-machine-frontend
```

## Usage

1. **Login**: Enter the auth password (default: `claw-machine-2026`)
2. **Create a project**: Click the project selector and add a new project path
3. **Create tasks**: Click "+" in the Backlog column, enter title and description
4. **Spawn workers**: Drag a task from Backlog to In Progress
   - A Claude Code worker spawns automatically in a git worktree
   - Watch progress in the Worker Panel
   - View live logs by clicking "View Logs" on the worker or task
5. **Review work**: When the worker goes idle (task complete):
   - Task moves to "reviewing" state
   - OpenClaw gateway sends a notification (if configured)
   - Review the git diff in the worker's worktree
   - Move task to Done when satisfied (auto-closes worker)
6. **Pause/Resume**: Drag In Progress tasks back to Backlog
   - Worker closes automatically
   - Conversation context is preserved for next spawn

## Features

### Kanban Board

- **Three-column workflow**: Backlog → In Progress → Done
- **Drag-and-drop**: Move tasks between columns with smooth animations
- **Project filtering**: Filter tasks by project or view all at once
- **Real-time updates**: WebSocket-powered live sync across all clients
- **Mobile responsive**: Works seamlessly on desktop, tablet, and mobile

### Worker Management

- **Automatic spawning**: Drag a task to "In Progress" to spawn a Claude Code worker
- **Worker panel**: Real-time view of all active workers with status indicators
- **Log streaming**: Live worker conversation logs with incremental updates
- **Git worktrees**: Each worker runs in an isolated git worktree
- **Smart cleanup**: Workers auto-close when tasks move to Done or back to Backlog
- **Review notifications**: OpenClaw gateway integration for human-in-the-loop review

### Task Features

- **Rich metadata**: Title, description, timestamps (created, started, completed)
- **Worker context**: Preserve conversation history when pausing/resuming tasks
- **Status tracking**: Visual indicators for worker states (starting, running, reviewing, closed)
- **Edit mode**: Edit title and description for backlog tasks
- **Task logs**: View full conversation history in a modal viewer

### Project Management

- **Multi-project support**: Organize tasks by filesystem project path
- **Auto-discovery**: Create projects by providing a valid directory path
- **Default project**: Smart selection for new task creation
- **Project selector**: Quick filter and switch between projects

## Tech Stack

### Backend

- **Runtime**: Bun (fast JavaScript runtime)
- **Framework**: Hono (lightweight, fast HTTP framework)
- **Database**: SQLite (via bun:sqlite)
- **Real-time**: Native WebSocket support
- **MCP Client**: @modelcontextprotocol/sdk for claude-team integration
- **Process Manager**: PM2 for production deployment

### Frontend

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS 4
- **Drag & Drop**: @dnd-kit
- **State Management**: React hooks + custom API hooks

### Infrastructure

- **Authentication**: Bearer token password protection
- **CORS**: Configured for multi-origin access
- **Polling**: Smart worker status polling (2s) and log streaming (3s)
- **Git Worktrees**: Isolated development environments per worker

## Architecture

```
┌─────────────────────┐
│   React Frontend    │
│   (Vite + Tailwind) │
└──────────┬──────────┘
           │ HTTP REST API
           │ WebSocket
┌──────────▼──────────┐
│   Bun + Hono API    │
│   (Port 18800)      │
└──────────┬──────────┘
           │ MCP HTTP Transport
┌──────────▼──────────┐
│  claude-team Server │
│   (Port 8766/mcp)   │
└──────────┬──────────┘
           │ Spawns/manages
┌──────────▼──────────┐
│  Claude Code Workers│
│  (Git worktrees)    │
└─────────────────────┘
```

## API Endpoints

### Tasks

- `GET /api/tasks?project_id=<id>` - List tasks (optionally filter by project)
- `GET /api/tasks/:id` - Get single task
- `POST /api/tasks` - Create task (requires `title`, `projectId`; spawns worker if `status: "in_progress"`)
- `PATCH /api/tasks/:id` - Update task (handles worker spawn/close automatically on status change)
- `POST /api/tasks/:id/respawn` - Respawn worker for in-progress task (saves context, closes old worker, spawns new)
- `DELETE /api/tasks/:id` - Delete task

### Workers

- `GET /api/workers` - List all workers (enriched with task info)
- `POST /api/workers/:id/close` - Close a worker manually

### Projects

- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project (requires `path`)
- `PATCH /api/projects/:id` - Update project path
- `DELETE /api/projects/:id` - Delete project

### WebSocket

- `WS /ws` - Real-time updates for tasks and workers
  - `tasks_update` - Full task list sync
  - `workers_update` - Full worker list sync
  - `ping/pong` - Keep-alive

## Worker Lifecycle

```
Backlog Task
    │
    ▼ (drag to In Progress)
Worker Spawning (status: "starting")
    │
    ▼
Worker Running (status: "running")
    │
    ▼ (worker goes idle)
Worker Reviewing (status: "reviewing")
    │
    ├─▶ (drag to Done) → Worker Closed
    ├─▶ (drag to Backlog) → Worker Closed + Context Saved
    └─▶ (POST /respawn) → Worker Closed + Context Saved + New Worker Spawned
```

## Database Schema

### Tasks Table

- `id` (TEXT, PK) - UUID
- `title` (TEXT) - Task title
- `description` (TEXT) - Task description
- `status` (TEXT) - backlog | in_progress | done
- `assigned_worker` (TEXT) - Worker ID
- `worker_status` (TEXT) - starting | running | reviewing | closed
- `worker_context` (TEXT) - Saved conversation context
- `logs` (TEXT) - JSON array of WorkerLog objects
- `project_id` (TEXT, FK) - Reference to projects table
- `created_at` (TEXT) - ISO timestamp
- `updated_at` (TEXT) - ISO timestamp
- `started_at` (TEXT) - When moved to in_progress
- `completed_at` (TEXT) - When moved to done

### Projects Table

- `id` (TEXT, PK) - UUID
- `path` (TEXT, UNIQUE) - Filesystem path
- `name` (TEXT) - Display name (basename of path)
- `created_at` (TEXT) - ISO timestamp

## Integration with OpenClaw

When a worker completes a task (goes idle), the backend can notify OpenClaw gateway to wake a reviewer agent:

```bash
POST ${OPENCLAW_GATEWAY}/hooks/agent
Content-Type: application/json
Authorization: Bearer ${OPENCLAW_TOKEN}

{
  "name": "[Reviewer] Task Title",
  "sessionKey": "project-id",
  "agentId": "reviewer",
  "wakeMode": "now",
  "message": "Worker ${worker.name} completed task: ${task.title}..."
}
```

The reviewer agent receives instructions on how to:

1. Read worker logs via `mcporter`
2. Check the git diff
3. Merge or request changes
4. Mark task as done via API

## Development Notes

### Worker Spawning

- Workers spawn with `use_worktree: true` for isolation
- Each worker gets a unique annotation: `task-{taskId}`
- Initial prompt includes task title, description, and worktree setup instructions

### Log Streaming

- Logs are fetched incrementally every 3 seconds
- Only active/busy/idle workers are polled
- claude-team session markers are automatically stripped
- Logs are cached to task when worker goes idle or task moves to done

### Status Polling

- Worker status polled every 2 seconds
- Idle detection triggers reviewing state and OpenClaw notification
- Changes broadcast via WebSocket only when state changes

### Authentication

- Simple Bearer token authentication
- Password stored in localStorage on frontend
- All API requests (except `/health`) require auth header

## Credits

Built mostly by **OpenClaw** and **Claude Opus 4.5**, using the kanban interface
itself to orchestrate the development. Every feature was implemented by AI
workers managed through this very tool.

---

*Last tested: PR creation flow verification complete.*
