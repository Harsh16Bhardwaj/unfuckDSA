"use client";
import { useState } from "react";
import type { AppState, Problem } from "@/lib/domain";
import { intervalList } from "@/lib/scheduler";

export function ProblemHistory({
  problem,
  state,
  onUpdate,
}: {
  problem: Problem;
  state: AppState;
  onUpdate: (recipe: (s: AppState) => AppState, replan?: boolean) => void;
}) {
  const [priority, setPriority] = useState(problem.priority);
  const [topics, setTopics] = useState(problem.topics.join(", "));
  const [duration, setDuration] = useState(problem.revisionMinutes);
  const [intervals, setIntervals] = useState(
    intervalList(problem.scheduleTemplate, problem.customIntervals).join(", "),
  );
  const [message, setMessage] = useState("");
  const [revealed, setRevealed] = useState({ hint: false, approach: false });
  const sessions = state.sessions.filter((s) => s.problemId === problem.id);
  const reviews = state.reviews.filter((r) => r.problemId === problem.id);
  const entries = [
    ...sessions.map((s) => ({
      id: s.id,
      date: s.endedAt ?? s.startedAt,
      kind: "Solve",
      minutes: s.activeMinutes,
      outcome: s.status?.replaceAll("_", " ") ?? "Unrecorded",
      code: s.code,
      blocker: s.blocker,
      reveal: "Reveal data not recorded",
    })),
    ...reviews.map((r) => ({
      id: r.id,
      date: r.completedAt,
      kind: "Revision",
      minutes: r.activeMinutes,
      outcome: r.outcome,
      code: r.code,
      blocker: r.blocker,
      reveal: `Hint ${r.hintRevealed ? "revealed" : "hidden"} · Approach ${r.approachRevealed ? "revealed" : "hidden"}`,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const trend = [...entries].reverse();
  const max = Math.max(1, ...trend.map((e) => e.minutes));
  const blockers = new Map<string, number>();
  [...sessions, ...reviews].forEach((s) => {
    const blocker = s.blocker?.trim();
    if (blocker) blockers.set(blocker, (blockers.get(blocker) ?? 0) + 1);
  });
  return (
    <section className="problem-history">
      <div className="detail-heading">
        <div>
          <span className="eyebrow">Problem history</span>
          <h3>{problem.title}</h3>
        </div>
        {problem.url && (
          <a
            className="text-button"
            href={problem.url}
            target="_blank"
            rel="noreferrer"
          >
            Open ↗
          </a>
        )}
      </div>
      <div className="detail-badges">
        <span>Stage {problem.reviewStage}</span>
        <span>Next: {new Date(problem.dueAt).toLocaleDateString()}</span>
        <span>{reviews.length} revisions</span>
      </div>
      {(["approach", "hint"] as const).map((kind) => (
        <div className="memory-box" key={kind}>
          <div>
            <span className="eyebrow">{kind}</span>
            <button
              className="text-button"
              onClick={() => {
                if (!revealed[kind])
                  onUpdate((current) => ({
                    ...current,
                    revealEvents: [
                      ...(current.revealEvents ?? []),
                      {
                        id: crypto.randomUUID(),
                        problemId: problem.id,
                        at: new Date().toISOString(),
                        kind,
                      },
                    ],
                  }));
                setRevealed((current) => ({
                  ...current,
                  [kind]: !current[kind],
                }));
              }}
            >
              {revealed[kind] ? "Hide" : "Reveal"}
            </button>
          </div>
          {revealed[kind] ? (
            <p>{problem[kind] || "Nothing recorded yet."}</p>
          ) : (
            <p>Hidden for recall</p>
          )}
        </div>
      ))}
      <details className="revision-settings">
        <summary>Edit revision settings</summary>
        <form
          className="history-editor"
          onSubmit={(event) => {
            event.preventDefault();
            const days = intervals.split(",").map((v) => Number(v.trim()));
            if (
              !days.length ||
              days.some(
                (d, i) =>
                  !Number.isInteger(d) ||
                  d < 1 ||
                  d > 3650 ||
                  (i > 0 && d <= days[i - 1]),
              )
            ) {
              setMessage("Enter increasing whole days, e.g. 1, 3, 7, 14.");
              return;
            }
            onUpdate(
              (current) => ({
                ...current,
                problems: current.problems.map((p) =>
                  p.id === problem.id
                    ? {
                        ...p,
                        priority,
                        topics: [
                          ...new Set(
                            topics
                              .split(",")
                              .map((t) => t.trim())
                              .filter(Boolean),
                          ),
                        ],
                        revisionMinutes: duration,
                        scheduleTemplate: "custom",
                        customIntervals: days,
                      }
                    : p,
                ),
              }),
              true,
            );
            setMessage("Saved. New intervals apply to your next review.");
          }}
        >
          <label>
            Priority
            <select
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as Problem["priority"])
              }
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>
            Revision length
            <select
              value={duration}
              onChange={(e) =>
                setDuration(
                  Number(e.target.value) as Problem["revisionMinutes"],
                )
              }
            >
              {[10, 20, 30].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </label>
          <label>
            Topics
            <input value={topics} onChange={(e) => setTopics(e.target.value)} />
          </label>
          <label>
            Intervals in days
            <input
              value={intervals}
              onChange={(e) => setIntervals(e.target.value)}
              required
            />
          </label>
          <button className="secondary-button compact">Save changes</button>
          <span role="status">{message}</span>
        </form>
      </details>
      <h4>Time per attempt</h4>
      {trend.length ? (
        <div className="attempt-trend" aria-label="Active minutes per attempt">
          {trend.map((e, i) => (
            <div
              key={e.id}
              title={`${e.kind} · ${new Date(e.date).toLocaleDateString()} · ${e.minutes} min`}
            >
              <span>{e.minutes}m</span>
              <i
                style={{ height: `${Math.max(4, (e.minutes / max) * 64)}px` }}
              />
              <small>{i + 1}</small>
            </div>
          ))}
        </div>
      ) : (
        <p>No attempts recorded yet.</p>
      )}
      <h4>Blockers</h4>
      {blockers.size ? (
        [...blockers].map(([text, count]) => (
          <p key={text}>
            {text} <small>×{count}</small>
          </p>
        ))
      ) : (
        <p>{problem.blocker || "No blockers recorded."}</p>
      )}
      <h4>Attempt timeline · {entries.length}</h4>
      <div className="attempt-timeline">
        {entries.map((e) => (
          <article key={e.id}>
            <small>
              {new Date(e.date).toLocaleString()} · {e.kind}
            </small>
            <strong>
              {e.outcome} · {e.minutes} min
            </strong>
            <span>{e.reveal}</span>
            {e.blocker && <p>{e.blocker}</p>}
            {e.code && (
              <details>
                <summary>Code version</summary>
                <pre>
                  <code>{e.code}</code>
                </pre>
              </details>
            )}
          </article>
        ))}
      </div>
      {!!state.revealEvents?.filter((e) => e.problemId === problem.id)
        .length && (
        <details>
          <summary>Library reveal history</summary>
          {state.revealEvents
            .filter((e) => e.problemId === problem.id)
            .map((e) => (
              <p key={e.id}>
                {e.kind} · {new Date(e.at).toLocaleString()}
              </p>
            ))}
        </details>
      )}
    </section>
  );
}
