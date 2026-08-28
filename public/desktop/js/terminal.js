import { FS, resolve, isDir, listing } from "./fs.js";
import { THEMES, applyTheme } from "./theme.js";
import { config } from "./config.js";

const ART = [
  "                   -`",
  "                  .o+`",
  "                 `ooo/",
  "                `+oooo:",
  "               `+oooooo:",
  "               -+oooooo+:",
  "             `/:-:++oooo+:",
  "            `/++++/+++++++:",
  "           `/++++++++++++++:",
  "          `/+++ooooooooooooo/`",
  "         ./ooosssso++osssssso+`",
  "        .oossssso-````/ossssss+`",
  "       -osssssso.      :ssssssso.",
  "      :osssssss/        osssso+++.",
  "     /ossssssss/        +ssssooo/-",
  "   `/ossssso+/:-        -:/+osssso+-",
  "  `+sso+:-`                 `.-/+oso:",
  " `++:.                           `-/+/",
  " .`                                 `/"
].join("\n");

const FIELDS = [
  ["OS", "Arch Linux x86_64"],
  ["Host", "10MUS1FK06 (ThinkCentre M910q)"],
  ["Kernel", "Linux 7.1.9-arch1-2"],
  ["Uptime", "3 hours, 18 mins"],
  ["Packages", "1022 (pacman)"],
  ["Shell", "bash 5.3.15"],
  ["Display (Sceptre F24)", "1920x1080 in 24\", 100 Hz [External]"],
  ["WM", "niri 26.04 (Wayland)"],
  ["Theme", "Breeze-Dark [GTK2], Breeze [GTK3]"],
  ["Icons", "Papirus-Dark [GTK2/3/4]"],
  ["Font", "Noto Sans (10pt) [GTK2], Montserrat (10pt) [GTK3/4]"],
  ["Cursor", "breeze (24px)"],
  ["Terminal", "alacritty 0.17.0"],
  ["Terminal Font", "JetBrainsMono Nerd Font (11pt, Regular)"],
  ["CPU", "Intel(R) Core(TM) i5-7500T (4) @ 3.30 GHz"],
  ["GPU", "Intel HD Graphics 630 @ 1.10 GHz [Integrated]"],
  ["Memory", "3.46 GiB / 15.50 GiB (@22%@)"],
  ["Swap", "0 B / 4.00 GiB (@0%@)"],
  ["Disk (/)", "13.63 GiB / 45.96 GiB (@30%@) - ext4"],
  ["Disk (/home)", "59.92 GiB / 421.13 GiB (@14%@) - ext4"],
  ["Local IP (enp0s31f6)", "192.168.4.29/22"],
  ["Locale", "en_US.UTF-8"]
];

const PALETTE = ["#3a2a2f", "#e0824a", "#d98a5c", "#c77a6a", "#b56a7a", "#9a6a8a", "#8f6ca0", "#d8c4bc"];

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

export function makeTerminal(openApp) {
  const wrap = el("div", "term");
  const out = el("div", "term-out");
  wrap.appendChild(out);

  let cwd = ["~"];
  const history = [];
  let hIdx = 0;

  const here = () => (cwd.length > 1 ? cwd.slice(1).join("/") : "~");
  const promptStr = () => `[${config.user}@${config.host} ${here()}]$`;
  const promptHTML = () => `[<b>${config.user}@${config.host}</b> ${here()}]$`;

  function write(node) { out.appendChild(node); wrap.scrollTop = wrap.scrollHeight; }
  function line(text, cls) { write(el("div", cls, text)); }

  function fastfetch() {
    const box = el("div", "term-row");
    box.appendChild(el("pre", "t-art", ART));
    const info = el("div");
    info.style.whiteSpace = "nowrap";
    const head = el("div");
    head.innerHTML = `<span class="t-pink">${config.user}</span>@<span class="t-pink">${config.host}</span>`;
    info.appendChild(head);
    info.appendChild(el("div", "t-dim", "----------------"));
    for (const [k, v] of FIELDS) {
      const row = el("div");
      const parts = v.split(/(@[^@]+@)/).map(seg => {
        if (seg.startsWith("@")) {
          const s = el("span", "t-accent", seg.slice(1, -1));
          return s;
        }
        return document.createTextNode(seg);
      });
      const label = el("span", "t-pink", k + ": ");
      row.appendChild(label);
      parts.forEach(p => row.appendChild(p));
      info.appendChild(row);
    }
    const pal = el("div", "term-palette");
    PALETTE.forEach(c => { const i = el("i"); i.style.background = c; pal.appendChild(i); });
    info.appendChild(pal);
    box.appendChild(info);
    write(box);
  }

  const COMMANDS = {
    help() {
      line("commands: help  ls  cd  pwd  cat  clear  echo  whoami  date  uname  neofetch  open  theme  setup  history", "t-dim");
      line("apps:     open [terminal|files|editor|browser|chat|settings|music|games|moves]", "t-dim");
    },
    setup() {
      openApp("setup");
      line("relaunching setup...", "t-dim");
    },
    ls(args) {
      const target = args[0] ? step(cwd, args[0]) : cwd;
      const node = target && resolve(target);
      if (!isDir(node)) { line("ls: not a directory", "t-dim"); return; }
      const items = listing(node);
      const row = el("div");
      items.forEach(it => {
        const s = el("span", it.dir ? "t-purple" : null, it.name + (it.dir ? "/" : "") + "  ");
        row.appendChild(s);
      });
      write(row);
    },
    cd(args) {
      if (!args[0] || args[0] === "~") { cwd = ["~"]; return; }
      const next = step(cwd, args[0]);
      if (next && isDir(resolve(next))) cwd = next;
      else line("cd: no such directory: " + args[0], "t-dim");
    },
    pwd() { line("/home/" + config.user + (cwd.length > 1 ? "/" + cwd.slice(1).join("/") : "")); },
    cat(args) {
      if (!args[0]) { line("cat: missing file", "t-dim"); return; }
      const p = step(cwd, args[0]);
      const node = p && resolve(p);
      if (node == null || isDir(node)) { line("cat: " + args[0] + ": no such file", "t-dim"); return; }
      line(String(node));
    },
    clear() { out.replaceChildren(); },
    echo(args) { line(args.join(" ")); },
    whoami() { line(config.user); },
    date() { line(new Date().toString()); },
    uname(args) { line(args[0] === "-a" ? `Linux ${config.host} 7.1.9-arch1-2 x86_64 GNU/Linux` : "Linux"); },
    neofetch() { fastfetch(); },
    fastfetch() { fastfetch(); },
    open(args) {
      const known = ["terminal", "files", "editor", "browser", "chat", "settings", "music", "games", "moves", "applications"];
      if (!known.includes(args[0])) { line("open: unknown app. try: " + known.join(", "), "t-dim"); return; }
      openApp(args[0]);
      line("launching " + args[0] + "...", "t-dim");
    },
    theme(args) {
      if (!args[0] || args[0] === "list") { line("themes: " + Object.keys(THEMES).join(", "), "t-dim"); return; }
      if (THEMES[args[0]]) { applyTheme(THEMES[args[0]]); line("theme -> " + args[0], "t-dim"); }
      else line("theme: no preset '" + args[0] + "'", "t-dim");
    },
    history() { history.forEach((h, i) => line(" " + (i + 1) + "  " + h, "t-dim")); }
  };

  function step(base, arg) {
    let path = arg.startsWith("~") ? ["~"] : base.slice();
    for (const seg of arg.replace(/^~\/?/, "").split("/")) {
      if (!seg || seg === ".") continue;
      if (seg === "..") { if (path.length > 1) path.pop(); }
      else path.push(seg);
    }
    return path;
  }

  function run(raw) {
    const cmd = raw.trim();
    const echo = el("div", "term-row");
    echo.innerHTML = `<span class="term-prompt">${promptHTML()}</span>&nbsp;`;
    echo.appendChild(document.createTextNode(cmd));
    write(echo);
    if (!cmd) return;
    history.push(cmd);
    hIdx = history.length;
    const [name, ...args] = cmd.split(/\s+/);
    if (COMMANDS[name]) COMMANDS[name](args);
    else line(name + ": command not found", "t-dim");
  }

  function newPrompt() {
    const row = el("div", "term-row");
    const pr = el("span", "term-prompt");
    pr.innerHTML = promptHTML();
    const inp = el("input", "term-input");
    inp.setAttribute("spellcheck", "false");
    inp.setAttribute("autocomplete", "off");
    row.append(pr, inp);
    write(row);
    inp.focus();
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        const v = inp.value;
        inp.remove();
        pr.remove();
        run(v);
        newPrompt();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (hIdx > 0) { hIdx -= 1; inp.value = history[hIdx] || ""; }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (hIdx < history.length) { hIdx += 1; inp.value = history[hIdx] || ""; }
      } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        out.replaceChildren();
      }
    });
  }

  fastfetch();
  newPrompt();
  wrap.addEventListener("mousedown", e => {
    if (window.getSelection().toString()) return;
    const inp = wrap.querySelector(".term-input");
    if (inp && e.target !== inp) setTimeout(() => inp.focus(), 0);
  });

  return wrap;
}
