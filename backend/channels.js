/*
 * Train Sim Germany – Kanäle und Kategorien in Servern (Communities), wie bei Discord
 *
 * Ein Server ist ein Gruppen-Chat mit category: 'server'. Er hat Kategorien und Kanäle; jede Nachricht gehört zu einem Kanal.
 *
 *   chat.categories → [{ id, name }]                       Reihenfolge = Anzeige
 *   chat.channels   → [{ id, name, cat, kind, topic }]      kind: text | news (Ankündigungen: schreiben nur Inhaber, Admins
 *                                                            und Rollen mit „Schreiben“)
 *   chat.home       → Standardkanal: Begrüßungen, Systemnachrichten, Weitergabe ins Spiel und nach Discord
 *   Nachricht.ch    → Kanal der Nachricht (fehlt = Standardkanal, z. B. bei älteren Nachrichten)
 *
 * Grenzen: 10 Kategorien, 30 Kanäle, je Kanal die letzten 200 Nachrichten, insgesamt 1500.
 */
import { clip, randomKey } from './lib.js';

export const MAX_CATEGORIES = 10;
export const MAX_CHANNELS = 30;
export const PER_CHANNEL = 200;
export const MAX_TOTAL = 1500;
export const KINDS = ['text', 'news'];

const bad = (msg = 'bad_request', status = 400) => Object.assign(new Error(msg), { status });
export const isCommunity = (c) => !!c && c.kind === 'group' && c.category === 'server';

// Neue Server starten mit diesen Kanälen
export function defaultLayout() {
  return {
    categories: [{ id: 'info', name: 'Information' }, { id: 'talk', name: 'Textkanäle' }],
    channels: [
      { id: 'willkommen', name: 'willkommen', cat: 'info', kind: 'news', topic: 'Schön, dass du da bist! Hier stehen die wichtigsten Infos.' },
      { id: 'ankuendigungen', name: 'ankündigungen', cat: 'info', kind: 'news', topic: 'Neuigkeiten für alle auf diesem Server' },
      { id: 'allgemein', name: 'allgemein', cat: 'talk', kind: 'text', topic: '' },
      { id: 'medien', name: 'medien', cat: 'talk', kind: 'text', topic: 'Fotos und Videos aus dem Spiel' },
      { id: 'befehle', name: 'befehle', cat: 'talk', kind: 'text', topic: 'Befehle wie /GetServers und eigene Bots' },
    ],
    home: 'allgemein',
  };
}

// Ältere Server ohne Kanäle: ein Kanal „allgemein“ mit allen bisherigen Nachrichten
const LEGACY = { categories: [], channels: [{ id: 'allgemein', name: 'allgemein', cat: null, kind: 'text', topic: '' }], home: 'allgemein' };
export function layoutOf(c) {
  if (!isCommunity(c)) return null;
  if (!Array.isArray(c.channels) || !c.channels.length) return LEGACY;
  const text = c.channels.find((x) => x.kind === 'text');
  const home = c.channels.some((x) => x.id === c.home) ? c.home : (text || c.channels[0]).id;
  return { categories: c.categories || [], channels: c.channels, home };
}
export const homeOf = (c) => { const l = layoutOf(c); return l ? l.home : null; };
export const channelOf = (c, m) => m.ch || homeOf(c);
export function findChannel(c, id) {
  const l = layoutOf(c);
  return l ? l.channels.find((x) => x.id === id) || null : null;
}
// Gewünschter Kanal oder der Standardkanal
export function pickChannel(c, id) {
  const l = layoutOf(c);
  if (!l) return null;
  return l.channels.find((x) => x.id === id) || l.channels.find((x) => x.id === l.home);
}

// Kanalname wie bei Discord: klein, Bindestriche statt Leerzeichen
export function cleanChannelName(v) {
  return clip(String(v || ''), 60).toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '')
    .replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
}
const cleanCatName = (v) => clip(String(v || ''), 30).replace(/\s+/g, ' ').trim();

// Neue Kanäle und Kategorien kommen aus der App mit vorläufigen IDs (z. B. „neu-1“); Verweise darauf werden übersetzt
export function cleanLayout(body, old) {
  const oldCats = new Set(old.categories.map((x) => x.id));
  const oldChs = new Set(old.channels.map((x) => x.id));
  const catIds = {};
  const categories = [];
  for (const x of (Array.isArray(body.categories) ? body.categories : []).slice(0, MAX_CATEGORIES)) {
    const name = cleanCatName(x && x.name);
    if (!name) continue;
    const want = String((x && x.id) || '');
    const id = oldCats.has(want) && !categories.some((k) => k.id === want) ? want : randomKey(6);
    catIds[want] = id;
    categories.push({ id, name });
  }
  const chIds = {};
  const channels = [];
  for (const x of (Array.isArray(body.channels) ? body.channels : []).slice(0, MAX_CHANNELS)) {
    const name = cleanChannelName(x && x.name);
    if (!name) continue;
    const want = String((x && x.id) || '');
    const id = oldChs.has(want) && !channels.some((k) => k.id === want) ? want : randomKey(6);
    chIds[want] = id;
    channels.push({
      id, name, cat: catIds[String((x && x.cat) || '')] || null,
      kind: KINDS.includes(x && x.kind) ? x.kind : 'text', topic: clip(String((x && x.topic) || ''), 200).replace(/\s+/g, ' ').trim(),
    });
  }
  if (!channels.length) throw bad('no_channels');
  const wanted = chIds[String(body.home || '')] || (channels.some((x) => x.id === old.home) ? old.home : null);
  const text = channels.find((x) => x.kind === 'text');
  return { categories, channels, home: wanted || (text || channels[0]).id };
}

// Alte Nachrichten löschen: je Kanal die letzten 200, insgesamt 1500 (Gruppen und Chats ohne Kanäle: die letzten 500)
export function pruneMessages(c, max = 500) {
  if (!isCommunity(c)) return c.messages.length > max ? c.messages.splice(0, c.messages.length - max) : [];
  const count = {};
  const drop = new Set();
  for (let i = c.messages.length - 1; i >= 0; i--) {
    const ch = channelOf(c, c.messages[i]);
    count[ch] = (count[ch] || 0) + 1;
    if (count[ch] > PER_CHANNEL) drop.add(i);
  }
  const keep = [];
  const gone = [];
  c.messages.forEach((m, i) => (drop.has(i) ? gone : keep).push(m));
  if (keep.length > MAX_TOTAL) gone.push(...keep.splice(0, keep.length - MAX_TOTAL));
  if (gone.length) c.messages = keep;
  return gone;
}
