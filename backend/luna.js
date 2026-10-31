/*
 * Luna – die Skriptsprache für eigene Bots in Train Sim Germany
 *
 * Läuft im Backend (ServerScripts und GameScripts) und in der App (ClientScripts, Testen im Editor) – dieselbe Datei.
 * Eigener Interpreter: kein eval, kein Zugriff auf JavaScript, Grenzen für Schritte, Tiefe, Länge und Ausgaben.
 *
 *   onjoin() {
 *     print("Willkommen {username} auf {server}!")
 *   }
 *
 * Kurz:
 *   let x = 5 · x += 1 · const NAME = "TSG"            Variablen (local/var gehen auch)
 *   if x > 3 { … } else if … { … } else { … }           Bedingungen (Klammern dürfen, müssen nicht)
 *   while x < 10 { … } · for item in liste { … }        Schleifen, auch for i in 1..5 und for i = 1, 10
 *   function name(a, b) { return a + b }                Funktionen – oder kurz: name(a, b) { … }
 *   onjoin() { … }                                      Ereignis (je nach Skriptart, siehe EVENTS)
 *   "Hallo {username}"                                  Platzhalter in Texten
 *   let texte = require("Texte")                        Modulscript laden (Name oder Pfad „Module/Texte“)
 *   // Kommentar · -- Kommentar · /* Kommentar *\/
 */

export const TYPES = { server: 'ServerScript', client: 'ClientScript', module: 'ModulScript', game: 'GameScript' };
export const FOLDERS = { server: 'Server', client: 'Client', module: 'Module', game: 'Game' };
export const EVENTS = {
  server: ['start', 'join', 'leave', 'message', 'command'],
  game: ['start', 'join', 'leave'],
  client: ['open', 'message'],
  module: [],
};
// Werte, die jedes Ereignis mitbringt (für Hilfe und Vervollständigung)
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
    ['args', 'Wörter nach dem Befehl (Liste)'], ['bot', 'Name des Bots'], ['time', 'Uhrzeit, z. B. 18:42'], ['date', 'Datum, z. B. 31.10.2026'],
  ],
  functions: [
    ['print(text)', 'Nachricht des Bots in den Chat (ClientScript: nur für die Person)'], ['reply(text)', 'Wie print'],
    ['discord(text)', 'Nachricht nach Discord (wenn verbunden und angenommen)'], ['log(text)', 'Nur ins Protokoll im Editor'],
    ['require("Name")', 'Modulscript laden'], ['save(key, wert)', 'Wert merken (bleibt erhalten)'], ['load(key, standard)', 'Gemerkten Wert lesen'],
    ['random(a, b)', 'Zufallszahl von a bis b – random(liste) wählt ein Element'], ['len(x)', 'Länge von Text, Liste oder Objekt'],
    ['format(text, objekt)', 'Platzhalter mit Werten aus einem Objekt füllen'], ['str(x) · num(x) · type(x)', 'Umwandeln, Typ'],
    ['upper(t) · lower(t) · trim(t)', 'Text ändern'], ['contains(a, b) · split(t, sep) · join(l, sep) · replace(t, a, b)', 'Text und Listen'],
    ['round(x) · floor(x) · ceil(x) · abs(x) · min(…) · max(…)', 'Rechnen'], ['keys(o) · values(o) · has(o, key)', 'Objekte'],
    ['now() · time() · date() · weekday()', 'Zeit (deutsche Zeit)'], ['error(text)', 'Skript mit Fehlermeldung beenden'],
  ],
};

export const LIMITS = { steps: 10000, depth: 60, str: 4000, list: 2000, keys: 200, says: 5, text: 1900, memory: 8000, memKeys: 50, logs: 40 };

export class LunaError extends Error {
  constructor(message, line = 0, col = 0) {
    super(message);
    this.line = line;
    this.col = col;
  }
}

// ---------- Lexer ----------
const KEYWORDS = new Set(['let', 'local', 'var', 'const', 'function', 'fn', 'return', 'if', 'else', 'elseif', 'while', 'for', 'in', 'break', 'continue', 'true', 'false', 'nil', 'null', 'and', 'or', 'not']);
const OPEN_DQ = '"„“”';
const CLOSE_DQ = '"“”';
const OPEN_SQ = "'‚‘’";
const CLOSE_SQ = "'‘’";
const ID_START = /[A-Za-z_À-ɏ]/;
const ID_PART = /[A-Za-z0-9_À-ɏ]/;
const OPS = ['==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/=', '..', '+', '-', '*', '/', '%', '<', '>', '=', '!', '(', ')', '{', '}', '[', ']', ',', '.', ':', ';'];
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
  while (i < n) {
    const ch = src[i];
    if (ch === '\n') { adv(); nl = true; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === ' ') { adv(); continue; }
    if ((ch === '/' && src[i + 1] === '/') || (ch === '-' && src[i + 1] === '-')) { while (i < n && src[i] !== '\n') adv(); continue; }
    if (ch === '/' && src[i + 1] === '*') {
      const l = line;
      const c = col;
      adv(); adv();
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) adv();
      if (i >= n) throw new LunaError('Kommentar wird nicht mit */ beendet', l, c);
      adv(); adv();
      continue;
    }
    const tok = { line, col, nl };
    nl = false;
    if (/[0-9]/.test(ch)) {
      let s = '';
      while (i < n && /[0-9]/.test(src[i])) { s += src[i]; adv(); }
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
    if (dq || OPEN_SQ.includes(ch)) {
      const close = dq ? CLOSE_DQ : CLOSE_SQ;
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
  // Nach einem Wert in ( … ), [ … ] oder { … }: Komma, Ende – oder die Klammer wurde nie geschlossen
  const sep = (close, open, what) => {
    if (isOp(close)) return;
    if (isOp(',')) { next(); return; }
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
    const body = [];
    while (!isOp('}')) {
      if (peek().t === 'eof') fail('„}“ fehlt – der Block wird nicht geschlossen', open);
      const s = statement();
      if (s) body.push(s);
    }
    next();
    return body;
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
    return { k: 'func', name, params: ps, body: block(), ...at(k) };
  }
  function ifStmt() {
    const k = next();
    const test = expr();
    const cons = block();
    let alt = null;
    if (isKw('else')) {
      next();
      alt = isKw('if') ? [ifStmt()] : block();
    } else if (isKw('elseif')) {
      alt = [ifStmt()];
    }
    return { k: 'if', test, cons, alt, ...at(k) };
  }
  function forStmt() {
    const k = next();
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
      return { k: 'fornum', name: a, from, to, step, body: block(), ...at(k) };
    }
    let b = null;
    if (isOp(',')) { next(); b = ident(); }
    if (!isKw('in')) fail(`„in“ erwartet, gefunden: ${describe(peek())}`);
    next();
    const iter = expr();
    if (paren) expectOp(')');
    return { k: 'for', a, b, iter, body: block(), ...at(k) };
  }
  function statement() {
    const k = peek();
    if (isOp(';')) { next(); return null; }
    if (k.t === 'kw') {
      switch (k.v) {
        case 'let': case 'local': case 'var': case 'const': {
          next();
          const name = ident(`nach „${k.v}“`);
          let init = null;
          if (isOp('=')) { next(); init = expr(); }
          return { k: 'let', name, init, constant: k.v === 'const', ...at(k) };
        }
        case 'function': case 'fn':
          if (peek(1).t === 'id') { next(); const name = next().v; return funcDecl(name, k); }
          break;
        case 'return': {
          next();
          let value = null;
          if (!peek().nl && !isOp('}') && !isOp(';') && peek().t !== 'eof') value = expr();
          return { k: 'return', value, ...at(k) };
        }
        case 'if': return ifStmt();
        case 'while': { next(); const test = expr(); return { k: 'while', test, body: block(), ...at(k) }; }
        case 'for': return forStmt();
        case 'break': case 'continue': next(); return { k: k.v, ...at(k) };
        case 'else': case 'elseif': fail('„else“ ohne passendes „if“'); break;
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
    while (isOp('==') || isOp('!=')) { const k = next(); l = { k: 'bin', op: k.v, l, r: cmpE(), ...at(k) }; }
    return l;
  }
  function cmpE() {
    let l = rangeE();
    while (isOp('<') || isOp('>') || isOp('<=') || isOp('>=')) { const k = next(); l = { k: 'bin', op: k.v, l, r: rangeE(), ...at(k) }; }
    return l;
  }
  function rangeE() {
    const l = addE();
    if (isOp('..')) { const k = next(); return { k: 'range', l, r: addE(), ...at(k) }; }
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
    if (isOp('-') || isOp('!') || isKw('not')) {
      const k = next();
      return { k: 'unary', op: k.v === '-' ? '-' : '!', e: unary(), ...at(k) };
    }
    return postfix();
  }
  function postfix() {
    let e = primary();
    for (;;) {
      if (isOp('(') && !peek().nl) {
        const k = next();
        const args = [];
        while (!isOp(')')) {
          if (peek().t === 'eof') fail(`„)“ fehlt – die Klammer aus Zeile ${k.line} wird nicht geschlossen`, k);
          args.push(expr());
          sep(')', k, 'die Klammer');
        }
        next();
        e = { k: 'call', fn: e, args, ...at(k) };
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
  function primary() {
    const k = peek();
    if (k.t === 'num') { next(); return { k: 'num', v: k.v, ...at(k) }; }
    if (k.t === 'str') { next(); return { k: 'str', parts: k.parts, ...at(k) }; }
    if (k.t === 'id') { next(); return { k: 'var', name: k.v, ...at(k) }; }
    if (k.t === 'kw') {
      if (k.v === 'true' || k.v === 'false') { next(); return { k: 'bool', v: k.v === 'true', ...at(k) }; }
      if (k.v === 'nil' || k.v === 'null') { next(); return { k: 'nil', ...at(k) }; }
      if (k.v === 'function' || k.v === 'fn') { next(); const ps = params(); return { k: 'lambda', params: ps, body: block(), ...at(k) }; }
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
    if (isOp('{')) {
      next();
      const entries = [];
      while (!isOp('}')) {
        const kk = peek();
        let key;
        if (kk.t === 'id' || kk.t === 'kw') key = next().v;
        else if (kk.t === 'str') { next(); key = kk.parts.map((x) => (typeof x === 'string' ? x : x.raw)).join(''); } else if (kk.t === 'num') key = String(next().v);
        else fail(`Schlüssel erwartet, gefunden: ${describe(kk)}`);
        if (isOp(':') || isOp('=')) { next(); entries.push([key, expr()]); } else if (kk.t === 'id') entries.push([key, { k: 'var', name: key, ...at(kk) }]);
        else fail('„:“ erwartet');
        sep('}', k, 'das Objekt');
      }
      next();
      return { k: 'obj', entries, ...at(k) };
    }
    return fail(`Unerwartet: ${describe(k)}`);
  }

  const body = [];
  while (peek().t !== 'eof') {
    const s = statement();
    if (s) body.push(s);
  }
  return body;
}

// Prüfen ohne Ausführen: { ok, error: { line, col, message } }
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
  constructor(name, params, body, scope) { this.name = name; this.params = params; this.body = body; this.scope = scope; }
}
class LNative {
  constructor(name, fn) { this.name = name; this.fn = fn; }
}
const isFn = (v) => v instanceof LFunc || v instanceof LNative;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && !isFn(v);
const newObj = () => Object.create(null);
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
export function typeOf(v) {
  if (v === null || v === undefined) return 'nil';
  if (Array.isArray(v)) return 'list';
  if (isFn(v)) return 'function';
  if (isObj(v)) return 'object';
  return typeof v;
}
const truthy = (v) => !(v === null || v === undefined || v === false || v === 0 || v === '');
function num(v) {
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 1e10) / 1e10);
}
export function str(v, depth = 0) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? num(v) : 'nan';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (isFn(v)) return `function ${v.name || ''}`.trim();
  if (depth > 3) return '…';
  if (Array.isArray(v)) return v.map((x) => str(x, depth + 1)).join(', ');
  return `{${Object.keys(v).map((k) => `${k}: ${typeof v[k] === 'string' ? `"${v[k]}"` : str(v[k], depth + 1)}`).join(', ')}}`;
}
// Werte für den Speicher (nur Daten, keine Funktionen)
function plain(v, depth = 0) {
  if (depth > 6) throw new LunaError('Zu tief verschachtelt zum Speichern');
  if (v === null || v === undefined || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v === undefined ? null : v;
  if (Array.isArray(v)) return v.map((x) => plain(x, depth + 1));
  if (isFn(v)) throw new LunaError('Funktionen kann man nicht speichern');
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
// onjoin, onJoin, on_join → 'join' (nur bekannte Ereignisse; online() bleibt eine normale Funktion)
const ALL_EVENTS = new Set(Object.values(EVENTS).flat());
const handlerEvent = (name) => {
  const ev = /^on/i.test(name) ? name.slice(2).replace(/_/g, '').toLowerCase() : '';
  return ALL_EVENTS.has(ev) ? ev : null;
};

const BERLIN = 'Europe/Berlin';
function clock(opts) {
  try { return new Intl.DateTimeFormat('de-DE', { timeZone: BERLIN, ...opts }).format(new Date()); } catch (e) { return new Intl.DateTimeFormat('de-DE', opts).format(new Date()); }
}

// ---------- Interpreter ----------
class Runtime {
  constructor(opts) {
    this.files = opts.files || [];
    this.vars = opts.vars || {};
    this.memory = fromPlain(opts.memory || {});
    this.memChanged = false;
    this.steps = 0;
    this.depth = 0;
    this.says = [];
    this.discords = [];
    this.logs = [];
    this.errors = [];
    this.phase = 'setup';
    this.file = null;
    this.modules = new Map();
    this.loading = new Set();
    this.warned = new Set();
    this.limits = { ...LIMITS, ...(opts.limits || {}) };
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
  output(kind, args, node) {
    const text = args.map((x) => str(x)).join(' ').slice(0, this.limits.text);
    if (this.phase !== 'event') {
      this.warnOnce(`${kind}-setup`, `${kind === 'say' ? 'print()' : 'discord()'} außerhalb eines Ereignisses wird ignoriert – schreib es z. B. in onjoin() { … }`, node);
      return;
    }
    if (!text.trim()) return;
    const list = kind === 'say' ? this.says : this.discords;
    if (list.length >= this.limits.says) {
      this.warnOnce(`${kind}-max`, `Höchstens ${this.limits.says} Nachrichten pro Ereignis`, node);
      return;
    }
    list.push(text);
    this.log(`${kind === 'say' ? '💬' : '🎮 Discord:'} ${text}`, 'out', node ? node.line : 0);
  }

  makeBuiltins() {
    const g = new Scope();
    const rt = this;
    const def = (name, fn) => g.define(name, new LNative(name, fn));
    const needStr = (v, fname, node) => {
      if (typeof v !== 'string') rt.fail(`${fname}() braucht einen Text, nicht ${typeOf(v)}`, node);
      return v;
    };
    const needNum = (v, fname, node) => {
      if (typeof v !== 'number') rt.fail(`${fname}() braucht eine Zahl, nicht ${typeOf(v)}`, node);
      return v;
    };
    def('print', (a, n) => rt.output('say', a, n));
    def('say', (a, n) => rt.output('say', a, n));
    def('reply', (a, n) => rt.output('say', a, n));
    def('discord', (a, n) => rt.output('discord', a, n));
    def('log', (a, n) => { rt.log(a.map((x) => str(x)).join(' '), 'log', n.line); return null; });
    def('error', (a, n) => rt.fail(str(a[0]) || 'Fehler', n));
    def('require', (a, n) => rt.require(a[0], n));
    def('len', ([v], n) => {
      if (typeof v === 'string' || Array.isArray(v)) return v.length;
      if (isObj(v)) return Object.keys(v).length;
      return rt.fail(`len() geht nicht mit ${typeOf(v)}`, n);
    });
    def('str', ([v]) => str(v));
    def('num', ([v]) => { const x = typeof v === 'number' ? v : Number(String(v).replace(',', '.')); return Number.isFinite(x) && String(v).trim() !== '' ? x : null; });
    def('type', ([v]) => typeOf(v));
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
      const lo = Math.ceil(needNum(a, 'random', n));
      const hi = b === undefined || b === null ? lo : Math.floor(needNum(b, 'random', n));
      const [x, y] = b === undefined || b === null ? [1, lo] : [lo, hi];
      return x + Math.floor(Math.random() * (y - x + 1));
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

  // Modulscripts: require("Texte") oder require("Module/Texte")
  require(name, node) {
    if (typeof name !== 'string' || !name.trim()) this.fail('require() braucht den Namen eines Modulscripts', node);
    const target = resolveModule(this.files, name);
    if (!target.file) this.fail(target.problem, node);
    const f = target.file;
    if (this.modules.has(f.id)) return this.modules.get(f.id);
    if (this.loading.has(f.id)) this.fail(`Kreis bei require: „${f.name}“ lädt sich über andere Module selbst`, node);
    const parsed = cached(f.code);
    if (parsed.error) this.fail(`Modulscript „${f.name}“ hat einen Fehler in Zeile ${parsed.error.line}: ${parsed.error.message}`, node);
    this.loading.add(f.id);
    const prevFile = this.file;
    const prevPhase = this.phase;
    this.file = f;
    this.phase = 'setup';
    let exports;
    try {
      const scope = new Scope(this.globalsFor());
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
  globalsFor() {
    const s = new Scope(this.builtins);
    Object.keys(this.vars).forEach((k) => s.define(k, fromPlain(this.vars[k])));
    return s;
  }

  // ----- Anweisungen -----
  execBlock(body, scope, top = false) {
    // Funktionen gelten im ganzen Block (auch vor ihrer Zeile)
    for (const s of body) if (s.k === 'func') scope.define(s.name, new LFunc(s.name, s.params, s.body, scope));
    for (const s of body) {
      if (s.k === 'func') continue;
      const r = this.exec(s, scope);
      if (r) {
        if (top && (r === BREAK || r === CONTINUE)) this.fail(`„${r.signal}“ außerhalb einer Schleife`, s);
        return r;
      }
    }
    return null;
  }
  exec(s, scope) {
    this.tick(s);
    switch (s.k) {
      case 'expr': this.eval(s.e, scope); return null;
      case 'let': {
        const own = scope.vars.has(s.name) && scope.consts && scope.consts.has(s.name);
        if (own) this.fail(`„${s.name}“ ist eine Konstante`, s);
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
          const r = this.execBlock(s.body, new Scope(scope));
          if (r === BREAK) break;
          if (r && r !== CONTINUE) return r;
        }
        return null;
      case 'for': {
        const it = this.eval(s.iter, scope);
        let pairs;
        if (Array.isArray(it)) pairs = it.map((v, i) => (s.b ? [i, v] : [v]));
        else if (typeof it === 'string') pairs = [...it].map((v, i) => (s.b ? [i, v] : [v]));
        else if (isObj(it)) pairs = Object.keys(it).map((k) => (s.b ? [k, it[k]] : [k]));
        else if (typeof it === 'number') pairs = this.range(1, it, s).map((v) => [v]);
        else this.fail(`for … in braucht eine Liste, einen Text oder ein Objekt, nicht ${typeOf(it)}`, s);
        for (const [x, y] of pairs) {
          const inner = new Scope(scope);
          inner.define(s.a, x);
          if (s.b) inner.define(s.b, y);
          const r = this.execBlock(s.body, inner);
          if (r === BREAK) break;
          if (r && r !== CONTINUE) return r;
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
          const inner = new Scope(scope);
          inner.define(s.name, i);
          const r = this.execBlock(s.body, inner);
          if (r === BREAK) break;
          if (r && r !== CONTINUE) return r;
        }
        return null;
      }
      case 'block': return this.execBlock(s.body, new Scope(scope));
      case 'return': return { signal: 'return', value: s.value ? this.eval(s.value, scope) : null };
      case 'break': return BREAK;
      case 'continue': return CONTINUE;
      case 'func': scope.define(s.name, new LFunc(s.name, s.params, s.body, scope)); return null;
      default: return this.fail('Unbekannte Anweisung', s);
    }
  }
  assign(s, scope) {
    const t = s.target;
    const compute = (old) => (s.op === '=' ? this.eval(s.value, scope) : this.binary(s.op[0], old, this.eval(s.value, scope), s));
    if (t.k === 'var') {
      const owner = scope.find(t.name);
      if (owner === this.builtins) this.fail(`„${t.name}“ ist eine eingebaute Funktion`, s);
      if (owner && owner.consts && owner.consts.has(t.name)) this.fail(`„${t.name}“ ist eine Konstante`, s);
      if (!owner && s.op !== '=') this.fail(`„${t.name}“ gibt es noch nicht`, s);
      const v = compute(owner ? owner.vars.get(t.name) : null);
      // Neue Namen ohne let landen im Skript (wie globale Variablen)
      let target = owner;
      if (!target) { target = scope; while (target.parent && target.parent !== this.builtins && target.parent.parent !== this.builtins) target = target.parent; }
      target.vars.set(t.name, v);
      return;
    }
    const obj = this.eval(t.obj, scope);
    if (t.k === 'member') {
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
      const v = compute(i < obj.length ? obj[i] : null);
      obj[i] = v;
      this.checkList(obj, s);
      return;
    }
    if (isObj(obj)) {
      const k = str(idx);
      if (!hasOwn(obj, k) && Object.keys(obj).length >= this.limits.keys) this.fail('Objekt zu groß', s);
      obj[k] = compute(hasOwn(obj, k) ? obj[k] : null);
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
      case 'var': {
        const owner = scope.find(e.name);
        if (!owner) this.fail(`„${e.name}“ gibt es nicht`, e);
        return owner.vars.get(e.name);
      }
      case 'list': return this.checkList(e.items.map((x) => this.eval(x, scope)), e);
      case 'obj': {
        const o = newObj();
        e.entries.forEach(([k, v]) => { o[k] = this.eval(v, scope); });
        return o;
      }
      case 'lambda': return new LFunc('', e.params, e.body, scope);
      case 'unary': {
        const v = this.eval(e.e, scope);
        if (e.op === '!') return !truthy(v);
        if (typeof v !== 'number') this.fail(`Minus geht nur mit Zahlen, nicht mit ${typeOf(v)}`, e);
        return -v;
      }
      case 'logic': {
        const l = this.eval(e.l, scope);
        if (e.op === 'and') return truthy(l) ? this.eval(e.r, scope) : l;
        return truthy(l) ? l : this.eval(e.r, scope);
      }
      case 'bin': return this.binary(e.op, this.eval(e.l, scope), this.eval(e.r, scope), e);
      case 'range': return this.range(this.eval(e.l, scope), this.eval(e.r, scope), e);
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
        return this.fail(`[…] geht nicht bei ${typeOf(o)}`, e);
      }
      case 'call': {
        let fn;
        let self;
        if (e.fn.k === 'member') {
          self = this.eval(e.fn.obj, scope);
          fn = this.member(self, e.fn.name, e.fn);
        } else fn = this.eval(e.fn, scope);
        const args = e.args.map((a) => this.eval(a, scope));
        return this.call(fn, args, e, e.fn.k === 'var' ? e.fn.name : e.fn.k === 'member' ? e.fn.name : '');
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
    try {
      const s = new Scope(fn.scope);
      fn.params.forEach((p, i) => s.define(p, args[i] === undefined ? null : args[i]));
      const r = this.execBlock(fn.body, s);
      if (r === BREAK || r === CONTINUE) this.fail(`„${r.signal}“ außerhalb einer Schleife`, node);
      return r ? r.value : null;
    } finally {
      this.depth -= 1;
    }
  }
  member(o, name, node) {
    if (o === null || o === undefined) this.fail(`.${name} geht nicht – der Wert ist nil`, node);
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
      case '==': return l === r || (l === null && r === undefined) || (l === undefined && r === null);
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
  contains: (rt, s, [x]) => s.toLowerCase().includes(str(x).toLowerCase()),
  startsWith: (rt, s, [x]) => s.toLowerCase().startsWith(str(x).toLowerCase()),
  endsWith: (rt, s, [x]) => s.toLowerCase().endsWith(str(x).toLowerCase()),
  split: (rt, s, [x], n) => rt.checkList(s.split(x === undefined || x === null ? ' ' : str(x)).filter((v, i, l) => v !== '' || l.length === 1), n),
  replace: (rt, s, [a, b], n) => rt.checkStr(s.split(str(a)).join(str(b)), n),
  sub: (rt, s, [a, b]) => s.slice(typeof a === 'number' ? a : 0, typeof b === 'number' ? b : undefined),
  slice: (rt, s, [a, b]) => s.slice(typeof a === 'number' ? a : 0, typeof b === 'number' ? b : undefined),
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

// ---------- Brücken: welche Skripte laden welche Modulscripts? ----------
const FOLDER_ALIASES = { server: ['server', 'serverscript', 'serverscripts'], client: ['client', 'clientscript', 'clientscripts'], module: ['module', 'modul', 'modules', 'modulscript', 'modulscripts', 'modulescript', 'modulescripts'], game: ['game', 'gamescript', 'gamescripts', 'spiel'] };
export function resolveModule(files, name) {
  const parts = String(name).trim().replace(/^\.\//, '').split('/').filter(Boolean);
  const base = (parts.pop() || '').replace(/\.luna$/i, '').toLowerCase();
  const folder = (parts.pop() || '').toLowerCase();
  const hits = (files || []).filter((f) => String(f.name).toLowerCase() === base);
  const want = folder ? Object.keys(FOLDER_ALIASES).find((k) => FOLDER_ALIASES[k].includes(folder)) : null;
  if (folder && !want) return { problem: `Ordner „${parts.concat(folder).join('/')}“ gibt es nicht – nimm Module/${base}` };
  const mod = hits.find((f) => f.type === 'module');
  if (mod && (!want || want === 'module')) return { file: mod };
  const other = hits[0];
  if (other) return { problem: `„${other.name}“ ist ein ${TYPES[other.type]} – mit require kann man nur Modulscripts laden` };
  return { problem: `Modulscript „${name}“ gibt es nicht` };
}
function walk(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((x) => walk(x, fn)); return; }
  if (node.k) fn(node);
  Object.keys(node).forEach((k) => { if (k !== 'scope') { const v = node[k]; if (v && typeof v === 'object') walk(v, fn); } });
}
// Übersicht über ein Skript: Ereignisse, Funktionen, require
export function outline(code, type = 'server') {
  const r = cached(code);
  if (r.error) {
    // Auch mit Tippfehler: require("…") per Suche finden, damit die Brücken sichtbar bleiben
    const requires = [];
    String(code || '').split('\n').forEach((l, i) => {
      const re = /require\(\s*["„“”'‚‘’]([^"“”'‘’\n]{1,80})["“”'‘’]\s*\)/g;
      let m;
      while ((m = re.exec(l))) requires.push({ name: m[1], line: i + 1 });
    });
    return { ok: false, error: r.error, handlers: [], functions: [], requires, warnings: [] };
  }
  const handlers = [];
  const functions = [];
  const warnings = [];
  r.ast.forEach((s) => {
    if (s.k !== 'func') return;
    const ev = handlerEvent(s.name);
    if (ev === null && /^on[A-Z_]/.test(s.name)) warnings.push({ line: s.line, message: `Unbekanntes Ereignis ${s.name}() – möglich: ${EVENTS[type].map((x) => `on${x}()`).join(', ') || 'keine'}` });
    if (ev !== null) {
      handlers.push({ name: s.name, event: ev, line: s.line });
      if (type === 'module') warnings.push({ line: s.line, message: 'Modulscripts haben keine Ereignisse – das läuft nur in Server-, Client- und GameScripts' });
      else if (!EVENTS[type].includes(ev)) warnings.push({ line: s.line, message: `${s.name}() gibt es in ${TYPES[type]}s nicht – möglich: ${EVENTS[type].map((x) => `on${x}()`).join(', ')}` });
    } else functions.push({ name: s.name, line: s.line, params: s.params });
  });
  const requires = [];
  walk(r.ast, (n) => {
    if (n.k === 'call' && n.fn.k === 'var' && n.fn.name === 'require' && n.args[0] && n.args[0].k === 'str' && n.args[0].parts.every((x) => typeof x === 'string')) {
      requires.push({ name: n.args[0].parts.join(''), line: n.line });
    }
  });
  return { ok: true, handlers, functions, requires, warnings };
}
export function bridges(files) {
  const out = [];
  (files || []).forEach((f) => {
    outline(f.code, f.type).requires.forEach((rq) => {
      const t = resolveModule(files, rq.name);
      out.push({ from: f.id, to: t.file ? t.file.id : null, name: rq.name, line: rq.line, ok: !!t.file, problem: t.problem || null });
    });
  });
  return out;
}

// ---------- Ausführen ----------
// files: [{ id, name, type, code }] · type: Skriptart · event: z. B. 'join' · vars: Platzhalter · args: Werte für den Handler
// Ergebnis: { says, discords, logs, errors, memory, memChanged, ran }
export function runEvent({ files, type, event, vars = {}, args = [], memory = {}, limits, only = null }) {
  const rt = new Runtime({ files, vars, memory, limits });
  let ran = 0;
  const list = (files || []).filter((f) => f.type === type && (!only || only === f.id));
  for (const f of list) {
    const parsed = cached(f.code);
    rt.file = f;
    if (parsed.error) { rt.errors.push({ file: f.name, fileId: f.id, ...parsed.error, parse: true }); continue; }
    try {
      rt.phase = 'setup';
      const scope = new Scope(rt.globalsFor());
      rt.execBlock(parsed.ast, scope, true);
      let handler = null;
      scope.vars.forEach((v, k) => { if (!handler && v instanceof LFunc && handlerEvent(k) === event) handler = v; });
      if (!handler) continue;
      ran += 1;
      rt.phase = 'event';
      rt.depth = 0;
      rt.call(handler, args.map(fromPlain), { line: handler.body[0] ? handler.body[0].line : 0, col: 0 }, handler.name);
    } catch (e) {
      if (!(e instanceof LunaError)) throw e;
      rt.errors.push({ file: f.name, fileId: f.id, message: e.message, line: e.line, col: e.col });
      rt.log(`Zeile ${e.line}: ${e.message}`, 'error', e.line);
    } finally {
      rt.phase = 'setup';
    }
  }
  return { says: rt.says, discords: rt.discords, logs: rt.logs, errors: rt.errors, memory: plain(rt.memory), memChanged: rt.memChanged, ran };
}

// ---------- Farben im Editor ----------
// Zerlegt Code in Abschnitte [art, text] – auch unfertigen Code, ohne Fehler zu werfen
const BUILTIN_NAMES = new Set(['print', 'say', 'reply', 'discord', 'log', 'error', 'require', 'len', 'str', 'num', 'type', 'upper', 'lower', 'trim', 'contains', 'startsWith', 'endsWith', 'split', 'join', 'replace', 'format', 'random', 'round', 'floor', 'ceil', 'abs', 'sqrt', 'min', 'max', 'keys', 'values', 'has', 'range', 'now', 'time', 'date', 'weekday', 'save', 'load']);
const VAR_NAMES = new Set(DOCS.vars.map(([n]) => n));
export function highlight(src) {
  const out = [];
  const s = String(src || '');
  let i = 0;
  const push = (kind, text) => { if (text) out.push([kind, text]); };
  while (i < s.length) {
    const ch = s[i];
    const rest = s.slice(i);
    let m;
    if ((m = rest.match(/^(\/\/|--)[^\n]*/))) { push('com', m[0]); i += m[0].length; continue; }
    if (rest.startsWith('/*')) { const end = s.indexOf('*/', i + 2); const j = end < 0 ? s.length : end + 2; push('com', s.slice(i, j)); i = j; continue; }
    if (OPEN_DQ.includes(ch) || OPEN_SQ.includes(ch)) {
      const close = OPEN_DQ.includes(ch) ? CLOSE_DQ : CLOSE_SQ;
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
    if ((m = rest.match(/^[0-9]+(?:\.[0-9]+)?/))) { push('num', m[0]); i += m[0].length; continue; }
    if ((m = rest.match(/^[A-Za-z_À-ɏ][A-Za-z0-9_À-ɏ]*/))) {
      const w = m[0];
      const after = s.slice(i + w.length).match(/^\s*\(/);
      const kind = KEYWORDS.has(w) ? 'kw' : /^on[_A-Za-z]/.test(w) && after ? 'ev' : BUILTIN_NAMES.has(w) && after ? 'fn' : after ? 'call' : VAR_NAMES.has(w) ? 'var' : 'id';
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

// Vorlagen für neue Dateien
export const TEMPLATES = {
  server: `// ServerScript – läuft im Backend, wenn im Chat etwas passiert
onjoin() {
  print("Willkommen {username} auf {server}!")
}

oncommand(command, args) {
  if command == "regeln" {
    print("Bitte halte dich an die Regeln von {server}.")
  }
}
`,
  client: `// ClientScript – läuft in der App von jedem, der den Chat öffnet.
// Was print() hier schreibt, sieht nur diese Person.
onopen() {
  print("Hallo {displayName}! Schön, dass du da bist.")
}
`,
  module: `// ModulScript – Bausteine für andere Skripte.
// Laden mit: let texte = require("NAME")
function begruessung(name) {
  return "Willkommen " + name + "!"
}
`,
  game: `// GameScript – läuft, wenn in einem verbundenen privaten Server etwas passiert
onjoin() {
  print("{username} ist auf {server} ({players} Spieler) – {game}, Spiel-ID {gameId}")
}
`,
};
