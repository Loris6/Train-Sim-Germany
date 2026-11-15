/*
 * Train Sim Germany – Abgleich mit dem Spiel
 *
 * Das Spiel (game/TSGAppSync.server.lua) meldet sich über POST /api/game/sync mit dem Schlüssel GAME_API_KEY.
 *
 *   online:   [userId]                                     – wer gerade auf diesem Server ist
 *   server:   { jobId, players, max, version, private, closing } – dieser Server (Server-Seite, /GetServers und /GetOnline im Chat)
 *             privater Server zusätzlich: { privateId, ownerId, ownerName, relaySince } → Antwort enthält config (siehe pservers.js)
 *   activity: [{ userId, name, displayName, role, line, train, … }] – wer was macht (siehe game.js)
 *   trips:    [{ userId, route, vehicle, km, delay }]      – beendete Fahrten für die Statistik
 *
 * Ältere Skripte schicken noch players/done (Coins und Käufe aus dem früheren Shop) – das wird ignoriert.
 */
import { clip, enc } from './lib.js';
import { privateServerSync } from './pservers.js';
import { recordServer, dropStale } from './game.js';

const bad = (msg = 'bad_request', status = 400) => Object.assign(new Error(msg), { status });

// Fahrzeuge im Spiel: Gattung für die Statistik (gleiche IDs wie im Spiel und in assets/js/data.js → trains)
export const VEHICLES = {
  trains: [
    { id: 'talent2', cat: 're' }, { id: 'br481', cat: 's' }, { id: 'flirt3', cat: 's' }, { id: 'lint41', cat: 'rb' },
    { id: 'kiss', cat: 're' }, { id: 'desirohc', cat: 're' }, { id: 'dosto', cat: 're' }, { id: 'ic2', cat: 'ic' },
    { id: 'ic1', cat: 'ic' }, { id: 'ice-t', cat: 'ice' }, { id: 'eu44', cat: 'ec' }, { id: 'ice4', cat: 'ice' },
  ],
};

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

export async function gameSync(store, body) {
  const t = Date.now();
  const online = (Array.isArray(body.online) ? body.online : []).slice(0, 200).map((x) => clip(x, 40)).filter((x) => /^\d{1,20}$/.test(x));
  // Laufende Server (älter als 10 Minuten = weg), wer was macht, Spielzeit und Fahrten (siehe game.js)
  const sv = body.server && typeof body.server === 'object' ? body.server : null;
  const jobId = sv && clip(sv.jobId, 64);
  let events = null;
  if (jobId) {
    const servers = (await store.get('game:servers')) || {};
    await dropStale(store, servers, t);
    const change = await recordServer(store, servers, jobId, sv, body, online, VEHICLES, t);
    await store.put('game:servers', servers);
    // Privater Server: wer kam und ging (für Automationen im verbundenen Server-Chat)
    if (sv.private && sv.privateId && (change.joined.length || change.left.length)) {
      events = [{ privateId: clip(sv.privateId, 64), joined: change.joined, left: change.left, players: online.length }];
    }
  }
  // Letzte Meldung aus dem Spiel (für die Anzeige „Verbindung zum Spiel“), höchstens einmal pro Minute geschrieben
  const last = await store.get('game:last');
  if (!last || t - last.at > 60000) await store.put('game:last', { at: t, private: !!(sv && sv.private) });
  // Privater Server: Stand merken, Einstellungen aus der App zurückgeben
  const config = jobId && sv.private && sv.privateId ? await privateServerSync(store, sv, online, clip(sv.ownerName, 40)) : null;
  // pending bleibt leer, damit ältere Skripte nicht stolpern
  return { pending: {}, at: t, ...(config ? { config } : {}), ...(events ? { _events: events } : {}) };
}
