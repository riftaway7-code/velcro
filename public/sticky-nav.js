(function () {
  var LINKS = [
    { href: "/", icon: "sports_esports", label: "games" },
    { href: "/apps.html", icon: "apps", label: "apps" },
    { href: "/movies.html", icon: "movie", label: "movies" },
    { href: "/cloud-gaming.html", icon: "cloud", label: "cloud gaming" },
    { href: "/browser.html", icon: "public", label: "browser" },
    { href: "/chat.html", icon: "forum", label: "chat" },
  ];

  var path = location.pathname;
  var linksHtml = LINKS.map(function (l) {
    var active = (l.href === "/" ? path === "/" || path === "/index.html" : path === l.href);
    return '<a href="' + l.href + '"' + (active ? ' class="active"' : '') +
      '><span class="material-symbols-rounded">' + l.icon + '</span><span class="sticky-nav-label">' + l.label + '</span></a>';
  }).join("");

  var bar = document.createElement("div");
  bar.id = "stickyNav";
  bar.innerHTML =
    '<a href="/" class="sticky-nav-brand">velcro</a>' +
    '<nav class="sticky-nav-links">' + linksHtml + '</nav>' +
    '<div class="sticky-nav-right">' +
      '<div class="search-wrapper sticky-nav-search">' +
        '<span class="material-symbols-rounded search-icon">search</span>' +
        '<input id="stickyNavSearch" class="search-input" type="text" placeholder="search" autocomplete="off" />' +
      '</div>' +
      '<button id="stickyNavTheme" class="theme-toggle" type="button" aria-label="Toggle theme">' +
        '<span class="material-symbols-rounded">dark_mode</span>' +
      '</button>' +
    '</div>';
  document.body.appendChild(bar);

  window.addEventListener("scroll", function () {
    bar.classList.toggle("visible", window.scrollY > 400);
  });

  var THEME_KEY = "velcro_theme";
  var DARK_THEMES = ["dark", "midnight"];
  var themeBtn = document.getElementById("stickyNavTheme");
  var themeIcon = themeBtn.querySelector(".material-symbols-rounded");

  function paintIcon() {
    var theme = document.documentElement.getAttribute("data-theme") || "dark";
    themeIcon.textContent = DARK_THEMES.indexOf(theme) !== -1 ? "light_mode" : "dark_mode";
  }
  paintIcon();

  themeBtn.addEventListener("click", function () {
    var current = document.documentElement.getAttribute("data-theme") || "dark";
    var next = DARK_THEMES.indexOf(current) !== -1 ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    paintIcon();
    // let the page's own theme toggle (if any) pick up the change too
    var pageToggle = document.getElementById("themeToggle");
    if (pageToggle && pageToggle !== themeBtn) {
      var pageIcon = pageToggle.querySelector(".material-symbols-rounded");
      if (pageIcon) pageIcon.textContent = themeIcon.textContent;
    }
  });

  var searchInput = document.getElementById("stickyNavSearch");
  searchInput.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    var q = searchInput.value.trim();
    if (!q) return;
    location.href = "/search.html?q=" + encodeURIComponent(q);
  });
})();
