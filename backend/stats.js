/*
 * Train Sim Germany – echte Zahlen (alle 10 Minuten neu geladen)
 *   Roblox-Gruppe: Mitglieder gesamt und je Rolle
 *   Spiel: Spieler online, Besuche, Favoriten
 *   Discord: Mitglieder und gerade online (über den Einladungslink)
 */
const CACHE_SECONDS = 600;

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

export async function liveStats(store, env, robloxUrl) {
  const cached = await store.get('cache:stats');
  if (cached && Date.now() - cached.at < CACHE_SECONDS * 1000) return cached;
  const group = String(env.ROBLOX_GROUP_ID || '33684346');
  const place = String(env.ROBLOX_PLACE_ID || '140440792597921');
  const invite = String(env.DISCORD_INVITE || 'tvaSwbh3rE');
  const out = { ...(cached || {}), at: Date.now() };
  await Promise.allSettled([
    getJson(`${robloxUrl(env, 'groups')}/v1/groups/${group}`).then((g) => { out.groupMembers = g.memberCount; }),
    getJson(`${robloxUrl(env, 'groups')}/v1/groups/${group}/roles`).then((r) => {
      out.roles = (r.roles || []).map((x) => ({ name: x.name, rank: x.rank, memberCount: x.memberCount }));
    }),
    getJson(`${robloxUrl(env, 'apis')}/universes/v1/places/${place}/universe`)
      .then((u) => getJson(`${robloxUrl(env, 'games')}/v1/games?universeIds=${u.universeId}`))
      .then((g) => {
        const game = (g.data || [])[0];
        if (game) { out.playing = game.playing; out.visits = game.visits; out.favorites = game.favoritedCount; }
      }),
    getJson(`${(env.DISCORD_API_URL || 'https://discord.com/api/v10').replace(/\/+$/, '')}/invites/${invite}?with_counts=true`).then((d) => {
      out.discordMembers = d.approximate_member_count;
      out.discordOnline = d.approximate_presence_count;
    }),
  ]);
  await store.put('cache:stats', out);
  return out;
}
