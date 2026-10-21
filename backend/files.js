/*
 * Train Sim Germany – Dateien im Chat: Fotos, Videos, PDFs (z. B. Beweise für Meldungen)
 *
 * Hochladen in Stücken zu 1 MB, damit auch große Videos durchgehen:
 *   1. POST /api/chats/<id>/files   { name, type, size, w, h }  → { id, chunk, chunks }
 *   2. PUT  /api/files/<id>/<n>     Bytes des n-ten Stücks (0, 1, 2, …)
 *   3. Nachricht mit { files: [id, …] } senden – erst dann gehört die Datei zum Gespräch
 * Nicht verschickte Dateien verfallen nach einem Tag.
 *
 * Abrufen: GET /api/files/<id>?c=<gespräch>&e=<ablauf>&s=<signatur>. Den Link bekommt nur, wer das Gespräch sehen darf;
 * er gilt bis Ende des nächsten Tages. Videos lassen sich vorspulen (Range).
 *
 *   file:<id>     → { id, chat, owner, name, type, kind, size, chunks, got, w, h, at, attached, expires }
 *   blob:<id>:<n> → Bytes (eigener Bereich, damit das Aufräumen nie alle Videos auf einmal lädt)
 * Abgelaufene Dateien (nicht verschickt nach einem Tag, sonst nach 180 Tagen) löscht cleanupFiles().
 */
import { randomKey, clip } from './lib.js';
import { sign, verify } from './secret.js';

export const CHUNK = 1024 * 1024;
const MB = 1024 * 1024;
const KEEP = 180 * 86400;
const DAILY = 300 * MB; // pro Person und Tag
// Erlaubte Arten und Größe in MB (Fotos werden in der App vorher verkleinert)
const TYPES = {
  'image/jpeg': ['image', 15], 'image/png': ['image', 15], 'image/webp': ['image', 15], 'image/gif': ['image', 15],
  'video/mp4': ['video', 80], 'video/webm': ['video', 80], 'video/quicktime': ['video', 80],
  'application/pdf': ['file', 20], 'text/plain': ['file', 2],
};
const bad = (msg = 'bad_request', status = 400) => Object.assign(new Error(msg), { status });

export async function startUpload(store, user, chatId, body) {
  const type = String(body.type || '').toLowerCase();
  if (!TYPES[type]) throw bad('bad_type', 415);
  const [kind, maxMb] = TYPES[type];
  const size = Math.round(+body.size);
  if (!(size > 0)) throw bad('bad_size');
  if (size > maxMb * MB) throw bad('too_large', 413);
  const day = new Date().toISOString().slice(0, 10);
  const quota = (await store.get(`upload:${user.sub}`)) || {};
  const used = quota.day === day ? quota.bytes : 0;
  if (used + size > DAILY) throw bad('quota', 429);
  await store.put(`upload:${user.sub}`, { day, bytes: used + size }, { ttl: 2 * 86400 });
  const meta = {
    id: randomKey(12), chat: chatId, owner: user.sub, name: clip(body.name, 120).replace(/[\\/\r\n"]/g, '_') || 'datei', type, kind, size,
    chunks: Math.ceil(size / CHUNK), got: [], at: Date.now(), attached: false, expires: Date.now() + 86400000,
    w: Math.round(+body.w) || null, h: Math.round(+body.h) || null,
  };
  await store.put(`file:${meta.id}`, meta);
  return { id: meta.id, chunk: CHUNK, chunks: meta.chunks };
}

// Gültige Datei (abgelaufene gelten als gelöscht)
async function getMeta(store, id) {
  const meta = /^[\w-]{10,30}$/.test(id) && await store.get(`file:${id}`);
  return meta && meta.expires > Date.now() ? meta : null;
}

export async function putChunk(store, user, id, n, req) {
  const meta = await getMeta(store, id);
  if (!meta || meta.owner !== user.sub || meta.attached) throw bad('not_found', 404);
  if (!(n >= 0 && n < meta.chunks)) throw bad('bad_chunk');
  const bytes = new Uint8Array(await req.arrayBuffer());
  const want = n === meta.chunks - 1 ? meta.size - n * CHUNK : CHUNK;
  if (bytes.length !== want) throw bad('bad_length');
  await store.put(`blob:${id}:${n}`, bytes);
  if (!meta.got.includes(n)) meta.got.push(n);
  await store.put(`file:${id}`, meta);
  return { got: meta.got.length, chunks: meta.chunks };
}

// Fertig hochgeladene Dateien an eine Nachricht hängen
export async function attachFiles(store, user, chatId, ids) {
  const list = (Array.isArray(ids) ? ids : []).slice(0, 10).map(String);
  const out = [];
  for (const id of list) {
    const meta = await getMeta(store, id);
    if (!meta || meta.owner !== user.sub || meta.chat !== chatId || meta.attached) throw bad('file_missing');
    if (meta.got.length !== meta.chunks) throw bad('file_incomplete', 409);
    meta.attached = true;
    meta.expires = Date.now() + KEEP * 1000;
    await store.put(`file:${id}`, meta);
    out.push({ id: meta.id, kind: meta.kind, type: meta.type, name: meta.name, size: meta.size, w: meta.w, h: meta.h });
  }
  return out;
}

export async function deleteFiles(store, files) {
  for (const f of files || []) {
    const meta = await store.get(`file:${f.id}`);
    const chunks = meta ? meta.chunks : Math.ceil((f.size || 0) / CHUNK);
    for (let n = 0; n < chunks; n++) await store.delete(`blob:${f.id}:${n}`);
    await store.delete(`file:${f.id}`);
  }
}
// Abgelaufene Dateien samt Bytes löschen (Zeitplan im Worker bzw. stündlich in server.js)
export async function cleanupFiles(store) {
  const t = Date.now();
  let n = 0;
  for (const key of await store.list('file:', 5000)) {
    const meta = await store.get(key);
    if (meta && meta.expires < t) { await deleteFiles(store, [meta]); n += 1; }
  }
  return n;
}

// Signierte Links für ein Gespräch (eine Signatur für alle Dateien, gültig bis Ende des nächsten Tages)
const sigCache = new Map();
export async function fileLinks(env, store, chatId) {
  const e = (Math.floor(Date.now() / 86400000) + 2) * 86400;
  const key = `${chatId}:${e}`;
  if (!sigCache.has(key)) {
    if (sigCache.size > 500) sigCache.clear();
    sigCache.set(key, await sign(env, store, `files:${chatId}:${e}`));
  }
  const s = sigCache.get(key);
  return (id) => `/api/files/${id}?c=${encodeURIComponent(chatId)}&e=${e}&s=${s}`;
}

// Datei ausliefern (mit Range für Videos)
export async function fileResponse(req, env, store, id, url, headers = {}) {
  const chatId = url.searchParams.get('c') || '';
  const e = +url.searchParams.get('e') || 0;
  if (e * 1000 < Date.now() || !await verify(env, store, `files:${chatId}:${e}`, url.searchParams.get('s') || '')) return new Response('forbidden', { status: 403, headers });
  const meta = await getMeta(store, id);
  if (!meta || !meta.attached || meta.chat !== chatId) return new Response('not found', { status: 404, headers });
  let start = 0;
  let end = meta.size - 1;
  let status = 200;
  const range = (req.headers.get('Range') || '').match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    if (range[1]) { start = +range[1]; end = range[2] ? Math.min(+range[2], meta.size - 1) : meta.size - 1; } else { start = Math.max(0, meta.size - +range[2]); }
    if (start > end || start >= meta.size) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${meta.size}` } });
    status = 206;
  }
  const first = Math.floor(start / CHUNK);
  const last = Math.floor(end / CHUNK);
  let n = first;
  const body = new ReadableStream({
    async pull(ctrl) {
      if (n > last) { ctrl.close(); return; }
      const bytes = await store.get(`blob:${id}:${n}`);
      if (!bytes) { ctrl.error(new Error('missing chunk')); return; }
      const from = n === first ? start - n * CHUNK : 0;
      const to = n === last ? end - n * CHUNK + 1 : bytes.length;
      ctrl.enqueue(bytes.subarray(from, to));
      n += 1;
    },
  });
  const inline = meta.kind !== 'file';
  return new Response(body, {
    status,
    headers: {
      ...headers,
      'Content-Type': meta.type,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
      ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${meta.size}` } : {}),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  });
}
