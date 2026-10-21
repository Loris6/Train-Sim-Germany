/* Train Sim Germany – Service Worker
   Die App funktioniert auch offline. Online wird immer zuerst das Netz gefragt,
   damit Änderungen an der Seite sofort ankommen. */
const CACHE = 'tsg-v16';
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
  'assets/img/favicon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/badge-96.png',
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

// Benachrichtigungen für Trainings per Web-Push (vom Backend, auch wenn die App geschlossen ist)
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    // Chat gerade offen und sichtbar? Dann keine Benachrichtigung – die Nachricht ist ja schon zu sehen
    if (String(d.tag || '').startsWith('chat-')) {
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (open.some((c) => c.visibilityState === 'visible' && new URL(c.url).hash.startsWith('#/chat'))) return;
    }
    // Chat: Profilbild des Absenders statt Logo (d.icon); neue Nachricht im selben Gespräch meldet sich erneut
    await self.registration.showNotification(d.title || 'Train Sim Germany', {
      body: d.body || '',
      icon: d.icon || 'assets/icons/icon-192.png',
      renotify: !!d.tag,
      timestamp: Date.now(),
      badge: 'assets/icons/badge-96.png',
      tag: d.tag || undefined,
      lang: d.lang || 'de',
      data: { url: d.url || './', join: d.join || null },
      actions: d.join ? [{ action: 'join', title: d.joinLabel || 'Beitreten' }] : [],
    });
  })());
});

// Tippen auf die Benachrichtigung: App öffnen (bzw. „Beitreten“ startet Roblox im richtigen Server)
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  if (e.action === 'join' && data.join) {
    e.waitUntil(self.clients.openWindow(data.join));
    return;
  }
  const target = new URL(data.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => c.url.startsWith(self.registration.scope));
    if (open) return open.focus().then((c) => (c && c.navigate ? c.navigate(target) : null));
    return self.clients.openWindow(target);
  }));
});
