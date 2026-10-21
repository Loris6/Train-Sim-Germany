/* Train Sim Germany – öffentliche Roblox-Daten: Spieler, Profilbilder, Rolle in der Gruppe */
import { matchRank } from './ranks.js';

const base = (env, name, fallback) => (env[`ROBLOX_${name}_URL`] || fallback).replace(/\/+$/, '');
export const usersApi = (env) => base(env, 'USERS', 'https://users.roblox.com');
export const groupsApi = (env) => base(env, 'GROUPS', 'https://groups.roblox.com');
export const thumbsApi = (env) => base(env, 'THUMBNAILS', 'https://thumbnails.roblox.com');
export const groupIdOf = (env) => String(env.ROBLOX_GROUP_ID || '33684346');

const bad = (msg = 'bad_request', status = 400) => Object.assign(new Error(msg), { status });

export async function getJson(url, init) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, ...init });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

// Öffentliches Profil (Name, Anzeigename, Profilbild, erstellt am)
export async function robloxUser(env, id) {
  const res = await fetch(`${usersApi(env)}/v1/users/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const u = await res.json();
  let avatar = null;
  try {
    const img = ((await getJson(`${thumbsApi(env)}/v1/users/avatar-headshot?userIds=${encodeURIComponent(id)}&size=150x150&format=Png&isCircular=false`)).data || [])[0];
    if (img && img.state === 'Completed') avatar = img.imageUrl;
  } catch (e) { /* ohne Bild */ }
  return { userId: String(u.id), username: u.name, displayName: u.displayName || u.name, avatar, created: u.created || null };
}

// Spieler per Roblox-Name oder Nutzer-ID
export async function findPlayer(env, query) {
  const q = String(query || '').trim().replace(/^@/, '');
  if (/^\d{1,20}$/.test(q)) return robloxUser(env, q);
  if (!/^[A-Za-z0-9_]{3,20}$/.test(q)) throw bad('bad_name');
  const res = await fetch(`${usersApi(env)}/v1/usernames/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usernames: [q], excludeBannedUsers: true }) });
  const hit = res.ok ? ((await res.json()).data || [])[0] : null;
  return hit ? robloxUser(env, hit.id) : null;
}

// Rolle in unserer Gruppe (null = nicht in der Gruppe)
export async function groupRole(env, id) {
  const r = await getJson(`${groupsApi(env)}/v2/users/${encodeURIComponent(id)}/groups/roles`);
  const hit = (r.data || []).find((x) => String(x.group && x.group.id) === groupIdOf(env));
  return hit ? { name: hit.role.name, rank: hit.role.rank, app: matchRank(hit.role) } : null;
}

// Namen zu vielen Nutzer-IDs (für „Wer ist online?“)
export async function namesOf(env, ids) {
  if (!ids.length) return [];
  const r = await getJson(`${usersApi(env)}/v1/users`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ userIds: ids.slice(0, 100).map(Number), excludeBannedUsers: false }) });
  return (r.data || []).map((u) => ({ userId: String(u.id), username: u.name, displayName: u.displayName || u.name }));
}

// Basisadressen wie in app.js (für Tests per ROBLOX_<NAME>_URL umstellbar)
const DEFAULTS = {
  apis: 'https://apis.roblox.com', users: 'https://users.roblox.com', groups: 'https://groups.roblox.com',
  games: 'https://games.roblox.com', thumbnails: 'https://thumbnails.roblox.com',
};
export const robloxUrl = (env, name) => (env[`ROBLOX_${name.toUpperCase()}_URL`] || DEFAULTS[name]).replace(/\/+$/, '');
