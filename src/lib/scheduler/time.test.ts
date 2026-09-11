import { describe, expect, it } from "vitest";
import {
  dayBounds,
  formatInMelbourne,
  resolveLocalDateTime,
  weekBounds,
} from "./time";

const elapsedHours = (bounds: { startAt: string; endAt: string }) =>
  (Date.parse(bounds.endAt) - Date.parse(bounds.startAt)) / 3600000;
describe("Melbourne wall time", () => {
  it("uses winter and summer offsets", () => {
    expect(resolveLocalDateTime("2026-07-01T09:00")).toEqual({
      status: "valid",
      utc: "2026-06-30T23:00:00.000Z",
    });
    expect(resolveLocalDateTime("2026-01-01T09:00")).toEqual({
      status: "valid",
      utc: "2025-12-31T22:00:00.000Z",
    });
  });
  it("rejects nonexistent spring clock times", () =>
    expect(resolveLocalDateTime("2026-10-04T02:30")).toEqual({
      status: "nonexistent",
    }));
  it("returns both fall clock possibilities for explicit confirmation", () =>
    expect(resolveLocalDateTime("2026-04-05T02:30")).toEqual({
      status: "ambiguous",
      candidates: ["2026-04-04T15:30:00.000Z", "2026-04-04T16:30:00.000Z"],
    }));
  it.each([
    "2026-02-30T10:00",
    "2026-10-04T24:00",
    "2026-10-04",
    "2026-10-04T02:30Z",
  ])("rejects malformed calendar input %s", (input) =>
    expect(resolveLocalDateTime(input)).toEqual({ status: "invalid" }),
  );
  it("uses calendar days with 23/25 hour DST lengths", () => {
    expect(elapsedHours(dayBounds("2026-10-04"))).toBe(23);
    expect(elapsedHours(dayBounds("2026-04-05"))).toBe(25);
    expect(elapsedHours(dayBounds("2026-07-01"))).toBe(24);
  });
  it("week starts Monday and spans the spring offset transition", () => {
    expect(weekBounds("2026-10-04")).toEqual({
      startAt: "2026-09-27T14:00:00.000Z",
      endAt: "2026-10-04T13:00:00.000Z",
    });
    expect(elapsedHours(weekBounds("2026-10-04"))).toBe(167);
  });
  it("rejects invalid boundary dates", () =>
    expect(() => dayBounds("2026-02-30")).toThrow(RangeError));
  it("formats equivalent instants identically and requires offsets", () => {
    expect(formatInMelbourne("2026-09-11T00:00:00Z")).toBe(
      formatInMelbourne("2026-09-11T10:00:00+10:00"),
    );
    expect(formatInMelbourne("2026-09-11T00:00:00Z", "zh")).toContain("2026");
    expect(() => formatInMelbourne("2026-09-11T00:00:00")).toThrow(RangeError);
  });
});
