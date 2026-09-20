import { describe, it, expect } from "vitest";
import { createInitialState } from "./demo-data";
import {
  copyPreviousWeek,
  materializeAvailability,
  makeSlot,
  moveAvailability,
} from "./calendar-pattern";
describe("calendar availability", () => {
  it("moves an hour atomically, rejects occupied targets, and prevents its recurring source from reappearing", () => {
    const state = createInitialState();
    state.slots = [
      makeSlot("2026-09-21-10", "dsa"),
      makeSlot("2026-09-21-12", "busy"),
    ];
    state.recurringAvailability = [
      { weekday: 1, hour: 10, kind: "dsa", startsOn: "2026-09-21" },
    ];
    expect(moveAvailability(state, "2026-09-21-10", "2026-09-21-12")).toBe(
      state,
    );
    const moved = moveAvailability(state, "2026-09-21-10", "2026-09-21-11");
    expect(moved.slots[0].id).toBe("slot-2026-09-21-11");
    expect(
      materializeAvailability(moved, new Date("2026-09-21T00:00:00"), 1).slots,
    ).toEqual(moved.slots);
  });
  it("copies the previous week without overwriting bookings or occupied hours, including after midnight", () => {
    const state = createInitialState();
    state.slots = [
      makeSlot("2026-09-14-10", "dsa"),
      makeSlot("2026-09-14-11", "dev"),
      makeSlot("2026-09-14-24", "dsa"),
      makeSlot("2026-09-21-10", "busy"),
    ];
    state.weeklyTaskPlacements = [
      {
        id: "task",
        taskId: "t",
        dayKey: "2026-09-21",
        startHour: 11,
        durationHours: 2,
      },
    ];
    const result = copyPreviousWeek(state, new Date("2026-09-21T00:00:00"));
    expect(result.slots.find((s) => s.id === "slot-2026-09-21-10")?.kind).toBe(
      "busy",
    );
    expect(result.slots.some((s) => s.id === "slot-2026-09-21-11")).toBe(false);
    expect(result.slots.find((s) => s.id === "slot-2026-09-21-24")?.kind).toBe(
      "dsa",
    );
    expect(
      copyPreviousWeek(result, new Date("2026-09-21T00:00:00")).slots,
    ).toEqual(result.slots);
  });
  it("repeats by weekday while respecting starts, exceptions and task bookings", () => {
    const state = createInitialState();
    state.recurringAvailability = [
      { weekday: 1, hour: 10, kind: "dsa", startsOn: "2026-09-21" },
    ];
    state.availabilityExceptions = ["2026-09-28-10"];
    state.weeklyTaskPlacements = [
      {
        id: "task",
        taskId: "t",
        dayKey: "2026-10-05",
        startHour: 10,
        durationHours: 2,
      },
    ];
    const result = materializeAvailability(
      state,
      new Date("2026-09-14T00:00:00"),
      36,
    );
    expect(result.slots.map((s) => s.id)).toEqual([
      "slot-2026-09-21-10",
      "slot-2026-10-12-10",
      "slot-2026-10-19-10",
    ]);
    expect(
      materializeAvailability(result, new Date("2026-09-14T00:00:00"), 36),
    ).toBe(result);
  });
});
