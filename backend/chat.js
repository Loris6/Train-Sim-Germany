/*
 * Train Sim Germany – Chat zwischen Spielern und dem Team
 *
 * Zwei Arten von Gesprächen:
 *   ticket  – Anfrage mit Grund und Bereich. Alle Teammitglieder dieses Bereichs sehen sie und können sie annehmen.
 *             Nicht angenommene Anfragen stehen oben. Danach schreiben nur noch Spieler und wer angenommen hat.
 *   direct  – Nachricht an eine bestimmte Person ab Supervisor. Nur die beiden sehen das Gespräch.
 *
 *   chat:<id>       → ganzes Gespräch mit Nachrichten
 *   chats:of:<id>   → Gespräche eines Nutzers (IDs)
 *   chats:queue     → Übersicht aller Anfragen für das Team
 *   cache:staff     → Teamliste aus der Roblox-Gruppe (30 Minuten)
 *
 * Gespräche werden 180 Tage nach der letzten Nachricht automatisch gelöscht.
 */
import { randomKey, clip } from './lib.js';
import { level, atLeast, matchRank } from './ranks.js';

const bad = (msg = 'bad_request', status = 400) => Object.assign(new Error(msg), { status });
const MAX_MESSAGES = 300;
const NEW_PER_DAY = 6;
const KEEP = 180 * 86400; // Gespräche werden 180 Tage nach der letzten Nachricht gelöscht

export const REASONS = ['training', 'rank', 'bug', 'report', 'application', 'shop', 'other'];
// Wer eine Anfrage annehmen darf: ab Supervisor, je nach Bereich. Leitung (OM, CDR, CEN) darf alles.
const LEADERSHIP = ['Operation Manager', 'Community Director', 'Chief Engineer'];
export const AREAS = {
  driver: ['Supervisor', 'Driver Manager'],
  platform: ['Supervisor', 'Platform Staff Manager'],
  conductor: ['Supervisor', 'Conductor Manager'],
  signaller: ['Supervisor', 'Signaller Manager'],
  career: ['Public Relations Department'],
  tech: ['Project Engineer', 'Alpha Test Account(s)'],
  report: '*',
  other: ['Supervisor', 'Public Relations Department'],
};
export const canHandle = (rank, area) => {
  if (!atLeast(rank, 'Supervisor') || !AREAS[area]) return false;
  return AREAS[area] === '*' || LEADERSHIP.includes(rank) || AREAS[area].includes(rank);
};
export const areasFor = (rank) => Object.keys(AREAS).filter((a) => canHandle(rank, a));

const person = (u) => ({ sub: u.sub, username: u.username, displayName: u.displayName || u.username, avatar: u.avatar || null, rank: u.rank || null });
const isIn = (c, sub) => c.from.sub === sub || (c.to && c.to.sub === sub) || (c.claimedBy && c.claimedBy.sub === sub);
const summary = (c) => ({
  id: c.id, kind: c.kind, reason: c.reason, area: c.area, status: c.status, from: c.from, to: c.to || null,
  claimedBy: c.claimedBy || null, created: c.created, updated: c.updated, count: c.messages.length,
  last: c.messages.length ? { by: c.messages[c.messages.length - 1].by, text: clip(c.messages[c.messages.length - 1].text, 120) } : null,
});

async function addTo(store, sub, id) {
  const key = `chats:of:${sub}`;
  const list = (await store.get(key)) || [];
  if (!list.includes(id)) await store.put(key, [id, ...list].slice(0, 100));
}
async function saveQueue(store, c) {
  const list = ((await store.get('chats:queue')) || []).filter((x) => x.id !== c.id);
  const keepFrom = Date.now() - 30 * 86400000;
  list.unshift(summary(c));
  await store.put('chats:queue', list.filter((x) => x.status !== 'closed' || x.updated > keepFrom).slice(0, 300));
}
function cleanText(v) {
  const text = clip(v, 2000).replace(/\r/g, '').trim();
  if (!text) throw bad('empty');
  return text;
}

// Darf der Nutzer das Gespräch sehen bzw. schreiben?
function access(c, user) {
  const mine = isIn(c, user.sub);
  const team = c.kind === 'ticket' && canHandle(user.rank, c.area);
  return { see: mine || team, write: c.status !== 'closed' && mine };
}
function view(c, user) {
  const a = access(c, user);
  return { ...c, canWrite: a.write, canClaim: c.kind === 'ticket' && c.status === 'open' && c.from.sub !== user.sub && canHandle(user.rank, c.area), canClose: c.status !== 'closed' && isIn(c, user.sub) };
}

export async function getChat(store, user, id) {
  if (!/^[\w-]{6,30}$/.test(id)) throw bad('not_found', 404);
  const c = await store.get(`chat:${id}`);
  if (!c || !access(c, user).see) throw bad('not_found', 404);
  return c;
}

export async function listChats(store, user) {
  const mine = [];
  for (const id of ((await store.get(`chats:of:${user.sub}`)) || []).slice(0, 60)) {
    const c = await store.get(`chat:${id}`);
    if (c && isIn(c, user.sub)) mine.push(summary(c));
  }
  const areas = areasFor(user.rank);
  const queue = areas.length ? ((await store.get('chats:queue')) || []).filter((x) => areas.includes(x.area) && x.from.sub !== user.sub) : [];
  return { chats: mine, queue, areas, me: user.sub };
}

export async function createChat(store, env, user, body) {
  const kind = body.kind === 'direct' ? 'direct' : 'ticket';
  const text = cleanText(body.text);
  const rl = `chats:new:${user.sub}`;
  const recent = ((await store.get(rl)) || []).filter((x) => x > Date.now() - 86400000);
  if (recent.length >= NEW_PER_DAY) throw bad('rate_limited', 429);
  const t = Date.now();
  const c = {
    id: randomKey(9), kind, status: 'open', from: person(user), created: t, updated: t,
    messages: [{ id: randomKey(6), by: user.sub, text, at: t }],
  };
  if (kind === 'ticket') {
    if (!REASONS.includes(body.reason) || !AREAS[body.area]) throw bad('bad_area');
    c.reason = body.reason;
    c.area = body.area;
    c.claimedBy = null;
  } else {
    const to = String(body.to || '');
    if (!/^\d{1,20}$/.test(to) || to === user.sub) throw bad('bad_target');
    const staff = await staffList(store, env);
    const target = staff.find((x) => String(x.userId) === to);
    if (!target) throw bad('not_staff', 404);
    c.to = { sub: to, username: target.username, displayName: target.displayName, avatar: target.avatar || null, rank: target.rank };
    c.reason = REASONS.includes(body.reason) ? body.reason : 'other';
  }
  await store.put(`chat:${c.id}`, c, { ttl: KEEP });
  await addTo(store, user.sub, c.id);
  if (c.to) await addTo(store, c.to.sub, c.id);
  if (kind === 'ticket') await saveQueue(store, c);
  recent.push(t);
  await store.put(rl, recent, { ttl: 86400 });
  return view(c, user);
}

export async function readChat(store, user, id, since = 0) {
  const c = await getChat(store, user, id);
  const v = view(c, user);
  if (since && c.updated <= since) return { id: c.id, updated: c.updated, unchanged: true, status: c.status, claimedBy: c.claimedBy || null, canWrite: v.canWrite, canClaim: v.canClaim, canClose: v.canClose };
  return v;
}

export async function postMessage(store, user, id, body) {
  const c = await getChat(store, user, id);
  if (!access(c, user).write) throw bad('forbidden', 403);
  if (c.messages.length >= MAX_MESSAGES) throw bad('full', 409);
  const t = Date.now();
  c.messages.push({ id: randomKey(6), by: user.sub, text: cleanText(body.text), at: t });
  c.updated = t;
  await store.put(`chat:${c.id}`, c, { ttl: KEEP });
  return view(c, user);
}

export async function claimChat(store, user, id) {
  const c = await getChat(store, user, id);
  if (c.kind !== 'ticket' || c.from.sub === user.sub || !canHandle(user.rank, c.area)) throw bad('forbidden', 403);
  if (c.status !== 'open') throw bad('taken', 409);
  const t = Date.now();
  c.status = 'claimed';
  c.claimedBy = person(user);
  c.claimedAt = t;
  c.updated = t;
  c.messages.push({ id: randomKey(6), by: 'system', text: 'claimed', name: user.username, at: t });
  await store.put(`chat:${c.id}`, c, { ttl: KEEP });
  await addTo(store, user.sub, c.id);
  await saveQueue(store, c);
  return view(c, user);
}

export async function closeChat(store, user, id) {
  const c = await getChat(store, user, id);
  if (!isIn(c, user.sub)) throw bad('forbidden', 403);
  if (c.status === 'closed') return view(c, user);
  const t = Date.now();
  c.status = 'closed';
  c.updated = t;
  c.messages.push({ id: randomKey(6), by: 'system', text: 'closed', name: user.username, at: t });
  await store.put(`chat:${c.id}`, c, { ttl: KEEP });
  if (c.kind === 'ticket') await saveQueue(store, c);
  return view(c, user);
}

// ---------- Team: alle ab Supervisor aus der Roblox-Gruppe ----------
async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}
export async function staffList(store, env) {
  const cached = await store.get('cache:staff');
  if (cached && Date.now() - cached.at < 30 * 60000) return cached.list;
  const group = String(env.ROBLOX_GROUP_ID || '33684346');
  const groups = (env.ROBLOX_GROUPS_URL || 'https://groups.roblox.com').replace(/\/+$/, '');
  const thumbs = (env.ROBLOX_THUMBNAILS_URL || 'https://thumbnails.roblox.com').replace(/\/+$/, '');
  try {
    const roles = ((await getJson(`${groups}/v1/groups/${group}/roles`)).roles || [])
      .map((r) => ({ ...r, rankName: matchRank(r) })).filter((r) => r.rank > 0 && atLeast(r.rankName, 'Supervisor'));
    const list = [];
    for (const r of roles) {
      let cursor = '';
      for (let page = 0; page < 5; page++) {
        const res = await getJson(`${groups}/v1/groups/${group}/roles/${r.id}/users?limit=100&sortOrder=Asc${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
        (res.data || []).forEach((u) => list.push({ userId: String(u.userId), username: u.username, displayName: u.displayName || u.username, rank: r.rankName, role: r.name }));
        if (!res.nextPageCursor) break;
        cursor = res.nextPageCursor;
      }
    }
    for (let i = 0; i < list.length; i += 100) {
      const part = list.slice(i, i + 100);
      const r = await getJson(`${thumbs}/v1/users/avatar-headshot?userIds=${part.map((x) => x.userId).join(',')}&size=150x150&format=Png&isCircular=false`).catch(() => ({ data: [] }));
      (r.data || []).forEach((img) => { const p = part.find((x) => x.userId === String(img.targetId)); if (p && img.state === 'Completed') p.avatar = img.imageUrl; });
    }
    list.sort((a, b) => level(b.rank) - level(a.rank) || a.username.localeCompare(b.username));
    await store.put('cache:staff', { at: Date.now(), list });
    return list;
  } catch (e) {
    if (cached) return cached.list;
    throw bad('staff_unavailable', 502);
  }
}
