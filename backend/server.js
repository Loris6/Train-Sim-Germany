/*
 * Train Sim Germany – Backend mit Node.js (ab Version 20)
 *
 *   cp .env.example .env    # Werte eintragen
 *   node server.js          # läuft auf http://localhost:8787
 *
 * Daten (Profile, Privatsphäre, Erinnerungen) liegen in data/store.json.
 * Fällige Benachrichtigungen werden jede Minute verschickt.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import { handle, sendDue } from './app.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const DIR = path.dirname(fileURLToPath(import.meta.url));

// .env lesen: KEY=wert, Zeilen mit # sind Kommentare. Echte Umgebungsvariablen haben Vorrang.
function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  });
  return out;
}
const env = { ...readEnv(path.join(DIR, '.env')), ...process.env };

// Einfacher Speicher in einer JSON-Datei
function fileStore(file) {
  let data = {};
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* neu */ }
  const save = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(data));
    fs.renameSync(`${file}.tmp`, file);
  };
  return {
    async get(key) {
      const e = data[key];
      if (!e) return null;
      if (e.exp && e.exp < Date.now()) { delete data[key]; save(); return null; }
      return structuredClone(e.v);
    },
    async put(key, v, { ttl } = {}) { data[key] = { v: structuredClone(v), exp: ttl ? Date.now() + ttl * 1000 : 0 }; save(); },
    async delete(key) { delete data[key]; save(); },
    async list(prefix, limit = 1000) {
      return Object.keys(data).filter((k) => k.startsWith(prefix) && !(data[k].exp && data[k].exp < Date.now())).sort().slice(0, limit);
    },
  };
}
const store = fileStore(path.resolve(DIR, env.DATA_FILE || 'data/store.json'));

const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > 200000) { res.writeHead(413).end(); return; }
      chunks.push(c);
    }
    const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const headers = new Headers();
    Object.entries(req.headers).forEach(([k, v]) => headers.set(k, Array.isArray(v) ? v.join(', ') : v));
    const request = new Request(`${proto}://${host}${req.url}`, {
      method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
    });
    const response = await handle(request, env, store);
    const out = {};
    response.headers.forEach((v, k) => { out[k] = v; });
    res.writeHead(response.status, out);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});
const port = +(env.PORT || 8787);
server.listen(port, () => {
  console.log(`Train Sim Germany Backend läuft auf http://localhost:${port}`);
  if (!env.ROBLOX_CLIENT_ID) console.log('Hinweis: ROBLOX_CLIENT_ID fehlt noch (.env) – ohne sie gibt es keine Anmeldung am Backend.');
});
// Benachrichtigungen für Trainings: jede Minute nachsehen, was fällig ist
setInterval(() => { sendDue(store, env).catch((e) => console.error(e)); }, 60000);
