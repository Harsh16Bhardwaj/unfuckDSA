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
  function publishStoredState() {
    if (!contextIsAlive()) return;
    try {
      chrome.storage.local.get("unfuckDsa", (stored) => {
        try {
          if (chrome.runtime.lastError || !contextIsAlive()) return;
          publish(stored.unfuckDsa);
        } catch {
        }
      });
    } catch {
    }
  }
  try {
    void publishStoredState();
    window.addEventListener("message", (event) => {
      if (event.source !== window || event.data?.type !== "UNFUCKDSA_REQUEST_SYNC") return;
      if (!contextIsAlive()) return;
      publishStoredState();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (!contextIsAlive()) return;
      if (area === "local" && changes.unfuckDsa) publish(changes.unfuckDsa.newValue);
    });
  } catch {
  }
})();
