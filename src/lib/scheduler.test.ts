import { describe, expect, it } from "vitest";
import type { CalendarSlot, Problem } from "./domain";
import {
  createSchedule,
  nextIntervalDays,
  recallBlockLimit,
  recommendRevisionMinutes,
} from "./scheduler";

describe("recall allocation", () => {
  it("allocates two recall blocks from five in balanced mode", () => {
    expect(recallBlockLimit(5, "balanced")).toBe(2);
  });

  it("honors the other day modes", () => {
    expect(recallBlockLimit(5, "revision-heavy")).toBe(4);
    expect(recallBlockLimit(5, "catch-up")).toBe(5);
    expect(recallBlockLimit(5, "manual", 3)).toBe(3);
  });
});

describe("review decisions", () => {
  it("recommends a long retry for stuck work", () => {
    expect(
      recommendRevisionMinutes({
        difficulty: "medium",
        status: "stuck",
        initialMinutes: 24,
        priority: "normal",
      }),
    ).toBe(30);
  });

  it("adjusts intervals by outcome", () => {
    expect(nextIntervalDays(2, "again", "default")).toBe(1);
    expect(nextIntervalDays(2, "hard", "default")).toBe(4);
    expect(nextIntervalDays(2, "good", "default")).toBe(7);
    expect(nextIntervalDays(2, "easy", "default")).toBe(11);
  });
});

describe("scheduler", () => {
  it("uses only DSA slots and protects stuck work from compression", () => {
    const now = new Date("2026-09-18T06:00:00.000Z");
    const problems: Problem[] = [{ id: "problem-koko", source: "leetcode", slug: "koko-eating-bananas", title: "Koko Eating Bananas", topics: ["Binary Search"], difficulty: "medium", priority: "normal", revisionMinutes: 30, scheduleTemplate: "default", needsVisual: false, initialMinutes: 50, reviewStage: 0, dueAt: now.toISOString(), status: "stuck", revealCount: 0, createdAt: now.toISOString() }];
    const slots: CalendarSlot[] = [
      { id: "dsa", startsAt: "2026-09-18T08:00:00.000Z", kind: "dsa" },
      { id: "dev", startsAt: "2026-09-18T09:00:00.000Z", kind: "dev" },
    ];
    const schedule = createSchedule({
      problems,
      slots,
      mode: "balanced",
      now,
    });
    const slotById = new Map(slots.map((slot) => [slot.id, slot]));
    expect(schedule.length).toBeGreaterThan(0);
    expect(schedule.every((item) => slotById.get(item.slotId)?.kind === "dsa")).toBe(true);
    const stuck = schedule.find((item) => item.problemId === "problem-koko");
    if (stuck) expect(stuck.minutes).toBe(30);
  });
});
