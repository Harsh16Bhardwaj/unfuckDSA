import { describe, expect, it } from "vitest";
import { createInitialState } from "./demo-data";
import { completeRevision } from "./revisions";

describe("revision completion", () => {
  it("records a good review, advances the stage and completes the plan", () => {
    const state = createInitialState();
    state.problems = [
      {
        id: "two-sum",
        source: "leetcode",
        slug: "two-sum",
        title: "Two Sum",
        url: "https://leetcode.com/problems/two-sum/",
        topics: ["Arrays"],
        difficulty: "easy",
        priority: "normal",
        revisionMinutes: 10,
        scheduleTemplate: "default",
        needsVisual: false,
        initialMinutes: 12,
        reviewStage: 0,
        dueAt: "2026-09-20T10:00:00.000Z",
        status: "solved_independently",
        revealCount: 0,
        createdAt: "2026-09-19T10:00:00.000Z",
      },
    ];
    state.scheduled = [
      {
        id: "plan-two-sum",
        problemId: "two-sum",
        slotId: "slot-1",
        minutes: 10,
        priorityScore: 10,
        reason: ["due for recall"],
        status: "planned",
      },
    ];

    const result = completeRevision(
      state,
      "two-sum",
      "plan-two-sum",
      new Date("2026-09-20T12:00:00.000Z"),
    );

    expect(result.scheduled[0].status).toBe("completed");
    expect(result.problems[0]).toMatchObject({
      reviewStage: 1,
      lastOutcome: "good",
    });
    expect(result.reviews[0]).toMatchObject({
      problemId: "two-sum",
      outcome: "good",
      activeMinutes: 10,
    });
  });
});
