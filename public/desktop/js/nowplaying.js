function fmt(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return m + ":" + String(r).padStart(2, "0");
}

export function initNowPlaying() {
  const card = document.getElementById("nowplaying");
  const fill = document.getElementById("np-fill");
  const cur = document.getElementById("np-cur");
  const dur = document.getElementById("np-dur");
  const play = document.getElementById("np-play");
  const titleEl = document.getElementById("np-title");
  const artistEl = document.getElementById("np-artist");

  let total = 69;
  let t = 24;
  let playing = true;
  let timer = null;
  let video = null;

  function icon() {
    play.innerHTML = `<span class="msym">${playing ? "pause" : "play_arrow"}</span>`;
  }
  function paint() {
    const d = video ? video.duration : total;
    const c = video ? video.currentTime : t;
    fill.style.width = (d ? c / d * 100 : 0).toFixed(1) + "%";
    cur.textContent = fmt(c);
    dur.textContent = fmt(d);
  }
  function tick() {
    if (video || !playing) return;
    t += 1;
    if (t > total) t = 0;
    paint();
  }
  timer = setInterval(tick, 1000);

  play.addEventListener("click", () => {
    if (video) {
      if (video.paused) video.play().catch(() => {});
      else video.pause();
      return;
    }
    playing = !playing;
    icon();
  });
  document.getElementById("np-next").addEventListener("click", () => {
    if (video) video.currentTime = 0;
    else { t = 0; paint(); }
  });
  document.getElementById("np-prev").addEventListener("click", () => {
    if (video) video.currentTime = 0;
    else { t = 0; paint(); }
  });
  document.getElementById("np-close").addEventListener("click", () => { card.hidden = true; });
  document.querySelector(".np-track").addEventListener("click", e => {
    const r = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - r.left) / r.width;
    if (video && video.duration) video.currentTime = frac * video.duration;
    else { t = Math.round(frac * total); paint(); }
  });

  icon();
  paint();

  return {
    toggle() { card.hidden = !card.hidden; },
    bindVideo(el, name) {
      video = el;
      titleEl.textContent = name || "video";
      artistEl.textContent = "local file";
      card.querySelector(".np-src").textContent = "mp4 · os-vc-test";
      card.hidden = false;
      const sync = () => { playing = !video.paused; icon(); paint(); };
      video.addEventListener("loadedmetadata", paint);
      video.addEventListener("timeupdate", paint);
      video.addEventListener("play", sync);
      video.addEventListener("pause", sync);
      video.addEventListener("ended", sync);
      sync();
    }
  };
}
