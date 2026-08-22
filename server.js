import express from "express";
import { createServer } from "http";
import { get as httpsGet } from "https";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { server as wispServer } from "@mercuryworkshop/wisp-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 4173;
const IS_SERVERLESS = !!process.env.VERCEL;

app.get("/api/wisp-available", (_, res) => res.json({ ok: !IS_SERVERLESS }));

function fetchProxy(target, req, res, depth = 0) {
  if (depth > 3) return res.status(502).end();
  let parsed;
  try { parsed = new URL(target); } catch { return res.status(400).end(); }
  const h = parsed.hostname;
  if (/^(localhost|::1|0\.0\.0\.0|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.)/.test(h) || h.endsWith(".local")) {
    return res.status(403).end();
  }
  httpsGet(target, { headers: { "user-agent": "Mozilla/5.0" } }, (r) => {
    if ([301, 302, 307, 308].includes(r.statusCode) && r.headers.location) {
      r.resume();
      return fetchProxy(new URL(r.headers.location, target).href, req, res, depth + 1);
    }
    res.status(r.statusCode || 200);
    if (r.headers["content-type"]) res.setHeader("content-type", r.headers["content-type"]);
    res.setHeader("access-control-allow-origin", "*");
    r.pipe(res);
  }).on("error", () => res.status(502).end());
}

app.get("/api/fetch", (req, res) => {
  const target = String(req.query.url || "");
  if (!target) return res.status(400).end();
  fetchProxy(target, req, res);
});

app.use(express.static(join(__dirname, "public")));

if (!IS_SERVERLESS) {
  const server = createServer(app);

  server.on("upgrade", (req, socket, head) => {
    if (req.url.startsWith("/wisp/")) {
      wispServer.routeRequest(req, socket, head);
    }
  });

  server.listen(PORT, () => {
    console.log(`velcro running at http://localhost:${PORT}`);
  });
}

export default app;
