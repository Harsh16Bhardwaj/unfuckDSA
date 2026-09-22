"use strict";
(() => {
  // extension/src/app-bridge.ts
  function publish(state) {
    window.postMessage({ type: "UNFUCKDSA_EXTENSION_SYNC", records: state?.records ?? [] }, window.location.origin);
  }
  async function publishStoredState() {
    try {
      const stored = await chrome.storage.local.get("unfuckDsa");
      publish(stored.unfuckDsa);
    } catch {
    }
  }
  try {
    void publishStoredState();
    window.addEventListener("message", (event) => {
      if (event.source !== window || event.data?.type !== "UNFUCKDSA_REQUEST_SYNC") return;
      void publishStoredState();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.unfuckDsa) publish(changes.unfuckDsa.newValue);
    });
  } catch {
  }
})();
