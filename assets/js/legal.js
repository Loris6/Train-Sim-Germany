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
