/*
 * Train Sim Germany – Shop: Coins, Züge und Strecken
 *
 * Das Spiel bleibt die Quelle für Coins und Besitz. Es meldet beides über POST /api/game/sync
 * (Schlüssel GAME_API_KEY, Skript: game/TSGAppSync.server.lua) und holt dabei die Käufe aus der App ab.
 * Ein Kauf in der App wartet, bis das Spiel ihn verbucht hat (Coins abziehen, Zug/Strecke freischalten).
 *
 *   wallet:<userId>  → { coins, trains, routes, syncedAt, history }   (Stand aus dem Spiel)
 *   shop:pending     → { <userId>: [{ id, kind, item, price, at }] }   (Käufe, die das Spiel noch abholen muss)
 */
import { randomKey, clip, enc } from './lib.js';

const bad = (msg = 'bad_request', status = 400) => Object.assign(new Error(msg), { status });

// Preise in Coins. Die IDs müssen im Spiel gleich heißen (siehe game/TSGAppSync.server.lua).
export const CATALOG = {
  trains: [
    { id: 'talent2', name: 'Talent 2', series: 'BR 442', cat: 're', vmax: 160, price: 0, starter: true },
    { id: 'br481', name: 'BR 481', series: 'S-Bahn Berlin', cat: 's', vmax: 100, price: 2500 },
    { id: 'flirt3', name: 'FLIRT 3', series: 'BR 1428', cat: 's', vmax: 140, price: 3500 },
    { id: 'lint41', name: 'LINT 41', series: 'BR 648', cat: 'rb', vmax: 120, price: 4000 },
    { id: 'kiss', name: 'KISS', series: 'BR 445', cat: 're', vmax: 160, price: 6500 },
    { id: 'desirohc', name: 'Desiro HC', series: 'BR 462', cat: 're', vmax: 160, price: 7500 },
    { id: 'dosto', name: 'Doppelstock', series: 'BR 146 + Dosto', cat: 're', vmax: 160, price: 9000 },
    { id: 'ic2', name: 'IC 2', series: 'BR 146.5 + Twindexx', cat: 'ic', vmax: 160, price: 15000 },
    { id: 'ic1', name: 'IC 1', series: 'BR 101', cat: 'ic', vmax: 200, price: 20000 },
    { id: 'ice-t', name: 'ICE T', series: 'BR 411', cat: 'ice', vmax: 230, price: 32000 },
    { id: 'eu44', name: 'Berlin-Warszawa-Express', series: 'EU44 Husarz', cat: 'ec', vmax: 160, price: 45000 },
    { id: 'ice4', name: 'ICE 4', series: 'BR 412', cat: 'ice', vmax: 250, price: 60000 },
  ],
  routes: [
    { id: 'R001', price: 0, starter: true },
    { id: 'R002', price: 3000 },
    { id: 'R003', price: 3000 },
    { id: 'R004', price: 5000 },
    { id: 'R005', price: 6000 },
    { id: 'R006', price: 8000 },
    { id: 'R007', price: 10000 },
    { id: 'R008', price: 12000 },
    { id: 'R009', price: 15000 },
    { id: 'R010', price: 40000 },
  ],
};
const itemOf = (kind, id) => (CATALOG[kind === 'route' ? 'routes' : 'trains'] || []).find((x) => x.id === id);
const starters = (kind) => CATALOG[kind].filter((x) => x.starter).map((x) => x.id);

const ids = (v, n = 200) => (Array.isArray(v) ? v : []).slice(0, n).map((x) => clip(x, 40)).filter(Boolean);
const emptyWallet = () => ({ coins: 0, trains: starters('trains'), routes: starters('routes'), syncedAt: null, history: [] });

export async function walletView(store, sub) {
  const w = (await store.get(`wallet:${sub}`)) || emptyWallet();
  const pending = ((await store.get('shop:pending')) || {})[sub] || [];
  const reserved = pending.reduce((n, p) => n + p.price, 0);
  return {
    coins: w.coins, available: Math.max(0, w.coins - reserved), trains: w.trains, routes: w.routes,
    syncedAt: w.syncedAt, pending, history: (w.history || []).slice(0, 20),
  };
}

export async function shopState(store, user) {
  return { catalog: CATALOG, connected: !!user, wallet: user ? await walletView(store, user.sub) : null };
}

// Kauf in der App: Coins werden reserviert, das Spiel verbucht ihn beim nächsten Abgleich
export async function buy(store, user, body) {
  const kind = body.kind === 'route' ? 'route' : body.kind === 'train' ? 'train' : null;
  const item = kind && itemOf(kind, String(body.id || ''));
  if (!item) throw bad('unknown_item');
  const w = await walletView(store, user.sub);
  if (!w.syncedAt) throw bad('not_synced', 409);
  const owned = kind === 'route' ? w.routes : w.trains;
  if (owned.includes(item.id) || w.pending.some((p) => p.kind === kind && p.item === item.id)) throw bad('owned', 409);
  if (w.pending.length >= 10) throw bad('too_many', 429);
  if (w.available < item.price) throw bad('not_enough', 402);
  const all = (await store.get('shop:pending')) || {};
  all[user.sub] = [...(all[user.sub] || []), { id: randomKey(9), kind, item: item.id, price: item.price, at: Date.now() }];
  await store.put('shop:pending', all);
  return walletView(store, user.sub);
}

// Schlüssel des Spiels prüfen (zeitkonstanter Vergleich)
async function sameSecret(a, b) {
  const [x, y] = await Promise.all([a, b].map((v) => crypto.subtle.digest('SHA-256', enc.encode(String(v || '')))));
  const p = new Uint8Array(x);
  const q = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < p.length; i++) diff |= p[i] ^ q[i];
  return diff === 0;
}
export async function gameAuthorized(req, env) {
  if (!env.GAME_API_KEY) throw bad('not_configured', 503);
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  return token.length > 0 && sameSecret(token, env.GAME_API_KEY);
}

/*
 * Abgleich mit dem Spiel:
 *   players: [{ userId, coins, trains, routes }]  – nur Spieler, deren Stand sich geändert hat (bzw. beim Betreten/Verlassen)
 *   online:  [userId]                               – für diese Spieler werden offene Käufe zurückgegeben
 *   done:    [{ id, userId, ok }]                   – vom Spiel verbuchte (ok) oder abgelehnte Käufe
 */
export async function gameSync(store, body) {
  const t = Date.now();
  const players = (Array.isArray(body.players) ? body.players : []).slice(0, 100);
  const done = (Array.isArray(body.done) ? body.done : []).slice(0, 200);
  const online = ids(body.online, 200).filter((x) => /^\d{1,20}$/.test(x));
  const all = (await store.get('shop:pending')) || {};
  let pendingChanged = false;
  const wallets = new Map();
  const walletOf = async (sub) => {
    if (!wallets.has(sub)) wallets.set(sub, (await store.get(`wallet:${sub}`)) || emptyWallet());
    return wallets.get(sub);
  };
  for (const p of players) {
    const sub = String(p.userId || '');
    if (!/^\d{1,20}$/.test(sub)) continue;
    const w = await walletOf(sub);
    w.coins = Math.max(0, Math.round(+p.coins || 0));
    w.trains = [...new Set([...starters('trains'), ...ids(p.trains)])];
    w.routes = [...new Set([...starters('routes'), ...ids(p.routes)])];
    w.syncedAt = t;
  }
  for (const d of done) {
    const sub = String(d.userId || '');
    const list = all[sub] || [];
    const hit = list.find((x) => x.id === d.id);
    if (!hit) continue;
    all[sub] = list.filter((x) => x.id !== d.id);
    if (!all[sub].length) delete all[sub];
    pendingChanged = true;
    const w = await walletOf(sub);
    if (d.ok) {
      const key = hit.kind === 'route' ? 'routes' : 'trains';
      if (!w[key].includes(hit.item)) w[key].push(hit.item);
    }
    w.history = [{ ...hit, ok: !!d.ok, doneAt: t }, ...(w.history || [])].slice(0, 30);
  }
  await Promise.all([...wallets].map(([sub, w]) => store.put(`wallet:${sub}`, w)));
  if (pendingChanged) await store.put('shop:pending', all);
  const pending = {};
  online.forEach((sub) => { if (all[sub]) pending[sub] = all[sub]; });
  return { pending, catalog: CATALOG, at: t };
}
