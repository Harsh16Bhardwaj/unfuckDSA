export {};

type StoredState = { records?: unknown[] };

function publish(state: StoredState | undefined) {
  window.postMessage({ type: "UNFUCKDSA_EXTENSION_SYNC", records: state?.records ?? [] }, window.location.origin);
}

async function publishStoredState() {
  try {
    const stored = await chrome.storage.local.get("unfuckDsa");
    publish(stored.unfuckDsa as StoredState | undefined);
  } catch {
    // The page can outlive an extension update. A stale bridge must fail silently.
  }
}

try {
  void publishStoredState();
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.type !== "UNFUCKDSA_REQUEST_SYNC") return;
    void publishStoredState();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.unfuckDsa) publish(changes.unfuckDsa.newValue as StoredState | undefined);
  });
} catch {
  // Registration can also throw while Chrome is tearing down an old context.
}
