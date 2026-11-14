/* Train Sim Germany – Datenschutz und Nutzungsbedingungen: Angaben aus config.js (legal) einsetzen */
(function () {
  'use strict';
  var legal = (window.TSG_CONFIG && window.TSG_CONFIG.legal) || {};
  document.querySelectorAll('[data-legal]').forEach(function (el) {
    var v = legal[el.getAttribute('data-legal')];
    if (v) el.textContent = v;
  });
  if (legal.email) {
    document.querySelectorAll('[data-legal-mail]').forEach(function (a) {
      a.href = 'mailto:' + legal.email;
      a.textContent = legal.email;
    });
  }
})();
/* Inhaltsverzeichnis: den Abschnitt markieren, der gerade gelesen wird */
(function () {
  'use strict';
  var links = Array.prototype.slice.call(document.querySelectorAll('.lg-toc a[href^="#"]'));
  if (!links.length || !('IntersectionObserver' in window)) return;
  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
  var seen = {};
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { seen[e.target.id] = e.isIntersecting; });
    var first = links.map(function (a) { return a.getAttribute('href').slice(1); }).filter(function (id) { return seen[id]; })[0];
    if (!first) return;
    links.forEach(function (a) { a.classList.toggle('is-active', a === byId[first]); });
  }, { rootMargin: '-120px 0px -55% 0px' });
  Object.keys(byId).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
})();
