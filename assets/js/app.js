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
  };

  // ---------- Abfahrten (aus Linien & Takt berechnet) ----------
  const CAT_GROUP = { ice: 'fern', ic: 'fern', re: 'regio', rb: 'regio', s: 's' };
  const GUESTS = ['Gast_4821', 'Bahnfreund22', 'Tf_Hannah', 'RegioRalf', 'Speedy_ICE', 'Elias_BR423', 'ZugZwang', 'LokLiebe'];
  const DRIVERS = D.players.map((p) => p.name).concat(GUESTS);
  const ALL_STOPS = Array.from(new Set(D.lines.flatMap((l) => l.stops.map((s) => s[0])))).sort((a, b) => a.localeCompare(b, 'de'));
  const stationInfo = (name) => D.stations.find((s) => s.name === name) || { name, region: 'Regionalnetz', tracks: 6, img: 'route-forest.svg' };

  function departures(station, { mode = 'dep', limit = 10, cat = 'all' } = {}) {
    const now = berlinNow();
    const info = stationInfo(station);
    const out = [];
    for (const line of D.lines) {
      if (cat !== 'all' && CAT_GROUP[line.cat] !== cat) continue;
      const total = line.stops[line.stops.length - 1][1];
      for (const dir of [0, 1]) {
        const stops = dir === 0 ? line.stops : line.stops.slice().reverse().map(([n, t]) => [n, total - t]);
        const idx = stops.findIndex((s) => s[0] === station);
        if (idx < 0) continue;
        if (mode === 'dep' && idx === stops.length - 1) continue;
        if (mode === 'arr' && idx === 0) continue;
        const offset = dir === 0 ? line.offset : (line.offset + Math.floor(line.every / 2)) % line.every;
        const base = offset + stops[idx][1];
        for (let k = Math.ceil((now.abs - 20 - base) / line.every); ; k++) {
          const planned = base + k * line.every;
          if (planned > now.abs + 300) break;
          const run = `${line.id}:${dir}:${planned - stops[idx][1]}`;
          const r = hash(run);
          const roll = r % 100;
          let delay = 0;
          const cancelled = roll < 2;
          if (!cancelled && roll < 10) delay = 6 + ((r >>> 8) % 12);
          else if (!cancelled && roll < 32) delay = 1 + ((r >>> 8) % 5);
          const actual = planned + delay;
          if (actual < now.abs || (cancelled && planned < now.abs)) continue;
          const dest = mode === 'dep' ? stops[stops.length - 1][0] : stops[0][0];
          const via = mode === 'dep' ? stops.slice(idx + 1, -1).slice(0, 3).map((s) => s[0]) : stops.slice(1, idx).slice(-3).map((s) => s[0]);
          const track = line.cat === 's'
            ? 1 + ((hash(line.id + station) + dir) % 2)
            : 3 + (hash(`${line.id}:${dir}:${station}`) % Math.max(1, info.tracks - 2));
          out.push({
            line, run, planned, actual, delay, cancelled, dest, via, track,
            mins: actual - now.abs,
            driver: DRIVERS[(r >>> 4) % DRIVERS.length],
            reason: cancelled || delay >= 6 ? D.delayReasons[(r >>> 12) % D.delayReasons.length] : '',
          });
        }
      }
    }
    out.sort((a, b) => a.planned - b.planned || a.actual - b.actual);
    return out.slice(0, limit);
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
        <h3>${esc(r.title)}</h3>
        <p>${esc(r.from)} → ${esc(r.to)}</p>
      </article>`;
    }).join('');
  }

  function renderNews() {
    $('[data-news]').innerHTML = D.news.map((n, i) => `<article class="news">
      <img src="assets/img/${n.img}" alt="" loading="lazy">
      <div>
        <div class="news__meta"><span class="tag ${['tag--red', 'tag--info', 'tag--ok'][i % 3]}">${esc(n.tag)}</span><span>${esc(n.date)}</span></div>
        <h3>${esc(n.title)}</h3>
      </div>
    </article>`).join('');
  }

  // ---------- Server ----------
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
    const me = rankOf(state.rank);
    const next = nextRank(state.rank);
    if (!next) {
      return `<article class="promo-card promo-card--done">
        <img class="promo-card__img" src="assets/img/group.svg" alt="" loading="lazy">
        <div class="promo-card__body">
          <span class="promo-card__eyebrow"><span class="rank-dot" style="--rc:${me.color}"></span>${esc(me.name)}</span>
          <${heading}>Alle Ausbildungen abgeschlossen</${heading}>
          <p>Du hast den höchsten Rang erreicht. Hilf jetzt neuen Spielern als Ausbilder.</p>
        </div>
      </article>`;
    }
    const type = typeOf(next.name);
    const t = trainingsList({ all: true }).find((x) => x.type === next.name);
    return `<article class="promo-card">
      <img class="promo-card__img" src="assets/img/${type.img}" alt="" loading="lazy">
      <div class="promo-card__body">
        <span class="promo-card__eyebrow"><span class="rank-dot" style="--rc:${me.color}"></span>${esc(me.name)} → ${esc(next.name)}</span>
        <${heading}>Dein nächster Schritt: ${esc(next.name)}</${heading}>
        <p>${esc(type.text)}</p>
        <p class="promo-card__when">${t ? `<b>${dayName(t.day)} · ${t.time} Uhr</b> · ${relTime(t.start)}` : 'Noch kein Termin geplant'}</p>
      </div>
      ${t
        ? `<button class="btn btn--primary btn--sm promo-card__btn" type="button" data-detail="${t.id}">Details</button>`
        : '<button class="btn btn--primary btn--sm promo-card__btn" type="button" data-bell>Erinnern</button>'}
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
        <span class="glass-btn">${icon(badge)}</span>
        <span class="tcard__role" style="--rc:${t.color}"><i></i>${esc(t.type)}</span>
      </div>
      <div class="tcard__body">
        <h3>${esc(t.title)}</h3>
        <div class="tcard__row"><b>${t.time} Uhr</b><span class="tcard__slots${st.cls === 'bad' ? ' is-full' : st.cls === 'mine' ? ' is-mine' : ''}">${icon('fi-rr-users-alt')}${t.taken}/${t.slots}</span></div>
      </div>
    </button>`;
  }

  function renderTrainings() {
    const now = berlinNow();
    const list = trainingsList();
    const me = rankOf(state.rank);

    $('[data-rank-name]').textContent = me.name;
    $('[data-rank-dot]').style.setProperty('--rc', me.color);
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
    toggle.innerHTML = state.showAll ? `Weniger ${icon('fi-rr-angle-small-up')}` : `Alle (${list.length}) ${icon('fi-rr-angle-small-down')}`;

    // Ränge in der Seitenleiste
    const cur = rankIdx(state.rank);
    $('[data-rank-ladder]').innerHTML = RANKS.map((r, i) => `<li class="${i === cur ? 'is-current' : i < cur ? 'is-done' : ''}" style="--rc:${r.color}"><i></i><b>${esc(r.name)}</b><span>${esc(r.label)}</span></li>`).join('');

    renderNextSteps();
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
    station: {
      title: 'Bahnhof wählen',
      render: () => `<div class="opt-list">${D.stations.map((s) => `
        <button class="opt" type="button" role="radio" aria-checked="${s.name === state.station}" data-station-pick="${esc(s.name)}">
          <span class="res-ic">${icon('fi-rr-marker')}</span><span><b>${esc(s.name)}</b><small>${esc(s.region)} · ${s.tracks} Gleise</small></span>
          ${s.name === state.station ? icon('fi-rr-check') : ''}
        </button>`).join('')}</div>`,
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
    modalView = { name, arg };
    $('[data-modal-title]').textContent = VIEWS[name].title;
    $('[data-modal-body]').innerHTML = VIEWS[name].render(arg);
    modal.hidden = false;
    document.body.classList.add('menu-open');
    const focusable = $('[data-modal-body] button:not([disabled])', modal) || $('[data-modal-close]', modal);
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
  const PAGES = ['home', 'abfahrten', 'trainings', 'server', 'statistiken', 'spieler'];
  const TITLES = {
    home: 'Train Sim Germany – Das Bahnerlebnis auf Roblox',
    abfahrten: 'Abfahrten · Train Sim Germany',
    trainings: 'Trainings · Train Sim Germany',
    server: 'Server · Train Sim Germany',
    statistiken: 'Statistiken · Train Sim Germany',
    spieler: 'Spieler · Train Sim Germany',
  };
  const RENDER = {
    home() { renderHeroBoard(); renderHomeBoard(); renderNextSteps(); renderRoutes(); renderHomeKpis(); renderNews(); },
    abfahrten() { renderFullBoard(); renderNotices(); },
    trainings() { renderTrainings(); },
    server() { $('[data-server-search]').value = state.serverQuery; renderServers(); },
    statistiken() { renderStatsKpis(); renderChart(); renderBars(); },
    spieler() { $('[data-player-search]').value = state.playerQuery; renderPlayers(); renderProfile(); },
  };

  function route() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const page = PAGES.includes(path) ? path : 'home';
    const params = new URLSearchParams(qs || '');
    if (params.get('station')) state.station = params.get('station');
    const changed = page !== state.page;
    state.page = page;
    document.body.dataset.page = page;

    $$('.page').forEach((p) => { p.hidden = p.dataset.page !== page; });
    $$('[data-nav]').forEach((a) => {
      const current = a.dataset.nav === page || (a.dataset.nav === 'more' && (page === 'statistiken' || page === 'spieler'));
      if (current) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
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
    $('[data-me-avatar]').innerHTML = avatar(D.me.username);
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
