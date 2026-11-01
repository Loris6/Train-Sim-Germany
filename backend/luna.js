/*
 * Luna – die Skriptsprache für eigene Bots in Train Sim Germany
 *
 * Fast wie Luau (Roblox), nur anders: Blöcke wahlweise mit { … } oder then/do … end, Platzhalter direkt in Texten,
 * Ereignisse als Funktionen (onjoin() { … }) und eine Hierarchie wie im Roblox-Explorer:
 *
 *   ../MyBot                       der Bot ganz oben in der Struktur („../“ = zum Anfang der Struktur)
 *     ServerScriptService          ServerScripts laufen hier (Ereignisse im Chat)
 *     ClientService                ClientScripts laufen hier (in der App der Person, die den Chat öffnet)
 *     GameService                  GameScripts laufen hier (Ereignisse im Spiel)
 *     ConnectorService             Connectors und Webhooks
 *   ModuleScripts dürfen überall liegen und werden mit require(…) geladen.
 *
 *   local c = ../MyBot.ConnectorService.Connect1              dasselbe wie
 *   local c = script.Parent.Parent.ConnectorService.Connect1  (wenn das Skript direkt in einem Service liegt)
 *
 * Läuft im Backend (ServerScripts, GameScripts) und in der App (ClientScripts, Testen im Editor) – dieselbe Datei.
 * Eigener Interpreter: kein eval, kein Zugriff auf JavaScript, Grenzen für Schritte, Tiefe, Länge und Ausgaben.
 */

// Version der Sprache (Playground, Dokumentation). Neue Funktionen → kleine Zahl, Änderungen, die alte Skripte brechen → große Zahl.
export const VERSION = '2.1';

export const TYPES = {
  server: 'ServerScript', client: 'ClientScript', module: 'ModuleScript', game: 'GameScript', connector: 'Connector', webhook: 'Webhook', folder: 'Folder',
  boolvalue: 'BoolValue', intvalue: 'IntValue', numbervalue: 'NumberValue', stringvalue: 'StringValue',
};
export const SCRIPT_TYPES = ['server', 'client', 'module', 'game'];
// Werte-Objekte wie in Roblox: .Value lesen und setzen – Änderungen aus Skripten bleiben gespeichert
export const VALUE_TYPES = ['boolvalue', 'intvalue', 'numbervalue', 'stringvalue'];
// ReplicatedStorage: Module und Werte für Server- und ClientScripts · ServerStorage: nur für Server- und GameScripts
export const SERVICES = ['ServerScriptService', 'ClientService', 'GameService', 'ConnectorService', 'ReplicatedStorage', 'ServerStorage'];
// Standardwert und Umwandlung eines Werte-Objekts
export function valueOf(type, v) {
  if (type === 'boolvalue') return v === true || v === 'true';
  if (type === 'intvalue') { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(-2147483648, Math.min(2147483647, n)) : 0; }
  if (type === 'numbervalue') { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  return String(v ?? '').slice(0, 500);
}
// Wo welche Skripte laufen (ModuleScripts laufen nur, wenn sie geladen werden)
export const RUNS_IN = { server: 'ServerScriptService', client: 'ClientService', game: 'GameService' };
export const DEFAULT_PARENT = {
  server: 'ServerScriptService', client: 'ClientService', game: 'GameService', module: 'ServerScriptService', connector: 'ConnectorService', webhook: 'ConnectorService', folder: 'ServerScriptService',
  boolvalue: 'ReplicatedStorage', intvalue: 'ReplicatedStorage', numbervalue: 'ReplicatedStorage', stringvalue: 'ReplicatedStorage',
};
export const EVENTS = {
  server: ['start', 'join', 'leave', 'message', 'command'],
  game: ['start', 'join', 'leave'],
  client: ['open', 'message'],
  module: [],
};
export const DOCS = {
  events: {
    server: [
      ['onstart()', 'Einmal, wenn der Bot gespeichert und eingeschaltet wird'],
      ['onjoin(username)', 'Jemand tritt dem Chat bei'],
      ['onleave(username)', 'Jemand verlässt den Chat'],
      ['onmessage(text, username)', 'Neue Nachricht im Chat (nicht von Bots)'],
      ['oncommand(command, args)', 'Nachricht mit dem Präfix des Bots, z. B. !regeln'],
    ],
    game: [
      ['onstart()', 'Einmal, wenn der Bot gespeichert und eingeschaltet wird'],
      ['onjoin(username)', 'Jemand betritt einen verbundenen privaten Server'],
      ['onleave(username)', 'Jemand verlässt einen verbundenen privaten Server'],
    ],
    client: [
      ['onopen(username)', 'Jemand öffnet den Chat in der App – nur er sieht die Ausgabe'],
      ['onmessage(text, username)', 'Neue Nachricht, während der Chat offen ist'],
    ],
    module: [],
  },
  vars: [
    ['username', 'Roblox-Name der Person'], ['displayName', 'Anzeigename'], ['userId', 'Roblox-ID'],
    ['server', 'Name des Chats bzw. privaten Servers'], ['chat', 'Name des Chats'], ['members', 'Mitglieder im Chat'],
    ['game', 'Name des Spiels'], ['gameId', 'ID des Spiels (Place-ID)'], ['serverId', 'ID des privaten Servers (GameScript)'],
    ['players', 'Spieler im privaten Server (GameScript)'], ['text', 'Text der Nachricht'], ['command', 'Befehl ohne Präfix'],
    ['args', 'Wörter nach dem Befehl (Liste)'], ['channel', 'Kanal der Nachricht in Servern, z. B. allgemein'], ['bot', 'Name des Bots'], ['time', 'Uhrzeit, z. B. 18:42'], ['date', 'Datum, z. B. 31.10.2026'],
    ['script', 'Das Skript selbst (Instance) – script.Parent ist der Ordner bzw. Service darüber'],
  ],
  functions: [
    ['print(…)', 'Nachricht des Bots in den Chat (ClientScript: nur für die Person)'], ['embed({ title, text, color, fields, footer })', 'Karte statt Text – nur für eigene Bots'],
    ['Wert.Value', 'BoolValue, IntValue, NumberValue, StringValue lesen und setzen (bleibt gespeichert)'], ['warn(…) · log(…)', 'Nur ins Protokoll bzw. die Ausgabe im Editor'],
    ['discord(text)', 'Nachricht über die Discord-Verbindung des Chats'], ['require(modul)', 'ModuleScript laden – require(script.Parent.Texte) oder require("Texte")'],
    ['save(key, wert) · load(key, standard)', 'Werte merken, die erhalten bleiben'], ['tostring(x) · tonumber(x) · typeof(x)', 'Umwandeln, Typ'],
    ['pairs(t) · ipairs(t)', 'Für for-Schleifen (Zählung ab 1 wie in Luau)'], ['math.random(a, b) · math.floor(x) · …', 'Rechnen'],
    ['string.upper(s) · string.sub(s, i, j) · …', 'Text'], ['table.insert(t, x) · table.concat(t, sep) · …', 'Listen'],
    ['now() · time() · date() · weekday()', 'Zeit (deutsche Zeit)'], ['error(text) · assert(bedingung, text)', 'Skript mit Fehlermeldung beenden'],
  ],
};

export const LIMITS = { steps: 10000, depth: 60, str: 4000, list: 2000, keys: 200, says: 5, text: 1900, memory: 8000, memKeys: 50, logs: 40, fire: 8 };

export class LunaError extends Error {
  constructor(message, line = 0, col = 0) {
    super(message);
    this.line = line;
    this.col = col;
  }
}

// ---------- Lexer ----------
const KEYWORDS = new Set(['let', 'local', 'var', 'const', 'function', 'fn', 'return', 'if', 'then', 'else', 'elseif', 'while', 'do', 'for', 'in', 'repeat', 'until', 'end', 'break', 'continue', 'true', 'false', 'nil', 'null', 'and', 'or', 'not']);
const OPEN_DQ = '"„“”';
const CLOSE_DQ = '"“”';
const OPEN_SQ = "'‚‘’";
const CLOSE_SQ = "'‘’";
const ID_START = /[A-Za-z_À-ɏ]/;
const ID_PART = /[A-Za-z0-9_À-ɏ]/;
const OPS = ['../', '==', '!=', '~=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/=', '..', '+', '-', '*', '/', '%', '<', '>', '=', '!', '#', '(', ')', '{', '}', '[', ']', ',', '.', ':', ';'];
const PLACEHOLDER = /^\{\s*([A-Za-z_À-ɏ][A-Za-z0-9_À-ɏ]*(?:\.[A-Za-z_À-ɏ][A-Za-z0-9_À-ɏ]*)*)\s*\}/;

function lex(src) {
  const toks = [];
  let i = 0;
  let line = 1;
  let col = 1;
  let nl = true;
  const n = src.length;
  const adv = () => {
    if (src[i] === '\n') { line += 1; col = 1; } else col += 1;
    i += 1;
  };
  const blockComment = (open, close) => {
    const l = line;
    const c = col;
    for (let k = 0; k < open.length; k += 1) adv();
    while (i < n && !src.startsWith(close, i)) adv();
    if (i >= n) throw new LunaError(`Kommentar wird nicht mit ${close} beendet`, l, c);
    for (let k = 0; k < close.length; k += 1) adv();
  };
  while (i < n) {
    const ch = src[i];
    if (ch === '\n') { adv(); nl = true; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === ' ') { adv(); continue; }
    if (src.startsWith('--[[', i)) { blockComment('--[[', ']]'); continue; }
    if (src.startsWith('/*', i)) { blockComment('/*', '*/'); continue; }
    if (src.startsWith('//', i) || src.startsWith('--', i)) { while (i < n && src[i] !== '\n') adv(); continue; }
    const tok = { line, col, nl };
    nl = false;
    if (/[0-9]/.test(ch)) {
      let s = '';
      while (i < n && /[0-9_]/.test(src[i])) { if (src[i] !== '_') s += src[i]; adv(); }
      if (src[i] === '.' && /[0-9]/.test(src[i + 1] || '')) {
        s += '.'; adv();
        while (i < n && /[0-9]/.test(src[i])) { s += src[i]; adv(); }
      }
      toks.push({ ...tok, t: 'num', v: Number(s) });
      continue;
    }
    if (ID_START.test(ch)) {
      let s = '';
      while (i < n && ID_PART.test(src[i])) { s += src[i]; adv(); }
      toks.push({ ...tok, t: KEYWORDS.has(s) ? 'kw' : 'id', v: s });
      continue;
    }
    const dq = OPEN_DQ.includes(ch);
    if (dq || OPEN_SQ.includes(ch) || ch === '`') {
      const close = ch === '`' ? '`' : dq ? CLOSE_DQ : CLOSE_SQ;
      adv();
      const parts = [];
      let s = '';
      let done = false;
      while (i < n) {
        const c = src[i];
        if (close.includes(c)) { adv(); done = true; break; }
        if (c === '\\') {
          adv();
          const e = src[i];
          s += e === 'n' ? '\n' : e === 't' ? '\t' : e === undefined ? '' : e;
          if (i < n) adv();
          continue;
        }
        if (c === '{') {
          if (src[i + 1] === '{') { s += '{'; adv(); adv(); continue; }
          const m = src.slice(i, i + 80).match(PLACEHOLDER);
          if (m) {
            if (s) { parts.push(s); s = ''; }
            parts.push({ path: m[1].split('.'), raw: m[0] });
            for (let k = 0; k < m[0].length; k += 1) adv();
            continue;
          }
        }
        if (c === '}' && src[i + 1] === '}') { s += '}'; adv(); adv(); continue; }
        s += c;
        adv();
      }
      if (!done) throw new LunaError('Text wird nicht beendet – das schließende Anführungszeichen fehlt', tok.line, tok.col);
      if (s || !parts.length) parts.push(s);
      toks.push({ ...tok, t: 'str', parts });
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new LunaError(`Unbekanntes Zeichen „${ch}“`, line, col);
    for (let k = 0; k < op.length; k += 1) adv();
    toks.push({ ...tok, t: 'op', v: op });
  }
  toks.push({ t: 'eof', line, col, nl: true });
  return toks;
}

// ---------- Parser ----------
const ASSIGN = ['=', '+=', '-=', '*=', '/='];
function describe(k) {
  if (k.t === 'eof') return 'Ende des Skripts';
  if (k.t === 'str') return 'ein Text';
  if (k.t === 'num') return `die Zahl ${k.v}`;
  return `„${k.v}“`;
}

export function parse(src) {
  const toks = lex(String(src || ''));
  let p = 0;
  const peek = (o = 0) => toks[Math.min(p + o, toks.length - 1)];
  const next = () => toks[p++];
  const isOp = (v, o = 0) => peek(o).t === 'op' && peek(o).v === v;
  const isKw = (v, o = 0) => peek(o).t === 'kw' && peek(o).v === v;
  const fail = (msg, k = peek()) => { throw new LunaError(msg, k.line, k.col); };
  const expectOp = (v, why = '') => {
    if (!isOp(v)) fail(`„${v}“ erwartet${why ? ` ${why}` : ''}, gefunden: ${describe(peek())}`);
    return next();
  };
  const ident = (why = '') => {
    if (peek().t !== 'id') fail(`Name erwartet${why ? ` ${why}` : ''}, gefunden: ${describe(peek())}`);
    return next().v;
  };
  const at = (k) => ({ line: k.line, col: k.col });
  const sep = (close, open, what) => {
    if (isOp(close)) return;
    if (isOp(',') || isOp(';')) { next(); return; }
    if (peek().line !== open.line || peek().t === 'eof') fail(`„${close}“ fehlt – ${what} aus Zeile ${open.line} wird nicht geschlossen`, open);
    fail(`„,“ oder „${close}“ erwartet, gefunden: ${describe(peek())}`);
  };
  function matchParen(i) {
    let depth = 0;
    for (let j = i; j < toks.length; j += 1) {
      const k = toks[j];
      if (k.t === 'eof') return -1;
      if (k.t === 'op' && k.v === '(') depth += 1;
      if (k.t === 'op' && k.v === ')') { depth -= 1; if (depth === 0) return j; }
    }
    return -1;
  }
  function block() {
    const open = expectOp('{', 'für den Anfang des Blocks');
    const out = [];
    while (!isOp('}')) {
      if (peek().t === 'eof') fail(`„}“ fehlt – der Block aus Zeile ${open.line} wird nicht geschlossen`, open);
      const s = statement();
      if (s) out.push(s);
    }
    next();
    return out;
  }
  // Anweisungen bis zu einem der Schlüsselwörter (für then/do … end)
  function stmtsUntil(stops, open) {
    const out = [];
    while (!stops.some((s) => isKw(s))) {
      if (peek().t === 'eof') fail(`„${stops[stops.length - 1]}“ fehlt – „${open.v}“ aus Zeile ${open.line} wird nicht geschlossen`, open);
      const s = statement();
      if (s) out.push(s);
    }
    return out;
  }
  // Rumpf: { … } oder (do) … end
  function body(open, opener) {
    if (isOp('{')) return block();
    if (opener) {
      if (!isKw(opener)) fail(`„${opener}“ oder „{“ erwartet, gefunden: ${describe(peek())}`);
      next();
    }
    const b = stmtsUntil(['end'], open);
    next();
    return b;
  }
  function params() {
    const open = expectOp('(');
    const list = [];
    while (!isOp(')')) {
      list.push(ident('für einen Parameter'));
      sep(')', open, 'die Klammer');
    }
    next();
    return list;
  }
  function funcDecl(name, k) {
    const ps = params();
    return { k: 'func', name, params: ps, body: body(k, null), ...at(k) };
  }
  function ifStmt(k) {
    const test = expr();
    if (isOp('{')) {
      const cons = block();
      let alt = null;
      if (isKw('else')) { next(); alt = isKw('if') ? [ifStmt(next())] : block(); } else if (isKw('elseif')) alt = [ifStmt(next())];
      return { k: 'if', test, cons, alt, ...at(k) };
    }
    if (!isKw('then')) fail(`„then“ oder „{“ erwartet nach der Bedingung, gefunden: ${describe(peek())}`);
    next();
    const cons = stmtsUntil(['elseif', 'else', 'end'], k);
    let alt = null;
    if (isKw('elseif')) alt = [ifStmt(next())];
    else if (isKw('else')) { next(); alt = stmtsUntil(['end'], k); next(); } else next();
    return { k: 'if', test, cons, alt, ...at(k) };
  }
  function forStmt(k) {
    const paren = isOp('(') && peek(1).t === 'id' && (isKw('in', 2) || isOp(',', 2) || isOp('=', 2));
    if (paren) next();
    const a = ident('nach „for“');
    if (isOp('=')) {
      next();
      const from = expr();
      expectOp(',', 'zwischen Start und Ende');
      const to = expr();
      let step = null;
      if (isOp(',')) { next(); step = expr(); }
      if (paren) expectOp(')');
      return { k: 'fornum', name: a, from, to, step, body: body(k, 'do'), ...at(k) };
    }
    let b = null;
    if (isOp(',')) { next(); b = ident(); }
    if (!isKw('in')) fail(`„in“ erwartet, gefunden: ${describe(peek())}`);
    next();
    const iter = expr();
    if (paren) expectOp(')');
    return { k: 'for', a, b, iter, body: body(k, 'do'), ...at(k) };
  }
  function statement() {
    const k = peek();
    if (isOp(';')) { next(); return null; }
    if (k.t === 'kw') {
      switch (k.v) {
        case 'let': case 'local': case 'var': case 'const': {
          next();
          if (isKw('function') || isKw('fn')) { const fk = next(); return funcDecl(ident('nach „function“'), fk); }
          const name = ident(`nach „${k.v}“`);
          let init = null;
          if (isOp('=')) { next(); init = expr(); }
          return { k: 'let', name, init, constant: k.v === 'const', ...at(k) };
        }
        case 'function': case 'fn':
          if (peek(1).t === 'id') {
            next();
            let target = { k: 'var', name: next().v, ...at(k) };
            let method = false;
            while (isOp('.') || isOp(':')) {
              const s = next();
              target = { k: 'member', obj: target, name: ident(), ...at(s) };
              if (s.v === ':') { method = true; break; }
            }
            const ps = params();
            if (method) ps.unshift('self');
            const b = body(k, null);
            if (target.k === 'var') return { k: 'func', name: target.name, params: ps, body: b, ...at(k) };
            return { k: 'assign', target, op: '=', value: { k: 'lambda', params: ps, body: b, name: target.name, ...at(k) }, ...at(k) };
          }
          break;
        case 'return': {
          next();
          let value = null;
          const stop = isOp('}') || isOp(';') || ['end', 'else', 'elseif', 'until'].some((w) => isKw(w)) || peek().t === 'eof';
          if (!peek().nl && !stop) value = expr();
          return { k: 'return', value, ...at(k) };
        }
        case 'if': next(); return ifStmt(k);
        case 'while': { next(); const test = expr(); return { k: 'while', test, body: body(k, 'do'), ...at(k) }; }
        case 'for': next(); return forStmt(k);
        case 'repeat': { next(); const b = stmtsUntil(['until'], k); next(); return { k: 'repeat', body: b, test: expr(), ...at(k) }; }
        case 'do': { next(); const b = stmtsUntil(['end'], k); next(); return { k: 'block', body: b, ...at(k) }; }
        case 'break': case 'continue': next(); return { k: k.v, ...at(k) };
        case 'else': case 'elseif': fail('„else“ ohne passendes „if“'); break;
        case 'end': fail('„end“ ohne passenden Anfang (if, for, while, function, do)'); break;
        case 'then': case 'until': fail(`Unerwartet: „${k.v}“`); break;
        default: break;
      }
    }
    // Kurzform einer Funktion: name(a, b) { … } – z. B. onjoin() { … }
    if (k.t === 'id' && isOp('(', 1)) {
      const end = matchParen(p + 1);
      const after = end > 0 ? toks[end + 1] : null;
      const inner = end > 0 ? toks.slice(p + 2, end) : [];
      const names = inner.every((x, i) => (i % 2 === 0 ? x.t === 'id' : x.t === 'op' && x.v === ','));
      if (after && after.t === 'op' && after.v === '{' && names) { next(); return funcDecl(k.v, k); }
    }
    if (isOp('{')) return { k: 'block', body: block(), ...at(k) };
    const e = expr();
    if (peek().t === 'op' && ASSIGN.includes(peek().v)) {
      if (!['var', 'member', 'index'].includes(e.k)) fail('Hier kann nichts zugewiesen werden');
      const op = next().v;
      return { k: 'assign', target: e, op, value: expr(), ...at(k) };
    }
    return { k: 'expr', e, ...at(k) };
  }

  function expr() { return orE(); }
  function orE() {
    let l = andE();
    while (isOp('||') || isKw('or')) { const k = next(); l = { k: 'logic', op: 'or', l, r: andE(), ...at(k) }; }
    return l;
  }
  function andE() {
    let l = eqE();
    while (isOp('&&') || isKw('and')) { const k = next(); l = { k: 'logic', op: 'and', l, r: eqE(), ...at(k) }; }
    return l;
  }
  function eqE() {
    let l = cmpE();
    while (isOp('==') || isOp('!=') || isOp('~=')) { const k = next(); l = { k: 'bin', op: k.v === '~=' ? '!=' : k.v, l, r: cmpE(), ...at(k) }; }
    return l;
  }
  function cmpE() {
    let l = dotsE();
    while (isOp('<') || isOp('>') || isOp('<=') || isOp('>=')) { const k = next(); l = { k: 'bin', op: k.v, l, r: dotsE(), ...at(k) }; }
    return l;
  }
  // a .. b – Zahlen: Bereich (1..5), sonst Texte verbinden ("a" .. "b")
  function dotsE() {
    const l = addE();
    if (isOp('..')) { const k = next(); return { k: 'dots', l, r: dotsE(), ...at(k) }; }
    return l;
  }
  function addE() {
    let l = mulE();
    while (isOp('+') || isOp('-')) { const k = next(); l = { k: 'bin', op: k.v, l, r: mulE(), ...at(k) }; }
    return l;
  }
  function mulE() {
    let l = unary();
    while (isOp('*') || isOp('/') || isOp('%')) { const k = next(); l = { k: 'bin', op: k.v, l, r: unary(), ...at(k) }; }
    return l;
  }
  function unary() {
    if (isOp('-') || isOp('!') || isKw('not') || isOp('#')) {
      const k = next();
      return { k: 'unary', op: k.v === '-' ? '-' : k.v === '#' ? '#' : '!', e: unary(), ...at(k) };
    }
    return postfix();
  }
  function args(open) {
    const list = [];
    while (!isOp(')')) {
      if (peek().t === 'eof') fail(`„)“ fehlt – die Klammer aus Zeile ${open.line} wird nicht geschlossen`, open);
      list.push(expr());
      sep(')', open, 'die Klammer');
    }
    next();
    return list;
  }
  function postfix() {
    let e = primary();
    for (;;) {
      if (isOp('(') && !peek().nl) {
        const k = next();
        e = { k: 'call', fn: e, args: args(k), ...at(k) };
      } else if (isOp(':') && peek(1).t === 'id' && isOp('(', 2)) {
        const k = next();
        const name = next().v;
        const open = next();
        e = { k: 'mcall', obj: e, name, args: args(open), ...at(k) };
      } else if (isOp('.')) {
        const k = next();
        const nk = peek();
        if (nk.t !== 'id' && nk.t !== 'kw') fail(`Name nach „.“ erwartet, gefunden: ${describe(nk)}`);
        next();
        e = { k: 'member', obj: e, name: nk.v, ...at(k) };
      } else if (isOp('[') && !peek().nl) {
        const k = next();
        const index = expr();
        expectOp(']');
        e = { k: 'index', obj: e, index, ...at(k) };
      } else break;
    }
    return e;
  }
  function table(k) {
    const items = [];
    const entries = [];
    while (!isOp('}')) {
      if (peek().t === 'eof') fail(`„}“ fehlt – die Tabelle aus Zeile ${k.line} wird nicht geschlossen`, k);
      const kk = peek();
      if (isOp('[')) {
        next();
        const key = expr();
        expectOp(']');
        expectOp('=');
        entries.push([key, expr(), true]);
      } else if ((kk.t === 'id' || kk.t === 'kw' || kk.t === 'str' || kk.t === 'num') && (isOp(':', 1) || isOp('=', 1))) {
        next();
        next();
        const key = kk.t === 'str' ? kk.parts.map((x) => (typeof x === 'string' ? x : x.raw)).join('') : String(kk.v);
        entries.push([key, expr(), false]);
      } else items.push(expr());
      sep('}', k, 'die Tabelle');
    }
    next();
    if (items.length && entries.length) fail('Eine Tabelle ist entweder eine Liste {1, 2} oder ein Objekt {a = 1} – nicht beides', k);
    return items.length ? { k: 'list', items, ...at(k) } : { k: 'obj', entries, ...at(k) };
  }
  function primary() {
    const k = peek();
    if (k.t === 'num') { next(); return { k: 'num', v: k.v, ...at(k) }; }
    if (k.t === 'str') { next(); return { k: 'str', parts: k.parts, ...at(k) }; }
    if (k.t === 'id') { next(); return { k: 'var', name: k.v, ...at(k) }; }
    if (k.t === 'kw') {
      if (k.v === 'true' || k.v === 'false') { next(); return { k: 'bool', v: k.v === 'true', ...at(k) }; }
      if (k.v === 'nil' || k.v === 'null') { next(); return { k: 'nil', ...at(k) }; }
      if (k.v === 'function' || k.v === 'fn') { next(); const ps = params(); return { k: 'lambda', params: ps, body: body(k, null), ...at(k) }; }
    }
    // ../MyBot – zum Anfang der Struktur
    if (isOp('../')) {
      next();
      const nk = peek();
      if (nk.t !== 'id') fail(`Nach „../“ kommt der Name des Bots, z. B. ../MyBot – gefunden: ${describe(nk)}`);
      next();
      return { k: 'member', obj: { k: 'root', ...at(k) }, name: nk.v, ...at(nk) };
    }
    if (isOp('(')) { next(); const e = expr(); expectOp(')'); return e; }
    if (isOp('[')) {
      next();
      const items = [];
      while (!isOp(']')) {
        if (peek().t === 'eof') fail(`„]“ fehlt – die Liste aus Zeile ${k.line} wird nicht geschlossen`, k);
        items.push(expr());
        sep(']', k, 'die Liste');
      }
      next();
      return { k: 'list', items, ...at(k) };
    }
    if (isOp('{')) { next(); return table(k); }
    return fail(`Unerwartet: ${describe(k)}`);
  }

  const out = [];
  while (peek().t !== 'eof') {
    const s = statement();
    if (s) out.push(s);
  }
  return out;
}

const cache = new Map();
function cached(code) {
  const key = String(code || '');
  let hit = cache.get(key);
  if (!hit) {
    try { hit = { ast: parse(key) }; } catch (e) { if (!(e instanceof LunaError)) throw e; hit = { error: { message: e.message, line: e.line, col: e.col } }; }
    if (cache.size > 200) cache.clear();
    cache.set(key, hit);
  }
  return hit;
}
export function check(code) {
  const r = cached(code);
  return r.error ? { ok: false, error: r.error } : { ok: true };
}

// ---------- Werte ----------
class LFunc {
  constructor(name, params, body, scope, file) { this.name = name; this.params = params; this.body = body; this.scope = scope; this.file = file; }
}
class LNative {
  constructor(name, fn) { this.name = name; this.fn = fn; }
}
// Objekt aus dem Explorer (Bot, Services, Skripte, Connectors, …)
class LInst {
  constructor(cls, name, item = null) { this.ClassName = cls; this.Name = name; this.item = item; this.Parent = null; this.children = []; this.listeners = []; }
}
// Für for k, v in pairs(t) / ipairs(t)
class LPairs {
  constructor(entries) { this.entries = entries; }
}
const isFn = (v) => v instanceof LFunc || v instanceof LNative;
const isInst = (v) => v instanceof LInst;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && !isFn(v) && !isInst(v) && !(v instanceof LPairs);
const newObj = () => Object.create(null);
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
export function typeOf(v) {
  if (v === null || v === undefined) return 'nil';
  if (Array.isArray(v)) return 'list';
  if (isFn(v)) return 'function';
  if (isInst(v)) return 'Instance';
  if (isObj(v)) return 'object';
  return typeof v;
}
const luauType = (v) => { const t = typeOf(v); return t === 'list' || t === 'object' ? 'table' : t; };
const truthy = (v) => !(v === null || v === undefined || v === false || v === 0 || v === '');
function num(v) {
  if (Number.isInteger(v)) return String(v);
  if (!Number.isFinite(v)) return v > 0 ? 'inf' : v < 0 ? '-inf' : 'nan';
  return String(Math.round(v * 1e10) / 1e10);
}
export function str(v, depth = 0) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return num(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (isFn(v)) return `function ${v.name || ''}`.trim();
  if (isInst(v)) return v.Name;
  if (depth > 3) return '…';
  if (Array.isArray(v)) return v.map((x) => str(x, depth + 1)).join(', ');
  if (v instanceof LPairs) return 'pairs';
  return `{${Object.keys(v).map((k) => `${k}: ${typeof v[k] === 'string' ? `"${v[k]}"` : str(v[k], depth + 1)}`).join(', ')}}`;
}
function plain(v, depth = 0) {
  if (depth > 6) throw new LunaError('Zu tief verschachtelt zum Speichern');
  if (v === null || v === undefined || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v === undefined ? null : v;
  if (Array.isArray(v)) return v.map((x) => plain(x, depth + 1));
  if (isFn(v)) throw new LunaError('Funktionen kann man nicht speichern');
  if (isInst(v)) throw new LunaError('Objekte aus dem Explorer kann man nicht speichern – speichere ihren Namen');
  if (v instanceof LPairs) throw new LunaError('Das kann man nicht speichern');
  const o = {};
  Object.keys(v).forEach((k) => { o[k] = plain(v[k], depth + 1); });
  return o;
}
function fromPlain(v) {
  if (Array.isArray(v)) return v.map(fromPlain);
  if (v && typeof v === 'object') {
    const o = newObj();
    Object.keys(v).forEach((k) => { o[k] = fromPlain(v[k]); });
    return o;
  }
  return v === undefined ? null : v;
}
// Länge des „Listen-Teils“ eines Objekts (Schlüssel 1, 2, 3 … wie in Luau)
function seqLen(o) {
  let n = 0;
  while (hasOwn(o, String(n + 1))) n += 1;
  return n;
}
const keyOf = (k) => (/^-?\d+$/.test(k) ? Number(k) : k);

// ---------- Umgebung ----------
class Scope {
  constructor(parent = null) { this.vars = new Map(); this.consts = null; this.parent = parent; }
  find(name) {
    for (let s = this; s; s = s.parent) if (s.vars.has(name)) return s;
    return null;
  }
  define(name, v, constant = false) {
    this.vars.set(name, v);
    if (constant) (this.consts || (this.consts = new Set())).add(name);
  }
}
const BREAK = { signal: 'break' };
const CONTINUE = { signal: 'continue' };
const ALL_EVENTS = new Set(Object.values(EVENTS).flat());
const handlerEvent = (name) => {
  const ev = /^on/i.test(name) ? name.slice(2).replace(/_/g, '').toLowerCase() : '';
  return ALL_EVENTS.has(ev) ? ev : null;
};
const BERLIN = 'Europe/Berlin';
function clock(opts) {
  try { return new Intl.DateTimeFormat('de-DE', { timeZone: BERLIN, ...opts }).format(new Date()); } catch (e) { return new Intl.DateTimeFormat('de-DE', opts).format(new Date()); }
}
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9À-ɏ]/g, '');
const SCRIPT_CLASSES = new Set(['ServerScript', 'ClientScript', 'ModuleScript', 'GameScript']);
const INST_PROPS = new Set(['Name', 'ClassName', 'Parent', 'Enabled', 'Event', 'Value']);
const VALUE_CLASSES = new Set(['BoolValue', 'IntValue', 'NumberValue', 'StringValue']);
const valueKey = (o) => `__v:${o.item.id}`;
const INST_METHOD_NAMES = new Set(['GetChildren', 'GetDescendants', 'FindFirstChild', 'FindFirstChildOfClass', 'WaitForChild', 'IsA', 'GetFullName', 'Fire', 'Connect', 'Send', 'Post']);

// Baum wie im Explorer aus den gespeicherten Objekten { id, name, type, parent }
function parentOf(f, byId) {
  const seen = new Set([f.id]);
  let p = f.parent;
  for (let i = 0; i < 64 && p && byId.has(p); i += 1) {
    if (seen.has(p)) return DEFAULT_PARENT[f.type] || 'ServerScriptService';
    seen.add(p);
    p = byId.get(p).parent;
  }
  if (SERVICES.includes(f.parent) || byId.has(f.parent)) return f.parent;
  return DEFAULT_PARENT[f.type] || 'ServerScriptService';
}
function buildTree(files, botName, make) {
  const root = make('DataModel', 'Luna', null);
  const bot = make('Bot', botName || 'Bot', null);
  const attach = (parent, child) => { child.Parent = parent; parent.children.push(child); };
  attach(root, bot);
  const services = {};
  SERVICES.forEach((s) => { services[s] = make(s, s, null); attach(bot, services[s]); });
  const list = (files || []).filter((f) => f && f.id);
  const byId = new Map(list.map((f) => [f.id, f]));
  const insts = new Map(list.map((f) => [f.id, make(TYPES[f.type] || 'Folder', f.name, f)]));
  list.forEach((f) => {
    const p = parentOf(f, byId);
    attach(services[p] || insts.get(p) || services.ServerScriptService, insts.get(f.id));
  });
  return { root, bot, services, insts };
}
const serviceOf = (x) => { for (let n = x.Parent; n; n = n.Parent) if (SERVICES.includes(n.ClassName)) return n.ClassName; return null; };
const fullName = (x) => { const parts = []; for (let n = x; n && n.ClassName !== 'DataModel'; n = n.Parent) parts.unshift(n.Name); return parts.join('.'); };
function childNamed(x, name) {
  const hit = x.children.find((c) => c.Name === name);
  if (hit) return hit;
  // ../MyBot: der Bot ganz oben auch ohne Leerzeichen und Groß-/Kleinschreibung (oder einfach ../Bot)
  if (x.ClassName === 'DataModel') return x.children.find((c) => norm(c.Name) === norm(name) || norm(name) === 'bot') || null;
  return null;
}
const isA = (x, cls) => x.ClassName === cls || cls === 'Instance' || (cls === 'Script' && SCRIPT_CLASSES.has(x.ClassName) && x.ClassName !== 'ModuleScript') || (cls === 'LuaSourceContainer' && SCRIPT_CLASSES.has(x.ClassName)) || (cls === 'Service' && SERVICES.includes(x.ClassName));

// ---------- Interpreter ----------
class Runtime {
  constructor(opts) {
    this.files = opts.files || [];
    this.vars = opts.vars || {};
    this.side = opts.side || 'backend';
    this.memory = fromPlain(opts.memory || {});
    this.memChanged = false;
    this.steps = 0;
    this.depth = 0;
    this.fires = 0;
    this.says = [];
    this.discords = [];
    this.webhooks = [];
    this.logs = [];
    this.errors = [];
    this.phase = 'setup';
    this.file = null;
    this.modules = new Map();
    this.loading = new Set();
    this.warned = new Set();
    this.limits = { ...LIMITS, ...(opts.limits || {}) };
    this.tree = buildTree(this.files, opts.botName, (cls, name, item) => new LInst(cls, name, item));
    this.builtins = this.makeBuiltins();
  }
  fail(msg, node) { throw new LunaError(msg, node ? node.line : 0, node ? node.col : 0); }
  tick(node) {
    this.steps += 1;
    if (this.steps > this.limits.steps) this.fail('Das Skript braucht zu viele Schritte (Endlosschleife?)', node);
  }
  log(text, kind = 'log', line = 0) {
    if (this.logs.length >= this.limits.logs) return;
    this.logs.push({ file: this.file ? this.file.name : '', line, text: String(text).slice(0, 500), kind });
  }
  warnOnce(key, text, node) {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.log(text, 'warn', node ? node.line : 0);
  }
  checkStr(s, node) {
    if (s.length > this.limits.str) this.fail(`Text zu lang (höchstens ${this.limits.str} Zeichen)`, node);
    return s;
  }
  checkList(l, node) {
    if (l.length > this.limits.list) this.fail(`Liste zu lang (höchstens ${this.limits.list} Elemente)`, node);
    return l;
  }
  // print → Chat, discord → Discord-Verbindung, webhook → Webhook-Objekt
  output(kind, args, node, extra = null, card = null) {
    const text = args.map((x) => str(x)).join(' ').slice(0, this.limits.text);
    const label = { say: 'print()', discord: 'discord()', webhook: 'Webhook:Send()' }[kind];
    if (this.phase !== 'event' && !this.free) {
      this.warnOnce(`${kind}-setup`, `${label} außerhalb eines Ereignisses wird ignoriert – schreib es z. B. in onjoin() { … }`, node);
      return null;
    }
    if (!text.trim()) return null;
    const list = kind === 'say' ? this.says : kind === 'discord' ? this.discords : this.webhooks;
    if (list.length >= this.limits.says) {
      this.warnOnce(`${kind}-max`, `Höchstens ${this.limits.says} Nachrichten pro Ereignis`, node);
      return null;
    }
    list.push(kind === 'webhook' ? { ...extra, text } : card ? { text, embed: card } : text);
    this.log(`${kind === 'say' ? '💬' : kind === 'discord' ? '🎮 Discord:' : `🔗 ${extra.name}:`} ${text}`, 'out', node ? node.line : 0);
    return null;
  }

  makeBuiltins() {
    const g = new Scope();
    const rt = this;
    const def = (name, fn) => g.define(name, new LNative(name, fn));
    const lib = (name, fns) => { const o = newObj(); Object.keys(fns).forEach((k) => { o[k] = typeof fns[k] === 'function' ? new LNative(`${name}.${k}`, fns[k]) : fns[k]; }); g.define(name, o); };
    const needStr = (v, fname, node) => {
      if (typeof v !== 'string') rt.fail(`${fname}() braucht einen Text, nicht ${typeOf(v)}`, node);
      return v;
    };
    const needNum = (v, fname, node) => {
      if (typeof v !== 'number') rt.fail(`${fname}() braucht eine Zahl, nicht ${typeOf(v)}`, node);
      return v;
    };
    const needTable = (v, fname, node) => {
      if (!Array.isArray(v) && !isObj(v)) rt.fail(`${fname}() braucht eine Tabelle, nicht ${typeOf(v)}`, node);
      return v;
    };
    const toNum = (v) => { const x = typeof v === 'number' ? v : Number(String(v).replace(',', '.')); return Number.isFinite(x) && String(v).trim() !== '' ? x : null; };
    const rand = (a, b, n) => {
      const lo = Math.ceil(needNum(a, 'random', n));
      const hi = Math.floor(needNum(b, 'random', n));
      return lo + Math.floor(Math.random() * (hi - lo + 1));
    };
    def('print', (a, n) => rt.output('say', a, n));
    // Karte (Embed) nur für eigene Bots: embed({ title = "…", text = "…", color = "#5865F2", fields = { { name = "…", value = "…" } }, footer = "…" })
    def('embed', ([o], n) => {
      if (!isObj(o)) rt.fail('embed() braucht eine Tabelle, z. B. embed({ title = "Hallo", text = "Willkommen!" })', n);
      const s2 = (v, max) => (v === null || v === undefined ? '' : str(v).slice(0, max));
      const rawFields = o.fields === undefined ? [] : Array.isArray(o.fields) ? o.fields : isObj(o.fields) ? Object.keys(o.fields).sort((x, y) => Number(x) - Number(y)).map((k) => o.fields[k]) : [];
      const card = {
        title: s2(o.title, 256), text: s2(o.text ?? o.description, 2000), footer: s2(o.footer, 200),
        color: /^#[0-9a-fA-F]{6}$/.test(str(o.color || '')) ? str(o.color).toUpperCase() : '#5865F2',
        fields: rawFields.filter(isObj).slice(0, 10).map((f) => ({ name: s2(f.name, 120), value: s2(f.value, 600) })).filter((f) => f.name || f.value),
      };
      if (!card.title && !card.text && !card.fields.length) rt.fail('embed() braucht mindestens title, text oder fields', n);
      return rt.output('say', [card.title || card.text], n, null, card);
    });
    def('say', (a, n) => rt.output('say', a, n));
    def('reply', (a, n) => rt.output('say', a, n));
    def('discord', (a, n) => {
      if (rt.side === 'client') rt.fail('discord() gibt es nur in Server- und GameScripts', n);
      return rt.output('discord', a, n);
    });
    def('log', (a, n) => { rt.log(a.map((x) => str(x)).join(' '), 'log', n.line); return null; });
    def('warn', (a, n) => { rt.log(a.map((x) => str(x)).join(' '), 'warn', n.line); return null; });
    def('error', (a, n) => rt.fail(str(a[0]) || 'Fehler', n));
    def('assert', (a, n) => (truthy(a[0]) ? a[0] : rt.fail(str(a[1]) || 'assert ist fehlgeschlagen', n)));
    def('wait', (a, n) => rt.fail('Warten gibt es in Luna nicht – Skripte laufen nur kurz bei einem Ereignis', n));
    def('require', (a, n) => rt.require(a[0], n));
    def('len', ([v], n) => {
      if (typeof v === 'string' || Array.isArray(v)) return v.length;
      if (isObj(v)) return Object.keys(v).length;
      return rt.fail(`len() geht nicht mit ${typeOf(v)}`, n);
    });
    def('str', ([v]) => str(v));
    def('tostring', ([v]) => str(v));
    def('num', ([v]) => toNum(v));
    def('tonumber', ([v]) => toNum(v));
    def('type', ([v]) => typeOf(v));
    def('typeof', ([v]) => luauType(v));
    def('pairs', ([t], n) => {
      if (Array.isArray(t)) return new LPairs(t.map((v, i) => [i + 1, v]));
      if (isObj(t)) return new LPairs(Object.keys(t).map((k) => [keyOf(k), t[k]]));
      if (isInst(t)) return new LPairs(t.children.map((c, i) => [i + 1, c]));
      return rt.fail(`pairs() braucht eine Tabelle, nicht ${typeOf(t)}`, n);
    });
    def('ipairs', ([t], n) => {
      if (Array.isArray(t)) return new LPairs(t.map((v, i) => [i + 1, v]));
      if (isObj(t)) { const out = []; for (let i = 1; i <= seqLen(t); i += 1) out.push([i, t[String(i)]]); return new LPairs(out); }
      return rt.fail(`ipairs() braucht eine Liste, nicht ${typeOf(t)}`, n);
    });
    def('upper', ([v], n) => needStr(v, 'upper', n).toUpperCase());
    def('lower', ([v], n) => needStr(v, 'lower', n).toLowerCase());
    def('trim', ([v], n) => needStr(v, 'trim', n).trim());
    def('contains', ([a, b]) => (Array.isArray(a) ? a.some((x) => x === b) : typeof a === 'string' ? a.toLowerCase().includes(str(b).toLowerCase()) : isObj(a) ? hasOwn(a, str(b)) : false));
    def('startsWith', ([a, b], n) => needStr(a, 'startsWith', n).toLowerCase().startsWith(str(b).toLowerCase()));
    def('endsWith', ([a, b], n) => needStr(a, 'endsWith', n).toLowerCase().endsWith(str(b).toLowerCase()));
    def('split', ([a, b], n) => rt.checkList(needStr(a, 'split', n).split(b === undefined || b === null ? ' ' : str(b)).filter((x, i, l) => x !== '' || l.length === 1), n));
    def('join', ([l, sep], n) => { if (!Array.isArray(l)) rt.fail('join() braucht eine Liste', n); return rt.checkStr(l.map((x) => str(x)).join(sep === undefined || sep === null ? ', ' : str(sep)), n); });
    def('replace', ([a, b, c], n) => rt.checkStr(needStr(a, 'replace', n).split(str(b)).join(str(c)), n));
    def('format', ([tpl, o], n) => rt.checkStr(renderTemplate(needStr(tpl, 'format', n), isObj(o) ? o : {}), n));
    def('random', ([a, b], n) => {
      if (Array.isArray(a)) return a.length ? a[Math.floor(Math.random() * a.length)] : null;
      if (a === undefined || a === null) return Math.random();
      return b === undefined || b === null ? rand(1, a, n) : rand(a, b, n);
    });
    def('round', ([v, d], n) => { const f = 10 ** (typeof d === 'number' ? Math.max(0, Math.min(8, Math.floor(d))) : 0); return Math.round(needNum(v, 'round', n) * f) / f; });
    def('floor', ([v], n) => Math.floor(needNum(v, 'floor', n)));
    def('ceil', ([v], n) => Math.ceil(needNum(v, 'ceil', n)));
    def('abs', ([v], n) => Math.abs(needNum(v, 'abs', n)));
    def('sqrt', ([v], n) => Math.sqrt(needNum(v, 'sqrt', n)));
    def('min', (a, n) => { const l = Array.isArray(a[0]) ? a[0] : a; l.forEach((x) => needNum(x, 'min', n)); return l.length ? Math.min(...l) : null; });
    def('max', (a, n) => { const l = Array.isArray(a[0]) ? a[0] : a; l.forEach((x) => needNum(x, 'max', n)); return l.length ? Math.max(...l) : null; });
    def('keys', ([o], n) => { if (!isObj(o)) rt.fail('keys() braucht ein Objekt', n); return Object.keys(o); });
    def('values', ([o], n) => { if (!isObj(o)) rt.fail('values() braucht ein Objekt', n); return Object.keys(o).map((k) => o[k]); });
    def('has', ([o, k]) => isObj(o) && hasOwn(o, str(k)));
    def('range', ([a, b], n) => rt.range(a, b, n));
    def('now', () => Date.now());
    def('time', () => clock({ hour: '2-digit', minute: '2-digit' }));
    def('date', () => clock({ day: '2-digit', month: '2-digit', year: 'numeric' }));
    def('weekday', () => clock({ weekday: 'long' }));
    def('save', ([k, v], n) => {
      const key = str(k).slice(0, 60);
      if (!key) rt.fail('save() braucht einen Namen', n);
      const next = { ...rt.memory };
      if (v === null || v === undefined) delete next[key]; else next[key] = fromPlain(plain(v));
      if (Object.keys(next).length > rt.limits.memKeys) rt.fail(`Höchstens ${rt.limits.memKeys} gemerkte Werte`, n);
      if (JSON.stringify(plain(next)).length > rt.limits.memory) rt.fail('Der Speicher des Bots ist voll', n);
      rt.memory = Object.assign(newObj(), next);
      rt.memChanged = true;
      return null;
    });
    def('load', ([k, d]) => { const key = str(k); return hasOwn(rt.memory, key) ? fromPlain(plain(rt.memory[key])) : d === undefined ? null : d; });
    // Bibliotheken wie in Luau
    lib('math', {
      floor: ([v], n) => Math.floor(needNum(v, 'math.floor', n)), ceil: ([v], n) => Math.ceil(needNum(v, 'math.ceil', n)),
      abs: ([v], n) => Math.abs(needNum(v, 'math.abs', n)), sqrt: ([v], n) => Math.sqrt(needNum(v, 'math.sqrt', n)),
      round: ([v], n) => Math.round(needNum(v, 'math.round', n)), min: (a, n) => Math.min(...a.map((x) => needNum(x, 'math.min', n))),
      max: (a, n) => Math.max(...a.map((x) => needNum(x, 'math.max', n))),
      random: ([a, b], n) => (a === undefined || a === null ? Math.random() : b === undefined || b === null ? rand(1, a, n) : rand(a, b, n)),
      clamp: ([x, a, b], n) => Math.min(needNum(b, 'math.clamp', n), Math.max(needNum(a, 'math.clamp', n), needNum(x, 'math.clamp', n))),
      sign: ([v], n) => Math.sign(needNum(v, 'math.sign', n)), pi: Math.PI, huge: Infinity,
    });
    const sub = (s, i, j) => { const L = s.length; let a = i < 0 ? L + i + 1 : i; let b = j < 0 ? L + j + 1 : j; a = Math.max(a, 1); b = Math.min(b, L); return a > b ? '' : s.slice(a - 1, b); };
    lib('string', {
      upper: ([s], n) => needStr(s, 'string.upper', n).toUpperCase(), lower: ([s], n) => needStr(s, 'string.lower', n).toLowerCase(),
      len: ([s], n) => needStr(s, 'string.len', n).length,
      sub: ([s, i, j], n) => sub(needStr(s, 'string.sub', n), typeof i === 'number' ? i : 1, typeof j === 'number' ? j : -1),
      rep: ([s, k, sp], n) => {
        const t = needStr(s, 'string.rep', n);
        const c = Math.max(0, Math.floor(Number(k) || 0));
        if ((t.length + str(sp).length) * c > rt.limits.str) rt.fail('Text zu lang', n);
        return Array(c).fill(t).join(sp === undefined || sp === null ? '' : str(sp));
      },
      split: ([s, d], n) => rt.checkList(needStr(s, 'string.split', n).split(d === undefined || d === null ? ',' : str(d)), n),
      find: ([s, f, init], n) => { const t = needStr(s, 'string.find', n); const i = t.indexOf(str(f), typeof init === 'number' ? init - 1 : 0); return i < 0 ? null : i + 1; },
      reverse: ([s], n) => [...needStr(s, 'string.reverse', n)].reverse().join(''), trim: ([s], n) => needStr(s, 'string.trim', n).trim(),
      format: ([tpl, ...a], n) => {
        let k = 0;
        return rt.checkStr(needStr(tpl, 'string.format', n).replace(/%([sdf%])/g, (m, c) => {
          if (c === '%') return '%';
          const v = a[k];
          k += 1;
          return c === 'd' ? String(Math.trunc(Number(v) || 0)) : c === 'f' ? (Number(v) || 0).toFixed(2) : str(v);
        }), n);
      },
    });
    lib('table', {
      insert: ([t, a, b], n) => {
        needTable(t, 'table.insert', n);
        const pos = b === undefined ? null : a;
        const v = b === undefined ? a : b;
        if (Array.isArray(t)) { if (pos === null) t.push(v); else t.splice(Math.max(0, Math.min(t.length, Number(pos) - 1)), 0, v); rt.checkList(t, n); return null; }
        const len = seqLen(t);
        const at = pos === null ? len + 1 : Math.max(1, Math.min(len + 1, Number(pos)));
        for (let i = len; i >= at; i -= 1) t[String(i + 1)] = t[String(i)];
        t[String(at)] = v;
        return null;
      },
      remove: ([t, pos], n) => {
        needTable(t, 'table.remove', n);
        if (Array.isArray(t)) { if (!t.length) return null; const i = pos === undefined ? t.length - 1 : Number(pos) - 1; return i >= 0 && i < t.length ? t.splice(i, 1)[0] : null; }
        const len = seqLen(t);
        const at = pos === undefined ? len : Number(pos);
        if (at < 1 || at > len) return null;
        const v = t[String(at)];
        for (let i = at; i < len; i += 1) t[String(i)] = t[String(i + 1)];
        delete t[String(len)];
        return v;
      },
      concat: ([t, sp], n) => {
        needTable(t, 'table.concat', n);
        const l = Array.isArray(t) ? t : Array.from({ length: seqLen(t) }, (x, i) => t[String(i + 1)]);
        return rt.checkStr(l.map((x) => str(x)).join(sp === undefined || sp === null ? '' : str(sp)), n);
      },
      find: ([t, v], n) => {
        needTable(t, 'table.find', n);
        if (Array.isArray(t)) { const i = t.findIndex((x) => x === v); return i < 0 ? null : i + 1; }
        for (let i = 1; i <= seqLen(t); i += 1) if (t[String(i)] === v) return i;
        return null;
      },
      clear: ([t], n) => { needTable(t, 'table.clear', n); if (Array.isArray(t)) t.length = 0; else Object.keys(t).forEach((k) => delete t[k]); return null; },
      sort: ([t], n) => { needTable(t, 'table.sort', n); if (Array.isArray(t)) t.sort((x, y) => (typeof x === 'number' && typeof y === 'number' ? x - y : str(x).localeCompare(str(y)))); return null; },
    });
    return g;
  }

  range(a, b, node) {
    if (typeof a !== 'number' || typeof b !== 'number') this.fail('Bereich a..b braucht Zahlen', node);
    const lo = Math.round(a);
    const hi = Math.round(b);
    if (Math.abs(hi - lo) + 1 > this.limits.list) this.fail(`Bereich zu groß (höchstens ${this.limits.list} Zahlen)`, node);
    const out = [];
    if (lo <= hi) for (let i = lo; i <= hi; i += 1) out.push(i); else for (let i = lo; i >= hi; i -= 1) out.push(i);
    return out;
  }

  // require(script.Parent.Texte) oder require("Texte")
  require(arg, node) {
    let inst;
    if (isInst(arg)) {
      if (arg.ClassName !== 'ModuleScript') this.fail(`„${arg.Name}“ ist ein ${arg.ClassName} – mit require lädt man nur ModuleScripts`, node);
      inst = arg;
    } else if (typeof arg === 'string' && arg.trim()) {
      const base = arg.trim().replace(/^\.\//, '').split('/').filter(Boolean).pop().replace(/\.luna$/i, '').toLowerCase();
      const all = [...this.tree.insts.values()].filter((x) => x.Name.toLowerCase() === base);
      const mods = all.filter((x) => x.ClassName === 'ModuleScript');
      if (mods.length > 1) this.fail(`Es gibt ${mods.length} ModuleScripts „${arg}“ – nimm den Pfad, z. B. require(script.Parent.${mods[0].Name})`, node);
      if (!mods.length) this.fail(all.length ? `„${all[0].Name}“ ist ein ${all[0].ClassName} – mit require lädt man nur ModuleScripts` : `ModuleScript „${arg}“ gibt es nicht`, node);
      [inst] = mods;
    } else this.fail('require() braucht ein ModuleScript, z. B. require(script.Parent.Texte)', node);
    const f = inst.item;
    if (this.modules.has(f.id)) return this.modules.get(f.id);
    if (this.loading.has(f.id)) this.fail(`Kreis bei require: „${f.name}“ lädt sich über andere Module selbst`, node);
    const parsed = cached(f.code);
    if (parsed.error) this.fail(`ModuleScript „${f.name}“ hat einen Fehler in Zeile ${parsed.error.line}: ${parsed.error.message}`, node);
    this.loading.add(f.id);
    const prevFile = this.file;
    const prevPhase = this.phase;
    this.file = f;
    this.phase = 'setup';
    let exports;
    try {
      const scope = new Scope(this.globalsFor(inst));
      const r = this.execBlock(parsed.ast, scope, true);
      if (r && r.signal === 'return') exports = r.value;
      else {
        exports = newObj();
        scope.vars.forEach((v, k) => { exports[k] = v; });
      }
    } finally {
      this.file = prevFile;
      this.phase = prevPhase;
      this.loading.delete(f.id);
    }
    this.modules.set(f.id, exports);
    return exports;
  }
  globalsFor(inst) {
    const s = new Scope(this.builtins);
    Object.keys(this.vars).forEach((k) => s.define(k, fromPlain(this.vars[k])));
    s.define('script', inst);
    return s;
  }

  // ----- Objekte aus dem Explorer -----
  instMember(o, name, node) {
    switch (name) {
      case 'Name': return o.Name;
      case 'ClassName': return o.ClassName;
      case 'Parent': return o.Parent || null;
      case 'Enabled': if (SCRIPT_CLASSES.has(o.ClassName)) return !(o.item && o.item.enabled === false); break;
      case 'Event': if (o.ClassName === 'Connector') return o; break;
      case 'Value': if (VALUE_CLASSES.has(o.ClassName)) return hasOwn(this.memory, valueKey(o)) ? this.memory[valueKey(o)] : valueOf(o.item.type, o.item.value); break;
      default: break;
    }
    const m = (fn) => new LNative(name, fn);
    switch (name) {
      case 'GetChildren': return m(() => [...o.children]);
      case 'GetDescendants': return m(() => { const out = []; const visit = (x) => x.children.forEach((c) => { out.push(c); visit(c); }); visit(o); return out; });
      case 'FindFirstChild': return m(([n2, deep]) => {
        if (!truthy(deep)) return childNamed(o, str(n2));
        const queue = [...o.children];
        while (queue.length) { const c = queue.shift(); if (c.Name === str(n2)) return c; queue.push(...c.children); }
        return null;
      });
      case 'FindFirstChildOfClass': return m(([c]) => o.children.find((x) => x.ClassName === str(c)) || null);
      case 'WaitForChild': return m(([n2], nd) => childNamed(o, str(n2)) || this.fail(`„${str(n2)}“ gibt es in „${o.Name}“ nicht`, nd));
      case 'IsA': return m(([c]) => isA(o, str(c)));
      case 'GetFullName': return m(() => fullName(o));
      default: break;
    }
    if (o.ClassName === 'Connector' && name === 'Connect') {
      return m(([fn], nd) => {
        if (!isFn(fn)) this.fail('Connect() braucht eine Funktion, z. B. Connect1:Connect(function(text) … end)', nd);
        const entry = { fn };
        o.listeners.push(entry);
        const conn = newObj();
        conn.Disconnect = new LNative('Disconnect', () => { o.listeners = o.listeners.filter((x) => x !== entry); return null; });
        return conn;
      });
    }
    if (o.ClassName === 'Connector' && name === 'Fire') {
      return m((a, nd) => {
        this.fires += 1;
        if (this.fires > this.limits.fire * 4) this.fail('Zu viele Fire()-Aufrufe in einem Ereignis', nd);
        if (this.depth > this.limits.fire * 3) this.fail('Connectors rufen sich gegenseitig zu oft auf', nd);
        [...o.listeners].forEach((l) => this.call(l.fn, a, nd, 'Listener'));
        return null;
      });
    }
    if (o.ClassName === 'Webhook' && (name === 'Send' || name === 'Post')) {
      return m((a, nd) => {
        if (this.side === 'client') this.fail('Webhooks senden nur Server- und GameScripts', nd);
        return this.output('webhook', a, nd, { id: o.item.id, name: o.Name });
      });
    }
    const child = childNamed(o, name);
    if (child) return child;
    return this.fail(`„${name}“ ist kein Kind und keine Eigenschaft von „${o.Name}“ (${o.ClassName})`, node);
  }

  // ----- Anweisungen -----
  execBlock(nodes, scope, top = false) {
    for (const s of nodes) if (s.k === 'func') scope.define(s.name, new LFunc(s.name, s.params, s.body, scope, this.file));
    for (const s of nodes) {
      if (s.k === 'func') continue;
      const r = this.exec(s, scope);
      if (r) {
        if (top && (r === BREAK || r === CONTINUE)) this.fail(`„${r.signal}“ außerhalb einer Schleife`, s);
        return r;
      }
    }
    return null;
  }
  loop(nodes, scope, set) {
    const inner = new Scope(scope);
    set(inner);
    const r = this.execBlock(nodes, inner);
    if (r === BREAK) return 'break';
    if (r && r !== CONTINUE) return r;
    return null;
  }
  exec(s, scope) {
    this.tick(s);
    switch (s.k) {
      case 'expr': this.eval(s.e, scope); return null;
      case 'let': {
        if (scope.vars.has(s.name) && scope.consts && scope.consts.has(s.name)) this.fail(`„${s.name}“ ist eine Konstante`, s);
        scope.define(s.name, s.init ? this.eval(s.init, scope) : null, s.constant);
        return null;
      }
      case 'assign': this.assign(s, scope); return null;
      case 'if':
        if (truthy(this.eval(s.test, scope))) return this.execBlock(s.cons, new Scope(scope));
        if (s.alt) return this.execBlock(s.alt, new Scope(scope));
        return null;
      case 'while':
        while (truthy(this.eval(s.test, scope))) {
          const r = this.loop(s.body, scope, () => {});
          if (r === 'break') break;
          if (r) return r;
        }
        return null;
      case 'repeat':
        for (;;) {
          const inner = new Scope(scope);
          const r = this.execBlock(s.body, inner);
          if (r === BREAK) break;
          if (r && r !== CONTINUE) return r;
          if (truthy(this.eval(s.test, inner))) break;
        }
        return null;
      case 'for': {
        const it = this.eval(s.iter, scope);
        let pairs;
        if (it instanceof LPairs) pairs = it.entries.map(([k, v]) => (s.b ? [k, v] : [v]));
        else if (Array.isArray(it)) pairs = it.map((v, i) => (s.b ? [i, v] : [v]));
        else if (typeof it === 'string') pairs = [...it].map((v, i) => (s.b ? [i, v] : [v]));
        else if (isObj(it)) pairs = Object.keys(it).map((k) => (s.b ? [keyOf(k), it[k]] : [keyOf(k)]));
        else if (isInst(it)) pairs = it.children.map((c, i) => (s.b ? [i + 1, c] : [c]));
        else if (typeof it === 'number') pairs = this.range(1, it, s).map((v) => [v]);
        else this.fail(`for … in braucht eine Liste, einen Text oder ein Objekt, nicht ${typeOf(it)}`, s);
        for (const [x, y] of pairs) {
          const r = this.loop(s.body, scope, (inner) => { inner.define(s.a, x); if (s.b) inner.define(s.b, y); });
          if (r === 'break') break;
          if (r) return r;
        }
        return null;
      }
      case 'fornum': {
        const from = this.eval(s.from, scope);
        const to = this.eval(s.to, scope);
        const step = s.step ? this.eval(s.step, scope) : 1;
        if (typeof from !== 'number' || typeof to !== 'number' || typeof step !== 'number') this.fail('for i = a, b braucht Zahlen', s);
        if (step === 0) this.fail('Schrittweite 0 geht nicht', s);
        for (let i = from; step > 0 ? i <= to : i >= to; i += step) {
          const r = this.loop(s.body, scope, (inner) => inner.define(s.name, i));
          if (r === 'break') break;
          if (r) return r;
        }
        return null;
      }
      case 'block': return this.execBlock(s.body, new Scope(scope));
      case 'return': return { signal: 'return', value: s.value ? this.eval(s.value, scope) : null };
      case 'break': return BREAK;
      case 'continue': return CONTINUE;
      case 'func': scope.define(s.name, new LFunc(s.name, s.params, s.body, scope, this.file)); return null;
      default: return this.fail('Unbekannte Anweisung', s);
    }
  }
  assign(s, scope) {
    const t = s.target;
    const compute = (old) => (s.op === '=' ? this.eval(s.value, scope) : this.binary(s.op[0], old, this.eval(s.value, scope), s));
    if (t.k === 'var') {
      const owner = scope.find(t.name);
      if (owner === this.builtins) this.fail(`„${t.name}“ ist eingebaut und kann nicht geändert werden`, s);
      if (owner && owner.consts && owner.consts.has(t.name)) this.fail(`„${t.name}“ ist eine Konstante`, s);
      if (!owner && s.op !== '=') this.fail(`„${t.name}“ gibt es noch nicht`, s);
      const v = compute(owner ? owner.vars.get(t.name) : null);
      let target = owner;
      if (!target) { target = scope; while (target.parent && target.parent !== this.builtins && target.parent.parent !== this.builtins) target = target.parent; }
      target.vars.set(t.name, v);
      return;
    }
    const obj = this.eval(t.obj, scope);
    // Werte-Objekte: script.Parent.Zaehler.Value = 5 (bleibt gespeichert)
    if (isInst(obj) && t.k === 'member' && t.name === 'Value' && VALUE_CLASSES.has(obj.ClassName)) {
      const cur = this.instMember(obj, 'Value', s);
      const v = compute(cur);
      const want = { BoolValue: 'boolean', IntValue: 'number', NumberValue: 'number', StringValue: 'string' }[obj.ClassName];
      if (typeof v !== want) this.fail(`${obj.ClassName}.Value braucht ${want === 'boolean' ? 'true/false' : want === 'number' ? 'eine Zahl' : 'einen Text'}, nicht ${typeOf(v)}`, s);
      if (this.side === 'client' && serviceOf(obj) !== 'ClientService') this.fail('ClientScripts können nur Werte im ClientService ändern', s);
      this.memory[valueKey(obj)] = valueOf(obj.item.type, v);
      this.memChanged = true;
      return;
    }
    if (isInst(obj)) this.fail(`Eigenschaften von „${obj.Name}“ stellt man im Editor ein, nicht im Skript`, s);
    if (t.k === 'member') {
      if (Array.isArray(obj)) this.fail(`.${t.name} = … geht nicht bei Listen – nimm ein Objekt {} oder table.insert`, s);
      if (!isObj(obj)) this.fail(`.${t.name} = … geht nur bei Objekten, nicht bei ${typeOf(obj)}`, s);
      if (!hasOwn(obj, t.name) && Object.keys(obj).length >= this.limits.keys) this.fail('Objekt zu groß', s);
      obj[t.name] = compute(hasOwn(obj, t.name) ? obj[t.name] : null);
      return;
    }
    const idx = this.eval(t.index, scope);
    if (Array.isArray(obj)) {
      if (typeof idx !== 'number' || !Number.isInteger(idx)) this.fail('Listen-Index muss eine ganze Zahl sein', s);
      const i = idx < 0 ? obj.length + idx : idx;
      if (i < 0 || i > obj.length) this.fail(`Index ${idx} liegt außerhalb der Liste (Länge ${obj.length})`, s);
      obj[i] = compute(i < obj.length ? obj[i] : null);
      this.checkList(obj, s);
      return;
    }
    if (isObj(obj)) {
      const k = str(idx);
      if (!hasOwn(obj, k) && Object.keys(obj).length >= this.limits.keys) this.fail('Objekt zu groß', s);
      const v = compute(hasOwn(obj, k) ? obj[k] : null);
      if (v === null) delete obj[k]; else obj[k] = v;
      return;
    }
    this.fail(`[…] = … geht nicht bei ${typeOf(obj)}`, s);
  }

  // ----- Ausdrücke -----
  eval(e, scope) {
    this.tick(e);
    switch (e.k) {
      case 'num': return e.v;
      case 'str': return this.checkStr(e.parts.map((x) => (typeof x === 'string' ? x : this.placeholder(x, scope))).join(''), e);
      case 'bool': return e.v;
      case 'nil': return null;
      case 'root': return this.tree.root;
      case 'var': {
        const owner = scope.find(e.name);
        if (!owner) this.fail(`„${e.name}“ gibt es nicht`, e);
        return owner.vars.get(e.name);
      }
      case 'list': return this.checkList(e.items.map((x) => this.eval(x, scope)), e);
      case 'obj': {
        const o = newObj();
        e.entries.forEach(([k, v, computed]) => { o[computed ? str(this.eval(k, scope)) : k] = this.eval(v, scope); });
        return o;
      }
      case 'lambda': return new LFunc(e.name || '', e.params, e.body, scope, this.file);
      case 'unary': {
        const v = this.eval(e.e, scope);
        if (e.op === '!') return !truthy(v);
        if (e.op === '#') {
          if (typeof v === 'string' || Array.isArray(v)) return v.length;
          if (isObj(v)) return seqLen(v);
          return this.fail(`# geht nicht bei ${typeOf(v)}`, e);
        }
        if (typeof v !== 'number') this.fail(`Minus geht nur mit Zahlen, nicht mit ${typeOf(v)}`, e);
        return -v;
      }
      case 'logic': {
        const l = this.eval(e.l, scope);
        if (e.op === 'and') return truthy(l) ? this.eval(e.r, scope) : l;
        return truthy(l) ? l : this.eval(e.r, scope);
      }
      case 'bin': return this.binary(e.op, this.eval(e.l, scope), this.eval(e.r, scope), e);
      case 'dots': {
        const l = this.eval(e.l, scope);
        const r = this.eval(e.r, scope);
        if (typeof l === 'number' && typeof r === 'number') return this.range(l, r, e);
        if (l === null || l === undefined || r === null || r === undefined) this.fail('.. geht nicht mit nil', e);
        return this.checkStr(str(l) + str(r), e);
      }
      case 'member': return this.member(this.eval(e.obj, scope), e.name, e);
      case 'index': {
        const o = this.eval(e.obj, scope);
        const i = this.eval(e.index, scope);
        if (Array.isArray(o) || typeof o === 'string') {
          if (typeof i !== 'number' || !Number.isInteger(i)) this.fail('Index muss eine ganze Zahl sein', e);
          const j = i < 0 ? o.length + i : i;
          return j >= 0 && j < o.length ? o[j] : null;
        }
        if (isObj(o)) { const k = str(i); return hasOwn(o, k) ? o[k] : null; }
        if (isInst(o)) return this.instMember(o, str(i), e);
        return this.fail(`[…] geht nicht bei ${typeOf(o)}`, e);
      }
      case 'call': {
        const fn = e.fn.k === 'member' ? this.member(this.eval(e.fn.obj, scope), e.fn.name, e.fn) : this.eval(e.fn, scope);
        const a = e.args.map((x) => this.eval(x, scope));
        return this.call(fn, a, e, e.fn.k === 'var' || e.fn.k === 'member' ? e.fn.name : '');
      }
      case 'mcall': {
        const self = this.eval(e.obj, scope);
        const fn = this.member(self, e.name, e);
        const a = e.args.map((x) => this.eval(x, scope));
        return this.call(fn, fn instanceof LFunc ? [self, ...a] : a, e, e.name);
      }
      default: return this.fail('Unbekannter Ausdruck', e);
    }
  }
  placeholder(x, scope) {
    const owner = scope.find(x.path[0]);
    if (!owner) return x.raw;
    let v = owner.vars.get(x.path[0]);
    for (const k of x.path.slice(1)) {
      if (isObj(v) && hasOwn(v, k)) v = v[k];
      else if ((Array.isArray(v) || typeof v === 'string') && k === 'length') v = v.length;
      else if (isInst(v) && INST_PROPS.has(k)) v = this.instMember(v, k);
      else if (isInst(v) && childNamed(v, k)) v = childNamed(v, k);
      else return x.raw;
    }
    return str(v);
  }
  call(fn, args, node, name = '') {
    if (fn instanceof LNative) {
      const r = fn.fn(args, node);
      return r === undefined ? null : r;
    }
    if (!(fn instanceof LFunc)) this.fail(`„${name || str(fn)}“ ist keine Funktion`, node);
    this.depth += 1;
    if (this.depth > this.limits.depth) this.fail('Zu viele verschachtelte Aufrufe', node);
    const prevFile = this.file;
    if (fn.file) this.file = fn.file;
    try {
      const s = new Scope(fn.scope);
      fn.params.forEach((p, i) => s.define(p, args[i] === undefined ? null : args[i]));
      const r = this.execBlock(fn.body, s);
      if (r === BREAK || r === CONTINUE) this.fail(`„${r.signal}“ außerhalb einer Schleife`, node);
      return r ? r.value : null;
    } finally {
      this.depth -= 1;
      this.file = prevFile;
    }
  }
  member(o, name, node) {
    if (o === null || o === undefined) this.fail(`.${name} geht nicht – der Wert ist nil`, node);
    if (isInst(o)) return this.instMember(o, name, node);
    if (isObj(o)) {
      if (hasOwn(o, name)) return o[name];
      const m = methodOf(OBJECT_METHODS, name);
      return m ? new LNative(name, (a, n) => m(this, o, a, n)) : null;
    }
    if (Array.isArray(o)) {
      if (name === 'length') return o.length;
      const m = methodOf(LIST_METHODS, name);
      if (!m) this.fail(`Listen haben kein „${name}“`, node);
      return new LNative(name, (a, n) => m(this, o, a, n));
    }
    if (typeof o === 'string') {
      if (name === 'length') return o.length;
      const m = methodOf(STRING_METHODS, name);
      if (!m) this.fail(`Texte haben kein „${name}“`, node);
      return new LNative(name, (a, n) => m(this, o, a, n));
    }
    return this.fail(`.${name} geht nicht bei ${typeOf(o)}`, node);
  }
  binary(op, l, r, node) {
    switch (op) {
      case '+':
        if (typeof l === 'number' && typeof r === 'number') return l + r;
        if (typeof l === 'string' || typeof r === 'string') return this.checkStr(str(l) + str(r), node);
        if (Array.isArray(l) && Array.isArray(r)) return this.checkList([...l, ...r], node);
        return this.fail(`${typeOf(l)} + ${typeOf(r)} geht nicht`, node);
      case '-': case '/': case '%':
        if (typeof l !== 'number' || typeof r !== 'number') this.fail(`${typeOf(l)} ${op} ${typeOf(r)} geht nicht`, node);
        if (op === '-') return l - r;
        if (r === 0) this.fail('Teilen durch 0 geht nicht', node);
        return op === '/' ? l / r : l % r;
      case '*':
        if (typeof l === 'number' && typeof r === 'number') return l * r;
        if (typeof l === 'string' && typeof r === 'number') {
          const times = Math.max(0, Math.floor(r));
          if (l.length * times > this.limits.str) this.fail(`Text zu lang (höchstens ${this.limits.str} Zeichen)`, node);
          return l.repeat(times);
        }
        return this.fail(`${typeOf(l)} * ${typeOf(r)} geht nicht`, node);
      case '==': return l === r || (l == null && r == null);
      case '!=': return !(l === r || (l == null && r == null));
      case '<': case '>': case '<=': case '>=': {
        if (!((typeof l === 'number' && typeof r === 'number') || (typeof l === 'string' && typeof r === 'string'))) this.fail(`${typeOf(l)} ${op} ${typeOf(r)} kann man nicht vergleichen`, node);
        return op === '<' ? l < r : op === '>' ? l > r : op === '<=' ? l <= r : l >= r;
      }
      default: return this.fail(`Unbekannter Operator ${op}`, node);
    }
  }
}

// Nur eigene Einträge – nie Object.prototype (constructor, toString, …)
const methodOf = (table, name) => (hasOwn(table, name) ? table[name] : null);
const STRING_METHODS = {
  upper: (rt, s) => s.toUpperCase(),
  lower: (rt, s) => s.toLowerCase(),
  trim: (rt, s) => s.trim(),
  len: (rt, s) => s.length,
  contains: (rt, s, [x]) => s.toLowerCase().includes(str(x).toLowerCase()),
  startsWith: (rt, s, [x]) => s.toLowerCase().startsWith(str(x).toLowerCase()),
  endsWith: (rt, s, [x]) => s.toLowerCase().endsWith(str(x).toLowerCase()),
  split: (rt, s, [x], n) => rt.checkList(s.split(x === undefined || x === null ? ' ' : str(x)).filter((v, i, l) => v !== '' || l.length === 1), n),
  replace: (rt, s, [a, b], n) => rt.checkStr(s.split(str(a)).join(str(b)), n),
  sub: (rt, s, [a, b]) => {
    const L = s.length;
    let i = typeof a === 'number' ? a : 1;
    let j = typeof b === 'number' ? b : -1;
    i = i < 0 ? L + i + 1 : i;
    j = j < 0 ? L + j + 1 : j;
    return i > j ? '' : s.slice(Math.max(i, 1) - 1, Math.min(j, L));
  },
  slice: (rt, s, [a, b]) => s.slice(typeof a === 'number' ? a : 0, typeof b === 'number' ? b : undefined),
  rep: (rt, s, [x], n) => rt.binary('*', s, Number(x) || 0, n),
  repeat: (rt, s, [x], n) => rt.binary('*', s, Number(x) || 0, n),
  format: (rt, s, [o], n) => rt.checkStr(renderTemplate(s, isObj(o) ? o : {}), n),
};
const LIST_METHODS = {
  push: (rt, l, a, n) => { l.push(...a); rt.checkList(l, n); return l.length; },
  pop: (rt, l) => (l.length ? l.pop() : null),
  first: (rt, l) => (l.length ? l[0] : null),
  last: (rt, l) => (l.length ? l[l.length - 1] : null),
  contains: (rt, l, [x]) => l.some((v) => v === x),
  indexOf: (rt, l, [x]) => l.findIndex((v) => v === x),
  join: (rt, l, [sep], n) => rt.checkStr(l.map((v) => str(v)).join(sep === undefined || sep === null ? ', ' : str(sep)), n),
  remove: (rt, l, [i]) => { const j = typeof i === 'number' ? (i < 0 ? l.length + i : i) : -1; return j >= 0 && j < l.length ? l.splice(j, 1)[0] : null; },
  random: (rt, l) => (l.length ? l[Math.floor(Math.random() * l.length)] : null),
  reverse: (rt, l) => [...l].reverse(),
  sort: (rt, l) => [...l].sort((x, y) => (typeof x === 'number' && typeof y === 'number' ? x - y : str(x).localeCompare(str(y)))),
  slice: (rt, l, [a, b]) => l.slice(typeof a === 'number' ? a : 0, typeof b === 'number' ? b : undefined),
};
const OBJECT_METHODS = {
  keys: (rt, o) => Object.keys(o),
  values: (rt, o) => Object.keys(o).map((k) => o[k]),
  has: (rt, o, [k]) => hasOwn(o, str(k)),
};

// Platzhalter in einfachen Vorlagen: {username}, {server}, … – Unbekanntes bleibt stehen
export function renderTemplate(tpl, vars) {
  return String(tpl || '').replace(/\{\{|\}\}|\{\s*([A-Za-z_À-ɏ][\wÀ-ɏ]*(?:\.[\wÀ-ɏ]+)*)\s*\}/g, (m, path) => {
    if (m === '{{') return '{';
    if (m === '}}') return '}';
    let v = vars;
    for (const k of path.split('.')) {
      if (v && typeof v === 'object' && hasOwn(v, k)) v = v[k];
      else return m;
    }
    return str(v);
  }).slice(0, LIMITS.text);
}

// ---------- Prüfen ohne Ausführen: Ereignisse, Pfade, Brücken, Lage im Explorer ----------
function walk(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((x) => walk(x, fn)); return; }
  if (node.k) fn(node);
  Object.keys(node).forEach((k) => { if (k !== 'scope' && k !== 'parts') { const v = node[k]; if (v && typeof v === 'object') walk(v, fn); } });
}
function outlineAst(r, type) {
  const handlers = [];
  const functions = [];
  const warnings = [];
  r.ast.forEach((s) => {
    if (s.k !== 'func') return;
    const ev = handlerEvent(s.name);
    if (ev === null && /^on[A-Z_]/.test(s.name)) warnings.push({ line: s.line, message: `Unbekanntes Ereignis ${s.name}() – möglich: ${(EVENTS[type] || []).map((x) => `on${x}()`).join(', ') || 'keine'}` });
    if (ev !== null) {
      handlers.push({ name: s.name, event: ev, line: s.line });
      if (type === 'module') warnings.push({ line: s.line, message: 'ModuleScripts haben keine Ereignisse – die laufen nur in Server-, Client- und GameScripts' });
      else if (!(EVENTS[type] || []).includes(ev)) warnings.push({ line: s.line, message: `${s.name}() gibt es in ${TYPES[type]}s nicht – möglich: ${EVENTS[type].map((x) => `on${x}()`).join(', ')}` });
    } else functions.push({ name: s.name, line: s.line, params: s.params });
  });
  return { handlers, functions, warnings };
}
export function outline(code, type = 'server') {
  const r = cached(code);
  if (r.error) return { ok: false, error: r.error, handlers: [], functions: [], requires: [], warnings: [] };
  const o = outlineAst(r, type);
  const requires = [];
  walk(r.ast, (n) => {
    if (n.k === 'call' && n.fn.k === 'var' && n.fn.name === 'require' && n.args[0] && n.args[0].k === 'str' && n.args[0].parts.every((x) => typeof x === 'string')) requires.push({ name: n.args[0].parts.join(''), line: n.line });
  });
  return { ok: true, ...o, requires };
}
// Pfade wie script.Parent.Texte oder ../MyBot.ConnectorService.Connect1 aus dem Code sammeln
function chainOf(n) {
  const steps = [];
  let x = n;
  while (x.k === 'member') { steps.unshift(x.name); x = x.obj; }
  if (x.k === 'root') return { base: 'root', steps };
  if (x.k === 'var' && x.name === 'script') return { base: 'script', steps };
  return null;
}
function collectPaths(ast) {
  const out = [];
  const visit = (n, inRequire = false) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach((x) => visit(x)); return; }
    if (n.k === 'member') {
      const c = chainOf(n);
      if (c) { out.push({ ...c, line: n.line, inRequire }); return; }
    }
    if (n.k === 'call' && n.fn.k === 'var' && n.fn.name === 'require') { n.args.forEach((a, i) => visit(a, i === 0)); return; }
    Object.keys(n).forEach((k) => { if (k !== 'parts') { const v = n[k]; if (v && typeof v === 'object') visit(v); } });
  };
  visit(ast);
  return out;
}
export function pathText(c) {
  return c.base === 'root' ? `../${c.steps.join('.')}` : ['script', ...c.steps].join('.');
}
function resolveChain(tree, fileNode, c) {
  let node = c.base === 'root' ? tree.root : fileNode;
  for (const step of c.steps) {
    if (step === 'Parent') {
      if (!node.Parent || node.Parent.ClassName === 'DataModel') return { problem: `„${node.Name}“ hat kein Parent darüber` };
      node = node.Parent;
      continue;
    }
    if (INST_PROPS.has(step) || INST_METHOD_NAMES.has(step)) return { node };
    const child = childNamed(node, step);
    if (!child) return { problem: `„${step}“ gibt es in „${node.Name}“ nicht` };
    node = child;
  }
  return { node };
}
// Alles prüfen: { checks: { id: { ok, error, warnings, handlers, functions } }, bridges: [{ from, to, kind, name, line, ok, problem }] }
export function analyze(files, botName = 'Bot') {
  const list = (files || []).filter((f) => f && f.id);
  const tree = buildTree(list, botName, (cls, name, item) => ({ ClassName: cls, Name: name, item, Parent: null, children: [] }));
  const checks = {};
  const found = [];
  const seen = new Set();
  const add = (b) => { const key = `${b.from}|${b.to}|${b.kind}|${b.ok ? '' : b.name}`; if (seen.has(key)) return; seen.add(key); found.push(b); };
  const modsNamed = (name) => list.filter((x) => x.type === 'module' && x.name.toLowerCase() === name.split('/').pop().toLowerCase());
  list.filter((f) => SCRIPT_TYPES.includes(f.type)).forEach((f) => {
    const node = tree.insts.get(f.id);
    const r = cached(f.code);
    const warnings = [];
    const svc = serviceOf(node);
    if (RUNS_IN[f.type] && svc !== RUNS_IN[f.type]) warnings.push({ line: 1, message: `${TYPES[f.type]}s laufen nur in ${RUNS_IN[f.type]} – „${f.name}“ liegt in ${svc || 'keinem Service'} und läuft deshalb nicht` });
    if (f.enabled === false) warnings.push({ line: 1, message: `„${f.name}“ ist ausgeschaltet (Eigenschaft Enabled)` });
    if (r.error) {
      // Mit Tippfehler: require("…") per Suche finden, damit Brücken sichtbar bleiben
      String(f.code || '').split('\n').forEach((l, i) => {
        const re = /require\(\s*["„“”'‚‘’`]([^"“”'‘’`\n]{1,80})["“”'‘’`]\s*\)/g;
        let m;
        while ((m = re.exec(l))) {
          const mods = modsNamed(m[1]);
          add({ from: f.id, to: mods.length === 1 ? mods[0].id : null, kind: 'require', name: `require("${m[1]}")`, line: i + 1, ok: mods.length === 1, problem: mods.length === 1 ? null : `ModuleScript „${m[1]}“ gibt es nicht` });
        }
      });
      checks[f.id] = { ok: false, error: r.error, warnings, handlers: [], functions: [] };
      return;
    }
    const o = outlineAst(r, f.type);
    checks[f.id] = { ok: true, error: null, warnings: [...warnings, ...o.warnings], handlers: o.handlers, functions: o.functions };
    walk(r.ast, (n) => {
      if (n.k === 'call' && n.fn.k === 'var' && n.fn.name === 'require' && n.args[0] && n.args[0].k === 'str' && n.args[0].parts.every((x) => typeof x === 'string')) {
        const name = n.args[0].parts.join('');
        const mods = modsNamed(name);
        add({ from: f.id, to: mods.length === 1 ? mods[0].id : null, kind: 'require', name: `require("${name}")`, line: n.line, ok: mods.length === 1, problem: mods.length === 1 ? null : mods.length ? `${mods.length} ModuleScripts heißen „${name}“ – nimm den Pfad` : `ModuleScript „${name}“ gibt es nicht` });
      }
    });
    collectPaths(r.ast).forEach((c) => {
      const res = resolveChain(tree, node, c);
      const name = pathText(c);
      if (res.problem) { add({ from: f.id, to: null, kind: c.inRequire ? 'require' : 'path', name, line: c.line, ok: false, problem: res.problem }); return; }
      const { item } = res.node;
      if (c.inRequire) {
        if (!item || item.type !== 'module') add({ from: f.id, to: null, kind: 'require', name, line: c.line, ok: false, problem: `„${res.node.Name}“ ist ein ${res.node.ClassName} – mit require lädt man nur ModuleScripts` });
        else add({ from: f.id, to: item.id, kind: 'require', name, line: c.line, ok: true, problem: null });
      } else if (item && (item.type === 'connector' || item.type === 'webhook')) add({ from: f.id, to: item.id, kind: item.type, name, line: c.line, ok: true, problem: null });
    });
  });
  return { checks, bridges: found };
}
export function bridges(files, botName) {
  return analyze(files, botName).bridges;
}

// ---------- Ausführen ----------
// files: alle Objekte des Bots · type: Skriptart, deren Ereignis läuft · event: z. B. 'join' · vars: Platzhalter
// Vorher laufen alle Skripte derselben Seite einmal an (Backend: Server + Game, App: Client), damit Connectors verbunden sind.
// Ergebnis: { says, discords, webhooks, logs, errors, memory, memChanged, ran }
export function runEvent({ files, type, event, vars = {}, args = [], memory = {}, limits, only = null, botName = 'Bot' }) {
  const side = type === 'client' ? 'client' : 'backend';
  const rt = new Runtime({ files, vars, memory, limits, botName, side });
  const types = side === 'client' ? ['client'] : ['server', 'game'];
  const runnable = [];
  rt.tree.insts.forEach((inst) => {
    const f = inst.item;
    if (!types.includes(f.type) || (f.enabled === false && only !== f.id)) return;
    if (serviceOf(inst) === RUNS_IN[f.type] || only === f.id) runnable.push(inst);
  });
  let ran = 0;
  const scopes = new Map();
  for (const inst of runnable) {
    const f = inst.item;
    rt.file = f;
    const parsed = cached(f.code);
    if (parsed.error) { rt.errors.push({ file: f.name, fileId: f.id, ...parsed.error, parse: true }); continue; }
    if (only === f.id && serviceOf(inst) !== RUNS_IN[f.type]) rt.log(`„${f.name}“ läuft im Bot nicht, weil es nicht in ${RUNS_IN[f.type]} liegt – hier nur zum Testen`, 'warn', 1);
    try {
      rt.phase = 'setup';
      const scope = new Scope(rt.globalsFor(inst));
      rt.execBlock(parsed.ast, scope, true);
      scopes.set(f.id, scope);
    } catch (e) {
      if (!(e instanceof LunaError)) throw e;
      rt.errors.push({ file: rt.file ? rt.file.name : f.name, fileId: rt.file ? rt.file.id : f.id, message: e.message, line: e.line, col: e.col });
      rt.log(`Zeile ${e.line}: ${e.message}`, 'error', e.line);
    }
  }
  for (const inst of runnable) {
    const f = inst.item;
    if (f.type !== type || (only && only !== f.id) || !scopes.has(f.id)) continue;
    let handler = null;
    scopes.get(f.id).vars.forEach((v, k) => { if (!handler && v instanceof LFunc && handlerEvent(k) === event) handler = v; });
    if (!handler) continue;
    ran += 1;
    rt.file = f;
    try {
      rt.phase = 'event';
      rt.depth = 0;
      rt.call(handler, args.map(fromPlain), { line: handler.body[0] ? handler.body[0].line : 0, col: 0 }, handler.name);
    } catch (e) {
      if (!(e instanceof LunaError)) throw e;
      rt.errors.push({ file: rt.file ? rt.file.name : f.name, fileId: rt.file ? rt.file.id : f.id, message: e.message, line: e.line, col: e.col });
      rt.log(`Zeile ${e.line}: ${e.message}`, 'error', e.line);
    } finally {
      rt.phase = 'setup';
      rt.file = f;
    }
  }
  return { says: rt.says, discords: rt.discords, webhooks: rt.webhooks, logs: rt.logs, errors: rt.errors, memory: plain(rt.memory), memChanged: rt.memChanged, ran };
}

// ---------- Luna ohne Bot: ein einzelnes Skript ausführen (Playground, andere Projekte) ----------
// print() schreibt hier sofort in die Ausgabe, auch außerhalb von Ereignissen. Ereignisse, die das Skript definiert
// (onstart, onjoin …), lassen sich mit events nacheinander auslösen: [{ event: 'join', args: ['Lok_Max'] }].
// Ergebnis: { output: [{ kind: out | log | warn | error, text, line }], says, errors, steps, ran }
export function runScript(code, { vars = {}, events = [], limits, name = 'Skript' } = {}) {
  const files = [{ id: 'main', name, type: 'server', parent: 'ServerScriptService', code: String(code || '') }];
  const rt = new Runtime({ files, vars, memory: {}, limits: { steps: 50000, says: 50, logs: 150, ...(limits || {}) }, botName: 'Playground', side: 'backend' });
  rt.free = true;
  let inst = null;
  rt.tree.insts.forEach((x) => { if (x.item && x.item.id === 'main') inst = x; });
  rt.file = files[0];
  const parsed = cached(files[0].code);
  const done = () => ({
    output: rt.logs.map((x) => ({ kind: x.kind, line: x.line, text: x.kind === 'out' ? x.text.replace(/^💬 /, '') : x.text })),
    says: rt.says, errors: rt.errors, steps: rt.steps, ran,
  });
  let ran = 0;
  if (parsed.error) {
    rt.errors.push({ ...parsed.error, parse: true });
    rt.log(`Zeile ${parsed.error.line}: ${parsed.error.message}`, 'error', parsed.error.line);
    return done();
  }
  const scope = new Scope(rt.globalsFor(inst));
  const guard = (fn) => {
    try { fn(); return true; } catch (e) {
      if (!(e instanceof LunaError)) throw e;
      rt.errors.push({ message: e.message, line: e.line, col: e.col });
      rt.log(`Zeile ${e.line}: ${e.message}`, 'error', e.line);
      return false;
    }
  };
  if (!guard(() => rt.execBlock(parsed.ast, scope, true))) return done();
  for (const ev of events) {
    let handler = null;
    scope.vars.forEach((v, k) => { if (!handler && v instanceof LFunc && handlerEvent(k) === ev.event) handler = v; });
    if (!handler) continue;
    ran += 1;
    rt.phase = 'event';
    rt.depth = 0;
    const ok = guard(() => rt.call(handler, (ev.args || []).map(fromPlain), { line: handler.body[0] ? handler.body[0].line : 0, col: 0 }, handler.name));
    rt.phase = 'setup';
    if (!ok) break;
  }
  return done();
}

// ---------- Farben im Editor ----------
const BUILTIN_NAMES = new Set(['print', 'embed', 'say', 'reply', 'discord', 'log', 'warn', 'error', 'assert', 'require', 'len', 'str', 'num', 'type', 'typeof', 'tostring', 'tonumber', 'pairs', 'ipairs', 'upper', 'lower', 'trim', 'contains', 'startsWith', 'endsWith', 'split', 'join', 'replace', 'format', 'random', 'round', 'floor', 'ceil', 'abs', 'sqrt', 'min', 'max', 'keys', 'values', 'has', 'range', 'now', 'time', 'date', 'weekday', 'save', 'load']);
const LIB_NAMES = new Set(['math', 'string', 'table']);
const VAR_NAMES = new Set(DOCS.vars.map(([n]) => n).filter((n) => n !== 'script'));
export function highlight(src) {
  const out = [];
  const s = String(src || '');
  let i = 0;
  const push = (kind, text) => { if (text) out.push([kind, text]); };
  while (i < s.length) {
    const ch = s[i];
    const rest = s.slice(i, i + 200);
    let m;
    if (rest.startsWith('--[[')) { const end = s.indexOf(']]', i + 4); const j = end < 0 ? s.length : end + 2; push('com', s.slice(i, j)); i = j; continue; }
    if (rest.startsWith('/*')) { const end = s.indexOf('*/', i + 2); const j = end < 0 ? s.length : end + 2; push('com', s.slice(i, j)); i = j; continue; }
    if (rest.startsWith('//') || rest.startsWith('--')) { const end = s.indexOf('\n', i); const j = end < 0 ? s.length : end; push('com', s.slice(i, j)); i = j; continue; }
    if (rest.startsWith('../')) { push('path', '../'); i += 3; continue; }
    if (OPEN_DQ.includes(ch) || OPEN_SQ.includes(ch) || ch === '`') {
      const close = ch === '`' ? '`' : OPEN_DQ.includes(ch) ? CLOSE_DQ : CLOSE_SQ;
      let j = i + 1;
      let buf = ch;
      while (j < s.length && !close.includes(s[j])) {
        if (s[j] === '\\' && j + 1 < s.length) { buf += s[j] + s[j + 1]; j += 2; continue; }
        if (s[j] === '{') {
          const pm = s.slice(j, j + 80).match(PLACEHOLDER);
          if (pm) { push('str', buf); buf = ''; push('ph', pm[0]); j += pm[0].length; continue; }
        }
        buf += s[j];
        j += 1;
      }
      if (j < s.length) { buf += s[j]; j += 1; }
      push('str', buf);
      i = j;
      continue;
    }
    if ((m = rest.match(/^[0-9][0-9_]*(?:\.[0-9]+)?/))) { push('num', m[0]); i += m[0].length; continue; }
    if ((m = rest.match(/^[A-Za-z_À-ɏ][A-Za-z0-9_À-ɏ]*/))) {
      const w = m[0];
      const after = /^\s*\(/.test(s.slice(i + w.length, i + w.length + 40));
      const prev = out.length ? out[out.length - 1] : null;
      const afterDot = !!prev && prev[0] === 'op' && (prev[1] === '.' || prev[1] === ':');
      let kind;
      if (KEYWORDS.has(w) && !afterDot) kind = 'kw';
      else if ((w === 'script' || w === 'self') && !afterDot) kind = 'self';
      else if (SERVICES.includes(w) || (afterDot && w === 'Parent')) kind = 'svc';
      else if (/^on[_A-Za-z]/.test(w) && after && !afterDot) kind = 'ev';
      else if (!afterDot && (BUILTIN_NAMES.has(w) || LIB_NAMES.has(w)) && (after || LIB_NAMES.has(w))) kind = 'fn';
      else if (after) kind = 'call';
      else if (!afterDot && VAR_NAMES.has(w)) kind = 'var';
      else kind = afterDot ? 'prop' : 'id';
      push(kind, w);
      i += w.length;
      continue;
    }
    if ((m = rest.match(/^\s+/))) { push('ws', m[0]); i += m[0].length; continue; }
    push(/[{}()[\]]/.test(ch) ? 'br' : 'op', ch);
    i += 1;
  }
  return out;
}

// Vorlagen für neue Skripte
export const TEMPLATES = {
  server: `-- ServerScript – läuft im Backend, wenn im Chat etwas passiert.
-- script.Parent ist der ServerScriptService, script.Parent.Parent dein Bot.

onjoin(username) {
  print("Willkommen {username} auf {server}!")
}

oncommand(command, args) {
  if command == "regeln" {
    print("Bitte halte dich an die Regeln von {server}.")
  }
}
`,
  client: `-- ClientScript – läuft in der App von jedem, der den Chat öffnet.
-- Was print() hier schreibt, sieht nur diese Person.

onopen(username) {
  print("Hallo {displayName}! Schön, dass du da bist.")
}
`,
  module: `-- ModuleScript – Bausteine für andere Skripte.
-- Laden mit: local NAME = require(script.Parent.NAME)
local NAME = {}

function NAME.gruss(name) {
  return "Willkommen " .. name .. "!"
}

return NAME
`,
  game: `-- GameScript – läuft, wenn in einem verbundenen privaten Server etwas passiert.

onjoin(username) {
  print("{username} ist auf {server} ({players} Spieler) – {game}, Spiel-ID {gameId}")
}
`,
};
