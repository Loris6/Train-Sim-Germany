/* Train Sim Germany – Backend: geheimer Schlüssel für Sitzungen und signierte Links (HMAC-SHA-256) */
import { enc, b64u, fromB64u, randomKey } from './lib.js';

// Wird beim ersten Start erzeugt und gespeichert, außer SESSION_SECRET ist gesetzt
const keyCache = new Map();
export async function hmacKey(env, store) {
  let secret = env.SESSION_SECRET;
  if (!secret) {
    secret = await store.get('config:session-secret');
    if (!secret) { secret = randomKey(32); await store.put('config:session-secret', secret); }
  }
  if (!keyCache.has(secret)) {
    keyCache.set(secret, crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']));
  }
  return keyCache.get(secret);
}
export async function sign(env, store, text) {
  return b64u(await crypto.subtle.sign('HMAC', await hmacKey(env, store), enc.encode(text)));
}
export async function verify(env, store, text, sig) {
  try {
    return await crypto.subtle.verify('HMAC', await hmacKey(env, store), fromB64u(sig), enc.encode(text));
  } catch (e) {
    return false;
  }
}
