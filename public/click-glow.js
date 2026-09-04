(function () {
  document.addEventListener("pointerdown", function (e) {
    if (e.button !== 0 && e.button !== undefined) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
    }

    var ring = document.createElement("div");
    ring.className = "click-glow";
    ring.style.left = e.clientX + "px";
    ring.style.top = e.clientY + "px";
    document.body.appendChild(ring);

    ring.addEventListener("animationend", function () {
      ring.remove();
    }, { once: true });
  }, { passive: true });
})();
