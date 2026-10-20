/*
 * Train Sim Germany – Token-Server für den Roblox-Login (optional)
 *
 * Nur nötig, falls Roblox den Token-Abruf direkt aus dem Browser blockiert (CORS).
 * Der Worker tauscht den Anmelde-Code gegen einen Token, lädt das Roblox-Profil und
 * gibt nur { user, nonce } an die Seite zurück. Der Token verlässt den Worker nicht.
 *
 * Einrichtung (Cloudflare Workers, kostenlos):
 *   1. https://dash.cloudflare.com → Workers & Pages → Create → „Hello World“-Worker
 *   2. Diesen Code einfügen und deployen
 *   3. Settings → Variables and Secrets:
 *        CLIENT_ID       = Client-ID der OAuth-App
 *        CLIENT_SECRET   = Client-Secret (als „Secret“ anlegen, nicht als Text)
 *        ALLOWED_ORIGIN  = Adresse der Seite ohne Pfad, z. B. https://<dein-name>.github.io
 *   4. Die Worker-Adresse in assets/js/config.js bei tokenProxy eintragen
 */
const ROBLOX = 'https://apis.roblox.com/oauth';

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST' || request.headers.get('Origin') !== env.ALLOWED_ORIGIN) return reply({ error: 'forbidden' }, 403);

    const input = new URLSearchParams(await request.text());
    if (input.get('grant_type') !== 'authorization_code' || !input.get('code') || !input.get('code_verifier')) return reply({ error: 'bad_request' }, 400);

    // Code gegen Token tauschen (mit Secret, das nur hier liegt)
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.get('code'),
      code_verifier: input.get('code_verifier'),
      client_id: env.CLIENT_ID,
    });
    if (env.CLIENT_SECRET) params.set('client_secret', env.CLIENT_SECRET);
    const tokenRes = await fetch(`${ROBLOX}/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    if (!tokenRes.ok) return reply({ error: 'token' }, 502);
    const tok = await tokenRes.json();

    // Profil laden: sub (Nutzer-ID), name, nickname (Anzeigename), preferred_username, picture
    const userRes = await fetch(`${ROBLOX}/v1/userinfo`, { headers: { Authorization: `Bearer ${tok.access_token}` } });
    if (!userRes.ok) return reply({ error: 'userinfo' }, 502);
    const info = await userRes.json();

    // nonce aus dem ID-Token, damit die Seite die Anmeldung prüfen kann
    let nonce = null;
    try {
      const part = tok.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      nonce = JSON.parse(atob(part)).nonce || null;
    } catch (e) { /* ohne ID-Token */ }

    // Der Refresh-Token wird nicht gebraucht: sofort ungültig machen
    if (tok.refresh_token) {
      const revoke = new URLSearchParams({ token: tok.refresh_token, client_id: env.CLIENT_ID });
      if (env.CLIENT_SECRET) revoke.set('client_secret', env.CLIENT_SECRET);
      await fetch(`${ROBLOX}/v1/token/revoke`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: revoke }).catch(() => {});
    }

    return reply({
      user: { sub: info.sub, name: info.name, nickname: info.nickname, preferred_username: info.preferred_username, picture: info.picture || null },
      nonce,
    });
  },
};
