import { createInitialState } from "./demo-data";
import type { AppState, Problem, StudySession } from "./domain";

function problemKey(problem: Pick<Problem, "source" | "slug">) {
  return `${problem.source}:${problem.slug}`;
}

function mergeByKey<T>(base: T[], incoming: T[], key: (value: T) => string) {
  const values = new Map<string, T>();
  for (const value of base) values.set(key(value), value);
  for (const value of incoming) values.set(key(value), value);
  return [...values.values()];
}

/**
 * Workspace state contains both mutable planning preferences and append-only facts.
 * Incoming preferences win, while sessions/reviews/contests are unioned so an older
 * browser snapshot cannot erase work recorded by another paired device.
 */
export function mergeWorkspaceStates(
  baseValue: Partial<AppState> | null | undefined,
  incomingValue: Partial<AppState> | null | undefined,
): AppState {
  const empty = createInitialState();
  const base = { ...empty, ...baseValue } as AppState;
  const incoming = { ...empty, ...incomingValue } as AppState;
  const deletedProblemKeys = new Set([
    ...(base.deletedProblemKeys ?? []),
    ...(incoming.deletedProblemKeys ?? []),
  ]);

  const problems = new Map<string, Problem>();
  const aliases = new Map<string, string>();
  for (const problem of base.problems ?? []) {
    const key = problemKey(problem);
    if (deletedProblemKeys.has(key)) continue;
    problems.set(key, problem);
    aliases.set(problem.id, problem.id);
  }
  for (const problem of incoming.problems ?? []) {
    const key = problemKey(problem);
    if (deletedProblemKeys.has(key)) continue;
    const existing = problems.get(key);
    const canonicalId = existing?.id ?? problem.id;
    aliases.set(problem.id, canonicalId);
    problems.set(key, existing ? { ...existing, ...problem, id: canonicalId } : problem);
  }

  const remapSession = (session: StudySession): StudySession => ({
    ...session,
    problemId: aliases.get(session.problemId) ?? session.problemId,
  });
  const sessions = mergeByKey(
    (base.sessions ?? []).map(remapSession),
    (incoming.sessions ?? []).map(remapSession),
    (session) => session.idempotencyKey || session.id,
  ).sort((left, right) =>
    (right.endedAt ?? right.startedAt).localeCompare(left.endedAt ?? left.startedAt),
  );

  const mergedProblems = [...problems.values()].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  const remapProblemId = <T extends { problemId: string }>(value: T): T => ({
    ...value,
    problemId: aliases.get(value.problemId) ?? value.problemId,
  });

  return {
    ...base,
    ...incoming,
    deletedProblemKeys: [...deletedProblemKeys],
    problems: mergedProblems,
    sessions,
    scheduled: (incoming.scheduled ?? []).map(remapProblemId),
    reviews: mergeByKey(
      (base.reviews ?? []).map(remapProblemId),
      (incoming.reviews ?? []).map(remapProblemId),
      (review) => review.id,
    ),
    contests: mergeByKey(base.contests ?? [], incoming.contests ?? [], (contest) => contest.id),
    revealEvents: mergeByKey(
      base.revealEvents ?? [],
      incoming.revealEvents ?? [],
      (event) => event.id,
    ),
  };
}

export function canonicalProblemKey(problem: Pick<Problem, "source" | "slug">) {
  return problemKey(problem);
}
