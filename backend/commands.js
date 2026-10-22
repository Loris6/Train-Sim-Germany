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
  { id: 'getgroupdata', usage: '/GetGroupData', desc: 'Roblox-Gruppe: Mitglieder und alle Rollen' },
  { id: 'getuser', usage: '/GetUser <Name>', desc: 'Roblox-Profil, Rang und ob jemand im Spiel ist' },
  { id: 'getrank', usage: '/GetRank <Name>', desc: 'Rang eines Spielers in der Gruppe' },
  { id: 'isonline', usage: '/Online <Name>', desc: 'Ist jemand gerade im Spiel?' },
  { id: 'getservers', usage: '/GetServers', desc: 'Laufende Server im Spiel – mit „Beitreten“' },
  { id: 'getprivateservers', usage: '/GetPrivateServers', desc: 'Private Server dieses Chats – Stand und Beitreten' },
  { id: 'getonline', usage: '/GetOnline', desc: 'Wer gerade im Spiel ist' },
  { id: 'getstats', usage: '/GetStats', desc: 'Spieler, Besuche, Favoriten, Discord' },
  { id: 'gettrainings', usage: '/GetTrainings', desc: 'Die nächsten Trainings' },
  { id: 'getnews', usage: '/GetNews', desc: 'Die neuesten Neuigkeiten' },
  { id: 'getteam', usage: '/GetTeam', desc: 'Das Team ab Supervisor nach Rang' },
  { id: 'members', usage: '/Members', desc: 'Wer in diesem Chat ist' },
  { id: 'coins', usage: '/Coins', desc: 'Deine Coins und Züge aus dem Spiel (nur du siehst die Antwort)' },
  { id: 'play', usage: '/Play', desc: 'Spiel starten und Gruppe beitreten' },
  { id: 'discord', usage: '/Discord', desc: 'Zum Discord der Community' },
  { id: 'time', usage: '/Time', desc: 'Spielzeit (Uhrzeit in Deutschland)' },
  { id: 'roll', usage: '/Roll <Zahl>', desc: 'Würfeln (Standard 1–6)' },
  { id: 'ping', usage: '/Ping', desc: 'Ist der Bot da?' },
];
export const COMMAND_IDS = COMMANDS.map((c) => c.id);
// Befehle, die es seit der ersten Fassung gibt (für ältere Gruppen-Einstellungen)
export const FIRST_COMMANDS = ['help', 'rules', 'getgroupdata', 'getuser', 'getrank', 'getservers', 'getonline', 'getstats', 'gettrainings', 'coins'];
const ALIAS = {
  hilfe: 'help', befehle: 'help', regeln: 'rules', server: 'getservers', online: 'isonline', stats: 'getstats', trainings: 'gettrainings',
  user: 'getuser', rank: 'getrank', group: 'getgroupdata', gruppe: 'getgroupdata', getroles: 'getgroupdata', roles: 'getgroupdata', rollen: 'getgroupdata',
  privateserver: 'getprivateservers', privatserver: 'getprivateservers', news: 'getnews', team: 'getteam', mitglieder: 'members',
  spielen: 'play', zeit: 'time', uhrzeit: 'time', wuerfeln: 'roll', würfeln: 'roll', dice: 'roll',
};

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
  const m = String(text || '').trim().match(/^\/([A-Za-zÄÖÜäöüß]+)(?:\s+(.{0,60}))?$/);
  if (!m) return null;
  const name = m[1].toLowerCase();
  const id = COMMAND_IDS.includes(name) ? name : ALIAS[name] || null;
  return { id, name: m[1], arg: (m[2] || '').trim() };
}

// Knöpfe unter der Antwort: Links ins Spiel, zu Roblox, Discord oder in die App (#/…)
const links = (env) => {
  const place = String(env.ROBLOX_PLACE_ID || '140440792597921');
  return {
    game: `https://www.roblox.com/games/${place}`,
    group: `https://www.roblox.com/groups/${groupIdOf(env)}`,
    profile: (id) => `https://www.roblox.com/users/${id}/profile`,
    join: (jobId) => `https://www.roblox.com/games/start?placeId=${place}&gameInstanceId=${encodeURIComponent(jobId)}`,
    discord: `https://discord.gg/${env.DISCORD_INVITE || 'tvaSwbh3rE'}`,
  };
};
const btn = (label, url, icon = null, primary = false) => ({ label, url, icon, primary });

export async function runCommand(store, env, user, c, cmd, enabled) {
  const only = (title, text, rows = [], buttons = []) => ({ title, text, rows, buttons, only: user.sub });
  const L = links(env);
  if (!cmd.id) return only('Unbekannter Befehl', `„/${cmd.name}“ gibt es nicht. Mit /help siehst du alle Befehle.`);
  if (!enabled.includes(cmd.id)) return only('Befehl ausgeschaltet', `/${cmd.name} ist in diesem Chat nicht erlaubt.`);
  const player = async () => {
    let p = null;
    try { p = await findPlayer(env, cmd.arg); } catch (e) { p = null; }
    return p;
  };
  switch (cmd.id) {
    case 'help':
      return { title: 'Befehle in diesem Chat', rows: COMMANDS.filter((x) => enabled.includes(x.id)).map((x) => [x.usage, x.desc]) };
    case 'rules':
      return { title: 'Regeln', text: c.rules || 'Für diesen Chat gibt es keine eigenen Regeln. Bitte bleib freundlich und fair.' };
    case 'getgroupdata': {
      const s = await liveStats(store, env, robloxUrl);
      // Alle Rollen der Gruppe, von oben nach unten (Trennlinien ausgenommen)
      const roles = (s.roles || []).filter((r) => r.rank > 0 && !/^[-–_=\s.]+$/.test(r.name)).sort((a, b) => b.rank - a.rank);
      const team = roles.filter((r) => atLeast(matchRank(r), 'Supervisor')).reduce((n, r) => n + (r.memberCount || 0), 0);
      return {
        title: 'Roblox-Gruppe Train Sim Germany',
        rows: [['Gruppen-ID', groupIdOf(env)], ['Mitglieder', num(s.groupMembers)], ['Rollen', String(roles.length)], ['Team ab Supervisor', num(team)],
          ...roles.map((r) => [r.name, num(r.memberCount)])],
        buttons: [btn('Gruppe öffnen', L.group, 'fi-rr-users-alt', true), btn('Spiel starten', L.game, 'fi-sr-play')],
      };
    }
    case 'getuser':
    case 'getrank':
    case 'isonline': {
      const how = { getuser: 'GetUser', getrank: 'GetRank', isonline: 'Online' }[cmd.id];
      if (!cmd.arg) return only('Name fehlt', `So geht es: /${how} Roblox-Name`);
      const p = await player();
      if (!p) return only('Nicht gefunden', `Den Roblox-Namen „${cmd.arg}“ gibt es nicht.`);
      const buttons = [btn('Roblox-Profil', L.profile(p.userId), 'fi-rr-user', true), btn('Anschreiben', `#/chat/an/${p.userId}`, 'fi-rr-paper-plane')];
      const server = (await liveServers(store)).find((s) => (s.online || []).includes(p.userId));
      if (cmd.id === 'isonline') {
        return {
          title: `${p.displayName} (@${p.username})`, avatar: p.avatar,
          text: server ? `Ist gerade im Spiel – ${server.private ? 'auf einem privaten Server' : `Server ${server.jobId.slice(0, 8)}`}.` : 'Ist gerade nicht im Spiel.',
          buttons: server && !server.private ? [btn('Auch beitreten', L.join(server.jobId), 'fi-sr-play', true), ...buttons] : buttons,
        };
      }
      let role = null;
      try { role = await groupRole(env, p.userId); } catch (e) { /* unbekannt */ }
      const rank = role ? `${rankLabel(role.app)}${role.name && !role.name.includes(role.app) ? ` (${role.name})` : ''}` : 'Nicht in der Gruppe';
      if (cmd.id === 'getrank') return { title: `${p.displayName} (@${p.username})`, avatar: p.avatar, rows: [['Rang', rank], ...(role ? [['Rolle in der Gruppe', role.name]] : [])], buttons };
      return {
        title: `${p.displayName} (@${p.username})`, avatar: p.avatar,
        rows: [['Roblox-ID', p.userId], ['Konto seit', p.created ? when(Date.parse(p.created), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–'],
          ['Rang', rank], ['Im Spiel', server ? (server.private ? 'Ja – privater Server' : `Ja – Server ${server.jobId.slice(0, 8)}`) : 'Nein']],
        buttons,
      };
    }
    case 'getservers': {
      const list = (await liveServers(store)).sort((a, b) => b.players - a.players);
      if (!list.length) return { title: 'Server im Spiel', text: 'Gerade meldet sich kein Server. Läuft das Skript TSGAppSync im Spiel?', buttons: [btn('Spiel starten', L.game, 'fi-sr-play', true)] };
      const open = list.filter((s) => !s.private && (!s.max || s.players < s.max));
      return {
        title: `Server im Spiel · ${list.length}`,
        rows: list.slice(0, 15).map((s) => [`${s.private ? 'Privat' : 'Server'} ${s.jobId.slice(0, 8)}`, `${s.players}/${s.max} Spieler${s.version ? ` · v${s.version}` : ''}`]),
        buttons: [...open.slice(0, 3).map((s, i) => btn(`Beitreten ${s.jobId.slice(0, 8)}`, L.join(s.jobId), 'fi-sr-play', i === 0)), btn('Alle Server', '#/server', 'fi-rr-signal-alt-2')],
      };
    }
    case 'getprivateservers': {
      const { serversOfChat } = await import('./pservers.js');
      const list = c.kind === 'group' ? await serversOfChat(store, c, user) : [];
      if (!list.length) return { title: 'Private Server', text: 'Dieser Chat ist mit keinem privaten Server verbunden. Server-Chats verbindet der Besitzer eines privaten Servers unter „Info“.', buttons: [btn('Server in der App', '#/server', 'fi-rr-signal-alt-2')] };
      return {
        title: `Private Server · ${list.length}`,
        rows: list.map((p) => [p.name, p.online ? `Online · ${p.players}/${p.max} Spieler` : 'Offline']),
        buttons: list.filter((p) => p.canJoin && p.link).slice(0, 3).map((p, i) => btn(`Beitreten: ${p.name}`, p.link, 'fi-sr-play', i === 0)),
        text: list.some((p) => p.join === 'roblox') ? 'Bei manchen Servern geht das Beitreten nur über Roblox selbst.' : '',
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
        buttons: [btn('Mitspielen', L.game, 'fi-sr-play', true)],
      };
    }
    case 'getstats': {
      const s = await liveStats(store, env, robloxUrl);
      return {
        title: 'Train Sim Germany in Zahlen',
        rows: [['Spieler online', num(s.playing)], ['Besuche', num(s.visits)], ['Favoriten', num(s.favorites)], ['Gruppe', num(s.groupMembers)],
          ['Discord', `${num(s.discordMembers)} (${num(s.discordOnline)} online)`]],
        buttons: [btn('Spiel öffnen', L.game, 'fi-sr-play', true), btn('Statistiken', '#/statistiken', 'fi-rr-chart-line-up'), btn('Discord', L.discord, 'fi-brands-discord')],
      };
    }
    case 'gettrainings': {
      const list = (await getContent(store)).trainings.filter((x) => x.start > Date.now() - x.dur * 60000).slice(0, 6);
      const buttons = [btn('Alle Trainings', '#/trainings', 'fi-rr-calendar', true)];
      if (!list.length) return { title: 'Nächste Trainings', text: 'Gerade ist kein Training geplant. Alle Termine stehen in der App unter Trainings.', buttons };
      return { title: 'Nächste Trainings', rows: list.map((x) => [when(x.start), `${x.title} · ${x.hostName || x.host}`]), buttons };
    }
    case 'getnews': {
      const list = (await getContent(store)).news.slice(0, 4);
      const buttons = [btn('Alle Neuigkeiten', '#/news', 'fi-rr-newspaper', true)];
      if (!list.length) return { title: 'Neuigkeiten', text: 'Die neuesten Neuigkeiten stehen in der App unter News.', buttons };
      return { title: 'Neuigkeiten', rows: list.map((n) => [n.date ? when(Date.parse(n.date), { day: '2-digit', month: '2-digit' }) : '', n.title]), buttons };
    }
    case 'getteam': {
      const { staffList } = await import('./chat.js');
      const staff = await staffList(store, env);
      const counts = new Map();
      staff.forEach((p) => counts.set(p.rank, [...(counts.get(p.rank) || []), p.displayName || p.username]));
      return {
        title: `Team ab Supervisor · ${staff.length}`,
        rows: [...counts].map(([rank, names]) => [rankLabel(rank), names.slice(0, 6).join(', ') + (names.length > 6 ? ` +${names.length - 6}` : '')]),
        buttons: [btn('Team anschreiben', '#/chat/team', 'fi-rr-users-alt', true)],
      };
    }
    case 'members': {
      const ROLE = { owner: 'Inhaber', admin: 'Admin', mod: 'Moderation', member: 'Mitglied' };
      const list = c.kind === 'group' ? Object.values(c.members || {}) : [c.from, c.to, c.claimedBy].filter(Boolean);
      return { title: `Im Chat · ${list.length}`, rows: list.slice(0, 50).map((p) => [`${p.displayName || p.username} (@${p.username})`, ROLE[p.role] || (p.rank ? rankLabel(p.rank) : 'Mitglied')]) };
    }
    case 'coins': {
      const w = await walletView(store, user.sub);
      const buttons = [btn('Zum Shop', '#/shop', 'fi-rr-shopping-cart', true)];
      if (!w.syncedAt) return only('Deine Coins', 'Noch kein Stand aus dem Spiel. Spiel einmal Train Sim Germany, dann erscheinen deine Coins hier.', [], [btn('Spiel starten', L.game, 'fi-sr-play', true)]);
      return only('Deine Coins', '', [['Coins', num(w.coins)], ['Verfügbar', num(w.available)], ['Züge', String(w.trains.length)], ['Strecken', String(w.routes.length)], ['Stand', when(w.syncedAt)]], buttons);
    }
    case 'play':
      return { title: 'Train Sim Germany spielen', text: 'Steig ein – die Bahnsimulation für ganz Deutschland auf Roblox.', buttons: [btn('Spielen', L.game, 'fi-sr-play', true), btn('Gruppe beitreten', L.group, 'fi-rr-user-add')] };
    case 'discord': {
      const s = await liveStats(store, env, robloxUrl);
      return { title: 'Discord-Community', text: `${num(s.discordMembers)} Mitglieder, ${num(s.discordOnline)} gerade online.`, buttons: [btn('Discord beitreten', L.discord, 'fi-brands-discord', true)] };
    }
    case 'time':
      return { title: 'Spielzeit', text: `${when(Date.now(), { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })} Uhr (Deutschland)` };
    case 'roll': {
      const max = Math.min(1000, Math.max(2, Math.round(+cmd.arg) || 6));
      const n = 1 + (crypto.getRandomValues(new Uint32Array(1))[0] % max);
      return { title: `🎲 ${n}`, text: `${user.displayName || user.username} würfelt eine ${n} (1–${max}).` };
    }
    case 'ping':
      return { title: 'Pong 🏓', text: `Der TSG-Bot ist da. Zeit: ${when(Date.now(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })} Uhr.` };
    default:
      return only('Unbekannter Befehl', 'Mit /help siehst du alle Befehle.');
  }
}
