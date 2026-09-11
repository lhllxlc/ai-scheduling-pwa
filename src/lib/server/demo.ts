import { randomUUID } from "node:crypto";
import { DEFAULT_PREFERENCES } from "@/lib/shared/defaults";
import type { Preferences, Task, TaskInput } from "@/lib/shared/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
interface DemoData {
  userId: string;
  tasks: Map<string, Task>;
  preferences: Preferences;
  keys: Map<string, { hash: string; task: Task }>;
  expires: number;
}
const globalDemo = globalThis as typeof globalThis & {
  dayweaveDemo?: Map<string, DemoData>;
};
const sessions = (globalDemo.dayweaveDemo ??= new Map());
export function demoEnabled() {
  return (
    process.env.APP_DEMO_MODE === "true" &&
    process.env.NODE_ENV !== "production"
  );
}
export function createDemoSession() {
  for (const [id, data] of sessions)
    if (data.expires < Date.now()) sessions.delete(id);
  if (sessions.size >= 1000)
    throw new ApiError(
      429,
      "CAPACITY",
      "Demo capacity reached. Try again later.",
    );
  const token = randomUUID();
  sessions.set(token, {
    userId: randomUUID(),
    tasks: new Map(),
    preferences: structuredClone(DEFAULT_PREFERENCES),
    keys: new Map(),
    expires: Date.now() + 86400000,
  });
  return token;
}
export function getDemoSession(token?: string) {
  const data = token ? sessions.get(token) : undefined;
  return data && data.expires > Date.now() ? data : undefined;
}
export function deleteDemoSession(token: string) {
  sessions.delete(token);
}
export function demoCreate(
  data: DemoData,
  input: TaskInput,
  key: string,
  hash: string,
) {
  const previous = data.keys.get(key);
  if (previous) {
    if (previous.hash !== hash)
      throw new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This request key was already used for different data.",
      );
    return previous.task;
  }
  if (data.tasks.size >= 1000)
    throw new ApiError(429, "CAPACITY", "Demo task limit reached.");
  const now = new Date().toISOString();
  const task: Task = {
    ...input,
    id: randomUUID(),
    userId: data.userId,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  data.tasks.set(task.id, task);
  data.keys.set(key, { hash, task });
  return task;
}
