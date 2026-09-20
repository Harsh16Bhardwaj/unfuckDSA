export {};

type Revision = {
  scheduleId: string;
  problemId: string;
  title: string;
  slug: string;
  url: string;
  difficulty: "easy" | "medium" | "hard";
  topics: string[];
  minutes: number;
  reason: string[];
  priorityScore: number;
};

type RevisionResponse = {
  ok: boolean;
  revisions?: Revision[];
  error?: string;
};

const HOST_ID = "unfuckdsa-problemset-revisions";
let revisions: Revision[] = [];
let errorMessage = "";
let loading = true;

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function pageIsDark() {
  const color = getComputedStyle(document.body).backgroundColor;
  const channels = color.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
  if (!channels?.length) return matchMedia("(prefers-color-scheme: dark)").matches;
  const [red, green, blue] = channels;
  return red * 0.299 + green * 0.587 + blue * 0.114 < 128;
}

function placementTarget() {
  return document.querySelector("main") ?? document.querySelector("#__next");
}

function ensureHost() {
  let host = document.getElementById(HOST_ID);
  const target = placementTarget();
  if (!target) return null;
  if (!host) {
    host = document.createElement("section");
    host.id = HOST_ID;
    host.setAttribute("aria-label", "Today's revision queue");
    target.prepend(host);
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>
      :host{display:block;width:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#262626}.queue{width:min(1200px,calc(100% - 32px));margin:18px auto 14px;border:1px solid #d9dfca;border-left:3px solid #9cce2e;border-radius:10px;background:#fff;box-shadow:0 4px 18px rgba(0,0,0,.035);overflow:hidden}.head{min-height:52px;padding:0 15px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #eceee7}.head div{display:flex;align-items:center;gap:9px}.mark{width:8px;height:8px;border-radius:50%;background:#9cce2e;box-shadow:0 0 0 4px rgba(156,206,46,.13)}h2{margin:0;font-size:14px;font-weight:600}.count{padding:4px 8px;border-radius:12px;color:#4d6419;background:#eff8d9;font-size:11px;font-weight:600}.rows{display:grid}.row{min-height:52px;padding:0 12px;display:grid;grid-template-columns:30px minmax(0,1fr) 86px 76px 38px;gap:10px;align-items:center;border-bottom:1px solid #f0f1ed;color:inherit;transition:background .14s}.row:last-child{border-bottom:0}.row:hover{background:#f8faf4}.order{color:#8a8a86;font-size:12px;text-align:center}.copy{min-width:0;color:inherit;text-decoration:none}.title{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500}.meta{display:block;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#898b84;font-size:10px}.minutes{color:#6f726a;font-size:11px}.difficulty{font-size:11px;text-transform:capitalize}.difficulty.easy{color:#00a67e}.difficulty.medium{color:#d69900}.difficulty.hard{color:#e34b4b}.done{width:32px;height:32px;display:grid;place-items:center;border:1px solid #dce3cc;border-radius:8px;color:#64891b;background:#f8fcee;cursor:pointer;transition:.14s}.done:hover{color:#345000;border-color:#9cce2e;background:#eaffb8}.done:disabled{opacity:.45;cursor:wait}.done svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.3;stroke-linecap:round;stroke-linejoin:round}.message{padding:16px;color:#777b71;font-size:12px}.error{color:#b1543c}.queue[data-theme="dark"]{color:#eff0ed;border-color:#41483a;border-left-color:#b4dd4d;background:#282828;box-shadow:0 5px 22px rgba(0,0,0,.18)}.queue[data-theme="dark"] .head,.queue[data-theme="dark"] .row{border-color:#3a3a3a}.queue[data-theme="dark"] .row:hover{background:#30322e}.queue[data-theme="dark"] .count{color:#dfff94;background:#3b4727}.queue[data-theme="dark"] .meta,.queue[data-theme="dark"] .minutes,.queue[data-theme="dark"] .order{color:#a2a49e}.queue[data-theme="dark"] .done{color:#cdec7b;border-color:#4b5934;background:#343a2c}.queue[data-theme="dark"] .done:hover{color:#ecffba;border-color:#a4cd3e;background:#44532d}@media(max-width:700px){.queue{width:calc(100% - 20px);margin-top:10px}.row{grid-template-columns:24px minmax(0,1fr) 54px 36px}.difficulty{display:none}.minutes{text-align:right}.head{padding-inline:12px}}
    </style><div class="queue"><div class="head"><div><i class="mark"></i><h2>Today’s revision order</h2></div><span class="count"></span></div><div class="rows"></div></div>`;
  } else if (host.parentElement !== target || target.firstElementChild !== host) {
    target.prepend(host);
  }
  return host;
}

function render() {
  const host = ensureHost();
  const shadow = host?.shadowRoot;
  if (!host || !shadow) return;
  const queue = shadow.querySelector<HTMLElement>(".queue")!;
  const rows = shadow.querySelector<HTMLElement>(".rows")!;
  const count = shadow.querySelector<HTMLElement>(".count")!;
  queue.dataset.theme = pageIsDark() ? "dark" : "light";
  count.textContent = loading ? "Syncing" : `${revisions.length} today`;
  rows.replaceChildren();

  if (loading || errorMessage || !revisions.length) {
    const message = document.createElement("div");
    message.className = `message${errorMessage ? " error" : ""}`;
    message.textContent = loading
      ? "Loading your revision queue…"
      : errorMessage || "Revision queue clear for today.";
    rows.append(message);
    return;
  }

  revisions.forEach((revision, index) => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<span class="order">${index + 1}</span><a class="copy"><strong class="title"></strong><small class="meta"></small></a><span class="minutes">${revision.minutes} min</span><span class="difficulty ${revision.difficulty}">${revision.difficulty}</span><button class="done" type="button" aria-label="Mark revised" title="Mark revised"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.2 4.2L19 7"/></svg></button>`;
    row.querySelector<HTMLAnchorElement>(".copy")!.href = revision.url;
    row.querySelector<HTMLElement>(".title")!.textContent = revision.title;
    row.querySelector<HTMLElement>(".meta")!.textContent =
      revision.topics.slice(0, 2).join(" · ") ||
      revision.reason[0] ||
      "Due for recall";
    row.querySelector<HTMLButtonElement>(".done")!.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        void complete(revision, event.currentTarget as HTMLButtonElement);
      },
    );
    rows.append(row);
  });
}

async function complete(revision: Revision, button: HTMLButtonElement) {
  button.disabled = true;
  const result = (await chrome.runtime.sendMessage({
    type: "COMPLETE_REVISION",
    scheduleId: revision.scheduleId,
  })) as RevisionResponse;
  if (!result.ok) {
    button.disabled = false;
    errorMessage = result.error ?? "Could not mark this revision complete.";
    render();
    return;
  }
  revisions = revisions.filter(
    (item) => item.scheduleId !== revision.scheduleId,
  );
  render();
}

async function load() {
  loading = true;
  errorMessage = "";
  render();
  const result = (await chrome.runtime.sendMessage({
    type: "GET_TODAY_REVISIONS",
    date: localDateKey(),
    timezoneOffset: new Date().getTimezoneOffset(),
  })) as RevisionResponse;
  loading = false;
  if (!result.ok) {
    errorMessage = result.error ?? "Could not load today's revisions.";
    revisions = [];
  } else {
    revisions = result.revisions ?? [];
  }
  render();
}

const observer = new MutationObserver(() => {
  if (!document.getElementById(HOST_ID)) render();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void load();
});
void load();
