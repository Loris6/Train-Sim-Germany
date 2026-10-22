/*
 * Train Sim Germany – private Server aus dem Spiel
 *
 * Das Spiel-Skript (game/TSGAppSync.server.lua) meldet laufende Server. Läuft ein privater Server, kennt das Backend
 * seine ID und den Besitzer. Der Besitzer stellt in der App ein:
 *   name     – wie der Server in der App heißt
 *   join     – app: „Beitreten“ in der App (mit dem Link zum privaten Server) · roblox: nur über Roblox selbst
 *   link     – Link zum privaten Server aus Roblox (…?privateServerLinkCode=… oder …/share?code=…&type=Server)
 *   access   – all: jeder mit Link · members: nur Mitglieder des verbundenen Server-Chats (das Spiel weist andere ab)
 *   show     – public: alle sehen ihn in der App · members: nur Chat-Mitglieder · owner: nur der Besitzer
 *   welcome  – Begrüßung im Spiel, relay – Nachrichten aus dem Server-Chat im Spiel anzeigen
 *   chat     – verbundener Server-Chat (eine Gruppe der Art „Server-Chat“)
 * Diese Einstellungen holt sich das Spiel beim nächsten Abgleich (siehe privateServerSync).
 *
 *   pserver:<id>     → Server mit Einstellungen und letztem Stand
 *   pservers:index   → IDs aller bekannten privaten Server
 */
import { clip } from './lib.js';

const bad = (msg = 'bad_request', status = 400) => Object.assign(new Error(msg), { status });
const ONLINE = 3 * 60000;
const SHOWN_DAYS = 30;

export const DEFAULTS = { join: 'roblox', link: '', access: 'all', show: 'members', welcome: '', relay: false, chat: null };

// Link zum privaten Server prüfen: nur roblox.com, mit Code
export function cleanLink(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  let u;
  try { u = new URL(s); } catch (e) { throw bad('bad_link'); }
  const host = u.hostname.replace(/^www\./, '');
  const ok = u.protocol === 'https:' && host === 'roblox.com'
    && ((/^\/games\/\d+/.test(u.pathname) && /^[\w-]{6,80}$/.test(u.searchParams.get('privateServerLinkCode') || ''))
      || (u.pathname.replace(/\/+$/, '') === '/share' && /^[\w-]{6,80}$/.test(u.searchParams.get('code') || '') && /server/i.test(u.searchParams.get('type') || '')));
  if (!ok) throw bad('bad_link');
  return `https://www.roblox.com${u.pathname}${u.search}`;
}

const memberIds = (c) => (c && c.kind === 'group' ? Object.keys(c.members || {}) : []);
const isOnline = (p) => !p.closed && Date.now() - (p.lastSeen || 0) < ONLINE;

async function load(store, id) {
  return /^[\w-]{6,64}$/.test(String(id)) ? store.get(`pserver:${id}`) : null;
}

// Was jemand von einem Server sehen darf
export async function pserverView(store, p, user, chatCache = new Map()) {
  const sub = user ? user.sub : null;
  let c = null;
  if (p.chat) {
    if (!chatCache.has(p.chat)) chatCache.set(p.chat, await store.get(`chat:${p.chat}`));
    c = chatCache.get(p.chat);
  }
  const mine = sub && p.owner === sub;
  const member = !!(sub && memberIds(c).includes(sub));
  const visible = mine || p.show === 'public' || (p.show === 'members' && member);
  if (!visible) return null;
  const online = isOnline(p);
  const mayEnter = p.access === 'all' || mine || member;
  const canJoin = p.join === 'app' && !!p.link && mayEnter;
  return {
    id: p.id, name: p.name, owner: p.owner, ownerName: p.ownerName || null, mine: !!mine, member,
    online, players: online ? p.players || 0 : 0, max: p.max || 0, lastSeen: p.lastSeen || null,
    join: p.join, access: p.access, show: p.show, relay: !!p.relay,
    chat: c ? { id: c.id, name: c.name, member } : null,
    link: mine || canJoin ? p.link || '' : null, canJoin,
    ...(mine ? { welcome: p.welcome || '' } : {}),
  };
}

// Liste für die App: eigene Server und alle, die man sehen darf (zuletzt 30 Tage aktiv)
export async function listPrivateServers(store, user) {
  const ids = (await store.get('pservers:index')) || [];
  const since = Date.now() - SHOWN_DAYS * 86400000;
  const cache = new Map();
  const mine = [];
  const visible = [];
  for (const id of ids.slice(0, 400)) {
    const p = await load(store, id);
    if (!p) continue;
    const v = await pserverView(store, p, user, cache);
    if (!v) continue;
    if (v.mine) mine.push(v);
    else if ((p.lastSeen || 0) > since) visible.push(v);
  }
  const order = (a, b) => (b.online - a.online) || (b.players - a.players) || ((b.lastSeen || 0) - (a.lastSeen || 0));
  return { mine: mine.sort(order), visible: visible.sort(order) };
}

// Einstellungen des Besitzers
export async function updatePrivateServer(store, user, id, body) {
  const p = await load(store, id);
  if (!p) throw bad('not_found', 404);
  if (p.owner !== user.sub) throw bad('forbidden', 403);
  const pick = (v, list, def) => (list.includes(v) ? v : def);
  if (body.name !== undefined) p.name = clip(body.name, 50).replace(/\s+/g, ' ').trim() || p.name;
  p.join = pick(body.join, ['app', 'roblox'], p.join);
  if (body.link !== undefined) p.link = cleanLink(body.link);
  p.access = pick(body.access, ['all', 'members'], p.access);
  p.show = pick(body.show, ['public', 'members', 'owner'], p.show);
  if (body.welcome !== undefined) p.welcome = clip(body.welcome, 300).replace(/\r/g, '').trim();
  if (typeof body.relay === 'boolean') p.relay = body.relay;
  if (body.chat !== undefined) await linkChat(store, user, p, body.chat || null);
  await store.put(`pserver:${p.id}`, p);
  return pserverView(store, p, user);
}

// Server mit einem Server-Chat verbinden (nur der Besitzer, der Chat muss ihm gehören oder er ist dort Admin)
export async function linkChat(store, user, p, chatId) {
  const old = p.chat;
  if (old === chatId) return;
  if (chatId) {
    const c = await store.get(`chat:${chatId}`);
    const role = c && c.kind === 'group' && c.members[user.sub] && c.members[user.sub].role;
    if (!c || !['owner', 'admin', 'mod'].includes(role)) throw bad('chat_forbidden', 403);
    c.category = 'server';
    c.servers = [...new Set([...(c.servers || []), p.id])].slice(0, 20);
    await store.put(`chat:${c.id}`, c, { ttl: 180 * 86400 });
  }
  if (old) {
    const c = await store.get(`chat:${old}`);
    if (c) {
      c.servers = (c.servers || []).filter((x) => x !== p.id);
      await store.put(`chat:${c.id}`, c, { ttl: 180 * 86400 });
    }
  }
  p.chat = chatId;
}

// Für Chat-Ansichten: die verbundenen Server
export async function serversOfChat(store, c, user) {
  const out = [];
  for (const id of c.servers || []) {
    const p = await load(store, id);
    if (p && p.chat === c.id) {
      const v = await pserverView(store, p, user, new Map([[c.id, c]]));
      if (v) out.push(v);
    }
  }
  return out;
}

/*
 * Abgleich aus dem Spiel für einen privaten Server: Stand speichern und die Einstellungen zurückgeben,
 * die das Spiel umsetzt (wer darf rein, Begrüßung, Regeln, Nachrichten aus dem Server-Chat).
 */
export async function privateServerSync(store, sv, online, ownerName) {
  const id = clip(sv.privateId, 64);
  const owner = String(sv.ownerId || '');
  if (!/^[\w-]{6,64}$/.test(id)) return null;
  const t = Date.now();
  let p = await load(store, id);
  if (!p) {
    p = { id, owner: /^\d{1,20}$/.test(owner) && owner !== '0' ? owner : null, name: ownerName ? `Privater Server von ${ownerName}` : 'Privater Server', ...DEFAULTS, firstSeen: t };
    const index = (await store.get('pservers:index')) || [];
    await store.put('pservers:index', [id, ...index.filter((x) => x !== id)].slice(0, 2000));
  }
  if (!p.ownerName && ownerName) p.ownerName = ownerName;
  Object.assign(p, {
    lastSeen: t, closed: !!sv.closing, jobId: clip(sv.jobId, 64), players: Math.max(0, Math.round(+sv.players || online.length)),
    max: Math.max(0, Math.round(+sv.max || 0)),
  });
  await store.put(`pserver:${id}`, p);
  if (sv.closing) return null;
  const c = p.chat ? await store.get(`chat:${p.chat}`) : null;
  const since = Math.max(+sv.relaySince || 0, t - 10 * 60000);
  const relay = c && p.relay ? c.messages.filter((m) => m.at > since && m.by !== 'system' && m.kind !== 'bot' && !m.only && !m.deleted && m.text && !m.text.startsWith('/'))
    .slice(-20).map((m) => ({ id: m.id, by: m.by, name: m.name || '?', text: clip(m.text, 200), at: m.at })) : [];
  return {
    privateId: id, name: p.name, chat: c ? c.name : null,
    access: p.access, allowed: p.access === 'members' ? [...new Set([p.owner, ...memberIds(c)].filter(Boolean))] : null,
    welcome: p.welcome || '', welcomeBy: p.owner, rules: c ? clip(c.rules || '', 500) : '', relay,
  };
}
