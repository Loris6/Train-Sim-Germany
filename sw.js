/* Train Sim Germany – Service Worker
   Die App funktioniert auch offline. Online wird immer zuerst das Netz gefragt,
   damit Änderungen an der Seite sofort ankommen. */
const CACHE = 'tsg-v9';
const SHELL = [
  './',
  'index.html',
  'privacy.html',
  'terms.html',
  'manifest.webmanifest',
  'assets/css/style.css',
  'assets/css/uicons.css',
  'assets/js/nozoom.js',
  'assets/js/config.js',
  'assets/js/data.js',
  'assets/js/legal.js',
  'assets/js/app.js',
  'assets/js/questions/de.js',
  'assets/img/logo.svg',
  'assets/icons/icon-192.png',
  'assets/fonts/rubik-latin-wght-normal.woff2',
  'assets/fonts/rubik-latin-ext-wght-normal.woff2',
  'assets/fonts/uicons-regular-rounded.woff2',
  'assets/fonts/uicons-solid-rounded.woff2',
  'assets/fonts/uicons-brands.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // Rückkehr vom Roblox-Login (?code=…) nicht zwischenspeichern
  if (url.search) return;
  // Videos werden in Teilen geladen (Range) und nicht zwischengespeichert
  if (req.headers.has('range') || req.destination === 'video') return;
  e.respondWith(fetch(req)
    .then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    })
    .catch(() => caches.match(req, { ignoreSearch: true })
      .then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
