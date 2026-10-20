# Train Sim Germany

Die Web-App zum Roblox-Spiel **Train Sim Germany**: Trainings, Server, News, Statistiken und Karriere, alles an einem Ort.

Die Seite ist reines HTML, CSS und JavaScript. Es gibt keinen Build-Schritt, sie läuft direkt auf GitHub Pages oder jedem anderen Webserver.

## Seiten

| Seite | Inhalt |
|---|---|
| **Start** | Titelbereich mit Logo und Begrüßung, Rollen-Karten (Passenger, Driver, Platform Staff, Conductor, Signaller) mit Spielerzahl, nächstes Training, Strecken mit Nummer (R001, R002, …), Kennzahlen, Karriere, News |
| **Server** | Serverliste mit Auslastung, Rollen (Lokführer, Zugbegleiter, Fahrdienstleiter, Fahrgäste), Ping, Laufzeit und Beitreten-Button |
| **News** | Neuigkeiten mit Kategorien (Updates, Events, Community), Beiträge mit Video (Play-Symbol auf der Karte). In der Detailansicht beginnt Bild bzw. Video ganz oben in der Rundung, Griff und Schließen liegen darauf |
| **Karriere** | Offene Stellen mit Status, Detailseite mit Verantwortlichkeiten und Anforderungen, eigene Bewerbungsseite je Stelle mit 60 Fragen in drei Sektoren: 1. Über dich (Roblox, Discord, E-Mail, Spielzeit, Rang), 2. Grundwissen (40 Fragen; beim Supervisor im gewählten Bereich Driver, Platform Staff, Conductor oder Signaller), 3. Erfahrung & Zeit (20 Fragen, u. a. Aktivität und freie Tage per Schieberegler, bei Game Developer, Map Builder und Social Media Links mit Art). Oben zählt „x von 60 Fragen beantwortet“ mit |
| **Statistiken** | Kennzahlen, Spieler-online-Diagramm (24 Std. / 7 Tage / 30 Tage), Zuggattungen, Pünktlichkeit, meistbefahrene Strecken (mit Streckennummer) |
| **Trainings** | Dein Rang und dein nächster Ausbildungsschritt (z. B. Conductor → Signaller), Tagesleiste über 14 Tage (roter Punkt = Trainings). Angezeigt werden nur die Trainings für den nächsten Rang – ein Conductor sieht also nur Signaller-Trainings; Supervisor und Management sehen alle. Trainingskarten mit Serverstatus (offen, öffnet in … Min., geschlossen), alle kommenden Termine. In der Detailansicht ist „Join Now“ grau, bis der Server offen ist, dann hellblau. Der Server öffnet 15 Minuten vor Beginn. |
| **Einstellungen** | Darstellung: Hell, Dunkel oder Mit Gerät synchronisieren (folgt automatisch der Einstellung von Handy oder PC), Sprache mit Flagge (Automatisch = Gerätesprache, Deutsch, English, Français, Español, Italiano, Nederlands, Polski, Türkçe), Roblox-Konto, App installieren |

## Design

- Schrift: **Rubik**, lokal eingebunden (`assets/fonts`, SIL Open Font License)
- Icons: **[UIcons von Flaticon](https://www.flaticon.com/uicons)** (Regular Rounded, Solid Rounded, Brands). Eingebunden sind nur die genutzten Icons (ca. 5 KB). Die Flaticon-Lizenz verlangt eine Namensnennung, sie steht in der Fußzeile.
- Aufbau nach dem [DB UX Design System](https://github.com/db-ux-design-system/core-web) (Generation 3, Apache-2.0): weiße Kopfzeile, große Überschriften, Buttons mit 40 px Höhe (Rot für die Hauptaktion, sonst grau oder mit Rand), graue Eingabefelder, Karten mit 1 px Rand, blauer Fokusrahmen. Abstände und Schatten sind die Werte aus dem DB UX Design System, die Ecken sind etwas runder (Buttons und Felder 8 px, Karten 12 px). DB-Logo und DB-Schriften werden nicht verwendet.
- Aktive Elemente (Tabs, Menü) sind grau eingerahmt mit Hintergrund, in der Leiste unten ist das aktive Icon rot mit rotem Punkt darunter, Tage mit Trainings haben einen roten Punkt – keine Unterstriche
- Farben: DB-Rot `#EC0016` und die Cool-Gray-Töne der DB, Gleisnummern im DB-Blau wie an den Bahnhofsschildern
- Uhr mit deutscher Zeit (MEZ/MESZ) im Menü
- Kein elastisches Nachfedern beim Scrollen (auf allen Seiten abgeschaltet)
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

- Oben links öffnet das Menü-Symbol ein Menü, das sich von links hereinschiebt (alle Seiten inkl. Einstellungen direkt unter Statistiken, Spielen/Gruppe/Discord, Uhr, App installieren).
- Oben rechts stehen das Rang-Kürzel des Spielers in der Rangfarbe (z. B. `[CD]` für Conductor) und sein Profilbild im Ring. Die Kürzel stehen in `ranks` (`prefix`).
- Unten schwebt eine dunkle, runde Leiste nur mit Icons (Start, News, Trainings). Rechts geht sie in einen größeren Kreis mit dem Profilbild über (Ring in der Rangfarbe). Im Dunkelmodus ist die Leiste etwas heller, damit sie sich vom Hintergrund abhebt. Abstand links, rechts und unten ist gleich. Das Profil unten ist dasselbe wie oben.
- **Mit Roblox verbinden:** Ein Klick auf das Profil öffnet den Dialog. Nach Eingabe des Roblox-Namens lädt die App den Anzeigenamen und das Profilbild und zeigt sie oben, unten und im Menü. Roblox erlaubt solche Abfragen nicht direkt aus dem Browser, deshalb läuft das über einen Proxy (`roblox` in `data.js`, Standard: roproxy.com). Ist er nicht erreichbar, verbindet die App trotzdem und zeigt die Initialen. Nach dem Verbinden zeigt der Profil-Dialog den Button **Meine Statistik** mit den eigenen Werten: Kacheln (Level, Kilometer, Fahrten, Pünktlichkeit, Trainings, Spielzeit, Bestenliste, Dabei seit, Lieblingsstrecke), Streifendiagramme der meistgefahrenen Züge im Fernverkehr, Regio und S-Bahn, alle Strecken als Rangliste (R001, R002, …) und die Spielzeit dieser Woche (Demo-Werte). Das ist kein echter Login – dafür bräuchte es Roblox-OAuth mit einem eigenen Server.

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

**Bewerbungen:** Das Formular prüft die Eingaben und berechnet, wie viele bewertete Fragen richtig sind (`score` / `total`). Es speichert Bewerbungen aber nur im Browser (Demo). Für echte Bewerbungen braucht es einen Server, der sie z. B. an einen Discord-Kanal weiterleitet. Eine Discord-Webhook-URL sollte nicht direkt in die Seite eingetragen werden, weil sie sonst öffentlich ist.

**Ränge & Trainings:** `ranks` legt den Ausbildungsweg fest (Passenger → Driver → Platform Staff → Conductor → Signaller → Dispatcher). Supervisor ist ein Teamrang ohne eigenes Training (Bewerbung über die Karriere) und leitet die Trainings; den Instructor gibt es nicht mehr. Jeder Rang hat ein Kürzel (`prefix`, z. B. UD, D, PS, CD, SG, SV) und die Zahl der Spieler (`members`), die auf der Startseite bei den Rollen steht. Die Trainingsseite zeigt nur die Trainings für den nächsten Rang an. `me` ist der angemeldete Spieler (Demo); später kann der Rang aus der Roblox-Gruppe kommen. `trainings` ist ein Wochenplan, den die App für zwei Wochen ausrollt. Aktuell sind das Beispieldaten. Später können sie über eine API mit echten Spieldaten befüllt werden.

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
index.html            Alle Seiten (Hash-Routing: #/trainings, #/server, …)
manifest.webmanifest  App-Beschreibung (Name, Icons, Schnellzugriffe)
sw.js                 Service Worker für den Offline-Modus
assets/css/style.css  Design-System und Layouts
assets/js/data.js     Inhalte & Beispieldaten
assets/js/app.js      Routing, Sprache, Trainings, Diagramme, Bewerbungen, Profil, Einstellungen
assets/js/i18n/       Übersetzungen der Oberfläche und Inhalte (en, fr, es, it, nl, pl, tr)
assets/js/questions/  Fragen für die Bewerbungen je Sprache (de.js ist das Original)
assets/css/uicons.css Flaticon UIcons (erzeugt)
assets/img/           Logo bzw. App-Icon, Illustrationen und Flaggen (SVG)
assets/video/         News-Clips (MP4) mit Vorschaubild
assets/icons/         App-Icons, Favicon, Roblox-Spiel-Icon und Vorschaubild (PNG)
assets/fonts/         Rubik und UIcons (woff2)
tools/build_icons.py  Baut die UIcons-Teilmenge
tools/render_videos.mjs Erzeugt die News-Clips aus den Illustrationen
```

---

Train Sim Germany ist ein Fan-Projekt auf Roblox und steht in keiner Verbindung zur Deutschen Bahn AG oder zur Roblox Corporation.
