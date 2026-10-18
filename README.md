# Train Sim Germany

Die Web-App zum Roblox-Spiel **Train Sim Germany**: Live-Abfahrten, Server, Statistiken, Spieler und kommende Trainings, alles an einem Ort.

Die Seite ist reines HTML, CSS und JavaScript. Es gibt keinen Build-Schritt, sie läuft direkt auf GitHub Pages oder jedem anderen Webserver.

## Seiten

| Seite | Inhalt |
|---|---|
| **Start** | Titelbereich mit Logo, Begrüßung und Suche, Einstiegskarte mit Server / Gruppe / Discord, Rollen-Karten (Passenger, Driver, Platform Staff, Conductor, Signaller) mit Spielerzahl, Live-Abfahrten, nächstes Training, Strecken, Kennzahlen, Karriere, News |
| **Reise** | Reiseauskunft wie im DB Navigator: Von/Nach mit Tauschen, Datum, Routeneinstellungen (Verkehrsmittel, nur direkt, Zwischenhalt), Haltestellen-Auswahl mit Favoriten und Verlauf, Schnelle Suche (Start antippen oder auf das Ziel ziehen), Verbindungen mit einem Umstieg, Reiseplan mit allen Halten, merken & anheften |
| **Abfahrten** | Live-Abfahrtstafel mit Abfahrten/Ankünften, Bahnhofssuche, Filtern nach Zuggattung, Lokführer und Verspätungen |
| **Server** | Serverliste mit Auslastung, Rollen (Lokführer, Zugbegleiter, Fahrdienstleiter, Fahrgäste), Ping, Laufzeit und Beitreten-Button |
| **News** | Neuigkeiten mit Kategorien (Updates, Events, Community) und Detailansicht |
| **Karriere** | Offene Stellen mit Status, Detailseite mit Verantwortlichkeiten und Anforderungen, eigene Bewerbungsseite je Stelle mit drei Sektoren: 1. Über dich (Roblox, Discord, Spielzeit, Rang), 2. Grundwissen (Fragen zum Bereich; bei Instructor wählbar: Driver, Platform Staff, Conductor oder Signaller), 3. Erfahrung & Zeit (Aktivität und freie Tage per Schieberegler) |
| **Statistiken** | Kennzahlen, Spieler-online-Diagramm (24 Std. / 7 Tage / 30 Tage), Zuggattungen, Pünktlichkeit, Top-Strecken |
| **Spieler** | Podium, Bestenliste (Kilometer / Fahrten / Pünktlichkeit), Spieler der Woche, Ränge |
| **Trainings** | Dein Rang und dein nächster Ausbildungsschritt (z. B. Conductor → Signaller), Tagesleiste über 14 Tage (roter Punkt = Trainings), Trainingskarten, alle kommenden Termine, Anmeldung |

## Design

- Schrift: **Rubik**, lokal eingebunden (`assets/fonts`, SIL Open Font License)
- Icons: **[UIcons von Flaticon](https://www.flaticon.com/uicons)** (Regular Rounded, Solid Rounded, Brands). Eingebunden sind nur die genutzten Icons (ca. 5 KB). Die Flaticon-Lizenz verlangt eine Namensnennung, sie steht in der Fußzeile.
- Aufbau nach dem [DB UX Design System](https://github.com/db-ux-design-system/core-web) (Generation 3, Apache-2.0): weiße Kopfzeile, große Überschriften, Buttons mit 40 px Höhe (Rot für die Hauptaktion, sonst grau oder mit Rand), graue Eingabefelder, Karten mit 1 px Rand, blauer Fokusrahmen. Abstände und Schatten sind die Werte aus dem DB UX Design System, die Ecken sind etwas runder (Buttons und Felder 8 px, Karten 12 px). DB-Logo und DB-Schriften werden nicht verwendet.
- Aktive Elemente (Tabs, Menü, Leiste unten) sind grau eingerahmt mit Hintergrund, Tage mit Trainings haben einen roten Punkt – keine Unterstriche
- Farben: DB-Rot `#EC0016` und die Cool-Gray-Töne der DB, Gleisnummern im DB-Blau wie an den Bahnhofsschildern
- Uhr mit deutscher Zeit (MEZ/MESZ) im Menü
- Responsiv für Handy, Tablet und Desktop
- Hell- und Dunkelmodus (folgt dem System, umschaltbar im Menü)
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

`manifest.webmanifest` beschreibt die App (Name, Icons, Schnellzugriffe auf Abfahrten, Reise und Trainings), `sw.js` sorgt für den Offline-Modus. Wenn sich Dateien ändern, holt die App sie automatisch neu, solange eine Verbindung besteht.

## Navigation & Profil

- Oben links öffnet das Menü-Symbol ein Menü, das sich von links hereinschiebt (alle Seiten, Spielen/Gruppe/Discord, Uhr, Hell/Dunkel, App installieren).
- Oben rechts stehen das Rang-Kürzel des Spielers in der Rangfarbe (z. B. `[CD]` für Conductor) und sein Profilbild im Ring. Die Kürzel stehen in `ranks` (`prefix`).
- Unten schwebt die Leiste mit Start, News, Trainings und Profil. Das Profil unten ist dasselbe wie oben.
- **Mit Roblox verbinden:** Ein Klick auf das Profil öffnet den Dialog. Nach Eingabe des Roblox-Namens lädt die App den Anzeigenamen und das Profilbild und zeigt sie oben, unten und im Menü. Roblox erlaubt solche Abfragen nicht direkt aus dem Browser, deshalb läuft das über einen Proxy (`roblox` in `data.js`, Standard: roproxy.com). Ist er nicht erreichbar, verbindet die App trotzdem und zeigt die Initialen. Das ist kein echter Login – dafür bräuchte es Roblox-OAuth mit einem eigenen Server.

## Inhalte anpassen

Alle Texte, Zahlen und Links stehen in **`assets/js/data.js`**:

```js
links: {
  play: 'https://www.roblox.com/games/…',   // Spiel-Link
  group: 'https://www.roblox.com/communities/…', // Roblox-Gruppe
  discord: 'https://discord.gg/…',          // Discord-Einladung
},
```

Dort stehen auch die Rollen-Karten der Startseite (`roleCards`), Linien und Fahrpläne (daraus werden Live-Abfahrten und Verbindungen berechnet), Server, Spieler, Trainings, Strecken, News und Jobs (`jobs`).

**Fragen im Bewerbungsformular:** Jede Stelle hat unter `quiz` eigene Fragen. Für Instructor kommen die Fragen aus `knowledge`: abgefragt wird der gewählte Bereich und alle Bereiche darunter (Signaller Instructor also auch Conductor, Platform Staff und Driver). Bei jeder Frage ist die erste Antwort die richtige, die App mischt die Reihenfolge.

**Bewerbungen:** Das Formular prüft die Eingaben, speichert Bewerbungen aber nur im Browser (Demo). Für echte Bewerbungen braucht es einen Server, der sie z. B. an einen Discord-Kanal weiterleitet. Eine Discord-Webhook-URL sollte nicht direkt in die Seite eingetragen werden, weil sie sonst öffentlich ist.

**Ränge & Trainings:** `ranks` legt den Ausbildungsweg fest (Passenger → Driver → Platform Staff → Conductor → Signaller → Dispatcher → Instructor). Supervisor ist ein Teamrang ohne eigenes Training. Jeder Rang hat ein Kürzel (`prefix`, z. B. UD, D, PS, CD, SG, SV) und die Zahl der Spieler (`members`), die auf der Startseite bei den Rollen steht. Die Trainingsseite zeigt immer das Training für den nächsten Rang an. `me` ist der angemeldete Spieler (Demo); später kann der Rang aus der Roblox-Gruppe kommen. `trainings` ist ein Wochenplan, den die App für zwei Wochen ausrollt. Aktuell sind das Beispieldaten. Später können sie über eine API mit echten Spieldaten befüllt werden.

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
index.html            Alle Seiten (Hash-Routing: #/abfahrten, #/server, …)
manifest.webmanifest  App-Beschreibung (Name, Icons, Schnellzugriffe)
sw.js                 Service Worker für den Offline-Modus
assets/css/style.css  Design-System und Layouts
assets/js/data.js     Inhalte & Beispieldaten
assets/js/app.js      Routing, Live-Abfahrten, Diagramme, Filter, Anmeldung
assets/css/uicons.css Flaticon UIcons (erzeugt)
assets/img/           Logo bzw. App-Icon und Illustrationen (SVG)
assets/icons/         App-Icons, Favicon, Roblox-Spiel-Icon und Vorschaubild (PNG)
assets/fonts/         Rubik und UIcons (woff2)
tools/build_icons.py  Baut die UIcons-Teilmenge
```

---

Train Sim Germany ist ein Fan-Projekt auf Roblox und steht in keiner Verbindung zur Deutschen Bahn AG oder zur Roblox Corporation.
