import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "../shared/defaults";
import type { TaskInput } from "../shared/types";
import {
  instantSchema,
  planDraftSchema,
  preferencesSchema,
  taskInputSchema,
  taskPatchSchema,
} from "./schemas";
import { AI_PRIVACY_PREVIEW, planParser } from "./parser";

const task: TaskInput = {
  title: "申请 5 jobs",
  kind: "flexible",
  durationMinutes: 60,
  priority: "medium",
  startAt: null,
  endAt: null,
  dueAt: null,
  splittable: true,
  recurrence: "none",
};
describe("structured validation", () => {
  it("accepts bilingual titles and matches shared types", () =>
    expect(taskInputSchema.parse(task)).toEqual(task));
  it.each([
    "2026-02-30T10:00:00Z",
    "2026-09-11T10:00:00",
    "tomorrow",
    "2026-09-11",
  ])("rejects invalid or unzoned instant %s", (value) =>
    expect(instantSchema.safeParse(value).success).toBe(false),
  );
  it.each(["2026-09-11T10:00:00+10:00", "2026-09-11T00:00:00Z"])(
    "accepts offset instant %s",
    (value) => expect(instantSchema.safeParse(value).success).toBe(true),
  );
  it("requires both fixed endpoints and their absolute order", () => {
    expect(taskInputSchema.safeParse({ ...task, kind: "fixed" }).success).toBe(
      false,
    );
    expect(
      taskInputSchema.safeParse({
        ...task,
        kind: "fixed",
        startAt: "2026-04-05T02:30:00+11:00",
        endAt: "2026-04-05T02:15:00+10:00",
      }).success,
    ).toBe(true);
    expect(
      taskInputSchema.safeParse({
        ...task,
        kind: "fixed",
        startAt: "2026-04-05T02:30:00+10:00",
        endAt: "2026-04-05T02:45:00+11:00",
      }).success,
    ).toBe(false);
  });
  it("requires deadlines and recurrence details", () => {
    expect(
      taskInputSchema.safeParse({ ...task, kind: "deadline" }).success,
    ).toBe(false);
    expect(
      taskInputSchema.safeParse({ ...task, kind: "recurring" }).success,
    ).toBe(false);
    expect(
      taskInputSchema.safeParse({
        ...task,
        kind: "recurring",
        recurrence: "weekly",
      }).success,
    ).toBe(true);
  });
  it("rejects unknown ownership fields and empty mutations", () => {
    expect(
      taskInputSchema.safeParse({ ...task, userId: "another-user" }).success,
    ).toBe(false);
    expect(taskPatchSchema.safeParse({ userId: "another-user" }).success).toBe(
      false,
    );
    expect(taskPatchSchema.safeParse({}).success).toBe(false);
    expect(taskPatchSchema.parse({ status: "completed" })).toEqual({
      status: "completed",
    });
  });
  it.each([0, 4, 1441, 15.5, NaN])(
    "rejects invalid task duration %s",
    (durationMinutes) =>
      expect(
        taskInputSchema.safeParse({ ...task, durationMinutes }).success,
      ).toBe(false),
  );
  it("validates preferences and allows overnight sleep", () => {
    expect(preferencesSchema.parse(DEFAULT_PREFERENCES)).toEqual(
      DEFAULT_PREFERENCES,
    );
    expect(
      preferencesSchema.safeParse({
        ...DEFAULT_PREFERENCES,
        wakeTime: "15:00",
        sleepTime: "07:00",
      }).success,
    ).toBe(true);
    expect(
      preferencesSchema.safeParse({ ...DEFAULT_PREFERENCES, wakeTime: "24:00" })
        .success,
    ).toBe(false);
    expect(
      preferencesSchema.safeParse({ ...DEFAULT_PREFERENCES, timezone: "UTC" })
        .success,
    ).toBe(false);
    expect(
      preferencesSchema.safeParse({
        ...DEFAULT_PREFERENCES,
        mealTimes: ["12:00", "12:00"],
      }).success,
    ).toBe(false);
  });
  it("bounds confidence and rejects raw-plan persistence fields", () => {
    expect(
      planDraftSchema.parse({ items: [task], questions: [], confidence: 1 })
        .items,
    ).toHaveLength(1);
    expect(
      planDraftSchema.safeParse({ items: [], questions: [], confidence: 1.1 })
        .success,
    ).toBe(false);
    expect(
      planDraftSchema.safeParse({
        items: [],
        questions: [],
        confidence: 0,
        rawInput: "secret",
      }).success,
    ).toBe(false);
  });
  it("disabled parser never invokes network or returns input", async () => {
    const network = vi.spyOn(globalThis, "fetch");
    try {
      expect(await planParser.parse("private plan")).toEqual({
        available: false,
        code: "AI_NOT_ENABLED",
      });
      expect(network).not.toHaveBeenCalled();
      expect(AI_PRIVACY_PREVIEW).toEqual({
        enabled: false,
        fieldsSent: [],
        rawInputRetained: false,
      });
    } finally {
      network.mockRestore();
    }
  });
});
