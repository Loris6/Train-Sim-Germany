# Train Sim Germany

Die Web-App zum Roblox-Spiel **Train Sim Germany**: Live-Abfahrten, Server, Statistiken, Spieler und kommende Trainings, alles an einem Ort.

Die Seite ist reines HTML, CSS und JavaScript. Es gibt keinen Build-Schritt, sie läuft direkt auf GitHub Pages oder jedem anderen Webserver.

## Seiten

| Seite | Inhalt |
|---|---|
| **Start** | Hero mit Suche, Play / Gruppe / Discord, Live-Kennzahlen, Abfahrten, Trainings, Strecken, News |
| **Abfahrten** | Live-Abfahrtstafel mit Abfahrten/Ankünften, Bahnhofssuche, Filtern nach Zuggattung, Lokführer und Verspätungen |
| **Server** | Serverliste mit Auslastung, Ping, Laufzeit und Beitreten-Button |
| **Statistiken** | Kennzahlen, Spieler-online-Diagramm (24 Std. / 7 Tage / 30 Tage), Zuggattungen, Pünktlichkeit, Top-Strecken |
| **Spieler** | Podium, Bestenliste (Kilometer / Fahrten / Pünktlichkeit), Spieler der Woche, Ränge |
| **Trainings** | Kommende Trainings mit Countdown, Tagesleiste, Filter, Anmeldung |

## Design

- Schrift: **Rubik**, lokal eingebunden (`assets/fonts`, SIL Open Font License)
- Eigenes Design im Stil moderner Bahn-Apps: dunkler Hero, helle „Sheet“-Fläche, Rot als Akzentfarbe
- Responsiv für Handy, Tablet und Desktop: auf dem Handy mit Tab-Leiste unten und Menü-Sheet
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

Dort stehen auch Linien und Fahrpläne (daraus werden die Live-Abfahrten berechnet), Server, Spieler, Trainings, Strecken und News. Aktuell sind das Beispieldaten. Später können sie über eine API mit echten Spieldaten befüllt werden.

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
assets/img/           Logo und Illustrationen (SVG)
assets/fonts/         Rubik (woff2)
```

---

Train Sim Germany ist ein Fan-Projekt auf Roblox und steht in keiner Verbindung zur Deutschen Bahn AG oder zur Roblox Corporation.
