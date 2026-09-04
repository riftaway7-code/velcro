import express from "express";
import { createServer, get as httpGet } from "http";
import { get as httpsGet } from "https";
import { isIP } from "net";
import { lookup } from "dns/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { server as wispServer } from "@mercuryworkshop/wisp-js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "./db.js";
import { auth, SECRET } from "./auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
