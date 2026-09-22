import { describe, expect, it } from "vitest";
import { createInitialState } from "./demo-data";
import type { Problem, StudySession } from "./domain";
import { mergeWorkspaceStates } from "./workspace-merge";

function problem(id: string, slug: string): Problem {
  return {
    id,
    source: "leetcode",
    slug,
    title: slug,
    topics: [],
    difficulty: "medium",
    priority: "normal",
    revisionMinutes: 20,
    scheduleTemplate: "default",
    needsVisual: false,
    initialMinutes: 20,
    reviewStage: 0,
    dueAt: "2026-09-23T10:00:00.000Z",
    status: "solved_independently",
    revealCount: 0,
    createdAt: "2026-09-22T10:00:00.000Z",
  };
}

function session(id: string, problemId: string, minutes: number): StudySession {
  return {
    id,
    problemId,
    startedAt: "2026-09-22T10:00:00.000Z",
    endedAt: "2026-09-22T11:00:00.000Z",
    activeMinutes: minutes,
    pausedMinutes: 0,
    idempotencyKey: `extension-local-${id}`,
  };
}

describe("workspace state merge", () => {
  it("preserves sessions created on two devices", () => {
    const laptopA = { ...createInitialState(), problems: [problem("a-two", "two-sum")], sessions: [session("a", "a-two", 31)] };
    const laptopB = { ...createInitialState(), problems: [problem("b-three", "three-sum")], sessions: [session("b", "b-three", 20)] };
    const merged = mergeWorkspaceStates(laptopA, laptopB);
    expect(merged.sessions.map((value) => value.idempotencyKey).sort()).toEqual(["extension-local-a", "extension-local-b"]);
    expect(merged.sessions.reduce((sum, value) => sum + value.activeMinutes, 0)).toBe(51);
  });

  it("deduplicates the same extension record and canonical problem across devices", () => {
    const laptopA = { ...createInitialState(), problems: [problem("a-two", "two-sum")], sessions: [session("same", "a-two", 51)] };
    const laptopB = { ...createInitialState(), problems: [problem("b-two", "two-sum")], sessions: [session("same", "b-two", 51)] };
    const merged = mergeWorkspaceStates(laptopA, laptopB);
    expect(merged.problems).toHaveLength(1);
    expect(merged.sessions).toHaveLength(1);
    expect(merged.sessions[0].problemId).toBe(merged.problems[0].id);
  });

  it("keeps deleted problems deleted when an older browser writes again", () => {
    const oldBrowser = { ...createInitialState(), problems: [problem("old", "two-sum")] };
    const newer = { ...createInitialState(), deletedProblemKeys: ["leetcode:two-sum"] };
    expect(mergeWorkspaceStates(newer, oldBrowser).problems).toHaveLength(0);
  });
});
