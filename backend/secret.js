/*
 * Train Sim Germany – Backend: geheimer Schlüssel für Sitzungen und signierte Links (HMAC-SHA-256)
 * und für Zugangsdaten, die verschlüsselt gespeichert werden (Discord-Webhooks und Bot-Tokens, AES-GCM).
 */
import { enc, dec, b64u, fromB64u, randomKey } from './lib.js';

// Wird beim ersten Start erzeugt und gespeichert, außer SESSION_SECRET ist gesetzt
const keyCache = new Map();
async function secretOf(env, store) {
  let secret = env.SESSION_SECRET;
  if (!secret) {
    secret = await store.get('config:session-secret');
    if (!secret) { secret = randomKey(32); await store.put('config:session-secret', secret); }
  }
  return secret;
}
export async function hmacKey(env, store) {
  const secret = await secretOf(env, store);
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

// Verschlüsseln mit einem eigenen Schlüssel, abgeleitet vom Geheimnis oben
const aesCache = new Map();
async function aesKey(env, store) {
  const secret = await secretOf(env, store);
  if (!aesCache.has(secret)) {
    aesCache.set(secret, crypto.subtle.digest('SHA-256', enc.encode(`${secret}|tsg-seal-v1`))
      .then((raw) => crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])));
  }
  return aesCache.get(secret);
}
export async function sealText(env, store, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(env, store), enc.encode(String(text)));
  return `${b64u(iv)}.${b64u(data)}`;
}
export async function openText(env, store, sealed) {
  try {
    const [iv, data] = String(sealed || '').split('.');
    return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64u(iv) }, await aesKey(env, store), fromB64u(data)));
  } catch (e) {
    return null;
  }
}
