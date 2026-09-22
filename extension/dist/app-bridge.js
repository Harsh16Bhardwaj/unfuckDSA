"use strict";
(() => {
  // extension/src/app-bridge.ts
  function publish(state) {
    window.postMessage({ type: "UNFUCKDSA_EXTENSION_SYNC", records: state?.records ?? [] }, window.location.origin);
  }
  function contextIsAlive() {
    try {
      return Boolean(chrome.runtime?.id && chrome.storage?.local);
    } catch {
      return false;
    }
  }
  async function publishStoredState() {
    if (!contextIsAlive()) return;
    try {
      const stored = await chrome.storage.local.get("unfuckDsa");
      if (!contextIsAlive()) return;
      publish(stored.unfuckDsa);
    } catch {
    }
  }
  try {
    void publishStoredState();
    window.addEventListener("message", (event) => {
      if (event.source !== window || event.data?.type !== "UNFUCKDSA_REQUEST_SYNC") return;
      if (!contextIsAlive()) return;
      void publishStoredState();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (!contextIsAlive()) return;
      if (area === "local" && changes.unfuckDsa) publish(changes.unfuckDsa.newValue);
    });
  } catch {
  }
})();
