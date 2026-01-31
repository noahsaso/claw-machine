import type { ServerWebSocket } from "bun";
import { getAllTasks } from "./db";
import { listWorkers } from "./claudeTeam";
import { enrichWorkersWithTasks } from "../utils/enrichWorkers";
import type { Task, Worker } from "../types";

// Track connected WebSocket clients
const wsClients = new Set<ServerWebSocket<unknown>>();

/**
 * Add a WebSocket client to the tracking set.
 */
export function addClient(ws: ServerWebSocket<unknown>): void {
  wsClients.add(ws);
}

/**
 * Remove a WebSocket client from the tracking set.
 */
export function removeClient(ws: ServerWebSocket<unknown>): void {
  wsClients.delete(ws);
}

/**
 * Get the count of connected clients.
 */
export function getClientCount(): number {
  return wsClients.size;
}

/**
 * Broadcast a message to all connected WebSocket clients.
 */
export function broadcast(message: Record<string, unknown>): void {
  const data = JSON.stringify(message);
  for (const client of wsClients) {
    try {
      client.send(data);
    } catch (error) {
      console.error("Failed to send to WebSocket client:", error);
      wsClients.delete(client);
    }
  }
}

/**
 * Broadcast current task state to all clients.
 */
export function broadcastTasks(): void {
  const allTasks = getAllTasks();
  broadcast({
    type: "tasks_update",
    tasks: allTasks,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get the initial state for a new WebSocket connection.
 * Returns tasks and enriched workers.
 */
export async function getInitialState(): Promise<{
  tasks: Task[];
  workers: Worker[];
}> {
  const tasks = getAllTasks();
  const workerList = await listWorkers();
  const workers = enrichWorkersWithTasks(workerList, tasks);
  return { tasks, workers };
}
