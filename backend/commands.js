/*
 * Train Sim Germany – Befehle im Chat (z. B. /GetGroupData)
 *
 * Die Antwort schreibt der „TSG-Bot“ ins Gespräch – mit Daten aus der Roblox-Gruppe, aus dem Spiel
 * (Server und Spieler über das Skript game/TSGAppSync.server.lua) und aus der App.
 * Persönliche Antworten (z. B. /Coins) und Fehler sieht nur, wer gefragt hat.
 * In Gruppen legen Inhaber und Admins fest, ob Befehle erlaubt sind, für wen und welche.
 */
import { liveStats } from './stats.js';
import { getContent } from './content.js';
import { walletView } from './shop.js';
import { findPlayer, groupRole, namesOf, robloxUrl, groupIdOf } from './roblox.js';
import { rankLabel, matchRank, atLeast } from './ranks.js';

export const COMMANDS = [
  { id: 'help', usage: '/help', desc: 'Alle Befehle in diesem Chat' },
  { id: 'rules', usage: '/rules', desc: 'Regeln dieses Chats' },
  { id: 'getgroupdata', usage: '/GetGroupData', desc: 'Roblox-Gruppe: Mitglieder und Ränge' },
  { id: 'getuser', usage: '/GetUser <Name>', desc: 'Roblox-Profil, Rang und ob jemand im Spiel ist' },
  { id: 'getrank', usage: '/GetRank <Name>', desc: 'Rang eines Spielers in der Gruppe' },
  { id: 'getservers', usage: '/GetServers', desc: 'Laufende Server im Spiel' },
  { id: 'getonline', usage: '/GetOnline', desc: 'Wer gerade im Spiel ist' },
  { id: 'getstats', usage: '/GetStats', desc: 'Spieler, Besuche, Favoriten, Discord' },
  { id: 'gettrainings', usage: '/GetTrainings', desc: 'Die nächsten Trainings' },
  { id: 'coins', usage: '/Coins', desc: 'Deine Coins und Züge aus dem Spiel (nur du siehst die Antwort)' },
];
export const COMMAND_IDS = COMMANDS.map((c) => c.id);
const ALIAS = { hilfe: 'help', befehle: 'help', regeln: 'rules', server: 'getservers', online: 'getonline', stats: 'getstats', trainings: 'gettrainings', user: 'getuser', rank: 'getrank', group: 'getgroupdata', gruppe: 'getgroupdata' };

const num = (n) => (Number.isFinite(n) ? n.toLocaleString('de-DE') : '–');
const when = (ms, opts = { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', ...opts }).format(new Date(ms));
const SERVER_FRESH = 3 * 60000;

// Server, die sich in den letzten 3 Minuten aus dem Spiel gemeldet haben
export async function liveServers(store) {
  const all = (await store.get('game:servers')) || {};
  const t = Date.now();
  return Object.entries(all).filter(([, s]) => t - s.at < SERVER_FRESH).map(([jobId, s]) => ({ jobId, ...s }));
}

// Text in Befehl und Argument zerlegen: „/GetUser Max“ → { id: 'getuser', arg: 'Max' }
export function parseCommand(text) {
  const m = String(text || '').trim().match(/^\/([A-Za-z]+)(?:\s+(.{0,60}))?$/);
  if (!m) return null;
  const name = m[1].toLowerCase();
  const id = COMMAND_IDS.includes(name) ? name : ALIAS[name] || null;
  return { id, name: m[1], arg: (m[2] || '').trim() };
}

export async function runCommand(store, env, user, c, cmd, enabled) {
  const only = (title, text, rows = []) => ({ title, text, rows, only: user.sub });
  if (!cmd.id) return only('Unbekannter Befehl', `„/${cmd.name}“ gibt es nicht. Mit /help siehst du alle Befehle.`);
  if (!enabled.includes(cmd.id)) return only('Befehl ausgeschaltet', `/${cmd.name} ist in diesem Chat nicht erlaubt.`);
  switch (cmd.id) {
    case 'help':
      return { title: 'Befehle in diesem Chat', rows: COMMANDS.filter((x) => enabled.includes(x.id)).map((x) => [x.usage, x.desc]) };
    case 'rules':
      return { title: 'Regeln', text: c.rules || 'Für diesen Chat gibt es keine eigenen Regeln. Bitte bleib freundlich und fair.' };
    case 'getgroupdata': {
      const s = await liveStats(store, env, robloxUrl);
      const roles = (s.roles || []).filter((r) => r.rank > 0 && !/^[-–\s]+$/.test(r.name)).sort((a, b) => b.rank - a.rank);
      const team = roles.filter((r) => atLeast(matchRank(r), 'Supervisor')).reduce((n, r) => n + (r.memberCount || 0), 0);
      return {
        title: 'Roblox-Gruppe Train Sim Germany',
        rows: [['Gruppen-ID', groupIdOf(env)], ['Mitglieder', num(s.groupMembers)], ['Team ab Supervisor', num(team)],
          ...roles.slice(0, 12).map((r) => [r.name, num(r.memberCount)])],
      };
    }
    case 'getuser':
    case 'getrank': {
      if (!cmd.arg) return only('Name fehlt', `So geht es: /${cmd.id === 'getuser' ? 'GetUser' : 'GetRank'} Roblox-Name`);
      let p;
      try { p = await findPlayer(env, cmd.arg); } catch (e) { p = null; }
      if (!p) return only('Nicht gefunden', `Den Roblox-Namen „${cmd.arg}“ gibt es nicht.`);
      let role = null;
      try { role = await groupRole(env, p.userId); } catch (e) { /* unbekannt */ }
      const rank = role ? `${rankLabel(role.app)}${role.name && !role.name.includes(role.app) ? ` (${role.name})` : ''}` : 'Nicht in der Gruppe';
      if (cmd.id === 'getrank') return { title: `${p.displayName} (@${p.username})`, avatar: p.avatar, rows: [['Rang', rank]] };
      const server = (await liveServers(store)).find((s) => (s.online || []).includes(p.userId));
      return {
        title: `${p.displayName} (@${p.username})`, avatar: p.avatar,
        rows: [['Roblox-ID', p.userId], ['Konto seit', p.created ? when(Date.parse(p.created), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–'],
          ['Rang', rank], ['Im Spiel', server ? `Ja – Server ${server.jobId.slice(0, 8)}` : 'Nein']],
      };
    }
    case 'getservers': {
      const list = await liveServers(store);
      if (!list.length) return { title: 'Server im Spiel', text: 'Gerade meldet sich kein Server. Läuft das Skript TSGAppSync im Spiel?' };
      return {
        title: `Server im Spiel · ${list.length}`,
        rows: list.sort((a, b) => b.players - a.players).slice(0, 15).map((s) => [`${s.private ? 'Privat' : 'Server'} ${s.jobId.slice(0, 8)}`, `${s.players}/${s.max} Spieler${s.version ? ` · v${s.version}` : ''}`]),
      };
    }
    case 'getonline': {
      const ids = [...new Set((await liveServers(store)).flatMap((s) => s.online || []))];
      const s = await liveStats(store, env, robloxUrl);
      let names = [];
      try { names = await namesOf(env, ids.slice(0, 40)); } catch (e) { /* ohne Namen */ }
      return {
        title: `Im Spiel: ${num(Number.isFinite(s.playing) ? s.playing : ids.length)}`,
        text: names.length ? names.map((u) => `@${u.username}`).join(', ') + (ids.length > names.length ? ` und ${ids.length - names.length} weitere` : '') : 'Die Namen kommen, sobald ein Server über TSGAppSync meldet.',
      };
    }
    case 'getstats': {
      const s = await liveStats(store, env, robloxUrl);
      return {
        title: 'Train Sim Germany in Zahlen',
        rows: [['Spieler online', num(s.playing)], ['Besuche', num(s.visits)], ['Favoriten', num(s.favorites)], ['Gruppe', num(s.groupMembers)],
          ['Discord', `${num(s.discordMembers)} (${num(s.discordOnline)} online)`]],
      };
    }
    case 'gettrainings': {
      const list = (await getContent(store)).trainings.filter((x) => x.start > Date.now() - x.dur * 60000).slice(0, 6);
      if (!list.length) return { title: 'Nächste Trainings', text: 'Gerade ist kein Training geplant. Alle Termine stehen in der App unter Trainings.' };
      return { title: 'Nächste Trainings', rows: list.map((x) => [when(x.start), `${x.title} · ${x.hostName || x.host}`]) };
    }
    case 'coins': {
      const w = await walletView(store, user.sub);
      if (!w.syncedAt) return only('Deine Coins', 'Noch kein Stand aus dem Spiel. Spiel einmal Train Sim Germany, dann erscheinen deine Coins hier.');
      return only('Deine Coins', '', [['Coins', num(w.coins)], ['Verfügbar', num(w.available)], ['Züge', String(w.trains.length)], ['Strecken', String(w.routes.length)], ['Stand', when(w.syncedAt)]]);
    }
    default:
      return only('Unbekannter Befehl', 'Mit /help siehst du alle Befehle.');
  }
}
