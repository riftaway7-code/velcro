const urlBar = document.getElementById("urlBar");
const goBtn = document.getElementById("goBtn");
const backBtn = document.getElementById("backBtn");
const forwardBtn = document.getElementById("forwardBtn");
const reloadBtn = document.getElementById("reloadBtn");
const proxyFrame = document.getElementById("proxyFrame");
const browserContent = document.getElementById("browserContent");
const loadingBar = document.getElementById("loadingBar");
const navLoading = document.getElementById("navLoading");
const navLoadingMsg = document.getElementById("navLoadingMsg");
const browserStart = document.querySelector(".browser-start");

const LOADING_MSGS = [
  "loading the loading...",
  "if this takes more than 1 minute u should probably refresh",
  "the wifi might be cooked",
  "its loading i promise",
  "certified loading moment",
  "almost there (no promises)",
  "buffering... buffering...",
  "one sec the server is on break",
];

let msgInterval = null;

function showNavLoading() {
  navLoadingMsg.textContent = LOADING_MSGS[Math.floor(Math.random() * LOADING_MSGS.length)];
  navLoading.classList.remove("hidden");
  msgInterval = setInterval(() => {
    navLoadingMsg.textContent = LOADING_MSGS[Math.floor(Math.random() * LOADING_MSGS.length)];
  }, 2500);
}

function hideNavLoading() {
  clearInterval(msgInterval);
  navLoading.classList.add("hidden");
}

let ready = false;
let pendingUrl = null;
let codec = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function waitForActivation(reg) {
  if (reg.active) return;
  const sw = reg.installing || reg.waiting;
  if (!sw) return;
  await new Promise((resolve) => {
    sw.addEventListener("statechange", function handler() {
      if (this.state === "activated") { this.removeEventListener("statechange", handler); resolve(); }
    });
  });
}

async function initScramjet() {
  const customWisp = localStorage.getItem("velcro_wisp_server");
  const localWisp = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/wisp/`;
  const hasLocalWisp = await fetch("/api/wisp-available").then(r => r.ok).catch(() => false);
  const WISP = customWisp || (hasLocalWisp ? localWisp : "wss://anura.pro/wisp/");

  const { ScramjetController } = await import("/scramjet/scramjet.bundle.js");
  const { BareMuxConnection } = await import("/bare-mux/index.mjs");

  const controller = new ScramjetController({
    prefix: "/scramjet/",
    files: {
      wasm: "/scramjet/scramjet.wasm.wasm",
      all: "/scramjet/scramjet.all.js",
      sync: "/scramjet/scramjet.sync.js",
    },
  });

  const existing = await navigator.serviceWorker.getRegistrations();
  await Promise.all(existing.map((r) => r.unregister()));
  if (existing.length > 0) await new Promise((r) => setTimeout(r, 600));

  await controller.init();
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/scramjet/" });
  await waitForActivation(reg);

  const conn = new BareMuxConnection("/bare-mux/worker.js");
  await conn.setTransport("/epoxy/index.mjs", [{ wisp: WISP }]);

  codec = {
    encodeUrl: (url) => controller.encodeUrl(url),
    decodeUrl: (url) => controller.decodeUrl(url),
  };
}

async function initUv() {
  const customWisp = localStorage.getItem("velcro_wisp_server");
  const localWisp = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/wisp/`;
  const hasLocalWisp = await fetch("/api/wisp-available").then(r => r.ok).catch(() => false);
  const WISP = customWisp || (hasLocalWisp ? localWisp : "wss://anura.pro/wisp/");

  await loadScript("/uv/uv.bundle.js");
  await loadScript("/uv/uv.config.js");
  const { BareMuxConnection } = await import("/bare-mux/index.mjs");

  const existing = await navigator.serviceWorker.getRegistrations();
  await Promise.all(existing.map((r) => r.unregister()));
  if (existing.length > 0) await new Promise((r) => setTimeout(r, 600));
  const reg = await navigator.serviceWorker.register("/uv/sw.js", { scope: "/uv/" });
  await waitForActivation(reg);

  const conn = new BareMuxConnection("/bare-mux/worker.js");
  await conn.setTransport("/epoxy/index.mjs", [{ wisp: WISP }]);

  const cfg = self.__uv$config;
  codec = {
    encodeUrl: (url) => cfg.prefix + cfg.encodeUrl(url),
    decodeUrl: (encoded) => {
      try {
        const path = new URL(encoded).pathname;
        return cfg.decodeUrl(path.slice(cfg.prefix.length));
      } catch { return encoded; }
    },
  };
}

async function initProxy() {
  if (!("serviceWorker" in navigator)) {
    document.getElementById("browserBlocked").classList.remove("hidden");
    return;
  }

  try {
    const engine = localStorage.getItem("velcro_proxy_engine") || "scramjet";
    if (engine === "uv") await initUv();
    else await initScramjet();

    ready = true;

    if (pendingUrl) {
      navigate(pendingUrl);
      pendingUrl = null;
    }
  } catch (err) {
    console.error("Proxy init failed:", err);
    document.getElementById("browserBlocked").classList.remove("hidden");
  }
}

function resolveUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes(".") && !trimmed.includes(" ")) return `https://${trimmed}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
}

function navigate(url) {
  if (!ready) { pendingUrl = url; return; }

  const encoded = codec.encodeUrl(url);
  urlBar.value = url;
  showLoadingBar();
  showNavLoading();

  browserStart.style.display = "none";
  proxyFrame.classList.remove("hidden");
  proxyFrame.src = encoded;
}

function showLoadingBar() {
  loadingBar.style.width = "0";
  loadingBar.style.transition = "none";
  requestAnimationFrame(() => {
    loadingBar.style.transition = "width 0.8s ease";
    loadingBar.style.width = "85%";
  });
}

function finishLoadingBar() {
  loadingBar.style.width = "100%";
  setTimeout(() => { loadingBar.style.width = "0"; }, 400);
}

goBtn.addEventListener("click", () => {
  const url = resolveUrl(urlBar.value);
  if (url) navigate(url);
});

urlBar.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const url = resolveUrl(urlBar.value);
    if (url) navigate(url);
  }
});

backBtn.addEventListener("click", () => {
  try { proxyFrame.contentWindow?.history.back(); } catch {}
});

forwardBtn.addEventListener("click", () => {
  try { proxyFrame.contentWindow?.history.forward(); } catch {}
});

reloadBtn.addEventListener("click", () => {
  if (!proxyFrame.classList.contains("hidden")) {
    showLoadingBar();
    proxyFrame.contentWindow?.location.reload();
  }
});

proxyFrame.addEventListener("load", () => {
  finishLoadingBar();
  hideNavLoading();
  try {
    const frameUrl = proxyFrame.contentWindow?.location.href;
    if (frameUrl && frameUrl !== "about:blank") {
      urlBar.value = codec.decodeUrl(frameUrl) || frameUrl;
    }
    const title = proxyFrame.contentDocument?.title;
    if (title) document.title = `${title} — velcro`;
  } catch {}
});

document.querySelectorAll(".quick-link").forEach((btn) => {
  btn.addEventListener("click", () => navigate(btn.dataset.url));
});

initProxy();
