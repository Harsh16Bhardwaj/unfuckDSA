export {};

type Timer = {
  status: "running" | "paused";
  title: string;
  url: string;
  startedAt: number;
  segmentStartedAt?: number;
  accumulatedMs: number;
};

type SubmissionFields = {
  status: "solved_independently" | "solved_with_hints" | "stuck" | "stopped";
  difficulty: "easy" | "medium" | "hard";
  priority: "normal" | "high";
  revisionMinutes: 10 | 20 | 30;
  template: "default" | "relaxed" | "custom";
  topics: string[];
  approach: string;
  blocker: string;
  hint: string;
  notes: string;
  needsVisual: boolean;
};

type PendingSubmission = {
  title: string;
  url: string;
  startedAt: number;
  activeMinutes: number;
  code: string;
};

type LoggedSession = SubmissionFields & PendingSubmission & {
  id: string;
  finishedAt: string;
  skipRevision: boolean;
};

type StoredState = {
  appUrl: string;
  token?: string;
  deviceId?: string;
  timer?: Timer;
  pending?: PendingSubmission;
  records?: LoggedSession[];
  uiMode?: "expanded" | "minimal" | "submit" | "success";
  placement?: "bottom-left" | "bottom-right" | "top-right";
};

type TrackerAction =
  | "start"
  | "pause"
  | "resume"
  | "end"
  | "expand"
  | "minimize"
  | "submit"
  | "ackSuccess";

type TrackerMessage =
  | { type: "TRACKER_STATE" }
  | { type: "TRACKER_ACTION"; action: TrackerAction; title?: string; url?: string; submissionMode?: "skip" | "default" | "add"; fields?: Partial<SubmissionFields> };

const DEFAULT_STATE: StoredState = {
  appUrl: "https://unfuck-dsa.vercel.app",
  records: [],
  uiMode: "expanded",
  placement: "bottom-left",
};

const DEFAULT_FIELDS: SubmissionFields = {
  status: "solved_independently",
  difficulty: "medium",
  priority: "normal",
  revisionMinutes: 20,
  template: "default",
  topics: [],
  approach: "",
  blocker: "",
  hint: "",
  notes: "",
  needsVisual: false,
};

const elapsed = (timer: Timer) => timer.accumulatedMs + (timer.status === "running" && timer.segmentStartedAt ? Date.now() - timer.segmentStartedAt : 0);

async function readState(): Promise<StoredState> {
  const stored = await chrome.storage.local.get("unfuckDsa");
  const value = stored.unfuckDsa as StoredState | undefined;
  if (!value) return { ...DEFAULT_STATE };
  return {
    ...DEFAULT_STATE,
    ...value,
    records: value.records ?? [],
    uiMode: value.uiMode ?? (value.timer?.status === "running" ? "minimal" : "expanded"),
  };
}

async function writeState(state: StoredState) {
  await chrome.storage.local.set({ unfuckDsa: state });
  const tabs = await chrome.tabs.query({ url: "https://leetcode.com/problems/*" });
  await Promise.all(tabs.map((tab) => tab.id ? chrome.tabs.sendMessage(tab.id, { type: "TRACKER_UPDATED", state }).catch(() => undefined) : undefined));
}

async function captureEditor(tabId: number) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      const page = window as typeof window & { monaco?: { editor?: { getModels?: () => Array<{ getValue: () => string }> } } };
      const model = page.monaco?.editor?.getModels?.()[0];
      if (model) return model.getValue();
      return document.querySelector<HTMLTextAreaElement>(".monaco-editor textarea.inputarea")?.value ?? "";
    },
  });
  return typeof result?.result === "string" ? result.result : "";
}

chrome.runtime.onMessage.addListener((message: TrackerMessage, sender, respond) => {
  void (async () => {
    const state = await readState();
    if (message.type === "TRACKER_STATE") {
      respond({ ok: true, state });
      return;
    }

    const now = Date.now();
    if (message.action === "start") {
      state.timer = {
        status: "running",
        title: message.title ?? "LeetCode problem",
        url: message.url ?? sender.tab?.url ?? "",
        startedAt: now,
        segmentStartedAt: now,
        accumulatedMs: 0,
      };
      state.pending = undefined;
      state.uiMode = "minimal";
      await writeState(state);
      respond({ ok: true, state });
      return;
    }

    if (message.action === "expand" || message.action === "minimize") {
      state.uiMode = message.action === "expand" ? "expanded" : "minimal";
      await writeState(state);
      respond({ ok: true, state });
      return;
    }

    if (message.action === "ackSuccess") {
      state.uiMode = "expanded";
      await writeState(state);
      respond({ ok: true, state });
      return;
    }

    if (message.action === "submit") {
      if (!state.pending) {
        respond({ ok: false, error: "No finished session to save." });
        return;
      }
      const mode = message.submissionMode ?? "add";
      const fields = mode === "add" ? { ...DEFAULT_FIELDS, ...message.fields } : DEFAULT_FIELDS;
      const record: LoggedSession = {
        ...state.pending,
        ...fields,
        topics: Array.isArray(fields.topics) ? fields.topics : [],
        id: crypto.randomUUID(),
        finishedAt: new Date().toISOString(),
        skipRevision: mode === "skip",
        code: mode === "skip" ? "" : state.pending.code,
      };
      state.records = [record, ...(state.records ?? [])].slice(0, 1000);
      state.timer = undefined;
      state.pending = undefined;
      state.uiMode = "success";
      await writeState(state);
      respond({ ok: true, state, success: true });
      return;
    }

    const timer = state.timer;
    if (!timer) {
      respond({ ok: false, error: "No active session." });
      return;
    }

    if (message.action === "pause") {
      state.timer = { ...timer, status: "paused", accumulatedMs: elapsed(timer), segmentStartedAt: undefined };
      state.uiMode = "expanded";
      await writeState(state);
      respond({ ok: true, state });
      return;
    }

    if (message.action === "resume") {
      state.timer = { ...timer, status: "running", segmentStartedAt: now };
      state.uiMode = "minimal";
      await writeState(state);
      respond({ ok: true, state });
      return;
    }

    if (message.action === "end") {
      if (!sender.tab?.id) {
        respond({ ok: false, error: "The current LeetCode tab is unavailable." });
        return;
      }
      const activeMinutes = Math.max(1, Math.ceil(elapsed(timer) / 60_000));
      const code = await captureEditor(sender.tab.id);
      state.timer = { ...timer, status: "paused", accumulatedMs: elapsed(timer), segmentStartedAt: undefined };
      state.pending = { title: timer.title, url: timer.url, startedAt: timer.startedAt, activeMinutes, code };
      state.uiMode = "submit";
      await writeState(state);
      respond({ ok: true, state });
      return;
    }
  })().catch((cause) => respond({ ok: false, error: cause instanceof Error ? cause.message : "Tracker failed." }));
  return true;
});
