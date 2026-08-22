importScripts("/scramjet/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

const STATIC = [
  "/scramjet/scramjet.all.js",
  "/scramjet/scramjet.bundle.js",
  "/scramjet/scramjet.sync.js",
  "/scramjet/scramjet.wasm.wasm",
  "/bare-mux/worker.js",
  "/bare-mux/index.mjs",
  "/bare-mux/index.js",
  "/epoxy/index.mjs",
  "/epoxy/index.js",
];

async function handleRequest(event) {
  const url = new URL(event.request.url);

  if (STATIC.includes(url.pathname) || !url.pathname.startsWith("/scramjet/")) {
    return fetch(event.request);
  }

  const decoded = decodeURIComponent(url.pathname.slice("/scramjet/".length));

  if (decoded.startsWith("data:")) {
    return fetch(decoded);
  }

  if (decoded.startsWith("blob:")) {
    try { return await fetch(decoded); } catch { return fetch(event.request); }
  }

  if (/\.wasm(\?|#|$)/.test(decoded)) {
    return fetch(`/api/fetch?url=${encodeURIComponent(decoded)}`);
  }

  await scramjet.loadConfig();
  if (scramjet.route(event)) {
    return scramjet.fetch(event);
  }
  return fetch(event.request);
}

self.addEventListener("fetch", (e) => {
  e.respondWith(handleRequest(e));
});
