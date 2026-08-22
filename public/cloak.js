(function () {
  var KEYS = {
    title: "velcro_cloak_title",
    favicon: "velcro_cloak_favicon",
  };

  function setFavicon(href) {
    var link = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = href || "data:,";
  }

  var VelcroCloak = {
    apply: function () {
      var title = localStorage.getItem(KEYS.title);
      var favicon = localStorage.getItem(KEYS.favicon);
      if (title) document.title = title;
      if (favicon) setFavicon(favicon);
    },
    save: function (title, favicon) {
      if (title) localStorage.setItem(KEYS.title, title);
      else localStorage.removeItem(KEYS.title);
      if (favicon) localStorage.setItem(KEYS.favicon, favicon);
      else localStorage.removeItem(KEYS.favicon);
      this.apply();
    },
    read: function () {
      return {
        title: localStorage.getItem(KEYS.title) || "",
        favicon: localStorage.getItem(KEYS.favicon) || "",
      };
    },
    clear: function () {
      localStorage.removeItem(KEYS.title);
      localStorage.removeItem(KEYS.favicon);
      document.title = "velcro";
      setFavicon("data:,");
    },
  };

  window.VelcroCloak = VelcroCloak;
  VelcroCloak.apply();
})();
