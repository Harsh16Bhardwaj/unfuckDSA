"use strict";
(() => {
  // extension/src/popup.ts
  var byId = (id) => document.getElementById(id);
  var current = { appUrl: "https://unfuck-dsa.vercel.app" };
  function elapsed() {
    const timer = current.timer;
    if (!timer) return 0;
    return timer.accumulatedMs + (timer.status === "running" && timer.segmentStartedAt ? Date.now() - timer.segmentStartedAt : 0);
  }
  function render() {
    byId("appUrl").value = current.appUrl;
    byId("placement").value = current.placement ?? "bottom-left";
    byId("statusDot").classList.toggle("live", current.timer?.status === "running");
    const minutes = Math.floor(elapsed() / 6e4);
    byId("activeStatus").textContent = current.timer ? `${current.timer.status === "paused" ? "Paused" : "Tracking"} ${current.timer.title} \xB7 ${minutes}m` : "Open a LeetCode problem to begin.";
    byId("unpairButton").hidden = !current.token;
  }
  async function save() {
    await chrome.storage.local.set({ unfuckDsa: current });
    render();
  }
  byId("placement").addEventListener("change", async () => {
    current = { ...current, placement: byId("placement").value };
    await save();
    byId("saveStatus").textContent = "Tracker position updated.";
  });
  byId("saveUrlButton").addEventListener("click", async () => {
    current = { ...current, appUrl: byId("appUrl").value.replace(/\/$/, ""), placement: byId("placement").value };
    await save();
    byId("saveStatus").textContent = "Saved. No pairing required.";
  });
  byId("openAppButton").addEventListener("click", () => {
    const appUrl = byId("appUrl").value.replace(/\/$/, "");
    void chrome.tabs.create({ url: `${appUrl}/dashboard` });
  });
  byId("pairButton").addEventListener("click", async () => {
    const appUrl = byId("appUrl").value.replace(/\/$/, "");
    const code = byId("pairCode").value.trim();
    const error = byId("pairError");
    error.textContent = "";
    try {
      const response = await fetch(`${appUrl}/api/extension/pair/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, name: `${navigator.platform} \xB7 Chromium` }) });
      const result = await response.json();
      if (!response.ok || !result.token) throw new Error(result.error ?? "Pairing failed.");
      current = { ...current, appUrl, token: result.token, deviceId: result.deviceId };
      await save();
      error.textContent = "Cloud pairing connected.";
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : "Pairing failed.";
    }
  });
  byId("unpairButton").addEventListener("click", async () => {
    current = { appUrl: current.appUrl, timer: current.timer };
    await save();
    byId("pairError").textContent = "Cloud pairing removed. Local tracking stays active.";
  });
  void chrome.storage.local.get("unfuckDsa").then((stored) => {
    current = stored.unfuckDsa ?? current;
    render();
    window.setInterval(render, 1e3);
  });
})();
