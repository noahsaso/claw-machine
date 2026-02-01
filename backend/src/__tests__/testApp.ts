import { Hono } from "hono";
import { cors } from "hono/cors";
import { AUTH_PASSWORD } from "./setup";

/**
 * Creates a minimal test app with auth middleware.
 * Routes can be mounted on this app for testing.
 */
export function createTestApp() {
  const app = new Hono();

  // CORS middleware
  app.use(
    "*",
    cors({
      origin: "*",
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

  return app;
}
