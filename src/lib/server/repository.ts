import "server-only";
import { createHash } from "node:crypto";
import type { Preferences, Task, TaskInput } from "@/lib/shared/types";
import { DEFAULT_PREFERENCES } from "@/lib/shared/defaults";
import { context } from "./auth";
import { ApiError, demoCreate } from "./demo";
type Context = Awaited<ReturnType<typeof context>>;
type Row = Record<string, unknown>;
export function taskFromRow(r: Row): Task {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    title: r.title as string,
    kind: r.kind as Task["kind"],
    durationMinutes: r.duration_minutes as number,
    priority: r.priority as Task["priority"],
    startAt: r.start_at as string | null,
    endAt: r.end_at as string | null,
    dueAt: r.due_at as string | null,
    splittable: r.splittable as boolean,
    recurrence: r.recurrence as Task["recurrence"],
    status: r.status as Task["status"],
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}
function taskToRow(t: TaskInput) {
  return {
    title: t.title,
    kind: t.kind,
    duration_minutes: t.durationMinutes,
    priority: t.priority,
    start_at: t.startAt,
    end_at: t.endAt,
    due_at: t.dueAt,
    splittable: t.splittable,
    recurrence: t.recurrence,
  };
}
export async function listTasks(c: Context): Promise<Task[]> {
  if (c.demo)
    return [...c.demo.tasks.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  const { data, error } = await c
    .client!.from("tasks")
    .select("*")
    .eq("user_id", c.userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(taskFromRow);
}
export async function getTask(c: Context, id: string) {
  if (c.demo) {
    const task = c.demo.tasks.get(id);
    if (!task) throw new ApiError(404, "NOT_FOUND", "Task not found.");
    return task;
  }
  const { data, error } = await c
    .client!.from("tasks")
    .select("*")
    .eq("user_id", c.userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "NOT_FOUND", "Task not found.");
  return taskFromRow(data);
}
export async function createTask(c: Context, input: TaskInput, key: string) {
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  if (c.demo) return demoCreate(c.demo, input, key, hash);
  const { data, error } = await c.client!.rpc("create_task_idempotent", {
    request_key: key,
    request_hash: hash,
    task_data: taskToRow(input),
  });
  if (error) {
    if (error.message.includes("IDEMPOTENCY_CONFLICT"))
      throw new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This request key was already used for different data.",
      );
    throw error;
  }
  return taskFromRow(data);
}
export async function updateTask(
  c: Context,
  id: string,
  input: TaskInput,
  status: Task["status"],
) {
  if (c.demo) {
    const task = {
      ...(await getTask(c, id)),
      ...input,
      status,
      updatedAt: new Date().toISOString(),
    };
    c.demo.tasks.set(id, task);
    return task;
  }
  const { data, error } = await c
    .client!.from("tasks")
    .update({
      ...taskToRow(input),
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", c.userId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "NOT_FOUND", "Task not found.");
  return taskFromRow(data);
}
export async function deleteTask(c: Context, id: string) {
  await getTask(c, id);
  if (c.demo) c.demo.tasks.delete(id);
  else {
    const { error } = await c
      .client!.from("tasks")
      .delete()
      .eq("id", id)
      .eq("user_id", c.userId);
    if (error) throw error;
  }
  return { deleted: true };
}
export async function getPreferences(c: Context): Promise<Preferences> {
  if (c.demo) return structuredClone(c.demo.preferences);
  const { data, error } = await c
    .client!.from("preferences")
    .select("data")
    .eq("user_id", c.userId)
    .maybeSingle();
  if (error) throw error;
  return data?.data ?? structuredClone(DEFAULT_PREFERENCES);
}
export async function putPreferences(c: Context, data: Preferences) {
  if (c.demo) c.demo.preferences = structuredClone(data);
  else {
    const { error } = await c
      .client!.from("preferences")
      .upsert({
        user_id: c.userId,
        data,
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
  }
  return data;
}
