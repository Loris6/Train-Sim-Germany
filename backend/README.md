# Train Sim Germany – Backend (optional)

Die Anmeldung mit Roblox braucht **kein** Backend – dafür reicht die Client-ID in `assets/js/config.js`. Das Backend ergänzt:

- **Benachrichtigungen für Trainings per Web-Push**, auch wenn die App geschlossen ist
- **Bewerbungen an einen privaten Discord-Kanal** (der Webhook bleibt geheim auf dem Server)
- **Privatsphäre**, die auch für andere gilt (öffentliches Profil)

| Weg | Wofür |
|---|---|
| `GET /health` | Zeigt, was eingerichtet ist |
| `POST /auth/session` | `{ id_token }` aus dem Roblox-Login → Sitzung fürs Backend (Signatur, Client-ID und Ablauf werden geprüft) |
| `POST /auth/logout` | Abmelden – alle Sitzungen des Kontos werden ungültig |
| `GET /api/me` | Eigenes Profil, Rang aus der Roblox-Gruppe, Privatsphäre |
| `PUT /api/me/privacy` | Privatsphäre speichern: `{ "profile": true, "stats": false }` |
| `GET /api/players/<id>` | Öffentliches Profil (nur wenn der Spieler es freigegeben hat) |
| `POST /api/applications` | Bewerbung an den Discord-Kanal senden (angemeldet) |
| `GET /api/push/key` | Öffentlicher Schlüssel für Web-Push |
| `POST /api/push/reminders` | `{ subscription, reminders }` – Erinnerungen für Trainings speichern |

Schlüssel für Sitzungen und Web-Push (VAPID) erzeugt das Backend beim ersten Start selbst und speichert sie.

## Auf Cloudflare (kostenlos, empfohlen)

Voraussetzung: kostenloses Konto auf [cloudflare.com](https://dash.cloudflare.com/sign-up) und Node.js.

```bash
cd backend
npx wrangler login
npx wrangler kv namespace create TSG_KV      # die ausgegebene id in wrangler.toml eintragen
# In wrangler.toml ROBLOX_CLIENT_ID (dieselbe wie in config.js), APP_URL und ALLOWED_ORIGINS eintragen
npx wrangler secret put DISCORD_WEBHOOK_URL   # optional, für Bewerbungen
npx wrangler deploy
```

Die Adresse am Ende (`https://tsg-backend.<name>.workers.dev`) in `assets/js/config.js` bei `api` eintragen – fertig. Der Zeitplan in `wrangler.toml` (`crons`) verschickt alle 2 Minuten die fälligen Benachrichtigungen.

Im kostenlosen Tarif von Cloudflare sind 1.000 Schreibvorgänge pro Tag im KV-Speicher enthalten. Für eine kleine Community reicht das; bei sehr vielen Erinnerungen ist der Workers-Tarif für 5 $/Monat nötig.

## Mit Node.js (eigener Server, Raspberry Pi, Render …)

Node.js ab Version 20, keine weiteren Pakete nötig.

```bash
cd backend
cp .env.example .env     # ROBLOX_CLIENT_ID, APP_URL usw. eintragen
node server.js           # läuft auf http://localhost:8787
```

Daten liegen in `data/store.json`, fällige Benachrichtigungen gehen jede Minute raus. `.env` und `data/` stehen in `.gitignore` und werden nie hochgeladen. Für Web-Push muss das Backend über **https** erreichbar sein (z. B. über Render oder einen Reverse-Proxy).

## Einstellungen

| Name | Pflicht | Bedeutung |
|---|---|---|
| `ROBLOX_CLIENT_ID` | für Login am Backend | Dieselbe Client-ID wie in `config.js` (nicht geheim) |
| `APP_URL` | ja | Adresse der Web-App, z. B. `https://loris6.github.io/Train-Sim-Germany/` |
| `ALLOWED_ORIGINS` | nein | Weitere erlaubte Adressen, mit Komma getrennt (z. B. `http://localhost:8000`) |
| `ROBLOX_GROUP_ID` | nein | Roblox-Gruppe für den Rang (Standard: 33684346) |
| `DISCORD_WEBHOOK_URL` | nein | Webhook eines privaten Team-Kanals für Bewerbungen (geheim!) |
| `PUSH_CONTACT` | nein | Kontakt für Web-Push (`mailto:` oder `https:`), sonst `APP_URL` |
| `SESSION_SECRET` | nein | Eigener Schlüssel für Sitzungen (sonst erzeugt das Backend einen) |

**Rang aus der Gruppe:** Die Rolle wird über Kürzel oder Namen zugeordnet – „[D] Driver“, „D | Driver“ und „Driver“ werden zu Driver. Kürzel: G, UD, D, PS, CD, SG, SV, DS, MG. Wer nicht in der Gruppe ist, ist Guest.

**Sicherheit:** Das ID-Token wird mit den öffentlichen Schlüsseln von Roblox geprüft (Signatur ES256, Client-ID, Aussteller, Ablauf). Sitzungen sind mit HMAC-SHA-256 signiert. Anfragen werden nur von `APP_URL` und `ALLOWED_ORIGINS` angenommen (CORS). Push-Nachrichten sind Ende-zu-Ende verschlüsselt (aes128gcm).
