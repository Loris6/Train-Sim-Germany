# Luna – eine einfache Programmiersprache

Luna ist eine kleine Programmiersprache (aktuell Version 2.1): gut lesbar, sicher im Sandkasten und einbettbar.
Heute läuft sie für eigene Bots in Train Sim Germany; Sprache und Standardbibliothek sind von der Plattform getrennt,
damit Luna auch in anderen Projekten laufen kann (`runScript()` in `backend/luna.js`).

Die ausführliche Dokumentation steht in der App unter **#/luna** (z. B. https://loris6.github.io/Train-Sim-Germany/#/luna) –
mit Startseite, Suche, Beispielen, Referenz und einem **Playground** (`#/luna/playground`), in dem man Luna ohne Bot ausführt.
Für den Chief Engineer gibt es zusätzlich `#/luna/intern` (Luna von innen, Inhalt kommt nur für diesen Rang aus dem Backend: `backend/luna-intern.js`). Die Inhalte liegen in [`assets/js/luna-docs.js`](../assets/js/luna-docs.js),
der Interpreter in [`backend/luna.js`](../backend/luna.js) (läuft im Backend und in der App).

## Kurz

Luna ist fast wie Luau aus Roblox – nur anders:

```luna
-- ServerScript „Main“ im ServerScriptService
local Texte = require(script.Parent.Lib.Texte)
local imSpiel = ../MyBot.ConnectorService.ImSpiel   -- dasselbe wie script.Parent.Parent.ConnectorService.ImSpiel

imSpiel:Connect(function(name)
  print(name .. " ist jetzt im Spiel")
end)

onjoin(username) {
  print(Texte.gruss(username))
}

function oncommand(command, args)
  if command == "regeln" then
    print("Bitte halte dich an die Regeln von {server}.")
  end
end
```

- Blöcke mit `{ … }` oder `then`/`do` … `end`, `local`, `function`, `~=`, `#`, `..`, `--`-Kommentare
- Platzhalter in Texten: `"Hallo {username}"`, auch Backticks
- `script`, `script.Parent`, `../MyBot` (Anfang der Struktur), `FindFirstChild`, `WaitForChild`, `GetChildren`, `IsA`
- `require(script.Parent.Modul)` oder `require("Modul")`
- Connectors (`:Connect`, `:Fire`) und Webhooks (`:Send`) im ConnectorService
- `math`, `string`, `table`, `pairs`, `ipairs`, `tostring`, `tonumber`, `typeof`, `save`/`load`

## Aufbau eines Bots (Explorer)

| Service | Was hier läuft |
| --- | --- |
| ServerScriptService | ServerScripts – im Backend bei Ereignissen im Chat (`onstart`, `onjoin`, `onleave`, `onmessage`, `oncommand`) |
| ClientService | ClientScripts – in der App der Person, die den Chat öffnet (`onopen`, `onmessage`), nur sie sieht die Ausgabe |
| GameService | GameScripts – bei Ereignissen in verbundenen privaten Servern (`onstart`, `onjoin`, `onleave`) |
| ConnectorService | Connectors (verbinden Skripte) und Webhooks (Discord) |

ModuleScripts und Ordner dürfen überall liegen.

## Grenzen

5 Bots je Chat, 40 Objekte je Bot, 12 000 Zeichen je Skript, 5 Nachrichten je Ereignis, 20 pro Minute und Bot,
10 000 Schritte je Ereignis. Webhooks senden erst, wenn die Discord-Verbindung des Server-Chats angenommen ist.

## Dokumentation bearbeiten

Alle Seiten stehen in `assets/js/luna-docs.js` im Array `PAGES` (`id`, `group`, `title`, `lead`, `md`). Das Markdown kann
Überschriften (`##`, `###`), Listen, Tabellen, Code in Backticks, `**fett**`, Links (`[Text](#/luna/seite)`), Codeblöcke mit
`luna` (mit „Kopieren“ und „Ausprobieren“) und Hinweise (`> [!TIPP]`, `> [!HINWEIS]`, `> [!WARNUNG]`). Backticks und `${`
im Text brauchen einen Backslash. Prüfen mit `node tools/check-luna-docs.mjs`, danach `CACHE` in `sw.js` erhöhen.

## Eigene Funktion hinzufügen

1. In `backend/luna.js` in `makeBuiltins()` mit `def('name', (args, node) => …)` (oder in `lib('math', …)`) ergänzen,
   Eingaben mit `needNum`/`needStr`/`needTable` prüfen.
2. Den Namen in `BUILTIN_NAMES` eintragen (Farbe im Editor) und in `DOCS.functions` beschreiben.
3. In der Dokumentation (`globals` bzw. `bibliotheken`) mit Beispiel erklären, `VERSION` und die Seite „Versionen“ anpassen.
4. Testen, pushen – `backend.yml` veröffentlicht das Backend, GitHub Pages die App; `CACHE` in `sw.js` erhöhen.
