(function () {
  var input = document.getElementById("searchInput");
  var emptyEl = document.getElementById("emptyState");
  var gamesResult = document.getElementById("gamesResult");
  var appsResult = document.getElementById("appsResult");
  var gamesGrid = document.getElementById("gamesGrid");
  var appsGrid = document.getElementById("appsGrid");

  var games = [];
  var apps = [];

  function card(item) {
    var a = document.createElement("a");
    a.className = "game-card";
    a.href = "/game.html?url=" + encodeURIComponent(item.url) + "&title=" + encodeURIComponent(item.title);
    a.addEventListener("click", function (e) {
      if (e.shiftKey || localStorage.getItem("velcro_launch_mode") === "about-blank") {
        e.preventDefault();
        var w = window.open("about:blank", "_blank");
        if (!w) return;
        var f = w.document.createElement("iframe");
        f.src = a.href;
        f.style.cssText = "border:none;position:fixed;inset:0;width:100%;height:100%";
        w.document.body.style.cssText = "margin:0";
        w.document.body.appendChild(f);
      }
    });
    var cover = document.createElement("span");
    cover.className = "cover";
    cover.style.backgroundImage = "url('" + item.thumbnail + "')";
    var info = document.createElement("span");
    info.className = "info";
    var name = document.createElement("span");
    name.className = "name";
    name.textContent = item.title;
    var cat = document.createElement("span");
    cat.className = "cat";
    cat.textContent = item.category || "";
    info.appendChild(name);
    info.appendChild(cat);
    a.appendChild(cover);
    a.appendChild(info);
    return a;
  }

  function fill(grid, section, list) {
    grid.innerHTML = "";
    section.hidden = list.length === 0;
    var frag = document.createDocumentFragment();
    list.slice(0, 40).forEach(function (it) { frag.appendChild(card(it)); });
    grid.appendChild(frag);
  }

  function run() {
    var q = input.value.trim().toLowerCase();
    if (!q) {
      gamesResult.hidden = true;
      appsResult.hidden = true;
      emptyEl.hidden = false;
      emptyEl.textContent = "type to search across games and apps";
      return;
    }
    var gm = games.filter(function (g) { return g.title.toLowerCase().indexOf(q) !== -1; });
    var am = apps.filter(function (a) { return a.title.toLowerCase().indexOf(q) !== -1; });
    fill(gamesGrid, gamesResult, gm);
    fill(appsGrid, appsResult, am);
    emptyEl.hidden = gm.length + am.length !== 0;
    emptyEl.textContent = "nothing matches “" + input.value.trim() + "”";
  }

  input.addEventListener("input", run);

  Promise.all([
    fetch("/games.json").then(function (r) { return r.json(); }).catch(function () { return []; }),
    fetch("/apps.json").then(function (r) { return r.json(); }).catch(function () { return []; })
  ]).then(function (res) {
    games = res[0] || [];
    apps = res[1] || [];
    var pre = new URLSearchParams(location.search).get("q");
    if (pre) { input.value = pre; run(); }
  });
})();
