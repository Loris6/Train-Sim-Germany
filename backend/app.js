/*
 * Train Sim Germany – Backend (optional)
 *
 * Die Anmeldung mit Roblox läuft direkt in der Web-App (nur Client-ID, PKCE). Das Backend ergänzt:
 *   - Benachrichtigungen für Trainings per Web-Push, auch wenn die App geschlossen ist
 *   - Bewerbungen an den Discord-Kanal des Teams (der Webhook bleibt geheim)
 *   - Privatsphäre-Einstellungen, die auch andere sehen (öffentliches Profil)
 *
 * Diese Datei nutzt nur Web-Standards (fetch, Request, Response, crypto.subtle) und läuft
 * als Cloudflare Worker (worker.js) und mit Node.js (server.js).
 *
 *   GET  /health                  Was ist eingerichtet?
 *   POST /auth/session            { id_token } aus dem Roblox-Login → Sitzung fürs Backend
 *   POST /auth/logout             Abmelden (alle Sitzungen des Kontos werden ungültig)
 *   GET  /api/me                  Eigenes Profil, Rang aus der Roblox-Gruppe, Privatsphäre
 *   PUT  /api/me/privacy          Privatsphäre speichern: { profile, stats }
 *   GET  /api/players/<id>        Öffentliches Profil eines Spielers (nur wenn freigegeben)
 *   POST /api/applications        Bewerbung an den Discord-Kanal senden (angemeldet)
 *   GET  /api/push/key            Öffentlicher Schlüssel für Web-Push
 *   POST /api/push/reminders      { subscription, reminders } – Erinnerungen für Trainings
 *
 * Einstellungen: siehe .env.example bzw. README.md
 */
import { enc, b64u, fromB64u, randomKey, now, clip, jsonPart } from './lib.js';
import { vapidKeys, saveReminders, sendDue } from './webpush.js';

export { sendDue };

const ROBLOX = {
  oauth: 'https://apis.roblox.com/oauth',
  users: 'https://users.roblox.com',
  groups: 'https://groups.roblox.com',
  thumbnails: 'https://thumbnails.roblox.com',
};
// Ränge der App mit Kürzel. Die Rolle in der Roblox-Gruppe wird über Kürzel oder Name zugeordnet,
// z. B. „[D] Driver“, „SG | Signaller“ oder „Platform Staff“. Nicht in der Gruppe = Guest.
const RANKS = [
  ['Management', 'MG'], ['Dispatcher', 'DS'], ['Supervisor', 'SV'], ['Signaller', 'SG'], ['Conductor', 'CD'],
  ['Platform Staff', 'PS'], ['Passenger', 'UD'], ['Driver', 'D'], ['Guest', 'G'],
];
const SESSION_DAYS = 30;
const REFRESH_MINUTES = 10;
const APPS_PER_DAY = 3;
const DEFAULT_GROUP = '33684346';

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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
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
export function matchRank(role) {
  if (!role) return 'Guest';
  const name = String(role.name || '').toLowerCase();
  const prefix = (name.match(/^\s*\[?\s*([a-z]{1,3})\s*[\]|:\-]/) || [])[1];
  const hit = (prefix && RANKS.find(([, p]) => p.toLowerCase() === prefix))
    || RANKS.slice().sort((a, b) => b[0].length - a[0].length).find(([rank]) => name.includes(rank.toLowerCase()));
  return hit ? hit[0] : 'Passenger';
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
  return json(req, env, { session, ...publicUser(user), privacy: user.privacy });
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

// ---------- Bewerbungen → Discord ----------
async function sendApplication(req, env, store, user) {
  if (!env.DISCORD_WEBHOOK_URL) return json(req, env, { error: 'not_configured' }, 503);
  const a = await readJson(req);
  if (!/^[a-z0-9-]{2,40}$/.test(a.job || '') || !Array.isArray(a.answers) || a.answers.length > 100) return json(req, env, { error: 'bad_request' }, 400);
  if (!String(a.discord || '').trim()) return json(req, env, { error: 'bad_request' }, 400);

  // Schutz vor Spam: höchstens 3 Bewerbungen pro Tag und eine pro Stelle
  const rlKey = `apps:${user.sub}`;
  const recent = ((await store.get(rlKey)) || []).filter((x) => x.at > now() - 86400);
  if (recent.length >= APPS_PER_DAY || recent.some((x) => x.job === a.job)) return json(req, env, { error: 'rate_limited' }, 429);

  const title = `${clip(a.jobTitle || a.job, 80)}${a.area ? ` – ${clip(a.area, 40)}` : ''}`;
  const profile = `https://www.roblox.com/users/${encodeURIComponent(user.sub)}/profile`;
  const score = Number.isFinite(+a.total) && +a.total > 0 ? `${+a.score} von ${+a.total} richtig (${Math.round((+a.score / +a.total) * 100)} %)` : '–';
  const role = user.groupRole ? `\nGruppe: ${user.groupRole.name}` : '\nNicht in der Gruppe';
  const field = (name, value, inline = true) => ({ name, value: clip(value || '–', 1024), inline });
  const embed = {
    title: clip(`Neue Bewerbung: ${title}`, 256),
    url: profile,
    color: 0xEC0016,
    description: clip(a.experience ? `**Erfahrung:**\n${a.experience}` : '', 3000),
    thumbnail: user.avatar ? { url: user.avatar } : undefined,
    fields: [
      field('Roblox (angemeldet)', `[${user.username}](${profile}) · ${user.displayName}\nID ${user.sub}`),
      field('Discord', clip(a.discord, 100)),
      field('E-Mail', clip(a.email, 200)),
      field('Spielt seit', clip(a.since, 60)),
      field('Rang', `${clip(a.rank, 40)} (angegeben)${role}`),
      field('Ergebnis', score),
      field('Aktivität', a.activity ? `${+a.activity} / 10` : '–'),
      field('Freie Tage', clip((a.days || []).join(', '), 100)),
      field('Sprache', clip(a.lang, 10)),
    ],
    footer: { text: 'Train Sim Germany · Bewerbung über die Web-App' },
    timestamp: new Date().toISOString(),
  };
  // Alle Fragen und Antworten als Textdatei im Anhang
  const lines = [
    `Bewerbung: ${title}`,
    `Roblox: ${user.username} (${user.displayName}, ID ${user.sub}) – ${profile}`,
    `Discord: ${clip(a.discord, 100)}`,
    `E-Mail: ${clip(a.email, 200)}`,
    `Spielt seit: ${clip(a.since, 60)}`,
    `Rang (angegeben): ${clip(a.rank, 40)} · ${user.groupRole ? `Rolle in der Gruppe: ${user.groupRole.name}` : 'nicht in der Gruppe'}`,
    `Ergebnis: ${score}`,
    `Aktivität: ${a.activity ? `${+a.activity} / 10` : '–'} · Freie Tage: ${clip((a.days || []).join(', '), 100) || '–'}`,
    `Sprache: ${clip(a.lang, 10)} · Gesendet: ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`,
    '',
    'Erfahrung:',
    clip(a.experience, 5000) || '–',
    '',
    'Fragen und Antworten:',
    ...a.answers.flatMap((x, i) => [
      '',
      `${i + 1}. ${x.ok === true ? '[richtig] ' : x.ok === false ? '[falsch] ' : ''}${clip(x.q, 600)}`,
      `   ${clip(x.a, 3000).replace(/\n/g, '\n   ')}`,
    ]),
  ];
  const file = `bewerbung-${user.username}-${a.job}.txt`;
  const form = new FormData();
  form.append('payload_json', JSON.stringify({ username: 'Train Sim Germany', allowed_mentions: { parse: [] }, embeds: [embed], attachments: [{ id: 0, filename: file }] }));
  form.append('files[0]', new Blob([lines.join('\n')], { type: 'text/plain; charset=utf-8' }), file);
  const res = await fetch(`${env.DISCORD_WEBHOOK_URL}${env.DISCORD_WEBHOOK_URL.includes('?') ? '&' : '?'}wait=true`, { method: 'POST', body: form });
  if (!res.ok) {
    console.error('Discord:', res.status, await res.text().catch(() => ''));
    return json(req, env, { error: 'discord' }, 502);
  }
  recent.push({ job: a.job, at: now() });
  await store.put(rlKey, recent, { ttl: 86400 });
  return json(req, env, { ok: true });
}

// ---------- Anfragen verteilen ----------
export async function handle(req, env, store) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req, env) });
  try {
    if (path === '/' || path === '/health') {
      return json(req, env, { ok: true, login: loginReady(env), applications: !!env.DISCORD_WEBHOOK_URL, push: true, group: groupId(env) });
    }
    if (path === '/auth/session' && req.method === 'POST') return await createSession(req, env, store);
    if (path === '/api/push/key' && req.method === 'GET') return json(req, env, { publicKey: (await vapidKeys(store)).publicKey });
    if (path === '/api/push/reminders' && req.method === 'POST') {
      const body = await readJson(req, 60000);
      return json(req, env, await saveReminders(store, body).then((r) => ({ count: r.count })));
    }

    const player = path.match(/^\/api\/players\/(\d{1,20})$/);
    if (player && req.method === 'GET') {
      const user = await store.get(`user:${player[1]}`);
      if (!user || !user.privacy || !user.privacy.profile) return json(req, env, { error: 'not_found' }, 404);
      return json(req, env, { ...publicUser(user), statsPublic: !!user.privacy.stats, stats: user.privacy.stats ? user.stats || null : null });
    }

    const user = await authUser(req, env, store);
    if (path === '/auth/logout' && req.method === 'POST') {
      if (user) { user.ver += 1; await store.put(`user:${user.sub}`, user); }
      return json(req, env, { ok: true });
    }
    if (!path.startsWith('/api/')) return json(req, env, { error: 'not_found' }, 404);
    if (!user) return json(req, env, { error: 'unauthorized' }, 401);

    if (path === '/api/me' && req.method === 'GET') {
      if (!user.refreshed || user.refreshed < now() - REFRESH_MINUTES * 60) {
        await refreshUser(env, user);
        await store.put(`user:${user.sub}`, user);
      }
      return json(req, env, { ...publicUser(user), privacy: user.privacy });
    }
    if (path === '/api/me/privacy' && req.method === 'PUT') {
      const body = await readJson(req, 1000);
      user.privacy = { profile: body.profile === true, stats: body.stats === true };
      await store.put(`user:${user.sub}`, user);
      return json(req, env, { privacy: user.privacy });
    }
    if (path === '/api/applications' && req.method === 'POST') return await sendApplication(req, env, store, user);
    return json(req, env, { error: 'not_found' }, 404);
  } catch (e) {
    if (e.status) return json(req, env, { error: e.message }, e.status);
    console.error(e);
    return json(req, env, { error: 'server' }, 500);
  }
}
