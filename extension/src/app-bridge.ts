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

async function publishStoredState() {
  if (!contextIsAlive()) return;
  try {
    const stored = await chrome.storage.local.get("unfuckDsa");
    if (!contextIsAlive()) return;
    publish(stored.unfuckDsa as StoredState | undefined);
  } catch {
    // The page can outlive an extension update. A stale bridge must fail silently.
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
    if (area === "local" && changes.unfuckDsa) publish(changes.unfuckDsa.newValue as StoredState | undefined);
  });
} catch {
  // Registration can also throw while Chrome is tearing down an old context.
}
