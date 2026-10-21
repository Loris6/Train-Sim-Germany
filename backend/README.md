# Train Sim Germany – Backend (App-Server)

Die Anmeldung mit Roblox braucht **kein** Backend – dafür reicht die Client-ID in `assets/js/config.js`. Alles, was zwischen Geräten und Spielern geteilt wird oder geheim bleiben muss, läuft über das Backend:

- **Trainings anbieten** (ab Supervisor) – immer für genau eine Rolle (QD, PS, CD oder SG), löschen nur die eigenen
- **Neuigkeiten schreiben** (ab Public Relations Department) – Foto oder Video, Tag, bis zu 2 Buttons (Discord, YouTube, Roblox oder beliebiger Link)
- **Karriere verwalten** (ab PRD) – Stellen öffnen/schließen, Zeitraum (Vorlagen 7/14/30 Tage oder eigene Zeit), Höchstzahl an Bewerbungen, „Dringend gesucht“, Hinweis für Bewerber, Verlauf; Bewerbungen prüfen – das Ergebnis geht sofort als Nachricht `[✅ PASSED]` / `[❌ FAILED]` vom Prüfer in den Chat, als Benachrichtigung und per E-Mail; die Bestandenen gesammelt an Discord senden
- **Chat** – Anfragen mit Grund und Bereich, die das zuständige Team annimmt, und Direktnachrichten: Spieler schreiben dem Team, das Team kann jeden Spieler anschreiben
- **Benachrichtigungen, auch bei geschlossener App** – neue Chat-Nachrichten (für beide Seiten), Ergebnis einer Bewerbung, fürs Team neue Anfragen und Bewerbungen, Trainings
- **E-Mails an Bewerber** – nach dem Absenden die ganze Bewerbung, nach der Auswertung das Ergebnis (Brevo oder Resend)
- **Shop** – Coins, Züge und Strecken aus dem Spiel; Käufe in der App verbucht das Spiel (Skript `game/TSGAppSync.server.lua`)
- **Einstellungen auf allen Geräten** – Darstellung, Sprache, gemerkte Trainings und Glocken
- **Echte Zahlen** – Gruppenmitglieder (auch je Rolle), Spieler online, Besuche, Favoriten, Discord-Mitglieder
- **Benachrichtigungen für Trainings per Web-Push**, auch wenn die App geschlossen ist
- **Privatsphäre**, die auch für andere gilt (öffentliches Profil)

Die Rechte kommen aus der Rolle in der Roblox-Gruppe und werden bei jeder Anfrage neu geprüft – in der App kann man sich keinen höheren Rang „einstellen“. Solange das Backend fehlt, sehen Teammitglieder ihre Knöpfe trotzdem und bekommen beim Antippen diese Anleitung.

## Am einfachsten: automatisch über GitHub (kostenlos)

Das Backend läuft kostenlos als **Cloudflare Worker**. GitHub veröffentlicht es selbst (Workflow `.github/workflows/backend.yml`) und trägt die Adresse in `config.js` ein.

1. Auf [cloudflare.com](https://dash.cloudflare.com/sign-up) ein kostenloses Konto anlegen und links einmal **Workers & Pages** öffnen (dabei bekommst du deine Adresse `<name>.workers.dev`).
2. **API-Token:** Oben rechts Profil → *API Tokens* → *Create Token* → Vorlage **„Edit Cloudflare Workers“** → erstellen und kopieren.
3. **Account-ID:** steht in Cloudflare unter *Workers & Pages* rechts („Account ID“).
4. Auf GitHub im Repository: *Settings → Secrets and variables → Actions → New repository secret*:
   - `CLOUDFLARE_API_TOKEN` = der Token aus Schritt 2
   - `CLOUDFLARE_ACCOUNT_ID` = die ID aus Schritt 3
   - optional `DISCORD_WEBHOOK_URL` (neue Bewerbungen), `DISCORD_RESULTS_WEBHOOK_URL` (Glückwünsche), `GAME_API_KEY` (Abgleich mit dem Spiel, eine lange Zufallszeichenkette)
   - optional für E-Mails: `BREVO_API_KEY` und `EMAIL_FROM` (siehe „E-Mails an Bewerber“)
5. *Actions → „Backend veröffentlichen“ → Run workflow*. Nach etwa einer Minute steht die Adresse in der Zusammenfassung und in `assets/js/config.js` bei `api`. Danach einmal ab- und wieder mit Roblox anmelden – fertig.

Bei jeder Änderung im Ordner `backend/` auf `main` veröffentlicht GitHub das Backend neu.

## Per Hand auf Cloudflare

```bash
cd backend
npx wrangler login
npx wrangler deploy                                   # Speicher (Durable Object) wird automatisch angelegt
npx wrangler secret put DISCORD_WEBHOOK_URL           # optional: Webhook 1 – neue Bewerbungen
npx wrangler secret put DISCORD_RESULTS_WEBHOOK_URL   # optional: Webhook 2 – Glückwünsche
npx wrangler secret put GAME_API_KEY                  # optional: Abgleich mit dem Spiel (Shop)
```

Danach die Adresse (`https://tsg-backend.<name>.workers.dev`) in `assets/js/config.js` bei `api` eintragen.

**Speicher:** Alle Daten liegen in einem einzigen **Durable Object mit SQLite** (im kostenlosen Tarif enthalten: 100.000 Anfragen und 100.000 geschriebene Zeilen am Tag). Jede Anfrage läuft dort, dadurch sehen alle sofort denselben Stand – wichtig für Chat und Käufe. Der Zeitplan in `wrangler.toml` (`crons`) verschickt alle 2 Minuten die fälligen Benachrichtigungen und räumt abgelaufene Einträge auf.

## Mit Node.js (eigener Server, Raspberry Pi, Render …)

Node.js ab Version 20, keine weiteren Pakete nötig.

```bash
cd backend
cp .env.example .env     # ROBLOX_CLIENT_ID, APP_URL, Webhooks, GAME_API_KEY usw. eintragen
node server.js           # läuft auf http://localhost:8787
```

Daten liegen in `data/store.json`, fällige Benachrichtigungen gehen jede Minute raus. `.env` und `data/` stehen in `.gitignore` und werden nie hochgeladen. Für Web-Push muss das Backend über **https** erreichbar sein.

## Shop: Abgleich mit dem Spiel

Das Spiel bleibt die Quelle für Coins und Besitz. Das Skript [`game/TSGAppSync.server.lua`](../game/TSGAppSync.server.lua) kommt nach *ServerScriptService* und

- meldet alle 30 Sekunden (und beim Betreten/Verlassen) Coins, Züge und Strecken der Spieler – nur wenn sich etwas geändert hat,
- holt Käufe aus der App ab, zieht die Coins im Spiel ab und schaltet Zug bzw. Strecke frei.

Einrichten: HTTP-Anfragen im Spiel erlauben, im Creator Dashboard unter *Secrets* das Secret `tsg_game_key` mit demselben Wert wie `GAME_API_KEY` anlegen und oben im Skript die Adresse des Backends eintragen. Speichert euer Spiel Coins und Besitz anders als in `leaderstats.Coins` bzw. den Ordnern `OwnedTrains`/`OwnedRoutes`, die beiden Funktionen `Economy.read` und `Economy.apply` anpassen. Preise und IDs stehen in `shop.js` (`CATALOG`) – sie müssen zu den IDs im Spiel passen.

In der App werden gekaufte Coins sofort **reserviert**; bis das Spiel den Kauf verbucht hat, steht dort „Wird im Spiel freigeschaltet“. Reichen die Coins im Spiel inzwischen nicht mehr, lehnt das Spiel den Kauf ab und die Reservierung verfällt.

## E-Mails an Bewerber

Nach dem Absenden bekommt jeder Bewerber eine schön gestaltete E-Mail mit **allen Angaben und Antworten** (✓ richtig / ✗ falsch), nach der Auswertung eine zweite mit dem **Ergebnis**. Ohne Einrichtung werden keine E-Mails verschickt – alles andere läuft trotzdem.

**Brevo (empfohlen, kostenlos bis 300 E-Mails am Tag, keine eigene Domain nötig, Sitz in der EU):**
1. Konto auf [brevo.com](https://www.brevo.com) anlegen.
2. *Senders, Domains & Dedicated IPs → Senders → Add a sender*: deine Absenderadresse eintragen (z. B. die E-Mail des Teams) und den Bestätigungslink anklicken.
3. *SMTP & API → API Keys → Generate a new API key* und kopieren.
4. Auf GitHub als Secrets eintragen: `BREVO_API_KEY` (der Schlüssel) und `EMAIL_FROM` (die bestätigte Absenderadresse). Optional `EMAIL_REPLY_TO`.
5. Unter Actions „Backend veröffentlichen“ noch einmal starten.

Mit einer eigenen Domain geht auch **Resend** (`RESEND_API_KEY` + `EMAIL_FROM` mit dieser Domain). Hinweis: Absender mit Gmail-, GMX- oder Outlook-Adresse landen eher im Spam als eine eigene Domain.

## Benachrichtigungen (auch bei geschlossener App)

In der App unter *Einstellungen → Benachrichtigungen* einschalten. Das Gerät meldet sich dann beim Backend an (bis zu 6 Geräte pro Konto) und bekommt Web-Push für:

- **Chat** – jede neue Nachricht an die jeweils andere Seite, „Anfrage angenommen“
- **Bewerbungen** – das Ergebnis `[✅ PASSED]` / `[❌ FAILED]`
- **Team** (ab Supervisor) – neue Anfragen im eigenen Bereich, ab PRD auch neue Bewerbungen
- **Trainings** – wie bisher über die Glocke

Chat-Benachrichtigungen sehen aus wie bei einem Messenger: Titel ist der Name, als Bild erscheint das **Roblox-Profilbild des Absenders** statt des Logos, und der Text beginnt mit dem ausgeschriebenen Rang – z. B. „**[SV] Supervisor:** Morgen um 19:30!“. (iPhone und iPad zeigen dabei immer das App-Icon, das Profilbild erscheint auf Android, Windows und macOS.)

Auf dem iPhone/iPad gehen Benachrichtigungen nur in der installierten App (Safari → Teilen → „Zum Home-Bildschirm“). Beim Abmelden wird das Gerät vom Konto getrennt.

## Chat

- **Anfrage:** Grund (Training, Rang, Fehler, Spieler melden, Bewerbung, Shop, Sonstiges) und Bereich wählen. Alle, die den Bereich betreuen, sehen sie unter *Anfragen*; nicht angenommene stehen oben (wer am längsten wartet, zuerst). Wer annimmt, steht im Gespräch – danach schreiben nur noch Spieler und diese Person.
- **Wer betreut was** (`AREAS` in `chat.js`): Qualified Driver / Platform Staff / Conductor / Signaller → Supervisor und der jeweilige Manager · Karriere → Public Relations Department · Technik → Project Engineer · Meldungen → alle ab Supervisor · Allgemein → Supervisor und PRD. Operation Manager, Community Director und Chief Engineer sehen alles.
- **Direktnachricht:** Spieler schreiben jeder Person ab Supervisor (Liste aus der Roblox-Gruppe, mit Suche). Das Team kann **jeden Spieler** anschreiben (unter *Team → Spieler anschreiben* per Roblox-Name oder direkt aus einer Bewerbung). Spieler untereinander können sich nicht schreiben. Nur die beiden sehen das Gespräch, beide bekommen eine Benachrichtigung bei neuen Nachrichten.
- **Ergebnis einer Bewerbung:** kommt als eigene Karte `[✅ PASSED]` / `[❌ FAILED]` vom Prüfer in einem Gespräch mit dem Bewerber – er kann direkt antworten.
- Gespräche werden 180 Tage nach der letzten Nachricht gelöscht. Pro Konto gehen höchstens 6 neue Gespräche am Tag (Team: 60).

## Wege (API)

| Weg | Wofür |
|---|---|
| `GET /health` | Zeigt, was eingerichtet ist |
| `GET /api/content` | Trainings, Neuigkeiten, Stellen (öffentlich) |
| `GET /api/stats` | Echte Zahlen: Gruppe, Spiel, Discord (alle 10 Minuten neu) |
| `GET /media/<id>` | Hochgeladenes Bild einer Neuigkeit |
| `POST /auth/session` | `{ id_token }` aus dem Roblox-Login → Sitzung fürs Backend (Signatur, Client-ID und Ablauf werden geprüft) |
| `POST /auth/logout` | Abmelden – alle Sitzungen des Kontos werden ungültig |
| `GET /api/me` | Profil, Rang aus der Gruppe, Privatsphäre, Einstellungen, eigene Bewerbungen |
| `PUT /api/me/privacy` · `PUT /api/me/settings` | Privatsphäre · Einstellungen für alle Geräte (die neueste Änderung gewinnt) |
| `GET /api/players/<id>` | Öffentliches Profil (nur wenn der Spieler es freigegeben hat) |
| `POST /api/trainings` · `DELETE /api/trainings/<id>` | Training anbieten (ab Supervisor) · eigenes löschen |
| `POST /api/news` · `DELETE /api/news/<id>` | Neuigkeit schreiben (ab PRD) · eigene löschen |
| `POST /api/media` | Bild hochladen (ab PRD, JPEG/PNG/WebP/GIF, höchstens 1 MB – die App verkleinert Fotos vorher) |
| `PUT /api/jobs/<id>` | `{ open, from, to, limit, urgent, note, resetCount }` – Stelle verwalten (ab PRD) |
| `POST /api/applications` | Bewerbung senden (angemeldet) |
| `GET /api/applications` · `GET /api/applications/<id>` | Bewerbungen prüfen (ab PRD; die eigene sieht jeder) |
| `PUT /api/applications/<id>` | `{ "status": "passed" \| "failed" \| "new" }` (ab PRD) |
| `POST /api/applications/announce` | `{ ids }` – Bestandene an Discord senden und gratulieren (ab PRD) |
| `GET /api/shop` · `POST /api/shop/buy` | Katalog, eigene Coins und Besitz · `{ kind: "train" \| "route", id }` kaufen |
| `POST /api/game/sync` | Abgleich mit dem Spiel (`Authorization: Bearer <GAME_API_KEY>`) |
| `GET /api/staff` | Team ab Supervisor aus der Roblox-Gruppe |
| `GET /api/chats` · `POST /api/chats` | Eigene Gespräche und offene Anfragen des Bereichs · neue Anfrage oder Direktnachricht |
| `GET /api/chats/<id>?since=<ms>` | Gespräch lesen (mit `since` nur, wenn sich etwas geändert hat) |
| `POST /api/chats/<id>/messages` · `/claim` · `/close` | Schreiben · Anfrage annehmen · beenden |
| `GET /api/push/key` · `POST /api/push/reminders` | Web-Push: öffentlicher Schlüssel · Erinnerungen für Trainings speichern |
| `POST /api/push/subscribe` · `/unsubscribe` · `/test` | Gerät für Benachrichtigungen anmelden (mit Auswahl Chat/Bewerbungen/Team) · abmelden · Probe senden |
| `GET /api/players/find?q=<name>` | Spieler per Roblox-Name suchen, um ihn anzuschreiben (ab Supervisor) |

**Stellen mit Zeitraum:** Ist der Zeitraum vorbei oder die Stelle geschlossen, zeigt die App „Geschlossen“ und „Jetzt bewerben“ verschwindet. Wer vorher schon angefangen hat zu schreiben, darf noch absenden (bis zu 12 Stunden nach dem Start). Ist eine **Höchstzahl** gesetzt und erreicht, zeigt die Stelle „Voll“ und nimmt keine Bewerbungen mehr an. „Dringend gesucht“ hebt die Stelle hervor (Abzeichen, steht oben), der **Hinweis** erscheint auf ihrer Seite. Der **Verlauf** zeigt die letzten 8 Änderungen mit Name und Zeit.

**Bewerbungen** werden 180 Tage gespeichert. Pro Konto gehen höchstens 3 Bewerbungen am Tag und eine pro Stelle.

## Einstellungen

| Name | Pflicht | Bedeutung |
|---|---|---|
| `ROBLOX_CLIENT_ID` | ja | Dieselbe Client-ID wie in `config.js` (nicht geheim) |
| `APP_URL` | ja | Adresse der Web-App, z. B. `https://loris6.github.io/Train-Sim-Germany/` |
| `ALLOWED_ORIGINS` | nein | Weitere erlaubte Adressen, mit Komma getrennt (z. B. `http://localhost:8000`) |
| `ROBLOX_GROUP_ID` | nein | Roblox-Gruppe für Rang, Team und Mitgliederzahl (Standard: 33684346) |
| `ROBLOX_PLACE_ID` | nein | Spiel für Spieler online, Besuche und Favoriten (Standard: 140440792597921) |
| `DISCORD_INVITE` | nein | Einladungscode des Discord-Servers für die Mitgliederzahl (Standard: `tvaSwbh3rE`) |
| `DISCORD_WEBHOOK_URL` | nein | **Geheim.** Webhook 1 – privater Team-Kanal, bekommt jede neue Bewerbung |
| `DISCORD_RESULTS_WEBHOOK_URL` | für „An Discord senden“ | **Geheim.** Webhook 2 – Kanal, in dem den Bestandenen gratuliert wird |
| `BREVO_API_KEY` | für E-Mails | **Geheim.** Schlüssel von Brevo (E-Mails an Bewerber) |
| `RESEND_API_KEY` | statt Brevo | **Geheim.** Schlüssel von Resend (braucht eine eigene Domain) |
| `EMAIL_FROM` | für E-Mails | Absenderadresse (bei Brevo bestätigt) |
| `EMAIL_FROM_NAME` · `EMAIL_REPLY_TO` | nein | Absendername (Standard: Train Sim Germany) · Antwortadresse |
| `GAME_API_KEY` | für den Shop | **Geheim.** Schlüssel, mit dem sich das Spiel beim Abgleich ausweist (im Spiel als Secret `tsg_game_key`) |
| `PUSH_CONTACT` | nein | Kontakt für Web-Push (`mailto:` oder `https:`), sonst `APP_URL` |
| `SESSION_SECRET` | nein | Eigener Schlüssel für Sitzungen (sonst erzeugt das Backend einen) |

Geheime Werte gehören **nur** in GitHub-Secrets, `backend/.env` (wird nicht hochgeladen) oder Cloudflare-Secrets – nie in `.env.example`, `wrangler.toml` oder eine andere Datei im Repository. Ein Client-Secret von Roblox wird nicht gebraucht.

**Rang aus der Gruppe:** Die Rolle wird über das Kürzel in eckigen Klammern zugeordnet, sonst über den Namen – „[PRD] Puplic Relations Department“ wird also trotz Tippfehler zu Public Relations Department. Kürzel (von hoch nach niedrig): CEN, CDR, OM, PJE, PRD, SGM, CDM, PSM, DM, SV, J-SV, SG, CD, PS, QD, LD. Wer nicht in der Gruppe ist, ist Guest ([G]); Testkonten („[AT] Alpha Test Accounts“) zählen ebenfalls nicht als Rang.

**Sicherheit:** Das ID-Token wird mit den öffentlichen Schlüsseln von Roblox geprüft (Signatur ES256, Client-ID, Aussteller, Ablauf). Sitzungen sind mit HMAC-SHA-256 signiert. Anfragen werden nur von `APP_URL` und `ALLOWED_ORIGINS` angenommen (CORS). Der Spiel-Schlüssel wird zeitkonstant verglichen. Links in Neuigkeiten müssen https sein. Push-Nachrichten sind Ende-zu-Ende verschlüsselt (aes128gcm). Discord-Nachrichten erwähnen niemanden automatisch (`allowed_mentions` leer).
