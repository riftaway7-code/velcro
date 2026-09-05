(function () {
  const messagesEl = document.getElementById("chatMessages");
  const input = document.getElementById("chatTextInput");
  const sendBtn = document.getElementById("chatSendBtn");
  const newChatBtn = document.getElementById("aiNewChat");

  const browserPane = document.getElementById("aiBrowserPane");
  const browserFrame = document.getElementById("aiBrowserFrame");
  const browserLoader = document.getElementById("aiBrowserLoader");
  const browserTitle = document.getElementById("aiBrowserTitle");
  const browserClose = document.getElementById("aiBrowserClose");
  const browserOpenTab = document.getElementById("aiBrowserOpenTab");

  let codec = null;
  let proxyReady = false;
  let proxyInitPromise = null;
  let currentBrowserUrl = "";

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
    if (proxyInitPromise) return proxyInitPromise;
    proxyInitPromise = (async () => {
      const customWisp = localStorage.getItem("velcro_wisp_server");
      const localWisp = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/wisp/`;
      const hasLocalWisp = await fetch("/api/wisp-available").then((r) => r.ok).catch(() => false);
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
      codec = { encodeUrl: (url) => controller.encodeUrl(url) };
      proxyReady = true;
    })();
    return proxyInitPromise;
  }

  browserFrame.addEventListener("load", () => {
    if (browserFrame.src) browserLoader.classList.add("gone");
  });

  function closeBrowser() {
    browserPane.classList.remove("open");
    browserFrame.src = "about:blank";
    currentBrowserUrl = "";
  }

  browserClose.addEventListener("click", closeBrowser);

  browserOpenTab.addEventListener("click", () => {
    if (currentBrowserUrl) window.open(currentBrowserUrl, "_blank", "noopener");
  });

  async function openInSidebar(url, title, opts) {
    currentBrowserUrl = url;
    browserTitle.textContent = title || url;
    browserPane.classList.add("open");
    browserLoader.classList.remove("gone");

    if (opts?.sandboxed) browserFrame.setAttribute("sandbox", "allow-scripts allow-forms");
    else browserFrame.removeAttribute("sandbox");

    const isLocal = url.startsWith(location.origin + "/") || url.startsWith("/");
    if (isLocal) { browserFrame.src = url; return; }

    if (!proxyReady) await initScramjet().catch(() => {});
    if (proxyReady) browserFrame.src = codec.encodeUrl(url);
    else browserFrame.src = url;
  }

  function scrollBrowser(direction, amount) {
    try {
      browserFrame.contentWindow.scrollBy({
        top: direction === "up" ? -(amount || 600) : (amount || 600),
        behavior: "smooth",
      });
    } catch {}
  }

  function clickBrowser(text) {
    try {
      const doc = browserFrame.contentDocument;
      if (!doc) return;
      const lower = String(text || "").trim().toLowerCase();
      const candidates = doc.querySelectorAll("a,button,input[type=submit],input[type=button],[role=button],summary");
      for (const el of candidates) {
        const t = (el.innerText || el.value || el.getAttribute("aria-label") || "").trim().toLowerCase();
        if (t && t.includes(lower)) { el.click(); return; }
      }
    } catch {}
  }

  function goBackBrowser() {
    try { browserFrame.contentWindow.history.back(); } catch {}
  }

  async function applyAction(action) {
    if (action.type === "open_url") await openInSidebar(action.url, action.title, { sandboxed: !!action.sandboxed });
    else if (action.type === "scroll_browser") scrollBrowser(action.direction, action.amount);
    else if (action.type === "click_browser") clickBrowser(action.text);
    else if (action.type === "go_back_browser") goBackBrowser();
    else if (action.type === "close_browser") closeBrowser();
  }

  function getPageContext() {
    if (!browserPane.classList.contains("open") || !currentBrowserUrl) return null;
    try {
      const doc = browserFrame.contentDocument;
      const text = doc?.body?.innerText;
      if (!text) return null;
      return { url: currentBrowserUrl, text: text.slice(0, 4000) };
    } catch {
      return null;
    }
  }

  initScramjet();

  const STORAGE_KEY = "velcro_ai_history";
  let history = [];
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(saved)) history = saved;
  } catch {}

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch {}
  }

  function scrollToEnd() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderMarkdown(text) {
    const mathBlocks = [];
    const protectedText = text.replace(
      /\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|\$[^\n$]+?\$/g,
      (m) => { mathBlocks.push(m); return `@@MATH${mathBlocks.length - 1}@@`; }
    );
    let html = marked.parse(protectedText, { breaks: true });
    html = html.replace(/@@MATH(\d+)@@/g, (_, i) => mathBlocks[+i]);
    return DOMPurify.sanitize(html);
  }

  function renderMessage(role, text, rich) {
    const wrap = document.createElement("div");
    wrap.className = "chat-msg" + (role === "user" ? " mine" : "");
    const meta = document.createElement("div");
    meta.className = "chat-msg-meta";
    const name = document.createElement("span");
    name.className = "chat-msg-name";
    name.textContent = role === "user" ? "you" : "ai";
    meta.appendChild(name);
    const bubble = document.createElement("div");
    bubble.className = "chat-msg-text";
    if (rich && window.marked && window.DOMPurify) {
      bubble.classList.add("md");
      bubble.innerHTML = renderMarkdown(text);
      if (window.renderMathInElement) {
        renderMathInElement(bubble, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "\\[", right: "\\]", display: true },
            { left: "\\(", right: "\\)", display: false },
            { left: "$", right: "$", display: false },
          ],
          throwOnError: false,
        });
      }
    } else {
      bubble.textContent = text;
    }
    wrap.appendChild(meta);
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    scrollToEnd();
    return bubble;
  }

  function renderTyping() {
    const wrap = document.createElement("div");
    wrap.className = "chat-msg";
    wrap.id = "aiTypingMsg";
    const bubble = document.createElement("div");
    bubble.className = "chat-msg-text";
    bubble.innerHTML = '<span id="aiTypingLabel"></span><span class="ai-typing"><span></span><span></span><span></span></span>';
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    scrollToEnd();
  }

  function setTypingLabel(text) {
    const label = document.getElementById("aiTypingLabel");
    if (label) label.textContent = text ? text + "… " : "";
    scrollToEnd();
  }

  function removeTyping() {
    document.getElementById("aiTypingMsg")?.remove();
  }

  function renderHistory() {
    messagesEl.innerHTML = "";
    if (history.length === 0) {
      const sys = document.createElement("div");
      sys.className = "chat-sys";
      sys.textContent = "ask anything — this is one continuous conversation until you start a new chat";
      messagesEl.appendChild(sys);
      return;
    }
    for (const m of history) renderMessage(m.role, m.content, m.role === "assistant");
  }

  async function send() {
    const text = input.value.trim();
    if (!text || sendBtn.disabled) return;
    input.value = "";
    history.push({ role: "user", content: text });
    save();
    renderMessage("user", text);

    sendBtn.disabled = true;
    input.disabled = true;
    renderTyping();

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history, pageContext: getPageContext() }),
      });
      if (!res.ok || !res.body) {
        let errMsg = "request failed";
        try { errMsg = (await res.json())?.error || errMsg; } catch {}
        throw new Error(errMsg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let final = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (!line.trim()) continue;
          const evt = JSON.parse(line);
          if (evt.type === "status") setTypingLabel(evt.label);
          else if (evt.type === "final") final = evt;
          else if (evt.type === "error") throw new Error(evt.error);
        }
      }

      removeTyping();
      if (!final) throw new Error("no response from ai");
      history.push({ role: "assistant", content: final.reply });
      save();
      renderMessage("assistant", final.reply, true);
      for (const action of final.actions || []) {
        await applyAction(action);
        await new Promise((r) => setTimeout(r, 350));
      }
    } catch (err) {
      removeTyping();
      renderMessage("assistant", "something went wrong talking to the ai: " + (err?.message || err));
    } finally {
      sendBtn.disabled = false;
      input.disabled = false;
      input.focus();
    }
  }

  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });

  newChatBtn.addEventListener("click", () => {
    history = [];
    save();
    renderHistory();
  });

  renderHistory();
})();
