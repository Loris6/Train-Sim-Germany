/*
 * Train Sim Germany – Server-Chats mit Discord verbinden
 *
 * Wer einen Server-Chat leitet (Inhaber, Admins, Rolle mit „Gruppe verwalten“), kann ihn mit dem eigenen Discord
 * verbinden – per Webhook (einfach: Link aus Discord → Kanal → Integrationen) oder mit einem eigenen Bot
 * (Bot-Token und Kanal-ID). Dann erscheinen die Nachrichten aus dem Server-Chat auch in Discord, und eigene
 * Automationen schreiben z. B. „Willkommen {username} auf {server}“, wenn jemand beitritt.
 *
 * Bevor etwas nach Discord geht, prüft das Team (Ränge über Public Relations Department) die Verbindung:
 *   draft → pending (eingereicht) → active (angenommen) oder denied (abgelehnt)
 * Voraussetzungen zum Einreichen: Server-Chat, eigene Regeln, mindestens eine eigene Rolle mit Mitglied,
 * eine geprüfte Verbindung zu Discord.
 *
 * Webhook-Links und Bot-Tokens liegen nur verschlüsselt im Backend (secret.js) und gehen nie zurück an die App.
 * Nach Discord gehen keine Erwähnungen (@everyone usw.), nur Text.
 */
import { clip, randomKey } from './lib.js';
import { sealText, openText } from './secret.js';

const bad = (msg = 'bad_request', status = 400) => Object.assign(new Error(msg), { status });

// Wer Verbindungen prüft: über Public Relations Department
export const REVIEW_RANK = 'Project Engineer';
export const TRIGGERS = ['join', 'leave', 'game_join', 'game_leave'];
const TARGETS = ['discord', 'chat', 'both'];
const MAX_AUTOMATIONS = 10;
const HOOK = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/(\d{5,25})\/([\w-]{20,120})\/?$/;
const TOKEN = /^[\w-]{20,40}\.[\w-]{4,12}\.[\w-]{20,80}$/;
const CHANNEL = /^\d{5,25}$/;

const apiBase = (env) => (env.DISCORD_API_URL || 'https://discord.com/api/v10').replace(/\/+$/, '');
const hookBase = (env) => (env.DISCORD_WEBHOOKS_URL || 'https://discord.com/api/webhooks').replace(/\/+$/, '');

async function call(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(6000) });
}
// Namen, die Discord für Webhooks nicht erlaubt
const hookName = (v) => clip(String(v || '').replace(/discord|clyde/gi, '').replace(/\s+/g, ' ').trim(), 80) || 'TSG';

// Platzhalter in Automationen: {username}, {displayName}, {server}, {chat}, {players}, {members}
export function renderTemplate(tpl, vars) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m)).slice(0, 1900);
}

function cleanAutomations(list) {
  return (Array.isArray(list) ? list : []).slice(0, MAX_AUTOMATIONS).map((a) => ({
    id: /^[\w-]{4,16}$/.test(String((a && a.id) || '')) ? a.id : randomKey(6),
    trigger: TRIGGERS.includes(a && a.trigger) ? a.trigger : 'join',
    target: TARGETS.includes(a && a.target) ? a.target : 'discord',
    template: clip(String((a && a.template) || '').replace(/\r/g, ''), 500).trim(),
    on: !(a && a.on === false),
  })).filter((a) => a.template);
}

// Verbindung zu Discord prüfen (und Name von Webhook bzw. Bot und Kanal merken)
async function verify(env, mode, secret, channel) {
  try {
    if (mode === 'webhook') {
      const res = await call(`${hookBase(env)}/${secret}`);
      if (!res.ok) return null;
      const h = await res.json();
      return { name: clip(h.name || 'Webhook', 80), channel: String(h.channel_id || ''), guild: String(h.guild_id || '') };
    }
    const auth = { Authorization: `Bot ${secret}` };
    const me = await call(`${apiBase(env)}/users/@me`, { headers: auth });
    if (!me.ok) return null;
    const bot = await me.json();
    const ch = await call(`${apiBase(env)}/channels/${channel}`, { headers: auth });
    if (!ch.ok) return null;
    const c = await ch.json();
    return { name: clip(bot.username || 'Bot', 80), channel: clip(c.name || channel, 100), guild: String(c.guild_id || '') };
  } catch (e) {
    return null;
  }
}

// Einstellungen speichern. Neue Zugangsdaten werden geprüft; ändert sich die Verbindung, muss sie neu eingereicht werden.
export async function updateConfig(env, store, old, body) {
  const d = { status: 'draft', mode: 'webhook', events: { messages: true, joins: true }, automations: [], botName: 'TSG-Bot', ...(old || {}) };
  let changed = false;
  if (['webhook', 'bot'].includes(body.mode) && body.mode !== d.mode) { d.mode = body.mode; changed = true; }
  if (body.botName !== undefined) d.botName = hookName(body.botName);
  if (body.events && typeof body.events === 'object') {
    d.events = { messages: body.events.messages !== false, joins: body.events.joins !== false };
  }
  if (body.automations !== undefined) d.automations = cleanAutomations(body.automations);
  if (d.mode === 'webhook' && body.webhook) {
    const m = String(body.webhook).trim().match(HOOK);
    if (!m) throw bad('bad_webhook');
    const info = await verify(env, 'webhook', `${m[1]}/${m[2]}`);
    if (!info) throw bad('webhook_unreachable', 422);
    d.hook = await sealText(env, store, `${m[1]}/${m[2]}`);
    d.hookHint = `…/webhooks/${m[1].slice(-4)}/••••`;
    d.info = info;
    delete d.token;
    changed = true;
  }
  if (d.mode === 'bot' && (body.token || body.channel)) {
    const channel = String(body.channel || d.channel || '').trim();
    if (!CHANNEL.test(channel)) throw bad('bad_channel');
    const token = body.token ? String(body.token).trim() : await openText(env, store, d.token);
    if (!token || !TOKEN.test(token)) throw bad('bad_token');
    const info = await verify(env, 'bot', token, channel);
    if (!info) throw bad('bot_unreachable', 422);
    d.token = await sealText(env, store, token);
    d.tokenHint = `${token.slice(0, 4)}••••`;
    d.channel = channel;
    d.info = info;
    delete d.hook;
    changed = true;
  }
  // Neue Verbindung: wieder Entwurf (angenommene Verbindungen müssen neu geprüft werden)
  if (changed && d.status !== 'draft') {
    d.status = 'draft';
    d.reviewedBy = null;
    d.reviewedAt = null;
    d.reason = '';
  }
  d.verified = !!(d.info && ((d.mode === 'webhook' && d.hook) || (d.mode === 'bot' && d.token && d.channel)));
  return d;
}

// Voraussetzungen zum Einreichen
export function requirements(c) {
  const d = c.discord || {};
  const roles = c.roles || [];
  const used = Object.values(c.members || {}).some((p) => (p.roles || []).some((r) => roles.some((x) => x.id === r)));
  return [
    { id: 'server', ok: c.kind === 'group' && c.category === 'server', text: 'Server-Chat (mit einem privaten Server verbunden oder als Server-Chat erstellt)' },
    { id: 'rules', ok: String(c.rules || '').trim().length >= 20, text: 'Eigene Regeln (mindestens 20 Zeichen)' },
    { id: 'roles', ok: roles.length > 0 && used, text: 'Mindestens eine eigene Rolle, die jemand hat' },
    { id: 'connection', ok: !!d.verified, text: 'Geprüfte Verbindung zu Discord (Webhook oder Bot)' },
  ];
}

// Für die App: ohne Zugangsdaten
export function publicView(c) {
  const d = c.discord;
  if (!d) return { status: 'none', requirements: requirements(c) };
  return {
    status: d.status, mode: d.mode, botName: d.botName, events: d.events, automations: d.automations,
    hint: d.mode === 'webhook' ? d.hookHint || null : d.tokenHint || null, channel: d.channel || null, info: d.info || null,
    verified: !!d.verified, requestedBy: d.requestedBy || null, requestedAt: d.requestedAt || null,
    reviewedBy: d.reviewedBy || null, reviewedAt: d.reviewedAt || null, reason: d.reason || '', lastError: d.lastError || null,
    requirements: requirements(c),
  };
}

// Text nach Discord schicken (Webhook mit Name und Bild des Absenders, Bot mit Namen vor dem Text)
export async function sendToDiscord(env, store, d, { username, avatar, content }) {
  if (!d || !content) return false;
  const text = clip(content, 1900);
  try {
    let res;
    if (d.mode === 'webhook') {
      const secret = await openText(env, store, d.hook);
      if (!secret) return false;
      res = await call(`${hookBase(env)}/${secret}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, username: hookName(username || d.botName), ...(avatar ? { avatar_url: avatar } : {}), allowed_mentions: { parse: [] } }),
      });
    } else {
      const token = await openText(env, store, d.token);
      if (!token || !d.channel) return false;
      res = await call(`${apiBase(env)}/channels/${d.channel}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bot ${token}` },
        body: JSON.stringify({ content: username ? clip(`**${String(username).replace(/[*_~`|]/g, '')}:** ${text}`, 2000) : text, allowed_mentions: { parse: [] } }),
      });
    }
    d.lastError = res.ok ? null : { at: Date.now(), status: res.status };
    return res.ok;
  } catch (e) {
    d.lastError = { at: Date.now(), status: 0 };
    return false;
  }
}
