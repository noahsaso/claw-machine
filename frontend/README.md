# Claw Machine Frontend

React + Vite + Tailwind CSS frontend for Claw Machine (Claw Machine).

## Overview

This is the frontend application for Claw Machine. It provides a drag-and-drop kanban board interface for managing tasks and Claude Code workers in real-time.

## Features

- **Kanban Board**: Three-column workflow (Backlog → In Progress → Done)
- **Drag & Drop**: Smooth task movement with @dnd-kit
- **Real-time Updates**: WebSocket-powered live sync
- **Worker Panel**: Live view of active workers with status indicators
- **Log Viewer**: Modal for viewing worker conversation logs
- **Project Management**: Filter and organize tasks by project
- **Mobile Responsive**: Works on desktop, tablet, and mobile
- **Password Authentication**: Bearer token login screen

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 4
- **Drag & Drop**: @dnd-kit
- **State Management**: Custom hooks

## Installation

```bash
npm install
# or
bun install
```

## Configuration

Create a `.env` file (optional):

```bash
VITE_API_URL=http://localhost:18800  # Backend API URL
```

Default: `http://localhost:18800`

## Development

```bash
npm run dev
# or
bun run dev
```

Starts development server on `http://localhost:5173`

## Build

```bash
npm run build
# or
bun run build
```

Outputs to `dist/` directory.

## Preview Production Build

```bash
npm run preview
# or
bun run preview
```

## Project Structure

```
src/
├── components/
│   ├── KanbanBoard.tsx      # Main board with drag-and-drop
│   ├── Column.tsx           # Board column with task list
│   ├── TaskCard.tsx         # Individual task card
│   ├── WorkerPanel.tsx      # Worker list sidebar
│   ├── LogModal.tsx         # Worker log viewer modal
│   ├── EditTaskModal.tsx    # Task editor modal
│   ├── ProjectSelector.tsx  # Project dropdown
│   ├── ProjectFilter.tsx    # Project filter widget
│   └── index.ts             # Component exports
├── hooks/
│   ├── useTasks.ts          # Task API + state management
│   ├── useWorkers.ts        # Worker API + state management
│   ├── useProjects.ts       # Project API + state management
│   ├── useWebSocket.ts      # WebSocket connection
│   └── index.ts             # Hook exports
├── types/
│   └── index.ts             # TypeScript type definitions
├── api.ts                   # API client + auth helpers
├── App.tsx                  # Main app component + login screen
└── main.tsx                 # React entry point
```

## Components

### KanbanBoard

Main board component with drag-and-drop functionality.

**Props:**

- `tasks` - Array of tasks to display
- `workers` - Array of active workers
- `onMoveTask` - Callback when task is moved
- `onDeleteTask` - Callback when task is deleted
- `onEditTask` - Callback when task is edited
- `onCreateTask` - Callback when task is created
- `projects` - Array of available projects
- `defaultNewTaskProjectId` - Default project for new tasks
- `onCreateProject` - Callback when project is created
- `isLoadingProjects` - Loading state for projects
- `onViewTaskLogs` - Callback to view task logs

### WorkerPanel

Sidebar showing active workers.

**Props:**

- `workers` - Array of active workers
- `tasks` - Array of tasks (for enrichment)
- `onCloseWorker` - Callback to close a worker
- `onViewTaskLogs` - Callback to view task logs
- `isConnected` - WebSocket connection status
- `hideHeader` - Hide panel header (for mobile)

### LogModal

Modal for viewing worker conversation logs.

**Props:**

- `task` - Task with logs to display
- `onClose` - Callback to close modal

### EditTaskModal

Modal for editing task title, description, and project (backlog only).

**Props:**

- `task` - Task to edit
- `projects` - Array of available projects
- `onSave` - Callback to save changes
- `onClose` - Callback to close modal
- `onCreateProject` - Callback when project is created
- `onUpdateProject` - Callback when project is updated
- `onDeleteProject` - Callback when project is deleted
- `isLoadingProjects` - Loading state for projects

### ProjectsModal

Modal for managing all projects (view, create, edit, delete).

**Props:**

- `projects` - Array of all projects
- `onClose` - Callback to close modal
- `onCreateProject` - Callback when project is created
- `onUpdateProject` - Callback when project is updated
- `onDeleteProject` - Callback when project is deleted

## Hooks

### useTasks

Manages task state and API calls.

```typescript
const {
  tasks,
  createTask,
  updateTask,
  moveTask,
  deleteTask,
  updateTaskFromWebSocket,
  setTasksFromWebSocket,
  refetch,
} = useTasks()
```

### useWorkers

Manages worker state and API calls.

```typescript
const { workers, closeWorker, setWorkersFromWebSocket } = useWorkers()
```

### useProjects

Manages project state and API calls.

```typescript
const {
  projects,
  defaultNewTaskProjectId,
  filterProjectId,
  setFilter,
  createProject,
  updateProject,
  deleteProject,
  isLoading,
} = useProjects()
```

### useWebSocket

Manages WebSocket connection.

```typescript
const { isConnected } = useWebSocket(url, {
  onMessage: (message) => {
    // Handle message
  },
})
```

## State Management

The app uses a combination of:

- **Local State**: React `useState` for UI state (modals, selections)
- **API State**: Custom hooks that fetch and cache API data
- **WebSocket State**: Real-time updates pushed from backend
- **Refs**: `useRef` for stable references in callbacks

## Authentication

The app uses password-based authentication:

1. User enters password on login screen
2. Password validated against backend `/health` endpoint
3. Password stored in localStorage
4. All API requests include `Authorization: Bearer ${password}` header

To logout, click "Logout" button or clear localStorage.

## WebSocket Integration

The app connects to `ws://localhost:18800/ws` for real-time updates.

**Message Types:**

- `tasks_update` - Full task list sync (replaces local state)
- `workers_update` - Full worker list sync (replaces local state)
- `ping/pong` - Keep-alive

Connection status shown in Worker Panel header.

## Drag & Drop

The kanban board uses @dnd-kit for drag-and-drop:

- **Draggable**: TaskCard components
- **Droppable**: Column components
- **Constraints**: 8px activation distance (prevents accidental drags)
- **Feedback**: DragOverlay shows task preview while dragging

Tasks can be dragged:

- Between columns (changes status)
- Within a column (no effect)

When dropped on a different column:

- Backend automatically spawns/closes workers based on status transition
- WebSocket broadcast updates all connected clients

## Mobile Support

The app is fully responsive:

- **Desktop**: Kanban board + Worker panel side-by-side
- **Tablet**: Kanban board + collapsible Worker panel
- **Mobile**: Kanban board + overlay Worker panel (toggle with button)

Touch gestures supported for drag-and-drop on mobile.

## Performance Optimizations

- **WebSocket**: Only updates when backend broadcasts changes
- **Refs**: Stable references in callbacks to avoid re-subscriptions
- **Incremental Updates**: Log streaming only fetches new logs
- **Conditional Rendering**: Modals only render when open
- **Memo**: Key components memoized to prevent unnecessary re-renders

## Deployment

### Static Hosting (Recommended)

Build the app and serve the `dist/` directory:

```bash
npm run build
```

Serve with:

- Nginx
- Apache
- Netlify
- Vercel
- GitHub Pages

**Important**: Configure server to rewrite all routes to `index.html` for client-side routing (if added in the future).

### PM2 (Development Server)

From project root:

```bash
pm2 start ecosystem.config.js
pm2 logs claw-machine-frontend
```

**Note**: This runs `vite dev` which is not suitable for production. Use static hosting instead.

### Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Environment Variables for Production

```bash
VITE_API_URL=https://api.example.com  # Production backend URL
```

## Development Notes

### Adding New Features

1. Create component in `src/components/`
2. Add API hook in `src/hooks/` if needed
3. Update types in `src/types/index.ts`
4. Export from `index.ts` files for clean imports

### Styling

- Use Tailwind utility classes
- Follow existing color scheme (slate + blue accents)
- Mobile-first responsive design
- Dark theme only (for now)

### Type Safety

- All components use TypeScript
- Props interfaces defined inline or in types file
- API responses typed in `src/types/index.ts`

## Troubleshooting

### API Connection Fails

Check backend is running and `VITE_API_URL` is correct:

```bash
curl http://localhost:18800/health
```

### WebSocket Disconnects

- Check CORS settings on backend
- Verify WebSocket URL in `api.ts`
- Check browser console for errors

### Drag & Drop Not Working

- Ensure tasks have unique IDs
- Check browser console for @dnd-kit errors
- Verify task status allows dragging (not "starting")

### Build Fails

```bash
# Clear cache
rm -rf node_modules dist
npm install
npm run build
```

## License

Built mostly by OpenClaw and Claude Opus 4.5.
