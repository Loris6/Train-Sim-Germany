/*
 * Train Sim Germany – Profil wie in Messenger-Apps: Banner, Status, Pronomen, Über mich, Akzentfarbe
 *
 *   user.profile      → { status, pronouns, bio, accent, banner (Zeitstempel oder null) }
 *   banner:<sub>      → Bannerbild (JPEG, in der App auf 1200 × 480 zugeschnitten, höchstens 600 KB)
 *
 * Andere sehen das Profil nur, wenn es unter „Privatsphäre“ öffentlich ist (siehe GET /api/players/<id>).
 */
import { clip } from './lib.js';

const bad = (msg = 'bad_request', status = 400) => Object.assign(new Error(msg), { status });
const line = (v, n) => clip(String(v || ''), n).replace(/[\r\n\t]+/g, ' ').trim();

export function profileOf(user) {
  const p = user.profile || {};
  return {
    status: p.status || '', pronouns: p.pronouns || '', bio: p.bio || '', accent: p.accent || null,
    banner: p.banner || null, since: user.created || user.firstLogin || null,
  };
}
export function updateProfile(user, body = {}) {
  const p = { ...(user.profile || {}) };
  if (body.status !== undefined) p.status = line(body.status, 80);
  if (body.pronouns !== undefined) p.pronouns = line(body.pronouns, 30);
  if (body.bio !== undefined) p.bio = clip(String(body.bio || ''), 600).replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (body.accent !== undefined) p.accent = /^#[0-9a-fA-F]{6}$/.test(body.accent || '') ? body.accent.toUpperCase() : null;
  user.profile = p;
  return profileOf(user);
}
export async function setBanner(store, user, req) {
  const p = { ...(user.profile || {}) };
  if (req.method === 'DELETE') {
    await store.delete(`banner:${user.sub}`);
    p.banner = null;
  } else {
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length > 600000) throw bad('too_large', 413);
    if (!(bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF)) throw bad('bad_type', 415);
    await store.put(`banner:${user.sub}`, bytes);
    p.banner = Date.now();
  }
  user.profile = p;
  return profileOf(user);
}
export async function bannerResponse(store, sub, headers = {}) {
  const bytes = /^\d{1,20}$/.test(sub) && await store.get(`banner:${sub}`);
  if (!bytes) return new Response('not found', { status: 404, headers });
  return new Response(bytes, {
    headers: { ...headers, 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=604800, immutable', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'cross-origin' },
  });
}
