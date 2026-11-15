/* Train Sim Germany – Steckbriefe des Teams (ab Junior Supervisor)
 *
 *   team:<userId>    → { about, area, motto, favRoute, favTrain, languages, discord, timezone, updated }
 *                      vom Teammitglied selbst gepflegt
 *   rsince:<userId>  → { rank, since }   seit wann die App die Person mit diesem Rang kennt
 *   rjoined:<userId> → Datum, an dem das Roblox-Konto erstellt wurde (30 Tage zwischengespeichert)
 *
 * Wer seinen Steckbrief sieht: alle. Was sie sehen, entscheidet die Person in den Einstellungen:
 *   „Profil öffentlich“ → der ganze Steckbrief, „Statistik öffentlich“ → die Zahlen aus dem Spiel.
 *   Sonst nur das Wichtigste: Name, Rang, seit wann im Rang, Beitrittsdaten.
 */
import { clip } from './lib.js';
import { robloxUser } from './roblox.js';
import { playerStats } from './game.js';

const bad = (msg = 'bad_request', status = 400) => Object.assign(new Error(msg), { status });
const FIELDS = { about: 600, area: 60, motto: 120, favRoute: 80, favTrain: 60, languages: 80, discord: 40, timezone: 40 };

export function cleanProfile(body) {
  const out = {};
  for (const [k, max] of Object.entries(FIELDS)) out[k] = clip(String((body && body[k]) || '').replace(/[\u0000-\u0008\u000B-\u001F]/g, '').trim(), max);
  if (out.discord && !/^[a-z0-9_.]{2,32}$/i.test(out.discord)) throw bad('discord');
  return out;
}

async function robloxJoined(store, env, id) {
  const key = `rjoined:${id}`;
  const cached = await store.get(key);
  if (cached !== null && cached !== undefined) return cached || null;
  let created = '';
  try { const u = await robloxUser(env, id); created = (u && u.created) || ''; } catch (e) { created = ''; }
  await store.put(key, created, { ttl: 30 * 86400 });
  return created || null;
}

// GET /api/team/<userId>
export async function teamMember(store, env, viewer, id, staff) {
  const m = staff.find((x) => x.userId === String(id));
  if (!m) throw bad('not_found', 404);
  const [user, since, stats, joined, profile] = await Promise.all([
    store.get(`user:${m.userId}`), store.get(`rsince:${m.userId}`), store.get(`pstats:${m.userId}`), robloxJoined(store, env, m.userId), store.get(`team:${m.userId}`),
  ]);
  const own = !!viewer && viewer.sub === m.userId;
  const pub = !!(user && user.privacy && user.privacy.profile);
  const statsPub = !!(user && user.privacy && user.privacy.stats);
  return {
    member: { userId: m.userId, username: m.username, displayName: m.displayName, avatar: m.avatar || null, rank: m.rank, role: m.role },
    basics: {
      rankSince: since && since.rank === m.rank ? since.since : null,
      robloxJoined: joined,
      firstPlayed: (stats && stats.first) || null,
      lastPlayed: statsPub || own ? (stats && stats.last) || null : null,
      appSince: (user && user.created) || null,
    },
    own, public: pub, statsPublic: statsPub,
    profile: pub || own ? profile || null : null,
    stats: statsPub || own ? await playerStats(store, m.userId) : null,
  };
}

// PUT /api/team/me – nur wer selbst im Team ist
export async function saveTeamProfile(store, user, body, staff) {
  if (!staff.some((x) => x.userId === user.sub)) throw bad('forbidden', 403);
  const profile = { ...cleanProfile(body), updated: Date.now() };
  await store.put(`team:${user.sub}`, profile);
  return profile;
}
