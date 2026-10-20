/* Train Sim Germany – kein Hineinzoomen auf allen Seiten
   (Zwei-Finger-Zoom, Doppeltippen, Strg/⌘ + Mausrad oder Touchpad, Strg/⌘ + Plus/Minus/0).
   Der Viewport sperrt den Zoom auf Android; iOS ignoriert das, deshalb zusätzlich hier. */
(function () {
  'use strict';
  var stop = function (e) { e.preventDefault(); };
  // Safari (iPhone, iPad, Mac-Touchpad)
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (type) {
    document.addEventListener(type, stop, { passive: false });
  });
  // Zwei Finger auf dem Bildschirm
  document.addEventListener('touchmove', function (e) {
    if (e.touches.length > 1 || (typeof e.scale === 'number' && e.scale !== 1)) e.preventDefault();
  }, { passive: false });
  // Touchpad-Zoom und Strg + Mausrad am PC
  window.addEventListener('wheel', function (e) { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  // Strg/⌘ + Plus, Minus oder 0
  window.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0', 'Add', 'Subtract'].indexOf(e.key) !== -1) e.preventDefault();
  });
})();
