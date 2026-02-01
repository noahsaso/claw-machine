import { describe, it, expect } from "vitest";
import { formatWorkerContext } from "./workerContext";
import { CONTEXT_MESSAGE_LIMIT, CONTENT_TRUNCATE_LENGTH } from "../config";
import type { WorkerLog } from "../types";

describe("formatWorkerContext", () => {
  const createLog = (overrides: Partial<WorkerLog> = {}): WorkerLog => ({
    role: "assistant",
    content: "Log content",
    ...overrides,
  });

  it("returns null for empty array", () => {
    const result = formatWorkerContext([]);
    expect(result).toBeNull();
  });

  it("returns null for null/undefined input", () => {
    // @ts-expect-error Testing null input
    expect(formatWorkerContext(null)).toBeNull();
    // @ts-expect-error Testing undefined input
    expect(formatWorkerContext(undefined)).toBeNull();
  });

  it("formats a single log entry", () => {
    const logs = [createLog({ role: "assistant", content: "Hello" })];

    const result = formatWorkerContext(logs);

    expect(result).toBe("[assistant]: Hello");
  });

  it("formats multiple log entries with newlines", () => {
    const logs = [
      createLog({ role: "user", content: "Request" }),
      createLog({ role: "assistant", content: "Response" }),
    ];

    const result = formatWorkerContext(logs);

    expect(result).toBe("[user]: Request\n[assistant]: Response");
  });

  it("takes only the last N messages based on CONTEXT_MESSAGE_LIMIT", () => {
    const logs: WorkerLog[] = [];
    for (let i = 0; i < CONTEXT_MESSAGE_LIMIT + 5; i++) {
      logs.push(createLog({ content: `Message ${i}` }));
    }

    const result = formatWorkerContext(logs);

    // Should only contain the last CONTEXT_MESSAGE_LIMIT messages
    expect(result).not.toContain("Message 0");
    expect(result).not.toContain("Message 4"); // First 5 should be cut off
    expect(result).toContain(`Message ${CONTEXT_MESSAGE_LIMIT + 4}`); // Last one should be present
  });

  it("truncates long content at CONTENT_TRUNCATE_LENGTH", () => {
    const longContent = "x".repeat(CONTENT_TRUNCATE_LENGTH + 100);
    const logs = [createLog({ content: longContent })];

    const result = formatWorkerContext(logs);

    // Should be truncated to CONTENT_TRUNCATE_LENGTH
    expect(result).toBe(`[assistant]: ${"x".repeat(CONTENT_TRUNCATE_LENGTH)}`);
    expect(result!.length).toBe(
      "[assistant]: ".length + CONTENT_TRUNCATE_LENGTH
    );
  });

  it("handles non-string content by stringifying", () => {
    const logs = [
      // @ts-expect-error Testing object content
      createLog({ content: { key: "value" } }),
    ];

    const result = formatWorkerContext(logs);

    expect(result).toBe('[assistant]: {"key":"value"}');
  });

  it("preserves both user and assistant roles", () => {
    const logs = [
      createLog({ role: "user", content: "User message" }),
      createLog({ role: "assistant", content: "Assistant response" }),
    ];

    const result = formatWorkerContext(logs);

    expect(result).toContain("[user]: User message");
    expect(result).toContain("[assistant]: Assistant response");
  });

  it("handles logs with timestamps (ignores them)", () => {
    const logs = [
      createLog({
        content: "Message",
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
    ];

    const result = formatWorkerContext(logs);

    // Timestamp should not appear in output
    expect(result).toBe("[assistant]: Message");
    expect(result).not.toContain("2026");
  });

  it("handles exactly CONTEXT_MESSAGE_LIMIT messages", () => {
    const logs: WorkerLog[] = [];
    for (let i = 0; i < CONTEXT_MESSAGE_LIMIT; i++) {
      logs.push(createLog({ content: `Msg${i}` }));
    }

    const result = formatWorkerContext(logs);

    // All messages should be present
    for (let i = 0; i < CONTEXT_MESSAGE_LIMIT; i++) {
      expect(result).toContain(`Msg${i}`);
    }
  });

  it("handles content at exactly CONTENT_TRUNCATE_LENGTH", () => {
    const exactContent = "y".repeat(CONTENT_TRUNCATE_LENGTH);
    const logs = [createLog({ content: exactContent })];

    const result = formatWorkerContext(logs);

    expect(result).toBe(`[assistant]: ${exactContent}`);
  });
});
