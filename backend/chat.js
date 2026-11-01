/*
 * Train Sim Germany – Chat
 *
 * Drei Arten von Gesprächen (alle unter „Gespräche“):
 *   ticket – Anfrage ans Team mit Grund und Bereich. Alle aus dem Team des Bereichs sehen sie und können sie annehmen.
 *   direct – zwei Personen. Jeder angemeldete Spieler kann jedem Roblox-Spieler schreiben, auch dem Team.
 *   group  – Gruppe mit Namen, bis zu 50 Leuten. Privat (nur auf Einladung) oder öffentlich (jeder kann beitreten).
 *            Inhaber und Admins legen Regeln fest und stellen ein: wer einladen und schreiben darf, Fotos/Videos,
 *            Langsam-Modus und Befehle (z. B. /GetGroupData, siehe commands.js).
 *
 * Sicherheit: Alle über Junior Supervisor (ab Supervisor) können jedes Gespräch jederzeit unsichtbar beobachten
 * oder sichtbar beitreten, Nachrichten löschen, Leute entfernen und Gespräche löschen – außer bei Gesprächen mit
 * jemandem, der einen höheren Rang hat. Jedes Beobachten wird intern vermerkt. Gespräche lassen sich melden.
 *
 * Benachrichtigungen bekommen alle Beteiligten außer dem Absender – aber nicht, wer das Gespräch (oder die
 * Chat-Übersicht) gerade offen hat, und nicht, wer das Gespräch stummgeschaltet hat (außer bei einer Erwähnung
 * mit @Name). Titel „[TSG] Name“, darunter die Nachricht; wo der Browser es kann, lässt sich direkt in der
 * Benachrichtigung antworten (signierter Link, 7 Tage gültig).
 *
 * Gruppen haben wie Discord eigene Rollen (Name, Farbe, Rechte) und eigene Bots (bots.js, Skripte in Luna).
 * Server (Gruppen mit category: 'server', „Communities“) haben dazu Kanäle und Kategorien wie Discord (channels.js)
 * und lassen sich nach Prüfung durch das Team mit Discord verbinden (siehe discord.js).
 * Ohne Namen heißen neue Server und Gruppen „Name's Server“, „Name's Server2“ …, Bots „Name's Bot“, „Name's Bot2“ …
 *
 *   chat:<id>       → Gespräch mit Nachrichten (die letzten 500)
 *   chats:index     → Übersicht aller Gespräche (eigene, Anfragen, öffentliche Gruppen, Moderation)
 *   chats:of:<id>   → Gesprächs-IDs eines Nutzers (Rückfall für ältere Gespräche)
 *   cache:staff2    → Teamliste aus der Roblox-Gruppe (30 Minuten)
 *
 * Gespräche werden 180 Tage nach der letzten Nachricht automatisch gelöscht.
 */
import { randomKey, clip } from './lib.js';
import { level, atLeast, matchRank } from './ranks.js';
import { notifyUser, notifyStaff } from './webpush.js';
import { sign, verify } from './secret.js';
import { REVIEW_RANK, updateConfig, requirements, publicView, sendToDiscord } from './discord.js';
import { metaOf as botMeta, listBots, getBot, createBot, updateBot, deleteBot, setBotPhoto, clientBundle, botsEvent } from './bots.js';
import { findPlayer, groupRole } from './roblox.js';
import { startUpload, attachFiles, deleteFiles, fileLinks } from './files.js';
import { serversOfChat, linkChat, cleanLink } from './pservers.js';
import { COMMANDS, COMMAND_IDS, FIRST_COMMANDS, parseCommand, runCommand } from './commands.js';
import { isCommunity, defaultLayout, layoutFor, layoutOf, homeOf, channelOf, pickChannel, cleanLayout, pruneMessages } from './channels.js';

export { findPlayer };

const bad = (msg = 'bad_request', status = 400) => Object.assign(new Error(msg), { status });
const MAX_MESSAGES = 500;
const MAX_MEMBERS = 50;
const NEW_PER_DAY = 15;
const KEEP = 180 * 86400;
const INDEX_MAX = 800;

export const REASONS = ['training', 'rank', 'bug', 'report', 'application', 'shop', 'other'];
const REASON_LABEL = { training: 'Frage zu einem Training', rank: 'Rang oder Beförderung', bug: 'Fehler im Spiel', report: 'Spieler melden', application: 'Bewerbung', shop: 'Coins, Züge, Strecken', other: 'Etwas anderes' };
const AREA_LABEL = { driver: 'Qualified Driver', platform: 'Platform Staff', conductor: 'Conductor', signaller: 'Signaller', career: 'Karriere & Bewerbungen', tech: 'Technik & Fehler', report: 'Meldungen', other: 'Allgemein' };
// Wer eine Anfrage annehmen darf: ab Supervisor, je nach Bereich. Leitung (OM, CDR, CEN) darf alles.
const LEADERSHIP = ['Operation Manager', 'Community Director', 'Chief Engineer'];
export const AREAS = {
  driver: ['Supervisor', 'Driver Manager'],
  platform: ['Supervisor', 'Platform Staff Manager'],
  conductor: ['Supervisor', 'Conductor Manager'],
  signaller: ['Supervisor', 'Signaller Manager'],
  career: ['Public Relations Department'],
  tech: ['Project Engineer'],
  report: '*',
  other: ['Supervisor', 'Public Relations Department'],
};
export const canHandle = (rank, area) => {
  if (!atLeast(rank, 'Supervisor') || !AREAS[area]) return false;
  return AREAS[area] === '*' || LEADERSHIP.includes(rank) || AREAS[area].includes(rank);
};
export const areasFor = (rank) => Object.keys(AREAS).filter((a) => canHandle(rank, a));
// Moderation: alle über Junior Supervisor
export const isMod = (rank) => atLeast(rank, 'Supervisor');

const person = (u) => ({ sub: String(u.sub), username: u.username, displayName: u.displayName || u.username, avatar: u.avatar || null, rank: u.rank || null });
const nameOf = (p) => p.displayName || p.username;
const COLORS = ['#EC0016', '#1455C0', '#408335', '#B35900', '#7A4BD1', '#0F8C8C', '#C2185B', '#3C414B'];

// ---------- Einstellungen einer Gruppe ----------
// Gespeichert wird, welche Befehle AUS sind (cmdsOff) – neue Befehle sind damit überall gleich an
const DEFAULTS = { visibility: 'private', invite: 'admins', write: 'all', media: true, slow: 0, cmd: 'all', cmdsOff: [], photo: 'admins' };
function settingsOf(c) {
  if (c.kind !== 'group') return { ...DEFAULTS, invite: 'none', cmds: COMMAND_IDS };
  const { cmds: oldCmds, ...st } = { ...DEFAULTS, ...(c.settings || {}) };
  const off = c.settings && c.settings.cmdsOff ? c.settings.cmdsOff : Array.isArray(oldCmds) ? FIRST_COMMANDS.filter((x) => !oldCmds.includes(x)) : [];
  return { ...st, cmdsOff: off, cmds: COMMAND_IDS.filter((x) => !off.includes(x)) };
}
function cleanSettings(v = {}, old = DEFAULTS) {
  const pick = (val, list, def) => (list.includes(val) ? val : def);
  return {
    visibility: pick(v.visibility, ['private', 'public'], old.visibility),
    invite: pick(v.invite, ['owner', 'admins', 'all'], old.invite),
    write: pick(v.write, ['all', 'admins'], old.write),
    media: typeof v.media === 'boolean' ? v.media : old.media,
    slow: [0, 5, 10, 30, 60, 300].includes(+v.slow) ? +v.slow : old.slow,
    cmd: pick(v.cmd, ['all', 'admins', 'off'], old.cmd),
    cmdsOff: Array.isArray(v.cmds) ? COMMAND_IDS.filter((x) => !v.cmds.includes(x)) : old.cmdsOff || [],
    photo: pick(v.photo, ['owner', 'admins', 'all'], old.photo),
  };
}
// Wer darf das Gruppenbild ändern?
const canPhoto = (c, role) => c.kind === 'group' && !!role
  && (role === 'owner' || role === 'mod' || (settingsOf(c).photo !== 'owner' && role === 'admin') || settingsOf(c).photo === 'all');

// ---------- Wer ist dabei, wer darf was? ----------
function people(c) {
  const out = {};
  if (c.kind === 'group') Object.values(c.members || {}).forEach((p) => { out[p.sub] = p; });
  else [c.from, c.to, c.claimedBy].forEach((p) => { if (p) out[p.sub] = p; });
  Object.values(c.mods || {}).forEach((p) => { out[p.sub] = { ...p, role: 'mod' }; });
  return out;
}
const roleOf = (c, sub) => { const p = people(c)[sub]; return p ? p.role || 'member' : null; };
const isManager = (role) => role === 'owner' || role === 'admin' || role === 'mod';

// ---------- Eigene Rollen (wie bei Discord): Name, Farbe, Rechte ----------
//   write – schreiben, auch wenn nur Admins dürfen · media – Fotos und Videos · invite – Leute einladen
//   commands – Befehle, auch wenn nur Admins dürfen · messages – Nachrichten anderer löschen · kick – Mitglieder entfernen
//   mention – @alle erwähnen · manage – Gruppe bearbeiten, Rollen und Discord einrichten
export const PERMS = ['write', 'media', 'invite', 'commands', 'messages', 'kick', 'mention', 'manage'];
const MAX_ROLES = 20;
function rolesOf(c, sub) {
  const p = c.kind === 'group' && c.members && c.members[sub];
  const ids = (p && p.roles) || [];
  return (c.roles || []).filter((r) => ids.includes(r.id));
}
const hasPerm = (c, sub, perm) => isManager(roleOf(c, sub)) || rolesOf(c, sub).some((r) => r.perms.includes(perm));
function cleanRoles(list, old = []) {
  return (Array.isArray(list) ? list : []).slice(0, MAX_ROLES).map((r) => ({
    id: old.some((o) => o.id === (r && r.id)) ? r.id : randomKey(6),
    name: clip(String((r && r.name) || ''), 30).replace(/\s+/g, ' ').trim(),
    color: /^#[0-9a-fA-F]{6}$/.test((r && r.color) || '') ? r.color.toUpperCase() : '#878C96',
    perms: PERMS.filter((x) => Array.isArray(r && r.perms) && r.perms.includes(x)),
  })).filter((r) => r.name.length >= 2);
}
const topLevel = (c) => Math.max(-1, ...Object.values(people(c)).map((p) => level(p.rank || 'Guest')));
// Beobachten: ab Supervisor, aber nicht bei Gesprächen mit höherem Rang
const canObserve = (c, user) => isMod(user.rank) && topLevel(c) <= level(user.rank);

function access(c, user) {
  const role = roleOf(c, user.sub);
  const st = settingsOf(c);
  const team = c.kind === 'ticket' && canHandle(user.rank, c.area);
  const pub = c.kind === 'group' && st.visibility === 'public' && !(c.banned || []).includes(user.sub);
  const mod = canObserve(c, user);
  let write = !!role && c.status !== 'closed';
  if (write && st.write === 'admins' && !hasPerm(c, user.sub, 'write')) write = false;
  const manage = c.kind === 'group' && !!role && hasPerm(c, user.sub, 'manage');
  return { role, team, pub, mod, see: !!role || team || pub || mod, observe: !role && !team && !pub && mod, moderate: isManager(role) || mod, admin: isManager(role), manage, write };
}
function enabledCommands(c, role, sub) {
  const st = settingsOf(c);
  if (st.cmd === 'off' || (st.cmd === 'admins' && !isManager(role) && !(sub && hasPerm(c, sub, 'commands')))) return [];
  return st.cmds;
}
const canInvite = (c, role, sub) => {
  if (c.kind !== 'group' || !role) return false;
  const st = settingsOf(c);
  return role === 'owner' || role === 'mod' || (st.invite === 'admins' && role === 'admin') || st.invite === 'all' || hasPerm(c, sub, 'invite');
};

// ---------- Anwesenheit: wer hat das Gespräch gerade offen? (nur im Speicher, keine Schreibzugriffe) ----------
const presence = new Map();
export function seen(sub, where) {
  if (presence.size > 5000) presence.clear();
  presence.set(sub, { at: Date.now(), where });
}
function watching(sub, id) {
  const p = presence.get(sub);
  if (!p) return false;
  const age = Date.now() - p.at;
  return (p.where === id && age < 15000) || (p.where === 'list' && age < 25000);
}

// ---------- Übersicht ----------
const SYSTEM_TEXT = {
  claimed: (m) => `${m.name} hat die Anfrage angenommen`, closed: (m) => `${m.name} hat das Gespräch beendet`,
  created: (m) => `${m.name} hat die Gruppe erstellt`, joined: (m) => `${m.name} ist beigetreten`, left: (m) => `${m.name} hat die Gruppe verlassen`,
  added: (m) => `${m.name} hat ${m.target} hinzugefügt`, removed: (m) => `${m.name} hat ${m.target} entfernt`,
  mod: (m) => `${m.name} (Moderation) ist beigetreten`, settings: (m) => `${m.name} hat die Gruppe bearbeitet`,
  role: (m) => `${m.target} ist jetzt ${m.role === 'owner' ? 'Inhaber' : m.role === 'admin' ? 'Admin' : 'Mitglied'}`,
  photo: (m) => `${m.name} hat das Gruppenbild geändert`, servers: (m) => `${m.name} hat die verbundenen Server geändert`,
  roles: (m) => `${m.name} hat die Rollen geändert`, channels: (m) => `${m.name} hat die Kanäle geändert`,
  community: (m) => `${m.name} hat die Gruppe in einen Server mit Kanälen umgewandelt`,
  bot: (m) => (m.action === 'deleted' ? `${m.name} hat den Bot ${m.target} entfernt` : `${m.name} hat den Bot ${m.target} erstellt`),
  discord: (m) => ({ pending: `${m.name} hat die Discord-Verbindung zur Prüfung eingereicht`, accepted: 'Die Discord-Verbindung wurde angenommen', denied: 'Die Discord-Verbindung wurde abgelehnt', removed: `${m.name} hat die Discord-Verbindung entfernt` }[m.target] || ''),
};
function previewOf(m) {
  if (m.deleted) return 'Nachricht gelöscht';
  if (m.by === 'system') return (SYSTEM_TEXT[m.text] || (() => ''))(m);
  if (m.kind === 'bot') return m.botId ? m.text || (m.embed ? m.embed.title || m.embed.text || '' : '') : `🤖 ${m.title || ''}`;
  if (m.text) return m.text;
  const f = (m.files || [])[0];
  return f ? (f.kind === 'image' ? '📷 Foto' : f.kind === 'video' ? '🎬 Video' : `📎 ${f.name}`) : '';
}
const lastOf = (c) => [...c.messages].reverse().find((m) => !m.only) || null;
function summary(c) {
  const ppl = people(c);
  const last = lastOf(c);
  return {
    id: c.id, kind: c.kind, reason: c.reason || null, area: c.area || null, status: c.status, ref: c.ref || null,
    from: c.from, to: c.to || null, claimedBy: c.claimedBy || null,
    name: c.name || null, desc: c.desc ? clip(c.desc, 140) : null, color: c.color || null, photo: c.photo || null,
    category: c.category || null, servers: (c.servers || []).length,
    visibility: settingsOf(c).visibility, subs: Object.keys(ppl), count: Object.keys(ppl).length, top: topLevel(c),
    admins: Object.values(ppl).filter((p) => isManager(p.role)).map((p) => p.sub),
    hidden: c.hidden || {}, banned: c.banned || [], reported: (c.reports || []).length,
    created: c.created, updated: c.updated,
    last: last ? { by: last.by, name: last.by === 'bot' ? (last.botId ? last.title || 'Bot' : 'TSG-Bot') : last.by === 'system' ? null : nameOf(ppl[last.by] || { username: last.name || '?' }), text: clip(previewOf(last), 120) } : null,
  };
}
// Für die App: ohne interne Listen
const strip = ({ subs, hidden, banned, top, admins, ...rest }) => rest;
// Für die eigene Liste: bin ich dort Inhaber oder Admin?
const forMe = (x, sub) => ({ ...strip(x), admin: (x.admins || []).includes(sub) });

async function loadIndex(store) {
  let idx = await store.get('chats:index');
  if (!idx) {
    // Übernahme aus der alten Anfrageliste
    idx = ((await store.get('chats:queue')) || []).map((x) => ({
      ...x, subs: [x.from && x.from.sub, x.to && x.to.sub, x.claimedBy && x.claimedBy.sub].filter(Boolean), top: -1, visibility: 'private', hidden: {}, banned: [],
    }));
    await store.put('chats:index', idx);
  }
  return idx;
}
async function saveIndex(store, c, { remove = false } = {}) {
  let idx = (await loadIndex(store)).filter((x) => x.id !== c.id);
  if (!remove) idx.unshift(summary(c));
  const old = Date.now() - KEEP * 1000;
  idx = idx.filter((x) => x.updated > old).sort((a, b) => b.updated - a.updated);
  if (idx.length > INDEX_MAX) {
    const done = Date.now() - 30 * 86400000;
    idx = idx.filter((x) => !(x.kind === 'ticket' && x.status === 'closed' && x.updated < done)).slice(0, INDEX_MAX);
  }
  await store.put('chats:index', idx);
}
async function addTo(store, sub, id) {
  const key = `chats:of:${sub}`;
  const list = (await store.get(key)) || [];
  if (!list.includes(id)) await store.put(key, [id, ...list].slice(0, 100));
}
async function save(store, c) {
  // Nur die letzten 500 Nachrichten bleiben (Server: 200 je Kanal, 1500 insgesamt), Dateien älterer Nachrichten werden gelöscht
  const gone = pruneMessages(c, MAX_MESSAGES);
  if (gone.length) await deleteFiles(store, gone.flatMap((m) => m.files || []));
  await store.put(`chat:${c.id}`, c, { ttl: KEEP });
  await saveIndex(store, c);
}
const sys = (c, text, name, extra = {}) => c.messages.push({ id: randomKey(6), by: 'system', text, name, at: Date.now(), ...extra });

// ---------- Benachrichtigungen ----------
const preview = (text) => (text.length > 140 ? `${text.slice(0, 139)}…` : text);
// Wie bei Messengern: Profilbild des Absenders, „[TSG] Name“ als Titel, darunter die Nachricht
const fromPerson = (p, text, title = nameOf(p)) => ({ style: 'person', title: `[TSG] ${title}`, body: preview(text), ...(p.avatar ? { icon: p.avatar } : {}) });
const REPLY_ACTION = { action: 'reply', type: 'text', title: 'Antworten', placeholder: 'Antwort schreiben …' };
const OPEN_ACTION = { action: 'open', title: 'Öffnen' };
// Erwähnte (@Name) bekommen die Nachricht auch, wenn sie das Gespräch stummgeschaltet haben.
// Wer schreiben darf, kann direkt in der Benachrichtigung antworten (signierter Link, 7 Tage).
async function notifyOthers(store, env, c, author, message, { mentioned = [] } = {}) {
  const ppl = people(c);
  const ids = Object.keys(ppl).filter((id) => id !== author && !watching(id, c.id) && (mentioned.includes(id) || !(c.muted && c.muted[id])));
  const exp = Date.now() + 7 * 86400000;
  await Promise.all(ids.map(async (id) => {
    const canReply = c.status !== 'closed' && access(c, { sub: id, rank: ppl[id].rank }).write;
    const extra = canReply ? { reply: { chat: c.id, sub: id, exp, k: await sign(env, store, `reply|${id}|${c.id}|${exp}`) }, actions: [REPLY_ACTION, OPEN_ACTION] } : {};
    return notifyUser(store, env, id, 'chat', { url: `./#/chat/${c.id}`, tag: `chat-${c.id}`, ...message, ...extra });
  }));
}
// @Name (Roblox-Name eines Mitglieds), @alle nur mit Recht „mention“ bzw. für Admins
function mentionsIn(c, text, author, everyone) {
  const names = new Set((String(text).match(/@([A-Za-z0-9_]{2,20})/g) || []).map((x) => x.slice(1).toLowerCase()));
  if (!names.size || c.kind !== 'group') return [];
  const all = everyone && (names.has('alle') || names.has('everyone'));
  return Object.values(c.members || {}).filter((p) => p.sub !== author && (all || names.has(String(p.username || '').toLowerCase()))).map((p) => p.sub);
}
const messageTitle = (c, p, ch = null) => (c.kind === 'group' ? `${nameOf(p)} · ${c.name}${ch ? ` #${ch.name}` : ''}` : nameOf(p));

// ---------- Standardnamen: „Lorthien's Server“, „Lorthien's Server2“ … ----------
export function defaultName(user, what, taken = []) {
  const base = `${user.username || user.displayName || 'Spieler'}'s ${what}`;
  const used = new Set(taken.map((x) => String(x || '').toLowerCase()));
  for (let n = 1; n < 1000; n++) {
    const name = n === 1 ? base : `${base}${n}`;
    if (!used.has(name.toLowerCase())) return name;
  }
  return `${base}${Date.now() % 100000}`;
}
// Welchen Kanal hat jemand zuletzt offen? (nur im Speicher – Antworten auf Aktionen zeigen denselben Kanal)
const lastChannel = new Map();
const rememberChannel = (sub, chatId, ch) => {
  if (lastChannel.size > 5000) lastChannel.clear();
  if (ch) lastChannel.set(`${sub}:${chatId}`, ch);
};

// ---------- Personen finden (Team zuerst, dann Roblox) ----------
async function resolvePerson(store, env, query) {
  const q = String(query || '').trim().replace(/^@/, '');
  if (!q) return null;
  const staff = await staffList(store, env).catch(() => []);
  const hit = staff.find((x) => x.userId === q || x.username.toLowerCase() === q.toLowerCase());
  if (hit) return { sub: hit.userId, username: hit.username, displayName: hit.displayName, avatar: hit.avatar || null, rank: hit.rank };
  let p = null;
  try { p = await findPlayer(env, q); } catch (e) { p = null; }
  if (!p) return null;
  const known = await store.get(`user:${p.userId}`);
  let rank = known && known.rank;
  if (!rank) { try { const r = await groupRole(env, p.userId); rank = r ? r.app : 'Guest'; } catch (e) { rank = null; } }
  return { sub: p.userId, username: p.username, displayName: p.displayName, avatar: p.avatar || null, rank };
}

// ---------- Lesen ----------
export async function getChat(store, user, id) {
  if (!/^[\w-]{6,30}$/.test(id)) throw bad('not_found', 404);
  const c = await store.get(`chat:${id}`);
  if (!c || !access(c, user).see) throw bad('not_found', 404);
  return c;
}

// Darf jemand in diesen Kanal schreiben? Ankündigungen: Inhaber, Admins, Moderation und Rollen mit „Schreiben“
const canPostIn = (c, user, ch) => !ch || ch.kind !== 'news' || isManager(roleOf(c, user.sub)) || hasPerm(c, user.sub, 'write');

async function view(env, store, c, user, { ch: wantCh } = {}) {
  const a = access(c, user);
  const st = settingsOf(c);
  const link = await fileLinks(env, store, c.id);
  const layout = layoutOf(c);
  // Server: nur die Nachrichten des offenen Kanals, dazu je Kanal die letzte Nachricht (für „ungelesen“)
  const channel = layout ? pickChannel(c, wantCh || lastChannel.get(`${user.sub}:${c.id}`)) : null;
  const visible = c.messages.filter((m) => !m.only || m.only === user.sub);
  const lastIn = {};
  if (layout) visible.forEach((m) => { if (m.by !== 'system' && !m.deleted) lastIn[channelOf(c, m)] = { at: m.at, by: m.by }; });
  const messages = (channel ? visible.filter((m) => channelOf(c, m) === channel.id) : visible)
    .map((m) => (m.files ? { ...m, files: m.files.map((f) => ({ ...f, url: link(f.id) })) } : m));
  const order = { owner: 0, mod: 1, admin: 2, member: 3 };
  const members = Object.values(people(c)).map((p) => ({ ...p, role: p.role || 'member' }))
    .sort((x, y) => order[x.role] - order[y.role] || level(y.rank || 'Guest') - level(x.rank || 'Guest') || nameOf(x).localeCompare(nameOf(y)));
  const cmds = enabledCommands(c, a.role, user.sub);
  return {
    id: c.id, kind: c.kind, status: c.status, reason: c.reason || null, area: c.area || null, ref: c.ref || null, app: c.app || null,
    name: c.name || null, desc: c.desc || '', rules: c.rules || '', color: c.color || null, owner: c.owner || null,
    photo: c.photo || null, category: c.category || null, servers: c.kind === 'group' ? await serversOfChat(store, c, user) : [],
    from: c.from, to: c.to || null, claimedBy: c.claimedBy || null, created: c.created, updated: c.updated,
    settings: c.kind === 'group' ? st : null, members, messages, roles: c.kind === 'group' ? c.roles || [] : [],
    me: { sub: user.sub, role: a.role, observe: a.observe, muted: !!(c.muted && c.muted[user.sub]) },
    canWrite: a.write && canPostIn(c, user, channel),
    ...(layout ? {
      community: true, channel: channel.id, home: layout.home, categories: layout.categories,
      channels: layout.channels.map((x) => ({ ...x, last: lastIn[x.id] || null, locked: !canPostIn(c, user, x) })),
    } : {}),
    canClaim: c.kind === 'ticket' && c.status === 'open' && c.from.sub !== user.sub && canHandle(user.rank, c.area),
    canClose: c.kind !== 'group' && c.status !== 'closed' && !!a.role,
    canInvite: canInvite(c, a.role, user.sub),
    canAdmin: c.kind === 'group' && a.admin,
    canManage: !!a.manage || (c.kind === 'group' && a.mod),
    discord: c.kind !== 'group' ? null : (a.manage || a.mod) ? publicView(c) : c.discord && c.discord.status === 'active' ? { status: 'active' } : null,
    canPhoto: canPhoto(c, a.role),
    bots: c.kind === 'group' ? (c.bots || []).map(botMeta) : [],
    botsClient: c.kind === 'group' && a.role ? Math.max(0, ...(c.bots || []).filter((b) => b.on !== false && b.mode === 'advanced').map((b) => b.rev || 0)) : 0,
    canBots: c.kind === 'group' && (!!a.manage || a.mod),
    canModerate: a.moderate,
    canJoin: c.kind === 'group' && !a.role && a.pub,
    canJoinMod: !a.role && a.mod,
    canLeave: (c.kind === 'group' && !!a.role) || a.role === 'mod',
    canDeleteAll: (c.kind === 'group' && a.role === 'owner') || a.mod,
    canReport: !!a.role && c.kind !== 'ticket' && !a.mod,
    canMedia: !!a.role && (st.media || a.admin || hasPerm(c, user.sub, 'media')),
    commands: COMMANDS.filter((x) => cmds.includes(x.id)).map(({ usage, desc }) => ({ usage, desc })),
    ...(a.moderate ? { reports: c.reports || [], modlog: (c.modlog || []).slice(-20) } : {}),
  };
}

export async function listChats(store, user, watchingList = false) {
  if (watchingList) seen(user.sub, 'list');
  const idx = await loadIndex(store);
  const shown = (x) => !((x.hidden || {})[user.sub] >= x.updated);
  const mine = idx.filter((x) => x.subs.includes(user.sub) && shown(x));
  // Ältere Gespräche, die noch nicht in der Übersicht stehen, einmalig übernehmen
  for (const id of ((await store.get(`chats:of:${user.sub}`)) || []).slice(0, 60)) {
    if (idx.some((x) => x.id === id)) continue;
    const c = await store.get(`chat:${id}`);
    if (c && people(c)[user.sub]) {
      await saveIndex(store, c);
      if (shown(summary(c))) mine.push(summary(c));
    }
  }
  const areas = areasFor(user.rank);
  const done = Date.now() - 30 * 86400000;
  const queue = areas.length ? idx.filter((x) => x.kind === 'ticket' && areas.includes(x.area) && x.from.sub !== user.sub && (x.status !== 'closed' || x.updated > done)) : [];
  const mod = isMod(user.rank);
  return {
    chats: mine.map((x) => forMe(x, user.sub)), queue: queue.map(strip), areas, me: user.sub, mod,
    reported: mod ? idx.filter((x) => x.reported && x.top <= level(user.rank)).length : 0,
  };
}

const matches = (x, q) => !q || [x.name, x.desc, x.from && x.from.username, x.from && x.from.displayName, x.to && x.to.username, x.to && x.to.displayName]
  .some((v) => v && String(v).toLowerCase().includes(q));
// Öffentliche Gruppen zum Beitreten
export async function publicChats(store, user, query = '') {
  const q = String(query).trim().toLowerCase().slice(0, 40);
  const idx = await loadIndex(store);
  return {
    chats: idx.filter((x) => x.kind === 'group' && x.visibility === 'public' && !(x.banned || []).includes(user.sub) && matches(x, q))
      .sort((a, b) => b.count - a.count || b.updated - a.updated).slice(0, 100)
      .map((x) => ({ ...strip(x), joined: x.subs.includes(user.sub) })),
  };
}
// Moderation: alle Gespräche, die man beobachten darf (gemeldete zuerst)
export async function moderationChats(store, user, query = '', kind = '') {
  if (!isMod(user.rank)) throw bad('forbidden', 403);
  const q = String(query).trim().toLowerCase().slice(0, 40);
  const idx = await loadIndex(store);
  return {
    chats: idx.filter((x) => x.top <= level(user.rank) && (!kind || x.kind === kind) && matches(x, q))
      .sort((a, b) => (b.reported > 0) - (a.reported > 0) || b.updated - a.updated).slice(0, 150)
      .map((x) => ({ ...strip(x), joined: x.subs.includes(user.sub) })),
  };
}

export async function readChat(store, env, user, id, { since = 0, observe = false, ch = '' } = {}) {
  const c = await getChat(store, user, id);
  const a = access(c, user);
  if (a.role) seen(user.sub, c.id);
  if (isCommunity(c) && ch) rememberChannel(user.sub, c.id, ch);
  // Unsichtbares Beobachten wird intern vermerkt (höchstens alle 6 Stunden je Person)
  if (a.observe && observe) {
    const log = c.modlog || [];
    if (!log.some((x) => x.sub === user.sub && x.at > Date.now() - 6 * 3600000)) {
      c.modlog = [...log, { sub: user.sub, name: user.username, action: 'observe', at: Date.now() }].slice(-100);
      await store.put(`chat:${c.id}`, c, { ttl: KEEP });
    }
  }
  if (since && c.updated <= since) {
    const v = await view(env, store, c, user);
    return { id: c.id, updated: c.updated, unchanged: true, status: c.status, claimedBy: c.claimedBy || null, canWrite: v.canWrite, canClaim: v.canClaim, canClose: v.canClose };
  }
  return view(env, store, c, user, { ch });
}

// ---------- Neues Gespräch ----------
async function rateLimit(store, user, max) {
  const key = `chats:new:${user.sub}`;
  const recent = ((await store.get(key)) || []).filter((x) => x > Date.now() - 86400000);
  if (recent.length >= max) throw bad('rate_limited', 429);
  recent.push(Date.now());
  await store.put(key, recent, { ttl: 86400 });
}
function cleanText(v, n = 2000) {
  return clip(v, n).replace(/\r/g, '').trim();
}

export async function createChat(store, env, user, body) {
  const kind = ['direct', 'group'].includes(body.kind) ? body.kind : 'ticket';
  const text = cleanText(body.text);
  const t = Date.now();
  const me = person(user);
  const team = isMod(user.rank);

  if (kind === 'direct') {
    const target = await resolvePerson(store, env, body.to);
    if (!target) throw bad('not_found', 404);
    if (target.sub === user.sub) throw bad('bad_target');
    if (!text) throw bad('empty');
    // Schon ein offenes Gespräch zwischen den beiden? Dann dort weiterschreiben
    const idx = await loadIndex(store);
    const open = idx.find((x) => x.kind === 'direct' && x.status !== 'closed' && x.subs.includes(user.sub) && x.subs.includes(target.sub) && x.count === 2);
    if (open) return postMessage(store, env, user, open.id, { text });
    await rateLimit(store, user, team ? 80 : NEW_PER_DAY);
    const c = { id: randomKey(9), kind, status: 'open', reason: REASONS.includes(body.reason) ? body.reason : 'other', from: me, to: target, created: t, updated: t, messages: [{ id: randomKey(6), by: user.sub, name: nameOf(me), text, at: t }] };
    await save(store, c);
    await addTo(store, user.sub, c.id);
    await addTo(store, target.sub, c.id);
    await notifyOthers(store, env, c, user.sub, fromPerson(me, text));
    return view(env, store, c, user);
  }

  if (kind === 'group') {
    const server = body.category === 'server';
    let name = cleanText(body.name, 60).replace(/\n/g, ' ');
    // Ohne Namen: „Lorthien's Server“, „Lorthien's Server2“ … (bzw. „… Gruppe“)
    if (!name) {
      const own = (await loadIndex(store)).filter((x) => x.kind === 'group' && x.from && x.from.sub === user.sub).map((x) => x.name);
      name = defaultName(user, server ? 'Server' : 'Gruppe', own);
    }
    if (name.length < 2) throw bad('bad_name');
    await rateLimit(store, user, team ? 40 : 8);
    const c = {
      id: randomKey(9), kind, status: 'open', from: me, owner: user.sub, name, desc: cleanText(body.desc, 300), rules: cleanText(body.rules, 1500),
      color: COLORS.includes(body.color) ? body.color : COLORS[Math.floor(Math.random() * COLORS.length)],
      settings: cleanSettings(body.settings || {}), members: { [user.sub]: { ...me, role: 'owner', joined: t } }, created: t, updated: t, messages: [],
      ...(server ? { category: 'server', servers: [], ...layoutFor(String(body.template || '')) } : {}),
    };
    sys(c, 'created', user.username);
    const added = [];
    for (const q of (Array.isArray(body.members) ? body.members : []).slice(0, 20)) {
      const p = await resolvePerson(store, env, q);
      if (p && !c.members[p.sub] && Object.keys(c.members).length < MAX_MEMBERS) { c.members[p.sub] = { ...p, role: 'member', joined: t }; added.push(p); }
    }
    if (added.length) sys(c, 'added', user.username, { target: added.map(nameOf).join(', ') });
    if (text) c.messages.push({ id: randomKey(6), by: user.sub, name: nameOf(me), text, at: t + 1, ...(server ? { ch: homeOf(c) } : {}) });
    await save(store, c);
    // Server-Chat: eigene private Server verbinden und gleich einstellen
    if (c.category === 'server') {
      await connectServers(store, user, c.id, body.servers, body.server || {});
      Object.assign(c, await store.get(`chat:${c.id}`));
      await saveIndex(store, c);
    }
    for (const sub of Object.keys(c.members)) await addTo(store, sub, c.id);
    await Promise.all(added.map((p) => notifyUser(store, env, p.sub, 'chat', {
      ...fromPerson(me, text || `Du bist jetzt in der Gruppe „${name}“.`, `${nameOf(me)} hat dich zu „${name}“ hinzugefügt`), url: `./#/chat/${c.id}`, tag: `chat-${c.id}`,
    })));
    return view(env, store, c, user);
  }

  // Anfrage ans Team
  if (!text) throw bad('empty');
  if (!REASONS.includes(body.reason) || !AREAS[body.area]) throw bad('bad_area');
  await rateLimit(store, user, team ? 80 : NEW_PER_DAY);
  const c = { id: randomKey(9), kind, status: 'open', reason: body.reason, area: body.area, claimedBy: null, from: me, created: t, updated: t, messages: [{ id: randomKey(6), by: user.sub, name: nameOf(me), text, at: t }] };
  if (body.ref) c.ref = String(body.ref);
  await save(store, c);
  await addTo(store, user.sub, c.id);
  await notifyStaff(store, env, (rank) => canHandle(rank, c.area), 'team', {
    ...fromPerson(c.from, text, `${nameOf(c.from)} · ${REASON_LABEL[c.reason]} (${AREA_LABEL[c.area]})`),
    url: `./#/chat/${c.id}`, tag: `chat-${c.id}`,
  }, user.sub);
  return view(env, store, c, user);
}

// ---------- Nachrichten ----------
export async function postMessage(store, env, user, id, body) {
  const c = await getChat(store, user, id);
  const a = access(c, user);
  if (!a.write) throw bad('forbidden', 403);
  const st = settingsOf(c);
  // Server: Nachricht in den gewählten Kanal (Ankündigungen nur mit Recht)
  const channel = isCommunity(c) ? pickChannel(c, String(body.ch || '')) : null;
  if (channel && !canPostIn(c, user, channel)) throw bad('channel_locked', 403);
  if (channel) rememberChannel(user.sub, c.id, channel.id);
  const inCh = channel ? { ch: channel.id } : {};
  const text = cleanText(body.text);
  const fileIds = Array.isArray(body.files) ? body.files : [];
  if (!text && !fileIds.length) throw bad('empty');
  if (fileIds.length && !(st.media || a.admin || hasPerm(c, user.sub, 'media'))) throw bad('no_media', 403);
  const t = Date.now();
  if (c.kind === 'group' && st.slow && !a.admin && t - ((c.lastPost || {})[user.sub] || 0) < st.slow * 1000) throw bad('slow', 429);
  const files = fileIds.length ? await attachFiles(store, user, c.id, fileIds) : null;
  const me = { ...person(user), ...(people(c)[user.sub] || {}) };
  c.messages.push({ id: randomKey(6), by: user.sub, name: nameOf(me), text, at: t, ...inCh, ...(files ? { files } : {}) });
  // Befehl? Antwort vom TSG-Bot (persönliche Antworten und Fehler sieht nur der Absender)
  const cmd = text && !files && st.cmd !== 'off' ? parseCommand(text) : null;
  if (cmd) {
    const enabled = enabledCommands(c, a.role, user.sub);
    let r;
    try {
      r = enabled.length || !cmd.id ? await runCommand(store, env, user, c, cmd, enabled)
        : { title: 'Befehle nur für Admins', text: 'In diesem Chat dürfen nur Inhaber und Admins Befehle nutzen.', only: user.sub };
    } catch (e) {
      r = { title: 'Gerade nicht verfügbar', text: 'Die Daten konnten nicht geladen werden. Bitte versuch es gleich noch einmal.', only: user.sub };
    }
    c.messages.push({ id: randomKey(6), by: 'bot', kind: 'bot', at: t + 1, title: r.title, text: r.text || '', rows: r.rows || [], buttons: (r.buttons || []).slice(0, 6), avatar: r.avatar || null, ...inCh, ...(r.only ? { only: r.only } : {}) });
  }
  // Eigene Bots des Chats: onmessage, Befehle mit ihrem Präfix (z. B. !regeln)
  const botPosted = !cmd && text && c.kind === 'group' ? await botsEvent(store, env, c, 'message', { person: me, text, ch: channel }) : false;
  c.updated = Math.max(t + (cmd ? 1 : 0), botPosted ? Date.now() : 0);
  if (c.kind === 'group') c.lastPost = { ...(c.lastPost || {}), [user.sub]: t };
  await save(store, c);
  const shown = text || (files[0].kind === 'image' ? '📷 Foto' : files[0].kind === 'video' ? '🎬 Video' : `📎 ${files[0].name}`);
  const mentioned = text ? mentionsIn(c, text, user.sub, hasPerm(c, user.sub, 'mention')) : [];
  await notifyOthers(store, env, c, user.sub, { ...fromPerson(me, shown, messageTitle(c, me, channel)), ...(channel ? { url: `./#/chat/${c.id}?k=${channel.id}` } : {}) }, { mentioned });
  // Server-Chat mit Discord: Nachricht auch dort zeigen (Befehle bleiben in der App; bei Servern nur der Standardkanal)
  if (!cmd && (!channel || channel.id === homeOf(c))) await toDiscord(store, env, c, { username: nameOf(me), avatar: me.avatar, content: shown });
  return view(env, store, c, user, { ch: channel && channel.id });
}

// Antwort direkt aus der Benachrichtigung (ohne Anmeldung, mit signiertem Link aus der Benachrichtigung)
export async function replyFromPush(store, env, id, body) {
  const sub = String(body.sub || '');
  const exp = Math.round(+body.exp || 0);
  if (!/^\d{1,20}$/.test(sub) || exp < Date.now() || !(await verify(env, store, `reply|${sub}|${id}|${exp}`, String(body.k || '')))) throw bad('forbidden', 403);
  const user = await store.get(`user:${sub}`);
  if (!user) throw bad('forbidden', 403);
  await postMessage(store, env, user, id, { text: body.text });
  return { ok: true };
}

export async function deleteMessage(store, env, user, id, mid) {
  const c = await getChat(store, user, id);
  const a = access(c, user);
  const m = c.messages.find((x) => x.id === mid);
  if (!m || m.deleted || m.by === 'system') throw bad('not_found', 404);
  if (m.by !== user.sub && !a.moderate && !hasPerm(c, user.sub, 'messages')) throw bad('forbidden', 403);
  await deleteFiles(store, m.files);
  Object.keys(m).forEach((k) => { if (!['id', 'by', 'at'].includes(k)) delete m[k]; });
  Object.assign(m, { deleted: true, deletedBy: m.by === user.sub ? null : user.username });
  c.updated = Date.now();
  await save(store, c);
  return view(env, store, c, user);
}

export async function startChatUpload(store, user, id, body) {
  const c = await getChat(store, user, id);
  const a = access(c, user);
  if (!a.write) throw bad('forbidden', 403);
  if (!(settingsOf(c).media || a.admin || hasPerm(c, user.sub, 'media'))) throw bad('no_media', 403);
  return startUpload(store, user, c.id, body);
}

// ---------- Anfragen annehmen und Gespräche beenden ----------
export async function claimChat(store, env, user, id) {
  const c = await getChat(store, user, id);
  if (c.kind !== 'ticket' || c.from.sub === user.sub || !canHandle(user.rank, c.area)) throw bad('forbidden', 403);
  if (c.status !== 'open') throw bad('taken', 409);
  const t = Date.now();
  c.status = 'claimed';
  c.claimedBy = person(user);
  c.claimedAt = t;
  c.updated = t;
  sys(c, 'claimed', user.username);
  await save(store, c);
  await addTo(store, user.sub, c.id);
  await notifyUser(store, env, c.from.sub, 'chat', {
    ...fromPerson(c.claimedBy, `Ich kümmere mich jetzt um deine Anfrage „${REASON_LABEL[c.reason]}“.`, `${nameOf(c.claimedBy)} hat deine Anfrage angenommen`),
    url: `./#/chat/${c.id}`, tag: `chat-${c.id}`,
  });
  return view(env, store, c, user);
}

export async function closeChat(store, env, user, id) {
  const c = await getChat(store, user, id);
  const a = access(c, user);
  if (c.kind === 'group' || !(a.role || a.moderate)) throw bad('forbidden', 403);
  if (c.status !== 'closed') {
    c.status = 'closed';
    c.updated = Date.now();
    sys(c, 'closed', user.username);
    await save(store, c);
  }
  return view(env, store, c, user);
}

// ---------- Gruppen: bearbeiten, Leute, Rollen ----------
export async function updateChat(store, env, user, id, body) {
  const c = await getChat(store, user, id);
  const a = access(c, user);
  if (c.kind !== 'group' || !(a.manage || a.mod)) throw bad('forbidden', 403);
  if (body.name !== undefined) { const name = cleanText(body.name, 60).replace(/\n/g, ' '); if (name.length < 2) throw bad('bad_name'); c.name = name; }
  if (body.desc !== undefined) c.desc = cleanText(body.desc, 300);
  if (body.rules !== undefined) c.rules = cleanText(body.rules, 1500);
  if (COLORS.includes(body.color)) c.color = body.color;
  if (body.settings) c.settings = cleanSettings(body.settings, settingsOf(c));
  c.updated = Date.now();
  sys(c, 'settings', user.username);
  await save(store, c);
  return view(env, store, c, user);
}

export async function addMembers(store, env, user, id, body) {
  const c = await getChat(store, user, id);
  const a = access(c, user);
  if (!canInvite(c, a.role, user.sub)) throw bad('forbidden', 403);
  const added = [];
  const t = Date.now();
  for (const q of (Array.isArray(body.users) ? body.users : [body.users]).slice(0, 10)) {
    const p = await resolvePerson(store, env, q);
    if (!p) continue;
    if (c.members[p.sub]) continue;
    if (Object.keys(c.members).length >= MAX_MEMBERS) throw bad('full', 409);
    c.members[p.sub] = { ...p, role: 'member', joined: t };
    c.banned = (c.banned || []).filter((x) => x !== p.sub);
    added.push(p);
  }
  if (!added.length) throw bad('not_found', 404);
  c.updated = t;
  sys(c, 'added', user.username, { target: added.map(nameOf).join(', ') });
  for (const p of added) await chatEvent(store, env, c, 'join', p);
  await save(store, c);
  for (const p of added) await addTo(store, p.sub, c.id);
  await Promise.all(added.map((p) => notifyUser(store, env, p.sub, 'chat', {
    ...fromPerson(person(user), `Du bist jetzt in der Gruppe „${c.name}“.`, `${nameOf(user)} hat dich zu „${c.name}“ hinzugefügt`), url: `./#/chat/${c.id}`, tag: `chat-${c.id}`,
  })));
  return view(env, store, c, user);
}

// Beitreten: öffentliche Gruppe – oder sichtbar als Moderation (ab Supervisor)
export async function joinChat(store, env, user, id, { asMod = false } = {}) {
  const c = await getChat(store, user, id);
  const a = access(c, user);
  if (a.role) return view(env, store, c, user);
  const t = Date.now();
  if (asMod) {
    if (!a.mod) throw bad('forbidden', 403);
    if (c.kind === 'group') c.members[user.sub] = { ...person(user), role: 'mod', joined: t };
    else c.mods = { ...(c.mods || {}), [user.sub]: person(user) };
    sys(c, 'mod', user.username);
    c.modlog = [...(c.modlog || []), { sub: user.sub, name: user.username, action: 'join', at: t }].slice(-100);
  } else {
    if (!a.pub) throw bad('forbidden', 403);
    if (Object.keys(c.members).length >= MAX_MEMBERS) throw bad('full', 409);
    c.members[user.sub] = { ...person(user), role: 'member', joined: t };
    sys(c, 'joined', user.username);
    await chatEvent(store, env, c, 'join', person(user));
  }
  c.updated = t;
  await save(store, c);
  await addTo(store, user.sub, c.id);
  return view(env, store, c, user);
}

export async function leaveChat(store, env, user, id) {
  const c = await getChat(store, user, id);
  const role = roleOf(c, user.sub);
  if (!role || (c.kind !== 'group' && role !== 'mod')) throw bad('forbidden', 403);
  if (c.kind !== 'group') delete c.mods[user.sub];
  else {
    delete c.members[user.sub];
    const rest = Object.values(c.members).filter((p) => p.role !== 'mod');
    if (!rest.length) return deleteChat(store, user, id, { force: true });
    if (role === 'owner') {
      const next = rest.find((p) => p.role === 'admin') || rest.sort((x, y) => (x.joined || 0) - (y.joined || 0))[0];
      next.role = 'owner';
      c.owner = next.sub;
      sys(c, 'role', user.username, { target: nameOf(next), role: 'owner' });
    }
  }
  c.updated = Date.now();
  sys(c, 'left', user.username);
  if (c.kind === 'group') await chatEvent(store, env, c, 'leave', person(user));
  await save(store, c);
  return { ok: true };
}

export async function removeMember(store, env, user, id, sub) {
  const c = await getChat(store, user, id);
  const a = access(c, user);
  const target = c.kind === 'group' ? c.members[sub] : (c.mods || {})[sub];
  if (!target || sub === user.sub) throw bad('not_found', 404);
  const allowed = a.mod || a.role === 'mod' || (a.role === 'owner' && target.role !== 'owner') || (a.role === 'admin' && target.role === 'member')
    || (target.role === 'member' && hasPerm(c, user.sub, 'kick') && !hasPerm(c, sub, 'manage'));
  if (!allowed) throw bad('forbidden', 403);
  if (c.kind === 'group') { delete c.members[sub]; c.banned = [...new Set([...(c.banned || []), sub])]; } else delete c.mods[sub];
  c.updated = Date.now();
  sys(c, 'removed', user.username, { target: nameOf(target) });
  if (c.kind === 'group') await chatEvent(store, env, c, 'leave', target);
  await save(store, c);
  return view(env, store, c, user);
}

export async function setRole(store, env, user, id, sub, body = {}) {
  const c = await getChat(store, user, id);
  const a = access(c, user);
  const target = c.kind === 'group' && c.members[sub];
  // Eigene Rollen zuweisen (wer die Gruppe verwalten darf)
  if (target && Array.isArray(body.roles)) {
    if (!(a.manage || a.mod)) throw bad('forbidden', 403);
    target.roles = (c.roles || []).filter((r) => body.roles.includes(r.id)).map((r) => r.id);
    c.updated = Date.now();
    await save(store, c);
    if (!body.role) return view(env, store, c, user);
  }
  const role = body.role;
  if (!target || !['admin', 'member', 'owner'].includes(role) || target.role === 'mod') throw bad('bad_request');
  if (!(a.role === 'owner' || a.mod || a.role === 'mod')) throw bad('forbidden', 403);
  if (role === 'owner') {
    const old = c.members[c.owner];
    if (old) old.role = 'admin';
    c.owner = sub;
  }
  target.role = role;
  c.updated = Date.now();
  sys(c, 'role', user.username, { target: nameOf(target), role });
  await save(store, c);
  return view(env, store, c, user);
}

// ---------- Für mich: stumm, ausblenden ----------
export async function muteChat(store, env, user, id, muted) {
  const c = await getChat(store, user, id);
  if (!roleOf(c, user.sub)) throw bad('forbidden', 403);
  c.muted = { ...(c.muted || {}) };
  if (muted) c.muted[user.sub] = true; else delete c.muted[user.sub];
  await store.put(`chat:${c.id}`, c, { ttl: KEEP });
  return view(env, store, c, user);
}
// „Für mich löschen“: verschwindet aus der eigenen Liste, bis wieder jemand schreibt
export async function hideChat(store, user, id) {
  const c = await getChat(store, user, id);
  if (!roleOf(c, user.sub)) throw bad('forbidden', 403);
  c.hidden = { ...(c.hidden || {}), [user.sub]: Date.now() };
  await store.put(`chat:${c.id}`, c, { ttl: KEEP });
  await saveIndex(store, c);
  return { ok: true };
}
// „Für alle löschen“: Inhaber einer Gruppe oder Moderation – samt Fotos und Videos
export async function deleteChat(store, user, id, { force = false } = {}) {
  const c = await getChat(store, user, id);
  const a = access(c, user);
  if (!force && !((c.kind === 'group' && a.role === 'owner') || a.mod)) throw bad('forbidden', 403);
  await deleteFiles(store, c.messages.flatMap((m) => m.files || []));
  // Verbundene private Server lösen
  for (const sid of c.servers || []) {
    const p = await store.get(`pserver:${sid}`);
    if (p && p.chat === c.id) { p.chat = null; await store.put(`pserver:${sid}`, p); }
  }
  await store.delete(`chatphoto:${c.id}`);
  if (c.discord) await requestIndex(store, c.id, false);
  await store.delete(`chat:${c.id}`);
  await saveIndex(store, c, { remove: true });
  return { ok: true };
}

// Übersicht neu schreiben, wenn sich außerhalb von chat.js etwas am Gespräch geändert hat (z. B. verbundener Server)
export async function reindexChat(store, id) {
  const c = id && await store.get(`chat:${id}`);
  if (c) await saveIndex(store, c);
}

// ---------- Gruppenbild (JPEG, in der App auf 256 × 256 zugeschnitten) ----------
export async function setChatPhoto(store, env, user, id, req) {
  const c = await getChat(store, user, id);
  if (!canPhoto(c, access(c, user).role)) throw bad('forbidden', 403);
  if (req.method === 'DELETE') {
    await store.delete(`chatphoto:${c.id}`);
    c.photo = null;
  } else {
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length > 300000) throw bad('too_large', 413);
    if (!(bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF)) throw bad('bad_type', 415);
    await store.put(`chatphoto:${c.id}`, bytes);
    c.photo = Date.now();
  }
  c.updated = Date.now();
  sys(c, 'photo', user.username);
  await save(store, c);
  return view(env, store, c, user);
}
export async function chatPhotoResponse(store, id, headers = {}) {
  const bytes = /^[\w-]{6,30}$/.test(id) && await store.get(`chatphoto:${id}`);
  if (!bytes) return new Response('not found', { status: 404, headers });
  return new Response(bytes, {
    headers: { ...headers, 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=604800, immutable', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'cross-origin' },
  });
}

// ---------- Server-Chat: private Server verbinden oder lösen (nur der Besitzer des Servers) ----------
async function connectServers(store, user, chatId, ids, opts = {}) {
  for (const sid of (Array.isArray(ids) ? ids : []).slice(0, 20)) {
    const p = await store.get(`pserver:${String(sid)}`);
    if (!p || p.owner !== user.sub) continue;
    if (['app', 'roblox'].includes(opts.join)) p.join = opts.join;
    if (['all', 'members'].includes(opts.access)) p.access = opts.access;
    if (typeof opts.relay === 'boolean') p.relay = opts.relay;
    if (opts.welcome !== undefined) p.welcome = clip(opts.welcome, 300).trim();
    if (opts.link) p.link = cleanLink(opts.link);
    p.show = p.show === 'owner' ? 'members' : p.show;
    await linkChat(store, user, p, chatId);
    await store.put(`pserver:${p.id}`, p);
  }
}
export async function chatServers(store, env, user, id, body) {
  const c = await getChat(store, user, id);
  const a = access(c, user);
  if (c.kind !== 'group' || !(a.manage || a.mod)) throw bad('forbidden', 403);
  if (body.add) await connectServers(store, user, c.id, [body.add], body.server || {});
  if (body.remove) {
    const p = await store.get(`pserver:${String(body.remove)}`);
    if (p && p.chat === c.id && (p.owner === user.sub || a.role === 'owner' || a.mod)) {
      p.chat = null;
      await store.put(`pserver:${p.id}`, p);
      const fresh = await store.get(`chat:${c.id}`);
      fresh.servers = (fresh.servers || []).filter((x) => x !== p.id);
      await store.put(`chat:${c.id}`, fresh, { ttl: KEEP });
    }
  }
  const fresh = await store.get(`chat:${c.id}`);
  fresh.category = 'server';
  fresh.updated = Date.now();
  sys(fresh, 'servers', user.username);
  await save(store, fresh);
  return view(env, store, fresh, user);
}

// ---------- Eigene Rollen bearbeiten ----------
export async function setChatRoles(store, env, user, id, body) {
  const c = await getChat(store, user, id);
  const a = access(c, user);
  if (c.kind !== 'group' || !(a.manage || a.mod)) throw bad('forbidden', 403);
  c.roles = cleanRoles(body.roles, c.roles || []);
  const ids = c.roles.map((r) => r.id);
  Object.values(c.members).forEach((m) => { if (m.roles) m.roles = m.roles.filter((r) => ids.includes(r)); });
  c.updated = Date.now();
  sys(c, 'roles', user.username);
  await save(store, c);
  return view(env, store, c, user);
}

// ---------- Server: Kanäle und Kategorien (wie Discord) ----------
// { categories: [{ id, name }], channels: [{ id, name, cat, kind, topic }], home } – die ganze Liste, neue Einträge mit vorläufiger ID.
// Gelöschte Kanäle verlieren ihre Nachrichten. Eine Gruppe wird mit { convert: true } zum Server mit den Standardkanälen.
export async function setChannels(store, env, user, id, body) {
  const c = await getChat(store, user, id);
  const a = access(c, user);
  if (c.kind !== 'group' || !(a.manage || a.mod)) throw bad('forbidden', 403);
  const t = Date.now();
  if (!isCommunity(c)) {
    if (body.convert !== true) throw bad('not_server', 409);
    Object.assign(c, { category: 'server', servers: c.servers || [] }, defaultLayout());
    c.messages.forEach((m) => { if (!m.ch) m.ch = c.home; });
    c.updated = t;
    sys(c, 'community', user.username, { ch: c.home });
    await save(store, c);
    return view(env, store, c, user);
  }
  const old = layoutOf(c);
  const next = cleanLayout(body, old);
  // Nachrichten ohne Kanal gehören zum bisherigen Standardkanal – das bleibt so, auch wenn sich der Standard ändert
  c.messages.forEach((m) => { if (!m.ch) m.ch = old.home; });
  const ids = new Set(next.channels.map((x) => x.id));
  const gone = c.messages.filter((m) => !ids.has(m.ch));
  if (gone.length) {
    await deleteFiles(store, gone.flatMap((m) => m.files || []));
    c.messages = c.messages.filter((m) => ids.has(m.ch));
  }
  Object.assign(c, next);
  c.updated = t;
  sys(c, 'channels', user.username, { ch: c.home });
  await save(store, c);
  return view(env, store, c, user);
}

// ---------- Einladungslinks für Gruppen und Server: #/einladung/<code> ----------
const INVITE = /^[\w-]{6,12}$/;
export async function chatInvite(store, user, id) {
  const c = await getChat(store, user, id);
  const a = access(c, user);
  if (c.kind !== 'group' || !(canInvite(c, a.role, user.sub) || a.mod)) throw bad('forbidden', 403);
  if (!c.invite) {
    c.invite = randomKey(6);
    await store.put(`chatinvite:${c.invite}`, c.id, { ttl: KEEP });
    await store.put(`chat:${c.id}`, c, { ttl: KEEP });
  }
  return { code: c.invite };
}
async function inviteChat(store, code) {
  const id = INVITE.test(String(code)) ? await store.get(`chatinvite:${code}`) : null;
  const c = id ? await store.get(`chat:${id}`) : null;
  if (!c || c.invite !== code) throw bad('not_found', 404);
  return c;
}
export async function invitePreview(store, user, code) {
  const c = await inviteChat(store, code);
  return {
    id: c.id, name: c.name, desc: c.desc ? clip(c.desc, 200) : '', color: c.color || null, photo: c.photo || null, category: c.category || null,
    members: Object.keys(c.members || {}).length, joined: !!(c.members || {})[user.sub], banned: (c.banned || []).includes(user.sub),
  };
}
export async function inviteJoin(store, env, user, code) {
  const c = await inviteChat(store, code);
  if ((c.banned || []).includes(user.sub)) throw bad('forbidden', 403);
  if (!c.members[user.sub]) {
    if (Object.keys(c.members).length >= MAX_MEMBERS) throw bad('full', 409);
    const t = Date.now();
    c.members[user.sub] = { ...person(user), role: 'member', joined: t };
    sys(c, 'joined', user.username);
    await chatEvent(store, env, c, 'join', person(user));
    c.updated = t;
    await save(store, c);
    await addTo(store, user.sub, c.id);
  }
  return view(env, store, c, user);
}

// ---------- Dashboard: eigene Server, Gruppen und Bots auf einen Blick ----------
// Bots stehen in den Chats, die man leitet (Inhaber, Admin) – höchstens 25 Chats werden dafür gelesen.
async function managedChats(store, user) {
  const idx = await loadIndex(store);
  const list = idx.filter((x) => x.kind === 'group' && (x.admins || []).includes(user.sub)).slice(0, 25);
  const out = [];
  for (const x of list) { const c = await store.get(`chat:${x.id}`); if (c) out.push(c); }
  return out;
}
const placeOf = (c) => ({ id: c.id, name: c.name, color: c.color || null, photo: c.photo || null, category: c.category || null });
export async function dashboard(store, user) {
  const chats = await managedChats(store, user);
  const bots = chats.flatMap((c) => (c.bots || []).map((b) => ({ ...botMeta(b), chat: placeOf(c) }))).sort((x, y) => (y.rev || 0) - (x.rev || 0));
  return {
    bots, places: chats.map((c) => ({ ...placeOf(c), bots: (c.bots || []).length, members: Object.keys(c.members || {}).length, updated: c.updated })),
    maxBots: 5,
  };
}

// ---------- Discord: Nachrichten weitergeben, Automationen ----------
async function toDiscord(store, env, c, msg) {
  const d = c.discord;
  if (!d || d.status !== 'active' || !d.events || !d.events.messages) return;
  const before = JSON.stringify(d.lastError || null);
  await sendToDiscord(env, store, d, msg);
  if (JSON.stringify(d.lastError || null) !== before) await store.put(`chat:${c.id}`, c, { ttl: KEEP });
}
// Jemand tritt dem Chat bei oder verlässt ihn: Hinweis nach Discord, eigene Bots
async function chatEvent(store, env, c, trigger, p) {
  if (c.kind !== 'group') return;
  const d = c.discord;
  if (d && d.status === 'active' && d.events && d.events.joins) {
    await sendToDiscord(env, store, d, { username: d.botName, content: trigger === 'join' ? `➡️ ${nameOf(p)} ist dem Server-Chat beigetreten` : `⬅️ ${nameOf(p)} hat den Server-Chat verlassen` });
  }
  await botsEvent(store, env, c, trigger, { person: p });
}
// Spieler betreten oder verlassen einen verbundenen privaten Server (aus dem Abgleich mit dem Spiel)
export async function gameEvents(store, env, events) {
  for (const ev of events || []) {
    const ps = await store.get(`pserver:${ev.privateId}`);
    const c = ps && ps.chat ? await store.get(`chat:${ps.chat}`) : null;
    if (!c || (!(c.bots || []).length && !(c.discord && (c.discord.automations || []).length))) continue;
    const ctx = (x) => ({ person: { username: x.name || x.id, displayName: x.dn || x.name || x.id, sub: x.id }, players: ev.players, serverName: ps.name, serverId: ev.privateId });
    let posted = false;
    for (const x of ev.joined || []) posted = (await botsEvent(store, env, c, 'game_join', ctx(x))) || posted;
    for (const x of ev.left || []) posted = (await botsEvent(store, env, c, 'game_leave', ctx(x))) || posted;
    if (posted) { c.updated = Date.now(); await save(store, c); } else await store.put(`chat:${c.id}`, c, { ttl: KEEP });
  }
}

// ---------- Eigene Bots (bots.js) ----------
async function botChat(store, user, id, manage = true) {
  const c = await getChat(store, user, id);
  if (c.kind !== 'group') throw bad('not_group');
  const a = access(c, user);
  if (manage && !(a.manage || a.mod)) throw bad('forbidden', 403);
  if (!manage && !a.role && !a.manage && !a.mod) throw bad('forbidden', 403);
  return { c, a };
}
export async function botsList(store, user, id) {
  const { c, a } = await botChat(store, user, id, false);
  return listBots(store, c, !!(a.manage || a.mod));
}
export async function botsClient(store, user, id) {
  const { c } = await botChat(store, user, id, false);
  return { bots: await clientBundle(store, c) };
}
export async function botGet(store, user, id, botId) {
  const { c } = await botChat(store, user, id);
  return getBot(store, c, botId);
}
export async function botCreate(store, env, user, id, body) {
  const { c } = await botChat(store, user, id);
  // Ohne Namen: „Lorthien's Bot“, „Lorthien's Bot2“ … (gezählt über alle Bots in Chats, die man leitet)
  if (!String(body.name || '').trim()) {
    const taken = [c, ...(await managedChats(store, user)).filter((x) => x.id !== c.id)].flatMap((x) => (x.bots || []).map((b) => b.name));
    body = { ...body, name: defaultName(user, 'Bot', taken) };
  }
  const b = await createBot(store, c, body);
  sys(c, 'bot', user.username, { target: b.name, action: 'created' });
  c.updated = Date.now();
  await save(store, c);
  return getBot(store, c, b.id);
}
export async function botUpdate(store, env, user, id, botId, body) {
  const { c } = await botChat(store, user, id);
  const r = await updateBot(store, env, c, botId, body);
  // Neuer Stand für alle offenen Apps (ClientScripts, Name, Bild)
  c.updated = Date.now();
  await save(store, c);
  return r.bot;
}
export async function botDelete(store, user, id, botId) {
  const { c } = await botChat(store, user, id);
  const name = ((c.bots || []).find((x) => x.id === botId) || {}).name;
  await deleteBot(store, c, botId);
  sys(c, 'bot', user.username, { target: name || 'Bot', action: 'deleted' });
  c.updated = Date.now();
  await save(store, c);
  return { ok: true };
}
export async function botPhoto(store, user, id, botId, req) {
  const { c } = await botChat(store, user, id);
  const r = await setBotPhoto(store, c, botId, req);
  c.updated = Date.now();
  await save(store, c);
  return r;
}

// ---------- Discord: einrichten, einreichen, prüfen ----------
async function requestIndex(store, id, add) {
  const ids = (await store.get('discord:requests')) || [];
  const next = add ? [id, ...ids.filter((x) => x !== id)].slice(0, 300) : ids.filter((x) => x !== id);
  await store.put('discord:requests', next);
}
async function manageable(store, user, id) {
  const c = await getChat(store, user, id);
  const a = access(c, user);
  if (c.kind !== 'group' || !(a.manage || a.mod)) throw bad('forbidden', 403);
  return c;
}
export async function discordGet(store, env, user, id) {
  return publicView(await manageable(store, user, id));
}
export async function discordPut(store, env, user, id, body) {
  const c = await manageable(store, user, id);
  if (c.category !== 'server') throw bad('not_server', 409);
  c.discord = await updateConfig(env, store, c.discord, body || {});
  await store.put(`chat:${c.id}`, c, { ttl: KEEP });
  return publicView(c);
}
export async function discordTest(store, env, user, id) {
  const c = await manageable(store, user, id);
  if (!c.discord || !c.discord.verified) throw bad('no_connection', 409);
  const ok = await sendToDiscord(env, store, c.discord, { username: c.discord.botName, content: `✅ Verbindung steht: Server-Chat „${c.name}“ aus Train Sim Germany.` });
  await store.put(`chat:${c.id}`, c, { ttl: KEEP });
  if (!ok) throw bad('discord_failed', 502);
  return publicView(c);
}
export async function discordSubmit(store, env, user, id) {
  const c = await manageable(store, user, id);
  if (!c.discord) throw bad('no_connection', 409);
  if (requirements(c).some((r) => !r.ok)) throw bad('requirements', 409);
  if (['pending', 'active'].includes(c.discord.status)) return publicView(c);
  Object.assign(c.discord, { status: 'pending', requestedBy: person(user), requestedAt: Date.now(), reviewedBy: null, reviewedAt: null, reason: '' });
  sys(c, 'discord', user.username, { target: 'pending' });
  c.updated = Date.now();
  await save(store, c);
  await requestIndex(store, c.id, true);
  await notifyStaff(store, env, (rank) => atLeast(rank, REVIEW_RANK), 'team', {
    title: 'Neue Discord-Verbindung', body: `„${c.name}“ von ${nameOf(user)} wartet auf Prüfung.`, url: './#/chat/discord', tag: `discord-${c.id}`, actions: [OPEN_ACTION],
  }, user.sub);
  return publicView(c);
}
export async function discordRemove(store, env, user, id) {
  const c = await manageable(store, user, id);
  if (c.discord) {
    delete c.discord;
    sys(c, 'discord', user.username, { target: 'removed' });
    c.updated = Date.now();
    await save(store, c);
    await requestIndex(store, c.id, false);
  }
  return publicView(c);
}
// Prüfung (Ränge über Public Relations Department)
export async function discordRequests(store, user) {
  if (!atLeast(user.rank, REVIEW_RANK)) throw bad('forbidden', 403);
  const out = [];
  for (const id of (await store.get('discord:requests')) || []) {
    const c = await store.get(`chat:${id}`);
    if (!c || !c.discord) continue;
    const { requirements: req, ...d } = publicView(c);
    const owner = c.members[c.owner];
    out.push({
      ...d, id: c.id, name: c.name, color: c.color || null, photo: c.photo || null, rules: clip(c.rules || '', 600),
      members: Object.keys(c.members).length, servers: (c.servers || []).length, owner: owner ? { sub: owner.sub, name: nameOf(owner), avatar: owner.avatar || null } : null,
      roles: (c.roles || []).map((r) => ({ name: r.name, color: r.color, perms: r.perms, count: Object.values(c.members).filter((m) => (m.roles || []).includes(r.id)).length })),
      bots: (c.bots || []).map((b) => ({ name: b.name, mode: b.mode, on: b.on !== false })),
      ok: req.every((r) => r.ok),
    });
  }
  const order = { pending: 0, active: 1, denied: 2, draft: 3 };
  out.sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4) || (b.requestedAt || 0) - (a.requestedAt || 0));
  return { requests: out };
}
export async function discordReview(store, env, user, id, body) {
  if (!atLeast(user.rank, REVIEW_RANK)) throw bad('forbidden', 403);
  const c = /^[\w-]{6,30}$/.test(id) ? await store.get(`chat:${id}`) : null;
  if (!c || !c.discord) throw bad('not_found', 404);
  const accept = body.decision === 'accept';
  const reason = clip(String(body.reason || ''), 300).trim();
  Object.assign(c.discord, { status: accept ? 'active' : 'denied', reviewedBy: { sub: user.sub, name: user.username }, reviewedAt: Date.now(), reason });
  sys(c, 'discord', user.username, { target: accept ? 'accepted' : 'denied' });
  c.updated = Date.now();
  if (accept) await sendToDiscord(env, store, c.discord, { username: c.discord.botName, content: `✅ Der Server-Chat „${c.name}“ ist jetzt mit Discord verbunden.` });
  await save(store, c);
  const to = (c.discord.requestedBy && c.discord.requestedBy.sub) || c.owner;
  // Angenommen: mit Knopf zum Server-Chat; abgelehnt: ohne Knopf
  await notifyUser(store, env, to, 'chat', accept
    ? { title: 'Discord-Verbindung angenommen', body: `„${c.name}“ ist jetzt mit Discord verbunden.`, url: `./#/chat/${c.id}/info`, tag: `discord-${c.id}`, actions: [OPEN_ACTION] }
    : { title: 'Discord-Verbindung abgelehnt', body: `„${c.name}“${reason ? `: ${reason}` : ' wurde nicht verbunden.'}`, url: './#/chat', tag: `discord-${c.id}` });
  return { ok: true, status: c.discord.status };
}

// ---------- Melden: Anfrage an „Meldungen“ mit Verweis auf das Gespräch ----------
export async function reportChat(store, env, user, id, body) {
  const c = await getChat(store, user, id);
  if (!roleOf(c, user.sub) || c.kind === 'ticket') throw bad('forbidden', 403);
  const what = c.kind === 'group' ? `die Gruppe „${c.name}“` : `das Gespräch mit ${nameOf(Object.values(people(c)).find((p) => p.sub !== user.sub) || { username: '?' })}`;
  const text = cleanText(body.text, 1500) || 'Bitte schaut euch dieses Gespräch an.';
  const ticket = await createChat(store, env, user, { kind: 'ticket', reason: 'report', area: 'report', ref: c.id, text: `Ich melde ${what}.\n\n${text}` });
  const fresh = await store.get(`chat:${c.id}`);
  fresh.reports = [...(fresh.reports || []), { sub: user.sub, name: user.username, at: Date.now(), ticket: ticket.id, text: clip(text, 300) }].slice(-20);
  await store.put(`chat:${c.id}`, fresh, { ttl: KEEP });
  await saveIndex(store, fresh);
  return { ticket: ticket.id };
}

// ---------- Team: alle ab Supervisor aus der Roblox-Gruppe ----------
async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}
export async function staffList(store, env) {
  const cached = await store.get('cache:staff2');
  if (cached && Date.now() - cached.at < 30 * 60000) return cached.list;
  const group = String(env.ROBLOX_GROUP_ID || '33684346');
  const groups = (env.ROBLOX_GROUPS_URL || 'https://groups.roblox.com').replace(/\/+$/, '');
  const thumbs = (env.ROBLOX_THUMBNAILS_URL || 'https://thumbnails.roblox.com').replace(/\/+$/, '');
  try {
    const roles = ((await getJson(`${groups}/v1/groups/${group}/roles`)).roles || [])
      .map((r) => ({ ...r, rankName: matchRank(r) })).filter((r) => r.rank > 0 && atLeast(r.rankName, 'Supervisor'));
    // Jede Person nur einmal – taucht jemand bei mehreren Rollen auf, zählt der höchste Rang
    const byId = new Map();
    for (const r of roles) {
      let cursor = '';
      for (let page = 0; page < 5; page++) {
        const res = await getJson(`${groups}/v1/groups/${group}/roles/${r.id}/users?limit=100&sortOrder=Asc${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
        (res.data || []).forEach((u) => {
          const id = String(u.userId);
          const had = byId.get(id);
          if (!had || level(r.rankName) > level(had.rank)) byId.set(id, { userId: id, username: u.username, displayName: u.displayName || u.username, rank: r.rankName, role: r.name });
        });
        if (!res.nextPageCursor || res.nextPageCursor === cursor) break;
        cursor = res.nextPageCursor;
      }
    }
    const list = [...byId.values()];
    for (let i = 0; i < list.length; i += 100) {
      const part = list.slice(i, i + 100);
      const r = await getJson(`${thumbs}/v1/users/avatar-headshot?userIds=${part.map((x) => x.userId).join(',')}&size=150x150&format=Png&isCircular=false`).catch(() => ({ data: [] }));
      (r.data || []).forEach((img) => { const p = byId.get(String(img.targetId)); if (p && img.state === 'Completed') p.avatar = img.imageUrl; });
    }
    list.sort((a, b) => level(b.rank) - level(a.rank) || a.username.localeCompare(b.username));
    await store.put('cache:staff2', { at: Date.now(), list });
    return list;
  } catch (e) {
    if (cached) return cached.list;
    throw bad('staff_unavailable', 502);
  }
}

// ---------- Ergebnis einer Bewerbung: Nachricht vom Prüfer an den Bewerber ----------
// Ein Gespräch je Bewerbung; ändert sich das Ergebnis, kommt eine neue Nachricht dazu.
export async function postResult(store, env, reviewer, a) {
  const passed = a.status === 'passed';
  const t = Date.now();
  const job = `${a.jobTitle}${a.area ? ` – ${a.area}` : ''}`;
  let c = a.chatId && await store.get(`chat:${a.chatId}`);
  if (!c) {
    c = {
      id: randomKey(9), kind: 'direct', status: 'open', reason: 'application', app: a.id, created: t, updated: t, messages: [],
      from: person(reviewer), to: { sub: a.sub, username: a.username, displayName: a.displayName || a.username, avatar: a.avatar || null, rank: matchRank(a.groupRole) },
    };
  }
  // Ein anderer Prüfer ändert das Ergebnis: er wird Teil des Gesprächs
  if (c.from.sub !== reviewer.sub && !(c.claimedBy && c.claimedBy.sub === reviewer.sub)) c.claimedBy = person(reviewer);
  if (c.status === 'closed') c.status = 'open';
  const label = passed ? '✅ PASSED' : '❌ FAILED';
  const corrected = c.messages.some((m) => m.kind === 'result');
  c.messages.push({
    id: randomKey(6), by: reviewer.sub, at: t, kind: 'result', status: a.status, job, score: a.score, total: a.total, reviewer: reviewer.username, corrected,
    text: `[${label}] ${corrected ? 'Korrektur: ' : ''}Bewerbung als ${job}\nAusgewertet von ${reviewer.username}\n${passed
      ? 'Herzlichen Glückwunsch! Wir melden uns hier mit allem Weiteren.' : 'Danke für deine Bewerbung. Du kannst dich später gern noch einmal bewerben.'}`,
  });
  c.updated = t;
  await save(store, c);
  await addTo(store, c.from.sub, c.id);
  await addTo(store, a.sub, c.id);
  if (c.claimedBy) await addTo(store, c.claimedBy.sub, c.id);
  await notifyUser(store, env, a.sub, 'applications', {
    title: `Bewerbung ausgewertet: ${label}`, body: `${job} · ausgewertet von ${reviewer.username}`,
    url: `./#/chat/${c.id}`, tag: `app-${a.id}`, actions: [OPEN_ACTION],
  });
  return c.id;
}
