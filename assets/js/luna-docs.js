/*
 * Luna – Dokumentation (Seite #/luna)
 *
 * HIER BEARBEITEST DU DIE DOKUMENTATION. Jede Seite ist ein Eintrag in PAGES:
 *   { id: 'adresse', group: 'Gruppe aus GROUPS', title: 'Titel', lead: 'Ein Satz darunter', md: `Text` }
 *   id    → Adresse der Seite: #/luna/<id> (nur a–z, 0–9, Bindestrich; nicht ändern, wenn schon verlinkt)
 *   group → in welcher Gruppe links im Menü (Reihenfolge der Gruppen = GROUPS, innerhalb der Gruppe = Reihenfolge hier)
 *   md    → kleines Markdown: ## und ### Überschriften, Absätze, - Listen, 1. Listen, | Tabellen |, `code`, **fett**,
 *           [Link](#/luna/seite), ```luna-Codeblöcke (bekommen „Kopieren“ und „Ausprobieren“) und Hinweise:
 *             > [!TIPP]      > [!HINWEIS]      > [!WARNUNG]
 * Achtung: In md ist alles ein JavaScript-Text in Backticks – ` und ${ müssen als \` und \${ geschrieben werden.
 * Ein | in einer Tabellenzelle als \| schreiben. Prüfen vor dem Pushen: node tools/check-luna-docs.mjs (jeder ```luna-Block,
 * jede Seite, jeder Link auf #/luna/…).
 * Wird erst geladen, wenn jemand die Dokumentation öffnet.
 */
import { highlight, VERSION } from '../../backend/luna.js';

export { VERSION };
// Sprache und Standardbibliothek gelten überall, wo Luna läuft. „TSG-Bots“ beschreibt die Plattform Train Sim Germany.
export const GROUPS = ['Erste Schritte', 'Sprache', 'Standardbibliothek', 'TSG-Bots', 'Referenz', 'Beispiele'];

export const PAGES = [
  {
    id: 'einfuehrung', group: 'Erste Schritte', title: 'Einführung in Luna',
    lead: 'Luna ist eine kleine, einfache Programmiersprache: schnell gelernt, gut lesbar und sicher – für Chat-Bots in Train Sim Germany und für eigene Projekte.',
    md: `
## Was ist Luna?

Luna ist eine **Programmiersprache** – keine Vorlage und kein Fließtext. Du schreibst Anweisungen, Variablen, Bedingungen, Schleifen und Funktionen, und Luna führt sie Schritt für Schritt aus:

\`\`\`luna
local stationen = { "Berlin Hbf", "Spandau", "Wolfsburg" }

for i, name in ipairs(stationen) do
  print(i .. ". Halt: " .. name)
end
\`\`\`

Luna sieht aus wie **Luau** aus Roblox und ist bewusst klein gehalten: Wer die Grundlagen kann, kann fast alles. Probier jeden Codeblock in dieser Dokumentation mit **Ausprobieren** direkt im [Playground](#/luna/playground) aus.

## Drei Ideen hinter Luna

| Idee | Was das heißt |
| --- | --- |
| **Einfach** | Wenige Schlüsselwörter, verständliche Fehlermeldungen auf Deutsch, Blöcke mit \`{ … }\` oder \`then … end\` |
| **Sicher** | Luna läuft in einem Sandkasten: kein Zugriff auf Dateien, Netzwerk oder fremde Daten, Grenzen für Zeit und Speicher |
| **Einbettbar** | Der Kern (Sprache und Standardbibliothek) ist von der Plattform getrennt – Luna kann in verschiedenen Projekten laufen |

## Sprache und Plattform

Diese Dokumentation ist in zwei Teile geteilt:

- **Sprache** und **Standardbibliothek** – gelten überall, wo Luna läuft: Variablen, Operatoren, Bedingungen, Schleifen, Funktionen, Tabellen, Texte, \`math\`, \`string\`, \`table\`.
- **TSG-Bots** – die Plattform Train Sim Germany: Bots in Servern und Gruppen, der Editor mit Explorer und Services, Ereignisse wie \`onjoin\`, Connectors und Webhooks.

Eine Plattform (ein „Host“) gibt Luna ihre eigenen Ereignisse, Platzhalter und Objekte. Die Sprache selbst bleibt gleich.

## Ein Bot in vier Zeilen

In Train Sim Germany schreibst du mit Luna eigene Bots für deine Server und Gruppen:

\`\`\`luna
onjoin(username) {
  print("Willkommen {username} auf {server}!")
}
\`\`\`

\`onjoin\` ist ein **Ereignis**: Die Funktion läuft, sobald jemand beitritt. \`{username}\` und \`{server}\` sind **Platzhalter**, die die Plattform füllt.

## Wo geht's weiter?

- [Luna auf einen Blick](#/luna/auf-einen-blick) – die ganze Sprache auf einer Seite
- [Playground](#/luna/playground) – Code schreiben und sofort ausführen
- [Dein erster Bot](#/luna/erster-bot) – Schritt für Schritt zum eigenen Bot
- [Versionen](#/luna/versionen) – was sich wann geändert hat
`,
  },
  {
    id: 'playground', group: 'Erste Schritte', title: 'Playground', custom: true,
    lead: 'Luna schreiben und sofort ausführen – ohne Bot und ohne Anmeldung.',
    md: '',
  },
  {
    id: 'auf-einen-blick', group: 'Erste Schritte', title: 'Luna auf einen Blick',
    lead: 'Die ganze Sprache auf einer Seite – zum Nachschlagen.',
    md: `
## Kommentare

\`\`\`luna
-- Kommentar bis zum Zeilenende
// geht auch
--[[ Kommentar
     über mehrere Zeilen ]]
\`\`\`

## Variablen und Werte

\`\`\`luna
local name = "Lok_Max"      -- Text
local zuege = 3             -- Zahl
local online = true         -- Wahrheitswert
local nichts = nil          -- kein Wert
const LINIE = "RE1"         -- Konstante
print(typeof(zuege))        -- number
\`\`\`

## Rechnen und Vergleichen

\`\`\`luna
local summe = 2 + 3 * 4     -- 14
local rest = 17 % 5         -- 2
local text = "RE" .. 1      -- "RE1"
print(summe >= 10 and rest ~= 0)
\`\`\`

## Bedingungen

\`\`\`luna
local spieler = 12
if spieler > 10 then
  print("Voll")
elseif spieler > 0 then
  print("Läuft")
else
  print("Leer")
end
\`\`\`

## Schleifen

\`\`\`luna
for i = 1, 3 do
  print("Runde " .. i)
end

local n = 0
while n < 3 do
  n += 1
end
print(n)
\`\`\`

## Funktionen

\`\`\`luna
local function gruss(name)
  return "Hallo " .. name .. "!"
end
print(gruss("Mia"))
\`\`\`

## Tabellen

\`\`\`luna
local liste = { "S1", "S2", "S3" }
table.insert(liste, "S5")
print(#liste)

local zug = { name = "ICE 4", plaetze = 918 }
for k, v in pairs(zug) do
  print(k .. ": " .. tostring(v))
end
\`\`\`

## Texte und Platzhalter

\`\`\`luna
local spieler = "Mia"
print(\`Hallo {spieler}!\`)
print(string.upper("leise"))
print(string.format("%d Züge", 4))
\`\`\`

> [!TIPP]
> Blöcke gehen auch mit geschweiften Klammern: \`if spieler > 10 { print("Voll") }\`. Such dir eine Schreibweise aus und bleib dabei.
`,
  },
  {
    id: 'erster-bot', group: 'TSG-Bots', title: 'Dein erster Bot',
    lead: 'In fünf Minuten zu einem Bot, der neue Mitglieder begrüßt und auf !regeln antwortet.',
    md: `
## 1. Bot erstellen

1. Öffne deinen Gruppen- oder Server-Chat und tippe oben auf **Info**.
2. Unter **Bots** tippst du auf **Bot erstellen**.
3. Gib ihm einen Namen, z. B. \`MyBot\`, und wähle **Erweitert**.

Der Bot-Editor öffnet sich. Links siehst du den **Explorer** mit deinem Bot und seinen vier Services.

## 2. Ein ServerScript einfügen

Neben **ServerScriptService** gibt es ein **+**. Tippe darauf und wähle **ServerScript**. Gib ihm den Namen \`Main\`.

\`\`\`luna
onjoin(username) {
  print("Willkommen {username} auf {server}! 👋")
}

oncommand(command, args) {
  if command == "regeln" {
    print("Bitte bleib freundlich und halte dich an den Fahrplan.")
  }
}
\`\`\`

## 3. Testen

Unten im Editor öffnest du **Testen**, wählst \`onjoin()\` und tippst auf **Ausführen**. Der Test läuft nur im Editor – im Chat passiert dabei nichts.

## 4. Speichern

Tippe oben auf **Speichern** (oder Strg/Cmd + S). Ab jetzt begrüßt dein Bot alle, die dem Chat beitreten. Schreibt jemand \`!regeln\`, antwortet er.

> [!HINWEIS]
> Fehler erscheinen sofort beim Tippen unter **Skriptanalyse** – mit Zeilennummer. Ein Skript mit Fehler läuft nicht, bis er behoben ist.

## 5. Bild und Präfix

Unter **Bot-Einstellungen** gibst du deinem Bot ein Bild, eine Beschreibung und ein eigenes Präfix für Befehle (z. B. \`?\` statt \`!\`). Befehle mit \`/\` gehören zum TSG-Bot.
`,
  },
  {
    id: 'editor', group: 'TSG-Bots', title: 'Der Bot-Editor',
    lead: 'Explorer und Eigenschaften links, Code rechts, offene Skripte als Tabs oben – wie in Roblox Studio.',
    md: `
## Aufbau

| Bereich | Wozu |
| --- | --- |
| **Explorer** | Die Struktur deines Bots: der Bot, darunter die Services und alles, was du eingefügt hast |
| **Eigenschaften** | Name, ClassName, Parent und Einstellungen des gewählten Objekts – plus Pfad zum Kopieren |
| **Tabs** | Deine offenen Skripte |
| **Editor** | Code mit Farben, Zeilennummern, Einrückungslinien und markierter aktueller Zeile |
| **Skriptanalyse** | Fehler und Hinweise aller Skripte – antippen springt zur Zeile |
| **Testen** | Ein Ereignis ausprobieren, ohne dass im Chat etwas passiert |
| **Ausgabe** | Was dein Bot im Chat zuletzt getan hat, mit Fehlern |

Auf dem Handy siehst du zuerst den Code. Der Knopf oben links schiebt den Explorer von links herein.

## Objekte einfügen

Das **+** neben einem Service, Ordner oder Skript öffnet das Einfügen-Menü. Oben stehen die **empfohlenen** Objekte für diesen Ort, darunter alle weiteren. Mit dem Suchfeld findest du schnell, was du brauchst.

- **ServerScript**, **ClientScript**, **GameScript**, **ModuleScript**
- **Connector** und **Webhook**
- **Folder** zum Sortieren

Neue Objekte bekommen gleich einen Namen zum Ändern – Enter bestätigt.

## Objekte bearbeiten

Rechtsklick (oder **⋯**) auf ein Objekt öffnet: Öffnen, Objekt einfügen, Umbenennen (F2), Duplizieren, Verschieben, Pfad kopieren und Löschen (Entf). Am Computer kannst du Objekte auch mit der Maus in einen anderen Ordner oder Service ziehen.

## Tastatur

| Taste | Wirkung |
| --- | --- |
| Strg/Cmd + S | Speichern |
| Tab / Umschalt + Tab | Ein- bzw. ausrücken (auch mehrere Zeilen) |
| Enter nach \`{\`, \`then\`, \`do\` | Neue Zeile eingerückt, \`}\` bzw. \`end\` kommt automatisch |
| F2 | Gewähltes Objekt umbenennen |
| Entf | Gewähltes Objekt löschen |
| ↑ ↓ ← → | Im Explorer bewegen, Ordner auf- und zuklappen |

Auf Touch-Geräten gibt es über der Tastatur eine Zeichenleiste mit \`{ }\`, \`( )\`, \`" "\`, \`..\` und \`script.Parent\`.

> [!TIPP]
> Nicht gespeicherte Änderungen gehen nicht verloren: Der Editor merkt sie sich auf deinem Gerät als Entwurf.
`,
  },
  {
    id: 'services', group: 'TSG-Bots', title: 'Explorer und Services',
    lead: 'Jeder Bot hat dieselbe Struktur: oben der Bot, darunter vier Services. Wo ein Skript liegt, entscheidet, ob und wann es läuft.',
    md: `
## Die Struktur

\`\`\`luna
-- ../MyBot                       der Bot ganz oben
--   ServerScriptService          ServerScripts laufen hier
--   ClientService                ClientScripts laufen hier
--   GameService                  GameScripts laufen hier
--   ConnectorService             Connectors und Webhooks
\`\`\`

## Die Services

| Service | Was hier läuft | Empfohlen |
| --- | --- | --- |
| **ServerScriptService** | ServerScripts – im Backend bei Ereignissen im Chat | ServerScript, ModuleScript, Folder |
| **ClientService** | ClientScripts – in der App jeder Person, die den Chat öffnet | ClientScript, ModuleScript, Folder |
| **GameService** | GameScripts – bei Ereignissen in verbundenen privaten Servern | GameScript, ModuleScript, Folder |
| **ConnectorService** | Keine Skripte – hier liegen die Verbindungen | Connector, Webhook, Folder |

> [!WARNUNG]
> Ein ServerScript im ClientService läuft nicht – genau wie ein Script in Roblox nur an bestimmten Orten läuft. Die Skriptanalyse zeigt dir das an.

## ModuleScripts sind kein Service

Ein ModuleScript ist eine Art Skript, das du **überall** ablegen darfst – in einem Service, einem Ordner oder sogar in einem anderen Skript. Es läuft nie von selbst, sondern nur, wenn ein anderes Skript es mit \`require\` lädt.

## Ordner

Mit **Folder** sortierst du deine Objekte. Ordner ändern nichts daran, ob ein Skript läuft: Ein ServerScript in einem Ordner im ServerScriptService läuft ganz normal.

## Namen

Namen bestehen aus Buchstaben, Zahlen und \`_\` und beginnen nicht mit einer Zahl – so kannst du sie im Code mit \`script.Parent.Name\` erreichen. Unter einem Parent darf jeder Name nur einmal vorkommen.
`,
  },
  {
    id: 'skripte', group: 'TSG-Bots', title: 'Skriptarten',
    lead: 'Vier Arten von Skripten – jede läuft an einem anderen Ort und reagiert auf andere Ereignisse.',
    md: `
## Übersicht

| Klasse | Läuft in | Wann | Wer sieht die Ausgabe |
| --- | --- | --- | --- |
| **ServerScript** | ServerScriptService | Ereignisse im Chat | Alle im Chat |
| **GameScript** | GameService | Ereignisse im Spiel (verbundene private Server) | Alle im Chat |
| **ClientScript** | ClientService | Wenn jemand den Chat in der App öffnet | Nur diese Person |
| **ModuleScript** | überall | Nur wenn es geladen wird | – |

## ServerScript

Läuft im Backend von Train Sim Germany. Es reagiert auf Beitritte, Austritte, Nachrichten und Befehle im Chat und kann Nachrichten in den Chat, über die Discord-Verbindung oder an Webhooks schicken.

\`\`\`luna
onmessage(text, username) {
  if contains(text, "zug") {
    print("🚆 Hat da jemand Zug gesagt, {username}?")
  }
}
\`\`\`

## GameScript

Läuft ebenfalls im Backend – aber bei Ereignissen aus dem Spiel: wenn jemand einen privaten Server betritt oder verlässt, der mit diesem Server-Chat verbunden ist.

\`\`\`luna
onjoin(username) {
  print("{username} ist jetzt auf {server} – {players} Spieler online")
}
\`\`\`

## ClientScript

Läuft in der App jeder Person, die den Chat öffnet – wie ein LocalScript in Roblox. Was \`print\` hier schreibt, sieht **nur diese Person** (markiert mit „Nur für dich“). ClientScripts können nichts nach Discord schicken.

\`\`\`luna
onopen(username) {
  print("Hallo {displayName}! Schau dir die Regeln mit !regeln an.")
}
\`\`\`

## ModuleScript

Enthält Funktionen und Werte, die andere Skripte mit \`require\` laden. Mehr dazu unter [ModuleScripts und require](#/luna/module).

## Enabled

In den Eigenschaften kannst du Skripte mit **Enabled** aus- und einschalten, ohne sie zu löschen.
`,
  },
  {
    id: 'ereignisse', group: 'TSG-Bots', title: 'Ereignisse',
    lead: 'Ereignisse sind Funktionen mit festem Namen. Luna ruft sie auf, wenn etwas passiert.',
    md: `
## So schreibt man ein Ereignis

Beide Schreibweisen sind gleich:

\`\`\`luna
onjoin(username) {
  print("Hallo {username}")
}

function onleave(username)
  print("Tschüss {username}")
end
\`\`\`

Groß- und Kleinschreibung und Unterstriche sind egal: \`onJoin\`, \`on_join\` und \`onjoin\` sind dasselbe.

## Alle Ereignisse

| Ereignis | ServerScript | GameScript | ClientScript |
| --- | --- | --- | --- |
| \`onstart()\` | ✓ beim Speichern/Einschalten | ✓ | – |
| \`onjoin(username)\` | jemand tritt dem Chat bei | jemand betritt den privaten Server | – |
| \`onleave(username)\` | jemand verlässt den Chat | jemand verlässt den privaten Server | – |
| \`onmessage(text, username)\` | neue Nachricht im Chat | – | neue Nachricht, während der Chat offen ist |
| \`oncommand(command, args)\` | Nachricht mit Präfix, z. B. \`!regeln\` | – | – |
| \`onopen(username)\` | – | – | jemand öffnet den Chat |

## Werte jedes Ereignisses

Diese Werte stehen in jedem Ereignis als Variable bereit – und als Platzhalter im Text, z. B. \`"{username}"\`:

| Name | Inhalt |
| --- | --- |
| \`username\`, \`displayName\`, \`userId\` | Die Person, um die es geht |
| \`server\`, \`chat\`, \`members\` | Name des Chats bzw. privaten Servers, Anzahl Mitglieder |
| \`game\`, \`gameId\` | „Train Sim Germany“ und die Place-ID des Spiels |
| \`serverId\`, \`players\` | ID des privaten Servers und Spieler darin (GameScript) |
| \`text\`, \`command\`, \`args\`, \`argtext\` | Nachricht, Befehl ohne Präfix, Wörter danach (Liste / Text) |
| \`bot\`, \`time\`, \`date\` | Name des Bots, Uhrzeit und Datum in deutscher Zeit |
| \`script\` | Das Skript selbst (Instance) |

## Code außerhalb von Ereignissen

Code ganz oben im Skript läuft vor jedem Ereignis – zum Vorbereiten von Werten, Funktionen und Connectors. \`print\` außerhalb eines Ereignisses wird ignoriert.

> [!HINWEIS]
> Variablen bleiben nicht von einem Ereignis zum nächsten erhalten. Dafür gibt es [save und load](#/luna/speicher).
`,
  },
  {
    id: 'pfade', group: 'TSG-Bots', title: 'Pfade: script, Parent und ../',
    lead: 'So erreichst du jedes Objekt in der Struktur – relativ zum Skript oder vom Anfang aus.',
    md: `
## script

\`script\` ist das Skript selbst. Mit \`.Parent\` gehst du eine Ebene nach oben, mit einem Namen eine Ebene nach unten.

\`\`\`luna
print(script.Name)            -- Main
print(script.Parent.Name)     -- ServerScriptService
print(script.Parent.Parent)   -- MyBot
\`\`\`

## ../ – zum Anfang der Struktur

\`../\` springt ganz nach oben. Danach kommt der Name deines Bots:

\`\`\`luna
local c = ../MyBot.ConnectorService.Connect1
\`\`\`

Das ist genau dasselbe wie – wenn das Skript direkt in einem Service liegt:

\`\`\`luna
local c = script.Parent.Parent.ConnectorService.Connect1
\`\`\`

> [!TIPP]
> Statt des Bot-Namens geht auch \`../Bot\`. Groß-/Kleinschreibung und Leerzeichen im Bot-Namen sind bei \`../\` egal.

## Pfad kopieren

In den **Eigenschaften** jedes Objekts steht sein Pfad – einmal von oben (\`../MyBot.…\`) und einmal relativ zum offenen Skript (\`script.Parent.…\`). Antippen kopiert ihn.

## Suchen statt Pfad

| Methode | Wirkung |
| --- | --- |
| \`obj:FindFirstChild(name)\` | Kind mit diesem Namen oder \`nil\` |
| \`obj:FindFirstChild(name, true)\` | Auch tiefer in Ordnern suchen |
| \`obj:WaitForChild(name)\` | Kind mit diesem Namen – Fehler, wenn es fehlt |
| \`obj:FindFirstChildOfClass(klasse)\` | Erstes Kind dieser Klasse |
| \`obj:GetChildren()\` | Liste aller Kinder |
| \`obj:GetDescendants()\` | Alle Objekte darunter |

\`\`\`luna
for _, kind in ipairs(script.Parent:GetChildren()) do
  log(kind.Name, kind.ClassName)
end
\`\`\`

## Fehler

Gibt es ein Objekt nicht, meldet Luna das sofort – schon im Editor unter Skriptanalyse: *„Texte“ gibt es in „ServerScriptService“ nicht.*
`,
  },
  {
    id: 'module', group: 'TSG-Bots', title: 'ModuleScripts und require',
    lead: 'Mit ModuleScripts teilst du Funktionen und Texte zwischen mehreren Skripten.',
    md: `
## Ein ModuleScript schreiben

Ein ModuleScript gibt am Ende mit \`return\` zurück, was andere nutzen dürfen – meist eine Tabelle:

\`\`\`luna
local Texte = {}

Texte.prefix = "🚆 "

function Texte.gruss(name) {
  return Texte.prefix .. "Willkommen " .. name .. "!"
}

return Texte
\`\`\`

Ohne \`return\` bekommt man alle Variablen und Funktionen des Moduls.

## Laden mit require

\`\`\`luna
local Texte = require(script.Parent.Texte)

onjoin(username) {
  print(Texte.gruss(username))
}
\`\`\`

Liegt das Modul in einem Ordner, gehst du den Pfad entlang: \`require(script.Parent.Lib.Texte)\` oder \`require(../MyBot.ServerScriptService.Lib.Texte)\`.

Kurzform über den Namen – wenn es nur ein ModuleScript mit diesem Namen gibt:

\`\`\`luna
local Texte = require("Texte")
\`\`\`

## Brücken

Jedes \`require\` ist eine **Brücke** zwischen zwei Skripten. Der Editor zeigt sie in den Eigenschaften: bei einem Skript, was es lädt – bei einem Modul, wer es nutzt.

## Methoden mit :

\`\`\`luna
local Zug = {}
Zug.linie = "RE1"

function Zug:beschreibung() {
  return "Linie " .. self.linie
}

return Zug
\`\`\`

\`Zug:beschreibung()\` übergibt die Tabelle automatisch als \`self\` – wie in Luau.

> [!HINWEIS]
> Ein Modul läuft pro Ereignis nur einmal; alle Skripte bekommen dieselbe Tabelle. Lädt ein Modul sich über Umwege selbst, meldet Luna einen Kreis.
`,
  },
  {
    id: 'connectors', group: 'TSG-Bots', title: 'Connectors',
    lead: 'Connectors verbinden Skripte miteinander – wie BindableEvents in Roblox.',
    md: `
## Wozu?

Ein GameScript merkt, dass jemand den privaten Server betritt – ein ServerScript soll daraufhin etwas im Chat schreiben. Ein **Connector** im ConnectorService verbindet beide.

## Zuhören mit Connect

\`\`\`luna
-- ServerScript „Main“ im ServerScriptService
local c = ../MyBot.ConnectorService.Connect1

c:Connect(function(name, spieler)
  print(name .. " ist im Spiel – " .. spieler .. " Spieler")
end)
\`\`\`

## Auslösen mit Fire

\`\`\`luna
-- GameScript „Spiel“ im GameService
onjoin(username) {
  script.Parent.Parent.ConnectorService.Connect1:Fire(username, players)
}
\`\`\`

## Methoden

| Methode | Wirkung |
| --- | --- |
| \`connector:Connect(funktion)\` | Funktion bei jedem \`Fire\` aufrufen; gibt eine Verbindung mit \`:Disconnect()\` zurück |
| \`connector:Fire(…)\` | Alle verbundenen Funktionen mit diesen Werten aufrufen |
| \`connector.Event:Connect(funktion)\` | Dasselbe wie \`Connect\` – wie bei Roblox |

> [!HINWEIS]
> Connectors verbinden Skripte auf derselben Seite: ServerScripts und GameScripts im Backend, ClientScripts in der App. Sie gelten für ein Ereignis – \`Connect\` steht deshalb meist oben im Skript.
`,
  },
  {
    id: 'webhooks', group: 'TSG-Bots', title: 'Webhooks',
    lead: 'Ein Webhook-Objekt schickt Nachrichten deines Bots in einen Discord-Kanal.',
    md: `
## Einrichten

1. In Discord: Kanal bearbeiten → **Integrationen** → **Webhooks** → neuen Webhook erstellen → **URL kopieren**.
2. Im Bot-Editor: **+** neben **ConnectorService** → **Webhook**.
3. In den **Eigenschaften** die URL einfügen und speichern.

Die URL wird beim Speichern bei Discord geprüft und nur verschlüsselt gespeichert – sie wird nie wieder angezeigt.

## Senden

\`\`\`luna
local melder = ../MyBot.ConnectorService.Melder

oncommand(command, args) {
  if command == "melden" {
    melder:Send("Meldung von {username}: " .. argtext)
    print("Danke, das Team ist informiert.")
  }
}
\`\`\`

| Methode | Wirkung |
| --- | --- |
| \`webhook:Send(text)\` | Nachricht mit Name und Bild deines Bots in den Discord-Kanal |

> [!WARNUNG]
> Webhooks senden erst, wenn die **Discord-Verbindung** des Server-Chats vom Team angenommen ist (Chat → Info → Discord verbinden). Vorher steht in der Ausgabe ein Hinweis. ClientScripts können keine Webhooks benutzen.

Erwähnungen wie @everyone werden in Discord nie ausgelöst.
`,
  },
  {
    id: 'variablen', group: 'Sprache', title: 'Variablen und Typen',
    lead: 'Werte merken und mit ihnen arbeiten.',
    md: `
## Variablen

\`\`\`luna
local name = "Mia"     -- wie in Luau
let zahl = 5           -- geht auch
const LINIE = "RE1"    -- Konstante: kann nicht geändert werden
zahl = zahl + 1
zahl += 1
\`\`\`

Variablen gelten im Block, in dem sie stehen. Ohne \`local\` angelegte Variablen gelten im ganzen Skript.

## Typen

| Typ | Beispiel | typeof() |
| --- | --- | --- |
| nil | \`nil\` | \`"nil"\` |
| Wahrheitswert | \`true\`, \`false\` | \`"boolean"\` |
| Zahl | \`42\`, \`3.5\`, \`1_000\` | \`"number"\` |
| Text | \`"Hallo"\`, \`'Hallo'\`, \`„Hallo“\` oder in Backticks | \`"string"\` |
| Tabelle | \`{1, 2}\`, \`{ name = "Mia" }\`, \`[1, 2]\` | \`"table"\` |
| Funktion | \`function(x) … end\` | \`"function"\` |
| Objekt | \`script\`, \`script.Parent\` | \`"Instance"\` |

## Was ist „falsch“?

\`false\`, \`nil\`, \`0\` und der leere Text \`""\` gelten in Bedingungen als falsch, alles andere als wahr.

## Kommentare

\`\`\`luna
-- bis zum Zeilenende
// geht auch
--[[ über
mehrere Zeilen ]]
\`\`\`
`,
  },
  {
    id: 'operatoren', group: 'Sprache', title: 'Operatoren',
    lead: 'Rechnen, vergleichen, verbinden.',
    md: `
## Rechnen

| Operator | Bedeutung |
| --- | --- |
| \`+ - * / %\` | Plus, minus, mal, geteilt, Rest |
| \`"ab" * 3\` | Text wiederholen: \`"ababab"\` |
| \`-x\` | Minus |

## Texte verbinden

\`\`\`luna
print("Hallo " .. username .. "!")   -- wie in Luau
print("Hallo " + username + "!")     -- geht auch
\`\`\`

> [!HINWEIS]
> Zwischen zwei Zahlen bedeutet \`..\` einen Bereich: \`1..5\` ist die Liste 1, 2, 3, 4, 5.

## Vergleichen

| Operator | Bedeutung |
| --- | --- |
| \`==\` | gleich |
| \`~=\` oder \`!=\` | ungleich |
| \`< > <= >=\` | kleiner, größer … (Zahlen oder Texte) |

## Logik

| Operator | Bedeutung |
| --- | --- |
| \`and\` / \`&&\` | und |
| \`or\` / \`\\|\\|\` | oder |
| \`not\` / \`!\` | nicht |

\`\`\`luna
local name = args[0] or username   -- Standardwert
\`\`\`

## Länge

\`#text\` und \`#liste\` geben die Länge zurück.
`,
  },
  {
    id: 'kontrolle', group: 'Sprache', title: 'Bedingungen und Schleifen',
    lead: 'Entscheiden und wiederholen – mit { } oder then/do … end.',
    md: `
## if

\`\`\`luna
if command == "regeln" then
  print("Bitte freundlich bleiben.")
elseif command == "hilfe" then
  print("Befehle: !regeln, !hilfe")
else
  print("Den Befehl kenne ich nicht.")
end
\`\`\`

Dasselbe mit geschweiften Klammern:

\`\`\`luna
if command == "regeln" {
  print("Bitte freundlich bleiben.")
} else if command == "hilfe" {
  print("Befehle: !regeln, !hilfe")
} else {
  print("Den Befehl kenne ich nicht.")
}
\`\`\`

## for mit Zahlen

\`\`\`luna
for i = 1, 3 do
  print(i)          -- 1, 2, 3
end

for i = 10, 1, -3 do
  print(i)          -- 10, 7, 4, 1
end

for i in 1..3 {
  print(i)
}
\`\`\`

## for über Tabellen

\`\`\`luna
local linien = {"RE1", "S7", "RB23"}

for i, linie in ipairs(linien) do
  print(i .. ": " .. linie)   -- 1: RE1 … (ab 1 wie in Luau)
end

local zug = { linie = "RE1", ziel = "Berlin" }
for key, wert in pairs(zug) do
  log(key, wert)
end
\`\`\`

## while und repeat

\`\`\`luna
local n = 0
while n < 3 do
  n += 1
end

repeat
  n -= 1
until n == 0
\`\`\`

\`break\` beendet eine Schleife, \`continue\` springt zur nächsten Runde.

> [!WARNUNG]
> Endlosschleifen werden nach 10 000 Schritten abgebrochen – mit Fehler in der Ausgabe.
`,
  },
  {
    id: 'funktionen', group: 'Sprache', title: 'Funktionen',
    lead: 'Code einmal schreiben, oft benutzen.',
    md: `
## Funktionen schreiben

\`\`\`luna
local function doppelt(x)
  return x * 2
end

function gruss(name) {
  return "Hallo " .. name
}

dreifach(x) {          -- Kurzform
  return x * 3
}

local quadrat = function(x) return x * x end
\`\`\`

Funktionen, die mit \`function\` oder in Kurzform geschrieben sind, kann man auch weiter oben im Skript schon aufrufen.

## Funktionen in Tabellen

\`\`\`luna
local Rechner = {}

function Rechner.plus(a, b)
  return a + b
end

function Rechner:name()
  return self.titel
end
\`\`\`

\`Rechner:name()\` übergibt \`Rechner\` automatisch als \`self\`.

## Rückgabe

\`return\` beendet die Funktion und gibt einen Wert zurück. Ohne \`return\` ist das Ergebnis \`nil\`.
`,
  },
  {
    id: 'tabellen', group: 'Sprache', title: 'Tabellen',
    lead: 'Listen und Objekte – wie Tabellen in Luau.',
    md: `
## Listen

\`\`\`luna
local linien = {"RE1", "S7"}      -- wie in Luau
table.insert(linien, "RB23")
print(#linien)                    -- 3
print(table.concat(linien, ", ")) -- RE1, S7, RB23
\`\`\`

Mit \`linien[0]\` greifst du auf das erste Element zu, mit \`linien[-1]\` auf das letzte. \`ipairs\`, \`table.insert\`, \`table.remove\` und \`table.find\` zählen wie in Luau ab 1.

## Objekte

\`\`\`luna
local zug = { linie = "RE1", ziel = "Berlin" }
zug.verspaetung = 2
print("{zug.linie} nach {zug.ziel}")
zug.ziel = nil                    -- Eintrag entfernen
\`\`\`

Auch \`{ linie: "RE1" }\` und \`zug["ziel"]\` gehen.

## Leere Tabellen wie in Luau

\`\`\`luna
local liste = {}
table.insert(liste, "a")
table.insert(liste, "b")
print(#liste, liste[1])           -- 2  a
\`\`\`

Eine Tabelle ist entweder eine Liste \`{1, 2}\` oder ein Objekt \`{a = 1}\` – beides gemischt gibt einen Fehler.

## Methoden von Listen

| Methode | Wirkung |
| --- | --- |
| \`l:push(x)\`, \`l:pop()\` | Hinten anfügen / wegnehmen |
| \`l:first()\`, \`l:last()\`, \`l:random()\` | Erstes, letztes, zufälliges Element |
| \`l:contains(x)\`, \`l:indexOf(x)\` | Enthalten? Position (ab 0) |
| \`l:join(", ")\`, \`l:sort()\`, \`l:reverse()\` | Verbinden, sortiert, umgedreht |
`,
  },
  {
    id: 'texte', group: 'Sprache', title: 'Texte und Platzhalter',
    lead: 'Werte direkt in Texte schreiben.',
    md: `
## Platzhalter

In jedem Text werden \`{name}\` durch Werte ersetzt – Werte des Ereignisses und deine eigenen Variablen:

\`\`\`luna
local linie = "RE1"
print("{username} fährt die {linie} auf {server}")
print("Pfad: {script.Parent.Name}")
\`\`\`

Unbekannte Platzhalter bleiben stehen. \`{{\` schreibt eine geschweifte Klammer.

## Anführungszeichen

\`"…"\`, \`'…'\`, deutsche \`„…“\` und Backticks gehen alle. \`\\n\` ist eine neue Zeile.

\`\`\`luna
print(\`Backticks wie in Luau: {username}\`)
\`\`\`

## Text-Funktionen

| Funktion | Ergebnis |
| --- | --- |
| \`string.upper(s)\`, \`s:upper()\` | GROSS |
| \`string.lower(s)\`, \`s:lower()\` | klein |
| \`string.sub(s, 1, 3)\` | Teil (ab 1, wie in Luau) |
| \`string.len(s)\`, \`#s\` | Länge |
| \`string.find(s, "zug")\` | Position oder \`nil\` |
| \`string.split(s, ",")\`, \`split(s)\` | Liste |
| \`string.rep(s, 3)\` | Wiederholen |
| \`string.format("%s hat %d", name, 3)\` | Formatieren |
| \`contains(s, "zug")\` | Enthält (ohne Groß/Klein) |
| \`replace(s, "a", "b")\` | Ersetzen |
`,
  },
  {
    id: 'speicher', group: 'TSG-Bots', title: 'Werte merken',
    lead: 'Mit save und load bleiben Werte zwischen Ereignissen erhalten.',
    md: `
## save und load

\`\`\`luna
oncommand(command) {
  if command == "zaehler" {
    local n = load("zaehler", 0) + 1
    save("zaehler", n)
    print("Der Befehl wurde {n}-mal benutzt.")
  }
}
\`\`\`

| Funktion | Wirkung |
| --- | --- |
| \`save(name, wert)\` | Wert merken (Zahl, Text, Tabelle) – \`nil\` löscht |
| \`load(name, standard)\` | Gemerkten Wert lesen oder den Standardwert |

> [!HINWEIS]
> Jeder Bot hat bis zu 50 Werte mit zusammen 8 KB. In ClientScripts liegt der Speicher auf dem Gerät der Person. Funktionen und Objekte aus dem Explorer kann man nicht speichern.
`,
  },
  {
    id: 'globals', group: 'Standardbibliothek', title: 'Globale Funktionen',
    lead: 'Funktionen, die es in jedem Skript gibt.',
    md: `
## Ausgabe

| Funktion | Wirkung |
| --- | --- |
| \`print(…)\` | Nachricht des Bots in den Chat (ClientScript: nur für die Person) |
| \`discord(text)\` | Über die angenommene Discord-Verbindung des Chats senden |
| \`warn(…)\` | Hinweis in die Ausgabe |
| \`log(…)\` | Nur in die Ausgabe |
| \`error(text)\` | Skript mit Fehler beenden |
| \`assert(bedingung, text)\` | Fehler, wenn die Bedingung falsch ist |

## Umwandeln

| Funktion | Wirkung |
| --- | --- |
| \`tostring(x)\`, \`str(x)\` | In Text |
| \`tonumber(x)\`, \`num(x)\` | In Zahl oder \`nil\` |
| \`typeof(x)\` | Typ wie in Luau: \`"string"\`, \`"table"\`, \`"Instance"\` … |
| \`type(x)\` | Typ in Luna: \`"list"\`, \`"object"\` … |

## Tabellen und Zeit

| Funktion | Wirkung |
| --- | --- |
| \`pairs(t)\`, \`ipairs(t)\` | Für \`for k, v in …\` |
| \`len(x)\`, \`keys(o)\`, \`values(o)\`, \`has(o, k)\` | Länge, Schlüssel, Werte, enthalten |
| \`random(a, b)\`, \`random(liste)\` | Zufallszahl bzw. Element |
| \`now()\` | Millisekunden seit 1970 |
| \`time()\`, \`date()\`, \`weekday()\` | „18:42“, „31.10.2026“, „Samstag“ |

## Module und Speicher

| Funktion | Wirkung |
| --- | --- |
| \`require(modul)\` | ModuleScript laden |
| \`save(name, wert)\`, \`load(name, standard)\` | Werte merken |
`,
  },
  {
    id: 'bibliotheken', group: 'Standardbibliothek', title: 'math, string, table',
    lead: 'Die Bibliotheken aus Luau – in Luna.',
    md: `
## math

| Funktion | Wirkung |
| --- | --- |
| \`math.random()\` | Zahl zwischen 0 und 1 |
| \`math.random(n)\`, \`math.random(a, b)\` | Ganze Zahl 1…n bzw. a…b |
| \`math.floor(x)\`, \`math.ceil(x)\`, \`math.round(x)\` | Ab-, auf-, runden |
| \`math.abs(x)\`, \`math.sqrt(x)\`, \`math.sign(x)\` | Betrag, Wurzel, Vorzeichen |
| \`math.min(…)\`, \`math.max(…)\`, \`math.clamp(x, a, b)\` | Kleinste, größte, begrenzen |
| \`math.pi\`, \`math.huge\` | π, unendlich |

## string

| Funktion | Wirkung |
| --- | --- |
| \`string.upper(s)\`, \`string.lower(s)\` | Groß / klein |
| \`string.len(s)\` | Länge |
| \`string.sub(s, i, j)\` | Teil von i bis j (ab 1, negative von hinten) |
| \`string.find(s, text)\` | Position (ab 1) oder \`nil\` |
| \`string.rep(s, n, trenner)\` | Wiederholen |
| \`string.split(s, trenner)\` | In Liste teilen |
| \`string.reverse(s)\`, \`string.trim(s)\` | Umdrehen, Leerzeichen weg |
| \`string.format(f, …)\` | \`%s\` Text, \`%d\` ganze Zahl, \`%f\` Zahl mit 2 Stellen |

## table

| Funktion | Wirkung |
| --- | --- |
| \`table.insert(t, x)\`, \`table.insert(t, pos, x)\` | Anfügen / einfügen (ab 1) |
| \`table.remove(t)\`, \`table.remove(t, pos)\` | Letztes / an Position entfernen |
| \`table.concat(t, trenner)\` | Zu Text verbinden |
| \`table.find(t, x)\` | Position (ab 1) oder \`nil\` |
| \`table.sort(t)\`, \`table.clear(t)\` | Sortieren, leeren |
`,
  },
  {
    id: 'api-instance', group: 'TSG-Bots', title: 'Instance',
    lead: 'Alle Objekte im Explorer – der Bot, die Services, Skripte, Connectors, Webhooks und Ordner – sind Instances.',
    md: `
## Eigenschaften

| Eigenschaft | Typ | Beschreibung |
| --- | --- | --- |
| \`Name\` | string | Name im Explorer |
| \`ClassName\` | string | Klasse, z. B. \`"ServerScript"\` |
| \`Parent\` | Instance | Objekt darüber |

Eigenschaften stellst du im Editor ein – im Skript sind sie nur lesbar.

## Methoden

| Methode | Rückgabe | Beschreibung |
| --- | --- | --- |
| \`GetChildren()\` | table | Alle direkten Kinder |
| \`GetDescendants()\` | table | Alle Objekte darunter |
| \`FindFirstChild(name, tief)\` | Instance? | Kind mit Namen (mit \`true\` auch tiefer) |
| \`FindFirstChildOfClass(klasse)\` | Instance? | Erstes Kind dieser Klasse |
| \`WaitForChild(name)\` | Instance | Kind mit Namen, sonst Fehler |
| \`IsA(klasse)\` | boolean | Gehört zur Klasse? \`"Script"\` passt auf Server-, Client- und GameScripts |
| \`GetFullName()\` | string | z. B. \`MyBot.ServerScriptService.Main\` |

## Kinder

Kinder erreichst du mit ihrem Namen: \`script.Parent.Texte\`. Gibt es keines, gibt es einen Fehler – mit \`FindFirstChild\` bekommst du stattdessen \`nil\`.
`,
  },
  {
    id: 'api-klassen', group: 'TSG-Bots', title: 'Klassen',
    lead: 'Was jede Klasse kann.',
    md: `
## Bot

Ganz oben in der Struktur, erreichbar mit \`../MyBot\` oder \`script.Parent.Parent\` (aus einem Skript direkt in einem Service). Kinder: die vier Services.

## ServerScriptService · ClientService · GameService · ConnectorService

Die vier Services. Sie legen fest, wo Skripte laufen – siehe [Explorer und Services](#/luna/services).

## ServerScript · ClientScript · GameScript

| Eigenschaft | Typ | Beschreibung |
| --- | --- | --- |
| \`Enabled\` | boolean | Läuft das Skript? (im Editor einstellbar) |

## ModuleScript

Wird mit \`require\` geladen und gibt seinen \`return\`-Wert zurück.

## Connector

| Methode | Beschreibung |
| --- | --- |
| \`Connect(funktion)\` | Bei jedem \`Fire\` aufrufen – gibt eine Verbindung mit \`Disconnect()\` |
| \`Fire(…)\` | Alle verbundenen Funktionen aufrufen |

| Eigenschaft | Beschreibung |
| --- | --- |
| \`Event\` | Der Connector selbst – für \`Connect1.Event:Connect(…)\` |

## Webhook

| Methode | Beschreibung |
| --- | --- |
| \`Send(text)\` | Nachricht in den Discord-Kanal (nur Server- und GameScripts, mit angenommener Discord-Verbindung) |

## Folder

Ordner zum Sortieren. Hat keine eigenen Eigenschaften oder Methoden.
`,
  },
  {
    id: 'grenzen', group: 'Referenz', title: 'Grenzen und Fehler',
    lead: 'Damit Bots den Chat nicht überfluten und alle schnell bleiben.',
    md: `
## Grenzen

| Was | Grenze |
| --- | --- |
| Bots pro Chat | 5 |
| Objekte pro Bot | 40 |
| Zeichen pro Skript | 12 000 (zusammen 100 000) |
| Nachrichten pro Ereignis | 5 (\`print\`, \`discord\` und Webhooks je 5) |
| Nachrichten pro Minute und Bot | 20 |
| Schritte pro Ereignis | 10 000 |
| Verschachtelte Aufrufe | 60 |
| Texte | 4 000 Zeichen, Bot-Nachrichten 1 900 |
| Gemerkte Werte | 50, zusammen 8 KB |

Nachrichten von Bots lösen keine Bots aus – so entstehen keine Schleifen.

## Häufige Fehler

| Meldung | Lösung |
| --- | --- |
| *„end“ fehlt – „function“ aus Zeile 3 wird nicht geschlossen* | Am Ende des Blocks \`end\` (bzw. \`}\`) ergänzen |
| *„x“ gibt es nicht* | Variable vorher mit \`local\` anlegen oder Tippfehler prüfen |
| *„Texte“ ist kein Kind und keine Eigenschaft von „ServerScriptService“* | Pfad prüfen – Eigenschaften zeigen den richtigen Pfad |
| *Das Skript braucht zu viele Schritte* | Endlosschleife? Bedingung von \`while\` prüfen |
| *ServerScripts laufen nur in ServerScriptService* | Skript in den richtigen Service ziehen |
| *Webhook sendet erst, wenn die Discord-Verbindung angenommen ist* | Discord-Verbindung im Chat einreichen |
`,
  },
  {
    id: 'luau', group: 'Referenz', title: 'Unterschiede zu Luau',
    lead: 'Luna ist fast wie Luau – hier ist, was anders ist.',
    md: `
## Was gleich ist

\`local\`, \`function … end\`, \`if … then … elseif … else … end\`, \`for i = 1, 10 do\`, \`for k, v in pairs(t) do\`, \`while … do\`, \`repeat … until\`, \`~=\`, \`#\`, \`..\` zum Verbinden, \`and\`/\`or\`/\`not\`, \`--\`-Kommentare, \`script.Parent\`, \`require\`, \`:Connect\`/\`:Fire\`, \`FindFirstChild\`, \`WaitForChild\`, \`math\`, \`string\`, \`table\`, \`typeof\`, \`tostring\`, \`tonumber\`, Backtick-Texte mit \`{wert}\`.

## Was Luna zusätzlich kann

| Luna | Bedeutung |
| --- | --- |
| \`{ … }\` statt \`then/do … end\` | Beide Schreibweisen gehen |
| \`onjoin() { … }\` | Ereignisse als Funktionen |
| \`"Hallo {username}"\` | Platzhalter in allen Texten, nicht nur in Backticks |
| \`../MyBot\` | Zum Anfang der Struktur |
| \`1..5\` | Bereich (zwischen zwei Zahlen) |
| \`[1, 2]\`, \`{ a: 1 }\` | Zusätzliche Schreibweisen für Tabellen |
| \`+\`, \`!=\`, \`&&\`, \`\\|\\|\`, \`!\`, \`//\` | Wie in JavaScript |
| \`let\`, \`const\`, \`+=\` | Variablen und Kurzschreibweisen |

## Was anders ist

| Luau | Luna |
| --- | --- |
| \`1 .. 2\` ergibt \`"12"\` | \`1..2\` ist ein Bereich – \`tostring(1) .. 2\` verbindet |
| Nur \`nil\` und \`false\` sind falsch | Auch \`0\` und \`""\` sind falsch |
| \`liste[1]\` ist das erste Element | \`liste[0]\` – \`ipairs\` und \`table.*\` zählen aber ab 1 |
| \`task.wait\`, \`wait\` | Gibt es nicht – Skripte laufen nur kurz bei einem Ereignis |
| \`game:GetService(…)\` | \`../MyBot.ServerScriptService\` |
| \`Instance.new\` | Objekte legst du im Explorer an |
`,
  },
  {
    id: 'versionen', group: 'Referenz', title: 'Versionen',
    lead: 'Was sich an Luna geändert hat – und wie es weitergeht.',
    md: `
## Luna 2.1 – November 2026

- **Playground**: Luna ohne Bot ausführen, \`print()\` geht auch außerhalb von Ereignissen
- \`runScript()\` – Luna in eigene Projekte einbetten (siehe unten)
- Neuer Platzhalter \`{channel}\`: Kanal der Nachricht in Servern mit Kanälen
- Dokumentation neu gegliedert: Sprache, Standardbibliothek und Plattform getrennt

## Luna 2.0 – Oktober 2026

- Fast wie Luau: \`local\`, \`then/do … end\`, \`repeat … until\`, \`~=\`, \`#\`, \`..\`
- Explorer mit Services, \`script.Parent\`, \`../MyBot\`, ModuleScripts mit \`require\`
- Connectors (\`:Connect\`, \`:Fire\`) und Webhooks

## Luna 1.0 – Oktober 2026

- Erste Version: Ereignisse wie \`onjoin() { … }\`, Platzhalter, \`print\`, \`save\` und \`load\`

## Versprechen

Skripte, die heute laufen, sollen auch morgen laufen. Neue Funktionen erhöhen die kleine Zahl (2.1 → 2.2). Ändert sich etwas so, dass alte Skripte brechen, steigt die große Zahl (2 → 3) – das wird vorher angekündigt.

## Luna in eigenen Projekten

Der Interpreter steckt in einer einzigen Datei ohne Abhängigkeiten und läuft im Browser und auf Servern:

| Funktion | Wofür |
| --- | --- |
| \`runScript(code, { vars, events })\` | Ein Skript ausführen – Ausgabe, Fehler und Schritte kommen zurück |
| \`parse(code)\` | Nur prüfen, ob der Code richtig geschrieben ist |
| \`highlight(code)\` | Code einfärben (für eigene Editoren) |

> [!HINWEIS]
> Eigene Projekte können Luna eigene Ereignisse und Platzhalter geben. Die Sprache bleibt dabei gleich – so funktioniert alles aus „Sprache“ und „Standardbibliothek“ überall.
`,
  },
  {
    id: 'beispiele', group: 'Beispiele', title: 'Beispiele',
    lead: 'Fertige Bausteine zum Kopieren.',
    md: `
## Begrüßung mit Zufall

\`\`\`luna
local gruesse = {"Willkommen", "Hallo", "Schön, dass du da bist"}

onjoin(username) {
  print(random(gruesse) .. ", {username}! 🚆")
}
\`\`\`

## Befehle mit Hilfe

\`\`\`luna
local befehle = {
  regeln = "Bitte bleib freundlich und halte dich an den Fahrplan.",
  discord = "Unser Discord: discord.gg/…",
}

oncommand(command, args) {
  if command == "hilfe" then
    print("Befehle: !" .. join(keys(befehle), ", !"))
  elseif befehle[command] then
    print(befehle[command])
  end
}
\`\`\`

## Würfeln und Zählen

\`\`\`luna
function oncommand(command, args)
  if command == "wuerfeln" then
    local seiten = tonumber(args[0]) or 6
    print("{username} würfelt eine " .. math.random(1, seiten))
  elseif command == "zaehler" then
    local n = load("zaehler", 0) + 1
    save("zaehler", n)
    print("Zähler: {n}")
  end
end
\`\`\`

## Spiel → Chat über einen Connector

\`\`\`luna
-- GameScript im GameService
onjoin(username) {
  ../MyBot.ConnectorService.ImSpiel:Fire(username, players)
}
\`\`\`

\`\`\`luna
-- ServerScript im ServerScriptService
local imSpiel = ../MyBot.ConnectorService.ImSpiel

imSpiel:Connect(function(name, spieler)
  print("🎮 {name} ist jetzt auf dem Server ({spieler} Spieler)")
end)
\`\`\`

## Meldungen nach Discord

\`\`\`luna
local team = ../MyBot.ConnectorService.TeamMelder

oncommand(command, args) {
  if command == "melden" and #args > 0 {
    team:Send("📣 {username} meldet: " .. argtext)
    print("Danke {username}, das Team schaut sich das an.")
  }
}
\`\`\`

## Gemeinsames Modul

\`\`\`luna
-- ModuleScript „Texte“ im Ordner „Lib“
local Texte = {}

function Texte.fett(text)
  return "**" .. text .. "**"
end

return Texte
\`\`\`

\`\`\`luna
-- ServerScript
local Texte = require(script.Parent.Lib.Texte)

onjoin(username) {
  print("Willkommen " .. Texte.fett(username))
}
\`\`\`
`,
  },
];

// Reihenfolge wie im Menü (Gruppen nach GROUPS, innerhalb der Gruppe wie oben) – für „Zurück“ und „Weiter“
PAGES.sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group));

// ---------- Darstellung ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const slug = (s) => String(s).toLowerCase().replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c])).replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Code in Backticks bleibt unverändert (kein fett, keine Links darin)
function inline(s) {
  const codes = [];
  return esc(s)
    .replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; })
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\((#\/luna[^)]*|https:\/\/[^)]+)\)/g, (m, text, href) => `<a href="${href}"${href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`)
    .replace(/\u0000(\d+)\u0000/g, (m, i) => `<code>${codes[+i]}</code>`);
}
export function codeHtml(code) {
  return highlight(code).map(([k, t]) => (k === 'ws' ? esc(t) : `<span class="tk-${k}">${esc(t)}</span>`)).join('');
}
// Kleines Markdown → { html, toc: [{ id, text, level }] }
export function render(md, pageId = '') {
  const lines = String(md).replace(/\r/g, '').split('\n');
  const out = [];
  const toc = [];
  let i = 0;
  const flushPara = (buf) => { if (buf.length) out.push(`<p>${inline(buf.join(' '))}</p>`); };
  let para = [];
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flushPara(para); para = [];
      const lang = line.slice(3).trim() || 'luna';
      const buf = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i += 1; }
      i += 1;
      const code = buf.join('\n');
      const tryBtn = lang === 'luna' ? '<button type="button" data-doc-try>Ausprobieren</button>' : '';
      out.push(`<figure class="doc-code"><figcaption><span>${lang === 'luna' ? 'Luna' : esc(lang)}</span>${tryBtn}<button type="button" data-doc-copy>Kopieren</button></figcaption><pre><code>${lang === 'luna' ? codeHtml(code) : esc(code)}</code></pre><textarea hidden data-doc-src>${esc(code)}</textarea></figure>`);
      continue;
    }
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      flushPara(para); para = [];
      const level = h[1].length;
      const text = h[2].trim();
      const id = slug(text);
      toc.push({ id, text, level });
      out.push(`<h${level} id="doc-${id}"><a href="#/luna/${pageId}?h=${id}" data-doc-anchor="${id}">${inline(text)}</a></h${level}>`);
      i += 1;
      continue;
    }
    const call = line.match(/^>\s*\[!(TIPP|HINWEIS|WARNUNG)\]/);
    if (call) {
      flushPara(para); para = [];
      const buf = [];
      i += 1;
      while (i < lines.length && /^>/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i += 1; }
      const kind = call[1].toLowerCase();
      out.push(`<aside class="doc-note doc-note--${kind}"><b>${{ tipp: 'Tipp', hinweis: 'Hinweis', warnung: 'Achtung' }[kind]}</b><p>${inline(buf.join(' '))}</p></aside>`);
      continue;
    }
    if (/^\|/.test(line)) {
      flushPara(para); para = [];
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i += 1; }
      const cells = (r) => r.replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      out.push(`<div class="doc-table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^(-|\d+\.)\s+/.test(line)) {
      flushPara(para); para = [];
      const ordered = /^\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^(-|\d+\.)\s+/.test(lines[i])) { items.push(lines[i].replace(/^(-|\d+\.)\s+/, '')); i += 1; }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    if (!line.trim()) { flushPara(para); para = []; i += 1; continue; }
    para.push(line.trim());
    i += 1;
  }
  flushPara(para);
  return { html: out.join('\n'), toc };
}
// Suche: Titel, Einleitung und Text
export function search(q) {
  const s = String(q || '').trim().toLowerCase();
  if (s.length < 2) return [];
  return PAGES.filter((p) => !p.custom).map((p) => {
    const hay = `${p.title}\n${p.lead}\n${p.md}`.toLowerCase();
    const at = hay.indexOf(s);
    if (at < 0) return null;
    const raw = `${p.title}\n${p.lead}\n${p.md}`;
    const snip = raw.slice(Math.max(0, at - 40), at + 80).replace(/[`*#>|]/g, '').replace(/\s+/g, ' ').trim();
    return { id: p.id, title: p.title, group: p.group, snip, score: p.title.toLowerCase().includes(s) ? 0 : 1 };
  }).filter(Boolean).sort((a, b) => a.score - b.score);
}
