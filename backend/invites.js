/*
 * Train Sim Germany – Einladungen ins Spiel
 *
 * Ein Spieler lädt einen anderen über die App zu Train Sim Germany ein. Ist der Einladende gerade im Spiel, führt
 * „Beitreten“ direkt auf seinen Server (öffentlich: über die Server-ID, privat: über den Link des Besitzers, wenn der
 * Eingeladene beitreten darf), sonst ins Spiel. Der Eingeladene bekommt eine Benachrichtigung mit den Knöpfen
 * „Beitreten“ und „Ablehnen“ (wo der Browser Knöpfe zeigt) oder öffnet die Einladung in der App.
 * Der Einladende erfährt, ob angenommen oder abgelehnt wurde.
 *
 *   invite:<id>          → { id, from, to, toName, join, where, at, status } (1 Tag)
 *   invites:sent:<sub>   → Zeitpunkte der letzten Einladungen (höchstens 20 pro Stunde)
 */
import { randomKey, clip } from './lib.js';
import { sign, verify } from './secret.js';
import { notifyUser } from './webpush.js';
import { serverOf, robloxNames } from './game.js';

const bad = (msg = 'bad_request', status = 400) => Object.assign(new Error(msg), { status });
const PER_HOUR = 20;
const nameOf = (p) => p.displayName || p.username;

async function nameFor(store, env, sub) {
  const u = await store.get(`user:${sub}`);
  if (u) return nameOf(u);
  const n = (await robloxNames(store, env, [sub]))[sub];
  return n ? n.displayName || n.username : null;
}

export async function createInvite(store, env, user, body) {
  const to = String(body.to || '');
  if (!/^\d{1,20}$/.test(to) || to === user.sub) throw bad('bad_target');
  const key = `invites:sent:${user.sub}`;
  const recent = ((await store.get(key)) || []).filter((x) => x > Date.now() - 3600000);
  if (recent.length >= PER_HOUR) throw bad('rate_limited', 429);
  await store.put(key, [...recent, Date.now()], { ttl: 3600 });

  // Wo spielt der Einladende gerade – und darf der Eingeladene dort hinein?
  const place = String(env.ROBLOX_PLACE_ID || '140440792597921');
  const loc = await serverOf(store, { sub: to }, user.sub);
  let join = `https://www.roblox.com/games/${place}`;
  let where = null;
  if (loc && !loc.private) {
    join = `https://www.roblox.com/games/start?placeId=${place}&gameInstanceId=${encodeURIComponent(loc.id)}`;
    where = 'öffentlicher Server';
  } else if (loc && loc.pserver && loc.pserver.canJoin && loc.pserver.link) {
    join = loc.pserver.link;
    where = loc.pserver.name;
  }
  const id = randomKey(9);
  const from = { sub: user.sub, username: user.username, displayName: nameOf(user), avatar: user.avatar || null };
  const inv = { id, from, to, toName: await nameFor(store, env, to), join, where, at: Date.now(), status: 'open' };
  await store.put(`invite:${id}`, inv, { ttl: 86400 });
  const k = await sign(env, store, `invite|${id}|${to}`);
  const sent = await notifyUser(store, env, to, 'chat', {
    style: 'person', title: `[TSG] ${nameOf(user)}`, body: where ? `Lädt dich zu Train Sim Germany ein – ${where}` : 'Lädt dich zu Train Sim Germany ein',
    ...(user.avatar ? { icon: user.avatar } : {}), tag: `invite-${id}`, url: `./#/spieler?invite=${id}`,
    join, invite: { id, k }, actions: [{ action: 'join', title: 'Beitreten' }, { action: 'decline', title: 'Ablehnen' }],
  });
  return { id, sent, where, toName: inv.toName };
}

const viewOf = ({ id, from, to, toName, join, where, at, status }) => ({ id, from, to, toName, join, where, at, status });

export async function getInvite(store, user, id) {
  const inv = /^[\w-]{6,20}$/.test(id) ? await store.get(`invite:${id}`) : null;
  if (!inv || (inv.to !== user.sub && inv.from.sub !== user.sub)) throw bad('not_found', 404);
  return viewOf(inv);
}

// Annehmen oder ablehnen – angemeldet in der App oder aus der Benachrichtigung (mit signiertem Schlüssel)
export async function answerInvite(store, env, user, id, body) {
  const inv = /^[\w-]{6,20}$/.test(id) ? await store.get(`invite:${id}`) : null;
  if (!inv) throw bad('not_found', 404);
  const allowed = user ? user.sub === inv.to : await verify(env, store, `invite|${id}|${inv.to}`, String(body.k || ''));
  if (!allowed) throw bad('forbidden', 403);
  const join = body.answer === 'join';
  if (inv.status === 'open') {
    inv.status = join ? 'joined' : 'declined';
    await store.put(`invite:${id}`, inv, { ttl: 86400 });
    await notifyUser(store, env, inv.from.sub, 'chat', {
      style: 'person', title: `[TSG] ${inv.toName || 'Spieler'}`, body: join ? 'Nimmt deine Einladung an und tritt bei.' : 'Hat deine Einladung abgelehnt.',
      tag: `invite-${id}`, url: './#/spieler',
    });
  }
  return viewOf(inv);
}
