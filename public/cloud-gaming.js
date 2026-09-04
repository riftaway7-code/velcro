(function () {
  var APPS = [
    { id: "19900", title: "Roblox", category: "adventure", thumb: "https://nowgg.fun/img/roadblock.png", url: "https://nowgg.fun/apps/a/19900/b.html" },
    { id: "10011", title: "Stumble Guys", category: "arcade", thumb: "https://nowgg.fun/img/stumbleguys.jpg", url: "https://nowgg.fun/apps/a/10011/b.html" },
    { id: "10008", title: "Call of Duty", category: "action", thumb: "https://nowgg.fun/img/cod.jpg", url: "https://nowgg.fun/apps/a/10008/b.html" },
    { id: "melon", title: "Melon Sandbox", category: "sandbox", thumb: "https://nowgg.fun/img/melon-sandbox.png", url: "https://nowgg.fun/apps/playducky/7199/melon-sandbox.html" },
    { id: "10019", title: "Cookie Run", category: "arcade", thumb: "https://nowgg.fun/img/cookierun.jpg", url: "https://nowgg.fun/apps/a/10019/b.html" },
    { id: "geodash", title: "Geometry Dash", category: "arcade", thumb: "https://nowgg.fun/img/geodash.png", url: "https://nowgg.fun/apps/robtop-games/1400/geometry-dash.html" },
    { id: "rocketleague", title: "Rocket League", category: "sports", thumb: "https://nowgg.fun/img/rocketleague.webp", url: "https://nowgg.fun/apps/psyonix-studios/4656/rocket-league.html" },
    { id: "fortnite", title: "Fortnite", category: "action", thumb: "https://nowgg.fun/img/fortnite.png", url: "https://nowgg.fun/apps/aptoide/5874/aptoide.html?deep_link=aptoidesearch://com.epicgames.fortnite" },
    { id: "minecraft", title: "Minecraft", category: "sandbox", thumb: "https://nowgg.fun/img/minecraft.png", url: "https://nowgg.fun/apps/aptoide/5874/aptoide.html?deep_link=aptoidesearch://com.mojang.minecrafttrialpe" },
  ];

  var grid = document.getElementById("cloudGrid");
  if (!grid) return;

  APPS.forEach(function (app) {
    var a = document.createElement("a");
    a.className = "game-card";
    a.href = "/cloud-player.html?url=" + encodeURIComponent(app.url) + "&title=" + encodeURIComponent(app.title);

    var cover = document.createElement("span");
    cover.className = "cover";
    cover.style.backgroundImage = "url('" + app.thumb + "')";

    var badge = document.createElement("span");
    badge.className = "cloud-badge";
    badge.innerHTML = '<span class="material-symbols-rounded">cloud</span>';
    cover.appendChild(badge);

    var info = document.createElement("span");
    info.className = "info";

    var name = document.createElement("span");
    name.className = "name";
    name.textContent = app.title;

    var cat = document.createElement("span");
    cat.className = "cat";
    cat.textContent = app.category;

    info.appendChild(name);
    info.appendChild(cat);
    a.appendChild(cover);
    a.appendChild(info);
    grid.appendChild(a);
  });
})();
