/*
 * Train Sim Germany – Bewerbungen
 *
 *   app:<id>       → ganze Bewerbung (Angaben, Antworten, Ergebnis, Status)
 *   content:apps   → Übersicht [{ id, job, jobTitle, area, sub, username, displayName, at, score, total, status, sentAt }]
 *
 * Status: new (neu) → passed (bestanden) | failed (nicht bestanden). Das Public Relations Department
 * schickt die Bestandenen gesammelt an Discord (DISCORD_RESULTS_WEBHOOK_URL) und gratuliert ihnen.
 * Bewerbungen werden nach 180 Tagen gelöscht.
 */
import { randomKey, clip, now } from './lib.js';
import { jobOpenAt } from './content.js';

const APPS_PER_DAY = 3;
const KEEP_DAYS = 180;
const bad = (msg = 'bad_request', status = 400) => Object.assign(new Error(msg), { status });

const summary = (a) => ({
  id: a.id, job: a.job, jobTitle: a.jobTitle, area: a.area, sub: a.sub, username: a.username, displayName: a.displayName,
  avatar: a.avatar, at: a.at, score: a.score, total: a.total, status: a.status, sentAt: a.sentAt || null,
});
// Was der Bewerber selbst wieder sehen kann
export const ownView = (a) => ({
  id: a.id, job: a.job, area: a.area, roblox: a.username, discord: a.discord, email: a.email, since: a.since, rank: a.rank,
  count: a.count, at: a.at, status: a.sentAt ? a.status : 'new',
});

async function saveIndex(store, list) {
  const keepFrom = Date.now() - KEEP_DAYS * 86400000;
  const old = list.filter((x) => x.at < keepFrom);
  await Promise.all(old.map((x) => store.delete(`app:${x.id}`)));
  await store.put('content:apps', list.filter((x) => x.at >= keepFrom));
}

async function postWebhook(url, payload, file) {
  const form = new FormData();
  form.append('payload_json', JSON.stringify({ username: 'Train Sim Germany', allowed_mentions: { parse: [] }, ...payload, ...(file ? { attachments: [{ id: 0, filename: file.name }] } : {}) }));
  if (file) form.append('files[0]', new Blob([file.text], { type: 'text/plain; charset=utf-8' }), file.name);
  const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}wait=true`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Discord ${res.status}: ${await res.text().catch(() => '')}`);
}

function answersText(a, profile, score) {
  return [
    `Bewerbung: ${a.jobTitle}${a.area ? ` – ${a.area}` : ''}`,
    `Roblox: ${a.username} (${a.displayName}, ID ${a.sub}) – ${profile}`,
    `Discord: ${a.discord}`,
    `E-Mail: ${a.email || '–'}`,
    `Spielt seit: ${a.since || '–'}`,
    `Rang (angegeben): ${a.rank || '–'} · ${a.groupRole ? `Rolle in der Gruppe: ${a.groupRole.name}` : 'nicht in der Gruppe'}`,
    `Ergebnis: ${score}`,
    `Aktivität: ${a.activity ? `${a.activity} / 10` : '–'} · Freie Tage: ${(a.days || []).join(', ') || '–'}`,
    `Sprache: ${a.lang} · Gesendet: ${new Date(a.at).toISOString().replace('T', ' ').slice(0, 16)} UTC`,
    '', 'Erfahrung:', a.experience || '–', '', 'Fragen und Antworten:',
    ...a.answers.flatMap((x, i) => ['', `${i + 1}. ${x.ok === true ? '[richtig] ' : x.ok === false ? '[falsch] ' : ''}${x.q}`, `   ${String(x.a).replace(/\n/g, '\n   ')}`]),
  ].join('\n');
}
const scoreText = (a) => (a.total > 0 ? `${a.score} von ${a.total} richtig (${Math.round((a.score / a.total) * 100)} %)` : '–');

export async function submitApplication(store, env, user, body) {
  if (!/^[a-z0-9-]{2,40}$/.test(body.job || '') || !Array.isArray(body.answers) || body.answers.length > 100) throw bad();
  if (!String(body.discord || '').trim()) throw bad();
  // Stelle offen? Wer vor dem Schließen bzw. vor Ende des Zeitraums angefangen hat, darf noch absenden.
  const jobs = (await store.get('content:jobs')) || {};
  const state = jobs[body.job];
  const t = Date.now();
  const started = Number.isFinite(+body.startedAt) ? Math.min(+body.startedAt, t) : t;
  if (!jobOpenAt(state, t) && !(jobOpenAt(state, started) && t - started < 12 * 3600000)) throw bad('closed', 409);

  // Schutz vor Spam: höchstens 3 Bewerbungen pro Tag und eine pro Stelle
  const rlKey = `apps:${user.sub}`;
  const recent = ((await store.get(rlKey)) || []).filter((x) => x.at > now() - 86400);
  if (recent.length >= APPS_PER_DAY || recent.some((x) => x.job === body.job)) throw bad('rate_limited', 429);

  const a = {
    id: randomKey(9), job: body.job, jobTitle: clip(body.jobTitle || body.job, 80), area: clip(body.area, 40) || null,
    sub: user.sub, username: user.username, displayName: user.displayName, avatar: user.avatar || null, groupRole: user.groupRole || null,
    discord: clip(body.discord, 100).trim(), email: clip(body.email, 200).trim(), since: clip(body.since, 60), rank: clip(body.rank, 40),
    experience: clip(body.experience, 5000), activity: Math.max(0, Math.min(10, Math.round(+body.activity || 0))),
    days: (Array.isArray(body.days) ? body.days : []).slice(0, 7).map((d) => clip(d, 12)),
    score: Math.max(0, Math.round(+body.score || 0)), total: Math.max(0, Math.round(+body.total || 0)),
    count: Math.round(+body.count || body.answers.length), lang: clip(body.lang, 5),
    answers: body.answers.map((x) => ({ q: clip(x.q, 600), a: clip(x.a, 3000), ok: x.ok === true ? true : x.ok === false ? false : null })),
    at: t, status: 'new',
  };
  await store.put(`app:${a.id}`, a);
  const list = (await store.get('content:apps')) || [];
  list.unshift(summary(a));
  await saveIndex(store, list);
  recent.push({ job: a.job, at: now() });
  await store.put(rlKey, recent, { ttl: 86400 });

  // Hinweis an den Team-Kanal (optional, Fehler sind nicht schlimm – die Bewerbung ist gespeichert)
  if (env.DISCORD_WEBHOOK_URL) {
    const profile = `https://www.roblox.com/users/${encodeURIComponent(a.sub)}/profile`;
    const field = (name, value) => ({ name, value: clip(value || '–', 1024), inline: true });
    await postWebhook(env.DISCORD_WEBHOOK_URL, {
      embeds: [{
        title: clip(`Neue Bewerbung: ${a.jobTitle}${a.area ? ` – ${a.area}` : ''}`, 256), url: profile, color: 0xEC0016,
        description: clip(a.experience ? `**Erfahrung:**\n${a.experience}` : '', 3000),
        thumbnail: a.avatar ? { url: a.avatar } : undefined,
        fields: [
          field('Roblox (angemeldet)', `[${a.username}](${profile}) · ${a.displayName}\nID ${a.sub}`), field('Discord', a.discord), field('E-Mail', a.email),
          field('Rang', `${a.rank} (angegeben)${a.groupRole ? `\nGruppe: ${a.groupRole.name}` : '\nNicht in der Gruppe'}`), field('Ergebnis', scoreText(a)),
          field('Aktivität', a.activity ? `${a.activity} / 10` : '–'), field('Freie Tage', a.days.join(', ')),
        ],
        footer: { text: 'Train Sim Germany · Prüfen in der App unter Karriere → Bewerbungen prüfen' },
        timestamp: new Date(t).toISOString(),
      }],
    }, { name: `bewerbung-${a.username}-${a.job}.txt`, text: answersText(a, profile, scoreText(a)) }).catch((e) => console.error(e.message));
  }
  return ownView(a);
}

export const listApplications = async (store) => (await store.get('content:apps')) || [];
export async function getApplication(store, id) {
  if (!/^[\w-]{6,30}$/.test(id)) return null;
  return store.get(`app:${id}`);
}
export async function setStatus(store, user, id, status) {
  if (!['new', 'passed', 'failed'].includes(status)) throw bad();
  const a = await getApplication(store, id);
  if (!a) throw bad('not_found', 404);
  a.status = status;
  a.reviewedBy = user.username;
  a.reviewedAt = Date.now();
  await store.put(`app:${a.id}`, a);
  const list = await listApplications(store);
  const i = list.findIndex((x) => x.id === id);
  if (i >= 0) list[i] = summary(a);
  await store.put('content:apps', list);
  return summary(a);
}

// Bestandene an Discord senden und gratulieren (Webhook 2)
export async function announce(store, env, user, ids) {
  if (!env.DISCORD_RESULTS_WEBHOOK_URL) throw bad('not_configured', 503);
  const chosen = [];
  for (const id of (Array.isArray(ids) ? ids : []).slice(0, 50)) {
    const a = await getApplication(store, id);
    if (a && a.status === 'passed' && !a.sentAt) chosen.push(a);
  }
  if (!chosen.length) throw bad('nothing_to_send');
  const lines = chosen.map((a) => `🎉 **${a.discord}** · Roblox: [${a.username}](https://www.roblox.com/users/${encodeURIComponent(a.sub)}/profile) – ${a.jobTitle}${a.area ? ` (${a.area})` : ''}`);
  await postWebhook(env.DISCORD_RESULTS_WEBHOOK_URL, {
    content: clip(`**Herzlichen Glückwunsch!** 🚆\nDiese Bewerbungen haben bestanden – willkommen im Team von Train Sim Germany:\n\n${lines.join('\n')}\n\nWir melden uns in den nächsten Tagen mit allem Weiteren.`, 2000),
  });
  const t = Date.now();
  const list = await listApplications(store);
  for (const a of chosen) {
    a.sentAt = t;
    a.sentBy = user.username;
    await store.put(`app:${a.id}`, a);
    const i = list.findIndex((x) => x.id === a.id);
    if (i >= 0) list[i] = summary(a);
  }
  await store.put('content:apps', list);
  return { sent: chosen.length };
}
