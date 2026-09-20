"use strict";
(() => {
  // extension/src/background.ts
  var DEFAULT_STATE = {
    appUrl: "https://unfuck-dsa.vercel.app",
    records: [],
    uiMode: "expanded",
    placement: "bottom-left"
  };
  var DEFAULT_FIELDS = {
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
    needsVisual: false
  };
  var elapsed = (timer) => timer.accumulatedMs + (timer.status === "running" && timer.segmentStartedAt ? Date.now() - timer.segmentStartedAt : 0);
  async function readState() {
    const stored = await chrome.storage.local.get("unfuckDsa");
    const value = stored.unfuckDsa;
    if (!value) return { ...DEFAULT_STATE };
    return {
      ...DEFAULT_STATE,
      ...value,
      appUrl: DEFAULT_STATE.appUrl,
      records: value.records ?? [],
      uiMode: value.uiMode ?? (value.timer?.status === "running" ? "minimal" : "expanded")
    };
  }
  async function writeState(state) {
    await chrome.storage.local.set({ unfuckDsa: state });
    const tabs = await chrome.tabs.query({ url: "https://leetcode.com/problems/*" });
    await Promise.all(tabs.map((tab) => tab.id ? chrome.tabs.sendMessage(tab.id, { type: "TRACKER_UPDATED", state }).catch(() => void 0) : void 0));
  }
  async function captureEditor(tabId) {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => {
        const page = window;
        const model = page.monaco?.editor?.getModels?.()[0];
        if (model) return model.getValue();
        return document.querySelector(".monaco-editor textarea.inputarea")?.value ?? "";
      }
    });
    return typeof result?.result === "string" ? result.result : "";
  }
  async function revisionRequest(state, path, init) {
    if (!state.token)
      throw new Error("Open the dashboard, copy your pairing key, then connect it in the extension popup.");
    const response = await fetch(`${state.appUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${state.token}`,
        ...init?.headers
      }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "Revision sync failed.");
    return result;
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    void (async () => {
      const state = await readState();
      if (message.type === "TRACKER_STATE") {
        respond({ ok: true, state });
        return;
      }
      if (message.type === "GET_TODAY_REVISIONS") {
        const params = new URLSearchParams({
          date: message.date,
          timezoneOffset: String(message.timezoneOffset)
        });
        const result = await revisionRequest(
          state,
          `/api/extension/revisions?${params}`
        );
        respond({ ok: true, revisions: result.revisions ?? [] });
        return;
      }
      if (message.type === "COMPLETE_REVISION") {
        await revisionRequest(state, "/api/extension/revisions", {
          method: "POST",
          body: JSON.stringify({
            scheduleId: message.scheduleId,
            completedAt: (/* @__PURE__ */ new Date()).toISOString(),
            outcome: "good"
          })
        });
        respond({ ok: true });
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
          accumulatedMs: 0
        };
        state.pending = void 0;
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
        const record = {
          ...state.pending,
          ...fields,
          topics: Array.isArray(fields.topics) ? fields.topics : [],
          id: crypto.randomUUID(),
          finishedAt: (/* @__PURE__ */ new Date()).toISOString(),
          skipRevision: mode === "skip",
          code: mode === "skip" ? "" : state.pending.code
        };
        state.records = [record, ...state.records ?? []].slice(0, 1e3);
        state.timer = void 0;
        state.pending = void 0;
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
        state.timer = { ...timer, status: "paused", accumulatedMs: elapsed(timer), segmentStartedAt: void 0 };
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
        const activeMinutes = Math.max(1, Math.ceil(elapsed(timer) / 6e4));
        const code = await captureEditor(sender.tab.id);
        state.timer = { ...timer, status: "paused", accumulatedMs: elapsed(timer), segmentStartedAt: void 0 };
        state.pending = { title: timer.title, url: timer.url, startedAt: timer.startedAt, activeMinutes, code };
        state.uiMode = "submit";
        await writeState(state);
        respond({ ok: true, state });
        return;
      }
    })().catch((cause) => respond({ ok: false, error: cause instanceof Error ? cause.message : "Tracker failed." }));
    return true;
  });
})();
