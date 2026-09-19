"use strict";
(() => {
  // extension/src/app-bridge.ts
  function publish(state) {
    window.postMessage({ type: "UNFUCKDSA_EXTENSION_SYNC", records: state?.records ?? [] }, window.location.origin);
  }
  void chrome.storage.local.get("unfuckDsa").then((stored) => publish(stored.unfuckDsa));
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.type !== "UNFUCKDSA_REQUEST_SYNC") return;
    void chrome.storage.local.get("unfuckDsa").then((stored) => publish(stored.unfuckDsa));
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.unfuckDsa) publish(changes.unfuckDsa.newValue);
  });
})();
