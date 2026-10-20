/*
 * Train Sim Germany – Backend
 *
 * Hier liegen alle Schlüssel: Roblox Client-ID und Client-Secret, der Schlüssel für die
 * Sitzungen und der Discord-Webhook für Bewerbungen. Die Web-App kennt nur die Adresse
 * des Backends (assets/js/config.js → api).
 *
 * Diese Datei nutzt nur Web-Standards (fetch, Request, Response, crypto.subtle) und läuft
 * deshalb als Cloudflare Worker (worker.js) und mit Node.js (server.js).
 *
 *   GET  /health                  Was ist eingerichtet?
 *   GET  /auth/login?return=URL   Weiter zu Roblox (OAuth 2.0 mit PKCE und Client-Secret)
 *   GET  /auth/callback           Rückkehr von Roblox → zurück zur App mit Sitzung
 *   POST /auth/logout             Abmelden (alle Sitzungen des Kontos werden ungültig)
 *   GET  /api/me                  Eigenes Profil, Rang aus der Roblox-Gruppe, Privatsphäre
 *   PUT  /api/me/privacy          Privatsphäre speichern: { profile, stats }
 *   GET  /api/players/<id>        Öffentliches Profil eines Spielers (nur wenn freigegeben)
 *   POST /api/applications        Bewerbung an den Discord-Kanal des Teams senden
 *
 * Einstellungen (Umgebungsvariablen bzw. Secrets): siehe .env.example
 */

const ROBLOX = {
  oauth: 'https://apis.roblox.com/oauth',
  users: 'https://users.roblox.com',
  groups: 'https://groups.roblox.com',
  thumbnails: 'https://thumbnails.roblox.com',
};
// Ränge der App mit Kürzel. Rollen in der Roblox-Gruppe werden über Name oder Kürzel zugeordnet,
// z. B. „Driver“, „[D] Driver“ oder „D | Driver“.
const RANKS = [
  ['Management', 'MG'], ['Dispatcher', 'DS'], ['Supervisor', 'SV'], ['Signaller', 'SG'],
  ['Conductor', 'CD'], ['Platform Staff', 'PS'], ['Driver', 'D'], ['Passenger', 'UD'],
];
const SESSION_DAYS = 30;
const LOGIN_MINUTES = 10;
const REFRESH_MINUTES = 10;
const APPS_PER_DAY = 3;

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------- Hilfen ----------
const b64u = (bytes) => {
  let s = '';
  new Uint8Array(bytes).forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const randomKey = (n = 32) => b64u(crypto.getRandomValues(new Uint8Array(n)));
const now = () => Math.floor(Date.now() / 1000);
const robloxUrl = (env, name) => (env[`ROBLOX_${name.toUpperCase()}_URL`] || ROBLOX[name]).replace(/\/+$/, '');
const clip = (v, n) => String(v ?? '').slice(0, n);

const keyCache = new Map();
async function hmacKey(env) {
  const secret = env.SESSION_SECRET;
  if (!keyCache.has(secret)) {
    keyCache.set(secret, crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']));
  }
  return keyCache.get(secret);
}
// Signierte Daten (für Sitzung und Login-Cookie): <daten>.<signatur>
async function seal(env, data) {
  const body = b64u(enc.encode(JSON.stringify(data)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(body));
  return `${body}.${b64u(sig)}`;
}
async function unseal(env, token) {
  const [body, sig, extra] = String(token || '').split('.');
  if (!body || !sig || extra !== undefined) return null;
  try {
    if (!await crypto.subtle.verify('HMAC', await hmacKey(env), fromB64u(sig), enc.encode(body))) return null;
    const data = JSON.parse(dec.decode(fromB64u(body)));
    return data.exp && data.exp > now() ? data : null;
  } catch (e) {
    return null;
  }
}

const loginReady = (env) => !!(env.ROBLOX_CLIENT_ID && env.ROBLOX_CLIENT_SECRET && String(env.SESSION_SECRET || '').length >= 32 && env.APP_URL);
const appOrigins = (env) => {
  const list = [env.APP_URL, ...String(env.ALLOWED_ORIGINS || '').split(',')].map((x) => x.trim()).filter(Boolean);
  return list.map((x) => { try { return new URL(x).origin; } catch (e) { return null; } }).filter(Boolean);
};
const publicBase = (req, env) => (env.BACKEND_URL ? env.BACKEND_URL.replace(/\/+$/, '') : new URL(req.url).origin);
const isHttps = (req, env) => publicBase(req, env).startsWith('https:');

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
const redirect = (url, headers = {}) => new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store', ...headers } });
const cookies = (req) => Object.fromEntries(String(req.headers.get('Cookie') || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, v.join('=')]));

// Zurück zur App: #login=<sitzung>&back=<seite> bzw. #login_error=<grund>&back=<seite>
function backToApp(env, ret, params) {
  const target = new URL(ret || env.APP_URL);
  const back = target.hash || '#/';
  target.hash = '';
  return `${target}#${new URLSearchParams({ ...params, back })}`;
}
function safeReturn(env, ret) {
  try {
    const u = new URL(ret);
    if (appOrigins(env).includes(u.origin)) return u.toString();
  } catch (e) { /* ungültig */ }
  return env.APP_URL;
}

// ---------- Roblox ----------
async function getJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}
function matchRank(roleName) {
  const name = String(roleName || '').toLowerCase();
  const prefix = (name.match(/^\s*\[?\s*([a-z]{1,3})\s*[\]|:\-]/) || [])[1];
  const hit = RANKS.find(([rank]) => name.includes(rank.toLowerCase())) || RANKS.find(([, p]) => p.toLowerCase() === prefix);
  return hit ? hit[0] : null;
}
// Aktuelle Angaben von Roblox: Name, Anzeigename, Profilbild, Rolle in der Gruppe. Fehler sind egal (alte Werte bleiben).
async function refreshUser(env, user) {
  const id = encodeURIComponent(user.sub);
  const jobs = [
    getJson(`${robloxUrl(env, 'users')}/v1/users/${id}`).then((u) => { user.username = u.name || user.username; user.displayName = u.displayName || user.displayName; }),
    getJson(`${robloxUrl(env, 'thumbnails')}/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png&isCircular=false`)
      .then((r) => { const img = (r.data || [])[0]; if (img && img.state === 'Completed') user.avatar = img.imageUrl; }),
  ];
  if (env.ROBLOX_GROUP_ID) {
    jobs.push(getJson(`${robloxUrl(env, 'groups')}/v2/users/${id}/groups/roles`).then((r) => {
      const hit = (r.data || []).find((x) => String(x.group && x.group.id) === String(env.ROBLOX_GROUP_ID));
      user.groupRole = hit ? { name: hit.role.name, rank: hit.role.rank } : null;
      user.rank = hit ? matchRank(hit.role.name) : 'Passenger';
    }));
  }
  await Promise.allSettled(jobs);
  user.refreshed = now();
  return user;
}
const publicUser = (user) => ({
  userId: user.sub, username: user.username, displayName: user.displayName, avatar: user.avatar || null,
  rank: user.rank || null, groupRole: user.groupRole || null,
});

// ---------- Anmeldung ----------
async function login(req, env) {
  if (!loginReady(env)) return new Response('Roblox-Login ist nicht eingerichtet (ROBLOX_CLIENT_ID, ROBLOX_CLIENT_SECRET, SESSION_SECRET, APP_URL).', { status: 503 });
  const url = new URL(req.url);
  const verifier = randomKey(48);
  const challenge = b64u(await crypto.subtle.digest('SHA-256', enc.encode(verifier)));
  const state = randomKey();
  const nonce = randomKey();
  const ret = safeReturn(env, url.searchParams.get('return'));
  const cookie = await seal(env, { state, verifier, nonce, ret, exp: now() + LOGIN_MINUTES * 60 });
  const q = new URLSearchParams({
    client_id: env.ROBLOX_CLIENT_ID, redirect_uri: `${publicBase(req, env)}/auth/callback`, scope: 'openid profile',
    response_type: 'code', state, nonce, code_challenge: challenge, code_challenge_method: 'S256',
  });
  return redirect(`${robloxUrl(env, 'oauth')}/v1/authorize?${q}`, {
    'Set-Cookie': `tsg_login=${cookie}; Path=/auth; Max-Age=${LOGIN_MINUTES * 60}; HttpOnly; SameSite=Lax${isHttps(req, env) ? '; Secure' : ''}`,
  });
}

async function callback(req, env, store) {
  const url = new URL(req.url);
  const saved = await unseal(env, cookies(req).tsg_login);
  const clear = { 'Set-Cookie': `tsg_login=; Path=/auth; Max-Age=0; HttpOnly; SameSite=Lax${isHttps(req, env) ? '; Secure' : ''}` };
  const ret = saved ? saved.ret : env.APP_URL;
  const fail = (reason) => redirect(backToApp(env, ret, { login_error: reason }), clear);
  if (!loginReady(env)) return fail('not_configured');
  if (url.searchParams.get('error')) return fail(url.searchParams.get('error') === 'access_denied' ? 'access_denied' : 'failed');
  if (!saved || url.searchParams.get('state') !== saved.state || !url.searchParams.get('code')) return fail('failed');
  try {
    const oauth = robloxUrl(env, 'oauth');
    const tok = await getJson(`${oauth}/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code: url.searchParams.get('code'), code_verifier: saved.verifier,
        client_id: env.ROBLOX_CLIENT_ID, client_secret: env.ROBLOX_CLIENT_SECRET,
      }),
    });
    // nonce aus dem ID-Token prüfen (der Token kommt direkt von Roblox über https)
    if (tok.id_token) {
      const claims = JSON.parse(dec.decode(fromB64u(tok.id_token.split('.')[1])));
      if (claims.nonce !== saved.nonce) throw new Error('nonce');
    }
    const info = await getJson(`${oauth}/v1/userinfo`, { headers: { Authorization: `Bearer ${tok.access_token}` } });
    if (!info.sub) throw new Error('userinfo');
    // Den Refresh-Token braucht das Backend nicht: sofort ungültig machen
    if (tok.refresh_token) {
      await fetch(`${oauth}/v1/token/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: tok.refresh_token, client_id: env.ROBLOX_CLIENT_ID, client_secret: env.ROBLOX_CLIENT_SECRET }),
      }).catch(() => {});
    }
    const old = (await store.get(`user:${info.sub}`)) || {};
    const user = {
      privacy: { profile: false, stats: false }, ver: 1, ...old,
      sub: String(info.sub), username: info.preferred_username || info.name, displayName: info.nickname || info.name, avatar: info.picture || old.avatar || null,
      lastLogin: now(),
    };
    await refreshUser(env, user);
    await store.put(`user:${user.sub}`, user);
    const session = await seal(env, { sub: user.sub, ver: user.ver, iat: now(), exp: now() + SESSION_DAYS * 86400 });
    return redirect(backToApp(env, ret, { login: session }), clear);
  } catch (e) {
    console.error('Login fehlgeschlagen:', e.message);
    return fail('failed');
  }
}

// Angemeldeter Nutzer aus „Authorization: Bearer <sitzung>“
async function authUser(req, env, store) {
  if (!loginReady(env)) return null;
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const s = await unseal(env, token);
  if (!s) return null;
  const user = await store.get(`user:${s.sub}`);
  return user && user.ver === s.ver ? user : null;
}

async function readJson(req, max = 100000) {
  const text = await req.text();
  if (text.length > max) throw Object.assign(new Error('too_large'), { status: 413 });
  try { return JSON.parse(text || '{}'); } catch (e) { throw Object.assign(new Error('bad_json'), { status: 400 }); }
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
      field('Rang', `${clip(a.rank, 40)} (angegeben)${user.groupRole ? `\nGruppe: ${user.groupRole.name}` : ''}`),
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
    `Rang (angegeben): ${clip(a.rank, 40)}${user.groupRole ? ` · Rolle in der Gruppe: ${user.groupRole.name}` : ''}`,
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
  const form = new FormData();
  form.append('payload_json', JSON.stringify({
    username: 'Train Sim Germany',
    allowed_mentions: { parse: [] },
    embeds: [embed],
    attachments: [{ id: 0, filename: `bewerbung-${user.username}-${a.job}.txt` }],
  }));
  form.append('files[0]', new Blob([lines.join('\n')], { type: 'text/plain; charset=utf-8' }), `bewerbung-${user.username}-${a.job}.txt`);
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
      return json(req, env, { ok: true, login: loginReady(env), applications: !!env.DISCORD_WEBHOOK_URL, group: !!env.ROBLOX_GROUP_ID });
    }
    if (path === '/auth/login' && req.method === 'GET') return await login(req, env);
    if (path === '/auth/callback' && req.method === 'GET') return await callback(req, env, store);

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
