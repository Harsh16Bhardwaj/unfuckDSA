export {};

type StoredState = {
  appUrl?: string;
  token?: string;
  deviceId?: string;
  placement?: "bottom-left" | "bottom-right" | "top-right";
  timer?: { status: "running" | "paused"; title: string; startedAt: number; segmentStartedAt?: number; accumulatedMs: number };
};

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const APP_URL = "https://unfuck-dsa.vercel.app";
let current: StoredState = { appUrl: APP_URL };

function elapsed() {
  const timer = current.timer;
  if (!timer) return 0;
  return timer.accumulatedMs + (timer.status === "running" && timer.segmentStartedAt ? Date.now() - timer.segmentStartedAt : 0);
}

function render() {
  byId<HTMLSelectElement>("placement").value = current.placement ?? "bottom-left";
  byId<HTMLElement>("statusDot").classList.toggle("live", current.timer?.status === "running");
  const minutes = Math.floor(elapsed() / 60_000);
  byId<HTMLElement>("activeStatus").textContent = current.timer ? `${current.timer.status === "paused" ? "Paused" : "Tracking"} ${current.timer.title} · ${minutes}m` : "Open a LeetCode problem to begin.";
  byId<HTMLButtonElement>("unpairButton").hidden = !current.token;
  byId<HTMLButtonElement>("pairButton").hidden = Boolean(current.token);
  byId<HTMLInputElement>("pairCode").disabled = Boolean(current.token);
  byId<HTMLElement>("pairState").textContent = current.token ? "Connected" : "Not paired";
  byId<HTMLElement>("pairState").classList.toggle("connected", Boolean(current.token));
}

async function save() {
  current = { ...current, appUrl: APP_URL };
  await chrome.storage.local.set({ unfuckDsa: current });
  render();
}

byId<HTMLSelectElement>("placement").addEventListener("change", async () => {
  current = { ...current, placement: byId<HTMLSelectElement>("placement").value as StoredState["placement"] };
  await save();
  byId<HTMLElement>("placementStatus").textContent = "Tracker position updated.";
});

byId<HTMLButtonElement>("openAppButton").addEventListener("click", () => {
  void chrome.tabs.create({ url: `${APP_URL}/dashboard` });
});

byId<HTMLButtonElement>("pairButton").addEventListener("click", async () => {
  const code = byId<HTMLInputElement>("pairCode").value.trim();
  const error = byId<HTMLElement>("pairError");
  error.textContent = "";
  try {
    if (!code) throw new Error("Paste the pairing key from your dashboard.");
    const response = await fetch(`${APP_URL}/api/extension/pair/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, name: `${navigator.platform} · Chromium` }) });
    const result = await response.json() as { token?: string; deviceId?: string; error?: string };
    if (!response.ok || !result.token) throw new Error(result.error ?? "Pairing failed.");
    current = { ...current, appUrl: APP_URL, token: result.token, deviceId: result.deviceId };
    await save();
    error.textContent = "Connected. Today’s revisions can now sync.";
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : "Pairing failed.";
  }
});

byId<HTMLButtonElement>("unpairButton").addEventListener("click", async () => {
  const next = { ...current, appUrl: APP_URL };
  delete next.token;
  delete next.deviceId;
  current = next;
  await save();
  byId<HTMLElement>("pairError").textContent = "Disconnected. Local timer data was kept.";
});

void chrome.storage.local.get("unfuckDsa").then((stored) => {
  current = (stored.unfuckDsa as StoredState | undefined) ?? current;
  render();
  window.setInterval(render, 1000);
});
