"use strict";
(() => {
  // extension/src/popup.ts
  var byId = (id) => document.getElementById(id);
  var APP_URL = "https://unfuck-dsa.vercel.app";
  var current = { appUrl: APP_URL };
  function elapsed() {
    const timer = current.timer;
    if (!timer) return 0;
    return timer.accumulatedMs + (timer.status === "running" && timer.segmentStartedAt ? Date.now() - timer.segmentStartedAt : 0);
  }
  function render() {
    byId("placement").value = current.placement ?? "bottom-left";
    byId("statusDot").classList.toggle("live", current.timer?.status === "running");
    const minutes = Math.floor(elapsed() / 6e4);
    byId("activeStatus").textContent = current.timer ? `${current.timer.status === "paused" ? "Paused" : "Tracking"} ${current.timer.title} \xB7 ${minutes}m` : "Open a LeetCode problem to begin.";
    byId("unpairButton").hidden = !current.token;
    byId("pairButton").hidden = Boolean(current.token);
    byId("pairCode").disabled = Boolean(current.token);
    byId("pairState").textContent = current.token ? "Connected" : "Not paired";
    byId("pairState").classList.toggle("connected", Boolean(current.token));
  }
  async function save() {
    current = { ...current, appUrl: APP_URL };
    await chrome.storage.local.set({ unfuckDsa: current });
    render();
  }
  byId("placement").addEventListener("change", async () => {
    current = { ...current, placement: byId("placement").value };
    await save();
    byId("placementStatus").textContent = "Tracker position updated.";
  });
  byId("openAppButton").addEventListener("click", () => {
    void chrome.tabs.create({ url: `${APP_URL}/dashboard` });
  });
  byId("pairButton").addEventListener("click", async () => {
    const code = byId("pairCode").value.trim();
    const error = byId("pairError");
    error.textContent = "";
    try {
      if (!code) throw new Error("Paste the pairing key from your dashboard.");
      const response = await fetch(`${APP_URL}/api/extension/pair/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, name: `${navigator.platform} \xB7 Chromium` }) });
      const result = await response.json();
      if (!response.ok || !result.token) throw new Error(result.error ?? "Pairing failed.");
      current = { ...current, appUrl: APP_URL, token: result.token, deviceId: result.deviceId };
      await save();
      void chrome.runtime.sendMessage({ type: "TRACKER_STATE" });
      error.textContent = "Connected. Today\u2019s revisions can now sync.";
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : "Pairing failed.";
    }
  });
  byId("unpairButton").addEventListener("click", async () => {
    const next = { ...current, appUrl: APP_URL };
    delete next.token;
    delete next.deviceId;
    current = next;
    await save();
    byId("pairError").textContent = "Disconnected. Local timer data was kept.";
  });
  void chrome.storage.local.get("unfuckDsa").then((stored) => {
    current = stored.unfuckDsa ?? current;
    render();
    window.setInterval(render, 1e3);
  });
})();
