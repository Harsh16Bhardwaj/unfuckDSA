import type { AppState, CalendarSlot } from "./domain";
import { createSchedule } from "./scheduler";
import { getWeeklyTaskPlacement } from "./weekly-tasks";

export function reconcileRecurringAvailability(state: AppState): AppState {
  const next = materializeAvailability(state);
  return next === state
    ? state
    : {
        ...next,
        scheduled: createSchedule({
          problems: next.problems,
          slots: next.slots,
          mode: next.dayMode,
          manualRecallBlocks: next.manualRecallBlocks,
        }),
      };
}

export const localDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function calendarCellStartsAt(key: string) {
  const date = new Date(`${key.slice(0, -3)}T00:00:00`);
  date.setHours(Number(key.slice(-2)), 0, 0, 0);
  return date;
}
export function isPastCalendarCell(key: string, now = Date.now()) {
  return calendarCellStartsAt(key).getTime() < now;
}
export function isPastCalendarDay(dayKey: string, now = Date.now()) {
  return dayKey < localDay(new Date(now));
}
export function occupiedTaskCells(state: AppState) {
  return new Set(
    (state.weeklyTaskPlacements ?? []).flatMap((p) =>
      Array.from(
        { length: p.durationHours },
        (_, i) => `${p.dayKey}-${String(p.startHour + i).padStart(2, "0")}`,
      ),
    ),
  );
}
export function makeSlot(
  key: string,
  kind: CalendarSlot["kind"],
): CalendarSlot {
  const date = calendarCellStartsAt(key);
  return { id: `slot-${key}`, startsAt: date.toISOString(), kind };
}
export function materializeAvailability(
  state: AppState,
  start = new Date(),
  count = 21,
  now = Date.now(),
): AppState {
  const slots = new Map(state.slots.map((s) => [s.id, s]));
  const occupied = occupiedTaskCells(state);
  const exceptions = new Set(state.availabilityExceptions ?? []);
  for (let i = 0; i < count; i++) {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    const dayKey = localDay(day);
    for (const pattern of state.recurringAvailability ?? []) {
      if (pattern.weekday !== day.getDay() || dayKey < pattern.startsOn)
        continue;
      const key = `${dayKey}-${String(pattern.hour).padStart(2, "0")}`;
      if (
        !isPastCalendarCell(key, now) &&
        !slots.has(`slot-${key}`) &&
        !occupied.has(key) &&
        !exceptions.has(key)
      )
        slots.set(`slot-${key}`, makeSlot(key, pattern.kind));
    }
  }
  return slots.size === state.slots.length
    ? state
    : { ...state, slots: [...slots.values()] };
}
export function copyPreviousWeek(
  state: AppState,
  start: Date,
  now = new Date(),
) {
  const targets = new Set(
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return localDay(d);
    }),
  );
  const occupied = new Set([
    ...state.slots.map((s) => s.id.slice(5)),
    ...occupiedTaskCells(state),
  ]);
  const additions: CalendarSlot[] = [];
  for (const slot of state.slots) {
    const key = slot.id.slice(5);
    const d = new Date(`${key.slice(0, -3)}T00:00:00`);
    d.setDate(d.getDate() + 7);
    const target = `${localDay(d)}-${key.slice(-2)}`;
    if (
      targets.has(localDay(d)) &&
      !isPastCalendarCell(target, now.getTime()) &&
      !occupied.has(target)
    ) {
      additions.push(makeSlot(target, slot.kind));
      occupied.add(target);
    }
  }
  const placements = [...(state.weeklyTaskPlacements ?? [])];
  for (const previous of state.weeklyTaskPlacements ?? []) {
    const nextDate = new Date(`${previous.dayKey}T00:00:00`);
    nextDate.setDate(nextDate.getDate() + 7);
    const day = localDay(nextDate);
    if (!targets.has(day)) continue;
    if (
      isPastCalendarCell(
        `${day}-${String(previous.startHour).padStart(2, "0")}`,
        now.getTime(),
      )
    )
      continue;
    const task = state.weeklyTasks.find((item) => item.id === previous.taskId);
    if (!task) continue;
    const count = placements.filter(
      (item) => item.taskId === task.id && targets.has(item.dayKey),
    ).length;
    if (count >= task.sessionsPerWeek) continue;
    const placement = getWeeklyTaskPlacement(
      { ...task, durationHours: previous.durationHours },
      `${day}-${String(previous.startHour).padStart(2, "0")}`,
      occupied,
    );
    if (!placement) continue;
    placement.keys.forEach((key) => occupied.add(key));
    placements.push({ ...previous, id: crypto.randomUUID(), dayKey: day });
  }
  const sprintDays = { ...state.sprintDays };
  for (const [day, kind] of Object.entries(state.sprintDays)) {
    const date = new Date(`${day}T00:00:00`);
    date.setDate(date.getDate() + 7);
    const target = localDay(date);
    if (
      targets.has(target) &&
      !isPastCalendarDay(target, now.getTime()) &&
      !sprintDays[target]
    )
      sprintDays[target] = kind;
  }
  return {
    ...state,
    slots: [...state.slots, ...additions],
    weeklyTaskPlacements: placements,
    sprintDays,
  };
}

export function moveAvailability(
  state: AppState,
  sourceKey: string,
  targetKey: string,
  now = Date.now(),
): AppState {
  const source = state.slots.find((slot) => slot.id === `slot-${sourceKey}`);
  if (
    !source ||
    isPastCalendarCell(sourceKey, now) ||
    isPastCalendarCell(targetKey, now) ||
    sourceKey === targetKey ||
    state.slots.some((slot) => slot.id === `slot-${targetKey}`) ||
    occupiedTaskCells(state).has(targetKey)
  )
    return state;
  return {
    ...state,
    slots: state.slots.map((slot) =>
      slot.id === source.id ? makeSlot(targetKey, source.kind) : slot,
    ),
    availabilityExceptions: [
      ...new Set([
        ...(state.availabilityExceptions ?? []),
        sourceKey,
        targetKey,
      ]),
    ],
  };
}
