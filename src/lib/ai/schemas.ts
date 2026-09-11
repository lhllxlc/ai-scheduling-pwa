import { DateTime } from "luxon";
import { z } from "zod";
import type { PlanDraft, Preferences, TaskInput } from "../shared/types";

// Offset required: never let a server's local timezone reinterpret an instant.
export const instantSchema = z.iso
  .datetime({ offset: true })
  .refine(
    (value) => DateTime.fromISO(value, { setZone: true }).isValid,
    "Invalid date or time",
  );
const wallTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");
export const taskStatusSchema = z.enum(["pending", "completed", "skipped"]);
const taskFields = z.strictObject({
  title: z.string().trim().min(1).max(200),
  kind: z.enum(["fixed", "deadline", "flexible", "recurring", "life", "break"]),
  durationMinutes: z.number().int().min(5).max(1440),
  priority: z.enum(["low", "medium", "high"]),
  startAt: instantSchema.nullable(),
  endAt: instantSchema.nullable(),
  dueAt: instantSchema.nullable(),
  splittable: z.boolean(),
  recurrence: z.enum(["none", "daily", "weekly"]),
});
export const taskInputSchema: z.ZodType<TaskInput> = taskFields.superRefine(
  (task, ctx) => {
    const issue = (path: keyof TaskInput, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (task.kind === "fixed" && (!task.startAt || !task.endAt))
      issue("startAt", "Fixed events require start and end times");
    if (Boolean(task.startAt) !== Boolean(task.endAt))
      issue("endAt", "Start and end must both be supplied");
    if (
      task.startAt &&
      task.endAt &&
      Date.parse(task.endAt) <= Date.parse(task.startAt)
    )
      issue("endAt", "End must follow start");
    if (task.kind === "deadline" && !task.dueAt)
      issue("dueAt", "Deadline tasks require a due date");
    if (task.kind === "recurring" && task.recurrence === "none")
      issue("recurrence", "Choose a recurrence");
  },
);
// Cross-field validation belongs to taskInputSchema after merging with stored data.
export const taskPatchSchema = taskFields
  .partial()
  .extend({ status: taskStatusSchema.optional() })
  .refine(
    (patch) => Object.keys(patch).length > 0,
    "Supply at least one change",
  );

export const preferencesSchema: z.ZodType<Preferences> = z
  .strictObject({
    locale: z.enum(["en", "zh"]),
    timezone: z.literal("Australia/Melbourne"),
    wakeTime: wallTime,
    sleepTime: wallTime,
    mealTimes: z
      .array(wallTime)
      .max(6)
      .refine(
        (values) => new Set(values).size === values.length,
        "Meal times must be unique",
      ),
    mealDurationMinutes: z.number().int().min(5).max(180),
    breakMinutes: z.number().int().min(0).max(120),
    commuteMinutes: z.number().int().min(0).max(240),
    eveningCutoff: wallTime,
    maxTaskMinutesPerDay: z.number().int().min(5).max(1440),
  })
  .refine((value) => value.wakeTime !== value.sleepTime, {
    path: ["sleepTime"],
    message: "Wake and sleep must differ",
  });

export const planDraftSchema: z.ZodType<PlanDraft> = z.strictObject({
  items: z.array(taskInputSchema).max(100),
  questions: z.array(z.string().trim().min(1).max(500)).max(20),
  confidence: z.number().min(0).max(1),
});
