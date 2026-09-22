"use client";

import {
  BookOpenCheck,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  PlugZap,
  RefreshCw,
  Settings,
  ListTodo,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createInitialState } from "@/lib/demo-data";
import type { AppState, Difficulty, Priority, Problem, ScheduleTemplate, SessionStatus } from "@/lib/domain";
import { createSchedule, recommendRevisionMinutes } from "@/lib/scheduler";
import { completeRevision as completeRevisionState } from "@/lib/revisions";
import { CalendarView, ProblemsView, SettingsView, WeeklyTasksView } from "./workspace-views";
import { SproutCompanion } from "./sprout-companion";
import ThemeToggle from "./theme-toggle";
import { materializeAvailability, reconcileRecurringAvailability } from '@/lib/calendar-pattern';
import { canonicalProblemKey, mergeWorkspaceStates } from "@/lib/workspace-merge";

type View = "today" | "calendar" | "problems" | "weekly-tasks" | "settings";
type CapturedSession = { title: string; url: string; activeMinutes: number; code?: string; captureId?: string; startedAt?: number };
type ExtensionRecord = {
  id: string;
  title: string;
  url: string;
  startedAt: number;
  activeMinutes: number;
  code: string;
  finishedAt: string;
  skipRevision: boolean;
  status: SessionStatus;
  difficulty: Difficulty;
  priority: Priority;
  revisionMinutes: 10 | 20 | 30;
  template: ScheduleTemplate;
  topics: string[];
  approach: string;
  blocker: string;
  hint: string;
  notes: string;
  needsVisual: boolean;
};

const APP_KEY = "unfuckdsa-state-v2";
const NAV_ITEMS: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: "today", label: "Today", icon: LayoutDashboard },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "problems", label: "Problems", icon: BookOpenCheck },
  { id: "weekly-tasks", label: "Weekly Tasks", icon: ListTodo },
  { id: "settings", label: "Settings", icon: Settings },
];

function loadState(scope: string): AppState {
  if (typeof window === "undefined") return createInitialState();
  try {
    const stored = window.localStorage.getItem(`${APP_KEY}-${scope}`);
    const parsed = stored ? JSON.parse(stored) as AppState : createInitialState();
    return reconcileRecurringAvailability({ ...parsed, dailyTargetMinutes: parsed.dailyTargetMinutes ?? 300, sprintDays: parsed.sprintDays ?? {}, weeklyTasks: parsed.weeklyTasks ?? [], weeklyTaskPlacements: parsed.weeklyTaskPlacements ?? [] });
  } catch { return createInitialState(); }
}

const dayKey = (date = new Date()) => date.toLocaleDateString("en-CA");
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const extractSlug = (url: string) => url.match(/leetcode\.com\/problems\/([^/?#]+)/)?.[1] ?? "";

export default function Workspace({ storageScope, cloudEnabled, nowIso, username }: { storageScope: string; cloudEnabled: boolean; nowIso: string; username: string }) {
  const router = useRouter();
  const [view, setView] = useState<View>("today");
  const [menuOpen, setMenuOpen] = useState(false);
  const [state, setState] = useState<AppState>(() => createInitialState());
  const [localLoaded, setLocalLoaded] = useState(false);
  const [cloudLoaded, setCloudLoaded] = useState(!cloudEnabled);
  const [manualOpen, setManualOpen] = useState(false);
  const [capture, setCapture] = useState<CapturedSession | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setState(loadState(storageScope));
      setLocalLoaded(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [storageScope]);

  useEffect(() => {
    window.localStorage.setItem(`${APP_KEY}-${storageScope}`, JSON.stringify(state));
    if (!cloudEnabled || !cloudLoaded) return;
    const sync = window.setTimeout(() => {
      void fetch("/api/workspace/state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ state, version: 2 }) });
    }, 450);
    return () => window.clearTimeout(sync);
  }, [state, storageScope, cloudEnabled, cloudLoaded]);

  useEffect(() => {
    if (!cloudEnabled || !localLoaded) return;
    fetch("/api/workspace/state").then(async (response) => {
      const data = await response.json() as { workspace?: { state?: AppState } };
      if (response.ok && data.workspace?.state) {
        setState((current) => reconcileRecurringAvailability(mergeWorkspaceStates(current, data.workspace?.state)));
      }
    }).finally(() => setCloudLoaded(true));
  }, [cloudEnabled, localLoaded]);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const captureId = search.get("capture");
    const localTitle = search.get("localTitle");
    if (!captureId && localTitle) {
      const timeout = window.setTimeout(() => setCapture({ title: localTitle, url: search.get("localUrl") ?? "", activeMinutes: Number(search.get("localMinutes")) || 1 }), 0);
      window.history.replaceState({}, "", window.location.pathname);
      return () => window.clearTimeout(timeout);
    }
    if (!captureId) return;
    fetch(`/api/extension/captures/${encodeURIComponent(captureId)}`).then(async (response) => {
      const data = await response.json() as { title?: string; url?: string; active_minutes?: number; code?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not load extension capture.");
      setCapture({ title: data.title ?? "LeetCode problem", url: data.url ?? "", activeMinutes: data.active_minutes ?? 1, code: data.code, captureId });
      window.history.replaceState({}, "", window.location.pathname);
    }).catch(() => undefined);
  }, []);

  const replan = useCallback((value: AppState) => { const next = materializeAvailability(value); return { ...next, scheduled: createSchedule({ problems: next.problems, slots: next.slots, mode: next.dayMode, manualRecallBlocks: next.manualRecallBlocks }) }; }, []);
  const updateState = useCallback((recipe: (current: AppState) => AppState, shouldReplan = false) => setState((current) => { const next = recipe(current); return shouldReplan ? replan(next) : next; }), [replan]);

  const importExtensionRecords = useCallback((records: ExtensionRecord[]) => {
      setState((current) => {
        const importedKeys = new Set(current.sessions.map((session) => session.idempotencyKey));
        const pending = records.filter((record) => record?.id && !importedKeys.has(`extension-local-${record.id}`));
        if (!pending.length) return current;
        const next: AppState = { ...current, problems: [...current.problems], sessions: [...current.sessions] };
        for (const record of [...pending].reverse()) {
          const slug = extractSlug(record.url) || slugify(record.title);
          const existing = next.problems.find((problem) => problem.slug === slug);
          const problemId = existing?.id ?? `extension-problem-${record.id}`;
          if (!record.skipRevision) {
            const problemKey = `leetcode:${slug}`;
            next.deletedProblemKeys = (next.deletedProblemKeys ?? []).filter((key) => key !== problemKey);
            const dueAt = new Date(record.finishedAt);
            dueAt.setDate(dueAt.getDate() + (record.status === "stuck" ? 1 : record.template === "relaxed" ? 2 : 1));
            dueAt.setHours(10, 0, 0, 0);
            const problem: Problem = {
              id: problemId,
              source: "leetcode",
              slug,
              title: record.title,
              url: record.url,
              topics: record.topics ?? [],
              difficulty: record.difficulty,
              priority: record.priority,
              revisionMinutes: record.revisionMinutes,
              scheduleTemplate: record.template,
              approach: record.approach,
              blocker: record.blocker,
              hint: record.hint,
              notes: record.notes,
              needsVisual: record.needsVisual,
              initialMinutes: existing?.initialMinutes ?? record.activeMinutes,
              reviewStage: existing?.reviewStage ?? 0,
              dueAt: dueAt.toISOString(),
              status: record.status,
              revealCount: existing?.revealCount ?? 0,
              createdAt: existing?.createdAt ?? record.finishedAt,
            };
            next.problems = existing ? next.problems.map((item) => item.id === existing.id ? problem : item) : [problem, ...next.problems];
          }
          next.sessions = [{ id: `extension-session-${record.id}`, problemId, startedAt: new Date(record.startedAt).toISOString(), endedAt: record.finishedAt, activeMinutes: record.activeMinutes, pausedMinutes: 0, status: record.status, code: record.code || undefined, blocker:record.blocker, approach:record.approach, hint:record.hint, idempotencyKey: `extension-local-${record.id}` }, ...next.sessions];
        }
        return replan(next);
      });
  }, [replan]);

  useEffect(() => {
    if (!cloudLoaded) return;
    function receiveExtensionRecords(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin || event.data?.type !== "UNFUCKDSA_EXTENSION_SYNC" || !Array.isArray(event.data.records)) return;
      importExtensionRecords(event.data.records as ExtensionRecord[]);
    }
    window.addEventListener("message", receiveExtensionRecords);
    window.postMessage({ type: "UNFUCKDSA_REQUEST_SYNC" }, window.location.origin);
    let refreshTimer: number | undefined;
    const loadCloudExtensionRecords = () => {
      if (!cloudEnabled) return;
      void fetch("/api/extension/sessions")
        .then(async (response) => {
          const data = await response.json() as { records?: ExtensionRecord[] };
          if (response.ok && Array.isArray(data.records)) importExtensionRecords(data.records);
        })
        .catch(() => undefined);
    };
    if (cloudEnabled) {
      loadCloudExtensionRecords();
      window.addEventListener("focus", loadCloudExtensionRecords);
      refreshTimer = window.setInterval(loadCloudExtensionRecords, 30_000);
    }
    return () => {
      window.removeEventListener("message", receiveExtensionRecords);
      window.removeEventListener("focus", loadCloudExtensionRecords);
      if (refreshTimer) window.clearInterval(refreshTimer);
    };
  }, [cloudEnabled, cloudLoaded, importExtensionRecords]);

  function addManualProblem(title: string, url: string) {
    const slug = extractSlug(url) || slugify(title);
    const existing = state.problems.find((problem) => problem.slug === slug);
    if (!existing) {
      const dueAt = new Date(); dueAt.setDate(dueAt.getDate() + 1); dueAt.setHours(10, 0, 0, 0);
      const problem: Problem = { id: crypto.randomUUID(), source: url.includes("leetcode.com") ? "leetcode" : "manual", slug, title, url: url || undefined, topics: [], difficulty: "medium", priority: "normal", revisionMinutes: 20, scheduleTemplate: "default", needsVisual: false, initialMinutes: 0, reviewStage: 0, dueAt: dueAt.toISOString(), status: "stopped", revealCount: 0, createdAt: new Date().toISOString() };
      updateState((current) => ({ ...current, deletedProblemKeys: (current.deletedProblemKeys ?? []).filter((key) => key !== canonicalProblemKey(problem)), problems: [problem, ...current.problems] }), true);
    }
    setManualOpen(false);
  }

  function finishCapture(result: EndSessionResult) {
    if (!capture) return;
    const finishedAt = new Date();
    const slug = extractSlug(capture.url) || slugify(capture.title);
    const existing = state.problems.find((problem) => problem.slug === slug);
    const id = existing?.id ?? crypto.randomUUID();
    const dueAt = new Date(finishedAt);
    dueAt.setDate(dueAt.getDate() + (result.status === "stuck" ? 1 : result.template === "relaxed" ? 2 : 1));
    dueAt.setHours(10, 0, 0, 0);
    const recommended = recommendRevisionMinutes({ difficulty: result.difficulty, status: result.status, initialMinutes: capture.activeMinutes, priority: result.priority });
    const problem: Problem = { id, source: capture.url.includes("leetcode.com") ? "leetcode" : "manual", slug, title: capture.title, url: capture.url || undefined, topics: result.topics, difficulty: result.difficulty, priority: result.priority, revisionMinutes: result.revisionMinutes ?? recommended, scheduleTemplate: result.template, approach: result.approach, blocker: result.blocker, hint: result.hint, notes: result.notes, needsVisual: result.needsVisual, initialMinutes: existing?.initialMinutes || capture.activeMinutes, reviewStage: existing?.reviewStage ?? 0, dueAt: dueAt.toISOString(), status: result.status, revealCount: existing?.revealCount ?? 0, createdAt: existing?.createdAt ?? finishedAt.toISOString() };
    updateState((current) => ({ ...current, problems: existing ? current.problems.map((item) => item.id === id ? problem : item) : [problem, ...current.problems], sessions: [{ id: crypto.randomUUID(), problemId: id, startedAt: new Date(capture.startedAt ?? finishedAt.getTime() - capture.activeMinutes * 60_000).toISOString(), endedAt: finishedAt.toISOString(), activeMinutes: capture.activeMinutes, pausedMinutes: 0, status: result.status, code: result.code || capture.code, blocker: result.blocker, approach: result.approach, hint: result.hint, idempotencyKey: capture.captureId ? `extension-${capture.captureId}` : `manual-${finishedAt.getTime()}` }, ...current.sessions] }), true);
    setCapture(null);
  }

  function removeProblem(id: string) {
    updateState((current) => {
      const problem = current.problems.find((item) => item.id === id);
      return { ...current, deletedProblemKeys: problem ? [...new Set([...(current.deletedProblemKeys ?? []), canonicalProblemKey(problem)])] : current.deletedProblemKeys, problems: current.problems.filter((item) => item.id !== id), scheduled: current.scheduled.filter((item) => item.problemId !== id) };
    });
  }

  function rescheduleProblem(id: string) {
    const nextDue = new Date(); nextDue.setDate(nextDue.getDate() + 1); nextDue.setHours(10, 0, 0, 0);
    updateState((current) => ({ ...current, problems: current.problems.map((problem) => problem.id === id ? { ...problem, dueAt: nextDue.toISOString() } : problem), scheduled: current.scheduled.filter((item) => item.problemId !== id) }), true);
  }

  function completeRevision(problemId: string, scheduledId?: string) {
    const completedAt = new Date();
    updateState((current) =>
      completeRevisionState(current, problemId, scheduledId, completedAt),
    );
  }

  async function signOut() {
    if (!cloudEnabled) {
      router.push("/login");
      return;
    }
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const today = dayKey(now);
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); weekStart.setHours(0, 0, 0, 0);
  const todaySessions = state.sessions.filter((session) => dayKey(new Date(session.startedAt)) === today);
  const weekSessions = state.sessions.filter((session) => new Date(session.startedAt) >= weekStart);
  const todayReviews = state.reviews.filter((review) => dayKey(new Date(review.completedAt)) === today);
  const weekReviews = state.reviews.filter((review) => new Date(review.completedAt) >= weekStart);
  const todayMinutes = [...todaySessions, ...todayReviews].reduce((sum, item) => sum + item.activeMinutes, 0);
  const todaySlotIds = new Set(state.slots.filter((slot) => dayKey(new Date(slot.startsAt)) === today).map((slot) => slot.id));
  const todayPlan = state.scheduled.filter((item) => todaySlotIds.has(item.slotId) && item.status === "planned");

  return <div className="workspace">
    <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
      <div className="brand-row"><div className="brand-mark">uD</div><div><strong>unfuckDSA</strong><span>Revision control</span></div><button className="icon-button mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <nav className="main-nav" aria-label="Primary navigation">{NAV_ITEMS.map((item) => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => { setView(item.id); setMenuOpen(false); }}><Icon size={18} /><span>{item.label}</span></button>; })}</nav>
      <SproutCompanion />
      <div className="sidebar-user"><div className="avatar">{username.slice(0, 2).toUpperCase()}</div><div><strong>{username}</strong><span>{cloudEnabled ? "Cloud workspace" : "Local workspace"}</span></div><button className="sidebar-signout" onClick={() => void signOut()} aria-label={cloudEnabled ? "Sign out" : "Open sign in"}>{cloudEnabled ? <LogOut size={16} /> : <ChevronRight size={16} />}</button></div>
    </aside>
    {menuOpen && <button className="sidebar-scrim" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}
    <main className="main-area">
      <header className="topbar"><button className="icon-button menu-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20} /></button><div><span className="eyebrow">{now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span><h1>{NAV_ITEMS.find((item) => item.id === view)?.label}</h1></div><div className="top-actions"><ThemeToggle /></div></header>
      <div className="view-content">
        {view === "today" && <TodayView state={state} todayPlan={todayPlan} todayMinutes={todayMinutes} todayCount={todaySessions.length + todayReviews.length} weekCount={weekSessions.length + weekReviews.length} referenceNow={now.getTime()} cloudEnabled={cloudEnabled} onNavigate={setView} onReplan={() => setState((current) => replan(current))} onCompletePlan={(id) => { const item = state.scheduled.find((entry) => entry.id === id); if (item) completeRevision(item.problemId, item.id); }} onRemovePlan={(id) => updateState((current) => ({ ...current, scheduled: current.scheduled.filter((item) => item.id !== id) }))} onReschedulePlan={(id) => { const item = state.scheduled.find((entry) => entry.id === id); if (item) rescheduleProblem(item.problemId); }} />}
        {view === "calendar" && <CalendarView state={state} updateState={updateState} />}
        {view === "problems" && <ProblemsView state={state} onAdd={() => setManualOpen(true)} onComplete={completeRevision} onDelete={removeProblem} onReschedule={rescheduleProblem} updateState={updateState} />}
        {view === "weekly-tasks" && <WeeklyTasksView state={state} updateState={updateState} onOpenCalendar={() => setView("calendar")} />}
        {view === "settings" && <SettingsView state={state} updateState={updateState} cloudEnabled={cloudEnabled} username={username} onSignOut={() => void signOut()} />}
      </div>
    </main>
    {manualOpen && <ManualProblemModal onClose={() => setManualOpen(false)} onAdd={addManualProblem} />}
    {capture && <ReflectionModal capture={capture} onCancel={() => setCapture(null)} onFinish={finishCapture} />}
  </div>;
}

function TodayView({ state, todayPlan, todayMinutes, todayCount, weekCount, referenceNow, cloudEnabled, onNavigate, onReplan, onCompletePlan, onRemovePlan, onReschedulePlan }: { state: AppState; todayPlan: AppState["scheduled"]; todayMinutes: number; todayCount: number; weekCount: number; referenceNow: number; cloudEnabled: boolean; onNavigate: (view: View) => void; onReplan: () => void; onCompletePlan: (id: string) => void; onRemovePlan: (id: string) => void; onReschedulePlan: (id: string) => void }) {
  const problemById = new Map(state.problems.map((problem) => [problem.id, problem]));
  const dailyAverage = Math.round(state.sessions.filter((session) => referenceNow - new Date(session.startedAt).getTime() <= 7 * 86_400_000).reduce((sum, session) => sum + session.activeMinutes, 0) / 7);
  const previousWeekCount = state.sessions.filter((session) => {
    const age = referenceNow - new Date(session.startedAt).getTime();
    return age > 7 * 86_400_000 && age <= 14 * 86_400_000;
  }).length;
  const weeklyTrend = previousWeekCount ? Math.round(((weekCount - previousWeekCount) / previousWeekCount) * 100) : weekCount ? 100 : 0;
  const targetMinutes = state.dailyTargetMinutes || 300;
  const rawProgress = (todayMinutes / targetMinutes) * 100;
  const progress = Math.min(100, rawProgress);
  const over = todayMinutes > targetMinutes;
  const meterHue = Math.round(8 + progress * 1.08);
  const meterColor = `hsl(${meterHue} 84% 48%)`;
  const todayKey = dayKey(new Date(referenceNow));
  const dsaHours = state.slots.filter((slot) => dayKey(new Date(slot.startsAt)) === todayKey && slot.kind === "dsa").length;
  const recallMinutes = todayPlan.reduce((sum, item) => sum + item.minutes, 0);
  const dueSoon = state.problems.filter((problem) => {
    const due = new Date(problem.dueAt).getTime();
    return due >= referenceNow && due <= referenceNow + 3 * 86_400_000;
  }).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()).slice(0, 3);
  return <div className="today-dashboard">
    <section className="performance-deck panel">
      <div className={`time-orbit ${over ? "overdrive" : ""}`} style={{ "--progress": `${progress * 3.6}deg`, "--meter-color": meterColor } as React.CSSProperties}>
        {over && <Flame className="orbit-flame" size={25} fill="currentColor" />}
        <div><strong>{todayMinutes}<span> min</span></strong><small>of {targetMinutes} minutes</small><em>{over ? `+${todayMinutes - targetMinutes} OVER` : `${Math.round(rawProgress)}% CLOCKED`}</em></div>
      </div>
      <div className="metric-cluster">
        <div className="stat-tile mint"><span>Today</span><strong>{todayCount}</strong><small>questions finished</small></div>
        <div className="stat-tile blue"><span>This week</span><strong>{weekCount}</strong><small>completed sessions</small></div>
        <div className="stat-tile violet"><span>Daily pace</span><strong>{dailyAverage}<b>m</b></strong><small>seven-day average</small></div>
        <div className="stat-tile coral"><span>Momentum</span><strong>{weeklyTrend > 0 ? "+" : ""}{weeklyTrend}%</strong><small><TrendingUp size={13} /> versus last week</small></div>
      </div>
      <div className="day-signal">
        <span className="signal-kicker">Today&apos;s shape</span>
        <strong>{todayPlan.length ? `${todayPlan.length} recalls ready` : "Clear runway"}</strong>
        <p>{dsaHours ? `${dsaHours} DSA blocks available with ${recallMinutes} minutes reserved for recall.` : "Add DSA availability to let the planner place your revision work."}</p>
        <div className="signal-stats"><span><b>{dsaHours}</b> DSA hours</span><span><b>{recallMinutes}</b> recall min</span><span><b>{dueSoon.length}</b> due soon</span></div>
      </div>
    </section>

    <div className="today-workbench">
    <section className="today-queue panel">
      <div className="queue-heading"><div><span className="eyebrow">Revision set</span><h3>Questions for today</h3></div><button className="text-button" onClick={() => onNavigate("problems")}>See this week <ChevronRight size={15} /></button></div>
      <div className="revision-list">{todayPlan.map((item) => { const problem = problemById.get(item.problemId); return <article key={item.id} className="today-revision"><div className="revision-status"><i /><span>{problem?.topics[0] ?? "Recall"}</span></div><div className="revision-copy"><strong>{problem?.title ?? "Revision"}</strong><span>{item.minutes} min · {item.reason[0] ?? "due today"}</span></div><button className="queue-action complete" onClick={() => onCompletePlan(item.id)} aria-label={`Mark ${problem?.title ?? "revision"} revised`} title="Mark revised"><Check size={18} /></button>{problem?.url && <a className="queue-action open" href={problem.url} target="_blank" rel="noreferrer" aria-label="Open on LeetCode"><ExternalLink size={18} /></a>}<button className="queue-action" onClick={() => onReschedulePlan(item.id)} aria-label="Reschedule"><CalendarClock size={18} /></button><button className="queue-action delete" onClick={() => onRemovePlan(item.id)} aria-label="Remove from today"><Trash2 size={18} /></button></article>; })}
      {!todayPlan.length && <div className="queue-empty"><div className="empty-orbit"><Sparkles size={22} /></div><h4>Your revision set is empty.</h4><p>Finish a session from the LeetCode overlay or add a problem manually. It will appear here when due.</p><button className="secondary-button" onClick={() => onNavigate("problems")}><Plus size={16} /> Add manually</button></div>}</div>
    </section>
    <aside className="dashboard-rail">
      <PairingCard cloudEnabled={cloudEnabled} />
      <section className="quick-launch panel"><div><span className="eyebrow">Quick controls</span><h3>Shape the plan</h3></div><button onClick={() => onNavigate("calendar")}><span className="quick-icon lime"><CalendarDays size={18} /></span><span><strong>Allocate time</strong><small>Paint DSA, dev and busy hours</small></span><ChevronRight size={16} /></button><button onClick={() => onNavigate("problems")}><span className="quick-icon blue"><BookOpenCheck size={18} /></span><span><strong>Revision library</strong><small>Today, week and all solved</small></span><ChevronRight size={16} /></button><button onClick={onReplan}><span className="quick-icon orange"><RefreshCw size={18} /></span><span><strong>Replan backlog</strong><small>Fit work into valid capacity</small></span><ChevronRight size={16} /></button></section>
      <section className="coming-up panel"><div className="rail-heading"><div><span className="eyebrow">Next 72 hours</span><h3>Coming up</h3></div><button className="text-button" onClick={() => onNavigate("problems")}>View all</button></div>{dueSoon.length ? <div className="due-list">{dueSoon.map((problem) => <div key={problem.id}><i className={`difficulty ${problem.difficulty}`} /><span><strong>{problem.title}</strong><small>{new Date(problem.dueAt).toLocaleDateString([], { weekday: "short", day: "numeric" })} · {problem.revisionMinutes} min</small></span></div>)}</div> : <p className="rail-empty">No problems are approaching their due date. Your runway is clean.</p>}</section>
    </aside>
    </div>
  </div>;
}

function PairingCard({ cloudEnabled }: { cloudEnabled: boolean }) {
  const [pairingKey, setPairingKey] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!cloudEnabled) return;
    const controller = new AbortController();
    fetch("/api/extension/pairing-code", { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as { code?: string; error?: string };
        if (!response.ok || !data.code)
          throw new Error(data.error ?? "Could not load pairing key.");
        setPairingKey(data.code);
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setMessage(cause instanceof Error ? cause.message : "Could not load pairing key.");
      });
    return () => controller.abort();
  }, [cloudEnabled]);

  async function copyPairingKey() {
    if (!pairingKey) return;
    await navigator.clipboard.writeText(pairingKey);
    setMessage("Copied. Paste it into the extension popup.");
  }

  return (
    <section className="pairing-card panel">
      <div className="pairing-heading">
        <span className="quick-icon lime"><PlugZap size={18} /></span>
        <span><strong>Pair your extension</strong><small>One reusable key for this account</small></span>
      </div>
      {cloudEnabled ? (
        <button className="pairing-key" onClick={() => void copyPairingKey()} disabled={!pairingKey} aria-label="Copy extension pairing key">
          <code>{pairingKey || "Loading…"}</code><Copy size={15} />
        </button>
      ) : (
        <p>Sign in to create your account pairing key.</p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}

function ManualProblemModal({ onClose, onAdd }: { onClose: () => void; onAdd: (title: string, url: string) => void }) {
  const [title, setTitle] = useState(""); const [url, setUrl] = useState("");
  return <div className="modal-backdrop"><form className="modal-card small-modal" onSubmit={(event) => { event.preventDefault(); onAdd(title, url); }}><div className="modal-heading"><div><span className="eyebrow">Manual addition</span><h2>Add to revision</h2><p>No timer starts here. Solving happens on LeetCode.</p></div><button type="button" className="icon-button" onClick={onClose}><X size={19} /></button></div><label>Problem title<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label>LeetCode link <span className="optional">optional</span><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://leetcode.com/problems/..." /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button">Add problem</button></div></form></div>;
}

interface EndSessionResult { status: SessionStatus; difficulty: Difficulty; priority: Priority; revisionMinutes: 10 | 20 | 30; template: ScheduleTemplate; topics: string[]; approach: string; blocker: string; hint: string; notes: string; needsVisual: boolean; code?: string; }

function ReflectionModal({ capture, onCancel, onFinish }: { capture: CapturedSession; onCancel: () => void; onFinish: (result: EndSessionResult) => void }) {
  const [status, setStatus] = useState<SessionStatus>("solved_independently"); const [difficulty, setDifficulty] = useState<Difficulty>("medium"); const [priority, setPriority] = useState<Priority>("normal"); const [revisionMinutes, setRevisionMinutes] = useState<10 | 20 | 30>(20); const [template, setTemplate] = useState<ScheduleTemplate>("default"); const [topics, setTopics] = useState(""); const [approach, setApproach] = useState(""); const [blocker, setBlocker] = useState(""); const [hint, setHint] = useState(""); const [notes, setNotes] = useState(""); const [needsVisual, setNeedsVisual] = useState(false);
  return <div className="modal-backdrop"><form className="modal-card" onSubmit={(event) => { event.preventDefault(); onFinish({ status, difficulty, priority, revisionMinutes, template, topics: topics.split(",").map((item) => item.trim()).filter(Boolean), approach, blocker, hint, notes, needsVisual, code: capture.code }); }}><div className="modal-heading"><div><span className="eyebrow accent">Session captured · {capture.activeMinutes} min</span><h2>{capture.title}</h2><p>The extension stopped the clock. Leave enough evidence for future-you.</p></div><button type="button" className="icon-button" onClick={onCancel}><X size={19} /></button></div><div className="form-grid"><fieldset className="full"><legend>Outcome</legend><div className="segmented four">{(["solved_independently", "solved_with_hints", "stuck", "stopped"] as SessionStatus[]).map((item) => <button type="button" className={status === item ? "selected" : ""} key={item} onClick={() => setStatus(item)}>{item.replaceAll("_", " ")}</button>)}</div></fieldset><label>Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option value="normal">Normal</option><option value="high">High</option></select></label><fieldset className="full"><legend>Revision length</legend><div className="duration-picks">{([10, 20, 30] as const).map((minutes) => <button type="button" className={revisionMinutes === minutes ? "selected" : ""} key={minutes} onClick={() => setRevisionMinutes(minutes)}><strong>{minutes} min</strong><span>{minutes === 10 ? "short" : minutes === 20 ? "medium" : "long"}</span></button>)}</div></fieldset><label>Schedule<select value={template} onChange={(event) => setTemplate(event.target.value as ScheduleTemplate)}><option value="default">1, 3, 7, 14, 30, 60</option><option value="relaxed">2, 6, 15, 30, 60</option><option value="custom">Custom</option></select></label><label>Topics<input value={topics} onChange={(event) => setTopics(event.target.value)} placeholder="Trees, DFS" /></label><label className="full">Quick approach<textarea rows={2} value={approach} onChange={(event) => setApproach(event.target.value)} /></label><label>Core blocker<textarea rows={2} value={blocker} onChange={(event) => setBlocker(event.target.value)} /></label><label>Hint for next time<textarea rows={2} value={hint} onChange={(event) => setHint(event.target.value)} /></label><label className="full">Notes <span className="optional">optional</span><textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></label><label className="check-label full"><input type="checkbox" checked={needsVisual} onChange={(event) => setNeedsVisual(event.target.checked)} /> Needs a visual explanation</label></div><div className="modal-actions sticky-actions"><button type="button" className="secondary-button" onClick={onCancel}>Keep for later</button><button className="primary-button"><Check size={16} /> Save session</button></div></form></div>;
}
