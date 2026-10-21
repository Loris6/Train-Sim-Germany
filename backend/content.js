/*
 * Train Sim Germany – Inhalte aus der App: Trainings, Neuigkeiten, Bilder, Stellen (offen/geschlossen)
 *
 *   content:trainings  → [{ id, type, title, start, dur, server, slots, text, host, hostId }]
 *   content:news       → [{ id, date, cat, tag, title, text, media, buttons, author, authorId }]
 *   content:jobs       → { <stelle>: { open, from, to, closedAt, updatedBy } }
 *   media:<id>         → { type, data }   (Bilder für Neuigkeiten, als Base64)
 */
import { b64u, fromB64u, randomKey, clip } from './lib.js';
import { TRAINING_RANKS } from './ranks.js';

const bad = (msg = 'bad_request') => Object.assign(new Error(msg), { status: 400 });
const forbidden = () => Object.assign(new Error('forbidden'), { status: 403 });
const notFound = () => Object.assign(new Error('not_found'), { status: 404 });
const MAX_IMAGE = 1000000; // als Base64 unter 2 MB (Grenze pro Eintrag im Durable Object)

export async function getContent(store) {
  const [trainings, news, jobs] = await Promise.all([store.get('content:trainings'), store.get('content:news'), store.get('content:jobs')]);
  const now = Date.now();
  return {
    trainings: (trainings || []).filter((x) => x.start + x.dur * 60000 > now - 3600000),
    news: news || [],
    jobs: jobs || {},
  };
}

// Erlaubte Links: https (lokal zum Testen auch http://localhost)
function safeUrl(u, { optional = false } = {}) {
  const v = String(u || '').trim();
  if (!v && optional) return '';
  try {
    const url = new URL(v);
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol === 'https:' || (local && url.protocol === 'http:')) return url.toString();
  } catch (e) { /* ungültig */ }
  throw bad('bad_url');
}

// ---------- Trainings (ab Supervisor) ----------
export async function addTraining(store, user, body) {
  const type = String(body.type || '');
  if (!TRAINING_RANKS.includes(type)) throw bad('bad_type');
  const start = +body.start;
  const now = Date.now();
  if (!Number.isFinite(start) || start < now - 3600000 || start > now + 60 * 86400000) throw bad('bad_time');
  const dur = Math.round(+body.dur);
  const slots = Math.round(+body.slots);
  if (!(dur >= 15 && dur <= 240) || !(slots >= 1 && slots <= 50)) throw bad();
  const training = {
    id: randomKey(9), type, title: clip(body.title, 80).trim() || `${type}-Training`, start, dur, slots,
    server: clip(body.server, 60).trim(), text: clip(body.text, 500).trim(),
    host: user.username, hostId: user.sub, created: now,
  };
  const list = ((await store.get('content:trainings')) || []).filter((x) => x.start + x.dur * 60000 > now - 86400000);
  if (list.length >= 200) throw bad('too_many');
  list.push(training);
  list.sort((a, b) => a.start - b.start);
  await store.put('content:trainings', list);
  return training;
}
export async function deleteTraining(store, user, id) {
  const list = (await store.get('content:trainings')) || [];
  const item = list.find((x) => x.id === id);
  if (!item) throw notFound();
  if (item.hostId !== user.sub) throw forbidden();
  await store.put('content:trainings', list.filter((x) => x.id !== id));
}

// ---------- Neuigkeiten (ab Public Relations Department) ----------
const BUTTON_TYPES = ['discord', 'youtube', 'roblox', 'link'];
const isYouTube = (u) => /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))[\w-]{11}/.test(u);
export async function addNews(store, user, body) {
  const title = clip(body.title, 120).trim();
  const text = clip(body.text, 4000).trim();
  if (!title || !text) throw bad('missing');
  const cat = ['update', 'event', 'community'].includes(body.cat) ? body.cat : 'update';
  const m = body.media || {};
  if (!['image', 'video'].includes(m.type)) throw bad('media_type');
  const media = { type: m.type, url: safeUrl(m.url) };
  if (m.type === 'video' && !isYouTube(media.url) && !/\.(mp4|webm|m4v)(\?|$)/i.test(media.url)) throw bad('video_url');
  if (m.poster) media.poster = safeUrl(m.poster);
  if (m.mediaId && /^[\w-]{8,40}$/.test(m.mediaId) && media.url.includes(`/media/${m.mediaId}`)) media.mediaId = m.mediaId;
  const buttons = (Array.isArray(body.buttons) ? body.buttons : []).slice(0, 2).map((b) => {
    if (!BUTTON_TYPES.includes(b.type)) throw bad('button_type');
    return { type: b.type, label: clip(b.label, 40).trim(), url: safeUrl(b.url) };
  });
  const item = {
    id: randomKey(9), date: new Date().toISOString(), cat, tag: clip(body.tag, 30).trim(), title, text, media, buttons,
    author: user.username, authorId: user.sub,
  };
  const list = (await store.get('content:news')) || [];
  list.unshift(item);
  await store.put('content:news', list.slice(0, 100));
  return item;
}
export async function deleteNews(store, user, id) {
  const list = (await store.get('content:news')) || [];
  const item = list.find((x) => x.id === id);
  if (!item) throw notFound();
  if (item.authorId !== user.sub) throw forbidden();
  if (item.media && item.media.mediaId) await store.delete(`media:${item.media.mediaId}`);
  await store.put('content:news', list.filter((x) => x.id !== id));
}

// ---------- Bilder ----------
export async function saveMedia(store, req) {
  const type = (req.headers.get('Content-Type') || '').split(';')[0].trim();
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type)) throw bad('image_type');
  const buf = new Uint8Array(await req.arrayBuffer());
  if (!buf.length || buf.length > MAX_IMAGE) throw Object.assign(new Error('too_large'), { status: 413 });
  const id = randomKey(12);
  await store.put(`media:${id}`, { type, data: b64u(buf) });
  return id;
}
export async function mediaResponse(store, id) {
  const m = /^[\w-]{8,40}$/.test(id) && await store.get(`media:${id}`);
  if (!m) return new Response('Nicht gefunden', { status: 404 });
  return new Response(fromB64u(m.data), { headers: { 'Content-Type': m.type, 'Cache-Control': 'public, max-age=31536000, immutable', 'Access-Control-Allow-Origin': '*' } });
}

// ---------- Stellen: offen/geschlossen und Zeitraum (ab Public Relations Department) ----------
export const jobOpenAt = (state, at) => {
  if (!state) return true;
  if (state.from && at < state.from) return false;
  if (state.to && at > state.to) return false;
  return state.open !== false || (state.closedAt && at < state.closedAt);
};
export async function setJob(store, user, id, body) {
  if (!/^[a-z0-9-]{2,40}$/.test(id)) throw bad();
  const jobs = (await store.get('content:jobs')) || {};
  const old = jobs[id] || {};
  const open = body.open !== false;
  const from = body.from ? +body.from : null;
  const to = body.to ? +body.to : null;
  if ((from && !Number.isFinite(from)) || (to && !Number.isFinite(to)) || (from && to && to <= from)) throw bad('bad_time');
  jobs[id] = {
    open, from, to,
    // Wer vor dem Schließen angefangen hat, darf noch absenden
    closedAt: !open ? (old.open === false ? old.closedAt : Date.now()) : null,
    updatedBy: user.username, updated: Date.now(),
  };
  await store.put('content:jobs', jobs);
  return jobs[id];
}
