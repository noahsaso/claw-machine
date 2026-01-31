import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { tasks } from "./routes/tasks";
import { workers } from "./routes/workers";
import { projects } from "./routes/projects";
import { addClient, removeClient, getInitialState } from "./services/websocket";
import { monitorWorkers, streamLogs } from "./services/sync";
import {
  PORT,
  HOST,
  AUTH_PASSWORD,
  WORKER_SYNC_INTERVAL,
  LOG_SYNC_INTERVAL,
} from "./config";

// Re-export for routes/tasks.ts
export { broadcast, broadcastTasks } from "./services/websocket";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*", // Allow all origins since we're using password auth
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Auth middleware - skip for health check
app.use("*", async (c, next) => {
  const path = new URL(c.req.url).pathname;

  if (path === "/health") {
    return next();
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing authorization" }, 401);
  }

  const token = authHeader.slice(7);
  if (token !== AUTH_PASSWORD) {
    return c.json({ error: "Invalid password" }, 401);
  }

  return next();
});

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mount routes
app.route("/api/tasks", tasks);
app.route("/api/workers", workers);
app.route("/api/projects", projects);

// Start sync loops
const workerSyncInterval = setInterval(monitorWorkers, WORKER_SYNC_INTERVAL);
const logSyncInterval = setInterval(streamLogs, LOG_SYNC_INTERVAL);

// Cleanup on shutdown
process.on("SIGINT", () => {
  clearInterval(workerSyncInterval);
  clearInterval(logSyncInterval);
  process.exit(0);
});

process.on("SIGTERM", () => {
  clearInterval(workerSyncInterval);
  clearInterval(logSyncInterval);
  process.exit(0);
});

console.log(`Starting Claw Machine backend on ${HOST}:${PORT}...`);

// Start the server with WebSocket support
const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  fetch(req, server) {
    const url = new URL(req.url);

    // Handle WebSocket upgrade for /ws
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    }

    // Handle regular HTTP requests via Hono
    return app.fetch(req);
  },
  websocket: {
    open(ws) {
      console.log("WebSocket client connected");
      addClient(ws);

      // Send current state on connect
      getInitialState().then(({ tasks, workers }) => {
        ws.send(
          JSON.stringify({
            type: "tasks_update",
            tasks,
            timestamp: new Date().toISOString(),
          })
        );
        ws.send(
          JSON.stringify({
            type: "workers_update",
            workers,
            timestamp: new Date().toISOString(),
          })
        );
      });
    },
    message(ws, message) {
      const data = typeof message === "string" ? message : message.toString();
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch {
        // Ignore invalid messages
      }
    },
    close(ws) {
      console.log("WebSocket client disconnected");
      removeClient(ws);
    },
    drain(ws) {
      // Handle backpressure if needed
    },
  },
});

console.log(`Server running at http://${HOST}:${PORT}`);
console.log(`WebSocket available at ws://${HOST}:${PORT}/ws`);
console.log(`Connecting to claude-team MCP at http://127.0.0.1:8766/mcp`);
console.log(`Auth password: ${AUTH_PASSWORD.slice(0, 4)}...`);
