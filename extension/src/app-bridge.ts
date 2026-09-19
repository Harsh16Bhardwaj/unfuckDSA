export {};

type StoredState = { records?: unknown[] };

function publish(state: StoredState | undefined) {
  window.postMessage({ type: "UNFUCKDSA_EXTENSION_SYNC", records: state?.records ?? [] }, window.location.origin);
}

void chrome.storage.local.get("unfuckDsa").then((stored) => publish(stored.unfuckDsa as StoredState | undefined));

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.type !== "UNFUCKDSA_REQUEST_SYNC") return;
  void chrome.storage.local.get("unfuckDsa").then((stored) => publish(stored.unfuckDsa as StoredState | undefined));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.unfuckDsa) publish(changes.unfuckDsa.newValue as StoredState | undefined);
});
