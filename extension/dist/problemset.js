"use strict";
(() => {
  // extension/src/problemset.ts
  var ROW_ATTRIBUTE = "data-unfuckdsa-revision";
  var HIDDEN_ATTRIBUTE = "data-unfuckdsa-native-hidden";
  var revisions = [];
  var refreshTimer;
  function localDateKey(date = /* @__PURE__ */ new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function problemPath(value) {
    try {
      return new URL(value, location.origin).pathname.replace(/\/$/, "");
    } catch {
      return "";
    }
  }
  function findProblemList() {
    const parents = /* @__PURE__ */ new Map();
    document.querySelectorAll('a[href^="/problems/"]').forEach((link) => {
      const parent = link.parentElement;
      if (parent) parents.set(parent, (parents.get(parent) ?? 0) + 1);
    });
    return [...parents.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }
  function ensureStyles() {
    if (document.getElementById("unfuckdsa-problemset-style")) return;
    const style = document.createElement("style");
    style.id = "unfuckdsa-problemset-style";
    style.textContent = `
    [${ROW_ATTRIBUTE}]{position:relative;outline:1px solid color-mix(in srgb,#9fcd35 58%,transparent);outline-offset:-1px;background:color-mix(in srgb,#b8e84b 9%,transparent)!important;box-shadow:inset 3px 0 #9fcd35;margin-bottom:2px}
    [${ROW_ATTRIBUTE}]:hover{background:color-mix(in srgb,#b8e84b 14%,transparent)!important}
    [${ROW_ATTRIBUTE}] .ud-revision-chip{flex:none;margin-left:8px;padding:3px 7px;border:1px solid color-mix(in srgb,#9fcd35 58%,transparent);border-radius:999px;color:#648516;background:color-mix(in srgb,#b8e84b 14%,transparent);font-size:10px;font-weight:650;line-height:1.2;white-space:nowrap}
    .dark [${ROW_ATTRIBUTE}] .ud-revision-chip{color:#d8ff79}
    @media(max-width:640px){[${ROW_ATTRIBUTE}] .ud-revision-chip{padding:3px 5px;font-size:9px}}
  `;
    document.head.append(style);
  }
  function restoreNativeRows() {
    document.querySelectorAll(`[${HIDDEN_ATTRIBUTE}]`).forEach((row) => {
      row.style.removeProperty("display");
      row.removeAttribute(HIDDEN_ATTRIBUTE);
    });
  }
  function difficultyClass(difficulty) {
    if (difficulty === "easy") return "text-sd-easy";
    if (difficulty === "hard") return "text-sd-hard";
    return "text-sd-medium";
  }
  function updateSyntheticRow(row, revision) {
    row.href = revision.url;
    row.id = `ud-${revision.problemId}`;
    row.removeAttribute("target");
    row.querySelector(".ellipsis")?.replaceChildren(revision.title);
    const difficulty = row.querySelector("p");
    if (difficulty) {
      difficulty.className = `mx-0 text-[14px] lc-xl:mx-4 ${difficultyClass(revision.difficulty)}`;
      difficulty.textContent = revision.difficulty === "medium" ? "Med." : revision.difficulty[0].toUpperCase() + revision.difficulty.slice(1);
    }
    const percent = [...row.querySelectorAll("div")].find(
      (element) => !element.children.length && /^\d+(\.\d+)?%$/.test(element.textContent?.trim() ?? "")
    );
    if (percent) percent.textContent = `${revision.minutes} min`;
  }
  function decorate(row, revision) {
    row.id = `ud-${revision.problemId}`;
    row.setAttribute(ROW_ATTRIBUTE, revision.scheduleId);
    row.querySelector(".ud-revision-chip")?.remove();
    const chip = document.createElement("span");
    chip.className = "ud-revision-chip";
    chip.textContent = "Revision";
    row.firstElementChild?.append(chip);
  }
  function injectRows() {
    const list = findProblemList();
    if (!list) return;
    const current = [
      ...list.querySelectorAll(`:scope > a[${ROW_ATTRIBUTE}]`)
    ];
    const hiddenNativeCount = list.querySelectorAll(
      `:scope > [${HIDDEN_ATTRIBUTE}]`
    ).length;
    if (current.length === revisions.length && (revisions.length > 0 || hiddenNativeCount === 0) && current.every(
      (row, index) => row.getAttribute(ROW_ATTRIBUTE) === revisions[index]?.scheduleId
    ))
      return;
    current.forEach((row) => row.remove());
    restoreNativeRows();
    if (!revisions.length) return;
    ensureStyles();
    const nativeRows = [
      ...list.querySelectorAll(":scope > a")
    ];
    const template = nativeRows.find((row) => !row.href.includes("daily-question")) ?? nativeRows[0];
    if (!template) return;
    const generated = [];
    revisions.forEach((revision) => {
      const path = problemPath(revision.url);
      const native = nativeRows.find((row2) => problemPath(row2.href) === path);
      const row = (native ?? template).cloneNode(true);
      if (native) {
        native.style.display = "none";
        native.setAttribute(HIDDEN_ATTRIBUTE, "true");
      } else {
        updateSyntheticRow(row, revision);
      }
      decorate(row, revision);
      generated.push(row);
    });
    generated.reverse().forEach((row) => list.prepend(row));
  }
  function scheduleInjection() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(injectRows, 80);
  }
  async function load() {
    const result = await chrome.runtime.sendMessage({
      type: "GET_TODAY_REVISIONS",
      date: localDateKey(),
      timezoneOffset: (/* @__PURE__ */ new Date()).getTimezoneOffset()
    }).catch(() => ({ ok: false }));
    revisions = result.ok ? result.revisions ?? [] : [];
    scheduleInjection();
  }
  new MutationObserver(scheduleInjection).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void load();
  });
  void load();
})();
