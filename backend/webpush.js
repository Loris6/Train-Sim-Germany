/*
 * Train Sim Germany – Web-Push (echte Benachrichtigungen, auch wenn die App geschlossen ist)
 *
 * VAPID (RFC 8292): Das Backend erzeugt sein Schlüsselpaar beim ersten Start selbst und speichert es.
 * Verschlüsselung der Nachricht: aes128gcm (RFC 8291). Nur Web-Standards (crypto.subtle).
 *
 * Gespeichert wird je Abo:  push:<sid>          → { subscription, reminders: [...], due: [...] }
 * und je Erinnerung:        due:<minute>:<sid>:<n> → { sid, id }   (sortiert nach Minute)
 */
import { enc, b64u, fromB64u, concat, now, clip } from './lib.js';

const MAX_REMINDERS = 60;
const pad = (n) => String(n).padStart(10, '0');

// ---------- Schlüssel ----------
export async function vapidKeys(store) {
  let v = await store.get('config:vapid');
  if (!v) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    v = { publicKey: b64u(await crypto.subtle.exportKey('raw', pair.publicKey)), privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey) };
    await store.put('config:vapid', v);
  }
  return v;
}
export async function vapidHeader(endpoint, keys, subject) {
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: now() + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${keys.publicKey}`;
}

// ---------- Verschlüsselung (RFC 8291) ----------
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}
// test: feste Werte für salt und Server-Schlüssel (nur für Tests mit den Beispielwerten aus RFC 8291)
export async function encryptPayload(text, p256dh, auth, test = {}) {
  const uaPublic = fromB64u(p256dh);
  const authSecret = fromB64u(auth);
  const salt = test.salt || crypto.getRandomValues(new Uint8Array(16));
  const local = test.keyPair || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(authSecret, secret, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(enc.encode(text), new Uint8Array([2]))));
  const header = new Uint8Array(21);
  header.set(salt);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  return concat(header, asPublic, cipher);
}

export async function sendPush(subscription, message, keys, subject) {
  const body = await encryptPayload(JSON.stringify(message), subscription.keys.p256dh, subscription.keys.auth);
  return fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(subscription.endpoint, keys, subject),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '1800',
      Urgency: 'high',
    },
    body,
  });
}

// ---------- Erinnerungen speichern ----------
async function subscriptionId(endpoint) {
  return b64u(await crypto.subtle.digest('SHA-256', enc.encode(endpoint))).slice(0, 22);
}
function validSubscription(sub) {
  try {
    const u = new URL(sub.endpoint);
    const local = ['localhost', '127.0.0.1'].includes(u.hostname);
    return (u.protocol === 'https:' || local) && fromB64u(sub.keys.p256dh).length === 65 && fromB64u(sub.keys.auth).length >= 16;
  } catch (e) {
    return false;
  }
}
async function dropDue(store, rec) {
  await Promise.all((rec.due || []).map((k) => store.delete(k)));
}
// Ersetzt die Erinnerungen eines Abos (leere Liste = alles löschen)
export async function saveReminders(store, body) {
  const sub = body && body.subscription;
  if (!sub || !validSubscription(sub) || !Array.isArray(body.reminders)) throw Object.assign(new Error('bad_request'), { status: 400 });
  const sid = await subscriptionId(sub.endpoint);
  const old = await store.get(`push:${sid}`);
  if (old) await dropDue(store, old);
  const t = now();
  const reminders = body.reminders.slice(0, MAX_REMINDERS)
    .filter((r) => Number.isFinite(+r.at) && +r.at > t - 60 && +r.at < t + 21 * 86400)
    .map((r) => ({
      id: clip(r.id, 40), at: Math.round(+r.at), title: clip(r.title, 120), body: clip(r.body, 400), tag: clip(r.tag, 60),
      url: clip(r.url, 500), join: clip(r.join, 500) || null, joinLabel: clip(r.joinLabel, 30), lang: clip(body.lang || r.lang, 5),
    }));
  if (!reminders.length) {
    await store.delete(`push:${sid}`);
    return { sid, count: 0 };
  }
  const due = [];
  for (const [n, r] of reminders.entries()) {
    const key = `due:${pad(Math.floor(r.at / 60))}:${sid}:${n}`;
    await store.put(key, { sid, id: r.id }, { ttl: r.at - t + 86400 });
    due.push(key);
  }
  await store.put(`push:${sid}`, { subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, reminders, due, updated: t }, { ttl: 22 * 86400 });
  return { sid, count: reminders.length };
}

// Fällige Erinnerungen senden (jede Minute bzw. alle 2 Minuten aufrufen)
export async function sendDue(store, env, { limit = 200 } = {}) {
  const minute = Math.floor(Date.now() / 60000);
  const keys = await store.list('due:', limit);
  const subject = env.PUSH_CONTACT || env.APP_URL || 'mailto:admin@example.com';
  let sent = 0;
  let vapid = null;
  for (const key of keys) {
    const at = +key.split(':')[1];
    if (at > minute) break;
    const ref = await store.get(key);
    await store.delete(key);
    const rec = ref && await store.get(`push:${ref.sid}`);
    const r = rec && rec.reminders.find((x) => x.id === ref.id);
    // Nur senden, wenn es nicht schon über eine halbe Stunde zu spät ist
    if (!r || at < minute - 30) continue;
    vapid = vapid || await vapidKeys(store);
    try {
      const res = await sendPush(rec.subscription, { title: r.title, body: r.body, tag: r.tag, url: r.url, join: r.join, joinLabel: r.joinLabel, lang: r.lang }, vapid, subject);
      if (res.status === 404 || res.status === 410) {
        // Abo gibt es nicht mehr (z. B. Benachrichtigungen im Browser abgeschaltet)
        await dropDue(store, rec);
        await store.delete(`push:${ref.sid}`);
      } else if (res.ok) sent += 1;
      else console.error('Push:', res.status, await res.text().catch(() => ''));
    } catch (e) {
      console.error('Push:', e.message);
    }
  }
  return sent;
}
