# Train Sim Germany

Die Web-App zum Roblox-Spiel **Train Sim Germany**: Live-Abfahrten, Server, Statistiken, Spieler und kommende Trainings, alles an einem Ort.

Die Seite ist reines HTML, CSS und JavaScript. Es gibt keinen Build-Schritt, sie läuft direkt auf GitHub Pages oder jedem anderen Webserver.

## Seiten

| Seite | Inhalt |
|---|---|
| **Start** | Begrüßung mit Suche, Play / Gruppe / Discord als Bildkarten, Live-Abfahrten, nächstes Training, Strecken, Kennzahlen, News |
| **Reise** | Reiseauskunft wie im DB Navigator: Von/Nach mit Tauschen, Datum, Routeneinstellungen (Verkehrsmittel, nur direkt, Zwischenhalt), Haltestellen-Auswahl mit Favoriten und Verlauf, Schnelle Suche (Start antippen oder auf das Ziel ziehen), Verbindungen mit einem Umstieg, Reiseplan mit allen Halten, merken & anheften |
| **Abfahrten** | Live-Abfahrtstafel mit Abfahrten/Ankünften, Bahnhofssuche, Filtern nach Zuggattung, Lokführer und Verspätungen |
| **Server** | Serverliste mit Auslastung, Rollen (Lokführer, Zugbegleiter, Fahrdienstleiter, Fahrgäste), Ping, Laufzeit und Beitreten-Button |
| **News** | Neuigkeiten mit Kategorien (Updates, Events, Community) und Detailansicht |
| **Karriere** | Offene Stellen mit Status, Detailseite mit Verantwortlichkeiten und Anforderungen, eigene Bewerbungsseite je Stelle mit drei Sektoren: 1. Über dich (Roblox, Discord, Alter, Rang), 2. Grundwissen (Fragen zum Bereich; bei Instructor wählbar: Driver, Platform Staff, Conductor oder Signaller), 3. Erfahrung & Zeit |
| **Statistiken** | Kennzahlen, Spieler-online-Diagramm (24 Std. / 7 Tage / 30 Tage), Zuggattungen, Pünktlichkeit, Top-Strecken |
| **Spieler** | Podium, Bestenliste (Kilometer / Fahrten / Pünktlichkeit), Spieler der Woche, Ränge |
| **Trainings** | Dein Rang und dein nächster Ausbildungsschritt (z. B. Conductor → Signaller), Tagesleiste über 14 Tage (roter Punkt = Trainings), Trainingskarten, alle kommenden Termine, Anmeldung |

## Design

- Schrift: **Rubik**, lokal eingebunden (`assets/fonts`, SIL Open Font License)
- Icons: **[UIcons von Flaticon](https://www.flaticon.com/uicons)** (Regular Rounded, Solid Rounded, Brands). Eingebunden sind nur die genutzten Icons (ca. 5 KB). Die Flaticon-Lizenz verlangt eine Namensnennung, sie steht in der Fußzeile.
- Aufbau nach dem [DB UX Design System](https://github.com/db-ux-design-system/core-web) (Generation 3, Apache-2.0): weiße Kopfzeile mit roter Markierung für die aktive Seite, Brotkrümel und große Überschriften, Buttons mit 40 px Höhe und 4 px Ecken (Rot für die Hauptaktion, sonst mit Rand), graue Eingabefelder, Karten mit 1 px Rand und 8 px Ecken, Tabs mit roter Linie, blauer Fokusrahmen. Abstände, Ecken und Schatten sind die Werte aus dem DB UX Design System. DB-Logo und DB-Schriften werden nicht verwendet.
- Farben: DB-Rot `#EC0016` und die Cool-Gray-Töne der DB, Gleisnummern im DB-Blau wie an den Bahnhofsschildern
- Auf dem Handy: Kopfzeile mit Spielen-Button und Tab-Leiste unten mit Beschriftung
- Responsiv für Handy, Tablet und Desktop
- Hell- und Dunkelmodus (folgt dem System, umschaltbar oben rechts)
- Alle Illustrationen sind eigene SVGs in `assets/img`. Sie können jederzeit durch Screenshots aus dem Spiel ersetzt werden (gleicher Dateiname, z. B. als `.png`, dann den Pfad anpassen).

## Inhalte anpassen

Alle Texte, Zahlen und Links stehen in **`assets/js/data.js`**:

```js
links: {
  play: 'https://www.roblox.com/games/…',   // Spiel-Link
  group: 'https://www.roblox.com/communities/…', // Roblox-Gruppe
  discord: 'https://discord.gg/…',          // Discord-Einladung
},
```

Dort stehen auch Linien und Fahrpläne (daraus werden Live-Abfahrten und Verbindungen berechnet), Server, Spieler, Trainings, Strecken, News und Jobs (`jobs`).

**Fragen im Bewerbungsformular:** Jede Stelle hat unter `quiz` eigene Fragen. Für Instructor kommen die Fragen aus `knowledge`: abgefragt wird der gewählte Bereich und alle Bereiche darunter (Signaller Instructor also auch Conductor, Platform Staff und Driver). Bei jeder Frage ist die erste Antwort die richtige, die App mischt die Reihenfolge.

**Bewerbungen:** Das Formular prüft die Eingaben, speichert Bewerbungen aber nur im Browser (Demo). Für echte Bewerbungen braucht es einen Server, der sie z. B. an einen Discord-Kanal weiterleitet. Eine Discord-Webhook-URL sollte nicht direkt in die Seite eingetragen werden, weil sie sonst öffentlich ist.

**Ränge & Trainings:** `ranks` legt den Ausbildungsweg fest (Passenger → Driver → Platform Staff → Conductor → Signaller → Dispatcher → Instructor). Die Trainingsseite zeigt immer das Training für den nächsten Rang an. `me` ist der angemeldete Spieler (Demo); später kann der Rang aus der Roblox-Gruppe kommen. `trainings` ist ein Wochenplan, den die App für zwei Wochen ausrollt. Aktuell sind das Beispieldaten. Später können sie über eine API mit echten Spieldaten befüllt werden.

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
assets/css/style.css  Design-System und Layouts
assets/js/data.js     Inhalte & Beispieldaten
assets/js/app.js      Routing, Live-Abfahrten, Diagramme, Filter, Anmeldung
assets/css/uicons.css Flaticon UIcons (erzeugt)
assets/img/           Logo und Illustrationen (SVG)
assets/fonts/         Rubik und UIcons (woff2)
tools/build_icons.py  Baut die UIcons-Teilmenge
```

---

Train Sim Germany ist ein Fan-Projekt auf Roblox und steht in keiner Verbindung zur Deutschen Bahn AG oder zur Roblox Corporation.
