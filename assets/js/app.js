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
  // Voraussetzung = der Rang davor (Teamränge ohne Training zählen nicht)
  function reqFor(type) {
    for (let i = rankIdx(type) - 1; i > 0; i--) if (!RANKS[i].staff) return RANKS[i].name;
    return RANKS[0].name;
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
    typeFilter: new Set(store.get('tsg-tfilter', [])),
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
    $('[data-top-routes]').innerHTML = routeList(D.topRoutes.map((d) => ({ route: routeOf(d.no), value: d.value })), top);
  }

  // Strecken über ihre Nummer (R001, R002, …)
  const routeOf = (no) => D.routes.find((r) => r.no === no) || { no, title: no, cat: 're', line: '' };
  const routeNo = (r) => `<span class="route-no">${esc(r.no)}</span>`;
  // Streifendiagramm als Rangliste (Statistikseite und Meine Statistik)
  const routeList = (rows, max) => rows.map((d, i) => `<li>
      <span class="rank-num">${i + 1}</span>
      <span class="r-main">${routeNo(d.route)}<span>${esc(d.route.title)}</span></span>
      <span class="r-val">${fmt(d.value)} <small>Fahrten</small></span>
      <span class="r-bar"><span style="width:${max ? (d.value / max) * 100 : 0}%"></span></span>
    </li>`).join('');
  // Streifendiagramm mit Balken (Zuggattungen, Meine Statistik)
  const hbarList = (rows, unit) => {
    const max = Math.max(...rows.map((d) => d.value), 1);
    return rows.map((d) => `<div class="hbar" data-tip="<b>${fmt(d.value)} ${unit}</b><span>${esc(d.label)}</span>">
      <span class="hbar__label">${esc(d.label)}</span>
      <span class="hbar__track"><span class="hbar__fill" style="width:${(d.value / max) * 86}%"></span><span class="hbar__value">${fmt(d.value)}</span></span>
    </div>`).join('');
  };

  // ---------- Strecken & News ----------
  // Einstieg und Rollen (Startseite)
  function renderRoles() {
    const rk = (name) => `<b class="rk" style="--rc:${rankOf(name).color}">${esc(name)}</b>`;
    const fill = (text, rank) => esc(text)
      .replace(/\{rank\}/g, rk(rank))
      .replace('{group}', `<a href="${esc(D.links.group)}" target="_blank" rel="noopener">Train Sim Germany Gruppe auf Roblox${icon('fi-rr-arrow-up-right-from-square')}</a>`);
    const start = `<article class="role-card role-card--start">
      <div class="role-card__media"><img src="assets/img/group.svg" alt="Roblox-Spieler winken auf dem Bahnsteig vor einem Regionalzug" loading="lazy"></div>
      <div class="role-card__body">
        <h3>Starte jetzt bei Train Sim Germany!</h3>
        <div class="start-actions">
          <a class="btn btn--primary btn--lg btn--block" href="${esc(D.links.play)}" target="_blank" rel="noopener">${icon('fi-sr-play')}Server beitreten</a>
          <p>Deine Reise beginnt auf Roblox.</p>
          <a class="btn btn--outline btn--lg btn--block" href="${esc(D.links.group)}" target="_blank" rel="noopener">${icon('fi-rr-user-add')}Roblox-Gruppe beitreten</a>
          <p>Für Ränge und Trainings.</p>
          <a class="btn btn--outline btn--lg btn--block btn--discord" href="${esc(D.links.discord)}" target="_blank" rel="noopener">${icon('fi-brands-discord')}Discord-Community beitreten</a>
          <p>Chatte mit <span data-bind="discordMembers">${compact(D.stats.discordMembers)}</span> anderen Spielern.</p>
        </div>
      </div>
    </article>`;
    $('[data-roles]').innerHTML = start + D.roleCards.map((c) => `<article class="role-card">
      <div class="role-card__media"><img src="assets/img/${c.img}" alt="" loading="lazy"></div>
      <div class="role-card__body">
        <h3>${fill(c.title, c.rank)}</h3>
        <p>${fill(c.text, c.rank)}</p>
        <span class="count-pill">${icon('fi-rr-users-alt')}<b>${fmt(rankOf(c.rank).members)}</b> Spieler als ${esc(c.rank)}</span>
      </div>
    </article>`).join('');
  }

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
          <h3>${routeNo(r)}<span>${esc(r.title)}</span></h3>
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
  const CREW = D.crew;
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
      const names = CREW.filter((_, i) => (hash(s.name) + i) % 5 === 0).slice(0, 3);
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
        const taken = week === 0 ? t.taken : Math.max(0, t.taken - 3 - (i % 3));
        out.push(Object.assign({}, t, {
          id, day, start, end: start + t.dur,
          taken: Math.min(t.slots, taken),
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
    if (isLocked(t)) return { cls: 'lock', text: `ab ${t.req}`, level: 'warn' };
    if (free <= 0) return { cls: 'bad', text: 'Voll', level: 'bad' };
    if (free <= 2) return { cls: 'warn', text: `${free} frei`, level: 'warn' };
    return { cls: 'ok', text: `${free} frei`, level: 'ok' };
  }

  // Trainingsserver: öffnet 15 Minuten vor Beginn und schließt mit dem Ende des Trainings
  const SERVER_OPENS = 15;
  function serverStatus(t) {
    const now = berlinNow().abs;
    const opens = t.start - SERVER_OPENS;
    if (now >= opens && now < t.end) return { cls: 'open', text: 'Server offen', open: true };
    if (now < opens && opens - now <= 60) return { cls: 'soon', text: `Öffnet in ${opens - now} Min.`, open: false };
    return { cls: 'closed', text: 'Geschlossen', open: false };
  }
  const serverPill = (t) => {
    const ss = serverStatus(t);
    return `<span class="server-pill server-pill--${ss.cls}"><i></i>${ss.text}</span>`;
  };

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
        <p>${esc(when)} ${t ? `Der Server öffnet ${SERVER_OPENS} Minuten vorher.` : 'Aktiviere die Glocke, dann sagen wir Bescheid.'}</p>
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
    return `<button class="tcard" type="button" data-detail="${t.id}">
      <div class="tcard__media">
        <img src="assets/img/${t.img}" alt="" loading="lazy">
        ${serverPill(t)}
        <span class="tcard__role" style="--rc:${t.color}"><i></i>${esc(t.type)}</span>
      </div>
      <div class="tcard__body">
        <h3>${esc(t.title)}</h3>
        <div class="tcard__row"><span>${t.time} Uhr</span><span class="tcard__slots${st.cls === 'bad' ? ' is-full' : ''}">${icon('fi-sr-user')}${t.taken}/${t.slots}</span></div>
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
    return `<header class="sector__head"><span class="sector__no" aria-hidden="true">${i + 1}</span><small>Sektor ${i + 1}</small><h3>${s.title}</h3></header>
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
          <div class="f" ${dataField('roblox')}><label class="f__label" for="ap-roblox">Roblox-Benutzername</label><input id="ap-roblox" name="roblox" autocomplete="username" value="${esc(state.profile ? state.profile.username : D.me.username)}" placeholder="Dein Roblox-Benutzername"></div>
          <div class="f" ${dataField('discord')}><label class="f__label" for="ap-discord">Discord-Benutzername</label><input id="ap-discord" name="discord" autocomplete="off" placeholder="z. B. lokfuehrer_max"></div>
          <div class="f" ${dataField('since')}><label class="f__label" for="ap-since">Du spielst seit</label><div class="select"><select id="ap-since" name="since"><option value="">Bitte wählen</option>${SINCE.map((x) => `<option>${x}</option>`).join('')}</select>${icon('fi-rr-angle-small-down')}</div></div>
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
          <div class="f" ${dataField('activity')}>
            <label class="f__label" for="ap-act">Wie aktiv wärst du, wenn du angenommen wirst?</label>
            <div class="slider" data-slider style="--a:0%;--b:${(5 - 1) / 9 * 100}%">
              <output class="slider__out" for="ap-act" data-slider-out>5 von 10</output>
              <div class="slider__track">
                <input type="range" id="ap-act" name="activity" min="1" max="10" step="1" value="5" data-slider-input="single">
              </div>
              <div class="slider__ticks" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<span>${i + 1}</span>`).join('')}</div>
            </div>
            <div class="scale__legend"><span>selten</span><span>sehr aktiv</span></div>
          </div>
          <div class="f" ${dataField('days')}>
            <span class="f__label" id="ap-days">An welchen Tagen hast du meistens Zeit?</span>
            <div class="slider slider--range" data-slider style="--a:0%;--b:100%" role="group" aria-labelledby="ap-days">
              <output class="slider__out" data-slider-out>Mo – So</output>
              <div class="slider__track">
                <input type="range" name="dayFrom" min="0" max="6" step="1" value="0" aria-label="Von" data-slider-input="from">
                <input type="range" name="dayTo" min="0" max="6" step="1" value="6" aria-label="Bis" data-slider-input="to">
              </div>
              <div class="slider__ticks" aria-hidden="true">${DAYS.map((d) => `<span>${d}</span>`).join('')}</div>
            </div>
          </div>
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
    const answers = {};
    for (const [k, v] of data) if (k.startsWith('q:')) answers[k.slice(2)] = +v;
    const values = Object.values(answers);
    state.applications[id] = {
      roblox: data.get('roblox').trim(), discord: data.get('discord').trim(),
      since: data.get('since'), rank: data.get('rank'), area: data.get('area') || null,
      answers, score: values.filter((v) => v === 0).length, total: values.length,
      experience: data.get('experience').trim(), activity: +data.get('activity'), days: DAYS.slice(+data.get('dayFrom'), +data.get('dayTo') + 1),
      at: Date.now(),
    };
    store.set('tsg-applications', state.applications);
    toast('Bewerbung gesendet');
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
      out.textContent = `${el.value} von ${el.max}`;
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
    out.textContent = from.value === to.value ? DAYS[from.value] : `${DAYS[from.value]} – ${DAYS[to.value]}`;
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
      { key: 'fern', title: 'Fernverkehr', cat: 'ice' },
      { key: 'regio', title: 'Regio', cat: 're' },
      { key: 'sbahn', title: 'S-Bahn', cat: 's' },
    ].map((g) => ({ ...g, total: part(g.key), rows: split(part(g.key), D.fleet[g.key], g.key) }));
    const routes = split(trips, D.routes.map((r) => r.no), 'route').map((d) => ({ route: D.routes[d.i], value: d.value }));
    const fav = routes[0].route;
    return {
      week,
      groups,
      routes,
      trips,
      tiles: [
        { ic: 'fi-rr-star', label: 'Level', value: fmt(state.profile ? rnd('lvl', 4, 60) : D.me.level) },
        { ic: 'fi-rr-train-side', label: 'Kilometer', value: fmt(rnd('km', 900, 32000)) },
        { ic: 'fi-rr-route', label: 'Fahrten', value: fmt(trips) },
        { ic: 'fi-rr-clock-three', label: 'Pünktlichkeit', value: `${nf1.format(rnd('punct', 860, 992) / 10)} %` },
        { ic: 'fi-rr-calendar', label: 'Trainings', value: `${fmt(Math.max(0, rankIdx(state.rank)))} bestanden` },
        { ic: 'fi-rr-time-fast', label: 'Spielzeit', value: `${fmt(rnd('hours', 12, 640))} Std.` },
        { ic: 'fi-rr-trophy', label: 'Bestenliste', value: `Platz ${fmt(rnd('place', 18, 2400))}` },
        { ic: 'fi-rr-user-add', label: 'Dabei seit', value: `${MONTHS_SHORT[rnd('mon', 0, 11)]} ${rnd('year', 2023, 2025)}` },
        { ic: 'fi-rr-heart', label: 'Lieblingsstrecke', value: `${routeNo(fav)}${esc(fav.title)}`, wide: true },
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
    toast(mode === 'system' ? 'Darstellung folgt jetzt deinem Gerät' : `Darstellung: ${mode === 'dark' ? 'Dunkel' : 'Hell'}`);
  }
  function renderSettings() {
    $$('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === themeMode())));
    const p = state.profile;
    const r = rankOf(state.rank);
    $('[data-settings-account]').innerHTML = `${ringHTML(p, r, 'avatar-ring--lg')}
      <div class="set-account__who"><b>${p ? esc(p.displayName || p.username) : 'Nicht verbunden'}</b><small>${p ? `@${esc(p.username)}` : 'Verbinde dein Roblox-Konto für Name und Profilbild.'}</small></div>
      <button class="btn ${p ? 'btn--soft' : 'btn--primary'}" type="button" data-open="profile">${p ? 'Profil' : 'Verbinden'}</button>`;
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
    $$('.me').forEach((b) => b.setAttribute('aria-label', p ? `Profil von ${p.displayName || p.username}` : 'Profil öffnen und mit Roblox verbinden'));
    $('[data-drawer-me]').innerHTML = `${ringHTML(p, r, 'avatar-ring--lg')}
      <span class="drawer__who"><b>${p ? esc(p.displayName || p.username) : 'Gast'}</b><small>${p ? `@${esc(p.username)}` : 'Mit Roblox verbinden'}</small></span>
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
      const t = await fetch(`${api.thumbnailsApi}/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`);
      const img = ((await t.json()).data || [])[0];
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
      showFieldError(field, 'Bitte gib einen gültigen Roblox-Namen ein (3–20 Zeichen: Buchstaben, Zahlen, _).', 'err-rbx');
      input.focus();
      return;
    }
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Wird verbunden …';
    let profile = null;
    let offline = false;
    try { profile = await fetchRoblox(name); } catch (e) { offline = true; }
    if (!offline && !profile) {
      btn.disabled = false;
      btn.innerHTML = label;
      showFieldError(field, 'Diesen Roblox-Namen gibt es nicht.', 'err-rbx');
      input.focus();
      return;
    }
    state.profile = profile || { userId: null, username: name, displayName: name, avatar: null };
    store.set('tsg-profile', state.profile);
    renderMe();
    closeModal();
    toast(offline ? `Verbunden als ${name} – Profilbild gerade nicht erreichbar` : `Verbunden als ${state.profile.displayName}`);
  }

  // ---------- Auswahl-Sheets ----------
  const modal = $('[data-modal]');
  let modalView = null;
  const VIEWS = {
    profile: {
      title: 'Profil',
      render: () => {
        const p = state.profile;
        const r = rankOf(state.rank);
        if (!p) {
          return `<div class="profile-box">
              ${ringHTML(null, r, 'avatar-ring--xl')}
              <h3>Mit Roblox verbinden</h3>
              <p>Dein Roblox-Name und dein Profilbild erscheinen dann oben in der Kopfzeile, unten in der Leiste und im Menü.</p>
            </div>
            <form class="connect" data-connect novalidate>
              <div class="f"><label class="f__label" for="rbx-name">Roblox-Benutzername</label><input id="rbx-name" name="username" autocomplete="username" placeholder="z. B. ${esc(D.me.username)}"></div>
              <button class="btn btn--primary btn--lg btn--block" type="submit">${icon('fi-rr-link-alt')}Verbinden</button>
              <p class="sheet-note">Es wird nur dein öffentliches Roblox-Profil geladen – kein Passwort, kein Login.</p>
            </form>`;
        }
        return `<div class="profile-box">
            ${ringHTML(p, r, 'avatar-ring--xl')}
            <h3>${esc(p.displayName || p.username)}</h3>
            <p>@${esc(p.username)}</p>
            <button class="rank-pill rank-pill--btn" type="button" data-open="rank" style="--rc:${r.color}">[${esc(r.prefix)}] ${esc(r.name)}${icon('fi-rr-angle-small-down')}</button>
          </div>
          <div class="sheet-actions">
            <button class="btn btn--primary btn--lg btn--block" type="button" data-open="stats">${icon('fi-rr-chart-line-up')}Meine Statistik</button>
            ${p.userId ? `<a class="btn btn--outline btn--lg btn--block" href="https://www.roblox.com/users/${encodeURIComponent(p.userId)}/profile" target="_blank" rel="noopener">${icon('fi-rr-arrow-up-right-from-square')}Roblox-Profil ansehen</a>` : ''}
            <button class="btn btn--soft btn--lg btn--block" type="button" data-disconnect>Verbindung trennen</button>
          </div>`;
      },
    },
    stats: {
      title: 'Meine Statistik',
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
            <h4 class="mystats__title"><span class="mystats__dot" style="--c:var(--c-${g.cat})"></span>${g.title}<small>${fmt(g.total)} Fahrten</small></h4>
            <p class="mystats__sub">Deine meistgefahrenen Züge</p>
            <div class="hbars" style="--viz:var(--c-${g.cat})">${hbarList(g.rows, 'Fahrten')}</div>
          </section>`).join('')}
          <section class="mystats__block">
            <h4 class="mystats__title"><span class="mystats__dot"></span>Alle Strecken<small>${fmt(st.trips)} Fahrten</small></h4>
            <p class="mystats__sub">Wie oft du jede Strecke gefahren bist</p>
            <ol class="rank-list rank-list--compact">${routeList(st.routes, st.routes[0].value)}</ol>
          </section>
          <h4 class="mystats__title">Diese Woche gespielt</h4>
          <div class="week-bars">${st.week.map((d) => `<div class="week-bars__col${d.today ? ' is-today' : ''}"><span class="week-bars__val">${d.min ? `${Math.round(d.min / 6) / 10} h` : '–'}</span><span class="week-bars__bar"><i style="height:${Math.max(4, (d.min / max) * 100)}%"></i></span><span class="week-bars__day">${d.label}</span></div>`).join('')}</div>
          <p class="sheet-note">Demo-Werte – später kommen sie direkt aus dem Spiel.</p>
          <div class="sheet-actions"><button class="btn btn--soft btn--lg btn--block" type="button" data-open="profile">${icon('fi-rr-arrow-left')}Zurück zum Profil</button></div>
        </div>`;
      },
    },
    rank: {
      title: 'Dein Rang',
      render: () => `<div class="opt-list" role="radiogroup" aria-label="Rang wählen">${RANKS.filter((r) => r.name !== 'Management').map((r) => `
        <button class="opt" type="button" role="radio" aria-checked="${r.name === state.rank}" data-rank="${r.name}">
          ${rankPill(r)}<span><b>${esc(r.name)}</b><small>${esc(r.label)} · ${esc(r.desc)}</small></span>
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
        const ss = serverStatus(t);
        const locked = isLocked(t);
        // „Join Now“ ist nur aktiv (hellblau), solange der Trainingsserver offen ist
        const action = ss.open && !locked
          ? `<a class="btn btn--join btn--lg btn--block" href="${esc(D.links.play)}" target="_blank" rel="noopener">${icon('fi-sr-play')}Join Now</a>`
          : `<button class="btn btn--join btn--lg btn--block" type="button" disabled>${icon(locked ? 'fi-rr-lock' : 'fi-sr-play')}Join Now</button>`;
        const hint = locked ? '' : ss.open ? 'Der Trainingsserver ist offen – du kannst jetzt beitreten.' : `Der Trainingsserver öffnet ${SERVER_OPENS} Minuten vor Beginn.`;
        return `<div class="detail">
          <img class="detail__img" src="assets/img/${t.img}" alt="">
          <div class="detail__top">${roleBadge(t.type)}${serverPill(t)}<span class="tag">${relTime(t.start)}</span></div>
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
          ${locked ? `<div class="lock">${icon('fi-rr-lock')}<span>Für dieses Training brauchst du mindestens den Rang ${esc(t.req)}. Dein Rang: ${esc(state.rank)}.</span></div>` : ''}
          ${action}
          ${hint ? `<p class="sheet-note join-hint">${hint}</p>` : ''}
        </div>`;
      },
    },
  };
  function openModal(name, arg) {
    closeMenu();
    modalView = { name, arg };
    const title = VIEWS[name].title;
    $('[data-modal-title]').textContent = typeof title === 'function' ? title(arg) : title;
    $('[data-modal-body]').innerHTML = VIEWS[name].render(arg);
    modal.hidden = false;
    document.body.classList.add('menu-open');
    const focusable = $('[data-modal-body] input', modal) || $('[data-modal-body] button:not([disabled])', modal) || $('[data-modal-close]', modal);
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

  function toggleBell() {
    state.bell = !state.bell;
    store.set('tsg-bell', state.bell);
    $$('[data-bell]').forEach((b) => b.setAttribute('aria-pressed', String(state.bell)));
    const next = nextRank(state.rank);
    toast(state.bell ? `Erinnerungen an${next ? ` – wir melden uns vor ${next.name}-Trainings` : ''}` : 'Erinnerungen aus');
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
      const el = e.target.closest('[data-open], [data-detail], [data-bell], [data-day], [data-pick-day], [data-rank], [data-ttoggle], [data-treset], [data-fav], [data-theme-set]');
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
        renderMe();
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
      } else if (ds.themeSet) setTheme(ds.themeSet);
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
        toast('Bewerbung zurückgezogen');
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
      toast('Verbindung zu Roblox getrennt');
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
      toast('App installiert');
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
  const tzName = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', timeZoneName: 'short' }).formatToParts(new Date()).find((x) => x.type === 'timeZoneName');
  $$('[data-tz]').forEach((el) => { el.textContent = tzName ? tzName.value : 'MEZ'; });
  events();
  renderMe();
  route();
  tick();
  lastMinute = berlinNow().abs;
  setInterval(tick, 1000);
  setInterval(liveRefresh, 1000);
})();
