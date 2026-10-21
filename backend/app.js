/*
 * Train Sim Germany – Backend (optional)
 *
 * Die Anmeldung mit Roblox läuft direkt in der Web-App (nur Client-ID, PKCE). Das Backend ergänzt alles,
 * was geteilt oder geheim sein muss. Rechte kommen aus der Rolle in der Roblox-Gruppe:
 *   ab Supervisor                    Trainings anbieten (und eigene löschen)
 *   ab Public Relations Department   Neuigkeiten schreiben, Stellen öffnen/schließen, Bewerbungen prüfen
 *
 * Diese Datei nutzt nur Web-Standards (fetch, Request, Response, crypto.subtle) und läuft
 * als Cloudflare Worker (worker.js) und mit Node.js (server.js).
 *
 *   GET    /health                       Was ist eingerichtet?
 *   GET    /api/content                  Trainings, Neuigkeiten, Stellen (öffentlich)
 *   GET    /api/stats                    Echte Zahlen: Gruppe, Spiel, Discord (öffentlich)
 *   GET    /media/<id>                   Hochgeladenes Bild
 *   POST   /auth/session                 { id_token } aus dem Roblox-Login → Sitzung fürs Backend
 *   POST   /auth/logout                  Abmelden (alle Sitzungen des Kontos werden ungültig)
 *   GET    /api/me                       Profil, Rang, Privatsphäre, Einstellungen, eigene Bewerbungen
 *   PUT    /api/me/privacy               { profile, stats }
 *   PUT    /api/me/settings              Einstellungen für alle Geräte (Darstellung, Sprache, Glocken …)
 *   GET    /api/players/<id>             Öffentliches Profil (nur wenn freigegeben)
 *   POST   /api/trainings                Training anbieten (ab Supervisor)
 *   DELETE /api/trainings/<id>           Eigenes Training löschen
 *   POST   /api/news                     Neuigkeit schreiben (ab PRD)
 *   DELETE /api/news/<id>                Eigene Neuigkeit löschen
 *   POST   /api/media                    Bild hochladen (ab PRD, höchstens 1 MB)
 *   PUT    /api/jobs/<id>                Stelle öffnen/schließen, Zeitraum (ab PRD)
 *   POST   /api/applications             Bewerbung senden (angemeldet)
 *   GET    /api/applications             Alle Bewerbungen (ab PRD)
 *   GET    /api/applications/<id>        Eine Bewerbung (ab PRD oder eigene)
 *   PUT    /api/applications/<id>        { status: passed | failed | new } (ab PRD)
 *   POST   /api/applications/announce    { ids } Bestandene an Discord senden (ab PRD)
 *   GET    /api/push/key                 Öffentlicher Schlüssel für Web-Push
 *   POST   /api/push/reminders           { subscription, reminders } – Erinnerungen für Trainings
 *   GET    /api/shop                     Züge, Strecken, Preise; angemeldet auch eigene Coins und Besitz
 *   POST   /api/shop/buy                 { kind: train | route, id } – Kauf, wird beim nächsten Abgleich im Spiel verbucht
 *   POST   /api/game/sync                Abgleich mit dem Spiel (Schlüssel GAME_API_KEY): Coins, Besitz, Käufe
 *   GET    /api/staff                    Team ab Supervisor aus der Roblox-Gruppe (für den Chat)
 *   GET    /api/chats                    Eigene Gespräche und – fürs Team – offene Anfragen des Bereichs
 *   POST   /api/chats                    Neue Anfrage { reason, area, text } oder Direktnachricht { kind: direct, to, text }
 *   GET    /api/chats/<id>?since=<ms>    Gespräch lesen
 *   POST   /api/chats/<id>/messages      { text }
 *   POST   /api/chats/<id>/claim         Anfrage annehmen (Team des Bereichs)
 *   POST   /api/chats/<id>/close         Gespräch beenden
 *   GET    /api/players/find?q=<name>    Spieler suchen, um ihn anzuschreiben (ab Supervisor)
 *   POST   /api/push/subscribe           { subscription, prefs } – Benachrichtigungen auf diesem Gerät (Chat, Bewerbungen, Team)
 *   POST   /api/push/unsubscribe         { endpoint } – Gerät abmelden
 *   POST   /api/push/test                Probe-Benachrichtigung an die eigenen Geräte
 *
 * Einstellungen: siehe .env.example bzw. README.md
 */
import { enc, b64u, fromB64u, randomKey, now, clip, jsonPart } from './lib.js';
import { vapidKeys, saveReminders, sendDue, subscribeUser, unsubscribeUser, notifyUser } from './webpush.js';
import { matchRank, atLeast } from './ranks.js';
import { getContent, addTraining, deleteTraining, addNews, deleteNews, saveMedia, mediaResponse, setJob } from './content.js';
import { submitApplication, listApplications, getApplication, setStatus, announce, ownView } from './applications.js';
import { liveStats } from './stats.js';
import { shopState, buy, gameAuthorized, gameSync } from './shop.js';
import { listChats, createChat, readChat, postMessage, claimChat, closeChat, staffList, findPlayer } from './chat.js';
import { mailReady } from './mail.js';

export { sendDue, matchRank };

const ROBLOX = {
  oauth: 'https://apis.roblox.com/oauth',
  apis: 'https://apis.roblox.com',
  users: 'https://users.roblox.com',
  groups: 'https://groups.roblox.com',
  games: 'https://games.roblox.com',
  thumbnails: 'https://thumbnails.roblox.com',
};
const SESSION_DAYS = 30;
const REFRESH_MINUTES = 10;
const DEFAULT_GROUP = '33684346';

const publicBase = (req, env) => (env.BACKEND_URL ? env.BACKEND_URL.replace(/\/+$/, '') : new URL(req.url).origin);
const robloxUrl = (env, name) => (env[`ROBLOX_${name.toUpperCase()}_URL`] || ROBLOX[name]).replace(/\/+$/, '');
const groupId = (env) => String(env.ROBLOX_GROUP_ID || DEFAULT_GROUP);
const loginReady = (env) => !!env.ROBLOX_CLIENT_ID;

// ---------- Geheimer Schlüssel für Sitzungen (wird beim ersten Start erzeugt, außer SESSION_SECRET ist gesetzt) ----------
const keyCache = new Map();
async function hmacKey(env, store) {
  let secret = env.SESSION_SECRET;
  if (!secret) {
    secret = await store.get('config:session-secret');
    if (!secret) { secret = randomKey(32); await store.put('config:session-secret', secret); }
  }
  if (!keyCache.has(secret)) {
    keyCache.set(secret, crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']));
  }
  return keyCache.get(secret);
}
async function seal(env, store, data) {
  const body = b64u(enc.encode(JSON.stringify(data)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env, store), enc.encode(body));
  return `${body}.${b64u(sig)}`;
}
async function unseal(env, store, token) {
  const [body, sig, extra] = String(token || '').split('.');
  if (!body || !sig || extra !== undefined) return null;
  try {
    if (!await crypto.subtle.verify('HMAC', await hmacKey(env, store), fromB64u(sig), enc.encode(body))) return null;
    const data = jsonPart(body);
    return data.exp && data.exp > now() ? data : null;
  } catch (e) {
    return null;
  }
}

// ---------- CORS & Antworten ----------
const appOrigins = (env) => [env.APP_URL, ...String(env.ALLOWED_ORIGINS || '').split(',')]
  .map((x) => String(x || '').trim()).filter(Boolean)
  .map((x) => { try { return new URL(x).origin; } catch (e) { return null; } }).filter(Boolean);
function cors(req, env) {
  const origin = req.headers.get('Origin');
  if (!origin || !appOrigins(env).includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
const json = (req, env, data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...cors(req, env) },
});
async function readJson(req, max = 100000) {
  const text = await req.text();
  if (text.length > max) throw Object.assign(new Error('too_large'), { status: 413 });
  try { return JSON.parse(text || '{}'); } catch (e) { throw Object.assign(new Error('bad_json'), { status: 400 }); }
}

// ---------- Roblox ----------
async function getJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}
// Aktuelle Angaben von Roblox: Name, Anzeigename, Profilbild, Rolle in der Gruppe. Fehler sind egal (alte Werte bleiben).
async function refreshUser(env, user) {
  const id = encodeURIComponent(user.sub);
  await Promise.allSettled([
    getJson(`${robloxUrl(env, 'users')}/v1/users/${id}`).then((u) => { user.username = u.name || user.username; user.displayName = u.displayName || user.displayName; }),
    getJson(`${robloxUrl(env, 'thumbnails')}/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png&isCircular=false`)
      .then((r) => { const img = (r.data || [])[0]; if (img && img.state === 'Completed') user.avatar = img.imageUrl; }),
    getJson(`${robloxUrl(env, 'groups')}/v2/users/${id}/groups/roles`).then((r) => {
      const hit = (r.data || []).find((x) => String(x.group && x.group.id) === groupId(env));
      user.groupRole = hit ? { name: hit.role.name, rank: hit.role.rank } : null;
      user.rank = matchRank(user.groupRole);
    }),
  ]);
  user.refreshed = now();
  return user;
}
const publicUser = (user) => ({
  userId: user.sub, username: user.username, displayName: user.displayName, avatar: user.avatar || null,
  rank: user.rank || null, groupRole: user.groupRole || null,
});

// ID-Token aus dem Roblox-Login prüfen: Signatur (Schlüssel von Roblox), für unsere Client-ID, nicht abgelaufen
const jwks = { at: 0, keys: [] };
async function robloxKeys(env, fresh = false) {
  if (fresh || !jwks.keys.length || Date.now() - jwks.at > 3600000) {
    jwks.keys = (await getJson(`${robloxUrl(env, 'oauth')}/v1/certs`)).keys || [];
    jwks.at = Date.now();
  }
  return jwks.keys;
}
export async function verifyIdToken(env, token) {
  const [h, p, s, extra] = String(token || '').split('.');
  if (!h || !p || !s || extra !== undefined) throw new Error('format');
  const header = jsonPart(h);
  const claims = jsonPart(p);
  const algs = {
    ES256: [{ name: 'ECDSA', namedCurve: 'P-256' }, { name: 'ECDSA', hash: 'SHA-256' }],
    RS256: [{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, { name: 'RSASSA-PKCS1-v1_5' }],
  };
  if (!algs[header.alg]) throw new Error('alg');
  const find = (keys) => keys.find((k) => k.kid === header.kid);
  const jwk = find(await robloxKeys(env)) || find(await robloxKeys(env, true));
  if (!jwk) throw new Error('kid');
  const key = await crypto.subtle.importKey('jwk', { ...jwk, key_ops: undefined, alg: header.alg }, algs[header.alg][0], false, ['verify']);
  if (!await crypto.subtle.verify(algs[header.alg][1], key, fromB64u(s), enc.encode(`${h}.${p}`))) throw new Error('signature');
  const aud = [].concat(claims.aud).map(String);
  if (!aud.includes(String(env.ROBLOX_CLIENT_ID))) throw new Error('aud');
  if (!String(claims.iss || '').startsWith(robloxUrl(env, 'oauth'))) throw new Error('iss');
  if (!claims.exp || claims.exp < now() - 60) throw new Error('exp');
  if (!claims.sub) throw new Error('sub');
  return claims;
}

async function createSession(req, env, store) {
  if (!loginReady(env)) return json(req, env, { error: 'not_configured' }, 503);
  const body = await readJson(req, 20000);
  let claims;
  try {
    claims = await verifyIdToken(env, body.id_token);
  } catch (e) {
    return json(req, env, { error: 'invalid_token' }, 401);
  }
  const old = (await store.get(`user:${claims.sub}`)) || {};
  const user = {
    privacy: { profile: false, stats: false }, ver: 1, ...old,
    sub: String(claims.sub),
    username: claims.preferred_username || claims.name || old.username || String(claims.sub),
    displayName: claims.nickname || claims.name || old.displayName || claims.preferred_username,
    avatar: claims.picture || old.avatar || null,
    lastLogin: now(),
  };
  await refreshUser(env, user);
  await store.put(`user:${user.sub}`, user);
  const session = await seal(env, store, { sub: user.sub, ver: user.ver, iat: now(), exp: now() + SESSION_DAYS * 86400 });
  return json(req, env, { session, ...publicUser(user), privacy: user.privacy, settings: user.settings || null, applications: await myApplications(store, user) });
}

// Angemeldeter Nutzer aus „Authorization: Bearer <sitzung>“
async function authUser(req, env, store) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const s = await unseal(env, store, token);
  if (!s) return null;
  const user = await store.get(`user:${s.sub}`);
  return user && user.ver === s.ver ? user : null;
}

// Rang vor Schreibzugriffen auffrischen (höchstens alle 10 Minuten), damit Rechte aktuell sind
async function freshUser(env, store, user) {
  if (!user.refreshed || user.refreshed < now() - REFRESH_MINUTES * 60) {
    await refreshUser(env, user);
    await store.put(`user:${user.sub}`, user);
  }
  return user;
}
const need = (user, min) => { if (!atLeast(user.rank, min)) throw Object.assign(new Error('forbidden'), { status: 403 }); };

// Einstellungen für alle Geräte
function cleanSettings(body) {
  const ids = (v) => (Array.isArray(v) ? v : []).slice(0, 200).map((x) => clip(x, 60));
  return {
    theme: ['light', 'dark', 'system'].includes(body.theme) ? body.theme : 'system',
    lang: /^(auto|[a-z]{2})$/.test(body.lang || '') ? body.lang : 'auto',
    bell: body.bell === true,
    remind: ids(body.remind), remindOff: ids(body.remindOff), favs: ids(body.favs),
    updatedAt: Math.min(Date.now(), Math.round(+body.updatedAt) || Date.now()),
  };
}
async function myApplications(store, user) {
  const out = [];
  for (const id of (user.apps || []).slice(-30)) {
    const a = await getApplication(store, id);
    if (a) out.push(ownView(a));
  }
  return out;
}

// ---------- Anfragen verteilen ----------
export async function handle(req, env, store) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const m = req.method;
  if (m === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req, env) });
  try {
    // ---------- öffentlich ----------
    if (path === '/' || path === '/health') {
      return json(req, env, { ok: true, login: loginReady(env), applications: true, discord: !!env.DISCORD_WEBHOOK_URL, results: !!env.DISCORD_RESULTS_WEBHOOK_URL, push: true, chat: true, mail: mailReady(env), game: !!env.GAME_API_KEY, group: groupId(env) });
    }
    if (path === '/api/content' && m === 'GET') return json(req, env, await getContent(store));
    if (path === '/api/stats' && m === 'GET') return json(req, env, await liveStats(store, env, robloxUrl));
    const media = path.match(/^\/media\/([\w-]+)$/);
    if (media && m === 'GET') return await mediaResponse(store, media[1]);
    if (path === '/auth/session' && m === 'POST') return await createSession(req, env, store);
    if (path === '/api/push/key' && m === 'GET') return json(req, env, { publicKey: (await vapidKeys(store)).publicKey });
    if (path === '/api/push/reminders' && m === 'POST') {
      const body = await readJson(req, 60000);
      return json(req, env, await saveReminders(store, body).then((r) => ({ count: r.count })));
    }
    if (path === '/api/staff' && m === 'GET') return json(req, env, { staff: await staffList(store, env) });
    if (path === '/api/game/sync' && m === 'POST') {
      if (!await gameAuthorized(req, env)) return json(req, env, { error: 'unauthorized' }, 401);
      return json(req, env, await gameSync(store, await readJson(req, 500000)));
    }
    const player = path.match(/^\/api\/players\/(\d{1,20})$/);
    if (player && m === 'GET') {
      const user = await store.get(`user:${player[1]}`);
      if (!user || !user.privacy || !user.privacy.profile) return json(req, env, { error: 'not_found' }, 404);
      return json(req, env, { ...publicUser(user), statsPublic: !!user.privacy.stats, stats: user.privacy.stats ? user.stats || null : null });
    }

    // ---------- angemeldet ----------
    const user = await authUser(req, env, store);
    if (path === '/auth/logout' && m === 'POST') {
      if (user) { user.ver += 1; await store.put(`user:${user.sub}`, user); }
      return json(req, env, { ok: true });
    }
    if (!path.startsWith('/api/')) return json(req, env, { error: 'not_found' }, 404);
    if (path === '/api/shop' && m === 'GET') return json(req, env, await shopState(store, user));
    if (!user) return json(req, env, { error: 'unauthorized' }, 401);

    // Shop
    if (path === '/api/shop/buy' && m === 'POST') return json(req, env, await buy(store, user, await readJson(req, 1000)));

    // Chat
    if (path === '/api/chats' && m === 'GET') return json(req, env, await listChats(store, await freshUser(env, store, user)));
    if (path === '/api/chats' && m === 'POST') return json(req, env, await createChat(store, env, await freshUser(env, store, user), await readJson(req, 10000)), 201);
    const chat = path.match(/^\/api\/chats\/([\w-]+)(?:\/(messages|claim|close))?$/);
    if (chat && !chat[2] && m === 'GET') return json(req, env, await readChat(store, user, chat[1], +url.searchParams.get('since') || 0));
    if (chat && chat[2] === 'messages' && m === 'POST') return json(req, env, await postMessage(store, env, user, chat[1], await readJson(req, 10000)), 201);
    if (chat && chat[2] === 'claim' && m === 'POST') return json(req, env, await claimChat(store, env, await freshUser(env, store, user), chat[1]));
    // Spieler suchen, um ihn anzuschreiben (nur Team)
    if (path === '/api/players/find' && m === 'GET') {
      need(await freshUser(env, store, user), 'Supervisor');
      const p = await findPlayer(env, url.searchParams.get('q'));
      return p ? json(req, env, p) : json(req, env, { error: 'not_found' }, 404);
    }

    // Benachrichtigungen auf diesem Gerät (auch bei geschlossener App)
    if (path === '/api/push/subscribe' && m === 'POST') {
      await freshUser(env, store, user);
      return json(req, env, await subscribeUser(store, user, await readJson(req, 10000), atLeast(user.rank, 'Supervisor')));
    }
    if (path === '/api/push/unsubscribe' && m === 'POST') return json(req, env, await unsubscribeUser(store, user, (await readJson(req, 5000)).endpoint));
    if (path === '/api/push/test' && m === 'POST') {
      return json(req, env, { sent: await notifyUser(store, env, user.sub, 'test', { title: 'Train Sim Germany', body: 'Benachrichtigungen funktionieren – auch wenn die App geschlossen ist. 🚆', url: './#/einstellungen', tag: 'test' }) });
    }
    if (chat && chat[2] === 'close' && m === 'POST') return json(req, env, await closeChat(store, user, chat[1]));

    if (path === '/api/me' && m === 'GET') {
      await freshUser(env, store, user);
      return json(req, env, { ...publicUser(user), privacy: user.privacy, settings: user.settings || null, applications: await myApplications(store, user) });
    }
    if (path === '/api/me/privacy' && m === 'PUT') {
      const body = await readJson(req, 1000);
      user.privacy = { profile: body.profile === true, stats: body.stats === true };
      await store.put(`user:${user.sub}`, user);
      return json(req, env, { privacy: user.privacy });
    }
    if (path === '/api/me/settings' && m === 'PUT') {
      const next = cleanSettings(await readJson(req, 20000));
      // Nur übernehmen, wenn neuer als der gespeicherte Stand (mehrere Geräte)
      if (!user.settings || next.updatedAt >= (user.settings.updatedAt || 0)) {
        user.settings = next;
        await store.put(`user:${user.sub}`, user);
      }
      return json(req, env, { settings: user.settings });
    }

    // Trainings (ab Supervisor)
    if (path === '/api/trainings' && m === 'POST') {
      need(await freshUser(env, store, user), 'Supervisor');
      return json(req, env, await addTraining(store, user, await readJson(req, 5000)), 201);
    }
    const training = path.match(/^\/api\/trainings\/([\w-]+)$/);
    if (training && m === 'DELETE') {
      await deleteTraining(store, user, training[1]);
      return json(req, env, { ok: true });
    }

    // Neuigkeiten, Bilder, Stellen (ab Public Relations Department)
    if (path === '/api/news' && m === 'POST') {
      need(await freshUser(env, store, user), 'Public Relations Department');
      return json(req, env, await addNews(store, user, await readJson(req, 20000)), 201);
    }
    const news = path.match(/^\/api\/news\/([\w-]+)$/);
    if (news && m === 'DELETE') {
      await deleteNews(store, user, news[1]);
      return json(req, env, { ok: true });
    }
    if (path === '/api/media' && m === 'POST') {
      need(await freshUser(env, store, user), 'Public Relations Department');
      const id = await saveMedia(store, req);
      return json(req, env, { id, url: `${publicBase(req, env)}/media/${id}` }, 201);
    }
    const job = path.match(/^\/api\/jobs\/([a-z0-9-]+)$/);
    if (job && m === 'PUT') {
      need(await freshUser(env, store, user), 'Public Relations Department');
      return json(req, env, await setJob(store, user, job[1], await readJson(req, 2000)));
    }

    // Bewerbungen
    if (path === '/api/applications' && m === 'POST') {
      await freshUser(env, store, user);
      const own = await submitApplication(store, env, user, await readJson(req));
      user.apps = [...(user.apps || []), own.id].slice(-30);
      await store.put(`user:${user.sub}`, user);
      return json(req, env, own, 201);
    }
    if (path === '/api/applications' && m === 'GET') {
      need(await freshUser(env, store, user), 'Public Relations Department');
      return json(req, env, { applications: await listApplications(store) });
    }
    if (path === '/api/applications/announce' && m === 'POST') {
      need(await freshUser(env, store, user), 'Public Relations Department');
      return json(req, env, await announce(store, env, user, (await readJson(req, 5000)).ids));
    }
    const app = path.match(/^\/api\/applications\/([\w-]+)$/);
    if (app && m === 'GET') {
      const a = await getApplication(store, app[1]);
      if (!a) return json(req, env, { error: 'not_found' }, 404);
      if (a.sub === user.sub && !atLeast((await freshUser(env, store, user)).rank, 'Public Relations Department')) return json(req, env, ownView(a));
      need(user, 'Public Relations Department');
      return json(req, env, a);
    }
    if (app && m === 'PUT') {
      need(await freshUser(env, store, user), 'Public Relations Department');
      return json(req, env, await setStatus(store, env, user, app[1], (await readJson(req, 1000)).status));
    }
    return json(req, env, { error: 'not_found' }, 404);
  } catch (e) {
    if (e.status) return json(req, env, { error: e.message }, e.status);
    console.error(e);
    return json(req, env, { error: 'server' }, 500);
  }
}
