/*
 * Train Sim Germany – eigene Bots in Gruppen- und Server-Chats
 *
 * Wer einen Chat leitet (Inhaber, Admins, Rolle mit „Gruppe verwalten“), erstellt eigene Bots mit Namen und Bild.
 * Sie laufen direkt im Chat – Discord ist nicht nötig (ist der Chat mit Discord verbunden, können sie auch dorthin schreiben).
 *
 *   Regeln mit Vorlage, z. B. „Wenn jemand beitritt“ → „Willkommen {username} auf {server}!“
 *
 *   chat:<id>.bots            → [{ id, name, desc, avatar, on, prefix, rev }]   (kurz, für Anzeige und Laufzeit)
 *   bot:<chatId>:<botId>      → { …, rules, stats }
 *   botphoto:<chatId>:<botId> → Bild (JPEG, 256 × 256)
 *
 * In Servern mit Kanälen antworten Bots im Kanal der Nachricht; Beitreten, Verlassen und das Spiel landen im Standardkanal.
 * Bot-Nachrichten lösen keine Bots aus (keine Schleifen) und schicken keine Benachrichtigungen.
 * Grenzen: 5 Bots je Chat, 15 Regeln je Bot, 20 Nachrichten je Minute und Bot.
 */
import { clip, randomKey } from './lib.js';
import { sendToDiscord } from './discord.js';
import { homeOf, pickChannel } from './channels.js';

const bad = (msg = 'bad_request', status = 400) => Object.assign(new Error(msg), { status });
const MAX_BOTS = 5;
const MAX_RULES = 15;
const PER_MINUTE = 20;
const KEEP = 180 * 86400;
export const RULE_TRIGGERS = ['join', 'leave', 'game_join', 'game_leave', 'command'];
const TARGETS = ['chat', 'discord', 'both'];
// Auch mit Apostroph: „Lorthien's Bot“
const NAME = /^[\p{L}\p{N} _.'’\-]{2,32}$/u;

const keyOf = (chatId, botId) => `bot:${chatId}:${botId}`;
const photoKey = (chatId, botId) => `botphoto:${chatId}:${botId}`;
export const metaOf = (b) => ({ id: b.id, name: b.name, desc: b.desc || '', avatar: b.avatar || null, on: b.on !== false, prefix: b.prefix || '!', rev: b.rev || 0 });

function cleanName(v, fallback) {
  const n = clip(String(v || ''), 32).replace(/\s+/g, ' ').trim();
  return NAME.test(n) ? n : fallback;
}
function cleanRules(list) {
  return (Array.isArray(list) ? list : []).slice(0, MAX_RULES).map((r) => ({
    id: /^[\w-]{4,16}$/.test(String((r && r.id) || '')) ? r.id : randomKey(6),
    trigger: RULE_TRIGGERS.includes(r && r.trigger) ? r.trigger : 'join',
    command: clip(String((r && r.command) || ''), 24).toLowerCase().replace(/[^\p{L}\p{N}_-]/gu, ''),
    target: TARGETS.includes(r && r.target) ? r.target : 'chat',
    template: clip(String((r && r.template) || '').replace(/\r/g, ''), 500).trim(),
    on: !(r && r.on === false),
  })).filter((r) => r.template && (r.trigger !== 'command' || r.command));
}
// Platzhalter wie {username} oder {chat.name}; {{ und }} für geschweifte Klammern
export function renderTemplate(tpl, vars) {
  return String(tpl || '').replace(/\{\{|\}\}|\{\s*([A-Za-z_\u00C0-\u024F][\w\u00C0-\u024F]*(?:\.[\w\u00C0-\u024F]+)*)\s*\}/g, (m, path) => {
    if (m === '{{') return '{';
    if (m === '}}') return '}';
    let v = vars;
    for (const k of path.split('.')) {
      if (v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, k)) v = v[k];
      else return m;
    }
    return Array.isArray(v) ? v.join(' ') : v === null || v === undefined ? '' : String(v);
  }).slice(0, 1900);
}

async function loadBot(store, chatId, botId) {
  return /^[\w-]{4,16}$/.test(botId) ? store.get(keyOf(chatId, botId)) : null;
}
const full = (b) => ({ ...metaOf(b), rules: b.rules || [], stats: b.stats || {}, created: b.created, updated: b.updated });

// Alte Automationen der Discord-Verbindung werden zu einem Bot im Basis-Modus
export async function migrateAutomations(store, c) {
  const d = c.discord;
  if (!d || !(d.automations || []).length) return false;
  if (!(c.bots || []).length) {
    const b = {
      id: randomKey(6), name: cleanName(d.botName, 'TSG-Bot'), desc: '', avatar: null, on: true, prefix: '!', rev: Date.now(),
      rules: cleanRules(d.automations.map((a) => ({ ...a, trigger: a.trigger, target: a.target }))), stats: {},
      created: Date.now(), updated: Date.now(),
    };
    await store.put(keyOf(c.id, b.id), b, { ttl: KEEP });
    c.bots = [metaOf(b)];
  }
  delete d.automations;
  return true;
}

export async function listBots(store, c, canManage) {
  if (await migrateAutomations(store, c)) await store.put(`chat:${c.id}`, c, { ttl: KEEP });
  return { bots: (c.bots || []).map(metaOf), canManage };
}
export async function getBot(store, c, botId) {
  const b = await loadBot(store, c.id, botId);
  if (!b) throw bad('not_found', 404);
  return full(b);
}
export async function createBot(store, c, body) {
  if (c.kind !== 'group') throw bad('not_group');
  await migrateAutomations(store, c);
  if ((c.bots || []).length >= MAX_BOTS) throw bad('too_many_bots', 409);
  const t = Date.now();
  const b = {
    id: randomKey(6), name: cleanName(body.name, ''), desc: clip(String(body.desc || ''), 140).trim(), avatar: null, on: true,
    prefix: '!', rev: t, rules: cleanRules([{ trigger: 'join', target: 'chat', template: 'Willkommen {username} auf {server}! 👋' }]), stats: {}, created: t, updated: t,
  };
  if (!b.name) throw bad('bad_name');
  c.bots = [...(c.bots || []), metaOf(b)];
  await store.put(keyOf(c.id, b.id), b, { ttl: KEEP });
  return b;
}
// Einstellungen und Regeln speichern
export async function updateBot(store, env, c, botId, body) {
  const b = await loadBot(store, c.id, botId);
  if (!b) throw bad('not_found', 404);
  if (body.name !== undefined) { const n = cleanName(body.name, ''); if (!n) throw bad('bad_name'); b.name = n; }
  if (body.desc !== undefined) b.desc = clip(String(body.desc || ''), 140).trim();
  if (body.on !== undefined) b.on = body.on !== false;
  if (body.prefix !== undefined) {
    const p = String(body.prefix || '').trim();
    if (!/^[!?.$%&#+~-]{1,3}$/.test(p)) throw bad('bad_prefix');
    b.prefix = p;
  }
  if (body.rules !== undefined) b.rules = cleanRules(body.rules);
  // Reste des früheren Skript-Modus
  delete b.mode; delete b.files; delete b.memory; delete b.logs;
  b.updated = Date.now();
  b.rev = b.updated;
  c.bots = (c.bots || []).map((x) => (x.id === b.id ? metaOf(b) : x));
  await store.put(keyOf(c.id, b.id), b, { ttl: KEEP });
  return { bot: full(b), posted: false };
}
export async function deleteBot(store, c, botId) {
  if (!(c.bots || []).some((x) => x.id === botId)) throw bad('not_found', 404);
  c.bots = c.bots.filter((x) => x.id !== botId);
  await store.delete(keyOf(c.id, botId));
  await store.delete(photoKey(c.id, botId));
}
export async function setBotPhoto(store, c, botId, req) {
  const meta = (c.bots || []).find((x) => x.id === botId);
  const b = meta && await loadBot(store, c.id, botId);
  if (!b) throw bad('not_found', 404);
  if (req.method === 'DELETE') {
    await store.delete(photoKey(c.id, botId));
    b.avatar = null;
  } else {
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length > 300000) throw bad('too_large', 413);
    if (!(bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF)) throw bad('bad_type', 415);
    await store.put(photoKey(c.id, botId), bytes, { ttl: KEEP });
    b.avatar = Date.now();
  }
  b.updated = Date.now();
  b.rev = b.updated;
  c.bots = c.bots.map((x) => (x.id === b.id ? metaOf(b) : x));
  await store.put(keyOf(c.id, b.id), b, { ttl: KEEP });
  return full(b);
}
export async function botPhotoResponse(store, chatId, botId, headers = {}) {
  const bytes = /^[\w-]{6,30}$/.test(chatId) && /^[\w-]{4,16}$/.test(botId) && await store.get(photoKey(chatId, botId));
  if (!bytes) return new Response('not found', { status: 404, headers });
  return new Response(bytes, {
    headers: { ...headers, 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=604800, immutable', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'cross-origin' },
  });
}

// ---------- Laufzeit ----------
const recent = new Map();
function allowed(botId) {
  const t = Date.now();
  const list = (recent.get(botId) || []).filter((x) => x > t - 60000);
  recent.set(botId, list);
  return list.length < PER_MINUTE;
}
function baseVars(env, c, b) {
  return {
    bot: b.name, chat: c.name || '', server: c.name || '', members: Object.keys(c.members || {}).length,
    game: 'Train Sim Germany', gameId: String(env.ROBLOX_PLACE_ID || '140440792597921'),
    time: new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date()),
    date: new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date()),
  };
}
const personVars = (p) => (p ? { username: p.username || p.name || '', displayName: p.displayName || p.dn || p.username || p.name || '', userId: String(p.sub || p.id || '') } : {});

// Nachricht eines eigenen Bots (nur Text)
function botMessage(c, b, text, ch) {
  c.messages.push({ id: randomKey(6), by: 'bot', kind: 'bot', botId: b.id, title: b.name, text: clip(text, 1900), at: Date.now(), rows: [], buttons: [], ...(ch ? { ch } : {}) });
}
async function say(store, env, c, b, texts, discords, ch = null) {
  let posted = false;
  for (const text of texts) {
    if (!allowed(b.id)) break;
    recent.get(b.id).push(Date.now());
    botMessage(c, b, text, ch);
    posted = true;
  }
  const d = c.discord;
  if (discords.length && d && d.status === 'active') {
    const avatar = b.avatar && env.BACKEND_URL ? `${env.BACKEND_URL.replace(/\/+$/, '')}/media/bot/${c.id}/${b.id}?v=${b.avatar}` : null;
    for (const text of discords) {
      if (!allowed(b.id)) break;
      recent.get(b.id).push(Date.now());
      await sendToDiscord(env, store, d, { username: b.name, avatar, content: text });
    }
  }
  return posted;
}
async function runBasic(store, env, c, b, trigger, vars, command = '', ch = homeOf(c)) {
  let posted = false;
  const d = c.discord;
  for (const r of b.rules || []) {
    if (!r.on || r.trigger !== trigger || (trigger === 'command' && r.command !== command)) continue;
    const text = renderTemplate(r.template, vars);
    if (r.target !== 'discord') posted = (await say(store, env, c, b, [text], [], ch)) || posted;
    if (r.target !== 'chat' && d && d.status === 'active') await say(store, env, c, b, [], [text]);
  }
  return posted;
}

// Ein Ereignis an alle eingeschalteten Bots eines Chats geben. true = es kam eine Nachricht in den Chat.
//   kind: join | leave | message | game_join | game_leave
//   ctx:  { person, text, players, serverName, serverId, ch (Kanal der Nachricht in Servern) }
export async function botsEvent(store, env, c, kind, ctx = {}) {
  if (c.kind !== 'group') return false;
  if (await migrateAutomations(store, c)) await store.put(`chat:${c.id}`, c, { ttl: KEEP });
  const metas = (c.bots || []).filter((x) => x.on);
  if (!metas.length) return false;
  let posted = false;
  for (const meta of metas) {
    const b = await loadBot(store, c.id, meta.id);
    if (!b || b.on === false) continue;
    const channel = pickChannel(c, ctx.ch && ctx.ch.id);
    const ch = channel ? channel.id : null;
    const vars = { ...baseVars(env, c, b), ...personVars(ctx.person), channel: channel ? channel.name : '' };
    if (kind.startsWith('game_')) Object.assign(vars, { server: ctx.serverName || vars.server, serverId: String(ctx.serverId || ''), players: ctx.players || 0 });
    let did = false;
    if (kind === 'message') {
      const text = String(ctx.text || '');
      const prefix = b.prefix || '!';
      const isCmd = text.startsWith(prefix) && text.length > prefix.length;
      const words = isCmd ? text.slice(prefix.length).trim().split(/\s+/) : [];
      const command = (words.shift() || '').toLowerCase();
      Object.assign(vars, { text, message: text });
      if (isCmd && command) did = await runBasic(store, env, c, b, 'command', { ...vars, command, args: words.join(' ') }, command, ch);
    } else {
      did = await runBasic(store, env, c, b, kind, vars);
    }
    if (did) {
      posted = true;
      b.stats = { runs: ((b.stats && b.stats.runs) || 0) + 1, lastRun: Date.now() };
      await store.put(keyOf(c.id, b.id), b, { ttl: KEEP });
    }
  }
  return posted;
}
