import { createWindow } from "./wm.js";
import { THEMES, applyTheme } from "./theme.js";
import { config } from "./config.js";
import { ZONES, zoneFor, browserZone } from "./zones.js";

const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function node(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

const SWATCH_KEYS = ["accent", "term-pink", "term-purple", "sky-top"];

export function runSetup(onDone) {
  const desktop = document.getElementById("desktop");

  const dim = document.createElement("div");
  dim.className = "setup-dim";
  desktop.appendChild(dim);
  requestAnimationFrame(() => dim.classList.add("in"));

  const shell = node(`<div class="setup">
    <div class="setup-page"></div>
    <div class="setup-foot">
      <div class="setup-dots"></div>
      <div class="setup-btns">
        <button class="back">back</button>
        <button class="next primary">next</button>
      </div>
    </div>
  </div>`);

  const win = createWindow({ id: "setup", title: "setup — os-vc-test", width: 460, height: 440, body: shell });
  win.classList.add("win--setup");
  const dr = desktop.getBoundingClientRect();
  win.style.left = Math.round((dr.width - 460) / 2) + "px";
  win.style.top = Math.round((dr.height - 440) / 2) + "px";
  win.querySelector(".win-dot.min").style.display = "none";
  win.querySelector(".win-resize").style.display = "none";

  const page = shell.querySelector(".setup-page");
  const dots = shell.querySelector(".setup-dots");
  const backBtn = shell.querySelector(".back");
  const nextBtn = shell.querySelector(".next");

  const defaultTz = ZONES.some(z => z.tz === config.tz) ? config.tz : browserZone();
  const state = { i: 0, user: config.user, host: config.host, tz: defaultTz, theme: "apollo" };
  const steps = [welcome, identity, location, theme, review];

  function welcome() {
    return node(`<div>
      <div class="setup-logo"><span class="msym">desktop_windows</span></div>
      <h2>welcome to os-vc-test</h2>
      <p>a browser desktop styled like an arch + niri rice. a few quick questions and it boots.</p>
    </div>`);
  }

  function location() {
    const el = node(`<div>
      <h2>location</h2>
      <p>sets the clock's time zone. the tray weather is read from wherever you pick.</p>
      <label class="setup-field">time zone
        <select class="su-tz"></select>
      </label>
      <div class="setup-preview"><span class="su-wx"></span></div>
    </div>`);
    const sel = el.querySelector(".su-tz");
    const wx = el.querySelector(".su-wx");
    ZONES.forEach(z => {
      const o = document.createElement("option");
      o.value = z.tz;
      o.textContent = `${z.city} — ${z.tz}`;
      sel.appendChild(o);
    });
    if (!ZONES.some(z => z.tz === state.tz)) {
      const o = document.createElement("option");
      o.value = state.tz;
      o.textContent = `local — ${state.tz}`;
      sel.appendChild(o);
    }
    sel.value = state.tz;
    const sync = () => {
      state.tz = sel.value;
      const z = zoneFor(state.tz);
      const now = new Intl.DateTimeFormat("en-US", { timeZone: state.tz, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date());
      wx.textContent = `${now}  ·  ${z.f}°F ${z.city}`;
    };
    sel.addEventListener("change", sync);
    sync();
    return el;
  }

  function identity() {
    const el = node(`<div>
      <h2>identity</h2>
      <p>this is the name on your shell prompt and the fastfetch header.</p>
      <label class="setup-field">username
        <input class="su-user" spellcheck="false" autocomplete="off">
      </label>
      <label class="setup-field">hostname
        <input class="su-host" spellcheck="false" autocomplete="off">
      </label>
      <div class="setup-preview">[<b class="su-prev"></b> ~]$</div>
    </div>`);
    const u = el.querySelector(".su-user");
    const h = el.querySelector(".su-host");
    const prev = el.querySelector(".su-prev");
    u.value = state.user;
    h.value = state.host;
    const sync = () => {
      state.user = u.value;
      state.host = h.value;
      prev.textContent = `${(u.value || "user").trim()}@${(h.value || "host").trim()}`;
    };
    u.addEventListener("input", sync);
    h.addEventListener("input", sync);
    sync();
    return el;
  }

  function theme() {
    const el = node(`<div>
      <h2>theme</h2>
      <p>pick a starting palette. everything is css variables, so Settings can remap it later.</p>
      <div class="setup-themes"></div>
    </div>`);
    const grid = el.querySelector(".setup-themes");
    Object.keys(THEMES).forEach(name => {
      const card = node(`<button class="setup-theme"><div class="sw"></div><span></span></button>`);
      card.querySelector("span").textContent = name;
      const sw = card.querySelector(".sw");
      SWATCH_KEYS.forEach(k => {
        const i = document.createElement("i");
        i.style.background = THEMES[name][k];
        sw.appendChild(i);
      });
      if (name === state.theme) card.classList.add("sel");
      card.addEventListener("click", () => {
        state.theme = name;
        grid.querySelectorAll(".setup-theme").forEach(c => c.classList.remove("sel"));
        card.classList.add("sel");
        applyTheme(THEMES[name]);
      });
      grid.appendChild(card);
    });
    return el;
  }

  function review() {
    return node(`<div>
      <h2>all set</h2>
      <ul class="setup-sum">
        <li>shell &mdash; <b>${state.user.trim() || "apollo"}@${state.host.trim() || "archlinux"}</b></li>
        <li>time zone &mdash; <b>${state.tz}</b></li>
        <li>theme &mdash; <b>${state.theme}</b></li>
      </ul>
      <p>press finish to boot the desktop. this only runs on first visit.</p>
    </div>`);
  }

  function render() {
    page.replaceChildren(steps[state.i]());
    dots.replaceChildren();
    steps.forEach((_, k) => {
      const d = document.createElement("i");
      if (k === state.i) d.className = "on";
      dots.appendChild(d);
    });
    backBtn.disabled = state.i === 0;
    nextBtn.textContent = state.i === steps.length - 1 ? "finish" : "next";
  }

  function finish() {
    config.user = state.user.trim() || "apollo";
    config.host = state.host.trim() || "archlinux";
    config.tz = state.tz;
    applyTheme(THEMES[state.theme]);

    dim.classList.remove("in");
    setTimeout(() => dim.remove(), REDUCE ? 0 : 220);
    win._close();
    onDone();
  }

  backBtn.addEventListener("click", () => {
    if (state.i > 0) { state.i -= 1; render(); }
  });
  nextBtn.addEventListener("click", () => {
    if (state.i < steps.length - 1) { state.i += 1; render(); }
    else finish();
  });
  win.querySelector(".win-dot.close").addEventListener("click", () => {
    dim.classList.remove("in");
    setTimeout(() => dim.remove(), REDUCE ? 0 : 220);
    onDone();
  });

  render();
  return win;
}
