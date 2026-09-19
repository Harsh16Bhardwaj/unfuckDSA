"use strict";
(() => {
  // extension/src/content.ts
  var ICONS = {
    play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8L18 12 8 5.6Z"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg>`,
    stop: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`,
    minimize: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11h10v2H7z"/></svg>`,
    chevron: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 14 4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  };
  var host = document.createElement("div");
  host.id = "unfuckdsa-tracker-host";
  document.documentElement.append(host);
  var root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
  :host{all:initial}*{box-sizing:border-box}.tracker{position:fixed;z-index:2147483647;right:16px;top:74px;color:#f7f8ef;font:13px/1.35 Inter,Arial,sans-serif}.surface{background:rgba(19,21,18,.97);border:1px solid #41473a;box-shadow:0 22px 70px rgba(0,0,0,.38);backdrop-filter:blur(18px)}.hidden{display:none!important}button,input,textarea,select{font:inherit}.icon{width:38px;height:38px;display:grid;place-items:center;border:1px solid #42483b;border-radius:11px;background:#30352c;color:#f4f6ee;cursor:pointer;transition:.16s}.icon:hover{background:#3b4234;border-color:#5b6747}.icon svg{width:18px;height:18px;fill:currentColor}.icon.danger{color:#ff9f7d;background:#49271f;border-color:#6b3428}.icon.primary{color:#18200f;background:#c8f25a;border-color:#c8f25a}.icon:disabled{opacity:.45;cursor:wait}.brand-icon{width:36px;height:36px;border-radius:11px;object-fit:cover;image-rendering:pixelated}.dot{width:7px;height:7px;border-radius:50%;background:#77806e}.dot.live{background:#c8f25a;box-shadow:0 0 0 5px rgba(200,242,90,.13)}
  .expanded{width:300px;border-radius:18px;overflow:hidden}.header{height:61px;padding:0 12px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #373c31}.header-copy{min-width:0;flex:1}.header strong,.header span{display:block}.header strong{font-size:12px}.header span{margin-top:2px;color:#8f9687;font-size:9px;letter-spacing:.08em}.header .icon{width:31px;height:31px;border:0;background:transparent}.body{padding:16px}.problem{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c6cabe;font-size:12px}.clock{margin:9px 0 14px;font:750 41px/1 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:-3.5px}.state{margin-bottom:5px;color:#89927f;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.controls{display:flex;gap:8px}.controls .start-wide{width:100%;min-height:42px;border:0;border-radius:12px;background:#c8f25a;color:#1b2115;font-weight:850;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}.start-wide svg{width:17px;height:17px;fill:currentColor}.controls .spacer{flex:1}.error{min-height:0;margin-top:9px;color:#ffac8f;font-size:10px}
  .minimal{height:52px;display:flex;align-items:center;gap:5px;padding:5px;border-radius:16px}.mini-main{height:42px;padding:0 10px 0 5px;display:flex;align-items:center;gap:8px;border:0;border-radius:11px;background:transparent;color:#fff;cursor:pointer}.mini-main:hover{background:#292e26}.mini-main img{width:32px;height:32px;border-radius:9px;object-fit:cover;image-rendering:pixelated}.mini-main time{min-width:69px;font:750 17px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:-1.2px}.minimal .icon{width:40px;height:40px}.minimal .dot{position:absolute;left:32px;top:6px;border:2px solid #1a1d18}
  .submit{width:390px;max-height:calc(100vh - 92px);border-radius:18px;overflow:hidden}.submit-head{padding:13px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #373c31}.submit-head div{min-width:0;flex:1}.submit-head strong,.submit-head span{display:block}.submit-head strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.submit-head span{margin-top:3px;color:#969d8d;font-size:10px}.quick-submit{padding:10px 12px;display:grid;grid-template-columns:.8fr 1fr 1fr;gap:7px;border-bottom:1px solid #34392e;background:#20241d}.quick-submit button{min-height:37px;border:1px solid #41483a;border-radius:10px;background:#2d3229;color:#d9ddcf;font-weight:800;cursor:pointer}.quick-submit button.default{background:#3a4132}.quick-submit button.add{background:#c8f25a;border-color:#c8f25a;color:#18200f}.form{max-height:calc(100vh - 222px);padding:13px;overflow:auto}.form::-webkit-scrollbar{width:6px}.form::-webkit-scrollbar-thumb{border-radius:9px;background:#4a5142}.field{display:grid;gap:5px;margin-bottom:10px}.field>span,.field legend{color:#9ba292;font-size:9px;font-weight:750;letter-spacing:.04em}.field input,.field textarea,.field select{width:100%;border:1px solid #41473a;border-radius:9px;background:#282c25;color:#f1f3eb;outline:none}.field input,.field select{height:36px;padding:0 9px}.field textarea{min-height:55px;padding:8px 9px;resize:vertical}.field input:focus,.field textarea:focus,.field select:focus{border-color:#8eaa36;box-shadow:0 0 0 3px rgba(200,242,90,.09)}.field-row{display:grid;grid-template-columns:1fr 1fr;gap:9px}.segments{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:3px;border-radius:10px;background:#252a22}.segments.three{grid-template-columns:repeat(3,1fr)}.segments button{min-height:31px;padding:0 5px;border:0;border-radius:8px;background:transparent;color:#969d8d;font-size:9px;font-weight:750;cursor:pointer}.segments button.selected{background:#424a37;color:#eaffae}.check{display:flex;align-items:center;gap:8px;color:#b5bbac;font-size:10px}.check input{width:15px;height:15px;accent-color:#a7cf36}.submit-note{margin:2px 0 8px;color:#777f70;font-size:9px;line-height:1.45}
  .success{width:250px;min-height:190px;padding:27px;display:grid;place-items:center;align-content:center;border-radius:20px;text-align:center}.success-ring{width:68px;height:68px;display:grid;place-items:center;border-radius:50%;background:#c8f25a;color:#17200e;box-shadow:0 0 0 9px rgba(200,242,90,.12);animation:success-pop .45s cubic-bezier(.2,.9,.3,1.25)}.success-ring svg{width:36px;height:36px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}.success h2{margin:20px 0 3px;font-size:20px}.success p{margin:0;color:#a8ae9f;font-size:11px}@keyframes success-pop{0%{transform:scale(.3);opacity:0}100%{transform:scale(1);opacity:1}}
  .tracker{right:auto;top:auto;left:16px;bottom:16px}.tracker[data-placement="bottom-right"]{left:auto;right:16px;bottom:16px}.tracker[data-placement="top-right"]{left:auto;right:16px;top:74px;bottom:auto}.minimal.idle{width:52px}.minimal.idle .mini-main{width:42px;padding:5px}.minimal.idle .mini-main time,.minimal.idle .mini-main svg,.minimal.idle .mini-toggle,.minimal.idle .mini-end,.minimal.idle .dot{display:none}.brand-icon{background:linear-gradient(145deg,#d8ff62,#7fb221)}
</style>
<div class="tracker" data-placement="bottom-left">
  <section class="surface expanded" data-view="expanded">
    <div class="header"><img class="brand-icon" alt=""/><div class="header-copy"><strong>unfuckDSA</strong><span>TRACKER</span></div><i class="dot"></i><button class="icon minimize" aria-label="Minimize tracker" title="Minimize">${ICONS.minimize}</button></div>
    <div class="body"><div class="state">Ready</div><div class="problem"></div><div class="clock">00:00:00</div><div class="controls"><button class="start-wide">${ICONS.play}<span>Start</span></button><button class="icon resume hidden" aria-label="Resume" title="Resume">${ICONS.play}</button><button class="icon pause hidden" aria-label="Pause" title="Pause">${ICONS.pause}</button><div class="spacer"></div><button class="icon end hidden danger" aria-label="End session" title="End">${ICONS.stop}</button></div><div class="error"></div></div>
  </section>
  <section class="surface minimal hidden" data-view="minimal"><i class="dot live"></i><button class="mini-main" aria-label="Expand tracker"><img alt=""/><time>00:00:00</time>${ICONS.chevron}</button><button class="icon mini-toggle" aria-label="Pause" title="Pause">${ICONS.pause}</button><button class="icon mini-end danger" aria-label="End session" title="End">${ICONS.stop}</button></section>
  <section class="surface submit hidden" data-view="submit">
    <div class="submit-head"><img class="brand-icon" alt=""/><div><strong class="submit-title">Finished problem</strong><span><b class="submit-minutes">0</b> active minutes</span></div></div>
    <div class="quick-submit"><button data-submit="skip">Skip</button><button class="default" data-submit="default">Default</button><button class="add" data-submit="add">Add</button></div>
    <div class="form">
      <p class="submit-note">Skip logs time only. Default ignores edits and uses standard revision settings. Add uses this form.</p>
      <div class="field"><span>Outcome</span><div class="segments" data-group="status"><button data-value="solved_independently" class="selected">Solo</button><button data-value="solved_with_hints">Hints</button><button data-value="stuck">Stuck</button><button data-value="stopped">Stopped</button></div></div>
      <div class="field-row"><div class="field"><span>Difficulty</span><div class="segments three" data-group="difficulty"><button data-value="easy">Easy</button><button data-value="medium" class="selected">Medium</button><button data-value="hard">Hard</button></div></div><div class="field"><span>Priority</span><div class="segments" data-group="priority"><button data-value="normal" class="selected">Normal</button><button data-value="high">High</button></div></div></div>
      <div class="field-row"><div class="field"><span>Revision</span><div class="segments three" data-group="revisionMinutes"><button data-value="10">10m</button><button data-value="20" class="selected">20m</button><button data-value="30">30m</button></div></div><label class="field"><span>Schedule</span><select name="template"><option value="default">1, 3, 7, 14, 30, 60</option><option value="relaxed">2, 6, 15, 30, 60</option><option value="custom">Custom</option></select></label></div>
      <label class="field"><span>Topics</span><input name="topics" placeholder="Arrays, Two pointers"/></label>
      <label class="field"><span>Approach</span><textarea name="approach" placeholder="The key idea\u2026"></textarea></label>
      <div class="field-row"><label class="field"><span>Blocker</span><textarea name="blocker"></textarea></label><label class="field"><span>Hint for next time</span><textarea name="hint"></textarea></label></div>
      <label class="field"><span>Notes</span><textarea name="notes"></textarea></label>
      <label class="check"><input name="needsVisual" type="checkbox"/> Needs a visual explanation</label>
    </div>
  </section>
  <section class="surface success hidden" data-view="success"><div class="success-ring"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.2 4.2L19 7"/></svg></div><h2>Good job.</h2><p>Session saved. Keep the flow.</p></section>
</div>`;
  var $ = (selector) => root.querySelector(selector);
  var $$ = (selector) => [...root.querySelectorAll(selector)];
  var petUrl = chrome.runtime.getURL("sprout-pet.png");
  $$("img").forEach((image) => {
    image.src = petUrl;
  });
  var state = { appUrl: "https://unfuck-dsa.vercel.app", uiMode: "expanded" };
  var successTimer;
  var problemTitle = () => document.title.replace(/\s*-\s*LeetCode.*$/i, "").trim() || location.pathname.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") || "LeetCode problem";
  var elapsed = (timer) => timer.accumulatedMs + (timer.status === "running" && timer.segmentStartedAt ? Date.now() - timer.segmentStartedAt : 0);
  function clockLabel(ms) {
    const seconds = Math.floor(ms / 1e3);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
  function render() {
    const timer = state.timer;
    const mode = state.uiMode ?? (timer?.status === "running" ? "minimal" : "expanded");
    $(".tracker").setAttribute("data-placement", state.placement ?? "bottom-left");
    $$("[data-view]").forEach((view) => view.classList.toggle("hidden", view.dataset.view !== mode));
    const label = clockLabel(timer ? elapsed(timer) : 0);
    $(".clock").textContent = label;
    $(".minimal time").textContent = label;
    $(".problem").textContent = timer?.title ?? problemTitle();
    $(".state").textContent = timer?.status === "paused" ? "Paused" : timer ? "Running" : "Ready";
    $$(".dot").forEach((dot) => dot.classList.toggle("live", timer?.status === "running"));
    $(".start-wide").classList.toggle("hidden", Boolean(timer));
    $(".pause").classList.toggle("hidden", timer?.status !== "running");
    $(".resume").classList.toggle("hidden", timer?.status !== "paused");
    $(".end").classList.toggle("hidden", !timer);
    $(".minimal").classList.toggle("idle", !timer);
    $(".mini-toggle").innerHTML = timer?.status === "paused" ? ICONS.play : ICONS.pause;
    $(".mini-toggle").setAttribute("aria-label", timer?.status === "paused" ? "Resume" : "Pause");
    if (state.pending) {
      $(".submit-title").textContent = state.pending.title;
      $(".submit-minutes").textContent = String(state.pending.activeMinutes);
    }
  }
  async function playSuccess() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const now = context.currentTime;
      [523.25, 659.25, 783.99].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, now + index * 0.08);
        gain.gain.linearRampToValueAtTime(0.07, now + index * 0.08 + 0.015);
        gain.gain.exponentialRampToValueAtTime(1e-3, now + index * 0.08 + 0.22);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(now + index * 0.08);
        oscillator.stop(now + index * 0.08 + 0.23);
      });
    } catch {
    }
  }
  function selectedValue(group) {
    return $(`[data-group="${group}"] button.selected`).dataset.value ?? "";
  }
  function collectFields() {
    return {
      status: selectedValue("status"),
      difficulty: selectedValue("difficulty"),
      priority: selectedValue("priority"),
      revisionMinutes: Number(selectedValue("revisionMinutes")),
      template: $("[name=template]").value,
      topics: $("[name=topics]").value.split(",").map((value) => value.trim()).filter(Boolean),
      approach: $("[name=approach]").value.trim(),
      blocker: $("[name=blocker]").value.trim(),
      hint: $("[name=hint]").value.trim(),
      notes: $("[name=notes]").value.trim(),
      needsVisual: $("[name=needsVisual]").checked
    };
  }
  async function action(actionName, extra = {}) {
    $(".error").textContent = actionName === "end" ? "Capturing editor\u2026" : "";
    const result = await chrome.runtime.sendMessage({ type: "TRACKER_ACTION", action: actionName, title: problemTitle(), url: location.href, ...extra });
    if (result.state) state = result.state;
    $(".error").textContent = result.ok ? "" : result.error ?? "Something went wrong.";
    render();
    if (result.success) {
      await playSuccess();
      window.clearTimeout(successTimer);
      successTimer = window.setTimeout(() => void action("ackSuccess"), 1900);
    }
  }
  $(".start-wide").addEventListener("click", () => void action("start"));
  $(".pause").addEventListener("click", () => void action("pause"));
  $(".resume").addEventListener("click", () => void action("resume"));
  $(".end").addEventListener("click", () => void action("end"));
  $(".minimize").addEventListener("click", () => void action("minimize"));
  $(".mini-main").addEventListener("click", () => void action("expand"));
  $(".mini-toggle").addEventListener("click", () => void action(state.timer?.status === "paused" ? "resume" : "pause"));
  $(".mini-end").addEventListener("click", () => void action("end"));
  $$("[data-group] button").forEach((button) => button.addEventListener("click", () => {
    const group = button.closest("[data-group]");
    group?.querySelectorAll("button").forEach((item) => item.classList.toggle("selected", item === button));
  }));
  $$("[data-submit]").forEach((button) => button.addEventListener("click", () => void action("submit", { submissionMode: button.dataset.submit, fields: collectFields() })));
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TRACKER_UPDATED" && message.state) {
      state = message.state;
      render();
    }
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.unfuckDsa?.newValue) return;
    state = changes.unfuckDsa.newValue;
    render();
  });
  void chrome.runtime.sendMessage({ type: "TRACKER_STATE" }).then((result) => {
    if (result.state) state = result.state;
    render();
  });
  window.setInterval(render, 1e3);
})();
