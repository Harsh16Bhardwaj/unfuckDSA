import type { WeeklyTask } from "./domain";

export const WEEKLY_TASK_HOURS = Array.from({ length: 16 }, (_, index) => index + 10);

export function getWeeklyTaskPlacement(task: WeeklyTask, startKey: string, occupied: ReadonlySet<string>) {
  const startHour = Number(startKey.slice(-2));
  const dayKey = startKey.slice(0, -3);
  if (!WEEKLY_TASK_HOURS.includes(startHour) || task.durationHours < 1 || startHour + task.durationHours > 26) return null;
  const keys = Array.from({ length: task.durationHours }, (_, offset) => `${dayKey}-${String(startHour + offset).padStart(2, "0")}`);
  if (keys.some((key) => occupied.has(key))) return null;
  return { dayKey, startHour, keys };
}
