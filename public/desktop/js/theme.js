const VARS = [
  "sky-top", "sky-mid", "sky-low", "wp-sun", "wp-mtn-far", "wp-mtn-mid", "wp-water", "wp-tree", "wp-goose",
  "bar-bg", "bar-fg", "bar-fg-dim", "bar-accent", "bar-active-bg", "bar-pill-bg", "bar-border",
  "win-bg", "win-fg", "win-border", "win-radius", "win-shadow",
  "term-fg", "term-dim", "term-accent", "term-pink", "term-purple", "term-cursor", "term-sel",
  "card-bg", "card-fg", "card-dim", "accent", "accent-2"
];

export const THEMES = {
  apollo: {
    "sky-top": "#b5643a", "sky-mid": "#bd7853", "sky-low": "#b0716b", "wp-sun": "#edb07a",
    "wp-mtn-far": "#6d5a6b", "wp-mtn-mid": "#97625a", "wp-water": "#b17d77", "wp-tree": "#7c4f54", "wp-goose": "#3a2a2f",
    "bar-bg": "rgba(30, 21, 25, 0.9)", "bar-fg": "#dcc6ba", "bar-fg-dim": "#9c8078", "bar-accent": "#e0824a",
    "bar-active-bg": "rgba(224, 130, 74, 0.22)", "bar-pill-bg": "rgba(255,255,255,0.06)", "bar-border": "rgba(232,200,180,0.1)",
    "win-bg": "rgba(28, 20, 24, 0.84)", "win-fg": "#e6d3c6", "win-border": "rgba(232,200,180,0.14)",
    "term-fg": "#e6d3c6", "term-dim": "#a98d80", "term-accent": "#e0824a", "term-pink": "#cd7a95",
    "term-purple": "#8f6ca0", "term-cursor": "#e0824a", "term-sel": "rgba(224,130,74,0.3)",
    "card-bg": "#2a1f24", "card-fg": "#e6d3c6", "card-dim": "#a98d80", "accent": "#e08a6a", "accent-2": "#cd7a95"
  },
  nocturne: {
    "sky-top": "#1b2b4b", "sky-mid": "#2b3a5c", "sky-low": "#3b4a63", "wp-sun": "#8fb6d9",
    "wp-mtn-far": "#3a4a68", "wp-mtn-mid": "#33507a", "wp-water": "#2f4666", "wp-tree": "#233450", "wp-goose": "#141c2c",
    "bar-bg": "rgba(16, 22, 36, 0.9)", "bar-fg": "#c8d4e6", "bar-fg-dim": "#7688a3", "bar-accent": "#6fb3d9",
    "bar-active-bg": "rgba(111,179,217,0.2)", "bar-pill-bg": "rgba(255,255,255,0.06)", "bar-border": "rgba(200,220,240,0.1)",
    "win-bg": "rgba(14, 20, 32, 0.86)", "win-fg": "#d7e2f0", "win-border": "rgba(200,220,240,0.14)",
    "term-fg": "#d7e2f0", "term-dim": "#7f92ad", "term-accent": "#7fc4e6", "term-pink": "#c58fd0",
    "term-purple": "#8a9ff0", "term-cursor": "#7fc4e6", "term-sel": "rgba(127,196,230,0.28)",
    "card-bg": "#141c2c", "card-fg": "#d7e2f0", "card-dim": "#7f92ad", "accent": "#7fc4e6", "accent-2": "#c58fd0"
  },
  moss: {
    "sky-top": "#2f3b2c", "sky-mid": "#3d4a34", "sky-low": "#4a5340", "wp-sun": "#c9d18a",
    "wp-mtn-far": "#43503c", "wp-mtn-mid": "#556b3f", "wp-water": "#495640", "wp-tree": "#2f3a29", "wp-goose": "#1a2016",
    "bar-bg": "rgba(24, 30, 22, 0.9)", "bar-fg": "#d6ddc4", "bar-fg-dim": "#8a9678", "bar-accent": "#a7c063",
    "bar-active-bg": "rgba(167,192,99,0.2)", "bar-pill-bg": "rgba(255,255,255,0.06)", "bar-border": "rgba(220,230,200,0.1)",
    "win-bg": "rgba(20, 26, 18, 0.86)", "win-fg": "#e2e8d2", "win-border": "rgba(220,230,200,0.14)",
    "term-fg": "#e2e8d2", "term-dim": "#93a07d", "term-accent": "#b7cf6f", "term-pink": "#d08f8f",
    "term-purple": "#a3b06f", "term-cursor": "#b7cf6f", "term-sel": "rgba(183,207,111,0.26)",
    "card-bg": "#1a2016", "card-fg": "#e2e8d2", "card-dim": "#93a07d", "accent": "#b7cf6f", "accent-2": "#d0a37a"
  }
};

export function applyTheme(theme) {
  const root = document.documentElement;
  for (const k of VARS) {
    if (theme[k] != null) root.style.setProperty("--" + k, theme[k]);
  }
  try { localStorage.setItem("osvc_theme", JSON.stringify(theme)); } catch (e) {}
}

export function currentTheme() {
  const cs = getComputedStyle(document.documentElement);
  const out = {};
  for (const k of VARS) out[k] = cs.getPropertyValue("--" + k).trim();
  return out;
}

export function restoreTheme() {
  try {
    const raw = localStorage.getItem("osvc_theme");
    if (raw) applyTheme(JSON.parse(raw));
  } catch (e) {}
}

function hexes(text) {
  return (text.match(/#[0-9a-fA-F]{6}/g) || []).map(h => h.toLowerCase());
}

export function parseDotColors(text) {
  const t = text.trim();
  let bg, fg, list = [];

  try {
    const j = JSON.parse(t);
    if (j.special || j.colors) {
      bg = j.special && j.special.background;
      fg = j.special && j.special.foreground;
      if (j.colors) list = Object.keys(j.colors).sort().map(k => j.colors[k]);
    }
  } catch (e) {}

  if (!list.length) {
    const xr = {};
    t.split(/\r?\n/).forEach(line => {
      const m = line.match(/(?:^|\*|\.)?(background|foreground|color\d{1,2})\s*:\s*(#[0-9a-fA-F]{6})/);
      if (m) xr[m[1]] = m[2];
    });
    if (Object.keys(xr).length) {
      bg = bg || xr.background;
      fg = fg || xr.foreground;
      list = Object.keys(xr).filter(k => k.startsWith("color")).sort((a, b) => +a.slice(5) - +b.slice(5)).map(k => xr[k]);
    }
  }

  if (!list.length) {
    const h = hexes(t);
    if (!h.length) return null;
    bg = bg || h[0];
    fg = fg || h[h.length - 1];
    list = h;
  }

  bg = bg || "#1c1418";
  fg = fg || "#e6d3c6";
  const c = (i, d) => list[i] || d;
  const accent = c(3, c(1, "#e0824a"));
  const pink = c(5, c(1, "#cd7a95"));
  const purple = c(4, "#8f6ca0");
  const tree = c(0, bg);

  const alpha = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255}, ${a})`;
  };

  return {
    "sky-top": accent, "sky-mid": pink, "sky-low": purple, "wp-sun": c(3, "#edb07a"),
    "wp-mtn-far": purple, "wp-mtn-mid": pink, "wp-water": alpha(pink, 0.8), "wp-tree": tree, "wp-goose": bg,
    "bar-bg": alpha(bg, 0.9), "bar-fg": fg, "bar-fg-dim": alpha(fg, 0.55), "bar-accent": accent,
    "bar-active-bg": alpha(accent, 0.22), "bar-border": alpha(fg, 0.12),
    "win-bg": alpha(bg, 0.85), "win-fg": fg, "win-border": alpha(fg, 0.14),
    "term-fg": fg, "term-dim": alpha(fg, 0.6), "term-accent": accent, "term-pink": pink,
    "term-purple": purple, "term-cursor": accent, "term-sel": alpha(accent, 0.3),
    "card-bg": bg, "card-fg": fg, "card-dim": alpha(fg, 0.6), "accent": accent, "accent-2": pink
  };
}
