import type { AppState, CalendarSlot } from "./domain";
import { createSchedule } from "./scheduler";

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
  const date = new Date(`${key.slice(0, -3)}T00:00:00`);
  date.setHours(Number(key.slice(-2)), 0, 0, 0);
  return { id: `slot-${key}`, startsAt: date.toISOString(), kind };
}
export function materializeAvailability(
  state: AppState,
  start = new Date(),
  count = 21,
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
export function copyPreviousWeek(state: AppState, start: Date) {
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
    if (targets.has(localDay(d)) && !occupied.has(target)) {
      additions.push(makeSlot(target, slot.kind));
      occupied.add(target);
    }
  }
  return { ...state, slots: [...state.slots, ...additions] };
}

export function moveAvailability(
  state: AppState,
  sourceKey: string,
  targetKey: string,
): AppState {
  const source = state.slots.find((slot) => slot.id === `slot-${sourceKey}`);
  if (
    !source ||
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
