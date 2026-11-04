(function () {
  "use strict";

  var TZ = "America/Argentina/Buenos_Aires";
  var config = window.SITE_CONFIG || {};
  var $ = function (s, root) { return (root || document).querySelector(s); };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  /* Sin viudas: une las dos últimas palabras */
  function nb(s) {
    s = String(s || "").trim();
    return s.split(/\s+/).length >= 4 ? s.replace(/\s+(\S+)$/, "\u00a0$1") : s;
  }
  function fmt(iso, opts) {
    return new Intl.DateTimeFormat("es-AR", Object.assign({ timeZone: TZ }, opts)).format(new Date(iso));
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  var longDate = function (iso) { return fmt(iso, { day: "numeric", month: "long", year: "numeric" }); };
  var dayTitle = function (iso) { return cap(fmt(iso, { weekday: "long", day: "numeric", month: "long" })); };
  var time = function (iso) { return fmt(iso, { hour: "2-digit", minute: "2-digit", hour12: false }); };
  var shortDay = function (iso) { return cap(fmt(iso, { weekday: "short" }).replace(".", "")) + " " + fmt(iso, { day: "numeric", month: "numeric" }); };

  function team(name) {
    return String(name || "")
      .replace(/\s*\((div(isi[oó]n|\.)?\s*\d+)\)/i, "")
      .replace(/\s+Club$/i, "")
      .trim();
  }
  function competition(name) {
    var n = String(name || "");
    if (/women|femen|mujeres/i.test(n)) {
      if (/summer|verano/i.test(n)) return { key: "fem", title: "Liga de Verano HP", sub: "Femenina", pink: true };
      if (/div\w*\s*1|primera/i.test(n)) return { key: "fem", title: "Primera femenina", sub: "División 1", pink: true };
      return { key: "fem", title: "Femenino", sub: n, pink: true };
    }
    if (/norte|north/i.test(n)) return { key: "otros", title: "Norte y Sur", sub: n.replace(/norte\s*&\s*sur/i, "").trim() };
    if (/division 1|div\. ?1/i.test(n)) return { key: "d1", title: "División 1", sub: "Primera masculina" };
    if (/division 2|div\. ?2/i.test(n)) return { key: "d2", title: "División 2", sub: "Segunda división" };
    if (/warm|amistoso/i.test(n)) return { key: "otros", title: "Amistosos", sub: "Partidos de preparación" };
    return { key: "otros", title: n, sub: "" };
  }
  function crest(t, size) {
    if (t.logo) return '<img src="' + esc(t.logo) + '" alt="" width="' + size + '" height="' + size + '" loading="lazy">';
    var initials = team(t.name).split(/\s+/).map(function (w) { return w.charAt(0); }).join("").slice(0, 2).toUpperCase();
    return '<span class="crest-txt' + (size > 30 ? " crest-lg" : "") + '">' + esc(initials) + "</span>";
  }
  function winText(m) {
    if (/tie/i.test(m.result)) return "Empate";
    if (!m.winner) return /abandon|no ?result/i.test(m.result) ? "Sin resultado" : "";
    var by = String(m.winBy || "").replace(/\bruns?\b/i, function (r) { return /s$/i.test(r) ? "carreras" : "carrera"; });
    return team(m.winner) + " ganó" + (by ? " por " + by : "");
  }

  /* Noticias del hero */
  function renderNews(news) {
    news.forEach(function (n, i) {
      var el = $('[data-news="' + i + '"]');
      if (!el) return;
      el.href = n.url;
      var img = $("img", el);
      if (n.image) { img.src = n.image; img.alt = n.title; img.removeAttribute("width"); img.removeAttribute("height"); }
      var kicker = $(".kicker", el);
      if (n.category) kicker.textContent = cap(n.category.toLowerCase());
      kicker.classList.toggle("kicker-pink", /femen|flamingo|mujer/i.test(n.title + n.category));
      $(i === 0 ? "h1" : "h2", el).textContent = nb(n.title);
      $("[data-date]", el).textContent = longDate(n.date);
    });
  }

  /* Ticker, próximo partido y fixture */
  function renderUpcoming(list) {
    if (!list.length) return;
    $("[data-ticker]").innerHTML = list.slice(0, 10).map(function (m) {
      var c = competition(m.competition);
      return '<a class="tick" href="' + esc(m.url) + '" target="_blank" rel="noopener">' +
        '<span class="tick-comp">' + esc(c.title) + " · " + esc(shortDay(m.start)) + " · " + esc(time(m.start)) + "</span>" +
        '<span class="tick-team">' + crest(m.a, 20) + esc(team(m.a.name)) + "</span>" +
        '<span class="tick-team">' + crest(m.b, 20) + esc(team(m.b.name)) + "</span></a>";
    }).join("");

    var next = list[0], c0 = competition(next.competition);
    $("[data-next-comp]").textContent = "Próximo partido · " + c0.title;
    $("[data-next-when]").textContent = dayTitle(next.start) + ", " + time(next.start);
    $("[data-next-ground]").textContent = next.ground;
    [["[data-next-a]", next.a], ["[data-next-b]", next.b]].forEach(function (p) {
      var box = $(p[0]);
      box.innerHTML = crest(p[1], 84).replace(' loading="lazy"', "") + "<strong>" + esc(team(p[1].name)) + "</strong>";
    });
    $("[data-countdown]").setAttribute("data-countdown", next.start);

    var html = "", day = "";
    list.forEach(function (m) {
      var d = dayTitle(m.start), c = competition(m.competition);
      if (d !== day) { day = d; html += '<h3 class="fx-day">' + esc(d) + "</h3>"; }
      html += '<article class="fx" data-comp="' + c.key + '">' +
        '<span class="fx-comp"><b' + (c.pink ? ' class="b-pink"' : "") + ">" + esc(c.title) + "</b> " + esc([c.sub, m.overs ? m.overs + " overs" : ""].filter(Boolean).join(" · ")) + "</span>" +
        '<span class="fx-team">' + crest(m.a, 40) + esc(team(m.a.name)) + "</span>" +
        '<span class="fx-time">' + esc(time(m.start)) + "</span>" +
        '<span class="fx-team fx-away">' + crest(m.b, 40) + esc(team(m.b.name)) + "</span>" +
        '<span class="fx-venue"><i class="bi bi-geo-alt"></i> ' + esc(m.ground) + "</span></article>";
    });
    var box = $("[data-fixtures]");
    var empty = $("[data-fx-empty]");
    box.innerHTML = html;
    box.appendChild(empty);
    var sel = $('[data-filter][aria-selected="true"]');
    if (sel) sel.click();
  }

  /* Últimos resultados */
  function renderResults(list) {
    if (!list.length) return;
    $("[data-results]").innerHTML = list.map(function (m) {
      var c = competition(m.competition);
      var row = function (t) {
        var won = m.winner && team(m.winner) === team(t.name);
        var score = /yet to bat/i.test(t.score) ? "No bateó" : (t.score || "–");
        return '<span class="res-team' + (won ? " is-win" : "") + '">' + crest(t, 28) + "<span>" + esc(team(t.name)) + "</span><b>" + esc(score) + "</b></span>";
      };
      return '<a class="res" href="' + esc(m.url) + '" target="_blank" rel="noopener">' +
        '<span class="res-comp"><b' + (c.pink ? ' class="b-pink"' : "") + ">" + esc(c.title) + "</b> " + esc(fmt(m.start, { day: "numeric", month: "short" })) + "</span>" +
        row(m.a) + row(m.b) +
        '<span class="res-win">' + esc(winText(m)) + "</span></a>";
    }).join("");
    $("[data-results-wrap]").hidden = false;
  }

  /* Líderes estadísticos */
  function renderLeaders(l) {
    if (!l || !l.items || !l.items.length) return;
    if (l.tournament) $("[data-leaders-title]").textContent = l.tournament.replace(/\s*&\s*/, " y ");
    $("[data-leaders]").innerHTML = l.items.map(function (p) {
      var initials = p.name.split(/\s+/).map(function (w) { return w.charAt(0); }).join("").slice(0, 2).toUpperCase();
      var t = team(p.team);
      return '<article class="leader">' +
        (p.photo
          ? '<div class="leader-photo"><img src="' + esc(p.photo) + '" alt="' + esc(p.name) + '" loading="lazy"></div>'
          : '<div class="leader-photo leader-empty"><span>' + esc(initials) + "</span></div>") +
        '<div class="leader-body"><span class="leader-stat">' + esc(p.label) + "</span>" +
        '<strong class="leader-num">' + esc(p.value) + "</strong>" +
        "<h3>" + esc(p.name) + "</h3>" +
        '<span class="leader-team' + (/sur/i.test(t) ? " team-sur" : "") + '">' + esc(t) + "</span></div></article>";
    }).join("");
  }

  /* Galería */
  function renderAlbums(list) {
    if (!list.length) return;
    $("[data-albums]").innerHTML = list.slice(0, 4).map(function (a, i) {
      return '<a class="album' + (i === 0 ? " album-a" : i === 1 ? " album-b" : "") + '" href="' + esc(a.url) + '" target="_blank" rel="noopener">' +
        '<img src="' + esc(a.image) + '" alt="" loading="lazy">' +
        '<span class="album-body"><h3>' + esc(nb(a.title.replace(/M9-M12/g, "M9\u2011M12"))) + "</h3>" +
        "<span>" + esc(longDate(a.date)) + " · " + a.count + " fotos</span></span></a>";
    }).join("");
  }

  /* Instagram vía Behold */
  function renderInstagram() {
    if (!config.beholdFeedId) return;
    fetch("https://feeds.behold.so/" + encodeURIComponent(config.beholdFeedId))
      .then(function (r) { if (!r.ok) throw r; return r.json(); })
      .then(function (d) {
        var posts = (Array.isArray(d) ? d : d.posts || []).slice(0, 6);
        if (!posts.length) return;
        var box = $("[data-ig-feed]");
        box.innerHTML = '<h3 class="feed-title"><i class="bi bi-instagram"></i> Instagram</h3><div class="ig-grid">' + posts.map(function (p) {
          var src = (p.sizes && p.sizes.medium && p.sizes.medium.mediaUrl) || (p.mediaType === "VIDEO" ? p.thumbnailUrl : p.mediaUrl);
          var text = p.prunedCaption || p.caption || "";
          return '<a class="ig-post" href="' + esc(p.permalink) + '" target="_blank" rel="noopener">' +
            '<img src="' + esc(src) + '" alt="' + esc(text.slice(0, 120)) + '" loading="lazy">' +
            (p.mediaType === "VIDEO" ? '<i class="bi bi-play-fill ig-video"></i>' : "") +
            '<span class="ig-caption">' + esc(text.slice(0, 110)) + "</span></a>";
        }).join("") + "</div>";
        box.hidden = false;
        layoutSocial();
      })
      .catch(function () {});
  }

  /* Facebook (lo trae GitHub Actions a data/facebook.json) */
  function renderFacebook(d) {
    var posts = (d && d.posts || []).slice(0, 3);
    if (!posts.length) return;
    var box = $("[data-fb-feed]");
    box.innerHTML = '<h3 class="feed-title"><i class="bi bi-facebook"></i> Facebook</h3>' + posts.map(function (p) {
      return '<a class="fb-post" href="' + esc(p.url) + '" target="_blank" rel="noopener">' +
        (p.image ? '<img src="' + esc(p.image) + '" alt="" loading="lazy">' : "") +
        '<span class="fb-body"><span class="fb-date">' + esc(longDate(p.date)) + "</span>" +
        "<p>" + esc(nb(p.text)) + "</p></span></a>";
    }).join("");
    box.hidden = false;
    layoutSocial();
  }
  function layoutSocial() {
    var both = !$("[data-ig-feed]").hidden && !$("[data-fb-feed]").hidden;
    $(".social-grid").classList.toggle("is-split", both);
  }

  if (config.instagram) $("[data-ig-link]").href = "https://www.instagram.com/" + config.instagram + "/";
  if (config.facebook) $("[data-fb-link]").href = "https://www.facebook.com/" + config.facebook;

  var get = function (url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw r; return r.json(); });
  };
  get("data/cricheroes.json").then(function (d) {
    var steps = [
      function () { renderNews(d.news || []); },
      function () { renderUpcoming(d.upcoming || []); },
      function () { renderResults(d.results || []); },
      function () { renderLeaders(d.leaders); },
      function () { renderAlbums(d.albums || []); }
    ];
    steps.forEach(function (fn) { try { fn(); } catch (e) { console.warn(e); } });
  }).catch(function () {});
  get("data/facebook.json").then(renderFacebook).catch(function () {});
  renderInstagram();
})();
