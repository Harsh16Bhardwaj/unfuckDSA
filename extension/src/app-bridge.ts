export {};

type StoredState = { records?: unknown[] };

function publish(state: StoredState | undefined) {
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
        // Reading lastError in the callback prevents Chrome from surfacing a
        // rejected promise while an old content script is being torn down.
        if (chrome.runtime.lastError || !contextIsAlive()) return;
        publish(stored.unfuckDsa as StoredState | undefined);
      } catch {
        // The extension may be invalidated between the callback and publish.
      }
    });
  } catch {
    // The page can outlive an extension update. A stale bridge must fail silently.
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
    if (area === "local" && changes.unfuckDsa) publish(changes.unfuckDsa.newValue as StoredState | undefined);
  });
} catch {
  // Registration can also throw while Chrome is tearing down an old context.
}
