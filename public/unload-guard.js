(function () {
  let allowNext = false;

  window.addEventListener("beforeunload", function (e) {
    if (allowNext) return;
    e.preventDefault();
    e.returnValue = "";
  });

  // clicking one of the site's own links (nav pills, game cards, etc.) is a
  // normal page-to-page transition, not the user trying to leave the site —
  // only suppress the prompt for that one navigation, not for closing the tab.
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest("a[href]");
    if (!a) return;
    if (a.target && a.target !== "_self") return;
    let url;
    try { url = new URL(a.href, location.href); } catch { return; }
    if (url.origin !== location.origin) return;

    allowNext = true;
    setTimeout(function () { allowNext = false; }, 1000);
  }, true);
})();
