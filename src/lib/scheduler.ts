import {
  DEFAULT_INTERVALS,
  RELAXED_INTERVALS,
  type CalendarSlot,
  type DayMode,
  type Problem,
  type ReviewOutcome,
  type ScheduleTemplate,
  type ScheduledReview,
} from "./domain";

const DAY_MS = 86_400_000;

export function recallBlockLimit(
  eligibleBlocks: number,
  mode: DayMode,
  manualBlocks = 0,
) {
  if (eligibleBlocks <= 0) return 0;
  if (mode === "catch-up") return eligibleBlocks;
  if (mode === "manual") return Math.min(eligibleBlocks, Math.max(0, manualBlocks));
  const ratio = mode === "revision-heavy" ? 0.8 : 0.4;
  return Math.min(eligibleBlocks, Math.max(1, Math.round(eligibleBlocks * ratio)));
}

export function recommendRevisionMinutes(input: {
  difficulty: Problem["difficulty"];
  status: Problem["status"];
  initialMinutes: number;
  priority: Problem["priority"];
}): 10 | 20 | 30 {
  if (
    input.difficulty === "hard" ||
    input.status === "stuck" ||
    input.priority === "high" ||
    input.initialMinutes > 60
  ) {
    return 30;
  }
  if (
    input.difficulty === "medium" ||
    input.status === "solved_with_hints" ||
    input.initialMinutes >= 30
  ) {
    return 20;
  }
  return 10;
}

export function intervalList(template: ScheduleTemplate, custom?: number[]) {
  if (template === "relaxed") return [...RELAXED_INTERVALS];
  if (template === "custom" && custom?.length) {
    return custom.filter((day) => Number.isFinite(day) && day > 0);
  }
  return [...DEFAULT_INTERVALS];
}

export function nextIntervalDays(
  stage: number,
  outcome: ReviewOutcome,
  template: ScheduleTemplate,
  custom?: number[],
) {
  if (outcome === "again") return 1;
  const intervals = intervalList(template, custom);
  const base = intervals[Math.min(Math.max(stage, 0), intervals.length - 1)] ?? 1;
  if (outcome === "hard") return Math.max(1, Math.round(base * 0.6));
  if (outcome === "easy") return Math.max(1, Math.round(base * 1.5));
  return base;
}

export function priorityFor(problem: Problem, now = new Date()) {
  const due = new Date(problem.dueAt).getTime();
  const overdueDays = Math.max(0, Math.floor((now.getTime() - due) / DAY_MS));
  const reasons: string[] = [];
  let score = Math.min(30, overdueDays * 6);

  if (overdueDays > 0) reasons.push(`${overdueDays}d overdue`);
  if (problem.blocker || problem.needsVisual) {
    score += 20;
    reasons.push(problem.needsVisual ? "visual gap recorded" : "blocker recorded");
  }
  if (problem.priority === "high") {
    score += 15;
    reasons.push("high priority");
  }
  if (["again", "hard"].includes(problem.lastOutcome ?? "") || problem.status === "stuck") {
    score += 15;
    reasons.push(problem.status === "stuck" ? "stuck retry" : `last review: ${problem.lastOutcome}`);
  }
  if (problem.topics.length) {
    score += 10;
    reasons.push(`${problem.topics[0]} focus`);
  }
  if (problem.notes?.toLowerCase().includes("contest")) {
    score += 10;
    reasons.push("contest relevant");
  }

  return { score: Math.min(100, score), reasons: reasons.length ? reasons : ["due for recall"] };
}

function dateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function createSchedule(input: {
  problems: Problem[];
  slots: CalendarSlot[];
  mode: DayMode;
  manualRecallBlocks?: number;
  now?: Date;
}): ScheduledReview[] {
  const now = input.now ?? new Date();
  const horizon = now.getTime() + 14 * DAY_MS;
  const due = input.problems
    .filter((problem) => new Date(problem.dueAt).getTime() <= horizon)
    .map((problem) => ({ problem, ...priorityFor(problem, now) }))
    .sort((a, b) => b.score - a.score || new Date(a.problem.dueAt).getTime() - new Date(b.problem.dueAt).getTime());

  const slots = input.slots
    .filter((slot) => slot.kind === "dsa" && new Date(slot.startsAt).getTime() >= now.getTime() - 3_600_000)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const dailySlots = new Map<string, CalendarSlot[]>();
  for (const slot of slots) {
    const key = dateKey(slot.startsAt);
    dailySlots.set(key, [...(dailySlots.get(key) ?? []), slot]);
  }

  const allowedSlotIds = new Set<string>();
  for (const daySlots of dailySlots.values()) {
    const limit = recallBlockLimit(daySlots.length, input.mode, input.manualRecallBlocks);
    daySlots.slice(0, limit).forEach((slot) => allowedSlotIds.add(slot.id));
  }

  const available = slots.filter((slot) => allowedSlotIds.has(slot.id));
  const capacity = available.length * 60;
  const requested = due.reduce((sum, entry) => sum + entry.problem.revisionMinutes, 0);
  const pressureRatio = capacity > 0 ? requested / capacity : Number.POSITIVE_INFINITY;
  const used = new Map<string, number>();
  const planned: ScheduledReview[] = [];

  for (const entry of due) {
    const original = entry.problem.revisionMinutes;
    const compressionFloor = entry.problem.status === "stuck" ? 1 : entry.problem.priority === "high" ? 0.85 : 0.7;
    const compression = pressureRatio > 1 ? Math.max(compressionFloor, 1 / pressureRatio) : 1;
    const minutes = Math.max(5, Math.ceil((original * compression) / 5) * 5);

    const slot = available.find((candidate) => (used.get(candidate.id) ?? 0) + minutes <= 60);
    if (!slot) continue;
    used.set(slot.id, (used.get(slot.id) ?? 0) + minutes);
    planned.push({
      id: `plan-${entry.problem.id}-${slot.id}`,
      problemId: entry.problem.id,
      slotId: slot.id,
      minutes,
      compressedFrom: minutes < original ? original : undefined,
      priorityScore: entry.score,
      reason: [
        ...entry.reasons,
        ...(minutes < original ? [`compressed ${original}→${minutes}m for backlog`] : []),
      ],
      status: "planned",
    });
  }

  return planned;
}

export function gradeLetter(score: number) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

