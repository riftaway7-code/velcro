import { createWindow } from "./wm.js";
import { makeTerminal } from "./terminal.js";
import { buildFiles, buildEditor, buildChat, buildBrowser, buildSettings, buildApplications, buildGames, buildEmbed, buildAssistant } from "./apps.js";
import { restoreTheme } from "./theme.js";
import { config, saveConfig } from "./config.js";
import { runSetup } from "./setup.js";
import { zoneFor } from "./zones.js";

restoreTheme();

function clock() {
  const el = document.getElementById("clock");
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: config.tz,
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true
    }).formatToParts(new Date());
  } catch (e) {
    parts = new Intl.DateTimeFormat("en-US", {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true
    }).formatToParts(new Date());
  }
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  el.innerHTML = `${p.weekday} ${p.month} ${p.day}&nbsp;&nbsp;&nbsp;${p.hour}:${p.minute}&nbsp;${p.dayPeriod}`;
}
clock();
setInterval(clock, 1000);

function weather() {
  const z = zoneFor(config.tz);
  document.getElementById("wx-icon").textContent = z.icon;
  document.getElementById("wx-temp").textContent = z.f + "°F";
  document.getElementById("tray-weather").title = `${z.city} · ${z.tz}`;
}
weather();

function openApp(name) {
  switch (name) {
    case "terminal":
      createWindow({ id: "terminal", title: `${config.user}@${config.host}: ~`, width: 900, height: 540, body: makeTerminal(openApp) });
      break;
    case "files":
      createWindow({ id: "files", title: "files", width: 380, height: 420, body: buildFiles(p => openEditor(p)) });
      break;
    case "editor":
      openEditor(null);
      break;
    case "chat":
      createWindow({ id: "chat", title: "chat — #rice", width: 420, height: 460, body: buildChat() });
      break;
    case "browser":
      createWindow({ id: "browser", title: "web", width: 640, height: 460, body: buildBrowser(openApp) });
      break;
    case "web":
      createWindow({ id: "web", title: "web — velcro", width: 940, height: 620, body: buildEmbed("/browser.html") });
      break;
    case "games":
      createWindow({ id: "games", title: "games", width: 980, height: 660, body: buildEmbed("/home.html") });
      break;
    case "movies":
      createWindow({ id: "movies", title: "movies", width: 980, height: 660, body: buildEmbed("/movies.html") });
      break;
    case "vapps":
      createWindow({ id: "vapps", title: "apps", width: 940, height: 640, body: buildEmbed("/apps.html") });
      break;
    case "assistant":
      createWindow({ id: "assistant", title: "assistant", width: 460, height: 560, body: buildAssistant() });
      break;
    case "settings":
      createWindow({ id: "settings", title: "settings", width: 440, height: 560, body: buildSettings(relaunchSetup) });
      break;
    case "setup":
      relaunchSetup();
      break;
    case "applications":
      createWindow({ id: "applications", title: "applications", width: 360, height: 300, body: buildApplications(openApp) });
      break;
    case "games":
      createWindow({ id: "games", title: "games — tic-tac-toe", width: 300, height: 360, body: buildGames() });
      break;
    case "moves":
      createWindow({ id: "moves", title: "moves", width: 360, height: 260, body: "" });
      break;
  }
}

function openEditor(path) {
  const win = createWindow({ id: "editor", title: "editor", width: 560, height: 420, body: editorBodyFor(path) });
  if (path && win._body.firstElementChild && win._body.firstElementChild._openPath) {
    win._body.firstElementChild._openPath(path);
  }
}
function editorBodyFor(path) {
  const node = buildEditor(path);
  return node;
}

document.querySelectorAll("[data-app]").forEach(b => {
  b.addEventListener("click", () => openApp(b.dataset.app));
});

document.getElementById("tray-gear").addEventListener("click", () => openApp("settings"));

const bell = document.getElementById("tray-bell");
bell.addEventListener("click", () => {
  const ctx = document.getElementById("ctx");
  ctx.innerHTML = `<button>no new notifications</button>`;
  showCtx(ctx, window.innerWidth - 190, 38);
});

const KICKOFF = [
  ["web", "public"], ["games", "sports_esports"], ["movies", "movie"],
  ["vapps", "apps"], ["assistant", "smart_toy"], ["terminal", "terminal"], ["files", "folder"],
  ["settings", "settings"]
];
document.getElementById("plasma").addEventListener("click", e => {
  const ctx = document.getElementById("ctx");
  ctx.replaceChildren();
  KICKOFF.forEach(([id, icon]) => {
    const b = document.createElement("button");
    b.innerHTML = `<span class="msym">${icon}</span><span>${id}</span>`;
    b.onclick = () => { openApp(id); hideCtx(); };
    ctx.appendChild(b);
  });
  const r = e.currentTarget.getBoundingClientRect();
  showCtx(ctx, r.right + 6, r.top);
});

const pins = document.getElementById("pins");
const pinDefs = [
  ["web", "public", "#cd7a95", "#a85875"],
  ["games", "sports_esports", "#e0824a", "#c25f2e"],
  ["movies", "movie", "#8f6ca0", "#6d4f7d"],
  ["terminal", "terminal", "#d98a5c", "#b5673a"],
  ["files", "folder", "#c77a6a", "#a3564a"],
  ["settings", "settings", "#9a8078", "#75605a"]
];
pinDefs.forEach(([app, icon, a, b]) => {
  const el = document.createElement("button");
  el.className = "pin";
  el.title = app;
  el.style.background = `linear-gradient(135deg, ${a}, ${b})`;
  el.innerHTML = `<span class="msym">${icon}</span>`;
  el.addEventListener("click", () => openApp(app));
  pins.appendChild(el);
});

const ctx = document.getElementById("ctx");
const CTX_APPS = ["web", "games", "movies", "vapps", "assistant", "terminal", "files", "settings"];
document.getElementById("desktop").addEventListener("contextmenu", e => {
  e.preventDefault();
  ctx.replaceChildren();
  CTX_APPS.forEach(a => {
    const b = document.createElement("button");
    b.textContent = "open " + a;
    b.onclick = () => { openApp(a); hideCtx(); };
    ctx.appendChild(b);
  });
  showCtx(ctx, e.clientX, e.clientY);
});
function showCtx(node, x, y) {
  node.hidden = false;
  node.style.left = Math.min(x, window.innerWidth - node.offsetWidth - 8) + "px";
  node.style.top = Math.min(y, window.innerHeight - node.offsetHeight - 8) + "px";
}
function hideCtx() { ctx.hidden = true; }
document.addEventListener("pointerdown", e => {
  if (!e.target.closest("#ctx")) hideCtx();
});

function relaunchSetup() {
  runSetup(() => {
    config.setup = true;
    saveConfig();
    clock();
    weather();
  });
}

if (config.setup) {
  openApp("web");
} else {
  runSetup(() => {
    config.setup = true;
    saveConfig();
    clock();
    weather();
    openApp("web");
  });
}
