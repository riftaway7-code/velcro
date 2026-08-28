let z = 20;
let cascade = 0;
const open = new Map();
const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function focusWindow(el) {
  z += 1;
  el.style.zIndex = z;
  document.querySelectorAll(".win.focused").forEach(w => w.classList.remove("focused"));
  el.classList.add("focused");
}

function drag(el, handle) {
  handle.addEventListener("pointerdown", e => {
    if (e.target.closest(".win-dot")) return;
    focusWindow(el);
    const r = el.getBoundingClientRect();
    const dr = document.getElementById("desktop").getBoundingClientRect();
    const ox = e.clientX - r.left;
    const oy = e.clientY - r.top;
    handle.setPointerCapture(e.pointerId);
    const move = ev => {
      const nx = Math.min(Math.max(ev.clientX - ox - dr.left, 0), dr.width - 60);
      const ny = Math.min(Math.max(ev.clientY - oy - dr.top, 0), dr.height - 30);
      el.style.left = nx + "px";
      el.style.top = ny + "px";
    };
    const up = () => {
      handle.releasePointerCapture(e.pointerId);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  });
}

function resize(el, grip) {
  grip.addEventListener("pointerdown", e => {
    e.stopPropagation();
    focusWindow(el);
    const r = el.getBoundingClientRect();
    grip.setPointerCapture(e.pointerId);
    const move = ev => {
      el.style.width = Math.max(260, ev.clientX - r.left) + "px";
      el.style.height = Math.max(150, ev.clientY - r.top) + "px";
    };
    const up = () => {
      grip.releasePointerCapture(e.pointerId);
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
  });
}

export function createWindow(opts) {
  const { id, title, width = 560, height = 380, body } = opts;

  if (id && open.has(id)) {
    const existing = open.get(id);
    focusWindow(existing);
    return existing;
  }

  const el = document.createElement("section");
  el.className = "win";
  el.style.width = width + "px";
  el.style.height = height + "px";
  const dr = document.getElementById("desktop").getBoundingClientRect();
  const gx = 44 + (cascade % 6) * 34;
  const gy = 40 + (cascade % 6) * 30;
  cascade += 1;
  el.style.left = Math.max(0, Math.min(gx, dr.width - width - 20)) + "px";
  el.style.top = Math.max(0, Math.min(gy, dr.height - height - 20)) + "px";

  const bar = document.createElement("header");
  bar.className = "win-bar";
  bar.innerHTML = `<span class="win-title"></span>
    <button class="win-dot min" title="minimize"></button>
    <button class="win-dot close" title="close"></button>`;
  bar.querySelector(".win-title").textContent = title;

  const content = document.createElement("div");
  content.className = "win-body";
  if (typeof body === "string") content.innerHTML = body;
  else if (body instanceof Node) content.appendChild(body);

  const grip = document.createElement("div");
  grip.className = "win-resize";

  el.append(bar, content, grip);
  document.getElementById("desktop").appendChild(el);

  if (!REDUCE) {
    el.classList.add("win-opening");
    el.addEventListener("animationend", function once() {
      el.classList.remove("win-opening");
      el.removeEventListener("animationend", once);
    });
  }

  const shut = () => {
    if (REDUCE) {
      el.remove();
      if (id) open.delete(id);
      return;
    }
    el.classList.add("win-closing");
    el.addEventListener("animationend", () => {
      el.remove();
      if (id) open.delete(id);
    }, { once: true });
  };
  bar.querySelector(".close").addEventListener("click", shut);
  bar.querySelector(".min").addEventListener("click", () => { el.style.display = el.style.display === "none" ? "" : "none"; });
  el.addEventListener("pointerdown", () => focusWindow(el), true);

  drag(el, bar);
  resize(el, grip);
  focusWindow(el);

  if (id) open.set(id, el);
  el._body = content;
  el._close = shut;
  return el;
}
