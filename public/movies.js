(function () {
  var API_KEY = "805a6a6661151cfd3927e1186c1f444e";
  var BASE_URL = "https://api.themoviedb.org/3";

  var gridEl = document.getElementById("moviesGrid");
  var emptyEl = document.getElementById("emptyState");
  var typePillsEl = document.getElementById("typePills");
  var searchInput = document.getElementById("searchInput");
  var modal = document.getElementById("movieModal");
  var modalFrame = document.getElementById("modalFrame");

  var activeType = "all";
  var currentPage = 1;
  var isLoading = false;
  var isSearching = false;

  function posterUrl(path) {
    if (!path) return "";
    return "https://image.tmdb.org/t/p/w500" + path;
  }

  function fetchPopular(page, type) {
    var movieUrl = BASE_URL + "/movie/popular?api_key=" + API_KEY + "&page=" + page;
    var tvUrl = BASE_URL + "/tv/popular?api_key=" + API_KEY + "&page=" + page;

    if (type === "movie") {
      return fetch(movieUrl).then(function (r) { return r.json(); }).then(function (res) {
        return (res.results || []).map(function (i) { i.media_type = "movie"; return i; });
      });
    }
    if (type === "tv") {
      return fetch(tvUrl).then(function (r) { return r.json(); }).then(function (res) {
        return (res.results || []).map(function (i) { i.media_type = "tv"; return i; });
      });
    }
    return Promise.all([
      fetch(movieUrl).then(function (r) { return r.json(); }),
      fetch(tvUrl).then(function (r) { return r.json(); }),
    ]).then(function (both) {
      var movies = (both[0].results || []).map(function (i) { i.media_type = "movie"; return i; });
      var tv = (both[1].results || []).map(function (i) { i.media_type = "tv"; return i; });
      return movies.concat(tv);
    });
  }

  function searchAll(query) {
    var url = BASE_URL + "/search/multi?api_key=" + API_KEY + "&query=" + encodeURIComponent(query);
    return fetch(url).then(function (r) { return r.json(); }).then(function (res) {
      return (res.results || []).filter(function (i) { return i.media_type === "movie" || i.media_type === "tv"; });
    });
  }

  function createCard(item) {
    var title = item.title || item.name || "unknown";
    var year = (item.release_date || item.first_air_date || "").split("-")[0];

    var card = document.createElement("div");
    card.className = "game-card movie-card";
    card.style.cursor = "pointer";

    var cover = document.createElement("span");
    cover.className = "cover";
    if (item.poster_path) cover.style.backgroundImage = "url('" + posterUrl(item.poster_path) + "')";

    var info = document.createElement("span");
    info.className = "info";

    var name = document.createElement("span");
    name.className = "name";
    name.textContent = title;

    var cat = document.createElement("span");
    cat.className = "cat";
    cat.textContent = item.media_type === "tv" ? "show" : "movie" + (year ? " · " + year : "");

    info.appendChild(name);
    info.appendChild(cat);
    card.appendChild(cover);
    card.appendChild(info);
    card.addEventListener("click", function () { openModal(item); });
    gridEl.appendChild(card);
  }

  function probe(url) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 4000);
    return fetch(url, { mode: "no-cors", signal: ctrl.signal }).then(function () {
      clearTimeout(timer);
      return url;
    }).catch(function () {
      clearTimeout(timer);
      return Promise.reject(new Error("unreachable"));
    });
  }

  function autoSelectSource(sources, sourceSelect) {
    modalFrame.src = "";
    var attempts = sources.map(probe);
    Promise.any ? Promise.any(attempts).catch(function () { return null; }).then(function (winner) {
      var best = winner || sources[0];
      pickSource(best, sourceSelect);
    }) : pickSource(sources[0], sourceSelect);
  }

  function pickSource(url, sourceSelect) {
    var opts = sourceSelect.options;
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].value === url) { opts[i].selected = true; break; }
    }
    modalFrame.src = url;
  }

  function sourceLabel(url) {
    try { return new URL(url).hostname.replace("www.", ""); } catch (e) { return "source"; }
  }

  function buildSourceSelect(sources) {
    var select = document.createElement("select");
    sources.forEach(function (url) {
      var opt = document.createElement("option");
      opt.value = url;
      opt.textContent = sourceLabel(url);
      select.appendChild(opt);
    });
    return select;
  }

  function fetchSeasons(tvId, seasonSelect) {
    var url = BASE_URL + "/tv/" + tvId + "?api_key=" + API_KEY;
    fetch(url).then(function (r) { return r.json(); }).then(function (res) {
      var seasons = (res.seasons || []).filter(function (s) { return s.season_number > 0; });
      seasonSelect.innerHTML = '<option value="">season</option>';
      seasons.forEach(function (s) {
        var opt = document.createElement("option");
        opt.value = s.season_number;
        opt.textContent = "season " + s.season_number;
        seasonSelect.appendChild(opt);
      });
    });
  }

  function fetchEpisodes(tvId, seasonNum, episodeSelect) {
    var url = BASE_URL + "/tv/" + tvId + "/season/" + seasonNum + "?api_key=" + API_KEY;
    fetch(url).then(function (r) { return r.json(); }).then(function (res) {
      var episodes = res.episodes || [];
      episodeSelect.innerHTML = '<option value="">episode</option>';
      episodes.forEach(function (ep) {
        var opt = document.createElement("option");
        opt.value = ep.episode_number;
        opt.textContent = "episode " + ep.episode_number;
        episodeSelect.appendChild(opt);
      });
      episodeSelect.style.display = "inline-block";
    });
  }

  function openModal(item) {
    var title = item.title || item.name || "unknown";
    var year = (item.release_date || item.first_air_date || "").split("-")[0];
    var isTV = item.media_type === "tv";
    var rating = item.vote_average ? item.vote_average.toFixed(1) : "n/a";

    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalYear").textContent = year;
    document.getElementById("modalType").textContent = isTV ? "tv series" : "movie";
    document.getElementById("modalRating").textContent = "⭐ " + rating;
    document.getElementById("modalPoster").src = posterUrl(item.poster_path);
    document.getElementById("modalDesc").textContent = item.overview || "no description available.";

    var controls = document.getElementById("modalControls");
    controls.innerHTML = "";

    var movieSources = [
      "https://vidsrc.xyz/embed/movie?tmdb=" + item.id,
      "https://player.vidsrc.co/embed/movie/" + item.id,
      "https://vidsrc.win/embed/movie?tmdb=" + item.id,
      "https://vidlink.pro/movie/" + item.id,
    ];
    var tvSources = [
      "https://vidsrc.xyz/embed/tv?tmdb=" + item.id,
      "https://player.vidsrc.co/embed/tv/" + item.id,
      "https://vidsrc.win/embed/tv?tmdb=" + item.id,
    ];

    if (isTV) {
      var seasonSelect = document.createElement("select");
      seasonSelect.innerHTML = '<option value="">season</option>';
      var episodeSelect = document.createElement("select");
      episodeSelect.innerHTML = '<option value="">episode</option>';
      episodeSelect.style.display = "none";
      var sourceSelect = buildSourceSelect(tvSources);

      seasonSelect.addEventListener("change", function () {
        if (seasonSelect.value) fetchEpisodes(item.id, seasonSelect.value, episodeSelect);
      });
      episodeSelect.addEventListener("change", function () {
        if (!seasonSelect.value || !episodeSelect.value) return;
        var sources = [
          "https://vidsrc.xyz/embed/tv?tmdb=" + item.id + "&season=" + seasonSelect.value + "&episode=" + episodeSelect.value,
          "https://player.vidsrc.co/embed/tv/" + item.id + "/" + seasonSelect.value + "/" + episodeSelect.value,
          "https://vidsrc.win/embed/tv?tmdb=" + item.id + "&season=" + seasonSelect.value + "&episode=" + episodeSelect.value,
        ];
        sourceSelect.innerHTML = "";
        sources.forEach(function (url) {
          var opt = document.createElement("option");
          opt.value = url;
          opt.textContent = sourceLabel(url);
          sourceSelect.appendChild(opt);
        });
        autoSelectSource(sources, sourceSelect);
      });
      sourceSelect.addEventListener("change", function () { modalFrame.src = sourceSelect.value; });

      controls.appendChild(seasonSelect);
      controls.appendChild(episodeSelect);
      controls.appendChild(sourceSelect);
      fetchSeasons(item.id, seasonSelect);
    } else {
      var movieSourceSelect = buildSourceSelect(movieSources);
      movieSourceSelect.addEventListener("change", function () { modalFrame.src = movieSourceSelect.value; });
      controls.appendChild(movieSourceSelect);
      autoSelectSource(movieSources, movieSourceSelect);
    }

    modal.classList.add("active");
  }

  function closeModal() {
    modal.classList.remove("active");
    modalFrame.src = "";
  }

  document.getElementById("movieModalClose").addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });

  function loadMore() {
    if (isLoading || isSearching) return;
    isLoading = true;
    if (currentPage === 1) gridEl.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>loading&hellip;</p></div>';

    fetchPopular(currentPage, activeType).then(function (items) {
      if (currentPage === 1) gridEl.innerHTML = "";
      emptyEl.hidden = true;
      items.forEach(createCard);
      currentPage++;
      isLoading = false;
    });
  }

  function runSearch() {
    var query = searchInput.value.trim();
    if (!query) {
      isSearching = false;
      currentPage = 1;
      loadMore();
      return;
    }
    isSearching = true;
    gridEl.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>searching&hellip;</p></div>';
    emptyEl.hidden = true;

    searchAll(query).then(function (results) {
      if (activeType !== "all") {
        results = results.filter(function (i) { return i.media_type === activeType; });
      }
      gridEl.innerHTML = "";
      if (results.length === 0) {
        emptyEl.hidden = false;
      } else {
        results.forEach(createCard);
      }
    });
  }

  searchInput.addEventListener("input", function () {
    clearTimeout(searchInput._debounce);
    searchInput._debounce = setTimeout(runSearch, 450);
  });

  typePillsEl.querySelectorAll(".pill").forEach(function (pill) {
    pill.addEventListener("click", function () {
      activeType = pill.dataset.type;
      typePillsEl.querySelectorAll(".pill").forEach(function (p) { p.classList.remove("active"); });
      pill.classList.add("active");
      if (searchInput.value.trim()) {
        runSearch();
      } else {
        currentPage = 1;
        isSearching = false;
        loadMore();
      }
    });
  });

  window.addEventListener("scroll", function () {
    if (isSearching) return;
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) loadMore();
  });

  loadMore();
})();
