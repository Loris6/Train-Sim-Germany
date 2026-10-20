/*
 * Train Sim Germany – Backend als Cloudflare Worker
 * Einrichtung: siehe backend/README.md. Daten liegen im KV-Speicher TSG_KV.
 */
import { handle } from './app.js';

const kvStore = (kv) => ({
  get: (key) => kv.get(key, 'json'),
  put: (key, value, { ttl } = {}) => kv.put(key, JSON.stringify(value), ttl ? { expirationTtl: Math.max(60, ttl) } : undefined),
  delete: (key) => kv.delete(key),
});

export default {
  fetch: (request, env) => handle(request, env, kvStore(env.TSG_KV)),
};
