# Train Sim Germany – Backend

Hier liegen alle Schlüssel: Roblox **Client-ID** und **Client-Secret**, der Schlüssel für die Sitzungen und der **Discord-Webhook** für Bewerbungen. Die Web-App kennt nur die Adresse des Backends.

| Weg | Wofür |
|---|---|
| `GET /health` | Zeigt, was eingerichtet ist (`login`, `applications`, `group`) |
| `GET /auth/login?return=<url>` | Weiter zu Roblox (OAuth 2.0 mit PKCE und Client-Secret) |
| `GET /auth/callback` | Rückkehr von Roblox, danach zurück zur App mit Sitzung |
| `POST /auth/logout` | Abmelden – alle Sitzungen des Kontos werden ungültig |
| `GET /api/me` | Eigenes Profil, Rang aus der Roblox-Gruppe, Privatsphäre |
| `PUT /api/me/privacy` | Privatsphäre speichern: `{ "profile": true, "stats": false }` |
| `GET /api/players/<id>` | Öffentliches Profil (nur wenn der Spieler es freigegeben hat) |
| `POST /api/applications` | Bewerbung an den Discord-Kanal senden (nur angemeldet) |

## 1. Roblox OAuth-App anlegen

1. [create.roblox.com/dashboard/credentials](https://create.roblox.com/dashboard/credentials) → **OAuth 2.0 Apps** → **Create OAuth App**
2. **Redirect URL:** Adresse des Backends + `/auth/callback`, z. B.
   `https://tsg-backend.<name>.workers.dev/auth/callback`
   (zum Testen zusätzlich `http://localhost:8787/auth/callback`)
3. **Scopes:** `openid` und `profile`
4. **Privacy Policy URL:** `https://loris6.github.io/Train-Sim-Germany/privacy.html`
   **Terms of Service URL:** `https://loris6.github.io/Train-Sim-Germany/terms.html`
5. Client-ID und Client-Secret notieren – **nur** ins Backend, nie in die Web-App oder auf GitHub.

## 2a. Backend auf Cloudflare (kostenlos, empfohlen)

Voraussetzung: kostenloses Konto auf [cloudflare.com](https://dash.cloudflare.com/sign-up) und Node.js.

```bash
cd backend
npx wrangler login
npx wrangler kv namespace create TSG_KV      # die ausgegebene id in wrangler.toml eintragen
# In wrangler.toml APP_URL, ALLOWED_ORIGINS und (optional) ROBLOX_GROUP_ID anpassen
npx wrangler secret put ROBLOX_CLIENT_ID
npx wrangler secret put ROBLOX_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET        # zufälliger Text, mindestens 32 Zeichen
npx wrangler secret put DISCORD_WEBHOOK_URL   # optional, für Bewerbungen
npx wrangler deploy
```

Die Adresse am Ende (`https://tsg-backend.<name>.workers.dev`) ist die Adresse des Backends.

Einen zufälligen `SESSION_SECRET` erzeugst du z. B. mit:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## 2b. Backend mit Node.js (eigener Server, Raspberry Pi, Render …)

Node.js ab Version 20, keine weiteren Pakete nötig.

```bash
cd backend
cp .env.example .env     # Werte eintragen
node server.js           # läuft auf http://localhost:8787
```

Daten (Profile, Privatsphäre) liegen in `data/store.json`. `.env` und `data/` stehen in `.gitignore` und werden nie hochgeladen. Läuft der Server hinter einer anderen Adresse (Domain mit https), `BACKEND_URL` auf diese Adresse setzen.

## 3. Web-App verbinden

In `assets/js/config.js` nur die Adresse eintragen:

```js
api: 'https://tsg-backend.<name>.workers.dev',
```

Fertig: Der Profil-Dialog zeigt „Mit Roblox anmelden“, die Privatsphäre-Schalter werden im Backend gespeichert und Bewerbungen landen im Discord-Kanal.

## Einstellungen

| Name | Pflicht | Bedeutung |
|---|---|---|
| `ROBLOX_CLIENT_ID` | ja | Client-ID der OAuth-App |
| `ROBLOX_CLIENT_SECRET` | ja | Client-Secret der OAuth-App (geheim!) |
| `SESSION_SECRET` | ja | Zufälliger Text ab 32 Zeichen, signiert die Sitzungen (geheim!) |
| `APP_URL` | ja | Adresse der Web-App, z. B. `https://loris6.github.io/Train-Sim-Germany/` |
| `ALLOWED_ORIGINS` | nein | Weitere erlaubte Adressen, mit Komma getrennt (z. B. `http://localhost:8000`) |
| `BACKEND_URL` | nein | Eigene Adresse (sonst aus der Anfrage) |
| `ROBLOX_GROUP_ID` | nein | Gruppen-ID: Rang wird aus der Rolle in der Gruppe übernommen |
| `DISCORD_WEBHOOK_URL` | nein | Webhook eines privaten Team-Kanals für Bewerbungen (geheim!) |

**Rang aus der Gruppe:** Die Rolle wird über den Namen oder das Kürzel zugeordnet – „Driver“, „[D] Driver“ und „D | Driver“ werden alle zu Driver. Kürzel: UD, D, PS, CD, SG, SV, DS, MG. Wer nicht in der Gruppe ist, gilt als Passenger.

**Sicherheit:** Sitzungen und das Login-Cookie sind mit `SESSION_SECRET` signiert (HMAC-SHA-256). Das Backend prüft `state` und `nonce`, erlaubt Anfragen nur von `APP_URL` und `ALLOWED_ORIGINS` (CORS) und leitet nach dem Login nur dorthin zurück. Bewerbungen: höchstens 3 pro Tag und eine pro Stelle und Konto.
