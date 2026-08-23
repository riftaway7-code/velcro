(function () {
  var gridEl = document.getElementById("gamesGrid");
  var emptyEl = document.getElementById("emptyState");
  var pillsEl = document.getElementById("categoryPills");
  var searchInput = document.getElementById("searchInput");
  var themeToggle = document.getElementById("themeToggle");
  var scrollTopBtn = document.getElementById("scrollTop");

  scrollTopBtn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", function () {
    scrollTopBtn.classList.toggle("visible", window.scrollY > 400);
  });

  var games = [];
  var activeCategory = "all";

  function openAboutBlank(url) {
    var win = window.open("about:blank", "_blank");
    if (!win) return;
    win.document.open();
    win.document.write(
      '<!doctype html><html><head><title>about:blank</title><style>html,body{margin:0;height:100%;background:#000}iframe{border:none;width:100%;height:100%;display:block}</style></head>' +
      '<body><iframe src="' + url.replace(/"/g, "&quot;") + '"></iframe></body></html>'
    );
    win.document.close();
  }

  function renderGrid() {
    var query = searchInput.value.trim().toLowerCase();
    var filtered = games.filter(function (g) {
      var matchesCategory = activeCategory === "all" || g.category === activeCategory;
      var matchesQuery = !query || g.title.toLowerCase().indexOf(query) !== -1;
      return matchesCategory && matchesQuery;
    });

    gridEl.innerHTML = "";
    emptyEl.hidden = filtered.length !== 0;

    var frag = document.createDocumentFragment();
    filtered.forEach(function (g) {
      var a = document.createElement("a");
      a.className = "game-card";
      var gameUrl = "/game.html?url=" + encodeURIComponent(g.url) + "&title=" + encodeURIComponent(g.title);
      a.href = gameUrl;

      if (localStorage.getItem("velcro_launch_mode") === "about-blank") {
        a.addEventListener("click", function (e) {
          e.preventDefault();
          openAboutBlank(gameUrl);
        });
      }

      var cover = document.createElement("span");
      cover.className = "cover";
      cover.style.backgroundImage = "url('" + g.thumbnail + "')";

      var info = document.createElement("span");
      info.className = "info";

      var name = document.createElement("span");
      name.className = "name";
      name.textContent = g.title;

      var cat = document.createElement("span");
      cat.className = "cat";
      cat.textContent = g.category;

      info.appendChild(name);
      info.appendChild(cat);
      a.appendChild(cover);
      a.appendChild(info);
      frag.appendChild(a);
    });
    gridEl.appendChild(frag);
  }

  function buildPills() {
    var categories = ["all"].concat(
      Array.from(new Set(games.map(function (g) { return g.category; }))).sort()
    );
    pillsEl.innerHTML = "";
    categories.forEach(function (cat) {
      var btn = document.createElement("button");
      btn.className = "pill" + (cat === "all" ? " active" : "");
      btn.type = "button";
      btn.dataset.category = cat;
      btn.textContent = cat;
      btn.addEventListener("click", function () {
        activeCategory = cat;
        pillsEl.querySelectorAll(".pill").forEach(function (p) { p.classList.remove("active"); });
        btn.classList.add("active");
        renderGrid();
      });
      pillsEl.appendChild(btn);
    });
  }

  searchInput.addEventListener("input", renderGrid);

  fetch("/games.json")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      games = data;
      buildPills();
      renderGrid();
    })
    .catch(function (err) {
      gridEl.innerHTML = "";
      emptyEl.hidden = false;
      emptyEl.textContent = "couldn't load games.json — check the console";
      console.error(err);
    });

  var THEME_KEY = "velcro_theme";
  var DARK_THEMES = ["dark", "midnight"];

  function applyThemeIcon(theme) {
    var icon = themeToggle.querySelector(".material-symbols-rounded");
    icon.textContent = DARK_THEMES.indexOf(theme) !== -1 ? "light_mode" : "dark_mode";
  }

  function currentTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    return saved || "light";
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
    applyThemeIcon(theme);
  }

  setTheme(currentTheme());

  var typingEl = document.getElementById("typingText");
  var TAGLINE = "i lowk didnt pay for the boosts in the server";
  var typeIndex = 0;

  function typeTagline() {
    if (typeIndex <= TAGLINE.length) {
      typingEl.textContent = TAGLINE.slice(0, typeIndex);
      typeIndex++;
      setTimeout(typeTagline, 45);
    } else {
      setTimeout(function () {
        typeIndex = 0;
        typeTagline();
      }, 2200);
    }
  }

  typeTagline();

  themeToggle.addEventListener("click", function () {
    var next = DARK_THEMES.indexOf(document.documentElement.getAttribute("data-theme")) !== -1 ? "light" : "dark";
    setTheme(next);
  });

  var PRESENCE_KEY = "velcro_presence_id";
  var activeUsersLine = document.getElementById("activeUsersLine");
  var totalUsersLine = document.getElementById("totalUsersLine");

  function getPresenceId() {
    var id = sessionStorage.getItem(PRESENCE_KEY);
    if (!id) {
      id = "tab_" + Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
      sessionStorage.setItem(PRESENCE_KEY, id);
    }
    return id;
  }

  function pingPresence() {
    var id = getPresenceId();
    fetch("/api/presence/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id }),
      keepalive: true,
    }).catch(function () {});
  }

  function leavePresence() {
    var id = getPresenceId();
    var payload = JSON.stringify({ id: id });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/presence/leave", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/presence/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(function () {});
    }
  }

  function refreshStats() {
    fetch("/api/stats/users")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        activeUsersLine.textContent = data.activeUsers + " online";
        totalUsersLine.textContent = data.totalUsers + " total";
      })
      .catch(function () {
        activeUsersLine.textContent = "unavailable";
        totalUsersLine.textContent = "unavailable";
      });
  }

  pingPresence();
  refreshStats();
  setInterval(pingPresence, 20000);
  setInterval(refreshStats, 15000);
  window.addEventListener("pagehide", leavePresence);
})();
