(function () {
  var TOKEN_KEY = "velcro_token";
  var USERNAME_KEY = "velcro_username";
  var FAV_KEY = "velcro_fav_games";
  var RECENT_KEY = "velcro_recent_games";
  var SETTINGS_KEYS = ["velcro_theme", "velcro_wallpaper", "velcro_cursor", "velcro_custom_theme"];

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }
  function getUsername() {
    try { return localStorage.getItem(USERNAME_KEY); } catch (e) { return null; }
  }
  function setSession(token, username) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USERNAME_KEY, username);
    } catch (e) {}
  }
  function clearSession() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USERNAME_KEY);
    } catch (e) {}
  }

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || fallback); } catch (e) { return JSON.parse(fallback); }
  }

  function localSettings() {
    var s = {};
    SETTINGS_KEYS.forEach(function (k) {
      var v = localStorage.getItem(k);
      if (v !== null) s[k] = v;
    });
    return s;
  }

  function applySettings(s) {
    if (!s) return;
    Object.keys(s).forEach(function (k) {
      if (SETTINGS_KEYS.indexOf(k) !== -1) localStorage.setItem(k, s[k]);
    });
  }

  function mergeIds(a, b, cap) {
    var seen = {};
    var out = [];
    a.concat(b).forEach(function (id) {
      if (!seen[id]) { seen[id] = true; out.push(id); }
    });
    return cap ? out.slice(0, cap) : out;
  }

  async function apiFetch(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers, { "content-type": "application/json" });
    var token = getToken();
    if (token) opts.headers.authorization = "Bearer " + token;
    var r = await fetch(path, opts);
    var data = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(data.error || "request failed");
    return data;
  }

  async function signup(email, username, password) {
    var data = await apiFetch("/auth/signup", { method: "POST", body: JSON.stringify({ email: email, username: username, password: password }) });
    setSession(data.token, data.username);
    await sync();
    return data;
  }

  async function login(email, password) {
    var data = await apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email: email, password: password }) });
    setSession(data.token, data.username);
    await sync();
    return data;
  }

  function logout() {
    clearSession();
  }

  // pulls server state, merges with what's local, writes the merge back both
  // ways — so favorites/recents/theme follow you between devices.
  async function sync() {
    if (!getToken()) return null;
    try {
      var me = await apiFetch("/auth/me");
      var mergedFavs = mergeIds(readJSON(FAV_KEY, "[]"), me.favorites || []);
      var mergedRecent = mergeIds(readJSON(RECENT_KEY, "[]"), me.recents || [], 10);
      var mergedSettings = Object.assign({}, me.settings || {}, localSettings());

      localStorage.setItem(FAV_KEY, JSON.stringify(mergedFavs));
      localStorage.setItem(RECENT_KEY, JSON.stringify(mergedRecent));
      applySettings(mergedSettings);

      await apiFetch("/api/sync", {
        method: "PUT",
        body: JSON.stringify({ favorites: mergedFavs, recents: mergedRecent, settings: mergedSettings }),
      });
      return me;
    } catch (e) {
      return null;
    }
  }

  window.velcroAccount = {
    getToken: getToken,
    getUsername: getUsername,
    signup: signup,
    login: login,
    logout: logout,
    sync: sync,
  };

  document.addEventListener("DOMContentLoaded", function () {
    if (getToken()) sync();
  });
})();
