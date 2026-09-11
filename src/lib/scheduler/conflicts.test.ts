import { describe, expect, it } from "vitest";
import type { Task } from "../shared/types";
import { detectFixedConflicts } from "./conflicts";

function fixed(
  id: string,
  startAt: string,
  endAt: string,
  status: Task["status"] = "pending",
): Task {
  return {
    id,
    userId: "user",
    title: id,
    kind: "fixed",
    durationMinutes: 60,
    priority: "medium",
    startAt,
    endAt,
    dueAt: null,
    splittable: false,
    recurrence: "none",
    status,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}
describe("fixed conflicts", () => {
  it("compares actual instants and leaves input unchanged", () => {
    const tasks = [
      fixed("a", "2026-04-05T02:00:00+11:00", "2026-04-05T03:00:00+10:00"),
      fixed("b", "2026-04-04T16:30:00Z", "2026-04-04T17:30:00Z"),
    ];
    const original = structuredClone(tasks);
    expect(detectFixedConflicts(tasks)).toEqual([
      {
        taskIds: ["a", "b"],
        startAt: "2026-04-04T16:30:00.000Z",
        endAt: "2026-04-04T17:00:00.000Z",
      },
    ]);
    expect(tasks).toEqual(original);
  });
  it("permits adjacent intervals and excludes completed/skipped/flexible tasks", () => {
    const a = fixed("a", "2026-09-11T09:00:00Z", "2026-09-11T10:00:00Z");
    const b = fixed("b", "2026-09-11T10:00:00Z", "2026-09-11T11:00:00Z");
    expect(
      detectFixedConflicts([
        a,
        b,
        { ...a, id: "c", status: "completed" },
        { ...a, id: "d", status: "skipped" },
        { ...a, id: "e", kind: "flexible" },
      ]),
    ).toEqual([]);
  });
  it("reports every overlap pair including containment", () => {
    const a = fixed("a", "2026-09-11T09:00:00Z", "2026-09-11T12:00:00Z");
    expect(
      detectFixedConflicts([a, { ...a, id: "b" }, { ...a, id: "c" }]),
    ).toHaveLength(3);
  });
  it("rejects malformed fixed intervals instead of silently omitting them", () =>
    expect(() =>
      detectFixedConflicts([fixed("a", "invalid", "invalid")]),
    ).toThrow(RangeError));
});
