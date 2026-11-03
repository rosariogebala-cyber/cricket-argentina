(function () {
  "use strict";

  var header = document.querySelector("[data-header]");
  var menuBtn = document.querySelector("[data-menu]");
  var nav = document.getElementById("nav");

  /* Menú mobile */
  function setMenu(open) {
    if (open) nav.style.setProperty("--nav-top", header.getBoundingClientRect().bottom + "px");
    nav.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    document.body.style.overflow = open ? "hidden" : "";
  }
  menuBtn.addEventListener("click", function () { setMenu(!nav.classList.contains("is-open")); });
  nav.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });

  /* Encabezado con sombra y sección activa en el menú */
  var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]:not(.nav-cta)'));
  var targets = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });
  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 10);
    var line = window.innerHeight * 0.35, current = -1;
    targets.forEach(function (t, i) { if (t && t.getBoundingClientRect().top <= line) current = i; });
    links.forEach(function (a, i) { a.classList.toggle("is-current", i === current); });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Ticker de partidos */
  var track = document.querySelector("[data-ticker]");
  document.querySelectorAll("[data-tick]").forEach(function (b) {
    b.addEventListener("click", function () {
      track.scrollBy({ left: track.clientWidth * 0.8 * Number(b.getAttribute("data-tick")), behavior: "smooth" });
    });
  });

  /* Cuenta regresiva al próximo partido */
  var cd = document.querySelector("[data-countdown]");
  if (cd) {
    var target = new Date(cd.getAttribute("data-countdown")).getTime();
    var parts = {};
    cd.querySelectorAll("[data-cd]").forEach(function (el) { parts[el.getAttribute("data-cd")] = el; });
    var pad = function (n) { return String(n).padStart(2, "0"); };
    var tick = function () {
      var left = Math.max(0, target - Date.now()) / 1000;
      parts.d.textContent = pad(Math.floor(left / 86400));
      parts.h.textContent = pad(Math.floor(left % 86400 / 3600));
      parts.m.textContent = pad(Math.floor(left % 3600 / 60));
      parts.s.textContent = pad(Math.floor(left % 60));
    };
    tick();
    setInterval(tick, 1000);
  }

  /* Filtro del fixture */
  var fixtures = document.querySelector("[data-fixtures]");
  var empty = document.querySelector("[data-fx-empty]");
  document.querySelectorAll("[data-filter]").forEach(function (tab, _, all) {
    tab.addEventListener("click", function () {
      var f = tab.getAttribute("data-filter");
      all.forEach(function (t) { t.setAttribute("aria-selected", String(t === tab)); });
      var shown = 0, day = null, dayCount = 0;
      var closeDay = function () { if (day) day.hidden = dayCount === 0; };
      Array.prototype.forEach.call(fixtures.children, function (el) {
        if (el.classList.contains("fx-day")) { closeDay(); day = el; dayCount = 0; return; }
        if (!el.classList.contains("fx")) return;
        var on = f === "all" || el.getAttribute("data-comp") === f;
        el.hidden = !on;
        if (on) { shown++; dayCount++; }
      });
      closeDay();
      empty.hidden = shown > 0;
    });
  });

  /* Aparición al hacer scroll */
  var groups = document.querySelectorAll(".hero-grid, .leaders, .squads, .gallery, .clubs-list, .fixtures, .heritage-in, .develop-in, .app-in");
  var items = [];
  groups.forEach(function (g) {
    Array.prototype.forEach.call(g.children, function (el, i) {
      if (el.classList.contains("fx-day") || el.hidden) return;
      el.classList.add("reveal");
      el.style.setProperty("--i", Math.min(i, 6));
      items.push(el);
    });
  });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* Sin viudas: la última palabra nunca queda sola en una línea */
  document.querySelectorAll("main h1, main h2, main h3, main p, footer p").forEach(function (el) {
    if (el.children.length) return;
    var t = el.textContent.trim();
    if (t.split(/\s+/).length >= 4) el.textContent = t.replace(/\s+(\S+)$/, "\u00a0$1");
  });

  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
