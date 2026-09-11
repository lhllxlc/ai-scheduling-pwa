import type { Preferences } from "./types";
export const DEFAULT_PREFERENCES: Preferences = {
  locale: "en",
  timezone: "Australia/Melbourne",
  wakeTime: "07:00",
  sleepTime: "23:00",
  mealTimes: ["08:00", "12:30", "18:30"],
  mealDurationMinutes: 30,
  breakMinutes: 15,
  commuteMinutes: 30,
  eveningCutoff: "21:00",
  maxTaskMinutesPerDay: 240,
};
