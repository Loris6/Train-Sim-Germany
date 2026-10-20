/* Train Sim Germany – App-Logik (Routing, Live-Daten, Rendering) */
(function () {
  'use strict';

  const D = window.TSG;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  // ---------- Hilfsfunktionen ----------
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
    quizAnswers: {},
    applications: store.get('tsg-applications', {}),
    // Mit Roblox verbundenes Profil: { userId, username, displayName, avatar }
    profile: store.get('tsg-profile', null),
  };

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
      kpi({ label: t('Spieler online'), value: `<span data-bind="online">${fmt(state.online)}</span>`, delta: `${pct(12)} <small>${t('vs. gestern')}</small>`, ic: 'fi-rr-users-alt', seed: 'on' }),
      kpi({ label: t('Aktive Server'), value: fmt(s.servers), delta: `3 <small>${t('seit 1 Std.')}</small>`, ic: 'fi-rr-database', seed: 'sv' }),
      kpi({ label: t('Züge unterwegs'), value: fmt(s.trains), delta: `${pct(8)} <small>${t('vs. gestern')}</small>`, ic: 'fi-rr-train-side', seed: 'tr' }),
      kpi({ label: t('Pünktlichkeit'), value: pct(s.punctuality, 1), delta: `${t('{n} Pkt.', { n: nf1.format(0.6) })} <small>${t('vs. gestern')}</small>`, up: false, ic: 'fi-rr-clock-three', seed: 'pu' }),
    ].join('');
  }
  function renderStatsKpis() {
    const s = D.stats;
    $('[data-kpis="stats"]').innerHTML = [
      kpi({ label: t('Besuche gesamt'), value: compact(s.visits), delta: pct(3.8, 1), ic: 'fi-rr-gamepad', seed: 'vi' }),
      kpi({ label: t('Favoriten'), value: compact(s.favorites), delta: pct(1.2, 1), ic: 'fi-rr-star', seed: 'fa' }),
      kpi({ label: t('Gruppenmitglieder'), value: compact(s.groupMembers), delta: fmt(640), ic: 'fi-rr-users-alt', seed: 'gr' }),
      kpi({ label: 'Discord', value: compact(s.discordMembers), delta: pct(2.1, 1), ic: 'fi-brands-discord', seed: 'dc' }),
      kpi({ label: t('Gefahrene km'), value: compact(s.km), delta: pct(4.4, 1), ic: 'fi-rr-route', seed: 'km' }),
      kpi({ label: t('Fahrten heute'), value: fmt(s.tripsToday), delta: pct(6), ic: 'fi-rr-train-side', seed: 'ft' }),
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
        return { label: `${pad(h)}:00`, tick: h % 3 === 0 ? `${pad(h)}` : '', value: v, tip: t('{time} Uhr', { time: `${pad(h)}:00` }) };
      });
    }
    const n = range === '7' ? 7 : 30;
    return Array.from({ length: n }, (_, i) => {
      const day = now.day - (n - 1) + i;
      const dt = dateOf(day);
      const wd = dt.getUTCDay();
      const weekend = wd === 0 || wd === 6 || wd === 5;
      const v = Math.round(1250 + i * (n === 30 ? 9 : 25) + (weekend ? 260 : 0) + (hash('d' + day) % 140));
      const label = dtf({ day: '2-digit', month: '2-digit' }).format(dt);
      return {
        label, value: v,
        tick: n === 7 ? wdShort(day) : i % 5 === 4 || i === 0 ? label : '',
        tip: `${wdLong(day)}, ${label} · ${t('Tageshöchstwert')}`,
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

  function renderBars() {
    const max = Math.max(...D.trainShare.map((d) => d.value));
    $('[data-hbars]').innerHTML = D.trainShare.map((d) => `<div class="hbar" data-tip="<b>${pct(d.value)}</b><span>${esc(t(d.label))}</span>">
      <span class="hbar__label">${esc(t(d.label))}</span>
      <span class="hbar__track"><span class="hbar__fill" style="width:${(d.value / max) * 86}%"></span><span class="hbar__value">${pct(d.value)}</span></span>
    </div>`).join('');

    $('[data-meters]').innerHTML = D.punctualityByNet.map((d) => {
      const s = d.value >= 93 ? ['ok', t('Gut'), 'fi-rr-check'] : d.value >= 88 ? ['warn', t('Angespannt'), 'fi-rr-triangle-warning'] : ['bad', t('Kritisch'), 'fi-rr-triangle-warning'];
      return `<li>
        <span class="m-label">${esc(t(d.label))}</span>
        <span class="m-value"><span class="state state--${s[0]}">${icon(s[2])}${s[1]}</span>${pct(d.value, 1)}</span>
        <span class="bar bar--${s[0]}"><span style="width:${d.value}%"></span></span>
      </li>`;
    }).join('');

    const top = Math.max(...D.topRoutes.map((d) => d.value));
    $('[data-top-routes]').innerHTML = routeList(D.topRoutes.map((d) => ({ route: routeOf(d.no), value: d.value })), top);
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
    const rk = (name) => `<b class="rk" style="--rc:${rankOf(name).color}">${esc(name)}</b>`;
    const fill = (text, rank) => esc(t(text))
      .replace(/\{rank\}/g, rk(rank))
      .replace('{group}', `<a href="${esc(D.links.group)}" target="_blank" rel="noopener">${t('Train Sim Germany Gruppe auf Roblox')}${icon('fi-rr-arrow-up-right-from-square')}</a>`);
    const start = `<article class="role-card role-card--start">
      <div class="role-card__media"><img src="assets/img/group.svg" alt="${esc(t('Roblox-Spieler winken auf dem Bahnsteig vor einem Regionalzug'))}" loading="lazy"></div>
      <div class="role-card__body">
        <h3>${t('Starte jetzt bei Train Sim Germany!')}</h3>
        <div class="start-actions">
          <a class="btn btn--primary btn--lg btn--block" href="${esc(D.links.play)}" target="_blank" rel="noopener">${icon('fi-sr-play')}${t('Server beitreten')}</a>
          <p>${t('Deine Reise beginnt auf Roblox.')}</p>
          <a class="btn btn--outline btn--lg btn--block" href="${esc(D.links.group)}" target="_blank" rel="noopener">${icon('fi-rr-user-add')}${t('Roblox-Gruppe beitreten')}</a>
          <p>${t('Für Ränge und Trainings.')}</p>
          <a class="btn btn--outline btn--lg btn--block btn--discord" href="${esc(D.links.discord)}" target="_blank" rel="noopener">${icon('fi-brands-discord')}${t('Discord-Community beitreten')}</a>
          <p>${t('Chatte mit {n} anderen Spielern.', { n: `<span data-bind="discordMembers">${compact(D.stats.discordMembers)}</span>` })}</p>
        </div>
      </div>
    </article>`;
    $('[data-roles]').innerHTML = start + D.roleCards.map((c) => `<article class="role-card">
      <div class="role-card__media"><img src="assets/img/${c.img}" alt="" loading="lazy"></div>
      <div class="role-card__body">
        <h3>${fill(c.title, c.rank)}</h3>
        <p>${fill(c.text, c.rank)}</p>
        <span class="count-pill">${icon('fi-rr-users-alt')}${t('<b>{n}</b> Spieler als {rank}', { n: fmt(rankOf(c.rank).members), rank: esc(c.rank) })}</span>
      </div>
    </article>`).join('');
  }

  function renderRoutes() {
    $('[data-routes]').innerHTML = D.routes.map((r) => {
      const fav = state.favs.has(r.title);
      return `<article class="scard">
        <div class="scard__media">
          <img src="assets/img/${r.img}" alt="${esc(t('Illustration der Strecke {name}', { name: t(r.title) }))}" loading="lazy">
          <button class="glass-btn" type="button" aria-pressed="${fav}" aria-label="${esc(t('{name} merken', { name: t(r.title) }))}" data-fav="${esc(r.title)}">${icon('fi-rr-heart', 'fav-off')}${icon('fi-sr-heart', 'fav-on')}</button>
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
    $('[data-news]').innerHTML = D.news.slice(0, 3).map(newsCard).join('');
  }

  // ---------- Server ----------
  const CREW = D.crew;
  function serverRoles(s) {
    const roles = [
      ['Driver', t('Lokführer'), Math.round(s.players * 0.32)],
      ['Conductor', t('Zugbegleiter'), Math.round(s.players * 0.2)],
      ['Signaller', t('Fahrdienstleiter'), Math.max(1, Math.round(s.players * 0.08))],
    ];
    roles.push(['Passenger', t('Fahrgäste'), Math.max(0, s.players - roles.reduce((sum, r) => sum + r[2], 0))]);
    return roles;
  }
  // Laufzeit in Minuten → „6 Std. 12 Min.“
  const uptime = (min) => (min >= 60 ? t('{h} Std. {m} Min.', { h: Math.floor(min / 60), m: pad(min % 60) }) : t('{m} Min.', { m: min }));
  function renderServers() {
    const free = D.servers.reduce((sum, x) => sum + Math.max(0, x.max - x.players), 0);
    const ping = Math.round(D.servers.reduce((sum, x) => sum + x.ping, 0) / D.servers.length);
    $('[data-server-stats]').innerHTML = `
      <div class="stat"><span>${t('Spieler online')}</span><b data-bind="online">${fmt(state.online)}</b></div>
      <div class="stat"><span>${t('Freie Plätze')}</span><b>${fmt(free)}</b></div>
      <div class="stat"><span>${t('Ø Ping')}</span><b>${ping} ms</b></div>`;

    const q = norm(state.serverQuery.trim());
    const list = D.servers.filter((s) => {
      if (state.serverType === 'free' && s.players >= s.max * 0.8) return false;
      if (!['all', 'free'].includes(state.serverType) && s.type !== state.serverType) return false;
      return !q || norm(`${s.name} ${s.network} ${s.region}`).includes(q);
    });
    const typeTag = { public: ['', t('Öffentlich')], event: ['tag--red', t('Event')], training: ['tag--info', t('Training')], vip: ['tag--warn', 'VIP'] };
    $('[data-servers]').innerHTML = list.length ? list.map((s) => {
      const ratio = s.players / s.max;
      const full = s.players >= s.max;
      const level = full ? 'bad' : ratio >= 0.85 ? 'warn' : 'ok';
      const label = full ? t('Voll') : ratio >= 0.85 ? t('Fast voll') : t('{n} frei', { n: s.max - s.players });
      const [tagCls, tagText] = typeTag[s.type];
      const names = CREW.filter((_, i) => (hash(s.name) + i) % 5 === 0).slice(0, 3);
      return `<article class="server">
        <div class="server__head">
          <div class="server__name">
            <span class="server__ic">${icon(s.type === 'training' ? 'fi-rr-calendar' : s.type === 'event' ? 'fi-rr-bolt' : 'fi-rr-database')}</span>
            <div><h3>${esc(t(s.name))}</h3><small><span class="live-dot live-dot--sm"></span>${esc(s.region)} · v${esc(s.version)}</small></div>
          </div>
          <span class="tag ${tagCls}">${tagText}</span>
        </div>
        <p class="server__net">${icon('fi-rr-route')}${esc(t(s.network))}</p>
        <div class="occ">
          <div class="occ__row"><span class="status status--${level}">${label}</span><b>${s.players}/${s.max}</b></div>
          <div class="bar bar--${level}"><span style="width:${Math.min(100, ratio * 100)}%"></span></div>
        </div>
        <div class="server__roles"><span class="server__roles-title">${t('Rollen')}</span>${serverRoles(s).map(([r, label, n]) => `<span class="role-count" style="--rc:${rankOf(r).color}"><i></i><span>${label}</span><b>${n}</b></span>`).join('')}</div>
        <dl class="server__meta">
          <div><dt>${icon('fi-rr-signal-alt-2')}Ping</dt><dd>${s.ping} ms</dd></div>
          <div><dt>${icon('fi-rr-train-side')}${t('Züge')}</dt><dd>${s.trains}</dd></div>
          <div><dt>${icon('fi-rr-clock-three')}${t('Laufzeit')}</dt><dd>${uptime(s.uptime)}</dd></div>
        </dl>
        <div class="server__foot">
          <span class="avatars">${names.map((n) => avatar(n)).join('')}<small>+${Math.max(0, s.players - names.length)}</small></span>
          ${full
            ? `<button class="btn btn--soft btn--sm" type="button" disabled>${t('Voll')}</button>`
            : `<a class="btn btn--primary btn--sm" href="${esc(D.links.play)}" target="_blank" rel="noopener">${icon('fi-sr-play')}${t('Beitreten')}</a>`}
        </div>
      </article>`;
    }).join('') : `<p class="empty">${t('Kein Server gefunden. Versuch einen anderen Filter.')}</p>`;
  }

  // ---------- Trainings ----------
  // Der Wochenplan aus data.js wird für zwei Wochen ausgerollt.
  function trainingsList({ all = false } = {}) {
    const now = berlinNow();
    const types = myTrainingTypes();
    const out = [];
    for (let week = 0; week < 2; week++) {
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
    if (!next) {
      return `<article class="promo-card">
        <img class="promo-card__img" src="assets/img/group.svg" alt="" loading="lazy">
        <div class="promo-card__body">
          <${heading}>${t('Alle Ausbildungen geschafft')}</${heading}>
          <p>${t('Du hast den höchsten Rang erreicht. Als Supervisor kannst du jetzt selbst Trainings leiten.')}</p>
          <a class="btn btn--primary promo-card__btn" href="#/karriere/supervisor">${icon('fi-rr-briefcase')}${t('Als Supervisor bewerben')}</a>
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
    if (state.page === 'home') home.innerHTML = nextStepHTML('h3');
    if (state.page === 'trainings') full.innerHTML = nextStepHTML('h2');
  }

  function tcard(tn) {
    const st = trainingState(tn);
    return `<button class="tcard" type="button" data-detail="${tn.id}">
      <div class="tcard__media">
        <img src="assets/img/${tn.img}" alt="" loading="lazy">
        ${serverPill(tn)}
        <span class="tcard__role" style="--rc:${tn.color}"><i></i>${esc(tn.type)}</span>
      </div>
      <div class="tcard__body">
        <h3>${esc(t(tn.title))}</h3>
        <div class="tcard__row"><span>${t('{time} Uhr', { time: tn.time })}</span><span class="tcard__slots${st.cls === 'bad' ? ' is-full' : ''}">${icon('fi-sr-user')}${tn.taken}/${tn.slots}</span></div>
      </div>
    </button>`;
  }

  function renderTrainings() {
    const now = berlinNow();
    const list = trainingsList();
    const me = rankOf(state.rank);

    $('[data-rank-name]').textContent = me.name;
    $('[data-bell]').setAttribute('aria-pressed', String(state.bell));
    const types = myTrainingTypes();
    $('[data-all-title]').textContent = !types ? t('Alle kommenden Trainings') : types.length ? t('Kommende {type}-Trainings', { type: types[0] }) : t('Keine weiteren Trainings');

    // Tagesleiste: 14 Tage, roter Punkt = an diesem Tag gibt es Trainings
    const days = Array.from({ length: 14 }, (_, i) => now.day + i);
    if (state.trainingDay === null || !days.includes(state.trainingDay)) state.trainingDay = list.length ? list[0].day : now.day;
    const tabs = $('[data-day-tabs]');
    tabs.innerHTML = days.map((d) => {
      const has = list.some((tn) => tn.day === d);
      const label = d === now.day ? t('Heute') : d === now.day + 1 ? t('Morgen') : `${wdShort(d)} ${dtf({ day: 'numeric' }).format(dateOf(d))}`;
      return `<button class="day-tab${has ? ' has-trainings' : ''}" type="button" role="tab" aria-selected="${d === state.trainingDay}" data-day="${d}" aria-label="${dayName(d, { long: true })}${has ? `, ${t('Trainings geplant')}` : ''}">${label}<i></i></button>`;
    }).join('');
    const sel = $('[aria-selected="true"]', tabs);
    if (sel) tabs.scrollTo({ left: sel.offsetLeft - tabs.clientWidth / 2 + sel.clientWidth / 2, behavior: 'instant' });

    const field = $('[data-date-field]');
    field.textContent = dayName(state.trainingDay, { long: true });
    field.parentElement.classList.add('is-set');

    // Trainings am gewählten Tag
    const ofDay = list.filter((tn) => tn.day === state.trainingDay);
    const nextDay = list.find((tn) => tn.day > state.trainingDay);
    $('[data-day-trainings]').innerHTML = ofDay.length
      ? ofDay.map(tcard).join('')
      : types && !types.length
        ? `<div class="rail-empty">${icon('fi-rr-check-circle')}<span>${t('Für deinen Rang gibt es keine weiteren Trainings.')}</span></div>`
        : `<div class="rail-empty">${icon('fi-rr-calendar')}<span>${t('An diesem Tag ist kein Training geplant.')}${nextDay ? ` ${t('Nächstes:')} <button class="link-more" type="button" data-day="${nextDay.day}">${dayName(nextDay.day)}</button>` : ''}</span></div>`;

    // Alle kommenden Trainings (klein)
    const shown = state.showAll ? list : list.slice(0, 6);
    $('[data-all-trainings]').innerHTML = shown.length ? shown.map((tn) => {
      const st = trainingState(tn);
      return `<li><button type="button" data-detail="${tn.id}">
        <div class="tdate${tn.day === now.day ? ' is-today' : ''}"><span>${wdShort(tn.day)}</span><b>${dateOf(tn.day).getUTCDate()}</b></div>
        <div><h3>${esc(t(tn.title))}</h3><p><i style="--rc:${tn.color}"></i>${esc(tn.type)} · ${t('{time} Uhr', { time: tn.time })} · ${esc(tn.host)}</p></div>
        <span class="pill-state pill-state--${st.cls}">${st.text}</span>
      </button></li>`;
    }).join('') : `<li class="board-empty">${types && !types.length ? t('Für deinen Rang gibt es keine weiteren Trainings.') : t('Gerade sind keine Trainings geplant.')}</li>`;
    const toggle = $('[data-all-toggle]');
    toggle.hidden = list.length <= 6;
    toggle.textContent = state.showAll ? t('Weniger anzeigen') : t('Alle anzeigen');

    // Ränge in der Seitenleiste
    const cur = rankIdx(state.rank);
    $('[data-rank-ladder]').innerHTML = RANKS.map((r, i) => `<li class="${i === cur ? 'is-current' : i < cur ? 'is-done' : ''}" style="--rc:${r.color}"><i></i><b>${esc(r.name)}</b><span>${esc(t(r.label))}</span></li>`).join('');

    renderNextSteps();
  }

  // ---------- Neuigkeiten ----------
  const newsDate = (n) => dtf({ day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${n.date}T00:00:00Z`));
  function newsCard(n, i) {
    return `<button class="ncard" type="button" data-news-open="${i}">
      <div class="ncard__img"><img src="assets/img/${n.img}" alt="" loading="lazy">${n.video ? `<span class="ncard__play" aria-label="${esc(t('Mit Video'))}">${icon('fi-sr-play')}</span>` : ''}</div>
      <div class="ncard__body">
        <h3>${esc(t(n.title))}</h3>
        <div class="ncard__foot"><span class="cat-tag cat-tag--${n.cat}">${esc(t(n.tag))}</span><span>${newsDate(n)}</span></div>
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
    ? `<span class="pill pill--ok">${icon('fi-rr-check')}${t('Offen')}</span>`
    : `<span class="pill pill--bad">${t('Geschlossen')}</span>`);
  const SINCE = ['Weniger als 1 Monat', '1–3 Monate', '3–6 Monate', '6–12 Monate', 'Mehr als 1 Jahr'];
  const SECTORS = [
    { title: 'Über dich', text: 'Damit wir dich im Spiel, auf Discord und per E-Mail erreichen.' },
    { title: 'Grundwissen', text: '40 Fragen zu deinem Bereich: Auswahl-, Schiebe- und Schreibaufgaben. Bei manchen Fragen sind mehrere Antworten richtig.' },
    { title: 'Erfahrung & Zeit', text: '20 Fragen zu dir, deiner Erfahrung und deiner Zeit.' },
  ];
  const QUESTIONS_TOTAL = 60;

  // Fragenkatalog je Sprache (assets/js/questions/<sprache>.js), geladen beim Öffnen einer Bewerbung.
  // Fehlt eine Übersetzung, gelten die deutschen Fragen.
  const qbankLoads = {};
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => { s.remove(); reject(new Error(src)); };
      document.head.appendChild(s);
    });
  }
  const qbankTried = {};
  function loadQuestions() {
    const want = [...new Set(['de', lang])];
    return Promise.all(want.map((l) => {
      if (window.TSG_QBANK && window.TSG_QBANK[l]) return Promise.resolve();
      if (!qbankLoads[l]) {
        qbankLoads[l] = loadScript(`assets/js/questions/${l}.js`)
          .then(() => { qbankTried[l] = true; })
          .catch((e) => { delete qbankLoads[l]; if (l === 'de') throw e; qbankTried[l] = true; });
      }
      return qbankLoads[l];
    }));
  }
  const questionsReady = () => !!(window.TSG_QBANK && window.TSG_QBANK.de && (lang === 'de' || window.TSG_QBANK[lang] || qbankTried[lang]));
  const qbank = () => (window.TSG_QBANK && (window.TSG_QBANK[lang] || window.TSG_QBANK.de)) || null;

  // 60 Fragen je Bewerbung. Sektor 2 (40): beim Supervisor der gewählte Bereich plus „Bahnbetrieb allgemein“;
  // der Signaller stellt Signale, die für den Driver gelten – deshalb gehören bei ihm alle Driver-Fragen dazu.
  function quizGroups(job, area) {
    const Q = qbank();
    if (!job.areas) return [{ key: 'job', items: Q.jobs[job.id] }];
    const ofArea = (a) => ({ key: a, title: a, color: rankOf(a).color, items: Q.areas[a] });
    return area === 'Signaller'
      ? [ofArea('Signaller'), ofArea('Driver')]
      : [ofArea(area), { key: 'basics', title: t('Bahnbetrieb allgemein'), color: 'var(--muted)', items: Q.basics }];
  }
  // Sektor 3 (20): drei feste Fragen, dann Supervisor-Fragen bzw. allgemeine und stellenbezogene Fragen
  const FIXED = [
    { key: 'experience', type: 'long', q: 'Welche Erfahrung bringst du für diese Stelle mit?', min: 30, placeholder: 'Beschreibe kurz deine Erfahrung' },
    { key: 'activity', type: 'scale', q: 'Wie aktiv wärst du, wenn du angenommen wirst?', min: 1, max: 10, labels: ['selten', 'sehr aktiv'] },
    { key: 'days', type: 'days', q: 'An welchen Tagen hast du meistens Zeit?' },
  ];
  const isFixed = (q) => FIXED.some((f) => f.key === q.key);
  function sector2Items(job, area) {
    if (job.areas && !area) return [];
    return quizGroups(job, area).flatMap((g) => g.items.map((q, i) => ({ ...q, key: `${g.key}-${i}`, group: g.title ? g : null })));
  }
  function sector3Items(job) {
    const Q = qbank();
    const pool = job.areas ? Q.supervisor : [...Q.common, ...Q.extra[job.id]];
    return [...FIXED.map((f) => ({ ...f, q: t(f.q), placeholder: f.placeholder && t(f.placeholder), labels: f.labels && f.labels.map((x) => t(x)) })),
      ...pool.map((q, i) => ({ ...q, key: `x-${i}` }))];
  }
  const applyQuestions = (job, area) => [...sector2Items(job, area), ...sector3Items(job)];

  // Aufgaben erscheinen immer in derselben Reihenfolge nach Typ, Schreib- und Freitextaufgaben gesammelt am Ende
  const TYPE_BLOCKS = [
    { types: ['single'], title: 'Auswahl', text: 'Genau eine Antwort ist richtig.' },
    { types: ['multi'], title: 'Mehrfachauswahl', text: 'Eine oder mehrere Antworten sind richtig.' },
    { types: ['order'], title: 'Schiebeaufgaben', text: 'Zieh die Einträge am Griff in die richtige Reihenfolge.' },
    { types: ['scale', 'days'], title: 'Selbsteinschätzung', text: 'Schieb den Regler auf den passenden Wert.' },
    { types: ['pick'], title: 'Was trifft zu?', text: 'Wähle alles, was auf dich zutrifft.' },
    { types: ['write'], title: 'Schreibaufgaben', text: 'Tipp die kurze Antwort ein, z. B. ein Kürzel, einen Begriff oder eine Zahl.' },
    { types: ['links'], title: 'Deine Arbeit', text: 'Gib deine Links an und wähle bei jedem, was es ist.' },
    { types: ['short', 'long'], title: 'Freitext', text: 'Antworte in eigenen Worten.' },
  ];
  // Fragen nach Typ sortiert (innerhalb eines Typs bleibt die Reihenfolge), mit fortlaufender Nummer ab `start`
  function questionBlocks(items, start) {
    let n = start;
    return TYPE_BLOCKS.map((b) => {
      const list = items.filter((q) => b.types.includes(q.type));
      if (!list.length) return '';
      return `<div class="quiz-group">
          <h4 class="quiz-group__title">${t(b.title)}<small>${list.length === 1 ? t('1 Aufgabe') : t('{n} Aufgaben', { n: list.length })}</small></h4>
          <p class="quiz-group__text">${t(b.text)}</p>
          ${list.map((q) => questionHtml(q, n++)).join('')}
        </div>`;
    }).join('');
  }

  // Feste, gemischte Reihenfolge; bei Schiebeaufgaben nie schon richtig sortiert
  const mixed = (q, list) => list.map((_, i) => i).sort((a, b) => hash(q.q + a) - hash(q.q + b));
  function orderStart(q) {
    const o = mixed(q, q.items);
    return o.every((x, i) => x === i) ? [...o.slice(1), o[0]] : o;
  }
  const dataField = (name) => `data-field="${esc(name)}"`;
  // Link-Arten: Name, Symbol und erlaubte Adressen (leer = jede Adresse)
  const LINK_TYPES = {
    youtube: { label: 'YouTube', icon: 'fi-brands-youtube', hosts: ['youtube.com', 'youtu.be'] },
    tiktok: { label: 'TikTok', icon: 'fi-brands-tik-tok', hosts: ['tiktok.com'] },
    instagram: { label: 'Instagram', icon: 'fi-brands-instagram', hosts: ['instagram.com'] },
    twitch: { label: 'Twitch', icon: 'fi-brands-twitch', hosts: ['twitch.tv'] },
    github: { label: 'GitHub', icon: 'fi-brands-github', hosts: ['github.com'] },
    roblox: { label: 'Roblox (Spiel oder Place)', icon: 'fi-rr-gamepad', hosts: ['roblox.com'] },
    images: { label: 'Screenshots (z. B. Imgur)', icon: 'fi-rr-picture', hosts: [] },
    portfolio: { label: 'Portfolio / Website', icon: 'fi-rr-globe', hosts: [] },
    other: { label: 'Anderer Link', icon: 'fi-rr-link-alt', hosts: [] },
  };
  const LINKS_MAX = 5;
  function linkRowHtml(q, name) {
    return `<div class="link-row">
        <div class="select link-row__type"><select name="${esc(name)}:type" aria-label="${esc(t('Was ist das für ein Link?'))}">
          <option value="">${esc(t('Was ist das?'))}</option>${q.types.map((x) => `<option value="${x}">${esc(t(LINK_TYPES[x].label))}</option>`).join('')}
        </select>${icon('fi-rr-angle-small-down')}</div>
        <div class="write link-row__url">${icon('fi-rr-link-alt')}<input name="${esc(name)}:url" type="url" inputmode="url" autocomplete="url" spellcheck="false" placeholder="https://…" aria-label="${esc(t('Link'))}"></div>
        <button class="link-row__del" type="button" data-link-del aria-label="${esc(t('Link entfernen'))}">${icon('fi-rr-cross-small')}</button>
      </div>`;
  }
  function questionHtml(q, n) {
    const fixed = isFixed(q);
    const name = fixed ? q.key : `q:${q.key}`;
    const id = `q${n}`;
    const group = q.group ? `<span class="q__group" style="--rc:${q.group.color}"><i></i>${esc(q.group.title)}</span>` : '';
    const title = `<span class="q__no">${n}</span>${group}<span>${esc(q.q)}</span>`;
    const attrs = `${dataField(name)} data-q="${q.type}"${q.min ? ` data-min="${q.min}"` : ''}`;
    const box = (inner) => `<fieldset class="q f" ${attrs}><legend>${title}</legend>${inner}</fieldset>`;
    const labelled = (inner) => `<div class="q f" ${attrs}><label class="q__label" for="${id}">${title}</label>${inner}</div>`;
    switch (q.type) {
      case 'single':
      case 'multi':
      case 'pick': {
        const type = q.type === 'single' ? 'radio' : 'checkbox';
        return box(`<div class="q__opts">${mixed(q, q.options).map((o) => `<label class="choice choice--${type}"><input type="${type}" name="${esc(name)}" value="${o}"><span>${esc(q.options[o])}</span></label>`).join('')}</div>`);
      }
      case 'write':
      case 'short':
        return labelled(`<div class="write">${icon(q.type === 'write' ? 'fi-rr-pencil' : 'fi-rr-edit')}<input id="${id}" name="${esc(name)}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(q.placeholder || t('Antwort eingeben'))}"></div>`);
      case 'long':
        return labelled(`<textarea id="${id}" name="${esc(name)}" placeholder="${esc(q.placeholder || t('Deine Antwort'))}"></textarea><span class="f__hint">${t('Mindestens {n} Zeichen', { n: q.min })}</span>`);
      case 'links':
        return box(`<div class="links" data-links data-max="${LINKS_MAX}" data-types="${q.types.join(',')}" data-name="${esc(name)}">${linkRowHtml(q, name)}</div>
          <button class="btn-text links__add" type="button" data-link-add>${icon('fi-rr-plus')}${t('Weiteren Link hinzufügen')}</button>
          <span class="f__hint">${q.min > 1 ? t('Mindestens {n} Links', { n: q.min }) : t('Mindestens ein Link')} · ${t('bis zu {n}', { n: LINKS_MAX })}</span>`);
      case 'order': {
        const start = orderStart(q);
        return box(`<ol class="order" data-order aria-describedby="order-help">${start.map((o, i) => `<li class="order__item" data-i="${o}" tabindex="0">
            <span class="order__grip" aria-hidden="true">${icon('fi-rr-grip-dots-vertical')}</span>
            <span class="order__pos">${i + 1}</span><span class="order__text">${esc(q.items[o])}</span>
          </li>`).join('')}</ol><input type="hidden" name="${esc(name)}" value="${start.join(',')}">`);
      }
      case 'scale': {
        const mid = Math.round((q.min + q.max) / 2);
        return box(`<div class="slider" data-slider style="--a:0%;--b:${((mid - q.min) / (q.max - q.min)) * 100}%">
            <output class="slider__out" data-slider-out>${t('{a} von {b}', { a: mid, b: q.max })}</output>
            <div class="slider__track"><input type="range" name="${esc(name)}" min="${q.min}" max="${q.max}" step="1" value="${mid}" aria-label="${esc(q.q)}" data-slider-input="single"></div>
            <div class="slider__ticks" aria-hidden="true">${Array.from({ length: q.max - q.min + 1 }, (_, i) => `<span>${q.min + i}</span>`).join('')}</div>
          </div>
          <div class="scale__legend"><span>${esc(q.labels[0])}</span><span>${esc(q.labels[1])}</span></div>`);
      }
      case 'days':
        return box(`<div class="slider slider--range" data-slider style="--a:0%;--b:100%">
            <output class="slider__out" data-slider-out>${dayShort(0)} – ${dayShort(6)}</output>
            <div class="slider__track">
              <input type="range" name="dayFrom" min="0" max="6" step="1" value="0" aria-label="${esc(t('Von'))}" data-slider-input="from">
              <input type="range" name="dayTo" min="0" max="6" step="1" value="6" aria-label="${esc(t('Bis'))}" data-slider-input="to">
            </div>
            <div class="slider__ticks" aria-hidden="true">${[0, 1, 2, 3, 4, 5, 6].map((d) => `<span>${dayShort(d)}</span>`).join('')}</div>
          </div>`);
      default:
        return '';
    }
  }

  function jobCard(job) {
    return `<a class="job" href="#/karriere/${job.id}">
      <div class="job__top"><h3>${esc(t(job.title))}</h3>${jobStatus(job)}</div>
      <span class="job__team">${icon('fi-rr-users-alt')}${t('Team {name}', { name: t(job.team) })}</span>
      <p>${esc(t(job.text))}</p>
      <span class="job__more">${t('Details')} ${icon('fi-rr-arrow-small-right')}</span>
    </a>`;
  }
  function careerList() {
    const open = D.jobs.filter((x) => x.open).length;
    return `<div class="cbox">
        <h2>${t('Werde Teil <em>unseres Teams</em>')}</h2>
        <p class="lead">${t('Die <strong>Train Sim Germany</strong> Community sucht motivierte Mitglieder, die unser virtuelles Bahnnetz erweitern und verbessern. Entdecke die offenen Stellen und finde die Rolle, die zu dir passt.')}</p>
      </div>
      <div class="career-list-head"><h2>${t('Offene Stellen')}</h2><span>${t('{a} von {b} offen', { a: open, b: D.jobs.length })}</span></div>
      <div class="job-list">${D.jobs.map(jobCard).join('')}</div>`;
  }
  function careerDetail(job) {
    const app = state.applications[job.id];
    let action;
    if (app) {
      action = `<div class="note note--ok">${icon('fi-rr-check-circle')}<span>${t('Du hast dich am {date} beworben.', { date: fmtDate(app.at) })}${app.area ? ` (${esc(t('Bereich {area}', { area: app.area }))})` : ''} ${t('Wir melden uns über Discord bei <b>{name}</b>.', { name: esc(app.discord) })}</span></div>
        <button class="btn-text" type="button" data-apply-reset="${job.id}">${t('Bewerbung zurückziehen')}</button>`;
    } else if (!job.open) {
      action = `<div class="note note--bad">${icon('fi-rr-info')}<span>${t('Diese Stelle ist gerade geschlossen. Schau bald wieder vorbei oder frag auf unserem Discord nach.')}</span></div>
        <a class="btn-line btn-line--outline" href="${esc(D.links.discord)}" target="_blank" rel="noopener">${icon('fi-brands-discord')}${t('Zum Discord')}</a>`;
    } else {
      action = `<a class="btn-line" href="#/karriere/${job.id}/bewerben">${icon('fi-rr-briefcase')}${t('Jetzt bewerben')}</a>`;
    }
    const list = (items) => `<ul>${items.map((x) => `<li>${icon('fi-rr-check-circle')}<span>${esc(t(x))}</span></li>`).join('')}</ul>`;
    const areas = job.areas
      ? `<section class="checks"><h3>${icon('fi-sr-check')}${t('Bereiche')}</h3><div class="area-tags">${job.areas.map((a) => `<span style="--rc:${rankOf(a).color}"><i></i>${esc(a)}</span>`).join('')}</div></section>`
      : '';
    return `<article class="cbox">
      <div class="cbox__meta">${jobStatus(job)}<span class="job__team">${icon('fi-rr-users-alt')}${t('Team {name}', { name: t(job.team) })}</span></div>
      <h2>${t('Werde Teil des Teams als <em>{job}</em>', { job: esc(t(job.title)) })}</h2>
      <p class="lead">${esc(t(job.text))}</p>
      <hr>
      <section class="checks"><h3>${icon('fi-sr-check')}${t('Verantwortlichkeiten')}</h3>${list(job.tasks)}</section>
      <section class="checks"><h3>${icon('fi-sr-check')}${t('Anforderungen')}</h3>${list(job.needs)}</section>
      ${areas}
      <hr>
      <div class="cbox__action">${action}</div>
    </article>`;
  }
  function quizHtml(job, area) {
    if (job.areas && !area) {
      return `<div class="quiz-empty">${icon('fi-rr-arrow-small-up')}<span>${t('Wähle zuerst deinen Bereich. Danach erscheinen hier die Fragen 1 bis 40.')}</span></div>`;
    }
    return questionBlocks(sector2Items(job, area), 1);
  }
  // Bereiche bis zum eigenen Rang sind wählbar, die anderen sind ausgegraut mit Hinweis
  function areasHtml(job, rank, chosen) {
    const mine = rankIdx(rank);
    const any = job.areas.some((a) => mine >= rankIdx(a));
    return `<div class="areas">${job.areas.map((a) => {
      const ok = mine >= rankIdx(a);
      const covers = a === 'Signaller' ? t('Signaller + alle Driver-Fragen') : t('{area} + Bahnbetrieb allgemein', { area: a });
      return `<label class="area${ok ? '' : ' is-locked'}" style="--rc:${rankOf(a).color}"${ok ? '' : ` title="${esc(t('Du brauchst mindestens den Rang {rank}.', { rank: a }))}"`}>
          ${ok ? '' : `<span class="area__lock">${icon('fi-rr-info')}${t('Ab Rang {rank}', { rank: esc(a) })}</span>`}
          <input type="radio" name="area" value="${esc(a)}"${ok ? '' : ' disabled'}${ok && a === chosen ? ' checked' : ''}>
          <span class="area__body"><b>${esc(a)}</b><small>${t('Fragen: {list}', { list: esc(covers) })}</small></span>
        </label>`;
    }).join('')}</div>
      <span class="f__hint">${any
        ? t('Du kannst dich für jeden Bereich bis zu deinem Rang bewerben (gerade: <b>{rank}</b>).', { rank: esc(rank) })
        : t('Für den Supervisor brauchst du mindestens den Rang Driver.')}</span>`;
  }
  function sectorHead(i) {
    const s = SECTORS[i];
    return `<header class="sector__head"><span class="sector__no" aria-hidden="true">${i + 1}</span><small>${t('Sektor {n}', { n: i + 1 })}</small><h3 id="sector-${i + 1}">${t(s.title)}</h3></header>
      <p class="sector__text">${t(s.text)}</p>`;
  }
  function careerApply(job) {
    const rankOpts = RANKS.filter((r) => r.name !== 'Management')
      .map((r) => `<option value="${esc(r.name)}"${r.name === state.rank ? ' selected' : ''}>${esc(r.name)} · ${esc(t(r.label))}</option>`).join('');
    const areaPicker = job.areas ? `<fieldset class="f" ${dataField('area')}>
        <legend class="f__label">${t('In welchem Bereich möchtest du Trainings leiten?')}</legend>
        <div class="area-picker" data-areas>${areasHtml(job, state.rank, null)}</div>
      </fieldset>` : '';
    return `<div class="cbox">
        <h2>${t('Bewerbung als <em>{job}</em>', { job: esc(t(job.title)) })}</h2>
        <p class="lead">${t('{n} Fragen in drei Sektoren. Plane etwa 30 Minuten ein.', { n: QUESTIONS_TOTAL })}</p>
        <ol class="sector-steps">${SECTORS.map((s, i) => `<li><button type="button" data-sector-jump="${i + 1}"><span class="sector-steps__no">${i + 1}</span><span class="sector-steps__label">${t(s.title)}</span></button></li>`).join('')}</ol>
        <div class="apply-progress" data-apply-progress><span><b data-progress-n>0</b> ${t('von {n} Fragen beantwortet', { n: QUESTIONS_TOTAL })}</span><i><span data-progress-bar></span></i></div>
      </div>
      <p class="sr-only" id="order-help">${t('Zum Umsortieren einen Eintrag auswählen und mit den Pfeiltasten nach oben oder unten verschieben.')}</p>
      <form class="apply" data-apply="${job.id}" novalidate>
        <section class="cbox sector" data-sector="1" aria-labelledby="sector-1">
          ${sectorHead(0)}
          <div class="f" ${dataField('roblox')}><label class="f__label" for="ap-roblox">${t('Roblox-Benutzername')}</label><input id="ap-roblox" name="roblox" autocomplete="username" value="${esc(state.profile ? state.profile.username : D.me.username)}" placeholder="${esc(t('Dein Roblox-Benutzername'))}"></div>
          <div class="f" ${dataField('discord')}><label class="f__label" for="ap-discord">${t('Discord-Benutzername')}</label><input id="ap-discord" name="discord" autocomplete="off" placeholder="${esc(t('z. B. lokfuehrer_max'))}"></div>
          <div class="f" ${dataField('email')}><label class="f__label" for="ap-email">${t('E-Mail-Adresse')}</label><input id="ap-email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="${esc(t('name@beispiel.de'))}"></div>
          <div class="f" ${dataField('since')}><label class="f__label" for="ap-since">${t('Du spielst seit')}</label><div class="select"><select id="ap-since" name="since"><option value="">${t('Bitte wählen')}</option>${SINCE.map((x) => `<option value="${esc(x)}">${esc(t(x))}</option>`).join('')}</select>${icon('fi-rr-angle-small-down')}</div></div>
          <div class="f" ${dataField('rank')}><label class="f__label" for="ap-rank">${t('Dein aktueller Rang')}</label><div class="select"><select id="ap-rank" name="rank">${rankOpts}</select>${icon('fi-rr-angle-small-down')}</div></div>
        </section>

        <section class="cbox sector" data-sector="2" aria-labelledby="sector-2">
          ${sectorHead(1)}
          ${areaPicker}
          <div class="quiz" data-quiz>${quizHtml(job, null)}</div>
        </section>

        <section class="cbox sector" data-sector="3" aria-labelledby="sector-3">
          ${sectorHead(2)}
          <div class="quiz">${questionBlocks(sector3Items(job), 41)}</div>
          <div class="f" ${dataField('confirm')}><label class="confirm"><input type="checkbox" name="confirm"><span>${t('Ich habe alle Angaben ehrlich gemacht und kenne die Regeln von Train Sim Germany.')}</span></label></div>
          <button class="btn-line" type="submit">${t('Bewerbung senden')} ${icon('fi-rr-paper-plane')}</button>
          <p class="f__note">${t('Demo: Die Bewerbung wird noch nicht verschickt, sondern nur auf diesem Gerät gespeichert.')}</p>
        </section>
      </form>`;
  }
  function careerDone(job, app) {
    const rows = [[t('Stelle'), t(job.title)], ...(app.area ? [[t('Bereich'), app.area]] : []), [t('Rang'), app.rank], ['Discord', app.discord],
      ...(app.email ? [[t('E-Mail'), app.email]] : []), [t('Fragen'), t('{n} beantwortet', { n: app.count || QUESTIONS_TOTAL })], [t('Gesendet'), fmtDate(app.at)]];
    return `<div class="cbox done">
      <span class="done__ic">${icon('fi-rr-check')}</span>
      <h2>${t('Bewerbung <em>gesendet</em>')}</h2>
      <p class="lead">${t('Danke, {name}! Wir schauen uns deine Bewerbung an und melden uns innerhalb von 7 Tagen über Discord.', { name: esc(app.roblox) })}</p>
      <dl class="done__list">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <a class="btn-line btn-line--outline" href="#/karriere">${icon('fi-rr-arrow-left')}${t('Zurück zu den Jobs')}</a>
      <button class="btn-text" type="button" data-apply-reset="${job.id}">${t('Bewerbung zurückziehen')}</button>
    </div>`;
  }
  function renderCareer() {
    const job = D.jobs.find((x) => x.id === state.jobId);
    if (job && state.jobApply && !job.open && !state.applications[job.id]) state.jobApply = false;
    const el = $('[data-career]');
    if (!job) el.innerHTML = careerList();
    else if (!state.jobApply) el.innerHTML = careerDetail(job);
    else if (state.applications[job.id]) el.innerHTML = careerDone(job, state.applications[job.id]);
    else if (!questionsReady()) {
      el.innerHTML = `<div class="cbox"><p class="lead">${t('Die Fragen werden geladen …')}</p></div>`;
      loadQuestions()
        .then(() => { if (state.jobApply && state.jobId === job.id && questionsReady()) renderCareer(); })
        .catch(() => { el.innerHTML = `<div class="cbox"><p class="lead">${t('Die Fragen konnten nicht geladen werden. Prüfe deine Verbindung und lade die Seite neu.')}</p></div>`; });
    } else {
      state.quizAnswers = {};
      el.innerHTML = careerApply(job);
      updateSectors($('form[data-apply]', el));
    }
  }

  // Prüft alle Felder; liefert { feld: Meldung }
  function applyErrors(form) {
    const job = D.jobs.find((x) => x.id === form.dataset.apply);
    const f = form.elements;
    const val = (name) => (f[name] ? f[name].value.trim() : '');
    const errors = {};
    if (!/^[A-Za-z0-9_]{3,20}$/.test(val('roblox'))) errors.roblox = t('Bitte gib einen gültigen Roblox-Namen ein (3–20 Zeichen: Buchstaben, Zahlen, _).');
    if (!/^([a-z0-9_.]{2,32}|.{2,32}#\d{4})$/i.test(val('discord'))) errors.discord = t('Bitte gib deinen Discord-Namen ein, z. B. lokfuehrer_max.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email'))) errors.email = t('Bitte gib eine gültige E-Mail-Adresse ein, z. B. name@beispiel.de.');
    if (!val('since')) errors.since = t('Bitte wähle aus, seit wann du spielst.');
    if (job.areas && !form.querySelector('input[name="area"]:checked')) {
      errors.area = job.areas.some((a) => rankIdx(val('rank')) >= rankIdx(a)) ? t('Bitte wähle einen Bereich.') : t('Für den Supervisor brauchst du mindestens den Rang Driver.');
    }
    $$('[data-q]', form).forEach((q) => {
      const type = q.dataset.q;
      const key = q.dataset.field;
      if (type === 'single' && !$('input:checked', q)) errors[key] = t('Bitte wähle eine Antwort.');
      else if ((type === 'multi' || type === 'pick') && !$('input:checked', q)) errors[key] = t('Bitte wähle mindestens eine Antwort.');
      else if ((type === 'write' || type === 'short') && !$('input', q).value.trim()) errors[key] = t('Bitte gib eine Antwort ein.');
      else if (type === 'long' && $('textarea', q).value.trim().length < +q.dataset.min) errors[key] = t('Bitte schreib etwas mehr, mindestens {n} Zeichen.', { n: q.dataset.min });
      else if (type === 'order' && !$('[data-order]', q).dataset.touched) errors[key] = t('Bitte bring die Einträge in die richtige Reihenfolge.');
      else if (type === 'links') { const er = linksError(q); if (er) errors[key] = er; }
    });
    if (!f.confirm.checked) errors.confirm = t('Bitte bestätige deine Angaben.');
    return errors;
  }
  // Links: jeder ausgefüllte Link braucht eine Art und muss zur Plattform passen
  function readLinks(box) {
    return $$('.link-row', box).map((row) => ({ type: $('select', row).value, url: $('input', row).value.trim() })).filter((x) => x.url || x.type);
  }
  function linksError(box) {
    const links = readLinks(box);
    for (const l of links) {
      if (!l.url) return t('Bitte gib zu jeder gewählten Art auch den Link ein.');
      if (!l.type) return t('Bitte wähle bei jedem Link aus, was es ist.');
      let host;
      try { const u = new URL(l.url); if (!/^https?:$/.test(u.protocol)) throw new Error(); host = u.hostname.replace(/^www\./, ''); } catch (e) {
        return t('Bitte gib einen gültigen Link ein (beginnt mit https://).');
      }
      const hosts = LINK_TYPES[l.type].hosts;
      if (hosts.length && !hosts.some((h) => host === h || host.endsWith(`.${h}`))) return t('Der Link passt nicht zu „{type}“.', { type: t(LINK_TYPES[l.type].label) });
    }
    const min = +box.dataset.min || 1;
    if (links.length < min) return min > 1 ? t('Bitte gib mindestens {n} Links an.', { n: min }) : t('Bitte gib mindestens einen Link an.');
    return '';
  }
  // Fortschritt der drei Sektoren und Zähler „x von 60 beantwortet“ (ohne Fehlermeldungen anzuzeigen)
  function updateSectors(form) {
    const errors = applyErrors(form);
    const answered = $$('[data-q]', form).filter((q) => !(q.dataset.field in errors)).length;
    const n = $('[data-progress-n]');
    if (n) {
      n.textContent = answered;
      $('[data-progress-bar]').style.width = `${(answered / QUESTIONS_TOTAL) * 100}%`;
      $('[data-apply-progress]').classList.toggle('is-done', answered >= QUESTIONS_TOTAL);
    }
    [1, 2, 3].forEach((n) => {
      const sec = $(`[data-sector="${n}"]`, form);
      const done = !Object.keys(errors).some((k) => $(`[data-field="${CSS.escape(k)}"]`, sec));
      const step = $(`[data-sector-jump="${n}"]`);
      if (step) step.classList.toggle('is-done', done);
    });
  }
  function showFieldError(field, msg, id) {
    field.classList.add('has-error');
    field.insertAdjacentHTML('beforeend', `<span class="f__error" id="${id}">${icon('fi-rr-info')}${esc(msg)}</span>`);
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
  // Sektor 2 neu zeigen; Antworten auf Fragen, die erhalten bleiben, werden übernommen
  function showQuiz(form, job, area) {
    const quiz = $('[data-quiz]', form);
    $$('[data-order]', quiz).forEach((list) => { if (list.dataset.touched) state.quizAnswers[`${list.nextElementSibling.name}#moved`] = true; });
    $$('input, textarea', quiz).forEach((x) => {
      if (x.type === 'radio' || x.type === 'checkbox') { if (x.checked) state.quizAnswers[`${x.name}=${x.value}`] = true; else delete state.quizAnswers[`${x.name}=${x.value}`]; }
      else state.quizAnswers[x.name] = x.value;
    });
    quiz.innerHTML = quizHtml(job, area);
    $$('input, textarea', quiz).forEach((x) => {
      if (x.type === 'radio' || x.type === 'checkbox') x.checked = !!state.quizAnswers[`${x.name}=${x.value}`];
      else if (x.name in state.quizAnswers) x.value = state.quizAnswers[x.name];
    });
    $$('[data-order]', quiz).forEach((list) => {
      list.nextElementSibling.value.split(',').forEach((i) => list.append($(`[data-i="${i}"]`, list)));
      orderSync(list, !!state.quizAnswers[`${list.nextElementSibling.name}#moved`]);
    });
    $$('[data-slider]', quiz).forEach(updateSlider);
  }
  function orderSync(list, moved = true) {
    const items = $$('.order__item', list);
    items.forEach((li, i) => { $('.order__pos', li).textContent = i + 1; });
    list.nextElementSibling.value = items.map((li) => li.dataset.i).join(',');
    if (moved) list.dataset.touched = '1';
    const form = list.closest('form[data-apply]');
    if (form) {
      const field = list.closest('.f.has-error');
      if (field && moved) clearFieldError(field);
      updateSectors(form);
    }
  }

  // Antworten auslesen und bewerten (Auswahl, Mehrfachauswahl, Schreib- und Schiebeaufgaben)
  function readAnswer(form, q) {
    const name = `q:${q.key}`;
    const picked = () => $$('input:checked', form).filter((x) => x.name === name).map((x) => +x.value);
    if (q.type === 'single') return picked()[0] ?? null;
    if (q.type === 'multi' || q.type === 'pick') return picked().sort((a, b) => a - b);
    if (q.type === 'links') return readLinks($(`[data-field="${CSS.escape(name)}"]`, form));
    const el = form.elements.namedItem(name);
    if (q.type === 'order') return el.value.split(',').map(Number);
    if (q.type === 'scale') return +el.value;
    return el.value.trim();
  }
  // Vergleich ohne Groß/Klein, Akzente, Leer- und Satzzeichen („Hp 0“ = „hp0“, „Désescalade“ = „desescalade“)
  const normAnswer = (x) => norm(String(x)).replace(/×/g, 'x').replace(/[\s.,;:!?„“”«»"'’()-]/g, '');
  function isRight(q, v) {
    if (q.type === 'single') return v === 0;
    if (q.type === 'multi') return v.length === q.correct.length && q.correct.every((c) => v.includes(c));
    if (q.type === 'write') return q.answers.some((a) => normAnswer(a) === normAnswer(v));
    if (q.type === 'order') return v.every((x, i) => x === i);
    return null; // Selbsteinschätzung und freie Texte werden nicht bewertet
  }
  function submitApplication(form) {
    const id = form.dataset.apply;
    const errors = applyErrors(form);
    $$('.f.has-error', form).forEach(clearFieldError);
    Object.entries(errors).forEach(([name, msg], i) => showFieldError($(`[data-field="${CSS.escape(name)}"]`, form), msg, `err-${i}`));
    const first = Object.keys(errors)[0];
    if (first) {
      const field = $(`[data-field="${CSS.escape(first)}"]`, form);
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('input, select, textarea', field).focus({ preventScroll: true });
      return;
    }
    const data = new FormData(form);
    const job = D.jobs.find((x) => x.id === id);
    const area = data.get('area');
    const answers = {};
    let score = 0;
    let total = 0;
    const questions = applyQuestions(job, area);
    questions.filter((q) => !isFixed(q)).forEach((q) => {
      const v = readAnswer(form, q);
      answers[q.key] = v;
      const ok = isRight(q, v);
      if (ok !== null) { total += 1; if (ok) score += 1; }
    });
    state.applications[id] = {
      roblox: data.get('roblox').trim(), discord: data.get('discord').trim(), email: data.get('email').trim(),
      since: data.get('since'), rank: data.get('rank'), area: area || null,
      answers, score, total, count: questions.length,
      experience: data.get('experience').trim(), activity: +data.get('activity'), days: [0, 1, 2, 3, 4, 5, 6].slice(+data.get('dayFrom'), +data.get('dayTo') + 1).map(dayShort),
      at: Date.now(),
    };
    store.set('tsg-applications', state.applications);
    toast(t('Bewerbung gesendet'));
    renderCareer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Schieberegler (Aktivität 1–10, Tage von–bis)
  function updateSlider(box) {
    const inputs = $$('[data-slider-input]', box);
    const out = $('[data-slider-out]', box);
    if (inputs.length === 1) {
      const el = inputs[0];
      box.style.setProperty('--b', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
      out.textContent = t('{a} von {b}', { a: el.value, b: el.max });
      return;
    }
    const [from, to] = inputs;
    if (+from.value > +to.value) {
      if (document.activeElement === from) from.value = to.value; else to.value = from.value;
    }
    const max = +from.max;
    box.style.setProperty('--a', `${(from.value / max) * 100}%`);
    box.style.setProperty('--b', `${(to.value / max) * 100}%`);
    // Liegen beide Griffe ganz rechts, muss „von“ oben liegen, sonst lässt er sich nicht mehr greifen
    from.style.zIndex = +from.value >= max ? 3 : '';
    out.textContent = from.value === to.value ? dayShort(+from.value) : `${dayShort(+from.value)} – ${dayShort(+to.value)}`;
  }

  // Eigene Statistik (Demo: aus dem Namen abgeleitet, damit sie stabil bleibt)
  function myStats() {
    const name = state.profile ? state.profile.username : D.me.username;
    const rnd = (key, min, max) => min + (hash(name + key) % (max - min + 1));
    const now = berlinNow();
    const monday = now.day - ((dateOf(now.day).getUTCDay() + 6) % 7);
    const week = Array.from({ length: 7 }, (_, i) => {
      const day = monday + i;
      return { label: wdShort(day), today: day === now.day, min: day > now.day ? 0 : rnd(`w${i}`, 0, 170) };
    });
    // Fahrten auf Züge und Strecken verteilen (Summe bleibt gleich), meistgefahren zuerst
    const split = (total, labels, key) => {
      const w = labels.map((_, i) => (4 + (hash(name + key + i) % 97)) ** 2);
      const sum = w.reduce((a, b) => a + b, 0);
      const rows = labels.map((label, i) => ({ label, i, value: Math.floor((total * w[i]) / sum) }));
      rows[0].value += total - rows.reduce((a, d) => a + d.value, 0);
      return rows.sort((a, b) => b.value - a.value);
    };
    const trips = rnd('trips', 120, 1600);
    const share = split(trips, ['fern', 'regio', 'sbahn'], 'cat');
    const part = (k) => share.find((d) => d.label === k).value;
    const groups = [
      { key: 'fern', title: t('Fernverkehr'), cat: 'ice' },
      { key: 'regio', title: t('Regio'), cat: 're' },
      { key: 'sbahn', title: t('S-Bahn'), cat: 's' },
    ].map((g) => ({ ...g, total: part(g.key), rows: split(part(g.key), D.fleet[g.key], g.key) }));
    const routes = split(trips, D.routes.map((r) => r.no), 'route').map((d) => ({ route: D.routes[d.i], value: d.value }));
    const fav = routes[0].route;
    return {
      week,
      groups,
      routes,
      trips,
      tiles: [
        { ic: 'fi-rr-star', label: t('Level'), value: fmt(state.profile ? rnd('lvl', 4, 60) : D.me.level) },
        { ic: 'fi-rr-train-side', label: t('Kilometer'), value: fmt(rnd('km', 900, 32000)) },
        { ic: 'fi-rr-route', label: t('Fahrten'), value: fmt(trips) },
        { ic: 'fi-rr-clock-three', label: t('Pünktlichkeit'), value: pct(rnd('punct', 860, 992) / 10, 1) },
        { ic: 'fi-rr-calendar', label: t('Trainings'), value: t('{n} bestanden', { n: fmt(Math.max(0, rankIdx(state.rank))) }) },
        { ic: 'fi-rr-time-fast', label: t('Spielzeit'), value: t('{n} Std.', { n: fmt(rnd('hours', 12, 640)) }) },
        { ic: 'fi-rr-trophy', label: t('Bestenliste'), value: t('Platz {n}', { n: fmt(rnd('place', 18, 2400)) }) },
        { ic: 'fi-rr-user-add', label: t('Dabei seit'), value: dtf({ month: 'short', year: 'numeric' }).format(new Date(Date.UTC(rnd('year', 2023, 2025), rnd('mon', 0, 11), 1))) },
        { ic: 'fi-rr-heart', label: t('Lieblingsstrecke'), value: `${routeNo(fav)}${esc(t(fav.title))}`, wide: true },
      ],
    };
  }

  // ---------- Einstellungen ----------
  const themeMode = () => document.documentElement.getAttribute('data-theme') || 'system';
  function setTheme(mode) {
    try {
      if (mode === 'system') localStorage.removeItem('tsg-theme'); else localStorage.setItem('tsg-theme', mode);
    } catch (e) { /* Speicher nicht verfügbar */ }
    if (mode === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);
    renderSettings();
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
    if (!start) store.set('tsg-lang', setting);
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
    document.title = t(TITLES[state.page]);
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
  function renderLangPicker() {
    const box = $('[data-lang-picker]');
    if (!box) return;
    const setting = langSetting();
    const row = (code, flagHtml, name, sub) => `<button type="button" data-lang-set="${code}" aria-pressed="${setting === code}">
        ${flagHtml}<span class="lang-picker__text"><b>${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
    box.innerHTML = row('auto', `<span class="flag flag--auto">${icon('fi-rr-smartphone')}</span>`, t('Automatisch'),
      t('Wie dein Gerät – gerade: {name}', { name: langOf(deviceLang()).name }))
      + LANGS.map((l) => row(l.code, `<img class="flag" src="assets/img/flags/${l.flag}.svg" alt="" width="32" height="24">`, l.name,
        l.code === lang ? '' : langName(l.code))).join('');
  }
  function renderSettings() {
    renderLangPicker();
    $$('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === themeMode())));
    const p = state.profile;
    const r = rankOf(state.rank);
    $('[data-settings-account]').innerHTML = `${ringHTML(p, r, 'avatar-ring--lg')}
      <div class="set-account__who"><b>${p ? esc(p.displayName || p.username) : t('Nicht verbunden')}</b><small>${p ? `@${esc(p.username)}` : t('Verbinde dein Roblox-Konto für Name und Profilbild.')}</small></div>
      <button class="btn ${p ? 'btn--soft' : 'btn--primary'}" type="button" data-open="profile">${p ? t('Profil') : t('Verbinden')}</button>`;
  }

  // ---------- Profil (Kopfzeile, Tab-Leiste, Menü) ----------
  function avatarInner(p) {
    if (p && p.avatar) return `<img src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer">`;
    if (p) return `<b>${esc(initials(p.username))}</b>`;
    return icon('fi-sr-user');
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
    $$('.tabbar__me').forEach((b) => b.setAttribute('aria-label', t('Profil')));
    $('[data-drawer-me]').innerHTML = `${ringHTML(p, r, 'avatar-ring--lg')}
      <span class="drawer__who"><b>${p ? esc(p.displayName || p.username) : t('Gast')}</b><small>${p ? `@${esc(p.username)}` : t('Mit Roblox verbinden')}</small></span>
      ${rankPill(r)}`;
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

  // ---------- Auswahl-Sheets ----------
  const modal = $('[data-modal]');
  let modalView = null;
  const VIEWS = {
    profile: {
      title: () => t('Profil'),
      render: () => {
        const p = state.profile;
        const r = rankOf(state.rank);
        if (!p) {
          return `<div class="profile-box">
              ${ringHTML(null, r, 'avatar-ring--xl')}
              <h3>${t('Mit Roblox verbinden')}</h3>
              <p>${t('Dein Roblox-Name und dein Profilbild erscheinen dann oben in der Kopfzeile, unten in der Leiste und im Menü.')}</p>
            </div>
            <form class="connect" data-connect novalidate>
              <div class="f"><label class="f__label" for="rbx-name">${t('Roblox-Benutzername')}</label><input id="rbx-name" name="username" autocomplete="username" placeholder="${esc(t('z. B. {name}', { name: D.me.username }))}"></div>
              <button class="btn btn--primary btn--lg btn--block" type="submit">${icon('fi-rr-link-alt')}${t('Verbinden')}</button>
              <p class="sheet-note">${t('Es wird nur dein öffentliches Roblox-Profil geladen – kein Passwort, kein Login.')}</p>
            </form>`;
        }
        return `<div class="profile-box">
            ${ringHTML(p, r, 'avatar-ring--xl')}
            <h3>${esc(p.displayName || p.username)}</h3>
            <p>@${esc(p.username)}</p>
            <button class="rank-pill rank-pill--btn" type="button" data-open="rank" style="--rc:${r.color}">[${esc(r.prefix)}] ${esc(r.name)}${icon('fi-rr-angle-small-down')}</button>
          </div>
          <div class="sheet-actions">
            <button class="btn btn--primary btn--lg btn--block" type="button" data-open="stats">${icon('fi-rr-chart-line-up')}${t('Meine Statistik')}</button>
            ${p.userId ? `<a class="btn btn--outline btn--lg btn--block" href="https://www.roblox.com/users/${encodeURIComponent(p.userId)}/profile" target="_blank" rel="noopener">${icon('fi-rr-arrow-up-right-from-square')}${t('Roblox-Profil ansehen')}</a>` : ''}
            <button class="btn btn--soft btn--lg btn--block" type="button" data-disconnect>${t('Verbindung trennen')}</button>
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
            <ol class="rank-list rank-list--compact">${routeList(st.routes, st.routes[0].value)}</ol>
          </section>
          <h4 class="mystats__title">${t('Diese Woche gespielt')}</h4>
          <div class="week-bars">${st.week.map((d) => `<div class="week-bars__col${d.today ? ' is-today' : ''}"><span class="week-bars__val">${d.min ? `${nf1.format(Math.round(d.min / 6) / 10)} h` : '–'}</span><span class="week-bars__bar"><i style="height:${Math.max(4, (d.min / max) * 100)}%"></i></span><span class="week-bars__day">${d.label}</span></div>`).join('')}</div>
          <p class="sheet-note">${t('Demo-Werte – später kommen sie direkt aus dem Spiel.')}</p>
          <div class="sheet-actions"><button class="btn btn--soft btn--lg btn--block" type="button" data-open="profile">${icon('fi-rr-arrow-left')}${t('Zurück zum Profil')}</button></div>
        </div>`;
      },
    },
    rank: {
      title: () => t('Dein Rang'),
      render: () => `<div class="opt-list" role="radiogroup" aria-label="${esc(t('Rang wählen'))}">${RANKS.filter((r) => r.name !== 'Management').map((r) => `
        <button class="opt" type="button" role="radio" aria-checked="${r.name === state.rank}" data-rank="${r.name}">
          ${rankPill(r)}<span><b>${esc(r.name)}</b><small>${esc(t(r.label))} · ${esc(t(r.desc))}</small></span>
          ${r.name === state.rank ? icon('fi-rr-check') : ''}
        </button>`).join('')}</div>
        <p class="sheet-note">${t('Demo: Später wird dein Rang automatisch aus der Roblox-Gruppe übernommen.')}</p>`,
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
    news: {
      title: () => t('Neuigkeit'),
      hero: true,
      render: (i) => {
        const n = D.news[+i];
        return `<div class="detail">
          ${mediaHtml(n)}
          <div class="detail__top"><span class="cat-tag cat-tag--${n.cat}">${esc(t(n.tag))}</span><span class="tag">${newsDate(n)}</span></div>
          <h3>${esc(t(n.title))}</h3>
          <p>${esc(t(n.text))}</p>
          <div class="btn-stack"><a class="btn btn--discord btn--block btn--lg" href="${esc(D.links.discord)}" target="_blank" rel="noopener">${icon('fi-brands-discord')}${t('Auf Discord diskutieren')}</a></div>
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
          ? `<a class="btn btn--join btn--lg btn--block" href="${esc(D.links.play)}" target="_blank" rel="noopener">${icon('fi-sr-play')}Join Now</a>`
          : `<button class="btn btn--join btn--lg btn--block" type="button" disabled>${icon(locked ? 'fi-rr-lock' : 'fi-sr-play')}Join Now</button>`;
        const hint = locked ? '' : ss.open ? t('Der Trainingsserver ist offen – du kannst jetzt beitreten.') : t('Der Trainingsserver öffnet {n} Minuten vor Beginn.', { n: SERVER_OPENS });
        return `<div class="detail">
          <div class="detail__media"><img src="assets/img/${tn.img}" alt=""></div>
          <div class="detail__top">${roleBadge(tn.type)}${serverPill(tn)}<span class="tag">${relTime(tn.start)}</span></div>
          <h3>${esc(t(tn.title))}</h3>
          <p>${esc(type ? t(type.text) : '')}</p>
          <dl>
            <div><dt>${icon('fi-rr-calendar')}${t('Datum')}</dt><dd>${dayName(tn.day, { long: true })}</dd></div>
            <div><dt>${icon('fi-rr-clock-three')}${t('Uhrzeit')}</dt><dd>${t('{time} Uhr', { time: `${tn.time} – ${hhmm(tn.end)}` })}</dd></div>
            <div><dt>${icon('fi-rr-database')}${t('Server')}</dt><dd>${esc(t(tn.server))}</dd></div>
            <div><dt>${icon('fi-rr-users-alt')}${t('Leitung')}</dt><dd>${esc(tn.host)}</dd></div>
          </dl>
          <div class="occ">
            <div class="occ__row"><span class="status status--${st.level}">${st.text}</span><b>${t('{a}/{b} Plätze', { a: tn.taken, b: tn.slots })}</b></div>
            <div class="bar bar--${st.level}"><span style="width:${(tn.taken / tn.slots) * 100}%"></span></div>
          </div>
          ${locked ? `<div class="lock">${icon('fi-rr-lock')}<span>${t('Für dieses Training brauchst du mindestens den Rang {rank}. Dein Rang: {mine}.', { rank: esc(tn.req), mine: esc(state.rank) })}</span></div>` : ''}
          ${action}
          ${hint ? `<p class="sheet-note join-hint">${hint}</p>` : ''}
        </div>`;
      },
    },
  };
  // Bild oder Video oben in der Detailansicht. video: YouTube-Link oder eigene Datei (assets/video/…)
  const youtubeId = (url) => {
    const m = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
    return m ? m[1] : null;
  };
  function mediaHtml(n) {
    if (!n.video) return `<div class="detail__media"><img src="assets/img/${n.img}" alt=""></div>`;
    const yt = youtubeId(n.video);
    if (yt) {
      // Erst nach dem Antippen laden (Datenschutz): Vorschaubild mit Play-Knopf
      return `<div class="detail__media detail__media--video"><button class="video-start" type="button" data-youtube="${yt}" aria-label="${esc(t('Video abspielen'))}">
          <img src="https://i.ytimg.com/vi/${yt}/hqdefault.jpg" alt="" referrerpolicy="no-referrer"><span class="video-start__btn">${icon('fi-sr-play')}</span></button></div>`;
    }
    return `<div class="detail__media detail__media--video"><video src="${esc(n.video)}" poster="${esc(n.poster || `assets/img/${n.img}`)}" controls playsinline preload="metadata"></video></div>`;
  }
  function openModal(name, arg) {
    closeMenu();
    modalView = { name, arg };
    const title = VIEWS[name].title;
    $('[data-modal-title]').textContent = typeof title === 'function' ? title(arg) : title;
    $('[data-modal-body]').innerHTML = VIEWS[name].render(arg);
    // Ansichten mit Bild/Video: Inhalt beginnt oben in der Rundung, Griff und Schließen liegen darüber
    $('.sheet-modal__panel', modal).classList.toggle('is-hero', !!VIEWS[name].hero);
    $('.sheet-modal__panel', modal).scrollTop = 0;
    modal.hidden = false;
    document.body.classList.add('menu-open');
    const focusable = $('[data-modal-body] input', modal) || $('[data-modal-body] button:not([disabled])', modal) || $('[data-modal-close]', modal);
    focusable.focus({ preventScroll: true });
  }
  function refreshModal() {
    if (modal.hidden || !modalView) return;
    const title = VIEWS[modalView.name].title;
    $('[data-modal-title]').textContent = typeof title === 'function' ? title(modalView.arg) : title;
    // Laufendes Video nicht neu laden
    if (!$('[data-modal-body] video, [data-modal-body] iframe')) $('[data-modal-body]').innerHTML = VIEWS[modalView.name].render(modalView.arg);
  }
  function closeModal() {
    if (modal.hidden) return;
    $$('[data-modal-body] video', modal).forEach((v) => v.pause());
    $('[data-modal-body]').innerHTML = '';
    modal.hidden = true;
    modalView = null;
    document.body.classList.remove('menu-open');
  }

  function toggleBell() {
    state.bell = !state.bell;
    store.set('tsg-bell', state.bell);
    $$('[data-bell]').forEach((b) => b.setAttribute('aria-pressed', String(state.bell)));
    const next = nextRank(state.rank);
    toast(state.bell ? (next ? t('Erinnerungen an – wir melden uns vor {type}-Trainings', { type: next.name }) : t('Erinnerungen an')) : t('Erinnerungen aus'));
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
  const PAGES = ['home', 'trainings', 'news', 'server', 'karriere', 'statistiken', 'einstellungen'];
  const TITLES = {
    home: 'Train Sim Germany – Das Bahnerlebnis auf Roblox',
    news: 'Neuigkeiten · Train Sim Germany',
    karriere: 'Karriere · Train Sim Germany',
    trainings: 'Trainings · Train Sim Germany',
    server: 'Server · Train Sim Germany',
    statistiken: 'Statistiken · Train Sim Germany',
    einstellungen: 'Einstellungen · Train Sim Germany',
  };
  const RENDER = {
    home() {
      renderRoles(); renderNextSteps(); renderRoutes(); renderHomeKpis(); renderNews();
      $('[data-open-jobs]').textContent = D.jobs.filter((x) => x.open).length;
    },
    news() { renderNewsPage(); },
    karriere() { renderCareer(); },
    trainings() { renderTrainings(); },
    server() { $('[data-server-search]').value = state.serverQuery; renderServers(); },
    statistiken() { renderStatsKpis(); renderChart(); renderBars(); },
    einstellungen() { renderSettings(); },
  };

  function route() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path] = raw.split('?');
    const [first, sub, sub2] = path.split('/');
    const page = PAGES.includes(first) ? first : 'home';
    const jobId = page === 'karriere' ? (sub || null) : null;
    const jobApply = !!jobId && sub2 === 'bewerben';
    const changed = page !== state.page || jobId !== state.jobId || jobApply !== state.jobApply;
    state.page = page;
    state.jobId = jobId;
    state.jobApply = jobApply;
    document.body.dataset.page = page;

    $$('.page').forEach((p) => { p.hidden = p.dataset.page !== page; });
    $$('[data-nav]').forEach((a) => {
      if (a.dataset.nav === page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = t(TITLES[page]);
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

  // ---------- Events ----------
  function events() {
    $$('[data-link]').forEach((a) => { if (D.links[a.dataset.link]) a.href = D.links[a.dataset.link]; });
    $$('[data-me-name]').forEach((el) => { el.textContent = D.me.name; });

    $('.skip-link').addEventListener('click', (e) => { e.preventDefault(); $('#main').focus(); });

    $$('[data-menu-open]').forEach((b) => b.addEventListener('click', openMenu));
    $$('[data-menu-close]').forEach((b) => b.addEventListener('click', closeMenu));
    $$('[data-modal-close]').forEach((b) => b.addEventListener('click', closeModal));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenu(); closeModal(); } });


    const topbar = $('[data-topbar]');
    const onScroll = () => topbar.classList.toggle('is-scrolled', window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Klicks, die überall vorkommen (Seiten und Sheets)
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-open], [data-detail], [data-bell], [data-day], [data-pick-day], [data-rank], [data-fav], [data-theme-set], [data-lang-set]');
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
        state.trainingDay = null;
        closeModal();
        renderTrainings();
        renderMe();
        const next = nextRank(ds.rank);
        toast(next ? t('Rang: {rank} – als Nächstes {next}', { rank: ds.rank, next: next.name }) : t('Rang: {rank}', { rank: ds.rank }));
      } else if (ds.themeSet) setTheme(ds.themeSet);
      else if (ds.langSet) setLanguage(ds.langSet).then(() => toast(t('Sprache: {name}', { name: ds.langSet === 'auto' ? `${t('Automatisch')} (${langOf(lang).name})` : langOf(lang).name })));
      else if (ds.fav) {
        const name = ds.fav;
        if (state.favs.has(name)) state.favs.delete(name); else state.favs.add(name);
        store.set('tsg-favs', Array.from(state.favs));
        el.setAttribute('aria-pressed', String(state.favs.has(name)));
        toast(state.favs.has(name) ? t('{name} gemerkt', { name: t(name) }) : t('{name} entfernt', { name: t(name) }));
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
      const el = e.target.closest('[data-news-cat], [data-news-open], [data-apply-reset], [data-sector-jump]');
      if (!el) return;
      const ds = el.dataset;
      if (ds.newsCat) {
        state.newsCat = ds.newsCat;
        renderNewsPage();
      } else if (ds.newsOpen) openModal('news', ds.newsOpen);
      else if (ds.sectorJump) $(`[data-sector="${ds.sectorJump}"]`).scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      const slider = target.closest('[data-slider]');
      if (slider) updateSlider(slider);
      const form = target.closest('form[data-apply]');
      if (form) {
        const field = target.closest('.f.has-error');
        if (field) clearFieldError(field);
        updateSectors(form);
      }
    });
    document.addEventListener('change', (e) => {
      const form = e.target.closest('form[data-apply]');
      if (!form) return;
      const job = D.jobs.find((x) => x.id === form.dataset.apply);
      // Rang geändert: wählbare Bereiche neu anzeigen (alles bis zum eigenen Rang)
      if (e.target.name === 'rank' && job.areas) {
        const box = $('[data-areas]', form);
        const chosen = $('input[name="area"]:checked', box);
        box.innerHTML = areasHtml(job, e.target.value, chosen && chosen.value);
        if (chosen && !$('input[name="area"]:checked', box)) showQuiz(form, job, null);
        const field = $('[data-field="area"].has-error', form);
        if (field) clearFieldError(field);
        updateSectors(form);
      }
      // Bereich gewechselt: passende Fragen zeigen, bisherige Antworten behalten
      if (e.target.name === 'area') {
        showQuiz(form, job, e.target.value);
        updateSectors(form);
      }
    });

    // Schiebeaufgaben: Einträge per Ziehen (Maus überall, Finger am Griff) oder mit den Pfeiltasten umsortieren
    document.addEventListener('keydown', (e) => {
      const item = e.target.closest && e.target.closest('.order__item');
      if (!item || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      e.preventDefault();
      const sib = e.key === 'ArrowUp' ? item.previousElementSibling : item.nextElementSibling;
      if (!sib) return;
      if (e.key === 'ArrowUp') sib.before(item); else sib.after(item);
      orderSync(item.parentElement);
      item.focus();
    });
    let drag = null;
    document.addEventListener('pointerdown', (e) => {
      const item = e.target.closest('.order__item');
      if (!item || e.target.closest('button') || (e.pointerType !== 'mouse' && !e.target.closest('.order__grip'))) return;
      e.preventDefault();
      drag = { item, list: item.parentElement, id: e.pointerId };
      item.classList.add('is-dragging');
      item.setPointerCapture(e.pointerId);
    });
    document.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { item } = drag;
      const prev = item.previousElementSibling;
      const next = item.nextElementSibling;
      const mid = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
      if (prev && e.clientY < mid(prev)) prev.before(item);
      else if (next && e.clientY > mid(next)) next.after(item);
    });
    const dragEnd = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.item.classList.remove('is-dragging');
      orderSync(drag.list);
      drag = null;
    };

    // Links in Bewerbungen: weitere Zeile, Zeile entfernen, Symbol passend zur Plattform
    document.addEventListener('click', (e) => {
      const add = e.target.closest('[data-link-add]');
      const del = e.target.closest('[data-link-del]');
      if (!add && !del) return;
      const box = (add || del).closest('[data-q="links"]');
      const list = $('[data-links]', box);
      if (add) {
        if ($$('.link-row', list).length >= +list.dataset.max) return;
        list.insertAdjacentHTML('beforeend', linkRowHtml({ types: list.dataset.types.split(',') }, list.dataset.name));
        $('.link-row:last-child select', list).focus();
      } else if ($$('.link-row', list).length > 1) del.closest('.link-row').remove();
      else $$('select, input', list).forEach((x) => { x.value = ''; });
      add && (add.hidden = $$('.link-row', list).length >= +list.dataset.max);
      const form = box.closest('form[data-apply]');
      if (form) updateSectors(form);
    });
    document.addEventListener('change', (e) => {
      const sel = e.target.closest('.link-row__type select');
      if (!sel) return;
      const type = LINK_TYPES[sel.value];
      const ic = $('.link-row__url .ic', sel.closest('.link-row'));
      ic.className = `fi ${type ? type.icon : 'fi-rr-link-alt'} ic`;
    });

    // YouTube erst nach dem Antippen laden
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-youtube]');
      if (!b) return;
      b.outerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.dataset.youtube)}?autoplay=1&rel=0" title="${esc(t('Video'))}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    });
    document.addEventListener('pointerup', dragEnd);
    document.addEventListener('pointercancel', dragEnd);
    document.addEventListener('submit', (e) => {
      const connect = e.target.closest('form[data-connect]');
      if (connect) { e.preventDefault(); connectRoblox(connect); return; }
      const form = e.target.closest('form[data-apply]');
      if (!form) return;
      e.preventDefault();
      submitApplication(form);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-disconnect]')) return;
      state.profile = null;
      store.set('tsg-profile', null);
      renderMe();
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

    window.addEventListener('hashchange', route);
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
    state.online = Math.max(900, state.online + Math.round((Math.random() - 0.48) * 14));
    bind();
    if (!minuteChanged) return;
    // Serverstatus der Trainings (offen / öffnet bald / geschlossen) jede Minute aktualisieren
    if (state.page === 'home') renderNextSteps();
    if (state.page === 'trainings' && modal.hidden) renderTrainings();
    if (modalView && modalView.name === 'training') refreshModal();
  }

  // ---------- Start ----------
  // Offline-Fähigkeit als App (nur über http/https möglich)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
  $$('[data-year]').forEach((el) => { el.textContent = berlinNow().y; });
  setLanguage(langSetting(), { start: true }).then(() => {
    events();
    renderMe();
    route();
    tick();
    lastMinute = berlinNow().abs;
    setInterval(tick, 1000);
    setInterval(liveRefresh, 1000);
    // „Automatisch“: ändert sich die Gerätesprache, wechselt die Seite mit
    window.addEventListener('languagechange', () => { if (langSetting() === 'auto') setLanguage('auto'); });
  });
})();
