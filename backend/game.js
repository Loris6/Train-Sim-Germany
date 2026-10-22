/*
 * Train Sim Germany – was gerade im Spiel passiert: laufende Server, wer was macht, Statistik
 *
 * Das Spiel (game/TSGAppSync.server.lua) meldet bei jedem Abgleich zusätzlich:
 *   activity: [{ userId, name, displayName, role, line, train, destination, nextStop, vehicle, station }]
 *             Rolle = Team im Spiel, der Rest kommt aus Attributen am Spieler (TSG_Line, TSG_Train, …)
 *   trips:    [{ userId, route, vehicle, cat, km, delay }]   beendete Fahrten
 * Daraus entstehen die Server-Seite, „Spieler“ und die Statistik. Was das Spiel nicht meldet, bleibt bei 0.
 *
 *   game:servers     → { <jobId>: { at, since, players, max, version, private, privateId, online, who, acc, flushed } }
 *   pstats:<userId>  → eigene Statistik { minutes, trips, km, punctual, routes, vehicles, days, first, last }
 *   gstats:<Tag>     → ein Tag (Berlin) { trips, km, punctual, cats, routes: { R001: { n, ok, km } } }
 *   gstats:total     → { trips, km, punctual }
 *   hist:online      → [[Stunde seit 1970, höchste Spielerzahl], …] der letzten 31 Tage
 *   avatar:<userId>  → Profilbild (6 Std.), friends:<userId> → IDs der Freunde (15 Min.)
 */
import { clip } from './lib.js';
import { usersApi, thumbsApi, getJson } from './roblox.js';
import { pserverView } from './pservers.js';

const FRESH = 3 * 60000;
const FLUSH = 10 * 60000;
const PUNCTUAL = 6; // weniger als 6 Minuten Verspätung = pünktlich

// Rollen im Spiel, von unten nach oben
export const GAME_ROLES = ['Passenger', 'Learning Driver', 'Qualified Driver', 'Platform Staff', 'Conductor', 'Signaller', 'Supervisor'];
const ROLE_WORDS = [
  ['Supervisor', /supervisor|aufsicht|manager|director|engineer|public relations|moderat|admin/],
  ['Signaller', /signal|stellwerk|fahrdienst|dispatch/],
  ['Conductor', /conductor|zugbegleit|schaffner|guard/],
  ['Platform Staff', /platform|bahnsteig/],
  ['Learning Driver', /learning|trainee|azubi|ausbildung/],
  ['Qualified Driver', /driver|lokf|fahrer/],
];
export function gameRole(team) {
  const s = String(team || '').toLowerCase();
  const hit = ROLE_WORDS.find(([, re]) => re.test(s));
  return hit ? hit[0] : 'Passenger';
}
const CATS = ['ice', 'ec', 'ic', 'ire', 're', 'rb', 's', 'g'];
const txt = (v, n) => clip(v, n).replace(/[\u0000-\u001f]/g, '').trim() || null;
const round1 = (n) => Math.round(n * 10) / 10;
export const dayKey = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

// Was jeder Spieler gerade macht (nur Spieler, die auf diesem Server sind)
export function cleanWho(list, online) {
  const ok = new Set(online);
  const out = new Map();
  for (const a of (Array.isArray(list) ? list : []).slice(0, 200)) {
    const id = String((a && a.userId) || '');
    if (!ok.has(id) || out.has(id)) continue;
    out.set(id, {
      id, name: /^[A-Za-z0-9_]{2,20}$/.test(a.name || '') ? a.name : null, dn: txt(a.displayName, 32), role: gameRole(a.role),
      line: txt(a.line, 14), train: txt(a.train, 20), dest: txt(a.destination, 48), next: txt(a.nextStop, 48),
      veh: txt(a.vehicle, 32), at: txt(a.station, 48),
    });
  }
  online.forEach((id) => { if (!out.has(id)) out.set(id, { id, role: 'Passenger' }); });
  return [...out.values()];
}

// ---------- Eigene Statistik ----------
const emptyStats = () => ({ minutes: 0, trips: 0, km: 0, punctual: 0, routes: {}, vehicles: {}, days: {}, first: null, last: null });
async function updateStats(store, id, fn) {
  const s = { ...emptyStats(), ...((await store.get(`pstats:${id}`)) || {}) };
  fn(s);
  const keep = Object.keys(s.days).sort().slice(-14);
  s.days = Object.fromEntries(keep.map((k) => [k, s.days[k]]));
  await store.put(`pstats:${id}`, s, { ttl: 400 * 86400 });
}
// Spielzeit gutschreiben (wer den Server verlassen hat, alle 10 Minuten alle anderen)
async function flushTime(store, acc, ids, t) {
  for (const id of ids) {
    const sec = acc[id] || 0;
    delete acc[id];
    await updateStats(store, id, (s) => {
      const min = sec / 60;
      const d = dayKey(t);
      s.minutes = round1(s.minutes + min);
      if (min > 0) s.days[d] = round1((s.days[d] || 0) + min);
      s.first = s.first || t - sec * 1000;
      s.last = t;
    });
  }
}
export async function playerStats(store, id) {
  const s = await store.get(`pstats:${id}`);
  return s ? { ...emptyStats(), ...s } : emptyStats();
}

// Beendete Fahrten: eigene Statistik, Tag und Gesamt
function cleanTrips(list, catalog) {
  return (Array.isArray(list) ? list : []).slice(0, 100).map((x) => {
    const userId = String((x && x.userId) || '');
    if (!/^\d{1,20}$/.test(userId)) return null;
    const veh = txt(x.vehicle, 32);
    const train = veh && catalog.trains.find((c) => c.id === veh);
    const cat = CATS.includes(x.cat) ? x.cat : train ? train.cat : null;
    const route = /^R\d{3}$/.test(x.route || '') ? x.route : null;
    return { userId, veh, cat, route, km: Math.max(0, Math.min(2000, +x.km || 0)), delay: Math.max(0, Math.min(600, +x.delay || 0)) };
  }).filter(Boolean);
}
async function recordTrips(store, trips, t) {
  if (!trips.length) return;
  const day = dayKey(t);
  const g = (await store.get(`gstats:${day}`)) || { trips: 0, km: 0, punctual: 0, cats: {}, routes: {} };
  const total = (await store.get('gstats:total')) || { trips: 0, km: 0, punctual: 0 };
  for (const tr of trips) {
    const ok = tr.delay < PUNCTUAL;
    g.trips += 1; g.km = round1(g.km + tr.km); g.punctual += ok ? 1 : 0;
    total.trips += 1; total.km = round1(total.km + tr.km); total.punctual += ok ? 1 : 0;
    if (tr.cat) g.cats[tr.cat] = (g.cats[tr.cat] || 0) + 1;
    if (tr.route) {
      const r = g.routes[tr.route] || (g.routes[tr.route] = { n: 0, ok: 0, km: 0 });
      r.n += 1; r.ok += ok ? 1 : 0; r.km = round1(r.km + tr.km);
    }
    await updateStats(store, tr.userId, (s) => {
      s.trips += 1; s.km = round1(s.km + tr.km); s.punctual += ok ? 1 : 0;
      if (tr.route) s.routes[tr.route] = (s.routes[tr.route] || 0) + 1;
      if (tr.veh) s.vehicles[tr.veh] = (s.vehicles[tr.veh] || 0) + 1;
      s.first = s.first || t;
      s.last = t;
    });
  }
  await store.put(`gstats:${day}`, g, { ttl: 40 * 86400 });
  await store.put('gstats:total', total);
}

/*
 * Abgleich eines Servers: Stand speichern, Spielzeit zählen, Fahrten verbuchen.
 * servers = game:servers (wird hier geändert und vom Aufrufer gespeichert)
 */
export async function recordServer(store, servers, jobId, sv, body, online, catalog, t) {
  const prev = servers[jobId] || null;
  const acc = { ...((prev && prev.acc) || {}) };
  // Spielzeit seit dem letzten Abgleich (höchstens 2 Minuten, falls einer ausgefallen ist)
  if (prev) {
    const sec = Math.max(0, Math.min(120, (t - prev.at) / 1000));
    online.forEach((id) => { if ((prev.online || []).includes(id)) acc[id] = Math.round((acc[id] || 0) + sec); });
  }
  const left = prev ? (prev.online || []).filter((id) => !online.includes(id)) : [];
  let flushed = (prev && prev.flushed) || t;
  if (sv.closing) {
    await flushTime(store, acc, [...new Set([...online, ...left])], t);
    delete servers[jobId];
  } else {
    await flushTime(store, acc, left, t);
    if (t - flushed > FLUSH) { await flushTime(store, acc, online.filter((id) => acc[id]), t); flushed = t; }
    online.forEach((id) => { if (!(id in acc)) acc[id] = 0; });
    servers[jobId] = {
      at: t, since: (prev && prev.since) || t, players: Math.max(0, Math.round(+sv.players || online.length)), max: Math.max(0, Math.round(+sv.max || 0)),
      version: Math.round(+sv.version) || null, private: sv.private === true, privateId: sv.privateId ? clip(sv.privateId, 64) : null,
      online, who: cleanWho(body.activity, online), acc, flushed,
    };
  }
  await recordTrips(store, cleanTrips(body.trips, catalog), t);
}

// Server, die seit 10 Minuten nichts gemeldet haben: Spielzeit gutschreiben und entfernen
export async function dropStale(store, servers, t) {
  for (const [jobId, s] of Object.entries(servers)) {
    if (t - s.at < 600000) continue;
    await flushTime(store, s.acc || {}, Object.keys(s.acc || {}), s.at);
    delete servers[jobId];
  }
}

// ---------- Profilbilder und Namen von Roblox (zwischengespeichert) ----------
export async function avatarsOf(store, env, ids) {
  const out = {};
  const miss = [];
  for (const id of [...new Set(ids.map(String))].filter((x) => /^\d{1,20}$/.test(x)).slice(0, 200)) {
    const v = await store.get(`avatar:${id}`);
    if (v) out[id] = v; else miss.push(id);
  }
  for (let i = 0; i < miss.length; i += 100) {
    try {
      const r = await getJson(`${thumbsApi(env)}/v1/users/avatar-headshot?userIds=${miss.slice(i, i + 100).join(',')}&size=150x150&format=Png&isCircular=false`);
      for (const x of r.data || []) {
        if (x.state !== 'Completed' || !x.imageUrl) continue;
        out[String(x.targetId)] = x.imageUrl;
        await store.put(`avatar:${x.targetId}`, x.imageUrl, { ttl: 6 * 3600 });
      }
    } catch (e) { /* ohne Bilder */ }
  }
  return out;
}
async function namesOf(store, env, ids) {
  const out = {};
  const miss = [];
  for (const id of ids) {
    const v = await store.get(`rbxname:${id}`);
    if (v) out[id] = v; else miss.push(id);
  }
  for (let i = 0; i < miss.length; i += 100) {
    try {
      const r = await getJson(`${usersApi(env)}/v1/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ userIds: miss.slice(i, i + 100).map(Number), excludeBannedUsers: false }),
      });
      for (const u of r.data || []) {
        const v = { username: u.name, displayName: u.displayName || u.name };
        out[String(u.id)] = v;
        await store.put(`rbxname:${u.id}`, v, { ttl: 86400 });
      }
    } catch (e) { /* ohne Namen */ }
  }
  return out;
}
const friendsApi = (env) => (env.ROBLOX_FRIENDS_URL || 'https://friends.roblox.com').replace(/\/+$/, '');
// Freunde eines Spielers (öffentliche Freundesliste auf Roblox). null = nicht abrufbar
export async function friendIds(store, env, sub) {
  const key = `friends:${sub}`;
  const cached = await store.get(key);
  if (cached) return new Set(cached);
  let ids = null;
  try {
    ids = [];
    let cursor = '';
    for (let page = 0; page < 10; page++) {
      const r = await getJson(`${friendsApi(env)}/v1/users/${sub}/friends/find?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      ids.push(...(r.PageItems || r.data || []).map((x) => String(x.id)));
      cursor = r.NextCursor || r.nextPageCursor || '';
      if (!cursor) break;
    }
  } catch (e) {
    try { ids = ((await getJson(`${friendsApi(env)}/v1/users/${sub}/friends`)).data || []).map((x) => String(x.id)); } catch (e2) { ids = null; }
  }
  if (!ids) return null;
  await store.put(key, ids, { ttl: 900 });
  return new Set(ids);
}

// ---------- Für die App ----------
async function liveMap(store) {
  const all = (await store.get('game:servers')) || {};
  const t = Date.now();
  return Object.entries(all).filter(([, s]) => t - s.at < FRESH);
}
function roleCounts(who) {
  const roles = Object.fromEntries(GAME_ROLES.map((r) => [r, 0]));
  who.forEach((x) => { roles[x.role] = (roles[x.role] || 0) + 1; });
  return roles;
}
// Team zuerst (Supervisor … Passenger), sonst in der Reihenfolge des Spiels
const byRole = (who) => [...who].sort((a, b) => GAME_ROLES.indexOf(b.role) - GAME_ROLES.indexOf(a.role));
const person = (x) => ({ id: x.id, name: x.name || null, dn: x.dn || null, role: x.role, line: x.line || null, train: x.train || null, dest: x.dest || null, next: x.next || null, veh: x.veh || null, at: x.at || null });
// Züge auf dem Server: alles, was Fahrer mit Linie oder Zugnummer melden
function trainsOf(who) {
  const map = new Map();
  who.filter((x) => x.line || x.train).forEach((x) => {
    const key = x.train || `${x.line}>${x.dest || ''}`;
    if (!map.has(key)) map.set(key, { key, line: x.line, train: x.train, dest: x.dest, next: x.next, veh: x.veh, crew: [] });
    map.get(key).crew.push({ id: x.id, role: x.role });
  });
  return [...map.values()];
}
const pserverLite = (p) => (p ? { id: p.id, name: p.name, ownerName: p.ownerName, mine: p.mine, member: p.member, canJoin: p.canJoin, link: p.link, join: p.join, access: p.access } : null);

function serverOut(jobId, s, p, full) {
  const who = s.who || (s.online || []).map((id) => ({ id, role: 'Passenger' }));
  const people = byRole(who);
  return {
    id: jobId, private: !!s.private, players: s.players, max: s.max, version: s.version, since: s.since || s.at, at: s.at,
    roles: roleCounts(who), trains: trainsOf(who).length, people: (full ? people : people.slice(0, 3)).map(person),
    ...(full ? { trainList: trainsOf(who) } : {}),
    ...(s.private ? { pserver: pserverLite(p) } : {}),
  };
}
async function visibleServers(store, user) {
  const cache = new Map();
  const out = [];
  for (const [jobId, s] of await liveMap(store)) {
    let p = null;
    if (s.private) {
      const rec = s.privateId ? await store.get(`pserver:${s.privateId}`) : null;
      p = rec ? await pserverView(store, rec, user, cache) : null;
      if (!p) { out.push({ jobId, s, hidden: true }); continue; }
    }
    out.push({ jobId, s, p });
  }
  return out;
}

// GET /api/servers – alle laufenden Server, die man sehen darf
export async function serversView(store, env, user) {
  const list = await visibleServers(store, user);
  const shown = list.filter((x) => !x.hidden).map((x) => serverOut(x.jobId, x.s, x.p, false))
    .sort((a, b) => a.private - b.private || b.players - a.players);
  const avatars = await avatarsOf(store, env, shown.flatMap((s) => s.people.map((x) => x.id)));
  return { servers: shown, avatars, online: list.reduce((n, x) => n + (x.s.players || 0), 0), hidden: list.filter((x) => x.hidden).length, at: Date.now() };
}

// GET /api/servers/<jobId> – ein Server mit allen Spielern und Zügen
export async function serverDetail(store, env, user, jobId) {
  const hit = (await visibleServers(store, user)).find((x) => x.jobId === jobId && !x.hidden);
  if (!hit) throw Object.assign(new Error('not_found'), { status: 404 });
  const sv = serverOut(hit.jobId, hit.s, hit.p, true);
  return { server: sv, avatars: await avatarsOf(store, env, sv.people.map((x) => x.id)) };
}

// POST /api/players/status { ids } – verfolgte Spieler: Name, Bild, Freund, ob und wo im Spiel
export async function playersStatus(store, env, user, body) {
  const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(String))].filter((x) => /^\d{1,20}$/.test(x)).slice(0, 100);
  const where = new Map();
  for (const x of await visibleServers(store, user)) (x.s.who || []).forEach((w) => { if (ids.includes(w.id)) where.set(w.id, { ...x, w }); });
  const [names, avatars, friends] = await Promise.all([namesOf(store, env, ids), avatarsOf(store, env, ids), user ? friendIds(store, env, user.sub) : null]);
  const out = [];
  for (const id of ids) {
    const n = names[id] || {};
    const hit = where.get(id);
    const st = await store.get(`pstats:${id}`);
    const item = {
      userId: id, username: n.username || (hit && hit.w.name) || null, displayName: n.displayName || (hit && hit.w.dn) || n.username || null,
      avatar: avatars[id] || null, friend: friends ? friends.has(id) : null, me: !!user && user.sub === id,
      inGame: !!hit, lastSeen: hit ? Date.now() : (st && st.last) || null,
    };
    if (hit && hit.hidden) item.server = { private: true, hidden: true };
    else if (hit) {
      const sv = serverOut(hit.jobId, hit.s, hit.p, false);
      item.server = { id: sv.id, private: sv.private, players: sv.players, max: sv.max, pserver: sv.pserver || null };
      item.activity = person(hit.w);
    }
    out.push(item);
  }
  return { players: out, friendsKnown: !!friends, at: Date.now() };
}

// GET /api/players/friends – eigene Freunde, die gerade in Train Sim Germany sind, zuerst
export async function friendsStatus(store, env, user) {
  const friends = await friendIds(store, env, user.sub);
  if (!friends) return { players: [], friendsKnown: false, total: 0 };
  const all = [...friends];
  const live = new Set((await liveMap(store)).flatMap(([, s]) => s.online || []));
  const first = [...all.filter((id) => live.has(id)), ...all.filter((id) => !live.has(id))].slice(0, 60);
  const r = await playersStatus(store, env, user, { ids: first });
  r.players.forEach((p) => { p.friend = true; });
  return { ...r, total: all.length };
}

// GET /api/gamestats – Statistik aus dem Spiel (alles 0, solange nichts gemeldet wurde)
export async function gameStats(store) {
  const t = Date.now();
  const days = [];
  for (let i = 0; i < 7; i++) days.push(dayKey(t - i * 86400000));
  const week = { trips: 0, km: 0, punctual: 0, routes: {} };
  let today = null;
  for (const d of days) {
    const g = await store.get(`gstats:${d}`);
    if (!g) continue;
    if (d === days[0]) today = g;
    week.trips += g.trips; week.km = round1(week.km + g.km); week.punctual += g.punctual;
    Object.entries(g.routes || {}).forEach(([no, r]) => {
      const w = week.routes[no] || (week.routes[no] = { n: 0, ok: 0, km: 0 });
      w.n += r.n; w.ok += r.ok; w.km = round1(w.km + r.km);
    });
  }
  const live = await liveMap(store);
  const who = live.flatMap(([, s]) => s.who || []);
  return {
    today: today || { trips: 0, km: 0, punctual: 0, cats: {}, routes: {} },
    week, total: (await store.get('gstats:total')) || { trips: 0, km: 0, punctual: 0 },
    hours: (await store.get('hist:online')) || [],
    live: { servers: live.length, players: live.reduce((n, [, s]) => n + (s.players || 0), 0), trains: trainsOf(who).length },
    at: t,
  };
}

// Höchste Spielerzahl je Stunde (für das Diagramm „Spieler online“)
export async function recordOnline(store, n, t = Date.now()) {
  if (!Number.isFinite(n) || n < 0) return;
  const hour = Math.floor(t / 3600000);
  const h = (await store.get('hist:online')) || [];
  const last = h[h.length - 1];
  if (last && last[0] === hour) {
    if (n <= last[1]) return;
    last[1] = n;
  } else h.push([hour, n]);
  await store.put('hist:online', h.filter(([x]) => x > hour - 24 * 31));
}
export async function liveOnline(store) {
  return (await liveMap(store)).reduce((n, [, s]) => n + (s.players || 0), 0);
}
