let dtz = "UTC";
try { dtz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) {}

const DEFAULTS = { user: "velcro", host: "archlinux", tz: dtz, setup: true };

let loaded;
try {
  loaded = { ...DEFAULTS, ...JSON.parse(localStorage.getItem("osvc_config") || "{}") };
} catch (e) {
  loaded = { ...DEFAULTS };
}

export const config = loaded;

export function saveConfig() {
  try { localStorage.setItem("osvc_config", JSON.stringify(config)); } catch (e) {}
}
