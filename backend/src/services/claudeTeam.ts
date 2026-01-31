import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Worker, WorkerLog } from "../types";

const MCP_URL = process.env.CLAUDE_TEAM_MCP_URL || "http://127.0.0.1:8766/mcp";

let client: Client | null = null;
let transport: StreamableHTTPClientTransport | null = null;
let connectionPromise: Promise<Client> | null = null;

async function getClient(): Promise<Client> {
  // If we have a valid client, return it
  if (client) return client;

  // If connection is in progress, wait for it
  if (connectionPromise) return connectionPromise;

  // Start new connection
  connectionPromise = (async () => {
    try {
      transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
      client = new Client(
        { name: "claw-machine-backend", version: "1.0.0" },
        { capabilities: {} }
      );

      await client.connect(transport);
      return client;
    } catch (error) {
      // Reset state on connection failure
      client = null;
      transport = null;
      throw error;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

// Reset client on error to force reconnection
function resetClient() {
  if (client) {
    try {
      client.close();
    } catch {
      // Ignore close errors
    }
  }
  client = null;
  transport = null;
  connectionPromise = null;
}

export async function listWorkers(): Promise<Worker[]> {
  try {
    const c = await getClient();
    const result = await c.callTool({ name: "list_workers", arguments: {} });

    // Parse the result - claude-team returns workers info
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find(
        (c: { type: string }) => c.type === "text"
      );
      if (textContent && "text" in textContent) {
        // Try to parse as JSON if possible
        try {
          const parsed = JSON.parse(textContent.text as string);
          if (Array.isArray(parsed)) {
            return parsed.map(mapToWorker);
          }
          if (parsed.workers && Array.isArray(parsed.workers)) {
            return parsed.workers.map(mapToWorker);
          }
        } catch {
          throw new Error("Failed to parse workers as JSON");
        }
      }
    }
    return [];
  } catch (error) {
    // Reset client on error to force reconnection next time
    resetClient();
    console.error("Failed to list workers:", error);
    // Return empty on connection failure - the MCP server might not be running
    return [];
  }
}

function mapToWorker(w: Record<string, unknown>): Worker {
  // Extract task ID from annotation
  const currentTask =
    w.coordinator_annotation &&
    typeof w.coordinator_annotation === "string" &&
    w.coordinator_annotation?.startsWith("task-")
      ? w.coordinator_annotation.substring(5)
      : null;

  // Try various field names for worker name - MCP uses 'annotation' when spawning
  const name = String(
    w.name || w.worker_name || w.annotation || w.session_name || "unknown"
  );

  // Try various field names for worker ID, falling back to annotation
  const id = String(w.session_id || w.id || w.worker_id || w.annotation || "");

  const annotation = w.annotation
    ? String(w.coordinator_annotation)
    : undefined;

  return {
    id,
    name,
    annotation,
    status: mapStatus(w.status as string),
    currentTask,
    worktreePath: (w.worktree_path || w.project_path) as string | undefined,
    projectPath: (w.main_repo_path || w.project_path) as string | undefined,
    isIdle: w.is_idle === true,
  };
}

function mapStatus(status: string): Worker["status"] {
  const normalized = (status || "").toLowerCase();
  if (normalized.includes("spawn")) return "spawning";
  if (normalized.includes("ready") || normalized.includes("active"))
    return "active";
  if (normalized.includes("busy")) return "busy";
  if (normalized.includes("idle")) return "idle";
  if (normalized.includes("closed")) return "closed";
  return "idle";
}

export async function spawnWorker({
  taskId,
  prompt,
  projectPath,
}: {
  taskId: string;
  prompt: string;
  projectPath: string;
}): Promise<{ success: boolean; workerId?: string; error?: string }> {
  try {
    const c = await getClient();
    const result = await c.callTool({
      name: "spawn_workers",
      arguments: {
        workers: [
          {
            project_path: projectPath,
            annotation: `task-${taskId}`,
            prompt,
            use_worktree: true,
            skip_permissions: true,
          },
        ],
        layout: "auto",
      },
    });

    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find(
        (c: { type: string }) => c.type === "text"
      );
      if (textContent && "text" in textContent) {
        const text = textContent.text as string;
        try {
          const parsed = JSON.parse(text);
          // Check if error is present
          if (parsed.error && typeof parsed.error === "string") {
            return {
              success: false,
              // Remove "for worker 0" from "Project path does not exist for worker 0: <PATH>"
              error: parsed.error.replace(/ for worker \d/, ""),
            };
          }

          // Get the first worker from the sessions object
          const sessions = parsed.sessions || {};
          const sessionKeys = Object.keys(sessions);
          if (sessionKeys.length > 0) {
            const sessionKey = sessionKeys[0];
            const session = sessions[sessionKey];
            // Use the session ID as the worker ID, falling back to the coordinator annotation or name
            const workerId =
              session?.session_id ||
              session?.coordinator_annotation ||
              session?.name;
            return {
              success: true,
              workerId: String(workerId),
            };
          }
        } catch {
          return {
            success: true,
            workerId: undefined,
          };
        }
      }
    }

    throw new Error("Unknown error");
  } catch (error) {
    resetClient();
    console.error("Failed to spawn worker:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function closeWorker(
  workerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const c = await getClient();
    await c.callTool({
      name: "close_workers",
      arguments: {
        session_ids: [workerId],
      },
    });
    return { success: true };
  } catch (error) {
    resetClient();
    console.error("Failed to close worker:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Strip claude-team session marker content from a message
// Returns the cleaned content, or null if the message should be filtered entirely
function stripClaudeTeamSessionContent(content: string): string | null {
  // Filter out the expected response to the marker
  if (content.trim() === "Identified!") {
    return null;
  }

  let cleaned = content;

  // Remove session marker tags: <!claude-team-session:...!> and <!claude-team-iterm:...!>
  cleaned = cleaned.replace(/<!claude-team-session:[^!]*!>/g, "");
  cleaned = cleaned.replace(/<!claude-team-iterm:[^!]*!>/g, "");

  // Remove the instruction text that accompanies the markers
  cleaned = cleaned.replace(
    /The above is a marker that assists Claude Teams in locating your session[^.]*\.[^\n]*/g,
    ""
  );

  // Clean up excessive whitespace that may remain
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  // If nothing meaningful remains, filter the entire message
  if (!cleaned) {
    return null;
  }

  return cleaned;
}

export async function getWorkerLogs(workerId: string): Promise<WorkerLog[]> {
  try {
    const c = await getClient();
    const result = await c.callTool({
      name: "read_worker_logs",
      arguments: {
        session_id: workerId,
      },
    });

    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find(
        (c: { type: string }) => c.type === "text"
      );
      if (textContent && "text" in textContent) {
        try {
          const parsed = JSON.parse(textContent.text as string);
          // Handle the new response format: { session_id, messages: [...] }
          const messages = parsed.messages || parsed;
          if (Array.isArray(messages)) {
            const result: WorkerLog[] = [];
            for (const log of messages) {
              const rawContent = String(
                log.content || log.message || log.text || ""
              );
              const cleanedContent = stripClaudeTeamSessionContent(rawContent);
              if (cleanedContent !== null) {
                result.push({
                  role: (log.role as "user" | "assistant") || "assistant",
                  content: cleanedContent,
                  timestamp: log.timestamp as string | undefined,
                });
              }
            }
            return result;
          }
        } catch {
          // Return raw text as a single log entry (with session markers stripped)
          const text = textContent.text as string;
          const cleanedText = stripClaudeTeamSessionContent(text);
          if (cleanedText === null) {
            return [];
          }
          return [{ role: "assistant", content: cleanedText }];
        }
      }
    }
    return [];
  } catch (error) {
    resetClient();
    console.error("Failed to get worker logs:", error);
    return [];
  }
}
