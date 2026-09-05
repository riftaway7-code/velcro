// Proxy engine backed by libcurl.js (WASM HTTP client tunneled over the WISP
// websocket protocol) instead of scramjet's service-worker interception.
// No service worker anywhere — works in contexts that block them (this is
// also why it's safe to test on the real site: it needs nothing scramjet
// doesn't already have, but proves out an engine that also works somewhere
// scramjet structurally can't, like Apps Script).
//
// Since there's no network-level interception, this module does the
// equivalent work at the DOM level: fetch the page, rewrite/inline its
// sub-resources, inject a bootstrap script that intercepts link clicks and
// form submits inside the proxied document, and re-run the same process for
// each navigation.

(function (global) {
  const WISP = "wss://anura.pro/wisp/";
  const LIBCURL_WASM = "https://cdn.jsdelivr.net/npm/libcurl.js@0.7.1/libcurl.wasm";

  let readyPromise = null;

  async function waitForLibcurlGlobal() {
    if (libcurl) return;
    // libcurl.js must be included as a genuine static <script> tag (it reads
    // document.currentScript to locate itself, which dynamically-inserted
    // scripts can't reliably provide) — poll briefly in case it's still
    // parsing/executing.
    for (let i = 0; i < 100; i++) {
      if (libcurl) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("libcurl.js global not found — is the <script src=\".../libcurl.js\"> tag present in the page's <head>?");
  }

  async function init() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      await waitForLibcurlGlobal();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("libcurl.js init timed out")), 20000);
        libcurl.onload = () => { clearTimeout(timeout); resolve(); };
        libcurl.load_wasm(LIBCURL_WASM);
      });
      libcurl.set_websocket(WISP);
    })();
    return readyPromise;
  }

  // libcurl.fetch() never surfaces Set-Cookie anywhere, confirmed directly
  // (not just via docs) — neither through its Headers object nor through
  // its own advertised cookie-jar option. Sites that set a session cookie
  // on one page and require it again after a redirect (nowgg.fun does this
  // for cloud gaming) break under that. Real Node http/https on the server
  // doesn't have that limitation, so requests to domains that need cookie
  // continuity go through /api/cookie-fetch instead, with the cookie jar
  // itself tracked here so the server route can stay stateless.
  const COOKIE_RELAY_HOSTS = [/(^|\.)nowgg\.fun$/i];
  const cookieJar = new Map(); // domain -> Map(name -> value)

  function needsCookieRelay(url) {
    let host;
    try { host = new URL(url).hostname; } catch { return false; }
    return COOKIE_RELAY_HOSTS.some((re) => re.test(host));
  }

  function cookieDomainKey(domain) {
    return domain.replace(/^\./, "").toLowerCase();
  }

  function storeSetCookie(setCookieStr, requestHostname) {
    const parts = setCookieStr.split(";").map((s) => s.trim());
    const nameValue = parts[0] || "";
    const eq = nameValue.indexOf("=");
    if (eq < 0) return;
    const name = nameValue.slice(0, eq).trim();
    const value = nameValue.slice(eq + 1).trim();
    let domain = requestHostname;
    for (const attr of parts.slice(1)) {
      const aEq = attr.indexOf("=");
      if (aEq < 0) continue;
      if (attr.slice(0, aEq).trim().toLowerCase() === "domain") domain = attr.slice(aEq + 1).trim();
    }
    const key = cookieDomainKey(domain);
    if (!cookieJar.has(key)) cookieJar.set(key, new Map());
    cookieJar.get(key).set(name, value);
  }

  function cookieHeaderFor(hostname) {
    const h = hostname.toLowerCase();
    const pairs = [];
    for (const [domain, map] of cookieJar) {
      if (h === domain || h.endsWith("." + domain)) {
        for (const [k, v] of map) pairs.push(`${k}=${v}`);
      }
    }
    return pairs.join("; ");
  }

  function base64ToBytes(b64) {
    const bin = atob(b64 || "");
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function cookieRelayFetch(url, params = {}) {
    const hostname = new URL(url).hostname;
    const cookie = cookieHeaderFor(hostname);
    const relayRes = await fetch("/api/cookie-fetch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url, cookie,
        method: params.method || "GET",
        headers: params.headers || {},
        body: typeof params.body === "string" ? params.body : undefined,
      }),
    });
    const data = await relayRes.json();
    if (!relayRes.ok) throw new Error(data.error || "cookie-fetch failed");
    for (const sc of data.setCookies || []) storeSetCookie(sc, hostname);
    const bytes = base64ToBytes(data.bodyBase64);
    return {
      url: data.finalUrl || url,
      status: data.status,
      ok: data.status >= 200 && data.status < 300,
      headers: { get: (name) => (name.toLowerCase() === "content-type" ? data.contentType : null) },
      text: async () => new TextDecoder().decode(bytes),
      arrayBuffer: async () => bytes.buffer,
    };
  }

  function doFetch(url, params) {
    return needsCookieRelay(url) ? cookieRelayFetch(url, params) : libcurl.fetch(url, params);
  }

  // Handles fetch() calls the proxied page's own JS makes at runtime (see
  // the bootstrap's window.fetch shim) — same doFetch() pipeline as page
  // loads, just returning a plain serializable payload over postMessage
  // instead of a real Response object.
  async function handleRuntimeFetch(iframeEl, req) {
    let payload;
    try {
      const res = await doFetch(req.url, { method: req.method, headers: req.headers, body: req.body });
      const buf = await res.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      payload = {
        id: req.id,
        status: res.status,
        headers: { "content-type": res.headers?.get?.("content-type") || "" },
        bodyBase64: btoa(binary),
      };
    } catch (err) {
      payload = { id: req.id, error: err.message || "fetch failed" };
    }
    iframeEl.contentWindow.postMessage({ __libcurlProxyFetchResponse: payload }, "*");
  }

  function guessType(url) {
    const ext = (url.split("?")[0].split(".").pop() || "").toLowerCase();
    const map = {
      css: "text/css", js: "application/javascript", mjs: "application/javascript",
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
      svg: "image/svg+xml", webp: "image/webp", ico: "image/x-icon",
      woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf",
      json: "application/json",
    };
    return map[ext] || "application/octet-stream";
  }

  async function fetchAsBlobUrl(absUrl) {
    try {
      const res = await doFetch(absUrl);
      const ct = res.headers?.get?.("content-type") || guessType(absUrl);
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: ct });
      return URL.createObjectURL(blob);
    } catch (e) {
      return null;
    }
  }

  // `location.href = x` is a real browser-engine navigation, not a JS
  // property write — Object.defineProperty can virtualize *reads* of
  // location (host/href/etc) but the engine still performs the actual
  // navigate when something assigns to it, bypassing any getter/setter
  // entirely. That's a hard platform boundary, not a bug to patch around.
  //
  // Real Service-Worker proxies don't have this problem because they
  // intercept the resulting *network request*, not the JS call that
  // triggered it. We have no equivalent network hook here, so instead we
  // do what scramjet/UV do at the source level: rewrite every script's
  // *text* before it ever runs, replacing references to the real
  // `location` with a plain JS object (`__plocation`) we fully own. A
  // plain object's setters are real JS — no engine can refuse to call them
  // — so `__plocation.href = x` reliably routes back into our nav pipeline
  // instead of ever touching the real, un-interceptable Location object.
  function rewriteJs(code) {
    return code
      .replace(/\b(?:window|self|document|top|parent)\.location\b/g, "window.__plocation")
      .replace(/(?<![.\w$])location\b(?!\s*:)/g, "window.__plocation");
  }

  function shouldRewriteScript(el) {
    const type = (el.getAttribute("type") || "").toLowerCase();
    if (!type) return true;
    return type === "text/javascript" || type === "module" || type === "application/javascript";
  }

  async function fetchScriptBlobUrl(absUrl) {
    try {
      const res = await doFetch(absUrl);
      const code = await res.text();
      const blob = new Blob([rewriteJs(code)], { type: "application/javascript" });
      return URL.createObjectURL(blob);
    } catch (e) {
      return null;
    }
  }

  // Content loaded via iframe.srcdoc reports its own address as the literal
  // string "about:srcdoc" (location.host === ""), not the real fetched URL.
  // Sites that build things off location.host/href in their own JS (e.g. a
  // "redirect to the right game server" script) get garbage as a result.
  // We give every rewritten script a fake `location` (see rewriteJs above)
  // that reports the *real* URL and routes navigation back through us; this
  // defines that object plus a best-effort real-`location` read shim for
  // any un-rewritten code (third-party assets we didn't touch, devtools).
  function buildBootstrap(realUrl) {
    return `(function(){
  var REAL_URL = ${JSON.stringify(realUrl)};
  function navigateTo(target) {
    try {
      var abs = new URL(target, REAL_URL).href;
      window.parent.postMessage({ __libcurlProxyNavigate: abs }, "*");
    } catch (e) {}
  }
  function u() { try { return new URL(REAL_URL); } catch(e) { return new URL("about:blank"); } }
  window.__plocation = {
    get href() { return REAL_URL; },
    set href(v) { navigateTo(v); },
    get host() { return u().host; },
    get hostname() { return u().hostname; },
    get origin() { return u().origin; },
    get pathname() { return u().pathname; },
    get search() { return u().search; },
    get hash() { return u().hash; },
    get protocol() { return u().protocol; },
    get port() { return u().port; },
    assign: navigateTo,
    replace: navigateTo,
    reload: function(){ navigateTo(REAL_URL); },
    toString: function(){ return REAL_URL; },
  };
  try {
    var uu = u();
    var defs = {
      href: { get: function(){ return REAL_URL; }, set: navigateTo },
      host: { get: function(){ return uu.host; } },
      hostname: { get: function(){ return uu.hostname; } },
      origin: { get: function(){ return uu.origin; } },
      pathname: { get: function(){ return uu.pathname; } },
      search: { get: function(){ return uu.search; } },
      hash: { get: function(){ return uu.hash; } },
      protocol: { get: function(){ return uu.protocol; } },
      port: { get: function(){ return uu.port; } },
      assign: { value: navigateTo },
      replace: { value: navigateTo },
      reload: { value: function(){ navigateTo(REAL_URL); } },
      toString: { value: function(){ return REAL_URL; } },
    };
    for (var k in defs) {
      var desc = Object.assign({configurable:true}, defs[k]);
      try { Object.defineProperty(location, k, desc); continue; } catch(e) {}
      try { Object.defineProperty(Object.getPrototypeOf(location), k, desc); } catch(e) {}
    }
  } catch (e) {}

  // history.pushState/replaceState with a real target URL throws a
  // SecurityError here (the document's real origin is about:srcdoc, so the
  // engine refuses to associate history state with a different URL) — this
  // isn't a navigation, so there's nothing to route anywhere, but an
  // uncaught throw here can abort whatever init chain called it. Swallow it.
  try {
    var origReplace = window.history.replaceState.bind(window.history);
    var origPush = window.history.pushState.bind(window.history);
    window.history.replaceState = function(state, title, url) {
      try { return origReplace(state, title, url); } catch(e) {}
    };
    window.history.pushState = function(state, title, url) {
      try { return origPush(state, title, url); } catch(e) {}
    };
  } catch (e) {}

  // Any runtime fetch() the page's own JS makes — e.g. nowgg's "start this
  // game session" API call — would otherwise hit the real network directly
  // from this srcdoc document's opaque origin, which gets CORS-blocked (or
  // just silently misses the cookies our relay is tracking) since it never
  // goes through our proxy at all. Route it there instead, via a
  // request/response postMessage bridge to the parent, which actually has
  // doFetch()/the cookie jar.
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  var fetchReqId = 0;
  var pendingFetches = {};
  window.addEventListener("message", function (e) {
    if (e.source !== window.parent) return;
    var reply = e.data && e.data.__libcurlProxyFetchResponse;
    if (!reply || !pendingFetches[reply.id]) return;
    var entry = pendingFetches[reply.id];
    delete pendingFetches[reply.id];
    if (reply.error) { entry.reject(new TypeError(reply.error)); return; }
    var bytes = null;
    try {
      var bin = atob(reply.bodyBase64 || "");
      bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch (err) {}
    entry.resolve(new Response(bytes, { status: reply.status, headers: reply.headers || {} }));
  });
  if (origFetch) {
    window.fetch = function (input, init) {
      var url, method = "GET", headers = {}, body = null;
      try {
        if (input instanceof Request) {
          url = input.url; method = input.method || "GET";
        } else {
          url = String(input);
        }
        if (init) {
          if (init.method) method = init.method;
          if (init.headers) headers = Object.fromEntries(new Headers(init.headers).entries());
          if (typeof init.body === "string") body = init.body;
        }
        url = new URL(url, REAL_URL).href;
      } catch (e) {
        return origFetch(input, init);
      }
      var id = ++fetchReqId;
      return new Promise(function (resolve, reject) {
        pendingFetches[id] = { resolve: resolve, reject: reject };
        window.parent.postMessage({ __libcurlProxyFetchRequest: { id: id, url: url, method: method, headers: headers, body: body } }, "*");
        setTimeout(function () {
          if (pendingFetches[id]) { delete pendingFetches[id]; reject(new TypeError("proxied fetch timed out")); }
        }, 30000);
      });
    };
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#" || href.indexOf("javascript:") === 0) return;
    e.preventDefault();
    navigateTo(href);
  }, true);

  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!form || (form.method || "").toLowerCase() === "post") return;
    e.preventDefault();
    var action = form.getAttribute("action") || REAL_URL;
    var abs;
    try { abs = new URL(action, REAL_URL); } catch (e) { return; }
    var data = new FormData(form);
    for (var pair of data.entries()) abs.searchParams.set(pair[0], pair[1]);
    navigateTo(abs.href);
  }, true);
})();`;
  }

  async function rewriteAndLoad(iframeEl, url, onStatus) {
    onStatus && onStatus("fetching " + url);
    const res = await doFetch(url);
    const finalUrl = res.url || url;
    let html = await res.text();

    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc.querySelector("base")) {
      const base = doc.createElement("base");
      base.href = finalUrl;
      doc.head?.prepend(base);
    }

    doc.querySelectorAll("script:not([src])").forEach((el) => {
      if (shouldRewriteScript(el) && el.textContent) {
        el.textContent = rewriteJs(el.textContent);
      }
    });

    // inline event-handler attributes (onclick="location.href=...") are JS
    // text too, just not inside a <script> tag — rewrite those the same way.
    const INLINE_EVENT_ATTRS = /^on\w+$/;
    doc.querySelectorAll("*").forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        if (INLINE_EVENT_ATTRS.test(attr.name) && attr.value) {
          el.setAttribute(attr.name, rewriteJs(attr.value));
        }
      }
    });

    const assets = [];
    doc.querySelectorAll("link[rel=stylesheet][href], script[src], img[src]").forEach((el) => {
      const attr = el.tagName === "LINK" ? "href" : "src";
      const raw = el.getAttribute(attr);
      if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return;
      let abs;
      try { abs = new URL(raw, finalUrl).href; } catch { return; }
      const isScript = el.tagName === "SCRIPT" && shouldRewriteScript(el);
      assets.push({ el, attr, abs, isScript });
    });

    onStatus && onStatus("loading " + assets.length + " sub-resources");
    await Promise.all(
      assets.map(async (a) => {
        const blobUrl = a.isScript ? await fetchScriptBlobUrl(a.abs) : await fetchAsBlobUrl(a.abs);
        if (blobUrl) a.el.setAttribute(a.attr, blobUrl);
        else a.el.removeAttribute(a.attr);
      })
    );

    const bootstrapScript = doc.createElement("script");
    bootstrapScript.textContent = buildBootstrap(finalUrl);
    doc.head?.prepend(bootstrapScript);

    iframeEl.srcdoc = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
    onStatus && onStatus("loaded " + finalUrl);
    return finalUrl;
  }

  async function navigate(iframeEl, url, onStatus, onNavigated) {
    await init();
    if (onNavigated) iframeEl.__libcurlOnNavigated = onNavigated;
    if (!iframeEl.hasAttribute("sandbox")) {
      iframeEl.setAttribute("sandbox", "allow-scripts allow-forms allow-same-origin allow-popups");
    }
    if (!iframeEl.__libcurlNavHandler) {
      iframeEl.__libcurlNavHandler = (e) => {
        if (e.source !== iframeEl.contentWindow) return;
        const fetchReq = e.data && e.data.__libcurlProxyFetchRequest;
        if (fetchReq) { handleRuntimeFetch(iframeEl, fetchReq); return; }
        const target = e.data && e.data.__libcurlProxyNavigate;
        if (!target) return;
        rewriteAndLoad(iframeEl, target, onStatus)
          .then((finalUrl) => iframeEl.__libcurlOnNavigated && iframeEl.__libcurlOnNavigated(finalUrl))
          .catch((err) => onStatus && onStatus("error: " + err.message));
      };
      window.addEventListener("message", iframeEl.__libcurlNavHandler);
    }
    return rewriteAndLoad(iframeEl, url, onStatus);
  }

  global.libcurlProxy = { init, navigate };
})(window);
