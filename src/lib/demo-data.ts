import type { AppState } from "./domain";

export function createInitialState(now = new Date()): AppState {
  void now;
  return {
    dailyTargetMinutes: 300,
    dayMode: "balanced",
    manualRecallBlocks: 2,
    problems: [],
    sessions: [],
    slots: [],
    scheduled: [],
    focusSprints: [],
    reviews: [],
    contests: [],
    sprintDays: {},
    weeklyTasks: [],
    weeklyTaskPlacements: [],
  };
}
