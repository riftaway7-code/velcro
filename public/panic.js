(function () {
  var KEY = "velcro_panic_key";
  var URL_KEY = "velcro_panic_url";
  var DEFAULT_KEY = "`";
  var DEFAULT_URL = "https://classroom.google.com/";

  function panicKey() {
    return localStorage.getItem(KEY) || DEFAULT_KEY;
  }
  function panicUrl() {
    var u = localStorage.getItem(URL_KEY) || DEFAULT_URL;
    return /^https?:\/\//i.test(u) ? u : DEFAULT_URL;
  }

  document.addEventListener("keydown", function (e) {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.key !== panicKey()) return;
    e.preventDefault();
    window.location.replace(panicUrl());
  });

  window.VelcroPanic = {
    get: function () { return { key: panicKey(), url: panicUrl() }; },
    save: function (key, url) {
      if (key) localStorage.setItem(KEY, key); else localStorage.removeItem(KEY);
      if (url && /^https?:\/\//i.test(url)) localStorage.setItem(URL_KEY, url);
      else localStorage.removeItem(URL_KEY);
    },
    clear: function () {
      localStorage.removeItem(KEY);
      localStorage.removeItem(URL_KEY);
    }
  };
})();
