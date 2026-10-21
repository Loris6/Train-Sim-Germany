# Train Sim Germany – Backend

Die Anmeldung mit Roblox braucht **kein** Backend – dafür reicht die Client-ID in `assets/js/config.js`. Alles, was zwischen Geräten und Spielern geteilt wird oder geheim bleiben muss, läuft über das Backend:

- **Trainings anbieten** (ab Supervisor) – immer für genau eine Rolle (QD, PS, CD oder SG), löschen nur die eigenen
- **Neuigkeiten schreiben** (ab Public Relations Department) – Foto oder Video, Tag, bis zu 2 Buttons (Discord, YouTube, Roblox oder beliebiger Link)
- **Karriere verwalten** (ab PRD) – Stellen öffnen/schließen, Zeitraum „von – bis“, Bewerbungen prüfen (bestanden / nicht bestanden) und die Bestandenen gesammelt an Discord senden
- **Einstellungen auf allen Geräten** – Darstellung, Sprache, gemerkte Trainings und Glocken
- **Echte Zahlen** – Gruppenmitglieder (auch je Rolle), Spieler online, Besuche, Favoriten, Discord-Mitglieder
- **Benachrichtigungen für Trainings per Web-Push**, auch wenn die App geschlossen ist
- **Privatsphäre**, die auch für andere gilt (öffentliches Profil)

Die Rechte kommen aus der Rolle in der Roblox-Gruppe und werden bei jeder Anfrage neu geprüft – in der App kann man sich keinen höheren Rang „einstellen“.

| Weg | Wofür |
|---|---|
| `GET /health` | Zeigt, was eingerichtet ist |
| `GET /api/content` | Trainings, Neuigkeiten, Stellen (öffentlich) |
| `GET /api/stats` | Echte Zahlen: Gruppe, Spiel, Discord (alle 10 Minuten neu) |
| `GET /media/<id>` | Hochgeladenes Bild einer Neuigkeit |
| `POST /auth/session` | `{ id_token }` aus dem Roblox-Login → Sitzung fürs Backend (Signatur, Client-ID und Ablauf werden geprüft) |
| `POST /auth/logout` | Abmelden – alle Sitzungen des Kontos werden ungültig |
| `GET /api/me` | Profil, Rang aus der Gruppe, Privatsphäre, Einstellungen, eigene Bewerbungen |
| `PUT /api/me/privacy` | `{ "profile": true, "stats": false }` |
| `PUT /api/me/settings` | Einstellungen für alle Geräte (die neueste Änderung gewinnt) |
| `GET /api/players/<id>` | Öffentliches Profil (nur wenn der Spieler es freigegeben hat) |
| `POST /api/trainings` · `DELETE /api/trainings/<id>` | Training anbieten (ab Supervisor) · eigenes löschen |
| `POST /api/news` · `DELETE /api/news/<id>` | Neuigkeit schreiben (ab PRD) · eigene löschen |
| `POST /api/media` | Bild hochladen (ab PRD, JPEG/PNG/WebP/GIF, höchstens 1,5 MB) |
| `PUT /api/jobs/<id>` | `{ open, from, to }` – Stelle öffnen/schließen, Zeitraum (ab PRD) |
| `POST /api/applications` | Bewerbung senden (angemeldet) |
| `GET /api/applications` · `GET /api/applications/<id>` | Bewerbungen prüfen (ab PRD; die eigene sieht jeder) |
| `PUT /api/applications/<id>` | `{ "status": "passed" \| "failed" \| "new" }` (ab PRD) |
| `POST /api/applications/announce` | `{ ids }` – Bestandene an Discord senden und gratulieren (ab PRD) |
| `GET /api/push/key` · `POST /api/push/reminders` | Web-Push: öffentlicher Schlüssel · Erinnerungen speichern |

Schlüssel für Sitzungen und Web-Push (VAPID) erzeugt das Backend beim ersten Start selbst und speichert sie.

**Stellen mit Zeitraum:** Ist der Zeitraum vorbei oder die Stelle geschlossen, zeigt die App „Geschlossen“ und „Jetzt bewerben“ verschwindet. Wer vorher schon angefangen hat zu schreiben, wird nicht unterbrochen und darf noch absenden (bis zu 12 Stunden nach dem Start).

**Bewerbungen** werden 180 Tage gespeichert. Pro Konto gehen höchstens 3 Bewerbungen am Tag und eine pro Stelle.

## Auf Cloudflare (kostenlos, empfohlen)

Voraussetzung: kostenloses Konto auf [cloudflare.com](https://dash.cloudflare.com/sign-up) und Node.js.

```bash
cd backend
npx wrangler login
npx wrangler kv namespace create TSG_KV               # die ausgegebene id in wrangler.toml eintragen
# In wrangler.toml ROBLOX_CLIENT_ID (dieselbe wie in config.js), APP_URL und ALLOWED_ORIGINS prüfen
npx wrangler secret put DISCORD_WEBHOOK_URL           # Webhook 1: neue Bewerbungen (privater Team-Kanal)
npx wrangler secret put DISCORD_RESULTS_WEBHOOK_URL   # Webhook 2: Glückwünsche an die Bestandenen
npx wrangler deploy
```

Die Adresse am Ende (`https://tsg-backend.<name>.workers.dev`) in `assets/js/config.js` bei `api` eintragen – fertig. Der Zeitplan in `wrangler.toml` (`crons`) verschickt alle 2 Minuten die fälligen Benachrichtigungen.

Im kostenlosen Tarif von Cloudflare sind 1.000 Schreibvorgänge pro Tag im KV-Speicher enthalten. Für eine kleine Community reicht das; bei sehr vielen Nutzern ist der Workers-Tarif für 5 $/Monat nötig.

## Mit Node.js (eigener Server, Raspberry Pi, Render …)

Node.js ab Version 20, keine weiteren Pakete nötig.

```bash
cd backend
cp .env.example .env     # ROBLOX_CLIENT_ID, APP_URL, Webhooks usw. eintragen
node server.js           # läuft auf http://localhost:8787
```

Daten liegen in `data/store.json`, fällige Benachrichtigungen gehen jede Minute raus. `.env` und `data/` stehen in `.gitignore` und werden nie hochgeladen. Für Web-Push muss das Backend über **https** erreichbar sein (z. B. über Render oder einen Reverse-Proxy).

## Einstellungen

| Name | Pflicht | Bedeutung |
|---|---|---|
| `ROBLOX_CLIENT_ID` | ja | Dieselbe Client-ID wie in `config.js` (nicht geheim) |
| `APP_URL` | ja | Adresse der Web-App, z. B. `https://loris6.github.io/Train-Sim-Germany/` |
| `ALLOWED_ORIGINS` | nein | Weitere erlaubte Adressen, mit Komma getrennt (z. B. `http://localhost:8000`) |
| `ROBLOX_GROUP_ID` | nein | Roblox-Gruppe für Rang und Mitgliederzahl (Standard: 33684346) |
| `ROBLOX_PLACE_ID` | nein | Spiel für Spieler online, Besuche und Favoriten (Standard: 140440792597921) |
| `DISCORD_INVITE` | nein | Einladungscode des Discord-Servers für die Mitgliederzahl (Standard: `tvaSwbh3rE`) |
| `DISCORD_WEBHOOK_URL` | nein | **Geheim.** Webhook 1 – privater Team-Kanal, bekommt jede neue Bewerbung |
| `DISCORD_RESULTS_WEBHOOK_URL` | für „An Discord senden“ | **Geheim.** Webhook 2 – Kanal, in dem den Bestandenen gratuliert wird |
| `PUSH_CONTACT` | nein | Kontakt für Web-Push (`mailto:` oder `https:`), sonst `APP_URL` |
| `SESSION_SECRET` | nein | Eigener Schlüssel für Sitzungen (sonst erzeugt das Backend einen) |

Geheime Werte gehören **nur** in `backend/.env` (wird nicht hochgeladen) oder als Cloudflare-Secret (`npx wrangler secret put …`) – nie in `.env.example`, `wrangler.toml` oder eine andere Datei im Repository. Ein Client-Secret von Roblox wird nicht gebraucht.

**Rang aus der Gruppe:** Die Rolle wird über das Kürzel in eckigen Klammern zugeordnet, sonst über den Namen – „[PRD] Puplic Relations Department“ wird also trotz Tippfehler zu Public Relations Department. Kürzel (von hoch nach niedrig): CEN, CDR, OM, PJE, PRD, SGM, CDM, PSM, DM, AT, SV, J-SV, SG, CD, PS, QD, LD. Wer nicht in der Gruppe ist, ist Guest ([G]).

**Sicherheit:** Das ID-Token wird mit den öffentlichen Schlüsseln von Roblox geprüft (Signatur ES256, Client-ID, Aussteller, Ablauf). Sitzungen sind mit HMAC-SHA-256 signiert. Anfragen werden nur von `APP_URL` und `ALLOWED_ORIGINS` angenommen (CORS). Links in Neuigkeiten müssen https sein. Push-Nachrichten sind Ende-zu-Ende verschlüsselt (aes128gcm). Discord-Nachrichten erwähnen niemanden automatisch (`allowed_mentions` leer).
