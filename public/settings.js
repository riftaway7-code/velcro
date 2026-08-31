(function () {
  var PRESETS = [
    { label: "google classroom", title: "Classes", favicon: "https://ssl.gstatic.com/classroom/favicon.png" },
    { label: "google drive", title: "My Drive - Google Drive", favicon: "https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png" },
    { label: "google docs", title: "Google Docs", favicon: "https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico" },
    { label: "gmail", title: "Inbox", favicon: "https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico" },
    { label: "powerschool", title: "PowerSchool Learning", favicon: "https://www.powerschool.com/favicon.ico" },
    { label: "canvas", title: "Dashboard", favicon: "https://canvas.instructure.com/favicon.ico" },
    { label: "schoology", title: "Home | Schoology", favicon: "https://asset-cdn.schoology.com/sites/all/themes/schoology_theme/favicon.ico" },
    { label: "clever", title: "Clever | Portal", favicon: "https://clever.com/favicon.ico" },
    { label: "classlink", title: "My Apps", favicon: "https://launchpad.classlink.com/favicon.ico" },
    { label: "khan academy", title: "Dashboard | Khan Academy", favicon: "https://cdn.kastatic.org/images/favicon.ico" },
    { label: "ixl", title: "IXL | Learn", favicon: "https://www.ixl.com/favicon.ico" },
    { label: "desmos", title: "Desmos | Graphing Calculator", favicon: "https://www.desmos.com/favicon.ico" },
    { label: "quizlet", title: "Quizlet", favicon: "https://quizlet.com/favicon.ico" },
    { label: "nearpod", title: "Nearpod", favicon: "https://nearpod.com/favicon.ico" },
    { label: "wikipedia", title: "Wikipedia", favicon: "https://en.wikipedia.org/static/favicon/wikipedia.ico" },
    { label: "dictionary", title: "Dictionary.com", favicon: "https://www.dictionary.com/favicon.ico" },
    { label: "none", title: "", favicon: "" },
  ];

  var themeBg = document.getElementById("themeBg");
  var themeAccent = document.getElementById("themeAccent");
  var themeReset = document.getElementById("themeReset");

  function computedHex(varName, fallback) {
    var val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (/^#[0-9a-f]{6}$/i.test(val)) return val;
    return fallback;
  }

  var existingCustom = window.VelcroTheme.getCustom();
  themeBg.value = (existingCustom && existingCustom.bg) || computedHex("--bg", "#7151a8");
  themeAccent.value = (existingCustom && existingCustom.accent) || computedHex("--accent", "#3ddc7a");

  function applyCustomFromInputs() {
    window.VelcroTheme.setCustom(themeBg.value, themeAccent.value);
  }

  themeBg.addEventListener("input", applyCustomFromInputs);
  themeAccent.addEventListener("input", applyCustomFromInputs);

  themeReset.addEventListener("click", function () {
    window.VelcroTheme.resetCustom();
    themeBg.value = computedHex("--bg", "#7151a8");
    themeAccent.value = computedHex("--accent", "#3ddc7a");
  });

  var wallpaperGrid = document.getElementById("wallpaperGrid");
  var wallpaperCustom = document.getElementById("wallpaperCustom");
  var wallpaperApplyCustom = document.getElementById("wallpaperApplyCustom");
  var wallpaperReset = document.getElementById("wallpaperReset");

  function renderWallpaperGrid() {
    var current = window.VelcroTheme.getWallpaper();
    wallpaperGrid.innerHTML = "";
    Object.keys(window.VelcroTheme.wallpapers).forEach(function (id) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wallpaper-swatch" + (current === id ? " active" : "");
      btn.style.backgroundImage = window.VelcroTheme.wallpapers[id];
      btn.title = id;
      btn.addEventListener("click", function () {
        window.VelcroTheme.setWallpaper(id);
        renderWallpaperGrid();
      });
      wallpaperGrid.appendChild(btn);
    });
  }

  renderWallpaperGrid();

  if (window.VelcroTheme.getWallpaper().indexOf("custom:") === 0) {
    wallpaperCustom.value = window.VelcroTheme.getWallpaper().slice(7);
  }

  wallpaperApplyCustom.addEventListener("click", function () {
    var url = wallpaperCustom.value.trim();
    if (!url) return;
    window.VelcroTheme.setWallpaper("custom:" + url);
    renderWallpaperGrid();
  });

  wallpaperReset.addEventListener("click", function () {
    window.VelcroTheme.setWallpaper("none");
    wallpaperCustom.value = "";
    renderWallpaperGrid();
  });

  var cursorGrid = document.getElementById("cursorGrid");

  function renderCursorGrid() {
    var current = window.VelcroTheme.getCursor();
    cursorGrid.innerHTML = "";
    Object.keys(window.VelcroTheme.cursors).forEach(function (id) {
      var cursor = window.VelcroTheme.cursors[id];
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cursor-swatch" + (current === id ? " active" : "");
      if (cursor.preview) {
        var img = document.createElement("img");
        img.src = cursor.preview;
        btn.appendChild(img);
      } else {
        var iconWrap = document.createElement("span");
        iconWrap.className = "cursor-none-icon";
        iconWrap.innerHTML = '<span class="material-symbols-rounded">near_me</span>';
        btn.appendChild(iconWrap);
      }
      var label = document.createElement("span");
      label.className = "cursor-label";
      label.textContent = cursor.label;
      btn.appendChild(label);
      btn.addEventListener("click", function () {
        window.VelcroTheme.setCursor(id);
        renderCursorGrid();
      });
      cursorGrid.appendChild(btn);
    });
  }

  renderCursorGrid();

  var presetRow = document.getElementById("presetRow");
  var titleInput = document.getElementById("cloakTitle");
  var faviconInput = document.getElementById("cloakFavicon");
  var saveBtn = document.getElementById("cloakSave");
  var resetBtn = document.getElementById("cloakReset");

  var current = window.VelcroCloak.read();
  titleInput.value = current.title;
  faviconInput.value = current.favicon;

  PRESETS.forEach(function (p) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "preset-btn";
    btn.textContent = p.label;
    btn.addEventListener("click", function () {
      titleInput.value = p.title;
      faviconInput.value = p.favicon;
      if (p.title || p.favicon) window.VelcroCloak.save(p.title, p.favicon);
      else window.VelcroCloak.clear();
    });
    presetRow.appendChild(btn);
  });

  saveBtn.addEventListener("click", function () {
    window.VelcroCloak.save(titleInput.value.trim(), faviconInput.value.trim());
  });

  resetBtn.addEventListener("click", function () {
    window.VelcroCloak.clear();
    titleInput.value = "";
    faviconInput.value = "";
  });

  var panicKeyInput = document.getElementById("panicKey");
  var panicUrlInput = document.getElementById("panicUrl");
  if (panicKeyInput && window.VelcroPanic) {
    var pc = window.VelcroPanic.get();
    panicKeyInput.value = pc.key;
    panicUrlInput.value = pc.url;
    document.getElementById("panicSave").addEventListener("click", function () {
      window.VelcroPanic.save(panicKeyInput.value.slice(0, 1), panicUrlInput.value.trim());
      var now = window.VelcroPanic.get();
      panicKeyInput.value = now.key;
      panicUrlInput.value = now.url;
    });
    document.getElementById("panicReset").addEventListener("click", function () {
      window.VelcroPanic.clear();
      var d = window.VelcroPanic.get();
      panicKeyInput.value = d.key;
      panicUrlInput.value = d.url;
    });
  }

  var LAUNCH_KEY = "velcro_launch_mode";
  var launchSwitch = document.getElementById("launchSwitch");

  function renderLaunchSwitch() {
    var mode = localStorage.getItem(LAUNCH_KEY) || "same-tab";
    launchSwitch.classList.toggle("on", mode === "about-blank");
  }

  launchSwitch.addEventListener("click", function () {
    var mode = localStorage.getItem(LAUNCH_KEY) || "same-tab";
    localStorage.setItem(LAUNCH_KEY, mode === "about-blank" ? "same-tab" : "about-blank");
    renderLaunchSwitch();
  });

  renderLaunchSwitch();

  var ENGINE_KEY = "velcro_proxy_engine";
  var engineSwitch = document.getElementById("engineSwitch");

  function renderEngineSwitch() {
    var engine = localStorage.getItem(ENGINE_KEY) || "scramjet";
    engineSwitch.classList.toggle("on", engine === "uv");
  }

  engineSwitch.addEventListener("click", function () {
    var engine = localStorage.getItem(ENGINE_KEY) || "scramjet";
    localStorage.setItem(ENGINE_KEY, engine === "uv" ? "scramjet" : "uv");
    renderEngineSwitch();
  });

  renderEngineSwitch();

  var WISP_KEY = "velcro_wisp_server";
  var wispServerInput = document.getElementById("wispServer");
  var wispSave = document.getElementById("wispSave");
  var wispReset = document.getElementById("wispReset");

  wispServerInput.value = localStorage.getItem(WISP_KEY) || "";

  wispSave.addEventListener("click", function () {
    var value = wispServerInput.value.trim();
    if (value) localStorage.setItem(WISP_KEY, value);
    else localStorage.removeItem(WISP_KEY);
  });

  wispReset.addEventListener("click", function () {
    localStorage.removeItem(WISP_KEY);
    wispServerInput.value = "";
  });
})();
