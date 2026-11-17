/* Train Sim Germany – App-Logik (Routing, Live-Daten, Rendering) */
(function () {
  'use strict';

  const D = window.TSG;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  // ---------- Hilfsfunktionen ----------
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Flaticon UIcons, z. B. icon('ph-house')
  const icon = (name, cls = '') => `<i class="i ${name} ic ${cls}" aria-hidden="true"></i>`;
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* Speicher nicht verfügbar */ }
    },
  };

  // ---------- Bewegung & Haptik ----------
  // Animationen (aus, wenn das Gerät „Bewegung reduzieren“ meldet oder sie in den Einstellungen aus sind) und
  // spürbares Feedback beim Tippen: Vibration (Android) bzw. der System-Schalter von iOS (Safari ab 17.4).
  const fx = { haptics: store.get('tsg-haptics', true) !== false, motion: store.get('tsg-motion', true) !== false, season: store.get('tsg-season', true) !== false };
  document.documentElement.dataset.motion = fx.motion ? 'on' : 'off';
  const reducedMotion = () => !fx.motion || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const canVibrate = typeof navigator.vibrate === 'function';
  const isApple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const hapticsAvailable = () => canVibrate || isApple;
  const HAPTIC = { tap: 8, select: 12, success: [12, 70, 20], warn: [20, 80, 20], error: [30, 60, 30, 60, 30] };
  let iosSwitch = null;
  function haptic(kind = 'tap') {
    if (!fx.haptics) return;
    try {
      if (canVibrate) { navigator.vibrate(HAPTIC[kind] || 8); return; }
      if (!isApple) return;
      if (!iosSwitch) {
        iosSwitch = document.createElement('label');
        iosSwitch.className = 'haptic-switch';
        iosSwitch.setAttribute('aria-hidden', 'true');
        iosSwitch.innerHTML = '<input type="checkbox" switch tabindex="-1">';
        document.body.appendChild(iosSwitch);
      }
      iosSwitch.click();
    } catch (e) { /* ohne Feedback */ }
  }
  function setHaptics(on, { quiet = false } = {}) {
    fx.haptics = !!on;
    store.set('tsg-haptics', fx.haptics);
    if (!quiet) { settingsChanged(); if (on) haptic('success'); }
    renderFxSettings();
  }
  function setMotion(on, { quiet = false } = {}) {
    fx.motion = !!on;
    store.set('tsg-motion', fx.motion);
    document.documentElement.dataset.motion = on ? 'on' : 'off';
    if (!quiet) settingsChanged();
    renderFxSettings();
  }
  function renderFxSettings() {
    const box = $('[data-fx]');
    if (!box) return;
    const sysReduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const row = (attr, title, text, on, off, note) => `<label class="toggle${off ? ' is-disabled' : ''}">
        <span class="toggle__text"><b>${title}</b><small>${text}</small>${note ? `<small class="toggle__note">${icon('ph-info')}${note}</small>` : ''}</span>
        <input type="checkbox" role="switch" ${attr}${on ? ' checked' : ''}${off ? ' disabled' : ''}>
        <span class="toggle__ui" aria-hidden="true"></span>
      </label>`;
    box.innerHTML = row('data-fx-motion', t('Animationen'), t('Seitenwechsel, Karten, Zahlen und Sheets bewegen sich weich.'), fx.motion, false,
      sysReduced ? t('Dein Gerät ist auf „Bewegung reduzieren“ gestellt – Animationen bleiben deshalb aus.') : '')
      + row('data-fx-haptics', t('Haptisches Feedback'), t('Ein leichtes Vibrieren beim Tippen, Kaufen und Verfolgen.'), fx.haptics && hapticsAvailable(), !hapticsAvailable(),
        hapticsAvailable() ? '' : t('Dieses Gerät kann nicht vibrieren.'));
  }

  // Elemente erscheinen nacheinander – nur nach einer Eingabe (Tippen, Seitenwechsel), nicht bei Aktualisierungen im Hintergrund
  let lastInput = Date.now();
  ['pointerdown', 'keydown', 'hashchange'].forEach((ev) => window.addEventListener(ev, () => { lastInput = Date.now(); }, true));
  function reveal(box) {
    if (!box || reducedMotion() || Date.now() - lastInput > 1500) return;
    Array.from(box.children).forEach((el, i) => el.style.setProperty('--i', Math.min(i, 14)));
    box.classList.remove('is-revealing');
    void box.offsetWidth;
    box.classList.add('is-revealing');
    clearTimeout(box.revealTimer);
    box.revealTimer = setTimeout(() => box.classList.remove('is-revealing'), 1400);
  }
  // Zahlen zählen vom letzten angezeigten Wert (beim ersten Mal von 0) zum neuen hoch
  const countMemo = new Map();
  function countUp(root) {
    if (!root) return;
    $$('[data-count]', root).forEach((el) => {
      const to = +el.dataset.count || 0;
      const key = el.dataset.countKey || '';
      const from = key && countMemo.has(key) ? countMemo.get(key) : 0;
      if (key) countMemo.set(key, to);
      const f = FORMATS[el.dataset.fmt] || FORMATS.fmt;
      if (from === to || reducedMotion()) { el.textContent = f(to); return; }
      const t0 = performance.now();
      const dur = Math.min(1200, 600 + Math.log10(Math.abs(to - from) + 1) * 120);
      el.textContent = f(from);
      const step = (nowT) => {
        const k = Math.min(1, (nowT - t0) / dur);
        el.textContent = f(from + (to - from) * (1 - Math.pow(1 - k, 3)));
        if (k < 1 && el.isConnected) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  // Münzen fliegen nach einem Kauf aus dem Knopf
  function coinBurst(x, y) {
    if (reducedMotion()) return;
    const layer = document.createElement('div');
    layer.className = 'coin-burst';
    layer.style.left = `${x}px`;
    layer.style.top = `${y}px`;
    for (let i = 0; i < 16; i++) {
      const c = document.createElement('i');
      const a = (Math.PI * 2 * i) / 16 + Math.random() * 0.5;
      const d = 50 + Math.random() * 80;
      c.style.setProperty('--dx', `${(Math.cos(a) * d).toFixed(1)}px`);
      c.style.setProperty('--dy', `${(Math.sin(a) * d - 50).toFixed(1)}px`);
      c.style.setProperty('--r', `${Math.round(Math.random() * 540 - 270)}deg`);
      c.style.animationDelay = `${Math.round(Math.random() * 80)}ms`;
      layer.appendChild(c);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 1300);
  }
  // Welle beim Tippen auf Knöpfe, Chips und Karten
  document.addEventListener('pointerdown', (e) => {
    if (reducedMotion() || e.button > 0) return;
    const el = e.target.closest('.btn, .chip, .head-tabs button, .head-tabs a, .segmented button, .menu__nav a, .svc__people, .pcard, .sp-row, .sx-card__open, .station, .sd-btn');
    if (!el || el.disabled) return;
    const host = el.classList.contains('sx-card__open') ? el.parentElement : el;
    const r = host.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    host.appendChild(dot);
    setTimeout(() => dot.remove(), 650);
  }, { passive: true });
  // Leichtes Tippen bei jedem Knopf, Reiter, Chip und Schalter
  document.addEventListener('click', (e) => {
    const el = e.target.closest('button, a[href], [role="tab"], .chip, input[type="checkbox"], input[type="radio"], summary');
    if (!el || el.disabled || el.closest('.haptic-switch') || (el.matches('input') && el.closest('label') && e.target !== el)) return;
    haptic(el.matches('input, [role="tab"], .chip, [role="switch"]') ? 'select' : 'tap');
  }, true);

  // ---------- Sprache ----------
  // Ausgangstext ist Deutsch. Übersetzungen: assets/js/i18n/<sprache>.js ({ "deutscher Text": "Übersetzung" }).
  // „auto“ übernimmt die Sprache des Geräts; wird sie nicht angeboten, gilt Englisch.
  const LANGS = [
    { code: 'de', name: 'Deutsch', flag: 'de', locale: 'de-DE' },
    { code: 'en', name: 'English', flag: 'gb', locale: 'en-GB' },
    { code: 'fr', name: 'Français', flag: 'fr', locale: 'fr-FR' },
    { code: 'es', name: 'Español', flag: 'es', locale: 'es-ES' },
    { code: 'it', name: 'Italiano', flag: 'it', locale: 'it-IT' },
    { code: 'nl', name: 'Nederlands', flag: 'nl', locale: 'nl-NL' },
    { code: 'pl', name: 'Polski', flag: 'pl', locale: 'pl-PL' },
    { code: 'tr', name: 'Türkçe', flag: 'tr', locale: 'tr-TR' },
  ];
  const langOf = (code) => LANGS.find((l) => l.code === code);
  function deviceLang() {
    for (const l of navigator.languages || [navigator.language || 'de']) {
      const hit = langOf(String(l).slice(0, 2).toLowerCase());
      if (hit) return hit.code;
    }
    return 'en';
  }
  const langSetting = () => (langOf(store.get('tsg-lang', 'auto')) ? store.get('tsg-lang', 'auto') : 'auto');
  let lang = 'de';
  let locale = 'de-DE';
  let dict = {};
  // t('Text') bzw. t('Noch {n} Plätze', { n: 3 }) – fehlt eine Übersetzung, bleibt der deutsche Text
  function t(s, vars) {
    let out = (lang !== 'de' && dict[s]) || s;
    if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return out;
  }

  // Zahlen und Daten im Format der gewählten Sprache
  let nf = new Intl.NumberFormat(locale);
  let nf1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  let nfc = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  const fmt = (n) => nf.format(n);
  const compact = (n) => (n >= 1e3 ? nfc.format(n) : fmt(n));
  const dtf = (opts) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...opts });
  const fmtDate = (ts) => new Intl.DateTimeFormat(locale).format(new Date(ts));
  const pct = (v, digits = 0) => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: digits }).format(v / 100);
  function setLocale() {
    locale = langOf(lang).locale;
    nf = new Intl.NumberFormat(locale);
    nf1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    nfc = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  const AVATAR_COLORS = [
    ['#EC0016', '#9B000E'], ['#1455C0', '#0C3992'], ['#408335', '#2A5A22'], ['#814997', '#5A2F6B'],
    ['#F39200', '#B35900'], ['#A9455D', '#74283A'], ['#00A099', '#006A65'], ['#646973', '#3C414B'],
  ];
  function initials(name) {
    const parts = name.replace(/[^A-Za-zÄÖÜäöüß_ ]/g, '').split(/[_ ]+/).filter(Boolean);
    if (!parts.length) return name.slice(0, 2);
    return parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
  }
  function avatar(name, cls = '') {
    const [a1, a2] = AVATAR_COLORS[hash(name) % AVATAR_COLORS.length];
    return `<span class="avatar ${cls}" style="--a1:${a1};--a2:${a2}" aria-hidden="true">${esc(initials(name))}</span>`;
  }

  // Spielzeit = Uhrzeit in Deutschland
  const berlinFmt = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  function berlinNow() {
    const p = {};
    berlinFmt.formatToParts(new Date()).forEach((x) => { p[x.type] = x.value; });
    const y = +p.year, mo = +p.month, d = +p.day, h = +p.hour % 24, m = +p.minute, s = +p.second;
    const day = Math.floor(Date.UTC(y, mo - 1, d) / 864e5);
    return { y, mo, d, h, m, s, day, abs: day * 1440 + h * 60 + m, absSec: (day * 1440 + h * 60 + m) * 60 + s };
  }
  const hhmm = (abs) => { const m = ((abs % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
  const dateOf = (day) => new Date(day * 864e5); // UTC-Datum des Kalendertags
  const wdShort = (day) => dtf({ weekday: 'short' }).format(dateOf(day)).replace(/\.$/, '');
  const wdLong = (day) => dtf({ weekday: 'long' }).format(dateOf(day));
  // Kurzer Wochentag ab Montag (0 = Mo … 6 = So), z. B. für den Tage-Regler
  const dayShort = (i) => wdShort(19723 + i); // 19723 = Montag, 1. Januar 2024
  function dayName(day, { long = false } = {}) {
    const today = berlinNow().day;
    const dt = dateOf(day);
    const dm = dtf({ day: 'numeric', month: 'long' }).format(dt);
    if (day === today) return long ? `${t('Heute')}, ${dm}` : t('Heute');
    if (day === today + 1) return long ? `${t('Morgen')}, ${dm}` : t('Morgen');
    return long ? dtf({ weekday: 'long', day: 'numeric', month: 'long' }).format(dt) : dtf({ weekday: 'short', day: 'numeric', month: 'short' }).format(dt);
  }
  function relTime(absMin) {
    const diff = absMin - berlinNow().abs;
    if (diff <= 0) return t('läuft gerade');
    if (diff < 60) return t('in {n} Min.', { n: diff });
    if (diff < 24 * 60) return t('in {n} Std.', { n: Math.round(diff / 60) });
    const d = Math.round(diff / 1440);
    return d === 1 ? t('in 1 Tag') : t('in {n} Tagen', { n: d });
  }

  // ---------- Ränge & Ausbildung ----------
  const RANKS = D.ranks;
  const rankIdx = (name) => RANKS.findIndex((r) => r.name === name);
  const rankOf = (name) => RANKS[Math.max(0, rankIdx(name))];
  const typeOf = (name) => D.trainingTypes.find((tt) => tt.name === name);
  // Nächster Rang mit eigenem Training (z. B. Conductor → Signaller)
  function nextRank(rank) {
    for (let i = rankIdx(rank) + 1; i < RANKS.length; i++) if (typeOf(RANKS[i].name)) return RANKS[i];
    return null;
  }
  // Voraussetzung = der Rang davor (Teamränge ohne Training zählen nicht)
  function reqFor(type) {
    for (let i = rankIdx(type) - 1; i > 0; i--) if (!RANKS[i].staff) return RANKS[i].name;
    return RANKS[0].name;
  }
  // Trainings, die der Spieler sieht: nur das für seinen nächsten Rang.
  // Teamränge (Supervisor, Management) leiten Trainings und sehen deshalb alle.
  function myTrainingTypes() {
    if (rankOf(state.rank).staff) return null;
    const next = nextRank(state.rank);
    return next ? [next.name] : [];
  }
  const roleBadge = (role) => `<span class="role" style="--rc:${rankOf(role).color}">${esc(role)}</span>`;

  // ---------- Zustand ----------
  const state = {
    page: 'home',
    serverType: 'all',
    serverQuery: '',
    // Server-Details (#/server/<id>): Ansicht und Filter
    serverId: null,
    sdTab: 'trains',
    sdCat: 'all',
    sdRole: 'all',
    board: { name: '', cat: 'all', back: 0, more: 0 },
    tripMid: true,
    range: '24',
    rank: rankIdx(store.get('tsg-rank', '')) >= 0 ? store.get('tsg-rank', '') : D.me.rank,
    trainingDay: null,
    showAll: false,
    bell: store.get('tsg-bell', false),
    favs: new Set(store.get('tsg-favs', [])),
    online: D.stats.online,
    updatedAt: Date.now(),
    // Neuigkeiten & Karriere
    newsCat: 'all',
    jobId: null,
    jobApply: false,
    applications: store.get('tsg-applications', {}),
    // Mit Roblox verbundenes Profil: { userId, username, displayName, avatar, oauth }
    profile: store.get('tsg-profile', null),
    // Rang kommt aus der Roblox-Gruppe (Roblox-Login)
    rankFromGroup: false,
    groupRole: null,
  };

  // ---------- Kennzahlen ----------
  // Nur echte Zahlen: Roblox und Discord (Spieler online, Besuche, Gruppe) und das Spiel selbst (backend/game.js:
  // Fahrten, km, Pünktlichkeit, Spieler je Stunde). Was noch nicht passiert ist, steht auf 0.
  const EMPTY_GAME = {
    today: { trips: 0, km: 0, punctual: 0, cats: {}, routes: {} }, week: { trips: 0, km: 0, punctual: 0, routes: {} },
    total: { trips: 0, km: 0, punctual: 0 }, hours: [], live: { servers: 0, players: 0, trains: 0 },
  };
  const game = { data: null, at: 0, busy: false, cached: false };
  // Letzter Stand aus dem Speicher, bis die frischen Zahlen da sind
  const G = () => {
    if (!game.data && !game.cached) { game.cached = true; if (apiReady()) game.data = store.get('tsg-gamestats', null); }
    return game.data || EMPTY_GAME;
  };
  async function loadGameStats(force = false) {
    if (!apiReady() || game.busy || (!force && Date.now() - game.at < 60000)) return;
    game.busy = true;
    try {
      game.data = await api('/api/gamestats');
      store.set('tsg-gamestats', game.data);
    } catch (e) { /* alter Stand bleibt */ }
    game.busy = false;
    game.at = Date.now();
    if (state.page === 'statistiken') RENDER.statistiken();
    if (state.page === 'home') { renderHomeKpis(); renderRoles(); }
  }
  const punctualPct = (x) => (x && x.trips ? (x.punctual / x.trips) * 100 : 0);
  // Spieler je Stunde, fehlende Stunden = 0; die laufende Stunde mindestens mit der Zahl von jetzt
  function hourSeries(n) {
    const map = new Map(G().hours.map(([h, v]) => [h, v]));
    const cur = Math.floor(Date.now() / 3600000);
    return Array.from({ length: n }, (_, i) => {
      const h = cur - (n - 1) + i;
      const v = map.get(h) || 0;
      return { h, value: h === cur ? Math.max(v, state.online) : v };
    });
  }
  function sparkline(values) {
    const w = 64, h = 26, min = Math.min(...values), max = Math.max(...values);
    const x = (i) => (i / (values.length - 1)) * w;
    const y = (v) => (max === min ? h - 4 : h - 3 - ((v - min) / (max - min)) * (h - 6));
    const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    const last = values.length - 1;
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}"/><circle cx="${x(last).toFixed(1)}" cy="${y(values[last]).toFixed(1)}" r="4"/></svg>`;
  }
  // Zahl, die beim Erscheinen hochzählt (siehe countUp)
  // exact: genaue Zahl wie bei Roblox (ab 10 Millionen kurz)
  const FORMATS = { fmt: (n) => fmt(Math.round(n)), exact: (n) => (n >= 1e7 ? compact(Math.round(n)) : fmt(Math.round(n))), compact: (n) => compact(Math.round(n)), pct: (n) => pct(n, 1), km: (n) => compact(Math.round(n)) };
  const countHtml = (n, format = 'fmt', key = '') => `<span data-count="${+n || 0}" data-fmt="${format}" data-count-key="${esc(key)}">${FORMATS[format](+n || 0)}</span>`;
  function kpi({ label, num, format = 'fmt', ic, live = false, spark = null, note = '', key = '', bindKey = '' }) {
    const value = bindKey ? `<span data-bind="${bindKey}">${FORMATS[format](num)}</span>` : countHtml(num, format, key || label);
    return `<div class="kpi">
      <span class="kpi__label"><span class="kpi__icon">${icon(ic)}</span>${label}</span>
      <span class="kpi__value">${value}</span>
      <span class="kpi__foot">${live ? `<span class="delta delta--live"><span class="live-dot live-dot--sm"></span>${t('Live')}</span>` : `<span class="delta delta--note">${note}</span>`}${spark ? sparkline(spark) : ''}</span>
    </div>`;
  }
  function renderHomeKpis() {
    const g = G();
    const sv = liveMode() && live.data ? live.data.servers : null;
    const box = $('[data-kpis="home"]');
    if (!box) { renderHomeNumbers(); return; }
    box.innerHTML = [
      kpi({ label: t('Spieler online'), num: state.online, ic: 'ph-users-three', live: !!state.liveOnline, spark: hourSeries(12).map((x) => x.value), bindKey: 'online' }),
      kpi({ label: t('Aktive Server'), num: sv ? sv.length : g.live.servers, ic: 'ph-hard-drives', live: liveMode(), note: t('aus dem Spiel'), key: 'home-servers' }),
      kpi({ label: t('Züge unterwegs'), num: sv ? sv.reduce((n, s) => n + (s.trains || 0), 0) : g.live.trains, ic: 'ph-train', live: liveMode(), note: t('aus dem Spiel'), key: 'home-trains' }),
      kpi({ label: t('Pünktlichkeit'), num: punctualPct(g.today), format: 'pct', ic: 'ph-clock', note: t('heute · {n} Fahrten', { n: fmt(g.today.trips) }), key: 'home-punct' }),
    ].join('');
    countUp(box);
  }
  function renderStatsKpis() {
    const s = D.stats;
    const g = G();
    const L = !!state.liveStats;
    const head = $('[data-visits-delta]');
    if (head) {
      head.hidden = !L;
      head.className = 'delta delta--live';
      head.innerHTML = `<span class="live-dot live-dot--sm"></span>${t('Live')}`;
    }
    const box = $('[data-kpis="stats"]');
    box.innerHTML = [
      kpi({ label: t('Besuche gesamt'), num: s.visits, format: 'exact', live: L && !s.restricted, note: s.restricted ? t('verschiedene Spieler') : t('laut Roblox'), ic: 'ph-game-controller', key: 'st-visits' }),
      kpi({ label: t('Favoriten'), num: s.favorites, format: 'exact', live: L, ic: 'ph-star', key: 'st-favs' }),
      kpi({ label: t('Gruppenmitglieder'), num: s.groupMembers, format: 'compact', live: L, ic: 'ph-users-three', key: 'st-group' }),
      kpi({ label: 'Discord', num: s.discordMembers, format: 'compact', live: L, ic: 'si-discord', key: 'st-discord' }),
      kpi({ label: t('Gefahrene km'), num: g.total.km, format: 'km', note: t('gesamt'), ic: 'ph-path', key: 'st-km' }),
      kpi({ label: t('Fahrten heute'), num: g.today.trips, note: t('heute'), ic: 'ph-train', key: 'st-trips' }),
    ].join('');
    countUp(box);
  }

  // ---------- Diagramme ----------
  function chartData(range) {
    if (range === '24') {
      return hourSeries(24).map((x) => {
        const h = Math.floor(((berlinOf(x.h * 3600000).abs % 1440) + 1440) % 1440 / 60);
        return { label: `${pad(h)}:00`, tick: h % 3 === 0 ? `${pad(h)}` : '', value: x.value, tip: t('{time} Uhr', { time: `${pad(h)}:00` }) };
      });
    }
    const n = range === '7' ? 7 : 30;
    const now = berlinNow();
    const peak = new Map();
    hourSeries(n * 24 + 26).forEach((x) => {
      const day = berlinOf(x.h * 3600000).day;
      peak.set(day, Math.max(peak.get(day) || 0, x.value));
    });
    return Array.from({ length: n }, (_, i) => {
      const day = now.day - (n - 1) + i;
      const label = dtf({ day: '2-digit', month: '2-digit' }).format(dateOf(day));
      return {
        label, value: peak.get(day) || 0,
        tick: n === 7 ? wdShort(day) : i % 5 === 4 || i === 0 ? label : '',
        tip: `${wdLong(day)}, ${label} · ${t('Tageshöchstwert')}`,
      };
    });
  }
  function niceMax(v) {
    if (!(v > 0)) return 10;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    return Math.max(10, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p);
  }
  function renderChart() {
    const el = $('[data-chart="online"]');
    if (!el || !el.clientWidth) return;
    const data = chartData(state.range);
    const W = el.clientWidth, H = el.clientHeight;
    const m = { l: 40, r: 54, t: 14, b: 28 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const yMax = niceMax(Math.max(...data.map((d) => d.value)) * 1.08);
    const x = (i) => m.l + (i / (data.length - 1)) * iw;
    const y = (v) => m.t + ih - (v / yMax) * ih;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
    const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(' ');
    const area = `${line} L${x(data.length - 1).toFixed(1)} ${y(0)} L${x(0)} ${y(0)} Z`;
    const last = data[data.length - 1];
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
      ${ticks.map((tk) => `<line class="gridline" x1="${m.l}" x2="${W - m.r}" y1="${y(tk).toFixed(1)}" y2="${y(tk).toFixed(1)}"/><text x="${m.l - 10}" y="${(y(tk) + 4).toFixed(1)}" text-anchor="end">${compact(tk)}</text>`).join('')}
      ${data.map((d, i) => (d.tick ? `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${d.tick}</text>` : '')).join('')}
      <path class="viz-area" d="${area}"/>
      <path class="viz-line" d="${line}"/>
      <circle class="viz-dot" cx="${x(data.length - 1).toFixed(1)}" cy="${y(last.value).toFixed(1)}" r="5"/>
      <text class="end-label" x="${(x(data.length - 1) + 10).toFixed(1)}" y="${(y(last.value) + 4).toFixed(1)}">${fmt(last.value)}</text>
      <line class="crosshair" data-cross x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/>
      <circle class="viz-dot" data-hover-dot r="5" cx="0" cy="0" visibility="hidden"/>
      <rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}"/>
    </svg>
    <table class="sr-only"><caption>${t('Spieler online')}</caption><tbody>${data.map((d) => `<tr><th>${d.label}</th><td>${fmt(d.value)}</td></tr>`).join('')}</tbody></table>`;
    const svg = $('svg', el), cross = $('[data-cross]', el), dot = $('[data-hover-dot]', el), hit = $('.hit', el);
    const move = (e) => {
      const r = svg.getBoundingClientRect();
      const px = e.clientX - r.left;
      const i = Math.max(0, Math.min(data.length - 1, Math.round(((px - m.l) / iw) * (data.length - 1))));
      const cx = x(i), cy = y(data[i].value);
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.setAttribute('visibility', 'visible');
      showTip(`<b>${t('{n} Spieler', { n: fmt(data[i].value) })}</b><span>${esc(data[i].tip)}</span>`, r.left + cx, r.top + cy);
    };
    const leave = () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); hideTip(); };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', leave);
    $('[data-chart-sub]').textContent = state.range === '24' ? t('Letzte 24 Stunden, stündlich') : t('Letzte {n} Tage, Tageshöchstwert', { n: state.range });
  }

  // Zuggattungen für „Fahrten nach Zuggattung“ (Gattung aus dem Spiel bzw. aus dem Fahrzeug)
  const TRAIN_SHARE = [['ICE', ['ice']], ['Eurocity', ['ec']], ['Intercity', ['ic']], ['Regional-Express', ['ire', 're']], ['Regionalbahn', ['rb']], ['S-Bahn', ['s']], ['Güterverkehr', ['g']]];
  function renderBars() {
    const g = G();
    const cats = g.today.cats || {};
    const total = Object.values(cats).reduce((a, b) => a + b, 0);
    const rows = TRAIN_SHARE.map(([label, cs]) => ({ label, value: total ? (cs.reduce((n, c) => n + (cats[c] || 0), 0) / total) * 100 : 0 }));
    const max = Math.max(...rows.map((d) => d.value));
    $('[data-hbars]').innerHTML = rows.map((d) => `<div class="hbar" data-tip="<b>${pct(d.value)}</b><span>${esc(t(d.label))}</span>">
      <span class="hbar__label">${esc(t(d.label))}</span>
      <span class="hbar__track"><span class="hbar__fill" style="width:${max ? (d.value / max) * 86 : 0}%"></span><span class="hbar__value">${pct(d.value)}</span></span>
    </div>`).join('');

    // Pünktlichkeit nach Netz: Fahrten der letzten 7 Tage auf den Strecken des Netzes
    $('[data-meters]').innerHTML = D.nets.map((net) => {
      const r = net.routes.reduce((a, no) => { const x = g.week.routes[no]; if (x) { a.n += x.n; a.ok += x.ok; } return a; }, { n: 0, ok: 0 });
      const v = r.n ? (r.ok / r.n) * 100 : 0;
      const s = !r.n ? ['none', t('Keine Fahrten'), 'ph-info'] : v >= 93 ? ['ok', t('Gut'), 'ph-check'] : v >= 88 ? ['warn', t('Angespannt'), 'ph-warning'] : ['bad', t('Kritisch'), 'ph-warning'];
      return `<li>
        <span class="m-label">${esc(t(net.label))}</span>
        <span class="m-value"><span class="state state--${s[0]}">${icon(s[2])}${s[1]}</span>${pct(v, 1)}</span>
        <span class="bar bar--${s[0]}"><span style="width:${v}%"></span></span>
      </li>`;
    }).join('');

    const top = D.routes.map((r) => ({ route: r, value: (g.week.routes[r.no] || {}).n || 0 })).sort((a, b) => b.value - a.value).slice(0, 5);
    $('[data-top-routes]').innerHTML = routeList(top, Math.max(...top.map((d) => d.value)));
  }

  // Strecken über ihre Nummer (R001, R002, …)
  const routeOf = (no) => D.routes.find((r) => r.no === no) || { no, title: no, cat: 're', line: '' };
  const routeNo = (r) => `<span class="route-no">${esc(r.no)}</span>`;
  // Streifendiagramm als Rangliste (Statistikseite und Meine Statistik)
  const routeList = (rows, max) => rows.map((d, i) => `<li>
      <span class="rank-num">${i + 1}</span>
      <span class="r-main">${routeNo(d.route)}<span>${esc(t(d.route.title))}</span></span>
      <span class="r-val">${fmt(d.value)} <small>${t('Fahrten')}</small></span>
      <span class="r-bar"><span style="width:${max ? (d.value / max) * 100 : 0}%"></span></span>
    </li>`).join('');
  // Streifendiagramm mit Balken (Zuggattungen, Meine Statistik)
  const hbarList = (rows, unit) => {
    const max = Math.max(...rows.map((d) => d.value), 1);
    return rows.map((d) => `<div class="hbar" data-tip="<b>${fmt(d.value)} ${unit}</b><span>${esc(t(d.label))}</span>">
      <span class="hbar__label">${esc(t(d.label))}</span>
      <span class="hbar__track"><span class="hbar__fill" style="width:${(d.value / max) * 86}%"></span><span class="hbar__value">${fmt(d.value)}</span></span>
    </div>`).join('');
  };

  // ---------- Strecken & News ----------
  // Einstieg und Rollen (Startseite)
  function renderRoles() {
    if (!$('[data-roles]')) return;
    const rk = (name, color) => `<b class="rk" style="--rc:${esc(color || rankOf(name).color)}">${esc(name)}</b>`;
    const fill = (text, rank, color, team = rank) => esc(t(text))
      .replace(/\{rank\}/g, rk(rank, color))
      .replace(/\{team\}/g, rk(team, color))
      .replace('{group}', `<a href="${esc(D.links.group)}" target="_blank" rel="noopener">${t('Train Sim Germany Gruppe auf Roblox')}${icon('ph-arrow-square-out')}</a>`);
    const start = `<article class="role-card role-card--start">
      <div class="role-card__media"><img src="assets/img/group.svg" alt="${esc(t('Roblox-Spieler winken auf dem Bahnsteig vor einem Regionalzug'))}" loading="lazy"></div>
      <div class="role-card__body">
        <h3>${t('Starte jetzt bei Train Sim Germany!')}</h3>
        <div class="start-actions">
          <a class="btn btn--primary btn--lg btn--block" href="${esc(D.links.play)}" target="_blank" rel="noopener">${icon('phf-play')}${t('Server beitreten')}</a>
          <p>${t('Deine Reise beginnt auf Roblox.')}</p>
          <a class="btn btn--outline btn--lg btn--block" href="${esc(D.links.group)}" target="_blank" rel="noopener">${icon('ph-user-plus')}${t('Roblox-Gruppe beitreten')}</a>
          <p>${t('Für Ränge und Trainings.')}</p>
          <a class="btn btn--outline btn--lg btn--block btn--discord" href="${esc(D.links.discord)}" target="_blank" rel="noopener">${icon('si-discord')}${t('Discord-Community beitreten')}</a>
          <p>${t('Chatte mit {n} anderen Spielern.', { n: `<span data-bind="discordMembers">${compact(D.stats.discordMembers)}</span>` })}</p>
        </div>
      </div>
    </article>`;
    // Eine Karte je Team aus Studio (Attribut „Extern“), in der Reihenfolge aus Studio, mit Name, TeamColor und Spielerzahl.
    // Text und Bild kommen aus data.js → roleCards (passend zum Team, z. B. „Driver“ → Qualified Driver).
    // Ohne Teams aus dem Spiel (kein Backend): die Karten aus data.js mit den Rollen.
    const teams = liveTeams();
    const karten = teams.length
      ? teams.map((tm) => ({ c: cardOf(tm.name), name: tm.name, color: teamColor(tm), n: tm.n || 0, team: true }))
      : D.roleCards.map((c) => { const x = inGameRole(c.rank); return { c, name: c.rank, color: x.color, n: x.n, team: false }; });
    $('[data-roles]').innerHTML = start + karten.map(({ c, name, color, n, team }) => {
      const chip = team ? `<span class="role-card__team" style="--rc:${esc(color)};--ink:${inkOn(color)}" title="${esc(t('Team im Spiel'))}"><i aria-hidden="true"></i>${esc(name)}</span>` : '';
      const zahl = team ? t('<b>{n}</b> gerade im Team {team}', { n: fmt(n), team: esc(name) }) : t('<b>{n}</b> gerade im Spiel als {rank}', { n: fmt(n), rank: esc(name) });
      return `<article class="role-card">
      <div class="role-card__media"><img src="assets/img/${c.img}" alt="" loading="lazy">${chip}</div>
      <div class="role-card__body">
        <h3>${fill(c.title, c.rank || name, color, name)}</h3>
        <p>${fill(c.text, c.rank || name, color, name)}</p>
        <span class="count-pill count-pill--live" style="--rc:${esc(color)}"><i class="count-pill__dot" aria-hidden="true"></i>${zahl}</span>
      </div>
    </article>`;
    }).join('');
  }
  // Teams aus dem Spiel (live oder zuletzt bekannt), sortiert nach ihrer Zahl in Studio
  function liveTeams() {
    if (!liveMode()) return [];
    const L = G().live || {};
    const teams = (live.data && live.data.teams) || L.teams || [];
    return [...teams].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));
  }
  // Text und Bild für ein Team: Karte der passenden Rolle, sonst eine allgemeine Karte mit dem Teamnamen
  function cardOf(teamName) {
    const role = roleOfTeam(teamName);
    return D.roleCards.find((c) => c.rank === role)
      || { rank: null, img: 'hero.svg', title: 'Spiel im Team {team}.', text: 'Wähle im Spiel das Team {team} und leg los.' };
  }
  // Wie viele gerade im Spiel diese Rolle haben: Team mit dem Namen der Rolle (Farbe aus dem Spiel), sonst aus dem
  // Teamnamen abgeleitet (z. B. „Driver“ → Qualified Driver). Ohne Backend: die Demo-Server.
  function inGameRole(rank) {
    const fallback = { name: rank, color: rankOf(rank).color };
    if (!liveMode()) {
      const n = D.servers.reduce((sum, sv) => sum + serverModel(sv).players.filter((p) => p.role === rank).length, 0);
      return { ...fallback, n };
    }
    const L = G().live || {};
    const teams = (live.data && live.data.teams) || L.teams || [];
    const team = teams.find((x) => sameTeam(x.name, rank));
    if (team) return { name: team.name, team: team.name, color: teamColor(team), n: team.n || 0 };
    // Teams, deren Name zur Rolle passt (z. B. „Driver“ → Qualified Driver): Farbe aus dem Spiel, Spieler zusammen
    const near = teams.filter((x) => roleOfTeam(x.name) === rank);
    if (near.length) return { name: rank, team: near.map((x) => x.name).join(' · '), color: teamColor(near[0]), n: near.reduce((n, x) => n + (x.n || 0), 0) };
    return { ...fallback, n: (L.roles && L.roles[rank]) || 0 };
  }
  // Lesbare Schrift auf einer Teamfarbe (helle Farben wie Gold → dunkle Schrift)
  function inkOn(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return '#fff';
    const n = parseInt(m[1], 16);
    const lin = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const lum = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return lum > 0.42 ? '#131821' : '#fff';
  }
  // Wie backend/game.js → gameRole: Teamname aus dem Spiel → feste Rolle
  const ROLE_WORDS = [
    ['Supervisor', /supervisor|aufsicht|manager|director|engineer|public relations|moderat|admin/], ['Signaller', /signal|stellwerk|fahrdienst|dispatch/],
    ['Conductor', /conductor|zugbegleit|schaffner|guard/], ['Platform Staff', /platform|bahnsteig/], ['Learning Driver', /learning|trainee|azubi|ausbildung/],
    ['Qualified Driver', /driver|lokf|fahrer/],
  ];
  const roleOfTeam = (name) => { const v = String(name || '').toLowerCase(); const hit = ROLE_WORDS.find(([, re]) => re.test(v)); return hit ? hit[0] : 'Passenger'; };

  function renderRoutes() {
    if (!$('[data-routes]')) return;
    $('[data-routes]').innerHTML = D.routes.map((r) => {
      const fav = state.favs.has(r.title);
      return `<article class="scard">
        <div class="scard__media">
          <img src="assets/img/${r.img}" alt="${esc(t('Illustration der Strecke {name}', { name: t(r.title) }))}" loading="lazy">
          <button class="glass-btn" type="button" aria-pressed="${fav}" aria-label="${esc(t('{name} merken', { name: t(r.title) }))}" data-fav="${esc(r.title)}">${icon('ph-heart', 'fav-off')}${icon('phf-heart', 'fav-on')}</button>
          <span class="line line--${r.cat}">${esc(r.line)}</span>
        </div>
        <div class="scard__body">
          <h3>${routeNo(r)}<span>${esc(t(r.title))}</span></h3>
          <p>${esc(r.from)} → ${esc(r.to)}</p>
          <small>${fmt(r.km)} km · ${t('{d} Std.', { d: r.dur })} · ${t('{n} Halte', { n: r.stops })}</small>
        </div>
      </article>`;
    }).join('');
  }

  function renderNews() {
    const box = $('[data-news]');
    if (box) box.innerHTML = newsItems().slice(0, 3).map(newsCard).join('');
    renderHomeNews();
  }

  // ---------- Server ----------
  const CREW = D.crew;
  const serverById = (id) => D.servers.find((s) => s.id === id);
  // Laufzeit in Minuten → „6 Std. 12 Min.“
  const uptime = (min) => (min >= 60 ? t('{h} Std. {m} Min.', { h: Math.floor(min / 60), m: pad(min % 60) }) : t('{m} Min.', { m: min }));

  // ---------- Fahrplan: Züge, Spieler und Stationen eines Servers ----------
  // Jede Linie aus D.lines fährt im Takt in beide Richtungen. Daraus ergeben sich die Züge, die gerade
  // unterwegs sind, und die nächsten Abfahrten an jedem Bahnhof (Demo – später live aus dem Spiel).
  const CATS = [
    { id: 'ice', name: 'ICE' }, { id: 'ec', name: 'EC' }, { id: 'ic', name: 'IC' }, { id: 'ire', name: 'IRE' },
    { id: 're', name: 'RE' }, { id: 'rb', name: 'RB' }, { id: 's', name: 'S-Bahn' },
  ];
  const CAT_ORDER = CATS.map((c) => c.id);
  const MAX_DELAY = 16;
  const lineEnd = (L) => L.stops[L.stops.length - 1][1];
  const lineOffset = (L, dir) => (dir ? (L.offset + Math.floor(L.every / 2)) % L.every : L.offset);
  const lineBadge = (L) => `<span class="line line--${L.cat}">${esc(L.name)}</span>`;
  const lineChip = (L) => `<span class="line line--${L.cat} line--chip">${icon('ph-train')}${esc(L.name)}</span>`;
  // Eine Fahrt: dir 0 = Richtung wie in data.js, 1 = Gegenrichtung, start = Abfahrt am ersten Halt (Minuten)
  function tripOf(lineId, dir, start) {
    const L = D.lines[lineId];
    const end = lineEnd(L);
    const raw = dir ? L.stops.map(([name, m]) => [name, end - m]).reverse() : L.stops;
    // 1 Minute Halt an jedem Zwischenhalt
    const stops = raw.map(([name, m], i) => ({ name, arr: start + m, dep: start + m + (i > 0 && i < raw.length - 1 ? 1 : 0) }));
    const perDay = 1440 / L.every;
    const idx = ((((start - lineOffset(L, dir)) / L.every) % perDay) + perDay) % perDay;
    const h = hash(`${lineId}/${dir}/${start}`);
    const r = h % 100;
    const delay = r < 60 ? 0 : r < 80 ? 1 + ((h >>> 8) % 2) : r < 94 ? 3 + ((h >>> 8) % 4) : 7 + ((h >>> 8) % 9);
    return {
      id: `${lineId}~${dir}~${start}`, lineId, line: L, dir, start, stops, delay,
      no: `${L.name.split(' ')[0]} ${L.no + idx * 2 + dir}`, from: stops[0].name, to: stops[stops.length - 1].name,
    };
  }
  function tripById(id) {
    const [lineId, dir, start] = String(id).split('~');
    return D.lines[lineId] ? tripOf(lineId, +dir, +start) : null;
  }
  function tripsBetween(lineId, dir, a, b) {
    const L = D.lines[lineId];
    const off = lineOffset(L, dir);
    const out = [];
    for (let k = Math.ceil((a - off) / L.every); off + k * L.every <= b; k++) out.push(tripOf(lineId, dir, off + k * L.every));
    return out;
  }
  // Wo ist der Zug gerade? now = Minuten mit Sekundenanteil
  function tripState(tr, now) {
    const at = now - tr.delay;
    const s = tr.stops;
    const last = s.length - 1;
    if (at < s[0].dep) return { phase: 'wait', i: 0, at, progress: 0 };
    if (at >= s[last].arr) return { phase: 'done', i: last, at, progress: 1 };
    const progress = (at - s[0].dep) / (s[last].arr - s[0].dep);
    for (let i = 0; i < last; i++) {
      if (at < s[i].dep) return { phase: 'stop', i, at, progress };
      if (at < s[i + 1].arr) return { phase: 'run', i, at, progress, seg: (at - s[i].dep) / (s[i + 1].arr - s[i].dep) };
    }
    return { phase: 'done', i: last, at, progress: 1 };
  }
  // Züge, die gerade fahren, an einem Bahnhof halten oder in den nächsten 3 Minuten abfahren
  function serverTrains(s, now) {
    const out = [];
    s.lines.forEach((lineId) => {
      const L = D.lines[lineId];
      [0, 1].forEach((dir) => tripsBetween(lineId, dir, now - lineEnd(L) - MAX_DELAY, now + 3).forEach((tr) => {
        const st = tripState(tr, now);
        if (st.phase === 'done' || (st.phase === 'wait' && tr.stops[0].dep - st.at > 3)) return;
        tr.st = st;
        out.push(tr);
      }));
    });
    return out.sort((a, b) => CAT_ORDER.indexOf(a.line.cat) - CAT_ORDER.indexOf(b.line.cat)
      || a.line.name.localeCompare(b.line.name, 'de', { numeric: true }) || a.start - b.start);
  }
  // Bahnhöfe des Servers, wichtige zuerst. box = mit Stellwerk
  function serverStations(s) {
    const map = new Map();
    s.lines.forEach((lineId) => D.lines[lineId].stops.forEach(([name]) => {
      if (!map.has(name)) map.set(name, { name, lines: [] });
      const st = map.get(name);
      if (!st.lines.includes(lineId)) st.lines.push(lineId);
    }));
    return Array.from(map.values()).map((st) => {
      const big = /Hbf|Fernbf|Główny|Centralna/.test(st.name);
      st.platforms = big ? Math.min(16, 4 + st.lines.length * 2) : Math.max(2, Math.min(6, st.lines.length + 1));
      st.box = big || st.lines.length >= 3;
      st.staff = [];
      st.signallers = [];
      return st;
    }).sort((a, b) => b.box - a.box || b.lines.length - a.lines.length || a.name.localeCompare(b.name, 'de'));
  }
  const platformOf = (st, lineId, dir) => (st ? 1 + (hash(`${st.name}/${lineId}/${dir}`) % st.platforms) : 1);
  // Gleis einer Fahrt an einem Bahnhof: planmäßig je Linie und Richtung, ab und zu ein Gleiswechsel
  function gleisOf(st, tr) {
    const plan = platformOf(st, tr.lineId, tr.dir);
    if (!st || st.platforms < 2 || hash(`${tr.id}@${st.name}`) % 11) return { n: plan, plan, changed: false };
    return { n: 1 + ((plan + (hash(tr.id) % (st.platforms - 1))) % st.platforms), plan, changed: true };
  }
  // Gleis als Schild: dunkelblau (Start und Ziel), grau (Zwischenhalt), rot bei Gleiswechsel
  const glHtml = (g, strong) => `<span class="gl${g.changed ? ' is-changed' : strong ? ' is-strong' : ''}"${g.changed ? ` title="${esc(t('Gleiswechsel – planmäßig Gl. {n}', { n: g.plan }))}"` : ''}>${t('Gl. {n}', { n: g.n })}</span>`;

  // Spieler: Namen aus D.crew und erzeugte Roblox-Namen, Rollen nach festen Anteilen (Rest = Fahrgäste)
  const NAME_A = ['Lok', 'Bahn', 'Gleis', 'Signal', 'Weichen', 'Takt', 'Zug', 'Schiene', 'Express', 'Regio', 'Rail', 'Tf', 'Strecke', 'Bahnhof', 'Rangier', 'Kelle'];
  const NAME_B = ['Max', 'Lena', 'Tom', 'Mia', 'Ben', 'Emma', 'Paul', 'Lea', 'Finn', 'Noah', 'Jana', 'Luca', 'Nele', 'Timo', 'Ida', 'Ole', 'Fan', 'Profi', 'Held', 'Fuchs'];
  // Rollen im Spiel: Ränge der Gruppe plus Fahrgäste (kein Rang)
  const ROLE_SHARE = [['Qualified Driver', 0.24], ['Learning Driver', 0.1], ['Conductor', 0.14], ['Platform Staff', 0.12], ['Signaller', 0.08]];
  const ROLE_ORDER = ['Supervisor', 'Signaller', 'Platform Staff', 'Qualified Driver', 'Learning Driver', 'Conductor', 'Passenger'];
  const ROLE_LABEL = {
    'Qualified Driver': 'Lokführer', 'Learning Driver': 'Lokführer in Ausbildung', Conductor: 'Zugbegleiter', 'Platform Staff': 'Bahnsteigpersonal',
    Signaller: 'Fahrdienstleiter', Supervisor: 'Aufsicht', Passenger: 'Fahrgäste',
  };
  const PASSENGER = { name: 'Passenger', prefix: 'FG', label: 'Fahrgast', color: '#878C96' };
  const roleRank = (r) => (r === 'Passenger' ? PASSENGER : rankOf(r));
  const DRIVERS = ['Qualified Driver', 'Learning Driver'];
  const playerCache = {};
  function serverPlayers(s) {
    if (playerCache[s.id]) return playerCache[s.id];
    const n = s.players;
    const host = s.type === 'training' ? (D.trainings.find((x) => x.server === s.name) || {}).host : null;
    const names = host ? [host] : [];
    CREW.forEach((name, i) => { if ((hash(s.id) + i) % 3 === 0 && !names.includes(name)) names.push(name); });
    for (let i = 0; names.length < n; i++) {
      const h = hash(`${s.id}#${i}`);
      const a = NAME_A[h % NAME_A.length];
      const b = NAME_B[(h >>> 5) % NAME_B.length];
      const k = (h >>> 11) % 100;
      const name = [`${a}_${b}`, `${b}${a}${pad(k)}`, `${a}${b}${2005 + (k % 14)}`, `${b}_${a}${k}`][(h >>> 18) % 4];
      if (!names.includes(name)) names.push(name);
    }
    const roles = [];
    if (host) roles.push('Supervisor');
    if (s.focus) for (let i = Math.round((n - roles.length) * 0.6); i > 0; i--) roles.push(s.focus);
    ROLE_SHARE.forEach(([role, share]) => {
      const want = Math.max(role === 'Signaller' && n >= 6 ? 1 : 0, Math.round(n * share));
      for (let i = roles.filter((r) => r === role).length; i < want && roles.length < n; i++) roles.push(role);
    });
    if (n >= 25 && roles.length < n) roles.push('Supervisor');
    while (roles.length < n) roles.push('Passenger');
    // Gemischte Reihenfolge, die Trainingsleitung behält ihre Rolle
    const rest = names.slice(host ? 1 : 0, n).sort((x, y) => hash(x + s.id) - hash(y + s.id));
    const list = (host ? [host] : []).concat(rest).map((name, i) => ({
      name, role: roles[i], since: 3 + (hash(`${name}@${s.id}`) % Math.max(4, Math.min(s.uptime, 300))),
    }));
    playerCache[s.id] = list.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name));
    return playerCache[s.id];
  }
  // Wer sitzt in welchem Zug? Einmal vergeben, bleibt ein Spieler bis zum Ende der Fahrt in seinem Zug.
  const seatMemo = {};
  function serverModel(s) {
    const now = berlinNow().absSec / 60;
    const trains = serverTrains(s, now);
    const stations = serverStations(s);
    const stationMap = new Map(stations.map((st) => [st.name, st]));
    const players = serverPlayers(s).map((p) => ({ ...p }));
    const active = new Map(trains.map((tr) => [tr.id, tr]));
    const memo = seatMemo[s.id] || (seatMemo[s.id] = new Map());
    players.forEach((p) => { const id = memo.get(p.name); if (id && active.has(id)) p.trainId = id; });
    trains.forEach((tr) => { tr.crew = {}; tr.riders = []; });
    const seat = (roles, key, eligible) => {
      const pool = players.filter((p) => roles.includes(p.role));
      pool.forEach((p) => { if (p.trainId) active.get(p.trainId).crew[key] = p; });
      trains.filter(eligible).sort((a, b) => a.start - b.start).forEach((tr) => {
        if (tr.crew[key]) return;
        const free = pool.filter((p) => !p.trainId);
        if (!free.length) return;
        const p = free.reduce((best, x) => (hash(x.name + tr.id) > hash(best.name + tr.id) ? x : best));
        p.trainId = tr.id;
        tr.crew[key] = p;
        memo.set(p.name, tr.id);
      });
    };
    seat(DRIVERS, 'Driver', () => true);
    seat(['Conductor'], 'Conductor', (tr) => tr.crew.Driver && tr.line.cat !== 's');
    const hubs = stations.slice(0, Math.min(3, stations.length));
    const boxes = stations.filter((st) => st.box);
    let staffN = 0;
    let boxN = 0;
    players.forEach((p) => {
      if (p.trainId) {
        p.train = active.get(p.trainId);
        if (p.role === 'Passenger') p.train.riders.push(p);
      } else if (p.role === 'Platform Staff') {
        p.station = stations[staffN++ % stations.length];
        p.station.staff.push(p);
      } else if (p.role === 'Signaller') {
        p.station = (boxes.length ? boxes : stations)[boxN++ % (boxes.length || stations.length)];
        p.station.signallers.push(p);
      } else if (p.role === 'Passenger' && trains.length && hash(p.name) % 10 < 7) {
        // Fahrgäste: 70 % sitzen in einem Zug, die anderen warten am Bahnsteig
        const tr = trains.reduce((best, x) => (hash(p.name + x.id) > hash(p.name + best.id) ? x : best));
        p.train = tr;
        tr.riders.push(p);
        memo.set(p.name, tr.id);
      } else if (p.role !== 'Supervisor') {
        p.station = hubs[hash(p.name) % hubs.length];
        p.waiting = true;
      }
    });
    // Bahnsteige auf das Platform Staff eines Bahnhofs aufteilen
    stations.forEach((st) => st.staff.forEach((p, k) => {
      const per = Math.ceil(st.platforms / st.staff.length);
      p.tracks = [k * per + 1, Math.min(st.platforms, (k + 1) * per)];
    }));
    return { s, now, trains, stations, stationMap, players };
  }
  const tracksText = (p) => (p.tracks[0] === p.tracks[1] ? t('Gleis {n}', { n: p.tracks[0] }) : t('Gleis {a}–{b}', { a: p.tracks[0], b: p.tracks[1] }));
  function roleCounts(players) {
    const out = ROLE_ORDER.map((role) => [role, players.filter((p) => p.role === role).length]).filter(([, n]) => n);
    // Fahrgäste zuletzt
    return out.sort((a, b) => (a[0] === 'Passenger') - (b[0] === 'Passenger') || rankIdx(b[0]) - rankIdx(a[0]));
  }

  // ---------- Live-Server aus dem Spiel ----------
  // Mit Backend zeigt die Server-Seite nur echte Server (gemeldet von game/TSGAppSync.server.lua), private nur, wenn
  // der Besitzer sie zeigt. Ohne Backend bleibt die Demo aus data.js.
  const live = { data: null, at: 0, busy: false, detail: {}, detailAt: {} };
  const liveMode = () => apiReady();
  // Rollen im Spiel von Passenger bis Supervisor (wie backend/game.js)
  const GAME_ROLES = ['Passenger', 'Learning Driver', 'Qualified Driver', 'Platform Staff', 'Conductor', 'Signaller', 'Supervisor'];
  // Teams aus dem Spiel (Attribut „Extern“): Name, Farbe und Reihenfolge wie im Teams-Service. Team mit der Zahl 2 fertigt ab.
  const DISPATCH_ORDER = 2;
  const sameTeam = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
  const teamColor = (x) => (x && x.color) || '#878C96';
  // Gruppen für Listen: alle Teams in ihrer Reihenfolge (auch leere), wer in keinem ist, kommt unter „Weitere Spieler“.
  // Ohne Teams aus dem Spiel: die festen Rollen von Supervisor bis Passenger (nur mit Spielern).
  function teamGroups(people, teams) {
    if (Array.isArray(teams) && teams.length) {
      const groups = teams.map((x) => ({ key: x.name, name: x.name, color: teamColor(x), sub: '', list: people.filter((p) => sameTeam(p.team, x.name)), team: x }));
      const rest = people.filter((p) => !teams.some((x) => sameTeam(p.team, x.name)));
      if (rest.length) groups.push({ key: '_rest', name: t('Weitere Spieler'), color: '#878C96', sub: t('ohne Team aus der App'), list: rest });
      return groups;
    }
    return [...GAME_ROLES].reverse().map((r) => ({ key: r, name: r, color: roleRank(r).color, sub: t(ROLE_LABEL[r]), list: people.filter((p) => p.role === r) })).filter((g) => g.list.length);
  }
  // Abfertigung: Team mit der Zahl 2; meldet das Spiel gar keine Zahlen, das Team für Bahnsteigpersonal (z. B. „Platform Staff“)
  function dispatchTeam(teams) {
    if (!Array.isArray(teams)) return null;
    const two = teams.find((x) => x.order != null && Number(x.order) === DISPATCH_ORDER);
    if (two) return two;
    return teams.every((x) => x.order == null) ? teams.find((x) => roleOfTeam(x.name) === 'Platform Staff') || null : null;
  }
  async function loadLive(force = false) {
    if (!liveMode() || live.busy || (!force && live.data && Date.now() - live.at < 25000)) return;
    live.busy = true;
    try { live.data = await api('/api/servers'); } catch (e) { live.data = live.data || { servers: [], avatars: {}, online: 0, error: true }; } finally { live.busy = false; live.at = Date.now(); }
    D.stats.servers = live.data.servers.length;
    if (state.page === 'server' && !state.serverId && modal.hidden) renderServers();
    if (state.page === 'home') { renderHomeKpis(); renderRoles(); }
    if (modalView && modalView.name === 'server-players') refreshModal();
    bind();
  }
  async function loadLiveDetail(id, force = false) {
    if (!liveMode() || (!force && live.detail[id] && Date.now() - (live.detailAt[id] || 0) < 20000)) return;
    live.detailAt[id] = Date.now();
    try { live.detail[id] = await api(`/api/servers/${encodeURIComponent(id)}`); } catch (e) { live.detail[id] = { error: e.status || true }; }
    if (state.page === 'server' && state.serverId === id && modal.hidden) renderServerDetail();
    if (modalView && modalView.name === 'server-players' && modalView.arg === id) refreshModal();
  }
  const liveServer = (id) => (live.data ? live.data.servers.find((s) => s.id === id) : null);
  const shortId = (id) => String(id).slice(0, 8);
  // Profilbild eines Spielers: Roblox-Bild, sonst Initialen
  function personPic(p, avatars = {}, cls = '') {
    const url = p.id && avatars[p.id];
    const name = p.name || p.dn || '?';
    return url ? `<span class="avatar avatar--img ${cls}" aria-hidden="true"><img src="${esc(url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>` : avatar(name, cls);
  }
  const personName = (p) => (p.dn && p.name && p.dn !== p.name ? `${esc(p.dn)} <small>@${esc(p.name)}</small>` : esc(p.dn || p.name || t('Spieler')));
  // Was jemand gerade macht (Live): Zug mit Linie, sonst Bahnhof
  function doingHtml(p) {
    if (p.line || p.train) {
      const L = lineByName(p.line);
      return `${icon('ph-train')}<span>${p.line ? `<span class="line line--${L ? L.cat : catOfTrain(p.veh) || 're'}">${esc(p.line)}</span>` : ''}${p.train ? `<b>${esc(p.train)}</b>` : ''}${p.dest ? ` ${t('nach {to}', { to: esc(p.dest) })}` : ''}</span>`;
    }
    if (p.at) return `${icon('ph-map-pin')}<span>${esc(p.at)}</span>`;
    return '';
  }
  const lineByName = (name) => (name ? Object.values(D.lines).find((L) => L.name.replace(/\s+/g, '') === String(name).replace(/\s+/g, '')) : null);
  const catOfTrain = (veh) => { const x = veh && D.trains.find((tr) => tr.id === veh); return x ? x.cat : null; };
  const trainName = (veh) => { const x = veh && D.trains.find((tr) => tr.id === veh); return x ? x.name : veh || ''; };

  // Einheitliche Karte für Demo- und Live-Server
  function serverCardModel(s) {
    if (s.live) return s;
    const m = serverModel(s);
    const roles = Object.fromEntries(GAME_ROLES.map((r) => [r, m.players.filter((p) => p.role === r).length]));
    const people = [...m.players].sort((a, b) => GAME_ROLES.indexOf(b.role) - GAME_ROLES.indexOf(a.role)).map((p) => ({ name: p.name, role: p.role }));
    return {
      id: s.id, title: t(s.name), sub: `${s.region} · v${s.version}`, private: s.type === 'vip', type: s.type,
      players: s.players, max: s.max, roles, people, avatars: {}, demo: true,
    };
  }
  function liveCardModel(s) {
    const p = s.pserver;
    return {
      live: true, id: s.id, private: s.private, type: s.private ? 'private' : 'public', players: s.players, max: s.max,
      title: s.private ? (p ? p.name : t('Privater Server')) : t('Öffentlicher Server'),
      sub: `${t('seit {time}', { time: uptime(Math.max(1, Math.round((Date.now() - s.since) / 60000))) })}${s.version ? ` · v${s.version}` : ''}`,
      roles: s.roles, teams: s.teams || null, people: s.people, avatars: (live.data && live.data.avatars) || {}, pserver: p,
    };
  }
  // Auslastung als Balken aus 12 Segmenten (wie die Auslastungsanzeige am Bahnsteig)
  function loadMeter(players, max) {
    const ratio = max ? Math.min(1, players / max) : 0;
    const on = Math.round(ratio * 12);
    const level = max && players >= max ? 'bad' : ratio >= 0.85 ? 'warn' : 'ok';
    return `<span class="sv-meter sv-meter--${level}" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i${i < on ? ' class="is-on"' : ''}></i>`).join('')}</span>`;
  }
  // Teams (oder Rollen) eines Servers als kleine Farbpunkte mit Anzahl
  function teamDots(c) {
    const groups = teamGroups(c.people || [], c.teams).filter((g) => g.list.length).slice(0, 4);
    if (!groups.length) return '';
    return `<ul class="sv-card__teams">${groups.map((g) => `<li style="--rc:${esc(g.color)}"><i></i><span>${esc(g.name)}</span><b>${g.list.length}</b></li>`).join('')}</ul>`;
  }
  function serverCard(s) {
    const c = s.live ? s : serverCardModel(s);
    const shown = c.people.slice(0, 3);
    const more = Math.max(0, c.players - shown.length);
    const kind = c.private ? t('Privat') : c.type === 'training' ? t('Training') : c.type === 'event' ? t('Event') : t('Öffentlich');
    const full = c.max && c.players >= c.max;
    return `<article class="sv-card${c.private ? ' is-private' : ''}">
      <div class="sv-card__top">
        <span class="sv-card__kind">${icon(c.private ? 'ph-lock' : 'ph-cell-signal-high')}${kind}</span>
        <span class="sv-card__live"><i></i>${full ? t('Voll') : t('Live')}</span>
      </div>
      <h3 class="sv-card__title">${esc(c.title)}</h3>
      <p class="sv-card__sub">${c.sub ? `${esc(c.sub)} · ` : ''}<button class="sv-card__id" type="button" data-copy="${esc(c.id)}" title="${esc(t('Server-ID kopieren'))}">#${esc(shortId(c.id))}${icon('ph-copy')}</button></p>
      <div class="sv-card__load">
        <span class="sv-card__count"><b>${countHtml(c.players, 'fmt', `sv-${c.id}`)}</b><small>/ ${fmt(c.max)} ${t('Spieler')}</small></span>
        ${loadMeter(c.players, c.max)}
      </div>
      ${teamDots(c)}
      <footer class="sv-card__foot">
        <button class="sv-card__people" type="button" data-server-people="${esc(c.id)}"${c.players ? '' : ' disabled'} aria-label="${esc(t('Alle Spieler ansehen'))}">
          <span class="avatars">${shown.map((p) => personPic(p, c.avatars)).join('')}${more ? `<span class="avatar avatar--more">+${more > 99 ? '99' : more}</span>` : ''}</span>
          <small>${c.players ? t('Alle ansehen') : t('Noch leer')}</small>
        </button>
        ${c.pserver && c.pserver.mine ? `<button class="sv-card__icon" type="button" data-pserver-edit="${esc(c.pserver.id)}" aria-label="${esc(t('Bearbeiten'))}" title="${esc(t('Bearbeiten'))}">${icon('ph-gear-six')}</button>` : ''}
        <a class="sv-card__go" href="#/server/${encodeURIComponent(c.id)}">${t('Details')}${icon('ph-arrow-right')}</a>
      </footer>
    </article>`;
  }

  function renderServers() {
    const isLive = liveMode();
    if (isLive && !live.data) loadLive();
    const list0 = isLive ? (live.data ? live.data.servers.map(liveCardModel) : null) : D.servers;
    const all = list0 || [];
    const players = isLive ? Math.max(state.online, live.data ? live.data.online : 0) : state.online;
    const free = all.reduce((sum, x) => sum + Math.max(0, x.max - x.players), 0);
    $('[data-server-stats]').innerHTML = `
      <div class="sv-stat"><b data-bind="online">${fmt(players)}</b><span>${t('Spieler online')}</span></div>
      <div class="sv-stat"><b>${fmt(all.length)}</b><span>${t('Server')}</span></div>
      <div class="sv-stat"><b>${fmt(free)}</b><span>${t('Freie Plätze')}</span></div>`;
    const types = isLive ? [['all', t('Alle')], ['public', t('Öffentlich')], ['private', t('Privat')], ['free', t('Freie Plätze')]]
      : [['all', t('Alle')], ['public', t('Öffentlich')], ['free', t('Freie Plätze')], ['event', t('Event')], ['training', t('Training')], ['vip', 'VIP']];
    if (!types.some(([id]) => id === state.serverType)) state.serverType = 'all';
    $('[data-server-filter]').innerHTML = types.map(([id, label]) => `<button class="sv-chip${state.serverType === id ? ' is-active' : ''}" type="button" data-type="${id}">${label}</button>`).join('');

    const q = norm(state.serverQuery.trim());
    const list = all.filter((s) => {
      if (state.serverType === 'free' && s.players >= s.max * 0.8) return false;
      if (state.serverType === 'private' && !s.private) return false;
      if (!['all', 'free', 'private'].includes(state.serverType) && s.type !== state.serverType) return false;
      const text = isLive ? `${s.title} ${s.id} ${s.people.map((p) => `${p.name || ''} ${p.dn || ''}`).join(' ')}` : `${s.name} ${s.id} ${s.network} ${s.region} ${s.lines.map((id) => D.lines[id].name).join(' ')}`;
      return !q || norm(text).includes(q);
    });
    // Private Server bleiben dauerhaft auf der Seite – auch wenn gerade niemand darauf spielt
    const running = new Set(all.filter((s) => s.pserver).map((s) => s.pserver.id));
    const offline = isLive && ps.list ? [...ps.list.mine, ...ps.list.visible].filter((p, i, arr) => !p.online && !running.has(p.id) && arr.findIndex((x) => x.id === p.id) === i)
      .filter((p) => ['all', 'private'].includes(state.serverType) && (!q || norm(`${p.name} ${p.ownerName || ''} ${p.id}`).includes(q))) : [];
    const status = $('[data-game-status]');
    if (status) status.innerHTML = isLive ? gameStatusHtml() : '';
    const box = $('[data-servers]');
    if (!list0) { box.innerHTML = `<div class="sv-card sv-card--skeleton" aria-hidden="true"></div>`.repeat(3); return; }
    if (!all.length && !offline.length) {
      box.innerHTML = `<div class="sv-empty">
        <span class="sv-empty__ic">${icon('ph-cell-signal-high')}</span>
        <h3>${t('Gerade läuft kein Server')}</h3>
        <p>${t('Sobald jemand Train Sim Germany spielt, erscheint der Server hier – mit Spielern und Rollen. Private Server erscheinen, wenn ihr Besitzer sie zeigt.')}</p>
        <a class="site-btn site-btn--brand" href="${esc(D.links.play)}" target="_blank" rel="noopener">${icon('phf-play')}${t('Jetzt spielen')}</a>
      </div>`;
      return;
    }
    box.innerHTML = list.length || offline.length ? list.map(serverCard).join('') + offline.map(offlineCard).join('') : `<p class="sv-none">${t('Kein Server gefunden. Versuch einen anderen Filter.')}</p>`;
    reveal(box);
    countUp(box);
  }
  // Privater Server, auf dem gerade niemand spielt
  function offlineCard(p) {
    return `<article class="sv-card is-private is-offline">
      <div class="sv-card__top">
        <span class="sv-card__kind">${icon('ph-lock')}${t('Privat')}</span>
        <span class="sv-card__live is-off"><i></i>${t('Offline')}</span>
      </div>
      <h3 class="sv-card__title">${esc(p.name)}</h3>
      <p class="sv-card__sub">${p.ownerName ? t('von {name}', { name: esc(p.ownerName) }) : t('Privater Server')}${p.lastSeen ? ` · ${t('zuletzt {when}', { when: agoText(p.lastSeen) })}` : ''}</p>
      <div class="sv-card__load">
        <span class="sv-card__count"><b>0</b><small>/ ${fmt(p.max || 0)} ${t('Spieler')}</small></span>
        ${loadMeter(0, p.max || 1)}
      </div>
      <ul class="sv-card__tags">${p.join === 'app' ? `<li>${icon('phf-play')}${t('Über die App')}</li>` : `<li>${icon('ph-lock')}${t('Nur über Roblox')}</li>`}${p.access === 'members' ? `<li>${icon('ph-users-three')}${t('Nur Mitglieder')}</li>` : ''}</ul>
      <footer class="sv-card__foot">
        ${p.canJoin && p.link ? `<a class="sv-card__go sv-card__go--brand" href="${esc(p.link)}" target="_blank" rel="noopener">${icon('phf-play')}${t('Starten')}</a>` : '<span></span>'}
        ${p.mine ? `<button class="sv-card__icon" type="button" data-pserver-edit="${esc(p.id)}" aria-label="${esc(t('Bearbeiten'))}" title="${esc(t('Bearbeiten'))}">${icon('ph-gear-six')}</button>` : ''}
      </footer>
    </article>`;
  }
  // Verbindung zum Spiel (nur fürs Team): fehlt der Schlüssel, passt er nicht oder meldet sich das Spiel nicht?
  const gstat = { data: null, at: 0 };
  const SCRIPT_PATH = 'game/TSGAppSync.server.lua';
  const SCRIPT_URL = `https://github.com/Loris6/Train-Sim-Germany/blob/main/${SCRIPT_PATH}`;
  async function copyGameScript(btn) {
    btn.disabled = true;
    let code = '';
    for (const url of [SCRIPT_PATH, `https://raw.githubusercontent.com/Loris6/Train-Sim-Germany/main/${SCRIPT_PATH}`]) {
      try { const r = await fetch(url, { cache: 'no-store' }); if (r.ok) { code = await r.text(); break; } } catch (e) { /* nächste Quelle */ }
    }
    btn.disabled = false;
    if (!code) { toast(t('Das Skript konnte nicht geladen werden. Öffne es auf GitHub.')); return; }
    try { await navigator.clipboard.writeText(code); toast(t('Skript kopiert – in Roblox Studio in das neue Script einfügen.')); } catch (e) { window.open(SCRIPT_URL, '_blank', 'noopener'); }
  }
  async function loadGameStatus() {
    if (!apiReady() || Date.now() - gstat.at < 60000) return;
    gstat.at = Date.now();
    try { gstat.data = await api('/api/game/status'); } catch (e) { gstat.data = null; }
    if (state.page === 'server' && !state.serverId) renderServers();
  }
  // Teams aus dem Spiel (nur fürs Team): kommen sie an, und wenn nicht, woran liegt es?
  function teamsStatusHtml(g) {
    const k = g.teams;
    const old = (g.scripts || []).some((v) => v < (g.script || 3)) || (k && (k.script || 1) < (g.script || 3));
    let cls = 'is-ok';
    let body;
    if (!k) {
      cls = 'is-warn';
      body = t('Das Spiel hat noch keine Teams gemeldet. Im Spiel läuft noch das alte Skript – das neue TSGAppSync einfügen, veröffentlichen und einen neuen Server starten.');
    } else if (!k.teams.length) {
      cls = 'is-warn';
      body = k.names.length
        ? t('Kein Team hat „Extern“ (als Attribut oder als Werte-Objekt im Team). Teams im Spiel: {list}', { list: k.names.map(esc).join(', ') })
        : t('Im Teams-Service des Spiels gibt es keine Teams.');
    } else {
      const dot = (x) => `<span class="tstat"><i style="--rc:${esc(teamColor(x))}"></i>${esc(x.name)}${x.order != null ? ` <small>${esc(String(x.order))}</small>` : ''}</span>`;
      body = `${t('Teams aus dem Spiel ({when}):', { when: agoText(k.at) })} ${k.teams.map(dot).join('')}`;
      if (k.teams.every((x) => x.order == null)) {
        cls = 'is-warn';
        const keys = k.keys ? k.teams.map((x) => `${esc(x.name)}: ${(k.keys[x.name] || []).map(esc).join(', ') || '–'}`).join(' · ') : '';
        body += `<br>${t('Keine Zahl für die Reihenfolge gefunden – die Teams stehen alphabetisch, die Abfertigung nutzt das Team für Bahnsteigpersonal.')}${keys ? `<br><small>${t('Am Team gefunden:')} ${keys}</small>` : ''}`;
      } else if (!k.teams.some((x) => x.order != null && Number(x.order) === DISPATCH_ORDER)) body += `<br>${t('Kein Team hat die Zahl 2 – die Abfertigung bleibt leer.')}`;
    }
    if (old) { cls = 'is-warn'; body += `<br>${t('Im Spiel läuft noch eine alte Version von TSGAppSync (Version {v}, aktuell {now}) – neues Skript einfügen und veröffentlichen.', { v: (k && k.script) || 1, now: g.script || 3 })}`; }
    return `<p class="game-link game-link--teams ${cls}">${icon(cls === 'is-ok' ? 'ph-users-three' : 'ph-warning')}<span>${body}</span></p>`;
  }
  function gameStatusHtml() {
    if (!isTeam('Public Relations Department')) return '';
    loadGameStatus();
    const g = gstat.data;
    if (!g) return '';
    const fresh = g.lastSync && Date.now() - g.lastSync < 10 * 60000;
    const rejected = g.lastReject && (!g.lastSync || g.lastReject.at > g.lastSync);
    if (g.configured && fresh && !rejected) {
      return `<p class="game-link is-ok">${icon('phf-check-circle')}<span>${t('Verbindung zum Spiel steht · letzte Meldung {when}', { when: agoText(g.lastSync) })}</span></p>${teamsStatusHtml(g)}`;
    }
    const host = esc(String(API).replace(/^https?:\/\//, ''));
    const steps = `<ol class="game-link__steps">
      <li>${t('Einen langen Zufallswert als Schlüssel ausdenken (z. B. 40 Zeichen).')}</li>
      <li>${t('GitHub → Repository → Settings → Secrets and variables → Actions: Secret {name} mit diesem Wert anlegen.', { name: '<code>GAME_API_KEY</code>' })}</li>
      <li>${t('Roblox Creator Dashboard → dein Spiel → Secrets: {name} mit demselben Wert, Domain {domain}.', { name: '<code>tsg_game_key</code>', domain: `<code>${host}</code>` })}</li>
      <li>${t('GitHub → Actions → „Backend veröffentlichen“ → „Run workflow“.')}</li>
    </ol>`;
    // TSGAppSync ist das Skript im Spiel, das Server und Spieler an die App meldet – ohne es meldet sich das Spiel nie
    const script = `<div class="game-link__script">
      <p>${t('{name} ist das Skript, das im Spiel läuft und der App Server, private Server und Spieler meldet. Ohne dieses Skript im Spiel bleibt die Server-Seite leer.', { name: '<b>TSGAppSync</b>' })}</p>
      <ol class="game-link__steps">
        <li>${t('Roblox Studio → Explorer → {where} → „+“ → {kind}, Name {name}.', { where: '<code>ServerScriptService</code>', kind: '<code>Script</code>', name: '<code>TSGAppSync</code>' })}</li>
        <li>${t('Den ganzen Inhalt des Skripts hineinkopieren (Knopf unten).')}</li>
        <li>${t('Home → Game Settings → Security → „Allow HTTP Requests“ einschalten.')}</li>
        <li>${t('Secret {name} im Creator Dashboard (Domain {domain}). Zum Testen in Studio zusätzlich unter Game Settings → Security → Secrets.', { name: '<code>tsg_game_key</code>', domain: `<code>${host}</code>` })}</li>
        <li>${t('File → Publish to Roblox und einem echten Server beitreten. In der Ausgabe (F9) steht dann „[TSG] Mit der App verbunden“ – oder was noch fehlt.')}</li>
      </ol>
      <div class="game-link__btns">
        <button class="btn btn--primary btn--sm" type="button" data-copy-script>${icon('ph-copy')}${t('Skript kopieren')}</button>
        <a class="btn btn--soft btn--sm" href="${SCRIPT_URL}" target="_blank" rel="noopener">${icon('ph-arrow-square-out')}${t('Auf GitHub ansehen')}</a>
      </div>
    </div>`;
    let title;
    let text;
    let help = '';
    if (!g.configured) {
      title = t('Dem Backend fehlt der Spiel-Schlüssel');
      text = t('Ohne GAME_API_KEY lehnt das Backend alle Meldungen aus dem Spiel ab – deshalb erscheinen hier keine Server, auch keine privaten.');
      help = steps;
    } else if (rejected && g.lastReject.reason === 'bad_key') {
      title = t('Der Schlüssel des Spiels passt nicht');
      text = t('Das Spiel meldet sich ({when}), aber sein Secret tsg_game_key ist nicht derselbe Wert wie GAME_API_KEY im Backend.', { when: agoText(g.lastReject.at) });
      help = steps;
    } else if (!g.lastSync) {
      title = t('Noch keine Meldung aus dem Spiel');
      text = t('Das Backend hat den Schlüssel, aber das Spiel hat sich noch nie gemeldet.');
      help = script;
    } else {
      title = t('Das Spiel meldet sich gerade nicht');
      text = t('Letzte Meldung {when}. Läuft gerade ein Server mit TSGAppSync?', { when: agoText(g.lastSync) });
      help = script;
    }
    return `<div class="game-link"><span class="game-link__ic">${icon('ph-warning')}</span><div class="game-link__body"><b>${title}</b><p>${text}</p>${help}<small>${t('Nur für das Team sichtbar.')}</small></div></div>${g.lastSync ? teamsStatusHtml(g) : ''}`;
  }

  // Alle Spieler eines Servers (Sheet)
  function serverPeopleView(id) {
    let people = null;
    let teams = null;
    let avatars = {};
    let title = '';
    if (liveMode()) {
      const d = live.detail[id];
      if (!d) { loadLiveDetail(id); return `<div class="sheet-loading">${icon('ph-spinner-gap')}<span>${t('Wird geladen …')}</span></div>`; }
      if (d.error) return `<p class="muted">${t('Dieser Server ist nicht mehr online.')}</p>`;
      people = d.server.people;
      teams = d.server.teams;
      avatars = d.avatars || {};
      title = d.server.private && d.server.pserver ? d.server.pserver.name : t('Öffentlicher Server');
    } else {
      const s = serverById(id);
      if (!s) return `<p class="muted">${t('Diesen Server gibt es nicht mehr.')}</p>`;
      people = serverModel(s).players.map((p) => ({ name: p.name, role: p.role, line: p.train ? p.train.line.name : null, dest: p.train ? p.train.to : null, at: p.station ? p.station.name : null }));
      title = t(s.name);
    }
    const groups = teamGroups(people, teams);
    return `<p class="sp-head">${icon('ph-users-three')}<span><b>${esc(title)}</b> · ${t('{n} Spieler', { n: fmt(people.length) })}</span></p>
      ${groups.map((g) => `<section class="sp-group">
        <h3 class="pgroup__title"><i style="--rc:${esc(g.color)}"></i>${esc(g.name)}<small>${g.sub ? `${esc(g.sub)} · ` : ''}${g.list.length}</small></h3>
        ${g.list.length ? '' : `<p class="team-empty">${t('Noch niemand in diesem Team')}</p>`}
        <ul class="sp-list">${g.list.map((p) => `<li>${p.id ? `<button class="sp-row" type="button" data-player="${esc(p.id)}">` : '<div class="sp-row">'}
          ${personPic(p, avatars)}<span class="sp-row__main"><b>${personName(p)}</b><span class="sp-row__doing">${doingHtml(p)}</span></span>
          ${p.id ? icon('ph-caret-right', 'sp-row__chev') : ''}${p.id ? '</button>' : '</div>'}</li>`).join('')}</ul>
      </section>`).join('')}`;
  }

  // Weitere Halte eines Zuges aus dem Spiel: Linie aus dem Fahrplan, ab dem gemeldeten nächsten Halt bis zum Ziel
  function liveStopsHtml(tr) {
    const L = lineByName(tr.line);
    if (!L || !tr.next) return '';
    const names = L.stops.map(([n]) => n);
    const i = names.indexOf(tr.next);
    const d = tr.dest ? names.indexOf(tr.dest) : -1;
    if (i < 0) return '';
    // Richtung aus dem Ziel: bis zum Ziel, in Fahrtrichtung
    const rest = d < 0 ? names.slice(i) : d >= i ? names.slice(i, d + 1) : names.slice(d, i + 1).reverse();
    return `<ol class="stoplist stoplist--live" aria-label="${esc(t('Weitere Halte'))}">${rest.map((n, k) => `<li class="stoplist__row is-${k === 0 ? 'next' : 'future'}"><i aria-hidden="true"></i><span class="stoplist__name">${esc(n)}</span></li>`).join('')}</ol>`;
  }

  // Server-Details mit echten Daten: Spieler nach Rollen und Züge
  function renderLiveDetail() {
    const id = state.serverId;
    const head = $('[data-sd-head]');
    const body = $('[data-sd-body]');
    const back = `<a class="back-link" href="#/server">${icon('ph-arrow-left')}${t('Alle Server')}</a>`;
    const d = live.detail[id];
    if (!d) {
      loadLiveDetail(id);
      head.innerHTML = `${back}<h1 class="appbar__value">${t('Server')}</h1>`;
      body.innerHTML = `<div class="sheet-loading">${icon('ph-spinner-gap')}<span>${t('Wird geladen …')}</span></div>`;
      return;
    }
    if (d.error) {
      head.innerHTML = `${back}<h1 class="appbar__value">${t('Server nicht gefunden')}</h1>`;
      body.innerHTML = `<p class="empty">${t('Diesen Server gibt es nicht mehr. Vielleicht wurde er gerade geschlossen.')}</p>`;
      return;
    }
    const s = d.server;
    const p = s.pserver;
    const avatars = d.avatars || {};
    const full = s.max && s.players >= s.max;
    const joinHref = s.private ? (p && p.canJoin && p.link ? p.link : null) : joinUrl({ id: s.id });
    const title = s.private ? (p ? p.name : t('Privater Server')) : t('Öffentlicher Server');
    head.innerHTML = `${back}
      <div class="appbar">
        <div class="appbar__title">
          <span class="appbar__label"><span class="live-dot"></span>${t('Live')}${s.version ? ` · v${esc(s.version)}` : ''} · ${s.private ? t('Privat') : t('Öffentlich')}</span>
          <h1 class="appbar__value">${esc(title)}<button class="sd-copy" type="button" data-copy="${esc(s.id)}" aria-label="${esc(t('Server-ID kopieren'))}" title="${esc(t('Server-ID kopieren'))}">${icon('ph-copy')}</button></h1>
        </div>
        <div class="appbar__actions">${full ? `<button class="btn btn--soft btn--sm" type="button" disabled>${t('Voll')}</button>`
          : joinHref ? `<a class="btn btn--primary btn--sm" href="${esc(joinHref)}" target="_blank" rel="noopener">${icon('phf-play')}${t('Beitreten')}</a>`
            : `<span class="ps-note">${icon('ph-lock')}${t('Beitreten nur über Roblox')}</span>`}</div>
      </div>
      ${p && p.ownerName ? `<p class="sd-net">${icon('ph-user')}${t('Privater Server von {name}', { name: esc(p.ownerName) })}</p>` : ''}`;
    const stats = `<div class="stat-row stat-row--4">
      <div class="stat"><span>${t('Spieler')}</span><b>${s.players}/${s.max}</b></div>
      <div class="stat"><span>${t('Züge unterwegs')}</span><b>${s.trainList.length}</b></div>
      <div class="stat"><span>${t('Laufzeit')}</span><b>${uptime(Math.max(1, Math.round((Date.now() - s.since) / 60000)))}</b></div>
      <div class="stat"><span>${t('Version')}</span><b>${s.version ? `v${esc(s.version)}` : '–'}</b></div>
    </div>`;
    const row = (x) => `<li><button class="sp-row" type="button" data-player="${esc(x.id)}">
      ${personPic(x, avatars)}<span class="sp-row__main"><b>${personName(x)}</b><span class="sp-row__doing">${doingHtml(x)}</span></span>${icon('ph-caret-right', 'sp-row__chev')}</button></li>`;
    const secHead = (ic, label, n, color = '') => `<h2 class="sd-sec__title">${color ? `<i class="sd-sec__dot" style="--rc:${esc(color)}"></i>` : icon(ic)}<span>${label}</span>${n ? `<small>${n}</small>` : ''}</h2>`;
    // 1. Abfertigung: Bahnhöfe, an denen gerade jemand aus dem Team mit der Zahl 2 abfertigt (ohne Teams: Bahnsteigpersonal)
    const dt = dispatchTeam(s.teams);
    const staff = s.people.filter((x) => (dt ? sameTeam(x.team, dt.name) : !s.teams && x.role === 'Platform Staff'));
    const stations = new Map();
    staff.forEach((x) => { const k = x.at || ''; if (!stations.has(k)) stations.set(k, []); stations.get(k).push(x); });
    const nextAt = (name) => s.trainList.filter((tr) => name && tr.next === name);
    const lineTag = (tr) => (tr.line ? `<span class="line line--${(lineByName(tr.line) || {}).cat || catOfTrain(tr.veh) || 're'}">${esc(tr.line)}</span>` : '');
    const dispatch = `<section class="sd-sec">
      ${secHead('ph-flag', dt ? t('Abfertigung · {team}', { team: esc(dt.name) }) : t('Abfertigung'), stations.size ? t('{n} Bahnhöfe', { n: stations.size }) : '', dt ? teamColor(dt) : '')}
      ${stations.size ? `<div class="disp-grid" data-reveal>${[...stations].map(([name, list]) => `<article class="disp" style="--rc:${esc(dt ? teamColor(dt) : roleRank('Platform Staff').color)}">
          <header class="disp__head"><span class="disp__ic">${icon('ph-map-pin')}</span><div><h3>${name ? esc(name) : t('Bahnhof nicht gemeldet')}</h3><small>${list.length === 1 ? t('1 Person fertigt ab') : t('{n} Personen fertigen ab', { n: list.length })}</small></div></header>
          ${nextAt(name).length ? `<p class="disp__next">${icon('ph-train')}<span>${nextAt(name).map((tr) => `${lineTag(tr)} ${tr.dest ? t('nach {to}', { to: esc(tr.dest) }) : esc(tr.train || '')}`).join(' · ')}</span></p>` : ''}
          <ul class="sp-list">${list.map(row).join('')}</ul>
        </article>`).join('')}</div>`
        : `<p class="team-empty">${dt || !s.teams ? t('Gerade fertigt niemand ab.') : t('Kein Team hat die Zahl 2 – im Spiel am Team für die Abfertigung als zweites Attribut 2 eintragen.')}</p>`}
    </section>`;
    // 2. Züge
    const byId = new Map(s.people.map((x) => [x.id, x]));
    const teamOf = (x) => (s.teams || []).find((tm) => sameTeam(tm.name, x.team));
    const trains = `<section class="sd-sec">${secHead('ph-train', t('Züge'), s.trainList.length ? fmt(s.trainList.length) : '')}
      ${s.trainList.length ? `<div class="train-grid" data-reveal>${s.trainList.map((tr) => {
        const L = lineByName(tr.line);
        const cat = L ? L.cat : catOfTrain(tr.veh) || 're';
        return `<article class="ltrain">
          <div class="ltrain__head">${tr.line ? `<span class="line line--${cat}">${esc(tr.line)}</span>` : `<span class="line line--${cat}">${icon('ph-train')}</span>`}
            <div class="ltrain__title"><h3>${tr.dest ? t('nach {to}', { to: esc(tr.dest) }) : esc(tr.train || t('Zug'))}</h3><small>${[tr.train, trainName(tr.veh)].filter(Boolean).map(esc).join(' · ')}</small></div></div>
          ${tr.next ? `<p class="train__now">${icon('ph-map-pin')}<span>${t('Nächster Halt')}: <b>${esc(tr.next)}</b></span></p>` : ''}
          ${liveStopsHtml(tr)}
          <div class="ltrain__crew">${tr.crew.map((c) => { const x = byId.get(c.id) || c; const tm = teamOf(x); return `<button class="crew crew--btn" type="button" data-player="${esc(c.id)}">${personPic(x, avatars)}<span class="crew__text"><small${tm ? ` style="color:${esc(teamColor(tm))}"` : ''}>${esc(tm ? tm.name : t(roleRank(c.role).label))}</small><b>${esc(x.dn || x.name || t('Spieler'))}</b></span></button>`; }).join('')}</div>
        </article>`;
      }).join('')}</div>` : `<p class="team-empty">${t('Kein Zug gemeldet. Züge erscheinen hier, sobald das Spiel Linie und Zugnummer der Fahrer meldet.')}</p>`}
    </section>`;
    // 3. Alle Teams aus dem Teams-Service, auch leere; wer neu dazukommt, steht unter den Spielern, die schon im Team sind
    const groups = teamGroups(s.people, s.teams);
    const teams = `<section class="sd-sec">${secHead('ph-users-three', s.teams ? t('Teams') : t('Spieler'), t('{n} Spieler', { n: fmt(s.people.length) }))}
      ${groups.length ? `<div data-reveal>${groups.map((g) => `<section class="pgroup${g.list.length ? '' : ' is-empty'}">
          <h3 class="pgroup__title"><i style="--rc:${esc(g.color)}"></i>${esc(g.name)}<small>${g.sub ? `${esc(g.sub)} · ` : ''}${g.list.length}</small></h3>
          ${g.list.length ? `<ul class="sp-list sp-list--card">${g.list.map(row).join('')}</ul>` : `<p class="team-empty">${t('Noch niemand in diesem Team')}</p>`}
        </section>`).join('')}</div>` : `<p class="empty">${t('Gerade ist niemand auf diesem Server.')}</p>`}
    </section>`;
    body.innerHTML = stats + dispatch + trains + teams;
    $$('[data-reveal]', body).forEach((x) => reveal(x));
  }

  // ---------- Server-Details ----------
  const delayHtml = (d) => (d ? `<span class="delay delay--${d > 5 ? 'bad' : 'warn'}">${t('+{n} Min.', { n: d })}</span>` : `<span class="delay delay--ok">${t('pünktlich')}</span>`);
  // Uhrzeit nach Fahrplan, darunter die erwartete Zeit (grün = pünktlich, rot = verspätet)
  const timeHtml = (sched, delay) => `<b>${hhmm(sched)}</b><small class="${delay ? 'is-late' : 'is-ok'}">${hhmm(sched + delay)}</small>`;
  const riders = (n) => (n === 1 ? t('1 Fahrgast') : t('{n} Fahrgäste', { n }));
  const stationBtn = (name) => `<button class="link-btn" type="button" data-station="${esc(name)}">${esc(name)}</button>`;
  const crewHtml = (p, role) => {
    const r = roleRank(p ? p.role : role);
    return `<span class="crew">${p ? avatar(p.name) : `<span class="crew__ai">${icon('ph-game-controller')}</span>`}
      <span class="crew__text"><small>${esc(t(r.label))}</small><b>${p ? esc(p.name) : t('KI')}</b></span></span>`;
  };
  function trainWhere(m, tr) {
    const st = tr.st;
    const stop = tr.stops[st.i];
    const gleis = gleisOf(m.stationMap.get(stop.name), tr).n;
    if (st.phase === 'wait') return t('Steht in {station} auf Gleis {n} bereit', { station: stop.name, n: gleis });
    if (st.phase === 'stop') return t('Hält in {station} auf Gleis {n}', { station: stop.name, n: gleis });
    return t('Zwischen {a} und {b}', { a: stop.name, b: tr.stops[st.i + 1].name });
  }
  // Zeit an einem Halt: bei Verspätung die Fahrplanzeit durchgestrichen, abgesetzt dahinter die neue Zeit
  const stopTime = (sched, delay) => (delay
    ? `<span class="st-time is-delayed"><s>${hhmm(sched)}</s><i class="st-time__sep" aria-hidden="true"></i><b class="${delay > 5 ? 'is-bad' : 'is-warn'}">${hhmm(sched + delay)}</b></span>`
    : `<span class="st-time"><b>${hhmm(sched)}</b></span>`);
  // Stand eines Halts in der Fahrt: passed (vorbei) | here (Zug steht hier) | next (nächster Halt) | future
  function stopPhase(tr, i) {
    const st = tr.st;
    if (st.phase === 'done') return 'passed';
    if (st.phase === 'wait') return i === 0 ? 'here' : 'future';
    if (st.phase === 'stop') return i < st.i ? 'passed' : i === st.i ? 'here' : 'future';
    return i <= st.i ? 'passed' : i === st.i + 1 ? 'next' : 'future';
  }
  function trainCard(m, tr) {
    const st = tr.st;
    const pctDone = Math.max(0, Math.min(100, st.progress * 100));
    const lastI = tr.stops.length - 1;
    return `<article class="train">
      <div class="train__head">
        ${lineBadge(tr.line)}
        <div class="train__title"><h3>${t('nach {to}', { to: esc(tr.to) })}</h3><small>${esc(tr.no)} · ${esc(tr.line.train)}</small></div>
        ${delayHtml(tr.delay)}
      </div>
      <p class="train__now">${icon(st.phase === 'run' ? 'ph-train' : 'ph-map-pin')}<span>${esc(trainWhere(m, tr))}</span></p>
      <div class="train__track" aria-hidden="true"><span style="width:${pctDone}%"></span><i style="left:${pctDone}%"></i></div>
      <ol class="stoplist" aria-label="${esc(t('Fahrtverlauf'))}">${tr.stops.map((stop, i) => `<li class="stoplist__row is-${stopPhase(tr, i)}">
          <i aria-hidden="true"></i><span class="stoplist__name">${esc(stop.name)}</span>
          ${i === lastI ? `<small class="stoplist__an">${t('an')}</small>` : ''}${stopTime(i === lastI ? stop.arr : stop.dep, tr.delay)}
        </li>`).join('')}</ol>
      <div class="train__crew">
        ${crewHtml(tr.crew.Driver, 'Qualified Driver')}
        ${tr.crew.Conductor ? crewHtml(tr.crew.Conductor, 'Conductor') : ''}
        ${tr.riders.length ? `<span class="crew crew--riders">${icon('ph-users-three')}${riders(tr.riders.length)}</span>` : ''}
      </div>
      <button class="sd-btn" type="button" data-trip="${esc(tr.id)}">${icon('ph-path')}<span>${t('Details')}<small>${t('Fahrtverlauf')}</small></span>${icon('ph-arrow-right', 'sd-btn__arrow')}</button>
    </article>`;
  }
  function playerWhere(p) {
    if (p.role === 'Supervisor') return p.station ? `${icon('ph-cell-signal-high')}<span>${t('Aufsicht im Betrieb')}</span>` : `${icon('ph-calendar-blank')}<span>${t('Leitet das Training')}</span>`;
    if (p.train) {
      return `${icon('ph-train')}<button class="link-btn" type="button" data-trip="${esc(p.train.id)}">${lineBadge(p.train.line)}<span>${t('nach {to}', { to: esc(p.train.to) })}</span></button>`;
    }
    if (!p.station) return '';
    if (p.role === 'Platform Staff') return `${icon('ph-map-pin')}<span>${stationBtn(p.station.name)} · ${tracksText(p)}</span>`;
    if (p.role === 'Signaller') return `${icon('ph-traffic-signal')}<span>${t('Stellwerk')} ${stationBtn(p.station.name)}</span>`;
    return `${icon('ph-clock')}<span>${t('Wartet in')} ${stationBtn(p.station.name)}</span>`;
  }
  function playerRow(p) {
    const r = roleRank(p.role);
    return `<li class="player">
      ${avatar(p.name)}
      <div class="player__main"><b>${esc(p.name)}</b><span class="player__where">${playerWhere(p)}</span></div>
      <span class="player__side">${rankPill(r)}<small>${t('seit {time}', { time: uptime(p.since) })}</small></span>
    </li>`;
  }
  function stationCard(m, st) {
    const deps = departures(m, st, 1);
    const next = deps[0];
    return `<button class="station" type="button" data-station="${esc(st.name)}">
      <span class="station__head">
        <span class="station__ic">${icon('ph-signpost')}</span>
        <span class="station__name"><b>${esc(st.name)}</b><small>${t('{n} Gleise', { n: st.platforms })}${st.box ? ` · ${t('Stellwerk')}` : ''}</small></span>
        ${icon('ph-caret-right', 'station__chev')}
      </span>
      <span class="station__lines">${st.lines.map((id) => lineBadge(D.lines[id])).join('')}</span>
      <span class="station__staff">${icon('ph-megaphone-simple')}${st.staff.length
        ? `<span><b>Platform Staff:</b> ${st.staff.map((p) => esc(p.name)).join(', ')}</span>`
        : `<span class="muted">${t('Kein Platform Staff')}</span>`}</span>
      ${next ? `<span class="station__next">${icon('ph-clock')}<span>${t('Nächster Zug')}: <b>${hhmm(next.time + next.tr.delay)}</b> ${esc(next.tr.line.name)} ${next.last ? t('aus {from}', { from: esc(next.tr.from) }) : t('nach {to}', { to: esc(next.tr.to) })}</span></span>` : ''}
    </button>`;
  }
  // Kommende Züge an einem Bahnhof: Abfahrten, am Endbahnhof Ankünfte
  function departures(m, st, limit = 12, within = 90, back = 0) {
    const now = m.now;
    const out = [];
    st.lines.filter((id) => m.s.lines.includes(id)).forEach((lineId) => {
      const L = D.lines[lineId];
      const end = lineEnd(L);
      [0, 1].forEach((dir) => {
        const j = (dir ? [...L.stops].reverse() : L.stops).findIndex(([name]) => name === st.name);
        const off = dir ? end - L.stops[L.stops.length - 1 - j][1] : L.stops[j][1];
        tripsBetween(lineId, dir, now - off - MAX_DELAY - 2 - back, now - off + within).forEach((tr) => {
          const stop = tr.stops[j];
          const last = j === tr.stops.length - 1;
          const time = last ? stop.arr : stop.dep;
          if (time + tr.delay < now - 0.5 - back || time > now + within) return;
          const s2 = tripState(tr, now);
          out.push({
            tr, j, time, last, gone: time + tr.delay < now - 0.5,
            here: (s2.phase === 'stop' || s2.phase === 'wait') && s2.i === j && !last, gleis: gleisOf(st, tr),
          });
        });
      });
    });
    // Wie am Bahnhof: nach Fahrplanzeit, bei gleicher Zeit nach der erwarteten
    const sorted = out.sort((a, b) => a.time - b.time || a.tr.delay - b.tr.delay);
    // Frühere Züge zusätzlich zur Anzahl der kommenden
    return sorted.slice(0, limit + sorted.filter((d) => d.gone).length);
  }

  function renderServerDetail() {
    if (liveMode()) { renderLiveDetail(); return; }
    const s = serverById(state.serverId);
    const head = $('[data-sd-head]');
    const body = $('[data-sd-body]');
    const back = `<a class="back-link" href="#/server">${icon('ph-arrow-left')}${t('Alle Server')}</a>`;
    if (!s) {
      head.innerHTML = `${back}<h1 class="appbar__value">${t('Server nicht gefunden')}</h1>`;
      body.innerHTML = `<p class="empty">${t('Diesen Server gibt es nicht mehr. Vielleicht wurde er gerade geschlossen.')}</p>`;
      return;
    }
    const m = serverModel(s);
    const full = s.players >= s.max;
    const typeName = { public: t('Öffentlich'), event: t('Event'), training: t('Training'), vip: 'VIP' }[s.type];
    const tab = state.sdTab;
    const tabBtn = (id, ic, label, n) => `<button type="button" role="tab" aria-selected="${tab === id}" data-sd-tab="${id}">${icon(ic)}${label}<span class="head-tabs__n">${n}</span></button>`;
    head.innerHTML = `${back}
      <div class="appbar">
        <div class="appbar__title">
          <span class="appbar__label"><span class="live-dot"></span>${t('Live')} · ${esc(s.region)} · v${esc(s.version)} · ${typeName}</span>
          <h1 class="appbar__value">${esc(t(s.name))}<button class="sd-copy" type="button" data-copy="${esc(s.id)}" aria-label="${esc(t('Server-ID kopieren'))}" title="${esc(t('Server-ID kopieren'))}">${icon('ph-copy')}</button></h1>
        </div>
        <div class="appbar__actions">${full
          ? `<button class="btn btn--soft btn--sm" type="button" disabled>${t('Voll')}</button>`
          : `<a class="btn btn--primary btn--sm" href="${esc(joinUrl(s))}" target="_blank" rel="noopener">${icon('phf-play')}${t('Beitreten')}</a>`}</div>
      </div>
      <p class="sd-net">${icon('ph-path')}${esc(t(s.network))}</p>
      <div class="head-tabs head-tabs--fill" role="tablist" aria-label="${esc(t('Ansicht'))}">
        ${tabBtn('trains', 'ph-train', t('Züge'), m.trains.length)}
        ${tabBtn('players', 'ph-users-three', t('Spieler'), m.players.length)}
        ${tabBtn('stations', 'ph-signpost', t('Stationen'), m.stations.length)}
      </div>`;

    const stats = `<div class="stat-row stat-row--4">
      <div class="stat"><span>${t('Spieler')}</span><b>${s.players}/${s.max}</b></div>
      <div class="stat"><span>${t('Züge unterwegs')}</span><b>${m.trains.length}</b></div>
      <div class="stat"><span>${t('Laufzeit')}</span><b>${uptime(s.uptime)}</b></div>
      <div class="stat"><span>Ping</span><b>${s.ping} ms</b></div>
    </div>`;
    let content = '';
    if (tab === 'trains') {
      const cats = CATS.filter((c) => s.lines.some((id) => D.lines[id].cat === c.id));
      if (!cats.some((c) => c.id === state.sdCat)) state.sdCat = 'all';
      const list = m.trains.filter((tr) => state.sdCat === 'all' || tr.line.cat === state.sdCat);
      content = `<div class="chips chips--scroll chips--block" role="group" aria-label="${esc(t('Zuggattung'))}">
          <button class="chip${state.sdCat === 'all' ? ' is-active' : ''}" type="button" data-sd-cat="all">${t('Alle')} · ${m.trains.length}</button>
          ${cats.map((c) => `<button class="chip${state.sdCat === c.id ? ' is-active' : ''}" type="button" data-sd-cat="${c.id}">${c.name} · ${m.trains.filter((tr) => tr.line.cat === c.id).length}</button>`).join('')}
        </div>
        <div class="train-grid">${list.length ? list.map((tr) => trainCard(m, tr)).join('') : `<p class="empty">${t('Gerade ist kein Zug dieser Gattung unterwegs.')}</p>`}</div>`;
    } else if (tab === 'players') {
      const roles = roleCounts(m.players);
      if (!roles.some(([r]) => r === state.sdRole)) state.sdRole = 'all';
      const groups = roles.filter(([r]) => state.sdRole === 'all' || r === state.sdRole);
      content = `<div class="chips chips--scroll chips--block" role="group" aria-label="${esc(t('Rolle'))}">
          <button class="chip${state.sdRole === 'all' ? ' is-active' : ''}" type="button" data-sd-role="all">${t('Alle')} · ${m.players.length}</button>
          ${roles.map(([r, n]) => `<button class="chip${state.sdRole === r ? ' is-active' : ''}" type="button" data-sd-role="${esc(r)}">${esc(r)} · ${n}</button>`).join('')}
        </div>
        ${groups.map(([r, n]) => `<section class="pgroup">
          <h2 class="pgroup__title"><i style="--rc:${roleRank(r).color}"></i>${esc(r)}<small>${esc(t(ROLE_LABEL[r]))} · ${n}</small></h2>
          <ul class="player-list">${m.players.filter((p) => p.role === r).map(playerRow).join('')}</ul>
        </section>`).join('')}`;
    } else {
      content = `<div class="station-grid">${m.stations.map((st) => stationCard(m, st)).join('')}</div>`;
    }
    body.innerHTML = stats + content;
  }

  // Fahrzeug: Nummer (Baureihe-Ordnungsnummer-Prüfziffer), Stromsystem und Geschwindigkeit
  const POLAND = /Rzepin|Poznań|Konin|Kutno|Warszawa/;
  function checkDigit(digits) {
    let sum = 0;
    [...digits].reverse().forEach((d, i) => { const v = +d * (i % 2 ? 1 : 2); sum += v > 9 ? v - 9 : v; });
    return (10 - (sum % 10)) % 10;
  }
  function vehicleOf(tr) {
    const T = D.trainTypes[tr.line.train] || { series: '000', vmax: 120, power: 'ac' };
    const serial = String(1 + (hash(tr.id) % 99)).padStart(3, '0');
    return { ...T, id: `${T.series}-${serial}-${checkDigit(T.series + serial)}` };
  }
  function powerText(tr, veh) {
    if (veh.power === 'diesel') return t('Diesel');
    if (veh.power === 'dc750') return `${fmt(750)} V DC`;
    if (veh.power === 'multi') {
      // Mehrsystemlok: in Polen 3.000 V Gleichstrom, Systemwechsel hinter Frankfurt (Oder)
      const st = tr.st;
      const a = POLAND.test(tr.stops[st.i].name);
      const b = POLAND.test(tr.stops[Math.min(st.i + 1, tr.stops.length - 1)].name);
      if (st.phase === 'run' ? (a && b) || (a !== b && (b ? st.seg > 0.4 : st.seg < 0.6)) : a) return `${fmt(3000)} V DC`;
    }
    return `${fmt(15000)} V AC`;
  }
  function speedOf(tr, veh) {
    const st = tr.st;
    if (!st || st.phase !== 'run') return 0;
    const cruise = veh.vmax * (0.72 + (hash(`${tr.id}#${st.i}`) % 25) / 100);
    return Math.max(4, Math.round(cruise * Math.min(1, Math.sin(Math.PI * st.seg) * 1.8)));
  }

  // Dialoge: Fahrtverlauf eines Zuges und kommende Züge an einem Bahnhof
  function tripView(id) {
    const s = serverById(state.serverId);
    const base = tripById(id);
    if (!s || !base) return `<p class="muted">${t('Diese Fahrt gibt es nicht mehr.')}</p>`;
    const m = serverModel(s);
    const live = m.trains.find((x) => x.id === id);
    const tr = live || Object.assign(base, { st: tripState(base, m.now), crew: {}, riders: [] });
    const st = tr.st;
    const veh = vehicleOf(tr);
    const lastI = tr.stops.length - 1;

    // Oben: wer fährt den Zug (ohne Hintergrund)
    const driver = tr.crew.Driver;
    const dr = driver && roleRank(driver.role);
    const head = driver
      ? `<header class="tv-user">
          <span class="avatar-ring tv-user__ring" style="--rc:${dr.color}">${avatar(driver.name)}</span>
          <span class="tv-user__text"><h3>${esc(driver.name)}</h3><span class="tv-badge" style="--rc:${dr.color}">${esc(t(dr.label))}</span></span>
        </header>`
      : `<header class="tv-user">
          <span class="avatar-ring tv-user__ring" style="--rc:var(--line-2)"><span class="tv-user__ai">${icon('ph-robot')}</span></span>
          <span class="tv-user__text"><h3>${live ? t('KI') : t('Noch offen')}</h3><span class="tv-badge tv-badge--muted">${esc(live ? t(rankOf('Qualified Driver').label) : st.phase === 'done' ? t('Diese Fahrt ist beendet.') : t('Die Besatzung steht kurz vor der Abfahrt fest.'))}</span></span>
        </header>`;

    const status = st.phase === 'done' ? t('Angekommen') : st.phase === 'wait'
      ? t('Abfahrt in {n} Min.', { n: Math.max(0, Math.ceil(tr.stops[0].dep - st.at)) }) : trainWhere(m, tr);
    const unit = `<section class="tv-card tv-unit">
        <div class="tv-unit__row">
          <div class="tv-unit__main"><span class="tv-label">${t('Einheit')}</span>${lineBadge(tr.line)}
            <b class="tv-unit__dest">${t('nach {to}', { to: esc(tr.to) })}</b><small>${esc(tr.no)} · ${esc(tr.line.train)}</small></div>
          <div class="tv-unit__id"><span class="tv-label">ID</span><code>${veh.id}</code></div>
        </div>
        <div class="tv-unit__facts">
          <span>${icon('ph-lightning', 'tv-ic tv-ic--power')}<b>${powerText(tr, veh)}</b></span>
          <span>${icon('ph-gauge', 'tv-ic tv-ic--speed')}<b>${t('{n} km/h', { n: speedOf(tr, veh) })}</b></span>
        </div>
        <p class="tv-unit__status">${icon(st.phase === 'run' ? 'ph-train' : 'ph-map-pin')}<span>${esc(status)}</span>${delayHtml(tr.delay)}</p>
        ${tr.crew.Conductor || tr.riders.length ? `<div class="train__crew">${tr.crew.Conductor ? crewHtml(tr.crew.Conductor, 'Conductor') : ''}
          ${tr.riders.length ? `<span class="crew crew--riders">${icon('ph-users-three')}${riders(tr.riders.length)}</span>` : ''}</div>` : ''}
      </section>`;

    // Reiseplan wie im DB Navigator: Start und Ziel mit Gleis-Schild, dazwischen die Zwischenhalte (ein- und ausblendbar).
    // Die Linie ist bis zur aktuellen Position dunkel, der Zug fährt als roter Punkt mit.
    const mids = lastI - 1;
    const open = state.tripMid || mids < 1;
    const progress = st.phase === 'done' ? 1 : st.phase === 'wait' ? 0 : Math.max(0, Math.min(1, st.progress));
    const fillOf = (i) => (st.phase === 'done' || i < st.i ? 1 : i === st.i && st.phase === 'run' ? st.seg : 0);
    const marker = (fill, top) => (fill > 0 && fill < 1 ? `<span class="tl__train" style="top:calc(${top}px + ${(fill * 100).toFixed(1)}%)">${icon('ph-train')}</span>` : '');
    const row = (i, kind) => {
      const stop = tr.stops[i];
      const station = m.stationMap.get(stop.name);
      const g = gleisOf(station, tr);
      const ph = stopPhase(tr, i);
      const time = kind === 'end' ? stop.arr : stop.dep;
      const fill = kind === 'end' ? 0 : kind === 'start' ? +(progress > 0) : fillOf(i);
      const people = station ? [...station.signallers.map((p) => [p, 'Signaller']), ...station.staff.map((p) => [p, 'Platform Staff'])] : [];
      const dot = kind === 'end' ? icon(st.phase === 'done' ? 'phf-map-pin' : 'ph-map-pin', 'tl__pin') : `<i class="tl__dot${kind === 'start' ? ' tl__dot--start' : ''}"></i>`;
      return `<li class="tl__row tl__row--${kind} is-${ph}">
        <span class="tl__time"><b>${hhmm(time)}</b><small class="${tr.delay ? 'is-late' : 'is-ok'}">${hhmm(time + tr.delay)}</small></span>
        <span class="tl__rail" style="--fill:${fill.toFixed(3)}">${dot}${kind === 'mid' ? marker(fill, 12) : ''}</span>
        <span class="tl__body">
          <span class="tl__head">${stationBtn(stop.name)}${glHtml(g, kind !== 'mid')}</span>
          ${ph === 'here' || g.changed ? `<span class="tl__notes">${ph === 'here' ? `<small class="tl__note">${t('Zug steht hier')}</small>` : ''}${g.changed ? `<small class="tl__note tl__note--gl">${t('Gleiswechsel – planmäßig Gl. {n}', { n: g.plan })}</small>` : ''}</span>` : ''}
          ${people.length ? `<span class="tl__chips">${people.map(([p, role]) => `<span class="tl-chip" style="--rc:${rankOf(role).color}">${avatar(p.name)}<span>${role}: <b>${esc(p.name)}</b></span></span>`).join('')}</span>` : ''}
        </span>
      </li>`;
    };
    // Abschnitt mit der Linie zwischen Start und erstem Zwischenhalt (eingeklappt: bis zum Ziel)
    const legFill = open ? fillOf(0) : progress;
    const leg = `<li class="tl__row tl__row--leg">
        <span class="tl__time"></span>
        <span class="tl__rail" style="--fill:${legFill.toFixed(3)}">${marker(legFill, 0)}</span>
        <span class="tl__body">
          <span class="tl-leg">${lineChip(tr.line)}<b>${t('nach {to}', { to: esc(tr.to) })}</b></span>
          ${mids ? `<button class="tl-toggle" type="button" data-trip-mid aria-expanded="${open}">${open ? t('Zwischenhalte ausblenden') : mids === 1 ? t('1 Zwischenhalt anzeigen') : t('{n} Zwischenhalte anzeigen', { n: mids })}${icon('ph-caret-down')}</button>` : ''}
        </span>
      </li>`;
    const dur = Math.max(0, Math.round(tr.stops[lastI].arr - tr.stops[0].dep));
    const rows = [row(0, 'start'), leg, ...(open ? tr.stops.slice(1, -1).map((x, k) => row(k + 1, 'mid')) : []), row(lastI, 'end')];
    return `<div class="tv">
      ${head}
      ${unit}
      <section class="tv-card tv-line">
        <header class="rp-head">
          <h4>${esc(tr.from)} <span aria-hidden="true">→</span> ${esc(tr.to)}</h4>
          <p>${t('Heute')} <i aria-hidden="true">•</i> ${t('Dauer: {d}', { d: `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}` })} <i aria-hidden="true">•</i> ${t('0 Umstiege')}</p>
        </header>
        <ol class="tl">${rows.join('')}</ol>
      </section>
      <p class="sheet-note">${t('Oben die Zeit laut Fahrplan, darunter die erwartete Zeit. Tippe auf einen Bahnhof für die Abfahrten dort.')}</p>
    </div>`;
  }
  // Abfahrtstafel eines Bahnhofs (wie im DB Navigator): Filter nach Zuggattung, früher/später blättern
  const BOARD_GROUPS = [
    { id: 'fern', label: 'Fernverkehr', cats: ['ice', 'ec', 'ic'] },
    { id: 'regio', label: 'Regional', cats: ['ire', 're', 'rb'] },
    { id: 's', label: 'S-Bahn', cats: ['s'] },
  ];
  function stationView(name) {
    const s = serverById(state.serverId);
    const m = s && serverModel(s);
    const st = m && m.stationMap.get(name);
    if (!st) return `<p class="muted">${t('Diesen Bahnhof gibt es auf diesem Server nicht.')}</p>`;
    if (state.board.name !== name) state.board = { name, cat: 'all', back: 0, more: 0 };
    const b = state.board;
    const cats = st.lines.filter((id) => m.s.lines.includes(id)).map((id) => D.lines[id].cat);
    const groups = BOARD_GROUPS.filter((g) => g.cats.some((c) => cats.includes(c)));
    if (!groups.some((g) => g.id === b.cat)) b.cat = 'all';
    const group = BOARD_GROUPS.find((g) => g.id === b.cat);
    const list = departures(m, st, 500, 90 + b.more * 5, b.back).filter((d) => !group || group.cats.includes(d.tr.line.cat));
    let left = 12 + b.more;
    const shown = list.filter((d) => d.gone || left-- > 0);
    const crew = (ic, label, people, extra, none) => `<div class="sb-crew__row">
        <span class="sb-crew__label">${icon(ic)}${label}</span>
        ${people.length ? `<span class="tl__chips">${people.map((p) => `<span class="tl-chip" style="--rc:${rankOf(p.role).color}">${avatar(p.name)}<span><b>${esc(p.name)}</b>${extra(p) ? ` · ${extra(p)}` : ''}</span></span>`).join('')}</span>`
          : `<small class="muted">${none}</small>`}
      </div>`;
    const row = (d) => {
      const tr = d.tr;
      const via = tr.stops.slice(d.j + 1, -1).slice(0, 3).map((x) => x.name).join(' · ');
      const note = d.gone ? (d.last ? t('Angekommen') : t('Abgefahren'))
        : d.here ? `<b>${t('Steht am Gleis')}</b>` : d.last ? t('Endet hier') : via ? esc(t('Über {via}', { via })) : esc(tr.no);
      return `<li><button class="sb-row${d.gone ? ' is-gone' : ''}" type="button" data-trip="${esc(tr.id)}">
          <span class="sb-row__time"><b>${hhmm(d.time)}</b><b class="${tr.delay ? 'is-late' : 'is-ok'}">${hhmm(d.time + tr.delay)}</b></span>
          <span class="sb-row__main">
            <span class="sb-row__line">${lineChip(tr.line)}<b>${esc(d.last ? t('Von {from}', { from: tr.from }) : t('Nach {to}', { to: tr.to }))}</b></span>
            ${d.gleis.changed && !d.gone ? `<small class="sb-row__warn">${icon('ph-info')}${t('Gleiswechsel, statt Gl. {p}', { p: d.gleis.plan })}</small>` : ''}
            <small class="sb-row__note">${note}</small>
          </span>
          ${glHtml(d.gleis, false)}
        </button></li>`;
    };
    return `<div class="sb">
      <header class="sb-head">
        <span class="sb-head__ic">${icon('ph-signpost')}</span>
        <span class="sb-head__text"><h3>${esc(st.name)}</h3><small>${t('{n} Gleise', { n: st.platforms })}${st.box ? ` · ${t('Stellwerk')}` : ''} · ${t('Stand {time}', { time: hhmm(Math.floor(m.now)) })}</small></span>
      </header>
      <div class="sb-crew">
        ${crew('ph-megaphone-simple', 'Platform Staff', st.staff, tracksText, t('Gerade niemand – die Abfertigung übernimmt die KI.'))}
        ${st.box ? crew('ph-traffic-signal', t('Stellwerk'), st.signallers, () => '', t('Nicht besetzt – die KI stellt die Fahrstraßen.')) : ''}
      </div>
      ${groups.length > 1 ? `<div class="sb-tabs" role="tablist" aria-label="${esc(t('Zuggattung'))}">
        <button type="button" role="tab" aria-selected="${b.cat === 'all'}" data-board-cat="all">${t('Alle')}</button>
        ${groups.map((g) => `<button type="button" role="tab" aria-selected="${b.cat === g.id}" data-board-cat="${g.id}">${esc(t(g.label))}</button>`).join('')}
      </div>` : ''}
      ${b.back < 120 ? `<button class="sb-more" type="button" data-board-earlier>${icon('ph-caret-down', 'is-up')}${t('Früher')}</button>` : ''}
      ${shown.length ? `<ol class="sb-list">${shown.map(row).join('')}</ol>` : `<p class="sb-empty">${t('In den nächsten 90 Minuten fährt hier kein Zug.')}</p>`}
      ${b.more < 48 && list.length > shown.length ? `<button class="sb-more" type="button" data-board-later>${icon('ph-caret-down')}${t('Später')}</button>` : ''}
    </div>`;
  }

  // ---------- Trainings ----------
  // Der Wochenplan aus data.js wird für zwei Wochen ausgerollt.
  // Uhrzeit (ms) → Tag und Minuten in deutscher Zeit
  function berlinOf(ms) {
    const p = {};
    berlinFmt.formatToParts(new Date(ms)).forEach((x) => { p[x.type] = x.value; });
    const day = Math.floor(Date.UTC(+p.year, +p.month - 1, +p.day) / 864e5);
    return { day, abs: day * 1440 + (+p.hour % 24) * 60 + +p.minute };
  }
  // Datum und Uhrzeit in deutscher Zeit → ms (auch bei Sommer-/Winterzeit)
  function berlinToEpoch(date, time) {
    const [y, mo, d] = date.split('-').map(Number);
    const [h, mi] = time.split(':').map(Number);
    const want = Math.floor(Date.UTC(y, mo - 1, d) / 864e5) * 1440 + h * 60 + mi;
    let guess = Date.UTC(y, mo - 1, d, h, mi);
    for (let i = 0; i < 2; i++) guess -= (berlinOf(guess).abs - want) * 60000;
    return guess;
  }
  function remoteTrainings() {
    return (remote.trainings || []).map((x) => {
      const b = berlinOf(x.start);
      return {
        id: x.id, type: x.type, title: x.title, host: x.host, hostName: x.hostName, hostAvatar: x.hostAvatar, hostId: x.hostId, server: x.server, slots: x.slots, taken: 0, dur: x.dur, text: x.text,
        helpers: Array.isArray(x.helpers) ? x.helpers : [],
        day: b.day, start: b.abs, end: b.abs + x.dur, time: hhmm(b.abs), req: reqFor(x.type),
        img: (typeOf(x.type) || {}).img || 'training.svg', color: rankOf(x.type).color, remote: true,
      };
    });
  }
  function trainingsList({ all = false } = {}) {
    const now = berlinNow();
    const types = myTrainingTypes();
    const out = apiReady() ? remoteTrainings() : [];
    for (let week = 0; week < (apiReady() ? 0 : 2); week++) {
      D.trainings.forEach((tn, i) => {
        const [hh, mm] = tn.time.split(':').map(Number);
        const day = now.day + tn.day + week * 7;
        const start = day * 1440 + hh * 60 + mm;
        const id = `${i}-${day}`;
        const taken = week === 0 ? tn.taken : Math.max(0, tn.taken - 3 - (i % 3));
        out.push(Object.assign({}, tn, {
          id, day, start, end: start + tn.dur,
          taken: Math.min(tn.slots, taken),
          req: reqFor(tn.type),
          img: (typeOf(tn.type) || {}).img || 'training.svg',
          color: rankOf(tn.type).color,
        }));
      });
    }
    return out
      .filter((tn) => tn.end > now.abs && (all || !types || types.includes(tn.type)))
      .sort((a, b) => a.start - b.start);
  }
  const findTraining = (id) => trainingsList({ all: true }).find((tn) => tn.id === id);
  const isLocked = (tn) => rankIdx(state.rank) < rankIdx(tn.req);
  function trainingState(tn) {
    const free = tn.slots - tn.taken;
    if (isLocked(tn)) return { cls: 'lock', text: t('ab {rank}', { rank: tn.req }), level: 'warn' };
    if (free <= 0) return { cls: 'bad', text: t('Voll'), level: 'bad' };
    if (free <= 2) return { cls: 'warn', text: t('{n} frei', { n: free }), level: 'warn' };
    return { cls: 'ok', text: t('{n} frei', { n: free }), level: 'ok' };
  }

  // Trainingsserver: öffnet 15 Minuten vor Beginn und schließt mit dem Ende des Trainings
  const SERVER_OPENS = 15;
  function serverStatus(tn) {
    const now = berlinNow().abs;
    const opens = tn.start - SERVER_OPENS;
    if (now >= opens && now < tn.end) return { cls: 'open', text: t('Server offen'), open: true };
    if (now < opens && opens - now <= 60) return { cls: 'soon', text: t('Öffnet in {n} Min.', { n: opens - now }), open: false };
    return { cls: 'closed', text: t('Geschlossen'), open: false };
  }
  const serverPill = (tn) => {
    const ss = serverStatus(tn);
    return `<span class="server-pill server-pill--${ss.cls}"><i></i>${ss.text}</span>`;
  };

  function nextStepHTML(heading) {
    const next = nextRank(state.rank);
    if (!next && mayTrain()) {
      return `<article class="promo-card">
        <img class="promo-card__img" src="assets/img/group.svg" alt="" loading="lazy">
        <div class="promo-card__body">
          <${heading}>${t('Du bildest jetzt selbst aus')}</${heading}>
          <p>${t('Als {rank} kannst du Trainings für eine Rolle anbieten – die Spieler werden auf Wunsch rechtzeitig benachrichtigt.', { rank: esc(state.rank) })}</p>
          <button class="btn btn--primary promo-card__btn" type="button" data-open="training-new">${icon('ph-plus')}${t('Training anbieten')}</button>
        </div>
      </article>`;
    }
    if (!next) {
      return `<article class="promo-card">
        <img class="promo-card__img" src="assets/img/group.svg" alt="" loading="lazy">
        <div class="promo-card__body">
          <${heading}>${t('Alle Ausbildungen geschafft')}</${heading}>
          <p>${t('Du hast den höchsten Rang erreicht. Als Supervisor kannst du jetzt selbst Trainings leiten.')}</p>
          <a class="btn btn--primary promo-card__btn" href="#/karriere/supervisor">${icon('ph-briefcase')}${t('Als Supervisor bewerben')}</a>
        </div>
      </article>`;
    }
    const type = typeOf(next.name);
    const tn = trainingsList({ all: true }).find((x) => x.type === next.name);
    let when = t('Noch kein {type}-Training geplant.', { type: next.name });
    if (tn) {
      const today = berlinNow().day;
      const vars = { type: next.name, time: tn.time, day: dayName(tn.day) };
      when = tn.day === today ? t('{type}-Training heute um {time} Uhr.', vars)
        : tn.day === today + 1 ? t('{type}-Training morgen um {time} Uhr.', vars)
          : t('{type}-Training am {day} um {time} Uhr.', vars);
    }
    return `<article class="promo-card">
      <img class="promo-card__img" src="assets/img/${type.img}" alt="" loading="lazy">
      <div class="promo-card__body">
        <${heading}>${t('Dein nächster Schritt: {rank}', { rank: esc(next.name) })}</${heading}>
        <p>${esc(when)} ${tn ? t('Der Server öffnet {n} Minuten vorher.', { n: SERVER_OPENS }) : t('Aktiviere die Glocke, dann sagen wir Bescheid.')}</p>
      </div>
      ${tn
        ? `<button class="btn btn--primary promo-card__btn" type="button" data-detail="${tn.id}">${t('Details')}</button>`
        : `<button class="btn btn--primary promo-card__btn" type="button" data-bell>${t('Erinnern')}</button>`}
    </article>`;
  }
  function renderNextSteps() {
    const home = $('[data-next-step="home"]');
    const full = $('[data-next-step="full"]');
    if (state.page === 'home' && home) home.innerHTML = nextStepHTML('h3');
    if (state.page === 'trainings' && full) full.innerHTML = nextStepHTML('h2');
  }

  const bellBtn = (tn, cls) => {
    const on = isReminded(tn);
    return `<button class="${cls}" type="button" data-remind="${tn.id}" aria-pressed="${on}" aria-label="${esc(on ? t('Benachrichtigung aus') : t('Benachrichtigen, wenn der Server öffnet'))}">${icon(on ? 'phf-bell-ringing' : 'ph-bell')}</button>`;
  };
  // Leitung des Trainings: Profilbild und daneben der Name
  const hostHtml = (tn, cls = '') => `<span class="host ${cls}">${tn.hostAvatar
    ? `<span class="avatar"><img src="${esc(tn.hostAvatar)}" alt="" referrerpolicy="no-referrer"></span>` : avatar(tn.host)}<span class="host__name"><b>${esc(tn.hostName || tn.host)}</b>${tn.hostName && tn.hostName !== tn.host ? `<small>@${esc(tn.host)}</small>` : ''}</span></span>`;
  // Training als Zeile wie auf der Abfahrtstafel: Uhrzeit, Rolle und Titel, Leitung, Server, Plätze, Glocke
  function tcard(tn) {
    const st = trainingState(tn);
    const ss = serverStatus(tn);
    return `<article class="tg-card${ss.open ? ' is-open' : ''}" style="--rc:${tn.color}">
      <button class="tg-card__main" type="button" data-detail="${tn.id}">
        <span class="tg-card__time"><b>${tn.time}</b><small>${t('{n} Min.', { n: tn.dur })}</small></span>
        <span class="tg-card__body">
          <span class="tg-card__role"><i></i>${esc(tn.type)}</span>
          <b class="tg-card__title">${esc(t(tn.title))}</b>
          ${hostHtml(tn, 'host--sm')}
        </span>
        <span class="tg-card__side">
          ${serverPill(tn)}
          <span class="tg-card__slots pill-state pill-state--${st.cls}">${icon(st.cls === 'lock' ? 'ph-lock' : 'phf-user')}${st.cls === 'lock' ? st.text : tn.remote ? t('max. {n}', { n: tn.slots }) : `${tn.taken}/${tn.slots}`}</span>
        </span>
      </button>
      ${bellBtn(tn, 'tg-card__bell')}
    </article>`;
  }

  function renderTrainings() {
    const now = berlinNow();
    const list = trainingsList();
    const me = rankOf(state.rank);

    const rankName = $('[data-rank-name]');
    rankName.textContent = me.name;
    rankName.title = me.name;
    const dot = $('[data-rank-dot]');
    if (dot) { dot.style.setProperty('--rc', me.color); dot.textContent = me.prefix; }
    $$('[data-can-train]').forEach((b) => { b.hidden = !mayTrain(); });
    const bell = $('[data-bell]');
    bell.setAttribute('aria-pressed', String(state.bell));
    bell.classList.toggle('is-on', !!state.bell);
    const types = myTrainingTypes();
    $('[data-all-title]').textContent = !types ? t('Alle kommenden Trainings') : types.length ? t('Kommende {type}-Trainings', { type: types[0] }) : t('Keine weiteren Trainings');

    // Tage: 14 Tage, Punkt = an diesem Tag gibt es Trainings
    const days = Array.from({ length: 14 }, (_, i) => now.day + i);
    if (state.trainingDay === null || !days.includes(state.trainingDay)) state.trainingDay = list.length ? list[0].day : now.day;
    const tabs = $('[data-day-tabs]');
    tabs.innerHTML = days.map((d) => {
      const n = list.filter((tn) => tn.day === d).length;
      const top = d === now.day ? t('Heute') : d === now.day + 1 ? t('Morgen') : wdShort(d);
      return `<button class="tg-dayb${n ? ' has-trainings' : ''}" type="button" role="tab" aria-selected="${d === state.trainingDay}" data-day="${d}" aria-label="${dayName(d, { long: true })}${n ? `, ${t('{n} Trainings', { n })}` : ''}">
        <small>${top}</small><b>${dtf({ day: 'numeric' }).format(dateOf(d))}</b><i>${n ? n : ''}</i></button>`;
    }).join('');
    const sel = $('[aria-selected="true"]', tabs);
    if (sel) tabs.scrollTo({ left: sel.offsetLeft - tabs.clientWidth / 2 + sel.clientWidth / 2, behavior: 'instant' });

    const field = $('[data-date-field]');
    field.textContent = dayName(state.trainingDay, { long: true });

    // Trainings am gewählten Tag
    const ofDay = list.filter((tn) => tn.day === state.trainingDay);
    const nextDay = list.find((tn) => tn.day > state.trainingDay);
    $('[data-day-trainings]').innerHTML = ofDay.length
      ? ofDay.map(tcard).join('')
      : types && !types.length
        ? `<div class="tg-empty">${icon('ph-check-circle')}<span>${t('Für deinen Rang gibt es keine weiteren Trainings.')}</span></div>`
        : `<div class="tg-empty">${icon('ph-calendar-blank')}<span>${t('An diesem Tag ist kein Training geplant.')}${nextDay ? ` ${t('Nächstes:')} <button class="more-link" type="button" data-day="${nextDay.day}">${dayName(nextDay.day)}</button>` : ''}</span></div>`;

    // Alle kommenden Trainings als Tafel
    const shown = state.showAll ? list : list.slice(0, 6);
    $('[data-all-trainings]').innerHTML = shown.length ? shown.map((tn) => {
      const st = trainingState(tn);
      return `<li><button type="button" data-detail="${tn.id}" style="--rc:${tn.color}">
        <span class="tg-board__date${tn.day === now.day ? ' is-today' : ''}"><small>${wdShort(tn.day)}</small><b>${dateOf(tn.day).getUTCDate()}</b></span>
        <span class="tg-board__time">${tn.time}</span>
        <span class="tg-board__main"><b>${esc(t(tn.title))}</b><small><i></i>${esc(tn.type)} · ${esc(tn.hostName || tn.host)}</small></span>
        <span class="tg-board__end">${isReminded(tn) ? `<span class="tlist__bell" title="${esc(t('Benachrichtigung an'))}">${icon('phf-bell-ringing')}</span>` : ''}<span class="pill-state pill-state--${st.cls}">${st.text}</span>${icon('ph-caret-right')}</span>
      </button></li>`;
    }).join('') : `<li class="tg-empty">${types && !types.length ? t('Für deinen Rang gibt es keine weiteren Trainings.') : t('Gerade sind keine Trainings geplant.')}</li>`;
    const toggle = $('[data-all-toggle]');
    toggle.hidden = list.length <= 6;
    toggle.textContent = state.showAll ? t('Weniger anzeigen') : t('Alle anzeigen');

    // Ausbildungsweg als Linie mit Halten (nur die Ausbildungsränge bis Signaller, danach das Team)
    const cur = rankIdx(state.rank);
    const path = RANKS.filter((r) => !r.staff);
    $('[data-rank-ladder]').innerHTML = path.map((r) => {
      const i = rankIdx(r.name);
      return `<li class="${i === cur ? 'is-current' : i < cur ? 'is-done' : ''}" style="--rc:${r.color}"><i></i><b>${esc(r.name)}</b><small>${esc(t(r.label))}</small>${i === cur ? `<em>${t('Du bist hier')}</em>` : ''}</li>`;
    }).join('') + `<li class="${cur >= rankIdx('Junior Supervisor') ? 'is-done' : ''} is-team"><i></i><b>${t('Team')}</b><small>${t('ab Junior Supervisor über die Karriere')}</small></li>`;

    renderNextSteps();
  }

  // ---------- Neuigkeiten ----------
  // Kategorien (wie backend/content.js → NEWS_CATS): Name im Filter, Farbe des Schilds
  const NEWS_CATS = [
    ['update', 'Updates', 'Update', '#1E2A78'], ['event', 'Events', 'Event', '#EC0016'], ['community', 'Community', 'Community', '#2E8B57'],
    ['strecke', 'Neue Strecken', 'Strecke', '#0F7B8A'], ['fahrzeug', 'Neue Züge', 'Fahrzeug', '#7A3FC7'], ['training', 'Trainings', 'Training', '#D97706'],
    ['team', 'Team & Stellen', 'Team', '#2563EB'], ['wartung', 'Wartung', 'Wartung', '#64748B'], ['gewinnspiel', 'Gewinnspiele', 'Gewinnspiel', '#DB2777'],
    ['hinweis', 'Wichtig', 'Hinweis', '#B45309'],
  ];
  const newsCat = (id) => NEWS_CATS.find((c) => c[0] === id) || NEWS_CATS[0];
  const catTag = (n) => `<span class="cat-tag" style="--cc:${newsCat(n.cat)[3]}">${esc(t(n.tag || newsCat(n.cat)[2]))}</span>`;
  const newsDate = (n) => dtf({ day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(n.date.length > 10 ? n.date : `${n.date}T00:00:00Z`));
  function newsCard(n) {
    return `<button class="ncard" type="button" data-news-open="${esc(n.id)}">
      <div class="ncard__img"><img src="${esc(newsImage(n))}" alt="" loading="lazy" referrerpolicy="no-referrer">${n.video ? `<span class="ncard__play" aria-label="${esc(t('Mit Video'))}">${icon('phf-play')}</span>` : ''}</div>
      <div class="ncard__body">
        <h3>${esc(t(n.title))}</h3>
        <div class="ncard__foot">${catTag(n)}<span>${newsDate(n)}</span></div>
      </div>
    </button>`;
  }
  function renderNewsPage() {
    // Filter: Alle und jede Kategorie, in der es Neuigkeiten gibt (die gewählte bleibt sichtbar)
    const used = new Set(newsItems().map((n) => n.cat));
    const tabs = $('[data-news-tabs]');
    if (tabs) {
      tabs.innerHTML = [['all', 'Alle'], ...NEWS_CATS.filter((c) => used.has(c[0]) || c[0] === state.newsCat)]
        .map(([id, label]) => `<button type="button" role="tab" aria-selected="${state.newsCat === id}" data-news-cat="${id}">${esc(t(label))}</button>`).join('');
    }
    $$('[data-can-pr]').forEach((b) => { b.hidden = !mayPR(); });
    const list = newsItems().filter((n) => state.newsCat === 'all' || n.cat === state.newsCat);
    // Neueste groß, alle weiteren als Karten mit Lesezeit (ein Klick öffnet die Neuigkeit als eigene Seite)
    $('[data-news-feed]').innerHTML = list.length
      ? `<div class="nr-grid">${newsTile(list[0], 'feature')}<div class="nr-side">${list.slice(1, 4).map((n) => newsTile(n)).join('')}</div></div>
        ${list.length > 4 ? `<div class="nr-cards">${list.slice(4).map((n) => newsTile(n, 'card')).join('')}</div>` : ''}`
      : `<p class="empty">${t('Hier gibt es noch keine Neuigkeiten.')}</p>`;
  }

  // ---------- Karriere ----------
  // Stelle offen? Mit Backend legt das Public Relations Department das fest (auch mit Zeitraum), sonst data.js
  const jobState = (job) => (apiReady() ? remote.jobs[job.id] || null : null);
  function jobOpen(job, at = Date.now()) {
    const s = jobState(job);
    if (!s) return job.open;
    if (s.limit && (s.received || 0) >= s.limit) return false;
    if (s.from && at < s.from) return false;
    if (s.to && at > s.to) return false;
    return s.open !== false || !!(s.closedAt && at < s.closedAt);
  }
  const fmtWhen = (ms) => new Intl.DateTimeFormat(locale, { timeZone: 'Europe/Berlin', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(ms);
  function jobStatus(job) {
    const s = jobState(job);
    if (s && s.limit && (s.received || 0) >= s.limit) return `<span class="pill pill--bad">${t('Voll')}</span>`;
    if (jobOpen(job)) return `<span class="pill pill--ok">${icon('ph-check')}${s && s.to ? t('Offen bis {date}', { date: fmtWhen(s.to) }) : t('Offen')}</span>`;
    if (s && s.from && Date.now() < s.from && s.open !== false) return `<span class="pill pill--warn">${icon('ph-clock')}${t('Öffnet am {date}', { date: fmtWhen(s.from) })}</span>`;
    return `<span class="pill pill--bad">${t('Geschlossen')}</span>`;
  }
  // Wer angefangen hat, als die Stelle offen war, darf noch absenden (12 Stunden lang)
  const applyStarts = () => store.get('tsg-apply-start', {});
  const startedRecently = (job) => { const ts = applyStarts()[job.id]; return !!ts && Date.now() - ts < 12 * 3600000 && jobOpen(job, ts); };
  function markApplyStart(job) {
    const all = applyStarts();
    if (!startedRecently(job)) { all[job.id] = Date.now(); store.set('tsg-apply-start', all); }
  }
  // Zeit (ms) ↔ Feld „Datum und Uhrzeit“ in deutscher Zeit
  const toLocalInput = (ms) => { if (!ms) return ''; const b = berlinOf(ms); return `${dateOf(b.day).toISOString().slice(0, 10)}T${hhmm(b.abs)}`; };
  const fromLocalInput = (v) => (v ? berlinToEpoch(v.slice(0, 10), v.slice(11, 16)) : null);
  // Auf der Seite einer Stelle: kurze Verwaltung mit „Bearbeiten“
  function jobAdmin(job) {
    if (mayPR() && !canBackend()) {
      return `<section class="cbox admin-strip"><span class="admin-strip__ic">${icon('ph-gear-six')}</span><div><b>${t('Verwaltung')}</b><small>${t('Geht, sobald der App-Server verbunden ist.')}</small></div>
        <button class="btn btn--soft btn--sm" type="button" data-open="backend-setup">${t('Einrichten')}</button></section>`;
    }
    if (!canPR()) return '';
    const st = jobStats(job);
    return `<section class="cbox admin-strip"><span class="admin-strip__ic">${icon('ph-gear-six')}</span>
      <div><b>${t('Verwaltung')}</b><small>${esc(jobLine(job))} · ${t('{n} Bewerbungen', { n: st.total })}</small></div>
      <button class="btn btn--primary btn--sm" type="button" data-job-edit="${esc(job.id)}">${icon('ph-pencil-simple')}${t('Bearbeiten')}</button></section>`;
  }
  // ---------- Stellen verwalten (ab Public Relations Department) ----------
  // Je Stelle: offen/geschlossen, Zeitraum (mit Vorlagen), Höchstzahl an Bewerbungen, „Dringend gesucht“,
  // Hinweis für Bewerber, Zahlen zu den Bewerbungen und ein Verlauf, wer was geändert hat.
  const untilText = (ms) => {
    const min = Math.round((ms - Date.now()) / 60000);
    if (min < 60) return t('noch {n} Min.', { n: Math.max(1, min) });
    if (min < 2880) return t('noch {n} Std.', { n: Math.round(min / 60) });
    return t('noch {n} Tage', { n: Math.round(min / 1440) });
  };
  const jobFull = (s) => !!(s && s.limit && (s.received || 0) >= s.limit);
  function jobStats(job) {
    const apps = (review.list || []).filter((a) => a.job === job.id);
    const scored = apps.filter((a) => a.total);
    return {
      total: apps.length, fresh: apps.filter((a) => a.status === 'new').length,
      passed: apps.filter((a) => a.status === 'passed').length, failed: apps.filter((a) => a.status === 'failed').length,
      avg: scored.length ? Math.round((scored.reduce((sum, a) => sum + a.score / a.total, 0) / scored.length) * 100) : null,
    };
  }
  function jobLine(job) {
    const s = jobState(job) || {};
    if (jobFull(s)) return t('Voll – {n} Bewerbungen erreicht', { n: s.limit });
    if (jobOpen(job)) return s.to ? t('Offen bis {date} · {left}', { date: fmtWhen(s.to), left: untilText(s.to) }) : t('Offen ohne Enddatum');
    if (s.from && Date.now() < s.from && s.open !== false) return t('Öffnet am {date} · {left}', { date: fmtWhen(s.from), left: untilText(s.from) });
    return s.closedAt ? t('Geschlossen seit {date}', { date: fmtWhen(s.closedAt) }) : t('Geschlossen');
  }
  function jobLineShort(job) {
    const s = jobState(job) || {};
    if (jobFull(s)) return t('Höchstzahl erreicht');
    if (jobOpen(job)) return s.to ? untilText(s.to) : t('ohne Enddatum');
    if (s.from && Date.now() < s.from && s.open !== false) return untilText(s.from);
    return s.closedAt ? t('seit {date}', { date: fmtWhen(s.closedAt) }) : '';
  }
  function manageCard(job) {
    const s = jobState(job) || {};
    const st = jobStats(job);
    const isOpen = s.open !== undefined ? s.open !== false : job.open;
    const stat = (n, label, cls = '') => `<div class="jm-stat ${cls}"><b>${n}</b><span>${label}</span></div>`;
    return `<article class="jm-card${jobOpen(job) ? ' is-open' : ''}">
      <header class="jm-card__head">
        <div class="jm-card__title"><h3>${esc(t(job.title))}</h3><span>${icon('ph-users-three')}${t('Team {name}', { name: t(job.team) })}</span></div>
        <label class="switch" title="${esc(t('Bewerbungen offen'))}"><input type="checkbox" role="switch" data-job-toggle="${esc(job.id)}"${isOpen ? ' checked' : ''} aria-label="${esc(t('Bewerbungen offen'))}"><span class="toggle__ui" aria-hidden="true"></span></label>
      </header>
      <p class="jm-card__line">${jobStatus(job)}<span>${esc(jobLineShort(job))}</span></p>
      ${s.urgent || s.note ? `<div class="jm-card__tags">${s.urgent ? `<span class="pill pill--bad">${icon('ph-lightning')}${t('Dringend gesucht')}</span>` : ''}${s.note ? `<span class="pill pill--info">${icon('ph-info')}${t('Hinweis aktiv')}</span>` : ''}</div>` : ''}
      <div class="jm-stats">${stat(st.total, t('gesamt'))}${stat(st.fresh, t('neu'), st.fresh ? 'is-new' : '')}${stat(st.passed, t('bestanden'), 'is-ok')}${stat(st.avg === null ? '–' : `${st.avg} %`, t('Ø Ergebnis'))}</div>
      ${s.limit ? `<div class="jm-limit"><div class="jm-limit__row"><span>${t('Plätze')}</span><b>${t('{a} von {b}', { a: s.received || 0, b: s.limit })}</b></div><i><span style="width:${Math.min(100, ((s.received || 0) / s.limit) * 100)}%"></span></i></div>` : ''}
      <div class="jm-card__actions">
        <button class="btn btn--primary btn--sm" type="button" data-job-edit="${esc(job.id)}">${icon('ph-pencil-simple')}${t('Bearbeiten')}</button>
        <button class="btn btn--soft btn--sm" type="button" data-job-apps="${esc(job.id)}">${icon('ph-file-text')}${t('Bewerbungen')}${st.fresh ? `<span class="count-badge">${st.fresh}</span>` : ''}</button>
        <a class="btn btn--soft btn--sm" href="#/karriere/${esc(job.id)}">${icon('ph-eye')}${t('Ansehen')}</a>
      </div>
      ${s.updatedBy ? `<p class="jm-card__by">${t('Zuletzt geändert von {name} · {date}', { name: esc(s.updatedBy), date: fmtWhen(s.updated) })}</p>` : ''}
    </article>`;
  }
  function careerManage() {
    const back = `<a class="back-link" href="#/karriere">${icon('ph-arrow-left')}${t('Karriere')}</a>`;
    if (!canPR()) return `${back}<div class="cbox">${mayPR() ? backendSetupHtml() : `<p class="lead">${t('Stellen verwalten kann das Public Relations Department und höher.')}</p>`}</div>`;
    const open = D.jobs.filter((x) => jobOpen(x)).length;
    const fresh = review.list ? review.list.filter((a) => a.status === 'new').length : 0;
    return `${back}
      <section class="cbox jm-intro">
        <h2>${t('Stellen <em>verwalten</em>')}</h2>
        <p class="lead">${t('Öffnen und schließen, Zeiträume und Plätze festlegen, dringende Stellen hervorheben – alles auf einen Blick.')}</p>
        <div class="jm-summary">
          <div><b>${open}</b><span>${t('offen')}</span></div>
          <div><b>${D.jobs.length - open}</b><span>${t('geschlossen')}</span></div>
          <a href="#/karriere/pruefen"><b>${fresh}</b><span>${t('neue Bewerbungen')}</span></a>
        </div>
      </section>
      <div class="jm-list">${D.jobs.map(manageCard).join('')}</div>`;
  }
  // Dialog „Stelle bearbeiten“
  function jobEditView(id) {
    const job = D.jobs.find((x) => x.id === id);
    if (!job || !canPR()) return `<p class="muted">${t('Diese Stelle gibt es nicht.')}</p>`;
    const s = jobState(job) || {};
    const isOpen = s.open !== undefined ? s.open !== false : job.open;
    const preset = s.from || s.to ? 'custom' : 'none';
    const chip = (val, label) => `<label class="pick"><input type="radio" name="preset" value="${val}"${preset === val ? ' checked' : ''}><span>${label}</span></label>`;
    return `<form class="cform job-edit" data-job-form="${esc(job.id)}" novalidate>
      <div class="job-edit__title"><b>${esc(t(job.title))}</b><span>${esc(jobLine(job))}</span></div>
      <label class="toggle"><span class="toggle__text"><b>${t('Bewerbungen offen')}</b><small>${t('Aus = sofort geschlossen. Wer gerade schreibt, darf trotzdem noch absenden.')}</small></span>
        <input type="checkbox" role="switch" name="open"${isOpen ? ' checked' : ''}><span class="toggle__ui" aria-hidden="true"></span></label>
      <fieldset class="f"><legend class="f__label">${t('Zeitraum')}</legend>
        <div class="pick-grid">${chip('none', t('Ohne Ende'))}${chip('7', t('7 Tage'))}${chip('14', t('14 Tage'))}${chip('30', t('30 Tage'))}${chip('custom', t('Eigene Zeit'))}</div>
        <div class="job-edit__custom">
          <div class="f"><label class="f__label" for="je-from">${t('Offen ab (optional)')}</label><input id="je-from" name="from" type="datetime-local" value="${toLocalInput(s.from)}"></div>
          <div class="f"><label class="f__label" for="je-to">${t('Offen bis')}</label><input id="je-to" name="to" type="datetime-local" value="${toLocalInput(s.to)}"></div>
        </div>
        <small class="f__hint">${t('Deutsche Zeit. Danach schließt die Stelle von selbst – wer vorher angefangen hat, kann noch absenden.')}</small>
      </fieldset>
      <div class="f"><label class="f__label" for="je-limit">${t('Höchstzahl an Bewerbungen')}</label>
        <input id="je-limit" name="limit" type="number" inputmode="numeric" min="0" max="500" value="${s.limit || 0}">
        <small class="f__hint">${t('0 = unbegrenzt. Ist sie erreicht, schließt die Stelle automatisch. Bisher eingegangen: {n}.', { n: s.received || 0 })}</small>
        ${s.received ? `<label class="check"><input type="checkbox" name="resetCount"><span>${t('Zähler auf 0 zurücksetzen')}</span></label>` : ''}
      </div>
      <label class="toggle"><span class="toggle__text"><b>${t('Dringend gesucht')}</b><small>${t('Die Stelle bekommt ein auffälliges Abzeichen und steht oben.')}</small></span>
        <input type="checkbox" role="switch" name="urgent"${s.urgent ? ' checked' : ''}><span class="toggle__ui" aria-hidden="true"></span></label>
      <div class="f"><label class="f__label" for="je-note">${t('Hinweis für Bewerber (optional)')}</label>
        <textarea id="je-note" name="note" maxlength="200" rows="2" placeholder="${esc(t('z. B. Wir suchen vor allem Builder für die Strecke nach Warschau.'))}">${esc(s.note || '')}</textarea></div>
      <button class="btn btn--primary btn--lg btn--block" type="submit">${icon('ph-check')}${t('Speichern')}</button>
      ${(s.log || []).length ? `<div class="job-edit__log"><h4>${t('Verlauf')}</h4><ul>${s.log.map((l) => `<li><b>${esc(l.text)}</b><small>${esc(l.by)} · ${fmtWhen(l.at)}</small></li>`).join('')}</ul></div>` : ''}
    </form>`;
  }
  function jobBody(job, patch = {}) {
    const s = jobState(job) || {};
    return { open: s.open !== undefined ? s.open !== false : job.open, from: s.from || null, to: s.to || null, limit: s.limit || 0, note: s.note || '', urgent: !!s.urgent, ...patch };
  }
  async function putJob(id, body, msg) {
    try {
      await api(`/api/jobs/${encodeURIComponent(id)}`, { method: 'PUT', body });
      await loadContent();
      if (state.page === 'karriere') renderCareer();
      if (msg) toast(msg);
      return true;
    } catch (e) {
      toast(errorText(e));
      if (state.page === 'karriere') renderCareer();
      return false;
    }
  }
  async function saveJobForm(form) {
    const id = form.dataset.jobForm;
    const f = new FormData(form);
    const preset = f.get('preset');
    let from = null;
    let to = null;
    if (preset === 'custom') {
      from = fromLocalInput(f.get('from'));
      to = fromLocalInput(f.get('to'));
      if (from && to && to <= from) { toast(t('„Offen bis“ muss nach „Offen ab“ liegen.')); return; }
    } else if (preset && preset !== 'none') to = Date.now() + +preset * 86400000;
    const body = {
      open: !!f.get('open'), from, to, limit: Math.max(0, Math.min(500, Math.round(+f.get('limit') || 0))),
      urgent: !!f.get('urgent'), note: String(f.get('note') || '').trim(), resetCount: !!f.get('resetCount'),
    };
    const btn = $('button[type="submit"]', form);
    btn.disabled = true;
    if (await putJob(id, body, t('Gespeichert'))) closeModal();
    else btn.disabled = false;
  }

  // Skript nachladen (Übersetzungen)
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => { s.remove(); reject(new Error(src)); };
      document.head.appendChild(s);
    });
  }
  // ---------- Karriereportal: Stellen wie eine Abfahrtstafel, Stellenseite, Bewerbung in drei kurzen Schritten ----------
  // Nur wenige Fragen: Über dich (Kontakt, Rang, Spielzeit), sechs Antworten, Überblick und Absenden.
  const SINCE = ['Weniger als 1 Monat', '1–3 Monate', '3–6 Monate', '6–12 Monate', 'Mehr als 1 Jahr'];
  const HOURS = [['Unter 2 Std.', 2], ['2–5 Std.', 4], ['5–10 Std.', 7], ['Über 10 Std.', 10]];
  // Je Stelle eine eigene Frage
  const JOB_QUESTION = {
    'game-developer': 'Was hast du schon in Roblox Studio oder mit Lua gebaut?',
    'map-builder': 'Welchen Bahnhof oder welche Strecke würdest du gern bauen – und warum?',
    moderator: 'Ein Spieler beleidigt andere im Chat. Wie gehst du vor?',
    supervisor: 'Wie läuft ein gutes Training bei dir ab?',
    'social-media': 'Welche Idee hast du für unseren nächsten Clip?',
  };
  const APPLY_STEPS = [
    { title: 'Über dich', text: 'Damit wir dich im Spiel, auf Discord und per E-Mail erreichen.' },
    { title: 'Deine Antworten', text: 'Sechs kurze Fragen – ehrlich und in eigenen Worten.' },
    { title: 'Absenden', text: 'Schau noch einmal drüber und schick deine Bewerbung ab.' },
  ];
  // Die Fragen aus Schritt 2 (ohne Bereich), in dieser Reihenfolge auch im Überblick und für das Team
  function applyQuestions(job) {
    return [
      { key: 'motivation', type: 'long', q: t('Warum möchtest du Teil des Teams werden?'), min: 40, placeholder: t('Erzähl uns, was dich antreibt') },
      { key: 'experience', type: 'long', q: t('Welche Erfahrung bringst du für diese Stelle mit?'), min: 30, placeholder: t('Beschreibe kurz deine Erfahrung') },
      { key: 'job', type: 'long', q: t(JOB_QUESTION[job.id] || 'Was würdest du als Erstes anpacken?'), min: 20, placeholder: t('Deine Antwort') },
      { key: 'hours', type: 'hours', q: t('Wie viel Zeit hast du pro Woche?') },
      { key: 'days', type: 'days', q: t('An welchen Tagen bist du meistens da?') },
      { key: 'link', type: 'link', q: t('Möchtest du uns etwas zeigen?'), optional: true },
    ];
  }
  const dataField = (name) => `data-field="${esc(name)}"`;

  function jobFacts(job) {
    const n = applyQuestions(job).length;
    return `<dl class="cr-facts">
        <div><dt>${t('Dauer')}</dt><dd>${t('ca. 5 Minuten')}</dd></div>
        <div><dt>${t('Fragen')}</dt><dd>${n}</dd></div>
        <div><dt>${t('Antwort')}</dt><dd>${t('innerhalb von 7 Tagen')}</dd></div>
      </dl>`;
  }
  function crStatus(job) {
    const s = jobState(job);
    if (jobFull(s)) return `<span class="cr-status cr-status--bad"><i></i>${t('Voll')}</span>`;
    if (jobOpen(job)) return `<span class="cr-status cr-status--ok"><i></i>${s && s.to ? t('Offen bis {date}', { date: fmtWhen(s.to) }) : t('Offen')}</span>`;
    if (s && s.from && Date.now() < s.from && s.open !== false) return `<span class="cr-status cr-status--soon"><i></i>${t('Öffnet am {date}', { date: fmtWhen(s.from) })}</span>`;
    return `<span class="cr-status"><i></i>${t('Geschlossen')}</span>`;
  }
  function jobRow(job) {
    const s = jobState(job) || {};
    const open = jobOpen(job);
    const applied = state.applications[job.id];
    return `<a class="cr-row${open ? '' : ' is-closed'}" href="#/karriere/${job.id}">
        <span class="cr-row__main"><b>${esc(t(job.title))}</b><small>${esc(t(job.text))}</small></span>
        <span class="cr-row__meta">${crStatus(job)}${s.urgent && open ? `<em class="cr-flag cr-flag--hot">${t('Dringend gesucht')}</em>` : ''}${applied ? `<em class="cr-flag">${t('Beworben')}</em>` : ''}</span>
        ${icon('ph-caret-right', 'cr-row__go')}
      </a>`;
  }
  // Ab Public Relations Department: Zugang zu Prüfen und Verwalten
  function careerStaff() {
    if (!mayPR()) return '';
    const open = D.jobs.filter((x) => jobOpen(x)).length;
    const fresh = review.list ? review.list.filter((a) => a.status === 'new').length : 0;
    return `<div class="cr-staff-links">
        <span class="cr-staff-links__label">${t('Für das Team')}</span>
        <a class="cr-staff-link" href="#/karriere/pruefen">${t('Bewerbungen prüfen')}<small>${fresh ? t('{n} neu', { n: fresh }) : t('Alles geprüft')}</small></a>
        <a class="cr-staff-link" href="#/karriere/verwalten">${t('Stellen verwalten')}<small>${t('{a} von {b} offen', { a: open, b: D.jobs.length })}</small></a>
      </div>`;
  }
  function careerList() {
    const open = D.jobs.filter((x) => jobOpen(x)).length;
    const sortJobs = (list) => list.slice().sort((a, b) => (jobOpen(b) - jobOpen(a)) || (!!(jobState(b) || {}).urgent - !!(jobState(a) || {}).urgent));
    const teams = [...new Set(D.jobs.map((j) => j.team))];
    const groups = teams.map((team) => {
      const jobs = sortJobs(D.jobs.filter((j) => j.team === team));
      const n = jobs.filter((j) => jobOpen(j)).length;
      return `<section class="cr-team">
          <h2 class="cr-team__name">${esc(t(team))}<small>${n ? (n === 1 ? t('1 Stelle offen') : t('{n} Stellen offen', { n })) : t('gerade nichts offen')}</small></h2>
          <div class="cr-team__jobs">${jobs.map(jobRow).join('')}</div>
        </section>`;
    }).join('');
    return `<header class="site-head cr-hero">
        <div class="site-wrap cr-hero__grid">
          <div>
            <p class="cr-eyebrow">${t('Karriere')}</p>
            <h1 class="cr-hero__title">${t('Mach mit bei Train Sim Germany.')}</h1>
          </div>
          <div class="cr-hero__side">
            <p>${t('Train Sim Germany wird von einem Team aus der Community gebaut und betrieben. Such dir eine Stelle aus – die Bewerbung dauert nur ein paar Minuten.')}</p>
            <p class="cr-hero__open">${open === 1 ? t('Gerade ist 1 Stelle offen.') : t('Gerade sind {n} Stellen offen.', { n: open })}</p>
          </div>
        </div>
      </header>
      <div class="site-wrap cr-body">
        ${careerStaff()}
        ${groups}
        <section class="cr-team cr-team--how">
          <h2 class="cr-team__name">${t('So läuft es ab')}</h2>
          <div class="cr-how">
            <p>${t('Du suchst dir eine Stelle aus und liest Aufgaben und Anforderungen in Ruhe durch.')}</p>
            <p>${t('Die Bewerbung hat drei Teile: ein paar Angaben zu dir, sechs kurze Fragen und ein letzter Blick, bevor du sie abschickst.')}</p>
            <p>${t('Das Team liest jede Bewerbung und meldet sich innerhalb von 7 Tagen – im Chat, per E-Mail und auf Discord.')}</p>
          </div>
        </section>
      </div>`;
  }
  function careerDetail(job) {
    const app = state.applications[job.id];
    const st = jobState(job);
    let action;
    if (app) {
      action = `<div class="cr-note cr-note--ok">${icon('ph-check')}<span>${t('Du hast dich am {date} beworben.', { date: fmtDate(app.at) })}</span></div>
        <a class="site-btn site-btn--brand site-btn--block" href="#/karriere/${job.id}/bewerbung">${t('Deine Bewerbung ansehen')}${icon('ph-arrow-right')}</a>`;
    } else if (!jobOpen(job)) {
      const soon = st && st.from && Date.now() < st.from && st.open !== false;
      action = `<div class="cr-note cr-note--bad">${icon('ph-info')}<span>${jobFull(st) ? t('Alle Plätze sind vergeben – es sind genug Bewerbungen eingegangen.') : soon ? t('Bewerbungen sind ab {date} möglich.', { date: fmtWhen(st.from) }) : t('Diese Stelle ist gerade geschlossen. Schau bald wieder vorbei oder frag auf unserem Discord nach.')}</span></div>
        <a class="site-btn site-btn--ghost site-btn--block" href="${esc(D.links.discord)}" target="_blank" rel="noopener">${icon('si-discord')}${t('Zum Discord')}</a>`;
    } else {
      action = `<a class="site-btn site-btn--brand site-btn--block site-btn--split" href="#/karriere/${job.id}/bewerben">${t('Jetzt bewerben')}${icon('ph-arrow-right')}</a>
        ${st && st.to ? `<p class="cr-side__small">${t('Bewerbungen sind bis {date} möglich ({left}).', { date: fmtWhen(st.to), left: untilText(st.to) })}</p>` : ''}
        ${st && st.limit ? `<p class="cr-side__small">${t('Noch {n} Plätze frei.', { n: Math.max(0, st.limit - (st.received || 0)) })}</p>` : ''}`;
    }
    if (st && st.note) action = `<div class="cr-note">${icon('ph-info')}<span><b>${t('Hinweis vom Team')}:</b> ${esc(st.note)}</span></div>${action}`;
    const list = (items) => `<ul class="cr-list">${items.map((x) => `<li>${esc(t(x))}</li>`).join('')}</ul>`;
    const areas = job.areas
      ? `<section class="cr-sec"><h2>${t('Bereiche')}</h2><ul class="cr-areas">${job.areas.map((a) => `<li style="--rc:${rankOf(a).color}"><i></i>${esc(a)}</li>`).join('')}</ul></section>`
      : '';
    return `<header class="site-head cr-jobhead">
        <div class="site-wrap">
          <nav class="cr-crumbs" aria-label="${esc(t('Brotkrumen'))}"><a href="#/karriere">${t('Karriere')}</a><span aria-hidden="true">/</span><span>${esc(t(job.team))}</span></nav>
          <h1 class="cr-jobhead__title">${esc(t(job.title))}</h1>
          <p class="site-head__lead">${esc(t(job.text))}</p>
          <div class="cr-jobhead__meta">${crStatus(job)}${st && st.urgent && jobOpen(job) ? `<em class="cr-flag cr-flag--hot">${t('Dringend gesucht')}</em>` : ''}<span>${t('Team {name}', { name: esc(t(job.team)) })}</span></div>
        </div>
      </header>
      <div class="site-wrap cr-job">
        <div class="cr-job__main">
          <section class="cr-sec"><h2>${t('Deine Aufgaben')}</h2>${list(job.tasks)}</section>
          <section class="cr-sec"><h2>${t('Das bringst du mit')}</h2>${list(job.needs)}</section>
          ${areas}
        </div>
        <aside class="cr-job__side">
          <div class="cr-side">
            <h2>${t('Interesse?')}</h2>
            ${jobFacts(job)}
            <div class="cr-side__action">${action}</div>
          </div>
          ${jobAdmin(job)}
        </aside>
      </div>`;
  }

  // Bereiche bis zum eigenen Rang sind wählbar, die anderen sind ausgegraut mit Hinweis
  function areasHtml(job, rank, chosen) {
    const mine = rankIdx(rank);
    const any = job.areas.some((a) => mine >= rankIdx(a));
    return `<div class="cr-pick cr-pick--areas">${job.areas.map((a) => {
      const ok = mine >= rankIdx(a);
      return `<label class="cr-opt${ok ? '' : ' is-locked'}" style="--rc:${rankOf(a).color}"${ok ? '' : ` title="${esc(t('Du brauchst mindestens den Rang {rank}.', { rank: a }))}"`}>
          <input type="radio" name="area" value="${esc(a)}"${ok ? '' : ' disabled'}${ok && a === chosen ? ' checked' : ''}>
          <span><i></i>${esc(a)}${ok ? '' : `<small>${t('Ab Rang {rank}', { rank: esc(a) })}</small>`}</span>
        </label>`;
    }).join('')}</div>
      <span class="f__hint">${any
        ? t('Du kannst dich für jeden Bereich bis zu deinem Rang bewerben (gerade: <b>{rank}</b>).', { rank: esc(rank) })
        : t('Für den Supervisor brauchst du mindestens den Rang Qualified Driver.')}</span>`;
  }
  function questionHtml(q, n, total) {
    const head = `<span class="cr-q__no">${t('Frage {n} von {total}', { n, total })}${q.optional ? ` · ${t('freiwillig')}` : ''}</span><span class="cr-q__text">${esc(q.q)}</span>`;
    const name = `q:${q.key}`;
    const id = `cr-${q.key}`;
    if (q.type === 'long') {
      return `<div class="cr-q f" ${dataField(name)} data-q="long" data-min="${q.min}"><label class="cr-q__head" for="${id}">${head}</label>
          <textarea id="${id}" name="${esc(name)}" rows="4" placeholder="${esc(q.placeholder)}"></textarea>
          <span class="cr-q__count" data-count="${q.min}">0 / ${q.min}</span></div>`;
    }
    if (q.type === 'hours') {
      return `<fieldset class="cr-q f" ${dataField(name)} data-q="single"><legend class="cr-q__head">${head}</legend>
          <div class="cr-pick">${HOURS.map(([label], i) => `<label class="cr-opt"><input type="radio" name="${esc(name)}" value="${i}"><span>${esc(t(label))}</span></label>`).join('')}</div></fieldset>`;
    }
    if (q.type === 'days') {
      return `<fieldset class="cr-q f" ${dataField(name)} data-q="multi"><legend class="cr-q__head">${head}</legend>
          <div class="cr-pick cr-pick--days">${[0, 1, 2, 3, 4, 5, 6].map((d) => `<label class="cr-opt"><input type="checkbox" name="${esc(name)}" value="${d}"><span>${esc(dayShort(d))}</span></label>`).join('')}</div></fieldset>`;
    }
    return `<div class="cr-q f" ${dataField(name)} data-q="link"><label class="cr-q__head" for="${id}">${head}</label>
        <div class="write">${icon('ph-link')}<input id="${id}" name="${esc(name)}" type="url" inputmode="url" autocomplete="url" spellcheck="false" placeholder="https://…"></div>
        <span class="f__hint">${t('Zum Beispiel ein Video, ein Spiel, Screenshots oder dein Portfolio.')}</span></div>`;
  }
  function careerApply(job) {
    const rankOpts = RANKS.map((r) => `<option value="${esc(r.name)}"${r.name === state.rank ? ' selected' : ''}>${esc(r.name)} · ${esc(t(r.label))}</option>`).join('');
    const qs = applyQuestions(job);
    const field = (name, label, input) => `<div class="cr-field f" ${dataField(name)}><label class="f__label" for="ap-${name}">${label}</label>${input}</div>`;
    return `<div class="site-wrap cr-apply" data-apply-top>
        <aside class="cr-apply__side">
          <nav class="cr-crumbs" aria-label="${esc(t('Brotkrumen'))}"><a href="#/karriere">${t('Karriere')}</a><span aria-hidden="true">/</span><a href="#/karriere/${job.id}">${esc(t(job.title))}</a></nav>
          <h1 class="cr-apply__title">${t('Bewerbung')}<small>${esc(t(job.title))}</small></h1>
          <ol class="cr-steps" data-steps>${APPLY_STEPS.map((s, i) => `<li${i === 0 ? ' class="is-active" aria-current="step"' : ''}><span class="cr-steps__no">${t('Teil {n}', { n: i + 1 })}</span><b>${t(s.title)}</b><small>${t(s.text)}</small></li>`).join('')}</ol>
        </aside>
        <form class="cr-form" data-apply="${job.id}" data-step="1" novalidate>
          <section class="cr-step" data-step-box="1">
            <h2 class="cr-step__title">${t(APPLY_STEPS[0].title)}</h2>
            <div class="cr-grid">
              ${field('roblox', t('Roblox-Benutzername'), `<input id="ap-roblox" name="roblox" autocomplete="username" value="${esc(state.profile ? state.profile.username : D.me.username)}" placeholder="${esc(t('Dein Roblox-Benutzername'))}"${state.profile && state.profile.oauth ? ' readonly' : ''}>`)}
              ${field('discord', t('Discord-Benutzername'), `<input id="ap-discord" name="discord" autocomplete="off" placeholder="${esc(t('z. B. lokfuehrer_max'))}">`)}
              ${field('email', t('E-Mail-Adresse'), `<input id="ap-email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="${esc(t('name@beispiel.de'))}">`)}
              ${field('rank', t('Dein aktueller Rang'), `<div class="select"><select id="ap-rank" name="rank">${rankOpts}</select>${icon('ph-caret-down')}</div>`)}
            </div>
            <fieldset class="cr-q f" ${dataField('since')} data-q="single"><legend class="f__label">${t('Du spielst seit')}</legend>
              <div class="cr-pick cr-pick--seg">${SINCE.map((x) => `<label class="cr-opt"><input type="radio" name="since" value="${esc(x)}"><span>${esc(t(x))}</span></label>`).join('')}</div></fieldset>
          </section>
          <section class="cr-step" data-step-box="2" hidden>
            <h2 class="cr-step__title">${t(APPLY_STEPS[1].title)}</h2>
            <p class="cr-step__text">${t('Ehrlich und in eigenen Worten – es gibt keine falschen Antworten.')}</p>
            ${job.areas ? `<fieldset class="cr-q f" ${dataField('area')}><legend class="cr-q__head"><span class="cr-q__no">${t('Bereich')}</span><span class="cr-q__text">${t('In welchem Bereich möchtest du Trainings leiten?')}</span></legend><div data-areas>${areasHtml(job, state.rank, null)}</div></fieldset>` : ''}
            ${qs.map((q, i) => questionHtml(q, i + 1, qs.length)).join('')}
          </section>
          <section class="cr-step" data-step-box="3" hidden>
            <h2 class="cr-step__title">${t(APPLY_STEPS[2].title)}</h2>
            <p class="cr-step__text">${t(APPLY_STEPS[2].text)}</p>
            <div class="cr-review" data-apply-review></div>
            <div class="f" ${dataField('confirm')}><label class="confirm"><input type="checkbox" name="confirm"><span>${t('Ich habe alle Angaben ehrlich gemacht und kenne die Regeln von Train Sim Germany.')}</span></label></div>
            <p class="cr-side__small">${apiReady() && loginReady() ? t('Die Bewerbung geht mit deinem Roblox-Konto direkt an das Team.') : t('Demo: Die Bewerbung wird noch nicht verschickt, sondern nur auf diesem Gerät gespeichert.')}</p>
          </section>
          <div class="cr-form__nav">
            <button class="cr-back" type="button" data-step-prev hidden>${icon('ph-arrow-left')}${t('Zurück')}</button>
            <button class="site-btn cr-next" type="button" data-step-next>${t('Weiter')}${icon('ph-arrow-right')}</button>
            <button class="site-btn site-btn--brand" type="submit" hidden>${t('Bewerbung senden')}${icon('ph-paper-plane-tilt')}</button>
          </div>
        </form>
      </div>`;
  }
  function careerDone(job, app) {
    const chatLink = app.chatId ? `<a class="cr-note__link" href="#/chat/${esc(app.chatId)}">${t('Zur Nachricht im Chat')} ${icon('ph-arrow-right')}</a>` : '';
    const stage = app.status === 'passed' || app.status === 'failed' ? 2 : 1;
    const result = app.status === 'passed' ? `<div class="cr-note cr-note--ok">${icon('ph-trophy')}<span><b>${t('Bestanden – herzlichen Glückwunsch!')}</b>${chatLink}</span></div>`
      : app.status === 'failed' ? `<div class="cr-note cr-note--bad">${icon('ph-info')}<span><b>${t('Diesmal leider nicht bestanden. Du kannst dich später noch einmal bewerben.')}</b>${chatLink}</span></div>` : '';
    const track = [t('Gesendet'), t('Wird geprüft'), t('Ergebnis')];
    const rows = [[t('Stelle'), t(job.title)], ...(app.area ? [[t('Bereich'), app.area]] : []), [t('Rang'), app.rank], ['Discord', app.discord],
      ...(app.email ? [[t('E-Mail'), app.email]] : []), [t('Gesendet'), fmtDate(app.at)]];
    return `<div class="site-wrap site-wrap--narrow cr-done">
        <nav class="cr-crumbs" aria-label="${esc(t('Brotkrumen'))}"><a href="#/karriere">${t('Karriere')}</a><span aria-hidden="true">/</span><a href="#/karriere/${job.id}">${esc(t(job.title))}</a></nav>
        <p class="cr-done__sent">${icon('ph-check-circle')}${t('Bewerbung gesendet')}</p>
        <h1 class="cr-done__title">${t('Danke, {name}.', { name: esc(app.roblox) })}</h1>
        <p class="site-head__lead">${t('Wir schauen uns deine Bewerbung an und melden uns innerhalb von 7 Tagen.')}</p>
        <ol class="cr-track" aria-label="${esc(t('Stand'))}">${track.map((x, i) => `<li class="${i < stage ? 'is-done' : i === stage ? 'is-now' : ''}"${i === stage ? ' aria-current="step"' : ''}><span>${x}</span></li>`).join('')}</ol>
        ${result}
        ${app.mailed && app.email ? `<p class="cr-side__small">${icon('ph-envelope-simple')} ${t('Eine Kopie mit allen Angaben ging an {email}.', { email: `<b>${esc(app.email)}</b>` })}</p>` : ''}
        <dl class="cr-dl">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        <div class="cr-done__actions">
          <a class="site-btn site-btn--ghost" href="#/karriere/${job.id}">${icon('ph-arrow-left')}${t('Zurück zur Stelle')}</a>
          ${app.sent ? '' : `<button class="site-btn site-btn--ghost" type="button" data-apply-reset="${job.id}">${t('Bewerbung zurückziehen')}</button>`}
        </div>
        ${app.sent ? `<p class="cr-side__small">${t('Die Bewerbung ist beim Team angekommen. Zurückziehen kannst du sie über Discord.')}</p>` : ''}
      </div>`;
  }
  // Verwalten und Prüfen behalten ihren Aufbau, stehen aber im Rahmen der Webseite
  const staffWrap = (html) => `<div class="site-wrap site-wrap--narrow cr-staffpage">${html}</div>`;
  function renderCareer() {
    const el = $('[data-career]');
    if (state.jobId === 'verwalten') {
      el.innerHTML = staffWrap(careerManage());
      ensureReviewData();
      return;
    }
    if (state.jobId === 'pruefen') {
      el.innerHTML = staffWrap(mayPR() && !canBackend() ? `<a class="back-link" href="#/karriere">${icon('ph-arrow-left')}${t('Karriere')}</a><div class="cbox">${backendSetupHtml()}</div>`
        : canPR() ? (state.reviewId ? reviewDetail() : reviewList())
        : `<div class="cbox"><p class="lead">${t('Bewerbungen prüfen kann das Public Relations Department und höher, wenn es mit Roblox angemeldet ist.')}</p>
          <a class="btn-line btn-line--outline" href="#/karriere">${icon('ph-arrow-left')}${t('Zurück zu den Jobs')}</a></div>`);
      ensureReviewData();
      return;
    }
    const job = D.jobs.find((x) => x.id === state.jobId);
    const app = job && state.applications[job.id];
    // „Jetzt bewerben“ nach dem Schließen: zurück zur Stelle (wer schon angefangen hat, darf weiterschreiben)
    if (job && state.jobApply && !app && !jobOpen(job) && !startedRecently(job)) state.jobApply = false;
    if (canPR() && !review.list) ensureReviewData();
    if (!job) el.innerHTML = careerList();
    else if (state.jobView === 'mine' && app) el.innerHTML = careerDone(job, app);
    else if (!state.jobApply) el.innerHTML = careerDetail(job);
    else if (app) el.innerHTML = careerDone(job, app);
    else {
      markApplyStart(job);
      el.innerHTML = careerApply(job);
    }
  }

  // Prüft die Felder eines Schritts (oder alle); liefert { feld: Meldung }
  function applyErrors(form, step = 0) {
    const job = D.jobs.find((x) => x.id === form.dataset.apply);
    const f = form.elements;
    const val = (name) => (f[name] ? String(f[name].value || '').trim() : '');
    const errors = {};
    if (!step || step === 1) {
      if (!/^[A-Za-z0-9_]{3,20}$/.test(val('roblox'))) errors.roblox = t('Bitte gib einen gültigen Roblox-Namen ein (3–20 Zeichen: Buchstaben, Zahlen, _).');
      if (!/^([a-z0-9_.]{2,32}|.{2,32}#\d{4})$/i.test(val('discord'))) errors.discord = t('Bitte gib deinen Discord-Namen ein, z. B. lokfuehrer_max.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email'))) errors.email = t('Bitte gib eine gültige E-Mail-Adresse ein, z. B. name@beispiel.de.');
      if (!form.querySelector('input[name="since"]:checked')) errors.since = t('Bitte wähle aus, seit wann du spielst.');
    }
    if (!step || step === 2) {
      if (job.areas && !form.querySelector('input[name="area"]:checked')) {
        errors.area = job.areas.some((a) => rankIdx(val('rank')) >= rankIdx(a)) ? t('Bitte wähle einen Bereich.') : t('Für den Supervisor brauchst du mindestens den Rang Qualified Driver.');
      }
      applyQuestions(job).forEach((q) => {
        const name = `q:${q.key}`;
        if (q.type === 'long' && val(name).length < q.min) errors[name] = t('Bitte schreib etwas mehr, mindestens {n} Zeichen.', { n: q.min });
        else if (q.type === 'hours' && !form.querySelector(`input[name="${name}"]:checked`)) errors[name] = t('Bitte wähle eine Antwort.');
        else if (q.type === 'days' && !form.querySelector(`input[name="${name}"]:checked`)) errors[name] = t('Bitte wähle mindestens eine Antwort.');
        else if (q.type === 'link' && val(name)) {
          try { const u = new URL(val(name)); if (!/^https?:$/.test(u.protocol)) throw new Error(); } catch (e) { errors[name] = t('Bitte gib einen gültigen Link ein (beginnt mit https://).'); }
        }
      });
    }
    if ((!step || step === 3) && !f.confirm.checked) errors.confirm = t('Bitte bestätige deine Angaben.');
    return errors;
  }
  function showFieldError(field, msg, id) {
    field.classList.add('has-error');
    field.insertAdjacentHTML('beforeend', `<span class="f__error" id="${id}">${icon('ph-info')}${esc(msg)}</span>`);
    const input = $('input, select, textarea', field);
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', id);
  }
  function clearFieldError(field) {
    field.classList.remove('has-error');
    const er = $('.f__error', field);
    if (er) er.remove();
    $$('[aria-invalid]', field).forEach((x) => { x.removeAttribute('aria-invalid'); x.removeAttribute('aria-describedby'); });
  }
  // Fehler anzeigen und zum ersten springen; true = alles in Ordnung
  function applyCheck(form, step) {
    const errors = applyErrors(form, step);
    $$('.f.has-error', form).forEach(clearFieldError);
    Object.entries(errors).forEach(([name, msg], i) => { const field = $(`[data-field="${CSS.escape(name)}"]`, form); if (field) showFieldError(field, msg, `err-${i}`); });
    const first = Object.keys(errors)[0];
    if (!first) return true;
    const field = $(`[data-field="${CSS.escape(first)}"]`, form);
    if (field) {
      field.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
      $('input:not([disabled]), select, textarea', field)?.focus({ preventScroll: true });
    }
    return false;
  }
  // Antworten lesen: [{ key, q, a }] für den Überblick und das Team
  function readAnswers(form, job) {
    const f = form.elements;
    return applyQuestions(job).map((q) => {
      const name = `q:${q.key}`;
      let a;
      if (q.type === 'hours') { const x = form.querySelector(`input[name="${name}"]:checked`); a = x ? t(HOURS[+x.value][0]) : ''; }
      else if (q.type === 'days') a = $$(`input[name="${name}"]:checked`, form).map((x) => dayShort(+x.value)).join(', ');
      else a = String(f[name].value || '').trim();
      return { key: q.key, q: q.q, a };
    });
  }
  function applyGo(form, step) {
    const job = D.jobs.find((x) => x.id === form.dataset.apply);
    form.dataset.step = step;
    $$('[data-step-box]', form).forEach((box) => { box.hidden = +box.dataset.stepBox !== step; });
    $$('[data-steps] li').forEach((li, i) => {
      li.classList.toggle('is-active', i + 1 === step);
      li.classList.toggle('is-done', i + 1 < step);
      if (i + 1 === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    $('[data-step-prev]', form).hidden = step === 1;
    $('[data-step-next]', form).hidden = step === 3;
    $('button[type="submit"]', form).hidden = step !== 3;
    if (step === 3) {
      const d = new FormData(form);
      const rows = [[t('Roblox'), d.get('roblox')], ['Discord', d.get('discord')], [t('E-Mail'), d.get('email')], [t('Rang'), d.get('rank')], [t('Du spielst seit'), t(d.get('since') || '')],
        ...(d.get('area') ? [[t('Bereich'), d.get('area')]] : [])];
      $('[data-apply-review]', form).innerHTML = `<dl class="cr-dl">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v || '–')}</dd></div>`).join('')}</dl>
        <ol class="cr-answers">${readAnswers(form, job).map((x) => `<li><b>${esc(x.q)}</b><p>${esc(x.a || '–')}</p></li>`).join('')}</ol>
        <button class="cr-back" type="button" data-step-to="2">${icon('ph-pencil-simple')}${t('Antworten bearbeiten')}</button>`;
    }
    const top = $('[data-apply-top]');
    if (top) window.scrollTo({ top: Math.max(0, top.getBoundingClientRect().top + window.scrollY - (navRoot ? navRoot.getBoundingClientRect().bottom : 0) - 24), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
  async function submitApplication(form) {
    const id = form.dataset.apply;
    for (const step of [1, 2, 3]) {
      if (!Object.keys(applyErrors(form, step)).length) continue;
      if (+form.dataset.step !== step) applyGo(form, step);
      applyCheck(form, step);
      return;
    }
    // Mit Backend: nur angemeldet (das Team sieht dann dein echtes Roblox-Konto)
    const viaBackend = apiReady() && loginReady();
    if (viaBackend && !sessionToken()) {
      toast(t('Bitte melde dich zuerst mit Roblox an.'));
      openModal('profile');
      return;
    }
    const data = new FormData(form);
    const job = D.jobs.find((x) => x.id === id);
    const area = data.get('area');
    const list = readAnswers(form, job);
    const by = (key) => (list.find((x) => x.key === key) || {}).a || '';
    const hoursPick = form.querySelector('input[name="q:hours"]:checked');
    const days = $$('input[name="q:days"]:checked', form).map((x) => dayShort(+x.value));
    const report = list.filter((x) => x.a || x.key !== 'link').map((x) => ({ q: x.q, a: x.a || '–', ok: null }));
    const app = {
      roblox: data.get('roblox').trim(), discord: data.get('discord').trim(), email: data.get('email').trim(),
      since: data.get('since'), rank: data.get('rank'), area: area || null,
      answers: Object.fromEntries(list.map((x) => [x.key, x.a])), score: 0, total: 0, count: list.length,
      experience: by('experience'), activity: hoursPick ? HOURS[+hoursPick.value][1] : 0, days, at: Date.now(),
    };
    if (viaBackend) {
      const btn = $('button[type="submit"]', form);
      const label = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = t('Wird gesendet …');
      try {
        await api('/api/applications', {
          method: 'POST',
          body: {
            job: id, jobTitle: job.title, area: app.area, discord: app.discord, email: app.email, since: app.since, rank: app.rank,
            experience: app.experience, activity: app.activity, days: app.days, score: 0, total: 0, lang, answers: report,
            count: list.length, startedAt: applyStarts()[id] || Date.now(),
          },
        }).then((own) => Object.assign(app, { id: own.id, status: own.status, mailed: own.mailed }));
        app.sent = true;
        review.at = 0;
      } catch (e) {
        btn.disabled = false;
        btn.innerHTML = label;
        toast(e.status === 429 ? t('Du hast dich gerade erst beworben. Bitte versuch es morgen noch einmal.')
          : e.status === 401 ? t('Bitte melde dich zuerst mit Roblox an.')
            : e.status === 503 ? t('Bewerbungen sind gerade nicht möglich. Bitte versuch es später noch einmal.')
              : t('Die Bewerbung konnte nicht gesendet werden. Bitte versuch es noch einmal.'));
        return;
      }
    }
    state.applications[id] = app;
    store.set('tsg-applications', state.applications);
    toast(t('Bewerbung gesendet'));
    renderCareer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Eigene Statistik aus dem Spiel (backend/game.js → pstats). Was noch nicht passiert ist, steht auf 0.
  const mine = { data: null, at: 0, busy: false };
  async function loadMyStats(force = false) {
    if (!apiReady() || !sessionToken() || mine.busy || (!force && Date.now() - mine.at < 60000)) return;
    mine.busy = true;
    try { mine.data = await api('/api/me/stats'); } catch (e) { /* bleibt bei 0 */ }
    mine.busy = false;
    mine.at = Date.now();
    if (modalView && modalView.name === 'stats') refreshModal();
  }
  // Bestandene Trainings = Ränge mit Training bis zum eigenen Rang
  const trainingsPassed = () => RANKS.slice(0, rankIdx(state.rank) + 1).filter((r) => typeOf(r.name)).length;
  function myStats() {
    loadMyStats();
    const s = { minutes: 0, trips: 0, km: 0, punctual: 0, routes: {}, vehicles: {}, days: {}, first: null, last: null, ...(mine.data || {}) };
    const now = berlinNow();
    const monday = now.day - ((dateOf(now.day).getUTCDay() + 6) % 7);
    const week = Array.from({ length: 7 }, (_, i) => {
      const day = monday + i;
      return { label: wdShort(day), today: day === now.day, min: s.days[dateOf(day).toISOString().slice(0, 10)] || 0 };
    });
    const groups = [
      { key: 'fern', title: t('Fernverkehr'), cat: 'ice', cats: ['ice', 'ec', 'ic'] },
      { key: 'regio', title: t('Regio'), cat: 're', cats: ['ire', 're', 'rb'] },
      { key: 'sbahn', title: t('S-Bahn'), cat: 's', cats: ['s'] },
    ].map((g) => {
      const rows = D.trains.filter((x) => g.cats.includes(x.cat)).map((x) => ({ label: x.name, value: s.vehicles[x.id] || 0 })).sort((a, b) => b.value - a.value);
      return { ...g, rows, total: rows.reduce((n, r) => n + r.value, 0) };
    });
    const routes = D.routes.map((r) => ({ route: r, value: s.routes[r.no] || 0 })).sort((a, b) => b.value - a.value);
    const fav = routes[0] && routes[0].value ? routes[0].route : null;
    return {
      week, groups, routes, trips: s.trips,
      tiles: [
        { ic: 'ph-train', label: t('Kilometer'), value: countHtml(s.km, 'km', 'my-km') },
        { ic: 'ph-path', label: t('Fahrten'), value: countHtml(s.trips, 'fmt', 'my-trips') },
        { ic: 'ph-clock', label: t('Pünktlichkeit'), value: countHtml(s.trips ? (s.punctual / s.trips) * 100 : 0, 'pct', 'my-punct') },
        { ic: 'ph-timer', label: t('Spielzeit'), value: t('{n} Std.', { n: nf1.format(Math.round(s.minutes / 6) / 10) }) },
        { ic: 'ph-calendar-blank', label: t('Trainings'), value: t('{n} bestanden', { n: fmt(trainingsPassed()) }) },
        { ic: 'ph-user-plus', label: t('Dabei seit'), value: s.first ? dtf({ month: 'short', year: 'numeric' }).format(new Date(s.first)) : '–' },
        { ic: 'ph-game-controller', label: t('Zuletzt gespielt'), value: s.last ? agoText(s.last) : '–' },
        { ic: 'ph-heart', label: t('Lieblingsstrecke'), value: fav ? `${routeNo(fav)}${esc(t(fav.title))}` : '–', wide: true },
      ],
    };
  }

  // ---------- Einstellungen ----------
  const themeMode = () => document.documentElement.getAttribute('data-theme') || 'system';
  function setTheme(mode, { quiet = false } = {}) {
    try {
      if (mode === 'system') localStorage.removeItem('tsg-theme'); else localStorage.setItem('tsg-theme', mode);
    } catch (e) { /* Speicher nicht verfügbar */ }
    if (mode === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);
    if (state.page === 'einstellungen') renderSettings();
    if (quiet) return;
    settingsChanged();
    toast(mode === 'system' ? t('Darstellung folgt jetzt deinem Gerät') : t('Darstellung: {mode}', { mode: mode === 'dark' ? t('Dunkel') : t('Hell') }));
  }
  // Sprache wählen: 'auto' (Gerätesprache) oder ein Sprachcode
  async function setLanguage(setting, { start = false } = {}) {
    const code = setting === 'auto' ? deviceLang() : setting;
    if (code !== 'de' && !(window.TSG_I18N && window.TSG_I18N[code])) {
      try { await loadScript(`assets/js/i18n/${code}.js`); } catch (e) { /* offline: Sprache bleibt */ }
    }
    const ok = code === 'de' || (window.TSG_I18N && window.TSG_I18N[code]);
    if (!ok && !start) { toast(t('Diese Sprache ist gerade nicht erreichbar.')); return; }
    if (!start) { store.set('tsg-lang', setting); settingsChanged(); }
    lang = ok ? code : 'de';
    dict = lang === 'de' ? {} : window.TSG_I18N[lang];
    setLocale();
    document.documentElement.lang = lang;
    translateStatic();
    const tz = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', timeZoneName: 'short' }).formatToParts(new Date()).find((x) => x.type === 'timeZoneName');
    $$('[data-tz]').forEach((el) => { el.textContent = t(tz ? tz.value : 'MEZ'); });
    if (start) return;
    renderMe();
    RENDER[state.page]();
    bind();
    document.title = TITLES[state.page] || 'Train Sim Germany';
    refreshModal();
  }
  // Fester Text aus index.html: beim ersten Aufruf merken, danach immer vom deutschen Original übersetzen
  let staticText = null;
  const STATIC_ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  function translateStatic() {
    if (!staticText) {
      staticText = { nodes: [], attrs: [] };
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (/[A-Za-zÄÖÜäöüß]/.test(n.nodeValue) && !n.parentElement.closest('script, style, [data-bind], [data-clock], [data-clock-full], [data-tz], [data-no-t]')
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
      });
      while (walker.nextNode()) staticText.nodes.push({ node: walker.currentNode, text: walker.currentNode.nodeValue });
      STATIC_ATTRS.forEach((a) => $$(`[${a}]`).forEach((el) => { if (!el.closest('[data-no-t]')) staticText.attrs.push({ el, a, text: el.getAttribute(a) }); }));
    }
    staticText.nodes.forEach(({ node, text }) => {
      const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
      node.nodeValue = m[1] + t(m[2]) + m[3];
    });
    staticText.attrs.forEach(({ el, a, text }) => el.setAttribute(a, t(text)));
  }
  const langName = (code) => { try { return new Intl.DisplayNames([locale], { type: 'language' }).of(code); } catch (e) { return ''; } };
  // Sprache als Dropdown: Knopf mit Flagge, darunter die Liste (Pfeiltasten, Esc, Klick daneben schließt)
  const langFlag = (code) => (code === 'auto'
    ? `<span class="flag flag--auto">${icon('ph-device-mobile')}</span>`
    : `<img class="flag" src="assets/img/flags/${langOf(code).flag}.svg" alt="" width="32" height="24">`);
  function renderLangPicker() {
    const box = $('[data-lang-picker]');
    if (!box) return;
    const setting = langSetting();
    const name = (code) => (code === 'auto' ? t('Automatisch') : langOf(code).name);
    const sub = (code) => (code === 'auto' ? t('Wie dein Gerät – gerade: {name}', { name: langOf(deviceLang()).name }) : code === lang ? '' : langName(code));
    const text = (code) => `<span class="dropdown__text"><b>${esc(name(code))}</b>${sub(code) ? `<small>${esc(sub(code))}</small>` : ''}</span>`;
    box.innerHTML = `<button class="dropdown__btn" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="lang-list" aria-label="${esc(t('Sprache'))}: ${esc(name(setting))}" data-lang-toggle>
        ${langFlag(setting)}${text(setting)}${icon('ph-caret-down', 'dropdown__chev')}
      </button>
      <div class="dropdown__list" id="lang-list" role="listbox" aria-label="${esc(t('Sprache'))}" hidden>
        ${['auto', ...LANGS.map((l) => l.code)].map((code) => `<button type="button" role="option" tabindex="-1" aria-selected="${setting === code}" data-lang-set="${code}">
          ${langFlag(code)}${text(code)}${setting === code ? icon('ph-check', 'dropdown__check') : ''}</button>`).join('')}
      </div>`;
  }
  function langMenu(open, { focus = true } = {}) {
    const box = $('[data-lang-picker]');
    if (!box) return;
    const btn = $('[data-lang-toggle]', box);
    const list = $('.dropdown__list', box);
    if (!btn || !list) return;
    if (open === list.hidden) {
      list.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      box.classList.toggle('is-open', open);
    }
    // Liste ganz sichtbar machen (nicht unter der Leiste unten)
    if (open) list.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (!focus) return;
    if (open) ($('[aria-selected="true"]', list) || $('[role="option"]', list)).focus({ preventScroll: true });
    else btn.focus();
  }

  // ---------- Privatsphäre ----------
  // Beides ist standardmäßig aus. Später werden die Werte mit dem Roblox-Konto auf dem Server gespeichert.
  const privacy = () => ({ profile: false, stats: false, ...store.get('tsg-privacy', {}) });
  const statsPublic = () => { const pv = privacy(); return pv.profile && pv.stats; };
  function renderPrivacy() {
    const box = $('[data-privacy]');
    if (!box) return;
    const pv = privacy();
    const row = (key, title, text, on, off, note) => `<label class="toggle${off ? ' is-disabled' : ''}">
        <span class="toggle__text"><b>${title}</b><small>${text}</small>${note ? `<small class="toggle__note">${icon('ph-info')}${note}</small>` : ''}</span>
        <input type="checkbox" role="switch" data-privacy-set="${key}"${on ? ' checked' : ''}${off ? ' disabled' : ''}>
        <span class="toggle__ui" aria-hidden="true"></span>
      </label>`;
    box.innerHTML = row('profile', t('Profil öffentlich'), t('Andere Spieler sehen deinen Roblox-Namen, dein Profilbild und deinen Rang.'), pv.profile)
      + row('stats', t('Zeige meine Statistik öffentlich an'), t('Andere sehen deine Fahrten, Kilometer, Pünktlichkeit und Spielzeit.'), pv.profile && pv.stats, !pv.profile,
        pv.profile ? '' : t('Geht nur, wenn dein Profil öffentlich ist.'));
  }
  async function setPrivacy(key, on) {
    const before = privacy();
    const pv = { ...before, [key]: on };
    store.set('tsg-privacy', pv);
    renderPrivacy();
    // Angemeldet: im Backend speichern, damit andere es sehen bzw. nicht mehr sehen
    if (sessionToken()) {
      try {
        store.set('tsg-privacy', (await api('/api/me/privacy', { method: 'PUT', body: pv })).privacy);
      } catch (e) {
        store.set('tsg-privacy', before);
        renderPrivacy();
        toast(t('Das hat nicht geklappt. Bitte versuch es noch einmal.'));
        return;
      }
    }
    refreshModal();
    if (key === 'profile') toast(on ? t('Dein Profil ist jetzt öffentlich') : t('Dein Profil ist jetzt privat'));
    else toast(on ? t('Deine Statistik ist jetzt öffentlich') : t('Deine Statistik sieht jetzt nur du'));
  }
  // Hinweis im Profil- und Statistik-Dialog
  const visibilityNote = (on, onText, offText) => `<p class="vis-note">${icon(on ? 'ph-eye' : 'ph-lock')}<span>${on ? onText : offText}</span><a href="#/einstellungen">${t('Ändern')}</a></p>`;
  function renderSettings() {
    // Eine Seite: Themes (Hell, Dunkel, Automatisch) und Präferenzen (was öffentlich ist)
    renderPrivacy();
    $$('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === themeMode())));
    if (!$('[data-settings-account]')) return;
    const p = state.profile;
    const r = rankOf(state.rank);
    $('[data-settings-account]').innerHTML = `${ringHTML(p, r, 'avatar-ring--lg')}
      <div class="set-account__who"><b>${p ? esc(p.displayName || p.username) : t('Nicht verbunden')}</b><small>${p ? `@${esc(p.username)}` : t('Verbinde dein Roblox-Konto für Name und Profilbild.')}</small></div>
      <button class="btn ${p ? 'btn--soft' : 'btn--primary'}" type="button" data-open="profile">${p ? t('Profil') : loginReady() ? t('Anmelden') : t('Verbinden')}</button>`;
  }

  // ---------- Profil (Kopfzeile, Tab-Leiste, Menü) ----------
  function avatarInner(p) {
    if (p && p.avatar) return `<img src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer">`;
    if (p) return `<b>${esc(initials(p.username))}</b>`;
    return icon('phf-user');
  }
  const ringHTML = (p, rank, cls) => `<span class="avatar-ring ${cls}" style="--rc:${rank.color}"><span class="avatar-img">${avatarInner(p)}</span></span>`;
  const rankPill = (rank, extra = '') => `<span class="rank-pill" style="--rc:${rank.color}">[${esc(rank.prefix)}]${extra}</span>`;
  function renderMe() {
    const r = rankOf(state.rank);
    const p = state.profile;
    $$('[data-me-rank]').forEach((el) => {
      el.textContent = `[${r.prefix}]`;
      el.style.setProperty('--rc', r.color);
      el.title = r.name;
    });
    $$('[data-me-ring]').forEach((el) => el.style.setProperty('--rc', r.color));
    $$('[data-me-avatar]').forEach((el) => { el.innerHTML = avatarInner(p); });
    $$('.me').forEach((b) => b.setAttribute('aria-label', p ? t('Profil von {name}', { name: p.displayName || p.username }) : t('Profil öffnen und mit Roblox verbinden')));
    renderNavAccount();
  }
  // Öffentliches Roblox-Profil laden (Name, Anzeigename, Profilbild)
  async function fetchRoblox(name) {
    const api = D.roblox;
    const res = await fetch(`${api.usersApi}/v1/usernames/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [name], excludeBannedUsers: true }),
    });
    if (!res.ok) throw new Error('Roblox nicht erreichbar');
    const user = ((await res.json()).data || [])[0];
    if (!user) return null;
    let avatarUrl = null;
    try {
      const thumb = await fetch(`${api.thumbnailsApi}/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`);
      const img = ((await thumb.json()).data || [])[0];
      if (img && img.state === 'Completed') avatarUrl = img.imageUrl;
    } catch (e) { /* ohne Profilbild weiter */ }
    return { userId: user.id, username: user.name, displayName: user.displayName, avatar: avatarUrl };
  }
  async function connectRoblox(form) {
    const input = form.elements.username;
    const field = input.closest('.f');
    const btn = $('button[type="submit"]', form);
    const name = input.value.trim();
    clearFieldError(field);
    if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) {
      showFieldError(field, t('Bitte gib einen gültigen Roblox-Namen ein (3–20 Zeichen: Buchstaben, Zahlen, _).'), 'err-rbx');
      input.focus();
      return;
    }
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = t('Wird verbunden …');
    let profile = null;
    let offline = false;
    try { profile = await fetchRoblox(name); } catch (e) { offline = true; }
    if (!offline && !profile) {
      btn.disabled = false;
      btn.innerHTML = label;
      showFieldError(field, t('Diesen Roblox-Namen gibt es nicht.'), 'err-rbx');
      input.focus();
      return;
    }
    state.profile = profile || { userId: null, username: name, displayName: name, avatar: null };
    store.set('tsg-profile', state.profile);
    renderMe();
    closeModal();
    toast(offline ? t('Verbunden als {name} – Profilbild gerade nicht erreichbar', { name }) : t('Verbunden als {name}', { name: state.profile.displayName }));
  }

  // ---------- Roblox-Login (OAuth 2.0 mit PKCE) ----------
  // Einrichtung: nur die Client-ID in assets/js/config.js eintragen. Die Anmeldung läuft direkt mit Roblox
  // (PKCE, kein Client-Secret nötig). Ohne Client-ID bleibt die Demo mit dem Roblox-Namen.
  // Der Rang kommt aus der Rolle in der Roblox-Gruppe; wer nicht in der Gruppe ist, ist [G] Guest.
  const CFG = window.TSG_CONFIG || {};
  const RBX = CFG.roblox || {};
  const OAUTH = 'https://apis.roblox.com/oauth';
  const clientId = () => String(RBX.clientId || '').trim();
  const loginReady = () => !!clientId();
  // Ohne Angabe: Adresse der Seite ohne index.html, z. B. https://name.github.io/Train-Sim-Germany/
  const redirectUri = () => RBX.redirectUri || location.origin + location.pathname.replace(/index\.html$/, '');
  const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
  const randomKey = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
  async function robloxLogin() {
    if (!window.crypto || !crypto.subtle) { toast(t('Die Anmeldung geht nur über eine sichere Verbindung (https).')); return; }
    const verifier = randomKey(48);
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const login = { verifier, state: randomKey(), nonce: randomKey(), back: location.hash || '#/' };
    try { sessionStorage.setItem('tsg-oauth', JSON.stringify(login)); } catch (e) { toast(t('Anmeldung fehlgeschlagen. Bitte versuch es noch einmal.')); return; }
    const q = new URLSearchParams({
      client_id: clientId(), redirect_uri: redirectUri(), scope: 'openid profile',
      response_type: 'code', state: login.state, nonce: login.nonce, code_challenge: challenge, code_challenge_method: 'S256',
    });
    location.assign(`${OAUTH}/v1/authorize?${q}`);
  }
  async function headshot(userId) {
    try {
      const res = await fetch(`${D.roblox.thumbnailsApi}/v1/users/avatar-headshot?userIds=${encodeURIComponent(userId)}&size=150x150&format=Png&isCircular=false`);
      const img = ((await res.json()).data || [])[0];
      return img && img.state === 'Completed' ? img.imageUrl : null;
    } catch (e) { return null; }
  }
  // Rückkehr von Roblox (?code=…&state=…): liefert den Hinweis für den Toast oder null
  async function oauthCallback() {
    const q = new URLSearchParams(location.search);
    if (!q.has('code') && !q.has('error')) return null;
    let login = null;
    try { login = JSON.parse(sessionStorage.getItem('tsg-oauth')); sessionStorage.removeItem('tsg-oauth'); } catch (e) { /* kein Speicher */ }
    // Code und state aus der Adresse entfernen, zurück zur Seite vor der Anmeldung
    history.replaceState(null, '', location.pathname + ((login && login.back) || '#/'));
    const failed = t('Anmeldung fehlgeschlagen. Bitte versuch es noch einmal.');
    if (q.has('error')) return q.get('error') === 'access_denied' ? t('Anmeldung abgebrochen') : failed;
    if (!login || q.get('state') !== login.state || !loginReady()) return failed;
    try {
      const form = (data) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data) });
      const res = await fetch(`${OAUTH}/v1/token`, form({ grant_type: 'authorization_code', code: q.get('code'), code_verifier: login.verifier, client_id: clientId() }));
      if (!res.ok) throw new Error('token');
      const tok = await res.json();
      const claims = tok.id_token ? JSON.parse(new TextDecoder().decode(fromB64url(tok.id_token.split('.')[1]))) : {};
      if (claims.nonce && claims.nonce !== login.nonce) throw new Error('nonce');
      const me = await fetch(`${OAUTH}/v1/userinfo`, { headers: { Authorization: `Bearer ${tok.access_token}` } });
      if (!me.ok) throw new Error('userinfo');
      const info = await me.json();
      if (!info.sub) throw new Error('profile');
      // Den Refresh-Token braucht die App nicht: gleich wieder ungültig machen
      if (tok.refresh_token) fetch(`${OAUTH}/v1/token/revoke`, form({ token: tok.refresh_token, client_id: clientId() })).catch(() => {});
      state.profile = {
        userId: String(info.sub), username: info.preferred_username || info.name, displayName: info.nickname || info.name || info.preferred_username,
        avatar: info.picture || (await headshot(info.sub)), oauth: true,
      };
      store.set('tsg-profile', state.profile);
      await syncGroupRank({ force: true });
      // Mit Backend: dort anmelden (für Bewerbungen, Privatsphäre und Push-Benachrichtigungen)
      if (apiReady() && tok.id_token) {
        try {
          const r = await api('/auth/session', { method: 'POST', body: { id_token: tok.id_token } });
          store.set('tsg-session', r.session);
          applyMe(r);
        } catch (e) { /* Backend nicht erreichbar: Login gilt trotzdem in der App */ }
      }
      return 'ok';
    } catch (e) {
      return failed;
    }
  }

  // ---------- Rang aus der Roblox-Gruppe ----------
  // Rolle → Rang über das Kürzel („[QD] Qualified Driver“, „[J-SV] Junior Supervisor“) oder den Namen.
  // Nicht in der Gruppe = Guest [G]. Unbekannte Rolle in der Gruppe = Learning Driver.
  function rankFromRole(role) {
    // Testkonten (Bots, z. B. „[AT] Alpha Test Accounts“) zählen nicht als Rang
    if (!role || /alpha\s*test|^\s*\[\s*at\s*\]/i.test(String(role.name || ''))) return 'Guest';
    const name = String(role.name || '').toLowerCase();
    const prefix = ((name.match(/^\s*\[\s*([^\]]+?)\s*\]/) || name.match(/^\s*([a-z-]{1,5})\s*[|:]/) || [])[1] || '').replace(/\s+/g, '');
    const byPrefix = prefix && RANKS.find((r) => r.prefix.toLowerCase() === prefix);
    const byName = RANKS.slice().sort((x, y) => y.name.length - x.name.length).find((r) => name.includes(r.name.toLowerCase()));
    return (byPrefix || byName || rankOf('Learning Driver')).name;
  }
  // Rolle öffentlich bei Roblox abfragen (über den Proxy aus data.js, Roblox selbst erlaubt das nicht aus dem Browser)
  async function syncGroupRank({ force = false } = {}) {
    const p = state.profile;
    if (!p || !p.oauth || !RBX.groupId) return;
    // Angemeldet mit Backend: der Rang kommt vom Backend (/api/me). Der Proxy ist dafür zu unzuverlässig –
    // eine leere oder gedrosselte Antwort darf niemanden zum Gast machen.
    if (apiReady() && sessionToken()) { await loadMe(); return; }
    const last = store.get('tsg-group', null);
    if (!force && last && last.userId === p.userId && Date.now() - last.at < 10 * 60000) return;
    try {
      const res = await fetch(`${D.roblox.groupsApi}/v2/users/${encodeURIComponent(p.userId)}/groups/roles`);
      if (!res.ok) throw new Error('groups');
      const json = await res.json();
      if (!json || !Array.isArray(json.data)) throw new Error('groups'); // keine echte Antwort: alten Rang behalten
      const hit = json.data.find((x) => String(x.group && x.group.id) === String(RBX.groupId));
      const role = hit ? { name: hit.role.name, rank: hit.role.rank } : null;
      store.set('tsg-group', { userId: p.userId, role, rank: rankFromRole(role), at: Date.now() });
      applyGroupRank();
    } catch (e) { /* offline: der letzte Rang bleibt */ }
  }
  function applyGroupRank() {
    const g = store.get('tsg-group', null);
    const p = state.profile;
    state.rankFromGroup = !!(g && p && p.oauth && g.userId === p.userId && rankIdx(g.rank) >= 0);
    state.groupRole = state.rankFromGroup ? g.role : null;
    if (state.rankFromGroup && state.rank !== g.rank) {
      state.rank = g.rank;
      store.set('tsg-rank', g.rank);
      state.trainingDay = null;
    }
  }

  // ---------- Backend (optional): Bewerbungen, Privatsphäre, Push-Benachrichtigungen ----------
  // Die App kennt nur die Adresse (config.js → api). Ohne Backend läuft alles auf dem Gerät.
  const API = String(CFG.api || '').trim().replace(/\/+$/, '');
  const apiReady = () => !!API;
  const sessionToken = () => store.get('tsg-session', null);
  async function api(path, { method = 'GET', body, raw, type } = {}) {
    const headers = {};
    const token = sessionToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (raw) headers['Content-Type'] = type;
    const res = await fetch(API + path, { method, headers, body: raw || (body === undefined ? undefined : JSON.stringify(body)) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) {
      // Sitzung ungültig: nicht still weitermachen, sondern einmal deutlich sagen, was zu tun ist
      store.set('tsg-session', null);
      if (!api.hinweis) { api.hinweis = true; toast(t('Deine Anmeldung ist abgelaufen. Bitte melde dich neu mit Roblox an.')); }
    }
    if (!res.ok) throw Object.assign(new Error(data.error || 'api'), { status: res.status });
    return data;
  }
  async function loadMe() {
    if (!apiReady() || !sessionToken()) return;
    try {
      applyMe(await api('/api/me'));
      safeRender();
      // Benachrichtigungen an, aber dieses Gerät noch nicht mit dem Konto verbunden (z. B. nach dem Login)
      const ns = notifyState();
      if (ns.on && state.profile && ns.linked !== state.profile.userId) linkPush();
    } catch (e) { /* offline */ }
  }
  function applyMe(me) {
    if (me.privacy) store.set('tsg-privacy', me.privacy);
    // Rang aus der Gruppe, vom Backend geprüft
    if (me.rank && state.profile && state.profile.oauth) {
      store.set('tsg-group', { userId: state.profile.userId, role: me.groupRole || null, rank: me.rank, at: Date.now() });
      applyGroupRank();
    }
    // Eigene Bewerbungen (auch von anderen Geräten)
    (me.applications || []).forEach((a) => {
      const old = state.applications[a.job];
      if (!old || old.at <= a.at) state.applications[a.job] = { ...(old || {}), ...a, sent: true };
    });
    store.set('tsg-applications', state.applications);
    // Einstellungen: neuerer Stand gewinnt
    if (me.settings && (me.settings.updatedAt || 0) > settingsAt()) applySettings(me.settings);
    else if (!me.settings || settingsAt() > (me.settings.updatedAt || 0)) pushSettings();
  }
  function signedOut(msg) {
    store.set('tsg-session', null);
    store.set('tsg-group', null);
    if (state.profile && state.profile.oauth) { state.profile = null; store.set('tsg-profile', null); }
    state.rankFromGroup = false;
    state.groupRole = null;
    renderMe();
    RENDER[state.page]();
    refreshModal();
    if (msg) toast(msg);
  }

  // Neu zeichnen, ohne offene Formulare (Bewerbung, Training, Neuigkeit) zu stören
  function safeRender() {
    renderMe();
    if (!(state.page === 'karriere' && state.jobApply)) RENDER[state.page]();
    if (modalView && !['training-new', 'news-new', 'news-edit'].includes(modalView.name)) refreshModal();
    bind();
  }
  const errorText = (e) => (e.status === 403 ? t('Dafür fehlt dir der Rang.')
    : e.status === 401 ? t('Bitte melde dich erneut mit Roblox an.')
      : e.status === 413 ? t('Die Datei ist zu groß.')
        : e.status === 409 ? t('Diese Stelle ist inzwischen geschlossen.')
          : t('Das hat nicht geklappt. Bitte versuch es noch einmal.'));

  // ---------- Rechte (aus der Rolle in der Roblox-Gruppe, das Backend prüft sie noch einmal) ----------
  const isMine = (id) => !!(state.profile && state.profile.oauth && String(state.profile.userId) === String(id));
  const canBackend = () => apiReady() && !!sessionToken() && state.rankFromGroup;
  const canTrain = () => canBackend() && rankIdx(state.rank) >= rankIdx('Supervisor');
  const canPR = () => canBackend() && rankIdx(state.rank) >= rankIdx('Public Relations Department');
  // Mit Roblox angemeldet, aber das Backend kennt die Sitzung nicht mehr (abgelaufen oder auf einem anderen Gerät abgemeldet)
  const needsReLogin = () => apiReady() && !!(state.profile && state.profile.oauth) && !sessionToken();
  // Darf es laut Rang? Dann sind die Knöpfe sichtbar – auch wenn das Backend noch fehlt (dann kommt die Anleitung)
  // oder die Sitzung weg ist (dann kommt „Bitte neu anmelden“ mit Anmelde-Knopf statt gar nichts).
  const isTeam = (min) => (state.rankFromGroup || needsReLogin()) && rankIdx(state.rank) >= rankIdx(min);
  const mayTrain = () => isTeam('Supervisor');
  const mayPR = () => isTeam('Public Relations Department');
  const BACKEND_GUIDE = 'https://github.com/Loris6/Train-Sim-Germany/blob/main/backend/README.md';
  function backendSetupHtml() {
    const r = rankOf(state.rank);
    const reLogin = apiReady() && !sessionToken();
    return `<div class="setup">
      <span class="setup__ic">${icon('ph-hard-drives')}</span>
      <h3>${reLogin ? t('Bitte neu anmelden') : t('Der App-Server fehlt noch')}</h3>
      <p>${reLogin ? t('Deine Anmeldung beim Server ist abgelaufen. Melde dich einmal neu mit Roblox an, dann kannst du wieder Trainings und Neuigkeiten erstellen.')
        : t('Als {rank} darfst du das. Damit Trainings, Neuigkeiten, Bewerbungen und der Chat bei allen ankommen, braucht die App ihren Server (Backend). Er ist noch nicht verbunden.', { rank: `<b>[${esc(r.prefix)}] ${esc(r.name)}</b>` })}</p>
      ${reLogin ? `<button class="btn btn--primary btn--lg btn--block" type="button" data-roblox-login>${icon('ph-sign-in')}${t('Mit Roblox anmelden')}</button>` : `<ol class="setup__steps">
        <li>${t('Bei Cloudflare ein kostenloses Konto anlegen und einen API-Token erstellen.')}</li>
        <li>${t('Auf GitHub unter Settings → Secrets die Werte CLOUDFLARE_API_TOKEN und CLOUDFLARE_ACCOUNT_ID eintragen.')}</li>
        <li>${t('Unter Actions „Backend veröffentlichen“ starten – die Adresse wird automatisch eingetragen.')}</li>
      </ol>
      <a class="btn btn--primary btn--lg btn--block" href="${BACKEND_GUIDE}" target="_blank" rel="noopener">${icon('ph-arrow-square-out')}${t('Anleitung öffnen')}</a>`}
    </div>`;
  }

  // ---------- Inhalte aus dem Backend: Trainings, Neuigkeiten, Stellen ----------
  const remote = { trainings: null, news: null, jobs: {} };
  if (apiReady()) {
    const c = store.get('tsg-content', null);
    if (c) Object.assign(remote, { trainings: c.trainings || [], news: c.news || [], jobs: c.jobs || {} });
  }
  async function loadContent({ render = true } = {}) {
    if (!apiReady()) return;
    try {
      const c = await api('/api/content');
      Object.assign(remote, { trainings: c.trainings || [], news: c.news || [], jobs: c.jobs || {} });
      store.set('tsg-content', c);
      if (render) safeRender();
    } catch (e) { /* offline: letzter Stand bleibt */ }
  }

  // Beim Öffnen einer Seite frische Inhalte holen (höchstens alle 20 Sekunden), ohne offene Formulare zu stören
  let freshAt = 0;
  function refreshOnEnter(page) {
    if (!apiReady() || Date.now() - freshAt < 20000) return;
    freshAt = Date.now();
    Promise.all([loadContent({ render: false }), page === 'karriere' ? loadMe() : null]).then(() => {
      if (state.page !== page || !modal.hidden || (page === 'karriere' && state.jobApply)) return;
      RENDER[page]();
    });
  }

  // ---------- Trainings anbieten (ab Supervisor) ----------
  const TRAINING_TYPES = D.trainingTypes.map((x) => x.name);
  function trainingForm() {
    if (mayTrain() && !canBackend()) return backendSetupHtml();
    if (!canTrain()) return `<p class="muted">${t('Trainings anbieten können Supervisor und höher, wenn sie mit Roblox angemeldet sind.')}</p>`;
    const today = dateOf(berlinNow().day).toISOString().slice(0, 10);
    return `<form class="cform" data-training-new novalidate>
      <fieldset class="f"><legend class="f__label">${t('Für welche Rolle? (genau eine)')}</legend>
        <div class="role-pick">${TRAINING_TYPES.map((r, i) => `<label class="role-pick__opt" style="--rc:${rankOf(r).color}">
          <input type="radio" name="type" value="${esc(r)}"${i ? '' : ' checked'}><span><i></i>[${esc(rankOf(r).prefix)}] ${esc(r)}</span></label>`).join('')}</div>
      </fieldset>
      <div class="f"><label class="f__label" for="tn-title">${t('Titel')}</label><input id="tn-title" name="title" maxlength="80" placeholder="${esc(t('z. B. Stellwerk Magdeburg Hbf'))}"></div>
      <div class="cform__row">
        <div class="f"><label class="f__label" for="tn-date">${t('Datum')}</label><input id="tn-date" name="date" type="date" min="${today}" value="${today}"></div>
        <div class="f"><label class="f__label" for="tn-time">${t('Uhrzeit (deutsche Zeit)')}</label><input id="tn-time" name="time" type="time" value="18:00"></div>
      </div>
      <div class="cform__row">
        <div class="f"><label class="f__label" for="tn-dur">${t('Dauer')}</label><div class="select"><select id="tn-dur" name="dur">${[30, 45, 60, 90, 120].map((m) => `<option value="${m}"${m === 60 ? ' selected' : ''}>${t('{m} Min.', { m })}</option>`).join('')}</select>${icon('ph-caret-down')}</div></div>
        <div class="f"><label class="f__label" for="tn-slots">${t('Plätze')}</label><input id="tn-slots" name="slots" type="number" inputmode="numeric" min="1" max="50" value="12"></div>
      </div>
      <div class="f"><label class="f__label" for="tn-server">${t('Server')}</label><div class="select"><select id="tn-server" name="server">${D.servers.map((x) => `<option${x.type === 'training' ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select>${icon('ph-caret-down')}</div></div>
      <div class="f"><label class="f__label" for="tn-helpers">${t('Supervisors (optional)')}</label><input id="tn-helpers" name="helpers" maxlength="140" autocomplete="off" spellcheck="false" placeholder="${esc(t('Roblox-Namen, mit Komma getrennt'))}"></div>
      <div class="f"><label class="f__label" for="tn-text">${t('Beschreibung (optional)')}</label><textarea id="tn-text" name="text" maxlength="500" rows="3" placeholder="${esc(t('Was lernen die Teilnehmer?'))}"></textarea></div>
      <button class="btn btn--primary btn--lg btn--block" type="submit">${icon('ph-plus')}${t('Training anbieten')}</button>
      <p class="sheet-note">${t('Löschen kannst du nur deine eigenen Trainings.')}</p>
    </form>`;
  }
  async function submitTraining(form) {
    const f = new FormData(form);
    if (!f.get('date') || !f.get('time')) { toast(t('Bitte Datum und Uhrzeit angeben.')); return; }
    const start = berlinToEpoch(f.get('date'), f.get('time'));
    if (start < Date.now()) { toast(t('Der Termin liegt in der Vergangenheit.')); return; }
    const btn = $('button[type="submit"]', form);
    btn.disabled = true;
    try {
      await api('/api/trainings', { method: 'POST', body: {
        type: f.get('type'), title: f.get('title').trim(), start, dur: +f.get('dur'), slots: +f.get('slots'), server: f.get('server'), text: f.get('text').trim(),
        helpers: String(f.get('helpers') || '').split(/[\s,;]+/).map((x) => x.replace(/^@/, '')).filter(Boolean),
      } });
      closeModal();
      toast(t('Training angeboten'));
      await loadContent();
    } catch (e) {
      btn.disabled = false;
      toast(errorText(e));
    }
  }
  async function deleteTraining(id) {
    if (!window.confirm(t('Dieses Training wirklich löschen?'))) return;
    try {
      await api(`/api/trainings/${encodeURIComponent(id)}`, { method: 'DELETE' });
      closeModal();
      toast(t('Training gelöscht'));
      await loadContent();
    } catch (e) { toast(errorText(e)); }
  }

  // ---------- Neuigkeiten erstellen (ab Public Relations Department) ----------
  const NEWS_BUTTONS = {
    discord: { name: 'Discord', icon: 'si-discord', label: 'Auf Discord diskutieren', url: () => D.links.discord },
    youtube: { name: 'YouTube', icon: 'si-youtube', label: 'Auf YouTube ansehen', url: () => '' },
    roblox: { name: 'Roblox', icon: 'phf-play', label: 'Jetzt spielen', url: () => D.links.play },
    link: { name: 'Weiterleitung (Link)', icon: 'ph-arrow-square-out', label: 'Mehr erfahren', url: () => '' },
  };
  const newsBtnRow = (b = null) => `<div class="nbtn-row" data-nbtn>
      <div class="select"><select name="btype" aria-label="${esc(t('Art des Buttons'))}">${Object.entries(NEWS_BUTTONS).map(([k, x]) => `<option value="${k}"${b && b.type === k ? ' selected' : ''}>${esc(t(x.name))}</option>`).join('')}</select>${icon('ph-caret-down')}</div>
      <input name="blabel" maxlength="40" placeholder="${esc(t('Text, z. B. {label}', { label: t(NEWS_BUTTONS.discord.label) }))}" value="${esc(b ? b.label : t(NEWS_BUTTONS.discord.label))}">
      <input name="burl" type="url" inputmode="url" placeholder="https://…" value="${esc(b ? b.url : D.links.discord)}">
      <button class="round-btn" type="button" data-nbtn-del aria-label="${esc(t('Button entfernen'))}">${icon('ph-x')}</button>
    </div>`;
  // n = vorhandene Neuigkeit zum Bearbeiten (sonst neu)
  function newsForm(n = null) {
    if (mayPR() && !canBackend()) return backendSetupHtml();
    if (!canPR()) return `<p class="muted">${t('Neuigkeiten schreiben kann das Public Relations Department und höher, wenn es mit Roblox angemeldet ist.')}</p>`;
    const m = (n && n.media) || {};
    const kind = m.type || '';
    const cat = n ? newsCat(n.cat)[0] : 'update';
    return `<form class="cform" data-news-new${n ? ` data-news-id="${esc(n.id)}"` : ''} novalidate>
      <div class="f"><label class="f__label" for="nw-title">${t('Titel')}</label><input id="nw-title" name="title" maxlength="120" value="${esc(n ? n.title : '')}"></div>
      <div class="f"><label class="f__label" for="nw-text">${t('Text')}</label><textarea id="nw-text" name="text" maxlength="4000" rows="5">${esc(n ? n.text : '')}</textarea></div>
      <fieldset class="f"><legend class="f__label">${t('Kategorie')}</legend><div class="cat-pick">${NEWS_CATS
        .map(([v, , label, color]) => `<label class="cat-pick__item" style="--cc:${color}"><input type="radio" name="cat" value="${v}"${v === cat ? ' checked' : ''}><span><i aria-hidden="true"></i>${esc(t(label))}</span></label>`).join('')}</div></fieldset>
      <div class="f"><label class="f__label" for="nw-tag">${t('Tag')}</label><input id="nw-tag" name="tag" maxlength="30" value="${esc(n ? n.tag || '' : '')}" placeholder="${esc(t('z. B. Update 2.6'))}"></div>
      <fieldset class="f"><legend class="f__label">${t('Foto oder Video? (Pflicht)')}</legend>
        <div class="seg seg--big">
          <label><input type="radio" name="media" value="image"${kind === 'image' ? ' checked' : ''}><span>${icon('ph-image')}${t('Foto')}</span></label>
          <label><input type="radio" name="media" value="video"${kind === 'video' ? ' checked' : ''}><span>${icon('phf-play')}${t('Video')}</span></label>
        </div>
        <div class="media-in" data-media-in="image"${kind === 'image' ? '' : ' hidden'}>
          <label class="upload"><input type="file" name="file" accept="image/*"><span data-upload-label>${icon('ph-image')}${kind === 'image' ? t('Anderes Foto auswählen') : t('Foto auswählen')}</span></label>
          <img class="upload__preview" data-upload-preview alt=""${kind === 'image' && m.url ? ` src="${esc(m.url)}"` : ' hidden'}>
          <input name="imageUrl" type="url" inputmode="url" value="${esc(kind === 'image' ? m.url || '' : '')}" placeholder="${esc(t('oder Link zu einem Bild (https://…)'))}">
        </div>
        <div class="media-in" data-media-in="video"${kind === 'video' ? '' : ' hidden'}>
          <input name="videoUrl" type="url" inputmode="url" value="${esc(kind === 'video' ? m.url || '' : '')}" placeholder="${esc(t('YouTube-Link oder Link zu einer .mp4-Datei'))}">
        </div>
      </fieldset>
      <fieldset class="f"><legend class="f__label">${t('Buttons (höchstens 2)')}</legend>
        <div class="nbtns" data-nbtns>${n ? (n.buttons || []).map((b) => newsBtnRow(b)).join('') : ''}</div>
        <button class="btn-text" type="button" data-nbtn-add${n && (n.buttons || []).length >= 2 ? ' hidden' : ''}>${icon('ph-plus')}${t('Button hinzufügen')}</button>
      </fieldset>
      <button class="btn btn--primary btn--lg btn--block" type="submit">${icon(n ? 'ph-check' : 'ph-paper-plane-tilt')}${n ? t('Änderungen speichern') : t('Veröffentlichen')}</button>
      <p class="sheet-note">${n ? t('Datum und Autor bleiben gleich, die Neuigkeit wird als „bearbeitet“ markiert.') : t('Bearbeiten und löschen kannst du nur deine eigenen Neuigkeiten.')}</p>
    </form>`;
  }
  // Foto verkleinern (höchstens 1600 px, JPEG), damit es schnell lädt
  async function shrinkImage(file, max = 1600) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * scale));
      c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return await new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.82));
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  async function submitNews(form) {
    const f = new FormData(form);
    const old = form.dataset.newsId ? (remote.news || []).find((x) => x.id === form.dataset.newsId) || null : null;
    const title = f.get('title').trim();
    const text = f.get('text').trim();
    const kind = f.get('media');
    if (!title || !text) { toast(t('Bitte Titel und Text ausfüllen.')); return; }
    if (!kind) { toast(t('Bitte angeben, ob es ein Foto oder ein Video ist.')); return; }
    const buttons = $$('[data-nbtn]', form).map((row) => ({
      type: $('[name="btype"]', row).value, label: $('[name="blabel"]', row).value.trim(), url: $('[name="burl"]', row).value.trim(),
    }));
    if (buttons.some((b) => !/^https?:\/\//.test(b.url))) { toast(t('Jeder Button braucht einen Link (https://…).')); return; }
    const btn = $('button[type="submit"]', form);
    btn.disabled = true;
    try {
      const media = { type: kind };
      if (kind === 'image') {
        const file = f.get('file');
        if (file && file.size) {
          btn.textContent = t('Foto wird hochgeladen …');
          const up = await api('/api/media', { method: 'POST', raw: await shrinkImage(file), type: 'image/jpeg' });
          Object.assign(media, { url: up.url, mediaId: up.id });
        } else {
          media.url = f.get('imageUrl').trim();
          // Beim Bearbeiten: das schon hochgeladene Foto behalten
          if (old && old.media && old.media.mediaId && media.url === old.media.url) media.mediaId = old.media.mediaId;
        }
      } else media.url = f.get('videoUrl').trim();
      if (!media.url) throw Object.assign(new Error('media'), { status: 400, msg: kind === 'image' ? t('Bitte ein Foto auswählen oder einen Bild-Link angeben.') : t('Bitte einen Video-Link angeben.') });
      const body = { title, text, cat: f.get('cat'), tag: f.get('tag').trim(), media, buttons };
      if (old) await api(`/api/news/${encodeURIComponent(old.id)}`, { method: 'PUT', body });
      else await api('/api/news', { method: 'POST', body });
      closeModal();
      toast(old ? t('Änderungen gespeichert') : t('Neuigkeit veröffentlicht'));
      await loadContent();
    } catch (e) {
      btn.disabled = false;
      btn.innerHTML = old ? `${icon('ph-check')}${t('Änderungen speichern')}` : `${icon('ph-paper-plane-tilt')}${t('Veröffentlichen')}`;
      toast(e.msg || (e.message === 'video_url' ? t('Das ist kein YouTube- oder Video-Link.') : errorText(e)));
    }
  }
  async function deleteNews(id) {
    if (!window.confirm(t('Diese Neuigkeit wirklich löschen?'))) return;
    try {
      await api(`/api/news/${encodeURIComponent(id)}`, { method: 'DELETE' });
      closeModal();
      toast(t('Neuigkeit gelöscht'));
      await loadContent();
    } catch (e) { toast(errorText(e)); }
  }
  // Neuigkeiten: mit Backend die echten, sonst die Beispiele aus data.js
  function newsItems() {
    if (!apiReady() || !remote.news) return D.news;
    return remote.news.map((x) => ({
      ...x, remote: true,
      image: x.media && x.media.type === 'image' ? x.media.url : null,
      video: x.media && x.media.type === 'video' ? x.media.url : null,
      poster: x.media && x.media.poster,
    }));
  }
  const newsImage = (n) => {
    if (n.image) return n.image;
    if (n.img) return `assets/img/${n.img}`;
    const yt = youtubeId(n.video);
    return yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : n.poster || 'assets/img/play.svg';
  };
  function newsButtons(n) {
    const list = n.buttons && n.buttons.length ? n.buttons : [{ type: 'discord', url: D.links.discord }];
    return list.map((b) => {
      const k = NEWS_BUTTONS[b.type] || NEWS_BUTTONS.link;
      const cls = b.type === 'discord' ? 'btn--discord' : b.type === 'roblox' ? 'btn--primary' : 'btn--outline';
      return `<a class="btn ${cls} btn--block btn--lg" href="${esc(b.url)}" target="_blank" rel="noopener">${icon(k.icon)}${esc(b.label || t(k.label))}</a>`;
    }).join('');
  }

  // ---------- Bewerbungen prüfen (ab Public Relations Department) ----------
  const review = { list: null, at: 0, apps: {}, filter: 'new', job: 'all', answers: 'all', busy: false };
  async function ensureReviewData() {
    if (!canPR() || review.busy) return;
    const id = state.reviewId;
    const needList = !review.list || Date.now() - review.at > 30000;
    const needApp = id && !review.apps[id];
    if (!needList && !needApp) return;
    review.busy = true;
    try {
      if (needList) { review.list = (await api('/api/applications')).applications || []; review.at = Date.now(); }
      if (needApp) review.apps[id] = await api(`/api/applications/${encodeURIComponent(id)}`).catch(() => ({ error: true }));
    } catch (e) {
      review.list = review.list || [];
      review.at = Date.now();
    } finally {
      review.busy = false;
    }
    if (state.page === 'karriere' && !state.jobApply) renderCareer();
  }
  const statusPill = (a) => (a.status === 'passed' ? `<span class="pill pill--ok">${icon('ph-check')}${t('Bestanden')}</span>`
    : a.status === 'failed' ? `<span class="pill pill--bad">${t('Nicht bestanden')}</span>` : `<span class="pill pill--warn">${t('Neu')}</span>`);
  const scorePct = (a) => (a.total ? Math.round((a.score / a.total) * 100) : null);
  const jobTitleOf = (a) => { const j = D.jobs.find((x) => x.id === a.job); return t(j ? j.title : a.jobTitle || a.job); };
  const personImg = (a, cls = '') => (a.avatar ? `<span class="avatar ${cls}"><img src="${esc(a.avatar)}" alt="" referrerpolicy="no-referrer"></span>` : avatar(a.username, cls));
  function reviewList() {
    const back = `<a class="back-link" href="#/karriere">${icon('ph-arrow-left')}${t('Karriere')}</a>`;
    if (!review.list) return `${back}<div class="cbox"><p class="lead">${t('Bewerbungen werden geladen …')}</p></div>`;
    const all = review.list;
    const count = (st) => all.filter((a) => a.status === st).length;
    const jobs = [...new Set(all.map((a) => a.job))];
    const shown = all.filter((a) => (review.filter === 'all' || a.status === review.filter) && (review.job === 'all' || a.job === review.job));
    const ready = all.filter((a) => a.status === 'passed' && !a.sentAt);
    const chip = (attr, val, cur, label) => `<button class="chip${cur === val ? ' is-active' : ''}" type="button" ${attr}="${esc(val)}">${label}</button>`;
    return `${back}
      <div class="cbox">
        <h2>${t('Bewerbungen <em>prüfen</em>')}</h2>
        <p class="lead">${t('Öffne eine Bewerbung, sieh dir alle Antworten an und entscheide: bestanden oder nicht. Die Bestandenen schickst du unten gesammelt an Discord.')}</p>
        <div class="chips chips--scroll">${chip('data-rv-filter', 'new', review.filter, `${t('Neu')} · ${count('new')}`)}${chip('data-rv-filter', 'passed', review.filter, `${t('Bestanden')} · ${count('passed')}`)}${chip('data-rv-filter', 'failed', review.filter, `${t('Nicht bestanden')} · ${count('failed')}`)}${chip('data-rv-filter', 'all', review.filter, `${t('Alle')} · ${all.length}`)}</div>
        ${jobs.length > 1 ? `<div class="chips chips--scroll rv-jobs">${chip('data-rv-job', 'all', review.job, t('Alle Stellen'))}${jobs.map((j) => chip('data-rv-job', j, review.job, esc(jobTitleOf({ job: j })))).join('')}</div>` : ''}
      </div>
      <div class="rv-list">${shown.length ? shown.map((a) => `<a class="rv-row" href="#/karriere/pruefen/${esc(a.id)}">
          ${personImg(a)}
          <span class="rv-row__main"><b>${esc(a.displayName || a.username)}</b><small>@${esc(a.username)} · ${esc(jobTitleOf(a))}${a.area ? ` – ${esc(a.area)}` : ''} · ${fmtDate(a.at)}</small></span>
          <span class="rv-row__side">${scorePct(a) !== null ? `<b class="rv-score">${scorePct(a)} %</b>` : ''}${statusPill(a)}${a.sentAt ? `<small>${icon('si-discord')}${t('gesendet')}</small>` : ''}</span>
        </a>`).join('') : `<p class="empty">${t('Keine Bewerbungen in dieser Ansicht.')}</p>`}</div>
      <section class="cbox rv-send">
        <h3>${icon('si-discord')}${t('Bestandene an Discord senden')}</h3>
        ${ready.length ? `<p>${t('Diese Spieler haben bestanden und wurden noch nicht verkündet. Entferne den Haken bei allen, die du (noch) nicht senden willst.')}</p>
          <ul class="rv-pick">${ready.map((a) => `<li><label><input type="checkbox" name="announce" value="${esc(a.id)}" checked>${personImg(a, 'avatar--sm')}<span><b>${esc(a.displayName || a.username)}</b><small>${esc(jobTitleOf(a))}${a.area ? ` – ${esc(a.area)}` : ''}</small></span></label></li>`).join('')}</ul>
          <button class="btn-line" type="button" data-announce>${icon('ph-paper-plane-tilt')}${t('Ausgewählte an Discord senden')}</button>`
          : `<p class="muted">${t('Gerade gibt es keine bestandenen Bewerbungen, die noch nicht gesendet wurden.')}</p>`}
      </section>`;
  }
  // Ergebnis als Ring (Prozent der bewerteten Fragen)
  function scoreRing(pctv) {
    const r = 34;
    const c = 2 * Math.PI * r;
    const color = pctv >= 70 ? 'var(--ok)' : pctv >= 50 ? 'var(--warn)' : 'var(--bad)';
    return `<svg class="rv-ring" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="${r}" fill="none" stroke="var(--line)" stroke-width="8"/>
      <circle cx="40" cy="40" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(c * pctv) / 100} ${c}" transform="rotate(-90 40 40)"/>
      <text x="40" y="45" text-anchor="middle" font-size="17" font-weight="800" fill="currentColor">${pctv}%</text></svg>`;
  }
  function reviewDetail() {
    const back = `<a class="back-link" href="#/karriere/pruefen">${icon('ph-arrow-left')}${t('Alle Bewerbungen')}</a>`;
    const a = review.apps[state.reviewId];
    if (!a) return `${back}<div class="cbox"><p class="lead">${t('Bewerbung wird geladen …')}</p></div>`;
    if (a.error) return `${back}<div class="cbox"><p class="lead">${t('Diese Bewerbung gibt es nicht (mehr).')}</p></div>`;
    const pctv = scorePct(a);
    const answers = a.answers || [];
    const nOk = answers.filter((x) => x.ok === true).length;
    const nBad = answers.filter((x) => x.ok === false).length;
    const nOpen = answers.length - nOk - nBad;
    const shown = answers.map((x, i) => [x, i]).filter(([x]) => review.answers === 'all' || (review.answers === 'bad' ? x.ok === false : review.answers === 'ok' ? x.ok === true : x.ok == null));
    const fact = (ic, k, v) => `<div class="rv-fact"><span class="rv-fact__ic">${icon(ic)}</span><span><small>${k}</small><b>${v}</b></span></div>`;
    const chip = (val, label) => `<button class="chip${review.answers === val ? ' is-active' : ''}" type="button" data-rv-answers="${val}">${label}</button>`;
    const sent = a.notifiedStatus ? `<p class="rv-sent">${icon('ph-paper-plane-tilt')}<span>${t('Ergebnis gesendet: {status}', { status: a.notifiedStatus === 'passed' ? '✅ PASSED' : '❌ FAILED' })}${a.reviewedBy ? ` · ${t('von {name}', { name: esc(a.reviewedBy) })}` : ''}</span>${a.chatId ? `<a href="#/chat/${esc(a.chatId)}">${t('Zum Chat')}</a>` : ''}</p>` : '';
    return `${back}
      <article class="rv-detail">
        <section class="cbox rv-hero">
          <div class="rv-hero__top">${personImg(a, 'avatar--lg')}
            <div class="rv-hero__who"><h2>${esc(a.displayName || a.username)}</h2><p>@${esc(a.username)}</p></div>
            ${statusPill(a)}</div>
          <div class="rv-hero__job">${icon('ph-briefcase')}<span>${esc(jobTitleOf(a))}${a.area ? ` – ${esc(a.area)}` : ''}</span><small>${fmtDate(a.at)}</small></div>
          ${pctv !== null ? `<div class="rv-score-box">${scoreRing(pctv)}<div><b>${t('{a} von {b} richtig', { a: a.score, b: a.total })}</b>
            <span class="rv-legend"><span><i class="is-ok"></i>${nOk} ${t('richtig')}</span><span><i class="is-bad"></i>${nBad} ${t('falsch')}</span><span><i></i>${nOpen} ${t('offen')}</span></span></div></div>` : ''}
          <div class="rv-hero__actions">
            <a class="btn btn--soft btn--sm" href="#/chat/an/${esc(a.sub)}">${icon('ph-chats-circle')}${t('Nachricht')}</a>
            <a class="btn btn--soft btn--sm" href="https://www.roblox.com/users/${encodeURIComponent(a.sub)}/profile" target="_blank" rel="noopener">${icon('ph-arrow-square-out')}${t('Roblox-Profil')}</a>
          </div>
        </section>
        <section class="cbox rv-facts">
          ${fact('si-discord', 'Discord', esc(a.discord || '–'))}
          ${fact('ph-envelope-simple', t('E-Mail'), esc(a.email || '–'))}
          ${fact('ph-clock', t('Spielt seit'), esc(t(a.since || '–')))}
          ${fact('ph-seal-check', t('Rang (angegeben)'), esc(a.rank || '–'))}
          ${fact('ph-users-three', t('Rolle in der Gruppe'), esc(a.groupRole ? a.groupRole.name : t('nicht in der Gruppe')))}
          ${fact('ph-calendar-blank', t('Freie Tage'), esc((a.days || []).join(', ') || '–'))}
          ${a.activity ? `<div class="rv-fact rv-fact--wide"><span class="rv-fact__ic">${icon('ph-chart-line-up')}</span><span><small>${t('Aktivität')}</small><b>${a.activity} / 10</b><i class="rv-bar"><span style="width:${a.activity * 10}%"></span></i></span></div>` : ''}
        </section>
        ${a.experience ? `<section class="cbox"><h3 class="rv-sub">${t('Erfahrung')}</h3><p class="rv-text">${esc(a.experience)}</p></section>` : ''}
        <section class="cbox">
          <h3 class="rv-sub">${t('Fragen und Antworten')}<span>${answers.length}</span></h3>
          <div class="chips">${chip('all', `${t('Alle')} · ${answers.length}`)}${nBad ? chip('bad', `${t('Falsch')} · ${nBad}`) : ''}${chip('ok', `${t('Richtig')} · ${nOk}`)}${nOpen ? chip('open', `${t('Offen')} · ${nOpen}`) : ''}</div>
          <ol class="rv-answers">${shown.map(([x, i]) => `<li class="${x.ok === true ? 'is-ok' : x.ok === false ? 'is-bad' : ''}">
            <span class="rv-mark" aria-label="${x.ok === true ? esc(t('richtig')) : x.ok === false ? esc(t('falsch')) : esc(t('nicht bewertet'))}">${x.ok === true ? icon('ph-check') : x.ok === false ? icon('ph-x') : '–'}</span>
            <div><small>${t('Frage {n}', { n: i + 1 })}</small><b>${esc(x.q)}</b><p>${esc(x.a || '–')}</p></div></li>`).join('') || `<li class="rv-empty">${t('Keine Fragen in dieser Ansicht.')}</li>`}</ol>
        </section>
        ${sent}
        <div class="rv-actions">
          <p>${t('Ergebnis an {name} senden', { name: `<b>${esc(a.username)}</b>` })}</p>
          <button class="btn btn--ok btn--lg" type="button" data-review="passed" aria-pressed="${a.status === 'passed'}">${icon('ph-check')}${t('Bestanden')}</button>
          <button class="btn btn--danger btn--lg" type="button" data-review="failed" aria-pressed="${a.status === 'failed'}">${icon('ph-x')}${t('Nicht bestanden')}</button>
        </div>
        ${a.sentAt ? `<p class="f__note">${icon('si-discord')}${t('Am {date} an Discord gesendet.', { date: fmtDate(a.sentAt) })}</p>` : ''}
      </article>`;
  }
  async function setReview(status) {
    const id = state.reviewId;
    const app = review.apps[id];
    // Das Ergebnis geht sofort an den Bewerber (Chat, Benachrichtigung, E-Mail)
    if (app && app.notifiedStatus !== status && !confirm(status === 'passed'
      ? t('{name} als BESTANDEN werten? Das Ergebnis wird sofort per Chat, Benachrichtigung und E-Mail gesendet.', { name: app.username })
      : t('{name} als NICHT BESTANDEN werten? Das Ergebnis wird sofort per Chat, Benachrichtigung und E-Mail gesendet.', { name: app.username }))) return;
    try {
      const sum = await api(`/api/applications/${encodeURIComponent(id)}`, { method: 'PUT', body: { status } });
      if (review.apps[id]) Object.assign(review.apps[id], { status: sum.status, notifiedStatus: sum.notified, chatId: sum.chatId, reviewedBy: sum.reviewedBy });
      if (review.list) review.list = review.list.map((x) => (x.id === id ? sum : x));
      toast(status === 'passed' ? t('✅ Bestanden – Ergebnis gesendet') : t('❌ Nicht bestanden – Ergebnis gesendet'));
      // Weiter zur nächsten neuen Bewerbung
      const next = review.list && review.list.find((x) => x.status === 'new');
      if (next) location.hash = `#/karriere/pruefen/${next.id}`;
      else location.hash = '#/karriere/pruefen';
    } catch (e) { toast(errorText(e)); }
  }
  async function announceSelected() {
    const ids = $$('input[name="announce"]:checked').map((x) => x.value);
    if (!ids.length) { toast(t('Bitte mindestens einen Spieler auswählen.')); return; }
    try {
      const r = await api('/api/applications/announce', { method: 'POST', body: { ids } });
      toast(t('{n} Spieler auf Discord beglückwünscht', { n: r.sent }));
      review.list = null;
      ensureReviewData();
    } catch (e) {
      toast(e.status === 503 ? t('Im Backend fehlt noch der zweite Discord-Webhook (DISCORD_RESULTS_WEBHOOK_URL).') : errorText(e));
    }
  }

  // ---------- Chat ----------
  // Gespräche: Anfragen ans Team, Nachrichten an jeden Spieler und Gruppen (privat oder öffentlich) mit eigenen Regeln,
  // Fotos, Videos, Dateien und Befehlen wie /GetGroupData. Ab Supervisor gibt es die Moderation: jedes Gespräch
  // unsichtbar beobachten oder sichtbar beitreten, Nachrichten und Gespräche löschen.
  const CHAT = D.chat;
  const chat = {
    list: null, at: 0, staff: null, staffAt: 0, query: '', conv: {}, busy: false, timer: null, edit: false,
    pub: null, pubAt: 0, pubQuery: '', mod: null, modAt: 0, modQuery: '', modKind: '',
    pending: {}, sending: false, found: null, members: [],
    // Server: offener Kanal je Server (bleibt gespeichert), Kanalliste auf dem Handy offen?
    ch: store.get('tsg-ch', {}) || {}, side: false,
  };
  // Gleiche Liste wie backend/commands.js
  const CHAT_COMMANDS = [
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
    { id: 'getteam', usage: '/GetTeam', desc: 'Das Team ab Junior Supervisor nach Rang' },
    { id: 'members', usage: '/Members', desc: 'Wer in diesem Chat ist' },
    { id: 'play', usage: '/Play', desc: 'Spiel starten und Gruppe beitreten' },
    { id: 'discord', usage: '/Discord', desc: 'Zum Discord der Community' },
    { id: 'time', usage: '/Time', desc: 'Spielzeit (Uhrzeit in Deutschland)' },
    { id: 'roll', usage: '/Roll <Zahl>', desc: 'Würfeln (Standard 1–6)' },
    { id: 'ping', usage: '/Ping', desc: 'Ist der Bot da?' },
  ];
  // Knöpfe unter Antworten des TSG-Bots: nur Links in die App, zu Roblox und zu Discord, nur diese Icons
  const BOT_ICONS = ['ph-users-three', 'phf-play', 'ph-user', 'ph-paper-plane-tilt', 'ph-cell-signal-high', 'ph-calendar-blank', 'ph-newspaper',
    'ph-chart-line-up', 'ph-user-plus', 'si-discord'];
  // Ältere Bot-Nachrichten speichern noch die Namen der früheren Symbole
  const BOT_ICONS_OLD = { 'fi-rs-users-alt': 'ph-users-three', 'fi-ss-play': 'phf-play', 'fi-rs-user': 'ph-user', 'fi-rs-paper-plane': 'ph-paper-plane-tilt',
    'fi-rs-signal-alt-2': 'ph-cell-signal-high', 'fi-rs-calendar': 'ph-calendar-blank', 'fi-rs-newspaper': 'ph-newspaper', 'fi-rs-chart-line-up': 'ph-chart-line-up',
    'fi-rs-user-add': 'ph-user-plus', 'fi-brands-discord': 'si-discord' };
  const safeBotUrl = (u) => /^#\/[\w/-]*$/.test(u) || /^https:\/\/(www\.)?(roblox\.com|discord\.gg)\//.test(u);
  const botButtons = (m) => (m.buttons || []).filter((b) => b && safeBotUrl(String(b.url))).map((b) => {
    const ext = !b.url.startsWith('#');
    return `<a class="bot-btn${b.primary ? ' is-primary' : ''}" href="${esc(b.url)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${BOT_ICONS.includes(BOT_ICONS_OLD[b.icon] || b.icon) ? icon(BOT_ICONS_OLD[b.icon] || b.icon) : ''}<span>${esc(b.label)}</span>${ext ? icon('ph-arrow-square-out', 'bot-btn__ext') : ''}</a>`;
  }).join('');
  const GROUP_DEFAULTS = { visibility: 'private', invite: 'admins', write: 'all', media: true, slow: 0, cmd: 'all', cmds: CHAT_COMMANDS.map((c) => c.id), photo: 'admins' };
  const GROUP_COLORS = ['#EC0016', '#1455C0', '#408335', '#B35900', '#7A4BD1', '#0F8C8C', '#C2185B', '#3C414B'];
  const reasonOf = (id) => CHAT.reasons.find((r) => r.id === id) || CHAT.reasons[CHAT.reasons.length - 1];
  const areaOf = (id) => CHAT.areas.find((a) => a.id === id) || CHAT.areas[CHAT.areas.length - 1];
  const chatReady = () => apiReady() && !!sessionToken();
  const meSub = () => String((chat.list && chat.list.me) || (state.profile && state.profile.userId) || '');
  const isModHere = () => isTeam('Supervisor');
  const seenChats = () => store.get('tsg-chat-seen', {});
  const markSeen = (c) => { const s = seenChats(); s[c.id] = c.updated; store.set('tsg-chat-seen', s); };
  const isUnread = (c) => !!(c.last && c.last.by !== meSub() && c.last.by !== 'system' && c.updated > (seenChats()[c.id] || 0));
  const chatAgo = (ms) => {
    const min = Math.round((Date.now() - ms) / 60000);
    if (min < 1) return t('gerade eben');
    if (min < 60) return t('vor {n} Min.', { n: min });
    if (min < 1440) return t('vor {n} Std.', { n: Math.round(min / 60) });
    return fmtDate(ms);
  };
  const sizeText = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  const loadingHtml = () => `<p class="empty">${t('Wird geladen …')}</p>`;
  function chatError(e) {
    const map = {
      slow: t('Langsam-Modus: Bitte warte kurz, bevor du wieder schreibst.'),
      no_media: t('In diesem Chat sind keine Fotos und Videos erlaubt.'),
      quota: t('Du hast heute schon sehr viel hochgeladen. Morgen geht es weiter.'),
      too_large: t('Die Datei ist zu groß.'),
      bad_type: t('Diese Dateiart kann man nicht senden. Erlaubt sind Fotos, Videos und PDFs.'),
      full: t('Die Gruppe ist voll (höchstens 50 Leute).'),
      rate_limited: t('Du hast heute schon viele Gespräche gestartet. Bitte versuch es morgen wieder.'),
      not_found: t('Nicht gefunden.'),
      bad_name: t('Bitte gib einen gültigen Namen ein.'),
      forbidden: t('Das darfst du hier nicht.'),
      file_incomplete: t('Eine Datei ist noch nicht ganz hochgeladen.'),
      bad_link: t('Das ist kein Link zu einem privaten Server auf roblox.com.'),
      chat_forbidden: t('Verbinden geht nur mit Gruppen, in denen du Inhaber oder Admin bist.'),
      bad_webhook: t('Das ist kein Discord-Webhook. Er beginnt mit https://discord.com/api/webhooks/'),
      webhook_unreachable: t('Discord kennt diesen Webhook nicht. Bitte den Link aus Discord neu kopieren.'),
      bad_token: t('Das sieht nicht wie ein Bot-Token aus.'),
      bad_channel: t('Die Kanal-ID besteht nur aus Ziffern (in Discord: Rechtsklick auf den Kanal → ID kopieren).'),
      bot_unreachable: t('Mit diesem Token und Kanal kommt der Bot nicht an. Ist er auf dem Server und darf in den Kanal schreiben?'),
      requirements: t('Es fehlt noch etwas – siehe Liste „Voraussetzungen“.'),
      not_server: t('Discord gibt es nur für Server-Chats.'),
      discord_failed: t('Discord hat die Nachricht nicht angenommen.'),
      no_connection: t('Bitte zuerst einen Webhook oder Bot eintragen.'),
      too_many_bots: t('Höchstens 5 Bots pro Chat.'),
      bad_file_name: t('Dateinamen: 1–32 Zeichen, nur Buchstaben, Zahlen, - und _.'),
      duplicate_file: t('Zwei Dateien haben denselben Namen.'),
      file_too_large: t('Eine Datei ist zu lang (höchstens 12 000 Zeichen).'),
      bot_too_large: t('Der Bot ist zu groß (höchstens 100 000 Zeichen insgesamt).'),
      bad_prefix: t('Präfix: 1–3 Zeichen wie ! ? . $ % & # + ~ - (nicht /).'),
      not_group: t('Bots gibt es nur in Gruppen- und Server-Chats.'),
      too_many_files: t('Höchstens 40 Objekte pro Bot.'),
      bad_parent: t('Dieses Objekt kann dort nicht liegen (Kreis, oder Connectors und Webhooks enthalten nichts).'),
    };
    return map[e.message] || errorText(e);
  }

  // ---------- Wer, was, wie heißt es? ----------
  function chatOther(c) {
    const me = meSub();
    if (c.kind === 'direct') return c.from.sub === me ? c.to : c.from;
    if (c.kind === 'group') return null;
    if (c.from.sub === me) return c.claimedBy || null;
    return c.from;
  }
  const nameOfP = (p) => (p ? p.displayName || p.username : '?');
  function chatTitle(c) {
    if (c.kind === 'group') return c.name || t('Gruppe');
    const me = meSub();
    if (c.kind === 'direct') {
      // Moderation schaut zu: beide Namen
      if (c.to && c.from.sub !== me && c.to.sub !== me) return `${nameOfP(c.from)} & ${nameOfP(c.to)}`;
      return nameOfP(chatOther(c));
    }
    return t(reasonOf(c.reason).label);
  }
  const groupBadge = (c, cls = '') => (c.photo && API
    ? `<span class="group-badge has-photo ${cls}" aria-hidden="true"><img src="${esc(`${API}/media/chat/${c.id}?v=${c.photo}`)}" alt="" loading="lazy"></span>`
    : `<span class="group-badge ${cls}" style="--gc:${esc(c.color || '#3C414B')}" aria-hidden="true">${esc(initials(c.name || 'G'))}</span>`);
  function chatImg(c, cls = '') {
    if (c.kind === 'group') return groupBadge(c, cls);
    const other = chatOther(c);
    if (other) return personImg(other, cls);
    return `<span class="chat-row__ic ${cls}">${icon(c.kind === 'ticket' ? areaOf(c.area).icon : 'ph-chats-circle')}</span>`;
  }
  const memberCount = (c) => c.count || (c.members || []).length;
  function chatStatus(c) {
    if (c.status === 'closed') return `<span class="pill">${t('Erledigt')}</span>`;
    if (c.kind === 'group') {
      const pub = (c.visibility || (c.settings && c.settings.visibility)) === 'public';
      const nServers = Array.isArray(c.servers) ? c.servers.length : c.servers || 0;
      return `<span class="pill${pub ? ' pill--ok' : ''}">${icon(pub ? 'ph-globe' : 'ph-lock')}${pub ? t('Öffentlich') : t('Privat')} · ${t('{n} Mitglieder', { n: memberCount(c) })}</span>${c.category === 'server' ? `<span class="pill pill--info">${icon('ph-cell-signal-high')}${nServers === 1 ? t('1 Server') : t('{n} Server', { n: nServers })}</span>` : ''}`;
    }
    if (c.kind === 'direct') return `<span class="pill pill--info">${icon('ph-lock')}${t('Privat')}</span>`;
    if (c.status === 'open') return `<span class="pill pill--warn">${t('Wartet auf Annahme')}</span>`;
    return `<span class="pill pill--ok">${t('Angenommen von {name}', { name: esc(c.claimedBy ? c.claimedBy.username : '') })}</span>`;
  }

  // ---------- Laden ----------
  async function loadChats(force = false) {
    if (!chatReady() || chat.busy || (!force && chat.list && Date.now() - chat.at < 10000)) return;
    chat.busy = true;
    // Nur wer die Übersicht gerade sieht, bekommt keine Benachrichtigungen (view=1)
    const watching = state.page === 'chat' && ['mine', 'queue'].includes(state.chatView) && document.visibilityState === 'visible';
    let ok = false;
    try {
      chat.list = await api(`/api/chats${watching ? '?view=1' : ''}`);
      ok = true;
    } catch (e) { /* später nochmal */ } finally {
      chat.busy = false;
      chat.at = Date.now();
    }
    chatDot();
    if (state.page === 'chat' && ['mine', 'queue'].includes(state.chatView)) renderChat();
    // Server offen: Leiste mit allen Servern auf neuen Stand
    if (ok && state.page === 'chat' && state.chatView === 'conv') { const cc = chat.conv[state.chatArg]; const side = $('[data-cm-side]'); if (cc && cc.community && side) side.outerHTML = cmSide(cc); }
  }
  async function loadPublic(force = false) {
    if (!chatReady() || (!force && chat.pub && Date.now() - chat.pubAt < 20000)) return;
    chat.pubAt = Date.now();
    try { chat.pub = (await api(`/api/chats/public?q=${encodeURIComponent(chat.pubQuery)}`)).chats; } catch (e) { chat.pub = chat.pub || []; }
    const box = $('[data-chat-pub]');
    if (state.page === 'chat' && state.chatView === 'public' && box) box.innerHTML = chatPublicList();
  }
  async function loadMod(force = false) {
    if (!chatReady() || (!force && chat.mod && Date.now() - chat.modAt < 20000)) return;
    chat.modAt = Date.now();
    try { chat.mod = (await api(`/api/chats/moderation?q=${encodeURIComponent(chat.modQuery)}&kind=${chat.modKind}`)).chats; } catch (e) { chat.mod = chat.mod || []; }
    const box = $('[data-chat-modlist]');
    if (state.page === 'chat' && state.chatView === 'mod' && box) box.innerHTML = chatModList();
  }
  function chatDot() {
    const l = chat.list;
    const n = l ? l.chats.filter(isUnread).length + l.queue.filter((x) => x.status === 'open').length : 0;
    $$('[data-chat-dot]').forEach((el) => { el.hidden = !n; });
    // Ungelesenes zeigt die Leiste oben am Profilbild (nur neu zeichnen, wenn sich die Zahl ändert)
    if (chatDot.last !== n) { chatDot.last = n; const dot = $('.nav__me-dot', navRoot || document); if (dot) dot.classList.toggle('is-unread', n > 0); }
  }
  // Team ab Supervisor: vom Backend oder direkt aus der Roblox-Gruppe (über den Proxy)
  // Jede Person nur einmal (höchster Rang, Profilbild von welchem Eintrag auch immer)
  function uniqueStaff(list) {
    const byId = new Map();
    (list || []).forEach((p) => {
      const id = String(p.userId);
      const had = byId.get(id);
      const avatar = (had && had.avatar) || p.avatar || null;
      byId.set(id, { ...(!had || rankIdx(p.rank) > rankIdx(had.rank) ? p : had), userId: id, avatar });
    });
    return [...byId.values()];
  }
  async function loadStaff() {
    if (chat.staff && Date.now() - chat.staffAt < 30 * 60000) return;
    const cached = store.get('tsg-staff3', null);
    if (!chat.staff && cached && Date.now() - cached.at < 30 * 60000) { chat.staff = uniqueStaff(cached.list); chat.staffAt = cached.at; return; }
    try {
      let list;
      if (apiReady()) list = (await api('/api/staff')).staff;
      else {
        const R = D.roblox;
        const j = (u) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
        const roles = ((await j(`${R.groupsApi}/v1/groups/${RBX.groupId}/roles`)).roles || [])
          .map((r) => ({ ...r, rankName: rankFromRole(r) })).filter((r) => r.rank > 0 && rankIdx(r.rankName) >= rankIdx('Junior Supervisor'));
        list = [];
        for (const r of roles) {
          const res = await j(`${R.groupsApi}/v1/groups/${RBX.groupId}/roles/${r.id}/users?limit=100&sortOrder=Asc`);
          (res.data || []).forEach((u) => list.push({ userId: String(u.userId), username: u.username, displayName: u.displayName || u.username, rank: r.rankName, role: r.name }));
        }
        list = uniqueStaff(list);
        for (let i = 0; i < list.length; i += 100) {
          const part = list.slice(i, i + 100);
          const r = await j(`${R.thumbnailsApi}/v1/users/avatar-headshot?userIds=${part.map((x) => x.userId).join(',')}&size=150x150&format=Png&isCircular=false`).catch(() => ({ data: [] }));
          (r.data || []).forEach((img) => { const p = part.find((x) => x.userId === String(img.targetId)); if (p && img.state === 'Completed') p.avatar = img.imageUrl; });
        }
      }
      list = uniqueStaff(list);
      chat.staff = list;
      chat.staffAt = Date.now();
      store.set('tsg-staff3', { at: chat.staffAt, list });
    } catch (e) {
      chat.staff = chat.staff || (cached && cached.list) || [];
      chat.staffAt = Date.now() - 25 * 60000;
    }
    if (state.page === 'chat' && ['team', 'direct'].includes(state.chatView)) renderChat();
  }

  // ---------- Kopf mit Reitern ----------
  function chatHead() {
    const v = state.chatView;
    const l = chat.list;
    const tab = (id, href, ic, label, n) => `<a role="tab" href="${href}" aria-selected="${v === id}">${icon(ic)}<span>${label}</span>${n ? `<span class="head-tabs__n">${n}</span>` : ''}</a>`;
    const open = l ? l.queue.filter((x) => x.status === 'open').length : 0;
    const unread = l ? l.chats.filter(isUnread).length : 0;
    return `<div class="appbar">
        <div class="appbar__title"><span class="appbar__label">${t('Spieler, Gruppen und Team')}</span><h1 class="appbar__value">${t('Chat')}</h1></div>
        <div class="appbar__actions"><a class="btn btn--primary btn--sm" href="#/chat/neu">${icon('ph-plus')}${t('Neu')}</a></div>
      </div>
      <div class="head-tabs head-tabs--chat" role="tablist" aria-label="${esc(t('Chat'))}">
        ${tab('mine', '#/chat', 'ph-chats-circle', t('Gespräche'), unread)}
        ${(l && l.areas.length) || mayTrain() ? tab('queue', '#/chat/anfragen', 'ph-envelope-open', t('Anfragen'), open) : ''}
        ${tab('public', '#/chat/gruppen', 'ph-globe', t('Gruppen'))}
        ${tab('team', '#/chat/team', 'ph-users-three', t('Team'))}
        ${isModHere() ? tab('mod', '#/chat/moderation', 'ph-shield-check', t('Moderation'), l && l.reported) : ''}
        ${isReviewer() ? tab('discord', '#/chat/discord', 'si-discord', 'Discord', dreq.list ? dreq.list.filter((x) => x.status === 'pending').length : 0) : ''}
      </div>`;
  }
  function chatGate() {
    if (!apiReady()) {
      return mayTrain() ? `<div class="cbox">${backendSetupHtml()}</div>`
        : `<div class="chat-empty">${icon('ph-chats-circle')}<h2>${t('Der Chat startet bald')}</h2><p>${t('Sobald der App-Server läuft, kannst du hier mit anderen Spielern und dem Team schreiben. Wer im Team ist, siehst du schon unter „Team“.')}</p>
          <a class="btn btn--soft" href="#/chat/team">${icon('ph-users-three')}${t('Team ansehen')}</a></div>`;
    }
    if (!sessionToken()) {
      return `<div class="chat-empty">${icon('ph-sign-in')}<h2>${t('Mit Roblox anmelden')}</h2><p>${t('Damit alle wissen, wer schreibt, meldest du dich einmal mit Roblox an.')}</p>
        <button class="btn btn--primary" type="button" data-open="profile">${t('Anmelden')}</button></div>`;
    }
    return '';
  }

  // ---------- Listen ----------
  function chatRow(c, { queue = false, mod = false } = {}) {
    const last = c.last;
    const me = meSub();
    const who = last && last.by !== 'system' ? (last.by === me ? `${t('Du')}: ` : last.name && c.kind !== 'direct' ? `${esc(last.name)}: ` : '') : '';
    const preview = last ? `${who}${esc(last.text)}` : '';
    const sub = c.kind === 'ticket' ? `${queue ? `${esc(t(reasonOf(c.reason).label))} · ` : ''}${esc(t(areaOf(c.area).label))}`
      : c.kind === 'group' ? esc(c.desc || t('Gruppe')) : mod ? t('Privat-Chat') : t('Direktnachricht');
    return `<div class="chat-row-wrap">
      <a class="chat-row${isUnread(c) ? ' is-unread' : ''}${c.status === 'open' && c.kind === 'ticket' ? ' is-waiting' : ''}" href="#/chat/${esc(c.id)}">
        ${chatImg(c)}
        <span class="chat-row__main">
          <span class="chat-row__top"><b>${queue ? esc(nameOfP(c.from)) : esc(chatTitle(c))}</b><small>${chatAgo(c.updated)}</small></span>
          <span class="chat-row__sub">${sub}</span>
          ${preview ? `<span class="chat-row__text">${preview}</span>` : ''}
          <span class="chat-row__status">${chatStatus(c)}${c.reported ? `<span class="pill pill--bad">${icon('ph-flag')}${t('Gemeldet')}</span>` : ''}${c.ref ? `<span class="pill pill--bad">${icon('ph-flag')}${t('Meldung')}</span>` : ''}</span>
        </span>
      </a>
      ${chat.edit && !queue && !mod ? `<button class="chat-row__del" type="button" data-chat-hide="${esc(c.id)}" aria-label="${esc(t('Für mich löschen'))}">${icon('ph-trash')}</button>` : ''}
    </div>`;
  }
  const newButtons = () => `<div class="chat-empty__btns">
      <a class="btn btn--primary" href="#/chat/neu/spieler">${icon('ph-user-plus')}${t('Spieler anschreiben')}</a>
      <a class="btn btn--soft" href="#/chat/neu/gruppe">${icon('ph-users-three')}${t('Gruppe erstellen')}</a>
      <a class="btn btn--soft" href="#/chat/neu/anfrage">${icon('ph-chat-centered-dots')}${t('Anfrage ans Team')}</a></div>`;
  function chatMine() {
    const gate = chatGate();
    if (gate) return gate;
    if (!chat.list) { loadChats(); return loadingHtml(); }
    const all = chat.list.chats.slice().sort((a, b) => (a.status === 'closed') - (b.status === 'closed') || b.updated - a.updated);
    // Zwei Arten: normale Chats und Server (Communities mit Kanälen, auf Wunsch mit privaten Servern im Spiel verbunden)
    const servers = all.filter((c) => c.category === 'server');
    const normal = all.filter((c) => c.category !== 'server');
    const cat = chat.cat === 'server' ? 'server' : 'chats';
    const tab = (id, ic, label, list) => `<button type="button" role="tab" aria-selected="${cat === id}" data-chat-cat="${id}">${icon(ic)}<span>${label}</span><i>${list.length}</i>${list.some(isUnread) ? '<b class="cat-tabs__dot"></b>' : ''}</button>`;
    const tabs = `<div class="cat-tabs" role="tablist" aria-label="${esc(t('Art der Gespräche'))}">${tab('chats', 'ph-chats-circle', t('Chats'), normal)}${tab('server', 'ph-squares-four', t('Server'), servers)}</div>`;
    const list = cat === 'server' ? servers : normal;
    if (!list.length) {
      return cat === 'server'
        ? `${tabs}<div class="chat-empty">${icon('ph-squares-four')}<h2>${t('Noch keine Server')}</h2><p>${t('Ein Server ist eine Community wie bei Discord: Kanäle, Kategorien, Rollen und Bots – auf Wunsch mit deinen privaten Servern im Spiel verbunden.')}</p>
          <div class="chat-empty__btns"><a class="btn btn--primary" href="#/chat/neu/server">${icon('ph-plus')}${t('Server erstellen')}</a></div></div>`
        : `${tabs}<div class="chat-empty">${icon('ph-chats-circle')}<h2>${t('Noch keine Gespräche')}</h2><p>${t('Schreib einem Spieler, gründe eine Gruppe oder stell dem Team eine Frage.')}</p>${newButtons()}</div>`;
    }
    return `${tabs}<div class="chat-tools"><span>${list.length === 1 ? t('1 Gespräch') : t('{n} Gespräche', { n: list.length })}</span>
        <button class="link-btn" type="button" data-chat-edit>${chat.edit ? t('Fertig') : `${icon('ph-trash')}${t('Löschen')}`}</button></div>
      ${chat.edit ? `<p class="chat-hint">${icon('ph-info')}<span>${t('Gelöschte Gespräche verschwinden nur bei dir. Schreibt jemand Neues, sind sie wieder da.')}</span></p>` : ''}
      <div class="chat-list">${list.map((c) => chatRow(c)).join('')}</div>`;
  }
  function chatQueue() {
    const gate = chatGate();
    if (gate) return gate;
    if (!chat.list) { loadChats(); return loadingHtml(); }
    if (!chat.list.areas.length) return `<p class="empty">${t('Anfragen annehmen kann das Team ab Supervisor.')}</p>`;
    const q = chat.list.queue;
    // Nicht angenommene zuerst – wer am längsten wartet, steht oben
    const open = q.filter((x) => x.status === 'open').sort((a, b) => a.created - b.created);
    const taken = q.filter((x) => x.status === 'claimed').sort((a, b) => b.updated - a.updated);
    const areas = chat.list.areas.map((id) => esc(t(areaOf(id).label))).join(', ');
    return `<p class="chat-hint">${icon('ph-info')}<span>${t('Du siehst Anfragen aus: {areas}', { areas })}</span></p>
      <h2 class="chat-sec">${t('Wartet auf Annahme')}<span>${open.length}</span></h2>
      ${open.length ? `<div class="chat-list">${open.map((c) => chatRow(c, { queue: true })).join('')}</div>` : `<p class="empty">${t('Alles erledigt – keine offenen Anfragen.')}</p>`}
      ${taken.length ? `<h2 class="chat-sec">${t('Angenommen')}<span>${taken.length}</span></h2><div class="chat-list">${taken.map((c) => chatRow(c, { queue: true })).join('')}</div>` : ''}`;
  }
  const searchField = (attr, value, placeholder) => `<label class="field chat-search">${icon('ph-magnifying-glass')}<span class="field__input"><span class="sr-only">${esc(placeholder)}</span><input type="search" ${attr} value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off"></span></label>`;
  function chatPublic() {
    const gate = chatGate();
    if (gate) return gate;
    loadPublic();
    return `${searchField('data-chat-pubsearch', chat.pubQuery, t('Öffentliche Gruppen suchen …'))}
      <a class="chat-alt" href="#/chat/neu/gruppe">${icon('ph-plus')}<span>${t('Eigene Gruppe erstellen')}<small>${t('Privat oder öffentlich – mit eigenen Regeln und Befehlen')}</small></span>${icon('ph-caret-right')}</a>
      <div data-chat-pub>${chatPublicList()}</div>`;
  }
  function chatPublicList() {
    if (!chat.pub) return loadingHtml();
    if (!chat.pub.length) return `<p class="empty">${chat.pubQuery ? t('Keine Gruppe gefunden.') : t('Noch keine öffentlichen Gruppen. Erstell die erste!')}</p>`;
    return `<div class="chat-list">${chat.pub.map((c) => `<div class="pub-row">
        <a class="pub-row__link" href="#/chat/${esc(c.id)}">${groupBadge(c)}
          <span class="pub-row__main"><b>${esc(c.name)}</b><small>${t('{n} Mitglieder', { n: c.count })} · ${chatAgo(c.updated)}</small>${c.desc ? `<span>${esc(c.desc)}</span>` : ''}</span></a>
        ${c.joined ? `<a class="btn btn--soft btn--sm" href="#/chat/${esc(c.id)}">${t('Öffnen')}</a>` : `<button class="btn btn--primary btn--sm" type="button" data-chat-join="${esc(c.id)}">${t('Beitreten')}</button>`}
      </div>`).join('')}</div>`;
  }
  function chatMod() {
    if (!isModHere()) return `<p class="empty">${t('Die Moderation gibt es ab Supervisor.')}</p>`;
    const gate = chatGate();
    if (gate) return gate;
    loadMod();
    const kinds = [['', t('Alle')], ['direct', t('Privat-Chats')], ['group', t('Gruppen')], ['ticket', t('Anfragen')]];
    return `<p class="chat-hint chat-hint--mod">${icon('ph-shield-check')}<span>${t('Zur Sicherheit kannst du jedes Gespräch unsichtbar beobachten oder sichtbar beitreten – außer bei Leuten mit höherem Rang. Jeder Blick wird vermerkt.')}</span></p>
      ${searchField('data-chat-modsearch', chat.modQuery, t('Name, Gruppe oder Spieler …'))}
      <div class="chips chips--block" role="group" aria-label="${esc(t('Art'))}">${kinds.map(([id, label]) => `<button class="chip${chat.modKind === id ? ' is-active' : ''}" type="button" data-mod-kind="${id}">${label}</button>`).join('')}</div>
      <div data-chat-modlist>${chatModList()}</div>`;
  }
  function chatModList() {
    if (!chat.mod) return loadingHtml();
    if (!chat.mod.length) return `<p class="empty">${t('Keine Gespräche gefunden.')}</p>`;
    return `<div class="chat-list">${chat.mod.map((c) => chatRow(c, { mod: true })).join('')}</div>`;
  }
  function chatTeam() {
    if (!chat.staff) { loadStaff(); return `<p class="empty">${t('Team wird geladen …')}</p>`; }
    return `<a class="chat-alt" href="#/chat/neu/spieler">${icon('ph-user-plus')}<span>${t('Jemand anderem schreiben?')}<small>${t('Jeden Roblox-Spieler per Name finden')}</small></span>${icon('ph-caret-right')}</a>
      ${searchField('data-chat-search', chat.query, t('Name oder Rang suchen …'))}
      <div data-chat-team>${chatTeamList()}</div>`;
  }
  function chatTeamList() {
    const me = meSub();
    const q = norm(chat.query.trim());
    const list = chat.staff.filter((p) => String(p.userId) !== me && (!q || norm(`${p.displayName} ${p.username} ${p.rank} ${rankOf(p.rank).prefix}`).includes(q)));
    const groups = RANKS.slice().reverse().filter((r) => rankIdx(r.name) >= rankIdx('Supervisor')).map((r) => [r, list.filter((p) => p.rank === r.name)]).filter(([, l]) => l.length);
    return groups.length ? groups.map(([r, l]) => `<section class="team-group">
          <h2 class="pgroup__title"><i style="--rc:${r.color}"></i>${esc(r.name)}<small>${esc(t(r.label))} · ${l.length}</small></h2>
          <ul class="team-list">${l.map((p) => `<li class="team-row">
            ${personImg(p)}
            <span class="team-row__main"><b>${esc(p.displayName)}</b><small>@${esc(p.username)}</small></span>
            ${rankPill(rankOf(p.rank))}
            <a class="btn btn--soft btn--sm" href="#/chat/an/${esc(p.userId)}" aria-label="${esc(t('{name} schreiben', { name: p.displayName }))}">${icon('ph-paper-plane-tilt')}<span>${t('Schreiben')}</span></a>
          </li>`).join('')}</ul>
        </section>`).join('') : `<p class="empty">${q ? t('Niemanden gefunden.') : t('Gerade ist niemand im Team eingetragen.')}</p>`;
  }

  // ---------- Neu: Spieler, Gruppe, Anfrage ----------
  const backTo = (href, label) => `<a class="back-link" href="${href}">${icon('ph-arrow-left')}${label}</a>`;
  function chatNewChoice() {
    const gate = chatGate();
    const card = (href, ic, title, text) => `<a class="new-card" href="${href}"><span class="new-card__ic">${icon(ic)}</span><span class="new-card__text"><b>${title}</b><small>${text}</small></span>${icon('ph-caret-right', 'new-card__chev')}</a>`;
    return `${backTo('#/chat', t('Chat'))}
      ${gate || `<div class="new-grid">
        ${card('#/chat/neu/spieler', 'ph-user-plus', t('Spieler anschreiben'), t('Privat mit einer Person schreiben – jeden Roblox-Spieler per Name'))}
        ${card('#/chat/neu/gruppe', 'ph-users-three', t('Gruppe erstellen'), t('Mehrere Leute, privat oder öffentlich, mit eigenen Regeln und Befehlen'))}
        ${card('#/chat/neu/server', 'ph-cell-signal-high', t('Server erstellen'), t('Mit Kanälen wie #allgemein – auf Wunsch mit deinen privaten Servern im Spiel verbunden'))}
        ${card('#/chat/neu/anfrage', 'ph-chat-centered-dots', t('Anfrage ans Team'), t('Frage, Fehler oder Meldung – das zuständige Team antwortet'))}
        ${card('#/chat/neu/beitreten', 'ph-link', t('Einem Server beitreten'), t('Mit einem Einladungslink oder Code'))}
      </div>`}`;
  }
  function chatNewDm() {
    const gate = chatGate();
    const f = chat.found;
    return `${backTo('#/chat/neu', t('Neu'))}
      ${gate || `<form class="find-player" data-find-player>
        <label class="f__label" for="fp-name">${icon('ph-magnifying-glass')}${t('Wem möchtest du schreiben?')}</label>
        <div class="find-player__row"><input id="fp-name" name="name" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(t('Roblox-Name, z. B. Lokfuehrer_Max'))}">
        <button class="btn btn--primary" type="submit">${t('Suchen')}</button></div>
        <small>${t('Du kannst jedem Roblox-Spieler schreiben. Eine Benachrichtigung bekommt, wer die App nutzt.')}</small>
      </form>
      ${f ? `<div class="dm-card">${personImg(f, 'avatar--lg')}<span><b>${esc(f.displayName)}</b><small>@${esc(f.username)}</small></span>
        <a class="btn btn--primary btn--sm" href="#/chat/an/${esc(f.userId)}">${icon('ph-paper-plane-tilt')}${t('Schreiben')}</a></div>` : ''}
      <a class="chat-alt" href="#/chat/team">${icon('ph-users-three')}<span>${t('Jemandem aus dem Team schreiben?')}<small>${t('Alle ab Supervisor mit Suche')}</small></span>${icon('ph-caret-right')}</a>`}`;
  }
  function chatNewTicket() {
    const gate = chatGate();
    const next = nextRank(state.rank);
    const nextArea = next && CHAT.areas.find((a) => a.rank === next.name);
    return `${backTo('#/chat/neu', t('Neu'))}
      ${gate || `<form class="cform chat-form" data-chat-new novalidate>
        <fieldset class="f"><legend class="f__label">${t('Worum geht es?')}</legend>
          <div class="pick-grid">${CHAT.reasons.map((r) => `<label class="pick"><input type="radio" name="reason" value="${r.id}" data-area-hint="${esc(r.area || (nextArea ? nextArea.id : 'driver'))}"><span>${icon(r.icon)}${esc(t(r.label))}</span></label>`).join('')}</div>
        </fieldset>
        <fieldset class="f"><legend class="f__label">${t('Welcher Bereich?')}</legend>
          <div class="ch-area-grid">${CHAT.areas.map((a) => `<label class="ch-area"><input type="radio" name="area" value="${a.id}"><span class="ch-area__ic">${icon(a.icon)}</span><span class="ch-area__text"><b>${esc(t(a.label))}</b><small>${esc(t(a.desc))}</small></span></label>`).join('')}</div>
        </fieldset>
        <div class="f"><label class="f__label" for="ch-text">${t('Deine Nachricht')}</label><textarea id="ch-text" name="text" rows="5" maxlength="2000" placeholder="${esc(t('Beschreib kurz, worum es geht …'))}"></textarea></div>
        <button class="btn btn--primary btn--lg btn--block" type="submit">${icon('ph-paper-plane-tilt')}${t('Anfrage senden')}</button>
        <p class="f__note">${t('Alle aus dem Team dieses Bereichs sehen deine Anfrage. Wer sie annimmt, antwortet dir hier – du siehst, wer es ist.')}</p>
      </form>`}`;
  }
  // Einstellungen einer Gruppe (beim Erstellen und unter „Info“)
  function groupSettingsFields(st) {
    const opt = (name, value, label) => `<option value="${value}"${String(st[name]) === String(value) ? ' selected' : ''}>${label}</option>`;
    return `<div class="gset__grid">
      <label class="f"><span class="f__label">${t('Wer darf Leute hinzufügen?')}</span><select name="invite">${opt('invite', 'owner', t('Nur der Inhaber'))}${opt('invite', 'admins', t('Inhaber und Admins'))}${opt('invite', 'all', t('Alle Mitglieder'))}</select></label>
      <label class="f"><span class="f__label">${t('Wer darf schreiben?')}</span><select name="write">${opt('write', 'all', t('Alle Mitglieder'))}${opt('write', 'admins', t('Nur Inhaber und Admins'))}</select></label>
      <label class="f"><span class="f__label">${t('Langsam-Modus')}</span><select name="slow">${opt('slow', 0, t('Aus'))}${[5, 10, 30, 60].map((s) => opt('slow', s, t('Alle {n} Sekunden', { n: s }))).join('')}${opt('slow', 300, t('Alle 5 Minuten'))}</select></label>
      <label class="f"><span class="f__label">${t('Befehle wie /GetGroupData')}</span><select name="cmd">${opt('cmd', 'all', t('Für alle'))}${opt('cmd', 'admins', t('Nur Inhaber und Admins'))}${opt('cmd', 'off', t('Aus'))}</select></label>
      <label class="f"><span class="f__label">${t('Wer darf das Gruppenbild ändern?')}</span><select name="photo">${opt('photo', 'owner', t('Nur der Inhaber'))}${opt('photo', 'admins', t('Inhaber und Admins'))}${opt('photo', 'all', t('Alle Mitglieder'))}</select></label>
    </div>
    <label class="toggle"><span class="toggle__text"><b>${t('Fotos, Videos und Dateien')}</b><small>${t('Aus = nur Inhaber und Admins dürfen Medien senden.')}</small></span>
      <input type="checkbox" role="switch" name="media"${st.media ? ' checked' : ''}><span class="toggle__ui" aria-hidden="true"></span></label>
    <fieldset class="cmd-pick"><legend>${t('Erlaubte Befehle')}</legend>
      ${CHAT_COMMANDS.map((c) => `<label class="cmd-pick__row"><input type="checkbox" name="cmds" value="${c.id}"${st.cmds.includes(c.id) ? ' checked' : ''}><span><code>${esc(c.usage)}</code><small>${esc(t(c.desc))}</small></span></label>`).join('')}
    </fieldset>`;
  }
  function readGroupSettings(form) {
    const f = form.elements;
    return {
      visibility: (form.querySelector('input[name="visibility"]:checked') || {}).value || 'private',
      invite: f.invite.value, write: f.write.value, slow: +f.slow.value, cmd: f.cmd.value, media: f.media.checked, photo: f.photo.value,
      cmds: [...form.querySelectorAll('input[name="cmds"]:checked')].map((x) => x.value),
    };
  }
  const visPick = (value) => `<div class="vis-grid">
      <label class="vis"><input type="radio" name="visibility" value="private"${value !== 'public' ? ' checked' : ''}><span>${icon('ph-lock')}<b>${t('Privat')}</b><small>${t('Nur wer eingeladen wird')}</small></span></label>
      <label class="vis"><input type="radio" name="visibility" value="public"${value === 'public' ? ' checked' : ''}><span>${icon('ph-globe')}<b>${t('Öffentlich')}</b><small>${t('Jeder kann sie finden und beitreten')}</small></span></label>
    </div>`;
  const memberChips = () => chat.members.map((p) => `<span class="mchip">${personImg(p, 'avatar--xs')}<b>${esc(p.displayName)}</b><button type="button" data-member-del="${esc(p.userId)}" aria-label="${esc(t('Entfernen'))}">${icon('ph-x')}</button></span>`).join('');
  function chatNewGroup() {
    const gate = chatGate();
    // Aus einem Privat-Chat: #/chat/neu/gruppe?mit=<id> – die Person ist schon dabei
    const withId = new URLSearchParams(location.hash.split('?')[1] || '').get('mit');
    if (withId && !chat.members.some((p) => p.userId === withId)) {
      const p = (chat.staff || []).find((x) => x.userId === withId) || (typeof chatPlayers[withId] === 'object' ? chatPlayers[withId] : null);
      if (p) chat.members.push(p); else if (!chatPlayers[withId]) loadPlayer(withId, () => { if (typeof chatPlayers[withId] === 'object') { chat.members.push(chatPlayers[withId]); const box = $('[data-member-chips]'); if (box) box.innerHTML = memberChips(); } });
    }
    return `${backTo('#/chat/neu', t('Neu'))}
      ${gate || `<form class="cform group-form" data-group-new novalidate>
        <div class="f"><label class="f__label" for="gr-name">${t('Name der Gruppe')}</label><input id="gr-name" name="name" maxlength="60" placeholder="${esc(defaultName('Gruppe'))}"><small class="f__hint">${t('Leer lassen für „{name}“', { name: esc(defaultName('Gruppe')) })}</small></div>
        <div class="f"><label class="f__label" for="gr-desc">${t('Beschreibung')}</label><textarea id="gr-desc" name="desc" rows="2" maxlength="300" placeholder="${esc(t('Worum geht es in der Gruppe? (optional)'))}"></textarea></div>
        <fieldset class="f"><legend class="f__label">${t('Wer kann die Gruppe sehen?')}</legend>${visPick('private')}</fieldset>
        <div class="f"><span class="f__label">${t('Leute hinzufügen')}</span>
          <div class="find-player__row"><input data-member-input autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(t('Roblox-Name'))}"><button class="btn btn--soft" type="button" data-member-add>${icon('ph-plus')}${t('Dazu')}</button></div>
          <div class="mchips" data-member-chips>${memberChips()}</div>
        </div>
        <div class="f"><label class="f__label" for="gr-rules">${t('Regeln')}</label><textarea id="gr-rules" name="rules" rows="3" maxlength="1500" placeholder="${esc(t('z. B. Freundlich bleiben, kein Spam, keine Werbung (optional)'))}"></textarea></div>
        <details class="gset"><summary>${icon('ph-sliders-horizontal')}${t('Rechte, Medien und Befehle')}</summary>${groupSettingsFields(GROUP_DEFAULTS)}</details>
        <div class="f"><label class="f__label" for="gr-text">${t('Erste Nachricht')}</label><textarea id="gr-text" name="text" rows="2" maxlength="2000" placeholder="${esc(t('Hallo zusammen! (optional)'))}"></textarea></div>
        <button class="btn btn--primary btn--lg btn--block" type="submit">${icon('ph-users-three')}${t('Gruppe erstellen')}</button>
        <p class="f__note">${icon('ph-shield-check')} ${t('Zur Sicherheit kann die Moderation (ab Supervisor) jede Gruppe einsehen.')}</p>
      </form>`}`;
  }
  // Beitreten: über die App (Knopf mit dem Link zum privaten Server) oder nur über Roblox
  const joinPick = (value) => `<div class="vis-grid">
      <label class="vis"><input type="radio" name="join" value="app"${value === 'app' ? ' checked' : ''}><span>${icon('phf-play')}<b>${t('Über die App')}</b><small>${t('„Beitreten“ in der App mit deinem Link zum privaten Server')}</small></span></label>
      <label class="vis"><input type="radio" name="join" value="roblox"${value !== 'app' ? ' checked' : ''}><span>${icon('ph-lock')}<b>${t('Nur über Roblox')}</b><small>${t('Freunde und Einladungen direkt in Roblox')}</small></span></label>
    </div>`;
  const linkField = (value = '') => `<div class="f"><label class="f__label" for="ps-link">${t('Link zum privaten Server')}</label>
      <input id="ps-link" name="link" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(value)}" placeholder="https://www.roblox.com/share?code=…&type=Server">
      <small class="f__hint">${t('In Roblox beim privaten Server auf „Konfigurieren“ → „Link erstellen“ und hier einfügen. Nur nötig für „Über die App“.')}</small></div>`;
  const psState = (p) => (p.online ? t('Online · {a}/{b} Spieler', { a: p.players, b: p.max }) : p.lastSeen ? t('Offline · zuletzt {when}', { when: fmtWhen(p.lastSeen) }) : t('Offline'));
  function chatNewServer() {
    const gate = chatGate();
    if (!ps.list) loadPservers();
    const mine = ps.list ? ps.list.mine : null;
    const pick = !mine ? loadingHtml() : mine.length
      ? `<div class="ps-pick">${mine.map((p) => `<label class="ps-pick__row"><input type="checkbox" name="servers" value="${esc(p.id)}"${mine.length === 1 ? ' checked' : ''}>
          <span class="ps-pick__ic">${icon('ph-cell-signal-high')}</span><span class="ps-pick__text"><b>${esc(p.name)}</b><small>${psState(p)}${p.chat ? ` · ${t('jetzt mit „{name}“ verbunden', { name: esc(p.chat.name) })}` : ''}</small></span></label>`).join('')}</div>`
      : `<p class="ps-empty">${icon('ph-info')}<span>${t('Noch kein privater Server von dir bekannt. Starte deinen privaten Server einmal in Roblox – dann erscheint er hier (das Spiel meldet ihn automatisch). Den Chat kannst du schon jetzt erstellen und den Server später unter „Info“ verbinden.')}</span></p>`;
    return `${backTo('#/chat/neu', t('Neu'))}
      ${gate || `<form class="cform group-form" data-server-new novalidate>
        <div class="f"><label class="f__label" for="gr-name">${t('Name des Servers')}</label><input id="gr-name" name="name" maxlength="60" placeholder="${esc(defaultName('Server'))}"><small class="f__hint">${t('Leer lassen für „{name}“', { name: esc(defaultName('Server')) })}</small></div>
        <div class="f"><label class="f__label" for="gr-desc">${t('Beschreibung')}</label><textarea id="gr-desc" name="desc" rows="2" maxlength="300" placeholder="${esc(t('Wofür ist der Server? (optional)'))}"></textarea></div>
        <fieldset class="f"><legend class="f__label">${t('Mit einer Vorlage starten')}</legend>${templatePick()}<small class="f__hint">${t('Kanäle und Kategorien kannst du danach jederzeit ändern.')}</small></fieldset>
        <fieldset class="f"><legend class="f__label">${t('Private Server verbinden')}</legend>${pick}</fieldset>
        <fieldset class="f"><legend class="f__label">${t('Wie tritt man bei?')}</legend>${joinPick('app')}</fieldset>
        ${linkField()}
        <label class="toggle"><span class="toggle__text"><b>${t('Nur Mitglieder dieses Chats auf den Server')}</b><small>${t('Das Spiel weist alle anderen freundlich ab.')}</small></span>
          <input type="checkbox" role="switch" name="membersOnly"><span class="toggle__ui" aria-hidden="true"></span></label>
        <label class="toggle"><span class="toggle__text"><b>${t('Nachrichten im Spiel anzeigen')}</b><small>${t('Was hier geschrieben wird, erscheint im Spiel-Chat des Servers (von Roblox gefiltert).')}</small></span>
          <input type="checkbox" role="switch" name="relay"><span class="toggle__ui" aria-hidden="true"></span></label>
        <div class="f"><label class="f__label" for="sv-welcome">${t('Begrüßung im Spiel')}</label><textarea id="sv-welcome" name="welcome" rows="2" maxlength="300" placeholder="${esc(t('Willkommen auf unserem Server! (optional)'))}"></textarea></div>
        <fieldset class="f"><legend class="f__label">${t('Wer kann den Chat sehen?')}</legend>${visPick('private')}</fieldset>
        <div class="f"><span class="f__label">${t('Leute hinzufügen')}</span>
          <div class="find-player__row"><input data-member-input autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(t('Roblox-Name'))}"><button class="btn btn--soft" type="button" data-member-add>${icon('ph-plus')}${t('Dazu')}</button></div>
          <div class="mchips" data-member-chips>${memberChips()}</div>
        </div>
        <div class="f"><label class="f__label" for="gr-rules">${t('Regeln')}</label><textarea id="gr-rules" name="rules" rows="3" maxlength="1500" placeholder="${esc(t('Gelten im Chat und werden im Spiel beim Betreten gezeigt (optional)'))}"></textarea></div>
        <details class="gset"><summary>${icon('ph-sliders-horizontal')}${t('Rechte, Medien und Befehle')}</summary>${groupSettingsFields(GROUP_DEFAULTS)}</details>
        <div class="f"><label class="f__label" for="gr-text">${t('Erste Nachricht')}</label><textarea id="gr-text" name="text" rows="2" maxlength="2000" placeholder="${esc(t('Hallo zusammen! (optional)'))}"></textarea></div>
        <button class="btn btn--primary btn--lg btn--block" type="submit">${icon('ph-cell-signal-high')}${t('Server-Chat erstellen')}</button>
        <p class="f__note">${icon('ph-info')} ${t('Die Einstellungen holt sich dein Server beim nächsten Abgleich mit der App (spätestens nach 30 Sekunden).')}</p>
      </form>`}`;
  }

  // ---------- Private Server (aus dem Spiel gemeldet) ----------
  const ps = { list: null, at: 0, busy: false };
  async function loadPservers(force = false) {
    if (ps.busy || (!force && ps.list && Date.now() - ps.at < 20000)) return;
    if (!apiReady()) { ps.list = { mine: [], visible: [] }; return; }
    ps.busy = true;
    try { ps.list = await api('/api/pservers'); } catch (e) { ps.list = ps.list || { mine: [], visible: [] }; } finally { ps.busy = false; ps.at = Date.now(); }
    if (state.page === 'server' && !state.serverId) { renderPservers(); renderServers(); }
    if (state.page === 'chat' && ['new-server', 'info'].includes(state.chatView)) renderChat();
  }
  function pserverCard(p, { inChat = null } = {}) {
    const status = p.online ? `<span class="status status--ok">${t('Online')} · ${p.players}/${p.max}</span>` : `<span class="status">${t('Offline')}</span>`;
    const why = p.join === 'roblox' ? t('Beitreten nur über Roblox') : p.access === 'members' && !p.member && !p.mine ? t('Nur für Mitglieder des Server-Chats') : t('Noch kein Link hinterlegt');
    const join = p.canJoin && p.link ? `<a class="btn btn--primary btn--sm" href="${esc(p.link)}" target="_blank" rel="noopener">${icon('phf-play')}${t('Beitreten')}</a>`
      : `<span class="ps-note">${icon(p.join === 'roblox' ? 'ph-lock' : 'ph-info')}${why}</span>`;
    const unlink = inChat && (p.mine || (inChat.me && inChat.me.role === 'owner'));
    return `<article class="ps-card">
      <div class="ps-card__head"><span class="ps-card__ic">${icon('ph-cell-signal-high')}</span>
        <span class="ps-card__name"><b>${esc(p.name)}</b><small>${t('Privater Server')}${p.ownerName ? ` · ${t('von {name}', { name: esc(p.ownerName) })}` : ''}${!p.online && p.lastSeen ? ` · ${t('zuletzt {when}', { when: fmtWhen(p.lastSeen) })}` : ''}</small></span>${status}</div>
      ${p.chat && !inChat ? `<a class="ps-card__chat" href="#/chat/${esc(p.chat.id)}">${icon('ph-chats-circle')}<span>${t('Server-Chat „{name}“', { name: esc(p.chat.name) })}</span>${icon('ph-caret-right')}</a>` : ''}
      <div class="ps-card__tags">${p.join === 'app' ? `<span class="pill pill--info">${icon('phf-play')}${t('Beitritt über die App')}</span>` : `<span class="pill">${icon('ph-lock')}${t('Beitritt über Roblox')}</span>`}${p.access === 'members' ? `<span class="pill">${icon('ph-users-three')}${t('Nur Mitglieder')}</span>` : ''}${p.relay ? `<span class="pill">${icon('ph-chats-circle')}${t('Chat im Spiel')}</span>` : ''}</div>
      <div class="ps-card__foot">${join}
        ${p.mine ? `<button class="btn btn--soft btn--sm" type="button" data-pserver-edit="${esc(p.id)}">${icon('ph-gear-six')}${t('Einstellungen')}</button>` : ''}
        ${unlink ? `<button class="btn btn--soft btn--sm" type="button" data-ps-unlink="${esc(p.id)}">${t('Trennen')}</button>` : ''}</div>
    </article>`;
  }
  // Private Server stehen als Karten in der Serverliste; hier nur der Hinweis, wenn es noch keinen gibt
  function renderPservers() {
    const box = $('[data-pservers]');
    if (!box) return;
    if (!apiReady()) { box.innerHTML = ''; return; }
    if (!ps.list) { loadPservers(); box.innerHTML = ''; return; }
    const any = ps.list.mine.length || ps.list.visible.length;
    box.innerHTML = !any && sessionToken() ? `<section class="ps-sec"><p class="ps-empty">${icon('ph-info')}<span>${t('Hast du einen privaten Server? Starte ihn einmal in Roblox – dann erscheint er hier und bleibt dauerhaft stehen. Du kannst ihn benennen, mit einem Server-Chat verbinden und festlegen, ob man über die App oder nur über Roblox beitritt.')}</span></p></section>` : '';
  }
  // Bearbeiten in Abschnitten: Vorschau oben, darunter Name, Beitritt, Zutritt, Sichtbarkeit, Chat und Spiel
  function pserverForm(id) {
    const p = ps.list && ps.list.mine.find((x) => x.id === id);
    if (!p) return `<p class="muted">${t('Diesen Server gibt es nicht oder er gehört dir nicht.')}</p>`;
    const chats = (chat.list ? chat.list.chats : []).filter((c) => c.kind === 'group' && c.admin);
    const opt = (v, cur, label) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${label}</option>`;
    const card = (name, value, cur, ic, title, text) => `<label class="pe-opt"><input type="radio" name="${name}" value="${value}"${value === cur ? ' checked' : ''}><span>${icon(ic)}<b>${title}</b><small>${text}</small></span></label>`;
    const seg = (value, label) => `<label class="pe-seg__item"><input type="radio" name="show" value="${value}"${(p.show || 'public') === value ? ' checked' : ''}><span>${label}</span></label>`;
    const sec = (no, title, text, inner) => `<section class="pe-sec"><header class="pe-sec__head"><span class="pe-sec__no">${no}</span><div><h3>${title}</h3>${text ? `<p>${text}</p>` : ''}</div></header>${inner}</section>`;
    return `<form class="pe-form" data-pserver-form="${esc(p.id)}" novalidate>
      <div class="pe-preview">
        <span class="pe-preview__ic">${icon('ph-lock')}</span>
        <div class="pe-preview__text"><b data-pe-name>${esc(p.name)}</b><small><span class="sv-card__live${p.online ? '' : ' is-off'}"><i></i>${psState(p)}</span></small></div>
        <button class="sv-card__id" type="button" data-copy="${esc(p.id)}" title="${esc(t('Server-ID kopieren'))}">#${esc(shortId(p.id))}${icon('ph-copy')}</button>
      </div>
      ${sec('01', t('Name'), t('So heißt der Server in der App und auf der Server-Seite.'), `<div class="f"><label class="sr-only" for="ps-name">${t('Name in der App')}</label><input id="ps-name" name="name" maxlength="50" value="${esc(p.name)}" data-pe-input></div>`)}
      ${sec('02', t('Beitritt'), t('Wie kommen Spieler auf deinen Server?'), `<div class="pe-opts">
          ${card('join', 'app', p.join === 'app' ? 'app' : 'roblox', 'phf-play', t('Über die App'), t('„Beitreten“ in der App mit deinem Link zum privaten Server'))}
          ${card('join', 'roblox', p.join === 'app' ? 'app' : 'roblox', 'ph-lock', t('Nur über Roblox'), t('Freunde und Einladungen direkt in Roblox'))}
        </div>
        <div class="pe-link" data-pe-link${p.join === 'app' ? '' : ' hidden'}>${linkField(p.link || '')}</div>`)}
      ${sec('03', t('Zutritt'), t('Wer darf auf den Server?'), `<div class="pe-opts">
          ${card('access', 'all', p.access === 'members' ? 'members' : 'all', 'ph-globe', t('Jeder mit Link'), t('Wie bei Roblox üblich'))}
          ${card('access', 'members', p.access === 'members' ? 'members' : 'all', 'ph-users-three', t('Nur Chat-Mitglieder'), t('Das Spiel weist andere ab'))}
        </div>`)}
      ${sec('04', t('Sichtbarkeit'), t('Wer sieht den Server in der App?'), `<div class="pe-seg" role="radiogroup" aria-label="${esc(t('Wer sieht den Server in der App?'))}">${seg('public', t('Alle'))}${seg('members', t('Mitglieder'))}${seg('owner', t('Nur ich'))}</div>`)}
      ${sec('05', t('Server-Chat'), t('Gruppen, in denen du Inhaber oder Admin bist. Sie werden damit zum Server-Chat.'), `<div class="f"><div class="select"><select name="chat" aria-label="${esc(t('Server-Chat'))}">${opt('', p.chat ? p.chat.id : '', t('Keiner'))}${chats.map((c) => opt(c.id, p.chat ? p.chat.id : '', esc(c.name))).join('')}</select>${icon('ph-caret-down')}</div></div>`)}
      ${sec('06', t('Im Spiel'), '', `<div class="f"><label class="f__label" for="ps-welcome">${t('Begrüßung im Spiel')}</label><textarea id="ps-welcome" name="welcome" rows="2" maxlength="300" placeholder="${esc(t('z. B. Willkommen auf unserem Server!'))}">${esc(p.welcome || '')}</textarea></div>
        <label class="toggle pe-toggle"><span class="toggle__text"><b>${t('Nachrichten aus dem Server-Chat im Spiel anzeigen')}</b><small>${t('Vorher von Roblox gefiltert.')}</small></span>
          <input type="checkbox" role="switch" name="relay"${p.relay ? ' checked' : ''}><span class="toggle__ui" aria-hidden="true"></span></label>`)}
      <p class="pe-note">${t('Der Server übernimmt die Einstellungen beim nächsten Abgleich (spätestens nach 30 Sekunden). Für Zutritt, Begrüßung und Chat im Spiel braucht das Spiel die Skripte TSGAppSync und TSGAppChat.')}</p>
      <div class="pe-save"><button class="site-btn site-btn--brand site-btn--block" type="submit">${icon('ph-check')}${t('Speichern')}</button></div>
    </form>`;
  }

  // Spieler zu einer ID oder einem Namen (für Direktnachrichten und Gruppen)
  const chatPlayers = {};
  async function loadPlayer(id, done) {
    if (chatPlayers[id]) return;
    chatPlayers[id] = 'loading';
    try { chatPlayers[id] = await api(`/api/players/find?q=${encodeURIComponent(id)}`); } catch (e) { chatPlayers[id] = 'missing'; }
    if (done) done();
    else if (state.page === 'chat' && state.chatView === 'direct') renderChat();
  }
  function chatDirect(userId) {
    const gate = chatGate();
    if (!chat.staff) loadStaff();
    let p = chat.staff && chat.staff.find((x) => x.userId === String(userId));
    if (!p && chatReady()) {
      if (!chatPlayers[userId]) loadPlayer(userId);
      if (typeof chatPlayers[userId] === 'object') p = chatPlayers[userId];
      else if (chatPlayers[userId] !== 'missing') return `${backTo('#/chat/neu/spieler', t('Zurück'))}${loadingHtml()}`;
    }
    return `${backTo('#/chat/neu/spieler', t('Zurück'))}
      ${!p ? `<p class="empty">${chat.staff ? t('Diesen Spieler gibt es nicht.') : t('Wird geladen …')}</p>` : `
      <div class="dm-card">${personImg(p, 'avatar--lg')}<span><b>${esc(p.displayName)}</b><small>@${esc(p.username)}</small>${p.rank ? rankPill(rankOf(p.rank)) : `<span class="pill pill--info">${t('Spieler')}</span>`}</span></div>
      ${gate || `<form class="cform" data-chat-direct="${esc(p.userId)}" novalidate>
        <div class="f"><label class="f__label" for="dm-text">${t('Nachricht an {name}', { name: esc(p.displayName) })}</label><textarea id="dm-text" name="text" rows="5" maxlength="2000"></textarea></div>
        <button class="btn btn--primary btn--lg btn--block" type="submit">${icon('ph-paper-plane-tilt')}${t('Senden')}</button>
        <p class="f__note">${icon('ph-lock')} ${t('Nur ihr beide seht die Nachrichten – zur Sicherheit kann die Moderation (ab Supervisor) mitlesen.')}</p>
      </form>`}`}`;
  }

  // ---------- Ein Gespräch ----------
  const SYS_TEXT = {
    claimed: (m) => t('{name} hat die Anfrage angenommen', { name: esc(m.name) }),
    closed: (m) => t('{name} hat das Gespräch beendet', { name: esc(m.name) }),
    created: (m) => t('{name} hat die Gruppe erstellt', { name: esc(m.name) }),
    joined: (m) => t('{name} ist beigetreten', { name: esc(m.name) }),
    left: (m) => t('{name} hat die Gruppe verlassen', { name: esc(m.name) }),
    added: (m) => t('{name} hat {target} hinzugefügt', { name: esc(m.name), target: esc(m.target) }),
    removed: (m) => t('{name} hat {target} entfernt', { name: esc(m.name), target: esc(m.target) }),
    mod: (m) => t('{name} ist als Moderation beigetreten', { name: esc(m.name) }),
    settings: (m) => t('{name} hat die Gruppe bearbeitet', { name: esc(m.name) }),
    role: (m) => t('{target} ist jetzt {role}', { target: esc(m.target), role: m.role === 'owner' ? t('Inhaber') : m.role === 'admin' ? t('Admin') : t('Mitglied') }),
    photo: (m) => t('{name} hat das Gruppenbild geändert', { name: esc(m.name) }),
    servers: (m) => t('{name} hat die verbundenen Server geändert', { name: esc(m.name) }),
    roles: (m) => t('{name} hat die Rollen geändert', { name: esc(m.name) }),
    discord: (m) => ({
      pending: t('{name} hat die Discord-Verbindung zur Prüfung eingereicht', { name: esc(m.name) }),
      accepted: t('Die Discord-Verbindung wurde angenommen'), denied: t('Die Discord-Verbindung wurde abgelehnt'),
      removed: t('{name} hat die Discord-Verbindung entfernt', { name: esc(m.name) }),
    }[m.target] || ''),
  };
  const ROLE_TAG = { owner: 'Inhaber', admin: 'Admin', mod: 'Moderation' };
  function peopleOf(c) {
    const out = {};
    [c.from, c.to, c.claimedBy].forEach((p) => { if (p) out[p.sub] = p; });
    (c.members || []).forEach((p) => { out[p.sub] = p; });
    return out;
  }
  const timeOf = (ms) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
  function filesHtml(m) {
    const files = m.files || [];
    const url = (f) => esc(API + f.url);
    const imgs = files.filter((f) => f.kind === 'image');
    const vids = files.filter((f) => f.kind === 'video');
    const docs = files.filter((f) => f.kind === 'file');
    return `${imgs.length ? `<div class="msg-media msg-media--${Math.min(imgs.length, 3)}">${imgs.map((f) => `<button class="msg-photo" type="button" data-photo="${url(f)}" aria-label="${esc(t('Foto öffnen'))}">
        <img src="${url(f)}" alt="${esc(f.name)}" loading="lazy"${f.w && f.h && imgs.length === 1 ? ` style="aspect-ratio:${f.w}/${f.h}"` : ''}></button>`).join('')}</div>` : ''}
      ${vids.map((f) => videoPlayer(`${API + f.url}#t=0.1`, { cls: 'vp--chat' })).join('')}
      ${docs.map((f) => `<a class="msg-file" href="${url(f)}" target="_blank" rel="noopener">${icon('ph-file')}<span><b>${esc(f.name)}</b><small>${sizeText(f.size)}</small></span>${icon('ph-download-simple')}</a>`).join('')}`;
  }
  // @Name hervorheben (eigener Name und @alle in Rot)
  function mentionHtml(text) {
    const mine = String((state.profile && state.profile.username) || '').toLowerCase();
    return esc(text).replace(/@([A-Za-z0-9_]{2,20})/g, (all, n) => `<span class="mention${[mine, 'alle', 'everyone'].includes(n.toLowerCase()) ? ' is-me' : ''}">@${n}</span>`);
  }
  function chatMessages(c) {
    const me = meSub();
    const people = peopleOf(c);
    const many = c.kind === 'group' || (c.members || []).length > 2;
    let lastDay = '';
    let lastBy = '';
    if (c.switching) return `<li class="msg-sys">${t('Wird geladen …')}</li>`;
    const all = c.messages;
    const botMeta = (id) => (c.bots || []).find((b) => b.id === id) || null;
    return all.map((m) => {
      const day = fmtDate(m.at);
      const sep = day !== lastDay ? `<li class="msg-day"><span>${day}</span></li>` : '';
      lastDay = day;
      if (m.by === 'system') {
        lastBy = '';
        return `${sep}<li class="msg-sys">${(SYS_TEXT[m.text] || (() => ''))(m)}</li>`;
      }
      const time = timeOf(m.at);
      // Eigener Bot des Chats (local = ClientScript, nur hier sichtbar)
      if (m.kind === 'bot' && m.botId) {
        const key = `bot:${m.botId}`;
        const first = key !== lastBy || sep;
        lastBy = key;
        const meta = botMeta(m.botId) || { id: m.botId, name: m.title };
        return `${sep}<li class="msg msg--bot${first ? ' is-first' : ''}">
          ${first ? botAvatar(c.id, meta, 'bot-ava--sm') : '<span class="msg__gap"></span>'}
          <div class="msg__col"><div class="msg__bubble">${first ? `<b class="msg__name">${esc(meta.name || m.title || 'Bot')} <span class="bot-tag">BOT</span></b>` : ''}<p>${mentionHtml(m.text || (m.embed ? [m.embed.title, m.embed.text].filter(Boolean).join(' – ') : ''))}</p><time>${time}</time></div></div>
        </li>`;
      }
      // Antwort vom TSG-Bot auf einen Befehl: eine normale Nachricht (ohne Karten)
      if (m.kind === 'bot') {
        const key = 'bot:tsg';
        const firstB = key !== lastBy || sep;
        lastBy = key;
        const lines = [m.text || '', ...(m.rows || []).map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join('\n');
        return `${sep}<li class="msg msg--bot msg--tsg${firstB ? ' is-first' : ''}${m.only ? ' is-local' : ''}">
          ${firstB ? `<span class="bot-ava bot-ava--sm bot-ava--tsg">${icon('ph-terminal-window')}</span>` : '<span class="msg__gap"></span>'}
          <div class="msg__col"><div class="msg__bubble">${firstB ? `<b class="msg__name">TSG-Bot <span class="bot-tag">BOT</span>${m.only ? `<small class="bot-only">${icon('ph-eye')}${t('Nur für dich')}</small>` : ''}</b>` : ''}
            ${m.title ? `<p><b>${esc(m.title)}</b></p>` : ''}${lines ? `<p>${esc(lines)}</p>` : ''}
            ${(m.buttons || []).length ? `<span class="msg__links">${botButtons(m)}</span>` : ''}<time>${time}</time></div></div>
        </li>`;
      }
      const mine = m.by === me;
      const p = people[m.by] || { username: m.name || '?', displayName: m.name || '?' };
      const first = m.by !== lastBy || sep;
      lastBy = m.by;
      const canDel = !m.deleted && (mine || c.canModerate);
      const body = m.deleted
        ? `<p class="msg__deleted">${icon('ph-prohibit')}${m.deletedBy ? t('Von der Moderation gelöscht') : t('Nachricht gelöscht')}</p>`
        : `${m.files ? filesHtml(m) : ''}${m.text ? `<p>${mentionHtml(m.text)}</p>` : ''}`;
      const tr = c.kind === 'group' ? topRole(c, p) : null;
      return `${sep}<li class="msg${mine ? ' msg--mine' : ''}${first ? ' is-first' : ''}${m.files && !m.text ? ' msg--media' : ''}">
        ${!mine ? (first ? personImg(p, 'avatar--sm') : '<span class="msg__gap"></span>') : ''}
        <div class="msg__col"><div class="msg__bubble"${canDel ? ` data-msg="${esc(m.id)}"` : ''}>${!mine && first && (many || p.rank) ? `<b class="msg__name"${tr ? ` style="--rc:${esc(tr.color)}"` : ''}>${esc(nameOfP(p))}${p.rank ? ` ${rankPill(rankOf(p.rank))}` : ''}${ROLE_TAG[p.role] ? `<span class="role-tag role-tag--${p.role}">${t(ROLE_TAG[p.role])}</span>` : ''}</b>` : ''}${body}<time>${time}</time></div>
        ${canDel ? `<div class="msg__acts"><button type="button" data-msg-del="${esc(m.id)}">${icon('ph-trash')}${mine ? t('Löschen') : t('Löschen (Moderation)')}</button></div>` : ''}</div>
      </li>`;
    }).join('');
  }
  function chatBackHref(c) {
    const me = meSub();
    if (c.me && c.me.observe) return '#/chat/moderation';
    if (c.kind === 'ticket' && chat.list && chat.list.areas.includes(c.area) && c.from.sub !== me && !(c.claimedBy && c.claimedBy.sub === me)) return '#/chat/anfragen';
    if (c.kind === 'group' && c.me && !c.me.role) return '#/chat/gruppen';
    return '#/chat';
  }
  // Kopf eines Gesprächs: zurück, Bild, Name mit Rang und Stand, Info – bleibt beim Scrollen oben
  function chatConvHead(c) {
    const area = c.kind === 'ticket' ? areaOf(c.area) : null;
    const other = chatOther(c);
    const [tone, stateText] = c.status === 'closed' ? ['done', t('Erledigt')]
      : c.kind === 'group' ? [c.settings && c.settings.visibility === 'public' ? 'ok' : 'lock', `${c.settings && c.settings.visibility === 'public' ? t('Öffentlich') : t('Privat')} · ${t('{n} Mitglieder', { n: (c.members || []).length })}${c.category === 'server' ? ` · ${(c.servers || []).filter((x) => x.online).length ? t('Server online') : (c.servers || []).length === 1 ? t('1 Server') : t('{n} Server', { n: (c.servers || []).length })}` : ''}`]
        : c.kind === 'direct' ? ['lock', t('Privat')]
          : c.status === 'open' ? ['warn', t('Wartet auf Annahme')] : ['ok', t('Angenommen von {name}', { name: esc(c.claimedBy ? c.claimedBy.username : '') })];
    const sub = [
      other && other.rank && c.kind !== 'group' ? rankPill(rankOf(other.rank)) : '',
      area ? `<span>${esc(t(area.label))}</span>` : '',
      `<span class="conv-state conv-state--${tone}">${tone === 'lock' ? icon('ph-lock') : '<i></i>'}${stateText}</span>`,
    ].filter(Boolean).join('');
    return `<div class="conv-bar">
        <a class="conv-bar__back" href="${chatBackHref(c)}" aria-label="${esc(t('Alle Gespräche'))}">${icon('ph-arrow-left')}</a>
        <a class="conv-bar__who" href="#/chat/${esc(c.id)}/info">
          ${c.kind === 'group' ? groupBadge(c, 'conv-bar__avatar') : other ? personImg(other, 'conv-bar__avatar') : `<span class="conv-bar__ic">${icon(area ? area.icon : 'ph-chats-circle')}</span>`}
          <span class="conv-bar__text"><h1>${esc(chatTitle(c))}</h1><p>${sub}</p></span>
        </a>
        ${c.canClose && c.kind === 'ticket' ? `<button class="conv-bar__close" type="button" data-chat-close="${esc(c.id)}">${icon('ph-check')}<span>${t('Beenden')}</span></button>` : ''}
        <a class="conv-bar__info" href="#/chat/${esc(c.id)}/info" aria-label="${esc(t('Info und Einstellungen'))}">${icon('ph-info')}</a>
      </div>`;
  }
  // Hinweis am Anfang: wer sieht das Gespräch, Regeln der Gruppe
  function chatIntro(c) {
    const me = meSub();
    const safety = `<small class="msg-intro__safe">${icon('ph-shield-check')}${t('Zur Sicherheit kann die Moderation (ab Supervisor) Gespräche einsehen.')}</small>`;
    if (c.kind === 'group') {
      return `<li class="msg-intro msg-intro--group">${groupBadge(c, 'group-badge--lg')}
        <b class="msg-intro__name">${esc(c.name)}</b>
        ${c.desc ? `<span class="msg-intro__desc">${esc(c.desc)}</span>` : ''}
        ${c.rules ? `<span class="msg-rules"><b>${icon('ph-scroll')}${t('Regeln')}</b><span>${esc(c.rules)}</span></span>` : ''}
        ${c.commands && c.commands.length ? `<small class="msg-intro__cmd">${icon('ph-terminal-window')}${t('Tipp: Schreib / für Befehle, z. B. /GetGroupData')}</small>` : ''}
        ${safety}</li>`;
    }
    if (c.kind === 'direct') {
      const other = chatOther(c);
      return `<li class="msg-intro">${icon('ph-lock')}<span>${t('Privates Gespräch mit {name}. Nur ihr beide seht diese Nachrichten.', { name: `<b>${esc(nameOfP(other))}</b>` })}${safety}</span></li>`;
    }
    const area = areaOf(c.area);
    return `<li class="msg-intro">${icon(area ? area.icon : 'ph-chats-circle')}<span><b>${esc(t(reasonOf(c.reason).label))}</b>${area ? ` · ${esc(t(area.label))}` : ''}<br>${c.from.sub === me
      ? t('Alle aus dem Team dieses Bereichs sehen deine Anfrage. Wer sie annimmt, antwortet dir hier – du siehst, wer es ist.')
      : t('Anfrage von {name}', { name: `<b>${esc(nameOfP(c.from))}</b>` })}
      ${c.ref && c.from.sub !== me ? `<a class="btn btn--soft btn--sm msg-intro__ref" href="#/chat/${esc(c.ref)}">${icon('ph-eye')}${t('Gemeldetes Gespräch ansehen')}</a>` : ''}</span></li>`;
  }
  function trayHtml(id) {
    return (chat.pending[id] || []).map((p) => `<div class="tray-item" data-tray="${p.key}">
        ${p.kind === 'image' ? `<img src="${p.preview}" alt="">` : `<span class="tray-item__ic">${icon(p.kind === 'video' ? 'ph-video-camera' : 'ph-file')}</span>`}
        <span class="tray-item__name">${esc(p.name)}<small>${sizeText(p.size)}</small></span>
        <i class="tray-item__bar"><span style="width:${Math.round(p.progress * 100)}%"></span></i>
        ${chat.sending ? '' : `<button type="button" class="tray-item__x" data-tray-del="${p.key}" aria-label="${esc(t('Entfernen'))}">${icon('ph-x')}</button>`}
      </div>`).join('');
  }
  function renderTray(id) {
    const box = $('[data-chat-tray]');
    if (box) box.innerHTML = trayHtml(id);
    const form = $('form[data-chat-send]');
    if (form) form.classList.toggle('has-files', !!(chat.pending[id] || []).length);
  }
  function chatComposer(c) {
    if (c.me && c.me.observe) {
      return `<div class="compose compose--note compose--mod">${icon('ph-eye-slash')}<span>${t('Du beobachtest dieses Gespräch unsichtbar (Moderation).')}</span>
        ${c.canJoinMod ? `<button class="btn btn--soft btn--sm" type="button" data-chat-joinmod="${esc(c.id)}">${t('Sichtbar beitreten')}</button>` : ''}</div>`;
    }
    if (c.canJoin) {
      return `<div class="compose compose--claim"><p>${t('Öffentliche Gruppe – du liest gerade mit.')}</p>
        <button class="btn btn--primary btn--lg btn--block" type="button" data-chat-join="${esc(c.id)}">${icon('ph-user-plus')}${t('Gruppe beitreten')}</button></div>`;
    }
    if (c.canClaim) {
      return `<div class="compose compose--claim"><p>${t('Diese Anfrage wartet auf jemanden aus deinem Bereich.')}</p>
        <button class="btn btn--primary btn--lg btn--block" type="button" data-chat-claim="${esc(c.id)}">${icon('ph-hand-waving')}${t('Anfrage annehmen')}</button></div>`;
    }
    if (c.status === 'closed') return `<p class="compose compose--note">${icon('ph-check-circle')}${t('Dieses Gespräch ist beendet. Für etwas Neues starte eine neue Anfrage.')}</p>`;
    if (!c.canWrite) {
      const ch = c.community ? (c.channels || []).find((x) => x.id === c.channel) : null;
      if (ch && ch.locked && c.me && c.me.role) return `<p class="compose compose--note">${icon('ph-megaphone')}${t('In #{name} schreiben nur Inhaber, Admins und Rollen mit dem Recht „Schreiben“.', { name: esc(ch.name) })}</p>`;
      if (c.kind === 'group' && c.me && c.me.role) return `<p class="compose compose--note">${icon('ph-megaphone')}${t('In dieser Gruppe schreiben nur Inhaber und Admins.')}</p>`;
      return `<p class="compose compose--note">${icon('ph-lock')}${t('Angenommen von {name}. Schreiben können nur die beiden.', { name: esc(c.claimedBy ? c.claimedBy.username : '') })}</p>`;
    }
    const files = (chat.pending[c.id] || []).length;
    return `<form class="compose${files ? ' has-files' : ''}" data-chat-send="${esc(c.id)}">
      <div class="compose__tray" data-chat-tray>${trayHtml(c.id)}</div>
      <div class="compose__cmds" data-chat-cmds hidden></div>
      <div class="compose__row">
        ${c.canMedia ? `<label class="compose__attach" title="${esc(t('Foto, Video oder Datei anhängen'))}"><span class="sr-only">${t('Foto, Video oder Datei anhängen')}</span>${icon('ph-paperclip')}
          <input type="file" data-chat-file multiple accept="image/*,video/*,application/pdf"></label>` : ''}
        <label class="sr-only" for="msg-text">${t('Nachricht')}</label>
        <textarea id="msg-text" name="text" rows="1" maxlength="2000" placeholder="${esc(c.community ? t('Nachricht an #{name}', { name: chLabel(((c.channels || []).find((x) => x.id === c.channel) || {}).name || '') }) : c.commands && c.commands.length ? t('Nachricht oder / für Befehle …') : t('Nachricht schreiben …'))}"></textarea>
        <button class="compose__send" type="submit" aria-label="${esc(t('Senden'))}">${icon('ph-paper-plane-tilt')}</button>
      </div>
    </form>`;
  }
  function chatConv(id) {
    const c = chat.conv[id];
    if (!c) {
      openConv(id, { observe: true });
      return { head: backTo('#/chat', t('Alle Gespräche')), body: loadingHtml() };
    }
    if (c.error) return { head: backTo('#/chat', t('Alle Gespräche')), body: `<p class="empty">${t('Dieses Gespräch gibt es nicht (mehr) oder du darfst es nicht sehen.')}</p>` };
    markSeen(c);
    if (c.community) {
      markChSeen(c);
      if (!chat.list || Date.now() - chat.at > 10000) loadChats();
      if (chat.sideAuto === c.id) { chat.sideAuto = null; if (window.innerWidth < 900) chat.side = true; }
      return {
        head: cmHead(c),
        body: `<div class="cm${chat.side ? ' is-open' : ''}" data-cm>${cmSide(c)}<button class="cm-scrim" type="button" data-cm-side-close aria-label="${esc(t('Kanäle schließen'))}"></button>
          <div class="cm-main"><ol class="msgs" data-chat-msgs>${cmIntro(c)}${chatMessages(c)}</ol><div class="compose-dock" data-chat-compose>${chatComposer(c)}</div></div></div>`,
      };
    }
    return {
      head: chatConvHead(c),
      body: `<ol class="msgs" data-chat-msgs>${chatIntro(c)}${chatMessages(c)}</ol><div class="compose-dock" data-chat-compose>${chatComposer(c)}</div>`,
    };
  }
  async function openConv(id, { since = 0, observe = false } = {}) {
    if (!chatReady()) { chat.conv[id] = { error: true }; renderChat(); return; }
    try {
      const q = new URLSearchParams();
      if (chat.conv[id] && chat.conv[id].switching) since = 0;
      if (since) q.set('since', since); else if (observe) q.set('observe', '1');
      if (chat.ch[id]) q.set('ch', chat.ch[id]);
      const r = await api(`/api/chats/${encodeURIComponent(id)}${q.toString() ? `?${q}` : ''}`);
      // Inzwischen anderer Kanal gewählt: diese Antwort gehört nicht mehr dazu
      if (r.community && chat.ch[id] && r.channel !== chat.ch[id] && (r.channels || []).some((x) => x.id === chat.ch[id])) { if (!r.unchanged) openConv(id); return; }
      if (r.unchanged) {
        const c = chat.conv[id];
        const flags = ['status', 'claimedBy', 'canWrite', 'canClaim', 'canClose'];
        if (c && flags.some((k) => JSON.stringify(c[k]) !== JSON.stringify(r[k]))) { flags.forEach((k) => { c[k] = r[k]; }); updateConv(id); }
        return;
      }
      chat.conv[id] = r;
      if (r.community) chat.ch[id] = r.channel;
    } catch (e) {
      chat.conv[id] = { error: true };
    }
    if (state.chatView === 'info' && state.chatArg === id) renderChat();
    else updateConv(id);
  }
  // Nur Nachrichten und Kopf neu zeichnen – was im Eingabefeld steht, bleibt
  function updateConv(id) {
    if (state.page !== 'chat' || state.chatView !== 'conv' || state.chatArg !== id) return;
    const list = $('[data-chat-msgs]');
    const c = chat.conv[id];
    if (!list || !c || c.error) {
      // Erstes Laden: gleich bei der neuesten Nachricht anfangen
      renderChat();
      if (!list && c && !c.error) window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
      return;
    }
    const atEnd = window.innerHeight + window.scrollY >= document.body.scrollHeight - 80;
    if (c.community) {
      const side = $('[data-cm-side]');
      if (!side) { renderChat(); return; }
      $('[data-chat-head]').innerHTML = cmHead(c);
      side.outerHTML = cmSide(c);
      list.innerHTML = cmIntro(c) + chatMessages(c);
      markChSeen(c);
    } else {
      $('[data-chat-head]').innerHTML = chatConvHead(c);
      list.innerHTML = chatIntro(c) + chatMessages(c);
    }
    const box = $('[data-chat-compose]');
    const wasForm = !!$('form', box);
    if (!wasForm || !c.canWrite) box.innerHTML = chatComposer(c);
    markSeen(c);
    if (atEnd) window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
  }
  function chatPoll() {
    clearInterval(chat.timer);
    chat.timer = null;
    if (state.page !== 'chat' || !chatReady()) return;
    chat.timer = setInterval(() => {
      if (document.visibilityState !== 'visible' || state.page !== 'chat') return;
      if (state.chatView === 'conv') { const c = chat.conv[state.chatArg]; if (c && !c.error) openConv(state.chatArg, { since: c.updated }); }
      else if (['mine', 'queue'].includes(state.chatView)) loadChats(true);
      else if (state.chatView === 'mod') loadMod(true);
    }, state.chatView === 'conv' ? 4000 : 15000);
  }

  // ---------- Server (Communities): Kanäle und Kategorien wie bei Discord ----------
  // Links die Kanalliste (auf dem Handy als Schublade), rechts der offene Kanal. Ungelesen merkt sich jedes Gerät selbst.
  const membersText = (n) => (n === 1 ? t('1 Mitglied') : t('{n} Mitglieder', { n }));
  // „📄-·-hub“ → „📄 · hub“
  const chLabel = (name) => String(name || '').replace(/-·-/g, ' · ');
  const chFind = (c, id = c.channel) => (c.channels || []).find((x) => x.id === id) || null;
  const chIcon = (x, cls = 'cm-ch__ic') => icon(x && x.kind === 'news' ? 'ph-megaphone' : 'ph-hash', cls);
  function chSeenOf(c) {
    const all = store.get('tsg-ch-seen', {}) || {};
    // Erster Besuch: alles bisher Geschriebene gilt als gelesen
    if (!all[c.id]) {
      all[c.id] = Object.fromEntries((c.channels || []).map((x) => [x.id, x.last ? x.last.at : 0]));
      store.set('tsg-ch-seen', all);
    }
    return all[c.id];
  }
  function markChSeen(c) {
    const ch = chFind(c);
    if (!ch || c.switching) return;
    const all = store.get('tsg-ch-seen', {}) || {};
    const mine = all[c.id] || chSeenOf(c);
    const at = Math.max(ch.last ? ch.last.at : 0, ...c.messages.map((m) => m.at || 0));
    if ((mine[ch.id] || 0) >= at) return;
    all[c.id] = { ...mine, [ch.id]: at };
    store.set('tsg-ch-seen', all);
  }
  const chUnread = (c, x, seenMap) => !!(x.id !== c.channel && x.last && x.last.by !== meSub() && x.last.at > (seenMap[x.id] || 0));
  const cmShut = (id) => ((store.get('tsg-cm-cats', {}) || {})[id] || []);
  function cmSide(c) {
    const seenMap = chSeenOf(c);
    const shutCats = chat.cmq ? [] : cmShut(c.id);
    const cats = c.categories || [];
    const q = (chat.cmq || '').trim().toLowerCase();
    const match = (x) => !q || chLabel(x.name).toLowerCase().includes(q);
    const row = (x) => (match(x) ? `<div class="cm-ch-row">
        <button type="button" class="cm-ch${x.id === c.channel ? ' is-active' : ''}${chUnread(c, x, seenMap) ? ' is-unread' : ''}" data-cm-ch="${esc(x.id)}"${x.id === c.channel ? ' aria-current="true"' : ''}>
          ${chIcon(x)}<span class="cm-ch__name">${esc(chLabel(x.name))}</span></button>
        ${c.canManage ? `<button type="button" class="cm-ch__edit" data-cm-edit="${esc(x.id)}" aria-label="${esc(t('Kanal bearbeiten'))}">${icon('ph-gear-six')}</button>` : ''}
      </div>` : '');
    const loose = (c.channels || []).filter((x) => !x.cat || !cats.some((k) => k.id === x.cat));
    const groups = cats.map((k) => {
      const list = (c.channels || []).filter((x) => x.cat === k.id);
      if (q && !list.some(match)) return '';
      const shut = shutCats.includes(k.id);
      const unread = shut && list.some((x) => chUnread(c, x, seenMap));
      return `<div class="cm-cat${shut ? ' is-shut' : ''}">
        <div class="cm-cat__head">
          <button type="button" class="cm-cat__toggle" data-cm-cat="${esc(k.id)}" aria-expanded="${!shut}"><span>${esc(k.name)}</span>${icon('ph-caret-down', 'cm-cat__chev')}${unread ? '<i class="cm-dot" aria-hidden="true"></i>' : ''}</button>
          ${c.canManage ? `<button type="button" class="cm-cat__add" data-cm-new="${esc(k.id)}" aria-label="${esc(t('Kanal in {name} erstellen', { name: k.name }))}">${icon('ph-plus')}</button>` : ''}
        </div>
        ${(shut ? list.filter((x) => x.id === c.channel) : list).map(row).join('')}
      </div>`;
    }).join('');
    // Leiste ganz links: alle eigenen Gruppen-Chats und Server
    const rail = (chat.list ? chat.list.chats : []).filter((x) => x.kind === 'group').sort((a, b) => (b.category === 'server') - (a.category === 'server') || b.updated - a.updated);
    const p = state.profile;
    const unreadAll = chat.list ? chat.list.chats.filter(isUnread).length : 0;
    return `<aside class="cm-side" data-cm-side aria-label="${esc(t('Kanäle'))}">
      <nav class="cm-rail" aria-label="${esc(t('Server'))}">
        <a class="cm-rail__dm" href="#/chat" aria-label="${esc(t('Alle Gespräche'))}">${icon('phf-chats-circle')}</a><i class="cm-rail__sep"></i>
        ${rail.map((x) => `<a class="cm-rail__srv${x.id === c.id ? ' is-active' : ''}" href="#/chat/${esc(x.id)}" title="${esc(x.name)}">${groupBadge(x, 'cm-rail__img')}${isUnread(x) && x.id !== c.id ? '<i class="cm-rail__dot"></i>' : ''}</a>`).join('')}
        <a class="cm-rail__add" href="#/chat/neu/server" aria-label="${esc(t('Server erstellen'))}">${icon('ph-plus')}</a>
      </nav>
      <div class="cm-panel">
        <div class="cm-panel__head">
          <a class="cm-panel__name" href="#/chat/${esc(c.id)}/info"><b>${esc(c.name)}</b>${c.canManage ? icon('phf-gear-six', 'cm-panel__gear') : ''}${icon('ph-caret-right', 'cm-panel__chev')}</a>
          <small>${membersText((c.members || []).length)} • ${t('Community')}</small>
        </div>
        <div class="cm-tools">
          <label class="cm-search">${icon('ph-magnifying-glass')}<input type="search" data-cm-q value="${esc(chat.cmq || '')}" placeholder="${esc(t('Suche'))}" autocomplete="off"></label>
          ${c.me && c.me.role ? `<button class="cm-tool" type="button" data-cm-invite-id="${esc(c.id)}" aria-label="${esc(t('Leute einladen'))}">${icon('ph-user-plus')}</button>` : ''}
          <a class="cm-tool" href="#/trainings" aria-label="${esc(t('Events'))}">${icon('phf-calendar-blank')}</a>
        </div>
        <div class="cm-links">
          <button type="button" data-cm-browse>${icon('ph-list-checks')}<span>${t('Kanäle durchstöbern')}</span></button>
          <a href="#/chat/${esc(c.id)}/info">${icon('ph-sliders-horizontal')}<span>${c.canManage ? t('Server-Einstellungen') : t('Server-Info')}</span></a>
        </div>
        <nav class="cm-side__list">${loose.map(row).join('')}${groups}${c.canManage ? `<div class="cm-side__foot"><button type="button" class="cm-side__btn" data-cm-new="">${icon('ph-plus')}${t('Kanal')}</button><button type="button" class="cm-side__btn" data-cm-cat-new>${icon('ph-folder')}${t('Kategorie')}</button></div>` : ''}</nav>
        <div class="cm-user">
          <button class="cm-user__me" type="button" data-open="profile" aria-label="${esc(t('Profil'))}">${p && p.avatar ? `<img src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer">` : `<b>${esc(initials(p ? p.username : 'G'))}</b>`}<i class="cm-user__dot"></i></button>
          <button class="cm-user__text" type="button" data-open="profile"><span><b>${esc(p ? p.displayName || p.username : t('Gast'))}</b><span class="cm-user__tag">${icon('phf-heart')}${esc(rankOf(state.rank).prefix)}</span></span><small>@${esc(p ? p.username : '')}</small></button>
          <a class="cm-user__bell" href="#/chat" aria-label="${esc(t('Benachrichtigungen'))}">${icon('phf-bell')}${unreadAll ? `<i>${unreadAll > 9 ? '9+' : unreadAll}</i>` : ''}</a>
        </div>
      </div>
    </aside>`;
  }
  function cmHead(c) {
    const ch = chFind(c) || {};
    const seenMap = chSeenOf(c);
    const unread = (c.channels || []).some((x) => chUnread(c, x, seenMap));
    return `<div class="conv-bar conv-bar--cm">
        <a class="conv-bar__back" href="${chatBackHref(c)}" aria-label="${esc(t('Alle Gespräche'))}">${icon('ph-arrow-left')}</a>
        <button class="cm-toggle${unread ? ' has-unread' : ''}" type="button" data-cm-side-open aria-label="${esc(t('Kanäle'))}">${icon('ph-list')}</button>
        <a class="conv-bar__who" href="#/chat/${esc(c.id)}/info">
          ${groupBadge(c, 'conv-bar__avatar cm-head__badge')}
          <span class="conv-bar__text"><h1 class="cm-head__ch">${chIcon(ch, 'cm-head__ic')}<span>${esc(chLabel(ch.name))}</span></h1><p><span>${esc(c.name)}</span>${ch.topic ? `<span class="cm-head__topic">${esc(ch.topic)}</span>` : ''}</p></span>
        </a>
        <a class="conv-bar__info" href="#/chat/${esc(c.id)}/info" aria-label="${esc(t('Info und Einstellungen'))}">${icon('ph-info')}</a>
      </div>`;
  }
  // Anfang eines Kanals (wie bei Discord); im Standardkanal dazu Beschreibung und Regeln des Servers
  function cmIntro(c) {
    const ch = chFind(c) || {};
    return `<li class="cm-intro"><span class="cm-intro__ic">${chIcon(ch, '')}</span>
        <b>${t('Willkommen in #{name}!', { name: esc(chLabel(ch.name)) })}</b>
        <span>${ch.topic ? esc(ch.topic) : ch.id === c.home ? t('Das ist der Anfang von {name}. Hier landen auch Begrüßungen und Hinweise.', { name: `<b>${esc(c.name)}</b>` }) : t('Das ist der Anfang des Kanals #{name}.', { name: esc(chLabel(ch.name)) })}</span>
        ${ch.kind === 'news' ? `<small>${icon('ph-megaphone')}${t('Ankündigungen: schreiben dürfen Inhaber, Admins und Rollen mit dem Recht „Schreiben“.')}</small>` : ''}
      </li>${ch.id === c.home ? chatIntro(c) : ''}`;
  }
  function switchChannel(id, ch) {
    const c = chat.conv[id];
    if (!c || c.error) return;
    chat.ch[id] = ch;
    store.set('tsg-ch', chat.ch);
    chat.side = false;
    history.replaceState(null, '', `#/chat/${id}?k=${encodeURIComponent(ch)}`);
    if (c.channel === ch && !c.switching) { const box = $('[data-cm]'); if (box) box.classList.remove('is-open'); return; }
    haptic('light');
    Object.assign(c, { channel: ch, messages: [], switching: true });
    c.canWrite = !(chFind(c) || {}).locked && c.canWrite;
    renderChat();
    openConv(id);
  }
  function toggleCategory(id, cat) {
    const all = store.get('tsg-cm-cats', {}) || {};
    const list = all[id] || [];
    all[id] = list.includes(cat) ? list.filter((x) => x !== cat) : [...list, cat];
    store.set('tsg-cm-cats', all);
    const c = chat.conv[id];
    const side = $('[data-cm-side]');
    if (c && side) side.outerHTML = cmSide(c);
  }
  // Kanäle und Kategorien bearbeiten: immer die ganze Liste an das Backend
  const layoutBody = (c) => ({
    home: c.home,
    categories: (c.categories || []).map(({ id, name }) => ({ id, name })),
    channels: (c.channels || []).map(({ id, name, cat, kind, topic }) => ({ id, name, cat, kind, topic })),
  });
  async function saveLayout(id, body, okText) {
    try {
      const r = await api(`/api/chats/${encodeURIComponent(id)}/channels`, { method: 'PUT', body });
      chat.conv[id] = r;
      if (r.community) chat.ch[id] = r.channel;
      haptic('success');
      if (okText) toast(okText);
      closeModal();
      chat.at = 0;
      if (state.page === 'chat') renderChat();
      return r;
    } catch (e) { toast(chatError(e)); return null; }
  }
  const chName = (v) => [...String(v || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_\-·\p{Extended_Pictographic}\u200d\ufe0f]/gu, '').replace(/-{3,}/g, '--').replace(/^-+|-+$/g, '')].slice(0, 32).join('');
  function channelView(arg) {
    const [cid, chId, catId] = String(arg).split(':');
    const c = chat.conv[cid];
    if (!c || !c.community) return loadingHtml();
    const ch = chId && chId !== 'neu' ? chFind(c, chId) : null;
    const cat = ch ? ch.cat || '' : catId || '';
    const kind = ch ? ch.kind : 'text';
    return `<form class="cform ch-form" data-ch-form="${esc(cid)}:${esc(ch ? ch.id : 'neu')}" novalidate>
      <div class="f"><label class="f__label" for="ch-name">${t('Name des Kanals')}</label>
        <div class="ch-name">${icon(kind === 'news' ? 'ph-megaphone' : 'ph-hash')}<input id="ch-name" name="name" maxlength="30" value="${esc(ch ? ch.name : '')}" placeholder="${esc(t('neuer-kanal'))}" autocomplete="off" autocapitalize="off" spellcheck="false" data-ch-name></div>
        <small class="f__hint">${t('Kleinbuchstaben, Zahlen und Bindestriche – Leerzeichen werden zu „-“.')}</small></div>
      <fieldset class="f"><legend class="f__label">${t('Art')}</legend><div class="vis-grid">
        <label class="vis"><input type="radio" name="kind" value="text"${kind !== 'news' ? ' checked' : ''}><span>${icon('ph-hash')}<b>${t('Text')}</b><small>${t('Alle Mitglieder schreiben')}</small></span></label>
        <label class="vis"><input type="radio" name="kind" value="news"${kind === 'news' ? ' checked' : ''}><span>${icon('ph-megaphone')}<b>${t('Ankündigungen')}</b><small>${t('Nur Inhaber, Admins und Rollen mit „Schreiben“')}</small></span></label>
      </div></fieldset>
      <label class="f"><span class="f__label">${t('Kategorie')}</span><select name="cat"><option value="">${t('Ohne Kategorie')}</option>${(c.categories || []).map((k) => `<option value="${esc(k.id)}"${k.id === cat ? ' selected' : ''}>${esc(k.name)}</option>`).join('')}</select></label>
      <div class="f"><label class="f__label" for="ch-topic">${t('Thema')}</label><input id="ch-topic" name="topic" maxlength="200" value="${esc(ch ? ch.topic || '' : '')}" placeholder="${esc(t('Worum geht es hier? (optional)'))}"></div>
      ${ch ? `<label class="toggle"><span class="toggle__text"><b>${t('Standardkanal')}</b><small>${t('Begrüßungen, Hinweise und Weitergabe ins Spiel und nach Discord')}</small></span>
        <input type="checkbox" role="switch" name="home"${c.home === ch.id ? ' checked disabled' : ''}><span class="toggle__ui" aria-hidden="true"></span></label>
      <div class="ch-move"><button class="btn btn--soft btn--sm" type="button" data-ch-move="-1">${icon('ph-arrow-up')}${t('Nach oben')}</button><button class="btn btn--soft btn--sm" type="button" data-ch-move="1">${icon('ph-arrow-down')}${t('Nach unten')}</button></div>` : ''}
      <button class="btn btn--primary btn--lg btn--block" type="submit">${icon(ch ? 'ph-check' : 'ph-plus')}${ch ? t('Speichern') : t('Kanal erstellen')}</button>
      ${ch && (c.channels || []).length > 1 ? `<button class="btn btn--danger btn--block" type="button" data-ch-del>${icon('ph-trash')}${t('Kanal löschen')}</button>
        <p class="f__note">${t('Beim Löschen verschwinden auch alle Nachrichten in diesem Kanal.')}</p>` : ''}
    </form>`;
  }
  function categoryView(arg) {
    const [cid, catId] = String(arg).split(':');
    const c = chat.conv[cid];
    if (!c || !c.community) return loadingHtml();
    const k = catId && catId !== 'neu' ? (c.categories || []).find((x) => x.id === catId) : null;
    return `<form class="cform" data-cat-form="${esc(cid)}:${esc(k ? k.id : 'neu')}" novalidate>
      <div class="f"><label class="f__label" for="cat-name">${t('Name der Kategorie')}</label><input id="cat-name" name="name" maxlength="30" value="${esc(k ? k.name : '')}" placeholder="${esc(t('z. B. Spiel'))}"></div>
      ${k ? `<div class="ch-move"><button class="btn btn--soft btn--sm" type="button" data-cat-move="-1">${icon('ph-arrow-up')}${t('Nach oben')}</button><button class="btn btn--soft btn--sm" type="button" data-cat-move="1">${icon('ph-arrow-down')}${t('Nach unten')}</button></div>` : ''}
      <button class="btn btn--primary btn--lg btn--block" type="submit">${icon(k ? 'ph-check' : 'ph-plus')}${k ? t('Speichern') : t('Kategorie erstellen')}</button>
      ${k ? `<button class="btn btn--danger btn--block" type="button" data-cat-del>${icon('ph-trash')}${t('Kategorie löschen')}</button><p class="f__note">${t('Die Kanäle darin bleiben erhalten (ohne Kategorie).')}</p>` : ''}
    </form>`;
  }
  // Übersicht in „Info“: alle Kanäle nach Kategorie, zum Bearbeiten antippen
  function channelsSection(c) {
    if (c.kind !== 'group') return '';
    if (!c.community) {
      return c.canManage ? `<section class="info-sec"><h3>${icon('ph-hash')}${t('Kanäle wie bei Discord')}</h3>
        <p class="muted">${t('Mach diese Gruppe zu einem Server mit Kanälen und Kategorien – die bisherigen Nachrichten landen in #allgemein.')}</p>
        <button class="btn btn--soft btn--block" type="button" data-cm-convert="${esc(c.id)}">${icon('ph-plus-square')}${t('In einen Server umwandeln')}</button></section>` : '';
    }
    const cats = c.categories || [];
    const line = (x) => `<li><button type="button" class="ch-line" ${c.canManage ? `data-cm-edit="${esc(x.id)}"` : `data-cm-go="${esc(x.id)}"`}>${chIcon(x, 'ch-line__ic')}<span><b>${esc(x.name)}</b>${x.topic ? `<small>${esc(x.topic)}</small>` : ''}</span>
      ${x.id === c.home ? `<span class="pill">${t('Standard')}</span>` : ''}${x.kind === 'news' ? `<span class="pill pill--info">${t('Ankündigungen')}</span>` : ''}${c.canManage ? icon('ph-caret-right', 'ch-line__chev') : ''}</button></li>`;
    const loose = (c.channels || []).filter((x) => !x.cat || !cats.some((k) => k.id === x.cat));
    return `<section class="info-sec"><h3>${icon('ph-hash')}${t('Kanäle')}</h3>
      ${loose.length ? `<ul class="ch-lines">${loose.map(line).join('')}</ul>` : ''}
      ${cats.map((k) => `<div class="ch-group"><div class="ch-group__head"><b>${esc(k.name)}</b>${c.canManage ? `<button type="button" class="link-btn" data-cm-cat-edit="${esc(k.id)}">${icon('ph-pencil-simple')}${t('Bearbeiten')}</button>` : ''}</div>
        <ul class="ch-lines">${(c.channels || []).filter((x) => x.cat === k.id).map(line).join('') || `<li class="muted ch-lines__empty">${t('Noch keine Kanäle')}</li>`}</ul></div>`).join('')}
      ${c.canManage ? `<div class="ch-actions"><button class="btn btn--primary btn--sm" type="button" data-cm-new="">${icon('ph-plus')}${t('Kanal erstellen')}</button><button class="btn btn--soft btn--sm" type="button" data-cm-cat-new>${icon('ph-folder')}${t('Kategorie erstellen')}</button></div>` : ''}
    </section>`;
  }

  // ---------- Info und Einstellungen eines Gesprächs ----------
  function memberRow(c, p) {
    const me = meSub();
    const myRole = c.me && c.me.role;
    const boss = myRole === 'owner' || myRole === 'mod' || (c.me && c.me.observe && c.canModerate);
    const acts = [];
    if (c.kind === 'group' && c.canManage && (c.roles || []).length) acts.push(`<button type="button" data-mem-roles="${esc(p.sub)}">${icon('ph-identification-badge')}${t('Rollen')}</button>`);
    if (c.kind === 'group' && p.sub !== me) {
      if (boss && p.role === 'member') acts.push(`<button type="button" data-mem-role="admin" data-mem="${esc(p.sub)}">${icon('ph-crown')}${t('Admin machen')}</button>`);
      if (boss && p.role === 'admin') acts.push(`<button type="button" data-mem-role="member" data-mem="${esc(p.sub)}">${t('Kein Admin mehr')}</button>`);
      if (myRole === 'owner' && p.role !== 'mod') acts.push(`<button type="button" data-mem-role="owner" data-mem="${esc(p.sub)}">${t('Zum Inhaber machen')}</button>`);
      if ((boss && p.role !== 'owner') || c.canModerate && !myRole || (myRole === 'admin' && p.role === 'member')) acts.push(`<button class="is-danger" type="button" data-mem-del="${esc(p.sub)}">${icon('ph-user-minus')}${t('Entfernen')}</button>`);
    }
    return `<li class="mem-row">
      ${personImg(p)}
      <span class="mem-row__main"><b>${esc(nameOfP(p))}${p.sub === me ? ` <small>(${t('Du')})</small>` : ''}</b><small>@${esc(p.username)}</small></span>
      <span class="mem-row__tags">${p.rank ? rankPill(rankOf(p.rank)) : ''}${ROLE_TAG[p.role] ? `<span class="role-tag role-tag--${p.role}">${t(ROLE_TAG[p.role])}</span>` : ''}${(c.roles || []).filter((r) => (p.roles || []).includes(r.id)).map(roleChip).join('')}</span>
      ${acts.length ? `<span class="mem-row__acts">${acts.join('')}</span>` : ''}
    </li>`;
  }
  function chatInfo(id) {
    const c = chat.conv[id];
    if (!c) { openConv(id, { observe: true }); return loadingHtml(); }
    if (c.error) return `${backTo('#/chat', t('Alle Gespräche'))}<p class="empty">${t('Dieses Gespräch gibt es nicht (mehr) oder du darfst es nicht sehen.')}</p>`;
    const st = c.settings || GROUP_DEFAULTS;
    const other = chatOther(c);
    const role = c.me && c.me.role;
    const yesNo = (v) => (v ? t('Ja') : t('Nein'));
    const label = { invite: { owner: t('Nur der Inhaber'), admins: t('Inhaber und Admins'), all: t('Alle Mitglieder') }, write: { all: t('Alle Mitglieder'), admins: t('Nur Inhaber und Admins') }, cmd: { all: t('Für alle'), admins: t('Nur Inhaber und Admins'), off: t('Aus') } };
    const head = `<div class="info-head">
        ${c.kind === 'group' ? groupBadge(c, 'group-badge--xl') : other ? personImg(other, 'avatar--xl') : `<span class="chat-row__ic avatar--xl">${icon(areaOf(c.area).icon)}</span>`}
        <h2>${esc(chatTitle(c))}</h2>
        ${c.kind === 'group' && c.desc ? `<p>${esc(c.desc)}</p>` : other ? `<p>@${esc(other.username)}</p>` : ''}
        <div class="info-head__tags">${chatStatus(c)}${other && other.rank && c.kind !== 'group' ? rankPill(rankOf(other.rank)) : ''}</div>
        ${c.canPhoto ? `<div class="photo-ctl"><label class="btn btn--soft btn--sm photo-ctl__pick">${icon('ph-image')}${c.photo ? t('Bild ändern') : t('Gruppenbild hochladen')}<input type="file" accept="image/*" data-group-photo="${esc(c.id)}"></label>
          ${c.photo ? `<button class="btn btn--soft btn--sm" type="button" data-group-photo-del="${esc(c.id)}">${icon('ph-trash')}${t('Entfernen')}</button>` : ''}</div>` : ''}
      </div>`;
    // Server-Chat: verbundene private Server
    if (c.kind === 'group' && (c.category === 'server' || (c.servers || []).length) && !ps.list) loadPservers();
    const free = ps.list ? ps.list.mine.filter((p) => !(c.servers || []).some((x) => x.id === p.id)) : [];
    const servers = c.kind === 'group' && (c.category === 'server' || (c.servers || []).length) ? `<section class="info-sec"><h3>${icon('ph-cell-signal-high')}${t('Private Server')}</h3>
        ${(c.servers || []).length ? `<div class="ps-list">${c.servers.map((p) => pserverCard(p, { inChat: c })).join('')}</div>` : `<p class="muted">${t('Noch kein Server verbunden.')}</p>`}
        ${c.canAdmin && free.length ? `<form class="find-player find-player--inline" data-ps-link="${esc(c.id)}"><div class="find-player__row"><select name="server">${free.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select><button class="btn btn--primary" type="submit">${icon('ph-plus')}${t('Verbinden')}</button></div></form>` : ''}
        ${c.canAdmin && ps.list && !ps.list.mine.length ? `<p class="ps-empty">${icon('ph-info')}<span>${t('Verbinden kann nur der Besitzer eines privaten Servers. Starte deinen privaten Server einmal in Roblox, dann erscheint er hier.')}</span></p>` : ''}
      </section>` : '';
    // Bearbeiten (Inhaber, Admins, Moderation)
    const edit = c.canAdmin ? `<section class="info-sec"><h3>${icon('ph-sliders-horizontal')}${t('Gruppe bearbeiten')}</h3>
        <form class="cform group-form" data-group-edit="${esc(c.id)}" novalidate>
          <div class="f"><label class="f__label" for="ge-name">${t('Name')}</label><input id="ge-name" name="name" maxlength="60" value="${esc(c.name)}"></div>
          <div class="f"><label class="f__label" for="ge-desc">${t('Beschreibung')}</label><textarea id="ge-desc" name="desc" rows="2" maxlength="300">${esc(c.desc)}</textarea></div>
          <fieldset class="f"><legend class="f__label">${t('Farbe')}</legend><div class="swatches">${GROUP_COLORS.map((col) => `<label class="swatch" style="--gc:${col}"><input type="radio" name="color" value="${col}"${c.color === col ? ' checked' : ''}><span></span></label>`).join('')}</div></fieldset>
          <fieldset class="f"><legend class="f__label">${t('Wer kann die Gruppe sehen?')}</legend>${visPick(st.visibility)}</fieldset>
          <div class="f"><label class="f__label" for="ge-rules">${t('Regeln')}</label><textarea id="ge-rules" name="rules" rows="4" maxlength="1500">${esc(c.rules)}</textarea></div>
          ${groupSettingsFields(st)}
          <button class="btn btn--primary btn--lg btn--block" type="submit">${icon('ph-check')}${t('Speichern')}</button>
        </form></section>`
      : c.kind === 'group' ? `<section class="info-sec"><h3>${icon('ph-scroll')}${t('Regeln und Einstellungen')}</h3>
        ${c.rules ? `<p class="info-rules">${esc(c.rules)}</p>` : `<p class="muted">${t('Diese Gruppe hat keine eigenen Regeln.')}</p>`}
        <dl class="info-dl">
          <div><dt>${t('Leute hinzufügen')}</dt><dd>${label.invite[st.invite]}</dd></div>
          <div><dt>${t('Schreiben')}</dt><dd>${label.write[st.write]}</dd></div>
          <div><dt>${t('Fotos und Videos')}</dt><dd>${yesNo(st.media)}</dd></div>
          <div><dt>${t('Langsam-Modus')}</dt><dd>${st.slow ? t('{n} Sekunden', { n: st.slow }) : t('Aus')}</dd></div>
          <div><dt>${t('Befehle')}</dt><dd>${label.cmd[st.cmd]}</dd></div>
        </dl></section>` : '';
    const members = c.members || [];
    const people = `<section class="info-sec"><h3>${icon('ph-users-three')}${c.kind === 'group' ? t('{n} Mitglieder', { n: members.length }) : t('Im Gespräch')}</h3>
        ${c.canInvite ? `<form class="find-player find-player--inline" data-member-invite="${esc(c.id)}"><div class="find-player__row"><input name="name" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(t('Roblox-Name'))}"><button class="btn btn--primary" type="submit">${icon('ph-user-plus')}${t('Hinzufügen')}</button></div></form>` : ''}
        <ul class="mem-list">${members.map((p) => memberRow(c, p)).join('')}</ul></section>`;
    const cmds = c.commands && c.commands.length ? `<section class="info-sec"><h3>${icon('ph-terminal-window')}${t('Befehle')}</h3>
        <ul class="cmd-list">${c.commands.map((x) => `<li><code>${esc(x.usage)}</code><span>${esc(t(x.desc))}</span></li>`).join('')}</ul></section>` : '';
    const mine = role ? `<section class="info-sec"><h3>${icon('ph-bell')}${t('Für dich')}</h3>
        <label class="toggle"><span class="toggle__text"><b>${t('Stummschalten')}</b><small>${t('Keine Benachrichtigungen aus diesem Gespräch.')}</small></span>
          <input type="checkbox" role="switch" data-chat-mute="${esc(c.id)}"${c.me.muted ? ' checked' : ''}><span class="toggle__ui" aria-hidden="true"></span></label></section>` : '';
    const btn = (attr, ic, text, cls = 'btn--soft') => `<button class="btn ${cls} btn--block" type="button" ${attr}>${icon(ic)}${text}</button>`;
    const actions = [
      c.kind === 'direct' && role && other ? `<button class="btn btn--soft btn--block" type="button" data-invite-player="${esc(other.sub)}" data-invite-name="${esc(nameOfP(other))}">${icon('phf-play')}${t('{name} ins Spiel einladen', { name: esc(nameOfP(other)) })}</button>` : '',
      c.kind === 'direct' && role && other ? `<a class="btn btn--soft btn--block" href="#/chat/neu/gruppe?mit=${esc(other.sub)}">${icon('ph-user-plus')}${t('Gruppe mit {name} und weiteren Leuten', { name: esc(nameOfP(other)) })}</a>` : '',
      c.canJoinMod ? btn(`data-chat-joinmod="${esc(c.id)}"`, 'ph-shield-check', t('Sichtbar als Moderation beitreten')) : '',
      c.canJoin ? btn(`data-chat-join="${esc(c.id)}"`, 'ph-user-plus', t('Gruppe beitreten'), 'btn--primary') : '',
      c.canReport ? btn(`data-chat-report="${esc(c.id)}"`, 'ph-flag', t('Gespräch melden')) : '',
      c.canLeave ? btn(`data-chat-leave="${esc(c.id)}"`, 'ph-sign-out', c.kind === 'group' ? t('Gruppe verlassen') : t('Gespräch verlassen')) : '',
      role ? btn(`data-chat-hide="${esc(c.id)}"`, 'ph-trash', t('Für mich löschen')) : '',
      c.canDeleteAll ? btn(`data-chat-delete="${esc(c.id)}"`, 'ph-trash-simple', t('Für alle löschen'), 'btn--danger') : '',
    ].filter(Boolean);
    const mod = c.canModerate && (c.reports || c.modlog) ? `<section class="info-sec info-sec--mod"><h3>${icon('ph-shield-check')}${t('Moderation')}</h3>
        ${(c.reports || []).length ? `<ul class="mod-log">${c.reports.map((r) => `<li>${icon('ph-flag')}<span><b>${esc(r.name)}</b> ${t('hat gemeldet')} · ${fmtWhen(r.at)}${r.text ? `<small>${esc(r.text)}</small>` : ''}</span>${r.ticket ? `<a href="#/chat/${esc(r.ticket)}">${t('Meldung')}</a>` : ''}</li>`).join('')}</ul>` : `<p class="muted">${t('Keine Meldungen.')}</p>`}
        ${(c.modlog || []).length ? `<ul class="mod-log mod-log--quiet">${c.modlog.slice().reverse().map((x) => `<li>${icon(x.action === 'join' ? 'ph-user-plus' : 'ph-eye')}<span>${esc(x.name)} ${x.action === 'join' ? t('ist beigetreten') : t('hat mitgelesen')} · ${fmtWhen(x.at)}</span></li>`).join('')}</ul>` : ''}
      </section>` : '';
    return `${backTo(`#/chat/${esc(c.id)}`, t('Zurück zum Gespräch'))}${head}${channelsSection(c)}${servers}${discordSection(c)}${edit}${rolesSection(c)}${botsSection(c)}${people}${cmds}${mine}
      ${actions.length ? `<section class="info-sec"><div class="btn-stack">${actions.join('')}</div></section>` : ''}${mod}`;
  }

  // ---------- Eigene Rollen in Gruppen (wie bei Discord): Name, Farbe, Rechte ----------
  const PERM_LABELS = [
    ['write', 'Schreiben, auch wenn nur Admins dürfen'], ['media', 'Fotos und Videos senden'], ['invite', 'Leute hinzufügen'],
    ['commands', 'Befehle nutzen, auch wenn nur Admins dürfen'], ['messages', 'Nachrichten anderer löschen'], ['kick', 'Mitglieder entfernen'],
    ['mention', '@alle erwähnen'], ['manage', 'Gruppe verwalten (Einstellungen, Rollen, Discord)'],
  ];
  const ROLE_COLORS = ['#EC0016', '#F27405', '#E2A512', '#408335', '#0F8C8C', '#1455C0', '#7A4BD1', '#C2185B', '#878C96'];
  const topRole = (c, p) => (c.roles || []).find((r) => (p.roles || []).includes(r.id)) || null;
  const roleChip = (r) => `<span class="crole" style="--rc:${esc(r.color)}"><i></i>${esc(r.name)}</span>`;
  function rolesSection(c) {
    if (c.kind !== 'group') return '';
    const roles = c.roles || [];
    if (!roles.length && !c.canManage) return '';
    const count = (r) => (c.members || []).filter((m) => (m.roles || []).includes(r.id)).length;
    const perms = (r) => (r.perms.length ? r.perms.map((x) => t((PERM_LABELS.find(([k]) => k === x) || [x, x])[1])).join(' · ') : t('Keine Extra-Rechte'));
    return `<section class="info-sec"><h3>${icon('ph-identification-badge')}${t('Rollen')}</h3>
      ${roles.length ? `<ul class="crole-list">${roles.map((r) => `<li>
        <span class="crole-list__main">${roleChip(r)}<small>${t('{n} Mitglieder', { n: count(r) })} · ${perms(r)}</small></span>
        ${c.canManage ? `<button class="btn btn--soft btn--sm" type="button" data-role-edit="${esc(r.id)}">${icon('ph-note-pencil')}${t('Bearbeiten')}</button>` : ''}
      </li>`).join('')}</ul>` : `<p class="muted">${t('Noch keine eigenen Rollen. Rollen geben Mitgliedern einen Namen, eine Farbe und Rechte – wie bei Discord.')}</p>`}
      ${c.canManage ? `<button class="btn btn--outline btn--block" type="button" data-role-edit="new">${icon('ph-plus')}${t('Rolle hinzufügen')}</button>` : ''}
    </section>`;
  }
  function roleView(arg) {
    const [cid, rid] = String(arg).split(':');
    const c = chat.conv[cid];
    if (!c) return `<p class="muted">${t('Nicht gefunden.')}</p>`;
    const r = (c.roles || []).find((x) => x.id === rid) || { id: 'new', name: '', color: ROLE_COLORS[(c.roles || []).length % ROLE_COLORS.length], perms: [] };
    return `<form class="cform role-form" data-role-form="${esc(cid)}" data-role-id="${esc(r.id)}" novalidate>
      <div class="f"><label class="f__label" for="role-name">${t('Name der Rolle')}</label><input id="role-name" name="name" maxlength="30" value="${esc(r.name)}" placeholder="${esc(t('z. B. Fahrdienst'))}"></div>
      <fieldset class="f"><legend class="f__label">${t('Farbe')}</legend><div class="swatches">${ROLE_COLORS.map((col) => `<label class="swatch" style="--gc:${col}"><input type="radio" name="color" value="${col}"${r.color === col ? ' checked' : ''}><span></span></label>`).join('')}</div></fieldset>
      <fieldset class="f"><legend class="f__label">${t('Rechte')}</legend><div class="toggles">${PERM_LABELS.map(([k, label]) => `<label class="toggle"><span class="toggle__text"><b>${t(label)}</b></span><input type="checkbox" role="switch" name="perm" value="${k}"${r.perms.includes(k) ? ' checked' : ''}><span class="toggle__ui" aria-hidden="true"></span></label>`).join('')}</div></fieldset>
      <button class="btn btn--primary btn--lg btn--block" type="submit">${icon('ph-check')}${t('Speichern')}</button>
      ${r.id !== 'new' ? `<button class="btn btn--danger btn--block" type="button" data-role-del="${esc(r.id)}" data-role-chat="${esc(cid)}">${icon('ph-trash')}${t('Rolle löschen')}</button>` : ''}
    </form>`;
  }
  function memberRolesView(arg) {
    const [cid, sub] = String(arg).split(':');
    const c = chat.conv[cid];
    const p = c && (c.members || []).find((m) => m.sub === sub);
    if (!p) return `<p class="muted">${t('Nicht gefunden.')}</p>`;
    if (!(c.roles || []).length) return `<p class="muted">${t('Lege zuerst unter „Rollen“ eine Rolle an.')}</p>`;
    return `<form class="cform" data-mem-roles-form="${esc(cid)}" data-mem="${esc(sub)}" novalidate>
      <p class="sp-head">${personImg(p)}<span><b>${esc(nameOfP(p))}</b> · @${esc(p.username)}</span></p>
      <div class="toggles">${c.roles.map((r) => `<label class="toggle"><span class="toggle__text">${roleChip(r)}</span><input type="checkbox" role="switch" name="role" value="${esc(r.id)}"${(p.roles || []).includes(r.id) ? ' checked' : ''}><span class="toggle__ui" aria-hidden="true"></span></label>`).join('')}</div>
      <button class="btn btn--primary btn--lg btn--block" type="submit">${icon('ph-check')}${t('Speichern')}</button>
    </form>`;
  }
  async function saveRoles(cid, roles, msg) {
    const r = await chatCall(cid, '/roles', { method: 'PUT', body: { roles } }, () => {});
    if (r) { closeModal(); renderChat(); toast(msg); }
  }

  // ---------- Discord: Server-Chat verbinden (Webhook oder eigener Bot), Automationen ----------
  const DISCORD_STATUS = { none: ['', 'Nicht verbunden'], draft: ['', 'Entwurf'], pending: ['pill--warn', 'Wird geprüft'], active: ['pill--ok', 'Verbunden'], denied: ['pill--bad', 'Abgelehnt'] };
  function discordSection(c) {
    const d = c.discord;
    if (c.kind !== 'group' || !d) return '';
    if (!c.canManage) {
      return d.status === 'active' ? `<section class="info-sec"><h3>${icon('si-discord')}Discord</h3><p class="muted">${t('Dieser Server-Chat ist mit Discord verbunden. Nachrichten erscheinen auch dort.')}</p></section>` : '';
    }
    if (c.category !== 'server') return '';
    const st = DISCORD_STATUS[d.status] || DISCORD_STATUS.none;
    const req = d.requirements || [];
    const ready = req.every((r) => r.ok);
    const mode = d.mode || 'webhook';
    return `<section class="info-sec info-sec--discord">
      <h3>${icon('si-discord')}${t('Discord verbinden')}<span class="pill ${st[0]}">${t(st[1])}</span></h3>
      <p class="muted">${t('Zeigt die Nachrichten dieses Server-Chats auch auf deinem Discord-Server – per Webhook oder mit deinem eigenen Bot. Das Team prüft jede Verbindung, bevor sie startet.')}</p>
      ${d.status === 'denied' ? `<p class="note note--bad">${icon('ph-info')}<span>${d.reason ? t('Abgelehnt: {reason}', { reason: esc(d.reason) }) : t('Abgelehnt. Du kannst die Verbindung anpassen und erneut einreichen.')}</span></p>` : ''}
      ${d.status === 'pending' ? `<p class="note">${icon('ph-timer')}<span>${t('Eingereicht – das Team prüft die Verbindung. Du bekommst eine Benachrichtigung.')}</span></p>` : ''}
      ${d.lastError && d.status === 'active' ? `<p class="note note--bad">${icon('ph-warning')}<span>${t('Discord hat zuletzt eine Nachricht abgelehnt ({when}). Webhook bzw. Bot prüfen.', { when: fmtWhen(d.lastError.at) })}</span></p>` : ''}
      <h4 class="info-sub">${t('Voraussetzungen')}</h4>
      <ul class="req-list">${req.map((r) => `<li class="${r.ok ? 'is-ok' : ''}">${icon(r.ok ? 'phf-check-circle' : 'ph-circle')}<span>${t(r.text)}</span></li>`).join('')}</ul>
      <form class="cform dc-form" data-discord-form="${esc(c.id)}" novalidate>
        <fieldset class="f"><legend class="f__label">${t('Verbindung')}</legend><div class="vis-grid">
          <label class="vis"><input type="radio" name="mode" value="webhook"${mode === 'webhook' ? ' checked' : ''}><span>${icon('ph-link')}<b>Webhook</b><small>${t('Einfach: Link aus Discord')}</small></span></label>
          <label class="vis"><input type="radio" name="mode" value="bot"${mode === 'bot' ? ' checked' : ''}><span>${icon('ph-robot')}<b>${t('Eigener Bot')}</b><small>${t('Bot-Token und Kanal')}</small></span></label>
        </div></fieldset>
        <div class="f dc-webhook"><label class="f__label" for="dc-hook">Webhook</label><input id="dc-hook" name="webhook" type="password" autocomplete="off" spellcheck="false" placeholder="${esc(mode === 'webhook' && d.hint ? d.hint : 'https://discord.com/api/webhooks/…')}">
          <small class="f__hint">${t('In Discord: Kanal bearbeiten → Integrationen → Webhooks → „Webhook-URL kopieren“.')}${mode === 'webhook' && d.info ? ` ${t('Verbunden mit „{name}“.', { name: esc(d.info.name) })}` : ''}</small></div>
        <div class="f dc-bot"><label class="f__label" for="dc-token">${t('Bot-Token')}</label><input id="dc-token" name="token" type="password" autocomplete="off" spellcheck="false" placeholder="${esc(mode === 'bot' && d.hint ? d.hint : t('Token aus dem Discord-Entwicklerportal'))}"></div>
        <div class="f dc-bot"><label class="f__label" for="dc-channel">${t('Kanal-ID')}</label><input id="dc-channel" name="channel" inputmode="numeric" autocomplete="off" value="${esc(d.channel || '')}">
          <small class="f__hint">${mode === 'bot' && d.info ? t('Bot „{name}“ schreibt in #{channel}.', { name: esc(d.info.name), channel: esc(d.info.channel) }) : t('In Discord den Entwicklermodus einschalten, dann Rechtsklick auf den Kanal → „Kanal-ID kopieren“.')}</small></div>
        <div class="f"><label class="f__label" for="dc-name">${t('Name deines Bots')}</label><input id="dc-name" name="botName" maxlength="40" value="${esc(d.botName || 'TSG-Bot')}"></div>
        <fieldset class="f"><legend class="f__label">${t('Was nach Discord geht')}</legend><div class="toggles">
          <label class="toggle"><span class="toggle__text"><b>${t('Nachrichten aus dem Server-Chat')}</b><small>${t('Mit Name und Profilbild, ohne Erwähnungen.')}</small></span><input type="checkbox" role="switch" name="messages"${!d.events || d.events.messages ? ' checked' : ''}><span class="toggle__ui" aria-hidden="true"></span></label>
          <label class="toggle"><span class="toggle__text"><b>${t('Wer beitritt und geht')}</b></span><input type="checkbox" role="switch" name="joins"${!d.events || d.events.joins ? ' checked' : ''}><span class="toggle__ui" aria-hidden="true"></span></label>
        </div></fieldset>
        <p class="f__hint">${icon('ph-robot')} ${t('Was dein Bot schreibt (z. B. eine Begrüßung), stellst du unter „Bots“ ein – dort kann jede Regel auch nach Discord gehen.')}</p>
        <div class="btn-row dc-actions">
          <button class="btn btn--primary" type="submit">${icon('ph-check')}${t('Speichern')}</button>
          ${d.verified ? `<button class="btn btn--soft" type="button" data-discord-test="${esc(c.id)}">${icon('ph-paper-plane-tilt')}${t('Testnachricht')}</button>` : ''}
          ${['draft', 'denied', 'none'].includes(d.status) ? `<button class="btn btn--soft" type="button" data-discord-submit="${esc(c.id)}"${ready ? '' : ' disabled'}>${icon('ph-paper-plane-right')}${t('Zur Prüfung einreichen')}</button>` : ''}
          ${d.status !== 'none' ? `<button class="btn btn--ghost" type="button" data-discord-remove="${esc(c.id)}">${icon('ph-trash')}${t('Entfernen')}</button>` : ''}
        </div>
      </form>
    </section>`;
  }
  function readDiscordForm(form) {
    const f = form.elements;
    const body = {
      mode: (form.querySelector('input[name="mode"]:checked') || {}).value, botName: f.botName.value,
      events: { messages: f.messages.checked, joins: f.joins.checked },
    };
    if (body.mode === 'webhook' && f.webhook.value.trim()) body.webhook = f.webhook.value.trim();
    if (body.mode === 'bot') {
      if (f.token.value.trim()) body.token = f.token.value.trim();
      if (f.channel.value.trim()) body.channel = f.channel.value.trim();
    }
    return body;
  }
  async function discordCall(id, path, opts, msg) {
    try {
      const r = await api(`/api/chats/${encodeURIComponent(id)}/discord${path}`, opts);
      if (chat.conv[id]) chat.conv[id].discord = r;
      if (msg) toast(msg);
      if (state.page === 'chat') renderChat();
      return r;
    } catch (e) {
      haptic('error');
      toast(chatError(e));
      return null;
    }
  }

  // ---------- Eigene Bots: Regeln mit Vorlagen ----------
  const BOT_TRIGGERS = [['join', 'Jemand tritt dem Chat bei'], ['leave', 'Jemand verlässt den Chat'], ['command', 'Befehl, z. B. !regeln'], ['game_join', 'Jemand betritt einen verbundenen Server im Spiel'], ['game_leave', 'Jemand verlässt den Server im Spiel']];
  const BOT_TARGETS = [['chat', 'In den Chat'], ['discord', 'Nach Discord'], ['both', 'Chat und Discord']];
  const BOT_PH = ['username', 'displayName', 'server', 'chat', 'members', 'game', 'gameId', 'players', 'command', 'args', 'time', 'date'];
  const botPhotoUrl = (cid, b) => (b && b.avatar && apiReady() ? `${API}/media/bot/${encodeURIComponent(cid)}/${encodeURIComponent(b.id)}?v=${b.avatar}` : '');
  // Ohne Bild: zwei Buchstaben auf einer Farbe aus dem Namen (wie bei Servern und Gruppen)
  function botAvatar(cid, b, cls = '') {
    const src = botPhotoUrl(cid, b);
    if (src) return `<span class="bot-ava ${cls}"><img src="${esc(src)}" alt="" loading="lazy"></span>`;
    const [a1, a2] = AVATAR_COLORS[hash(String((b && b.name) || 'Bot')) % AVATAR_COLORS.length];
    return `<span class="bot-ava bot-ava--ini ${cls}" style="--a1:${a1};--a2:${a2}">${esc(initials(String((b && b.name) || 'Bot')))}</span>`;
  }
  const botsFull = {};
  async function loadBotFull(cid, bid) {
    try { botsFull[bid] = await api(`/api/chats/${encodeURIComponent(cid)}/bots/${encodeURIComponent(bid)}`); } catch (e) { botsFull[bid] = { error: e.message || 'error' }; }
    return botsFull[bid];
  }
  async function botCall(cid, path, opts) {
    try { return await api(`/api/chats/${encodeURIComponent(cid)}/bots${path}`, opts); } catch (e) { haptic('error'); toast(chatError(e)); return null; }
  }
  function botsSection(c) {
    if (c.kind !== 'group') return '';
    const bots = c.bots || [];
    if (!bots.length && !c.canBots) return '';
    return `<section class="info-sec info-sec--bots"><h3>${icon('ph-robot')}${t('Bots')}</h3>
      ${bots.length ? `<ul class="bot-list">${bots.map((b) => `<li class="bot-row${b.on ? '' : ' is-off'}">
        ${botAvatar(c.id, b)}
        <span class="bot-row__main"><b>${esc(b.name)} <span class="bot-tag">BOT</span></b><small>${b.desc ? esc(b.desc) : t('Vorlagen mit Platzhaltern')}${b.on ? '' : ` · ${t('Aus')}`}</small></span>
        ${c.canBots ? `<span class="bot-row__acts">
          <button class="btn btn--soft btn--sm" type="button" data-bot-edit="${esc(c.id)}:${esc(b.id)}">${icon('ph-gear-six')}${t('Einstellungen')}</button></span>` : ''}
      </li>`).join('')}</ul>` : `<p class="muted">${t('Eigene Bots begrüßen neue Mitglieder, antworten auf Befehle wie !regeln und melden, wer im Spiel ist – einfach mit Vorlagen.')}</p>`}
      ${c.canBots && bots.length < 5 ? `<button class="btn btn--outline btn--block" type="button" data-bot-new="${esc(c.id)}">${icon('ph-plus')}${t('Bot erstellen')}</button>` : ''}
    </section>`;
  }
  function botNewView(cid) {
    return `<form class="cform" data-bot-create="${esc(cid)}" novalidate>
      <div class="f"><label class="f__label" for="bot-name">${t('Name des Bots')}</label><input id="bot-name" name="name" maxlength="32" placeholder="${esc(defaultName('Bot'))}"><small class="f__hint">${t('Leer lassen für „{name}“', { name: esc(defaultName('Bot')) })}</small></div>
      <p class="f__hint">${t('Bild, Beschreibung und Regeln wie „Willkommen {username}!“ stellst du danach ein. Bots brauchen kein Discord – sie laufen direkt in diesem Chat.')}</p>
      <button class="btn btn--primary btn--lg btn--block" type="submit">${icon('ph-plus')}${t('Bot erstellen')}</button>
    </form>`;
  }
  function ruleRow(a = {}, discordOn = true) {
    return `<li class="auto-row" data-auto-row data-auto-id="${esc(a.id || '')}">
      <div class="auto-row__head">
        <select name="trigger" aria-label="${esc(t('Wann'))}">${BOT_TRIGGERS.map(([k, l]) => `<option value="${k}"${(a.trigger || 'join') === k ? ' selected' : ''}>${t(l)}</option>`).join('')}</select>
        <select name="target" aria-label="${esc(t('Wohin'))}">${BOT_TARGETS.map(([k, l]) => `<option value="${k}"${(a.target || 'chat') === k ? ' selected' : ''}${k !== 'chat' && !discordOn ? ' disabled' : ''}>${t(l)}</option>`).join('')}</select>
      </div>
      <label class="auto-row__cmd"><span>${t('Befehl')}</span><input name="command" maxlength="24" value="${esc(a.command || '')}" placeholder="regeln" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
      <textarea class="code-field" name="template" rows="2" maxlength="500" spellcheck="false" autocapitalize="off" placeholder="Willkommen {username} auf {server}!">${esc(a.template || '')}</textarea>
      <div class="auto-row__foot">
        <label class="mini-toggle"><input type="checkbox" name="on"${a.on === false ? '' : ' checked'}><span>${t('Aktiv')}</span></label>
        <button class="btn btn--ghost btn--sm" type="button" data-auto-del>${icon('ph-trash')}${t('Entfernen')}</button>
      </div>
    </li>`;
  }
  function botView(arg) {
    const [cid, bid] = String(arg).split(':');
    const c = chat.conv[cid];
    const b = botsFull[bid];
    if (!b) { loadBotFull(cid, bid).then(() => { if (modalView && modalView.name === 'bot') refreshModal(); }); return loadingHtml(); }
    if (b.error) return `<p class="muted">${t('Nicht gefunden.')}</p>`;
    const discordOn = !!(c && c.discord && c.discord.status === 'active');
    const pre = esc(b.prefix || '!');
    return `<form class="cform bot-form" data-bot-form="${esc(cid)}" data-bot-id="${esc(bid)}" novalidate>
      <div class="bot-head">
        ${botAvatar(cid, b, 'bot-ava--xl')}
        <div class="photo-ctl"><label class="btn btn--soft btn--sm photo-ctl__pick">${icon('ph-image')}${b.avatar ? t('Bild ändern') : t('Bild hochladen')}<input type="file" accept="image/*" data-bot-photo="${esc(cid)}:${esc(bid)}"></label>
          ${b.avatar ? `<button class="btn btn--soft btn--sm" type="button" data-bot-photo-del="${esc(cid)}:${esc(bid)}">${icon('ph-trash')}${t('Entfernen')}</button>` : ''}</div>
      </div>
      <div class="f"><label class="f__label" for="bf-name">${t('Name')}</label><input id="bf-name" name="name" maxlength="32" value="${esc(b.name)}"></div>
      <div class="f"><label class="f__label" for="bf-desc">${t('Beschreibung')}</label><input id="bf-desc" name="desc" maxlength="140" value="${esc(b.desc || '')}" placeholder="${esc(t('Was macht dein Bot?'))}"></div>
      <div class="f"><label class="f__label" for="bf-prefix">${t('Präfix für Befehle')}</label><input id="bf-prefix" name="prefix" maxlength="3" value="${pre}" autocapitalize="off" autocomplete="off" spellcheck="false">
        <small class="f__hint">${t('Mit {ex} ruft man den Befehl „regeln“ auf. Befehle mit / gehören zum TSG-Bot.', { ex: `<code>${pre}regeln</code>` })}</small></div>
      <label class="toggle"><span class="toggle__text"><b>${t('Bot ist aktiv')}</b><small>${t('Ausgeschaltet reagiert er auf nichts.')}</small></span><input type="checkbox" role="switch" name="on"${b.on ? ' checked' : ''}><span class="toggle__ui" aria-hidden="true"></span></label>
      <div class="bot-rules">
        <h4 class="info-sub">${t('Regeln')}</h4>
        <ul class="auto-list" data-auto-list>${(b.rules || []).map((r) => ruleRow(r, discordOn)).join('')}</ul>
        <button class="btn btn--outline btn--sm" type="button" data-auto-add data-discord-on="${discordOn ? 1 : 0}">${icon('ph-plus')}${t('Regel hinzufügen')}</button>
        <p class="f__hint code-help">${t('Platzhalter:')} ${BOT_PH.map((x) => `<code>{${x}}</code>`).join(' ')}</p>
        ${discordOn ? '' : `<p class="f__hint">${t('Nach Discord geht es erst, wenn dieser Server-Chat mit Discord verbunden und angenommen ist.')}</p>`}
      </div>
      <button class="btn btn--primary btn--lg btn--block" type="submit">${icon('ph-check')}${t('Speichern')}</button>
      <button class="btn btn--danger btn--block" type="button" data-bot-del="${esc(cid)}:${esc(bid)}">${icon('ph-trash')}${t('Bot löschen')}</button>
    </form>`;
  }
  // Quadratisches JPEG (256 × 256) für Gruppen- und Bot-Bilder
  async function squareJpeg(file) {
    const bmp = await createImageBitmap(file);
    const side = Math.min(bmp.width, bmp.height);
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 256;
    cv.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256);
    if (bmp.close) bmp.close();
    return new Promise((ok, fail) => cv.toBlob((b) => (b ? ok(b) : fail(new Error('blob'))), 'image/jpeg', 0.86));
  }
  function botChanged(cid, bot) {
    if (bot && bot.id) botsFull[bot.id] = bot;
    openConv(cid);
    if (modalView && modalView.name === 'bot') refreshModal();
  }
  async function uploadBotPhoto(arg, file) {
    const [cid, bid] = arg.split(':');
    try {
      const blob = await squareJpeg(file);
      const r = await botCall(cid, `/${bid}/photo`, { method: 'PUT', raw: blob, type: 'image/jpeg' });
      if (r) { botChanged(cid, r); toast(t('Bild gespeichert')); }
    } catch (e) {
      toast(t('Dieses Bild lässt sich nicht verwenden.'));
    }
  }

  // ---------- Prüfung der Discord-Verbindungen (Ränge über Public Relations Department) ----------
  const dreq = { list: null, at: 0, busy: false };
  const isReviewer = () => isTeam('Project Engineer');
  async function loadDiscordRequests(force = false) {
    if (!apiReady() || !sessionToken() || !isReviewer() || dreq.busy || (!force && dreq.list && Date.now() - dreq.at < 30000)) return;
    dreq.busy = true;
    try { dreq.list = (await api('/api/discord/requests')).requests; } catch (e) { dreq.list = dreq.list || []; }
    dreq.busy = false;
    dreq.at = Date.now();
    if (state.page === 'chat' && !['conv', 'info'].includes(state.chatView)) renderChat();
  }
  function dreqCard(r) {
    const st = DISCORD_STATUS[r.status] || DISCORD_STATUS.none;
    const how = r.mode === 'bot' ? t('Eigener Bot „{name}“ in #{channel}', { name: esc((r.info || {}).name || '?'), channel: esc((r.info || {}).channel || r.channel || '?') })
      : t('Webhook „{name}“', { name: esc((r.info || {}).name || '?') });
    return `<article class="dreq">
      <header class="dreq__head">${groupBadge(r)}<span class="dreq__title"><b>${esc(r.name)}</b><small>${t('{n} Mitglieder', { n: r.members })} · ${t('{n} Server', { n: r.servers })}</small></span><span class="pill ${st[0]}">${t(st[1])}</span></header>
      <dl class="info-dl">
        <div><dt>${t('Inhaber')}</dt><dd>${esc(r.owner ? r.owner.name : '–')}</dd></div>
        <div><dt>${t('Eingereicht')}</dt><dd>${r.requestedBy ? `${esc(r.requestedBy.displayName || r.requestedBy.username)} · ${fmtWhen(r.requestedAt)}` : '–'}</dd></div>
        <div><dt>${t('Verbindung')}</dt><dd>${how}</dd></div>
        <div><dt>${t('Bot-Name')}</dt><dd>${esc(r.botName || 'TSG-Bot')}</dd></div>
      </dl>
      ${r.rules ? `<p class="info-rules">${esc(r.rules)}</p>` : ''}
      ${(r.roles || []).length ? `<div class="dreq__roles">${r.roles.map((x) => `${roleChip(x)}<small>${x.count}</small>`).join('')}</div>` : ''}
      ${(r.bots || []).length ? `<p class="dreq__bots">${icon('ph-robot')}${r.bots.map((b) => `<span>${esc(b.name)} <small>${b.mode === 'advanced' ? 'Luna' : t('Basis')}${b.on ? '' : ` · ${t('Aus')}`}</small></span>`).join('')}</p>` : ''}
      ${r.status === 'pending' ? `<div class="btn-row"><button class="btn btn--primary" type="button" data-dreq-accept="${esc(r.id)}">${icon('ph-check')}${t('Annehmen')}</button>
        <button class="btn btn--soft" type="button" data-dreq-deny="${esc(r.id)}">${icon('ph-x')}${t('Ablehnen')}</button></div>`
        : r.reviewedBy ? `<p class="muted">${r.status === 'active' ? t('Angenommen von {name}', { name: esc(r.reviewedBy.name) }) : t('Abgelehnt von {name}', { name: esc(r.reviewedBy.name) })} · ${fmtWhen(r.reviewedAt)}${r.reason ? ` – ${esc(r.reason)}` : ''}</p>` : ''}
    </article>`;
  }
  function chatDiscordReview() {
    if (!isReviewer()) return `<p class="empty">${t('Discord-Verbindungen prüfen die Ränge über Public Relations Department.')}</p>`;
    if (!dreq.list) { loadDiscordRequests(); return loadingHtml(); }
    if (!dreq.list.length) return `<div class="chat-empty">${icon('si-discord')}<h2>${t('Keine Anfragen')}</h2><p>${t('Eingereichte Discord-Verbindungen von Server-Chats erscheinen hier.')}</p></div>`;
    return `<div class="dreq-list">${dreq.list.map(dreqCard).join('')}</div>`;
  }
  async function reviewDiscord(id, decision) {
    let reason = '';
    if (decision === 'deny') {
      reason = prompt(t('Warum wird die Verbindung abgelehnt? (Der Antragsteller sieht den Grund.)'));
      if (reason === null) return;
    }
    try {
      await api(`/api/discord/requests/${encodeURIComponent(id)}`, { method: 'POST', body: { decision, reason } });
      haptic('success');
      toast(decision === 'accept' ? t('Verbindung angenommen') : t('Verbindung abgelehnt'));
      loadDiscordRequests(true);
    } catch (e) { toast(chatError(e)); }
  }

  function renderChat() {
    const v = state.chatView;
    const head = $('[data-chat-head]');
    const body = $('[data-chat]');
    if (v === 'conv') {
      const r = chatConv(state.chatArg);
      head.innerHTML = r.head;
      body.innerHTML = r.body;
      return;
    }
    const sub = { new: t('Neu'), 'new-dm': t('Spieler anschreiben'), 'new-group': t('Neue Gruppe'), 'new-server': t('Neuer Server'), 'new-ticket': t('Neue Anfrage'), join: t('Beitreten'), direct: t('Direktnachricht'), info: t('Info') }[v];
    if (sub) {
      head.innerHTML = `<div class="appbar"><div class="appbar__title"><span class="appbar__label">${t('Chat')}</span><h1 class="appbar__value">${sub}</h1></div></div>`;
      body.innerHTML = v === 'new' ? chatNewChoice() : v === 'new-dm' ? chatNewDm() : v === 'new-group' ? chatNewGroup() : v === 'new-server' ? chatNewServer()
        : v === 'new-ticket' ? chatNewTicket() : v === 'join' ? chatJoinView() : v === 'info' ? chatInfo(state.chatArg) : chatDirect(state.chatArg);
      return;
    }
    head.innerHTML = chatHead();
    if (isReviewer() && !dreq.list) loadDiscordRequests();
    body.innerHTML = v === 'team' ? chatTeam() : v === 'queue' ? chatQueue() : v === 'public' ? chatPublic() : v === 'mod' ? chatMod() : v === 'discord' ? chatDiscordReview() : chatMine();
  }

  // ---------- Aktionen ----------
  async function findPlayer(form) {
    const name = form.elements.name.value.trim().replace(/^@/, '');
    if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) { toast(t('Bitte gib einen gültigen Roblox-Namen ein.')); return; }
    const btn = $('button', form);
    btn.disabled = true;
    try {
      const p = await api(`/api/players/find?q=${encodeURIComponent(name)}`);
      chatPlayers[p.userId] = p;
      chat.found = p;
      renderChat();
    } catch (e) {
      btn.disabled = false;
      toast(e.status === 404 ? t('Diesen Roblox-Namen gibt es nicht.') : errorText(e));
    }
  }
  async function addGroupMember() {
    const input = $('[data-member-input]');
    const name = input ? input.value.trim().replace(/^@/, '') : '';
    if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) { toast(t('Bitte gib einen gültigen Roblox-Namen ein.')); return; }
    try {
      const p = await api(`/api/players/find?q=${encodeURIComponent(name)}`);
      if (String(p.userId) === meSub()) { toast(t('Du bist sowieso dabei.')); return; }
      if (!chat.members.some((x) => x.userId === p.userId)) chat.members.push(p);
      input.value = '';
      $('[data-member-chips]').innerHTML = memberChips();
    } catch (e) {
      toast(e.status === 404 ? t('Diesen Roblox-Namen gibt es nicht.') : errorText(e));
    }
  }
  async function sendChat(form) {
    const btn = $('button[type="submit"]', form);
    let body;
    if ('groupNew' in form.dataset || 'serverNew' in form.dataset) {
      const name = form.elements.name.value.trim();
      // Leer = Standardname („Name's Gruppe“ bzw. „Name's Server“)
      if (name.length === 1) { toast(t('Der Name braucht mindestens 2 Zeichen.')); form.elements.name.focus(); return; }
      body = {
        kind: 'group', name, desc: form.elements.desc.value, rules: form.elements.rules.value, text: form.elements.text.value.trim(),
        members: chat.members.map((p) => p.userId), settings: readGroupSettings(form),
      };
      if ('serverNew' in form.dataset) {
        const f = form.elements;
        Object.assign(body, {
          category: 'server', template: (form.querySelector('input[name="template"]:checked') || {}).value || '', servers: [...form.querySelectorAll('input[name="servers"]:checked')].map((x) => x.value),
          server: { join: (form.querySelector('input[name="join"]:checked') || {}).value || 'roblox', link: f.link.value.trim(), access: f.membersOnly.checked ? 'members' : 'all', relay: f.relay.checked, welcome: f.welcome.value },
        });
      }
    } else {
      const text = form.elements.text.value.trim();
      if (!text) { form.elements.text.focus(); return; }
      if ('chatNew' in form.dataset) {
        const reason = (form.querySelector('input[name="reason"]:checked') || {}).value;
        const area = (form.querySelector('input[name="area"]:checked') || {}).value;
        if (!reason || !area) { toast(t('Bitte wähle Grund und Bereich.')); return; }
        body = { kind: 'ticket', reason, area, text };
      } else body = { kind: 'direct', to: form.dataset.chatDirect, text };
    }
    btn.disabled = true;
    try {
      const c = await api('/api/chats', { method: 'POST', body });
      chat.conv[c.id] = c;
      chat.at = 0;
      if (body.kind === 'group') { chat.members = []; if (body.category === 'server') { chat.cat = 'server'; loadPservers(true); } }
      location.hash = `#/chat/${c.id}`;
      toast(body.kind === 'ticket' ? t('Anfrage gesendet') : body.category === 'server' ? t('Server-Chat erstellt') : body.kind === 'group' ? t('Gruppe erstellt') : t('Nachricht gesendet'));
    } catch (e) {
      btn.disabled = false;
      toast(chatError(e));
    }
  }
  // Dateien anhängen: Fotos werden verkleinert (max. 1920 px), Videos und PDFs bleiben wie sie sind
  const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf'];
  const FILE_LIMIT = { image: 15, video: 80, file: 20 };
  const kindOf = (type) => (type.startsWith('image/') ? 'image' : type.startsWith('video/') ? 'video' : 'file');
  async function shrinkChatImage(file) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    cv.getContext('2d').drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    const blob = await new Promise((ok, fail) => cv.toBlob((b) => (b ? ok(b) : fail(new Error('blob'))), 'image/jpeg', 0.85));
    return { blob, w, h };
  }
  async function addChatFiles(id, files) {
    const list = chat.pending[id] || (chat.pending[id] = []);
    for (const f of [...files]) {
      if (list.length >= 10) { toast(t('Höchstens 10 Dateien auf einmal.')); break; }
      let blob = f;
      let type = (f.type || '').toLowerCase();
      let w = null;
      let h = null;
      const kind = kindOf(type);
      if (kind === 'image' && type !== 'image/gif') {
        try { ({ blob, w, h } = await shrinkChatImage(f)); type = 'image/jpeg'; } catch (e) { /* unverändert senden */ }
      }
      if (!FILE_TYPES.includes(type)) { toast(t('„{name}“ kann man nicht senden. Erlaubt sind Fotos, Videos und PDFs.', { name: f.name })); continue; }
      if (blob.size > FILE_LIMIT[kind] * 1048576) { toast(t('„{name}“ ist zu groß (höchstens {n} MB).', { name: f.name, n: FILE_LIMIT[kind] })); continue; }
      list.push({ key: Math.random().toString(36).slice(2), name: f.name || 'datei', type, kind, size: blob.size, blob, w, h, preview: kind === 'image' ? URL.createObjectURL(blob) : null, progress: 0 });
    }
    renderTray(id);
  }
  async function uploadGroupPhoto(id, file) {
    try {
      const bmp = await createImageBitmap(file);
      const side = Math.min(bmp.width, bmp.height);
      const cv = document.createElement('canvas');
      cv.width = 256;
      cv.height = 256;
      cv.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256);
      if (bmp.close) bmp.close();
      const blob = await new Promise((ok, fail) => cv.toBlob((b) => (b ? ok(b) : fail(new Error('blob'))), 'image/jpeg', 0.86));
      if (await chatCall(id, '/photo', { method: 'PUT', raw: blob, type: 'image/jpeg' })) { chat.at = 0; toast(t('Gruppenbild gespeichert')); }
    } catch (e) {
      toast(t('Dieses Bild lässt sich nicht verwenden.'));
    }
  }
  async function uploadPending(id) {
    const ids = [];
    for (const p of chat.pending[id] || []) {
      if (!p.remoteId) {
        const s = await api(`/api/chats/${encodeURIComponent(id)}/files`, { method: 'POST', body: { name: p.name, type: p.type, size: p.size, w: p.w, h: p.h } });
        for (let n = 0; n < s.chunks; n++) {
          await api(`/api/files/${s.id}/${n}`, { method: 'PUT', raw: p.blob.slice(n * s.chunk, (n + 1) * s.chunk), type: 'application/octet-stream' });
          p.progress = (n + 1) / s.chunks;
          const bar = $(`[data-tray="${p.key}"] .tray-item__bar span`);
          if (bar) bar.style.width = `${Math.round(p.progress * 100)}%`;
        }
        p.remoteId = s.id;
      }
      ids.push(p.remoteId);
    }
    return ids;
  }
  async function sendMessage(form) {
    const id = form.dataset.chatSend;
    const ta = form.elements.text;
    const text = ta.value.trim();
    const pending = chat.pending[id] || [];
    if ((!text && !pending.length) || chat.sending) return;
    chat.sending = true;
    form.classList.add('is-sending');
    renderTray(id);
    const btn = $('.compose__send', form);
    btn.disabled = true;
    try {
      const files = pending.length ? await uploadPending(id) : [];
      ta.value = '';
      ta.style.height = '';
      const cc = chat.conv[id];
      chat.conv[id] = await api(`/api/chats/${encodeURIComponent(id)}/messages`, { method: 'POST', body: { text, files, ...(cc && cc.community ? { ch: cc.channel } : {}) } });
      pending.forEach((p) => { if (p.preview) URL.revokeObjectURL(p.preview); });
      chat.pending[id] = [];
      chat.sending = false;
      renderTray(id);
      hideCommands();
      updateConv(id);
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch (e) {
      chat.sending = false;
      if (!ta.value) ta.value = text;
      renderTray(id);
      toast(chatError(e));
    } finally {
      chat.sending = false;
      btn.disabled = false;
      form.classList.remove('is-sending');
    }
  }
  // Befehle vorschlagen, sobald man „/“ tippt
  function showCommands(ta) {
    const box = $('[data-chat-cmds]');
    const c = chat.conv[state.chatArg];
    if (!box || !c) return;
    const v = ta.value;
    const q = v.startsWith('/') && !/\s/.test(v) ? v.slice(1).toLowerCase() : null;
    const list = q === null ? [] : (c.commands || []).filter((x) => x.usage.slice(1).toLowerCase().startsWith(q));
    box.hidden = !list.length;
    box.innerHTML = list.map((x) => `<button type="button" data-cmd="${esc(x.usage.split(' ')[0])}${x.usage.includes('<') ? ' ' : ''}"><code>${esc(x.usage)}</code><small>${esc(t(x.desc))}</small></button>`).join('');
  }
  function hideCommands() {
    const box = $('[data-chat-cmds]');
    if (box) { box.hidden = true; box.innerHTML = ''; }
  }
  // Aktionen im Gespräch und in der Info (Beitreten, Rollen, Stumm, Löschen, Melden …)
  async function chatCall(id, path, opts = {}, done = null) {
    try {
      const r = await api(`/api/chats/${encodeURIComponent(id)}${path}`, opts);
      if (r && r.id === id && r.messages) chat.conv[id] = r;
      chat.at = 0;
      if (done) done(r);
      else if (state.page === 'chat') renderChat();
      return r;
    } catch (e) {
      toast(e.status === 409 && path === '/claim' ? t('Jemand anderes war schneller.') : chatError(e));
      return null;
    }
  }
  async function chatAction(id, action) {
    const r = await chatCall(id, `/${action}`, { method: 'POST' });
    if (r) toast(action === 'claim' ? t('Du hast die Anfrage angenommen') : t('Gespräch beendet'));
    else openConv(id);
  }

  // ---------- Spieler: auf Roblox verfolgen ----------
  // Nur verfolgte Spieler (keine Freundesliste) mit Status: nur ob jemand in Train Sim Germany ist (nie andere Spiele),
  // auf welchem Server, in welcher Rolle und mit welchem Zug. Die Liste der Verfolgten gilt auf allen Geräten.
  const pl = {
    track: store.get('tsg-track', []).filter((x) => /^\d{1,20}$/.test(x)), data: {}, at: 0, busy: false, found: null, finding: false,
  };
  const saveTrack = () => { store.set('tsg-track', pl.track); settingsChanged(); };
  const isTracked = (id) => pl.track.includes(String(id));
  function agoText(ms) {
    const min = Math.round((Date.now() - ms) / 60000);
    if (min < 1) return t('gerade eben');
    if (min < 60) return t('vor {n} Min.', { n: min });
    if (min < 24 * 60) return t('vor {n} Std.', { n: Math.round(min / 60) });
    return fmtWhen(ms);
  }
  async function loadStatus(ids, done) {
    if (!apiReady() || !ids.length) return;
    try {
      const r = await api('/api/players/status', { method: 'POST', body: { ids } });
      r.players.forEach((p) => { pl.data[p.userId] = { ...p, at: Date.now() }; });
    } catch (e) { /* alter Stand bleibt */ }
    if (done) done();
  }
  async function loadTracked(force = false) {
    if (pl.busy || (!force && Date.now() - pl.at < 25000)) return;
    pl.busy = true;
    await loadStatus(pl.track);
    pl.busy = false;
    pl.at = Date.now();
    if (state.page === 'spieler') renderPlayers();
    if (modalView && modalView.name === 'player') refreshModal();
  }
  function setTracked(id, on) {
    id = String(id);
    pl.track = on ? [id, ...pl.track.filter((x) => x !== id)].slice(0, 100) : pl.track.filter((x) => x !== id);
    saveTrack();
    haptic(on ? 'success' : 'tap');
    toast(on ? t('Du verfolgst jetzt {name}.', { name: (pl.data[id] && pl.data[id].displayName) || id }) : t('Nicht mehr verfolgt.'));
    if (on && !pl.data[id]) loadStatus([id], () => { if (state.page === 'spieler') renderPlayers(); });
    if (state.page === 'spieler') renderPlayers();
    if (modalView && modalView.name === 'player') refreshModal();
  }
  async function findTrackPlayer(form) {
    const q = form.q.value.trim();
    if (!q) return;
    pl.finding = true;
    pl.found = null;
    renderPlayers();
    try {
      const p = await api(`/api/players/find?q=${encodeURIComponent(q)}`);
      pl.found = p;
      await loadStatus([p.userId]);
    } catch (e) {
      pl.found = { missing: true, q };
      haptic('error');
    }
    pl.finding = false;
    renderPlayers();
  }

  // Zugfahrt eines verfolgten Spielers: Linie, Zug, Ziel, nächster Halt (sonst nichts)
  const tripCat = (tr) => { const L = lineByName(tr.line); return L ? L.cat : catOfTrain(tr.veh) || 're'; };
  function tripLine(p) {
    if (!p) return `<span class="pstat">${t('Wird geladen …')}</span>`;
    const tr = p.trip;
    if (!tr) return `<span class="pstat">${t('Gerade keine Zugfahrt')}</span>`;
    return `<span class="pstat pstat--on"><i></i>${tr.line ? `${esc(tr.line)} ` : ''}${tr.dest ? t('nach {to}', { to: esc(tr.dest) }) : esc(tr.train || t('unterwegs'))}</span>`;
  }
  const playerPic = (p, cls = '') => (p && p.avatar
    ? `<span class="avatar avatar--img ${cls}" aria-hidden="true"><img src="${esc(p.avatar)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>`
    : avatar((p && (p.username || p.displayName)) || '?', cls));
  // Karte: Bild, Name und – falls unterwegs – die Fahrt mit Linie, Ziel und nächstem Halt
  function playerCard(id) {
    const p = pl.data[id];
    const name = p ? p.displayName || p.username || id : id;
    const tr = p && p.trip;
    return `<article class="tr-card${tr ? ' is-driving' : ''}">
      <button class="tr-card__open" type="button" data-player="${esc(id)}" aria-label="${esc(name)}">
        <span class="tr-card__who">${playerPic(p, 'avatar--lg')}<span><b>${esc(name)}${p && p.me ? ` <em>${t('Du')}</em>` : ''}</b>${p && p.username ? `<small>@${esc(p.username)}</small>` : ''}</span></span>
        ${tr ? `<span class="tr-card__trip">
            <span class="tr-card__line"><span class="line line--${tripCat(tr)}">${esc(tr.line || tr.train || '')}</span>${tr.train && tr.line ? `<small>${esc(tr.train)}</small>` : ''}</span>
            <b class="tr-card__dest">${tr.dest ? t('nach {to}', { to: esc(tr.dest) }) : t('unterwegs')}</b>
            ${tr.next ? `<span class="tr-card__next">${icon('ph-map-pin')}${t('Nächster Halt')}: <b>${esc(tr.next)}</b></span>` : ''}
            ${tr.veh ? `<small class="tr-card__veh">${icon('ph-train')}${esc(trainName(tr.veh))}</small>` : ''}
          </span>` : `<span class="tr-card__idle">${icon('ph-train')}${t('Gerade keine Zugfahrt')}</span>`}
      </button>
      ${p && p.me ? '' : `<button class="pl-card__unfollow" type="button" data-track="${esc(id)}" aria-pressed="true" aria-label="${esc(t('Nicht mehr verfolgen'))}" title="${esc(t('Nicht mehr verfolgen'))}">${icon('ph-x')}</button>`}
    </article>`;
  }
  const playersSorted = (ids) => [...ids].sort((a, b) => (!!(pl.data[b] || {}).trip - !!(pl.data[a] || {}).trip));

  function renderPlayers() {
    const head = $('[data-players-head]');
    const body = $('[data-players]');
    if (!head || !body) return;
    // Kopf nur einmal bauen (sonst verschwindet beim Aktualisieren, was man gerade ins Suchfeld tippt)
    if (head.dataset.lang !== lang) {
      head.dataset.lang = lang;
      head.innerHTML = `<p class="cr-eyebrow">${t('Zugfahrten verfolgen')}</p>
        <h1 class="mega mega--stack">${t('Spieler.')}<br><span>${t('Wer fährt gerade?')}</span></h1>
        <p class="site-head__lead">${t('Such nach einem Roblox-Namen und verfolge ihn. Dann siehst du hier seine Zugfahrt: Linie, Zug, Ziel und den nächsten Halt.')}</p>
        <form class="sv-hero__bar pl-search" data-player-search novalidate>
          <label class="sv-search">${icon('ph-magnifying-glass')}<span class="sr-only">${t('Roblox-Name oder ID')}</span><input name="q" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(t('Roblox-Name oder ID'))}"></label>
          <button class="site-btn site-btn--brand" type="submit">${t('Suchen')}</button>
        </form>`;
    }
    if (!apiReady()) {
      body.innerHTML = `<div class="sv-empty"><span class="sv-empty__ic">${icon('ph-hard-drives')}</span><h3>${t('Der App-Server fehlt noch')}</h3><p>${t('Zugfahrten verfolgen geht nur mit dem Server der App.')}</p></div>`;
      return;
    }
    let found = '';
    if (pl.finding) found = `<div class="pl-found"><div class="sheet-loading">${icon('ph-spinner-gap')}<span>${t('Suche auf Roblox …')}</span></div></div>`;
    else if (pl.found && pl.found.missing) found = `<div class="pl-found"><p class="cr-note cr-note--bad">${icon('ph-info')}<span>${t('Auf Roblox gibt es niemanden mit „{name}“.', { name: esc(pl.found.q) })}</span></p></div>`;
    else if (pl.found) {
      const id = pl.found.userId;
      const p = pl.data[id] || pl.found;
      const on = isTracked(id);
      found = `<div class="pl-found">
          <span class="pl-found__pic">${playerPic(p, 'avatar--lg')}</span>
          <span class="pl-found__main"><small>${t('Gefunden')}</small><b>${esc(p.displayName || p.username || id)}</b>${p.username ? `<span>@${esc(p.username)}</span>` : ''}${pl.data[id] ? tripLine(pl.data[id]) : ''}</span>
          <span class="pl-found__btns">
            ${p.me ? '' : `<button class="site-btn ${on ? 'site-btn--ghost' : 'site-btn--brand'} site-btn--sm" type="button" data-track="${esc(id)}" aria-pressed="${on}">${icon(on ? 'ph-check' : 'ph-eye')}${on ? t('Wird verfolgt') : t('Verfolgen')}</button>`}
          </span>
        </div>`;
    }
    let list;
    if (!pl.track.length) {
      list = `<div class="sv-empty"><span class="sv-empty__ic">${icon('ph-train')}</span><h3>${t('Noch niemand verfolgt')}</h3><p>${t('Suche oben nach einem Roblox-Namen und tippe auf „Verfolgen“. Sobald er einen Zug fährt, siehst du hier Linie, Ziel und den nächsten Halt.')}</p></div>`;
    } else {
      if (!pl.at) loadTracked();
      const sorted = playersSorted(pl.track);
      const driving = sorted.filter((id) => pl.data[id] && pl.data[id].trip);
      const idle = sorted.filter((id) => !(pl.data[id] && pl.data[id].trip));
      const group = (title, ids, live) => (ids.length ? `<section class="pl-group">
          <h2 class="pl-group__title">${live ? '<i class="pl-group__dot"></i>' : ''}${title}<small>${ids.length}</small></h2>
          <div class="tr-grid" data-reveal>${ids.map(playerCard).join('')}</div>
        </section>` : '');
      list = `<div class="sv-stats pl-stats">
          <div class="sv-stat"><b>${fmt(pl.track.length)}</b><span>${t('Verfolgt')}</span></div>
          <div class="sv-stat"><b>${fmt(driving.length)}</b><span>${t('Gerade unterwegs')}</span></div>
          <div class="sv-stat"><b>${fmt(idle.length)}</b><span>${t('Keine Zugfahrt')}</span></div>
        </div>
        ${group(t('Gerade unterwegs'), driving, true)}${group(t('Keine Zugfahrt'), idle, false)}`;
    }
    body.innerHTML = found + list;
    $$('[data-reveal]', body).forEach((x) => reveal(x));
  }

  // Fenster eines Spielers: nur seine Zugfahrt mit den weiteren Halten
  function playerView(id) {
    const p = pl.data[id];
    if (!p || Date.now() - (p.at || 0) > 30000) loadStatus([id], () => { if (modalView && modalView.name === 'player' && modalView.arg === id) refreshModal(); if (state.page === 'spieler') renderPlayers(); });
    if (!p) return `<div class="sheet-loading">${icon('ph-spinner-gap')}<span>${t('Wird geladen …')}</span></div>`;
    const tr = p.trip;
    const tracked = isTracked(id);
    const trip = tr ? `<section class="trip-box">
        <div class="trip-box__head"><span class="line line--${tripCat(tr)}">${esc(tr.line || tr.train || '')}</span>
          <span><b>${tr.dest ? t('nach {to}', { to: esc(tr.dest) }) : t('unterwegs')}</b><small>${[tr.train, trainName(tr.veh)].filter(Boolean).map(esc).join(' · ')}</small></span></div>
        ${tr.next ? `<p class="train__now">${icon('ph-map-pin')}<span>${t('Nächster Halt')}: <b>${esc(tr.next)}</b></span></p>` : ''}
        ${liveStopsHtml(tr)}
      </section>`
      : `<section class="trip-box is-idle">${icon('ph-train')}<p>${t('Gerade keine Zugfahrt. Sobald {name} einen Zug fährt, steht die Fahrt hier.', { name: esc(p.displayName || p.username || '') })}</p></section>`;
    return `<div class="profile-box profile-box--player">
        <span class="pbig${tr ? ' is-ingame' : ''}">${playerPic(p, 'avatar--xl')}</span>
        <h3>${esc(p.displayName || p.username || id)}</h3>
        ${p.username ? `<p>@${esc(p.username)}</p>` : ''}
      </div>
      ${trip}
      ${p.me ? '' : `<div class="sheet-actions"><button class="btn ${tracked ? 'btn--soft' : 'btn--primary'} btn--lg btn--block" type="button" data-track="${esc(id)}" aria-pressed="${tracked}">${icon(tracked ? 'ph-check' : 'ph-eye')}${tracked ? t('Wird verfolgt – beenden') : t('Verfolgen')}</button></div>`}
      <p class="sheet-note">${t('Angezeigt wird nur die Zugfahrt in Train Sim Germany – nichts anderes.')}</p>`;
  }

  // Push-Nachrichten erscheinen immer als Benachrichtigung des Geräts (sw.js). Ist die App offen, meldet der
  // Service Worker das nur kurz, damit Chatliste und roter Punkt gleich stimmen.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      const m = e.data || {};
      if (m.type === 'tsg-push' && String(m.tag || '').startsWith('chat-')) loadChats(true);
    });
  }

  // ---------- Einladungen ins Spiel ----------
  async function invitePlayer(id, name, btn) {
    if (!sessionToken()) { openModal('profile'); return; }
    if (btn) btn.disabled = true;
    try {
      const r = await api('/api/invites', { method: 'POST', body: { to: String(id) } });
      haptic('success');
      toast(r.sent ? t('Einladung an {name} gesendet', { name: name || r.toName || t('Spieler') })
        : t('Eingeladen – {name} hat aber keine Benachrichtigungen an.', { name: name || r.toName || t('Spieler') }));
    } catch (e) {
      haptic('error');
      toast(e.status === 429 ? t('Du hast gerade sehr viele Einladungen verschickt. Bitte warte etwas.') : errorText(e));
    } finally {
      if (btn) btn.disabled = false;
    }
  }
  const invites = {};
  function inviteView(id) {
    const inv = invites[id];
    if (!inv) {
      invites[id] = 'loading';
      api(`/api/invites/${encodeURIComponent(id)}`).then((r) => { invites[id] = r; }).catch(() => { invites[id] = { error: true }; })
        .finally(() => { if (modalView && modalView.name === 'invite') refreshModal(); });
    }
    if (!inv || inv === 'loading') return `<div class="sheet-loading">${icon('ph-spinner-gap')}<span>${t('Wird geladen …')}</span></div>`;
    if (inv.error) return `<p class="muted">${t('Diese Einladung gibt es nicht mehr.')}</p>`;
    const from = inv.from || {};
    const open = inv.status === 'open' && inv.to === meSub();
    return `<div class="profile-box">
        <span class="pbig">${from.avatar ? `<span class="avatar avatar--img avatar--xl"><img src="${esc(from.avatar)}" alt="" referrerpolicy="no-referrer"></span>` : avatar(from.username || '?', 'avatar--xl')}</span>
        <h3>${esc(from.displayName || from.username || t('Spieler'))}</h3>
        <p>${inv.where ? t('Lädt dich zu Train Sim Germany ein – {where}', { where: esc(inv.where) }) : t('Lädt dich zu Train Sim Germany ein')}</p>
      </div>
      ${open ? `<div class="sheet-actions">
        <a class="btn btn--primary btn--lg btn--block" href="${esc(inv.join)}" target="_blank" rel="noopener" data-invite-answer="join" data-invite-id="${esc(inv.id)}">${icon('phf-play')}${t('Beitreten')}</a>
        <button class="btn btn--soft btn--lg btn--block" type="button" data-invite-answer="decline" data-invite-id="${esc(inv.id)}">${t('Ablehnen')}</button>
      </div>` : `<p class="sheet-note">${inv.status === 'joined' ? t('Angenommen.') : inv.status === 'declined' ? t('Abgelehnt.') : t('Offen.')}</p>`}`;
  }
  document.addEventListener('click', (e) => {
    const inv = e.target.closest('[data-invite-player]');
    if (inv) { invitePlayer(inv.dataset.invitePlayer, inv.dataset.inviteName, inv); return; }
    const ans = e.target.closest('[data-invite-answer]');
    if (ans) {
      const id = ans.dataset.inviteId;
      api(`/api/invites/${encodeURIComponent(id)}/answer`, { method: 'POST', body: { answer: ans.dataset.inviteAnswer } })
        .then((r) => { invites[id] = r; if (ans.dataset.inviteAnswer === 'decline') { toast(t('Einladung abgelehnt')); closeModal(); } })
        .catch((err) => toast(errorText(err)));
    }
  });

  // ---------- Saison-Design: Halloween, Weihnachten, Neujahr, Ostern ----------
  // Nur in der passenden Zeit (deutsche Zeit) und nur, wenn es in den Einstellungen an ist.
  function easterSunday(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return Math.floor(Date.UTC(y, month - 1, day) / 864e5);
  }
  function seasons(y) {
    const day = (mo, d, yy = y) => Math.floor(Date.UTC(yy, mo - 1, d) / 864e5);
    const easter = easterSunday(y);
    return [
      { id: 'newyear', name: t('Neujahr'), from: day(12, 27, y - 1), to: day(1, 6) },
      { id: 'easter', name: t('Ostern'), from: easter - 7, to: easter + 1 },
      { id: 'halloween', name: t('Halloween'), from: day(10, 17), to: day(11, 2) },
      { id: 'christmas', name: t('Weihnachten'), from: day(12, 1), to: day(12, 26) },
      { id: 'newyear', name: t('Neujahr'), from: day(12, 27), to: day(1, 6, y + 1) },
    ];
  }
  function seasonNow() {
    const now = berlinNow();
    return seasons(now.y).find((s) => now.day >= s.from && now.day <= s.to) || null;
  }
  function seasonNext() {
    const now = berlinNow();
    return [...seasons(now.y), ...seasons(now.y + 1)].filter((s) => s.from > now.day).sort((a, b) => a.from - b.from)[0] || null;
  }
  const SEASON_ART = {
    halloween: ['<svg viewBox="0 0 64 32"><path d="M32 10c2-4 4-6 4-6l2 5c6-4 14-4 20 1-5 0-8 3-9 7-4-2-8-1-10 3-2-3-5-4-7-3-2-1-5 0-7 3-2-4-6-5-10-3-1-4-4-7-9-7 6-5 14-5 20-1l2-5s2 2 4 6z" fill="currentColor"/></svg>',
      '<svg viewBox="0 0 32 32"><path d="M16 7c-1-3 1-5 3-5" stroke="#3b6b2a" stroke-width="2.4" fill="none" stroke-linecap="round"/><ellipse cx="16" cy="19" rx="13" ry="11" fill="#F27405"/><path d="M16 8c-4 3-4 19 0 22M16 8c4 3 4 19 0 22M8 10c-4 5-4 14 0 19M24 10c4 5 4 14 0 19" stroke="#C25700" stroke-width="1.4" fill="none"/></svg>'],
    christmas: ['<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#fff"/></svg>'],
    newyear: ['<svg viewBox="0 0 24 24"><path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" fill="#E2B33C"/></svg>'],
    easter: ['<svg viewBox="0 0 24 30"><ellipse cx="12" cy="16" rx="10" ry="13" fill="#F6C5D3"/><path d="M2.5 14c4 2 6-2 9.5 0s5.5 2 9.5 0M2.5 19c4 2 6-2 9.5 0s5.5 2 9.5 0" stroke="#7CC4A6" stroke-width="2" fill="none"/></svg>',
      '<svg viewBox="0 0 24 30"><ellipse cx="12" cy="16" rx="10" ry="13" fill="#FCE38A"/><circle cx="8" cy="12" r="2" fill="#9AB8F0"/><circle cx="15" cy="17" r="2" fill="#9AB8F0"/><circle cx="9" cy="21" r="2" fill="#9AB8F0"/></svg>'],
  };
  function applySeason() {
    const root = document.documentElement;
    const skin = typeof activeSkin === 'function' ? activeSkin() : null;
    if (skin) root.dataset.skin = skin; else delete root.dataset.skin;
    // Fallende Fledermäuse, Schnee …: zum Theme, sonst zur Saison
    const now = fx.season ? seasonNow() : null;
    const s = skin ? { id: skin === 'winter' ? 'christmas' : 'halloween' } : now;
    const old = $('[data-season-fx]');
    if (!s) { delete root.dataset.season; if (old) old.remove(); return; }
    if (root.dataset.season === s.id && old) return;
    root.dataset.season = s.id;
    if (old) old.remove();
    const layer = document.createElement('div');
    layer.className = 'season-fx';
    layer.dataset.seasonFx = '';
    layer.setAttribute('aria-hidden', 'true');
    const art = SEASON_ART[s.id];
    const n = s.id === 'christmas' ? 26 : 10;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('i');
      el.innerHTML = art[i % art.length];
      el.style.setProperty('--x', `${Math.round(Math.random() * 100)}%`);
      el.style.setProperty('--d', `${(s.id === 'christmas' ? 9 : 14) + Math.random() * 10}s`);
      el.style.setProperty('--delay', `${-Math.random() * 20}s`);
      el.style.setProperty('--s', `${s.id === 'christmas' ? 4 + Math.random() * 6 : 16 + Math.random() * 16}px`);
      layer.appendChild(el);
    }
    document.body.appendChild(layer);
  }
  function setSeason(on, { quiet = false } = {}) {
    fx.season = !!on;
    store.set('tsg-season', fx.season);
    applySeason();
    if (!quiet) settingsChanged();
    renderSeasonSettings();
  }
  function renderSeasonSettings() {
    const box = $('[data-season-set]');
    if (!box) return;
    const now = seasonNow();
    const next = seasonNext();
    const range = (s) => `${dtf({ day: 'numeric', month: 'short' }).format(dateOf(s.from))} – ${dtf({ day: 'numeric', month: 'short' }).format(dateOf(s.to))}`;
    box.innerHTML = `<label class="toggle">
        <span class="toggle__text"><b>${t('Saison-Design')}</b><small>${now ? t('Gerade: {name} ({range})', { name: now.name, range: range(now) }) : next ? t('Gerade keine Saison. Als Nächstes: {name} ab {date}', { name: next.name, date: dtf({ day: 'numeric', month: 'long' }).format(dateOf(next.from)) }) : ''}</small>
          <small class="toggle__note">${icon('ph-info')}${t('Halloween, Weihnachten, Neujahr und Ostern – automatisch zur passenden Zeit.')}</small></span>
        <input type="checkbox" role="switch" data-season-toggle${fx.season ? ' checked' : ''}><span class="toggle__ui" aria-hidden="true"></span>
      </label>`;
  }

  // ---------- Einstellungen: Hauptliste und Unterseiten (#/einstellungen/<bereich>) ----------
  // Jede Zeile öffnet eine eigene Seite mit allem, was zu ihr gehört – z. B. „Privatsphäre“ → alle Schalter dazu.
  const SET_PAGES = [
    { group: 'Konto', items: [
      { id: 'konto', ic: 'ph-link', label: 'Roblox-Konto' },
      { id: 'privacy', ic: 'ph-shield-check', label: 'Privatsphäre' },
      { id: 'benachrichtigungen', ic: 'ph-bell', label: 'Benachrichtigungen' },
    ] },
    { group: 'App', items: [
      { id: 'darstellung', ic: 'ph-palette', label: 'Darstellung' },
      { id: 'themes', ic: 'ph-sparkle', label: 'Themes' },
      { id: 'app-symbol', ic: 'ph-squares-four', label: 'App-Symbol' },
      { id: 'bewegung', ic: 'ph-play', label: 'Bewegung & Haptik' },
      { id: 'sprache', ic: 'ph-globe', label: 'Sprache' },
      { id: 'app', ic: 'ph-download-simple', label: 'App installieren' },
    ] },
    { group: 'Info', items: [
      { id: 'rechtliches', ic: 'ph-file-text', label: 'Rechtliches' },
    ] },
  ];
  const setPage = (id) => SET_PAGES.flatMap((g) => g.items).find((x) => x.id === id) || null;
  function setValue(id) {
    if (id === 'darstellung') return { system: t('Wie das Gerät'), light: t('Hell'), dark: t('Dunkel') }[themeMode()];
    if (id === 'themes') return t(SKINS.find((x) => x.id === fx.skin).name);
    if (id === 'app-symbol') return t((APP_ICONS.find((x) => x.id === fx.icon) || APP_ICONS[0]).name);
    if (id === 'sprache') { const l = langSetting(); return l === 'auto' ? t('Automatisch') : l.toUpperCase(); }
    if (id === 'konto') return state.profile ? `@${state.profile.username}` : t('Nicht verbunden');
    return '';
  }
  function renderSettingsNav() {
    const sub = state.settingsSub;
    const page = sub ? setPage(sub) : null;
    const box = $('[data-settings]');
    if (!box) return;
    box.dataset.sub = page ? sub : '';
    $$('[data-set-sec]', box).forEach((sec) => { sec.hidden = !page || sec.dataset.setSec !== sub; });
    const head = $('[data-settings-head]');
    if (head) {
      head.innerHTML = page
        ? `<a class="set-back" href="#/einstellungen" aria-label="${esc(t('Zurück zu den Einstellungen'))}">${icon('ph-arrow-left')}</a><div class="appbar__title"><span class="appbar__label">${t('Einstellungen')}</span><h1 class="appbar__value">${esc(t(page.label))}</h1></div>`
        : `<div class="appbar__title"><span class="appbar__label">App</span><h1 class="appbar__value">${t('Einstellungen')}</h1></div>`;
    }
    const menu = $('[data-settings-menu]');
    menu.hidden = !!page;
    if (page) return;
    const p = state.profile;
    const r = rankOf(state.rank);
    menu.innerHTML = `<button class="set-me" type="button" data-open="profile">${ringHTML(p, r, 'avatar-ring--lg')}<span><b>${p ? esc(p.displayName || p.username) : t('Gast')}</b><small>${p ? `@${esc(p.username)}` : t('Mit Roblox anmelden')}</small></span>${rankPill(r)}${icon('ph-caret-right', 'set-row__chev')}</button>
      ${SET_PAGES.map((g) => `<div class="set-group"><h2>${esc(t(g.group))}</h2><div class="set-list">${g.items.map((x) => `<a class="set-row" href="${x.href || `#/einstellungen/${x.id}`}">
        <span class="set-row__ic">${icon(x.ic)}</span><span class="set-row__label">${esc(t(x.label))}</span><span class="set-row__val">${esc(setValue(x.id) || '')}</span>${icon('ph-caret-right', 'set-row__chev')}</a>`).join('')}</div></div>`).join('')}`;
  }

  // ---------- Themes: ganzes Design statt nur Hell/Dunkel ----------
  // auto = zur Saison (Halloween, Weihnachten), sonst Standard. Halloween: Nachthimmel, Mond, Spinnweben, Fledermäuse,
  // Kürbis-Farben und eine kleine Animation bei jedem Tippen auf einen Knopf.
  const SKINS = [
    { id: 'auto', name: 'Automatisch', desc: 'Zur Saison das passende Theme, sonst Standard' },
    { id: 'standard', name: 'Standard', desc: 'Hell oder dunkel wie unter „Darstellung“' },
    { id: 'halloween', name: 'Halloween', desc: 'Nachthimmel, Spinnweben, Fledermäuse und Kürbisse' },
    { id: 'winter', name: 'Winter', desc: 'Verschneit, mit Lichterkette und Schneeflocken' },
  ];
  fx.skin = SKINS.some((x) => x.id === store.get('tsg-skin', 'auto')) ? store.get('tsg-skin', 'auto') : 'auto';
  function activeSkin() {
    if (fx.skin === 'standard') return null;
    if (fx.skin !== 'auto') return fx.skin;
    const s = fx.season ? seasonNow() : null;
    return s && s.id === 'halloween' ? 'halloween' : s && s.id === 'christmas' ? 'winter' : null;
  }
  function setSkin(id, { quiet = false } = {}) {
    if (!SKINS.some((x) => x.id === id)) return;
    fx.skin = id;
    store.set('tsg-skin', id);
    applySeason();
    if (!quiet) { settingsChanged(); haptic('select'); toast(t('Theme: {name}', { name: t(SKINS.find((x) => x.id === id).name) })); }
    if (state.page === 'einstellungen') renderSettings();
  }
  function renderSkinPicker() {
    const box = $('[data-skin-picker]');
    if (!box) return;
    const now = activeSkin();
    box.innerHTML = SKINS.map((x) => `<button type="button" class="skin-card skin-card--${x.id}" data-skin-set="${x.id}" aria-pressed="${fx.skin === x.id}">
        <span class="skin-card__preview" aria-hidden="true"><i></i><i></i><i></i><b></b></span>
        <span class="skin-card__text"><b>${esc(t(x.name))}${x.id === 'auto' && now ? ` · ${esc(t(SKINS.find((k) => k.id === now).name))}` : ''}</b><small>${esc(t(x.desc))}</small></span>
      </button>`).join('');
  }
  // Kleine Animation beim Tippen (nur mit Theme und Animationen an)
  const SKIN_POP = {
    halloween: ['🦇', '🎃', '👻', '🕸️', '🍬'],
    winter: ['❄️', '✨', '❄️', '⭐'],
  };
  document.addEventListener('pointerdown', (e) => {
    const skin = document.documentElement.dataset.skin;
    if (!skin || !SKIN_POP[skin] || reducedMotion()) return;
    const btn = e.target.closest('button, .btn, a.btn, [role="tab"], .set-row');
    if (!btn) return;
    const list = SKIN_POP[skin];
    for (let i = 0; i < 5; i++) {
      const el = document.createElement('span');
      el.className = 'skin-pop';
      el.textContent = list[(Math.random() * list.length) | 0];
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
      el.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 140)}px`);
      el.style.setProperty('--dy', `${Math.round(-40 - Math.random() * 90)}px`);
      el.style.setProperty('--rot', `${Math.round((Math.random() - 0.5) * 120)}deg`);
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 900);
    }
  }, { passive: true });

  // ---------- App-Symbol: Varianten des Zeichens, als Favicon und für „Zum Home-Bildschirm“ ----------
  const APP_ICONS = [
    { id: 'standard', name: 'Standard', bg: '#FFFFFF', body: '#E3001B', win: '#1B1F27', s1: '#1B1F27', s2: '#FFC400', rail: '#8A909A' },
    { id: 'dunkel', name: 'Dunkel', bg: '#0F1217', body: '#E3001B', win: '#2A2F3A', s1: '#2A2F3A', s2: '#FFC400', rail: '#555B66' },
    { id: 'rot', name: 'Rot', bg: '#E3001B', body: '#FFFFFF', win: '#1B1F27', s1: '#1B1F27', s2: '#FFC400', rail: '#FFFFFF' },
    { id: 'nacht', name: 'Nacht', bg: '#0C1A3A', body: '#4F8CFF', win: '#0C1A3A', s1: '#0C1A3A', s2: '#FFFFFF', rail: '#6E83B5' },
    { id: 'halloween', name: 'Halloween', bg: '#1A0F2A', body: '#FF7A1A', win: '#2B1740', s1: '#2B1740', s2: '#A6FF4D', rail: '#8C6BB5' },
    { id: 'winter', name: 'Winter', bg: '#EAF4FF', body: '#2E6FD8', win: '#13294B', s1: '#13294B', s2: '#FFFFFF', rail: '#9DB8D8' },
    { id: 'gold', name: 'Gold', bg: '#111111', body: '#E2B33C', win: '#111111', s1: '#111111', s2: '#FFF3C4', rail: '#8A7A4A' },
    { id: 'gruen', name: 'Grün', bg: '#FFFFFF', body: '#408335', win: '#1B1F27', s1: '#1B1F27', s2: '#FFC400', rail: '#8A909A' },
  ];
  fx.icon = APP_ICONS.some((x) => x.id === store.get('tsg-appicon', 'standard')) ? store.get('tsg-appicon', 'standard') : 'standard';
  const appIconSvg = (v, rx = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${rx}" fill="${v.bg}"/><g transform="translate(66 168.6) scale(.95)"><defs><clipPath id="c${v.id}"><path d="M56 24H248C316 24 366 64 394 134C400 150 390 168 372 168H28C16 168 9 157 12 146L46 32C48 27 51 24 56 24Z"/></clipPath></defs><path d="M56 24H248C316 24 366 64 394 134C400 150 390 168 372 168H28C16 168 9 157 12 146L46 32C48 27 51 24 56 24Z" fill="${v.body}"/><g clip-path="url(#c${v.id})"><path d="M68 54H262C304 56 340 78 362 110H68C61 110 56 105 56 98V66C56 59 61 54 68 54Z" fill="${v.win}"/><rect x="0" y="126" width="400" height="12" fill="${v.s1}"/><rect x="0" y="144" width="400" height="12" fill="${v.s2}"/></g><rect x="34" y="188" width="362" height="11" rx="5.5" fill="${v.rail}"/><rect x="2" y="188" width="20" height="11" rx="5.5" fill="${v.rail}"/></g></svg>`;
  async function iconPng(v, size) {
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(appIconSvg(v))}`;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    cv.getContext('2d').drawImage(img, 0, 0, size, size);
    return cv.toDataURL('image/png');
  }
  async function applyAppIcon() {
    const v = APP_ICONS.find((x) => x.id === fx.icon) || APP_ICONS[0];
    const touch = $('link[data-app-icon]');
    const fav = $('link[data-app-favicon]');
    if (v.id === 'standard') {
      if (touch) touch.href = 'assets/icons/apple-touch-icon.png';
      if (fav) fav.href = 'assets/icons/favicon-32.png';
      const svgFav = $('link[rel="icon"][type="image/svg+xml"]');
      if (svgFav) svgFav.href = 'assets/img/favicon.svg';
      return;
    }
    try {
      if (touch) touch.href = await iconPng(v, 180);
      if (fav) fav.href = await iconPng(v, 64);
      const svgFav = $('link[rel="icon"][type="image/svg+xml"]');
      if (svgFav) svgFav.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(appIconSvg(v, 112))}`;
    } catch (e) { /* Symbol bleibt */ }
  }
  function setAppIcon(id) {
    if (!APP_ICONS.some((x) => x.id === id)) return;
    fx.icon = id;
    store.set('tsg-appicon', id);
    applyAppIcon();
    settingsChanged();
    haptic('select');
    toast(t('App-Symbol: {name}', { name: t(APP_ICONS.find((x) => x.id === id).name) }));
    if (state.page === 'einstellungen') renderSettings();
  }
  function renderIconPicker() {
    const box = $('[data-icon-picker]');
    if (!box) return;
    box.innerHTML = `<div class="icon-grid">${APP_ICONS.map((v) => `<button type="button" class="icon-opt" data-icon-set="${v.id}" aria-pressed="${fx.icon === v.id}">
        <span class="icon-opt__img">${appIconSvg(v, 112)}</span><span>${esc(t(v.name))}</span></button>`).join('')}</div>
      <p class="set-note">${icon('ph-info')}<span>${t('Das Symbol gilt sofort im Browser-Tab. Auf dem Home-Bildschirm übernimmt das Gerät es, wenn du die App neu hinzufügst (iPhone/iPad: Teilen → „Zum Home-Bildschirm“). Installierte Android-Apps behalten ihr Symbol, bis sie neu installiert werden.')}</span></p>`;
  }

  // ---------- Echte Zahlen: Gruppe, Spiel, Discord ----------
  const inviteCode = (String(D.links.discord).match(/discord\.(?:gg|com\/invite)\/([\w-]+)/) || [])[1];
  function applyStats(s) {
    const st = D.stats;
    ['groupMembers', 'visits', 'favorites', 'discordMembers', 'discordOnline'].forEach((k) => { if (Number.isFinite(s[k])) st[k] = s[k]; });
    // Roblox verbirgt Besuche bei privaten bzw. nicht freigegebenen Spielen: dann zählt das Backend selbst – jede
    // Roblox-Nutzer-ID nur einmal (wer zehnmal beitritt, ist ein Besuch)
    st.restricted = !!s.restricted;
    if (s.counted && Number.isFinite(s.counted.players) && (st.restricted || !Number.isFinite(s.visits))) st.visits = s.counted.players;
    if (Number.isFinite(s.playing)) { st.online = s.playing; state.online = s.playing; state.liveOnline = true; }
    if (Array.isArray(s.roles)) {
      const counts = {};
      s.roles.forEach((r) => {
        if (!r.rank || /^[-–\s]+$/.test(r.name)) return; // Gast-Rolle und Trennlinien
        const k = rankFromRole(r);
        counts[k] = (counts[k] || 0) + (r.memberCount || 0);
      });
      RANKS.forEach((r) => { if (!r.guest && counts[r.name] != null) r.members = counts[r.name]; });
    }
    state.liveStats = true;
  }
  async function browserStats() {
    const R = D.roblox;
    const out = {};
    const j = (u) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
    await Promise.allSettled([
      RBX.groupId && j(`${R.groupsApi}/v1/groups/${RBX.groupId}`).then((g) => { out.groupMembers = g.memberCount; }),
      RBX.groupId && j(`${R.groupsApi}/v1/groups/${RBX.groupId}/roles`).then((r) => { out.roles = r.roles; }),
      placeId && j(`${R.apisApi}/universes/v1/places/${placeId}/universe`).then((u) => Promise.allSettled([
        j(`${R.gamesApi}/v1/games?universeIds=${u.universeId}`).then((g) => { const x = (g.data || [])[0]; if (x) Object.assign(out, { playing: x.playing, visits: x.visits, favorites: x.favoritedCount }); }),
        j(`${R.gamesApi}/v1/games/${u.universeId}/favorites/count`).then((f) => { if (Number.isFinite(f.favoritesCount)) out.favorites = f.favoritesCount; }),
      ])),
      inviteCode && j(`${R.discordApi}/invites/${inviteCode}?with_counts=true`)
        .then((x) => Object.assign(out, { discordMembers: x.approximate_member_count, discordOnline: x.approximate_presence_count })),
    ]);
    return out;
  }
  async function loadStats() {
    let s = {};
    if (apiReady()) { try { s = await api('/api/stats'); } catch (e) { /* weiter ohne Backend */ } }
    // Fehlt dem Backend eine Zahl (Roblox hat abgelehnt), fragt die App selbst über roproxy.com
    if (['groupMembers', 'discordMembers', 'visits', 'favorites', 'playing'].some((k) => s[k] == null)) {
      const b = await browserStats();
      Object.keys(b).forEach((k) => { if (s[k] == null) s[k] = b[k]; });
    }
    if (Object.keys(s).some((k) => k !== 'at' && s[k] != null)) {
      store.set('tsg-live', { ...s, at: Date.now() });
      applyStats(s);
      safeRender();
    }
  }
  { const cached = store.get('tsg-live', null); if (cached) applyStats(cached); }

  // ---------- Einstellungen auf allen Geräten (mit Backend und Roblox-Login) ----------
  const settingsAt = () => store.get('tsg-settings-at', 0);
  const currentSettings = () => ({
    theme: themeMode(), lang: langSetting(), bell: state.bell, remind: [...remind.ids], remindOff: [...remind.off], favs: [...state.favs],
    track: pl.track, haptics: fx.haptics, motion: fx.motion, season: fx.season, skin: fx.skin, icon: fx.icon, updatedAt: settingsAt(),
  });
  let settingsTimer = null;
  let applyingSettings = false;
  function settingsChanged() {
    if (applyingSettings) return;
    store.set('tsg-settings-at', Date.now());
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(pushSettings, 600);
  }
  async function pushSettings() {
    if (!apiReady() || !sessionToken()) return;
    try { await api('/api/me/settings', { method: 'PUT', body: currentSettings() }); } catch (e) { /* später nochmal */ }
  }
  async function applySettings(s) {
    applyingSettings = true;
    try {
      store.set('tsg-settings-at', s.updatedAt || Date.now());
      if (s.theme && s.theme !== themeMode()) setTheme(s.theme, { quiet: true });
      state.bell = !!s.bell;
      store.set('tsg-bell', state.bell);
      remind.ids = new Set(s.remind || []);
      remind.off = new Set(s.remindOff || []);
      saveRemind();
      state.favs = new Set(s.favs || []);
      store.set('tsg-favs', [...state.favs]);
      if (Array.isArray(s.track)) { pl.track = s.track.filter((x) => /^\d{1,20}$/.test(x)); store.set('tsg-track', pl.track); }
      if (typeof s.haptics === 'boolean') setHaptics(s.haptics, { quiet: true });
      if (typeof s.motion === 'boolean') setMotion(s.motion, { quiet: true });
      if (typeof s.season === 'boolean') setSeason(s.season, { quiet: true });
      if (s.skin && s.skin !== fx.skin) setSkin(s.skin, { quiet: true });
      if (s.icon && s.icon !== fx.icon) { fx.icon = s.icon; store.set('tsg-appicon', s.icon); applyAppIcon(); }
      if (Array.isArray(s.wish)) store.set('tsg-wish', s.wish);
      if (s.lang && s.lang !== langSetting()) await setLanguage(s.lang);
    } finally {
      applyingSettings = false;
    }
  }

  // ---------- Auswahl-Sheets ----------
  const modal = $('[data-modal]');
  let modalView = null;
  const VIEWS = {
    profile: {
      title: () => t('Profil'),
      render: () => {
        const p = state.profile;
        const r = rankOf(state.rank);
        if (!p && loginReady()) {
          return `<div class="profile-box">
              ${ringHTML(null, r, 'avatar-ring--xl')}
              <h3>${t('Mit Roblox anmelden')}</h3>
              <p>${t('Du wirst zu Roblox weitergeleitet und bestätigst dort die Anmeldung. Wir erhalten nur deinen Namen, Anzeigenamen und dein Profilbild – nie dein Passwort.')}</p>
            </div>
            <div class="sheet-actions">
              <button class="btn btn--primary btn--lg btn--block" type="button" data-roblox-login>${icon('ph-sign-in')}${t('Mit Roblox anmelden')}</button>
            </div>
            <p class="sheet-note">${t('Mit der Anmeldung akzeptierst du die {terms} und die {privacy}.', {
              terms: `<a href="terms.html">${t('Nutzungsbedingungen')}</a>`, privacy: `<a href="privacy.html">${t('Datenschutzerklärung')}</a>`,
            })}</p>`;
        }
        if (!p) {
          return `<div class="profile-box">
              ${ringHTML(null, r, 'avatar-ring--xl')}
              <h3>${t('Mit Roblox verbinden')}</h3>
              <p>${t('Dein Roblox-Name und dein Profilbild erscheinen dann oben in der Kopfzeile, unten in der Leiste und im Menü.')}</p>
            </div>
            <form class="connect" data-connect novalidate>
              <div class="f"><label class="f__label" for="rbx-name">${t('Roblox-Benutzername')}</label><input id="rbx-name" name="username" autocomplete="username" placeholder="${esc(t('z. B. {name}', { name: D.me.username }))}"></div>
              <button class="btn btn--primary btn--lg btn--block" type="submit">${icon('ph-link')}${t('Verbinden')}</button>
              <p class="sheet-note">${t('Es wird nur dein öffentliches Roblox-Profil geladen – kein Passwort, kein Login.')}</p>
            </form>`;
        }
        return `<div class="profile-box">
            ${ringHTML(p, r, 'avatar-ring--xl')}
            <h3>${esc(p.displayName || p.username)}</h3>
            <p>@${esc(p.username)}</p>
            <button class="rank-pill rank-pill--btn" type="button" data-open="rank" style="--rc:${r.color}">[${esc(r.prefix)}] ${esc(r.name)}${icon('ph-caret-down')}</button>
          </div>
          ${p.oauth && RBX.groupId ? `<p class="group-note">${icon('ph-users-three')}<span>${state.groupRole
            ? t('Rolle in der Roblox-Gruppe: {role}', { role: `<b>${esc(state.groupRole.name)}</b>` })
            : state.rankFromGroup ? t('Du bist noch nicht in der Roblox-Gruppe und bist deshalb Gast.') : t('Deine Rolle in der Roblox-Gruppe wird geladen …')}</span>${!state.groupRole && state.rankFromGroup ? `<a href="${esc(D.links.group)}" target="_blank" rel="noopener">${t('Beitreten')}</a>` : ''}</p>` : ''}
          ${visibilityNote(privacy().profile, t('Dein Profil ist öffentlich.'), t('Dein Profil ist privat.'))}
          <div class="sheet-actions">
            <button class="btn btn--primary btn--lg btn--block" type="button" data-open="stats">${icon('ph-chart-line-up')}${t('Meine Statistik')}</button>
            ${p.userId ? `<a class="btn btn--outline btn--lg btn--block" href="https://www.roblox.com/users/${encodeURIComponent(p.userId)}/profile" target="_blank" rel="noopener">${icon('ph-arrow-square-out')}${t('Roblox-Profil ansehen')}</a>` : ''}
            <button class="btn btn--soft btn--lg btn--block" type="button" data-disconnect>${p.oauth ? t('Abmelden') : t('Verbindung trennen')}</button>
          </div>`;
      },
    },
    stats: {
      title: () => t('Meine Statistik'),
      render: () => {
        const p = state.profile;
        const r = rankOf(state.rank);
        const st = myStats();
        const max = Math.max(...st.week.map((d) => d.min), 1);
        return `<div class="mystats">
          <div class="mystats__head">${ringHTML(p, r, 'avatar-ring--lg')}<div><b>${esc(p ? p.displayName || p.username : D.me.username)}</b>${rankPill(r, ` ${esc(r.name)}`)}</div></div>
          ${visibilityNote(statsPublic(), t('Deine Statistik ist öffentlich.'), t('Deine Statistik sieht nur du.'))}
          <dl class="mystats__grid">
            ${st.tiles.map((x) => `<div${x.wide ? ' class="is-wide"' : ''}><dt>${icon(x.ic)}${x.label}</dt><dd>${x.value}</dd></div>`).join('')}
          </dl>
          ${st.groups.map((g) => `<section class="mystats__block">
            <h4 class="mystats__title"><span class="mystats__dot" style="--c:var(--c-${g.cat})"></span>${g.title}<small>${t('{n} Fahrten', { n: fmt(g.total) })}</small></h4>
            <p class="mystats__sub">${t('Deine meistgefahrenen Züge')}</p>
            <div class="hbars" style="--viz:var(--c-${g.cat})">${hbarList(g.rows, t('Fahrten'))}</div>
          </section>`).join('')}
          <section class="mystats__block">
            <h4 class="mystats__title"><span class="mystats__dot"></span>${t('Alle Strecken')}<small>${t('{n} Fahrten', { n: fmt(st.trips) })}</small></h4>
            <p class="mystats__sub">${t('Wie oft du jede Strecke gefahren bist')}</p>
            <ol class="rank-list rank-list--compact">${routeList(st.routes, st.routes[0] ? st.routes[0].value : 0)}</ol>
          </section>
          <h4 class="mystats__title">${t('Diese Woche gespielt')}</h4>
          <div class="week-bars">${st.week.map((d) => `<div class="week-bars__col${d.today ? ' is-today' : ''}"><span class="week-bars__val">${nf1.format(Math.round(d.min / 6) / 10)} h</span><span class="week-bars__bar"><i style="height:${Math.max(4, (d.min / max) * 100)}%"></i></span><span class="week-bars__day">${d.label}</span></div>`).join('')}</div>
          <p class="sheet-note">${t('Alle Werte kommen direkt aus dem Spiel. Was noch nicht passiert ist, steht auf 0.')}</p>
          <div class="sheet-actions"><button class="btn btn--soft btn--lg btn--block" type="button" data-open="profile">${icon('ph-arrow-left')}${t('Zurück zum Profil')}</button></div>
        </div>`;
      },
    },
    rank: {
      title: () => t('Dein Rang'),
      render: () => `<div class="opt-list" role="radiogroup" aria-label="${esc(t('Rang wählen'))}">${RANKS.map((r) => `
        <button class="opt" type="button" role="radio" aria-checked="${r.name === state.rank}" data-rank="${r.name}"${state.rankFromGroup ? ' disabled' : ''}>
          ${rankPill(r)}<span><b>${esc(r.name)}</b><small>${esc(t(r.label))} · ${esc(t(r.desc))}</small></span>
          ${r.name === state.rank ? icon('ph-check') : ''}
        </button>`).join('')}</div>
        <p class="sheet-note">${state.rankFromGroup ? t('Dein Rang kommt automatisch aus der Roblox-Gruppe.') : t('Demo: Später wird dein Rang automatisch aus der Roblox-Gruppe übernommen.')}</p>`,
    },
    date: {
      title: () => t('Trainingsdatum wählen'),
      render: () => {
        const now = berlinNow();
        const list = trainingsList();
        const days = Array.from({ length: 14 }, (_, i) => now.day + i);
        return `<div class="date-grid">
          ${days.slice(0, 7).map((d) => `<span class="date-grid__wd">${wdShort(d)}</span>`).join('')}
          ${days.map((d) => `<button class="date-cell${list.some((tn) => tn.day === d) ? ' has-trainings' : ''}" type="button" aria-pressed="${d === state.trainingDay}" data-pick-day="${d}" aria-label="${dayName(d, { long: true })}">${dateOf(d).getUTCDate()}<i></i></button>`).join('')}
        </div>
        <p class="sheet-note">${t('Rote Punkte zeigen Tage mit Trainings.')}</p>`;
      },
    },
    player: {
      title: () => t('Spieler'),
      render: (id) => playerView(id),
    },
    invite: {
      title: () => t('Einladung'),
      render: (id) => inviteView(id),
    },
    role: {
      title: (arg) => (String(arg).endsWith(':new') ? t('Neue Rolle') : t('Rolle bearbeiten')),
      render: (arg) => roleView(arg),
    },
    memroles: {
      title: () => t('Rollen vergeben'),
      render: (arg) => memberRolesView(arg),
    },
    botnew: {
      title: () => t('Neuer Bot'),
      render: (cid) => botNewView(cid),
    },
    bot: {
      title: (arg) => { const b = botsFull[String(arg).split(':')[1]]; return b && b.name ? b.name : t('Bot'); },
      render: (arg) => botView(arg),
    },
    channel: {
      title: (arg) => { const [cid, ch] = String(arg).split(':'); const c = chat.conv[cid]; const x = c && ch !== 'neu' ? chFind(c, ch) : null; return x ? `#${x.name}` : t('Neuer Kanal'); },
      render: (arg) => channelView(arg),
    },
    category: {
      title: (arg) => (String(arg).split(':')[1] === 'neu' ? t('Neue Kategorie') : t('Kategorie bearbeiten')),
      render: (arg) => categoryView(arg),
    },
    'server-players': {
      title: () => t('Alle Spieler'),
      render: (id) => serverPeopleView(id),
    },
    trip: {
      title: () => t('Fahrtverlauf'),
      render: (id) => tripView(id),
    },
    station: {
      title: () => t('Abfahrten'),
      render: (name) => stationView(name),
    },
    // Privater Server: Einstellungen des Besitzers
    pserver: {
      title: () => t('Privater Server'),
      render: (id) => pserverForm(id),
    },
    // Foto aus dem Chat in groß
    photo: {
      title: () => t('Foto'),
      render: (src) => `<div class="photo-view"><img src="${esc(src)}" alt=""><a class="btn btn--soft btn--block" href="${esc(src)}" target="_blank" rel="noopener">${icon('ph-download-simple')}${t('Original öffnen')}</a></div>`,
    },
    news: {
      title: () => t('Neuigkeit'),
      hero: true,
      render: (id) => {
        const n = newsItems().find((x) => String(x.id) === String(id));
        if (!n) return `<p class="muted">${t('Diese Neuigkeit gibt es nicht mehr.')}</p>`;
        return `<div class="detail">
          ${mediaHtml(n)}
          <div class="detail__top">${catTag(n)}<span class="tag">${newsDate(n)}</span>${n.author ? `<span class="tag">${icon('ph-pencil-simple')}${esc(n.author)}</span>` : ''}${n.edited ? `<span class="tag">${t('bearbeitet')}</span>` : ''}</div>
          <h3>${esc(t(n.title))}</h3>
          <p class="detail__text">${esc(t(n.text))}</p>
          <div class="btn-stack">${newsButtons(n)}
            ${n.remote && isMine(n.authorId) ? `<button class="btn btn--soft btn--block btn--lg" type="button" data-news-edit="${esc(n.id)}">${icon('ph-pencil-simple')}${t('Bearbeiten')}</button>
            <button class="btn btn--danger btn--block btn--lg" type="button" data-news-del="${esc(n.id)}">${icon('ph-trash')}${t('Neuigkeit löschen')}</button>` : ''}</div>
        </div>`;
      },
    },
    training: {
      title: () => t('Training'),
      hero: true,
      render: (id) => {
        const tn = findTraining(id);
        if (!tn) return `<p class="muted">${t('Dieses Training ist bereits vorbei.')}</p>`;
        const st = trainingState(tn);
        const type = typeOf(tn.type);
        const ss = serverStatus(tn);
        const locked = isLocked(tn);
        // „Join Now“ ist nur aktiv (hellblau), solange der Trainingsserver offen ist
        const action = ss.open && !locked
          ? `<a class="btn btn--join btn--lg btn--block" href="${esc(joinUrl(trainingServer(tn)))}" target="_blank" rel="noopener">${icon('phf-play')}Join Now</a>`
          : `<button class="btn btn--join btn--lg btn--block" type="button" disabled>${icon(locked ? 'ph-lock' : 'phf-play')}Join Now</button>`;
        const hint = locked ? '' : ss.open ? t('Der Trainingsserver ist offen – du kannst jetzt beitreten.') : t('Der Trainingsserver öffnet {n} Minuten vor Beginn.', { n: SERVER_OPENS });
        return `<div class="detail">
          <div class="detail__media"><img src="assets/img/${tn.img}" alt=""></div>
          <div class="detail__top">${roleBadge(tn.type)}${serverPill(tn)}<span class="tag">${relTime(tn.start)}</span></div>
          <h3>${esc(t(tn.title))}</h3>
          <p>${esc(tn.text || (type ? t(type.text) : ''))}</p>
          <dl>
            <div><dt>${icon('ph-calendar-blank')}${t('Datum')}</dt><dd>${dayName(tn.day, { long: true })}</dd></div>
            <div><dt>${icon('ph-clock')}${t('Uhrzeit')}</dt><dd>${t('{time} Uhr', { time: `${tn.time} – ${hhmm(tn.end)}` })}</dd></div>
            <div><dt>${icon('ph-hard-drives')}${t('Server')}</dt><dd>${esc(t(tn.server || '–'))}</dd></div>
            <div><dt>${icon('ph-users-three')}${t('Leitung')}</dt><dd>${hostHtml(tn, 'host--sm')}</dd></div>
            ${tn.helpers && tn.helpers.length ? `<div><dt>${icon('ph-users')}${t('Supervisors')}</dt><dd>${tn.helpers.map(esc).join(', ')}</dd></div>` : ''}
            ${tn.remote ? `<div><dt>${icon('phf-user')}${t('Plätze')}</dt><dd>${t('max. {n}', { n: tn.slots })}</dd></div>` : ''}
          </dl>
          ${tn.remote ? '' : `<div class="occ">
            <div class="occ__row"><span class="status status--${st.level}">${st.text}</span><b>${t('{a}/{b} Plätze', { a: tn.taken, b: tn.slots })}</b></div>
            <div class="bar bar--${st.level}"><span style="width:${(tn.taken / tn.slots) * 100}%"></span></div>
          </div>`}
          ${locked ? `<div class="lock">${icon('ph-lock')}<span>${t('Für dieses Training brauchst du mindestens den Rang {rank}. Dein Rang: {mine}.', { rank: esc(tn.req), mine: esc(state.rank) })}</span></div>` : ''}
          ${action}
          <button class="btn btn--remind btn--lg btn--block" type="button" data-remind="${tn.id}" aria-pressed="${isReminded(tn)}">${icon(isReminded(tn) ? 'phf-bell-ringing' : 'ph-bell')}${isReminded(tn) ? t('Benachrichtigung an') : t('Benachrichtigen, wenn der Server öffnet')}</button>
          ${hint ? `<p class="sheet-note join-hint">${hint}</p>` : ''}
          ${tn.remote && isMine(tn.hostId) ? `<button class="btn btn--danger btn--lg btn--block" type="button" data-training-del="${esc(tn.id)}">${icon('ph-trash')}${t('Training löschen')}</button>` : ''}
        </div>`;
      },
    },
    'training-new': {
      title: () => t('Training anbieten'),
      render: () => trainingForm(),
    },
    'news-new': {
      title: () => t('Neuigkeit erstellen'),
      render: () => newsForm(),
    },
    'news-edit': {
      title: () => t('Neuigkeit bearbeiten'),
      render: (id) => {
        const n = (remote.news || []).find((x) => x.id === id);
        return n && isMine(n.authorId) ? newsForm(n) : `<p class="muted">${t('Diese Neuigkeit gibt es nicht mehr.')}</p>`;
      },
    },
    'job-edit': {
      title: () => t('Stelle bearbeiten'),
      render: (id) => jobEditView(id),
    },
    'backend-setup': {
      title: () => t('App-Server'),
      render: () => backendSetupHtml(),
    },
  };
  // Bild oder Video oben in der Detailansicht. video: YouTube-Link oder eigene Datei (assets/video/…)
  const youtubeId = (url) => {
    const m = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
    return m ? m[1] : null;
  };
  // ---------- Videoplayer in DB-Farben ----------
  // Eigene Bedienung statt der des Browsers: großer Play-Knopf, Fortschritt in DB-Rot, Zeit, Ton, Tempo,
  // Bild-in-Bild und Vollbild. Beim Abspielen blendet sich die Leiste nach kurzer Zeit aus.
  function videoPlayer(src, { poster = '', cls = '' } = {}) {
    const pip = typeof document !== 'undefined' && document.pictureInPictureEnabled;
    return `<div class="vp ${cls}" data-vp tabindex="0" aria-label="${esc(t('Videoplayer'))}">
      <video class="vp__video" src="${esc(src)}"${poster ? ` poster="${esc(poster)}"` : ''} playsinline preload="metadata"></video>
      <button class="vp__big" type="button" data-vp-play aria-label="${esc(t('Abspielen'))}"><span>${icon('phf-play')}</span></button>
      <span class="vp__spin" aria-hidden="true"></span>
      <div class="vp__bar">
        <div class="vp__track" data-vp-seek role="slider" tabindex="0" aria-label="${esc(t('Position im Video'))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <i class="vp__buf"></i><i class="vp__fill"></i><i class="vp__knob"></i><span class="vp__tip" data-vp-tip>0:00</span>
        </div>
        <div class="vp__row">
          <button class="vp__btn vp__btn--play" type="button" data-vp-play aria-label="${esc(t('Abspielen'))}">${icon('phf-play')}</button>
          <button class="vp__btn" type="button" data-vp-skip="-10" aria-label="${esc(t('10 Sekunden zurück'))}">${icon('ph-rewind')}</button>
          <button class="vp__btn" type="button" data-vp-skip="10" aria-label="${esc(t('10 Sekunden vor'))}">${icon('ph-fast-forward')}</button>
          <span class="vp__time"><b data-vp-cur>0:00</b><span>/</span><span data-vp-dur>0:00</span></span>
          <span class="vp__gap"></span>
          <button class="vp__btn" type="button" data-vp-mute aria-label="${esc(t('Ton aus'))}">${icon('ph-speaker-high')}</button>
          <button class="vp__btn vp__btn--text" type="button" data-vp-speed aria-label="${esc(t('Tempo'))}">1×</button>
          ${pip ? `<button class="vp__btn vp__btn--pip" type="button" data-vp-pip aria-label="${esc(t('Bild im Bild'))}">${icon('ph-image')}</button>` : ''}
          <button class="vp__btn" type="button" data-vp-full aria-label="${esc(t('Vollbild'))}">${icon('ph-corners-out')}</button>
        </div>
      </div>
    </div>`;
  }
  const vpTime = (sec) => {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const x = String(Math.floor(sec % 60)).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`;
  };
  const VP_SPEEDS = [1, 1.25, 1.5, 2, 0.75];
  function vpSync(box) {
    const v = $('video', box);
    const d = v.duration || 0;
    const pct = d ? (v.currentTime / d) * 100 : 0;
    box.style.setProperty('--vp-p', `${pct}%`);
    let buf = 0;
    try { if (v.buffered.length) buf = (v.buffered.end(v.buffered.length - 1) / (d || 1)) * 100; } catch (e) { /* noch nichts geladen */ }
    box.style.setProperty('--vp-b', `${Math.min(100, buf)}%`);
    $('[data-vp-cur]', box).textContent = vpTime(v.currentTime);
    $('[data-vp-dur]', box).textContent = vpTime(d);
    const seek = $('[data-vp-seek]', box);
    seek.setAttribute('aria-valuenow', String(Math.round(pct)));
    seek.setAttribute('aria-valuetext', `${vpTime(v.currentTime)} / ${vpTime(d)}`);
  }
  function vpState(box) {
    const v = $('video', box);
    const playing = !v.paused && !v.ended;
    box.classList.toggle('is-playing', playing);
    box.classList.toggle('is-started', playing || v.currentTime > 0);
    $$('[data-vp-play]', box).forEach((b) => { b.setAttribute('aria-label', playing ? t('Pause') : t('Abspielen')); });
    $('.vp__btn--play', box).innerHTML = icon(playing ? 'phf-pause' : 'phf-play');
    $('.vp__big span', box).innerHTML = icon(v.ended ? 'ph-arrow-clockwise' : 'phf-play');
    const mute = $('[data-vp-mute]', box);
    mute.innerHTML = icon(v.muted || !v.volume ? 'ph-speaker-slash' : 'ph-speaker-high');
    mute.setAttribute('aria-label', v.muted ? t('Ton an') : t('Ton aus'));
    vpWake(box);
  }
  // Leiste ausblenden, wenn beim Abspielen eine Weile nichts passiert
  function vpWake(box) {
    box.classList.remove('is-idle');
    clearTimeout(box._idle);
    const v = $('video', box);
    if (!v.paused) box._idle = setTimeout(() => { if (!v.paused && !box.matches(':focus-within')) box.classList.add('is-idle'); }, 2600);
  }
  function vpToggle(box) {
    const v = $('video', box);
    if (v.paused || v.ended) v.play().catch(() => {}); else v.pause();
  }
  function vpSeekTo(box, clientX) {
    const v = $('video', box);
    const r = $('[data-vp-seek]', box).getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    if (v.duration) v.currentTime = f * v.duration;
    vpSync(box);
  }
  function vpFull(box) {
    const v = $('video', box);
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    if (box.requestFullscreen) box.requestFullscreen().catch(() => {});
    else if (box.webkitRequestFullscreen) box.webkitRequestFullscreen();
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
  }
  function vpBind() {
    // Ereignisse des Videos (bubbeln nicht – deshalb in der Capture-Phase)
    ['play', 'pause', 'ended', 'volumechange'].forEach((type) => document.addEventListener(type, (e) => { const box = e.target.closest && e.target.closest('[data-vp]'); if (box) vpState(box); }, true));
    ['timeupdate', 'loadedmetadata', 'progress', 'durationchange'].forEach((type) => document.addEventListener(type, (e) => { const box = e.target.closest && e.target.closest('[data-vp]'); if (box) vpSync(box); }, true));
    document.addEventListener('waiting', (e) => { const box = e.target.closest && e.target.closest('[data-vp]'); if (box) box.classList.add('is-waiting'); }, true);
    ['playing', 'canplay'].forEach((type) => document.addEventListener(type, (e) => { const box = e.target.closest && e.target.closest('[data-vp]'); if (box) box.classList.remove('is-waiting'); }, true));
    document.addEventListener('click', (e) => {
      const box = e.target.closest('[data-vp]');
      if (!box) return;
      const v = $('video', box);
      const b = e.target.closest('button');
      if (e.target === v) { vpToggle(box); return; }
      if (!b) return;
      const ds = b.dataset;
      if ('vpPlay' in ds) {
        // Nur ein Video gleichzeitig
        $$('[data-vp] video').forEach((x) => { if (x !== v && !x.paused) x.pause(); });
        vpToggle(box);
      } else if (ds.vpSkip) { v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + Number(ds.vpSkip))); vpSync(box); }
      else if ('vpMute' in ds) v.muted = !v.muted;
      else if ('vpSpeed' in ds) {
        const next = VP_SPEEDS[(VP_SPEEDS.indexOf(v.playbackRate) + 1) % VP_SPEEDS.length];
        v.playbackRate = next;
        b.textContent = `${String(next).replace('.', ',')}×`;
      } else if ('vpPip' in ds) {
        if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
        else v.requestPictureInPicture().catch(() => {});
      } else if ('vpFull' in ds) vpFull(box);
      vpWake(box);
    });
    document.addEventListener('dblclick', (e) => { const box = e.target.closest('[data-vp]'); if (box && e.target.tagName === 'VIDEO') vpFull(box); });
    // Fortschritt ziehen (Maus und Finger)
    let drag = null;
    document.addEventListener('pointerdown', (e) => {
      const seek = e.target.closest('[data-vp-seek]');
      if (!seek) return;
      drag = seek.closest('[data-vp]');
      drag.classList.add('is-seeking');
      seek.setPointerCapture(e.pointerId);
      vpSeekTo(drag, e.clientX);
    });
    document.addEventListener('pointermove', (e) => {
      const box = e.target.closest && e.target.closest('[data-vp]');
      if (box) vpWake(box);
      const seek = e.target.closest && e.target.closest('[data-vp-seek]');
      if (seek && !drag) {
        const v = $('video', seek.closest('[data-vp]'));
        const r = seek.getBoundingClientRect();
        const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        const tip = $('[data-vp-tip]', seek);
        tip.textContent = vpTime(f * (v.duration || 0));
        seek.style.setProperty('--vp-h', `${f * 100}%`);
      }
      if (drag) vpSeekTo(drag, e.clientX);
    });
    const end = () => { if (drag) { drag.classList.remove('is-seeking'); drag = null; } };
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
    // Tastatur: Leertaste/K, Pfeile (±5 s), M (Ton), F (Vollbild)
    document.addEventListener('keydown', (e) => {
      const box = e.target.closest && e.target.closest('[data-vp]');
      if (!box || e.target.matches('input, textarea')) return;
      const v = $('video', box);
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'k') { if (e.target.tagName === 'BUTTON' && k === ' ') return; e.preventDefault(); vpToggle(box); }
      else if (k === 'arrowleft' || k === 'arrowright') { e.preventDefault(); v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + (k === 'arrowleft' ? -5 : 5))); vpSync(box); }
      else if (k === 'm') v.muted = !v.muted;
      else if (k === 'f') vpFull(box);
      else return;
      vpWake(box);
    });
    document.addEventListener('fullscreenchange', () => {
      $$('[data-vp]').forEach((box) => {
        const on = document.fullscreenElement === box;
        box.classList.toggle('is-full', on);
        const b = $('[data-vp-full]', box);
        if (b) { b.innerHTML = icon(on ? 'ph-corners-in' : 'ph-corners-out'); b.setAttribute('aria-label', on ? t('Vollbild beenden') : t('Vollbild')); }
      });
    });
  }

  function mediaHtml(n) {
    if (!n.video) return `<div class="detail__media"><img src="${esc(newsImage(n))}" alt="" referrerpolicy="no-referrer"></div>`;
    const yt = youtubeId(n.video);
    if (yt) {
      // Erst nach dem Antippen laden (Datenschutz): Vorschaubild mit Play-Knopf
      return `<div class="detail__media detail__media--video"><button class="video-start" type="button" data-youtube="${yt}" aria-label="${esc(t('Video abspielen'))}">
          <img src="https://i.ytimg.com/vi/${yt}/hqdefault.jpg" alt="" referrerpolicy="no-referrer"><span class="video-start__btn">${icon('phf-play')}</span></button></div>`;
    }
    return `<div class="detail__media detail__media--video detail__media--vp">${videoPlayer(n.video, { poster: n.poster || (n.img ? `assets/img/${n.img}` : '') })}</div>`;
  }
  // Wechsel zwischen Zug und Bahnhof im offenen Dialog: vorige Ansicht merken (Zurück-Knopf)
  let modalStack = [];
  const modalBody = (name, arg) => (modalStack.length
    ? `<button class="modal-back" type="button" data-modal-back>${icon('ph-arrow-left')}${esc(t('Zurück zu {name}', { name: modalTitle(modalStack[modalStack.length - 1]) }))}</button>` : '') + VIEWS[name].render(arg);
  const modalTitle = (v) => { const title = VIEWS[v.name].title; return typeof title === 'function' ? title(v.arg) : title; };
  let modalCloseTimer = null;
  function openModal(name, arg, { stack = false } = {}) {
    closeMenu();
    if (modalCloseTimer) { clearTimeout(modalCloseTimer); modalCloseTimer = null; modal.classList.remove('is-closing'); $('[data-modal-body]').innerHTML = ''; modal.hidden = true; }
    if (stack && !modal.hidden && modalView) modalStack.push(modalView);
    else if (!stack) modalStack = [];
    modalView = { name, arg };
    $('[data-modal-title]').textContent = modalTitle(modalView);
    $('[data-modal-body]').innerHTML = modalBody(name, arg);
    // Ansichten mit Bild/Video: Inhalt beginnt oben in der Rundung, Griff und Schließen liegen darüber
    $('.sheet-modal__panel', modal).classList.toggle('is-hero', !!VIEWS[name].hero);
    $('.sheet-modal__panel', modal).scrollTop = 0;
    modal.hidden = false;
    document.body.classList.add('menu-open');
    countUp($('[data-modal-body]'));
    const focusable = $('[data-modal-body] input', modal) || $('[data-modal-body] button:not([disabled])', modal) || $('[data-modal-close]', modal);
    focusable.focus({ preventScroll: true });
  }
  function refreshModal() {
    if (modal.hidden || !modalView) return;
    $('[data-modal-title]').textContent = modalTitle(modalView);
    // Laufendes Video nicht neu laden
    if (!$('[data-modal-body] video, [data-modal-body] iframe')) $('[data-modal-body]').innerHTML = modalBody(modalView.name, modalView.arg);
    countUp($('[data-modal-body]'));
  }
  function closeModal() {
    if (modal.hidden || modalCloseTimer) return;
    $$('[data-modal-body] video', modal).forEach((v) => v.pause());
    modalView = null;
    modalStack = [];
    document.body.classList.remove('menu-open');
    const finish = () => {
      modalCloseTimer = null;
      modal.classList.remove('is-closing');
      $('[data-modal-body]').innerHTML = '';
      modal.hidden = true;
    };
    if (reducedMotion()) { finish(); return; }
    // Sheet gleitet nach unten weg
    modal.classList.add('is-closing');
    modalCloseTimer = setTimeout(finish, 190);
  }

  // ---------- Benachrichtigungen für Trainings ----------
  // Echte Benachrichtigungen des Systems (wie bei YouTube oder Gmail), sobald der Trainingsserver öffnet
  // (15 Minuten vor Beginn). Ist die App offen oder im Hintergrund, schickt sie die Benachrichtigung selbst.
  // Mit Backend (config.js → api) kommen sie per Web-Push auch, wenn die App geschlossen ist.
  // Glocke oben = alle Trainings für deinen nächsten Rang, Glocke auf der Karte = dieses Training.
  const remind = {
    ids: new Set(store.get('tsg-remind', [])), // einzeln eingeschaltet
    off: new Set(store.get('tsg-remind-off', [])), // trotz Glocke oben ausgeschaltet
    sent: new Set(store.get('tsg-notified', [])), // schon benachrichtigt
  };
  const saveRemind = () => {
    store.set('tsg-remind', [...remind.ids]);
    store.set('tsg-remind-off', [...remind.off]);
    store.set('tsg-notified', [...remind.sent].slice(-100));
  };
  function remindedIds() {
    const out = new Set(remind.ids);
    if (state.bell) trainingsList().forEach((tn) => { if (!remind.off.has(tn.id)) out.add(tn.id); });
    return out;
  }
  const isReminded = (tn) => remindedIds().has(tn.id);
  const notesSupported = () => 'Notification' in window && 'serviceWorker' in navigator;
  async function allowNotifications() {
    if (!notesSupported()) {
      toast(/iPhone|iPad|iPod/.test(navigator.userAgent)
        ? t('Auf dem iPhone: In Safari auf „Teilen“ → „Zum Home-Bildschirm“ tippen und die App von dort öffnen. Dann klappen Benachrichtigungen.')
        : t('Dein Browser unterstützt keine Benachrichtigungen.'));
      return false;
    }
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') {
      toast(t('Benachrichtigungen sind blockiert. Erlaube sie in den Einstellungen deines Browsers.'));
      return false;
    }
    if (await Notification.requestPermission() === 'granted') return true;
    toast(t('Ohne deine Erlaubnis können wir keine Benachrichtigungen senden.'));
    return false;
  }
  // Benachrichtigung über den Service Worker (geht auch auf Android); sonst direkt
  // Wie alle Benachrichtigungen der App: „Train Sim Germany“, darunter eine Linie, dann Betreff und Nachricht
  const NOTE_LINE = '━━━━━━━━━━━━━━━━';
  async function notify(subject, options) {
    const opts = { icon: 'assets/icons/icon-192.png', badge: 'assets/icons/badge-96.png', lang, ...options, body: [NOTE_LINE, subject, options.body].filter(Boolean).join('\n') };
    try {
      const reg = 'serviceWorker' in navigator && await navigator.serviceWorker.getRegistration();
      if (reg) { await reg.showNotification('Train Sim Germany', opts); return; }
    } catch (e) { /* weiter ohne Service Worker */ }
    try { new Notification('Train Sim Germany', opts); } catch (e) { /* nicht möglich */ }
  }
  const placeId = (String(D.links.play).match(/games\/(\d+)/) || [])[1];
  const trainingServer = (tn) => D.servers.find((x) => x.name === tn.server);
  const joinUrl = (s) => (placeId && s ? `https://www.roblox.com/games/start?placeId=${placeId}&gameInstanceId=${encodeURIComponent(s.id)}` : D.links.play);
  // Inhalt der Benachrichtigung, wenn der Server öffnet
  function trainingNote(tn) {
    return {
      id: tn.id,
      title: t('{type}-Training startet in {n} Minuten', { type: tn.type, n: SERVER_OPENS }),
      body: `${t(tn.title)} · ${t('{time} Uhr', { time: tn.time })}\n${t('Der Server „{server}“ ist jetzt offen. Leitung: {host}', { server: t(tn.server), host: tn.host })}`,
      tag: `training-${tn.id}`,
      url: new URL(`#/trainings?t=${encodeURIComponent(tn.id)}`, location.href).href,
      join: joinUrl(trainingServer(tn)),
      joinLabel: t('Beitreten'),
    };
  }
  const showTrainingNote = (n) => notify(n.title, { body: n.body, tag: n.tag, data: { url: n.url, join: n.join }, actions: [{ action: 'join', title: n.joinLabel }] });
  async function toggleReminder(id) {
    const tn = findTraining(id);
    if (!tn) return;
    const on = !isReminded(tn);
    if (on && !(await allowNotifications())) return;
    if (on) { remind.ids.add(id); remind.off.delete(id); } else { remind.ids.delete(id); if (state.bell) remind.off.add(id); }
    saveRemind();
    settingsChanged();
    renderReminders();
    if (on) {
      // Sofort eine echte Benachrichtigung als Bestätigung
      notify(t(tn.title), {
        body: t('Wir melden uns, wenn der Server für „{title}“ öffnet – {day}, {time} Uhr.', { title: t(tn.title), day: dayName(tn.day), time: hhmm(tn.start - SERVER_OPENS) }),
        tag: 'tsg-remind-confirm', data: { url: trainingNote(tn).url },
      });
      toast(t('Benachrichtigung für {title} an', { title: t(tn.title) }));
    } else toast(t('Benachrichtigung für {title} aus', { title: t(tn.title) }));
    syncPush();
  }
  async function toggleBell() {
    if (!state.bell && !(await allowNotifications())) return;
    state.bell = !state.bell;
    store.set('tsg-bell', state.bell);
    if (state.bell) remind.off.clear();
    saveRemind();
    settingsChanged();
    renderReminders();
    const next = nextRank(state.rank);
    if (state.bell) {
      notify('', {
        body: next ? t('Wir melden uns vor jedem {type}-Training, sobald der Server öffnet.', { type: next.name }) : t('Wir melden uns vor jedem Training, sobald der Server öffnet.'),
        tag: 'tsg-remind-confirm',
      });
    }
    toast(state.bell ? (next ? t('Benachrichtigungen an – wir melden uns vor {type}-Trainings', { type: next.name }) : t('Benachrichtigungen an')) : t('Benachrichtigungen aus'));
    syncPush();
    renderNotify();
  }
  function renderReminders() {
    $$('[data-bell]').forEach((b) => b.setAttribute('aria-pressed', String(state.bell)));
    if (state.page === 'trainings') renderTrainings();
    if (state.page === 'home') renderNextSteps();
    if (modalView && modalView.name === 'training') refreshModal();
  }
  // Jede Minute: fällige Benachrichtigungen zeigen (solange die App läuft) und Push-Liste abgleichen
  function remindersTick() {
    if (!notesSupported() || Notification.permission !== 'granted') return;
    const now = berlinNow().abs;
    trainingsList({ all: true }).filter(isReminded).forEach((tn) => {
      if (now >= tn.start - SERVER_OPENS && now < tn.start + 5 && !remind.sent.has(tn.id)) {
        remind.sent.add(tn.id);
        saveRemind();
        showTrainingNote(trainingNote(tn));
      }
    });
    syncPush();
  }
  // Web-Push über das Backend: Liste der kommenden Erinnerungen dort hinterlegen
  const epochOf = (abs) => Math.round(Date.now() / 1000 + (abs - berlinNow().absSec / 60) * 60);
  let pushBusy = false;
  async function syncPush() {
    if (!apiReady() || pushBusy || !notesSupported() || !('PushManager' in window) || Notification.permission !== 'granted') return;
    pushBusy = true;
    try {
      const now = berlinNow().abs;
      const list = trainingsList({ all: true }).filter((tn) => isReminded(tn) && tn.start - SERVER_OPENS > now)
        .map((tn) => ({ ...trainingNote(tn), at: epochOf(tn.start - SERVER_OPENS) }));
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub && !list.length) return;
      if (!sub) {
        const { publicKey } = await api('/api/push/key');
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64url(publicKey) });
      }
      const sig = JSON.stringify([sub.endpoint, lang, list.map((r) => [r.id, r.at])]);
      if (sig === store.get('tsg-push-sig', '')) return;
      await api('/api/push/reminders', { method: 'POST', body: { subscription: sub.toJSON(), reminders: list, lang } });
      store.set('tsg-push-sig', sig);
    } catch (e) {
      /* ohne Push: die Benachrichtigung kommt, solange die App offen ist */
    } finally {
      pushBusy = false;
    }
  }

  // ---------- Benachrichtigungen (Einstellungen): auch bei geschlossener App ----------
  // Das Gerät meldet sich beim Backend an; Chat-Nachrichten, Ergebnisse von Bewerbungen und (fürs Team)
  // neue Anfragen kommen dann als echte Benachrichtigung des Systems. Gilt pro Gerät.
  const NOTIFY_KINDS = [
    ['chat', 'Chat-Nachrichten', 'Wenn dir jemand im Chat schreibt oder deine Anfrage annimmt.'],
    ['applications', 'Bewerbungen', 'Ergebnis deiner Bewerbung (bestanden oder nicht).'],
    ['team', 'Team: neue Anfragen und Bewerbungen', 'Neue Anfragen in deinem Bereich, ab PRD auch neue Bewerbungen.'],
  ];
  const notifyState = () => store.get('tsg-notify', { on: false, prefs: { chat: true, applications: true, team: true } });
  const pushSupported = () => notesSupported() && 'PushManager' in window;
  const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  async function pushSubscription(create = true) {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub && create) {
      const { publicKey } = await api('/api/push/key');
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64url(publicKey) });
    }
    return sub;
  }
  // Gerät mit dem angemeldeten Konto verbinden (nach dem Einschalten, nach dem Login, wenn sich etwas ändert)
  async function linkPush() {
    const ns = notifyState();
    if (!ns.on || !apiReady() || !sessionToken() || !pushSupported() || Notification.permission !== 'granted') return false;
    try {
      const sub = await pushSubscription();
      await api('/api/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON(), prefs: ns.prefs, lang } });
      store.set('tsg-notify', { ...ns, endpoint: sub.endpoint, linked: state.profile && state.profile.userId });
      return true;
    } catch (e) {
      return false;
    }
  }
  async function unlinkPush() {
    const ns = notifyState();
    if (ns.endpoint && apiReady() && sessionToken()) await api('/api/push/unsubscribe', { method: 'POST', body: { endpoint: ns.endpoint } }).catch(() => {});
  }
  async function setNotify(on) {
    const ns = notifyState();
    if (on) {
      if (!pushSupported()) {
        toast(isIOS() && !standalone() ? t('Auf dem iPhone: In Safari auf „Teilen“ → „Zum Home-Bildschirm“ tippen und die App von dort öffnen. Dann klappen Benachrichtigungen.') : t('Dein Browser unterstützt keine Benachrichtigungen.'));
        renderNotify();
        return;
      }
      if (!await allowNotifications()) { renderNotify(); return; }
      store.set('tsg-notify', { ...ns, on: true });
      const linked = await linkPush();
      store.set('tsg-push-sig', '');
      syncPush();
      toast(linked ? t('Benachrichtigungen sind an – auch wenn die App geschlossen ist.')
        : sessionToken() ? t('Benachrichtigungen sind an.') : t('Benachrichtigungen sind an. Für Chat und Bewerbungen melde dich mit Roblox an.'));
    } else {
      await unlinkPush();
      try { const sub = await pushSubscription(false); if (sub) await sub.unsubscribe(); } catch (e) { /* schon weg */ }
      store.set('tsg-notify', { ...ns, on: false, endpoint: null });
      store.set('tsg-push-sig', '');
      toast(t('Benachrichtigungen sind aus.'));
    }
    renderNotify();
  }
  async function setNotifyKind(kind, on) {
    const ns = notifyState();
    store.set('tsg-notify', { ...ns, prefs: { ...ns.prefs, [kind]: on } });
    renderNotify();
    await linkPush();
  }
  async function testNotify() {
    if (!sessionToken() || !apiReady()) {
      notify('', { body: t('So sehen Benachrichtigungen aus.'), tag: 'test' });
      return;
    }
    try {
      const r = await api('/api/push/test', { method: 'POST', body: {} });
      toast(r.sent ? t('Probe gesendet – sie kommt gleich als Benachrichtigung.') : t('Dieses Gerät ist noch nicht angemeldet. Schalte die Benachrichtigungen einmal aus und wieder an.'));
    } catch (e) { toast(errorText(e)); }
  }
  function renderNotify() {
    const box = $('[data-notify]');
    if (!box) return;
    const ns = notifyState();
    const denied = 'Notification' in window && Notification.permission === 'denied';
    const on = ns.on && !denied && pushSupported() && Notification.permission === 'granted';
    const row = (attr, title, text, checked, off = false) => `<label class="toggle${off ? ' is-disabled' : ''}">
        <span class="toggle__text"><b>${title}</b><small>${text}</small></span>
        <input type="checkbox" role="switch" ${attr}${checked ? ' checked' : ''}${off ? ' disabled' : ''}>
        <span class="toggle__ui" aria-hidden="true"></span>
      </label>`;
    let note = '';
    if (!pushSupported()) note = isIOS() && !standalone() ? t('Auf dem iPhone/iPad gehen Benachrichtigungen nur in der installierten App: In Safari auf „Teilen“ → „Zum Home-Bildschirm“, dann die App von dort öffnen.') : t('Dein Browser unterstützt keine Benachrichtigungen.');
    else if (denied) note = t('Benachrichtigungen sind für diese Seite blockiert. Erlaube sie in den Einstellungen deines Geräts bzw. Browsers.');
    else if (on && !sessionToken()) note = t('Für Chat und Bewerbungen melde dich mit Roblox an – Trainings-Erinnerungen gehen auch so.');
    box.innerHTML = `${row('data-notify-set="on"', t('Benachrichtigungen erlauben'), t('Echte Benachrichtigungen auf diesem Gerät – auch wenn die App geschlossen ist.'), on, !pushSupported() || denied)}
      ${note ? `<p class="toggle__note notify-note">${icon('ph-info')}<span>${note}</span></p>` : ''}
      <div class="notify-kinds${on ? '' : ' is-off'}">
        ${NOTIFY_KINDS.filter(([k]) => k !== 'team' || mayTrain()).map(([k, title, text]) => row(`data-notify-kind="${k}"`, t(title), t(text), on && ns.prefs[k] !== false, !on)).join('')}
        ${row('data-bell', t('Trainings'), t('Wenn der Server eines Trainings für deinen nächsten Rang öffnet. Einzelne Trainings stellst du über die Glocke ein.'), on && state.bell, !on)}
      </div>
      ${on ? `<button class="btn btn--soft btn--block" type="button" data-notify-test>${icon('ph-bell')}${t('Probe-Benachrichtigung senden')}</button>` : ''}`;
  }

  // ---------- Tooltip & Toast ----------
  const tipEl = $('[data-tooltip]');
  function showTip(html, x, y) {
    tipEl.innerHTML = html;
    tipEl.hidden = false;
    const w = tipEl.offsetWidth;
    tipEl.style.left = `${Math.max(w / 2 + 8, Math.min(window.innerWidth - w / 2 - 8, x))}px`;
    tipEl.style.top = `${y}px`;
  }
  function hideTip() { tipEl.hidden = true; }
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest('[data-tip]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const fill = $('.hbar__fill', el);
    const fr = fill ? fill.getBoundingClientRect() : r;
    showTip(el.dataset.tip, fr.right - Math.min(24, fr.width / 2), r.top + 4);
  });
  document.addEventListener('pointerout', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el && !el.contains(e.relatedTarget)) hideTip();
  });

  let toastTimer;
  let toastOutTimer;
  function toast(msg) {
    const el = $('[data-toast]');
    el.innerHTML = `${icon('ph-check')}<span>${esc(msg)}</span>`;
    el.hidden = false;
    el.classList.remove('is-out');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(toastTimer);
    clearTimeout(toastOutTimer);
    toastTimer = setTimeout(() => {
      el.classList.add('is-out');
      toastOutTimer = setTimeout(() => { el.hidden = true; el.classList.remove('is-out'); }, reducedMotion() ? 0 : 220);
    }, 2800);
  }

  // ---------- Standardnamen und Einladungslinks ----------
  // Ohne Namen heißen neue Server, Gruppen und Bots „Name's Server“, „Name's Server2“ … (das Backend vergibt sie genauso)
  function defaultName(what) {
    const me = state.profile || {};
    const base = `${me.username || me.displayName || t('Spieler')}'s ${what}`;
    const taken = new Set((chat.list ? chat.list.chats : []).filter((c) => c.kind === 'group' && c.from && String(c.from.sub) === meSub()).map((c) => String(c.name || '').toLowerCase()));
    if (what === 'Bot') Object.values(chat.conv).forEach((c) => ((c && c.bots) || []).forEach((b) => taken.add(String(b.name || '').toLowerCase())));
    for (let n = 1; n < 1000; n++) { const name = n === 1 ? base : `${base}${n}`; if (!taken.has(name.toLowerCase())) return name; }
    return base;
  }
  // Vorlagen beim Erstellen eines Servers (Kanäle und Kategorien kommen aus backend/channels.js)
  const SERVER_TEMPLATES = [['', '✨', 'Standard'], ['gaming', '🎮', 'Gaming'], ['schule', '📘', 'Schulklub'], ['lernen', '🍎', 'Lerngruppe'], ['freunde', '💗', 'Freunde'], ['creator', '🎨', 'Künstler & Creator'], ['vorort', '🍃', 'Community vor Ort']];
  const templatePick = () => `<div class="tpl-grid">${SERVER_TEMPLATES.map(([id, emo, label]) => `<label class="tpl"><input type="radio" name="template" value="${id}"${id === '' ? ' checked' : ''}><span><i aria-hidden="true">${emo}</i><b>${esc(t(label))}</b></span></label>`).join('')}</div>`;
  const inviteCodeOf = (v) => { const m = String(v || '').trim().match(/(?:einladung\/)?([\w-]{6,12})\s*$/); return m ? m[1] : ''; };
  const invite = { code: '', preview: null, busy: false };
  function chatJoinView() {
    const pv = invite.preview;
    return `${backTo('#/chat/neu', t('Neu'))}
      ${chatGate() || `<form class="cform" data-invite-join novalidate>
        <div class="f"><label class="f__label" for="inv-code">${t('Einladungslink oder Code')}</label>
          <input id="inv-code" name="code" value="${esc(invite.code || '')}" placeholder="${esc(`${location.origin}${location.pathname}#/einladung/aB3dE5fG`)}" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
        ${pv ? `<div class="inv-preview">${groupBadge(pv, 'inv-preview__img')}<span><b>${esc(pv.name)}</b><small>${membersText(pv.members)}${pv.desc ? ` · ${esc(pv.desc)}` : ''}</small></span></div>` : ''}
        <button class="btn btn--primary btn--lg btn--block" type="submit"${invite.busy ? ' disabled' : ''}>${pv ? (pv.joined ? t('Öffnen') : t('Beitreten')) : t('Weiter')}</button>
        <a class="back-link" href="#/chat/gruppen">${icon('ph-globe')}${t('Oder öffentliche Server und Gruppen entdecken')}</a>
      </form>`}`;
  }
  async function joinSubmit(form) {
    const code = inviteCodeOf(form.elements.code.value);
    if (!code) { toast(t('Das ist kein gültiger Einladungslink.')); return; }
    const pv = invite.preview;
    invite.busy = true;
    try {
      if (pv && invite.code === code) {
        if (pv.joined) { location.hash = `#/chat/${pv.id}`; return; }
        const r = await api(`/api/chat-invites/${encodeURIComponent(code)}/join`, { method: 'POST' });
        chat.conv[r.id] = r;
        chat.at = 0;
        haptic('success');
        toast(t('Willkommen in {name}!', { name: r.name }));
        Object.assign(invite, { code: '', preview: null });
        location.hash = `#/chat/${r.id}`;
        return;
      }
      invite.code = code;
      invite.preview = await api(`/api/chat-invites/${encodeURIComponent(code)}`);
      if (invite.preview.banned) { toast(t('Du kannst diesem Server nicht beitreten.')); invite.preview = null; }
    } catch (e) { toast(e.status === 404 ? t('Diese Einladung gibt es nicht (mehr).') : chatError(e)); } finally { invite.busy = false; }
    if (state.page === 'chat' && state.chatView === 'join') renderChat();
  }
  async function shareInvite(id) {
    try {
      const r = await api(`/api/chats/${encodeURIComponent(id)}/invite`, { method: 'POST' });
      const url = `${location.origin}${location.pathname}#/einladung/${r.code}`;
      try { await navigator.clipboard.writeText(url); toast(t('Einladungslink kopiert')); } catch (e) { prompt(t('Einladungslink'), url); }
      haptic('success');
    } catch (e) { toast(chatError(e)); }
  }

  // ---------- Website: Navigation, Startseite, Netz, FAQ, Team, Neuigkeit als eigene Seite ----------
  // Oben eine schwebende weiße Leiste: links Logo und „TSG“, rechts das Profil-Symbol und das Menü-Symbol. Das Menü
  // öffnet darunter eine Karte mit allen Seiten (Symbol und Name), Trennlinie und Sprache; angemeldet zeigt das
  // Profil-Symbol das eigene Bild und öffnet das Konto in derselben Karte.
  const navRoot = $('[data-nav-root]');
  const NAV_SVG = {
    menu: '<svg class="nav__svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 6h14.5M2.5 12h11.5M2.5 18h19"/></svg>',
    close: '<svg class="nav__svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>',
    user: '<svg class="nav__svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3.6"/><path d="M5.2 21.2v-3.4c0-3.4 3-6 6.8-6s6.8 2.6 6.8 6v3.4z"/></svg>',
  };
  let navMode = null;
  function navOpen(which) {
    if (!navRoot) return;
    const panel = $('[data-nav-panel]', navRoot);
    if (!panel) return;
    const show = which && which !== navMode ? which : null;
    navMode = show;
    if (show) {
      panel.innerHTML = show === 'account' ? navAccountHtml() : navMenuHtml();
      panel.dataset.mode = show;
      panel.hidden = false;
      void panel.offsetWidth;
      panel.classList.add('is-open');
    } else if (!panel.hidden) {
      panel.classList.remove('is-open');
      if (reducedMotion()) panel.hidden = true;
      else setTimeout(() => { if (!panel.classList.contains('is-open')) panel.hidden = true; }, 220);
    }
    navRoot.classList.toggle('is-menu', show === 'menu');
    navRoot.classList.toggle('is-account', show === 'account');
    const menuBtn = $('[data-nav-menu]', navRoot);
    if (menuBtn) {
      menuBtn.innerHTML = show === 'menu' ? NAV_SVG.close : NAV_SVG.menu;
      menuBtn.setAttribute('aria-expanded', String(show === 'menu'));
      menuBtn.setAttribute('aria-label', show === 'menu' ? t('Menü schließen') : t('Menü öffnen'));
    }
    $$('[data-nav-me]', navRoot).forEach((x) => x.setAttribute('aria-expanded', String(show === 'account')));
    if (show) { const first = $('a, button', panel); if (first) first.focus({ preventScroll: true }); }
  }
  const navClose = () => navOpen(null);
  // Seiten im Menü: Gäste sehen die Webseite, angemeldet kommen Trainings und Spieler dazu
  const NAV_GUEST = [['', 'Startseite', 'ph-house'], ['netz', 'Netz', 'ph-map-trifold'], ['server', 'Server', 'ph-hard-drives'], ['news', 'Neuigkeiten', 'ph-newspaper'],
    ['karriere', 'Karriere', 'ph-rocket-launch'], ['entwickler', 'Team', 'ph-users-three'], ['faq', 'FAQ', 'ph-question']];
  const NAV_AUTH = [['', 'Startseite', 'ph-house'], ['netz', 'Netz', 'ph-map-trifold'], ['server', 'Server', 'ph-hard-drives'], ['trainings', 'Trainings', 'ph-calendar-blank'],
    ['spieler', 'Spieler', 'ph-train'], ['news', 'Neuigkeiten', 'ph-newspaper'], ['karriere', 'Karriere', 'ph-rocket-launch'], ['entwickler', 'Team', 'ph-users-three'], ['faq', 'FAQ', 'ph-question']];
  function navMenuHtml() {
    const list = state.profile ? NAV_AUTH : NAV_GUEST;
    const cur = (id) => state.page === (id || 'home');
    const other = lang === 'de' ? ['en', 'English'] : ['de', 'Deutsch'];
    return `<nav class="nav__menu-list" aria-label="${esc(t('Hauptnavigation'))}">
        ${list.map(([id, label, ic]) => `<a class="nav__item" href="#/${id}" data-nav="${id || 'home'}"${cur(id) ? ' aria-current="page"' : ''}>${icon(ic)}<span>${esc(t(label))}</span></a>`).join('')}
      </nav>
      <hr class="nav__sep">
      <button class="nav__item" type="button" data-lang-set="${other[0]}" lang="${other[0]}">${icon('ph-globe')}<span>${other[1]}</span></button>`;
  }
  function navAccountHtml() {
    const p = state.profile;
    if (!p) return '';
    const r = rankOf(state.rank);
    return `<div class="nav__acc-head">${ringHTML(p, r, 'avatar-ring--lg')}<span><b>${esc(p.displayName || p.username)}</b><small>@${esc(p.username)}</small></span>${rankPill(r)}</div>
      <nav class="nav__menu-list" aria-label="${esc(t('Konto'))}">
        ${rankIdx(state.rank) >= rankIdx('Junior Supervisor') && meSub() ? `<a class="nav__item" href="#/entwickler/${encodeURIComponent(meSub())}">${icon('ph-identification-badge')}<span>${t('Mein Steckbrief')}</span></a>` : ''}
        <a class="nav__item" href="#/einstellungen"${state.page === 'einstellungen' ? ' aria-current="page"' : ''}>${icon('ph-gear-six')}<span>${t('Einstellungen')}</span></a>
        <a class="nav__item" href="#/statistiken"${state.page === 'statistiken' ? ' aria-current="page"' : ''}>${icon('ph-chart-line-up')}<span>${t('Statistiken')}</span></a>
      </nav>
      <hr class="nav__sep">
      <button class="nav__item nav__item--out" type="button" data-disconnect>${icon('ph-sign-out')}<span>${p.oauth ? t('Abmelden') : t('Trennen')}</span></button>`;
  }
  // Menü-Inhalt neu zeichnen, wenn es offen ist (Seitenwechsel, Anmeldung, Sprache)
  function renderNavLinks() {
    if (!navRoot) return;
    navRoot.classList.toggle('is-auth', !!state.profile);
    const panel = $('[data-nav-panel]', navRoot);
    if (panel && navMode && !panel.hidden) panel.innerHTML = navMode === 'account' ? navAccountHtml() : navMenuHtml();
  }
  // Rechts in der Leiste: Profil-Symbol (Gast) bzw. eigenes Bild mit rotem Ring (angemeldet), daneben das Menü
  function renderNavAccount() {
    if (!navRoot) return;
    const box = $('[data-nav-account]', navRoot);
    const p = state.profile;
    if (!p) {
      if (navMode === 'account') navClose();
      box.innerHTML = `<button class="nav__icon nav__profile" type="button" data-open="profile" aria-label="${esc(loginReady() ? t('Anmelden') : t('Verbinden'))}" title="${esc(loginReady() ? t('Anmelden') : t('Verbinden'))}">${NAV_SVG.user}</button>`;
    } else {
      const unread = chatDot.last > 0;
      box.innerHTML = `<button class="nav__icon nav__me" type="button" data-nav-me aria-expanded="${navMode === 'account'}" aria-label="${esc(t('Konto von {name}', { name: p.displayName || p.username }))}" title="${esc(p.displayName || p.username)}">
        <span class="nav__me-pic">${avatarInner(p)}</span><i class="nav__me-dot${unread ? ' is-unread' : ''}" aria-hidden="true"></i></button>`;
    }
    renderNavLinks();
  }
  // Deckkraft der Leiste nach dem, was gerade darunter liegt: auf dunklen Flächen (Video, Nachthimmel, Zahlen,
  // Fußzeile) etwas durchscheinender mit stärkerem Schatten, auf hellen Flächen deckend weiß – Schrift immer schwarz
  let toneFrame = 0;
  function navTone() {
    if (!navRoot || toneFrame) return;
    toneFrame = requestAnimationFrame(() => {
      toneFrame = 0;
      const bar = $('.nav__bar', navRoot);
      const r = bar.getBoundingClientRect();
      const y = r.top + r.height / 2;
      let dark = false;
      for (const el of $$('[data-tone="dark"]')) {
        if (el === navRoot || el.closest('[hidden]')) continue;
        const b = el.getBoundingClientRect();
        if (b.height && b.top <= y && b.bottom >= y) { dark = true; break; }
      }
      navRoot.dataset.tone = dark ? 'dark' : 'light';
    });
  }

  // Sätze zum Durchblättern auf der Startseite
  const QUOTES = [
    'Train Sim Germany ist kein Spiel, das man nur nebenbei fährt – es ist ein Netz, das jeden Tag von echten Menschen betrieben wird.',
    'Vom ersten Training als Learning Driver bis ins Stellwerk: Bei uns wächst du mit jeder Fahrt und jedem Rang.',
    'Echte Bahnhöfe, echte Linien, echter Fahrplan – und eine Community, die pünktlich sein will.',
    'Jeder Halt, jedes Signal und jede Ansage ist mit Liebe zum Detail gebaut. Und das Netz wächst weiter.',
  ];
  // Sätze: alle 7 Sekunden der nächste. Der Knopf in der Mitte ist ein grauer Kreis, um den sich ein roter Ring
  // füllt – so sieht man, wie lange es noch bis zum nächsten Satz dauert. Pause hält den Ring an.
  const QUOTE_MS = 7000;
  const quote = { i: 0, timer: null, paused: false, left: QUOTE_MS, started: 0 };
  function showQuote(i, dir = 1) {
    const stage = $('[data-quote-stage]');
    if (!stage) return;
    quote.i = (i + QUOTES.length) % QUOTES.length;
    stage.innerHTML = `<blockquote class="quotes__text" style="--dir:${dir}"><span class="quotes__mark" aria-hidden="true">„</span>${esc(t(QUOTES[quote.i]))}</blockquote>`;
    const c = $('[data-quote-count]');
    if (c) c.innerHTML = `<b>${pad(quote.i + 1)}</b> / ${pad(QUOTES.length)}`;
  }
  function quoteRing(restart) {
    const ring = $('[data-quote-play]');
    if (!ring) return;
    ring.style.setProperty('--qdur', `${QUOTE_MS}ms`);
    if (restart) { ring.classList.remove('is-running'); void ring.offsetWidth; }
    ring.classList.add('is-running');
    ring.classList.toggle('is-paused', quote.paused || reducedMotion());
  }
  function quoteAuto(restart = true) {
    clearTimeout(quote.timer);
    if (restart) quote.left = QUOTE_MS;
    quoteRing(restart);
    if (quote.paused || reducedMotion()) return;
    quote.started = Date.now();
    quote.timer = setTimeout(() => {
      if (state.page === 'home' && document.visibilityState === 'visible') showQuote(quote.i + 1);
      quoteAuto(true);
    }, quote.left);
  }
  function quotePause(on) {
    if (on && !quote.paused) quote.left = Math.max(300, quote.left - (Date.now() - quote.started));
    quote.paused = on;
    quoteAuto(false);
  }

  // Titel: Schiene mit Halten, der nächste Halt wechselt
  const HERO_STOPS = ['Magdeburg Hbf', 'Halle (Saale) Hbf', 'Leipzig Hbf', 'Lutherstadt Wittenberg', 'Berlin Hbf', 'Frankfurt (Oder)', 'Poznań Główny'];
  const hero = { i: 4, timer: null };
  function heroLine() {
    const box = $('[data-hero-line]');
    if (!box) return;
    box.innerHTML = `<span class="hero__rule"></span>${HERO_STOPS.map((s, i) => `<span class="hero__stop${i === hero.i ? ' is-next' : i < hero.i ? ' is-past' : ''}" style="--x:${(i / (HERO_STOPS.length - 1)) * 100}%"><i></i><small>${esc(s)}</small></span>`).join('')}`;
    const name = $('[data-hero-stop]');
    if (name) name.textContent = HERO_STOPS[hero.i];
    clearInterval(hero.timer);
    if (reducedMotion()) return;
    hero.timer = setInterval(() => {
      if (state.page !== 'home' || document.visibilityState !== 'visible') return;
      hero.i = (hero.i + 1) % HERO_STOPS.length;
      $$('.hero__stop', box).forEach((el, i) => { el.classList.toggle('is-next', i === hero.i); el.classList.toggle('is-past', i < hero.i); });
      if (name) { name.classList.remove('is-in'); void name.offsetWidth; name.textContent = HERO_STOPS[hero.i]; name.classList.add('is-in'); }
    }, 3200);
  }
  function heroStars() {
    const sky = $('[data-stars]');
    if (!sky || sky.childElementCount) return;
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    sky.innerHTML = Array.from({ length: 70 }, () => `<i style="left:${(rnd() * 100).toFixed(2)}%;top:${(rnd() * 70).toFixed(2)}%;--s:${(1 + rnd() * 2).toFixed(1)}px;--d:${(rnd() * 4).toFixed(2)}s"></i>`).join('');
  }

  // Lesezeit: rund 200 Wörter pro Minute, mindestens 1 Minute
  const readMinutes = (n) => Math.max(1, Math.round(String(t(n.text || '')).split(/\s+/).filter(Boolean).length / 200));
  const readText = (n) => t('{n} Min. Lesezeit', { n: readMinutes(n) });
  const newsHref = (n) => `#/news/${encodeURIComponent(n.id)}`;
  const excerpt = (s, n = 140) => { const v = String(s || ''); return v.length > n ? `${v.slice(0, n).replace(/\s+\S*$/, '')} …` : v; };
  const chipOf = (n) => `<span class="chip-cat" style="--cc:${newsCat(n.cat)[3]}">${esc(t(n.tag || newsCat(n.cat)[2]))}</span>`;
  // Neuigkeit als Karte: groß (Bild als Fläche) oder als Zeile mit Kategorie, Datum, Titel, Auszug
  function newsTile(n, kind = 'row') {
    if (kind === 'feature') {
      return `<a class="nr-feature" href="${newsHref(n)}">
        <img src="${esc(newsImage(n))}" alt="" loading="lazy" referrerpolicy="no-referrer">${n.video ? `<span class="nr-play">${icon('phf-play')}</span>` : ''}
        <span class="nr-feature__body"><span class="nr-meta">${chipOf(n)}<span>${newsDate(n)}</span><span>${readText(n)}</span></span>
          <b class="nr-feature__title">${esc(t(n.title))}</b><span class="nr-feature__text">${esc(excerpt(t(n.text), 110))}</span></span>
      </a>`;
    }
    if (kind === 'card') {
      return `<a class="nr-card" href="${newsHref(n)}">
        <span class="nr-card__img"><img src="${esc(newsImage(n))}" alt="" loading="lazy" referrerpolicy="no-referrer">${n.video ? `<span class="nr-play">${icon('phf-play')}</span>` : ''}</span>
        <span class="nr-meta">${chipOf(n)}<span>${newsDate(n)}</span></span>
        <b class="nr-card__title">${esc(t(n.title))}</b><span class="nr-card__text">${esc(excerpt(t(n.text)))}</span>
        <span class="nr-card__read">${icon('ph-clock')}${readText(n)}</span>
      </a>`;
    }
    return `<a class="nr-row" href="${newsHref(n)}"><span class="nr-meta">${chipOf(n)}<span>${newsDate(n)}</span><span>${readText(n)}</span></span>
      <b class="nr-row__title">${esc(t(n.title))}</b><span class="nr-row__text">${esc(excerpt(t(n.text)))}</span></a>`;
  }
  function renderHomeNews() {
    const box = $('[data-home-news]');
    if (!box) return;
    const list = newsItems();
    if (!list.length) { box.innerHTML = `<p class="empty">${t('Hier gibt es noch keine Neuigkeiten.')}</p>`; return; }
    box.innerHTML = `<div class="nr-side">${list.slice(1, 4).map((n) => newsTile(n)).join('')}</div>${newsTile(list[0], 'feature')}`;
  }

  // Zahlen wie auf einer Anzeigetafel: jede Ziffer rollt an ihren Platz
  function rollDigits(n) {
    return String(fmt(Math.max(0, Math.round(n || 0)))).split('').map((ch, i) => (/\d/.test(ch)
      ? `<span class="roll" style="--d:${ch};--i:${i}"><span>${'0123456789'.split('').map((d) => `<i>${d}</i>`).join('')}</span></span>`
      : `<span class="roll-sep">${ch}</span>`)).join('');
  }
  function renderHomeNumbers() {
    const box = $('[data-home-numbers]');
    if (!box) return;
    const s = D.stats;
    const items = [[s.groupMembers, t('Gruppenmitglieder'), 'ph-users-three'], [s.visits, t('Besuche'), 'ph-door-open'], [Math.max(state.online || 0, (live.data && live.data.online) || 0), t('Gerade im Spiel'), 'ph-game-controller']];
    const key = items.map((x) => Math.round(x[0] || 0)).join('|');
    if (box.dataset.key === key) return;
    box.dataset.key = key;
    box.innerHTML = items.map(([n, label, ic]) => `<div class="numbers__item">${icon(ic, 'numbers__ic')}<b class="numbers__value" aria-label="${esc(fmt(Math.round(n || 0)))}">${rollDigits(n)}</b><span>${label}</span></div>`).join('');
    // Erst rollen, wenn die Zahlen zu sehen sind
    const go = () => box.classList.add('is-rolled');
    box.classList.remove('is-rolled');
    if (reducedMotion() || !('IntersectionObserver' in window)) { go(); return; }
    const io = new IntersectionObserver((list) => { if (list.some((x) => x.isIntersecting)) { requestAnimationFrame(go); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(box);
  }

  // Häufige Fragen
  const FAQ = [
    ['Was ist Train Sim Germany?', 'Train Sim Germany ist eine Bahnsimulation auf Roblox. Du fährst Züge nach Fahrplan, fertigst Bahnhöfe ab, begleitest Züge oder stellst im Stellwerk die Fahrstraßen – zusammen mit anderen Spielern auf denselben Servern.'],
    ['Brauche ich Roblox zum Spielen?', 'Ja. Roblox ist kostenlos und läuft auf PC, Mac, Handy, Tablet und Konsole. Über „Auf Roblox spielen“ kommst du direkt ins Spiel.'],
    ['Wie bekomme ich einen höheren Rang?', 'Tritt der Roblox-Gruppe bei – dann startest du als Learning Driver. Weitere Ränge wie Qualified Driver, Platform Staff, Conductor oder Signaller bekommst du in Trainings. Termine stehen unter „Trainings“.'],
    ['Was bringt mir die Anmeldung auf der Webseite?', 'Mit deinem Roblox-Konto siehst du deinen Rang, bekommst Erinnerungen an Trainings, kannst chatten, Spieler auf ihrer Zugfahrt verfolgen, dich bewerben und deine Statistik ansehen. Wir erhalten nie dein Passwort.'],
    ['Wie kann ich im Team mitmachen?', 'Offene Stellen findest du unter „Karriere“ – vom Supervisor bis zum Game Developer. Die Bewerbung läuft direkt hier auf der Webseite.'],
    ['Kostet das Spiel etwas?', 'Nein, Train Sim Germany ist kostenlos.'],
    ['Wo erfahre ich, was es Neues gibt?', 'Unter „Neuigkeiten“ und auf unserem Discord-Server. Dort kannst du auch Fragen stellen und das Team erreichen.'],
  ];
  function renderFaq(where) {
    const box = $(`[data-faq="${where}"]`);
    if (!box) return;
    box.innerHTML = FAQ.map(([q, a], i) => `<details class="faq__item"${where === 'home' && i === 0 ? ' open' : ''}>
        <summary><span>${esc(t(q))}</span><i class="faq__plus" aria-hidden="true"></i></summary>
        <div class="faq__a"><p>${esc(t(a))}</p></div>
      </details>`).join('');
  }

  function renderHome() {
    heroStars();
    heroLine();
    const marks = $('[data-open-marks]');
    if (marks && !marks.childElementCount) {
      marks.innerHTML = ['R004', 'R001', 'R005'].map((no) => D.routes.find((r) => r.no === no)).filter(Boolean)
        .map((r) => `<a class="open-net__mark" href="#/netz/${esc(r.no)}">${lineMark(r.cat, r.line)}<span>${esc(r.from)} – ${esc(r.to)}</span></a>`).join('');
    }
    if (!$('[data-quote-stage] blockquote')) showQuote(quote.i);
    quoteAuto();
    renderHomeNews();
    renderHomeNumbers();
    renderFaq('home');
  }

  // Netz: Kennzahlen, Linien als Bänder mit allen Halten, Strecken als Karten
  // ---------- Netz: Linien als Karten, jede Strecke mit eigener Seite (#/netz/R001) ----------
  // Zeichen der Linie: S-Bahn mit rundem S-Logo (weißer Rand) in Grün, Regionalverkehr dunkelgrau mit Regionalzug,
  // Fernverkehr schwarz mit Fernzug; daneben ein abgerundeter Kasten in derselben Farbe mit der Linie.
  const lineKind = (cat) => (cat === 's' ? 's' : ['ice', 'ic', 'ec'].includes(cat) ? 'fv' : 'rv');
  const KIND_NAME = { s: 'S-Bahn', rv: 'Regionalverkehr', fv: 'Fernverkehr' };
  function lineMark(cat, name, cls = '') {
    const k = lineKind(cat);
    const logo = k === 's' ? '<b class="lmark__s">S</b>' : icon(k === 'fv' ? 'ph-train' : 'ph-train-regional');
    return `<span class="lmark lmark--${k} ${cls}" title="${esc(t(KIND_NAME[k]))}"><span class="lmark__logo" aria-hidden="true">${logo}</span><span class="lmark__pill">${esc(String(name).replace(/\s+/g, ''))}</span></span>`;
  }
  const routeLine = (r) => (r.lineId && D.lines[r.lineId]) || Object.values(D.lines).find((L) => L.name === r.line) || null;
  const sameStop = (a, b) => a === b || a.startsWith(`${b} `) || b.startsWith(`${a} `);
  // Verlauf einer Strecke aus dem Fahrplan der Linie: Halte von Start bis Ziel mit Minuten ab Start (auch rückwärts)
  function routeCourse(r) {
    const L = routeLine(r);
    if (!L) return [];
    const i = L.stops.findIndex(([n]) => sameStop(n, r.from));
    const j = L.stops.findIndex(([n]) => sameStop(n, r.to));
    if (i < 0 || j < 0) return L.stops.map(([n, m]) => ({ name: n, min: m }));
    const seg = i <= j ? L.stops.slice(i, j + 1) : L.stops.slice(j, i + 1).reverse();
    const m0 = seg[0][1];
    return seg.map(([n, m]) => ({ name: n, min: Math.abs(m - m0) }));
  }
  const durText = (min) => (min >= 60 ? (min % 60 ? t('{h} h {m} min', { h: Math.floor(min / 60), m: min % 60 }) : t('{h} h', { h: min / 60 })) : t('{m} min', { m: min }));
  function routeVia(course) {
    if (course.length < 3) return '';
    const end = course[course.length - 1].min;
    const mid = course.slice(1, -1).reduce((best, x) => (Math.abs(x.min - end / 2) < Math.abs(best.min - end / 2) ? x : best));
    return mid.name;
  }
  function routeCard(r) {
    const course = routeCourse(r);
    const end = course.length ? course[course.length - 1].min : 0;
    const via = routeVia(course);
    return `<a class="ln-card" href="#/netz/${esc(r.no)}" data-kind="${lineKind(r.cat)}">
      <span class="ln-card__head"><b class="ln-card__no">${esc(r.no)}</b>${lineMark(r.cat, r.line)}</span>
      <span class="ln-card__ends">
        <span><small>${t('Von')}</small><b>${esc(r.from)}</b></span>
        <span class="ln-card__to"><small>${t('Nach')}</small><b>${esc(r.to)}</b></span>
      </span>
      ${via ? `<span class="ln-card__via"><small>${t('Via')}</small><span>${esc(via)}</span></span>` : ''}
      <span class="ln-card__foot"><span class="ln-card__dur">${icon('ph-clock')}${durText(end)}</span><span class="ln-card__km">${fmt(r.km)} km</span><span class="ln-card__go">${t('Details ansehen')}</span></span>
    </a>`;
  }
  const NET_FILTERS = [['all', 'Alle'], ['s', 'S-Bahn'], ['rv', 'Regionalverkehr'], ['fv', 'Fernverkehr']];
  function renderNet() {
    if (state.routeNo) { renderRoute(); return; }
    const lines = Object.values(D.lines);
    const stations = new Set(lines.flatMap((L) => L.stops.map(([n]) => n)));
    const km = D.routes.reduce((n, r) => n + (r.km || 0), 0);
    const stats = $('[data-net-stats]');
    if (stats) {
      stats.innerHTML = [[D.routes.length, t('Strecken')], [lines.length, t('Linien')], [stations.size, t('Bahnhöfe')], [km, t('Kilometer Strecke')]]
        .map(([n, label]) => `<div class="sv-stat"><b>${fmt(n)}</b><span>${label}</span></div>`).join('');
    }
    const f = state.netFilter || 'all';
    const fb = $('[data-net-filter]');
    if (fb) fb.innerHTML = NET_FILTERS.map(([id, label]) => `<button class="sv-chip${f === id ? ' is-active' : ''}" type="button" data-net-filter-set="${id}">${t(label)}</button>`).join('');
    const box = $('[data-net-routes]');
    if (box) {
      const list = D.routes.filter((r) => f === 'all' || lineKind(r.cat) === f);
      box.innerHTML = list.map(routeCard).join('') || `<p class="sv-none">${t('Keine Strecke in dieser Auswahl.')}</p>`;
    }
  }
  // Eine Strecke: Kopf mit Routennummer und Linie, Daten, dann Hin- und Rückfahrt mit allen Halten, Minuten und Spawnpunkten
  function renderRoute() {
    const box = $('[data-route]');
    if (!box) return;
    const r = D.routes.find((x) => x.no === state.routeNo);
    const back = `<a class="back-pill" href="#/netz">${icon('ph-arrow-left')}${t('Alle Linien')}</a>`;
    if (!r) { box.innerHTML = `<div class="site-wrap rt-wrap">${back}<h1 class="mega">${t('Strecke nicht gefunden')}</h1></div>`; return; }
    const L = routeLine(r);
    const course = routeCourse(r);
    const end = course.length ? course[course.length - 1].min : 0;
    const spawns = new Map((r.spawns || []).map(([at, name]) => [at, name]));
    const spawnAt = (n) => [...spawns].find(([at]) => sameStop(n, at));
    const back2 = course.slice().reverse().map((x) => ({ name: x.name, min: end - x.min }));
    const k = lineKind(r.cat);
    const dir = (title, list) => `<section class="rt-dir">
        <header class="rt-dir__head"><h2>${title}</h2><p>${esc(list[0].name)} ${icon('ph-arrow-right')} ${esc(list[list.length - 1].name)}</p></header>
        <ol class="rt-stops">${list.map((x, i) => {
          const sp = spawnAt(x.name);
          const first = i === 0;
          const last = i === list.length - 1;
          return `<li class="${first ? 'is-start' : last ? 'is-end' : ''}${sp ? ' has-spawn' : ''}">
            <span class="rt-stops__time">${first ? t('ab') : `+${x.min}`}<small>${first ? '0 min' : 'min'}</small></span>
            <i class="rt-stops__dot" aria-hidden="true"></i>
            <span class="rt-stops__body"><b>${esc(x.name)}</b>${first ? `<em class="rt-tag">${t('Start')}</em>` : last ? `<em class="rt-tag rt-tag--end">${t('Ziel')}</em>` : ''}
              ${sp ? `<span class="rt-spawn">${icon('ph-warehouse')}<span>${t('Spawnpunkt')}: <b>${esc(sp[1])}</b></span></span>` : ''}</span>
          </li>`;
        }).join('')}</ol>
      </section>`;
    const fact = (label, value) => `<div class="sv-stat"><b>${value}</b><span>${label}</span></div>`;
    box.innerHTML = `<header class="site-head lines-bg rt-hero">
        <div class="site-wrap">
          ${back}
          <div class="rt-hero__top"><span class="rt-hero__no">${esc(r.no)}</span>${lineMark(r.cat, r.line, 'lmark--lg')}</div>
          <h1 class="mega">${esc(t(r.title))}</h1>
          <p class="site-head__lead">${t('{kind} von {from} nach {to}.', { kind: t(KIND_NAME[k]), from: `<b>${esc(r.from)}</b>`, to: `<b>${esc(r.to)}</b>` })}${L ? ` ${t('Gefahren wird mit dem {train}, alle {n} Minuten in jede Richtung.', { train: esc(L.train), n: L.every })}` : ''}</p>
        </div>
      </header>
      <div class="site-wrap rt-body">
        <div class="sv-stats sv-stats--4 rt-facts">
          ${fact(t('Fahrzeit'), durText(end))}${fact(t('Länge'), `${fmt(r.km)} km`)}${fact(t('Halte'), fmt(course.length))}${fact(t('Takt'), L ? t('{n} min', { n: L.every }) : '–')}
        </div>
        <p class="rt-meta">${L ? `${icon('ph-train')}<span>${esc(L.train)}</span>` : ''}${r.tag ? `${icon('ph-tag')}<span>${esc(t(r.tag))}</span>` : ''}${spawns.size ? `${icon('ph-warehouse')}<span>${t('{n} Spawnpunkte', { n: spawns.size })}</span>` : ''}</p>
        <div class="rt-dirs">${course.length ? dir(t('Hinfahrt'), course) + dir(t('Rückfahrt'), back2) : `<p class="sv-none">${t('Für diese Strecke gibt es noch keinen Fahrplan.')}</p>`}</div>
        <p class="rt-note">${icon('ph-info')}<span>${t('Spawnpunkte sind Depots und Abstellgleise, an denen Züge für diese Strecke ins Spiel kommen. Die Minuten zählen ab der Abfahrt am Start.')}</span></p>
      </div>`;
  }

  // Team: alle ab Supervisor aus der Roblox-Gruppe in drei Gruppen (Leitung, Manager, Aufsicht). Jede Karte: Bild auf
  // zartem Rot, Name, Rang, @Name und ↗ – das öffnet den Chat mit der Person.
  const TEAM_GROUPS = [
    ['Leitung', ['Chief Engineer', 'Community Director', 'Operation Manager', 'Project Engineer']],
    ['Manager', ['Public Relations Department', 'Signaller Manager', 'Conductor Manager', 'Platform Staff Manager', 'Driver Manager']],
    ['Aufsicht', ['Supervisor', 'Junior Supervisor']],
  ];
  function renderTeam() {
    const box = $('[data-team]');
    const strip = $('[data-team-strip]');
    if (!box) return;
    if (!chat.staff) { loadStaff().then(() => { if (state.page === 'entwickler') renderTeam(); }); box.innerHTML = loadingHtml(); return; }
    const list = chat.staff;
    if (strip) strip.innerHTML = list.filter((p) => p.avatar).slice(0, 14).map((p, i) => `<img src="${esc(p.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer" style="--i:${i}">`).join('');
    if (!list.length) { box.innerHTML = `<p class="empty">${t('Gerade ist niemand im Team eingetragen.')}</p>`; return; }
    const known = new Set(TEAM_GROUPS.flatMap(([, ranks]) => ranks));
    const groups = TEAM_GROUPS.map(([title, ranks]) => [title, list.filter((p) => ranks.includes(p.rank)).sort((a, b) => rankIdx(b.rank) - rankIdx(a.rank))]);
    const rest = list.filter((p) => !known.has(p.rank));
    if (rest.length) groups.push(['Team', rest]);
    box.innerHTML = groups.filter(([, l]) => l.length).map(([title, l]) => `<section class="team-group">
        <h2 class="team-group__title">${esc(t(title))}</h2>
        <div class="team-grid">${l.map((p) => `<a class="team-card" href="#/entwickler/${encodeURIComponent(p.userId)}" aria-label="${esc(t('Steckbrief von {name}', { name: p.displayName || p.username }))}">
          <span class="team-card__img">${p.avatar ? `<img src="${esc(p.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<b>${esc(initials(p.displayName || p.username))}</b>`}</span>
          <b class="team-card__name">${esc(p.displayName || p.username)}</b>
          <span class="team-card__role">${esc(p.rank)}</span>
          <span class="team-card__foot"><small>@${esc(p.username)}</small><span class="team-card__go" aria-hidden="true">${icon('ph-arrow-up-right')}</span></span>
        </a>`).join('')}</div>
      </section>`).join('');
  }

  // ---------- Steckbrief eines Teammitglieds (#/entwickler/<userId>) ----------
  // Immer sichtbar: Name, Rang, seit wann im Rang, Beitrittsdaten. Den Rest (Über mich, Angaben, Statistik) nur,
  // wenn die Person ihr Profil bzw. ihre Statistik in den Einstellungen öffentlich gemacht hat. Die Person selbst
  // sieht alles und kann ihren Steckbrief hier bearbeiten.
  const team = { members: {}, at: {}, editing: false };
  const MEMBER_FIELDS = [
    ['area', 'Bereich im Team', 'z. B. Trainings Signaller', 60],
    ['motto', 'Motto', 'Ein Satz, der zu dir passt', 120],
    ['favRoute', 'Lieblingsstrecke', 'z. B. Magdeburg – Berlin', 80],
    ['favTrain', 'Lieblingszug', 'z. B. Desiro HC', 60],
    ['languages', 'Sprachen', 'z. B. Deutsch, Englisch', 80],
    ['timezone', 'Meist online', 'z. B. abends ab 18 Uhr', 40],
    ['discord', 'Discord', 'z. B. lokfuehrer_max', 40],
  ];
  function loadMember(id, force = false) {
    if (!force && team.members[id] && Date.now() - (team.at[id] || 0) < 60000) return Promise.resolve(team.members[id]);
    team.at[id] = Date.now();
    const local = () => {
      const m = (chat.staff || []).find((x) => String(x.userId) === String(id));
      return m ? { member: m, basics: {}, own: String(id) === meSub(), public: false, statsPublic: false, profile: null, stats: null, local: true } : { error: 404 };
    };
    const job = apiReady()
      ? api(`/api/team/${encodeURIComponent(id)}`).catch((e) => (e.status === 404 ? { error: 404 } : local()))
      : loadStaff().then(local);
    return job.then((r) => {
      team.members[id] = r;
      if (state.page === 'entwickler' && state.memberId === String(id)) renderMember();
      return r;
    });
  }
  const dateLong = (v) => { if (!v) return '–'; const d = new Date(v); return Number.isNaN(+d) ? '–' : dtf({ day: 'numeric', month: 'long', year: 'numeric' }).format(d); };
  function renderMember() {
    const box = $('[data-member]');
    if (!box) return;
    const id = state.memberId;
    const r = team.members[id];
    const back = `<a class="back-pill" href="#/entwickler">${icon('ph-arrow-left')}${t('Das Team')}</a>`;
    if (!r) { loadMember(id); box.innerHTML = `<div class="site-wrap mb-wrap">${back}${loadingHtml()}</div>`; return; }
    if (r.error) { box.innerHTML = `<div class="site-wrap mb-wrap">${back}<h1 class="mega">${t('Nicht im Team')}</h1><p class="site-head__lead">${t('Diese Person gehört nicht (mehr) zum Team.')}</p></div>`; return; }
    const m = r.member;
    const b = r.basics || {};
    const rr = rankOf(m.rank);
    const name = m.displayName || m.username;
    const p = r.profile || {};
    const fact = (ic, label, value) => `<div class="mb-fact">${icon(ic)}<span><small>${label}</small><b>${value}</b></span></div>`;
    const facts = [
      fact('ph-identification-badge', t('Rang'), esc(m.rank)),
      fact('ph-calendar-blank', t('Im Rang seit'), b.rankSince ? dateLong(b.rankSince) : t('noch nicht bekannt')),
      fact('ph-user-plus', t('Roblox-Konto seit'), dateLong(b.robloxJoined)),
      fact('ph-game-controller', t('Zum ersten Mal gespielt'), dateLong(b.firstPlayed)),
      ...(b.lastPlayed ? [fact('ph-timer', t('Zuletzt gespielt'), agoText(b.lastPlayed))] : []),
      ...(b.appSince ? [fact('ph-sign-in', t('In der App seit'), dateLong(b.appSince))] : []),
    ].join('');
    const details = MEMBER_FIELDS.filter(([k]) => p[k]).map(([k, label]) => `<div><dt>${t(label)}</dt><dd>${esc(p[k])}</dd></div>`).join('');
    const st = r.stats;
    const stats = st ? `<section class="mb-sec"><h2>${t('Im Spiel')}</h2><div class="mb-stats">
        <div><b>${fmt(Math.round((st.minutes || 0) / 60))}</b><span>${t('Stunden gespielt')}</span></div>
        <div><b>${fmt(st.trips || 0)}</b><span>${t('Fahrten')}</span></div>
        <div><b>${fmt(Math.round(st.km || 0))}</b><span>${t('Kilometer')}</span></div>
        <div><b>${st.trips ? `${Math.round(((st.punctual || 0) / st.trips) * 100)} %` : '–'}</b><span>${t('pünktlich')}</span></div>
      </div></section>` : '';
    const hidden = !r.own && !r.public;
    const edit = r.own && team.editing ? `<form class="mb-edit" data-member-form novalidate>
        <div class="f"><label class="f__label" for="mb-about">${t('Über mich')}</label><textarea id="mb-about" name="about" maxlength="600" rows="4" placeholder="${esc(t('Wer bist du, was machst du im Team?'))}">${esc(p.about || '')}</textarea></div>
        <div class="mb-edit__grid">${MEMBER_FIELDS.map(([k, label, ph, max]) => `<div class="f"><label class="f__label" for="mb-${k}">${t(label)}</label><input id="mb-${k}" name="${k}" maxlength="${max}" value="${esc(p[k] || '')}" placeholder="${esc(t(ph))}"></div>`).join('')}</div>
        <p class="cr-side__small">${r.public ? t('Dein Profil ist öffentlich – alle sehen deinen Steckbrief.') : t('Dein Profil ist privat – andere sehen nur Rang und Beitrittsdaten.')} <a href="#/einstellungen">${t('In den Einstellungen ändern')}</a></p>
        <div class="mb-edit__btns"><button class="site-btn site-btn--ghost" type="button" data-member-cancel>${t('Abbrechen')}</button><button class="site-btn site-btn--brand" type="submit">${icon('ph-check')}${t('Speichern')}</button></div>
      </form>` : '';
    box.innerHTML = `<header class="site-head lines-bg mb-hero">
        <div class="site-wrap">
          ${back}
          <div class="mb-head">
            <span class="mb-pic" style="--rc:${rr.color}">${m.avatar ? `<img src="${esc(m.avatar)}" alt="" referrerpolicy="no-referrer">` : `<b>${esc(initials(name))}</b>`}</span>
            <div class="mb-head__text">
              <p class="cr-eyebrow">${esc(m.rank)}</p>
              <h1 class="mega">${esc(name)}</h1>
              <p class="mb-head__user">@${esc(m.username)}${p.motto && !hidden ? ` · „${esc(p.motto)}“` : ''}</p>
              <div class="mb-head__btns">
                ${r.own ? `<button class="site-btn site-btn--brand" type="button" data-member-edit>${icon('ph-pencil-simple')}${t('Steckbrief bearbeiten')}</button>`
                  : `<a class="site-btn site-btn--brand" href="#/chat/an/${encodeURIComponent(m.userId)}">${icon('ph-paper-plane-tilt')}${t('Anschreiben')}</a>`}
                <a class="site-btn site-btn--ghost" href="https://www.roblox.com/users/${encodeURIComponent(m.userId)}/profile" target="_blank" rel="noopener">${t('Roblox-Profil')}${icon('ph-arrow-up-right')}</a>
              </div>
            </div>
          </div>
        </div>
      </header>
      <div class="site-wrap mb-body">
        ${edit}
        <section class="mb-sec"><h2>${t('Das Wichtigste')}</h2><div class="mb-facts">${facts}</div></section>
        ${hidden ? `<p class="cr-note">${icon('ph-lock')}<span>${t('{name} hat das Profil nicht öffentlich gemacht. Zu sehen sind nur Rang und Beitrittsdaten.', { name: esc(name) })}</span></p>` : ''}
        ${!hidden && (p.about || details) ? `<section class="mb-sec"><h2>${t('Steckbrief')}</h2>${p.about ? `<p class="mb-about">${esc(p.about)}</p>` : ''}${details ? `<dl class="cr-dl">${details}</dl>` : ''}</section>` : ''}
        ${!hidden && !p.about && !details && r.own && !team.editing ? `<p class="cr-note">${icon('ph-info')}<span>${t('Dein Steckbrief ist noch leer. Tippe auf „Steckbrief bearbeiten“.')}</span></p>` : ''}
        ${stats}
      </div>`;
  }
  async function saveMember(form) {
    const body = Object.fromEntries(['about', ...MEMBER_FIELDS.map(([k]) => k)].map((k) => [k, form.elements[k].value.trim()]));
    const btn = $('button[type="submit"]', form);
    btn.disabled = true;
    try {
      await api('/api/team/me', { method: 'PUT', body });
      team.editing = false;
      await loadMember(state.memberId, true);
      toast(t('Steckbrief gespeichert'));
    } catch (e) {
      btn.disabled = false;
      toast(e.status === 400 ? t('Bitte prüfe den Discord-Namen (nur Buchstaben, Zahlen, Punkt und _).') : e.status === 403 ? t('Nur Teammitglieder haben einen Steckbrief.') : t('Speichern hat nicht geklappt. Bitte versuch es noch einmal.'));
    }
  }

  // Neuigkeit als eigene Seite: Kategorie, großer Titel, Datum, Autor, Lesezeit, Bild/Video, Text, Knöpfe, Teilen
  function renderArticle() {
    const box = $('[data-article]');
    const n = newsItems().find((x) => String(x.id) === String(state.newsId));
    if (!n) {
      box.innerHTML = `<div class="site-wrap article__head"><a class="back-pill" href="#/news">${icon('ph-arrow-left')}${t('Alle Neuigkeiten')}</a><h1 class="article__title">${t('Diese Neuigkeit gibt es nicht mehr.')}</h1></div>`;
      return;
    }
    const url = `${location.origin}${location.pathname}${newsHref(n)}`;
    const share = [
      ['x', 'X', `https://x.com/intent/post?text=${encodeURIComponent(t(n.title))}&url=${encodeURIComponent(url)}`, 'si-x'],
      ['whatsapp', 'WhatsApp', `https://wa.me/?text=${encodeURIComponent(`${t(n.title)} ${url}`)}`, 'si-whatsapp'],
      ['reddit', 'Reddit', `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(t(n.title))}`, 'si-reddit'],
      ['facebook', 'Facebook', `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, 'si-facebook'],
    ];
    const others = newsItems().filter((x) => x.id !== n.id).slice(0, 3);
    box.innerHTML = `<div class="site-wrap article__head">
        <a class="back-pill" href="#/news">${icon('ph-arrow-left')}${t('Alle Neuigkeiten')}</a>
        ${chipOf(n)}
        <h1 class="article__title">${esc(t(n.title))}</h1>
        <p class="article__meta"><span>${newsDate(n)}</span>${n.author ? `<span>${t('Von {name}', { name: esc(n.author) })}</span>` : ''}<span>${icon('ph-clock')}${readText(n)}</span>${n.edited ? `<span>${t('bearbeitet')}</span>` : ''}</p>
      </div>
      <div class="site-wrap article__media">${mediaHtml(n)}</div>
      <div class="site-wrap site-wrap--narrow article__body">
        ${String(t(n.text)).split(/\n{2,}/).map((para) => `<p>${esc(para)}</p>`).join('')}
        <div class="article__btns">${newsButtons(n)}</div>
        ${n.remote && isMine(n.authorId) ? `<div class="article__own"><button class="btn btn--soft" type="button" data-news-edit="${esc(n.id)}">${icon('ph-pencil-simple')}${t('Bearbeiten')}</button><button class="btn btn--danger" type="button" data-news-del="${esc(n.id)}">${icon('ph-trash')}${t('Löschen')}</button></div>` : ''}
        <div class="article__share"><b>${t('Beitrag teilen')}</b><span>
          ${share.map(([k, name, href, ic]) => `<a class="share-btn" href="${esc(href)}" target="_blank" rel="noopener" aria-label="${esc(t('Auf {name} teilen', { name }))}" data-share="${k}">${icon(ic)}</a>`).join('')}
          <button class="share-btn" type="button" data-copy="${esc(url)}" aria-label="${esc(t('Link kopieren'))}">${icon('ph-link')}</button>
          ${navigator.share ? `<button class="share-btn" type="button" data-share-native="${esc(url)}" data-share-title="${esc(t(n.title))}" aria-label="${esc(t('Teilen'))}">${icon('ph-share-network')}</button>` : ''}
        </span></div>
      </div>
      ${others.length ? `<div class="site-wrap article__more"><div class="mega-head"><h2 class="display">${t('Weitere Neuigkeiten')}</h2><a class="more-link" href="#/news">${t('Alle Beiträge')}${icon('ph-arrow-right')}</a></div>
        <div class="nr-cards">${others.map((x) => newsTile(x, 'card')).join('')}</div></div>` : ''}`;
  }

  // ---------- Seitenwechsel: Streifen wischen über den Bildschirm, dann Ladebildschirm mit Logo ----------
  const PAGE_NAMES = {
    home: 'Train Sim Germany', netz: 'Unser Netz', server: 'Server', news: 'Neuigkeiten', karriere: 'Karriere', faq: 'Fragen', entwickler: 'Das Team',
    trainings: 'Trainings', chat: 'Chat', spieler: 'Spieler', statistiken: 'Statistiken', einstellungen: 'Einstellungen',
  };
  const loaderState = { busy: false, timers: [] };
  const LOADER_HOLD = 2000;
  // Ladebildschirm beim Seitenwechsel. Optionen:
  //   sub     – kleine Zeile unter dem Namen (z. B. die ganze Server-ID)
  //   steps   – Schritte unter der Leiste („Lade Spieler …“) mit geschätzter Restzeit
  //   ready   – Promise: ausgefädelt wird erst, wenn die Daten da sind (höchstens 8 Sekunden)
  //   theme   – 'vip' (Rot wird nach dem Einfädeln zu Dunkelblau) oder 'member' (Rot wird zu Hellblau)
  //   avatar  – Profilbild in der Mitte über dem Namen (Teammitglied)
  function playLoader(text, swap, { splash = false, sub = '', steps = null, ready = null, theme = '', avatar = '' } = {}) {
    const el = $('[data-loader]');
    if (!el || reducedMotion() || loaderState.busy) { swap(); return; }
    loaderState.busy = true;
    loaderState.timers.forEach(clearTimeout);
    loaderState.timers = [];
    const name = $('[data-loader-name]', el);
    if (name) name.innerHTML = String(text).split('').map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
    const subEl = $('[data-loader-sub]', el);
    if (subEl) { subEl.textContent = sub; subEl.hidden = !sub; }
    const pic = $('[data-loader-avatar]', el);
    if (pic) { pic.hidden = !avatar; if (avatar) pic.src = avatar; else pic.removeAttribute('src'); }
    const status = $('[data-loader-status]', el);
    if (status) { status.textContent = ''; status.hidden = !steps; }
    el.className = 'loader';
    el.style.removeProperty('--p');
    if (theme) el.classList.add(`is-${theme}`);
    if (avatar) el.classList.add('is-person');
    if (steps) el.classList.add('is-steps');
    el.hidden = false;
    void el.offsetWidth;
    // Einfädeln: Streifen gelb, hellrot, rot von rechts (beim Öffnen der Seite liegt alles schon da)
    el.classList.add(splash ? 'is-splash' : 'is-in');
    const at = (ms, fn) => loaderState.timers.push(setTimeout(fn, ms));
    const cover = splash ? 0 : 560;
    const start = Date.now();
    let done = !ready;
    if (ready) Promise.resolve(ready).catch(() => {}).finally(() => { done = true; });
    at(cover, () => { try { swap(); } finally { el.classList.add('is-loading'); navTone(); } });
    // Nach dem Einfädeln wechselt die Farbe (VIP: Dunkelblau, Teammitglied: Hellblau)
    if (theme) at(cover + 250, () => el.classList.add('is-shift'));
    const finish = () => {
      el.classList.add('is-out');
      at(900, () => { el.hidden = true; el.className = 'loader'; loaderState.busy = false; });
    };
    if (!steps) { at(cover + LOADER_HOLD, finish); return; }
    // Schritte: Fortschritt nach Zeit, der letzte wartet auf die Daten; dazu „noch ca. … Sek.“
    const total = LOADER_HOLD + cover;
    const tick = () => {
      const ms = Date.now() - start;
      const f = Math.min(done ? 1 : 0.92, ms / total);
      const i = Math.min(steps.length - 1, Math.floor(f * steps.length));
      el.style.setProperty('--p', `${Math.round(f * 100)}%`);
      const left = Math.max(0, Math.ceil((total - ms) / 1000));
      status.innerHTML = `<b>${esc(steps[i])}</b><span>${f >= 1 ? t('Fertig') : left > 0 ? t('noch ca. {n} Sek.', { n: left }) : t('gleich fertig …')}</span>`;
      if ((f >= 1 && ms >= total) || ms > 8000) { el.style.setProperty('--p', '100%'); at(250, finish); return; }
      at(120, tick);
    };
    tick();
  }
  const loaderText = (page) => t(PAGE_NAMES[page] || 'Train Sim Germany');
  // Server: ID statt nur „Server“, Schritte beim Laden; private Server als „VIP – ID“ auf Dunkelblau
  function serverLoader(id) {
    const ls = liveServer(id);
    const demo = !liveMode() && serverById(id);
    const vip = !!((ls && ls.private) || (demo && demo.type === 'vip'));
    const ready = liveMode() ? loadLiveDetail(id, true) : null;
    return {
      text: vip ? `VIP – ${shortId(id).toUpperCase()}` : t('Server {id}', { id: shortId(id) }),
      opts: {
        sub: String(id), ready, theme: vip ? 'vip' : '',
        steps: [t('Verbinde mit dem Server …'), t('Lade Spieler …'), t('Lade Spieldaten …'), t('Lade Züge und Fahrpläne …')],
      },
    };
  }
  // Teammitglied: Profilbild in der Mitte, Name darunter, Rot wird zu Hellblau
  function memberLoader(id) {
    const m = (chat.staff || []).find((x) => String(x.userId) === String(id));
    const ready = loadMember(id);
    return {
      text: m ? m.displayName || m.username : t('Steckbrief'),
      opts: { sub: m ? m.rank : '', avatar: m && m.avatar ? m.avatar : '', theme: 'member', ready, steps: [t('Lade Steckbrief …'), t('Lade Rang und Beitritt …'), t('Lade Statistik …')] },
    };
  }

  // ---------- Bindings ----------
  function bind() {
    const s = D.stats;
    const values = {
      online: fmt(state.online), servers: fmt(s.servers), groupMembers: compact(s.groupMembers),
      discordOnline: compact(s.discordOnline), discordMembers: compact(s.discordMembers),
      visits: FORMATS.exact(s.visits), favorites: FORMATS.exact(s.favorites),
    };
    $$('[data-bind]').forEach((el) => { if (values[el.dataset.bind] != null) el.textContent = values[el.dataset.bind]; });
  }

  // ---------- Routing ----------
  const PAGES = ['home', 'trainings', 'news', 'server', 'spieler', 'chat', 'karriere', 'statistiken', 'einstellungen', 'netz', 'faq', 'entwickler'];
  // Die App heißt überall nur „Train Sim Germany“
  const TITLES = Object.fromEntries(PAGES.map((p) => [p, 'Train Sim Germany']));
  const RENDER = {
    home() {
      renderHome();
      loadGameStats();
      if (liveMode()) loadLive();
    },
    news() { if (state.newsId) renderArticle(); else renderNewsPage(); },
    netz() { renderNet(); },
    faq() { renderFaq('page'); },
    entwickler() { if (state.memberId) renderMember(); else renderTeam(); },
    chat() { renderChat(); },
    karriere() { renderCareer(); },
    trainings() { renderTrainings(); },
    server() {
      if (state.serverId) { renderServerDetail(); return; }
      $('[data-server-search]').value = state.serverQuery;
      renderServers();
      renderPservers();
    },
    spieler() { renderPlayers(); loadTracked(); },
    statistiken() { renderStatsKpis(); renderChart(); renderBars(); loadGameStats(); },
    einstellungen() { renderSettings(); },
  };

  function route() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, query] = raw.split('?');
    const [first, sub, sub2] = path.split('/');
    // Einladungslink: #/einladung/<code> → Chat „Beitreten“ mit Vorschau
    if (first === 'einladung' && sub) { location.replace(`#/chat/neu/beitreten?code=${encodeURIComponent(sub)}`); return; }
    const page = PAGES.includes(first) ? first : 'home';
    const jobId = page === 'karriere' ? (sub || null) : null;
    const jobApply = !!jobId && sub2 === 'bewerben';
    const jobView = !jobId ? null : jobId === 'pruefen' ? 'review' : jobId === 'verwalten' ? 'manage' : sub2 === 'bewerbung' ? 'mine' : jobApply ? 'apply' : 'detail';
    const reviewId = jobId === 'pruefen' ? (sub2 || null) : null;
    const serverId = page === 'server' && sub ? decodeURIComponent(sub) : null;
    const memberId = page === 'entwickler' && sub ? decodeURIComponent(sub) : null;
    const routeNo = page === 'netz' && sub ? decodeURIComponent(sub).toUpperCase() : null;
    // Neuigkeit als eigene Seite: #/news/<id>
    const newsId = page === 'news' && sub ? decodeURIComponent(sub) : null;
    const chatSub = page === 'chat' ? (sub || '') : null;
    const NEW_VIEWS = { spieler: 'new-dm', gruppe: 'new-group', server: 'new-server', anfrage: 'new-ticket', beitreten: 'join' };
    let chatView = chatSub === null ? null : { '': 'mine', anfragen: 'queue', team: 'team', gruppen: 'public', moderation: 'mod', discord: 'discord', neu: 'new', an: 'direct' }[chatSub] || 'conv';
    if (chatView === 'new' && NEW_VIEWS[sub2]) chatView = NEW_VIEWS[sub2];
    // Beitreten: Code aus dem Link gleich prüfen
    if (chatView === 'join') {
      const code = inviteCodeOf(new URLSearchParams(query || '').get('code') || '');
      if (code && code !== invite.code) {
        Object.assign(invite, { code, preview: null });
        history.replaceState(null, '', '#/chat/neu/beitreten');
        setTimeout(() => { const f = $('form[data-invite-join]'); if (f) joinSubmit(f); }, 60);
      }
    }
    if (chatView === 'conv' && sub2 === 'info') chatView = 'info';
    const chatArg = chatView === 'direct' ? (sub2 || '') : ['conv', 'info'].includes(chatView) ? chatSub : null;
    // Server: #/chat/<id>?k=<kanal> öffnet den Kanal (z. B. aus einer Benachrichtigung)
    const kParam = chatView === 'conv' ? new URLSearchParams(query || '').get('k') : null;
    if (kParam && /^[\w-]{1,30}$/.test(kParam) && chat.ch[chatArg] !== kParam) {
      chat.ch[chatArg] = kParam;
      store.set('tsg-ch', chat.ch);
      const cc = chat.conv[chatArg];
      if (cc && !cc.error && cc.community) { Object.assign(cc, { channel: kParam, messages: [], switching: true }); if (state.chatArg === chatArg && state.chatView === 'conv') { renderChat(); openConv(chatArg); } }
    }
    if (chatView !== state.chatView || chatArg !== state.chatArg) { chat.side = false; chat.cmq = ''; chat.sideAuto = chatView === 'conv' && !kParam ? chatArg : null; }
    const settingsSub = page === 'einstellungen' ? (sub || '') : '';
    const changed = page !== state.page || newsId !== state.newsId || jobId !== state.jobId || jobApply !== state.jobApply || serverId !== state.serverId || memberId !== state.memberId || routeNo !== state.routeNo
      || jobView !== state.jobView || reviewId !== state.reviewId || chatView !== state.chatView || chatArg !== state.chatArg
      || settingsSub !== (state.settingsSub || '');
    if (chatView && chatView !== state.chatView && ['mine', 'queue'].includes(chatView)) chat.at = 0;
    if (chatView === 'public' && state.chatView !== 'public') chat.pubAt = 0;
    if (chatView === 'mod' && state.chatView !== 'mod') chat.modAt = 0;
    if (chatView === 'new-dm' && state.chatView !== 'new-dm') chat.found = null;
    if (['new-group', 'new-server'].includes(chatView) && state.chatView !== chatView) chat.members = [];
    if (chatView === 'new-server' || (page === 'server' && !serverId)) loadPservers(true);
    // Server-Details beim Öffnen frisch laden (wer gerade in welchem Team ist)
    if (page === 'server' && liveMode()) { if (serverId) loadLiveDetail(serverId, serverId !== state.serverId && Date.now() - (live.detailAt[serverId] || 0) > 3000); else loadLive(); }
    // Info öffnen: Gespräch frisch laden (Mitglieder, Rechte)
    if (chatView === 'info' && chatArg && chat.conv[chatArg] && !chat.conv[chatArg].error) openConv(chatArg);
    if (reviewId !== state.reviewId) review.answers = 'all';
    // Liste beim Öffnen frisch laden (neue Bewerbungen von anderen Geräten)
    if (jobView === 'review' && !reviewId && state.jobView !== 'review') review.at = 0;
    if (serverId !== state.serverId) Object.assign(state, { sdTab: liveMode() ? 'players' : 'trains', sdCat: 'all', sdRole: 'all' });
    state.page = page;
    state.jobId = jobId;
    state.jobApply = jobApply;
    state.jobView = jobView;
    state.reviewId = reviewId;
    if (memberId !== state.memberId) team.editing = false;
    state.serverId = serverId;
    state.memberId = memberId;
    state.routeNo = routeNo;
    state.newsId = newsId;
    state.chatView = chatView;
    state.chatArg = chatArg;
    state.settingsSub = settingsSub;
    // Gespräch aus dem Speicher: gleich auf neuen Stand bringen
    if (chatView === 'conv' && chat.conv[chatArg] && !chat.conv[chatArg].error && changed) {
      if (chat.conv[chatArg].updated) openConv(chatArg, { since: chat.conv[chatArg].updated });
    }
    document.body.dataset.page = page;
    document.body.dataset.chatView = chatView || '';
    const view = serverId ? 'server-detail' : newsId ? 'news-article' : memberId ? 'member' : routeNo ? 'net-route' : page;

    $$('.page').forEach((p) => { p.hidden = p.dataset.page !== view; });
    // Inhalt der neuen Seite gleitet nacheinander herein
    const pageEl = $(`.page[data-page="${view}"]`);
    if (changed && pageEl && page !== 'chat' && !reducedMotion()) {
      pageEl.classList.remove('is-entering');
      void pageEl.offsetWidth;
      pageEl.classList.add('is-entering');
      clearTimeout(pageEl.enterTimer);
      pageEl.enterTimer = setTimeout(() => pageEl.classList.remove('is-entering'), 1100);
    }
    $$('[data-nav]').forEach((a) => {
      if (a.dataset.nav === page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    navTone();
    // Video oben nur abspielen, solange die Startseite offen ist
    const hv = $('[data-hero-video]');
    if (hv) { if (page === 'home' && !reducedMotion() && !hv.dataset.userPaused) hv.play().catch(() => {}); else hv.pause(); }
    document.title = TITLES[page];
    closeMenu();
    closeModal();
    RENDER[page]();
    bind();
    if (changed) window.scrollTo({ top: chatView === 'conv' ? document.body.scrollHeight : 0, behavior: 'instant' });
    chatPoll();
    if (chatView === 'mine' || chatView === 'queue') loadChats();
    if (['home', 'karriere', 'trainings', 'news'].includes(page)) refreshOnEnter(page);
    // Aus einer Benachrichtigung: #/spieler?invite=<id> öffnet die Einladung
    const inviteId = new URLSearchParams(query || '').get('invite');
    if (page === 'spieler' && inviteId && sessionToken()) {
      history.replaceState(null, '', '#/spieler');
      delete invites[inviteId];
      openModal('invite', inviteId);
    }
    // Aus einer Benachrichtigung: #/trainings?t=<id> öffnet das Training
    const openId = new URLSearchParams(query || '').get('t');
    if (page === 'trainings' && openId) {
      history.replaceState(null, '', '#/trainings');
      if (findTraining(openId)) openModal('training', openId);
    }
  }

  // Seitenwechsel mit Übergang (View Transitions): Richtung nach der Reihenfolge der Tab-Leiste
  const NAV_ORDER = ['home', 'news', 'trainings', 'spieler', 'chat', 'server', 'karriere', 'statistiken', 'einstellungen'];
  function navigate() {
    const parts = location.hash.replace(/^#\/?/, '').split('?')[0].split('/');
    const next = parts[0] || 'home';
    const nextPage = PAGES.includes(next) ? next : 'home';
    // Andere Seite oder eine Neuigkeit öffnen: Streifen und Ladebildschirm (Unterseiten im Chat usw. ohne)
    const article = nextPage === 'news' && parts[1] ? decodeURIComponent(parts[1]) : null;
    const server = nextPage === 'server' && parts[1] ? decodeURIComponent(parts[1]) : null;
    const member = nextPage === 'entwickler' && parts[1] ? decodeURIComponent(parts[1]) : null;
    const routeTo = nextPage === 'netz' && parts[1] ? decodeURIComponent(parts[1]).toUpperCase() : null;
    if (server && server !== state.serverId) {
      navClose();
      const x = serverLoader(server);
      playLoader(x.text, route, x.opts);
      return;
    }
    if (routeTo && routeTo !== state.routeNo) {
      navClose();
      const r = D.routes.find((x) => x.no === routeTo);
      playLoader(r ? `${r.no} · ${r.line}` : t('Unser Netz'), route, { sub: r ? `${r.from} → ${r.to}` : '' });
      return;
    }
    if (member && member !== state.memberId) {
      navClose();
      const x = memberLoader(member);
      playLoader(x.text, route, x.opts);
      return;
    }
    if (nextPage !== state.page || (article && article !== state.newsId)) {
      navClose();
      playLoader(loaderText(nextPage), route);
      return;
    }
    const from = NAV_ORDER.indexOf(state.page);
    const to = NAV_ORDER.indexOf(PAGES.includes(next) ? next : 'home');
    const sub = next === state.page;
    if (!document.startViewTransition || reducedMotion() || document.visibilityState !== 'visible' || (sub && state.page === 'chat')) { route(); return; }
    document.documentElement.dataset.navDir = sub ? 'deeper' : to < from ? 'back' : 'fwd';
    try { document.startViewTransition(() => route()); } catch (e) { route(); }
  }

  // ---------- Menü ----------
  const menu = $('[data-menu]');
  function openMenu() {
    if (!menu) return;
    if (menuCloseTimer) { clearTimeout(menuCloseTimer); menuCloseTimer = null; menu.classList.remove('is-closing'); }
    menu.hidden = false;
    document.body.classList.add('menu-open');
    $$('[data-menu-open]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
    const first = $('.menu__nav a', menu);
    if (first) first.focus({ preventScroll: true });
  }
  let menuCloseTimer = null;
  function closeMenu() {
    navClose();
    if (!menu || menu.hidden || menuCloseTimer) return;
    document.body.classList.remove('menu-open');
    $$('[data-menu-open]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    const finish = () => { menuCloseTimer = null; menu.classList.remove('is-closing'); menu.hidden = true; };
    if (reducedMotion()) { finish(); return; }
    menu.classList.add('is-closing');
    menuCloseTimer = setTimeout(finish, 200);
  }

  // ---------- Events ----------
  function events() {
    vpBind();
    $$('[data-link]').forEach((a) => { if (D.links[a.dataset.link]) a.href = D.links[a.dataset.link]; });
    $$('[data-me-name]').forEach((el) => { el.textContent = D.me.name; });

    $('.skip-link').addEventListener('click', (e) => { e.preventDefault(); $('#main').focus(); });

    $$('[data-menu-open]').forEach((b) => b.addEventListener('click', openMenu));
    $$('[data-menu-close]').forEach((b) => b.addEventListener('click', closeMenu));
    $$('[data-modal-close]').forEach((b) => b.addEventListener('click', closeModal));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenu(); closeModal(); } });


    // Leiste oben: Menü und Konto als zweite Leiste, schließen mit Esc, Klick daneben oder Seitenwechsel
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-nav-me]')) { navOpen('account'); return; }
      if (e.target.closest('[data-nav-menu]')) { navOpen('menu'); return; }
      if (navMode && (!navRoot.contains(e.target) || e.target.closest('.nav__panel a, .nav__panel button'))) navClose();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') navClose(); });

    // Startseite: Sätze vor und zurück, Pause; Teilen über das System
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-quote-prev], [data-quote-next], [data-quote-play], [data-share-native]');
      if (!el) return;
      const ds = el.dataset;
      if ('quotePrev' in ds) { showQuote(quote.i - 1, -1); quoteAuto(); }
      else if ('quoteNext' in ds) { showQuote(quote.i + 1, 1); quoteAuto(); }
      else if ('quotePlay' in ds) {
        quotePause(!quote.paused);
        const ic = $('.ic', el);
        if (ic) ic.className = `i ${quote.paused ? 'phf-play' : 'phf-pause'} ic`;
        el.setAttribute('aria-label', quote.paused ? t('Abspielen') : t('Pause'));
      } else if (ds.shareNative) navigator.share({ title: ds.shareTitle, url: ds.shareNative }).catch(() => {});
    });

    window.addEventListener('scroll', navTone, { passive: true });
    window.addEventListener('resize', navTone);
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-hero-pause]');
      if (!b) return;
      const v = $('[data-hero-video]');
      if (!v) return;
      v.dataset.userPaused = v.paused ? '' : '1';
      if (v.paused) { v.play().catch(() => {}); b.innerHTML = icon('phf-pause'); b.setAttribute('aria-label', t('Video anhalten')); }
      else { v.pause(); b.innerHTML = icon('phf-play'); b.setAttribute('aria-label', t('Video abspielen')); }
    });

    const topbar = $('[data-topbar]');
    const onScroll = () => topbar.classList.toggle('is-scrolled', window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Klicks, die überall vorkommen (Seiten und Sheets)
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-open], [data-detail], [data-remind], [data-bell], [data-day], [data-pick-day], [data-rank], [data-fav], [data-theme-set], [data-lang-set], [data-skin-set], [data-icon-set]');
      if (!el) return;
      const ds = el.dataset;
      if (ds.skinSet) { setSkin(ds.skinSet); return; }
      if (ds.iconSet) { setAppIcon(ds.iconSet); return; }
      if (ds.open) openModal(ds.open);
      else if (ds.detail) openModal('training', ds.detail);
      else if (ds.remind) toggleReminder(ds.remind);
      else if ('bell' in ds) toggleBell();
      else if (ds.pickDay) { state.trainingDay = +ds.pickDay; closeModal(); renderTrainings(); }
      else if (ds.day) { state.trainingDay = +ds.day; renderTrainings(); }
      else if (ds.rank) {
        state.rank = ds.rank;
        store.set('tsg-rank', ds.rank);
        state.trainingDay = null;
        closeModal();
        renderTrainings();
        renderMe();
        const next = nextRank(ds.rank);
        toast(next ? t('Rang: {rank} – als Nächstes {next}', { rank: ds.rank, next: next.name }) : t('Rang: {rank}', { rank: ds.rank }));
      } else if (ds.themeSet) setTheme(ds.themeSet);
      else if (ds.langSet) {
        langMenu(false, { focus: false });
        setLanguage(ds.langSet).then(() => {
          const btn = $('[data-lang-toggle]');
          if (btn) btn.focus();
          toast(t('Sprache: {name}', { name: ds.langSet === 'auto' ? `${t('Automatisch')} (${langOf(lang).name})` : langOf(lang).name }));
        });
      }
      else if (ds.fav) {
        const name = ds.fav;
        if (state.favs.has(name)) state.favs.delete(name); else state.favs.add(name);
        store.set('tsg-favs', Array.from(state.favs));
        settingsChanged();
        el.setAttribute('aria-pressed', String(state.favs.has(name)));
        toast(state.favs.has(name) ? t('{name} gemerkt', { name: t(name) }) : t('{name} entfernt', { name: t(name) }));
      }
    });

    // Server-ID kopieren
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-copy]');
      if (!b) return;
      const done = () => toast(t('Server-ID kopiert'));
      if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.copy).then(done, () => toast(b.dataset.copy));
      else toast(b.dataset.copy);
    });

    // Sprach-Dropdown
    document.addEventListener('click', (e) => {
      const box = $('[data-lang-picker]');
      const list = box && $('.dropdown__list', box);
      if (!list) return;
      if (e.target.closest('[data-lang-toggle]')) langMenu(list.hidden);
      else if (!box.contains(e.target)) langMenu(false, { focus: false });
    });
    document.addEventListener('keydown', (e) => {
      const box = e.target.closest && e.target.closest('[data-lang-picker]');
      if (!box) return;
      const opts = $$('[role="option"]', box);
      const i = opts.indexOf(e.target);
      if (e.target.matches('[data-lang-toggle]') && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); langMenu(true); return; }
      if (i < 0) return;
      const go = (k) => { e.preventDefault(); opts[(k + opts.length) % opts.length].focus(); };
      if (e.key === 'ArrowDown') go(i + 1);
      else if (e.key === 'ArrowUp') go(i - 1);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(opts.length - 1);
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); langMenu(false); }
      else if (e.key === 'Tab') langMenu(false, { focus: false });
    });
    // Privatsphäre-Schalter
    document.addEventListener('change', (e) => {
      const sw = e.target.closest('[data-privacy-set]');
      if (sw) setPrivacy(sw.dataset.privacySet, sw.checked);
      const ns = e.target.closest('[data-notify-set]');
      if (ns) setNotify(ns.checked);
      const nk = e.target.closest('[data-notify-kind]');
      if (nk) setNotifyKind(nk.dataset.notifyKind, nk.checked);
      if (e.target.closest('[data-fx-motion]')) setMotion(e.target.checked);
      if (e.target.closest('[data-fx-haptics]')) setHaptics(e.target.checked);
      if (e.target.closest('[data-season-toggle]')) setSeason(e.target.checked);
    });
    document.addEventListener('click', (e) => { if (e.target.closest('[data-notify-test]')) testNotify(); });
    document.addEventListener('click', (e) => { const b = e.target.closest('[data-copy-script]'); if (b) copyGameScript(b); });

    // Server-Details: Tabs, Filter, Zug- und Bahnhofsdialog
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-board-cat], [data-board-earlier], [data-board-later], [data-trip-mid], [data-sd-tab], [data-sd-cat], [data-sd-role], [data-trip], [data-station], [data-modal-back], [data-server-people], [data-player], [data-track]');
      if (!el) return;
      const ds = el.dataset;
      const inModal = !!el.closest('[data-modal]');
      if (ds.boardCat) { state.board.cat = ds.boardCat; refreshModal(); }
      else if ('boardEarlier' in ds) { state.board.back = Math.min(120, state.board.back + 30); refreshModal(); }
      else if ('boardLater' in ds) { state.board.more += 12; refreshModal(); }
      else if ('tripMid' in ds) { state.tripMid = !state.tripMid; refreshModal(); }
      else if (ds.sdTab) { state.sdTab = ds.sdTab; renderServerDetail(); }
      else if (ds.sdCat) { state.sdCat = ds.sdCat; renderServerDetail(); }
      else if (ds.sdRole) { state.sdRole = ds.sdRole; renderServerDetail(); }
      else if (ds.trip) openModal('trip', ds.trip, { stack: inModal });
      else if (ds.station) openModal('station', ds.station, { stack: inModal });
      else if (ds.serverPeople) openModal('server-players', ds.serverPeople, { stack: inModal });
      else if (ds.player) openModal('player', ds.player, { stack: inModal });
      else if (ds.track) setTracked(ds.track, !isTracked(ds.track));
      else if ('modalBack' in ds && modalStack.length) {
        const prev = modalStack.pop();
        modalView = prev;
        $('[data-modal-title]').textContent = modalTitle(prev);
        $('[data-modal-body]').innerHTML = modalBody(prev.name, prev.arg);
        $('.sheet-modal__panel', modal).scrollTop = 0;
      }
    });

    // Karussell-Pfeile
    const rail = $('[data-rail="routes"]');
    const step = () => (rail && rail.firstElementChild ? rail.firstElementChild.offsetWidth + 14 : 240);
    if (rail) {
      $('[data-rail-prev="routes"]').addEventListener('click', () => rail.scrollBy({ left: -step() * 2, behavior: 'smooth' }));
      $('[data-rail-next="routes"]').addEventListener('click', () => rail.scrollBy({ left: step() * 2, behavior: 'smooth' }));
    }
    const tabs = $('[data-day-tabs]');
    $('[data-day-prev]').addEventListener('click', () => tabs.scrollBy({ left: -240, behavior: 'smooth' }));
    $('[data-day-next]').addEventListener('click', () => tabs.scrollBy({ left: 240, behavior: 'smooth' }));
    $('[data-all-toggle]').addEventListener('click', () => { state.showAll = !state.showAll; renderTrainings(); });

    // Spieler suchen
    document.addEventListener('submit', (e) => {
      const f = e.target.closest('[data-player-search]');
      if (!f) return;
      e.preventDefault();
      findTrackPlayer(f);
    });

    // Server
    $('[data-server-search]').addEventListener('input', (e) => { state.serverQuery = e.target.value; renderServers(); });
    $('[data-server-filter]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-type]');
      if (!b) return;
      state.serverType = b.dataset.type;
      $$('[data-type]').forEach((x) => x.classList.toggle('is-active', x === b));
      renderServers();
    });

    // Statistiken
    $$('[data-range]').forEach((b) => b.addEventListener('click', () => {
      state.range = b.dataset.range;
      $$('[data-range]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      renderChart();
    }));
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (state.page === 'statistiken') renderChart(); }, 120);
    });

    // Neuigkeiten & Karriere
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-news-cat], [data-news-open], [data-apply-reset], [data-step-next], [data-step-prev], [data-step-to]');
      if (!el) return;
      const ds = el.dataset;
      if (ds.newsCat) {
        state.newsCat = ds.newsCat;
        renderNewsPage();
      } else if (ds.newsOpen) location.hash = `#/news/${encodeURIComponent(ds.newsOpen)}`;
      else if ('stepNext' in ds || 'stepPrev' in ds || ds.stepTo) {
        const form = el.closest('form[data-apply]');
        const step = +form.dataset.step;
        if (ds.stepTo) applyGo(form, +ds.stepTo);
        else if ('stepPrev' in ds) applyGo(form, Math.max(1, step - 1));
        else if (applyCheck(form, step)) applyGo(form, Math.min(3, step + 1));
      }
      else if (ds.applyReset) {
        delete state.applications[ds.applyReset];
        store.set('tsg-applications', state.applications);
        toast(t('Bewerbung zurückgezogen'));
        if (state.jobApply) location.hash = `#/karriere/${ds.applyReset}`;
        else renderCareer();
      }
    });

    document.addEventListener('input', (e) => {
      const target = e.target;
      const form = target.closest('form[data-apply]');
      if (!form) return;
      const field = target.closest('.f.has-error');
      if (field) clearFieldError(field);
      // Zeichen zählen, bis die Mindestlänge erreicht ist
      const q = target.closest('[data-q="long"]');
      const count = q && $('[data-count]', q);
      if (count) {
        const n = target.value.trim().length;
        count.textContent = n >= +count.dataset.count ? t('{n} Zeichen', { n }) : `${n} / ${count.dataset.count}`;
        count.classList.toggle('is-ok', n >= +count.dataset.count);
      }
    });
    // Enter in einem Feld blättert weiter statt abzusenden
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
      const form = e.target.closest('form[data-apply]');
      if (!form || +form.dataset.step === 3) return;
      e.preventDefault();
      const next = $('[data-step-next]', form);
      if (next) next.click();
    });
    document.addEventListener('change', (e) => {
      const form = e.target.closest('form[data-apply]');
      if (!form) return;
      const job = D.jobs.find((x) => x.id === form.dataset.apply);
      const field = e.target.closest('.f.has-error');
      if (field) clearFieldError(field);
      // Rang geändert: wählbare Bereiche neu anzeigen (alles bis zum eigenen Rang)
      if (e.target.name === 'rank' && job.areas) {
        const box = $('[data-areas]', form);
        const chosen = $('input[name="area"]:checked', box);
        box.innerHTML = areasHtml(job, e.target.value, chosen && chosen.value);
      }
    });

    // Privaten Server bearbeiten: Vorschau des Namens, Link-Feld nur bei „Über die App“
    document.addEventListener('input', (e) => {
      if (!e.target.matches('[data-pe-input]')) return;
      const name = $('[data-pe-name]', e.target.closest('form'));
      if (name) name.textContent = e.target.value.trim() || t('Privater Server');
    });
    document.addEventListener('change', (e) => {
      if (e.target.name !== 'join' || !e.target.closest('form[data-pserver-form]')) return;
      const box = $('[data-pe-link]', e.target.closest('form'));
      if (box) box.hidden = e.target.value !== 'app';
    });
    // Netz: Filter nach Art der Linie
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-net-filter-set]');
      if (!b) return;
      state.netFilter = b.dataset.netFilterSet;
      renderNet();
    });
    // Steckbrief bearbeiten
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-member-edit]')) { team.editing = true; renderMember(); const f = $('[data-member-form] textarea'); if (f) f.focus(); }
      else if (e.target.closest('[data-member-cancel]')) { team.editing = false; renderMember(); }
    });
    document.addEventListener('submit', (e) => {
      const f = e.target.closest('form[data-member-form]');
      if (!f) return;
      e.preventDefault();
      saveMember(f);
    });
    // YouTube erst nach dem Antippen laden
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-youtube]');
      if (!b) return;
      b.outerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.dataset.youtube)}?autoplay=1&rel=0" title="${esc(t('Video'))}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    });
    // Server: Kanäle wechseln, bearbeiten, Kategorien
    document.addEventListener('click', async (e) => {
      const el = e.target.closest('[data-cm-browse], [data-cm-ch], [data-cm-edit], [data-cm-new], [data-cm-cat-new], [data-cm-cat-edit], [data-cm-cat], [data-cm-side-open], [data-cm-side-close], [data-cm-convert], [data-cm-go], [data-ch-move], [data-ch-del], [data-cat-move], [data-cat-del]');
      if (!el) return;
      const ds = el.dataset;
      const id = state.chatArg;
      const c = id && chat.conv[id];
      if (ds.cmConvert !== undefined) {
        if (confirm(t('Diese Gruppe in einen Server mit Kanälen umwandeln? Das lässt sich nicht rückgängig machen.'))) await saveLayout(ds.cmConvert, { convert: true }, t('Jetzt ein Server mit Kanälen'));
        return;
      }
      if (!c || c.error) return;
      if (ds.cmSideOpen !== undefined || ds.cmSideClose !== undefined) {
        chat.side = ds.cmSideOpen !== undefined;
        const box = $('[data-cm]');
        if (box) box.classList.toggle('is-open', chat.side);
        if (chat.side) haptic('light');
        return;
      }
      if (ds.cmCh) { switchChannel(id, ds.cmCh); return; }
      if (ds.cmBrowse !== undefined) {
        const all = store.get('tsg-cm-cats', {}) || {};
        delete all[id];
        store.set('tsg-cm-cats', all);
        const side = $('[data-cm-side]');
        if (side) side.outerHTML = cmSide(c);
        const input = $('[data-cm-q]');
        if (input) input.focus();
        return;
      }
      if (ds.cmGo) { location.hash = `#/chat/${id}?k=${encodeURIComponent(ds.cmGo)}`; return; }
      if (ds.cmCat) { toggleCategory(id, ds.cmCat); return; }
      if (ds.cmEdit) { openModal('channel', `${id}:${ds.cmEdit}`); return; }
      if (ds.cmNew !== undefined) { openModal('channel', `${id}:neu:${ds.cmNew}`); return; }
      if (ds.cmCatNew !== undefined) { openModal('category', `${id}:neu`); return; }
      if (ds.cmCatEdit) { openModal('category', `${id}:${ds.cmCatEdit}`); return; }
      const form = el.closest('form');
      if (!form) return;
      const body = layoutBody(c);
      if (ds.chMove || ds.chDel !== undefined) {
        const chId = form.dataset.chForm.split(':')[1];
        const i = body.channels.findIndex((x) => x.id === chId);
        if (i < 0) return;
        if (ds.chDel !== undefined) {
          if (!confirm(t('Kanal #{name} mit allen Nachrichten löschen?', { name: body.channels[i].name }))) return;
          body.channels.splice(i, 1);
          if (body.home === chId) body.home = '';
          await saveLayout(id, body, t('Kanal gelöscht'));
          return;
        }
        // Verschieben innerhalb der eigenen Kategorie
        const cat = body.channels[i].cat || null;
        const same = body.channels.map((x, n) => [x, n]).filter(([x]) => (x.cat || null) === cat).map(([, n]) => n);
        const pos = same.indexOf(i) + Number(ds.chMove);
        if (pos < 0 || pos >= same.length) return;
        const j = same[pos];
        [body.channels[i], body.channels[j]] = [body.channels[j], body.channels[i]];
        await saveLayout(id, body);
        openModal('channel', `${id}:${chId}`);
        return;
      }
      if (ds.catMove || ds.catDel !== undefined) {
        const catId = form.dataset.catForm.split(':')[1];
        const i = body.categories.findIndex((x) => x.id === catId);
        if (i < 0) return;
        if (ds.catDel !== undefined) {
          if (!confirm(t('Kategorie „{name}“ löschen? Die Kanäle bleiben erhalten.', { name: body.categories[i].name }))) return;
          body.categories.splice(i, 1);
          body.channels.forEach((x) => { if (x.cat === catId) x.cat = null; });
          await saveLayout(id, body, t('Kategorie gelöscht'));
          return;
        }
        const j = i + Number(ds.catMove);
        if (j < 0 || j >= body.categories.length) return;
        [body.categories[i], body.categories[j]] = [body.categories[j], body.categories[i]];
        await saveLayout(id, body);
        openModal('category', `${id}:${catId}`);
      }
    });
    document.addEventListener('input', (e) => {
      // Kanäle suchen
      if (e.target.matches('[data-cm-q]')) {
        chat.cmq = e.target.value;
        const c = chat.conv[state.chatArg];
        const side = $('[data-cm-side]');
        if (c && side) {
          const pos = e.target.selectionStart;
          side.outerHTML = cmSide(c);
          const input = $('[data-cm-q]');
          if (input) { input.focus(); input.setSelectionRange(pos, pos); }
        }
        return;
      }
      // Kanalname wie bei Discord: klein, Leerzeichen werden zu „-“
      if (e.target.matches('[data-ch-name]')) {
        const v = e.target.value;
        const next = v.toLowerCase().replace(/\s/g, '-');
        if (next !== v) { const pos = e.target.selectionStart; e.target.value = next; e.target.setSelectionRange(pos, pos); }
      }
    });
    document.addEventListener('change', (e) => {
      const f = e.target.closest('form[data-ch-form]');
      if (f && e.target.name === 'kind') { const ic = $('.ch-name .ic', f); if (ic) ic.outerHTML = icon(e.target.value === 'news' ? 'ph-megaphone' : 'ph-hash'); }
    });
    document.addEventListener('submit', async (e) => {
      const chf = e.target.closest('form[data-ch-form]');
      const catf = e.target.closest('form[data-cat-form]');
      if (!chf && !catf) return;
      e.preventDefault();
      const [id, which] = (chf ? chf.dataset.chForm : catf.dataset.catForm).split(':');
      const c = chat.conv[id];
      if (!c || c.error) return;
      const body = layoutBody(c);
      const btn = $('button[type="submit"]', e.target);
      if (chf) {
        const f = chf.elements;
        const name = chName(f.name.value);
        if (!name) { toast(t('Bitte gib dem Kanal einen Namen.')); f.name.focus(); return; }
        const next = { name, kind: (chf.querySelector('input[name="kind"]:checked') || {}).value || 'text', cat: f.cat.value || null, topic: f.topic.value.trim() };
        if (which === 'neu') body.channels.push({ id: 'neu-1', ...next });
        else Object.assign(body.channels.find((x) => x.id === which) || {}, next);
        if (f.home && f.home.checked && which !== 'neu') body.home = which;
        btn.disabled = true;
        const r = await saveLayout(id, body, which === 'neu' ? t('Kanal #{name} erstellt', { name }) : t('Gespeichert'));
        btn.disabled = false;
        // Neuer Kanal: gleich öffnen
        if (r && which === 'neu') { const made = (r.channels || []).find((x) => x.name === name && !body.channels.some((y) => y.id === x.id && y.id !== 'neu-1')); if (made) switchChannel(id, made.id); }
        return;
      }
      const name = catf.elements.name.value.replace(/\s+/g, ' ').trim();
      if (!name) { toast(t('Bitte gib der Kategorie einen Namen.')); return; }
      if (which === 'neu') body.categories.push({ id: 'neu-k', name });
      else Object.assign(body.categories.find((x) => x.id === which) || {}, { name });
      btn.disabled = true;
      await saveLayout(id, body, which === 'neu' ? t('Kategorie erstellt') : t('Gespeichert'));
      btn.disabled = false;
    });

    // Einladungslinks: teilen (Server-Leiste) und beitreten
    document.addEventListener('click', (e) => { const el = e.target.closest('[data-cm-invite-id]'); if (el) shareInvite(el.dataset.cmInviteId); });
    document.addEventListener('submit', (e) => { const f = e.target.closest('form[data-invite-join]'); if (f) { e.preventDefault(); joinSubmit(f); } });

    // Eigene Bots
    document.addEventListener('click', async (e) => {
      const el = e.target.closest('[data-bot-new], [data-bot-edit], [data-bot-del], [data-bot-photo-del]');
      if (!el) return;
      const ds = el.dataset;
      if (ds.botNew) openModal('botnew', ds.botNew);
      else if (ds.botEdit) { delete botsFull[ds.botEdit.split(':')[1]]; openModal('bot', ds.botEdit); }
      else if (ds.botDel) {
        const [cid, bid] = ds.botDel.split(':');
        if (!confirm(t('Bot löschen? Seine Regeln gehen verloren.'))) return;
        if (await botCall(cid, `/${encodeURIComponent(bid)}`, { method: 'DELETE' })) {
          delete botsFull[bid];
          closeModal();
          toast(t('Bot gelöscht'));
          openConv(cid);
        }
      } else if (ds.botPhotoDel) {
        const [cid, bid] = ds.botPhotoDel.split(':');
        const r = await botCall(cid, `/${encodeURIComponent(bid)}/photo`, { method: 'DELETE' });
        if (r) botChanged(cid, r);
      }
    });
    document.addEventListener('change', (e) => {
      if (e.target.matches('[data-bot-photo]') && e.target.files && e.target.files[0]) uploadBotPhoto(e.target.dataset.botPhoto, e.target.files[0]);
    });
    document.addEventListener('submit', async (e) => {
      const bc = e.target.closest('form[data-bot-create]');
      if (bc) {
        e.preventDefault();
        const cid = bc.dataset.botCreate;
        const name = bc.elements.name.value.trim();
        if (name.length === 1) { toast(t('Der Name braucht mindestens 2 Zeichen.')); return; }
        const btn = $('button[type="submit"]', bc);
        btn.disabled = true;
        const r = await botCall(cid, '', { method: 'POST', body: { name } });
        btn.disabled = false;
        if (!r) return;
        botsFull[r.id] = r;
        haptic('success');
        toast(t('Bot erstellt'));
        openConv(cid);
        openModal('bot', `${cid}:${r.id}`);
        return;
      }
      const bf = e.target.closest('form[data-bot-form]');
      if (bf) {
        e.preventDefault();
        const f = bf.elements;
        const body = {
          name: f.name.value.trim(), desc: f.desc.value.trim(), prefix: f.prefix.value.trim() || '!', on: f.on.checked,
          rules: $$('[data-auto-row]', bf).map((row) => ({
            id: row.dataset.autoId || undefined, trigger: $('select[name="trigger"]', row).value, target: $('select[name="target"]', row).value,
            command: $('input[name="command"]', row).value.trim().replace(/^[!?.$%&#+~-]+/, ''), template: $('textarea', row).value, on: $('input[name="on"]', row).checked,
          })).filter((r) => r.template.trim()),
        };
        if (body.rules.some((r) => r.trigger === 'command' && !r.command)) { toast(t('Bei einer Befehl-Regel fehlt der Befehl.')); return; }
        const btn = $('button[type="submit"]', bf);
        btn.disabled = true;
        const r = await botCall(bf.dataset.botForm, `/${encodeURIComponent(bf.dataset.botId)}`, { method: 'PUT', body });
        btn.disabled = false;
        if (r) { haptic('success'); toast(t('Gespeichert')); botChanged(bf.dataset.botForm, r); }
      }
    });
    // Rollen und Discord im Server-Chat, Prüfung der Discord-Verbindungen
    document.addEventListener('click', async (e) => {
      const el = e.target.closest('[data-role-edit], [data-role-del], [data-mem-roles], [data-auto-add], [data-auto-del], [data-discord-test], [data-discord-submit], [data-discord-remove], [data-dreq-accept], [data-dreq-deny]');
      if (!el) return;
      const ds = el.dataset;
      const conv = state.chatArg;
      if (ds.roleEdit) openModal('role', `${conv}:${ds.roleEdit}`);
      else if (ds.roleDel) {
        const c = chat.conv[ds.roleChat];
        if (c && confirm(t('Rolle löschen? Alle verlieren sie.'))) saveRoles(c.id, (c.roles || []).filter((r) => r.id !== ds.roleDel), t('Rolle gelöscht'));
      } else if (ds.memRoles) openModal('memroles', `${conv}:${ds.memRoles}`);
      else if ('autoAdd' in ds) {
        const list = $('[data-auto-list]', el.closest('form'));
        if (list) { list.insertAdjacentHTML('beforeend', ruleRow({ trigger: 'join', target: 'chat' }, el.dataset.discordOn === '1')); $('textarea', list.lastElementChild).focus(); }
      } else if ('autoDel' in ds) el.closest('[data-auto-row]').remove();
      else if (ds.discordTest) { el.disabled = true; await discordCall(ds.discordTest, '/test', { method: 'POST' }, t('Testnachricht gesendet')); el.disabled = false; }
      else if (ds.discordSubmit) {
        el.disabled = true;
        if (await discordCall(ds.discordSubmit, '/submit', { method: 'POST' }, t('Eingereicht – das Team prüft die Verbindung'))) { haptic('success'); openConv(ds.discordSubmit); }
        el.disabled = false;
      } else if (ds.discordRemove) {
        if (confirm(t('Discord-Verbindung entfernen? Webhook bzw. Bot-Token werden gelöscht.'))) discordCall(ds.discordRemove, '', { method: 'DELETE' }, t('Verbindung entfernt'));
      } else if (ds.dreqAccept) reviewDiscord(ds.dreqAccept, 'accept');
      else if (ds.dreqDeny) reviewDiscord(ds.dreqDeny, 'deny');
    });
    document.addEventListener('submit', (e) => {
      const rf = e.target.closest('form[data-role-form]');
      if (rf) {
        e.preventDefault();
        const c = chat.conv[rf.dataset.roleForm];
        if (!c) return;
        const role = { id: rf.dataset.roleId, name: rf.elements.name.value.trim(), color: (rf.querySelector('input[name="color"]:checked') || {}).value, perms: $$('input[name="perm"]:checked', rf).map((x) => x.value) };
        if (role.name.length < 2) { toast(t('Bitte gib der Rolle einen Namen.')); return; }
        const roles = role.id === 'new' ? [...(c.roles || []), { ...role, id: undefined }] : (c.roles || []).map((r) => (r.id === role.id ? role : r));
        saveRoles(c.id, roles, t('Rollen gespeichert'));
        return;
      }
      const mr = e.target.closest('form[data-mem-roles-form]');
      if (mr) {
        e.preventDefault();
        chatCall(mr.dataset.memRolesForm, `/members/${mr.dataset.mem}`, { method: 'PUT', body: { roles: $$('input[name="role"]:checked', mr).map((x) => x.value) } }, () => {})
          .then((r) => { if (r) { closeModal(); renderChat(); toast(t('Rollen vergeben')); } });
        return;
      }
      const df = e.target.closest('form[data-discord-form]');
      if (df) {
        e.preventDefault();
        const btn = $('button[type="submit"]', df);
        btn.disabled = true;
        discordCall(df.dataset.discordForm, '', { method: 'PUT', body: readDiscordForm(df) }, t('Gespeichert')).finally(() => { btn.disabled = false; });
      }
    });
    // Chat
    document.addEventListener('click', async (e) => {
      const el = e.target.closest('[data-chat-claim], [data-chat-close], [data-chat-join], [data-chat-joinmod], [data-chat-hide], [data-chat-delete], [data-chat-leave], [data-chat-report], [data-chat-edit], [data-mem-role], [data-mem-del], [data-msg-del], [data-msg], [data-photo], [data-tray-del], [data-cmd], [data-mod-kind], [data-member-add], [data-member-del], [data-chat-cat], [data-pserver-edit], [data-ps-unlink], [data-group-photo-del]');
      if (!el) return;
      const ds = el.dataset;
      const conv = state.chatArg;
      if (ds.chatClaim) { el.disabled = true; chatAction(ds.chatClaim, 'claim'); }
      else if (ds.chatClose) { if (confirm(t('Gespräch wirklich beenden?'))) chatAction(ds.chatClose, 'close'); }
      else if (ds.chatJoin) {
        el.disabled = true;
        const r = await chatCall(ds.chatJoin, '/join', { method: 'POST', body: {} }, () => {});
        if (r) { toast(t('Du bist beigetreten')); chat.pubAt = 0; location.hash = `#/chat/${ds.chatJoin}`; renderChat(); }
        el.disabled = false;
      } else if (ds.chatJoinmod) {
        if (confirm(t('Sichtbar beitreten? Alle im Gespräch sehen dann, dass die Moderation dabei ist.'))) await chatCall(ds.chatJoinmod, '/join', { method: 'POST', body: { mod: true } });
      } else if (ds.chatHide) {
        if (!confirm(t('Gespräch für dich löschen? Es verschwindet aus deiner Liste, bis jemand Neues schreibt.'))) return;
        if (await chatCall(ds.chatHide, '/hide', { method: 'POST' }, () => {})) {
          if (chat.list) chat.list.chats = chat.list.chats.filter((x) => x.id !== ds.chatHide);
          toast(t('Gespräch gelöscht'));
          if (state.chatView === 'mine') renderChat(); else location.hash = '#/chat';
        }
      } else if (ds.chatDelete) {
        if (!confirm(t('Gespräch für alle löschen? Alle Nachrichten, Fotos und Videos sind dann weg.'))) return;
        if (await chatCall(ds.chatDelete, '', { method: 'DELETE' }, () => {})) { delete chat.conv[ds.chatDelete]; toast(t('Gespräch gelöscht')); location.hash = '#/chat'; }
      } else if (ds.chatLeave) {
        if (!confirm(t('Wirklich verlassen?'))) return;
        if (await chatCall(ds.chatLeave, '/leave', { method: 'POST' }, () => {})) { delete chat.conv[ds.chatLeave]; toast(t('Du hast das Gespräch verlassen')); location.hash = '#/chat'; }
      } else if (ds.chatReport) {
        const text = prompt(t('Was ist passiert? Das Team für Meldungen sieht deine Nachricht und das Gespräch.'));
        if (text === null) return;
        const r = await chatCall(ds.chatReport, '/report', { method: 'POST', body: { text } }, () => {});
        if (r) { toast(t('Danke – die Meldung ist beim Team.')); location.hash = `#/chat/${r.ticket}`; }
      } else if ('chatEdit' in ds) { chat.edit = !chat.edit; renderChat(); }
      else if (ds.memRole) {
        const c = chat.conv[conv];
        if (ds.memRole === 'owner' && !confirm(t('Wirklich zum Inhaber machen? Du bist dann nur noch Admin.'))) return;
        if (c) await chatCall(c.id, `/members/${ds.mem}`, { method: 'PUT', body: { role: ds.memRole } });
      } else if (ds.memDel) {
        const c = chat.conv[conv];
        if (c && confirm(t('Aus der Gruppe entfernen?'))) await chatCall(c.id, `/members/${ds.memDel}`, { method: 'DELETE' });
      } else if (ds.msgDel) {
        if (confirm(t('Nachricht löschen?'))) await chatCall(conv, `/messages/${ds.msgDel}`, { method: 'DELETE' }, () => updateConv(conv));
      } else if (ds.msg) {
        if (e.target.closest('a, button, video')) return;
        const li = el.closest('li');
        $$('.msg.is-open').forEach((x) => { if (x !== li) x.classList.remove('is-open'); });
        li.classList.toggle('is-open');
      } else if (ds.photo) openModal('photo', ds.photo);
      else if (ds.trayDel) {
        const list = chat.pending[conv] || [];
        const p = list.find((x) => x.key === ds.trayDel);
        if (p && p.preview) URL.revokeObjectURL(p.preview);
        chat.pending[conv] = list.filter((x) => x.key !== ds.trayDel);
        renderTray(conv);
      } else if (ds.cmd) {
        const ta = $('.compose textarea');
        if (ta) { ta.value = ds.cmd; ta.focus(); hideCommands(); if (!ds.cmd.endsWith(' ')) ta.form.requestSubmit(); }
      } else if (ds.modKind !== undefined) { chat.modKind = ds.modKind; chat.mod = null; renderChat(); loadMod(true); }
      else if (ds.chatCat) { chat.cat = ds.chatCat; renderChat(); }
      else if (ds.pserverEdit) {
        if (!chat.list) await loadChats(true);
        openModal('pserver', ds.pserverEdit);
      } else if (ds.psUnlink) {
        if (!confirm(t('Server vom Chat trennen?'))) return;
        if (await chatCall(conv, '/servers', { method: 'POST', body: { remove: ds.psUnlink } })) loadPservers(true);
      } else if (ds.groupPhotoDel) {
        if (confirm(t('Gruppenbild entfernen?'))) chatCall(ds.groupPhotoDel, '/photo', { method: 'DELETE' });
      }
      else if ('memberAdd' in ds) addGroupMember();
      else if (ds.memberDel) { chat.members = chat.members.filter((p) => p.userId !== ds.memberDel); $('[data-member-chips]').innerHTML = memberChips(); }
    });
    document.addEventListener('change', (e) => {
      if (e.target.matches('[data-chat-file]')) {
        addChatFiles(state.chatArg, e.target.files);
        e.target.value = '';
      } else if (e.target.matches('[data-group-photo]')) {
        const file = e.target.files[0];
        const id = e.target.dataset.groupPhoto;
        e.target.value = '';
        if (file) uploadGroupPhoto(id, file);
      } else if (e.target.matches('[data-chat-mute]')) {
        chatCall(e.target.dataset.chatMute, '/mute', { method: 'POST', body: { muted: e.target.checked } }, () => toast(e.target.checked ? t('Stummgeschaltet') : t('Benachrichtigungen an')));
      }
    });
    let chatSearchTimer = null;
    document.addEventListener('input', (e) => {
      if (e.target.matches('[data-chat-search]')) {
        chat.query = e.target.value;
        const box = $('[data-chat-team]');
        if (box) box.innerHTML = chatTeamList();
      } else if (e.target.matches('[data-chat-pubsearch], [data-chat-modsearch]')) {
        const pub = e.target.matches('[data-chat-pubsearch]');
        if (pub) chat.pubQuery = e.target.value; else chat.modQuery = e.target.value;
        clearTimeout(chatSearchTimer);
        chatSearchTimer = setTimeout(() => (pub ? loadPublic(true) : loadMod(true)), 300);
      } else if (e.target.matches('.compose textarea')) {
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
        showCommands(e.target);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.target.matches('.compose textarea')) {
        e.preventDefault();
        e.target.form.requestSubmit();
      } else if (e.key === 'Enter' && e.target.matches('[data-member-input]')) {
        e.preventDefault();
        addGroupMember();
      } else if (e.key === 'Escape' && e.target.matches('.compose textarea')) hideCommands();
    });
    document.addEventListener('change', (e) => {
      const form = e.target.closest('form[data-chat-new]');
      if (!form) return;
      if (e.target.name === 'area') form.dataset.areaTouched = '1';
      if (e.target.name === 'reason' && !form.dataset.areaTouched) {
        const area = form.querySelector(`input[name="area"][value="${e.target.dataset.areaHint}"]`);
        if (area) area.checked = true;
      }
    });
    // Stellen verwalten
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-job-edit], [data-job-apps], [data-rv-answers]');
      if (!el) return;
      const ds = el.dataset;
      if (ds.jobEdit) openModal('job-edit', ds.jobEdit);
      else if (ds.jobApps) { review.job = ds.jobApps; review.filter = 'all'; location.hash = '#/karriere/pruefen'; }
      else if (ds.rvAnswers) { review.answers = ds.rvAnswers; renderCareer(); }
    });
    document.addEventListener('change', (e) => {
      const sw = e.target.closest('[data-job-toggle]');
      if (!sw) return;
      const job = D.jobs.find((x) => x.id === sw.dataset.jobToggle);
      if (job) putJob(job.id, jobBody(job, { open: sw.checked }), sw.checked ? t('{name} ist jetzt offen', { name: t(job.title) }) : t('{name} ist jetzt geschlossen', { name: t(job.title) }));
    });
    // Bewerbungen prüfen
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-rv-filter], [data-rv-job], [data-review], [data-announce]');
      if (!el) return;
      const ds = el.dataset;
      if (ds.rvFilter) { review.filter = ds.rvFilter; renderCareer(); }
      else if (ds.rvJob) { review.job = ds.rvJob; renderCareer(); }
      else if (ds.review) setReview(ds.review);
      else if ('announce' in ds) announceSelected();
    });

    // Trainings und Neuigkeiten erstellen/löschen
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-training-del], [data-news-del], [data-news-edit], [data-nbtn-add], [data-nbtn-del]');
      if (!el) return;
      const ds = el.dataset;
      if (ds.trainingDel) deleteTraining(ds.trainingDel);
      else if (ds.newsEdit) openModal('news-edit', ds.newsEdit);
      else if (ds.newsDel) deleteNews(ds.newsDel);
      else if ('nbtnAdd' in ds) {
        const box = $('[data-nbtns]', el.closest('form'));
        if ($$('[data-nbtn]', box).length < 2) box.insertAdjacentHTML('beforeend', newsBtnRow());
        el.hidden = $$('[data-nbtn]', box).length >= 2;
      } else if ('nbtnDel' in ds) {
        const form = el.closest('form');
        el.closest('[data-nbtn]').remove();
        $('[data-nbtn-add]', form).hidden = false;
      }
    });
    document.addEventListener('change', (e) => {
      const form = e.target.closest('form[data-news-new]');
      if (!form) return;
      if (e.target.name === 'media') $$('[data-media-in]', form).forEach((x) => { x.hidden = x.dataset.mediaIn !== e.target.value; });
      if (e.target.name === 'btype') {
        // Text und Link passend zur Art vorschlagen, solange sie nicht selbst geändert wurden
        const row = e.target.closest('[data-nbtn]');
        const k = NEWS_BUTTONS[e.target.value];
        const label = $('[name="blabel"]', row);
        const url = $('[name="burl"]', row);
        if (!label.value || Object.values(NEWS_BUTTONS).some((b) => t(b.label) === label.value)) label.value = t(k.label);
        if (!url.value || Object.values(NEWS_BUTTONS).some((b) => b.url() && b.url() === url.value)) url.value = k.url();
      }
      if (e.target.name === 'file') {
        const file = e.target.files && e.target.files[0];
        const prev = $('[data-upload-preview]', form);
        if (file) { prev.src = URL.createObjectURL(file); prev.hidden = false; $('[data-upload-label]', form).textContent = file.name; }
      }
    });

    document.addEventListener('submit', (e) => {
      const jform = e.target.closest('form[data-job-form]');
      if (jform) { e.preventDefault(); saveJobForm(jform); return; }
      const fp = e.target.closest('form[data-find-player]');
      if (fp) { e.preventDefault(); findPlayer(fp); return; }
      const cform = e.target.closest('form[data-chat-new], form[data-chat-direct], form[data-group-new], form[data-server-new]');
      if (cform) { e.preventDefault(); sendChat(cform); return; }
      const gedit = e.target.closest('form[data-group-edit]');
      if (gedit) {
        e.preventDefault();
        const f = gedit.elements;
        chatCall(gedit.dataset.groupEdit, '', { method: 'PUT', body: { name: f.name.value, desc: f.desc.value, rules: f.rules.value, color: (gedit.querySelector('input[name="color"]:checked') || {}).value, settings: readGroupSettings(gedit) } })
          .then((r) => { if (r) toast(t('Gespeichert')); });
        return;
      }
      const psForm = e.target.closest('form[data-pserver-form]');
      if (psForm) {
        e.preventDefault();
        const f = psForm.elements;
        const body = {
          name: f.name.value, join: (psForm.querySelector('input[name="join"]:checked') || {}).value, link: f.link.value.trim(),
          access: (psForm.querySelector('input[name="access"]:checked') || {}).value, show: (psForm.querySelector('input[name="show"]:checked') || {}).value || 'public', chat: f.chat.value || null,
          welcome: f.welcome.value, relay: f.relay.checked,
        };
        const btn = $('button[type="submit"]', psForm);
        btn.disabled = true;
        api(`/api/pservers/${encodeURIComponent(psForm.dataset.pserverForm)}`, { method: 'PUT', body })
          .then(() => { toast(t('Gespeichert')); closeModal(); chat.at = 0; loadPservers(true); if (state.chatView === 'info' && state.chatArg) openConv(state.chatArg); })
          .catch((err) => { btn.disabled = false; toast(chatError(err)); });
        return;
      }
      const psLink = e.target.closest('form[data-ps-link]');
      if (psLink) {
        e.preventDefault();
        chatCall(psLink.dataset.psLink, '/servers', { method: 'POST', body: { add: psLink.elements.server.value } }).then((r) => { if (r) { toast(t('Server verbunden')); loadPservers(true); } });
        return;
      }
      const invite = e.target.closest('form[data-member-invite]');
      if (invite) {
        e.preventDefault();
        const name = invite.elements.name.value.trim().replace(/^@/, '');
        if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) { toast(t('Bitte gib einen gültigen Roblox-Namen ein.')); return; }
        chatCall(invite.dataset.memberInvite, '/members', { method: 'POST', body: { users: [name] } }).then((r) => { if (r) toast(t('Hinzugefügt')); });
        return;
      }
      const mform = e.target.closest('form[data-chat-send]');
      if (mform) { e.preventDefault(); sendMessage(mform); return; }
      const tform = e.target.closest('form[data-training-new]');
      if (tform) { e.preventDefault(); submitTraining(tform); return; }
      const nform = e.target.closest('form[data-news-new]');
      if (nform) { e.preventDefault(); submitNews(nform); return; }
      const connect = e.target.closest('form[data-connect]');
      if (connect) { e.preventDefault(); connectRoblox(connect); return; }
      const form = e.target.closest('form[data-apply]');
      if (!form) return;
      e.preventDefault();
      submitApplication(form);
    });

    document.addEventListener('click', (e) => { if (e.target.closest('[data-roblox-login]')) robloxLogin(); });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-disconnect]')) return;
      if (state.profile && state.profile.oauth) {
        // Dieses Gerät bekommt keine Nachrichten mehr für das Konto
        if (sessionToken()) unlinkPush().finally(() => api('/auth/logout', { method: 'POST' }).catch(() => {}).finally(() => signedOut(t('Abgemeldet'))));
        else signedOut(t('Abgemeldet'));
        return;
      }
      state.profile = null;
      store.set('tsg-profile', null);
      renderMe();
      if (state.page === 'einstellungen') renderSettings();
      refreshModal();
      toast(t('Verbindung zu Roblox getrennt'));
    });

    // App installieren (Chrome, Edge, Android); auf dem iPhone über „Zum Home-Bildschirm“
    let installEvent = null;
    const showInstall = (on) => $$('[data-install]').forEach((b) => { b.hidden = !on; });
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      installEvent = e;
      showInstall(true);
    });
    window.addEventListener('appinstalled', () => {
      installEvent = null;
      showInstall(false);
      toast(t('App installiert'));
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-install]') || !installEvent) return;
      installEvent.prompt();
      installEvent.userChoice.finally(() => { installEvent = null; showInstall(false); });
    });
    if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !standalone) $$('[data-install-ios]').forEach((el) => { el.hidden = false; });

    window.addEventListener('hashchange', navigate);
  }

  // ---------- Live-Takt ----------
  function tick() {
    const now = berlinNow();
    const clock = `${pad(now.h)}:${pad(now.m)}`;
    $$('[data-clock]').forEach((el) => { el.textContent = clock; });
    $$('[data-clock-full]').forEach((el) => { el.textContent = `${clock}:${pad(now.s)}`; });
    const ago = Math.round((Date.now() - state.updatedAt) / 1000);
    $$('[data-updated]').forEach((el) => { el.textContent = ago < 5 ? t('gerade eben') : t('vor {n} s', { n: ago }); });
  }

  let lastMinute = -1;
  function liveRefresh() {
    const now = berlinNow();
    if (now.abs === lastMinute && (Date.now() - state.updatedAt) < 20000) return;
    const minuteChanged = now.abs !== lastMinute;
    lastMinute = now.abs;
    state.updatedAt = Date.now();
    bind();
    // Echte Server und verfolgte Spieler alle 30 Sekunden
    if (document.visibilityState === 'visible') {
      if (state.page === 'server' && liveMode()) { if (state.serverId) loadLiveDetail(state.serverId); else loadLive(); }
      if (state.page === 'spieler') loadTracked();
      if (modalView && modalView.name === 'player' && pl.data[modalView.arg] && Date.now() - pl.data[modalView.arg].at > 30000) refreshModal();
      if (state.page === 'home' && liveMode()) loadLive();
    }
    if (!minuteChanged) return;
    if (['home', 'statistiken'].includes(state.page) && document.visibilityState === 'visible') loadGameStats();
    if (now.m === 0) applySeason();
    remindersTick();
    // Serverstatus der Trainings (offen / öffnet bald / geschlossen) jede Minute aktualisieren
    if (state.page === 'home') renderNextSteps();
    if (state.page === 'trainings' && modal.hidden) renderTrainings();
    if (modalView && modalView.name === 'training') refreshModal();
    if (state.page === 'server' && !liveMode()) {
      if (modal.hidden) RENDER.server();
      else if (modalView && (modalView.name === 'trip' || modalView.name === 'station')) refreshModal();
    }
  }

  // ---------- Start ----------
  // Offline-Fähigkeit als App (nur über http/https möglich)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
  $$('[data-year]').forEach((el) => { el.textContent = berlinNow().y; });
  let loginNote = null;
  applyGroupRank();
  setLanguage(langSetting(), { start: true }).then(async () => {
    loginNote = await oauthCallback();
    if (loginNote === null) syncGroupRank().then(() => { renderMe(); if (state.page === 'trainings') renderTrainings(); });
  }).then(() => {
    events();
    renderMe();
    // Beim Öffnen der Seite: kurzer Ladebildschirm mit Logo (ohne Streifen)
    playLoader(loaderText((location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]) || 'home'), route, { splash: true });
    if (loginNote === 'ok' && state.profile) {
      const r = rankOf(state.rank);
      toast(state.rankFromGroup ? t('Angemeldet als {name} · Rang: [{prefix}] {rank}', { name: state.profile.displayName, prefix: r.prefix, rank: r.name })
        : t('Angemeldet als {name}', { name: state.profile.displayName }));
    } else if (loginNote) toast(loginNote);
    else if (needsReLogin()) toast(t('Deine Anmeldung ist abgelaufen. Bitte melde dich neu mit Roblox an.'));
    remindersTick();
    // Echte Daten: Inhalte und Einstellungen vom Backend, Zahlen von Roblox und Discord
    loadContent();
    loadMe();
    loadStats();
    loadChats();
    let lastSync = Date.now();
    const sync = () => { lastSync = Date.now(); loadContent(); loadMe(); loadChats(true); };
    setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 120000);
    // Neue Nachrichten im Chat (roter Punkt unten)
    setInterval(() => { if (document.visibilityState === 'visible' && state.page !== 'chat') loadChats(true); }, 45000);
    setInterval(loadStats, 600000);
    // Zurück in die App (z. B. auf einem anderen Gerät etwas geändert): gleich abgleichen
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastSync > 15000) sync(); });
    applySeason();
    applyAppIcon();
    tick();
    lastMinute = berlinNow().abs;
    setInterval(tick, 1000);
    setInterval(liveRefresh, 1000);
    // „Automatisch“: ändert sich die Gerätesprache, wechselt die Seite mit
    window.addEventListener('languagechange', () => { if (langSetting() === 'auto') setLanguage('auto'); });
  });
})();
