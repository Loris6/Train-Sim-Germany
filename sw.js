/* Train Sim Germany – Service Worker
   Die App funktioniert auch offline. Online wird immer zuerst das Netz gefragt,
   damit Änderungen an der Seite sofort ankommen. */
const CACHE = 'tsg-v3';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/css/style.css',
  'assets/css/uicons.css',
  'assets/js/data.js',
  'assets/js/app.js',
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
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
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
