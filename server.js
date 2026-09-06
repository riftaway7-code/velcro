import express from "express";
import { createServer, get as httpGet, request as httpRequest } from "http";
import { get as httpsGet, request as httpsRequest } from "https";
import { isIP } from "net";
import { lookup } from "dns/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { server as wispServer } from "@mercuryworkshop/wisp-js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "./db.js";
import { auth, SECRET } from "./auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  const envText = readFileSync(join(__dirname, ".env"), "utf8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {}

const app = express();
const PORT = process.env.PORT || 4173;
const IS_SERVERLESS = !!process.env.VERCEL;

app.use(express.json());

app.get("/api/wisp-available", (_, res) => res.json({ ok: !IS_SERVERLESS }));

const PRESENCE_TTL_MS = 30000;
const presenceMap = new Map();
let totalUsers = 0;
const seenIds = new Set();

setInterval(() => {
  const now = Date.now();
  for (const [id, lastSeenAt] of presenceMap.entries()) {
    if (now - lastSeenAt > PRESENCE_TTL_MS) presenceMap.delete(id);
  }
}, 10000);

app.post("/api/presence/ping", (req, res) => {
  const id = String(req.body?.id || "").slice(0, 64);
  if (!id) return res.status(400).json({ ok: false });
  presenceMap.set(id, Date.now());
  if (!seenIds.has(id)) {
    if (seenIds.size < 100000) seenIds.add(id);
    totalUsers++;
  }
  res.json({ ok: true });
});

app.post("/api/presence/leave", (req, res) => {
  const id = String(req.body?.id || "").slice(0, 64);
  if (id) presenceMap.delete(id);
  res.json({ ok: true });
});

app.get("/api/stats/users", (_, res) => {
  res.json({ ok: true, totalUsers, activeUsers: presenceMap.size });
});

// ── chat ──────────────────────────────────────────────────────────────────
const chatHistory = [];
const CHAT_MAX = 100;
const chatActiveUsers = new Map();

app.get("/api/chat/messages", (req, res) => {
  const since = parseInt(req.query.since || 0, 10) || 0;
  const sid = String(req.query.sid || "").slice(0, 64);
  if (sid) {
    chatActiveUsers.set(sid, Date.now());
    const cutoff = Date.now() - 10000;
    for (const [id, t] of chatActiveUsers) if (t < cutoff) chatActiveUsers.delete(id);
  }
  res.json({
    messages: since === 0 ? chatHistory : chatHistory.filter((m) => m.time > since),
    online: chatActiveUsers.size,
  });
});

app.post("/api/chat/send", (req, res) => {
  let { name, text } = req.body || {};
  name = String(name || "anon").slice(0, 24).trim() || "anon";
  text = String(text || "").slice(0, 500).trim();
  if (!text) return res.status(400).json({ ok: false, error: "empty" });
  const msg = { name, text, time: Date.now() };
  chatHistory.push(msg);
  if (chatHistory.length > CHAT_MAX) chatHistory.shift();
  res.json({ ok: true });
});

// ── ai chat ───────────────────────────────────────────────────────────────
const GROQ_MODEL = "openai/gpt-oss-120b";
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const sandboxes = new Map();
const SANDBOX_TTL_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of sandboxes) if (now - entry.createdAt > SANDBOX_TTL_MS) sandboxes.delete(id);
}, 5 * 60 * 1000);

app.get("/api/sandbox/:id", (req, res) => {
  const entry = sandboxes.get(req.params.id);
  if (!entry) return res.status(404).send("this preview has expired — ask the ai to run it again");
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.send(entry.html);
});

async function safeFetchText(target, maxBytes = 250000) {
  let parsed;
  try { parsed = new URL(target); } catch { throw new Error("invalid url"); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("invalid protocol");
  if (isBlockedHost(parsed.hostname) || (await resolvesToBlocked(parsed.hostname))) throw new Error("that host can't be fetched");
  const r = await fetch(target, { headers: { "user-agent": BROWSER_UA }, redirect: "follow", signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`upstream returned ${r.status}`);
  const buf = await r.arrayBuffer();
  return Buffer.from(buf.slice(0, maxBytes)).toString("utf8");
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchWeb(query) {
  const html = await safeFetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
  const linkRe = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  const results = [];
  let m;
  while ((m = linkRe.exec(html)) && results.length < 6) {
    const uddg = m[1].match(/[?&]uddg=([^&]+)/);
    const url = uddg ? decodeURIComponent(uddg[1]) : m[1];
    results.push({ url, title: htmlToText(m[2]), snippet: "" });
  }
  let i = 0;
  while ((m = snippetRe.exec(html)) && i < results.length) {
    results[i].snippet = htmlToText(m[1]);
    i++;
  }
  return results;
}

async function readPage(url) {
  const html = await safeFetchText(url);
  return htmlToText(html).slice(0, 6000);
}

const AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Search the live web for current information (news, facts, prices, anything after your training data). Returns a list of results with title, url, and snippet.",
      parameters: { type: "object", properties: { query: { type: "string", description: "the search query" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "read_page",
      description: "Fetch a specific URL and return its visible text content, to answer questions about that exact page.",
      parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
    },
  },
  {
    type: "function",
    function: {
      name: "open_url",
      description: "Open or navigate the live browser panel next to the chat to a URL, so the user can see and interact with the page themselves. Use this whenever the user asks you to open, show, browse to, or go to a site or a search result — including navigating the panel somewhere new if it's already open.",
      parameters: { type: "object", properties: { url: { type: "string" }, title: { type: "string", description: "short label for the tab" } }, required: ["url"] },
    },
  },
  {
    type: "function",
    function: {
      name: "scroll_browser",
      description: "Scroll the page currently open in the browser panel, up or down.",
      parameters: {
        type: "object",
        properties: {
          direction: { type: "string", enum: ["up", "down"] },
          amount: { type: "number", description: "pixels to scroll, default 600" },
        },
        required: ["direction"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "click_browser",
      description: "Click a link or button on the page currently open in the browser panel, matched by its visible text.",
      parameters: { type: "object", properties: { text: { type: "string", description: "visible text of the element to click" } }, required: ["text"] },
    },
  },
  {
    type: "function",
    function: {
      name: "go_back_browser",
      description: "Go back to the previous page in the browser panel's history.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "close_browser",
      description: "Close the browser panel next to the chat.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "run_code",
      description: "Write a complete, self-contained HTML page (with inline <style> and <script> as needed) and run it live in the browser panel next to the chat, like a code sandbox/preview. Use this whenever the user asks you to build, code, or show a demo of a website, game, animation, or any visual/interactive thing.",
      parameters: {
        type: "object",
        properties: {
          html: { type: "string", description: "a complete HTML document, including <style> and <script> tags inline" },
          title: { type: "string", description: "short label for the tab" },
        },
        required: ["html"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate_view",
      description: "Navigate velcro itself (not the browser panel) to a different section of the site. Use this whenever the user asks to go to, open, or switch to a page like games, apps, movies, cloud gaming, chat, their account, or settings.",
      parameters: {
        type: "object",
        properties: { view: { type: "string", enum: ["home", "games", "apps", "movies", "cloudgaming", "chat", "account", "settings"] } },
        required: ["view"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_library",
      description: "Navigate to velcro's games, apps, or movies page with a search already applied, so the user sees matching results immediately. Use this whenever they ask to find or search for a game/app/movie.",
      parameters: {
        type: "object",
        properties: {
          view: { type: "string", enum: ["games", "apps", "movies"] },
          query: { type: "string", description: "what to search for" },
        },
        required: ["view", "query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "launch_game",
      description: "Find a game in velcro's library by name and launch it directly, skipping the games page entirely. Use this whenever the user asks to play a specific game by name.",
      parameters: { type: "object", properties: { name: { type: "string", description: "the game's name, doesn't need to be exact" } }, required: ["name"] },
    },
  },
  {
    type: "function",
    function: {
      name: "set_theme",
      description: "Change velcro's color theme to a custom background/accent color pair the user asks for (e.g. \"make it blue\", \"purple theme\"). Colors must be hex codes.",
      parameters: {
        type: "object",
        properties: {
          background: { type: "string", description: "hex color for the background, e.g. #1a1a2e" },
          accent: { type: "string", description: "hex color for the accent, e.g. #e94560" },
        },
        required: ["background", "accent"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_wallpaper",
      description: "Change velcro's background wallpaper. Use one of the preset names, or \"none\" to clear it.",
      parameters: {
        type: "object",
        properties: { style: { type: "string", enum: ["none", "aurora", "sunset", "citrus", "candy", "dusk", "grape"] } },
        required: ["style"],
      },
    },
  },
];

const CLIENT_ACTION_TOOLS = new Set([
  "open_url", "scroll_browser", "click_browser", "go_back_browser", "close_browser",
  "navigate_view", "search_library", "launch_game", "set_theme", "set_wallpaper",
]);

function toolStatusLabel(name, args) {
  const host = (u) => { try { return new URL(u).hostname; } catch { return u; } };
  switch (name) {
    case "search_web": return `Searching the web for "${args.query}"`;
    case "read_page": return `Reading ${host(args.url)}`;
    case "open_url": return `Opening ${host(args.url)}`;
    case "scroll_browser": return "Scrolling the page";
    case "click_browser": return `Clicking "${args.text}"`;
    case "go_back_browser": return "Going back";
    case "close_browser": return "Closing the browser panel";
    case "run_code": return "Writing and running the code";
    case "navigate_view": return `Opening ${args.view}`;
    case "search_library": return `Searching ${args.view} for "${args.query}"`;
    case "launch_game": return `Launching ${args.name}`;
    case "set_theme": return "Changing the theme";
    case "set_wallpaper": return "Changing the wallpaper";
    default: return "Working";
  }
}

async function runTool(name, args) {
  if (name === "search_web") return JSON.stringify(await searchWeb(String(args.query || "")));
  if (name === "read_page") return JSON.stringify({ url: args.url, text: await readPage(String(args.url || "")) });
  if (name === "run_code") {
    const id = crypto.randomUUID();
    sandboxes.set(id, { html: String(args.html || "").slice(0, 300000), createdAt: Date.now() });
    return JSON.stringify({ ran: true, url: `/api/sandbox/${id}` });
  }
  if (CLIENT_ACTION_TOOLS.has(name)) return JSON.stringify({ queued: true, action: name, ...args });
  return JSON.stringify({ error: "unknown tool" });
}

async function callGroq(messages, useTools) {
  const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      ...(useTools ? { tools: AI_TOOLS, tool_choice: "auto" } : {}),
    }),
  });
  const data = await upstream.json();
  if (!upstream.ok) throw new Error(data?.error?.message || "ai request failed");
  return data.choices[0].message;
}

const AI_SYSTEM_PROMPT =
  "You are the ai assistant built into velcro. You can call search_web to look up current information, " +
  "read_page to read a specific URL's content, open_url to open or navigate the browser panel next to the " +
  "chat, scroll_browser/click_browser/go_back_browser/close_browser to actually control that panel for " +
  "the user (scroll it, click things in it, go back, or close it) whenever they ask you to, and run_code to " +
  "write a complete HTML/CSS/JS page and instantly run it live in that same browser panel — use run_code " +
  "whenever asked to build, code, or demo something visual or interactive. If the user already has a page " +
  "open in the panel, its current text is given to you below as context — use it to answer questions about " +
  "that page without needing to fetch it again. " +
  "You also control velcro itself, not just the browser panel: navigate_view switches the site to a " +
  "different page (games, apps, movies, cloud gaming, chat, account, settings, home), search_library jumps " +
  "to games/apps/movies with a search already applied, launch_game finds a game by name and starts it " +
  "immediately, and set_theme/set_wallpaper change the site's look. Use these whenever the user asks to go " +
  "somewhere, find or play something, or change how velcro looks — don't just describe how to do it, do it. " +
  "Keep answers well-formatted with markdown and LaTeX ($...$ or \\(...\\)) for any math.";

// The jsdelivr-hosted build of the standalone site (embedded via SVG
// foreignObject, no server of its own) calls back into these two routes
// cross-origin from https://cdn.jsdelivr.net — allow just that origin
// rather than "*", since these do read/write per-request session cookies.
const CDN_ORIGIN = "https://cdn.jsdelivr.net";
function allowCdnCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", CDN_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
}
app.options("/api/ai/chat", (req, res) => { allowCdnCors(req, res); res.sendStatus(204); });
app.options("/api/cookie-fetch", (req, res) => { allowCdnCors(req, res); res.sendStatus(204); });

app.post("/api/ai/chat", async (req, res) => {
  allowCdnCors(req, res);
  const messages = req.body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array required" });
  }
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "ai is not configured on this server" });
  }
  const trimmed = messages
    .slice(-30)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (trimmed.length === 0) return res.status(400).json({ error: "no valid messages" });

  const convo = [{ role: "system", content: AI_SYSTEM_PROMPT }];
  const pageContext = req.body?.pageContext;
  if (pageContext?.url && typeof pageContext.text === "string") {
    convo.push({
      role: "system",
      content: `The browser panel currently has this page open — url: ${String(pageContext.url).slice(0, 300)}\n\nPage text:\n${pageContext.text.slice(0, 4000)}`,
    });
  }
  convo.push(...trimmed);

  const actions = [];
  res.setHeader("content-type", "application/x-ndjson");

  function emit(evt) {
    res.write(JSON.stringify(evt) + "\n");
  }

  try {
    for (let round = 0; round < 4; round++) {
      const message = await callGroq(convo, true);
      convo.push(message);

      if (!message.tool_calls || message.tool_calls.length === 0) {
        emit({ type: "final", reply: message.content || "", actions });
        return res.end();
      }

      for (const call of message.tool_calls) {
        let args = {};
        try { args = JSON.parse(call.function.arguments || "{}"); } catch {}
        emit({ type: "status", label: toolStatusLabel(call.function.name, args) });
        let result;
        try {
          result = await runTool(call.function.name, args);
        } catch (err) {
          result = JSON.stringify({ error: err.message });
        }
        if (CLIENT_ACTION_TOOLS.has(call.function.name)) {
          actions.push({ type: call.function.name, ...args });
        } else if (call.function.name === "run_code") {
          let parsed = {};
          try { parsed = JSON.parse(result); } catch {}
          if (parsed.url) actions.push({ type: "open_url", url: parsed.url, title: args.title || "code preview", sandboxed: true });
        }
        convo.push({ role: "tool", tool_call_id: call.id, content: result });
      }
    }
    const final = await callGroq(convo, false);
    emit({ type: "final", reply: final.content || "", actions });
    res.end();
  } catch (err) {
    emit({ type: "error", error: err.message || "ai request failed" });
    res.end();
  }
});

// ── accounts ──────────────────────────────────────────────────────────────
function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    favorites: JSON.parse(row.favorites),
    recents: JSON.parse(row.recents),
    settings: JSON.parse(row.settings),
  };
}

app.post("/auth/signup", async (req, res) => {
  const { email, username, password } = req.body || {};
  if (!email || !username || !password) return res.status(400).json({ error: "all fields required" });
  if (username.trim().length > 24) return res.status(400).json({ error: "username must be 24 characters or fewer" });
  if (password.length < 6) return res.status(400).json({ error: "password must be at least 6 characters" });
  try {
    const hash = await bcrypt.hash(password, 10);
    const info = db
      .prepare("INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)")
      .run(email.toLowerCase().trim(), username.trim(), hash);
    const token = jwt.sign({ id: info.lastInsertRowid, username: username.trim() }, SECRET, { expiresIn: "30d" });
    res.json({ token, username: username.trim() });
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) return res.status(400).json({ error: "email already in use" });
    res.status(500).json({ error: "server error" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "all fields required" });
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email).toLowerCase().trim());
  if (!user) return res.status(401).json({ error: "invalid email or password" });
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: "invalid email or password" });
  const token = jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: "30d" });
  res.json({ token, username: user.username });
});

app.get("/auth/me", auth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "not found" });
  res.json(publicUser(user));
});

app.put("/api/sync", auth, (req, res) => {
  const { favorites, recents, settings } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "not found" });
  db.prepare("UPDATE users SET favorites = ?, recents = ?, settings = ? WHERE id = ?").run(
    JSON.stringify(favorites ?? JSON.parse(user.favorites)),
    JSON.stringify(recents ?? JSON.parse(user.recents)),
    JSON.stringify(settings ?? JSON.parse(user.settings)),
    req.user.id
  );
  res.json({ ok: true });
});

// ── trending ──────────────────────────────────────────────────────────────
const TRENDING_WINDOW_MS = 24 * 60 * 60 * 1000;
const PLAYS_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const insertPlay = db.prepare("INSERT INTO plays (id, time) VALUES (?, ?)");
const prunePlays = db.prepare("DELETE FROM plays WHERE time < ?");
const trendingQuery = db.prepare(
  "SELECT id, COUNT(*) as plays FROM plays WHERE time > ? GROUP BY id ORDER BY plays DESC LIMIT ?"
);

setInterval(() => prunePlays.run(Date.now() - PLAYS_RETENTION_MS), 60 * 60 * 1000);

app.post("/api/plays", (req, res) => {
  const id = String(req.body?.id || "").slice(0, 200);
  if (!id) return res.status(400).json({ ok: false });
  insertPlay.run(id, Date.now());
  res.json({ ok: true });
});

app.get("/api/trending", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const rows = trendingQuery.all(Date.now() - TRENDING_WINDOW_MS, limit);
  res.json({ ok: true, games: rows });
});

const reportCounts = new Map();
const REPORT_WEBHOOK = process.env.REPORT_WEBHOOK || "";
setInterval(() => reportCounts.clear(), 10 * 60 * 1000);

app.post("/api/report", (req, res) => {
  const id = String(req.body?.id || "").slice(0, 120);
  const title = String(req.body?.title || "").slice(0, 200);
  const url = String(req.body?.url || "").slice(0, 500);
  if (!id && !title) return res.status(400).json({ ok: false });
  const key = id || title;
  const n = (reportCounts.get(key) || 0) + 1;
  reportCounts.set(key, n);
  if (n <= 5) {
    console.log(`[report] broken game: ${title || id} ${url}`);
    if (REPORT_WEBHOOK) {
      fetch(REPORT_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `broken game reported: **${title || id}** ${url}` })
      }).catch(() => {});
    }
  }
  res.json({ ok: true });
});

function v4ToInt(ip) {
  const p = ip.split(".");
  return ((+p[0] << 24) >>> 0) + (+p[1] << 16) + (+p[2] << 8) + +p[3];
}

function isPrivateV4(ip) {
  const n = v4ToInt(ip);
  const inRange = (base, bits) => (n >>> (32 - bits)) === (v4ToInt(base) >>> (32 - bits));
  return (
    inRange("0.0.0.0", 8) ||        // "this host"
    inRange("10.0.0.0", 8) ||       // private
    inRange("100.64.0.0", 10) ||    // carrier-grade NAT / tailscale
    inRange("127.0.0.0", 8) ||      // loopback
    inRange("169.254.0.0", 16) ||   // link-local + cloud metadata (169.254.169.254)
    inRange("172.16.0.0", 12) ||    // private
    inRange("192.0.0.0", 24) ||     // IETF protocol assignments
    inRange("192.168.0.0", 16) ||   // private
    inRange("198.18.0.0", 15) ||    // benchmarking
    inRange("224.0.0.0", 4) ||      // multicast
    inRange("240.0.0.0", 4)         // reserved / broadcast
  );
}

function isPrivateV6(ip) {
  const s = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (s === "::1" || s === "::") return true;
  const m = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (m) return isPrivateV4(m[1]);
  const head = s.split(":")[0] || "";
  return (
    /^f[cd]/.test(head) ||          // fc00::/7 unique local
    /^fe[89ab]/.test(head) ||       // fe80::/10 link-local
    /^ff/.test(head)                // ff00::/8 multicast
  );
}

function isBlockedHost(hostname) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "metadata.google.internal") return true;
  const v = isIP(h);
  if (v === 4) return isPrivateV4(h);
  if (v === 6) return isPrivateV6(h);
  return false;
}

async function resolvesToBlocked(hostname) {
  const h = hostname.replace(/^\[|\]$/g, "");
  if (isIP(h)) return false;
  try {
    const addrs = await lookup(h, { all: true });
    return addrs.some((a) => (a.family === 4 ? isPrivateV4(a.address) : isPrivateV6(a.address)));
  } catch {
    return true;
  }
}

async function fetchProxy(target, req, res, depth = 0) {
  if (depth > 3) return res.status(508).end();

  let parsed;
  try { parsed = new URL(target); } catch { return res.status(400).end(); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return res.status(400).end();

  if (isBlockedHost(parsed.hostname) || (await resolvesToBlocked(parsed.hostname))) {
    return res.status(403).end();
  }

  const getter = parsed.protocol === "http:" ? httpGet : httpsGet;
  const upstream = getter(
    target,
    { headers: { "user-agent": "Mozilla/5.0" }, timeout: 15000 },
    (r) => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location) {
        r.resume();
        fetchProxy(new URL(r.headers.location, target).href, req, res, depth + 1).catch(() => {
          if (!res.headersSent) res.status(502).end();
        });
        return;
      }
      res.status(r.statusCode || 200);
      if (r.headers["content-type"]) res.setHeader("content-type", r.headers["content-type"]);
      res.setHeader("x-content-type-options", "nosniff");
      res.setHeader("access-control-allow-origin", "*");
      r.pipe(res);
    }
  );
  upstream.on("timeout", () => upstream.destroy(new Error("upstream timeout")));
  upstream.on("error", () => { if (!res.headersSent) res.status(502).end(); });
}

app.get("/api/fetch", (req, res) => {
  const target = String(req.query.url || "");
  if (!target) return res.status(400).end();
  fetchProxy(target, req, res).catch(() => { if (!res.headersSent) res.status(502).end(); });
});

// libcurl.js (the WASM client the browser-tab proxy tunnels through) never
// surfaces Set-Cookie anywhere — not via its fetch() Headers, not via its
// own advertised cookie-jar option (confirmed by direct testing, not just
// reading its docs). Sites like nowgg.fun that set a session cookie on one
// page and require it again after a same-JS redirect break under that as a
// result. Real Node http/https requests don't have that limitation, so this
// gives the client a way to do specific fetches through here instead, with
// the client itself tracking the accumulated Cookie header across calls
// (kept stateless here — no server-side session to lose track of).
const COOKIE_FETCH_MAX_BYTES = 20 * 1024 * 1024;

function mergeCookieHeader(existing, setCookies) {
  const jar = new Map();
  if (existing) {
    for (const pair of existing.split(";")) {
      const eq = pair.indexOf("=");
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  for (const sc of setCookies) {
    const nameValue = sc.split(";")[0];
    const eq = nameValue.indexOf("=");
    if (eq > 0) jar.set(nameValue.slice(0, eq).trim(), nameValue.slice(eq + 1).trim());
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function cookieProxyFetch(target, cookieHeader, depth = 0, opts = {}) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error("too many redirects"));
    let parsed;
    try { parsed = new URL(target); } catch { return reject(new Error("invalid url")); }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return reject(new Error("invalid protocol"));

    const method = (opts.method || "GET").toUpperCase();
    const reqBody = typeof opts.body === "string" ? opts.body : undefined;

    const proceed = async () => {
      if (isBlockedHost(parsed.hostname) || (await resolvesToBlocked(parsed.hostname))) {
        return reject(new Error("that host can't be fetched"));
      }
      const requester = parsed.protocol === "http:" ? httpRequest : httpsRequest;
      const headers = { "user-agent": BROWSER_UA, ...(opts.headers || {}) };
      if (cookieHeader) headers.cookie = cookieHeader;
      if (reqBody !== undefined) headers["content-length"] = Buffer.byteLength(reqBody);
      const upstream = requester(target, { method, headers, timeout: 15000 }, (r) => {
        const setCookies = r.headers["set-cookie"] || [];
        // only GET redirects get auto-followed here — a POST redirect should
        // resolve back to the client's own fetch() caller to decide, same as
        // real browser fetch() behavior with redirect:"follow" on POST is
        // itself inconsistent across specs; simplest correct behavior for
        // our case is to just follow it as a GET, which covers the common
        // "redirect to a canonical resource" pattern these APIs use.
        if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location) {
          r.resume();
          const nextCookie = mergeCookieHeader(cookieHeader, setCookies);
          const nextOpts = r.statusCode === 307 || r.statusCode === 308 ? opts : {};
          cookieProxyFetch(new URL(r.headers.location, target).href, nextCookie, depth + 1, nextOpts)
            .then((result) => resolve({ ...result, setCookies: [...setCookies, ...result.setCookies] }))
            .catch(reject);
          return;
        }
        const chunks = [];
        let total = 0;
        r.on("data", (c) => {
          total += c.length;
          if (total > COOKIE_FETCH_MAX_BYTES) { upstream.destroy(new Error("response too large")); return; }
          chunks.push(c);
        });
        r.on("end", () => {
          resolve({
            status: r.statusCode || 200,
            finalUrl: target,
            contentType: r.headers["content-type"] || "",
            body: Buffer.concat(chunks),
            setCookies,
          });
        });
      });
      upstream.on("timeout", () => upstream.destroy(new Error("upstream timeout")));
      upstream.on("error", reject);
      if (reqBody !== undefined) upstream.end(reqBody); else upstream.end();
    };
    proceed();
  });
}

app.post("/api/cookie-fetch", async (req, res) => {
  allowCdnCors(req, res);
  const target = String(req.body?.url || "");
  const cookie = String(req.body?.cookie || "").slice(0, 8000);
  const method = String(req.body?.method || "GET").slice(0, 10);
  const body = typeof req.body?.body === "string" ? req.body.body.slice(0, COOKIE_FETCH_MAX_BYTES) : undefined;
  const headers = {};
  if (req.body?.headers && typeof req.body.headers === "object") {
    for (const [k, v] of Object.entries(req.body.headers)) {
      const lk = k.toLowerCase();
      if (lk === "host" || lk === "cookie" || lk === "content-length") continue;
      if (typeof v === "string") headers[lk] = v.slice(0, 2000);
    }
  }
  if (!target) return res.status(400).json({ error: "url required" });
  try {
    const result = await cookieProxyFetch(target, cookie, 0, { method, headers, body });
    res.json({
      status: result.status,
      finalUrl: result.finalUrl,
      contentType: result.contentType,
      bodyBase64: result.body.toString("base64"),
      setCookies: result.setCookies,
    });
  } catch (e) {
    res.status(502).json({ error: e.message || "fetch failed" });
  }
});

app.use(express.static(join(__dirname, "public")));

if (!IS_SERVERLESS) {
  const server = createServer(app);

  server.on("upgrade", (req, socket, head) => {
    if (req.url.startsWith("/wisp/")) {
      wispServer.routeRequest(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  server.listen(PORT, () => {
    console.log(`velcro running at http://localhost:${PORT}`);
  });
}

export default app;
