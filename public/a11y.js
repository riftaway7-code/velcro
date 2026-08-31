(function () {
  var RM = "velcro_reduce_motion";
  var HC = "velcro_high_contrast";
  var root = document.documentElement;

  function get(k) { return localStorage.getItem(k) === "1"; }

  function apply() {
    var prefersRM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.classList.toggle("reduce-motion", get(RM) || prefersRM);
    root.classList.toggle("high-contrast", get(HC));
  }

  apply();

  window.VelcroA11y = {
    get: function () { return { reduceMotion: get(RM), highContrast: get(HC) }; },
    set: function (rm, hc) {
      if (rm) localStorage.setItem(RM, "1"); else localStorage.removeItem(RM);
      if (hc) localStorage.setItem(HC, "1"); else localStorage.removeItem(HC);
      apply();
    }
  };
})();
