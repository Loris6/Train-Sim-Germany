/*
 * Train Sim Germany – Einstellungen für den Roblox-Login und die Rechtstexte
 *
 * ── Roblox-Login (OAuth 2.0) einrichten ─────────────────────────────────────
 * 1. https://create.roblox.com/dashboard/credentials → „OAuth 2.0 Apps“ → „Create OAuth App“
 * 2. Bei „Redirect URLs“ genau die Adresse der Seite eintragen, z. B.
 *      https://<dein-name>.github.io/Train-Sim-Germany/
 *    (mit / am Ende, ohne # und ohne ?). Für Tests zusätzlich http://localhost:8000/
 * 3. Berechtigungen (Scopes): openid und profile
 * 4. Datenschutz-Link: https://<dein-name>.github.io/Train-Sim-Germany/privacy.html
 *    Nutzungsbedingungen: https://<dein-name>.github.io/Train-Sim-Germany/terms.html
 * 5. Die Client-ID unten bei clientId eintragen – fertig.
 *
 * Das Client-Secret gehört NIEMALS in diese Datei! Alles hier ist öffentlich lesbar.
 * Die Seite meldet sich mit PKCE an und braucht dafür kein Secret.
 * Nur falls Roblox die Anmeldung aus dem Browser blockiert (Fehler „Anmeldung fehlgeschlagen“
 * und in der Konsole ein CORS-Fehler), tools/oauth-worker.js als Cloudflare Worker starten
 * und dessen Adresse bei tokenProxy eintragen.
 */
window.TSG_CONFIG = {
  roblox: {
    // Client-ID der OAuth-App (nur Ziffern). Leer = Demo: Verbinden über den Roblox-Namen
    clientId: '',
    // Leer = aktuelle Seite. Muss exakt mit einer Redirect-URL im Roblox-Dashboard übereinstimmen.
    redirectUri: '',
    scopes: 'openid profile',
    // Optional: Adresse des eigenen Token-Servers (tools/oauth-worker.js), z. B. https://tsg-login.<name>.workers.dev
    tokenProxy: '',
  },

  // Angaben für Datenschutzerklärung und Nutzungsbedingungen (privacy.html, terms.html)
  legal: {
    operator: 'Vor- und Nachname eintragen',
    address: 'Straße Hausnummer, PLZ Ort, Deutschland',
    email: 'kontakt@beispiel.de',
    updated: '20. Oktober 2026',
  },
};
