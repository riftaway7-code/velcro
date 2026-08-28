export const FS = {
  "notes.md": `# notes

- os-vc-test is a browser desktop mockup of an arch + niri rice
- theme lives entirely in css custom properties (see css/theme.css)
- Settings app can import pywal / Xresources / a list of hex and remap the vars
- drop the real dotfiles in and convert them field by field
`,
  "todo.txt": `[ ] wire real waybar module spacing
[ ] port alacritty colors -> --term-* vars
[x] draggable windows
[x] fastfetch panel
[ ] make the geese migrate on a timer
`,
  "projects": {
    "os-vc-test": {
      "README.md": "see the top-level README.md for the run + theming guide.",
      "public": { "index.html": "<!doctype html> ...", "css": {}, "js": {} }
    }
  },
  ".config": {
    "niri": {
      "config.kdl": `input {
    keyboard { xkb { layout "us" } }
    touchpad { tap; natural-scroll }
}
layout {
    gaps 12
    center-focused-column "never"
    default-column-width { proportion 0.5 }
}
`
    },
    "waybar": {
      "style.css": `* {
    font-family: "JetBrainsMono Nerd Font";
    font-size: 12px;
}
window#waybar {
    background: rgba(30, 21, 25, 0.9);
    color: #dcc6ba;
}
#workspaces button.active {
    background: rgba(224, 130, 74, 0.22);
    color: #dcc6ba;
}
`
    },
    "alacritty": {
      "alacritty.toml": `[colors.primary]
background = "#1c1418"
foreground = "#e6d3c6"

[colors.normal]
red     = "#cd7a95"
yellow  = "#e0824a"
magenta = "#8f6ca0"
`
    }
  }
};

export function resolve(pathArr) {
  let node = FS;
  for (const seg of pathArr) {
    if (seg === "~" || seg === "") continue;
    if (node && typeof node === "object" && seg in node) node = node[seg];
    else return null;
  }
  return node;
}

export function isDir(node) {
  return node && typeof node === "object";
}

export function listing(node) {
  if (!isDir(node)) return [];
  return Object.keys(node).map(name => ({ name, dir: isDir(node[name]) }));
}
