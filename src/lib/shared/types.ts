export type Locale = "en" | "zh";
export type TaskKind =
  "fixed" | "deadline" | "flexible" | "recurring" | "life" | "break";
export type TaskStatus = "pending" | "completed" | "skipped";
export interface TaskInput {
  title: string;
  kind: TaskKind;
  durationMinutes: number;
  priority: "low" | "medium" | "high";
  startAt: string | null;
  endAt: string | null;
  dueAt: string | null;
  splittable: boolean;
  recurrence: "none" | "daily" | "weekly";
}
export interface Task extends TaskInput {
  id: string;
  userId: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}
export interface Preferences {
  locale: Locale;
  timezone: "Australia/Melbourne";
  wakeTime: string;
  sleepTime: string;
  mealTimes: string[];
  mealDurationMinutes: number;
  breakMinutes: number;
  commuteMinutes: number;
  eveningCutoff: string;
  maxTaskMinutesPerDay: number;
}
export interface SessionInfo {
  user: { id: string; email: string } | null;
  mode: "demo" | "supabase" | "unconfigured";
}
export type ApiResult<T> =
  { data: T } | { error: { code: string; message: string } };
export interface PlanDraft {
  items: TaskInput[];
  questions: string[];
  confidence: number;
}
export interface ScheduleBlock {
  taskId: string;
  startAt: string;
  endAt: string;
  explanation: string;
}
export interface ScheduleResult {
  blocks: ScheduleBlock[];
  unscheduled: { taskId: string; minutes: number; reason: string }[];
  warnings: string[];
}
