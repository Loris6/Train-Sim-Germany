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
    { id: 'b1cb1816-7d85-457c-9f32-2a1422d00e17', name: 'Nordnetz #1', region: 'EU-West', network: 'Hamburg – Hannover – Berlin', players: 33, max: 35, ping: 28, uptime: 372, version: '2.4.1', type: 'public', lines: ['ice-28', 'ice-22', 'ic-31', 'ire-1', 're-3', 's-3'] },
    { id: '5bb7fb0f-d8d9-415b-8725-460b8ce504db', name: 'Nordnetz #2', region: 'EU-West', network: 'Hamburg – Kiel – Sylt', players: 18, max: 35, ping: 31, uptime: 160, version: '2.4.1', type: 'public', lines: ['ice-31', 'ic-26', 're-6', 're-7', 'rb-61', 's-3p'] },
    { id: 'ce9c02e4-aafb-4062-97ff-bbaaeca05990', name: 'Südnetz #1', region: 'EU-Central', network: 'München – Nürnberg – Garmisch', players: 35, max: 35, ping: 24, uptime: 663, version: '2.4.1', type: 'public', lines: ['ice-29', 'ic-87', 're-1', 'rb-6', 's-8m'] },
    { id: '0583542f-4cd5-413d-8c6e-3438c63be5a9', name: 'Westnetz #1', region: 'EU-West', network: 'Köln – Düsseldorf – Koblenz', players: 27, max: 35, ping: 33, uptime: 295, version: '2.4.1', type: 'public', lines: ['ice-43', 'ic-35', 're-5', 'rb-26', 's-6'] },
    { id: 'e35fd989-b021-4ac8-8c31-76236de8809a', name: 'Ostnetz #1', region: 'EU-Central', network: 'Berlin – Leipzig – Dresden', players: 12, max: 35, ping: 38, uptime: 58, version: '2.4.1', type: 'public', lines: ['ice-15', 'ic-17', 're-50', 're-3b', 's-7', 's-1d'] },
    { id: 'dde53f64-b9a5-4b5f-b3c1-8c1b55270a2c', name: 'Nachtfahrt-Event', region: 'EU-Central', network: 'Gesamtnetz · Nachtfahrplan', players: 48, max: 50, ping: 41, uptime: 80, version: '2.4.1', type: 'event', lines: ['ice-28', 'ice-22', 'ire-1', 're-6', 're-7', 'ice-29', 'rb-6', 'ice-41', 're-5', 're-50', 's-7'] },
    { id: '2e432cd4-4edb-4a59-89e3-2949b3995201', name: 'Signaller-Training', region: 'EU-West', network: 'Hannover Hbf · Ausbildung', players: 9, max: 12, ping: 27, uptime: 35, version: '2.4.1', type: 'training', focus: 'Signaller', lines: ['ice-22', 'ic-31', 're-2', 's-5'] },
    { id: '8a1e6f91-0951-4549-a823-213cb38eb51c', name: 'Driver-Training', region: 'EU-West', network: 'Hamburg – Bremen', players: 6, max: 10, ping: 29, uptime: 22, version: '2.4.1', type: 'training', focus: 'Driver', lines: ['ic-30', 're-4'] },
    { id: '5fbd48da-8157-4056-9496-0b4de48e224b', name: 'Westnetz #2', region: 'EU-West', network: 'Frankfurt – Köln (SFS)', players: 31, max: 35, ping: 35, uptime: 468, version: '2.4.1', type: 'public', lines: ['ice-41', 'ice-78', 're-9', 's-8f'] },
    { id: '1a306ce2-9f4a-4d58-afb7-fb492f5fca05', name: 'NA Network #1', region: 'US-East', network: 'Gesamtnetz', players: 22, max: 35, ping: 112, uptime: 190, version: '2.4.1', type: 'public', lines: ['ice-28', 'ice-29', 'ice-41', 'ic-17', 're-6', 're-1', 'rb-26', 's-3'] },
    { id: 'db4b4019-d184-4f29-8669-d2723a604f08', name: 'VIP · Lea & Friends', region: 'EU-West', network: 'Schwarzwaldbahn', players: 5, max: 12, ping: 26, uptime: 65, version: '2.4.1', type: 'vip', lines: ['re-2s', 'rb-37'] },
    { id: '233308a8-c720-4ded-8418-4a04f387583b', name: 'Beta · Update 2.5', region: 'EU-Central', network: 'Linke Rheinstrecke (neu)', players: 19, max: 20, ping: 30, uptime: 45, version: '2.5.0-beta', type: 'event', lines: ['ic-35r', 're-5r', 'rb-26r'] },
  ],

  // Linien im Spiel. stops = [Bahnhof, Minuten ab dem ersten Halt]. Gefahren wird in beide Richtungen.
  // every = Takt in Minuten, offset = erste Abfahrt nach Mitternacht (Minute), no = erste Zugnummer,
  // train = Fahrzeug, cat = Gattung (ice, ic, ire, re, rb, s).
  lines: {
    'ice-28': { name: 'ICE 28', cat: 'ice', train: 'ICE 4', every: 60, offset: 24, no: 500, stops: [['Hamburg Hbf', 0], ['Ludwigslust', 52], ['Berlin-Spandau', 92], ['Berlin Hbf', 105]] },
    'ice-22': { name: 'ICE 22', cat: 'ice', train: 'ICE 3', every: 60, offset: 46, no: 570, stops: [['Hamburg Hbf', 0], ['Hamburg-Harburg', 10], ['Lüneburg', 28], ['Uelzen', 47], ['Celle', 68], ['Hannover Hbf', 84]] },
    'ice-31': { name: 'ICE 31', cat: 'ice', train: 'ICE 4', every: 120, offset: 50, no: 1080, stops: [['Hamburg Hbf', 0], ['Hamburg Dammtor', 4], ['Neumünster', 42], ['Kiel Hbf', 68]] },
    'ice-29': { name: 'ICE 29', cat: 'ice', train: 'ICE 4', every: 60, offset: 55, no: 1500, stops: [['München Hbf', 0], ['Ingolstadt Hbf', 36], ['Nürnberg Hbf', 66]] },
    'ice-43': { name: 'ICE 43', cat: 'ice', train: 'ICE 3', every: 60, offset: 12, no: 600, stops: [['Düsseldorf Hbf', 0], ['Köln Hbf', 24], ['Bonn Hbf', 44], ['Koblenz Hbf', 78]] },
    'ice-41': { name: 'ICE 41', cat: 'ice', train: 'ICE 3', every: 60, offset: 54, no: 1020, stops: [['Köln Hbf', 0], ['Siegburg/Bonn', 17], ['Montabaur', 37], ['Limburg Süd', 47], ['Frankfurt Flughafen Fernbf', 60], ['Frankfurt (Main) Hbf', 70]] },
    'ice-78': { name: 'ICE 78', cat: 'ice', train: 'ICE 3', every: 120, offset: 20, no: 1110, stops: [['Köln Hbf', 0], ['Frankfurt Flughafen Fernbf', 50], ['Frankfurt (Main) Hbf', 62]] },
    'ice-15': { name: 'ICE 15', cat: 'ice', train: 'ICE T', every: 60, offset: 30, no: 1700, stops: [['Berlin Hbf', 0], ['Berlin Südkreuz', 7], ['Lutherstadt Wittenberg', 38], ['Bitterfeld', 55], ['Leipzig Hbf', 70]] },
    'ic-31': { name: 'IC 31', cat: 'ic', train: 'IC 2', every: 120, offset: 10, no: 2170, stops: [['Hamburg Hbf', 0], ['Hamburg-Harburg', 11], ['Lüneburg', 30], ['Uelzen', 50], ['Celle', 72], ['Hannover Hbf', 88]] },
    'ic-26': { name: 'IC 26', cat: 'ic', train: 'IC 1', every: 120, offset: 40, no: 2070, stops: [['Hamburg Hbf', 0], ['Elmshorn', 22], ['Itzehoe', 42], ['Heide (Holst)', 72], ['Husum', 98], ['Niebüll', 126], ['Westerland (Sylt)', 160]] },
    'ic-87': { name: 'IC 87', cat: 'ic', train: 'IC 1', every: 120, offset: 18, no: 2080, stops: [['München Hbf', 0], ['München-Pasing', 8], ['Weilheim (Oberbay)', 36], ['Murnau', 52], ['Garmisch-Partenkirchen', 72]] },
    'ic-35': { name: 'IC 35', cat: 'ic', train: 'IC 1', every: 120, offset: 28, no: 2000, stops: [['Düsseldorf Hbf', 0], ['Köln Hbf', 24], ['Bonn Hbf', 44], ['Remagen', 62], ['Andernach', 75], ['Koblenz Hbf', 88]] },
    'ic-35r': { name: 'IC 35', cat: 'ic', train: 'IC 1', every: 120, offset: 0, no: 2010, stops: [['Köln Hbf', 0], ['Bonn Hbf', 20], ['Koblenz Hbf', 56], ['Bingen (Rhein) Hbf', 93], ['Mainz Hbf', 112]] },
    'ic-17': { name: 'IC 17', cat: 'ic', train: 'IC 2', every: 120, offset: 37, no: 2430, stops: [['Berlin Hbf', 0], ['Berlin Südkreuz', 7], ['Doberlug-Kirchhain', 64], ['Elsterwerda', 76], ['Dresden-Neustadt', 112], ['Dresden Hbf', 120]] },
    'ic-30': { name: 'IC 30', cat: 'ic', train: 'IC 2', every: 120, offset: 55, no: 2200, stops: [['Hamburg Hbf', 0], ['Hamburg-Harburg', 10], ['Bremen Hbf', 56]] },
    'ire-1': { name: 'IRE 1', cat: 'ire', train: 'Doppelstock', every: 120, offset: 52, no: 4270, stops: [['Hamburg Hbf', 0], ['Büchen', 32], ['Hagenow Land', 50], ['Ludwigslust', 66], ['Wittenberge', 92], ['Berlin-Spandau', 140], ['Berlin Hbf', 152]] },
    're-3': { name: 'RE 3', cat: 're', train: 'Doppelstock', every: 60, offset: 5, no: 82100, stops: [['Hamburg Hbf', 0], ['Hamburg-Harburg', 11], ['Winsen (Luhe)', 22], ['Lüneburg', 32], ['Bad Bevensen', 46], ['Uelzen', 56]] },
    're-4': { name: 'RE 4', cat: 're', train: 'Doppelstock', every: 60, offset: 38, no: 82000, stops: [['Hamburg Hbf', 0], ['Hamburg-Harburg', 11], ['Buchholz (Nordheide)', 25], ['Tostedt', 36], ['Rotenburg (Wümme)', 55], ['Bremen Hbf', 75]] },
    're-6': { name: 'RE 6', cat: 're', train: 'Doppelstock', every: 60, offset: 15, no: 11000, stops: [['Hamburg-Altona', 0], ['Elmshorn', 22], ['Itzehoe', 45], ['Heide (Holst)', 80], ['Husum', 108], ['Niebüll', 140], ['Westerland (Sylt)', 185]] },
    're-7': { name: 'RE 7', cat: 're', train: 'FLIRT 3', every: 60, offset: 30, no: 21000, stops: [['Hamburg Hbf', 0], ['Hamburg Dammtor', 4], ['Elmshorn', 24], ['Neumünster', 48], ['Kiel Hbf', 75]] },
    're-1': { name: 'RE 1', cat: 're', train: 'Talent 2', every: 60, offset: 25, no: 4000, stops: [['München Hbf', 0], ['Petershausen', 24], ['Ingolstadt Hbf', 46], ['Kinding (Altmühltal)', 66], ['Allersberg', 80], ['Nürnberg Hbf', 100]] },
    're-5': { name: 'RE 5', cat: 're', train: 'Desiro HC', every: 60, offset: 40, no: 10500, stops: [['Düsseldorf Hbf', 0], ['Düsseldorf-Benrath', 10], ['Köln Hbf', 28], ['Bonn Hbf', 52], ['Remagen', 70], ['Andernach', 84], ['Koblenz Hbf', 98]] },
    're-5r': { name: 'RE 5', cat: 're', train: 'Desiro HC', every: 60, offset: 22, no: 10600, stops: [['Köln Hbf', 0], ['Bonn Hbf', 20], ['Remagen', 37], ['Andernach', 50], ['Koblenz Hbf', 63], ['Boppard Hbf', 80], ['St. Goar', 92], ['Oberwesel', 98], ['Bacharach', 104], ['Bingen (Rhein) Hbf', 115], ['Mainz Hbf', 130]] },
    're-9': { name: 'RE 9', cat: 're', train: 'FLIRT 3', every: 60, offset: 36, no: 10900, stops: [['Köln Hbf', 0], ['Köln Messe/Deutz', 4], ['Troisdorf', 16], ['Siegburg/Bonn', 21], ['Eitorf', 38], ['Au (Sieg)', 55], ['Siegen Hbf', 82]] },
    're-50': { name: 'RE 50', cat: 're', train: 'Doppelstock', every: 60, offset: 12, no: 16000, stops: [['Leipzig Hbf', 0], ['Wurzen', 17], ['Oschatz', 33], ['Riesa', 45], ['Coswig (b Dresden)', 66], ['Dresden-Neustadt', 80], ['Dresden Hbf', 87]] },
    're-3b': { name: 'RE 3', cat: 're', train: 'KISS', every: 60, offset: 50, no: 3300, stops: [['Berlin Hbf', 0], ['Berlin Südkreuz', 7], ['Ludwigsfelde', 21], ['Jüterbog', 50], ['Lutherstadt Wittenberg', 76]] },
    're-2': { name: 'RE 2', cat: 're', train: 'Doppelstock', every: 60, offset: 20, no: 82800, stops: [['Hannover Hbf', 0], ['Hannover Messe/Laatzen', 8], ['Sarstedt', 14], ['Nordstemmen', 22], ['Elze (Han)', 28], ['Alfeld (Leine)', 40], ['Kreiensen', 60], ['Göttingen', 85]] },
    're-2s': { name: 'RE 2', cat: 're', train: 'Doppelstock', every: 60, offset: 5, no: 4700, stops: [['Offenburg', 0], ['Gengenbach', 10], ['Hausach', 24], ['Hornberg', 34], ['Triberg', 45], ['St. Georgen (Schwarzw)', 57], ['Villingen (Schwarzw)', 68], ['Donaueschingen', 80], ['Singen (Hohentwiel)', 105], ['Radolfzell', 113], ['Konstanz', 125]] },
    'rb-61': { name: 'RB 61', cat: 'rb', train: 'FLIRT 3', every: 60, offset: 45, no: 21600, stops: [['Hamburg Hbf', 0], ['Hamburg Dammtor', 4], ['Pinneberg', 18], ['Elmshorn', 28], ['Glückstadt', 40], ['Itzehoe', 52]] },
    'rb-6': { name: 'RB 6', cat: 'rb', train: 'Talent 2', every: 60, offset: 32, no: 59400, stops: [['München Hbf', 0], ['München-Pasing', 8], ['Starnberg', 24], ['Tutzing', 34], ['Weilheim (Oberbay)', 46], ['Murnau', 62], ['Oberau', 77], ['Garmisch-Partenkirchen', 88]] },
    'rb-26': { name: 'RB 26', cat: 'rb', train: 'FLIRT 3', every: 60, offset: 8, no: 25000, stops: [['Köln Hbf', 0], ['Bonn Hbf', 25], ['Remagen', 45], ['Andernach', 62], ['Koblenz Hbf', 80]] },
    'rb-26r': { name: 'RB 26', cat: 'rb', train: 'FLIRT 3', every: 60, offset: 52, no: 25300, stops: [['Köln Hbf', 0], ['Bonn Hbf', 25], ['Remagen', 45], ['Andernach', 62], ['Koblenz Hbf', 80], ['Boppard Hbf', 99], ['St. Goar', 113], ['Oberwesel', 120], ['Bacharach', 127], ['Bingen (Rhein) Hbf', 141], ['Ingelheim', 152], ['Mainz Hbf', 165]] },
    'rb-37': { name: 'RB 37', cat: 'rb', train: 'LINT 41', every: 60, offset: 35, no: 87300, stops: [['Offenburg', 0], ['Gengenbach', 12], ['Biberach (Baden)', 20], ['Haslach', 27], ['Hausach', 34]] },
    's-3': { name: 'S 3', cat: 's', train: 'BR 490', every: 10, offset: 2, no: 31100, stops: [['Hamburg-Altona', 0], ['Landungsbrücken', 5], ['Jungfernstieg', 9], ['Hamburg Hbf', 11], ['Hamburg-Harburg', 22]] },
    's-3p': { name: 'S 3', cat: 's', train: 'BR 490', every: 10, offset: 6, no: 31500, stops: [['Pinneberg', 0], ['Elbgaustraße', 9], ['Hamburg-Altona', 18], ['Jungfernstieg', 24], ['Hamburg Hbf', 27]] },
    's-8m': { name: 'S 8', cat: 's', train: 'BR 423', every: 20, offset: 4, no: 8100, stops: [['München-Pasing', 0], ['München Hbf', 7], ['Marienplatz', 11], ['München Ost', 15], ['Ismaning', 33], ['Flughafen München', 46]] },
    's-6': { name: 'S 6', cat: 's', train: 'BR 430', every: 20, offset: 14, no: 30600, stops: [['Düsseldorf Hbf', 0], ['Düsseldorf-Benrath', 12], ['Leverkusen Mitte', 28], ['Köln-Mülheim', 38], ['Köln Hbf', 46]] },
    's-8f': { name: 'S 8', cat: 's', train: 'BR 423', every: 15, offset: 3, no: 35800, stops: [['Frankfurt Flughafen Regionalbf', 0], ['Frankfurt-Stadion', 4], ['Frankfurt (Main) Hbf', 11], ['Hauptwache', 14], ['Konstablerwache', 16], ['Offenbach Ost', 27]] },
    's-7': { name: 'S 7', cat: 's', train: 'BR 481', every: 10, offset: 1, no: 7700, stops: [['Westkreuz', 0], ['Zoologischer Garten', 5], ['Berlin Hbf', 10], ['Friedrichstraße', 12], ['Alexanderplatz', 16], ['Ostbahnhof', 20], ['Ostkreuz', 24]] },
    's-1d': { name: 'S 1', cat: 's', train: 'Doppelstock', every: 30, offset: 9, no: 33100, stops: [['Meißen Triebischtal', 0], ['Coswig (b Dresden)', 16], ['Radebeul Ost', 26], ['Dresden-Neustadt', 36], ['Dresden Hbf', 43]] },
    's-5': { name: 'S 5', cat: 's', train: 'BR 424', every: 30, offset: 11, no: 34500, stops: [['Hannover Flughafen', 0], ['Langenhagen Mitte', 7], ['Hannover Hbf', 18], ['Hannover Messe/Laatzen', 28]] },
  },

  // Reihenfolge = Ausbildungsweg. Nach jedem Training steigt man einen Rang auf.
  // Guest = nicht in der Roblox-Gruppe. Beim Roblox-Login kommt der Rang aus der Rolle in der Gruppe
  // (Name oder Kürzel der Rolle, z. B. „Driver“ oder „[D] Driver“).
  // prefix = Kürzel vor dem Profilbild, members = Spieler mit diesem Rang in der Gruppe.
  // staff = Teamrang ohne eigenes Training (zählt nicht als Voraussetzung für Trainings).
  ranks: [
    { name: 'Guest', prefix: 'G', label: 'Gast', desc: 'Noch nicht in der Roblox-Gruppe', color: '#AFB4BB', members: 0, guest: true },
    { name: 'Passenger', prefix: 'UD', label: 'Fahrgast', desc: 'Neu im Spiel, noch ohne Ausbildung', color: '#878C96', members: 18420 },
    { name: 'Driver', prefix: 'D', label: 'Lokführer', desc: 'Züge sicher und pünktlich fahren', color: '#EC0016', members: 9650 },
    { name: 'Platform Staff', prefix: 'PS', label: 'Bahnsteigpersonal', desc: 'Bahnsteig sichern, Abfahrtsauftrag geben', color: '#00A099', members: 3120 },
    { name: 'Conductor', prefix: 'CD', label: 'Zugbegleiter', desc: 'Türen, Abfahrt und Fahrgäste', color: '#408335', members: 4380 },
    { name: 'Signaller', prefix: 'SG', label: 'Fahrdienstleiter', desc: 'Stellwerke bedienen, Fahrstraßen stellen', color: '#0C3992', members: 1890 },
    { name: 'Supervisor', prefix: 'SV', label: 'Aufsicht & Ausbildung', desc: 'Trainings leiten, Betrieb überwachen', color: '#0087B9', members: 235, staff: true },
    { name: 'Dispatcher', prefix: 'DS', label: 'Disponent', desc: 'Netz und Fahrplan steuern', color: '#814997', members: 610 },
    { name: 'Management', prefix: 'MG', label: 'Leitung', desc: 'Leitung von Train Sim Germany', color: '#3C414B', members: 12 },
  ],

  // Öffentliche Roblox-Daten (Name, Profilbild, Rolle in der Gruppe) über einen Proxy mit CORS laden.
  // Roblox selbst erlaubt diese Abfragen nicht direkt aus dem Browser.
  // Der Login (OAuth 2.0) wird in assets/js/config.js eingerichtet (nur die Client-ID).
  roblox: {
    usersApi: 'https://users.roproxy.com',
    thumbnailsApi: 'https://thumbnails.roproxy.com',
    groupsApi: 'https://groups.roproxy.com',
  },

  // Spielernamen für die Besatzung auf den Servern (Demo)
  crew: [
    'Lokfuehrer_Max', 'ICEspeed2009', 'Nordlicht_Mia', 'Weichenwolf',
    'Paula_Pendolino', 'BR218Fan', 'Stellwerk_Tim', 'TrainSpotterJan',
    'Taktfahrplan', 'S_Bahn_Sven', 'Gleis9dreiviertel', 'Rangierlok_Rudi',
    'Fahrdienst_Finn', 'xXRegioXx', 'BahnFan_Lea',
  ],

  // Wochenplan: Tag 0 = heute, Uhrzeit in MEZ. Die App plant daraus zwei Wochen.
  // type = Rang, den man nach bestandenem Training erhält.
  trainings: [
    { day: 0, time: '17:00', dur: 60, type: 'Driver', title: 'Grundausbildung Driver', host: 'Lokfuehrer_Max', server: 'Driver-Training', slots: 12, taken: 9 },
    { day: 0, time: '20:30', dur: 60, type: 'Signaller', title: 'Stellwerk Hannover Hbf', host: 'Nordlicht_Mia', server: 'Signaller-Training', slots: 8, taken: 8 },
    { day: 0, time: '18:30', dur: 45, type: 'Platform Staff', title: 'Abfertigung am Bahnsteig', host: 'S_Bahn_Sven', server: 'Nordnetz #2', slots: 12, taken: 5 },
    { day: 1, time: '15:00', dur: 45, type: 'Conductor', title: 'Türen, Abfahrt & Ansagen', host: 'BahnFan_Lea', server: 'Nordnetz #2', slots: 15, taken: 6 },
    { day: 1, time: '19:00', dur: 60, type: 'Signaller', title: 'Stellwerk Köln Hbf', host: 'Weichenwolf', server: 'Signaller-Training', slots: 8, taken: 3 },
    { day: 2, time: '18:30', dur: 60, type: 'Dispatcher', title: 'Fahrplan & Störungen', host: 'BR218Fan', server: 'Südnetz #1', slots: 6, taken: 2 },
    { day: 3, time: '17:00', dur: 60, type: 'Driver', title: 'ICE auf der Schnellfahrstrecke', host: 'ICEspeed2009', server: 'Westnetz #2', slots: 10, taken: 4 },
    { day: 3, time: '20:00', dur: 60, type: 'Signaller', title: 'Stellwerk Berlin Ostkreuz', host: 'Stellwerk_Tim', server: 'Signaller-Training', slots: 8, taken: 5 },
    { day: 4, time: '17:30', dur: 45, type: 'Platform Staff', title: 'Großbahnhof Köln Hbf', host: 'BahnFan_Lea', server: 'Westnetz #1', slots: 12, taken: 3 },
    { day: 5, time: '16:00', dur: 45, type: 'Conductor', title: 'Service im Fernverkehr', host: 'S_Bahn_Sven', server: 'Nordnetz #1', slots: 15, taken: 11 },
    { day: 5, time: '20:00', dur: 60, type: 'Dispatcher', title: 'Leitstelle Nordnetz', host: 'Taktfahrplan', server: 'Nordnetz #1', slots: 6, taken: 4 },
    { day: 6, time: '18:00', dur: 60, type: 'Driver', title: 'S-Bahn Hamburg im Takt', host: 'Paula_Pendolino', server: 'Nordnetz #2', slots: 12, taken: 7 },
  ],

  // Bild und Kurzbeschreibung je Trainingsart
  trainingTypes: [
    { name: 'Driver', img: 'play.svg', text: 'Signale, Bremsen und Fahrplan: Du fährst deinen ersten Zug sicher ans Ziel.' },
    { name: 'Platform Staff', img: 'role-platform.svg', text: 'Bahnsteig sichern, Fahrgäste lenken und mit der Kelle den Abfahrtsauftrag geben.' },
    { name: 'Conductor', img: 'role-conductor.svg', text: 'Türen, Abfahrtsauftrag und Ansagen: Du sorgst für eine pünktliche Abfahrt.' },
    { name: 'Signaller', img: 'training.svg', text: 'Fahrstraßen stellen und Züge sicher durchs Stellwerk leiten.' },
    { name: 'Dispatcher', img: 'role-dispatcher.svg', text: 'Das ganze Netz im Blick: Fahrplan, Störungen und Umleitungen steuern.' },
  ],

  // Startseite: Rollen-Karten. {rank} = Rangname in seiner Farbe, {group} = Link zur Roblox-Gruppe
  roleCards: [
    { rank: 'Passenger', img: 'route-coast.svg', title: 'Fahr als {rank} mit.', text: 'Lehn dich zurück und genieß die Fahrt durch Deutschland – von der Nordseeküste bis in die Alpen. Als {rank} entdeckst du Dutzende Bahnhöfe, vom kleinen Haltepunkt bis zum großen Hauptbahnhof.' },
    { rank: 'Driver', img: 'play.svg', title: 'Fahr Züge als {rank} durchs ganze Netz.', text: 'Tritt der {group} bei und besuche ein {rank}-Training. Danach fährst du ICE, Regionalzüge und S-Bahnen nach echtem Fahrplan.' },
    { rank: 'Platform Staff', img: 'role-platform.svg', title: 'Sorg als {rank} für pünktliche Abfahrten.', text: 'Sichere den Bahnsteig, lenke die Fahrgäste und gib mit der Kelle den Abfahrtsauftrag. Nach dem Training bist du als {rank} an jedem großen Bahnhof gefragt.' },
    { rank: 'Conductor', img: 'role-conductor.svg', title: 'Begleite Züge als {rank}.', text: 'Schließ die Türen, prüf die Fahrkarten und mach die Ansagen. Als {rank} bist du das Gesicht des Zuges und sorgst für eine pünktliche Abfahrt.' },
    { rank: 'Signaller', img: 'training.svg', title: 'Stell als {rank} die Fahrstraßen.', text: 'Übernimm ein Stellwerk wie Hannover Hbf oder Köln Hbf und leite die Züge sicher durch deinen Bereich – Signal für Signal.' },
  ],

  // Strecken mit Nummer (R001, R002, …) wie im Spiel
  routes: [
    { no: 'R001', title: 'Marschbahn', from: 'Hamburg-Altona', to: 'Westerland (Sylt)', line: 'RE 6', cat: 're', km: 237, dur: '3:05', stops: 14, rating: 4.9, reviews: '2,4K', img: 'route-coast.svg', tag: 'Küste' },
    { no: 'R002', title: 'Werdenfelsbahn', from: 'München Hbf', to: 'Garmisch-Partenkirchen', line: 'RB 6', cat: 'rb', km: 101, dur: '1:28', stops: 12, rating: 4.8, reviews: '1,9K', img: 'route-alps.svg', tag: 'Alpen' },
    { no: 'R003', title: 'Berliner Stadtbahn', from: 'Westkreuz', to: 'Ostbahnhof', line: 'S7', cat: 's', km: 12, dur: '0:24', stops: 10, rating: 4.7, reviews: '3,1K', img: 'route-city.svg', tag: 'Großstadt' },
    { no: 'R004', title: 'Linke Rheinstrecke', from: 'Köln Hbf', to: 'Mainz Hbf', line: 'RE 5', cat: 're', km: 185, dur: '2:10', stops: 18, rating: 4.9, reviews: '980', img: 'route-rhine.svg', tag: 'Neu in 2.5' },
    { no: 'R005', title: 'Schwarzwaldbahn', from: 'Offenburg', to: 'Konstanz', line: 'RE 2', cat: 're', km: 149, dur: '2:05', stops: 21, rating: 4.8, reviews: '1,2K', img: 'route-forest.svg', tag: 'Gebirge' },
    { no: 'R006', title: 'SFS Hannover – Würzburg', from: 'Hannover Hbf', to: 'Würzburg Hbf', line: 'ICE 23', cat: 'ice', km: 327, dur: '1:58', stops: 4, rating: 4.6, reviews: '2,0K', img: 'play.svg', tag: '280 km/h' },
    { no: 'R007', title: 'Hamburg – Berlin', from: 'Hamburg Hbf', to: 'Berlin Hbf', line: 'ICE 28', cat: 'ice', km: 289, dur: '1:45', stops: 3, rating: 4.7, reviews: '2,8K', img: 'play.svg', tag: '230 km/h' },
    { no: 'R008', title: 'S-Bahn Hamburg', from: 'Wedel', to: 'Poppenbüttel', line: 'S1', cat: 's', km: 46, dur: '1:00', stops: 25, rating: 4.6, reviews: '2,2K', img: 'route-city.svg', tag: 'Großstadt' },
    { no: 'R009', title: 'SFS Köln – Frankfurt', from: 'Köln Hbf', to: 'Frankfurt (Main) Hbf', line: 'ICE 41', cat: 'ice', km: 180, dur: '1:10', stops: 3, rating: 4.7, reviews: '1,6K', img: 'route-rhine.svg', tag: '300 km/h' },
    { no: 'R010', title: 'Hamburg – Kiel', from: 'Hamburg Hbf', to: 'Kiel Hbf', line: 'RE 7', cat: 're', km: 105, dur: '1:15', stops: 6, rating: 4.5, reviews: '1,1K', img: 'route-coast.svg', tag: 'Küste' },
  ],

  // Züge für „Meine Statistik“: daraus werden die meistgefahrenen Züge je Bereich angezeigt
  fleet: {
    fern: ['ICE 4', 'ICE 3', 'ICE T', 'ICE 1', 'IC 2', 'IC 1'],
    regio: ['Talent 2', 'KISS', 'FLIRT 3', 'Desiro HC', 'LINT 41', 'Doppelstock'],
    sbahn: ['BR 423', 'BR 430', 'BR 474', 'BR 481', 'BR 490'],
  },

  // cat: update | event | community
  // video (optional): eigene Datei (assets/video/…mp4) oder ein YouTube-Link; poster = Vorschaubild
  news: [
    { date: '2026-10-15', cat: 'update', tag: 'Update 2.5', video: 'assets/video/rheinstrecke.mp4', poster: 'assets/video/rheinstrecke.jpg', title: 'Linke Rheinstrecke jetzt in der Beta', text: 'Burgen, Weinberge und 185 km Strecke zwischen Köln und Mainz – teste sie auf dem Beta-Server. Neu sind außerdem 18 Bahnhöfe, das Stellwerk Koblenz und der Fahrzeugtyp BR 429.', img: 'route-rhine.svg' },
    { date: '2026-10-12', cat: 'event', tag: 'Event', video: 'assets/video/nachtfahrt.mp4', poster: 'assets/video/nachtfahrt.jpg', title: 'Nachtfahrt-Wochenende mit Sonderzügen', text: 'Freitag bis Sonntag ab 21 Uhr: Nachtfahrplan, Sonderzüge und doppelte XP auf allen Event-Servern. Wer drei Nachtfahrten pünktlich schafft, bekommt das Abzeichen „Nachteule“.', img: 'route-city.svg' },
    { date: '2026-10-08', cat: 'community', tag: 'Crew', title: 'Neue Stellwerke für Signaller', text: 'Köln Hbf und Berlin Ostkreuz können jetzt von Spielern besetzt werden. Die passenden Signaller-Trainings starten diese Woche.', img: 'training.svg' },
    { date: '2026-10-02', cat: 'update', tag: 'Update 2.4.1', title: 'Neue Abfahrtstafeln und weniger Ruckler', text: 'Bahnhöfe zeigen jetzt Live-Abfahrten mit Verspätungen an. Außerdem laufen große Bahnhöfe auf Handys spürbar flüssiger.', img: 'play.svg' },
    { date: '2026-09-27', cat: 'community', tag: 'Community', title: 'Spieler der Woche: Nordlicht_Mia', text: 'Über 1.800 Fahrten und 98,6 % Pünktlichkeit – Nordlicht_Mia hält den S-Bahn-Takt in Hamburg zuverlässig am Laufen.', img: 'group.svg' },
    { date: '2026-09-20', cat: 'event', tag: 'Event', video: 'assets/video/alpen-rallye.mp4', poster: 'assets/video/alpen-rallye.jpg', title: 'Alpen-Rallye auf der Werdenfelsbahn', text: 'Wer schafft München – Garmisch am schnellsten und trotzdem pünktlich? Die Bestenliste läuft noch bis Sonntag.', img: 'route-alps.svg' },
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
      text: 'Als Supervisor leitest du die Trainings in deinem Bereich – Driver, Platform Staff, Conductor oder Signaller – und behältst den Betrieb auf den Servern im Blick.',
      tasks: ['Trainings in deinem Bereich planen und leiten', 'Prüfungen abnehmen und Ränge vergeben', 'Server-Betrieb und Stellwerke überwachen', 'Bei Störungen schnell reagieren'],
      needs: ['Mindestens den Rang deines Bereichs (z. B. Signaller für den Bereich Signaller)', 'Geduld und klare Erklärungen', 'Mindestens 2 Trainings pro Woche'],
      // Bereiche in Reihenfolge des Ausbildungswegs. Wählbar ist jeder Bereich bis zum eigenen Rang.
      areas: ['Driver', 'Platform Staff', 'Conductor', 'Signaller'],
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
    { label: 'Nordnetz', value: 96.1 },
    { label: 'Südnetz', value: 93.4 },
    { label: 'Westnetz', value: 90.8 },
    { label: 'Ostnetz', value: 87.2 },
  ],

  // Meistbefahrene Strecken (Nummer aus routes, Fahrten in 7 Tagen)
  topRoutes: [
    { no: 'R007', value: 18420 },
    { no: 'R008', value: 16210 },
    { no: 'R009', value: 14980 },
    { no: 'R002', value: 11340 },
    { no: 'R010', value: 9870 },
  ],
};
