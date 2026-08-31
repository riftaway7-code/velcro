// Minimal shell service worker — only here to satisfy PWA installability.
// It does NOT touch proxy traffic: anything but a top-level navigation is left
// entirely to the browser (no respondWith), and the proxy's own SW at
// /scramjet/ and /uv/ wins by scope anyway.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.mode !== "navigate") return;
  if (/^\/(scramjet|uv|wisp|epoxy|bare-mux|api)\//.test(u.pathname)) return;
  e.respondWith(fetch(e.request).catch(() => new Response("offline", { status: 503, headers: { "content-type": "text/plain" } })));
});
