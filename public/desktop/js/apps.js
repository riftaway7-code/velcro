import { resolve, isDir, listing } from "./fs.js";
import { THEMES, applyTheme, currentTheme, parseDotColors } from "./theme.js";

function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function buildFiles(openFile) {
  const root = h(`<div class="pane"><div class="crumbs"></div><ul class="filelist"></ul></div>`);
  const crumbs = root.querySelector(".crumbs");
  const ul = root.querySelector(".filelist");
  let path = ["~"];

  function render() {
    crumbs.textContent = "~/" + path.slice(1).join("/");
    ul.replaceChildren();
    if (path.length > 1) {
      const up = h(`<li><span class="fi">..</span><span>parent</span></li>`);
      up.onclick = () => { path.pop(); render(); };
      ul.appendChild(up);
    }
    const node = resolve(path);
    for (const it of listing(node)) {
      const li = h(`<li><span class="fi msym">${it.dir ? "folder" : "description"}</span><span></span></li>`);
      li.querySelector("span:last-child").textContent = it.name;
      li.onclick = () => {
        if (it.dir) { path.push(it.name); render(); }
        else openFile(path.concat(it.name));
      };
      ul.appendChild(li);
    }
  }
  render();
  return root;
}

export function buildEditor(initialPath) {
  const root = h(`<div class="editor">
    <div class="editor-tabs"></div>
    <textarea spellcheck="false"></textarea>
  </div>`);
  const tabs = root.querySelector(".editor-tabs");
  const ta = root.querySelector("textarea");
  const openTabs = [];
  let active = -1;

  function paint() {
    tabs.replaceChildren();
    openTabs.forEach((t, i) => {
      const tab = h(`<div class="editor-tab"></div>`);
      tab.textContent = t.path[t.path.length - 1];
      if (i === active) tab.classList.add("on");
      tab.onclick = () => { save(); active = i; ta.value = openTabs[active].text; };
      tabs.appendChild(tab);
    });
  }
  function save() {
    if (active >= 0) openTabs[active].text = ta.value;
  }
  function openPath(p) {
    const node = resolve(p);
    if (isDir(node) || node == null) return;
    const existing = openTabs.findIndex(t => t.path.join("/") === p.join("/"));
    save();
    if (existing >= 0) { active = existing; }
    else { openTabs.push({ path: p, text: String(node) }); active = openTabs.length - 1; }
    ta.value = openTabs[active].text;
    paint();
  }
  ta.addEventListener("input", save);

  if (initialPath) openPath(initialPath);
  else {
    ta.value = "// open a file from the Files app";
  }
  root._openPath = openPath;
  return root;
}

export function buildChat() {
  const root = h(`<div class="chat">
    <div class="chat-log"></div>
    <form class="chat-in"><input placeholder="message #rice" spellcheck="false" autocomplete="off"><button type="submit">send</button></form>
  </div>`);
  const log = root.querySelector(".chat-log");
  const form = root.querySelector("form");
  const input = form.querySelector("input");

  const seed = [
    ["aiyan", "yo the sunset wallpaper goes hard"],
    ["aiyan", "did you get niri gaps right this time"],
    ["you", "12px, matches waybar"],
    ["aiyan", "send the dotfiles when you can, i wanna port the alacritty colors"]
  ];
  function add(who, text) {
    const m = h(`<div class="msg"><span class="who"></span><span class="body"></span></div>`);
    m.classList.add(who === "you" ? "me" : "them");
    m.querySelector(".who").textContent = who;
    m.querySelector(".body").textContent = text;
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
  }
  seed.forEach(([w, t]) => add(w, t));
  form.addEventListener("submit", e => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    add("you", v);
    input.value = "";
    setTimeout(() => add("aiyan", "ok noted"), 600);
  });
  return root;
}

export function buildAssistant() {
  const root = h(`<div class="chat">
    <div class="chat-log"></div>
    <form class="chat-in"><input placeholder="ask anything" spellcheck="false" autocomplete="off"><button type="submit">send</button></form>
  </div>`);
  const log = root.querySelector(".chat-log");
  const form = root.querySelector("form");
  const input = form.querySelector("input");

  const history = [
    { role: "system", content: "You are a concise, helpful assistant embedded in a web desktop. Give direct answers. Use short paragraphs and code blocks where useful." }
  ];

  function add(who, text, cls) {
    const m = h(`<div class="msg"><span class="who"></span><span class="body"></span></div>`);
    m.classList.add(who === "you" ? "me" : "them");
    if (cls) m.classList.add(cls);
    m.querySelector(".who").textContent = who;
    m.querySelector(".body").textContent = text;
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m.querySelector(".body");
  }

  add("assistant", "hey. what do you need?");

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    add("you", v);
    input.value = "";
    input.disabled = true;
    history.push({ role: "user", content: v });
    const body = add("assistant", "…", "pending");
    try {
      const res = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "openai", messages: history.slice(-14) })
      });
      if (!res.ok) throw new Error("http " + res.status);
      const data = await res.json();
      const reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "").trim()
        || (typeof data === "string" ? data : "");
      body.textContent = reply || "no answer came back. try again.";
      body.parentElement.classList.remove("pending");
      if (reply) history.push({ role: "assistant", content: reply });
    } catch (err) {
      body.textContent = "couldn't reach the model (" + err.message + "). the endpoint may be blocked on this network.";
      body.parentElement.classList.remove("pending");
    } finally {
      input.disabled = false;
      input.focus();
    }
  });
  return root;
}

export function buildEmbed(src, opts) {
  const root = h(`<div class="embed"><iframe class="embed-frame" referrerpolicy="no-referrer"></iframe></div>`);
  const frame = root.querySelector("iframe");
  frame.setAttribute("allow", "fullscreen; autoplay; clipboard-read; clipboard-write; encrypted-media");
  if (opts && opts.sandbox) frame.setAttribute("sandbox", opts.sandbox);
  frame.src = src + (src.includes("?") ? "&" : "?") + "embed=1";
  return root;
}

export function buildBrowser(openApp) {
  const root = h(`<div class="browser">
    <div class="browser-bar"><input value="home://start" spellcheck="false"></div>
    <div class="browser-view"></div>
  </div>`);
  const bar = root.querySelector("input");
  const view = root.querySelector(".browser-view");

  function start() {
    view.replaceChildren(h(`<div class="startpage">
      <h1>archlinux</h1>
      <p>a browser desktop, running on localhost</p>
      <div class="links">
        <button data-a="terminal">terminal</button>
        <button data-a="files">files</button>
        <button data-a="editor">editor</button>
        <button data-a="chat">chat</button>
        <button data-a="settings">settings</button>
      </div>
    </div>`));
    view.querySelectorAll(".links button").forEach(b => b.onclick = () => openApp(b.dataset.a));
  }
  bar.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    const v = bar.value.trim();
    if (v === "home://start" || v === "" || v === "home") start();
    else view.replaceChildren(h(`<div class="startpage"><h1>offline</h1><p>${v} is unreachable from this sandbox. try home://start</p></div>`));
  });
  start();
  return root;
}

export function buildApplications(open) {
  const items = [
    ["terminal", "terminal", "terminal"],
    ["files", "folder", "files"],
    ["editor", "code", "editor"],
    ["browser", "public", "browser"],
    ["chat", "chat_bubble", "chat"],
    ["assistant", "smart_toy", "assistant"],
    ["games", "sports_esports", "games"],
    ["moves", "open_with", "moves"],
    ["settings", "settings", "settings"]
  ];
  const root = h(`<div class="applist"></div>`);
  items.forEach(([id, icon, label]) => {
    const b = h(`<button class="appcard"><span class="msym">${icon}</span><span></span></button>`);
    b.querySelector("span:last-child").textContent = label;
    b.onclick = () => open(id);
    root.appendChild(b);
  });
  return root;
}

export function buildGames() {
  const root = h(`<div class="ttt">
    <div class="ttt-status"></div>
    <div class="ttt-grid"></div>
    <button class="ttt-reset">new game</button>
  </div>`);
  const grid = root.querySelector(".ttt-grid");
  const status = root.querySelector(".ttt-status");
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  let board, over;

  function outcome(b) {
    for (const [a, c, d] of LINES) {
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    }
    return b.every(Boolean) ? "draw" : null;
  }
  function bot() {
    const empty = board.map((v, i) => (v ? null : i)).filter(i => i !== null);
    for (const mark of ["o", "x"]) {
      for (const i of empty) {
        const t = board.slice();
        t[i] = mark;
        if (outcome(t) === mark) return i;
      }
    }
    if (empty.includes(4)) return 4;
    return empty[Math.floor(Math.random() * empty.length)];
  }
  function render() {
    grid.replaceChildren();
    board.forEach((v, i) => {
      const c = h(`<button class="ttt-cell"></button>`);
      c.textContent = v ? v.toUpperCase() : "";
      c.disabled = Boolean(v) || over;
      c.onclick = () => play(i);
      grid.appendChild(c);
    });
  }
  function play(i) {
    if (board[i] || over) return;
    board[i] = "x";
    let w = outcome(board);
    if (!w) {
      const j = bot();
      if (j != null) board[j] = "o";
      w = outcome(board);
    }
    over = Boolean(w);
    status.textContent = w === "x" ? "you win" : w === "o" ? "you lose" : w === "draw" ? "draw" : "your move (x)";
    render();
  }
  function reset() {
    board = Array(9).fill(null);
    over = false;
    status.textContent = "your move (x)";
    render();
  }
  root.querySelector(".ttt-reset").onclick = reset;
  reset();
  return root;
}

export function buildSettings(onRerunSetup) {
  const keys = ["bar-accent", "term-accent", "term-pink", "term-purple", "accent", "win-fg", "sky-top", "sky-mid", "wp-tree"];
  const root = h(`<div class="settings">
    <section>
      <h3>presets</h3>
      <div class="presets"></div>
    </section>
    <section>
      <h3>colors</h3>
      <div class="swatch-grid"></div>
    </section>
    <section>
      <h3>import dotfile colors</h3>
      <textarea spellcheck="false" placeholder="paste pywal colors.json, ~/.Xresources, alacritty.toml, or a list of #hex values"></textarea>
      <div class="row">
        <button data-do="apply">apply</button>
        <button data-do="reset">reset to apollo</button>
      </div>
      <p class="hint">maps background/foreground + color0..15 onto the --bar-*, --term-*, --win-*, --card-*, and wallpaper variables. this is the hook for the real dotfiles.</p>
    </section>
    <section>
      <h3>first-run setup</h3>
      <div class="row"><button data-do="setup">run setup again</button></div>
      <p class="hint">re-opens the welcome / identity / location / theme wizard.</p>
    </section>
  </div>`);

  root.querySelector('[data-do="setup"]').onclick = () => {
    if (typeof onRerunSetup === "function") onRerunSetup();
  };

  const presets = root.querySelector(".presets");
  Object.keys(THEMES).forEach(name => {
    const b = h(`<button></button>`);
    b.textContent = name;
    b.onclick = () => { applyTheme(THEMES[name]); refresh(); };
    presets.appendChild(b);
  });

  const grid = root.querySelector(".swatch-grid");
  const inputs = {};
  keys.forEach(k => {
    const s = h(`<label class="swatch"><span></span><input type="color"></label>`);
    s.querySelector("span").textContent = "--" + k;
    const inp = s.querySelector("input");
    inputs[k] = inp;
    inp.addEventListener("input", () => {
      document.documentElement.style.setProperty("--" + k, inp.value);
      applyTheme(currentTheme());
    });
    grid.appendChild(s);
  });

  function toHex(v) {
    v = v.trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    const m = v.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (m) return "#" + [m[1], m[2], m[3]].map(n => (+n).toString(16).padStart(2, "0")).join("");
    return "#000000";
  }
  function refresh() {
    const cs = getComputedStyle(document.documentElement);
    keys.forEach(k => { inputs[k].value = toHex(cs.getPropertyValue("--" + k)); });
  }

  root.querySelector('[data-do="apply"]').onclick = () => {
    const parsed = parseDotColors(root.querySelector("textarea").value);
    if (parsed) { applyTheme(parsed); refresh(); }
    else root.querySelector(".hint").textContent = "could not find colors in that. need #hex values, a pywal json, or Xresources lines.";
  };
  root.querySelector('[data-do="reset"]').onclick = () => { applyTheme(THEMES.apollo); refresh(); };

  refresh();
  return root;
}
