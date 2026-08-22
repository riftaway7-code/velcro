(function () {
  var CUSTOM_KEY = "velcro_custom_theme";
  var THEME_KEY = "velcro_theme";
  var WALLPAPER_KEY = "velcro_wallpaper";

  var WALLPAPERS = {
    aurora: "linear-gradient(135deg, #0f2027, #203a43, #2c5364)",
    sunset: "linear-gradient(135deg, #ff512f, #dd2476)",
    citrus: "linear-gradient(135deg, #f7971e, #ffd200)",
    candy: "linear-gradient(135deg, #ee9ca7, #ffdde1)",
    dusk: "linear-gradient(135deg, #2c3e50, #4ca1af)",
    grape: "linear-gradient(135deg, #41295a, #2f0743)",
  };

  var VARS = [
    "bg", "bg-elevated", "bg-elevated-hover",
    "accent", "accent-bright", "accent-glow", "accent-soft",
    "text", "text-muted", "border", "shadow",
    "icon-color", "cat-color", "filter-bg", "filter-text", "filter-border",
  ];

  function hexToRgb(hex) {
    hex = hex.replace("#", "");
    if (hex.length === 3) hex = hex.split("").map(function (c) { return c + c; }).join("");
    var n = parseInt(hex, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(function (v) {
      return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
    }).join("");
  }

  function luminance(hex) {
    var c = hexToRgb(hex);
    return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
  }

  function mix(hexA, hexB, weight) {
    var a = hexToRgb(hexA), b = hexToRgb(hexB);
    return rgbToHex(
      a.r + (b.r - a.r) * weight,
      a.g + (b.g - a.g) * weight,
      a.b + (b.b - a.b) * weight
    );
  }

  function lighten(hex, pct) { return mix(hex, "#ffffff", pct / 100); }
  function darken(hex, pct) { return mix(hex, "#000000", pct / 100); }

  function buildPalette(bg, accent) {
    var isDark = luminance(bg) < 0.5;
    var accentRgb = hexToRgb(accent);
    var p = {};

    if (isDark) {
      p["bg"] = bg;
      p["bg-elevated"] = lighten(bg, 10);
      p["bg-elevated-hover"] = lighten(bg, 16);
      p["border"] = lighten(bg, 22);
      p["text"] = "#f5f5f7";
      p["text-muted"] = lighten(bg, 55);
      p["accent-bright"] = lighten(accent, 12);
      p["icon-color"] = p["accent-bright"];
      p["cat-color"] = p["accent-bright"];
      p["filter-bg"] = p["bg-elevated"];
      p["filter-text"] = p["text-muted"];
      p["filter-border"] = p["border"];
      p["shadow"] = "rgba(0, 0, 0, 0.45)";
    } else {
      p["bg"] = bg;
      p["bg-elevated"] = darken(bg, 4);
      p["bg-elevated-hover"] = darken(bg, 8);
      p["border"] = darken(bg, 20);
      p["text"] = "#0d0d10";
      p["text-muted"] = darken(bg, 45);
      p["accent-bright"] = darken(accent, 12);
      p["icon-color"] = "#000000";
      p["cat-color"] = "#000000";
      p["filter-bg"] = "#000000";
      p["filter-text"] = "#f5f5f5";
      p["filter-border"] = "#000000";
      p["shadow"] = "rgba(0, 0, 0, 0.18)";
    }

    p["accent"] = accent;
    p["accent-glow"] = "rgba(" + accentRgb.r + ", " + accentRgb.g + ", " + accentRgb.b + ", 0.3)";
    p["accent-soft"] = mix(accent, bg, 0.55);
    return p;
  }

  function applyPalette(p) {
    VARS.forEach(function (key) {
      if (p[key]) document.documentElement.style.setProperty("--" + key, p[key]);
    });
  }

  function clearPalette() {
    VARS.forEach(function (key) {
      document.documentElement.style.removeProperty("--" + key);
    });
  }

  function applyWallpaper(value) {
    if (!value || value === "none") {
      document.documentElement.style.removeProperty("--wallpaper-image");
      document.documentElement.style.removeProperty("--wallpaper-scrim");
      return;
    }
    var css;
    if (value.indexOf("custom:") === 0) {
      var url = value.slice(7);
      css = "url('" + url.replace(/'/g, "%27") + "')";
    } else if (WALLPAPERS[value]) {
      css = WALLPAPERS[value];
    } else {
      document.documentElement.style.removeProperty("--wallpaper-image");
      document.documentElement.style.removeProperty("--wallpaper-scrim");
      return;
    }
    document.documentElement.style.setProperty("--wallpaper-image", css);
    document.documentElement.style.setProperty("--wallpaper-scrim", "0.45");
  }

  var VelcroTheme = {
    wallpapers: WALLPAPERS,
    getWallpaper: function () {
      return localStorage.getItem(WALLPAPER_KEY) || "none";
    },
    setWallpaper: function (value) {
      localStorage.setItem(WALLPAPER_KEY, value);
      applyWallpaper(value);
    },
    getCustom: function () {
      try {
        var raw = localStorage.getItem(CUSTOM_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    setCustom: function (bg, accent) {
      var data = { bg: bg, accent: accent };
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(data));
      applyPalette(buildPalette(bg, accent));
    },
    resetCustom: function () {
      localStorage.removeItem(CUSTOM_KEY);
      clearPalette();
    },
    apply: function () {
      var saved = localStorage.getItem(THEME_KEY);
      var theme = saved || "light";
      document.documentElement.setAttribute("data-theme", theme);

      var custom = this.getCustom();
      if (custom && custom.bg && custom.accent) {
        applyPalette(buildPalette(custom.bg, custom.accent));
      }

      applyWallpaper(this.getWallpaper());
    },
  };

  window.VelcroTheme = VelcroTheme;
  VelcroTheme.apply();
})();
