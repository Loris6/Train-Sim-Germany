/* Train Sim Germany – Service Worker
   Die App funktioniert auch offline. Online wird immer zuerst das Netz gefragt,
   damit Änderungen an der Seite sofort ankommen. */
const CACHE = 'tsg-v28';
const SHELL = [
  './',
  'index.html',
  'privacy.html',
  'terms.html',
  'manifest.webmanifest',
  'assets/css/style.css',
  'assets/css/site.css',
  'assets/img/lines-bg.svg',
  'assets/img/logo-white.svg',
  'assets/css/uicons.css',
  'assets/js/nozoom.js',
  'assets/js/config.js',
  'assets/js/data.js',
  'assets/js/legal.js',
  'assets/js/app.js',
  'assets/img/halloween-bg.svg',
  'assets/img/winter-bg.svg',
  'assets/img/cobweb.svg',
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

// ---------- Benachrichtigungen (Web-Push vom Backend, auch wenn die App geschlossen ist) ----------
// Adresse des Backends aus config.js (dort steht window.TSG_CONFIG)
self.window = self;
try { importScripts('assets/js/config.js'); } catch (err) { /* ohne Backend */ }
const API = String((self.TSG_CONFIG && self.TSG_CONFIG.api) || '').trim().replace(/\/+$/, '');
// Apple (iPhone, iPad, Safari auf dem Mac) zeigt keine Knöpfe und verlangt zu jeder Push-Nachricht eine Benachrichtigung
const UA = self.navigator.userAgent || '';
const APPLE = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && !/Chrome|Chromium|Firefox|Edg/.test(UA));
const LINE = '━━━━━━━━━━━━━━━━';

// Nachrichten von Personen: „[TSG] Name“, darunter die Nachricht.
// Alles andere: „Train Sim Germany“, darunter eine Linie, dann Betreff und Nachricht.
function shape(d) {
  if (d.style === 'person') return { title: d.title || 'Train Sim Germany', body: d.body || '' };
  const subject = d.title && d.title !== 'Train Sim Germany' ? d.title : '';
  return { title: 'Train Sim Germany', body: [LINE, subject, d.body].filter(Boolean).join('\n') };
}
function actionsOf(d) {
  if (Array.isArray(d.actions)) {
    return d.actions.filter((a) => a && a.action && a.title).slice(0, 2)
      .map((a) => ({ action: a.action, title: a.title, ...(a.type === 'text' ? { type: 'text', placeholder: a.placeholder || '' } : {}) }));
  }
  return d.join ? [{ action: 'join', title: d.joinLabel || 'Beitreten' }] : [];
}

// Ist genau dieses Gespräch gerade offen und im Vordergrund? (wie bei Messengern: dann keine Meldung)
function chatOpen(clients, tag) {
  const id = String(tag || '').startsWith('chat-') ? String(tag).slice(5) : '';
  if (!id || APPLE) return false; // Apple verlangt zu jeder Push-Nachricht eine Meldung
  return clients.some((c) => {
    if (c.visibilityState !== 'visible' || c.focused === false) return false;
    const hash = new URL(c.url).hash.split('?')[0];
    return hash === `#/chat/${id}` || hash.startsWith(`#/chat/${id}/`);
  });
}

// Jede Push-Nachricht wird eine echte Benachrichtigung des Geräts (Mitteilungszentrale, Sperrbildschirm) –
// auch wenn die App gerade offen ist. Die offene App aktualisiert nur still ihre Liste.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    open.forEach((c) => c.postMessage({ type: 'tsg-push', tag: d.tag || '' }));
    if (chatOpen(open, d.tag)) return;
    const n = shape(d);
    await self.registration.showNotification(n.title, {
      body: n.body,
      icon: d.icon || 'assets/icons/icon-192.png',
      badge: 'assets/icons/badge-96.png',
      renotify: !!d.tag,
      timestamp: Date.now(),
      tag: d.tag || undefined,
      lang: d.lang || 'de',
      vibrate: d.style === 'person' ? [120, 60, 120] : [200],
      // Einladungen bleiben stehen, bis man „Beitreten“ oder „Ablehnen“ wählt (wo das Gerät das kann)
      requireInteraction: !!d.invite,
      data: { url: d.url || './', join: d.join || null, reply: d.reply || null, invite: d.invite || null },
      actions: actionsOf(d),
    });
  })());
});

async function post(path, body) {
  if (!API) return null;
  try {
    return await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (err) {
    return null;
  }
}
async function openUrl(url) {
  const target = new URL(url || './', self.registration.scope).href;
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const open = list.find((c) => c.url.startsWith(self.registration.scope));
  if (open) return open.focus().then((c) => (c && c.navigate ? c.navigate(target) : null));
  return self.clients.openWindow(target);
}

// Tippen auf die Benachrichtigung oder einen Knopf
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  const inv = data.invite;
  // Antworten direkt in der Benachrichtigung (wie bei Messengern); ohne Textfeld öffnet sich das Gespräch
  if (e.action === 'reply' && data.reply && (e.reply || '').trim()) {
    const r = data.reply;
    e.waitUntil(post(`/api/chats/${encodeURIComponent(r.chat)}/reply`, { text: e.reply.trim(), sub: r.sub, exp: r.exp, k: r.k }));
    return;
  }
  // Einladung: „Beitreten“ startet Roblox (im richtigen Server), „Ablehnen“ sagt dem Einladenden Bescheid
  if (e.action === 'join' && data.join) {
    e.waitUntil(Promise.all([self.clients.openWindow(data.join), inv ? post(`/api/invites/${inv.id}/answer`, { answer: 'join', k: inv.k }) : null]));
    return;
  }
  if (e.action === 'decline' && inv) {
    e.waitUntil(post(`/api/invites/${inv.id}/answer`, { answer: 'decline', k: inv.k }));
    return;
  }
  e.waitUntil(openUrl(data.url));
});
