/*
 * Train Sim Germany – eigene Bots in Gruppen- und Server-Chats
 *
 * Wer einen Chat leitet (Inhaber, Admins, Rolle mit „Gruppe verwalten“), erstellt eigene Bots mit Namen und Bild.
 * Sie laufen direkt im Chat – Discord ist nicht nötig (ist der Chat mit Discord verbunden, können sie auch dorthin schreiben).
 *
 *   Basis-Modus:    Regeln mit Vorlage, z. B. „Wenn jemand beitritt“ → „Willkommen {username} auf {server}!“
 *   Erweitert:      Skripte in Luna (luna.js) – vier Arten:
 *                     ServerScript  läuft im Backend bei Ereignissen im Chat (onjoin, onleave, onmessage, oncommand, onstart)
 *                     GameScript    läuft im Backend bei Ereignissen im Spiel (onjoin/onleave in verbundenen privaten Servern)
 *                     ClientScript  läuft in der App der Person, die den Chat öffnet (onopen, onmessage) – nur sie sieht die Ausgabe
 *                     ModulScript   Bausteine, die andere Skripte mit require("Name") laden (Brücken)
 *
 *   chat:<id>.bots            → [{ id, name, desc, avatar, on, mode, prefix, rev }]   (kurz, für Anzeige und Laufzeit)
 *   bot:<chatId>:<botId>      → { …, rules, files, memory, logs, stats }
 *   botphoto:<chatId>:<botId> → Bild (JPEG, 256 × 256)
 *
 * Bot-Nachrichten lösen keine Bots aus (keine Schleifen) und schicken keine Benachrichtigungen.
 * Grenzen: 5 Bots je Chat, 25 Dateien je Bot, 12 000 Zeichen je Datei, 5 Nachrichten je Ereignis, 20 je Minute und Bot.
 */
import { clip, randomKey } from './lib.js';
import { runEvent, check, outline, bridges, renderTemplate, TYPES } from './luna.js';
import { sendToDiscord } from './discord.js';

const bad = (msg = 'bad_request', status = 400) => Object.assign(new Error(msg), { status });
const MAX_BOTS = 5;
const MAX_FILES = 25;
const MAX_CODE = 12000;
const MAX_TOTAL = 100000;
const MAX_RULES = 15;
const PER_MINUTE = 20;
const KEEP = 180 * 86400;
export const RULE_TRIGGERS = ['join', 'leave', 'game_join', 'game_leave', 'command'];
const TARGETS = ['chat', 'discord', 'both'];
const FILE_TYPES = Object.keys(TYPES);
const NAME = /^[\p{L}\p{N} _.\-]{2,32}$/u;
const FILE_NAME = /^[\p{L}\p{N}_\-]{1,32}$/u;

const keyOf = (chatId, botId) => `bot:${chatId}:${botId}`;
const photoKey = (chatId, botId) => `botphoto:${chatId}:${botId}`;
export const metaOf = (b) => ({ id: b.id, name: b.name, desc: b.desc || '', avatar: b.avatar || null, on: b.on !== false, mode: b.mode, prefix: b.prefix || '!', rev: b.rev || 0 });

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
function cleanFiles(list, old = []) {
  const seen = new Set();
  const files = (Array.isArray(list) ? list : []).slice(0, MAX_FILES).map((f) => {
    const name = clip(String((f && f.name) || ''), 32).trim();
    if (!FILE_NAME.test(name)) throw bad('bad_file_name');
    if (seen.has(name.toLowerCase())) throw bad('duplicate_file');
    seen.add(name.toLowerCase());
    const code = String((f && f.code) || '').replace(/\r/g, '');
    if (code.length > MAX_CODE) throw bad('file_too_large', 413);
    const prev = old.find((x) => x.id === (f && f.id));
    return {
      id: prev ? prev.id : randomKey(6),
      name,
      type: FILE_TYPES.includes(f && f.type) ? f.type : 'server',
      code,
      updated: prev && prev.code === code && prev.name === name ? prev.updated : Date.now(),
    };
  });
  if (files.reduce((n, f) => n + f.code.length, 0) > MAX_TOTAL) throw bad('bot_too_large', 413);
  return files;
}
// Prüfung aller Dateien: Fehler, Warnungen, Brücken (für die App)
function diagnose(files) {
  const report = {};
  files.forEach((f) => {
    const c = check(f.code);
    const o = outline(f.code, f.type);
    report[f.id] = { ok: c.ok, error: c.error || null, warnings: o.warnings, handlers: o.handlers.map((h) => h.event) };
  });
  return { checks: report, bridges: bridges(files) };
}

async function loadBot(store, chatId, botId) {
  return /^[\w-]{4,16}$/.test(botId) ? store.get(keyOf(chatId, botId)) : null;
}
const full = (b) => ({ ...metaOf(b), rules: b.rules || [], files: b.files || [], memory: b.memory || {}, logs: (b.logs || []).slice(-40), stats: b.stats || {}, created: b.created, updated: b.updated, ...diagnose(b.files || []) });

// Alte Automationen der Discord-Verbindung werden zu einem Bot im Basis-Modus
export async function migrateAutomations(store, c) {
  const d = c.discord;
  if (!d || !(d.automations || []).length) return false;
  if (!(c.bots || []).length) {
    const b = {
      id: randomKey(6), name: cleanName(d.botName, 'TSG-Bot'), desc: '', avatar: null, on: true, mode: 'basic', prefix: '!', rev: Date.now(),
      rules: cleanRules(d.automations.map((a) => ({ ...a, trigger: a.trigger, target: a.target }))), files: [], memory: {}, logs: [], stats: {},
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
  const mode = body.mode === 'advanced' ? 'advanced' : 'basic';
  const b = {
    id: randomKey(6), name: cleanName(body.name, ''), desc: clip(String(body.desc || ''), 140).trim(), avatar: null, on: true, mode,
    prefix: '!', rev: t, rules: [], files: [], memory: {}, logs: [], stats: {}, created: t, updated: t,
  };
  if (!b.name) throw bad('bad_name');
  if (mode === 'basic') b.rules = cleanRules([{ trigger: 'join', target: 'chat', template: 'Willkommen {username} auf {server}! 👋' }]);
  c.bots = [...(c.bots || []), metaOf(b)];
  await store.put(keyOf(c.id, b.id), b, { ttl: KEEP });
  return b;
}
// Einstellungen und Dateien speichern. Wird der Bot eingeschaltet oder ändern sich seine Skripte, läuft onstart().
export async function updateBot(store, env, c, botId, body) {
  const b = await loadBot(store, c.id, botId);
  if (!b) throw bad('not_found', 404);
  const wasOn = b.on !== false;
  const wasAdvanced = b.mode === 'advanced';
  const before = JSON.stringify((b.files || []).map((f) => [f.name, f.type, f.code]));
  if (body.name !== undefined) { const n = cleanName(body.name, ''); if (!n) throw bad('bad_name'); b.name = n; }
  if (body.desc !== undefined) b.desc = clip(String(body.desc || ''), 140).trim();
  if (body.on !== undefined) b.on = body.on !== false;
  if (body.mode !== undefined) b.mode = body.mode === 'advanced' ? 'advanced' : 'basic';
  if (body.prefix !== undefined) {
    const p = String(body.prefix || '').trim();
    if (!/^[!?.$%&#+~-]{1,3}$/.test(p)) throw bad('bad_prefix');
    b.prefix = p;
  }
  if (body.rules !== undefined) b.rules = cleanRules(body.rules);
  if (body.files !== undefined) b.files = cleanFiles(body.files, b.files || []);
  if (body.clearMemory === true) b.memory = {};
  if (body.clearLogs === true) b.logs = [];
  b.updated = Date.now();
  b.rev = b.updated;
  c.bots = (c.bots || []).map((x) => (x.id === b.id ? metaOf(b) : x));
  const changed = before !== JSON.stringify((b.files || []).map((f) => [f.name, f.type, f.code]));
  let posted = false;
  if (b.on && b.mode === 'advanced' && (changed || !wasOn || !wasAdvanced)) {
    posted = (await runAdvanced(store, env, c, b, 'server', 'start', baseVars(env, c, b), [])) || posted;
    posted = (await runAdvanced(store, env, c, b, 'game', 'start', baseVars(env, c, b), [])) || posted;
  }
  await store.put(keyOf(c.id, b.id), b, { ttl: KEEP });
  return { bot: full(b), posted };
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

// ClientScripts für die App (nur eingeschaltete Bots im erweiterten Modus, mit den Modulscripts, die sie laden)
export async function clientBundle(store, c) {
  const out = [];
  for (const meta of c.bots || []) {
    if (!meta.on || meta.mode !== 'advanced') continue;
    const b = await loadBot(store, c.id, meta.id);
    const files = (b && b.files) || [];
    if (!files.some((f) => f.type === 'client')) continue;
    out.push({ ...metaOf(b), files: files.filter((f) => f.type === 'client' || f.type === 'module').map(({ id, name, type, code }) => ({ id, name, type, code })) });
  }
  return out;
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

function botMessage(c, b, text) {
  c.messages.push({ id: randomKey(6), by: 'bot', kind: 'bot', botId: b.id, title: b.name, text: clip(text, 1900), at: Date.now(), rows: [], buttons: [] });
}
async function say(store, env, c, b, texts, discords) {
  let posted = false;
  for (const text of texts) {
    if (!allowed(b.id)) break;
    recent.get(b.id).push(Date.now());
    botMessage(c, b, text);
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
// Protokoll und Zähler (Syntaxfehler stehen schon in der Prüfung im Editor und kommen nicht bei jedem Ereignis ins Protokoll)
function remember(b, res, event) {
  const t = Date.now();
  const errors = res.errors.filter((e) => !e.parse);
  b.logs = [...(b.logs || []), ...res.logs.map((x) => ({ ...x, at: t, event }))].slice(-40);
  b.stats = { runs: ((b.stats && b.stats.runs) || 0) + (res.ran ? 1 : 0), lastRun: res.ran ? t : (b.stats && b.stats.lastRun) || null, lastError: errors.length ? { at: t, text: errors[0].message, file: errors[0].file, line: errors[0].line } : (b.stats && b.stats.lastError) || null };
  if (res.memChanged) b.memory = res.memory;
}
async function runAdvanced(store, env, c, b, type, event, vars, args) {
  if (!(b.files || []).some((f) => f.type === type)) return false;
  const res = runEvent({ files: b.files, type, event, vars, args, memory: b.memory || {} });
  if (!res.ran && !res.errors.some((e) => !e.parse) && !res.logs.length) return false;
  remember(b, res, event);
  return say(store, env, c, b, res.says, res.discords);
}
async function runBasic(store, env, c, b, trigger, vars, command = '') {
  let posted = false;
  const d = c.discord;
  for (const r of b.rules || []) {
    if (!r.on || r.trigger !== trigger || (trigger === 'command' && r.command !== command)) continue;
    const text = renderTemplate(r.template, vars);
    if (r.target !== 'discord') posted = (await say(store, env, c, b, [text], [])) || posted;
    if (r.target !== 'chat' && d && d.status === 'active') await say(store, env, c, b, [], [text]);
  }
  return posted;
}

// Ein Ereignis an alle eingeschalteten Bots eines Chats geben. true = es kam eine Nachricht in den Chat.
//   kind: join | leave | message | game_join | game_leave
//   ctx:  { person, text, players, serverName, serverId }
export async function botsEvent(store, env, c, kind, ctx = {}) {
  if (c.kind !== 'group') return false;
  if (await migrateAutomations(store, c)) await store.put(`chat:${c.id}`, c, { ttl: KEEP });
  const metas = (c.bots || []).filter((x) => x.on);
  if (!metas.length) return false;
  let posted = false;
  for (const meta of metas) {
    const b = await loadBot(store, c.id, meta.id);
    if (!b || b.on === false) continue;
    const vars = { ...baseVars(env, c, b), ...personVars(ctx.person) };
    if (kind.startsWith('game_')) Object.assign(vars, { server: ctx.serverName || vars.server, serverId: String(ctx.serverId || ''), players: ctx.players || 0 });
    const before = JSON.stringify([b.logs, b.memory, b.stats]);
    if (kind === 'message') {
      const text = String(ctx.text || '');
      const prefix = b.prefix || '!';
      const isCmd = text.startsWith(prefix) && text.length > prefix.length;
      const words = isCmd ? text.slice(prefix.length).trim().split(/\s+/) : [];
      const command = (words.shift() || '').toLowerCase();
      Object.assign(vars, { text, message: text });
      if (b.mode === 'advanced') {
        posted = (await runAdvanced(store, env, c, b, 'server', 'message', vars, [text, vars.username])) || posted;
        if (isCmd && command) posted = (await runAdvanced(store, env, c, b, 'server', 'command', { ...vars, command, args: words, argtext: words.join(' ') }, [command, words])) || posted;
      } else if (isCmd && command) {
        posted = (await runBasic(store, env, c, b, 'command', { ...vars, command, args: words.join(' ') }, command)) || posted;
      }
    } else if (b.mode === 'advanced') {
      const type = kind.startsWith('game_') ? 'game' : 'server';
      posted = (await runAdvanced(store, env, c, b, type, kind.replace('game_', ''), vars, [vars.username])) || posted;
    } else {
      posted = (await runBasic(store, env, c, b, kind, vars)) || posted;
    }
    if (JSON.stringify([b.logs, b.memory, b.stats]) !== before) await store.put(keyOf(c.id, b.id), b, { ttl: KEEP });
  }
  return posted;
}
