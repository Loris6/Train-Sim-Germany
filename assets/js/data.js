/*
 * Train Sim Germany – Inhalte & Beispieldaten
 *
 * Alles, was die Seite anzeigt, kommt aus dieser Datei. Später können die
 * Beispielwerte durch echte Daten aus dem Spiel (z. B. über eine API) ersetzt werden.
 */
window.TSG = {
  // Hier die echten Links eintragen
  links: {
    play: 'https://www.roblox.com/games/140440792597921/Unbenannte-Experience',
    group: 'https://www.roblox.com/share/g/33684346',
    discord: 'https://discord.gg/tvaSwbh3rE',
  },

  // Angemeldeter Spieler (Demo – später aus dem Roblox-Login)
  me: { name: 'Jonas', username: 'Jonas_BR218', rank: 'Conductor', level: 24 },

  stats: {
    online: 1284,
    servers: 42,
    trains: 318,
    punctuality: 94.2,
    visits: 12400000,
    favorites: 284000,
    groupMembers: 48200,
    discordMembers: 21700,
    discordOnline: 3100,
    km: 9800000,
    tripsToday: 18430,
  },

  // id = Server-ID aus dem Spiel (JobId), zugleich Adresse der Detailseite (#/server/<id>) und für „Beitreten“.
  // lines = Linien aus `lines`, die auf dem Server fahren.
  // focus = Rang, den ein Trainingsserver vor allem ausbildet. Züge, Spieler und Stationen
  // berechnet die App aus dem Fahrplan (Demo – später live aus dem Spiel).
  servers: [
    { id: 'b1cb1816-7d85-457c-9f32-2a1422d00e17', name: 'Ostnetz #1', region: 'EU-Central', network: 'Magdeburg – Berlin', players: 33, max: 35, ping: 28, uptime: 372, version: '2.4.1', type: 'public', lines: ['re-1', 'ic-56', 's-1md', 'rb-32', 's-7'] },
    { id: '5bb7fb0f-d8d9-415b-8725-460b8ce504db', name: 'Ostnetz #2', region: 'EU-Central', network: 'Magdeburg – Halle – Leipzig', players: 18, max: 35, ping: 31, uptime: 160, version: '2.4.1', type: 'public', lines: ['re-13', 're-30', 'ic-55', 's-5', 's-1md'] },
    { id: 'ce9c02e4-aafb-4062-97ff-bbaaeca05990', name: 'Ostnetz #3', region: 'EU-Central', network: 'Berlin – Leipzig – Halle', players: 35, max: 35, ping: 24, uptime: 663, version: '2.4.1', type: 'public', lines: ['ice-28', 'ice-15', 're-3', 's-5', 's-7'] },
    { id: '0583542f-4cd5-413d-8c6e-3438c63be5a9', name: 'Ostnetz #4', region: 'EU-Central', network: 'Berlin – Warschau', players: 27, max: 35, ping: 33, uptime: 295, version: '2.4.1', type: 'public', lines: ['ec-95', 're-1', 's-7'] },
    { id: 'e35fd989-b021-4ac8-8c31-76236de8809a', name: 'Ostnetz #5', region: 'EU-Central', network: 'Leipzig – Dresden', players: 12, max: 35, ping: 38, uptime: 58, version: '2.4.1', type: 'public', lines: ['re-50', 's-1d', 'ice-28'] },
    { id: 'dde53f64-b9a5-4b5f-b3c1-8c1b55270a2c', name: 'Nachtfahrt-Event', region: 'EU-Central', network: 'Gesamtnetz · Nachtfahrplan', players: 48, max: 50, ping: 41, uptime: 80, version: '2.4.1', type: 'event', lines: ['ice-28', 'ice-15', 'ec-95', 'ic-55', 'ic-56', 're-1', 're-13', 're-30', 're-50', 's-5', 's-7'] },
    { id: '2e432cd4-4edb-4a59-89e3-2949b3995201', name: 'Signaller-Training', region: 'EU-Central', network: 'Magdeburg Hbf · Ausbildung', players: 9, max: 12, ping: 27, uptime: 35, version: '2.4.1', type: 'training', focus: 'Signaller', lines: ['re-1', 're-13', 're-30', 's-1md'] },
    { id: '8a1e6f91-0951-4549-a823-213cb38eb51c', name: 'Driver-Training', region: 'EU-Central', network: 'Halle – Leipzig', players: 6, max: 10, ping: 29, uptime: 22, version: '2.4.1', type: 'training', focus: 'Qualified Driver', lines: ['s-5', 'ic-55'] },
    { id: '5fbd48da-8157-4056-9496-0b4de48e224b', name: 'Ostnetz #6', region: 'EU-Central', network: 'Berlin Hbf – Stadtbahn', players: 31, max: 35, ping: 35, uptime: 468, version: '2.4.1', type: 'public', lines: ['s-7', 're-1', 'ice-28', 'ec-95'] },
    { id: '1a306ce2-9f4a-4d58-afb7-fb492f5fca05', name: 'NA Network #1', region: 'US-East', network: 'Gesamtnetz', players: 22, max: 35, ping: 112, uptime: 190, version: '2.4.1', type: 'public', lines: ['ice-28', 'ice-15', 'ec-95', 're-1', 're-30', 's-5', 's-7'] },
    { id: 'db4b4019-d184-4f29-8669-d2723a604f08', name: 'VIP · Lea & Friends', region: 'EU-Central', network: 'Halle (Saale) – Magdeburg', players: 5, max: 12, ping: 26, uptime: 65, version: '2.4.1', type: 'vip', lines: ['re-30', 's-5'] },
    { id: '233308a8-c720-4ded-8418-4a04f387583b', name: 'Beta · Update 2.5', region: 'EU-Central', network: 'Berlin – Warschau (neu)', players: 19, max: 20, ping: 30, uptime: 45, version: '2.5.0-beta', type: 'event', lines: ['ec-95', 're-1'] },
  ],

  // Linien im Spiel. stops = [Bahnhof, Minuten ab dem ersten Halt]. Gefahren wird in beide Richtungen.
  // every = Takt in Minuten, offset = erste Abfahrt nach Mitternacht (Minute), no = erste Zugnummer,
  // train = Fahrzeug, cat = Gattung (ice, ec, ic, ire, re, rb, s).
  lines: {
    'ice-28': { name: 'ICE 28', cat: 'ice', train: 'ICE 4', every: 120, offset: 24, no: 500, stops: [['Berlin Hbf', 0], ['Berlin Südkreuz', 7], ['Lutherstadt Wittenberg', 38], ['Leipzig Hbf', 72]] },
    'ice-15': { name: 'ICE 15', cat: 'ice', train: 'ICE T', every: 120, offset: 84, no: 1700, stops: [['Berlin Hbf', 0], ['Berlin Südkreuz', 7], ['Lutherstadt Wittenberg', 38], ['Bitterfeld', 55], ['Halle (Saale) Hbf', 70]] },
    'ec-95': { name: 'EC 95', cat: 'ec', train: 'EC (Berlin-Warszawa-Express)', every: 120, offset: 37, no: 40, stops: [['Berlin Hbf', 0], ['Berlin Ostbahnhof', 6], ['Frankfurt (Oder)', 58], ['Rzepin', 75], ['Poznań Główny', 170], ['Konin', 220], ['Kutno', 265], ['Warszawa Zachodnia', 320], ['Warszawa Centralna', 330]] },
    'ic-55': { name: 'IC 55', cat: 'ic', train: 'IC 2', every: 120, offset: 10, no: 2030, stops: [['Magdeburg Hbf', 0], ['Köthen', 38], ['Halle (Saale) Hbf', 56], ['Leipzig Hbf', 80]] },
    'ic-56': { name: 'IC 56', cat: 'ic', train: 'IC 1', every: 120, offset: 70, no: 2430, stops: [['Magdeburg Hbf', 0], ['Brandenburg Hbf', 45], ['Potsdam Hbf', 68], ['Berlin Hbf', 90]] },
    're-1': { name: 'RE 1', cat: 're', train: 'Desiro HC', every: 60, offset: 5, no: 3100, stops: [['Magdeburg Hbf', 0], ['Burg (b Magdeburg)', 20], ['Genthin', 34], ['Brandenburg Hbf', 55], ['Potsdam Hbf', 75], ['Berlin-Wannsee', 82], ['Berlin Zoologischer Garten', 95], ['Berlin Hbf', 99], ['Berlin Ostbahnhof', 105], ['Erkner', 125], ['Fürstenwalde (Spree)', 138], ['Frankfurt (Oder)', 158]] },
    're-13': { name: 'RE 13', cat: 're', train: 'Doppelstock', every: 60, offset: 40, no: 16300, stops: [['Magdeburg Hbf', 0], ['Biederitz', 8], ['Gommern', 18], ['Zerbst/Anhalt', 33], ['Roßlau (Elbe)', 44], ['Dessau Hbf', 50], ['Bitterfeld', 70], ['Delitzsch unt Bf', 80], ['Leipzig Hbf', 97]] },
    're-30': { name: 'RE 30', cat: 're', train: 'Talent 2', every: 60, offset: 22, no: 16500, stops: [['Magdeburg Hbf', 0], ['Schönebeck (Elbe)', 13], ['Calbe (Saale) Ost', 27], ['Köthen', 40], ['Halle (Saale) Hbf', 60]] },
    're-3': { name: 'RE 3', cat: 're', train: 'KISS', every: 60, offset: 50, no: 3300, stops: [['Berlin Hbf', 0], ['Berlin Südkreuz', 7], ['Ludwigsfelde', 21], ['Jüterbog', 50], ['Lutherstadt Wittenberg', 76]] },
    're-50': { name: 'RE 50', cat: 're', train: 'Doppelstock', every: 60, offset: 12, no: 16000, stops: [['Leipzig Hbf', 0], ['Wurzen', 17], ['Oschatz', 33], ['Riesa', 45], ['Coswig (b Dresden)', 66], ['Dresden-Neustadt', 80], ['Dresden Hbf', 87]] },
    'rb-32': { name: 'RB 32', cat: 'rb', train: 'LINT 41', every: 60, offset: 35, no: 87300, stops: [['Magdeburg Hbf', 0], ['Magdeburg-Neustadt', 6], ['Barleben', 13], ['Wolmirstedt', 20], ['Haldensleben', 33]] },
    's-5': { name: 'S 5', cat: 's', train: 'Talent 2', every: 30, offset: 9, no: 37500, stops: [['Halle (Saale) Hbf', 0], ['Halle Messe', 5], ['Schkeuditz', 15], ['Flughafen Leipzig/Halle', 19], ['Leipzig Messe', 26], ['Leipzig Hbf (tief)', 33], ['Leipzig Markt', 35], ['Leipzig Wilhelm-Leuschner-Platz', 37], ['Leipzig Bayerischer Bf', 39]] },
    's-1md': { name: 'S 1', cat: 's', train: 'FLIRT 3', every: 30, offset: 4, no: 36100, stops: [['Schönebeck-Bad Salzelmen', 0], ['Schönebeck (Elbe)', 4], ['Magdeburg-Buckau', 14], ['Magdeburg Hbf', 19], ['Magdeburg-Neustadt', 24], ['Zielitz', 40]] },
    's-7': { name: 'S 7', cat: 's', train: 'BR 481', every: 10, offset: 1, no: 7700, stops: [['Westkreuz', 0], ['Zoologischer Garten', 5], ['Berlin Hbf', 10], ['Friedrichstraße', 12], ['Alexanderplatz', 16], ['Ostbahnhof', 20], ['Ostkreuz', 24]] },
    's-1d': { name: 'S 1', cat: 's', train: 'Doppelstock', every: 30, offset: 9, no: 33100, stops: [['Meißen Triebischtal', 0], ['Coswig (b Dresden)', 16], ['Radebeul Ost', 26], ['Dresden-Neustadt', 36], ['Dresden Hbf', 43]] },
  },

  // Fahrzeuge der Linien (train): Baureihe für die Fahrzeugnummer, Höchstgeschwindigkeit und Stromsystem
  // power: ac = 15.000 V AC, dc750 = 750 V DC (Stromschiene), diesel, multi = Mehrsystem (in Polen 3.000 V DC)
  trainTypes: {
    'ICE 4': { series: '412', vmax: 250, power: 'ac' },
    'ICE T': { series: '411', vmax: 230, power: 'ac' },
    'EC (Berlin-Warszawa-Express)': { series: '370', vmax: 160, power: 'multi' },
    'IC 2': { series: '146', vmax: 160, power: 'ac' },
    'IC 1': { series: '101', vmax: 200, power: 'ac' },
    'Desiro HC': { series: '462', vmax: 160, power: 'ac' },
    'Doppelstock': { series: '146', vmax: 160, power: 'ac' },
    'Talent 2': { series: '442', vmax: 160, power: 'ac' },
    'KISS': { series: '445', vmax: 160, power: 'ac' },
    'LINT 41': { series: '648', vmax: 120, power: 'diesel' },
    'FLIRT 3': { series: '1428', vmax: 140, power: 'ac' },
    'BR 481': { series: '481', vmax: 100, power: 'dc750' },
  },

  // Shop: Züge und Strecken für Coins. Mit Backend kommen Preise und Besitz vom Server (backend/shop.js,
  // gleiche IDs wie im Spiel). Diese Liste gilt nur für die Demo ohne Backend.
  // art = Zeichnung: nose (ice | round | flat), deck (1 | 2), body/top/stripe/window = Farben
  shop: {
    trains: [
      { id: 'talent2', name: 'Talent 2', series: 'BR 442', cat: 're', vmax: 160, price: 0, starter: true, art: { nose: 'round', body: '#F4F6F8', stripe: '#EC0016', window: '#2B313B' } },
      { id: 'br481', name: 'BR 481', series: 'S-Bahn Berlin', cat: 's', vmax: 100, price: 2500, art: { nose: 'round', body: '#8F1D21', top: '#F2B705', stripe: '#8F1D21', window: '#2B313B' } },
      { id: 'flirt3', name: 'FLIRT 3', series: 'BR 1428', cat: 's', vmax: 140, price: 3500, art: { nose: 'round', body: '#F4F6F8', stripe: '#1E5AA8', window: '#26303C' } },
      { id: 'lint41', name: 'LINT 41', series: 'BR 648', cat: 'rb', vmax: 120, price: 4000, art: { nose: 'flat', body: '#F4F6F8', stripe: '#EC0016', window: '#2B313B', short: true } },
      { id: 'kiss', name: 'KISS', series: 'BR 445', cat: 're', vmax: 160, price: 6500, art: { nose: 'round', deck: 2, body: '#F4F6F8', stripe: '#EC0016', window: '#2B313B' } },
      { id: 'desirohc', name: 'Desiro HC', series: 'BR 462', cat: 're', vmax: 160, price: 7500, art: { nose: 'ice', body: '#F4F6F8', stripe: '#EC0016', window: '#2B313B' } },
      { id: 'dosto', name: 'Doppelstock', series: 'BR 146 + Dosto', cat: 're', vmax: 160, price: 9000, art: { nose: 'flat', deck: 2, body: '#F4F6F8', stripe: '#EC0016', lower: '#B2B8C0', window: '#2B313B' } },
      { id: 'ic2', name: 'IC 2', series: 'BR 146.5 + Twindexx', cat: 'ic', vmax: 160, price: 15000, art: { nose: 'round', deck: 2, body: '#F4F6F8', stripe: '#EC0016', lower: '#8E949E', window: '#2B313B' } },
      { id: 'ic1', name: 'IC 1', series: 'BR 101', cat: 'ic', vmax: 200, price: 20000, art: { nose: 'flat', body: '#F4F6F8', stripe: '#EC0016', window: '#2B313B' } },
      { id: 'ice-t', name: 'ICE T', series: 'BR 411', cat: 'ice', vmax: 230, price: 32000, art: { nose: 'ice', body: '#F4F6F8', stripe: '#EC0016', window: '#1F252D' } },
      { id: 'eu44', name: 'Berlin-Warszawa-Express', series: 'EU44 Husarz', cat: 'ec', vmax: 160, price: 45000, art: { nose: 'flat', body: '#1C3F7A', stripe: '#F4F6F8', window: '#0F1C33' } },
      { id: 'ice4', name: 'ICE 4', series: 'BR 412', cat: 'ice', vmax: 250, price: 60000, art: { nose: 'ice', body: '#F4F6F8', stripe: '#EC0016', window: '#1F252D', long: true } },
    ],
    // Strecken aus routes (gleiche Nummern)
    routes: [
      { id: 'R001', price: 0, starter: true }, { id: 'R002', price: 3000 }, { id: 'R003', price: 3000 }, { id: 'R004', price: 5000 },
      { id: 'R005', price: 6000 }, { id: 'R006', price: 8000 }, { id: 'R007', price: 10000 }, { id: 'R008', price: 12000 },
      { id: 'R009', price: 15000 }, { id: 'R010', price: 40000 },
    ],
    // Demo-Stand ohne Backend
    demo: { coins: 24500, trains: ['talent2', 'br481'], routes: ['R001', 'R002'] },
  },

  // Chat: Grund und Bereich einer Anfrage. Wer annehmen darf, legt backend/chat.js fest (AREAS).
  chat: {
    reasons: [
      { id: 'training', label: 'Frage zu einem Training', icon: 'fi-rr-calendar' },
      { id: 'rank', label: 'Rang oder Beförderung', icon: 'fi-rr-badge-check', area: 'other' },
      { id: 'bug', label: 'Fehler im Spiel', icon: 'fi-rr-bug', area: 'tech' },
      { id: 'report', label: 'Spieler melden', icon: 'fi-rr-flag', area: 'report' },
      { id: 'application', label: 'Bewerbung', icon: 'fi-rr-briefcase', area: 'career' },
      { id: 'shop', label: 'Coins, Züge, Strecken', icon: 'fi-rr-coins', area: 'tech' },
      { id: 'other', label: 'Etwas anderes', icon: 'fi-rr-interrogation', area: 'other' },
    ],
    areas: [
      { id: 'driver', label: 'Qualified Driver', desc: 'Fahren, Signale, Fahrplan', icon: 'fi-rr-train-side', rank: 'Qualified Driver' },
      { id: 'platform', label: 'Platform Staff', desc: 'Abfertigung am Bahnsteig', icon: 'fi-rr-whistle', rank: 'Platform Staff' },
      { id: 'conductor', label: 'Conductor', desc: 'Türen, Fahrgäste, Tickets', icon: 'fi-rr-ticket', rank: 'Conductor' },
      { id: 'signaller', label: 'Signaller', desc: 'Stellwerk und Fahrstraßen', icon: 'fi-rr-traffic-light', rank: 'Signaller' },
      { id: 'career', label: 'Karriere & Bewerbungen', desc: 'Stellen und Bewerbungen', icon: 'fi-rr-briefcase' },
      { id: 'tech', label: 'Technik & Fehler', desc: 'Bugs, App, Coins und Käufe', icon: 'fi-rr-bug' },
      { id: 'report', label: 'Meldungen', desc: 'Regelverstöße und Spieler melden', icon: 'fi-rr-flag' },
      { id: 'other', label: 'Allgemein', desc: 'Alles andere', icon: 'fi-rr-interrogation' },
    ],
  },

  // Ränge = Rollen der Roblox-Gruppe, von unten nach oben. Ausbildungsweg mit Trainings:
  // Learning Driver → Qualified Driver → Platform Staff → Conductor → Signaller.
  // staff = Teamrang ohne Training. Ab Supervisor können Trainings angeboten werden,
  // ab Public Relations Department (PRD) Neuigkeiten, Stellen und Bewerbungen verwaltet werden.
  // Guest = nicht in der Gruppe. Beim Roblox-Login kommt der Rang aus der Rolle in der Gruppe
  // (über das Kürzel in eckigen Klammern, z. B. „[QD] Qualified Driver“).
  // prefix = Kürzel vor dem Profilbild, members = Spieler mit diesem Rang (wird live aus der Gruppe geladen).
  ranks: [
    { name: 'Guest', prefix: 'G', label: 'Gast', desc: 'Noch nicht in der Roblox-Gruppe', color: '#AFB4BB', members: 0, guest: true },
    { name: 'Learning Driver', prefix: 'LD', label: 'Lokführer in Ausbildung', desc: 'Neu in der Gruppe, lernt Züge zu fahren', color: '#F0646B', members: 18420 },
    { name: 'Qualified Driver', prefix: 'QD', label: 'Lokführer', desc: 'Fährt Züge sicher und pünktlich', color: '#D3212D', members: 9650 },
    { name: 'Platform Staff', prefix: 'PS', label: 'Bahnsteigpersonal', desc: 'Bahnsteig sichern, Abfahrtsauftrag geben', color: '#E2A512', members: 3120 },
    { name: 'Conductor', prefix: 'CD', label: 'Zugbegleiter', desc: 'Türen, Abfahrt und Fahrgäste', color: '#E8702A', members: 4380 },
    { name: 'Signaller', prefix: 'SG', label: 'Fahrdienstleiter', desc: 'Stellwerke bedienen, Fahrstraßen stellen', color: '#2FA65A', members: 1890 },
    { name: 'Junior Supervisor', prefix: 'J-SV', label: 'Aufsicht in Ausbildung', desc: 'Hilft bei Trainings und im Betrieb', color: '#55C3DD', members: 64, staff: true },
    { name: 'Supervisor', prefix: 'SV', label: 'Aufsicht & Ausbildung', desc: 'Trainings leiten, Betrieb überwachen', color: '#1FA9C9', members: 235, staff: true },
    { name: 'Driver Manager', prefix: 'DM', label: 'Leitung Driver', desc: 'Leitet den Bereich Driver', color: '#9C72DB', members: 3, staff: true },
    { name: 'Platform Staff Manager', prefix: 'PSM', label: 'Leitung Platform Staff', desc: 'Leitet den Bereich Platform Staff', color: '#9C72DB', members: 2, staff: true },
    { name: 'Conductor Manager', prefix: 'CDM', label: 'Leitung Conductor', desc: 'Leitet den Bereich Conductor', color: '#9C72DB', members: 2, staff: true },
    { name: 'Signaller Manager', prefix: 'SGM', label: 'Leitung Signaller', desc: 'Leitet den Bereich Signaller', color: '#9C72DB', members: 2, staff: true },
    { name: 'Public Relations Department', prefix: 'PRD', label: 'Öffentlichkeitsarbeit', desc: 'Neuigkeiten, Karriere und Bewerbungen', color: '#2346D8', members: 4, staff: true },
    { name: 'Project Engineer', prefix: 'PJE', label: 'Projekt-Ingenieur', desc: 'Entwickelt Strecken und Funktionen', color: '#E479AE', members: 5, staff: true },
    { name: 'Operation Manager', prefix: 'OM', label: 'Betriebsleitung', desc: 'Leitet den Spielbetrieb', color: '#8A5CD0', members: 2, staff: true },
    { name: 'Community Director', prefix: 'CDR', label: 'Community-Leitung', desc: 'Leitet die Community', color: '#3CB98C', members: 1, staff: true },
    { name: 'Chief Engineer', prefix: 'CEN', label: 'Chefentwickler', desc: 'Leitung von Train Sim Germany', color: '#D12FC8', members: 1, staff: true },
  ],

  // Öffentliche Roblox-Daten (Name, Profilbild, Rolle in der Gruppe) über einen Proxy mit CORS laden.
  // Roblox selbst erlaubt diese Abfragen nicht direkt aus dem Browser.
  // Der Login (OAuth 2.0) wird in assets/js/config.js eingerichtet (nur die Client-ID).
  roblox: {
    usersApi: 'https://users.roproxy.com',
    thumbnailsApi: 'https://thumbnails.roproxy.com',
    groupsApi: 'https://groups.roproxy.com',
    gamesApi: 'https://games.roproxy.com',
    apisApi: 'https://apis.roproxy.com',
    // Discord: Mitgliederzahl über den Einladungslink aus links.discord
    discordApi: 'https://discord.com/api/v10',
  },

  // Spielernamen für die Besatzung auf den Servern (Demo)
  crew: [
    'Lokfuehrer_Max', 'ICEspeed2009', 'Nordlicht_Mia', 'Weichenwolf',
    'Paula_Pendolino', 'BR218Fan', 'Stellwerk_Tim', 'TrainSpotterJan',
    'Taktfahrplan', 'S_Bahn_Sven', 'Gleis9dreiviertel', 'Rangierlok_Rudi',
    'Fahrdienst_Finn', 'xXRegioXx', 'BahnFan_Lea',
  ],

  // Demo-Wochenplan (ohne Backend): Tag 0 = heute, Uhrzeit in MEZ. Die App plant daraus zwei Wochen.
  // Mit Backend bieten Supervisor und höher echte Trainings direkt in der App an.
  // type = Rang, den man nach bestandenem Training erhält (immer genau einer).
  trainings: [
    { day: 0, time: '17:00', dur: 60, type: 'Qualified Driver', title: 'Grundausbildung Qualified Driver', host: 'Lokfuehrer_Max', server: 'Driver-Training', slots: 12, taken: 9 },
    { day: 0, time: '20:30', dur: 60, type: 'Signaller', title: 'Stellwerk Magdeburg Hbf', host: 'Nordlicht_Mia', server: 'Signaller-Training', slots: 8, taken: 8 },
    { day: 0, time: '18:30', dur: 45, type: 'Platform Staff', title: 'Abfertigung am Bahnsteig', host: 'S_Bahn_Sven', server: 'Ostnetz #2', slots: 12, taken: 5 },
    { day: 1, time: '15:00', dur: 45, type: 'Conductor', title: 'Türen, Abfahrt & Ansagen', host: 'BahnFan_Lea', server: 'Ostnetz #1', slots: 15, taken: 6 },
    { day: 1, time: '19:00', dur: 60, type: 'Signaller', title: 'Stellwerk Leipzig Hbf', host: 'Weichenwolf', server: 'Signaller-Training', slots: 8, taken: 3 },
    { day: 2, time: '18:30', dur: 60, type: 'Conductor', title: 'Fernverkehr Berlin – Warschau', host: 'BR218Fan', server: 'Ostnetz #4', slots: 12, taken: 2 },
    { day: 3, time: '17:00', dur: 60, type: 'Qualified Driver', title: 'ICE Berlin – Leipzig', host: 'ICEspeed2009', server: 'Ostnetz #3', slots: 10, taken: 4 },
    { day: 3, time: '20:00', dur: 60, type: 'Signaller', title: 'Stellwerk Berlin Ostkreuz', host: 'Stellwerk_Tim', server: 'Signaller-Training', slots: 8, taken: 5 },
    { day: 4, time: '17:30', dur: 45, type: 'Platform Staff', title: 'Großbahnhof Leipzig Hbf', host: 'BahnFan_Lea', server: 'Ostnetz #2', slots: 12, taken: 3 },
    { day: 5, time: '16:00', dur: 45, type: 'Conductor', title: 'Service im Fernverkehr', host: 'S_Bahn_Sven', server: 'Ostnetz #1', slots: 15, taken: 11 },
    { day: 5, time: '20:00', dur: 60, type: 'Platform Staff', title: 'Berlin Hbf zur Hauptverkehrszeit', host: 'Taktfahrplan', server: 'Ostnetz #6', slots: 10, taken: 4 },
    { day: 6, time: '18:00', dur: 60, type: 'Qualified Driver', title: 'S-Bahn Mitteldeutschland im Takt', host: 'Paula_Pendolino', server: 'Driver-Training', slots: 12, taken: 7 },
  ],

  // Bild und Kurzbeschreibung je Trainingsart
  trainingTypes: [
    { name: 'Qualified Driver', img: 'play.svg', text: 'Signale, Bremsen und Fahrplan: Als Learning Driver fährst du deinen ersten Zug sicher ans Ziel und wirst Qualified Driver.' },
    { name: 'Platform Staff', img: 'role-platform.svg', text: 'Bahnsteig sichern, Fahrgäste lenken und mit der Kelle den Abfahrtsauftrag geben.' },
    { name: 'Conductor', img: 'role-conductor.svg', text: 'Türen, Abfahrtsauftrag und Ansagen: Du sorgst für eine pünktliche Abfahrt.' },
    { name: 'Signaller', img: 'training.svg', text: 'Fahrstraßen stellen und Züge sicher durchs Stellwerk leiten.' },
  ],

  // Startseite: Rollen-Karten. {rank} = Rangname in seiner Farbe, {group} = Link zur Roblox-Gruppe
  roleCards: [
    { rank: 'Learning Driver', img: 'route-city.svg', title: 'Starte als {rank}.', text: 'Tritt der {group} bei und du startest als {rank}. Fahr deine ersten Züge durch den Osten – von Magdeburg über Halle und Leipzig bis Berlin und weiter nach Warschau.' },
    { rank: 'Qualified Driver', img: 'play.svg', title: 'Fahr Züge als {rank} durchs ganze Netz.', text: 'Besuche ein {rank}-Training. Danach fährst du ICE, Intercity, Regionalzüge und S-Bahnen nach echtem Fahrplan.' },
    { rank: 'Platform Staff', img: 'role-platform.svg', title: 'Sorg als {rank} für pünktliche Abfahrten.', text: 'Sichere den Bahnsteig, lenke die Fahrgäste und gib mit der Kelle den Abfahrtsauftrag. Nach dem Training bist du als {rank} an jedem großen Bahnhof gefragt.' },
    { rank: 'Conductor', img: 'role-conductor.svg', title: 'Begleite Züge als {rank}.', text: 'Schließ die Türen, prüf die Fahrkarten und mach die Ansagen. Als {rank} bist du das Gesicht des Zuges und sorgst für eine pünktliche Abfahrt.' },
    { rank: 'Signaller', img: 'training.svg', title: 'Stell als {rank} die Fahrstraßen.', text: 'Übernimm ein Stellwerk wie Magdeburg Hbf oder Leipzig Hbf und leite die Züge sicher durch deinen Bereich – Signal für Signal.' },
  ],

  // Strecken mit Nummer (R001, R002, …) wie im Spiel
  routes: [
    { no: 'R001', title: 'Magdeburg – Berlin', from: 'Magdeburg Hbf', to: 'Berlin Hbf', line: 'RE 1', cat: 're', km: 142, dur: '1:39', stops: 9, rating: 4.8, reviews: '2,6K', img: 'route-city.svg', tag: 'Hauptstrecke' },
    { no: 'R002', title: 'Magdeburg – Leipzig', from: 'Magdeburg Hbf', to: 'Leipzig Hbf', line: 'RE 13', cat: 're', km: 118, dur: '1:37', stops: 9, rating: 4.7, reviews: '1,8K', img: 'route-forest.svg', tag: 'Über Dessau' },
    { no: 'R003', title: 'Magdeburg – Halle', from: 'Magdeburg Hbf', to: 'Halle (Saale) Hbf', line: 'RE 30', cat: 're', km: 86, dur: '1:00', stops: 5, rating: 4.6, reviews: '1,2K', img: 'route-rhine.svg', tag: 'Elbe & Saale' },
    { no: 'R004', title: 'S-Bahn Mitteldeutschland', from: 'Halle (Saale) Hbf', to: 'Leipzig Hbf', line: 'S 5', cat: 's', km: 38, dur: '0:39', stops: 9, rating: 4.7, reviews: '2,1K', img: 'route-city.svg', tag: 'City-Tunnel' },
    { no: 'R005', title: 'Leipzig – Berlin', from: 'Leipzig Hbf', to: 'Berlin Hbf', line: 'ICE 28', cat: 'ice', km: 190, dur: '1:12', stops: 4, rating: 4.8, reviews: '2,9K', img: 'play.svg', tag: '200 km/h' },
    { no: 'R006', title: 'Halle – Berlin', from: 'Halle (Saale) Hbf', to: 'Berlin Hbf', line: 'ICE 15', cat: 'ice', km: 166, dur: '1:10', stops: 5, rating: 4.6, reviews: '1,4K', img: 'play.svg', tag: '200 km/h' },
    { no: 'R007', title: 'Magdeburg – Halle – Leipzig', from: 'Magdeburg Hbf', to: 'Leipzig Hbf', line: 'IC 55', cat: 'ic', km: 120, dur: '1:20', stops: 4, rating: 4.6, reviews: '1,1K', img: 'route-rhine.svg', tag: 'Intercity' },
    { no: 'R008', title: 'Berliner Stadtbahn', from: 'Westkreuz', to: 'Ostkreuz', line: 'S 7', cat: 's', km: 12, dur: '0:24', stops: 7, rating: 4.7, reviews: '3,1K', img: 'route-city.svg', tag: 'Großstadt' },
    { no: 'R009', title: 'Berlin – Frankfurt (Oder)', from: 'Berlin Hbf', to: 'Frankfurt (Oder)', line: 'RE 1', cat: 're', km: 82, dur: '0:59', stops: 6, rating: 4.5, reviews: '960', img: 'route-forest.svg', tag: 'Richtung Polen' },
    { no: 'R010', title: 'Berlin – Warschau', from: 'Berlin Hbf', to: 'Warszawa Centralna', line: 'EC 95', cat: 'ec', km: 573, dur: '5:30', stops: 9, rating: 4.9, reviews: '870', img: 'route-coast.svg', tag: 'Neu in 2.5' },
  ],

  // Züge für „Meine Statistik“: daraus werden die meistgefahrenen Züge je Bereich angezeigt
  fleet: {
    fern: ['ICE 4', 'ICE 3', 'ICE T', 'ICE 1', 'IC 2', 'IC 1'],
    regio: ['Talent 2', 'KISS', 'FLIRT 3', 'Desiro HC', 'LINT 41', 'Doppelstock'],
    sbahn: ['BR 423', 'BR 430', 'BR 474', 'BR 481', 'BR 490'],
  },

  // Demo-Neuigkeiten (ohne Backend). Mit Backend schreibt das Public Relations Department sie in der App.
  // cat: update | event | community
  // video (optional): eigene Datei (assets/video/…mp4) oder ein YouTube-Link; poster = Vorschaubild
  news: [
    { id: 'n1', date: '2026-10-15', cat: 'update', tag: 'Update 2.5', video: 'assets/video/rheinstrecke.mp4', poster: 'assets/video/rheinstrecke.jpg', title: 'Berlin – Warschau jetzt in der Beta', text: '573 km über Frankfurt (Oder) und Poznań bis Warszawa Centralna – teste die neue Strecke auf dem Beta-Server. Neu sind außerdem 9 Bahnhöfe in Polen, das Stellwerk Frankfurt (Oder) und der EC „Berlin-Warszawa-Express“.', img: 'route-coast.svg' },
    { id: 'n2', date: '2026-10-12', cat: 'event', tag: 'Event', video: 'assets/video/nachtfahrt.mp4', poster: 'assets/video/nachtfahrt.jpg', title: 'Nachtfahrt-Wochenende mit Sonderzügen', text: 'Freitag bis Sonntag ab 21 Uhr: Nachtfahrplan, Sonderzüge und doppelte XP auf allen Event-Servern. Wer drei Nachtfahrten pünktlich schafft, bekommt das Abzeichen „Nachteule“.', img: 'route-city.svg' },
    { id: 'n3', date: '2026-10-08', cat: 'community', tag: 'Crew', title: 'Neue Stellwerke für Signaller', text: 'Magdeburg Hbf und Leipzig Hbf können jetzt von Spielern besetzt werden. Die passenden Signaller-Trainings starten diese Woche.', img: 'training.svg' },
    { id: 'n4', date: '2026-10-02', cat: 'update', tag: 'Update 2.4.1', title: 'Neue Abfahrtstafeln und weniger Ruckler', text: 'Bahnhöfe zeigen jetzt Live-Abfahrten mit Verspätungen an. Außerdem laufen große Bahnhöfe wie Berlin Hbf und Leipzig Hbf auf Handys spürbar flüssiger.', img: 'play.svg' },
    { id: 'n5', date: '2026-09-27', cat: 'community', tag: 'Community', title: 'Spieler der Woche: Nordlicht_Mia', text: 'Über 1.800 Fahrten und 98,6 % Pünktlichkeit – Nordlicht_Mia hält den S-Bahn-Takt in Mitteldeutschland zuverlässig am Laufen.', img: 'group.svg' },
    { id: 'n6', date: '2026-09-20', cat: 'event', tag: 'Event', title: 'Elbe-Rallye: Magdeburg – Berlin', text: 'Wer schafft Magdeburg – Berlin mit dem RE 1 am schnellsten und trotzdem pünktlich? Die Bestenliste läuft noch bis Sonntag.', img: 'route-forest.svg' },
  ],

  // Karriere: offene Stellen im Team
  jobs: [
    {
      id: 'game-developer', title: 'Game Developer', open: true, team: 'Entwicklung',
      text: 'Entwickle neue Strecken, Züge und Spielfunktionen für Train Sim Germany. Erfahrung mit Lua und Roblox Studio ist Voraussetzung.',
      tasks: ['Neue Spielfunktionen in Lua programmieren', 'Fehler finden und beheben', 'Mit Buildern und Testern zusammenarbeiten'],
      needs: ['Sicherer Umgang mit Lua und Roblox Studio', 'Mindestens 5 Stunden pro Woche Zeit', 'Discord-Account und Teamgeist'],
    },
    {
      id: 'map-builder', title: 'Map Builder', open: true, team: 'Entwicklung',
      text: 'Baue Bahnhöfe, Brücken und Landschaften nach echten Vorbildern – von der Nordsee bis in die Alpen.',
      tasks: ['Bahnhöfe und Strecken nach Vorbild bauen', 'Modelle für gute Leistung auf Handys optimieren', 'Feedback aus der Community umsetzen'],
      needs: ['Erfahrung mit Roblox Studio (Bauen, Terrain)', 'Auge für Details', 'Mindestens 4 Stunden pro Woche Zeit'],
    },
    {
      id: 'moderator', title: 'Moderator', open: false, team: 'Community',
      text: 'Sorge für eine freundliche Community, setze die Regeln durch und hilf Spielern im Spiel und auf Discord.',
      tasks: ['Regeln im Spiel und auf Discord durchsetzen', 'Spielern bei Fragen helfen', 'Meldungen bearbeiten und dokumentieren'],
      needs: ['Mindestens Rang Conductor', 'Ruhig und fair auch in hitzigen Situationen', 'Mindestens 14 Jahre alt'],
    },
    {
      id: 'supervisor', title: 'Supervisor', open: true, team: 'Betrieb & Ausbildung',
      text: 'Als Supervisor leitest du die Trainings in deinem Bereich – Qualified Driver, Platform Staff, Conductor oder Signaller – und behältst den Betrieb auf den Servern im Blick.',
      tasks: ['Trainings in deinem Bereich planen und leiten', 'Prüfungen abnehmen und Ränge vergeben', 'Server-Betrieb und Stellwerke überwachen', 'Bei Störungen schnell reagieren'],
      needs: ['Mindestens den Rang deines Bereichs (z. B. Signaller für den Bereich Signaller)', 'Geduld und klare Erklärungen', 'Mindestens 2 Trainings pro Woche'],
      // Bereiche in Reihenfolge des Ausbildungswegs. Wählbar ist jeder Bereich bis zum eigenen Rang.
      areas: ['Qualified Driver', 'Platform Staff', 'Conductor', 'Signaller'],
    },
    {
      id: 'social-media', title: 'Social Media', open: false, team: 'Community',
      text: 'Zeig Train Sim Germany auf TikTok, YouTube und Discord – mit Clips, Screenshots und Ankündigungen.',
      tasks: ['Clips und Screenshots aus dem Spiel erstellen', 'Updates und Events ankündigen', 'Kommentare und Fragen beantworten'],
      needs: ['Erfahrung mit Videoschnitt', 'Kreative Ideen', 'Mindestens 3 Stunden pro Woche Zeit'],
    },
  ],

  trainShare: [
    { label: 'ICE', value: 34 },
    { label: 'Regional-Express', value: 22 },
    { label: 'S-Bahn', value: 18 },
    { label: 'Intercity', value: 12 },
    { label: 'Regionalbahn', value: 9 },
    { label: 'Güterverkehr', value: 5 },
  ],

  punctualityByNet: [
    { label: 'Magdeburg', value: 95.2 },
    { label: 'Halle/Leipzig', value: 93.8 },
    { label: 'Berlin', value: 91.4 },
    { label: 'Berlin – Warschau', value: 86.9 },
  ],

  // Meistbefahrene Strecken (Nummer aus routes, Fahrten in 7 Tagen)
  topRoutes: [
    { no: 'R005', value: 18420 },
    { no: 'R008', value: 16210 },
    { no: 'R001', value: 14980 },
    { no: 'R004', value: 11340 },
    { no: 'R010', value: 9870 },
  ],
};
