// Server configuration
export const PORT = process.env.PORT || 18800;
export const HOST = process.env.HOST || "0.0.0.0";

// Authentication
export const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "claw-machine-2026";

// OpenClaw gateway
export const OPENCLAW_GATEWAY =
  process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789";
export const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || "";

// Sync intervals (in milliseconds)
export const WORKER_SYNC_INTERVAL = 2000;
export const LOG_SYNC_INTERVAL = 3000;

// Worker prompt template
export const WORKTREE_NOTE = `**IMPORTANT:** You are in a fresh git worktree with no dependencies installed. Before running any package scripts (tsc, build, test, lint, etc.), you MUST install dependencies first: Check package.json to see which package manager the project uses (\`npm install\`, \`pnpm install\`, \`bun install\`, etc.)`;

// Context message limit and truncate length
export const CONTEXT_MESSAGE_LIMIT = 10;
export const CONTENT_TRUNCATE_LENGTH = 1000;
