import type { Task } from "../shared/types";

export interface FixedConflict {
  taskIds: [string, string];
  startAt: string;
  endAt: string;
}
/** Read-only feasibility foundation. Never move events or claim flexible tasks are scheduled. */
export function detectFixedConflicts(tasks: readonly Task[]): FixedConflict[] {
  const fixed = tasks.filter(
    (task) => task.kind === "fixed" && task.status === "pending",
  );
  const intervals = fixed.map((task) => {
    const start = task.startAt ? Date.parse(task.startAt) : NaN;
    const end = task.endAt ? Date.parse(task.endAt) : NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
      throw new RangeError("Invalid fixed interval");
    return { id: task.id, start, end };
  });
  const conflicts: FixedConflict[] = [];
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const left = intervals[i],
        right = intervals[j];
      const start = Math.max(left.start, right.start),
        end = Math.min(left.end, right.end);
      if (start < end)
        conflicts.push({
          taskIds: [left.id, right.id],
          startAt: new Date(start).toISOString(),
          endAt: new Date(end).toISOString(),
        });
    }
  }
  return conflicts;
}
