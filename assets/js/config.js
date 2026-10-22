/*
 * Train Sim Germany – Einstellungen der Web-App
 *
 * ── Roblox-Login: nur die Client-ID eintragen ───────────────────────────────
 * 1. https://create.roblox.com/dashboard/credentials → „OAuth 2.0 Apps“ → App anlegen
 * 2. Redirect-URL: genau die Adresse der Seite, z. B. https://loris6.github.io/Train-Sim-Germany/
 *    (mit / am Ende, ohne index.html, # oder ?). Zum Testen zusätzlich http://localhost:8000/
 * 3. Berechtigungen (Scopes): openid und profile
 * 4. Datenschutz: …/privacy.html, Nutzungsbedingungen: …/terms.html
 * 5. Die Client-ID unten bei clientId eintragen – fertig.
 *
 * Die Anmeldung läuft mit PKCE direkt mit Roblox und braucht kein Client-Secret.
 * Das Client-Secret gehört NIE hierher (diese Datei ist öffentlich).
 * Der Rang kommt automatisch aus der Rolle in der Roblox-Gruppe; wer nicht in der Gruppe ist, ist [G] Gast.
 */
window.TSG_CONFIG = {
  roblox: {
    // Client-ID der OAuth-App (nur Ziffern). Leer = Demo: Verbinden über den Roblox-Namen
    clientId: '7832208484042432028',
    // ID der Roblox-Gruppe (aus https://www.roblox.com/share/g/33684346)
    groupId: 33684346,
    // Leer = Adresse der Seite. Muss exakt mit einer Redirect-URL im Roblox-Dashboard übereinstimmen.
    redirectUri: '',
  },

  // Optional: Adresse des Backends (Ordner backend/) für Benachrichtigungen bei geschlossener App,
  // Bewerbungen an Discord und gespeicherte Privatsphäre, z. B. 'https://tsg-backend.<name>.workers.dev'
  api: 'https://tsg-backend.lorismziray01.workers.dev',

  // Angaben für Datenschutzerklärung und Nutzungsbedingungen (privacy.html, terms.html)
  legal: {
    operator: 'Vor- und Nachname eintragen',
    address: 'Straße Hausnummer, PLZ Ort, Deutschland',
    email: 'kontakt@beispiel.de',
    // Wo das Backend läuft (Anbieter mit Anschrift), z. B. Cloudflare
    backendHost: 'Cloudflare, Inc., 101 Townsend St., San Francisco, CA 94107, USA',
    updated: '22. Oktober 2026',
  },
};
