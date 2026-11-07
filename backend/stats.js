/*
 * Train Sim Germany – echte Zahlen (alle 10 Minuten neu geladen)
 *   Roblox-Gruppe: Mitglieder gesamt und je Rolle
 *   Spiel: Spieler online, Besuche, Favoriten
 *   Discord: Mitglieder und gerade online (über den Einladungslink)
 *
 * Roblox lehnt Abfragen manchmal ab (z. B. von Cloud-Servern). Dann wird roproxy.com versucht, die Favoriten kommen
 * notfalls aus /v1/games/<universe>/favorites/count, und alte Zahlen bleiben stehen, statt auf 0 zu fallen.
 * Fehlt eine Zahl, wird schon nach einer Minute wieder gefragt. Die Universe-ID wird gemerkt (oder ROBLOX_UNIVERSE_ID).
 */
const CACHE_SECONDS = 600;
const RETRY_SECONDS = 60;
const HEADERS = { Accept: 'application/json', 'User-Agent': 'TrainSimGermanyApp/1.0' };

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}
// Erst Roblox selbst, dann roproxy.com (gleiche Pfade)
async function robloxJson(robloxUrl, env, name, path) {
  const urls = [`${robloxUrl(env, name)}${path}`];
  if (!env[`ROBLOX_${name.toUpperCase()}_URL`]) urls.push(`https://${name}.roproxy.com${path}`);
  let last;
  for (const url of urls) {
    try { return await getJson(url); } catch (e) { last = e; }
  }
  throw last;
}
async function universeOf(store, env, robloxUrl, place) {
  if (/^\d{1,20}$/.test(String(env.ROBLOX_UNIVERSE_ID || ''))) return String(env.ROBLOX_UNIVERSE_ID);
  const key = `cache:universe:${place}`;
  const known = await store.get(key);
  if (known) return known;
  const u = await robloxJson(robloxUrl, env, 'apis', `/universes/v1/places/${place}/universe`);
  if (!u || !u.universeId) throw new Error('no_universe');
  await store.put(key, String(u.universeId));
  return String(u.universeId);
}
const num = (v) => (Number.isFinite(v) && v >= 0 ? v : undefined);

export async function liveStats(store, env, robloxUrl) {
  const cached = await store.get('cache:stats');
  const complete = (s) => s && ['visits', 'favorites', 'groupMembers', 'discordMembers'].every((k) => Number.isFinite(s[k]));
  if (cached && Date.now() - cached.at < (complete(cached) ? CACHE_SECONDS : RETRY_SECONDS) * 1000) return cached;
  const group = String(env.ROBLOX_GROUP_ID || '33684346');
  const place = String(env.ROBLOX_PLACE_ID || '140440792597921');
  const invite = String(env.DISCORD_INVITE || 'tvaSwbh3rE');
  const out = { ...(cached || {}), at: Date.now() };
  const set = (k, v) => { if (num(v) !== undefined) out[k] = v; };
  await Promise.allSettled([
    robloxJson(robloxUrl, env, 'groups', `/v1/groups/${group}`).then((g) => set('groupMembers', g.memberCount)),
    robloxJson(robloxUrl, env, 'groups', `/v1/groups/${group}/roles`).then((r) => {
      if (Array.isArray(r.roles)) out.roles = r.roles.map((x) => ({ name: x.name, rank: x.rank, memberCount: x.memberCount }));
    }),
    universeOf(store, env, robloxUrl, place).then(async (universe) => {
      out.universeId = universe;
      const [games, favs] = await Promise.allSettled([
        robloxJson(robloxUrl, env, 'games', `/v1/games?universeIds=${universe}`),
        robloxJson(robloxUrl, env, 'games', `/v1/games/${universe}/favorites/count`),
      ]);
      const game = games.status === 'fulfilled' ? ((games.value && games.value.data) || [])[0] : null;
      if (game) { set('playing', game.playing); set('visits', game.visits); set('favorites', game.favoritedCount); }
      // Eigene Abfrage für Favoriten: genauer und auch dann, wenn die Spieldaten fehlen
      if (favs.status === 'fulfilled' && favs.value) set('favorites', favs.value.favoritesCount);
    }),
    getJson(`${(env.DISCORD_API_URL || 'https://discord.com/api/v10').replace(/\/+$/, '')}/invites/${invite}?with_counts=true`).then((d) => {
      set('discordMembers', d.approximate_member_count);
      set('discordOnline', d.approximate_presence_count);
    }),
  ]);
  await store.put('cache:stats', out);
  return out;
}
