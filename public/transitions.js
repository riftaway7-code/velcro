(function () {
  var MSGS = [
    "loading...",
    "grabbing the goods",
    "almost there",
    "one sec",
    "warming up",
    "spinning up",
  ];

  function randMsg() {
    return MSGS[Math.floor(Math.random() * MSGS.length)];
  }

  var overlay = document.createElement("div");
  overlay.id = "page-transition";
  overlay.innerHTML =
    '<div class="pt-spinner">' +
      '<div class="pt-ring"></div>' +
      '<div class="pt-ring pt-ring2"></div>' +
    '</div>' +
    '<p class="pt-msg"></p>';
  document.body.appendChild(overlay);

  var msgEl = overlay.querySelector(".pt-msg");
  var msgTimer = null;

  function startMsgs() {
    msgEl.textContent = randMsg();
    msgTimer = setInterval(function () {
      msgEl.classList.remove("pt-msg-in");
      void msgEl.offsetWidth;
      msgEl.classList.add("pt-msg-in");
      msgEl.textContent = randMsg();
    }, 2200);
  }

  function stopMsgs() {
    clearInterval(msgTimer);
  }

  function showTransition() {
    startMsgs();
    overlay.classList.remove("pt-out");
    overlay.classList.add("pt-visible");
  }

  function hideTransition() {
    stopMsgs();
    overlay.classList.add("pt-out");
    overlay.addEventListener("animationend", function () {
      overlay.classList.remove("pt-visible", "pt-out");
    }, { once: true });
  }

  showTransition();

  var hidden = false;
  function hideOnce() {
    if (hidden) return;
    hidden = true;
    hideTransition();
  }

  // DOMContentLoaded, not load: content is ready as soon as HTML is parsed
  // and app.js has run. Waiting on "load" means a single slow external
  // resource (fonts, a CDN thumbnail) can trap the whole page behind this
  // overlay forever, even though everything visible is already usable.
  if (document.readyState === "interactive" || document.readyState === "complete") {
    setTimeout(hideOnce, 80);
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(hideOnce, 80);
    });
  }

  // safety net: never let a stuck resource hold this overlay up forever
  setTimeout(hideOnce, 4000);

  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript") || a.target === "_blank") return;
    var url;
    try {
      url = new URL(href, location.href);
    } catch (err) { return; }
    if (url.origin !== location.origin) return;
    showTransition();
  });
})();
