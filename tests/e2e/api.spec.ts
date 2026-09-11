import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const input = {
  title: "Assignment draft",
  kind: "deadline",
  durationMinutes: 90,
  priority: "high",
  startAt: null,
  endAt: null,
  dueAt: "2026-10-10T10:00:00Z",
  splittable: true,
  recurrence: "none",
};
test("private API isolation, validation, idempotency and account lifecycle", async ({
  playwright,
  baseURL,
}) => {
  const alice = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL! },
  });
  const bob = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL! },
  });
  expect((await alice.get("/api/tasks")).status()).toBe(401);
  expect(
    (await alice.post("/api/auth", { data: { action: "demo" } })).ok(),
  ).toBeTruthy();
  expect(
    (await bob.post("/api/auth", { data: { action: "demo" } })).ok(),
  ).toBeTruthy();
  const key = randomUUID();
  const options = { data: input, headers: { "Idempotency-Key": key } };
  const created = await alice.post("/api/tasks", options);
  expect(created.status()).toBe(201);
  const { data: task } = await created.json();
  const replay = await alice.post("/api/tasks", options);
  expect((await replay.json()).data.id).toBe(task.id);
  expect(
    (
      await alice.post("/api/tasks", {
        data: { ...input, title: "Different payload" },
        headers: options.headers,
      })
    ).status(),
  ).toBe(409);
  expect((await alice.get("/api/tasks")).headers()["cache-control"]).toContain(
    "no-store",
  );
  expect((await (await bob.get("/api/tasks")).json()).data).toHaveLength(0);
  expect(
    (
      await bob.patch(`/api/tasks/${task.id}`, {
        data: { status: "completed" },
      })
    ).status(),
  ).toBe(404);
  expect((await bob.delete(`/api/tasks/${task.id}`)).status()).toBe(404);
  expect(
    (
      await alice.post("/api/tasks", {
        data: { ...input, durationMinutes: -1 },
        headers: { "Idempotency-Key": randomUUID() },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await alice.patch(`/api/tasks/${task.id}`, {
        data: { status: "completed" },
      })
    ).ok(),
  ).toBeTruthy();
  const exported = await alice.get("/api/export");
  expect(exported.ok()).toBeTruthy();
  expect(JSON.stringify(await exported.json())).toContain("Assignment draft");
  expect(
    (
      await alice.post("/api/auth", {
        data: { action: "logout" },
        headers: { Origin: "https://attacker.example" },
      })
    ).status(),
  ).toBe(403);
  expect((await alice.delete(`/api/tasks/${task.id}`)).ok()).toBeTruthy();
  expect(
    (
      await alice.delete("/api/account", { data: { confirmation: "DELETE" } })
    ).ok(),
  ).toBeTruthy();
  expect((await alice.get("/api/tasks")).status()).toBe(401);
  await alice.dispose();
  await bob.dispose();
});
