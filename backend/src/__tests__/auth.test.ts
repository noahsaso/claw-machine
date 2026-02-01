import { describe, it, expect, beforeEach } from "vitest";
import { createTestApp } from "./testApp";
import { authHeader, AUTH_PASSWORD } from "./setup";

describe("Auth Middleware", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
    // Add a protected test endpoint
    app.get("/api/test", (c) => c.json({ message: "authorized" }));
  });

  describe("protected endpoints", () => {
    it("returns 401 when no authorization header is provided", async () => {
      const res = await app.request("/api/test");

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Missing authorization");
    });

    it("returns 401 when authorization header does not start with Bearer", async () => {
      const res = await app.request("/api/test", {
        headers: { Authorization: "Basic sometoken" },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Missing authorization");
    });

    it("returns 401 when password is invalid", async () => {
      const res = await app.request("/api/test", {
        headers: { Authorization: "Bearer wrong-password" },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Invalid password");
    });

    it("allows access with valid Bearer token", async () => {
      const res = await app.request("/api/test", {
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("authorized");
    });

    it("accepts the default password from config", async () => {
      const res = await app.request("/api/test", {
        headers: { Authorization: `Bearer ${AUTH_PASSWORD}` },
      });

      expect(res.status).toBe(200);
    });
  });
});

describe("Health Check", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
  });

  it("returns 200 OK without authentication", async () => {
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
    expect(typeof body.timestamp).toBe("string");
  });

  it("returns ISO timestamp format", async () => {
    const res = await app.request("/health");

    const body = await res.json();
    // Verify ISO timestamp format
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it("works even with invalid auth header (auth is skipped)", async () => {
    const res = await app.request("/health", {
      headers: { Authorization: "Bearer wrong-password" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
