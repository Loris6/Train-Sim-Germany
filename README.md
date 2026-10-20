# Train Sim Germany

Die Web-App zum Roblox-Spiel **Train Sim Germany**: Trainings, Server, News, Statistiken und Karriere, alles an einem Ort.

Die Seite ist reines HTML, CSS und JavaScript. Es gibt keinen Build-Schritt, sie läuft direkt auf GitHub Pages oder jedem anderen Webserver.

## Seiten

| Seite | Inhalt |
|---|---|
| **Start** | Titelbereich mit Logo und Begrüßung, Rollen-Karten (Passenger, Driver, Platform Staff, Conductor, Signaller) mit Spielerzahl, nächstes Training, Strecken mit Nummer (R001, R002, …), Kennzahlen, Karriere, News |
| **Server** | Serverliste mit Auslastung, Linien (ICE, IC, IRE, RE, RB, S-Bahn), Rollen (Driver, Conductor, Platform Staff, Signaller, Dispatcher, Passenger), Ping, Laufzeit und **Details**-Button. Die Detailseite (`#/server/<id>`) zeigt live alle **Züge** als Karten (Position, Verspätung, Lokführer bzw. KI, Zugbegleiter, Fahrgäste) mit Details-Button für den **Fahrtverlauf**, alle **Spieler** nach Rolle (wer wo Platform Staff ist, wer im Stellwerk sitzt, wer welchen Zug fährt) und alle **Stationen**. Ein Klick auf eine Station zeigt die kommenden Züge mit Gleis, Platform Staff und Stellwerk. Die Adresse ist die Server-ID aus dem Spiel (`#/server/b1cb1816-…`), sie steht auch auf der Detailseite (antippen = kopieren). „Beitreten“ startet Roblox direkt in genau diesem Server |
| **News** | Neuigkeiten mit Kategorien (Updates, Events, Community), Beiträge mit Video (Play-Symbol auf der Karte). In der Detailansicht beginnt Bild bzw. Video ganz oben in der Rundung, Griff und Schließen liegen darauf |
| **Karriere** | Offene Stellen mit Status, Detailseite mit Verantwortlichkeiten und Anforderungen, eigene Bewerbungsseite je Stelle mit 60 Fragen in drei Sektoren: 1. Über dich (Roblox, Discord, E-Mail, Spielzeit, Rang), 2. Grundwissen (40 Fragen; beim Supervisor im gewählten Bereich Driver, Platform Staff, Conductor oder Signaller), 3. Erfahrung & Zeit (20 Fragen, u. a. Aktivität und freie Tage per Schieberegler, bei Game Developer, Map Builder und Social Media Links mit Art). Oben zählt „x von 60 Fragen beantwortet“ mit |
| **Statistiken** | Kennzahlen, Spieler-online-Diagramm (24 Std. / 7 Tage / 30 Tage), Zuggattungen, Pünktlichkeit, meistbefahrene Strecken (mit Streckennummer) |
| **Trainings** | Dein Rang und dein nächster Ausbildungsschritt (z. B. Conductor → Signaller), Tagesleiste über 14 Tage (roter Punkt = Trainings). Angezeigt werden nur die Trainings für den nächsten Rang – ein Conductor sieht also nur Signaller-Trainings; Supervisor und Management sehen alle. Trainingskarten mit Serverstatus (offen, öffnet in … Min., geschlossen), alle kommenden Termine. In der Detailansicht ist „Join Now“ grau, bis der Server offen ist, dann hellblau. Der Server öffnet 15 Minuten vor Beginn. **Benachrichtigungen:** Oben links auf jeder Trainingskarte (gegenüber der Server-Anzeige) und im Detail sitzt eine Glocke. Eingeschaltet leuchtet sie rot, und das Gerät bekommt eine echte Benachrichtigung (wie bei YouTube oder Gmail), sobald der Server öffnet – mit Training, Uhrzeit, Server, Leitung und Knopf „Beitreten“. Die Glocke oben schaltet das für alle Trainings des nächsten Rangs ein |
| **Einstellungen** | Darstellung: Hell, Dunkel oder Mit Gerät synchronisieren (folgt automatisch der Einstellung von Handy oder PC), Sprache als Dropdown mit Flagge (Automatisch = Gerätesprache, Deutsch, English, Français, Español, Italiano, Nederlands, Polski, Türkçe), Privatsphäre mit zwei Schaltern („Profil öffentlich“ und „Zeige meine Statistik öffentlich an“, beide standardmäßig aus; die Statistik geht nur bei öffentlichem Profil), Roblox-Konto, App installieren, Links zu Datenschutz und Nutzungsbedingungen |
| **Datenschutz** · **Nutzungsbedingungen** | Eigene Seiten `privacy.html` und `terms.html` (z. B. für die Roblox-OAuth-App). Name, Adresse, E-Mail und Datum kommen aus `assets/js/config.js` |

## Design

- Schrift: **Rubik**, lokal eingebunden (`assets/fonts`, SIL Open Font License)
- Icons: **[UIcons von Flaticon](https://www.flaticon.com/uicons)** (Regular Rounded, Solid Rounded, Brands). Eingebunden sind nur die genutzten Icons (ca. 5 KB). Die Flaticon-Lizenz verlangt eine Namensnennung, sie steht in der Fußzeile.
- Aufbau nach dem [DB UX Design System](https://github.com/db-ux-design-system/core-web) (Generation 3, Apache-2.0): weiße Kopfzeile, große Überschriften, Buttons mit 40 px Höhe (Rot für die Hauptaktion, sonst grau oder mit Rand), graue Eingabefelder, Karten mit 1 px Rand, blauer Fokusrahmen. Abstände und Schatten sind die Werte aus dem DB UX Design System, die Ecken sind etwas runder (Buttons und Felder 8 px, Karten 12 px). DB-Logo und DB-Schriften werden nicht verwendet.
- Aktive Elemente (Tabs, Menü) sind grau eingerahmt mit Hintergrund, in der Leiste unten ist das aktive Icon rot mit rotem Punkt darunter, Tage mit Trainings haben einen roten Punkt – keine Unterstriche
- Farben: DB-Rot `#EC0016` und die Cool-Gray-Töne der DB, Gleisnummern im DB-Blau wie an den Bahnhofsschildern
- Uhr mit deutscher Zeit (MEZ/MESZ) im Menü
- Kein elastisches Nachfedern beim Scrollen (auf allen Seiten abgeschaltet)
- Kein Hineinzoomen auf allen Seiten: weder mit zwei Fingern noch per Doppeltippen, Strg/⌘ + Mausrad bzw. Touchpad oder Strg/⌘ + Plus/Minus (`assets/js/nozoom.js`, Viewport und `touch-action`)
- Responsiv für Handy, Tablet und Desktop
- Hell- und Dunkelmodus: in den Einstellungen Hell, Dunkel oder Mit Gerät synchronisieren (Standard)
- Acht Sprachen, Standard „Automatisch“ (siehe unten)
- Alle Illustrationen sind eigene SVGs in `assets/img`. Sie können jederzeit durch Screenshots aus dem Spiel ersetzt werden (gleicher Dateiname, z. B. als `.png`, dann den Pfad anpassen).

## App & Spielbild

Die Seite ist eine installierbare Web-App (PWA): Auf dem Handy über „Zum Startbildschirm hinzufügen“ bzw. „App installieren“ im Menü, am PC über das Installieren-Symbol in der Adressleiste. Danach startet sie wie eine eigene App mit Icon und funktioniert auch offline.

**Logo:** `assets/img/logo.svg` ist das Zeichen ohne Hintergrund (Schnellzug mit Fahrtlinien, der aus einem offenen Rahmen fährt), `assets/img/logo-white.svg` die weiße Variante für dunkle Hintergründe. Als PNG in 1024 × 1024 mit transparentem Hintergrund: `assets/icons/logo-1024.png` und `logo-white-1024.png`.

Das App-Icon ist gleichzeitig das Spielbild auf Roblox. Vorlage ist `assets/img/app-icon.svg` (Logo auf weißer Fläche, der Hintergrund lässt sich frei austauschen), daraus sind alle Größen erzeugt:

| Datei | Wofür |
|---|---|
| `assets/icons/roblox-game-icon.png` | Roblox-Spiel-Icon (512 × 512, randlos – Roblox rundet die Ecken selbst) |
| `assets/icons/roblox-thumbnail.png` | Roblox-Vorschaubild und Link-Vorschau (1920 × 1080) |
| `assets/icons/icon-192.png`, `icon-512.png` | App-Icon (mit runden Ecken) |
| `assets/icons/icon-maskable-512.png` | App-Icon für Android (randlos, das System schneidet die Form zu) |
| `assets/icons/apple-touch-icon.png` | iPhone/iPad-Startbildschirm (180 × 180) |
| `assets/icons/favicon-32.png` | Browser-Tab |

`manifest.webmanifest` beschreibt die App (Name, Icons, Schnellzugriffe auf Trainings, Server und News), `sw.js` sorgt für den Offline-Modus. Wenn sich Dateien ändern, holt die App sie automatisch neu, solange eine Verbindung besteht.

## Navigation & Profil

- Oben links öffnet das Menü-Symbol ein Menü, das sich von links hereinschiebt: alle Seiten, darunter Datenschutz und Nutzungsbedingungen als gleiche Buttons, Spielen/Gruppe/Discord und unten die Uhrzeit in Deutschland als Karte (Uhr, Zeit und Zeitzone auf einer Linie).
- Oben rechts stehen das Rang-Kürzel des Spielers in der Rangfarbe (z. B. `[CD]` für Conductor) und sein Profilbild im Ring. Die Kürzel stehen in `ranks` (`prefix`).
- Unten liegt eine dunkle Leiste über die ganze Breite (`width: 100vw`), fest am unteren Rand, nur mit Icons: Start, News, Trainings und rechts ein kleines Profilbild (Ring in der Rangfarbe). Icons und Profil liegen senkrecht genau in der Mitte – auf iPhones mit Home-Balken über die ganze Höhe der Leiste. Im Dunkelmodus ist die Leiste etwas heller.
- Die Fußzeile (Logo, Buttons, Seiten, Hinweise) ist mittig untereinander angeordnet.
- **Mit Roblox anmelden:** Ist in `assets/js/config.js` die Client-ID eingetragen, zeigt der Profil-Dialog „Mit Roblox anmelden“ (siehe „Roblox-Login“). Ohne Client-ID gilt die Demo:
- **Mit Roblox verbinden (Demo):** Ein Klick auf das Profil öffnet den Dialog. Nach Eingabe des Roblox-Namens lädt die App den Anzeigenamen und das Profilbild und zeigt sie oben, unten und im Menü. Roblox erlaubt solche Abfragen nicht direkt aus dem Browser, deshalb läuft das über einen Proxy (`roblox` in `data.js`, Standard: roproxy.com). Ist er nicht erreichbar, verbindet die App trotzdem und zeigt die Initialen. Nach dem Verbinden zeigt der Profil-Dialog den Button **Meine Statistik** mit den eigenen Werten: Kacheln (Level, Kilometer, Fahrten, Pünktlichkeit, Trainings, Spielzeit, Bestenliste, Dabei seit, Lieblingsstrecke), Streifendiagramme der meistgefahrenen Züge im Fernverkehr, Regio und S-Bahn, alle Strecken als Rangliste (R001, R002, …) und die Spielzeit dieser Woche (Demo-Werte). Das ist noch kein echter Login – dafür die Client-ID eintragen (siehe „Roblox-Login“). Im Profil- und Statistik-Dialog steht, ob Profil bzw. Statistik öffentlich sind, mit Link zu den Einstellungen.

## Roblox-Login: nur die Client-ID eintragen

1. Auf [create.roblox.com/dashboard/credentials](https://create.roblox.com/dashboard/credentials) unter **OAuth 2.0 Apps** eine App anlegen.
2. **Redirect URL:** genau die Adresse der Seite, z. B. `https://loris6.github.io/Train-Sim-Germany/` (mit `/` am Ende, ohne `index.html`, `#` oder `?`). Zum Testen zusätzlich `http://localhost:8000/`.
3. **Scopes:** `openid` und `profile`.
4. **Privacy Policy URL:** `…/privacy.html`, **Terms of Service URL:** `…/terms.html`.
5. In **`assets/js/config.js`** die Client-ID eintragen – fertig:

```js
roblox: {
  clientId: '1234567890123456789', // aus dem Roblox-Dashboard
  groupId: 33684346,               // Roblox-Gruppe von Train Sim Germany
  redirectUri: '',                 // leer = Adresse der Seite
},
```

Die Anmeldung läuft mit **PKCE** direkt zwischen Browser und Roblox (Roblox erlaubt das ausdrücklich für reine Web-Apps, CORS ist freigeschaltet). Ein Client-Secret wird nicht gebraucht und gehört nie in die Seite. Die App prüft `state` und `nonce`, lädt Nutzer-ID, Name, Anzeigename und Profilbild, macht den Refresh-Token sofort ungültig und speichert nur das öffentliche Profil im Browser. Danach geht es zurück auf die Seite, von der aus man sich angemeldet hat.

**Rang aus der Roblox-Gruppe:** Nach dem Login fragt die App die Rolle des Spielers in der Gruppe (`groupId`) ab und gibt ihm den passenden Rang – über das Kürzel oder den Namen der Rolle: „[D] Driver“, „D | Driver“ und „Driver“ werden alle zu Driver, „[UD] …“ zu Passenger, „[SG] Signaller“ zu Signaller usw. **Wer nicht in der Gruppe ist, ist [G] Guest (Gast)** und bekommt im Profil den Hinweis mit Link zur Gruppe. Eine Rolle ohne passenden Namen oder Kürzel zählt als Passenger. Der Rang aus der Gruppe lässt sich nicht von Hand ändern und wird spätestens alle 10 Minuten beim Öffnen der App aktualisiert. Die Abfrage läuft über `groupsApi` in `data.js` (roproxy.com), weil Roblox sie nicht direkt aus dem Browser erlaubt.

## Benachrichtigungen für Trainings

Die Glocke auf den Trainingskarten (oben links, gegenüber der Server-Anzeige), im Training-Detail und oben auf der Trainingsseite (alle Trainings des nächsten Rangs) schaltet echte Benachrichtigungen des Geräts ein. Beim ersten Mal fragt der Browser um Erlaubnis, danach kommt sofort eine Bestätigung. Sobald der Trainingsserver öffnet (15 Minuten vor Beginn), meldet sich das Gerät mit Training, Uhrzeit, Server und Leitung; „Beitreten“ in der Benachrichtigung startet Roblox direkt im Trainingsserver, ein Tippen auf die Benachrichtigung öffnet das Training in der App.

- **Ohne Backend** kommen die Benachrichtigungen, solange die App offen oder im Hintergrund ist.
- **Mit Backend** (`api` in `config.js`) kommen sie per **Web-Push** auch bei geschlossener App – auf Android und am PC in Chrome, Edge und Firefox, auf dem iPhone/iPad ab iOS 16.4, wenn die App über „Zum Home-Bildschirm“ installiert ist.

## Backend (optional)

Für alles, was ein Server braucht, liegt im Ordner [`backend/`](backend/README.md) ein kleines Backend (kostenlos als **Cloudflare Worker** oder mit **Node.js**, keine Pakete nötig):

| Funktion | Was es macht |
|---|---|
| **Web-Push** | Speichert, wer für welches Training benachrichtigt werden will, und schickt die Benachrichtigung zur richtigen Zeit (verschlüsselt nach RFC 8291, VAPID-Schlüssel erzeugt es selbst) |
| **Bewerbungen** | Sendet Bewerbungen mit dem angemeldeten Roblox-Konto, Ergebnis und allen Antworten an einen privaten Discord-Kanal (`DISCORD_WEBHOOK_URL`, bleibt geheim). Höchstens 3 pro Tag und eine pro Stelle |
| **Privatsphäre** | Speichert „Profil öffentlich“ und „Statistik öffentlich“; `GET /api/players/<id>` liefert ein Profil nur, wenn es öffentlich ist |
| **Sitzung** | Nach dem Login schickt die App das von Roblox signierte ID-Token; das Backend prüft Signatur, Client-ID und Ablauf und gibt eine eigene Sitzung (30 Tage, Abmelden beendet alle) |

Einrichten: Schritt-für-Schritt in [`backend/README.md`](backend/README.md), danach die Adresse in `config.js` bei `api` eintragen. Ohne Backend läuft alles andere wie gewohnt (Bewerbungen bleiben dann auf dem Gerät).

## Datenschutz & Nutzungsbedingungen

`privacy.html` (Datenschutzerklärung) und `terms.html` (Nutzungsbedingungen) sind eigene Seiten im Design der App. Verlinkt sind sie in der Fußzeile, im Menü, in den Einstellungen und beim Roblox-Login. Name, Anschrift und E-Mail des Betreibers, der Anbieter des Backends (`backendHost`) sowie das Datum stehen in `config.js` unter `legal` und werden automatisch eingesetzt. **Bitte vor dem Veröffentlichen ausfüllen und prüfen** – die Texte sind eine Vorlage für dieses Projekt, keine Rechtsberatung. Kommen neue Funktionen hinzu (z. B. Live-Daten aus dem Spiel oder ein anderer Anbieter für das Backend), müssen beide Texte angepasst werden.

## Sprachen

In den Einstellungen gibt es **Automatisch** (übernimmt die Sprache des Geräts; ist sie nicht dabei, gilt Englisch) und Deutsch, English, Français, Español, Italiano, Nederlands, Polski und Türkçe, jeweils mit Flagge (`assets/img/flags`). Datum, Wochentage und Zahlen erscheinen im Format der gewählten Sprache.

- **Ausgangstext ist Deutsch.** Im Code steht jeder Text als `t('deutscher Text')`; der feste Text aus `index.html` wird automatisch übersetzt.
- **Übersetzungen:** `assets/js/i18n/<sprache>.js` – ein Objekt `{ "deutscher Text": "Übersetzung" }` für Oberfläche und Inhalte aus `data.js` (News, Stellen, Trainings …). Platzhalter wie `{n}` oder `{name}` müssen in der Übersetzung bleiben.
- **Fehlt eine Übersetzung** (z. B. bei einer neuen News), erscheint der deutsche Text. Neue Inhalte also zuerst auf Deutsch eintragen und die Übersetzung in den Sprachdateien nachtragen.
- **Bewerbungsfragen:** `assets/js/questions/<sprache>.js` mit genau demselben Aufbau wie `de.js`. Schreibaufgaben akzeptieren die Antwort in der jeweiligen Sprache und die deutsche Antwort.
- **Neue Sprache:** in `app.js` bei `LANGS` eintragen, Flagge nach `assets/img/flags` legen, `i18n/<code>.js` und `questions/<code>.js` anlegen.

## Inhalte anpassen

Alle Texte, Zahlen und Links stehen in **`assets/js/data.js`**:

```js
links: {
  play: 'https://www.roblox.com/games/140440792597921/…', // Spiel-Link
  group: 'https://www.roblox.com/communities/…', // Roblox-Gruppe
  discord: 'https://discord.gg/…',          // Discord-Einladung
},
```

Dort stehen auch die Rollen-Karten der Startseite (`roleCards`), Server, Trainings, News und Jobs (`jobs`).

**Server & Fahrplan:** Jeder Server in `servers` hat als `id` seine Server-ID aus dem Spiel (JobId, z. B. `b1cb1816-7d85-457c-9f32-2a1422d00e17`). Sie ist die Adresse der Detailseite (`#/server/<id>`) und sorgt dafür, dass „Beitreten“ direkt in diesen Server führt. `lines` sind die Linien, die dort fahren. Die Linien stehen in `lines`:

```js
'ice-28': { name: 'ICE 28', cat: 'ice', train: 'ICE 4', every: 60, offset: 24, no: 500,
  stops: [['Hamburg Hbf', 0], ['Ludwigslust', 52], ['Berlin-Spandau', 92], ['Berlin Hbf', 105]] },
```

`cat` ist die Gattung (`ice`, `ic`, `ire`, `re`, `rb`, `s`), `stops` sind die Halte mit Minuten ab dem ersten Halt, `every` der Takt, `offset` die erste Abfahrt nach Mitternacht und `no` die erste Zugnummer. Jede Linie fährt in beide Richtungen. Daraus berechnet die App jede Minute, welche Züge gerade wo sind (inkl. Verspätung), die Abfahrten an jedem Bahnhof mit Gleis und – aus `players` – welche Spieler welchen Zug fahren, wo Platform Staff steht und wer welches Stellwerk besetzt (Bahnhöfe mit „Hbf“ oder mindestens drei Linien haben ein Stellwerk). Züge ohne Spieler fährt die KI. `focus` bei Trainingsservern legt fest, welche Rolle dort vor allem gespielt wird. Das sind Demo-Daten; später können Züge und Spieler live aus dem Spiel kommen.

**Videos in News:** `video` ist entweder eine eigene Datei (`assets/video/…mp4`, mit `poster` als Vorschaubild) oder ein YouTube-Link. YouTube wird erst nach dem Antippen geladen (`youtube-nocookie.com`). Die drei Beispiel-Clips sind aus den eigenen Illustrationen erzeugt (`node tools/render_videos.mjs`, braucht Playwright und ffmpeg) und können durch echte Spielvideos ersetzt werden.

**Strecken:** Jede Strecke in `routes` hat eine Nummer (`no`: `R001`, `R002`, …). Die Nummer steht auf den Streckenkarten, in den meistbefahrenen Strecken (`topRoutes` verweist nur auf die Nummer) und in „Meine Statistik“. Neue Strecken einfach mit der nächsten Nummer anhängen.

**Züge:** `fleet` enthält die Züge für „Meine Statistik“, getrennt nach Fernverkehr (`fern`), Regio (`regio`) und S-Bahn (`sbahn`).

**Fragen im Bewerbungsformular:** Alle Fragen stehen in **`assets/js/questions/de.js`** (Übersetzungen daneben; geladen wird erst beim Öffnen einer Bewerbung). Jede Bewerbung hat genau 60 Fragen, die Grunddaten (Roblox, Discord, E-Mail, Spielzeit, Rang) zählen nicht mit:

| Stelle | Sektor 2 – Grundwissen (40) | Sektor 3 – Erfahrung & Zeit (20) |
|---|---|---|
| Supervisor, Bereich Driver / Platform Staff / Conductor | 20 Fragen des Bereichs (`areas`) + 20 „Bahnbetrieb allgemein“ (`basics`) | 3 feste Fragen + 17 `supervisor` |
| Supervisor, Bereich Signaller | 20 Signaller-Fragen + **alle 20 Driver-Fragen** (der Signaller stellt die Signale, die für den Driver gelten) | 3 feste Fragen + 17 `supervisor` |
| Game Developer, Map Builder, Moderator, Social Media | 40 Fachfragen (`jobs`) | 3 feste Fragen + 7 `common` + 10 `extra` |

Die drei festen Fragen sind Erfahrung (Text), Aktivität (Schieberegler 1–10) und freie Tage (Schieberegler Mo–So). In jedem Sektor stehen die Aufgaben nach Typ geordnet, immer in derselben Reihenfolge: Auswahl, Mehrfachauswahl, Schiebeaufgaben, Selbsteinschätzung, „Was trifft zu?“, Schreibaufgaben, Links, Freitext. Beim Supervisor (übernimmt die Aufgaben des früheren Instructors) sind nur Bereiche bis zum eigenen Rang wählbar, die anderen sind ausgegraut mit Hinweis oben links.

Fragetypen (`type`):

| Typ | Darstellung | Bewertung |
|---|---|---|
| `single` | Auswahl, eine Antwort | erste Option ist richtig, die App mischt |
| `multi` | Mehrfachauswahl, eine oder mehrere richtig | `correct` = Liste der richtigen Optionen |
| `write` | Schreibaufgabe, normales Eingabefeld (z. B. „Hp 0“) | `answers` = erlaubte Schreibweisen; Groß/Klein, Akzente, Leer- und Satzzeichen egal |
| `order` | Schiebeaufgabe: Einträge am Griff (6 Punkte) ziehen, mit der Tastatur über die Pfeiltasten | `items` in richtiger Reihenfolge, die App mischt; muss einmal verschoben werden |
| `scale` | Schieberegler zur Selbsteinschätzung | nicht bewertet |
| `long`, `short` | Freitext (mehrzeilig / einzeilig) | nicht bewertet, `long` mit Mindestlänge |
| `pick` | Mehrfachauswahl ohne richtige Lösung | nicht bewertet |
| `links` | Links mit Art: pro Zeile auswählen, was es ist (YouTube, TikTok, Instagram, Twitch, GitHub, Roblox, Screenshots, Portfolio, Anderer Link), bis zu 5 | nicht bewertet; der Link muss zur gewählten Plattform passen (`LINK_TYPES` in `app.js`) |

**Bewerbungen:** Das Formular prüft die Eingaben und berechnet, wie viele bewertete Fragen richtig sind (`score` / `total`). Mit Backend gehen Bewerbungen an einen Discord-Kanal (Webhook nur im Backend, nie in der Seite); ohne Backend werden sie nur im Browser gespeichert (Demo).

**Ränge & Trainings:** `ranks` legt den Ausbildungsweg fest (Guest → Passenger → Driver → Platform Staff → Conductor → Signaller → Dispatcher). Guest [G] ist, wer nicht in der Roblox-Gruppe ist. Supervisor ist ein Teamrang ohne eigenes Training (Bewerbung über die Karriere) und leitet die Trainings; den Instructor gibt es nicht mehr. Jeder Rang hat ein Kürzel (`prefix`, z. B. UD, D, PS, CD, SG, SV) und die Zahl der Spieler (`members`), die auf der Startseite bei den Rollen steht. Die Trainingsseite zeigt nur die Trainings für den nächsten Rang an. `me` ist der Spieler im Demo-Modus; mit Roblox-Login kommt der Rang aus der Roblox-Gruppe. `trainings` ist ein Wochenplan, den die App für zwei Wochen ausrollt. Aktuell sind das Beispieldaten. Später können sie über eine API mit echten Spieldaten befüllt werden.

## Icons hinzufügen

1. Icon auf [flaticon.com/uicons](https://www.flaticon.com/uicons) suchen und die Klasse verwenden, z. B. `<i class="fi fi-rr-ticket ic"></i>` im HTML oder `icon('fi-rr-ticket')` im JavaScript.
2. Icon-Dateien neu bauen:

```bash
npm install --no-save @flaticon/flaticon-uicons
pip install fonttools brotli
python3 tools/build_icons.py
```

Das Skript findet alle `fi-rr-…`, `fi-sr-…` und `fi-brands-…` Klassen und erzeugt `assets/css/uicons.css` sowie die passenden Schriftdateien in `assets/fonts`.

## Lokal starten

```bash
npx http-server .
# oder
python3 -m http.server
```

Danach `http://localhost:8080` (bzw. `:8000`) öffnen.

## Struktur

```
index.html            Alle Seiten (Hash-Routing: #/trainings, #/server, #/server/<id>, …)
privacy.html          Datenschutzerklärung
terms.html            Nutzungsbedingungen
manifest.webmanifest  App-Beschreibung (Name, Icons, Schnellzugriffe)
sw.js                 Service Worker für den Offline-Modus und Benachrichtigungen
assets/css/style.css  Design-System und Layouts
assets/js/config.js   Roblox-Client-ID, Gruppe, Adresse des Backends und Angaben für die Rechtstexte (keine Geheimnisse!)
assets/js/nozoom.js   Sperrt das Hineinzoomen auf allen Seiten
assets/js/data.js     Inhalte & Beispieldaten (Server, Linien, Trainings, News …)
assets/js/legal.js    Setzt die Angaben aus config.js in privacy.html und terms.html ein
assets/js/app.js      Routing, Sprache, Trainings, Server & Fahrplan, Diagramme, Bewerbungen, Profil, Login, Einstellungen
assets/js/i18n/       Übersetzungen der Oberfläche und Inhalte (en, fr, es, it, nl, pl, tr)
assets/js/questions/  Fragen für die Bewerbungen je Sprache (de.js ist das Original)
assets/css/uicons.css Flaticon UIcons (erzeugt)
assets/img/           Logo bzw. App-Icon, Illustrationen und Flaggen (SVG)
assets/video/         News-Clips (MP4) mit Vorschaubild
assets/icons/         App-Icons, Favicon, Roblox-Spiel-Icon und Vorschaubild (PNG)
assets/fonts/         Rubik und UIcons (woff2)
tools/build_icons.py  Baut die UIcons-Teilmenge
tools/render_videos.mjs Erzeugt die News-Clips aus den Illustrationen
backend/              Optionales Backend: Web-Push, Bewerbungen → Discord, Privatsphäre
  app.js              Logik (Web-Standards, läuft überall)
  webpush.js          Web-Push (VAPID, Verschlüsselung nach RFC 8291, Zeitplan)
  lib.js              Kleine Hilfen
  worker.js           Start als Cloudflare Worker (wrangler.toml)
  server.js           Start mit Node.js (.env)
  .env.example        Alle Einstellungen mit Erklärung
```

---

Train Sim Germany ist ein Fan-Projekt auf Roblox und steht in keiner Verbindung zur Deutschen Bahn AG oder zur Roblox Corporation.
