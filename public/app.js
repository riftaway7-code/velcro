(function () {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      var hasApp = regs.some(function (r) { return r.active && r.active.scriptURL.indexOf("/app-sw.js") !== -1; });
      if (!hasApp) navigator.serviceWorker.register("/app-sw.js", { scope: "/" }).catch(function () {});
    }).catch(function () {});
  }

  var gridEl = document.getElementById("gamesGrid");
  var emptyEl = document.getElementById("emptyState");
  var pillsEl = document.getElementById("categoryPills");
  var searchInput = document.getElementById("searchInput");
  var themeToggle = document.getElementById("themeToggle");
  var scrollTopBtn = document.getElementById("scrollTop");
  var recentSection = document.getElementById("recentSection");
  var recentGrid = document.getElementById("recentGrid");
  var topSection = document.getElementById("topSection");
  var topGrid = document.getElementById("topGrid");
  var trendingSection = document.getElementById("trendingSection");
  var trendingGrid = document.getElementById("trendingGrid");
  var favSection = document.getElementById("favSection");
  var favGrid = document.getElementById("favGrid");
  var gameCountEl = document.getElementById("gameCount");
  var randomBtn = document.getElementById("randomGame");

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
    var d = win.document;
    d.title = "about:blank";
    d.body.style.cssText = "margin:0;height:100%;background:#000";
    d.documentElement.style.height = "100%";
    var frame = d.createElement("iframe");
    frame.src = url;
    frame.style.cssText = "border:none;position:fixed;inset:0;width:100%;height:100%;display:block";
    d.body.appendChild(frame);
  }

  var RECENT_KEY = "velcro_recent_games";
  var PLAY_COUNTS_KEY = "velcro_play_counts";
  var FAV_KEY = "velcro_fav_games";

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || fallback); } catch (e) { return JSON.parse(fallback); }
  }
  function getFavs() { return readJSON(FAV_KEY, "[]"); }
  function isFav(id) { return getFavs().indexOf(id) !== -1; }
  function toggleFav(id) {
    var favs = getFavs();
    var i = favs.indexOf(id);
    if (i === -1) favs.push(id); else favs.splice(i, 1);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); } catch (e) {}
    renderFavorites();
    pushAccountSync();
  }

  var syncTimer = null;
  function pushAccountSync() {
    if (!window.velcroAccount || !window.velcroAccount.getToken()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () { window.velcroAccount.sync(); }, 1500);
  }

  function reportBroken(g, btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = "reported";
    fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: g.id, title: g.title, url: g.url }),
      keepalive: true
    }).catch(function () {});
  }

  function recordPlay(id) {
    try {
      var recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      recent = recent.filter(function (existingId) { return existingId !== id; });
      recent.unshift(id);
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 10)));

      var counts = JSON.parse(localStorage.getItem(PLAY_COUNTS_KEY) || "{}");
      counts[id] = (counts[id] || 0) + 1;
      localStorage.setItem(PLAY_COUNTS_KEY, JSON.stringify(counts));

      pushAccountSync();
    } catch (e) {}
    fetch("/api/plays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id }),
      keepalive: true
    }).catch(function () {});
  }

  function buildCard(g) {
    var a = document.createElement("a");
    a.className = "game-card";
    var gameUrl = "/game.html?url=" + encodeURIComponent(g.url) + "&title=" + encodeURIComponent(g.title);
    a.href = gameUrl;

    a.addEventListener("click", function (e) {
      recordPlay(g.id);
      var forceBlank = e.shiftKey;
      if (forceBlank || localStorage.getItem("velcro_launch_mode") === "about-blank") {
        e.preventDefault();
        openAboutBlank(gameUrl);
      }
    });
    a.title = "shift-click to open in an about:blank tab";

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

    var star = document.createElement("button");
    star.type = "button";
    star.className = "card-fav" + (isFav(g.id) ? " on" : "");
    star.title = "Favorite";
    star.setAttribute("aria-label", "Toggle favorite");
    star.innerHTML = '<span class="material-symbols-rounded">star</span>';
    star.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleFav(g.id);
      star.classList.toggle("on");
    });
    a.appendChild(star);

    var report = document.createElement("button");
    report.type = "button";
    report.className = "card-report";
    report.textContent = "report broken";
    report.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      reportBroken(g, report);
    });
    a.appendChild(report);

    return a;
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
    filtered.forEach(function (g) { frag.appendChild(buildCard(g)); });
    gridEl.appendChild(frag);

    lastFiltered = filtered;
    if (gameCountEl) {
      gameCountEl.textContent = filtered.length === games.length
        ? games.length + " games"
        : filtered.length + " of " + games.length;
    }
  }

  var lastFiltered = [];

  function renderFavorites() {
    var favIds = getFavs();
    var list = favIds
      .map(function (id) { return games.find(function (g) { return g.id === id; }); })
      .filter(Boolean);
    renderRow(favSection, favGrid, list);
  }

  function renderRow(section, grid, list) {
    grid.innerHTML = "";
    section.hidden = list.length === 0;
    var frag = document.createDocumentFragment();
    list.forEach(function (g) { frag.appendChild(buildCard(g)); });
    grid.appendChild(frag);
  }

  function renderRecent() {
    var recentIds;
    try { recentIds = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch (e) { recentIds = []; }
    var list = recentIds
      .map(function (id) { return games.find(function (g) { return g.id === id; }); })
      .filter(Boolean)
      .slice(0, 10);
    renderRow(recentSection, recentGrid, list);
  }

  function renderTop() {
    var counts;
    try { counts = JSON.parse(localStorage.getItem(PLAY_COUNTS_KEY) || "{}"); } catch (e) { counts = {}; }
    var list = Object.keys(counts)
      .sort(function (a, b) { return counts[b] - counts[a]; })
      .map(function (id) { return games.find(function (g) { return g.id === id; }); })
      .filter(Boolean)
      .slice(0, 10);
    renderRow(topSection, topGrid, list);
  }

  function renderTrending() {
    if (!trendingSection) return;
    fetch("/api/trending?limit=10")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var list = (data.games || [])
          .map(function (row) { return games.find(function (g) { return g.id === row.id; }); })
          .filter(Boolean);
        renderRow(trendingSection, trendingGrid, list);
      })
      .catch(function () { trendingSection.hidden = true; });
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

  if (randomBtn) {
    randomBtn.addEventListener("click", function () {
      var pool = lastFiltered.length ? lastFiltered : games;
      if (!pool.length) return;
      var g = pool[Math.floor(Math.random() * pool.length)];
      var url = "/game.html?url=" + encodeURIComponent(g.url) + "&title=" + encodeURIComponent(g.title);
      recordPlay(g.id);
      if (localStorage.getItem("velcro_launch_mode") === "about-blank") openAboutBlank(url);
      else window.location.href = url;
    });
  }

  gridEl.addEventListener("keydown", function (e) {
    if (["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].indexOf(e.key) === -1) return;
    var cards = Array.prototype.slice.call(gridEl.querySelectorAll(".game-card"));
    var idx = cards.indexOf(document.activeElement);
    if (idx === -1) { if (cards[0]) cards[0].focus(); e.preventDefault(); return; }
    var perRow = Math.max(1, Math.round(gridEl.clientWidth / cards[0].offsetWidth));
    var next = idx;
    if (e.key === "ArrowRight") next = idx + 1;
    else if (e.key === "ArrowLeft") next = idx - 1;
    else if (e.key === "ArrowDown") next = idx + perRow;
    else if (e.key === "ArrowUp") next = idx - perRow;
    if (cards[next]) { cards[next].focus(); e.preventDefault(); }
  });

  fetch("/games.json")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      games = data;
      buildPills();
      renderGrid();
      renderFavorites();
      renderRecent();
      renderTop();
      renderTrending();
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
    return saved || "dark";
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
