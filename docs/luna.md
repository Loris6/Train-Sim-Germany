# Luna – Skriptsprache für eigene Bots

Die ausführliche Dokumentation steht in der App unter **#/luna** (z. B. https://loris6.github.io/Train-Sim-Germany/#/luna) –
mit Suche, Beispielen und Referenz. Die Inhalte liegen in [`assets/js/luna-docs.js`](../assets/js/luna-docs.js),
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
