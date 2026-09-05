const urlBar = document.getElementById("urlBar");
const goBtn = document.getElementById("goBtn");
const homeUrlBar = document.getElementById("homeUrlBar");
const homeGoBtn = document.getElementById("homeGoBtn");
const backBtn = document.getElementById("backBtn");
const forwardBtn = document.getElementById("forwardBtn");
const reloadBtn = document.getElementById("reloadBtn");
const proxyFrame = document.getElementById("proxyFrame");
const browserContent = document.getElementById("browserContent");
const loadingBar = document.getElementById("loadingBar");
const navLoading = document.getElementById("navLoading");
const navLoadingMsg = document.getElementById("navLoadingMsg");
const browserStart = document.querySelector(".browser-start");
const browserTopbar = document.getElementById("browserTopbar");

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
let currentUrl = "";
const navHistory = [];
let navIndex = -1;

async function initProxy() {
  try {
    await libcurlProxy.init();
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

async function navigate(url, opts) {
  if (!ready) { pendingUrl = url; return; }
  const fromHistory = opts && opts.fromHistory;

  urlBar.value = url;
  showLoadingBar();
  showNavLoading();

  browserStart.style.display = "none";
  browserTopbar.classList.remove("hidden");
  proxyFrame.classList.remove("hidden");

  try {
    const finalUrl = await libcurlProxy.navigate(
      proxyFrame,
      url,
      (msg) => { navLoadingMsg.textContent = msg; },
      onProxyNavigated
    );
    onProxyNavigated(finalUrl, fromHistory);
  } catch (err) {
    hideNavLoading();
    navLoadingMsg.textContent = "failed: " + err.message;
  }
}

function onProxyNavigated(finalUrl, fromHistory) {
  currentUrl = finalUrl;
  urlBar.value = finalUrl;
  if (!fromHistory) {
    navHistory.splice(navIndex + 1);
    navHistory.push(finalUrl);
    navIndex = navHistory.length - 1;
  }
  finishLoadingBar();
  hideNavLoading();
  const title = proxyFrame.contentDocument?.title;
  if (title) document.title = `${title} — velcro`;
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

if (homeUrlBar && homeGoBtn) {
  homeGoBtn.addEventListener("click", () => {
    const url = resolveUrl(homeUrlBar.value);
    if (url) navigate(url);
  });

  homeUrlBar.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const url = resolveUrl(homeUrlBar.value);
      if (url) navigate(url);
    }
  });
}

backBtn.addEventListener("click", () => {
  if (navIndex <= 0) return;
  navIndex--;
  navigate(navHistory[navIndex], { fromHistory: true });
});

forwardBtn.addEventListener("click", () => {
  if (navIndex >= navHistory.length - 1) return;
  navIndex++;
  navigate(navHistory[navIndex], { fromHistory: true });
});

reloadBtn.addEventListener("click", () => {
  if (currentUrl) navigate(currentUrl, { fromHistory: true });
});

document.querySelectorAll(".quick-link").forEach((btn) => {
  btn.addEventListener("click", () => navigate(btn.dataset.url));
});

// ?url= lets other pages (like cloud-gaming.html) deep-link straight into
// a proxied page instead of dropping the user on the blank address bar.
function sanitizeDeepLink(raw) {
  if (!raw) return null;
  const s = raw.trim();
  if (!/^https?:\/\//i.test(s)) return null;
  return s;
}
const deepLinkUrl = sanitizeDeepLink(new URLSearchParams(location.search).get("url"));
if (deepLinkUrl) {
  history.replaceState({}, "", "/");
  pendingUrl = deepLinkUrl;
}

initProxy();
