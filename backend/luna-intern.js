/*
 * Luna von innen – Erklärseite nur für den Chief Engineer (#/luna/intern)
 *
 * Wird vom Backend nur an den Rang Chief Engineer ausgeliefert (GET /api/luna/intern) und in der App mit demselben
 * kleinen Markdown wie die Dokumentation dargestellt (siehe assets/js/luna-docs.js).
 * Achtung: Text in JavaScript-Backticks – Backtick und Dollar mit Klammer brauchen einen Backslash davor.
 * Prüfen: node tools/check-luna-docs.mjs
 */
export const LUNA_INTERN_DATE = '2026-11-01';

export const LUNA_INTERN = `
## Für dich als Chief Engineer

Diese Seite sieht nur der **Chief Engineer**. Sie erklärt dir persönlich, wie Luna von innen funktioniert – welches Teil was macht, wo es im Code steht und wie du die Sprache selbst erweiterst. Du musst dafür kein Profi sein: Wenn du verstehst, wie die Teile zusammenspielen, weißt du bei jeder Änderung, wo du hinmusst.

> [!HINWEIS]
> Der Inhalt dieser Seite kommt aus dem Backend und wird nur an den Rang Chief Engineer ausgeliefert. Die Quelle liegt in \`backend/luna-intern.js\` im Repository – wer Zugriff auf das Repository hat, kann sie dort lesen.

## Das große Bild

Ein Luna-Skript ist zuerst nur Text. Bis daraus „Willkommen Max!“ im Chat wird, läuft es durch vier Stationen:

| Station | Was passiert | Wo im Code |
| --- | --- | --- |
| **1. Lexer** | Zerlegt den Text in Wörter („Tokens“): Namen, Zahlen, Texte, Zeichen wie \`==\` | \`lex()\` in \`backend/luna.js\` |
| **2. Parser** | Baut aus den Tokens einen Baum („AST“): was ist eine Bedingung, was eine Schleife, was ein Aufruf | \`parse()\` in \`backend/luna.js\` |
| **3. Interpreter** | Läuft den Baum ab und rechnet wirklich: Variablen, Funktionen, Schleifen | \`class Runtime\` in \`backend/luna.js\` |
| **4. Plattform** | Entscheidet, wann ein Skript läuft und was mit \`print()\` passiert | \`backend/bots.js\`, \`backend/chat.js\`, \`assets/js/app.js\` |

Die Stationen 1–3 sind **die Sprache**. Sie wissen nichts von Chats oder Roblox. Station 4 ist **die Plattform** – hier Train Sim Germany. Genau diese Trennung macht Luna für andere Projekte nutzbar.

## Die Dateien

| Datei | Was drin ist |
| --- | --- |
| \`backend/luna.js\` | Die ganze Sprache in einer Datei: Lexer, Parser, Interpreter, Standardbibliothek, Explorer-Objekte, Prüfung im Editor, Farben, \`runEvent()\`, \`runScript()\` |
| \`backend/bots.js\` | Bots speichern, Ereignisse an Bots geben, Grenzen pro Minute, Webhooks senden |
| \`backend/chat.js\` | Wann Ereignisse entstehen: jemand tritt bei, schreibt, nutzt einen Befehl |
| \`assets/js/app.js\` | Bot-Editor (\`#/bots/…\`), ClientScripts in der App, Playground und Doku-Seite |
| \`assets/js/luna-docs.js\` | Der Text der öffentlichen Dokumentation |
| \`backend/luna-intern.js\` | Diese Seite |

\`backend/luna.js\` wird **zweimal** benutzt: vom Backend (ServerScripts, GameScripts) und von der App (ClientScripts, Testen, Playground). Darum muss alles darin ohne Node.js und ohne Browser-Besonderheiten laufen.

## 1. Der Lexer – Text in Wörter

Der Lexer liest Zeichen für Zeichen und macht daraus eine Liste von Tokens. Jedes Token merkt sich Zeile und Spalte – deshalb kann Luna später sagen „Zeile 4: …“.

| Er erkennt | Beispiele |
| --- | --- |
| Zahlen | \`3\`, \`2.5\`, \`1000\` |
| Texte | \`"Hallo"\`, \`'Hallo'\`, \`„Hallo“\` und Backtick-Texte; Platzhalter wie \`{username}\` werden markiert |
| Namen und Schlüsselwörter | \`name\`, \`local\`, \`function\`, \`if\`, \`then\`, \`end\` (Liste: \`KEYWORDS\`) |
| Zeichen | \`+\`, \`==\`, \`~=\`, \`..\`, \`../\` (Liste: \`OPS\`) |
| Kommentare | \`--\`, \`//\`, \`--[[ … ]]\`, \`/* … */\` – werden übersprungen |

Neues Schlüsselwort? Dann gehört es in \`KEYWORDS\`. Neues Zeichen? In \`OPS\` – längere Zeichen immer **vor** kürzeren (\`..\` vor \`.\`), sonst erkennt der Lexer sie falsch.

## 2. Der Parser – Wörter in einen Baum

Der Parser liest die Tokens und baut daraus Knoten. Aus

\`\`\`luna
if spieler > 10 then
  print("Voll")
end
\`\`\`

wird ungefähr: *Knoten „if“ mit Bedingung (spieler > 10) und Block [Aufruf print("Voll")]*. Jeder Knoten hat ein Kürzel \`k\`, z. B. \`if\`, \`while\`, \`call\`, \`let\`, \`func\`.

Der Parser ist auch der Ort für **Fehlermeldungen beim Schreiben**: „„end“ fehlt – „function“ aus Zeile 3 wird nicht geschlossen“. Wenn du Luna eine neue Schreibweise beibringen willst (z. B. ein neues \`switch\`), änderst du zuerst den Parser.

Damit nicht jedes Ereignis den Code neu zerlegt, merkt sich \`cached()\` die letzten 200 fertigen Bäume.

## 3. Der Interpreter – der Baum wird lebendig

\`class Runtime\` läuft den Baum ab:

- \`exec()\` führt Anweisungen aus (Variable anlegen, \`if\`, Schleifen, \`return\`)
- \`eval()\` rechnet Ausdrücke aus (\`2 + 3\`, \`name .. "!"\`, Aufrufe)
- \`Scope\` ist ein „Raum“ für Variablen. Jede Funktion und jede Schleife bekommt einen eigenen, der auf den äußeren zeigt – so findet \`local\` die richtige Variable
- \`LFunc\` ist eine Funktion aus Luna, \`LNative\` eine eingebaute Funktion aus JavaScript (z. B. \`print\`)
- \`LInst\` ist ein Objekt aus dem Explorer (Skript, Ordner, Service, Connector)

### Sicherheit: der Sandkasten

Luna führt **nie** JavaScript aus, das jemand schreibt – es gibt kein \`eval\`. Ein Skript kann nur, was der Interpreter erlaubt. Dazu kommen Grenzen (\`LIMITS\` in \`backend/luna.js\`):

| Grenze | Wert | Warum |
| --- | --- | --- |
| Schritte je Ereignis | 10 000 | Endlosschleifen stoppen |
| Verschachtelung | 60 | Endlose Rekursion stoppen |
| Textlänge | 4 000 Zeichen | Speicher schützen |
| Listen | 2 000 Elemente | Speicher schützen |
| Nachrichten je Ereignis | 5 | Spam verhindern (dazu 20 pro Minute je Bot in \`bots.js\`) |

Tabellen werden ohne JavaScript-Prototyp angelegt, und Methoden werden nur aus eigenen Listen gesucht (\`methodOf\` mit \`hasOwn\`). So kommt niemand über Tricks wie \`"a".constructor\` an JavaScript heran. **Wichtig für dich:** Diese Regeln nie lockern, wenn du Funktionen ergänzt.

## 4. Die Plattform – wann läuft was?

Luna selbst wartet nicht auf Ereignisse. Die Plattform ruft sie auf:

1. Im Chat passiert etwas – z. B. jemand schreibt (\`postMessage\` in \`backend/chat.js\`).
2. \`botsEvent()\` in \`backend/bots.js\` geht alle eingeschalteten Bots durch.
3. Für jeden Bot ruft es \`runEvent()\` aus \`backend/luna.js\` auf: Erst laufen alle Skripte einmal an (damit Connectors verbunden sind), dann wird die passende Funktion wie \`onmessage\` aufgerufen.
4. Zurück kommen \`says\` (für \`print\`), \`discords\`, \`webhooks\`, \`logs\` und \`errors\`. \`bots.js\` schreibt die Nachrichten in den Kanal und merkt sich das Protokoll.

ClientScripts laufen genauso, nur in der App (\`runClientBots\` in \`assets/js/app.js\`) – ihre Ausgabe sieht nur die Person selbst.

\`runScript()\` ist die Variante **ohne Bot**: ein Skript, \`print()\` geht überall. Sie wird vom Playground benutzt und ist der Einstieg für andere Projekte.

## Die Dokumentation bearbeiten

Die öffentliche Dokumentation steht komplett in \`assets/js/luna-docs.js\`. Jede Seite ist ein Eintrag in \`PAGES\`:

| Feld | Bedeutung |
| --- | --- |
| \`id\` | Adresse: \`#/luna/<id>\` – nur Kleinbuchstaben, Zahlen, Bindestrich. Nicht ändern, wenn andere Seiten darauf verlinken |
| \`group\` | Gruppe links im Menü, muss in \`GROUPS\` stehen |
| \`title\`, \`lead\` | Überschrift und der Satz darunter |
| \`md\` | Der Text als kleines Markdown |

Das Markdown kann: \`##\`/\`###\` Überschriften (erscheinen automatisch in „Auf dieser Seite“), Absätze, Listen mit \`-\` oder \`1.\`, Tabellen, Code in Backticks, \`**fett**\`, Links wie \`[Text](#/luna/seite)\` und Hinweise:

\`\`\`text
> [!TIPP]
> Ein guter Tipp.
\`\`\`

Statt \`TIPP\` gehen auch \`HINWEIS\` und \`WARNUNG\`. Codeblöcke mit \`luna\` bekommen Farben sowie „Kopieren“ und „Ausprobieren“.

### Darauf musst du achten

- Der Text steht selbst in JavaScript-Backticks. Darum bekommen ein Backtick und ein Dollarzeichen mit Klammer im Text einen Backslash davor – genau wie im Kasten unten.
- Ein senkrechter Strich **in** einer Tabellenzelle bekommt ebenfalls einen Backslash.

\`\`\`text
Im Text von md:     \\\`code\\\`     \\\${wert}
In einer Tabelle:   | a \\|\\| b |
\`\`\`
- Prüf die Doku vor dem Pushen mit \`node tools/check-luna-docs.mjs\` im Projektordner: Sie testet jeden \`luna\`-Codeblock, jede Seite und jeden Link auf \`#/luna/…\` und sagt dir genau, wo etwas nicht stimmt.
- Neue Seite: an die richtige Stelle in \`PAGES\`, die Reihenfolge im Menü ergibt sich aus \`GROUPS\` und der Reihenfolge in der Datei.
- Danach im \`sw.js\` die Zahl in \`CACHE\` um eins erhöhen (z. B. \`tsg-v23\` → \`tsg-v24\`), damit installierte Apps die neue Doku laden.

## Eine eigene Funktion hinzufügen

Beispiel: Du willst \`round2(x)\` – rundet auf zwei Nachkommastellen.

### 1. Die Funktion bauen

In \`backend/luna.js\` in \`makeBuiltins()\` steht jede eingebaute Funktion als \`def(name, (args, node) => …)\`. Dort ergänzen:

\`\`\`text
def('round2', ([x], n) => Math.round(needNum(x, 'round2', n) * 100) / 100);
\`\`\`

- \`args\` ist die Liste der Argumente, \`n\` der Knoten im Baum (für Zeilennummern in Fehlermeldungen).
- Prüf die Eingaben mit \`needNum\`, \`needStr\`, \`needTable\` – dann bekommt man eine deutsche Fehlermeldung statt eines Absturzes.
- Gib nur Luna-Werte zurück: Zahl, Text, \`true\`/\`false\`, \`null\`, Listen oder Tabellen.
- Texte und Listen, die wachsen können, mit \`rt.checkStr\` bzw. \`rt.checkList\` begrenzen.

Für Funktionen in einer Bibliothek (wie \`math.floor\`) ergänzt du sie im passenden \`lib('math', { … })\`.

### 2. Farbe im Editor

Den Namen in \`BUILTIN_NAMES\` (weiter unten in \`backend/luna.js\`) eintragen – dann wird er im Editor eingefärbt.

### 3. Dokumentieren

- In \`DOCS.functions\` in \`backend/luna.js\` eine Zeile ergänzen (erscheint in der Hilfe im Editor).
- In \`assets/js/luna-docs.js\` auf der Seite „Globale Funktionen“ (\`globals\`) bzw. „math, string, table“ einen Abschnitt mit Beispiel schreiben.
- In der Seite „Versionen“ eintragen und \`VERSION\` oben in \`backend/luna.js\` erhöhen (neue Funktion = kleine Zahl, z. B. 2.1 → 2.2).

### 4. Testen und veröffentlichen

1. Lokal ausprobieren: im Playground (\`#/luna/playground\`) oder mit \`node\` und \`runScript('print(round2(3.14159))')\`.
2. Doku prüfen mit \`node tools/check-luna-docs.mjs\` (prüft auch, ob Luna grundsätzlich läuft).
3. Committen und pushen. Der Workflow \`backend.yml\` veröffentlicht das Backend automatisch, sobald sich etwas in \`backend/\` ändert – damit kennen auch ServerScripts die neue Funktion. Die App kommt über GitHub Pages.
4. \`CACHE\` in \`sw.js\` erhöhen, damit installierte Apps die neue \`luna.js\` laden.

> [!WARNUNG]
> Eine Funktion, die ins Internet geht, Dateien liest oder lange rechnet, gehört **nicht** in die Sprache. So etwas bekommt die Plattform – kontrolliert und mit Grenzen, wie die Webhooks in \`bots.js\`.

## Ein neues Ereignis hinzufügen

Beispiel: \`onreaction()\`, wenn jemand auf eine Nachricht reagiert.

1. In \`backend/luna.js\` den Namen in \`EVENTS\` bei der passenden Skriptart eintragen (\`server\`, \`game\` oder \`client\`) und in \`DOCS.events\` beschreiben.
2. In der Plattform den Moment finden, in dem es passiert (z. B. in \`backend/chat.js\`), und dort \`botsEvent(store, env, c, 'reaction', { person, … })\` aufrufen.
3. In \`botsEvent()\` in \`backend/bots.js\` festlegen, welche Argumente die Funktion bekommt.
4. Dokumentieren auf der Seite „Ereignisse“ und testen.

## Wenn etwas kaputt ist

| Was du siehst | Wo du suchst |
| --- | --- |
| Fehlermeldung beim Tippen im Editor | Parser (\`parse()\`) – meist eine fehlende Klammer oder ein \`end\` |
| Fehler beim Ausführen („Zeile 5: …“) | Interpreter (\`eval()\`, \`exec()\`) oder die eingebaute Funktion |
| Bot antwortet gar nicht | Plattform: Bot eingeschaltet? Erweiterter Modus? Skript im richtigen Service? Protokoll im Editor unter „Ausgabe“ |
| Webhook sendet nicht | Discord-Verbindung des Servers muss vom Team angenommen sein (\`bots.js\`) |
| Neue Funktion fehlt in der App | \`CACHE\` in \`sw.js\` nicht erhöht, oder Seite neu laden |

## Kurz gesagt

- **Sprache** = \`backend/luna.js\`: Lexer → Parser → Interpreter. Sicher, klein, ohne Plattform-Wissen.
- **Plattform** = \`bots.js\`, \`chat.js\`, \`app.js\`: wann Skripte laufen und wohin die Ausgabe geht.
- **Doku** = \`assets/js/luna-docs.js\`, **diese Seite** = \`backend/luna-intern.js\`.
- Neue Funktion: \`makeBuiltins()\` → \`BUILTIN_NAMES\` → \`DOCS\` → Doku → Tests → pushen → \`CACHE\` erhöhen.
`;
