import { DateTime } from "luxon";

export const MELBOURNE_ZONE = "Australia/Melbourne";
export type LocalTimeResolution =
  | { status: "valid"; utc: string }
  | { status: "ambiguous"; candidates: string[] }
  | { status: "nonexistent" | "invalid" };

/** Accept the minute precision emitted by datetime-local inputs; ambiguity needs user choice. */
export function resolveLocalDateTime(local: string): LocalTimeResolution {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    return { status: "invalid" };
  const calendar = DateTime.fromISO(local, { zone: "UTC" });
  if (!calendar.isValid || calendar.toFormat("yyyy-MM-dd'T'HH:mm") !== local)
    return { status: "invalid" };
  const date = DateTime.fromISO(local, { zone: MELBOURNE_ZONE });
  if (!date.isValid) return { status: "invalid" };
  if (date.toFormat("yyyy-MM-dd'T'HH:mm") !== local)
    return { status: "nonexistent" };
  const candidates = [
    ...new Set(
      date.getPossibleOffsets().map((value) => value.toUTC().toISO()!),
    ),
  ].sort();
  return candidates.length > 1
    ? { status: "ambiguous", candidates }
    : { status: "valid", utc: candidates[0] };
}

function localDate(date: string): DateTime {
  const parsed = DateTime.fromISO(date, { zone: MELBOURNE_ZONE });
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !parsed.isValid ||
    parsed.toISODate() !== date
  )
    throw new RangeError("Invalid local date");
  return parsed.startOf("day");
}
function bounds(start: DateTime, end: DateTime) {
  return { startAt: start.toUTC().toISO()!, endAt: end.toUTC().toISO()! };
}
/** Half-open calendar bounds; days on DST transitions have 23 or 25 hours. */
export function dayBounds(date: string) {
  const start = localDate(date);
  return bounds(start, start.plus({ days: 1 }));
}
/** Monday-start calendar week independent of browser locale. */
export function weekBounds(date: string) {
  const start = localDate(date).startOf("week");
  return bounds(start, start.plus({ weeks: 1 }));
}
export function formatInMelbourne(
  instant: string,
  locale: "en" | "zh" = "en",
): string {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(instant))
    throw new RangeError("An offset is required");
  const date = DateTime.fromISO(instant, { setZone: true }).setZone(
    MELBOURNE_ZONE,
  );
  if (!date.isValid) throw new RangeError("Invalid instant");
  return date
    .setLocale(locale === "zh" ? "zh-CN" : "en-AU")
    .toLocaleString(DateTime.DATETIME_MED);
}
