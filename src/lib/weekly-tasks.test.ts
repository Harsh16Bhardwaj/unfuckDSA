import { describe, expect, it } from "vitest";
import type { WeeklyTask } from "./domain";
import { getWeeklyTaskPlacement } from "./weekly-tasks";

const task: WeeklyTask = { id: "hld", title: "HLD", durationHours: 3, sessionsPerWeek: 2, color: "#000", createdAt: "2026-09-19T00:00:00.000Z" };

describe("weekly task placement", () => {
  it("claims every consecutive hour atomically", () => {
    expect(getWeeklyTaskPlacement(task, "2026-09-19-14", new Set())?.keys).toEqual(["2026-09-19-14", "2026-09-19-15", "2026-09-19-16"]);
  });

  it("rejects a placement when any covered hour is occupied", () => {
    expect(getWeeklyTaskPlacement(task, "2026-09-19-14", new Set(["2026-09-19-15"]))).toBeNull();
  });

  it("rejects a placement that extends beyond the 1 AM cell", () => {
    expect(getWeeklyTaskPlacement(task, "2026-09-19-24", new Set())).toBeNull();
  });
});
