export {};

type StoredState = {
  appUrl: string;
  token?: string;
  deviceId?: string;
  placement?: "bottom-left" | "bottom-right" | "top-right";
  timer?: { status: "running" | "paused"; title: string; startedAt: number; segmentStartedAt?: number; accumulatedMs: number };
};

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let current: StoredState = { appUrl: "https://unfuck-dsa.vercel.app" };

function elapsed() {
  const timer = current.timer;
  if (!timer) return 0;
  return timer.accumulatedMs + (timer.status === "running" && timer.segmentStartedAt ? Date.now() - timer.segmentStartedAt : 0);
}

function render() {
  byId<HTMLInputElement>("appUrl").value = current.appUrl;
  byId<HTMLSelectElement>("placement").value = current.placement ?? "bottom-left";
  byId<HTMLElement>("statusDot").classList.toggle("live", current.timer?.status === "running");
  const minutes = Math.floor(elapsed() / 60_000);
  byId<HTMLElement>("activeStatus").textContent = current.timer ? `${current.timer.status === "paused" ? "Paused" : "Tracking"} ${current.timer.title} · ${minutes}m` : "Open a LeetCode problem to begin.";
  byId<HTMLButtonElement>("unpairButton").hidden = !current.token;
}

async function save() {
  await chrome.storage.local.set({ unfuckDsa: current });
  render();
}

byId<HTMLSelectElement>("placement").addEventListener("change", async () => {
  current = { ...current, placement: byId<HTMLSelectElement>("placement").value as StoredState["placement"] };
  await save();
  byId<HTMLElement>("saveStatus").textContent = "Tracker position updated.";
});

byId<HTMLButtonElement>("saveUrlButton").addEventListener("click", async () => {
  current = { ...current, appUrl: byId<HTMLInputElement>("appUrl").value.replace(/\/$/, ""), placement: byId<HTMLSelectElement>("placement").value as StoredState["placement"] };
  await save();
  byId<HTMLElement>("saveStatus").textContent = "Saved. No pairing required.";
});

byId<HTMLButtonElement>("openAppButton").addEventListener("click", () => {
  const appUrl = byId<HTMLInputElement>("appUrl").value.replace(/\/$/, "");
  void chrome.tabs.create({ url: `${appUrl}/dashboard` });
});

byId<HTMLButtonElement>("pairButton").addEventListener("click", async () => {
  const appUrl = byId<HTMLInputElement>("appUrl").value.replace(/\/$/, "");
  const code = byId<HTMLInputElement>("pairCode").value.trim();
  const error = byId<HTMLElement>("pairError");
  error.textContent = "";
  try {
    const response = await fetch(`${appUrl}/api/extension/pair/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, name: `${navigator.platform} · Chromium` }) });
    const result = await response.json() as { token?: string; deviceId?: string; error?: string };
    if (!response.ok || !result.token) throw new Error(result.error ?? "Pairing failed.");
    current = { ...current, appUrl, token: result.token, deviceId: result.deviceId };
    await save();
    error.textContent = "Cloud pairing connected.";
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : "Pairing failed.";
  }
});

byId<HTMLButtonElement>("unpairButton").addEventListener("click", async () => {
  current = { appUrl: current.appUrl, timer: current.timer };
  await save();
  byId<HTMLElement>("pairError").textContent = "Cloud pairing removed. Local tracking stays active.";
});

void chrome.storage.local.get("unfuckDsa").then((stored) => {
  current = (stored.unfuckDsa as StoredState | undefined) ?? current;
  render();
  window.setInterval(render, 1000);
});
