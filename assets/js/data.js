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
    group: 'https://www.roblox.com/search/communities?keyword=Train%20Sim%20Germany',
    discord: 'https://discord.gg/DEIN-EINLADUNGSCODE',
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

  servers: [
    { name: 'Nordnetz #1', region: 'EU-West', network: 'Hamburg – Hannover – Berlin', players: 33, max: 35, ping: 28, uptime: 372, version: '2.4.1', trains: 16, type: 'public' },
    { name: 'Nordnetz #2', region: 'EU-West', network: 'Hamburg – Kiel – Sylt', players: 18, max: 35, ping: 31, uptime: 160, version: '2.4.1', trains: 9, type: 'public' },
    { name: 'Südnetz #1', region: 'EU-Central', network: 'München – Nürnberg – Garmisch', players: 35, max: 35, ping: 24, uptime: 663, version: '2.4.1', trains: 18, type: 'public' },
    { name: 'Westnetz #1', region: 'EU-West', network: 'Köln – Düsseldorf – Koblenz', players: 27, max: 35, ping: 33, uptime: 295, version: '2.4.1', trains: 14, type: 'public' },
    { name: 'Ostnetz #1', region: 'EU-Central', network: 'Berlin – Leipzig – Dresden', players: 12, max: 35, ping: 38, uptime: 58, version: '2.4.1', trains: 6, type: 'public' },
    { name: 'Nachtfahrt-Event', region: 'EU-Central', network: 'Gesamtnetz · Nachtfahrplan', players: 48, max: 50, ping: 41, uptime: 80, version: '2.4.1', trains: 24, type: 'event' },
    { name: 'Signaller-Training', region: 'EU-West', network: 'Hannover Hbf · Ausbildung', players: 9, max: 12, ping: 27, uptime: 35, version: '2.4.1', trains: 4, type: 'training' },
    { name: 'Driver-Training', region: 'EU-West', network: 'Hamburg – Bremen', players: 6, max: 10, ping: 29, uptime: 22, version: '2.4.1', trains: 3, type: 'training' },
    { name: 'Westnetz #2', region: 'EU-West', network: 'Frankfurt – Köln (SFS)', players: 31, max: 35, ping: 35, uptime: 468, version: '2.4.1', trains: 15, type: 'public' },
    { name: 'NA Network #1', region: 'US-East', network: 'Gesamtnetz', players: 22, max: 35, ping: 112, uptime: 190, version: '2.4.1', trains: 11, type: 'public' },
    { name: 'VIP · Lea & Friends', region: 'EU-West', network: 'Schwarzwaldbahn', players: 5, max: 12, ping: 26, uptime: 65, version: '2.4.1', trains: 3, type: 'vip' },
    { name: 'Beta · Update 2.5', region: 'EU-Central', network: 'Linke Rheinstrecke (neu)', players: 19, max: 20, ping: 30, uptime: 45, version: '2.5.0-beta', trains: 8, type: 'event' },
  ],

  // Reihenfolge = Ausbildungsweg. Nach jedem Training steigt man einen Rang auf.
  // prefix = Kürzel vor dem Profilbild, members = Spieler mit diesem Rang in der Gruppe.
  // staff = Teamrang ohne eigenes Training (zählt nicht als Voraussetzung für Trainings).
  ranks: [
    { name: 'Passenger', prefix: 'UD', label: 'Fahrgast', desc: 'Neu im Spiel, noch ohne Ausbildung', color: '#878C96', members: 18420 },
    { name: 'Driver', prefix: 'D', label: 'Lokführer', desc: 'Züge sicher und pünktlich fahren', color: '#EC0016', members: 9650 },
    { name: 'Platform Staff', prefix: 'PS', label: 'Bahnsteigpersonal', desc: 'Bahnsteig sichern, Abfahrtsauftrag geben', color: '#00A099', members: 3120 },
    { name: 'Conductor', prefix: 'CD', label: 'Zugbegleiter', desc: 'Türen, Abfahrt und Fahrgäste', color: '#408335', members: 4380 },
    { name: 'Signaller', prefix: 'SG', label: 'Fahrdienstleiter', desc: 'Stellwerke bedienen, Fahrstraßen stellen', color: '#0C3992', members: 1890 },
    { name: 'Supervisor', prefix: 'SV', label: 'Aufsicht & Ausbildung', desc: 'Trainings leiten, Betrieb überwachen', color: '#0087B9', members: 235, staff: true },
    { name: 'Dispatcher', prefix: 'DS', label: 'Disponent', desc: 'Netz und Fahrplan steuern', color: '#814997', members: 610 },
    { name: 'Management', prefix: 'MG', label: 'Leitung', desc: 'Leitung von Train Sim Germany', color: '#3C414B', members: 12 },
  ],

  // Profil mit Roblox verbinden: öffentliche Roblox-Daten (Name, Profilbild) über einen
  // Proxy mit CORS laden. Roblox selbst erlaubt keine Abfragen direkt aus dem Browser.
  // Für einen echten Login (OAuth) braucht es einen eigenen Server.
  roblox: {
    usersApi: 'https://users.roproxy.com',
    thumbnailsApi: 'https://thumbnails.roproxy.com',
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
