/*
 * Train Sim Germany – Backend als Cloudflare Worker
 * Einrichtung: siehe backend/README.md.
 *
 * Alle Daten liegen in einem Durable Object (SQLite, im kostenlosen Tarif enthalten). Jede Anfrage läuft dort,
 * dadurch sehen alle sofort denselben Stand – wichtig für Chat, Käufe und Bewerbungen.
 * Der Zeitplan (wrangler.toml → crons) verschickt alle 2 Minuten die fälligen Benachrichtigungen, merkt sich die
 * Spielerzahl für die Statistik und räumt einmal pro Stunde abgelaufene Dateien aus dem Chat auf.
 */
import { DurableObject } from 'cloudflare:workers';
import { handle, sendDue, recordHistory } from './app.js';
import { cleanupFiles } from './files.js';

// Speicher im Durable Object: { v: Wert, exp: Ablauf in ms (0 = nie) }
const doStore = (storage) => ({
  async get(key) {
    const e = await storage.get(key);
    if (!e) return null;
    if (e.exp && e.exp < Date.now()) { await storage.delete(key); return null; }
    return e.v;
  },
  put: (key, v, { ttl } = {}) => storage.put(key, { v, exp: ttl ? Date.now() + ttl * 1000 : 0 }),
  delete: (key) => storage.delete(key),
  async list(prefix, limit = 1000) {
    const t = Date.now();
    return [...(await storage.list({ prefix, limit }))].filter(([, e]) => !(e.exp && e.exp < t)).map(([k]) => k);
  },
});

export class TSGStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.store = doStore(ctx.storage);
  }
  fetch(request) {
    return handle(request, this.env, this.store);
  }
  async cron() {
    await sendDue(this.store, this.env);
    // Spieler je Stunde für die Statistik
    await recordHistory(this.store, this.env).catch((e) => console.error(e));
    // Abgelaufene Dateien aus dem Chat (Bytes liegen unter blob:, siehe files.js)
    if (new Date().getUTCMinutes() < 2) await cleanupFiles(this.store);
    // Abgelaufene Einträge aufräumen – ohne den Bereich blob: (der würde alle Videos in den Speicher laden)
    const t = Date.now();
    const entries = [...await this.ctx.storage.list({ end: 'blob:', limit: 2000 }), ...await this.ctx.storage.list({ start: 'blob;', limit: 2000 })];
    const old = entries.filter(([, e]) => e && e.exp && e.exp < t).map(([k]) => k);
    for (let i = 0; i < old.length; i += 128) await this.ctx.storage.delete(old.slice(i, i + 128));
  }
}

const main = (env) => env.TSG_STORE.get(env.TSG_STORE.idFromName('main'));

export default {
  fetch: (request, env) => main(env).fetch(request),
  scheduled: (event, env, ctx) => ctx.waitUntil(main(env).cron()),
};
