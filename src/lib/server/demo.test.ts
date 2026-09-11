import { afterEach, describe, expect, it, vi } from "vitest";
afterEach(() => vi.unstubAllEnvs());
import {
  createDemoSession,
  deleteDemoSession,
  demoCreate,
  demoEnabled,
  getDemoSession,
} from "./demo";
import { body, checkOrigin, localLimit, route } from "./http";
import type { TaskInput } from "@/lib/shared/types";
const input: TaskInput = {
  title: "Study",
  kind: "flexible",
  durationMinutes: 30,
  priority: "medium",
  startAt: null,
  endAt: null,
  dueAt: null,
  splittable: true,
  recurrence: "none",
};
describe("local demo boundaries", () => {
  it("never enables demo in production even when explicitly requested", () => {
    vi.stubEnv("APP_DEMO_MODE", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect(demoEnabled()).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    expect(demoEnabled()).toBe(true);
    vi.stubEnv("APP_DEMO_MODE", "");
    expect(demoEnabled()).toBe(false);
  });
  it("isolates sessions and deletes only the selected account", () => {
    const a = createDemoSession(),
      b = createDemoSession();
    const da = getDemoSession(a)!,
      db = getDemoSession(b)!;
    demoCreate(da, input, crypto.randomUUID(), "a");
    expect(db.tasks.size).toBe(0);
    expect(da.userId).not.toBe(db.userId);
    deleteDemoSession(a);
    expect(getDemoSession(a)).toBeUndefined();
    expect(getDemoSession(b)).toBeDefined();
    deleteDemoSession(b);
  });
  it("replays keys without duplicate tasks and rejects changed payload", () => {
    const token = createDemoSession(),
      data = getDemoSession(token)!;
    const key = crypto.randomUUID();
    const first = demoCreate(data, input, key, "hash");
    expect(demoCreate(data, input, key, "hash")).toEqual(first);
    expect(data.tasks.size).toBe(1);
    expect(() =>
      demoCreate(data, { ...input, title: "different" }, key, "other"),
    ).toThrow("different data");
    deleteDemoSession(token);
  });
});
describe("HTTP guards", () => {
  it("uses the configured external origin behind a proxy without trusting forwarded hosts", () => {
    vi.stubEnv("APP_ORIGIN", "https://planner.example");
    expect(() =>
      checkOrigin(
        new Request("http://localhost/api/tasks", {
          headers: { origin: "https://planner.example" },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      checkOrigin(
        new Request("http://localhost/api/tasks", {
          headers: {
            origin: "https://evil.invalid",
            "x-forwarded-host": "evil.invalid",
          },
        }),
      ),
    ).toThrow();
  });
  it("rejects missing and cross-site origins", () => {
    expect(() =>
      checkOrigin(new Request("http://localhost/api/tasks")),
    ).toThrow();
    expect(() =>
      checkOrigin(
        new Request("http://localhost/api/tasks", {
          headers: { origin: "https://evil.invalid" },
        }),
      ),
    ).toThrow();
    expect(() =>
      checkOrigin(
        new Request("http://localhost/api/tasks", {
          headers: { origin: "http://localhost" },
        }),
      ),
    ).not.toThrow();
  });
  it("rejects malformed and oversized JSON without returning content", async () => {
    await expect(
      body(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "private invalid",
        }),
      ),
    ).rejects.toThrow("Invalid JSON");
    await expect(
      body(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify("a".repeat(17000)),
        }),
      ),
    ).rejects.toThrow("16 KB");
    const result = await route(async () => {
      throw new Error("SECRET");
    });
    expect(await result.text()).not.toContain("SECRET");
    expect(result.status).toBe(500);
  });
  it("enforces burst limits", () => {
    const key = crypto.randomUUID();
    localLimit(key, 1);
    expect(() => localLimit(key, 1)).toThrow("Too many requests");
  });
});
