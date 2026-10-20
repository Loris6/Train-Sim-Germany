/*
 * Train Sim Germany – Einstellungen der Web-App
 *
 * Alle Schlüssel (Roblox Client-ID und Client-Secret, Discord-Webhook) liegen im Backend
 * (Ordner backend/, Anleitung in backend/README.md) – NIE hier. Diese Datei ist öffentlich.
 */
window.TSG_CONFIG = {
  // Adresse des Backends, z. B. 'https://tsg-backend.<name>.workers.dev'
  // Leer = Demo: Profil über den Roblox-Namen verbinden, Bewerbungen bleiben auf dem Gerät.
  api: '',

  // Angaben für Datenschutzerklärung und Nutzungsbedingungen (privacy.html, terms.html)
  legal: {
    operator: 'Vor- und Nachname eintragen',
    address: 'Straße Hausnummer, PLZ Ort, Deutschland',
    email: 'kontakt@beispiel.de',
    // Wo das Backend läuft (Anbieter mit Anschrift), z. B. Cloudflare
    backendHost: 'Cloudflare, Inc., 101 Townsend St., San Francisco, CA 94107, USA',
    updated: '20. Oktober 2026',
  },
};
