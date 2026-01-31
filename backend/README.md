# Claw Machine Backend

Bun + Hono API server for Claw Machine (Claw Machine).

## Overview

This is the backend service for the Claw Machine application. It provides a REST API and WebSocket server for managing tasks, projects, and Claude Code workers via the claude-team MCP server.

## Features

- **REST API**: CRUD operations for tasks, projects, and workers
- **WebSocket**: Real-time updates for task and worker state changes
- **MCP Integration**: Connects to claude-team server for worker management
- **SQLite Database**: Persistent storage with automatic migrations
- **Worker Polling**: Background polling for worker status (2s) and logs (3s)
- **Authentication**: Bearer token password protection
- **OpenClaw Integration**: Sends review notifications when workers complete tasks

## Tech Stack

- **Runtime**: Bun (fast JavaScript runtime)
- **Framework**: Hono (lightweight HTTP framework)
- **Database**: SQLite (via bun:sqlite)
- **MCP Client**: @modelcontextprotocol/sdk
- **WebSocket**: Native Bun WebSocket support

## Installation

```bash
bun install
```

## Configuration

Create a `.env` file (optional):

```bash
PORT=18800                    # API server port (default: 18800)
HOST=0.0.0.0                  # Bind address (default: 0.0.0.0)
AUTH_PASSWORD=your-password # Auth password (default: claw-machine-2026)
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789  # OpenClaw gateway URL
OPENCLAW_TOKEN=your-token     # OpenClaw auth token
CLAUDE_TEAM_MCP_URL=http://127.0.0.1:8766/mcp # claude-team MCP server
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

#### 3. Set Environment Variables

```bash
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789  # Default OpenClaw gateway port
OPENCLAW_TOKEN=<your-gateway-token>          # Must match hooks.token in openclaw.json
```

When configured, the backend will automatically notify the OpenClaw reviewer agent when workers go idle, providing:

- Task and worker details
- CLI commands for reviewing git diffs
- Instructions for merging or requesting changes
- API commands for task completion

## Development

```bash
# Development mode with hot reload
bun run dev

# Production mode
bun run start

# Type check
bun run typecheck
```

## Project Structure

```
src/
├── config.ts              # Configuration constants
├── types.ts               # TypeScript type definitions
├── index.ts               # Main server entry point
├── routes/
│   ├── tasks.ts           # Task CRUD + worker spawn/respawn logic
│   ├── workers.ts         # Worker list + close
│   └── projects.ts        # Project CRUD
├── services/
│   ├── claudeTeam.ts      # MCP client + worker operations
│   ├── db.ts              # SQLite database + migrations
│   ├── websocket.ts       # WebSocket client management + broadcasting
│   ├── openclaw.ts        # OpenClaw review notifications
│   └── sync/
│       ├── index.ts       # Re-exports
│       ├── state.ts       # SyncState class
│       ├── workerMonitor.ts # Worker status monitoring
│       └── logStreamer.ts # Log streaming to tasks
└── utils/
    ├── enrichWorkers.ts   # Worker-task enrichment
    └── taskLookup.ts      # Find task for worker
```

## API Endpoints

### Authentication

All endpoints except `/health` require a Bearer token:

```bash
Authorization: Bearer your-password
```

### Tasks

- `GET /api/tasks?project_id=<id>` - List tasks (optional project filter)
- `GET /api/tasks/:id` - Get single task
- `POST /api/tasks` - Create task (spawns worker if `status: "in_progress"`)
  ```json
  { "title": "Task title", "description": "...", "projectId": "uuid" }
  { "title": "Task title", "projectId": "uuid", "status": "in_progress" }  // Creates and spawns immediately
  ```
- `PATCH /api/tasks/:id` - Update task (auto-spawns/closes workers on status change)
  ```json
  { "status": "in_progress" }  // Spawns worker
  { "status": "backlog" }      // Closes worker, saves context
  { "status": "done" }         // Closes worker, saves logs
  ```
- `POST /api/tasks/:id/respawn` - Respawn worker for in-progress task
  - Saves current worker's context (last 5 log messages)
  - Closes current worker (sets `workerStatus: "closed"`)
  - Spawns new worker with saved context
  ```json
  { "success": true, "workerId": "worker-abc123", "taskId": "uuid" }
  ```
- `DELETE /api/tasks/:id` - Delete task

### Workers

- `GET /api/workers` - List all workers (enriched with task info)
- `POST /api/workers/:id/close` - Close a worker manually

### Projects

- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
  ```json
  { "path": "/absolute/path/to/project" }
  ```
- `PATCH /api/projects/:id` - Update project path
  ```json
  { "path": "/new/absolute/path/to/project" }
  ```
- `DELETE /api/projects/:id` - Delete project

### WebSocket

- `WS /ws` - Real-time updates

**Message types:**

- `tasks_update` - Full task list sync
- `workers_update` - Full worker list with task enrichment
- `ping/pong` - Keep-alive

### Health Check

- `GET /health` - Unauthenticated health check
  ```json
  { "status": "ok", "timestamp": "2026-01-31T..." }
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

## MCP Integration

### Connection

The backend connects to the claude-team MCP server at `http://127.0.0.1:8766/mcp` using StreamableHTTPClientTransport.

### Worker Spawning

When a task moves to "in_progress", the backend spawns a Claude Code worker:

```javascript
{
  name: "spawn_workers",
  arguments: {
    workers: [{
      project_path: "/path/to/project",
      annotation: "task-{task-id}",
      prompt: "Task: {title}\n\n{description}\n\n{worktree-note}",
      use_worktree: true,
      skip_permissions: true
    }],
    layout: "auto"
  }
}
```

### Worker Lifecycle

1. Task status → `in_progress`
2. Backend sets `workerStatus: "starting"`
3. MCP spawns worker with git worktree
4. Worker ID stored as `assignedWorker`
5. Background polling detects idle status (every 2s)
6. When idle:
   - Fetch and cache logs
   - Set `workerStatus: "reviewing"`
   - Notify OpenClaw gateway (if configured)
7. Task status → `done`:
   - Close worker via MCP
   - Clear `assignedWorker`
   - Set `workerStatus: "closed"`

### Log Streaming

- Background polling fetches logs every 3 seconds
- Only polls active/busy/idle workers
- Tracks last log count per worker for incremental updates
- Strips claude-team session markers automatically
- Broadcasts updates via WebSocket when new logs appear

## OpenClaw Integration

When a worker goes idle (task complete), the backend sends a notification to the OpenClaw gateway:

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

The notification includes:

- Task details (ID, title, description)
- Worker info (ID, name, worktree path)
- CLI instructions for reviewing (mcporter commands)
- API curl command for marking task done

## Deployment

### PM2 (Recommended)

From project root:

```bash
pm2 start ecosystem.config.js
pm2 logs claw-machine-backend
pm2 reload claw-machine-backend  # After code changes
```

### Docker

```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
EXPOSE 18800
CMD ["bun", "run", "src/index.ts"]
```

### Environment Variables for Production

```bash
PORT=18800
HOST=0.0.0.0
AUTH_PASSWORD=strong-random-password
WORKER_PROJECT_PATH=/path/to/default/project
OPENCLAW_GATEWAY_URL=http://openclaw:18789
OPENCLAW_TOKEN=secret-token
```

## Development Notes

### Error Handling

- MCP connection failures are logged but not fatal (server may be offline)
- Worker spawn failures revert `workerStatus` to null
- WebSocket send failures remove client from set
- Database migrations use try/catch for idempotency

### Performance

- Polling only broadcasts on state changes (JSON diffing)
- Log polling tracks last count to avoid redundant fetches
- WebSocket for real-time updates instead of frontend polling
- SQLite transactions for atomic updates

### Security

- Bearer token authentication on all API endpoints
- CORS allows all origins (password protects access)
- No rate limiting (add nginx or similar in production)
- SQL injection protected by prepared statements

## Troubleshooting

### MCP Connection Fails

Check that claude-team server is running:

```bash
curl http://127.0.0.1:8766/mcp
```

### Workers Not Spawning

1. Verify claude-team server is running
2. Check backend logs for MCP errors
3. Ensure project path exists and is accessible
4. Verify git worktree support in the project

### WebSocket Disconnects

- Check CORS configuration
- Verify firewall/proxy settings
- Increase WebSocket timeout if needed

## License

Built mostly by OpenClaw and Claude Opus 4.5.
