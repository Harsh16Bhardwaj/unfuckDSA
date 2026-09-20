import type { AppState, ReviewOutcome } from "./domain";
import { nextIntervalDays } from "./scheduler";

export function completeRevision(
  state: AppState,
  problemId: string,
  scheduledId: string | undefined,
  completedAt: Date,
  outcome: ReviewOutcome = "good",
): AppState {
  const problem = state.problems.find((item) => item.id === problemId);
  if (!problem) return state;
  const planned = scheduledId
    ? state.scheduled.find((item) => item.id === scheduledId)
    : state.scheduled.find(
        (item) => item.problemId === problemId && item.status === "planned",
      );
  const intervalDays = nextIntervalDays(
    problem.reviewStage,
    outcome,
    problem.scheduleTemplate,
    problem.customIntervals,
  );
  const nextDue = new Date(completedAt);
  nextDue.setDate(nextDue.getDate() + intervalDays);
  nextDue.setHours(10, 0, 0, 0);

  return {
    ...state,
    problems: state.problems.map((item) =>
      item.id === problemId
        ? {
            ...item,
            reviewStage: item.reviewStage + 1,
            lastOutcome: outcome,
            dueAt: nextDue.toISOString(),
          }
        : item,
    ),
    reviews: [
      {
        id: crypto.randomUUID(),
        problemId,
        completedAt: completedAt.toISOString(),
        outcome,
        activeMinutes: planned?.minutes ?? problem.revisionMinutes,
        hintRevealed: false,
        approachRevealed: false,
        rubric: {
          recognition: 3,
          invariant: 3,
          implementation: 3,
          complexity: 3,
          edgeCases: 3,
          explanation: 3,
        },
      },
      ...state.reviews,
    ],
    scheduled: state.scheduled.map((item) =>
      item.id === (scheduledId ?? planned?.id)
        ? { ...item, status: "completed" as const }
        : item,
    ),
  };
}
