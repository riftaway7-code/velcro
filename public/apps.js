(function () {
  var gridEl = document.getElementById("gamesGrid");
  var emptyEl = document.getElementById("emptyState");
  var pillsEl = document.getElementById("categoryPills");
  var searchInput = document.getElementById("searchInput");

  var apps = [];
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

  function renderGrid() {
    var query = searchInput.value.trim().toLowerCase();
    var filtered = apps.filter(function (a) {
      var matchesCategory = activeCategory === "all" || a.category === activeCategory;
      var matchesQuery = !query || a.title.toLowerCase().indexOf(query) !== -1;
      return matchesCategory && matchesQuery;
    });

    gridEl.innerHTML = "";
    emptyEl.hidden = filtered.length !== 0;

    var frag = document.createDocumentFragment();
    filtered.forEach(function (a) {
      var link = document.createElement("a");
      link.className = "game-card";
      var appUrl = "/game.html?url=" + encodeURIComponent(a.url) + "&title=" + encodeURIComponent(a.title);
      link.href = appUrl;

      if (localStorage.getItem("velcro_launch_mode") === "about-blank") {
        link.addEventListener("click", function (e) {
          e.preventDefault();
          openAboutBlank(appUrl);
        });
      }

      var cover = document.createElement("span");
      cover.className = "cover";
      cover.style.backgroundImage = "url('" + a.thumbnail + "')";

      var info = document.createElement("span");
      info.className = "info";

      var name = document.createElement("span");
      name.className = "name";
      name.textContent = a.title;

      var cat = document.createElement("span");
      cat.className = "cat";
      cat.textContent = a.category;

      info.appendChild(name);
      info.appendChild(cat);
      link.appendChild(cover);
      link.appendChild(info);
      frag.appendChild(link);
    });
    gridEl.appendChild(frag);
  }

  function buildPills() {
    var categories = ["all"].concat(
      Array.from(new Set(apps.map(function (a) { return a.category; }))).sort()
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

  fetch("/apps.json")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      apps = data;
      buildPills();
      renderGrid();
    })
    .catch(function (err) {
      gridEl.innerHTML = "";
      emptyEl.hidden = false;
      emptyEl.textContent = "couldn't load apps.json — check the console";
      console.error(err);
    });
})();
