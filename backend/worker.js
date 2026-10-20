/*
 * Train Sim Germany – Backend als Cloudflare Worker
 * Einrichtung: siehe backend/README.md. Daten liegen im KV-Speicher TSG_KV.
 * Der Zeitplan (wrangler.toml → crons) verschickt alle 2 Minuten die fälligen Benachrichtigungen.
 */
import { handle, sendDue } from './app.js';

const kvStore = (kv) => ({
  get: (key) => kv.get(key, 'json'),
  put: (key, value, { ttl } = {}) => kv.put(key, JSON.stringify(value), ttl ? { expirationTtl: Math.max(60, Math.round(ttl)) } : undefined),
  delete: (key) => kv.delete(key),
  list: async (prefix, limit = 1000) => (await kv.list({ prefix, limit })).keys.map((k) => k.name),
});

export default {
  fetch: (request, env) => handle(request, env, kvStore(env.TSG_KV)),
  scheduled: (event, env, ctx) => ctx.waitUntil(sendDue(kvStore(env.TSG_KV), env)),
};
