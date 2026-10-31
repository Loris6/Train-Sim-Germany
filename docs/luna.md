# Luna – Skriptsprache für eigene Bots

Luna ist die Sprache, mit der Bots in Gruppen- und Server-Chats von Train Sim Germany programmiert werden.
Geschrieben wird im **Bot-Editor** der App (Chat → Info → Bots → *Editor*). Ein Interpreter (`backend/luna.js`)
führt Luna im Backend und in der App aus – ohne Zugriff auf JavaScript, mit festen Grenzen gegen Endlosschleifen.

```luna
onjoin() {
  print("Willkommen {username} auf {server}!")
}
```

## Zwei Modi

| Modus | So geht's |
| --- | --- |
| **Basis** | Regeln mit Vorlage: *Wann* (Beitritt, Verlassen, Befehl, Betreten/Verlassen des privaten Servers im Spiel) → *Wohin* (Chat, Discord, beides) → Text mit Platzhaltern wie `{username}` |
| **Erweitert** | Eigene Skripte in Luna im Editor. Beim Wechsel lassen sich die Regeln mit einem Knopf in Luna-Code umwandeln |

## Vier Arten von Skripten

| Art | Läuft … | Ereignisse |
| --- | --- | --- |
| **ServerScript** | im Backend, wenn im Chat etwas passiert | `onstart()`, `onjoin(username)`, `onleave(username)`, `onmessage(text, username)`, `oncommand(command, args)` |
| **GameScript** | im Backend, wenn in einem verbundenen privaten Server etwas passiert | `onstart()`, `onjoin(username)`, `onleave(username)` |
| **ClientScript** | in der App der Person, die den Chat öffnet – nur sie sieht die Ausgabe | `onopen(username)`, `onmessage(text, username)` |
| **ModulScript** | gar nicht von selbst – liefert Funktionen und Werte für andere Skripte | – |

`oncommand` reagiert auf Nachrichten mit dem Präfix des Bots (Standard `!`, z. B. `!regeln bitte` → `command = "regeln"`,
`args = ["bitte"]`). Befehle mit `/` gehören zum TSG-Bot.

## Brücken (Connectors)

Ein Skript lädt ein ModulScript mit `require` – über den Namen oder den Pfad. So entsteht eine **Brücke**, die der Editor
links unter „Brücken“ anzeigt (kaputte Brücken rot).

```luna
// ModulScript „Texte“
function gruss(name) {
  return "Hallo " + name + "!"
}
```

```luna
// ServerScript „Main“
let texte = require("Texte")          // oder require("Module/Texte")
onjoin(username) {
  print(texte.gruss(username))
}
```

Ohne `return` bekommt man alle Funktionen und Variablen des Moduls; mit `return { … }` genau das zurückgegebene Objekt.

## Platzhalter und Werte

In Texten wird `{name}` durch den Wert ersetzt – Werte des Ereignisses und eigene Variablen (`{spieler.name}` geht auch).
Unbekanntes bleibt stehen, `{{` schreibt eine geschweifte Klammer.

| Wert | Bedeutung |
| --- | --- |
| `username`, `displayName`, `userId` | Person, um die es geht |
| `server`, `chat`, `members` | Name des Chats bzw. privaten Servers, Mitglieder |
| `game`, `gameId` | „Train Sim Germany“ und die ID des Spiels (Place-ID) |
| `serverId`, `players` | ID des privaten Servers und Spieler darin (GameScript) |
| `text`, `command`, `args`, `argtext` | Nachricht, Befehl ohne Präfix, Wörter danach (Liste bzw. Text) |
| `bot`, `time`, `date` | Name des Bots, Uhrzeit und Datum (deutsche Zeit) |

## Sprache

```luna
let zahl = 5                      // auch local oder var
const NAME = "TSG"                // Konstante
zahl += 1

if zahl > 3 { print("groß") } else if zahl == 3 { print("drei") } else { print("klein") }
while zahl < 10 { zahl += 1 }
for i in 1..3 { print(i) }        // 1, 2, 3
for i = 10, 1, -3 { print(i) }    // 10, 7, 4, 1
for name in ["Mia", "Tim"] { print("Hallo " + name) }
for key, wert in { linie: "RE1", ziel: "Berlin" } { log(key, wert) }

function doppelt(x) { return x * 2 }
dreifach(x) { return x * 3 }      // Kurzform
let quadrat = fn(x) { return x * x }

let liste = [3, 1, 2]
liste.push(4)
print(liste.sort().join("-"))     // 1-2-3-4
let zug = { linie: "S1", ziel: "Potsdam" }
zug.verspätung = 2
print("{zug.linie} nach {zug.ziel}")
```

- Kommentare: `// …`, `-- …`, `/* … */` · Semikolons sind erlaubt, aber nicht nötig
- Texte in `"…"`, `'…'` oder deutschen Anführungszeichen `„…“`
- `and`/`&&`, `or`/`||`, `not`/`!` · Falsch sind `false`, `nil`, `0` und `""`
- Listen beginnen bei 0, `liste[-1]` ist das letzte Element
- Text + Zahl ergibt Text, `"ab" * 3` ergibt `"ababab"`

## Funktionen

| Funktion | Wirkung |
| --- | --- |
| `print(…)`, `reply(…)` | Nachricht des Bots in den Chat (ClientScript: nur für die Person) |
| `discord(…)` | Nachricht nach Discord – nur wenn der Server-Chat verbunden und angenommen ist |
| `log(…)` | nur ins Protokoll im Editor |
| `require("Name")` | ModulScript laden |
| `save(key, wert)`, `load(key, standard)` | Werte merken, die erhalten bleiben (z. B. Zähler) – bis 50 Werte, 8 KB |
| `random(a, b)`, `random(liste)` | Zufallszahl bzw. zufälliges Element |
| `len`, `str`, `num`, `type` | Länge, umwandeln, Typ |
| `upper`, `lower`, `trim`, `contains`, `startsWith`, `endsWith`, `split`, `join`, `replace`, `format` | Text und Listen |
| `round`, `floor`, `ceil`, `abs`, `sqrt`, `min`, `max`, `range` | Rechnen |
| `keys`, `values`, `has` | Objekte |
| `now()`, `time()`, `date()`, `weekday()` | Zeit |
| `error(text)` | Skript mit Fehlermeldung beenden |

Texte und Listen haben dieselben Funktionen auch als Methode: `name.upper()`, `liste.contains(x)`, `liste.length`.

## Grenzen

- Höchstens **5 Nachrichten pro Ereignis** und 20 pro Minute und Bot; Bot-Nachrichten lösen keine Bots aus
- 10 000 Schritte pro Ereignis (danach „Endlosschleife?“), 60 verschachtelte Aufrufe, Texte bis 4 000 Zeichen
- 5 Bots je Chat, 25 Dateien je Bot, 12 000 Zeichen je Datei
- `print` außerhalb eines Ereignisses wird ignoriert – Code oben im Skript läuft vor jedem Ereignis, um Werte und Funktionen vorzubereiten

## Editor

- **Struktur links:** Ordner Server, Client, Module, Game mit Dateien, darunter die Ereignisse und Funktionen jeder Datei
  (antippen springt zur Zeile) und die Brücken. Auf dem Handy öffnet der Knopf oben links die Struktur von links.
- **Dateien oben** als Tabs, **Editor rechts** mit Zeilennummern, Farben, automatischem Einrücken und schließender `}`.
  Tab rückt ein (Umschalt+Tab aus), Strg/Cmd+S speichert. Auf Touch-Geräten gibt es eine Zeichenleiste mit `{ }`, `( )`, `" "` …
- **Unten:** Probleme (Fehler mit Zeile, sofort beim Tippen), **Testen** (Ereignis wählen und ausführen – läuft nur im
  Editor, nichts wird gesendet), **Protokoll** (was der Bot im Chat getan hat, mit Fehlern) und **Hilfe**.
- Nicht gespeicherte Änderungen bleiben als Entwurf auf dem Gerät erhalten.
