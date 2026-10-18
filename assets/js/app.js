/* Train Sim Germany – App-Logik (Routing, Live-Daten, Rendering) */
(function () {
  'use strict';

  const D = window.TSG;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  // ---------- Hilfsfunktionen ----------
  const nf = new Intl.NumberFormat('de-DE');
  const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
  const fmt = (n) => nf.format(n);
  const compact = (n) => (n >= 1e6 ? nf1.format(n / 1e6) + ' Mio.' : n >= 1e3 ? nf1.format(n / 1e3) + 'K' : fmt(n));
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Flaticon UIcons, z. B. icon('fi-rr-home')
  const icon = (name, cls = '') => `<i class="fi ${name} ic ${cls}" aria-hidden="true"></i>`;
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* Speicher nicht verfügbar */ }
    },
  };

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
  const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const MONTHS_SHORT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
  const dateOf = (day) => new Date(day * 864e5); // UTC-Datum des Kalendertags
  const wdShort = (day) => WEEKDAYS[dateOf(day).getUTCDay()].slice(0, 2);
  function dayName(day, { long = false } = {}) {
    const today = berlinNow().day;
    const dt = dateOf(day);
    const full = `${WEEKDAYS[dt.getUTCDay()]}, ${dt.getUTCDate()}. ${MONTHS[dt.getUTCMonth()]}`;
    if (day === today) return long ? `Heute, ${dt.getUTCDate()}. ${MONTHS[dt.getUTCMonth()]}` : 'Heute';
    if (day === today + 1) return long ? `Morgen, ${dt.getUTCDate()}. ${MONTHS[dt.getUTCMonth()]}` : 'Morgen';
    return long ? full : `${wdShort(day)}, ${dt.getUTCDate()}. ${MONTHS_SHORT[dt.getUTCMonth()]}`;
  }
  function relTime(absMin) {
    const diff = absMin - berlinNow().abs;
    if (diff <= 0) return 'läuft gerade';
    if (diff < 60) return `in ${diff} Min.`;
    if (diff < 24 * 60) return `in ${Math.round(diff / 60)} Std.`;
    const d = Math.round(diff / 1440);
    return d === 1 ? 'in 1 Tag' : `in ${d} Tagen`;
  }

  // ---------- Ränge & Ausbildung ----------
  const RANKS = D.ranks;
  const rankIdx = (name) => RANKS.findIndex((r) => r.name === name);
  const rankOf = (name) => RANKS[Math.max(0, rankIdx(name))];
  const typeOf = (name) => D.trainingTypes.find((t) => t.name === name);
  // Nächster Rang mit eigenem Training (z. B. Conductor → Signaller)
  function nextRank(rank) {
    for (let i = rankIdx(rank) + 1; i < RANKS.length; i++) if (typeOf(RANKS[i].name)) return RANKS[i];
    return null;
  }
  const reqFor = (type) => RANKS[Math.max(0, rankIdx(type) - 1)].name;
  const roleBadge = (role) => `<span class="role" style="--rc:${rankOf(role).color}">${esc(role)}</span>`;

  // ---------- Zustand ----------
  const state = {
    page: 'home',
    homeStation: 'Hamburg Hbf',
    station: 'Hamburg Hbf',
    mode: 'dep',
    cat: 'all',
    serverType: 'all',
    serverQuery: '',
    playerSort: 'km',
    playerQuery: '',
    range: '24',
    rank: rankIdx(store.get('tsg-rank', '')) >= 0 ? store.get('tsg-rank', '') : D.me.rank,
    trainingDay: null,
    typeFilter: new Set(store.get('tsg-tfilter', [])),
    showAll: false,
    bell: store.get('tsg-bell', false),
    favs: new Set(store.get('tsg-favs', [])),
    signups: new Set(store.get('tsg-signups', [])),
    online: D.stats.online,
    updatedAt: Date.now(),
    // Reiseauskunft
    trip: { from: '', to: '', via: '', dayOffset: 0, time: null, products: new Set(['fern', 'regio', 's']), directOnly: false },
    optDraft: null,
    tripResults: null,
    planConn: null,
    planOpen: {},
    quick: store.get('tsg-quick', D.quickSearch.slice()),
    quickSel: null,
    quickEdit: false,
    favStations: new Set(store.get('tsg-fav-stations', ['Hamburg Hbf', 'Berlin Hbf'])),
    history: store.get('tsg-history', ['Leipzig Hbf', 'Frankfurt (Main) Hbf', 'Dresden Hbf']),
    pinned: store.get('tsg-pinned', null),
    pickerTarget: null,
    // Neuigkeiten & Karriere
    newsCat: 'all',
    jobId: null,
    jobApply: false,
    quizAnswers: {},
    applications: store.get('tsg-applications', {}),
  };

  // ---------- Abfahrten (aus Linien & Takt berechnet) ----------
  const CAT_GROUP = { ice: 'fern', ic: 'fern', re: 'regio', rb: 'regio', s: 's' };
  const GUESTS = ['Gast_4821', 'Bahnfreund22', 'Tf_Hannah', 'RegioRalf', 'Speedy_ICE', 'Elias_BR423', 'ZugZwang', 'LokLiebe'];
  const DRIVERS = D.players.map((p) => p.name).concat(GUESTS);
  const ALL_STOPS = Array.from(new Set(D.lines.flatMap((l) => l.stops.map((s) => s[0])))).sort((a, b) => a.localeCompare(b, 'de'));
  const stationInfo = (name) => D.stations.find((s) => s.name === name) || { name, region: 'Regionalnetz', tracks: 6, img: 'route-forest.svg' };

  // Fahrplan-Helfer: Richtung, Takt-Versatz, Verspätung je Fahrt, Gleis
  function orient(line, dir) {
    const total = line.stops[line.stops.length - 1][1];
    return dir === 0 ? line.stops : line.stops.slice().reverse().map(([n, t]) => [n, total - t]);
  }
  const lineOffset = (line, dir) => (dir === 0 ? line.offset : (line.offset + Math.floor(line.every / 2)) % line.every);
  function runInfo(run) {
    const r = hash(run);
    const roll = r % 100;
    const cancelled = roll < 2;
    let delay = 0;
    if (!cancelled && roll < 10) delay = 6 + ((r >>> 8) % 12);
    else if (!cancelled && roll < 32) delay = 1 + ((r >>> 8) % 5);
    return { r, delay, cancelled, reason: cancelled || delay >= 6 ? D.delayReasons[(r >>> 12) % D.delayReasons.length] : '' };
  }
  function trackFor(line, dir, station) {
    const info = stationInfo(station);
    return line.cat === 's'
      ? 1 + ((hash(line.id + station) + dir) % 2)
      : 3 + (hash(`${line.id}:${dir}:${station}`) % Math.max(1, info.tracks - 2));
  }

  function departures(station, { mode = 'dep', limit = 10, cat = 'all' } = {}) {
    const now = berlinNow();
    const out = [];
    for (const line of D.lines) {
      if (cat !== 'all' && CAT_GROUP[line.cat] !== cat) continue;
      for (const dir of [0, 1]) {
        const stops = orient(line, dir);
        const idx = stops.findIndex((s) => s[0] === station);
        if (idx < 0) continue;
        if (mode === 'dep' && idx === stops.length - 1) continue;
        if (mode === 'arr' && idx === 0) continue;
        const base = lineOffset(line, dir) + stops[idx][1];
        for (let k = Math.ceil((now.abs - 20 - base) / line.every); ; k++) {
          const planned = base + k * line.every;
          if (planned > now.abs + 300) break;
          const run = `${line.id}:${dir}:${planned - stops[idx][1]}`;
          const ri = runInfo(run);
          const actual = planned + ri.delay;
          if (actual < now.abs || (ri.cancelled && planned < now.abs)) continue;
          const dest = mode === 'dep' ? stops[stops.length - 1][0] : stops[0][0];
          const via = mode === 'dep' ? stops.slice(idx + 1, -1).slice(0, 3).map((s) => s[0]) : stops.slice(1, idx).slice(-3).map((s) => s[0]);
          out.push({
            line, run, planned, actual, delay: ri.delay, cancelled: ri.cancelled, dest, via,
            track: trackFor(line, dir, station),
            mins: actual - now.abs,
            driver: DRIVERS[(ri.r >>> 4) % DRIVERS.length],
            reason: ri.reason,
          });
        }
      }
    }
    out.sort((a, b) => a.planned - b.planned || a.actual - b.actual);
    return out.slice(0, limit);
  }

  // ---------- Verbindungssuche (direkt oder mit einem Umstieg) ----------
  const PRODUCTS = [
    { id: 'fern', label: 'Fernverkehr', short: 'ICE/IC', hint: 'ICE, IC' },
    { id: 'regio', label: 'Regionalverkehr', short: 'RE/RB', hint: 'RE, RB' },
    { id: 's', label: 'S-Bahn', short: 'S-Bahn', hint: 'S' },
  ];
  const MIN_TRANSFER = 4;

  function legsBetween(from, to, t0, products, count) {
    const out = [];
    for (const line of D.lines) {
      if (!products.has(CAT_GROUP[line.cat])) continue;
      for (const dir of [0, 1]) {
        const stops = orient(line, dir);
        const i = stops.findIndex((s) => s[0] === from);
        if (i < 0) continue;
        const k = stops.findIndex((s) => s[0] === to);
        if (k <= i) continue;
        const base = lineOffset(line, dir) + stops[i][1];
        let n = Math.ceil((t0 - base) / line.every);
        for (let c = 0; c < count; c++, n++) {
          const start = base + n * line.every - stops[i][1];
          const run = `${line.id}:${dir}:${start}`;
          const ri = runInfo(run);
          const seq = stops.slice(i, k + 1).map(([name, t]) => ({ name, planned: start + t, actual: start + t + ri.delay, track: trackFor(line, dir, name) }));
          out.push({
            line, dir, run, seq, dest: stops[stops.length - 1][0],
            dep: seq[0].planned, arr: seq[seq.length - 1].planned,
            depAct: seq[0].actual, arrAct: seq[seq.length - 1].actual,
            delay: ri.delay, cancelled: ri.cancelled, reason: ri.reason,
            driver: DRIVERS[(ri.r >>> 4) % DRIVERS.length],
          });
        }
      }
    }
    return out;
  }

  function searchConnections(from, to, t0, opts) {
    if (!from || !to || from === to) return [];
    let found = legsBetween(from, to, t0, opts.products, 3).map((l) => [l]);
    if (!opts.directOnly) {
      const hubs = new Set();
      for (const line of D.lines) {
        if (!opts.products.has(CAT_GROUP[line.cat])) continue;
        for (const dir of [0, 1]) {
          const st = orient(line, dir);
          const i = st.findIndex((x) => x[0] === from);
          if (i >= 0) st.slice(i + 1).forEach((x) => { if (x[0] !== to) hubs.add(x[0]); });
        }
      }
      hubs.forEach((hub) => {
        legsBetween(from, hub, t0, opts.products, 2).forEach((l1) => {
          legsBetween(hub, to, l1.arr + MIN_TRANSFER, opts.products, 1).forEach((l2) => {
            if (l2.line.id !== l1.line.id) found.push([l1, l2]);
          });
        });
      });
    }
    if (opts.via) found = found.filter((legs) => legs.some((l) => l.seq.some((x) => x.name === opts.via)));
    const conns = found
      .map((legs, i) => {
        const a = legs[0], b = legs[legs.length - 1];
        return {
          id: `${a.run}>${b.run}`, legs, transfers: legs.length - 1,
          dep: a.dep, arr: b.arr, depAct: a.depAct, arrAct: b.arrAct,
          cancelled: legs.some((l) => l.cancelled),
          risky: legs.length > 1 && legs[1].depAct - legs[0].arrAct < 2,
        };
      })
      .filter((c) => c.dep >= t0 && c.arr - c.dep < 12 * 60);
    // Unsinnige Verbindungen entfernen: später los und trotzdem früher da = besser
    const best = conns.filter((c) => !conns.some((o) => o !== c && o.dep >= c.dep && o.arr <= c.arr
      && (o.dep > c.dep || o.arr < c.arr || o.transfers < c.transfers)));
    const seen = new Set();
    return best
      .sort((a, b) => a.dep - b.dep || a.transfers - b.transfers)
      .filter((c) => { const k = `${c.dep}|${c.arr}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 6);
  }

  function statusOf(d, mode) {
    if (d.cancelled) return { cls: 'bad', text: 'Fällt aus' };
    if (d.mins <= 0) return { cls: 'now', text: mode === 'dep' ? 'Fährt ab' : 'Fährt ein' };
    if (d.delay >= 6) return { cls: 'bad', text: `+${d.delay} Min.` };
    if (d.delay > 0) return { cls: 'warn', text: `+${d.delay} Min.` };
    return { cls: 'ok', text: d.mins < 60 ? `Pünktlich · in ${d.mins} Min.` : 'Pünktlich' };
  }

  function depRow(d, mode, prevRuns) {
    const st = statusOf(d, mode);
    const isNew = prevRuns && !prevRuns.has(d.run);
    const viaText = d.via.length ? `über ${d.via.join(' · ')}` : mode === 'dep' ? 'ohne Zwischenhalt' : 'direkt';
    return `<li class="dep${d.cancelled ? ' is-cancelled' : ''}${isNew ? ' is-new' : ''}" data-run="${esc(d.run)}">
      <div class="dep__time">${hhmm(d.planned)}${d.delay ? `<small class="${d.delay >= 6 ? '' : 'minor'}">${hhmm(d.actual)}</small>` : ''}</div>
      <div class="dep__train"><span class="line line--${d.line.cat}">${esc(d.line.name)}</span></div>
      <div class="dep__main"><span class="dep__dest">${mode === 'arr' ? 'von ' : ''}${esc(d.dest)}</span><span class="dep__via">${esc(viaText)}</span></div>
      <div class="dep__track"><span>Gleis</span><b>${d.track}</b></div>
      <div class="dep__meta">
        <span class="dep__status"><span class="status status--${st.cls}">${st.text}</span>${d.reason ? `<span class="dep__reason">${esc(d.reason)}</span>` : ''}</span>
        <span class="dep__driver">${avatar(d.driver)}<span>Tf: ${esc(d.driver)}</span></span>
      </div>
    </li>`;
  }

  function renderBoard(el, list, mode, key) {
    if (!el) return;
    // Neue Zeilen nur hervorheben, wenn dieselbe Tafel aktualisiert wird
    const prev = el.dataset.key === key ? new Set($$('[data-run]', el).map((li) => li.dataset.run)) : null;
    el.dataset.key = key;
    el.innerHTML = list.length
      ? list.map((d) => depRow(d, mode, prev && prev.size ? prev : null)).join('')
      : '<li class="board-empty">Keine Fahrten in den nächsten Stunden.</li>';
  }

  function renderHeroBoard() {
    const el = $('[data-board="hero"]');
    $('[data-hero-station]').textContent = state.homeStation;
    el.innerHTML = departures(state.homeStation, { limit: 5 }).map((d) => {
      const st = statusOf(d, 'dep');
      const small = d.cancelled ? '<small>fällt aus</small>' : d.delay ? `<small>+${d.delay}</small>` : '';
      return `<li>
        <span class="t">${hhmm(d.planned)}${small}</span>
        <span class="line line--${d.line.cat}">${esc(d.line.name)}</span>
        <span class="d"><b>${esc(d.dest)}</b><span>${esc(st.text)}</span></span>
        <span class="g">Gl.<b>${d.track}</b></span>
      </li>`;
    }).join('');
  }

  function renderHomeBoard() {
    const chips = $('[data-station-chips="home"]');
    chips.innerHTML = D.stations.map((s) => `<button class="chip" type="button" role="tab" aria-selected="${s.name === state.homeStation}" data-station="${esc(s.name)}">${esc(s.name.replace(' (Main)', ''))}</button>`).join('');
    renderBoard($('[data-board="home"]'), departures(state.homeStation, { limit: 4 }), 'dep', state.homeStation);
  }

  function renderFullBoard() {
    const info = stationInfo(state.station);
    $('[data-board-station]').textContent = state.station;
    $('[data-board-label]').textContent = state.mode === 'dep' ? 'Abfahrten ab' : 'Ankünfte in';
    $('[data-col-dest]').textContent = state.mode === 'dep' ? 'Nach' : 'Von';
    renderBoard($('[data-board="full"]'), departures(state.station, { mode: state.mode, cat: state.cat, limit: 14 }), state.mode, `${state.station}|${state.mode}|${state.cat}`);

    $('[data-station-name]').textContent = info.name;
    $('[data-station-region]').textContent = info.region;
    $('[data-station-tracks]').textContent = info.tracks;
    $('[data-station-tph]').textContent = departures(state.station, { limit: 200 }).filter((d) => d.mins <= 60).length;
    $('[data-station-players]').textContent = 4 + (hash(info.name + Math.floor(Date.now() / 60000)) % 30);
    const img = $('[data-station-img]');
    const src = `assets/img/${info.img}`;
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
  }

  function setStation(name) {
    state.station = name;
    history.replaceState(null, '', `#/abfahrten?station=${encodeURIComponent(name)}`);
    renderFullBoard();
  }

  function renderNotices() {
    const icons = { warn: 'fi-rr-triangle-warning', info: 'fi-rr-info', ok: 'fi-rr-check' };
    $('[data-notices]').innerHTML = D.notices.map((n) => `<li>
      <span class="n-ic n-ic--${n.level}">${icon(icons[n.level])}</span>
      <div><b>${esc(n.title)}</b><span>${esc(n.text)}</span></div>
    </li>`).join('');
  }

  // ---------- Kennzahlen ----------
  function series(seed, n, trend = 0.02) {
    const out = [];
    let v = 50;
    for (let i = 0; i < n; i++) { v += (((hash(seed + i) % 100) / 100) - 0.45) * 8 + trend * 10; out.push(v); }
    return out;
  }
  function sparkline(values) {
    const w = 64, h = 26, min = Math.min(...values), max = Math.max(...values);
    const x = (i) => (i / (values.length - 1)) * w;
    const y = (v) => h - 3 - ((v - min) / (max - min || 1)) * (h - 6);
    const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    const last = values.length - 1;
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}"/><circle cx="${x(last).toFixed(1)}" cy="${y(values[last]).toFixed(1)}" r="4"/></svg>`;
  }
  function kpi({ label, value, delta, up = true, good = true, ic, seed }) {
    const cls = up === good ? 'delta--up' : 'delta--down';
    return `<div class="kpi">
      <span class="kpi__label"><span class="kpi__icon">${icon(ic)}</span>${label}</span>
      <span class="kpi__value">${value}</span>
      <span class="kpi__foot"><span class="delta ${cls}">${up ? '▲' : '▼'} ${delta}</span>${sparkline(series(seed, 12, up ? 0.04 : -0.04))}</span>
    </div>`;
  }
  function renderHomeKpis() {
    const s = D.stats;
    $('[data-kpis="home"]').innerHTML = [
      kpi({ label: 'Spieler online', value: `<span data-bind="online">${fmt(state.online)}</span>`, delta: '12 % <small>vs. gestern</small>', ic: 'fi-rr-users-alt', seed: 'on' }),
      kpi({ label: 'Aktive Server', value: fmt(s.servers), delta: '3 <small>seit 1 Std.</small>', ic: 'fi-rr-database', seed: 'sv' }),
      kpi({ label: 'Züge unterwegs', value: fmt(s.trains), delta: '8 % <small>vs. gestern</small>', ic: 'fi-rr-train-side', seed: 'tr' }),
      kpi({ label: 'Pünktlichkeit', value: `${nf1.format(s.punctuality)} %`, delta: '0,6 Pkt. <small>vs. gestern</small>', up: false, ic: 'fi-rr-clock-three', seed: 'pu' }),
    ].join('');
  }
  function renderStatsKpis() {
    const s = D.stats;
    $('[data-kpis="stats"]').innerHTML = [
      kpi({ label: 'Besuche gesamt', value: compact(s.visits), delta: '3,8 %', ic: 'fi-rr-gamepad', seed: 'vi' }),
      kpi({ label: 'Favoriten', value: compact(s.favorites), delta: '1,2 %', ic: 'fi-rr-star', seed: 'fa' }),
      kpi({ label: 'Gruppenmitglieder', value: compact(s.groupMembers), delta: '640', ic: 'fi-rr-users-alt', seed: 'gr' }),
      kpi({ label: 'Discord', value: compact(s.discordMembers), delta: '2,1 %', ic: 'fi-brands-discord', seed: 'dc' }),
      kpi({ label: 'Gefahrene km', value: compact(s.km), delta: '4,4 %', ic: 'fi-rr-route', seed: 'km' }),
      kpi({ label: 'Fahrten heute', value: fmt(s.tripsToday), delta: '6 %', ic: 'fi-rr-train-side', seed: 'ft' }),
    ].join('');
  }

  // ---------- Diagramme ----------
  const HOURLY = [820, 610, 430, 310, 240, 220, 260, 330, 410, 480, 560, 640, 720, 800, 880, 980, 1100, 1220, 1350, 1460, 1520, 1430, 1250, 1030];
  function chartData(range) {
    const now = berlinNow();
    if (range === '24') {
      return Array.from({ length: 24 }, (_, i) => {
        const h = (now.h - 23 + i + 24) % 24;
        const v = i === 23 ? state.online : Math.round(HOURLY[h] * (0.92 + (hash('h' + h) % 16) / 100));
        return { label: `${pad(h)}:00`, tick: h % 3 === 0 ? `${pad(h)}` : '', value: v, tip: `${pad(h)}:00 Uhr` };
      });
    }
    const n = range === '7' ? 7 : 30;
    return Array.from({ length: n }, (_, i) => {
      const day = now.day - (n - 1) + i;
      const dt = dateOf(day);
      const wd = dt.getUTCDay();
      const weekend = wd === 0 || wd === 6 || wd === 5;
      const v = Math.round(1250 + i * (n === 30 ? 9 : 25) + (weekend ? 260 : 0) + (hash('d' + day) % 140));
      const label = `${pad(dt.getUTCDate())}.${pad(dt.getUTCMonth() + 1)}.`;
      return {
        label, value: v,
        tick: n === 7 ? WEEKDAYS[wd].slice(0, 2) : i % 5 === 4 || i === 0 ? label : '',
        tip: `${WEEKDAYS[wd]}, ${label} · Tageshöchstwert`,
      };
    });
  }
  function niceMax(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
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
      ${ticks.map((t) => `<line class="gridline" x1="${m.l}" x2="${W - m.r}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/><text x="${m.l - 10}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end">${compact(t)}</text>`).join('')}
      ${data.map((d, i) => (d.tick ? `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${d.tick}</text>` : '')).join('')}
      <path class="viz-area" d="${area}"/>
      <path class="viz-line" d="${line}"/>
      <circle class="viz-dot" cx="${x(data.length - 1).toFixed(1)}" cy="${y(last.value).toFixed(1)}" r="5"/>
      <text class="end-label" x="${(x(data.length - 1) + 10).toFixed(1)}" y="${(y(last.value) + 4).toFixed(1)}">${fmt(last.value)}</text>
      <line class="crosshair" data-cross x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/>
      <circle class="viz-dot" data-hover-dot r="5" cx="0" cy="0" visibility="hidden"/>
      <rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}"/>
    </svg>
    <table class="sr-only"><caption>Spieler online</caption><tbody>${data.map((d) => `<tr><th>${d.label}</th><td>${fmt(d.value)}</td></tr>`).join('')}</tbody></table>`;
    const svg = $('svg', el), cross = $('[data-cross]', el), dot = $('[data-hover-dot]', el), hit = $('.hit', el);
    const move = (e) => {
      const r = svg.getBoundingClientRect();
      const px = e.clientX - r.left;
      const i = Math.max(0, Math.min(data.length - 1, Math.round(((px - m.l) / iw) * (data.length - 1))));
      const cx = x(i), cy = y(data[i].value);
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.setAttribute('visibility', 'visible');
      showTip(`<b>${fmt(data[i].value)} Spieler</b><span>${esc(data[i].tip)}</span>`, r.left + cx, r.top + cy);
    };
    const leave = () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); hideTip(); };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', leave);
    $('[data-chart-sub]').textContent = state.range === '24' ? 'Letzte 24 Stunden, stündlich' : `Letzte ${state.range} Tage, Tageshöchstwert`;
  }

  function renderBars() {
    const max = Math.max(...D.trainShare.map((d) => d.value));
    $('[data-hbars]').innerHTML = D.trainShare.map((d) => `<div class="hbar" data-tip="<b>${d.value} %</b><span>${esc(d.label)}</span>">
      <span class="hbar__label">${esc(d.label)}</span>
      <span class="hbar__track"><span class="hbar__fill" style="width:${(d.value / max) * 86}%"></span><span class="hbar__value">${d.value} %</span></span>
    </div>`).join('');

    $('[data-meters]').innerHTML = D.punctualityByNet.map((d) => {
      const s = d.value >= 93 ? ['ok', 'Gut', 'fi-rr-check'] : d.value >= 88 ? ['warn', 'Angespannt', 'fi-rr-triangle-warning'] : ['bad', 'Kritisch', 'fi-rr-triangle-warning'];
      return `<li>
        <span class="m-label">${esc(d.label)}</span>
        <span class="m-value"><span class="state state--${s[0]}">${icon(s[2])}${s[1]}</span>${nf1.format(d.value)} %</span>
        <span class="bar bar--${s[0]}"><span style="width:${d.value}%"></span></span>
      </li>`;
    }).join('');

    const top = Math.max(...D.topRoutes.map((d) => d.value));
    $('[data-top-routes]').innerHTML = D.topRoutes.map((d, i) => `<li>
      <span class="rank-num">${i + 1}</span>
      <span class="r-main"><span class="line line--${d.cat}">${esc(d.line)}</span><span>${esc(d.label)}</span></span>
      <span class="r-val">${fmt(d.value)} <small>Fahrten</small></span>
      <span class="r-bar"><span style="width:${(d.value / top) * 100}%"></span></span>
    </li>`).join('');
  }

  // ---------- Strecken & News ----------
  function renderRoutes() {
    $('[data-routes]').innerHTML = D.routes.map((r) => {
      const fav = state.favs.has(r.title);
      return `<article class="scard">
        <div class="scard__media">
          <img src="assets/img/${r.img}" alt="Illustration der Strecke ${esc(r.title)}" loading="lazy">
          <button class="glass-btn" type="button" aria-pressed="${fav}" aria-label="${esc(r.title)} merken" data-fav="${esc(r.title)}">${icon('fi-rr-heart', 'fav-off')}${icon('fi-sr-heart', 'fav-on')}</button>
          <span class="line line--${r.cat}">${esc(r.line)}</span>
        </div>
        <div class="scard__body">
          <h3>${esc(r.title)}</h3>
          <p>${esc(r.from)} → ${esc(r.to)}</p>
          <small>${fmt(r.km)} km · ${esc(r.dur)} · ${r.stops} Halte</small>
        </div>
      </article>`;
    }).join('');
  }

  function renderNews() {
    $('[data-news]').innerHTML = D.news.slice(0, 3).map(newsCard).join('');
  }

  // ---------- Server ----------
  function serverRoles(s) {
    const roles = [
      ['Driver', 'Lokführer', Math.round(s.players * 0.32)],
      ['Conductor', 'Zugbegleiter', Math.round(s.players * 0.2)],
      ['Signaller', 'Fahrdienstleiter', Math.max(1, Math.round(s.players * 0.08))],
    ];
    roles.push(['Passenger', 'Fahrgäste', Math.max(0, s.players - roles.reduce((sum, r) => sum + r[2], 0))]);
    return roles;
  }
  function renderServers() {
    const free = D.servers.reduce((sum, x) => sum + Math.max(0, x.max - x.players), 0);
    const ping = Math.round(D.servers.reduce((sum, x) => sum + x.ping, 0) / D.servers.length);
    $('[data-server-stats]').innerHTML = `
      <div class="stat"><span>Spieler online</span><b data-bind="online">${fmt(state.online)}</b></div>
      <div class="stat"><span>Freie Plätze</span><b>${fmt(free)}</b></div>
      <div class="stat"><span>Ø Ping</span><b>${ping} ms</b></div>`;

    const q = norm(state.serverQuery.trim());
    const list = D.servers.filter((s) => {
      if (state.serverType === 'free' && s.players >= s.max * 0.8) return false;
      if (!['all', 'free'].includes(state.serverType) && s.type !== state.serverType) return false;
      return !q || norm(`${s.name} ${s.network} ${s.region}`).includes(q);
    });
    const typeTag = { public: ['', 'Öffentlich'], event: ['tag--red', 'Event'], training: ['tag--info', 'Training'], vip: ['tag--warn', 'VIP'] };
    $('[data-servers]').innerHTML = list.length ? list.map((s) => {
      const ratio = s.players / s.max;
      const full = s.players >= s.max;
      const level = full ? 'bad' : ratio >= 0.85 ? 'warn' : 'ok';
      const label = full ? 'Voll' : ratio >= 0.85 ? 'Fast voll' : `${s.max - s.players} frei`;
      const [tagCls, tagText] = typeTag[s.type];
      const names = DRIVERS.filter((_, i) => (hash(s.name) + i) % 5 === 0).slice(0, 3);
      return `<article class="server">
        <div class="server__head">
          <div class="server__name">
            <span class="server__ic">${icon(s.type === 'training' ? 'fi-rr-calendar' : s.type === 'event' ? 'fi-rr-bolt' : 'fi-rr-database')}</span>
            <div><h3>${esc(s.name)}</h3><small><span class="live-dot live-dot--sm"></span>${esc(s.region)} · v${esc(s.version)}</small></div>
          </div>
          <span class="tag ${tagCls}">${tagText}</span>
        </div>
        <p class="server__net">${icon('fi-rr-route')}${esc(s.network)}</p>
        <div class="occ">
          <div class="occ__row"><span class="status status--${level}">${label}</span><b>${s.players}/${s.max}</b></div>
          <div class="bar bar--${level}"><span style="width:${Math.min(100, ratio * 100)}%"></span></div>
        </div>
        <div class="server__roles"><span class="server__roles-title">Rollen</span>${serverRoles(s).map(([r, label, n]) => `<span class="role-count" style="--rc:${rankOf(r).color}"><i></i><span>${label}</span><b>${n}</b></span>`).join('')}</div>
        <dl class="server__meta">
          <div><dt>${icon('fi-rr-signal-alt-2')}Ping</dt><dd>${s.ping} ms</dd></div>
          <div><dt>${icon('fi-rr-train-side')}Züge</dt><dd>${s.trains}</dd></div>
          <div><dt>${icon('fi-rr-clock-three')}Laufzeit</dt><dd>${esc(s.uptime)}</dd></div>
        </dl>
        <div class="server__foot">
          <span class="avatars">${names.map((n) => avatar(n)).join('')}<small>+${Math.max(0, s.players - names.length)}</small></span>
          ${full
            ? '<button class="btn btn--soft btn--sm" type="button" disabled>Voll</button>'
            : `<a class="btn btn--primary btn--sm" href="${esc(D.links.play)}" target="_blank" rel="noopener">${icon('fi-sr-play')}Beitreten</a>`}
        </div>
      </article>`;
    }).join('') : '<p class="empty">Kein Server gefunden. Versuch einen anderen Filter.</p>';
  }

  // ---------- Spieler ----------
  function renderPlayers() {
    const byKm = D.players.slice().sort((a, b) => b.km - a.km);
    const podium = [byKm[1], byKm[0], byKm[2]];
    $('[data-podium]').innerHTML = podium.map((p) => {
      const place = byKm.indexOf(p) + 1;
      return `<div class="podium__item podium__item--${place}">
        <span class="podium__place">${place}</span>
        ${place === 1 ? `<span class="podium__crown">${icon('fi-sr-crown')}</span>` : ''}
        ${avatar(p.name)}
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.role)}</p>
        <strong>${fmt(p.km)} km</strong>
      </div>`;
    }).join('');

    const key = state.playerSort;
    const sorted = D.players.slice().sort((a, b) => b[key] - a[key]);
    const q = norm(state.playerQuery.trim());
    const rows = sorted.map((p, i) => ({ p, rank: i + 1 })).filter(({ p }) => !q || norm(p.name).includes(q));
    const cell = (k, value, unit) => `<span class="lb-stat${k === key ? ' is-primary' : ''}">${value}<small>${unit}</small></span>`;
    $('[data-leaderboard]').innerHTML =
      `<li class="lb-head" aria-hidden="true"><span>#</span><span></span><span>Spieler</span><span class="lb-stat">Level</span><span class="lb-stat">Kilometer</span><span class="lb-stat">Fahrten</span><span class="lb-stat">Pünktlich</span></li>` +
      (rows.length ? rows.map(({ p, rank }) => `<li${q ? ' class="is-match"' : ''}>
        <span class="lb-rank">${rank}</span>
        ${avatar(p.name)}
        <span class="lb-name"><b>${esc(p.name)}</b><small>${roleBadge(p.role)}${esc(p.region)}</small></span>
        <span class="lb-stat">${p.level}</span>
        ${cell('km', fmt(p.km), 'Kilometer')}
        ${cell('trips', fmt(p.trips), 'Fahrten')}
        ${cell('punct', nf1.format(p.punct) + ' %', 'pünktlich')}
      </li>`).join('') : '<li class="board-empty">Kein Spieler mit diesem Namen gefunden.</li>');
  }

  function renderProfile() {
    const p = D.players.find((x) => x.name === 'Nordlicht_Mia') || D.players[0];
    $('[data-profile]').innerHTML = `
      <div class="profile-card__cover"><span>${icon('fi-sr-star')}Spieler der Woche</span></div>
      <div class="profile-card__body">
        ${avatar(p.name, 'avatar--xl')}
        <h3>${esc(p.name)}</h3>
        <p class="handle">@${esc(p.name.toLowerCase())} ${roleBadge(p.role)}</p>
        <p class="bio">Stellwerk Hamburg Hbf. Hält den S-Bahn-Takt auf Kurs und fährt nachts gern ICE.</p>
        <div class="profile-stats">
          <div><b>${p.level}</b><span>Level</span></div>
          <div><b>${compact(p.km)}</b><span>Kilometer</span></div>
          <div><b>${nf1.format(p.punct)} %</b><span>Pünktlich</span></div>
        </div>
      </div>`;
  }

  // ---------- Trainings ----------
  // Der Wochenplan aus data.js wird für zwei Wochen ausgerollt.
  function trainingsList({ all = false } = {}) {
    const now = berlinNow();
    const out = [];
    for (let week = 0; week < 2; week++) {
      D.trainings.forEach((t, i) => {
        const [hh, mm] = t.time.split(':').map(Number);
        const day = now.day + t.day + week * 7;
        const start = day * 1440 + hh * 60 + mm;
        const id = `${i}-${day}`;
        const signed = state.signups.has(id);
        const taken = week === 0 ? t.taken : Math.max(0, t.taken - 3 - (i % 3));
        out.push(Object.assign({}, t, {
          id, day, start, end: start + t.dur, signed,
          taken: Math.min(t.slots, taken + (signed ? 1 : 0)),
          req: reqFor(t.type),
          img: (typeOf(t.type) || {}).img || 'training.svg',
          color: rankOf(t.type).color,
        }));
      });
    }
    return out
      .filter((t) => t.end > now.abs && (all || !state.typeFilter.size || state.typeFilter.has(t.type)))
      .sort((a, b) => a.start - b.start);
  }
  const findTraining = (id) => trainingsList({ all: true }).find((t) => t.id === id);
  const isLocked = (t) => rankIdx(state.rank) < rankIdx(t.req);
  function trainingState(t) {
    const free = t.slots - t.taken;
    if (t.signed) return { cls: 'mine', text: 'Angemeldet', level: 'ok' };
    if (isLocked(t)) return { cls: 'lock', text: `ab ${t.req}`, level: 'warn' };
    if (free <= 0) return { cls: 'bad', text: 'Voll', level: 'bad' };
    if (free <= 2) return { cls: 'warn', text: `${free} frei`, level: 'warn' };
    return { cls: 'ok', text: `${free} frei`, level: 'ok' };
  }

  function nextStepHTML(heading) {
    const next = nextRank(state.rank);
    if (!next) {
      return `<article class="promo-card">
        <img class="promo-card__img" src="assets/img/group.svg" alt="" loading="lazy">
        <div class="promo-card__body">
          <${heading}>Alle Ausbildungen geschafft</${heading}>
          <p>Du hast den höchsten Rang erreicht. Hilf jetzt neuen Spielern als Ausbilder.</p>
        </div>
      </article>`;
    }
    const type = typeOf(next.name);
    const t = trainingsList({ all: true }).find((x) => x.type === next.name);
    let when = `Noch kein ${next.name}-Training geplant.`;
    if (t) {
      const d = dayName(t.day);
      when = `${next.name}-Training ${d === 'Heute' || d === 'Morgen' ? d.toLowerCase() : `am ${d}`} um ${t.time} Uhr.`;
    }
    return `<article class="promo-card">
      <img class="promo-card__img" src="assets/img/${type.img}" alt="" loading="lazy">
      <div class="promo-card__body">
        <${heading}>Dein nächster Schritt: ${esc(next.name)}</${heading}>
        <p>${esc(when)} ${t ? 'Sichere dir jetzt deinen Platz.' : 'Aktiviere die Glocke, dann sagen wir Bescheid.'}</p>
      </div>
      ${t
        ? `<button class="btn btn--primary promo-card__btn" type="button" data-detail="${t.id}">Details</button>`
        : '<button class="btn btn--primary promo-card__btn" type="button" data-bell>Erinnern</button>'}
    </article>`;
  }
  function renderNextSteps() {
    const home = $('[data-next-step="home"]');
    const full = $('[data-next-step="full"]');
    if (state.page === 'home') home.innerHTML = nextStepHTML('h3');
    if (state.page === 'trainings') full.innerHTML = nextStepHTML('h2');
  }

  function tcard(t) {
    const st = trainingState(t);
    const badge = t.signed ? 'fi-rr-check' : isLocked(t) ? 'fi-rr-lock' : 'fi-rr-bell';
    return `<button class="tcard" type="button" data-detail="${t.id}">
      <div class="tcard__media">
        <img src="assets/img/${t.img}" alt="" loading="lazy">
        <span class="tcard__fav">${icon(badge)}</span>
        <span class="tcard__role" style="--rc:${t.color}"><i></i>${esc(t.type)}</span>
      </div>
      <div class="tcard__body">
        <h3>${esc(t.title)}</h3>
        <div class="tcard__row"><span>${t.time} Uhr</span><span class="tcard__slots${st.cls === 'bad' ? ' is-full' : st.cls === 'mine' ? ' is-mine' : ''}">${icon('fi-sr-user')}${t.taken}/${t.slots}</span></div>
      </div>
    </button>`;
  }

  function renderTrainings() {
    const now = berlinNow();
    const list = trainingsList();
    const me = rankOf(state.rank);

    $('[data-rank-name]').textContent = me.name;
    $('[data-bell]').setAttribute('aria-pressed', String(state.bell));
    $('[data-filter-badge]').hidden = !state.typeFilter.size;

    // Tagesleiste: 14 Tage, roter Punkt = an diesem Tag gibt es Trainings
    const days = Array.from({ length: 14 }, (_, i) => now.day + i);
    if (state.trainingDay === null || !days.includes(state.trainingDay)) state.trainingDay = list.length ? list[0].day : now.day;
    const tabs = $('[data-day-tabs]');
    tabs.innerHTML = days.map((d) => {
      const has = list.some((t) => t.day === d);
      const dt = dateOf(d);
      const label = d === now.day ? 'Heute' : d === now.day + 1 ? 'Morgen' : `${wdShort(d)} ${dt.getUTCDate()}.`;
      return `<button class="day-tab${has ? ' has-trainings' : ''}" type="button" role="tab" aria-selected="${d === state.trainingDay}" data-day="${d}" aria-label="${dayName(d, { long: true })}${has ? ', Trainings geplant' : ''}">${label}<i></i></button>`;
    }).join('');
    const sel = $('[aria-selected="true"]', tabs);
    if (sel) tabs.scrollTo({ left: sel.offsetLeft - tabs.clientWidth / 2 + sel.clientWidth / 2, behavior: 'instant' });

    const field = $('[data-date-field]');
    field.textContent = dayName(state.trainingDay, { long: true });
    field.parentElement.classList.add('is-set');

    // Trainings am gewählten Tag
    const ofDay = list.filter((t) => t.day === state.trainingDay);
    const nextDay = list.find((t) => t.day > state.trainingDay);
    $('[data-day-trainings]').innerHTML = ofDay.length
      ? ofDay.map(tcard).join('')
      : `<div class="rail-empty">${icon('fi-rr-calendar')}<span>Am ${dayName(state.trainingDay, { long: true }).replace(/^(Heute|Morgen), /, '')} ist kein Training geplant.${nextDay ? ` Nächstes: <button class="link-more" type="button" data-day="${nextDay.day}">${dayName(nextDay.day)}</button>` : ''}</span></div>`;

    // Alle kommenden Trainings (klein)
    const shown = state.showAll ? list : list.slice(0, 6);
    $('[data-all-trainings]').innerHTML = shown.length ? shown.map((t) => {
      const st = trainingState(t);
      return `<li><button type="button" data-detail="${t.id}">
        <div class="tdate${t.day === now.day ? ' is-today' : ''}"><span>${wdShort(t.day)}</span><b>${dateOf(t.day).getUTCDate()}</b></div>
        <div><h3>${esc(t.title)}</h3><p><i style="--rc:${t.color}"></i>${esc(t.type)} · ${t.time} Uhr · ${esc(t.host)}</p></div>
        <span class="pill-state pill-state--${st.cls}">${st.text}</span>
      </button></li>`;
    }).join('') : '<li class="board-empty">Keine Trainings für diesen Filter.</li>';
    const toggle = $('[data-all-toggle]');
    toggle.hidden = list.length <= 6;
    toggle.textContent = state.showAll ? 'Weniger anzeigen' : 'Alle anzeigen';

    // Ränge in der Seitenleiste
    const cur = rankIdx(state.rank);
    $('[data-rank-ladder]').innerHTML = RANKS.map((r, i) => `<li class="${i === cur ? 'is-current' : i < cur ? 'is-done' : ''}" style="--rc:${r.color}"><i></i><b>${esc(r.name)}</b><span>${esc(r.label)}</span></li>`).join('');

    renderNextSteps();
  }

  // ---------- Reiseauskunft ----------
  const fmtDur = (min) => `${Math.floor(min / 60)}:${pad(min % 60)}`;
  const PICKER_TITLES = { from: 'Von', to: 'Nach', via: 'Zwischenhalt', board: 'Bahnhof', quick: 'Bahnhof hinzufügen' };

  function tripStart() {
    const now = berlinNow();
    if (state.trip.time === null) return now.abs;
    const [hh, mm] = state.trip.time.split(':').map(Number);
    return (now.day + state.trip.dayOffset) * 1440 + hh * 60 + mm;
  }
  function whenLabel() {
    const day = berlinNow().day + state.trip.dayOffset;
    return `${dayName(day)}, ${state.trip.time === null ? 'jetzt' : state.trip.time}`;
  }
  function optsLabel() {
    const t = state.trip;
    const parts = [];
    if (t.products.size < PRODUCTS.length) parts.push(PRODUCTS.filter((p) => t.products.has(p.id)).map((p) => p.short).join(', '));
    if (t.directOnly) parts.push('nur direkt');
    if (t.via) parts.push(`über ${t.via}`);
    return parts.length ? parts.join(' · ') : 'Alle Züge';
  }
  function addHistory(name) {
    state.history = [name].concat(state.history.filter((x) => x !== name)).slice(0, 8);
    store.set('tsg-history', state.history);
  }
  const lineBadge = (line) => `<span class="line line--${line.cat}">${esc(line.name)}</span>`;
  function rtTime(planned, actual, cancelled, tag = 'span') {
    if (cancelled) return `<${tag} class="rt rt--late">fällt aus</${tag}>`;
    return `<${tag} class="rt ${actual - planned >= 6 ? 'rt--late' : 'rt--ok'}">${hhmm(actual)}</${tag}>`;
  }

  function renderTrip() {
    const t = state.trip;
    const setField = (sel, val, ph) => {
      const el = $(sel);
      el.textContent = val || ph;
      el.classList.toggle('is-empty', !val);
    };
    setField('[data-trip-from]', t.from, 'Von');
    setField('[data-trip-to]', t.to, 'Nach');
    $('[data-trip-when]').textContent = whenLabel();
    $('[data-trip-opts]').textContent = optsLabel();
    $('[data-trip-search]').disabled = !(t.from && t.to && t.from !== t.to);
    renderQuick();
    renderTripResults();
  }

  function renderQuick() {
    const tiles = [{ name: D.me.position, label: 'Aktuelle Position', pos: true }].concat(state.quick.map((n) => ({ name: n, label: n })));
    $('[data-quick]').innerHTML = tiles.map((q) => {
      const sel = state.quickSel === q.name;
      return `<button class="quick-tile${sel ? ' is-from' : ''}" type="button" data-quick-tile="${esc(q.name)}" draggable="false" aria-pressed="${sel}">
        ${q.pos ? icon('fi-rr-location-crosshairs') : ''}<span>${esc(q.label)}</span>
        ${sel ? '<span class="quick-tile__tag">Start</span>' : ''}
        ${state.quickEdit && !q.pos ? `<span class="quick-tile__del" data-quick-del="${esc(q.name)}" role="button" aria-label="${esc(q.name)} entfernen">${icon('fi-rr-cross-small')}</span>` : ''}
      </button>`;
    }).join('') + (state.quick.length < 7 ? `<button class="quick-tile quick-tile--add" type="button" data-quick-add aria-label="Bahnhof hinzufügen">${icon('fi-rr-plus')}</button>` : '');
    $('[data-quick-edit]').innerHTML = `${icon(state.quickEdit ? 'fi-rr-check' : 'fi-rr-settings')}${state.quickEdit ? 'Fertig' : 'Bearbeiten'}`;
  }

  function connCard(c, i) {
    const first = c.legs[0], last = c.legs[c.legs.length - 1];
    let state_ = first.delay ? `<span class="conn__warn">+${first.delay} Min.</span>` : '<span class="rt--ok">pünktlich</span>';
    if (c.risky) state_ = '<span class="conn__warn">Anschluss gefährdet</span>';
    if (c.cancelled) state_ = '<span class="conn__warn">Fahrt fällt aus</span>';
    return `<button class="conn" type="button" data-conn="${i}">
      <div class="conn__top">
        <div class="conn__times">
          <b>${hhmm(c.dep)}</b><i>–</i><b>${hhmm(c.arr)}</b>
          ${rtTime(c.dep, c.depAct, first.cancelled)}<span></span>${rtTime(c.arr, c.arrAct, last.cancelled)}
        </div>
        <div class="conn__dur"><b>${fmtDur(c.arr - c.dep)}</b>${c.transfers ? '1 Umstieg' : 'Direkt'}</div>
      </div>
      <div class="conn__legs">${c.legs.map((l) => lineBadge(l.line)).join(icon('fi-rr-angle-small-right'))}</div>
      <div class="conn__meta"><span>ab Gl. ${first.seq[0].track} · nach ${esc(first.dest)}</span>${state_}</div>
    </button>`;
  }

  function renderTripResults() {
    const el = $('[data-trip-results]');
    const t = state.trip;
    if (!state.tripResults) {
      el.innerHTML = (state.pinned ? `<div class="results-head"><h2>Angeheftet</h2></div>${pinnedHTML()}` : '')
        + `<div class="empty-state empty-state--desk">${icon('fi-rr-route')}<b>Wohin möchtest du fahren?</b><span>Wähle Start und Ziel oder nutze die schnelle Suche.</span></div>`;
      return;
    }
    const list = state.tripResults;
    el.innerHTML = `<div class="results-head"><h2>${esc(t.from)} → ${esc(t.to)}</h2><span>${whenLabel()}</span></div>`
      + (list.length
        ? `<div class="conn-list">${list.map(connCard).join('')}</div>`
        : `<div class="empty-state">${icon('fi-rr-train-side')}<b>Keine Verbindung gefunden</b><span>Probier andere Optionen oder eine spätere Uhrzeit.</span></div>`);
  }

  function runSearch({ scroll = true } = {}) {
    const t = state.trip;
    if (!t.from || !t.to || t.from === t.to) return;
    state.tripResults = searchConnections(t.from, t.to, tripStart(), t);
    renderTripResults();
    if (scroll && window.innerWidth < 1080) $('[data-trip-results]').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function quickTap(name) {
    if (state.quickEdit) return;
    if (!state.quickSel) {
      state.quickSel = name;
      renderQuick();
      toast(`Start: ${name} – jetzt das Ziel antippen`);
    } else if (state.quickSel === name) {
      state.quickSel = null;
      renderQuick();
    } else {
      quickSearch(state.quickSel, name);
    }
  }
  function quickSearch(from, to) {
    state.quickSel = null;
    state.trip.from = from;
    state.trip.to = to;
    addHistory(from);
    addHistory(to);
    renderTrip();
    runSearch();
  }

  // Angeheftete Verbindung
  const isPinned = (c) => !!(state.pinned && c && state.pinned.id === c.id);
  function pinnedHTML() {
    const p = state.pinned;
    if (!p) return '';
    const over = p.arr < berlinNow().abs;
    return `<div class="pinned">
      <span class="pinned__ic">${icon('fi-sr-bookmark')}</span>
      <button class="pinned__body" type="button" data-pinned-open><b>${esc(p.from)} → ${esc(p.to)}</b><small>${over ? 'Fahrt vorbei · ' : ''}${dayName(Math.floor(p.dep / 1440))} ${hhmm(p.dep)} – ${hhmm(p.arr)} · ${esc(p.lines.join(' › '))}</small></button>
      <button class="round-btn" type="button" data-unpin aria-label="Anheften lösen">${icon('fi-rr-cross-small')}</button>
    </div>`;
  }
  function renderPinned() {
    $('[data-pinned="home"]').innerHTML = pinnedHTML();
    $('[data-pinned-sec]').hidden = !state.pinned;
  }
  function togglePin() {
    const c = state.planConn;
    if (!c) return;
    if (isPinned(c)) {
      state.pinned = null;
      toast('Anheften gelöst');
    } else {
      state.pinned = {
        id: c.id, from: c.legs[0].seq[0].name, to: c.legs[c.legs.length - 1].seq.slice(-1)[0].name,
        dep: c.dep, arr: c.arr, lines: c.legs.map((l) => l.line.name),
      };
      toast('Gemerkt – du findest die Fahrt auf der Startseite');
    }
    store.set('tsg-pinned', state.pinned);
    renderPlan();
  }
  function openPinned() {
    const p = state.pinned;
    if (!p) return;
    const now = berlinNow();
    state.trip.from = p.from;
    state.trip.to = p.to;
    if (p.dep >= now.abs) {
      state.trip.dayOffset = Math.floor(p.dep / 1440) - now.day;
      state.trip.time = hhmm(p.dep);
    } else {
      state.trip.dayOffset = 0;
      state.trip.time = null;
    }
    state.tripResults = searchConnections(p.from, p.to, tripStart(), state.trip);
    const match = state.tripResults.find((c) => c.id === p.id);
    if (match) {
      state.planConn = match;
      state.planOpen = {};
      location.hash = '#/reiseplan';
    } else if (state.page === 'reise') {
      renderTrip();
    } else {
      location.hash = '#/reise';
    }
  }

  // Reiseplan
  function stopRow(st, o = {}) {
    const rail = o.mark === 'start' ? icon('fi-rr-dot-circle', 'plan__start')
      : o.mark === 'pin' ? icon('fi-sr-marker', 'plan__pin') : '<i class="plan__dot"></i>';
    return `<li class="plan__stop${o.main ? ' plan__stop--main' : ''}${o.first ? ' plan__stop--first' : ''}${o.last ? ' plan__stop--last' : ''}">
      <div class="plan__time">${hhmm(st.planned)}${rtTime(st.planned, st.actual, false, 'small')}</div>
      <span class="plan__rail">${rail}</span>
      <div class="plan__name">${esc(st.name)}</div>
      <span class="gl${o.main ? ' gl--strong' : ''}">Gl. ${st.track}</span>
    </li>`;
  }
  function renderPlan() {
    const c = state.planConn;
    if (!c) { location.replace('#/reise'); return; }
    const day = Math.floor(c.dep / 1440);
    $('[data-plan-summary]').textContent = `${dayName(day)} • Dauer: ${fmtDur(c.arr - c.dep)} • ${c.transfers} ${c.transfers === 1 ? 'Umstieg' : 'Umstiege'}`;
    $('[data-plan-route]').textContent = `${c.legs[0].seq[0].name} → ${c.legs[c.legs.length - 1].seq.slice(-1)[0].name}`;
    let html = '';
    c.legs.forEach((l, li) => {
      const open = state.planOpen[li] !== false;
      const first = l.seq[0], last = l.seq[l.seq.length - 1];
      const mid = l.seq.slice(1, -1);
      const isStart = li === 0, isEnd = li === c.legs.length - 1;
      html += stopRow(first, { main: true, first: isStart, mark: isStart ? 'start' : '' });
      html += `<li class="plan__leg"><span></span><span class="plan__rail"></span><div class="plan__info">
        <span class="plan__badge line--${l.line.cat}">${icon('fi-rr-train-side')}<i class="sep"></i>${esc(l.line.name)}</span>
        <p class="plan__dir">nach ${esc(l.dest)}</p>
        <p class="plan__extra">Lokführer: ${esc(l.driver)}${l.cancelled ? ' · Fahrt fällt aus' : l.reason ? ` · ${esc(l.reason)}` : ''}</p>
        ${mid.length ? `<button class="plan__toggle" type="button" data-plan-toggle="${li}" aria-expanded="${open}">${icon(open ? 'fi-rr-angle-small-up' : 'fi-rr-angle-small-down')}${open ? 'Zwischenhaltestellen ausblenden' : `${mid.length} Zwischenhaltestellen einblenden`}</button>` : ''}
      </div></li>`;
      if (open) mid.forEach((st) => { html += stopRow(st); });
      html += stopRow(last, { main: true, last: isEnd, mark: isEnd ? 'pin' : '' });
      if (!isEnd) {
        const next = c.legs[li + 1];
        html += `<li class="plan__transfer${c.risky ? ' is-risky' : ''}"><span></span><span class="plan__rail"></span><div class="plan__info">${icon(c.risky ? 'fi-rr-triangle-warning' : 'fi-rr-clock-three')}<span>Umstieg in ${esc(last.name)} · ${next.dep - l.arr} Min. · Gl. ${last.track} → Gl. ${next.seq[0].track}${c.risky ? ' · Anschluss gefährdet' : ''}</span></div></li>`;
      }
    });
    $('[data-plan]').innerHTML = html;
    const pinned = isPinned(c);
    $('[data-pin-trip]').innerHTML = `${icon(pinned ? 'fi-sr-bookmark' : 'fi-rr-bookmark')}<span>${pinned ? 'Angeheftet – lösen' : 'merken &amp; anheften'}</span>`;
  }

  // Haltestellen-Auswahl
  function pkRow(name) {
    const fav = state.favStations.has(name);
    return `<div class="pk-row"><button class="pk-item" type="button" data-pk="${esc(name)}">${icon('fi-rr-circle-h')}<span>${esc(name)}</span></button><button class="pk-star" type="button" data-pk-star="${esc(name)}" aria-pressed="${fav}" aria-label="${esc(name)} ${fav ? 'aus den Favoriten entfernen' : 'als Favorit speichern'}">${icon(fav ? 'fi-sr-star' : 'fi-rr-star')}</button></div>`;
  }
  function pickerList(q) {
    const nq = norm(q.trim());
    if (nq) {
      const hits = ALL_STOPS.map((n) => ({ n, p: norm(n).indexOf(nq) })).filter((x) => x.p >= 0)
        .sort((a, b) => a.p - b.p || a.n.length - b.n.length).slice(0, 30);
      return hits.length ? hits.map((x) => pkRow(x.n)).join('') : '<p class="pk-empty">Keine Haltestelle gefunden.</p>';
    }
    const favs = Array.from(state.favStations);
    const hist = state.history.filter((n) => !state.favStations.has(n));
    return `<div class="pk-row"><button class="pk-item pk-item--pos" type="button" data-pk="${esc(D.me.position)}">${icon('fi-rr-location-crosshairs')}<span>Aktuelle Position</span><small>${esc(D.me.position)}</small></button></div>
      <div class="pk-head">Favoriten</div>${favs.length ? favs.map(pkRow).join('') : '<p class="pk-empty">Tippe auf den Stern, um Bahnhöfe zu speichern.</p>'}
      ${hist.length ? `<div class="pk-head">Verlauf<button type="button" data-pk-clear aria-label="Verlauf löschen">${icon('fi-rr-trash')}</button></div>${hist.map(pkRow).join('')}` : ''}
      <div class="pk-head">Beliebte Bahnhöfe</div>${D.stations.filter((x) => !state.favStations.has(x.name) && !hist.includes(x.name)).map((x) => pkRow(x.name)).join('')}`;
  }
  function pickStation(name) {
    const target = state.pickerTarget;
    addHistory(name);
    if (target === 'from' || target === 'to') {
      state.trip[target] = name;
      state.tripResults = null;
      closeModal();
      renderTrip();
    } else if (target === 'via') {
      state.optDraft.via = name;
      openModal('options', 'keep');
    } else if (target === 'board') {
      closeModal();
      setStation(name);
    } else if (target === 'quick') {
      if (name !== D.me.position && !state.quick.includes(name)) {
        state.quick.push(name);
        store.set('tsg-quick', state.quick);
      }
      closeModal();
      renderQuick();
    }
  }

  // ---------- Neuigkeiten ----------
  function newsCard(n, i) {
    return `<button class="ncard" type="button" data-news-open="${i}">
      <div class="ncard__img"><img src="assets/img/${n.img}" alt="" loading="lazy"></div>
      <div class="ncard__body">
        <h3>${esc(n.title)}</h3>
        <div class="ncard__foot"><span class="cat-tag cat-tag--${n.cat}">${esc(n.tag)}</span><span>${esc(n.date)}</span></div>
      </div>
    </button>`;
  }
  function renderNewsPage() {
    $$('[data-news-cat]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.newsCat === state.newsCat)));
    $('[data-news-feed]').innerHTML = D.news.map((n, i) => ({ n, i }))
      .filter(({ n }) => state.newsCat === 'all' || n.cat === state.newsCat)
      .map(({ n, i }) => newsCard(n, i)).join('');
  }

  // ---------- Karriere ----------
  const jobStatus = (job) => (job.open
    ? `<span class="pill pill--ok">${icon('fi-rr-check')}Offen</span>`
    : '<span class="pill pill--bad">Geschlossen</span>');
  const SINCE = ['Weniger als 1 Monat', '1–3 Monate', '3–6 Monate', '6–12 Monate', 'Mehr als 1 Jahr'];
  const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const SECTORS = [
    { title: 'Über dich', text: 'Damit wir dich im Spiel und auf Discord finden.' },
    { title: 'Grundwissen', text: 'Ein paar Fragen zu deinem Bereich. Du musst nicht alles wissen.' },
    { title: 'Erfahrung & Zeit', text: 'Erzähl uns, was du mitbringst und wann du Zeit hast.' },
  ];
  // Instructor: gemeinsame Fragen + gewählter Bereich + alle Bereiche darunter
  function quizGroups(job, area) {
    if (!job.areas) return [{ key: 'job', title: 'Fragen zur Stelle', items: job.quiz || [] }];
    const groups = [{ key: 'common', title: 'Für alle Instructor', items: job.quiz || [] }];
    job.areas.slice(0, job.areas.indexOf(area) + 1).forEach((a) => {
      groups.push({ key: a, title: `${a} · ${rankOf(a).label}`, color: rankOf(a).color, items: D.knowledge[a] || [] });
    });
    return groups;
  }
  // Die erste Antwort ist richtig; angezeigt wird eine feste, gemischte Reihenfolge
  const optionOrder = (q) => q.options.map((_, i) => i).sort((a, b) => hash(q.q + a) - hash(q.q + b));
  const dataField = (name) => `data-field="${name}"`;

  function jobCard(job) {
    return `<a class="job" href="#/karriere/${job.id}">
      <div class="job__top"><h3>${esc(job.title)}</h3>${jobStatus(job)}</div>
      <span class="job__team">${icon('fi-rr-users-alt')}Team ${esc(job.team)}</span>
      <p>${esc(job.text)}</p>
      <span class="job__more">Details ${icon('fi-rr-arrow-small-right')}</span>
    </a>`;
  }
  function renderCrumbs(job) {
    const sep = icon('fi-rr-angle-small-right');
    let html = `<a href="#/">Start</a>${sep}`;
    if (!job) html += '<span aria-current="page">Karriere</span>';
    else if (!state.jobApply) html += `<a href="#/karriere">Karriere</a>${sep}<span aria-current="page">${esc(job.title)}</span>`;
    else html += `<a href="#/karriere">Karriere</a>${sep}<a href="#/karriere/${job.id}">${esc(job.title)}</a>${sep}<span aria-current="page">Bewerbung</span>`;
    $('[data-crumbs]').innerHTML = html;
  }
  function careerList() {
    const open = D.jobs.filter((x) => x.open).length;
    return `<div class="cbox">
        <h2>Werde Teil <em>unseres Teams</em></h2>
        <p class="lead">Die <strong>Train Sim Germany</strong> Community sucht motivierte Mitglieder, die unser virtuelles Bahnnetz erweitern und verbessern. Entdecke die offenen Stellen und finde die Rolle, die zu dir passt.</p>
      </div>
      <div class="career-list-head"><h2>Offene Stellen</h2><span>${open} von ${D.jobs.length} offen</span></div>
      <div class="job-list">${D.jobs.map(jobCard).join('')}</div>`;
  }
  function careerDetail(job) {
    const app = state.applications[job.id];
    let action;
    if (app) {
      action = `<div class="note note--ok">${icon('fi-rr-check-circle')}<span>Du hast dich am ${new Date(app.at).toLocaleDateString('de-DE')} beworben${app.area ? ` (${esc(app.area)} Instructor)` : ''}. Wir melden uns über Discord bei <b>${esc(app.discord)}</b>.</span></div>
        <button class="btn-text" type="button" data-apply-reset="${job.id}">Bewerbung zurückziehen</button>`;
    } else if (!job.open) {
      action = `<div class="note note--bad">${icon('fi-rr-info')}<span>Diese Stelle ist gerade geschlossen. Schau bald wieder vorbei oder frag auf unserem Discord nach.</span></div>
        <a class="btn-line btn-line--outline" href="${esc(D.links.discord)}" target="_blank" rel="noopener">${icon('fi-brands-discord')}Zum Discord</a>`;
    } else {
      action = `<a class="btn-line" href="#/karriere/${job.id}/bewerben">${icon('fi-rr-briefcase')}Jetzt bewerben</a>`;
    }
    const list = (items) => `<ul>${items.map((x) => `<li>${icon('fi-rr-check-circle')}<span>${esc(x)}</span></li>`).join('')}</ul>`;
    const areas = job.areas
      ? `<section class="checks"><h3>${icon('fi-sr-check')}Bereiche</h3><div class="area-tags">${job.areas.map((a) => `<span style="--rc:${rankOf(a).color}"><i></i>${esc(a)} Instructor</span>`).join('')}</div></section>`
      : '';
    return `<article class="cbox">
      <div class="cbox__meta">${jobStatus(job)}<span class="job__team">${icon('fi-rr-users-alt')}Team ${esc(job.team)}</span></div>
      <h2>Werde Teil des Teams als <em>${esc(job.title)}</em></h2>
      <p class="lead">${esc(job.text)}</p>
      <hr>
      <section class="checks"><h3>${icon('fi-sr-check')}Verantwortlichkeiten</h3>${list(job.tasks)}</section>
      <section class="checks"><h3>${icon('fi-sr-check')}Anforderungen</h3>${list(job.needs)}</section>
      ${areas}
      <hr>
      <div class="cbox__action">${action}</div>
    </article>`;
  }
  function quizHtml(job, area, answers = {}) {
    if (job.areas && !area) {
      return `<div class="quiz-empty">${icon('fi-rr-arrow-small-up')}<span>Wähle zuerst deinen Bereich. Danach erscheinen die passenden Fragen.</span></div>`;
    }
    let n = 0;
    return quizGroups(job, area).map((g) => `<div class="quiz-group">
        <h4 class="quiz-group__title"${g.color ? ` style="--rc:${g.color}"` : ''}>${g.color ? '<i></i>' : ''}${esc(g.title)}</h4>
        ${g.items.map((q, i) => {
          const key = `${g.key}-${i}`;
          n += 1;
          return `<fieldset class="q f" ${dataField(`q:${key}`)}>
            <legend><span class="q__no">${n}</span>${esc(q.q)}</legend>
            <div class="q__opts">${optionOrder(q).map((o) => `<label class="choice"><input type="radio" name="q:${key}" value="${o}"${answers[key] === String(o) ? ' checked' : ''}><span>${esc(q.options[o])}</span></label>`).join('')}</div>
          </fieldset>`;
        }).join('')}
      </div>`).join('');
  }
  function sectorHead(i) {
    const s = SECTORS[i];
    return `<header class="sector__head"><span class="sector__no">${i + 1}</span><div><small>Sektor ${i + 1}</small><h3>${s.title}</h3></div></header>
      <p class="sector__text">${s.text}</p>`;
  }
  function careerApply(job) {
    const rankOpts = RANKS.filter((r) => r.name !== 'Management')
      .map((r) => `<option value="${esc(r.name)}"${r.name === state.rank ? ' selected' : ''}>${esc(r.name)} · ${esc(r.label)}</option>`).join('');
    const areaPicker = job.areas ? `<fieldset class="f" ${dataField('area')}>
        <legend class="f__label">In welchem Bereich möchtest du ausbilden?</legend>
        <div class="areas">${job.areas.map((a, i) => {
          const covered = job.areas.slice(0, i + 1);
          return `<label class="area" style="--rc:${rankOf(a).color}"><input type="radio" name="area" value="${esc(a)}">
            <span class="area__body"><b>${esc(a)} Instructor</b><small>Wissen: ${covered.length === job.areas.length ? 'alle vier Bereiche' : esc(covered.join(', '))}</small></span></label>`;
        }).join('')}</div>
        <span class="f__hint">Jeder Bereich baut auf den vorherigen auf: Signaller Instructor prüft auch Conductor, Platform Staff und Driver.</span>
      </fieldset>` : '';
    return `<div class="cbox">
        <h2>Bewerbung als <em>${esc(job.title)}</em></h2>
        <p class="lead">Fülle die drei Sektoren aus. Das dauert etwa 5 Minuten.</p>
        <ol class="sector-steps">${SECTORS.map((s, i) => `<li><button type="button" data-sector-jump="${i + 1}"><span class="sector-steps__no">${i + 1}</span><span class="sector-steps__label">${s.title}</span></button></li>`).join('')}</ol>
      </div>
      <form class="apply" data-apply="${job.id}" novalidate>
        <section class="cbox sector" data-sector="1" aria-labelledby="sector-1">
          ${sectorHead(0).replace('<h3>', '<h3 id="sector-1">')}
          <div class="f" ${dataField('roblox')}><label class="f__label" for="ap-roblox">Roblox-Benutzername</label><input id="ap-roblox" name="roblox" autocomplete="username" value="${esc(D.me.username)}" placeholder="Dein Roblox-Benutzername"></div>
          <div class="f" ${dataField('discord')}><label class="f__label" for="ap-discord">Discord-Benutzername</label><input id="ap-discord" name="discord" autocomplete="off" placeholder="z. B. lokfuehrer_max"></div>
          <div class="f-row">
            <div class="f" ${dataField('age')}><label class="f__label" for="ap-age">Alter</label><input id="ap-age" name="age" type="number" inputmode="numeric" min="10" max="99" placeholder="z. B. 16"></div>
            <div class="f" ${dataField('since')}><label class="f__label" for="ap-since">Du spielst seit</label><div class="select"><select id="ap-since" name="since"><option value="">Bitte wählen</option>${SINCE.map((x) => `<option>${x}</option>`).join('')}</select>${icon('fi-rr-angle-small-down')}</div></div>
          </div>
          <div class="f" ${dataField('rank')}><label class="f__label" for="ap-rank">Dein aktueller Rang</label><div class="select"><select id="ap-rank" name="rank">${rankOpts}</select>${icon('fi-rr-angle-small-down')}</div></div>
        </section>

        <section class="cbox sector" data-sector="2" aria-labelledby="sector-2">
          ${sectorHead(1).replace('<h3>', '<h3 id="sector-2">')}
          ${areaPicker}
          <div class="quiz" data-quiz>${quizHtml(job, null)}</div>
        </section>

        <section class="cbox sector" data-sector="3" aria-labelledby="sector-3">
          ${sectorHead(2).replace('<h3>', '<h3 id="sector-3">')}
          <div class="f" ${dataField('experience')}><label class="f__label" for="ap-exp">Welche Erfahrung hast du in dieser Rolle?</label><textarea id="ap-exp" name="experience" placeholder="Beschreibe kurz deine Erfahrung"></textarea><span class="f__hint">Mindestens 30 Zeichen</span></div>
          <fieldset class="f" ${dataField('activity')}>
            <legend class="f__label">Wie aktiv wärst du, wenn du angenommen wirst?</legend>
            <div class="scale">${Array.from({ length: 10 }, (_, i) => `<label><input type="radio" name="activity" value="${i + 1}"><span>${i + 1}</span></label>`).join('')}</div>
            <div class="scale__legend"><span>1 = selten</span><span>10 = sehr aktiv</span></div>
          </fieldset>
          <fieldset class="f" ${dataField('days')}>
            <legend class="f__label">An welchen Tagen hast du meistens Zeit?</legend>
            <div class="scale scale--days">${DAYS.map((d) => `<label><input type="checkbox" name="days" value="${d}"><span>${d}</span></label>`).join('')}</div>
          </fieldset>
          <div class="f" ${dataField('confirm')}><label class="confirm"><input type="checkbox" name="confirm"><span>Ich habe alle Angaben ehrlich gemacht und kenne die Regeln von Train Sim Germany.</span></label></div>
          <button class="btn-line" type="submit">Bewerbung senden ${icon('fi-rr-paper-plane')}</button>
          <p class="f__note">Demo: Die Bewerbung wird noch nicht verschickt, sondern nur auf diesem Gerät gespeichert.</p>
        </section>
      </form>`;
  }
  function careerDone(job, app) {
    const rows = [['Stelle', job.title], ...(app.area ? [['Bereich', `${app.area} Instructor`]] : []), ['Rang', app.rank], ['Discord', app.discord], ['Gesendet', new Date(app.at).toLocaleDateString('de-DE')]];
    return `<div class="cbox done">
      <span class="done__ic">${icon('fi-rr-check')}</span>
      <h2>Bewerbung <em>gesendet</em></h2>
      <p class="lead">Danke, ${esc(app.roblox)}! Wir schauen uns deine Bewerbung an und melden uns innerhalb von 7 Tagen über Discord.</p>
      <dl class="done__list">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <a class="btn-line btn-line--outline" href="#/karriere">${icon('fi-rr-arrow-left')}Zurück zu den Jobs</a>
      <button class="btn-text" type="button" data-apply-reset="${job.id}">Bewerbung zurückziehen</button>
    </div>`;
  }
  function renderCareer() {
    const job = D.jobs.find((x) => x.id === state.jobId);
    if (job && state.jobApply && !job.open && !state.applications[job.id]) state.jobApply = false;
    renderCrumbs(job);
    const el = $('[data-career]');
    if (!job) el.innerHTML = careerList();
    else if (!state.jobApply) el.innerHTML = careerDetail(job);
    else if (state.applications[job.id]) el.innerHTML = careerDone(job, state.applications[job.id]);
    else {
      state.quizAnswers = {};
      el.innerHTML = careerApply(job);
    }
  }

  // Prüft alle Felder; liefert { feld: Meldung }
  function applyErrors(form) {
    const job = D.jobs.find((x) => x.id === form.dataset.apply);
    const f = form.elements;
    const val = (name) => (f[name] ? f[name].value.trim() : '');
    const errors = {};
    if (!/^[A-Za-z0-9_]{3,20}$/.test(val('roblox'))) errors.roblox = 'Bitte gib einen gültigen Roblox-Namen ein (3–20 Zeichen: Buchstaben, Zahlen, _).';
    if (!/^([a-z0-9_.]{2,32}|.{2,32}#\d{4})$/i.test(val('discord'))) errors.discord = 'Bitte gib deinen Discord-Namen ein, z. B. lokfuehrer_max.';
    const age = Number(val('age'));
    if (!Number.isInteger(age) || age < 10 || age > 99) errors.age = 'Bitte gib dein Alter an.';
    if (!val('since')) errors.since = 'Bitte wähle aus, seit wann du spielst.';
    const area = form.querySelector('input[name="area"]:checked');
    if (job.areas) {
      if (!area) errors.area = 'Bitte wähle einen Bereich.';
      else if (rankIdx(val('rank')) < rankIdx(area.value)) errors.area = `Für ${area.value} Instructor brauchst du mindestens den Rang ${area.value}.`;
    }
    $$('fieldset.q', form).forEach((q) => {
      if (!$('input:checked', q)) errors[q.dataset.field] = 'Bitte beantworte diese Frage.';
    });
    if (val('experience').length < 30) errors.experience = 'Erzähl uns etwas mehr, mindestens 30 Zeichen.';
    if (!form.querySelector('input[name="activity"]:checked')) errors.activity = 'Bitte wähle einen Wert von 1 bis 10.';
    if (!form.querySelector('input[name="days"]:checked')) errors.days = 'Bitte wähle mindestens einen Tag.';
    if (!f.confirm.checked) errors.confirm = 'Bitte bestätige deine Angaben.';
    return errors;
  }
  // Fortschritt der drei Sektoren (ohne Fehlermeldungen anzuzeigen)
  function updateSectors(form) {
    const errors = applyErrors(form);
    [1, 2, 3].forEach((n) => {
      const sec = $(`[data-sector="${n}"]`, form);
      const done = !Object.keys(errors).some((k) => $(`[data-field="${CSS.escape(k)}"]`, sec));
      const step = $(`[data-sector-jump="${n}"]`);
      if (step) step.classList.toggle('is-done', done);
    });
  }
  function clearFieldError(field) {
    field.classList.remove('has-error');
    const er = $('.f__error', field);
    if (er) er.remove();
    $$('[aria-invalid]', field).forEach((x) => { x.removeAttribute('aria-invalid'); x.removeAttribute('aria-describedby'); });
  }
  function submitApplication(form) {
    const id = form.dataset.apply;
    const errors = applyErrors(form);
    $$('.f.has-error', form).forEach(clearFieldError);
    Object.entries(errors).forEach(([name, msg], i) => {
      const field = $(`[data-field="${CSS.escape(name)}"]`, form);
      const errId = `err-${i}`;
      field.classList.add('has-error');
      field.insertAdjacentHTML('beforeend', `<span class="f__error" id="${errId}">${icon('fi-rr-info')}${esc(msg)}</span>`);
      const input = $('input, select, textarea', field);
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', errId);
    });
    const first = Object.keys(errors)[0];
    if (first) {
      const field = $(`[data-field="${CSS.escape(first)}"]`, form);
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('input, select, textarea', field).focus({ preventScroll: true });
      return;
    }
    const data = new FormData(form);
    const answers = {};
    for (const [k, v] of data) if (k.startsWith('q:')) answers[k.slice(2)] = +v;
    const values = Object.values(answers);
    state.applications[id] = {
      roblox: data.get('roblox').trim(), discord: data.get('discord').trim(), age: +data.get('age'),
      since: data.get('since'), rank: data.get('rank'), area: data.get('area') || null,
      answers, score: values.filter((v) => v === 0).length, total: values.length,
      experience: data.get('experience').trim(), activity: +data.get('activity'), days: data.getAll('days'),
      at: Date.now(),
    };
    store.set('tsg-applications', state.applications);
    toast('Bewerbung gesendet');
    renderCareer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Auswahl-Sheets ----------
  const modal = $('[data-modal]');
  let modalView = null;
  const VIEWS = {
    rank: {
      title: 'Dein Rang',
      render: () => `<div class="opt-list" role="radiogroup" aria-label="Rang wählen">${RANKS.filter((r) => r.name !== 'Management').map((r) => `
        <button class="opt" type="button" role="radio" aria-checked="${r.name === state.rank}" data-rank="${r.name}">
          <i class="dot" style="--rc:${r.color}"></i><span><b>${esc(r.name)}</b><small>${esc(r.label)} · ${esc(r.desc)}</small></span>
          ${r.name === state.rank ? icon('fi-rr-check') : ''}
        </button>`).join('')}</div>
        <p class="sheet-note">Demo: Später wird dein Rang automatisch aus der Roblox-Gruppe übernommen.</p>`,
    },
    date: {
      title: 'Trainingsdatum wählen',
      render: () => {
        const now = berlinNow();
        const list = trainingsList();
        const days = Array.from({ length: 14 }, (_, i) => now.day + i);
        return `<div class="date-grid">
          ${days.slice(0, 7).map((d) => `<span class="date-grid__wd">${wdShort(d)}</span>`).join('')}
          ${days.map((d) => `<button class="date-cell${list.some((t) => t.day === d) ? ' has-trainings' : ''}" type="button" aria-pressed="${d === state.trainingDay}" data-pick-day="${d}" aria-label="${dayName(d, { long: true })}">${dateOf(d).getUTCDate()}<i></i></button>`).join('')}
        </div>
        <p class="sheet-note">Rote Punkte zeigen Tage mit Trainings.</p>`;
      },
    },
    filter: {
      title: 'Trainings filtern',
      render: () => `<div class="opt-list">${D.trainingTypes.map((t) => {
        const r = rankOf(t.name);
        const on = state.typeFilter.has(t.name);
        return `<button class="opt" type="button" role="checkbox" aria-checked="${on}" data-ttoggle="${t.name}">
          <i class="dot" style="--rc:${r.color}"></i><span><b>${esc(t.name)}</b><small>${esc(r.label)} · ${esc(r.desc)}</small></span>
          <span class="opt__check">${on ? icon('fi-rr-check') : ''}</span>
        </button>`;
      }).join('')}</div>
      <div class="btn-stack"><button class="btn btn--soft btn--block" type="button" data-treset>Alle Trainings anzeigen</button></div>`,
    },
    picker: {
      title: (target) => PICKER_TITLES[target] || 'Haltestelle',
      render: () => `<label class="picker__search">${icon('fi-rr-search')}<span class="sr-only">Haltestelle eingeben</span><input type="search" placeholder="Haltestelle eingeben" autocomplete="off" data-picker-input></label>
        <div class="pk-list" data-pk-list>${pickerList('')}</div>`,
    },
    when: {
      title: 'Datum & Uhrzeit',
      render: () => {
        const d = state.whenDraft;
        const now = berlinNow();
        const time = d.time || `${pad(now.h)}:${pad(now.m)}`;
        return `<div class="when-days" role="radiogroup" aria-label="Tag">${Array.from({ length: 7 }, (_, i) => `<button class="chip${d.dayOffset === i ? ' is-active' : ''}" type="button" role="radio" aria-checked="${d.dayOffset === i}" data-when-day="${i}">${dayName(now.day + i)}</button>`).join('')}</div>
          <label class="time-field">${icon('fi-rr-clock-three')}<span class="sr-only">Uhrzeit</span><input type="time" value="${time}" data-when-time></label>
          <div class="sheet-actions">
            <button class="btn btn--outline btn--lg btn--block" type="button" data-when-now>Jetzt</button>
            <button class="btn btn--primary btn--lg btn--block" type="button" data-when-apply>Übernehmen</button>
          </div>`;
      },
    },
    options: {
      title: 'Routeneinstellungen',
      render: () => {
        const d = state.optDraft;
        return `<section class="opt-section"><h3>Verkehrsmittel</h3><div class="opt-list">${PRODUCTS.map((p) => {
          const on = d.products.has(p.id);
          return `<button class="opt" type="button" role="checkbox" aria-checked="${on}" data-opt-product="${p.id}"><span><b>${p.label}</b><small>${p.hint}</small></span><span class="opt__check">${on ? icon('fi-rr-check') : ''}</span></button>`;
        }).join('')}</div></section>
          <section class="opt-section"><h3>Verbindungstyp</h3><div class="switch-row"><span id="lbl-direct">Nur Direktverbindungen</span><button class="switch" type="button" role="switch" aria-checked="${d.directOnly}" aria-labelledby="lbl-direct" data-opt-direct></button></div></section>
          <section class="opt-section"><h3>Zwischenhalt</h3><div class="via-btn"><button type="button" data-picker="via">${icon('fi-rr-circle-h')}<span class="${d.via ? '' : 'is-empty'}">${d.via ? esc(d.via) : 'Zwischenhalt wählen'}</span></button>${d.via ? `<button class="round-btn round-btn--soft" type="button" data-opt-via-clear aria-label="Zwischenhalt entfernen">${icon('fi-rr-cross-small')}</button>` : ''}</div></section>
          <div class="sheet-actions">
            <button class="btn btn--outline btn--lg btn--block" type="button" data-opt-reset>Zurücksetzen</button>
            <button class="btn btn--primary btn--lg btn--block" type="button" data-opt-apply>Übernehmen</button>
          </div>`;
      },
    },
    news: {
      title: 'Neuigkeit',
      render: (i) => {
        const n = D.news[+i];
        return `<div class="detail">
          <img class="detail__img" src="assets/img/${n.img}" alt="">
          <div class="detail__top"><span class="cat-tag cat-tag--${n.cat}">${esc(n.tag)}</span><span class="tag">${esc(n.date)}</span></div>
          <h3>${esc(n.title)}</h3>
          <p>${esc(n.text)}</p>
          <div class="btn-stack"><a class="btn btn--discord btn--block btn--lg" href="${esc(D.links.discord)}" target="_blank" rel="noopener">${icon('fi-brands-discord')}Auf Discord diskutieren</a></div>
        </div>`;
      },
    },
    training: {
      title: 'Training',
      render: (id) => {
        const t = findTraining(id);
        if (!t) return '<p class="muted">Dieses Training ist bereits vorbei.</p>';
        const st = trainingState(t);
        const type = typeOf(t.type);
        const running = t.start <= berlinNow().abs;
        const full = t.taken >= t.slots && !t.signed;
        let action;
        if (t.signed) action = `<button class="btn btn--ok btn--block" type="button" data-signup="${t.id}">${icon('fi-rr-check')}Angemeldet – abmelden</button>`;
        else if (isLocked(t)) action = `<button class="btn btn--soft btn--block" type="button" disabled>${icon('fi-rr-lock')}Ab Rang ${esc(t.req)}</button>`;
        else if (full) action = `<button class="btn btn--soft btn--block" type="button" data-waitlist="${t.id}">${icon('fi-rr-bell')}Auf die Warteliste</button>`;
        else action = `<button class="btn btn--primary btn--block" type="button" data-signup="${t.id}">Jetzt anmelden</button>`;
        return `<div class="detail">
          <img class="detail__img" src="assets/img/${t.img}" alt="">
          <div class="detail__top">${roleBadge(t.type)}${running ? '<span class="tag tag--red"><span class="live-dot live-dot--sm"></span>Läuft gerade</span>' : `<span class="tag">${relTime(t.start)}</span>`}</div>
          <h3>${esc(t.title)}</h3>
          <p>${esc(type ? type.text : '')}</p>
          <dl>
            <div><dt>${icon('fi-rr-calendar')}Datum</dt><dd>${dayName(t.day, { long: true })}</dd></div>
            <div><dt>${icon('fi-rr-clock-three')}Uhrzeit</dt><dd>${t.time} – ${hhmm(t.end)} Uhr</dd></div>
            <div><dt>${icon('fi-rr-database')}Server</dt><dd>${esc(t.server)}</dd></div>
            <div><dt>${icon('fi-rr-users-alt')}Leitung</dt><dd>${esc(t.host)}</dd></div>
          </dl>
          <div class="occ">
            <div class="occ__row"><span class="status status--${st.level}">${st.text}</span><b>${t.taken}/${t.slots} Plätze</b></div>
            <div class="bar bar--${st.level}"><span style="width:${(t.taken / t.slots) * 100}%"></span></div>
          </div>
          ${isLocked(t) && !t.signed ? `<div class="lock">${icon('fi-rr-lock')}<span>Für dieses Training brauchst du mindestens den Rang ${esc(t.req)}. Dein Rang: ${esc(state.rank)}.</span></div>` : ''}
          ${action}
        </div>`;
      },
    },
  };
  function openModal(name, arg) {
    const t = state.trip;
    if (name === 'options' && arg !== 'keep') state.optDraft = { products: new Set(t.products), directOnly: t.directOnly, via: t.via };
    if (name === 'when') state.whenDraft = { dayOffset: t.dayOffset, time: t.time };
    if (name === 'picker') state.pickerTarget = arg;
    modalView = { name, arg };
    const title = VIEWS[name].title;
    $('[data-modal-title]').textContent = typeof title === 'function' ? title(arg) : title;
    $('[data-modal-body]').innerHTML = VIEWS[name].render(arg);
    modal.hidden = false;
    document.body.classList.add('menu-open');
    const focusable = $('[data-modal-body] input[type="search"]', modal) || $('[data-modal-body] button:not([disabled])', modal) || $('[data-modal-close]', modal);
    focusable.focus({ preventScroll: true });
  }
  function refreshModal() {
    if (!modal.hidden && modalView) $('[data-modal-body]').innerHTML = VIEWS[modalView.name].render(modalView.arg);
  }
  function closeModal() {
    if (modal.hidden) return;
    modal.hidden = true;
    modalView = null;
    document.body.classList.remove('menu-open');
  }

  function toggleSignup(id) {
    const t = findTraining(id);
    if (!t) return;
    if (state.signups.has(id)) { state.signups.delete(id); toast('Anmeldung zurückgezogen'); }
    else { state.signups.add(id); toast(`Angemeldet: ${t.title}, ${dayName(t.day)} ${t.time} Uhr`); }
    store.set('tsg-signups', Array.from(state.signups));
    if (state.page === 'trainings') renderTrainings(); else renderNextSteps();
    refreshModal();
  }
  function toggleBell() {
    state.bell = !state.bell;
    store.set('tsg-bell', state.bell);
    $$('[data-bell]').forEach((b) => b.setAttribute('aria-pressed', String(state.bell)));
    const next = nextRank(state.rank);
    toast(state.bell ? `Erinnerungen an${next ? ` – wir melden uns vor ${next.name}-Trainings` : ''}` : 'Erinnerungen aus');
  }

  // ---------- Suche ----------
  function searchIndex() {
    const items = [];
    ALL_STOPS.forEach((s) => items.push({ type: 'Bahnhof', label: s, sub: stationInfo(s).region, ic: 'fi-rr-marker', go: () => goStation(s) }));
    const seenLines = new Set();
    D.lines.forEach((l) => {
      const key = `${l.name} ${l.stops[0][0]}`;
      if (seenLines.has(key)) return;
      seenLines.add(key);
      const hub = l.stops.find((s) => D.stations.some((st) => st.name === s[0])) || l.stops[0];
      items.push({ type: 'Linie', label: l.name, sub: `${l.stops[0][0]} – ${l.stops[l.stops.length - 1][0]}`, ic: 'fi-rr-train-side', go: () => goStation(hub[0]) });
    });
    D.players.forEach((p) => items.push({ type: 'Spieler', label: p.name, sub: p.role, ic: 'fi-rr-users-alt', go: () => { state.playerQuery = p.name; location.hash = '#/spieler'; } }));
    D.servers.forEach((s) => items.push({ type: 'Server', label: s.name, sub: s.network, ic: 'fi-rr-database', go: () => { state.serverQuery = s.name; location.hash = '#/server'; } }));
    return items;
  }
  function goStation(name) {
    state.station = name;
    location.hash = `#/abfahrten?station=${encodeURIComponent(name)}`;
  }

  function attachSearch(form, input, results, getItems) {
    let matches = [];
    let active = -1;
    const close = () => { results.hidden = true; active = -1; input.setAttribute('aria-expanded', 'false'); };
    const paint = () => {
      results.innerHTML = matches.length
        ? matches.map((m, i) => `<li role="option" aria-selected="${i === active}"><button type="button" data-i="${i}"><span class="res-ic">${icon(m.ic)}</span><span><strong>${esc(m.label)}</strong><small>${esc(m.type)} · ${esc(m.sub)}</small></span></button></li>`).join('')
        : '<li class="res-empty">Nichts gefunden – probier z. B. „Köln“, „ICE 28“ oder einen Spielernamen.</li>';
    };
    const update = () => {
      const q = norm(input.value.trim());
      if (!q) { close(); return; }
      matches = getItems()
        .map((it) => ({ it, pos: norm(it.label).indexOf(q) }))
        .filter((x) => x.pos >= 0)
        .sort((a, b) => a.pos - b.pos || a.it.label.length - b.it.label.length)
        .slice(0, 7)
        .map((x) => x.it);
      active = matches.length ? 0 : -1;
      paint();
      results.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    };
    const pick = (m) => { if (!m) return; input.value = ''; close(); input.blur(); m.go(); };
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.addEventListener('input', update);
    input.addEventListener('focus', () => { if (input.value.trim()) update(); });
    input.addEventListener('keydown', (e) => {
      if (results.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(matches.length - 1, active + 1); paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paint(); }
      else if (e.key === 'Escape') { close(); }
    });
    results.addEventListener('mousedown', (e) => e.preventDefault());
    results.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (b) pick(matches[+b.dataset.i]);
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!input.value.trim()) { input.focus(); return; }
      update();
      pick(matches[Math.max(0, active)]);
    });
    document.addEventListener('click', (e) => { if (!form.contains(e.target)) close(); });
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
    const t = e.target.closest('[data-tip]');
    if (!t) return;
    const r = t.getBoundingClientRect();
    const fill = $('.hbar__fill', t);
    const fr = fill ? fill.getBoundingClientRect() : r;
    showTip(t.dataset.tip, fr.right - Math.min(24, fr.width / 2), r.top + 4);
  });
  document.addEventListener('pointerout', (e) => {
    const t = e.target.closest('[data-tip]');
    if (t && !t.contains(e.relatedTarget)) hideTip();
  });

  let toastTimer;
  function toast(msg) {
    const el = $('[data-toast]');
    el.innerHTML = `${icon('fi-rr-check')}<span>${esc(msg)}</span>`;
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
  }

  // ---------- Bindings ----------
  function bind() {
    const s = D.stats;
    const values = {
      online: fmt(state.online), servers: fmt(s.servers), groupMembers: compact(s.groupMembers),
      discordOnline: compact(s.discordOnline), discordMembers: compact(s.discordMembers),
      visits: compact(s.visits), favorites: compact(s.favorites),
    };
    $$('[data-bind]').forEach((el) => { if (values[el.dataset.bind] != null) el.textContent = values[el.dataset.bind]; });
  }

  // ---------- Routing ----------
  const PAGES = ['home', 'reise', 'reiseplan', 'abfahrten', 'trainings', 'news', 'server', 'karriere', 'statistiken', 'spieler'];
  const NAV_OF = { abfahrten: 'reise', reiseplan: 'reise' };
  const MORE_PAGES = ['server', 'karriere', 'statistiken', 'spieler'];
  const TITLES = {
    home: 'Train Sim Germany – Das Bahnerlebnis auf Roblox',
    reise: 'Reiseauskunft · Train Sim Germany',
    reiseplan: 'Reiseplan · Train Sim Germany',
    abfahrten: 'Abfahrten · Train Sim Germany',
    news: 'Neuigkeiten · Train Sim Germany',
    karriere: 'Karriere · Train Sim Germany',
    trainings: 'Trainings · Train Sim Germany',
    server: 'Server · Train Sim Germany',
    statistiken: 'Statistiken · Train Sim Germany',
    spieler: 'Spieler · Train Sim Germany',
  };
  const RENDER = {
    home() {
      renderHeroBoard(); renderHomeBoard(); renderPinned(); renderNextSteps(); renderRoutes(); renderHomeKpis(); renderNews();
      $('[data-open-jobs]').textContent = D.jobs.filter((x) => x.open).length;
    },
    reise() { renderTrip(); },
    reiseplan() { renderPlan(); },
    news() { renderNewsPage(); },
    karriere() { renderCareer(); },
    abfahrten() { renderFullBoard(); renderNotices(); },
    trainings() { renderTrainings(); },
    server() { $('[data-server-search]').value = state.serverQuery; renderServers(); },
    statistiken() { renderStatsKpis(); renderChart(); renderBars(); },
    spieler() { $('[data-player-search]').value = state.playerQuery; renderPlayers(); renderProfile(); },
  };

  function route() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const [first, sub, sub2] = path.split('/');
    const page = PAGES.includes(first) ? first : 'home';
    const params = new URLSearchParams(qs || '');
    if (params.get('station')) state.station = params.get('station');
    const jobId = page === 'karriere' ? (sub || null) : null;
    const jobApply = !!jobId && sub2 === 'bewerben';
    const changed = page !== state.page || jobId !== state.jobId || jobApply !== state.jobApply;
    state.page = page;
    state.jobId = jobId;
    state.jobApply = jobApply;
    document.body.dataset.page = page;

    $$('.page').forEach((p) => { p.hidden = p.dataset.page !== page; });
    const group = NAV_OF[page] || page;
    $$('[data-nav]').forEach((a) => {
      const n = a.dataset.nav;
      const current = n === group || (n === 'more' && MORE_PAGES.includes(page)) || (n === 'more-desk' && (page === 'statistiken' || page === 'spieler'));
      if (current) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $$('[data-head-tab]').forEach((a) => {
      if (a.dataset.headTab === group || a.dataset.headTab === page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $$('[data-head-tab="reise"]').forEach((a) => { if (page === 'abfahrten') a.removeAttribute('aria-current'); });
    document.title = TITLES[page];
    closeMenu();
    closeModal();
    RENDER[page]();
    bind();
    if (changed) window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ---------- Menü ----------
  const menu = $('[data-menu]');
  function openMenu() {
    menu.hidden = false;
    document.body.classList.add('menu-open');
    $$('[data-menu-open]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
    const first = $('.menu__nav a', menu);
    if (first) first.focus({ preventScroll: true });
  }
  function closeMenu() {
    if (menu.hidden) return;
    menu.hidden = true;
    document.body.classList.remove('menu-open');
    $$('[data-menu-open]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }

  // ---------- Theme ----------
  function isDark() {
    const t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // ---------- Events ----------
  function events() {
    $$('[data-link]').forEach((a) => { if (D.links[a.dataset.link]) a.href = D.links[a.dataset.link]; });
    $$('[data-me-name]').forEach((el) => { el.textContent = D.me.name; });

    $('.skip-link').addEventListener('click', (e) => { e.preventDefault(); $('#main').focus(); });

    $$('[data-menu-open]').forEach((b) => b.addEventListener('click', openMenu));
    $$('[data-menu-close]').forEach((b) => b.addEventListener('click', closeMenu));
    $$('[data-modal-close]').forEach((b) => b.addEventListener('click', closeModal));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenu(); closeModal(); } });

    $$('[data-theme-toggle]').forEach((btn) => btn.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('tsg-theme', next); } catch (e) { /* Speicher nicht verfügbar */ }
      if (state.page === 'statistiken') renderChart();
    }));

    const topbar = $('[data-topbar]');
    const onScroll = () => topbar.classList.toggle('is-scrolled', window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Suche
    const items = searchIndex();
    attachSearch($('[data-search]'), $('[data-search-input]'), $('[data-search-results]'), () => items);
    const stationItems = items.filter((i) => i.type === 'Bahnhof').map((i) => Object.assign({}, i, { go: () => setStation(i.label) }));
    attachSearch($('[data-station-search]'), $('[data-station-input]'), $('[data-station-results]'), () => stationItems);

    // Klicks, die überall vorkommen (Seiten und Sheets)
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-open], [data-detail], [data-bell], [data-day], [data-pick-day], [data-rank], [data-ttoggle], [data-treset], [data-signup], [data-waitlist], [data-station-pick], [data-station], [data-fav]');
      if (!el) return;
      const ds = el.dataset;
      if (ds.open) openModal(ds.open);
      else if (ds.detail) openModal('training', ds.detail);
      else if ('bell' in ds) toggleBell();
      else if (ds.pickDay) { state.trainingDay = +ds.pickDay; closeModal(); renderTrainings(); }
      else if (ds.day) { state.trainingDay = +ds.day; renderTrainings(); }
      else if (ds.rank) {
        state.rank = ds.rank;
        store.set('tsg-rank', ds.rank);
        closeModal();
        renderTrainings();
        const next = nextRank(ds.rank);
        toast(next ? `Rang: ${ds.rank} – als Nächstes ${next.name}` : `Rang: ${ds.rank}`);
      } else if (ds.ttoggle) {
        if (state.typeFilter.has(ds.ttoggle)) state.typeFilter.delete(ds.ttoggle); else state.typeFilter.add(ds.ttoggle);
        store.set('tsg-tfilter', Array.from(state.typeFilter));
        state.trainingDay = null;
        renderTrainings();
        refreshModal();
      } else if ('treset' in ds) {
        state.typeFilter.clear();
        store.set('tsg-tfilter', []);
        state.trainingDay = null;
        closeModal();
        renderTrainings();
      } else if (ds.signup) toggleSignup(ds.signup);
      else if (ds.waitlist) { const t = findTraining(ds.waitlist); toast(`Auf der Warteliste für „${t.title}“`); closeModal(); }
      else if (ds.stationPick) { closeModal(); setStation(ds.stationPick); }
      else if (ds.station) { state.homeStation = ds.station; renderHomeBoard(); renderHeroBoard(); }
      else if (ds.fav) {
        const name = ds.fav;
        if (state.favs.has(name)) state.favs.delete(name); else state.favs.add(name);
        store.set('tsg-favs', Array.from(state.favs));
        el.setAttribute('aria-pressed', String(state.favs.has(name)));
        toast(state.favs.has(name) ? `${name} gemerkt` : `${name} entfernt`);
      }
    });

    // Karussell-Pfeile
    const rail = $('[data-rail="routes"]');
    const step = () => (rail.firstElementChild ? rail.firstElementChild.offsetWidth + 14 : 240);
    $('[data-rail-prev="routes"]').addEventListener('click', () => rail.scrollBy({ left: -step() * 2, behavior: 'smooth' }));
    $('[data-rail-next="routes"]').addEventListener('click', () => rail.scrollBy({ left: step() * 2, behavior: 'smooth' }));
    const tabs = $('[data-day-tabs]');
    $('[data-day-prev]').addEventListener('click', () => tabs.scrollBy({ left: -240, behavior: 'smooth' }));
    $('[data-day-next]').addEventListener('click', () => tabs.scrollBy({ left: 240, behavior: 'smooth' }));
    $('[data-all-toggle]').addEventListener('click', () => { state.showAll = !state.showAll; renderTrainings(); });

    // Abfahrten
    $$('[data-board-mode]').forEach((b) => b.addEventListener('click', () => {
      state.mode = b.dataset.boardMode;
      $$('[data-board-mode]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      renderFullBoard();
    }));
    $('[data-cat-filter]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]');
      if (!b) return;
      state.cat = b.dataset.cat;
      $$('[data-cat]').forEach((x) => x.classList.toggle('is-active', x === b));
      renderFullBoard();
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

    // Spieler
    $('[data-player-search]').addEventListener('input', (e) => { state.playerQuery = e.target.value; renderPlayers(); });
    $$('[data-sort]').forEach((b) => b.addEventListener('click', () => {
      state.playerSort = b.dataset.sort;
      $$('[data-sort]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      renderPlayers();
    }));

    // Reiseauskunft, Schnelle Suche, Sheets, News, Karriere
    let suppressClick = false;
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-picker], [data-pk], [data-pk-star], [data-pk-clear], [data-trip-swap], [data-trip-search], [data-conn], [data-plan-toggle], [data-pin-trip], [data-unpin], [data-pinned-open], [data-quick-del], [data-quick-tile], [data-quick-add], [data-quick-edit], [data-quick-info], [data-when-day], [data-when-now], [data-when-apply], [data-opt-product], [data-opt-direct], [data-opt-via-clear], [data-opt-reset], [data-opt-apply], [data-news-cat], [data-news-open], [data-apply-reset], [data-sector-jump]');
      if (!el) return;
      const ds = el.dataset;
      const t = state.trip;
      if (ds.picker) openModal('picker', ds.picker);
      else if (ds.pk) pickStation(ds.pk);
      else if (ds.pkStar) {
        if (state.favStations.has(ds.pkStar)) state.favStations.delete(ds.pkStar); else state.favStations.add(ds.pkStar);
        store.set('tsg-fav-stations', Array.from(state.favStations));
        const input = $('[data-picker-input]');
        $('[data-pk-list]').innerHTML = pickerList(input ? input.value : '');
      } else if ('pkClear' in ds) {
        state.history = [];
        store.set('tsg-history', []);
        $('[data-pk-list]').innerHTML = pickerList('');
      } else if ('tripSwap' in ds) {
        [t.from, t.to] = [t.to, t.from];
        if (state.tripResults) runSearch({ scroll: false }); else renderTrip();
        renderTrip();
      } else if ('tripSearch' in ds) runSearch();
      else if (ds.conn) {
        state.planConn = state.tripResults[+ds.conn];
        state.planOpen = {};
        location.hash = '#/reiseplan';
      } else if (ds.planToggle) {
        const li = +ds.planToggle;
        state.planOpen[li] = state.planOpen[li] === false;
        renderPlan();
      } else if ('pinTrip' in ds) togglePin();
      else if ('unpin' in ds) {
        state.pinned = null;
        store.set('tsg-pinned', null);
        toast('Anheften gelöst');
        if (state.page === 'home') renderPinned();
        if (state.page === 'reise') renderTripResults();
      } else if ('pinnedOpen' in ds) openPinned();
      else if (ds.quickDel) {
        state.quick = state.quick.filter((n) => n !== ds.quickDel);
        store.set('tsg-quick', state.quick);
        renderQuick();
      } else if (ds.quickTile) {
        if (!suppressClick) quickTap(ds.quickTile);
      } else if ('quickAdd' in ds) openModal('picker', 'quick');
      else if ('quickEdit' in ds) {
        state.quickEdit = !state.quickEdit;
        state.quickSel = null;
        renderQuick();
      } else if ('quickInfo' in ds) toast('Start antippen, dann Ziel antippen – oder den Start aufs Ziel ziehen');
      else if (ds.whenDay) {
        const input = $('[data-when-time]');
        if (input) state.whenDraft.time = input.value;
        state.whenDraft.dayOffset = +ds.whenDay;
        refreshModal();
      } else if ('whenNow' in ds) {
        t.dayOffset = 0;
        t.time = null;
        closeModal();
        renderTrip();
        if (state.tripResults) runSearch({ scroll: false });
      } else if ('whenApply' in ds) {
        const now = berlinNow();
        const value = $('[data-when-time]').value || `${pad(now.h)}:${pad(now.m)}`;
        const unchangedNow = state.whenDraft.dayOffset === 0 && state.whenDraft.time === null && value === `${pad(now.h)}:${pad(now.m)}`;
        t.dayOffset = state.whenDraft.dayOffset;
        t.time = unchangedNow ? null : value;
        closeModal();
        renderTrip();
        if (state.tripResults) runSearch({ scroll: false });
      } else if (ds.optProduct) {
        const p = state.optDraft.products;
        if (p.has(ds.optProduct) && p.size === 1) { toast('Mindestens ein Verkehrsmittel muss ausgewählt sein'); return; }
        if (p.has(ds.optProduct)) p.delete(ds.optProduct); else p.add(ds.optProduct);
        refreshModal();
      } else if ('optDirect' in ds) {
        state.optDraft.directOnly = !state.optDraft.directOnly;
        refreshModal();
      } else if ('optViaClear' in ds) {
        state.optDraft.via = '';
        refreshModal();
      } else if ('optReset' in ds) {
        state.optDraft = { products: new Set(PRODUCTS.map((p) => p.id)), directOnly: false, via: '' };
        refreshModal();
      } else if ('optApply' in ds) {
        t.products = state.optDraft.products;
        t.directOnly = state.optDraft.directOnly;
        t.via = state.optDraft.via;
        closeModal();
        renderTrip();
        if (state.tripResults) runSearch({ scroll: false });
      } else if (ds.newsCat) {
        state.newsCat = ds.newsCat;
        renderNewsPage();
      } else if (ds.newsOpen) openModal('news', ds.newsOpen);
      else if (ds.sectorJump) $(`[data-sector="${ds.sectorJump}"]`).scrollIntoView({ behavior: 'smooth', block: 'start' });
      else if (ds.applyReset) {
        delete state.applications[ds.applyReset];
        store.set('tsg-applications', state.applications);
        toast('Bewerbung zurückgezogen');
        if (state.jobApply) location.hash = `#/karriere/${ds.applyReset}`;
        else renderCareer();
      }
    });

    // Schnelle Suche: Start-Kachel auf die Ziel-Kachel ziehen (Maus & Touch)
    let drag = null;
    $('[data-quick]').addEventListener('pointerdown', (e) => {
      const tile = e.target.closest('[data-quick-tile]');
      if (!tile || state.quickEdit || e.target.closest('[data-quick-del]')) return;
      drag = { name: tile.dataset.quickTile, x: e.clientX, y: e.clientY, moved: false, ghost: null, over: null };
    });
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
      if (!drag.moved) {
        drag.moved = true;
        drag.ghost = document.createElement('div');
        drag.ghost.className = 'quick-ghost';
        drag.ghost.textContent = drag.name === D.me.position ? 'Aktuelle Position' : drag.name;
        document.body.appendChild(drag.ghost);
      }
      drag.ghost.style.left = `${e.clientX}px`;
      drag.ghost.style.top = `${e.clientY}px`;
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const over = hit && hit.closest('[data-quick-tile]');
      $$('.quick-tile.is-drop').forEach((x) => x.classList.remove('is-drop'));
      drag.over = over && over.dataset.quickTile !== drag.name ? over.dataset.quickTile : null;
      if (drag.over) over.classList.add('is-drop');
    });
    const endDrag = () => {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (d.ghost) d.ghost.remove();
      $$('.quick-tile.is-drop').forEach((x) => x.classList.remove('is-drop'));
      if (d.moved) {
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 0);
        if (d.over) quickSearch(d.name, d.over);
      }
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    document.addEventListener('input', (e) => {
      const target = e.target;
      if (target.matches('[data-picker-input]')) $('[data-pk-list]').innerHTML = pickerList(target.value);
      const form = target.closest('form[data-apply]');
      if (form) {
        const field = target.closest('.f.has-error');
        if (field) clearFieldError(field);
        // Der Rang entscheidet mit, ob der gewählte Bereich passt
        const area = target.name === 'rank' && $('[data-field="area"].has-error', form);
        if (area) clearFieldError(area);
        updateSectors(form);
      }
    });
    // Bereich gewechselt: passende Fragen zeigen, bisherige Antworten behalten
    document.addEventListener('change', (e) => {
      if (!e.target.matches('form[data-apply] input[name="area"]')) return;
      const form = e.target.form;
      $$('[data-quiz] input:checked', form).forEach((x) => { state.quizAnswers[x.name.slice(2)] = x.value; });
      $('[data-quiz]', form).innerHTML = quizHtml(D.jobs.find((x) => x.id === form.dataset.apply), e.target.value, state.quizAnswers);
      updateSectors(form);
    });
    document.addEventListener('submit', (e) => {
      const form = e.target.closest('form[data-apply]');
      if (!form) return;
      e.preventDefault();
      submitApplication(form);
    });

    window.addEventListener('hashchange', route);
  }

  // ---------- Live-Takt ----------
  function tick() {
    const now = berlinNow();
    const clock = `${pad(now.h)}:${pad(now.m)}`;
    $$('[data-clock]').forEach((el) => { el.textContent = clock; });
    $$('[data-clock-full]').forEach((el) => { el.textContent = `${clock}:${pad(now.s)}`; });
    const ago = Math.round((Date.now() - state.updatedAt) / 1000);
    $$('[data-updated]').forEach((el) => { el.textContent = ago < 5 ? 'gerade eben' : `vor ${ago} s`; });
  }

  let lastMinute = -1;
  function liveRefresh() {
    const now = berlinNow();
    if (now.abs === lastMinute && (Date.now() - state.updatedAt) < 20000) return;
    const minuteChanged = now.abs !== lastMinute;
    lastMinute = now.abs;
    state.updatedAt = Date.now();
    state.online = Math.max(900, state.online + Math.round((Math.random() - 0.48) * 14));
    bind();
    if (state.page === 'home') { renderHeroBoard(); renderHomeBoard(); if (minuteChanged) renderNextSteps(); }
    if (state.page === 'abfahrten') renderFullBoard();
    if (state.page === 'trainings' && minuteChanged && modal.hidden) renderNextSteps();
  }

  // ---------- Start ----------
  $$('[data-year]').forEach((el) => { el.textContent = berlinNow().y; });
  events();
  route();
  tick();
  lastMinute = berlinNow().abs;
  setInterval(tick, 1000);
  setInterval(liveRefresh, 1000);
})();
