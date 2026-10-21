/*
 * Train Sim Germany – E-Mails an Bewerber
 *
 *   • nach dem Absenden: die ganze Bewerbung zum Nachlesen
 *   • nach der Auswertung: Ergebnis (bestanden / nicht bestanden)
 *
 * Versand über Brevo (BREVO_API_KEY, kostenlos 300 E-Mails am Tag, ohne eigene Domain mit bestätigter Absenderadresse)
 * oder Resend (RESEND_API_KEY, braucht eine eigene Domain). Absender: EMAIL_FROM (+ EMAIL_FROM_NAME).
 * Ohne Schlüssel wird keine E-Mail verschickt – die Bewerbung funktioniert trotzdem.
 */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl2br = (s) => esc(s).replace(/\n/g, '<br>');

export const mailReady = (env) => !!(env.EMAIL_FROM && (env.BREVO_API_KEY || env.RESEND_API_KEY));
const validEmail = (e) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(String(e || ''));

export async function sendMail(env, { to, toName, subject, html, text }) {
  if (!mailReady(env) || !validEmail(to)) return false;
  const fromName = env.EMAIL_FROM_NAME || 'Train Sim Germany';
  try {
    let res;
    if (env.BREVO_API_KEY) {
      res = await fetch(env.BREVO_API_URL || 'https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: fromName, email: env.EMAIL_FROM }, to: [{ email: to, name: toName || to }], subject, htmlContent: html, textContent: text,
          ...(env.EMAIL_REPLY_TO ? { replyTo: { email: env.EMAIL_REPLY_TO } } : {}),
        }),
      });
    } else {
      res = await fetch(env.RESEND_API_URL || 'https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `${fromName} <${env.EMAIL_FROM}>`, to: [to], subject, html, text, ...(env.EMAIL_REPLY_TO ? { reply_to: env.EMAIL_REPLY_TO } : {}) }),
      });
    }
    if (!res.ok) console.error('E-Mail:', res.status, await res.text().catch(() => ''));
    return res.ok;
  } catch (e) {
    console.error('E-Mail:', e.message);
    return false;
  }
}

// ---------- Vorlage ----------
const appUrl = (env) => String(env.APP_URL || 'https://loris6.github.io/Train-Sim-Germany/').replace(/\/?$/, '/');
const fmtTime = (ms) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(ms));
const scorePct = (a) => (a.total > 0 ? Math.round((a.score / a.total) * 100) : null);

function layout(env, { preheader, accent = '#EC0016', badge, title, intro, body, button }) {
  const base = appUrl(env);
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#F0F3F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#282D37;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0F3F5;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
  <tr><td style="padding:0 4px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td><img src="${base}assets/icons/icon-192.png" width="40" height="40" alt="" style="display:block;border-radius:12px;"></td>
      <td style="padding-left:12px;font-size:18px;font-weight:700;color:#131821;">Train Sim Germany</td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 8px 24px rgba(19,24,33,.08);">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="height:6px;background:${accent};font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:28px 28px 8px;">
        ${badge ? `<span style="display:inline-block;padding:6px 12px;border-radius:999px;background:${badge.bg};color:${badge.fg};font-size:13px;font-weight:700;letter-spacing:.02em;">${esc(badge.text)}</span>` : ''}
        <h1 style="margin:14px 0 8px;font-size:24px;line-height:1.25;color:#131821;">${esc(title)}</h1>
        <p style="margin:0;font-size:16px;line-height:1.55;color:#3C414B;">${intro}</p>
      </td></tr>
      <tr><td style="padding:16px 28px 28px;">${body}
        ${button ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr><td style="border-radius:10px;background:#EC0016;">
          <a href="${esc(button.href)}" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">${esc(button.text)}</a></td></tr></table>` : ''}
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:18px 8px 0;font-size:12px;line-height:1.6;color:#646973;text-align:center;">
    Diese E-Mail kommt automatisch von der App Train Sim Germany, weil du dich dort beworben hast.<br>
    Fragen? Schreib dem Team im Chat der App. · <a href="${base}privacy.html" style="color:#646973;">Datenschutz</a><br>
    Train Sim Germany ist ein Fan-Projekt auf Roblox und nicht mit der Deutschen Bahn AG oder der Roblox Corporation verbunden.
  </td></tr>
</table></td></tr></table></body></html>`;
}

const row = (label, value) => `<tr>
  <td style="padding:10px 0;border-bottom:1px solid #E6EAEE;font-size:14px;color:#646973;width:42%;vertical-align:top;">${esc(label)}</td>
  <td style="padding:10px 0;border-bottom:1px solid #E6EAEE;font-size:14px;color:#131821;font-weight:600;vertical-align:top;word-break:break-word;">${esc(value || '–')}</td></tr>`;
const section = (title) => `<h2 style="margin:26px 0 10px;font-size:16px;color:#131821;">${esc(title)}</h2>`;

function scoreBlock(a) {
  const pct = scorePct(a);
  if (pct === null) return '';
  const color = pct >= 70 ? '#408335' : pct >= 50 ? '#C26E00' : '#C0001A';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;background:#F5F7F9;border-radius:14px;"><tr><td style="padding:16px 18px;">
    <div style="font-size:13px;color:#646973;">Ergebnis der Wissensfragen</div>
    <div style="margin-top:2px;font-size:26px;font-weight:800;color:${color};">${pct} %<span style="font-size:14px;font-weight:600;color:#646973;"> · ${a.score} von ${a.total} richtig</span></div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;"><tr>
      <td style="height:8px;width:${pct}%;background:${color};border-radius:8px 0 0 8px;font-size:0;">&nbsp;</td>
      <td style="height:8px;background:#DDE2E7;border-radius:${pct ? '0 8px 8px 0' : '8px'};font-size:0;">&nbsp;</td>
    </tr></table>
  </td></tr></table>`;
}

function answersHtml(a) {
  return (a.answers || []).map((x, i) => {
    const mark = x.ok === true ? ['✓', '#408335', '#E8F3E5'] : x.ok === false ? ['✗', '#C0001A', '#FDE8EA'] : ['–', '#646973', '#EEF1F4'];
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #E6EAEE;"><tr>
      <td style="width:30px;padding:12px 10px 12px 0;vertical-align:top;"><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;background:${mark[2]};color:${mark[1]};font-size:13px;font-weight:800;">${mark[0]}</span></td>
      <td style="padding:12px 0;vertical-align:top;">
        <div style="font-size:12px;color:#646973;">Frage ${i + 1}</div>
        <div style="margin-top:2px;font-size:14px;font-weight:600;color:#131821;">${nl2br(x.q)}</div>
        <div style="margin-top:4px;font-size:14px;line-height:1.5;color:#3C414B;word-break:break-word;">${nl2br(x.a || '–')}</div>
      </td></tr></table>`;
  }).join('');
}

export function applicationMail(env, a) {
  const job = `${a.jobTitle}${a.area ? ` – ${a.area}` : ''}`;
  const pct = scorePct(a);
  const body = `${scoreBlock(a)}
    ${section('Deine Angaben')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row('Stelle', job)}${row('Roblox', `${a.username} (${a.displayName})`)}${row('Discord', a.discord)}${row('E-Mail', a.email)}
      ${row('Spielt seit', a.since)}${row('Rang (angegeben)', a.rank)}${row('Aktivität', a.activity ? `${a.activity} von 10` : '–')}${row('Freie Tage', (a.days || []).join(', '))}
      ${row('Gesendet', fmtTime(a.at))}
    </table>
    ${a.experience ? `${section('Deine Erfahrung')}<div style="padding:14px 16px;border-radius:12px;background:#F5F7F9;font-size:14px;line-height:1.6;color:#3C414B;word-break:break-word;">${nl2br(a.experience)}</div>` : ''}
    ${section(`Fragen und Antworten (${(a.answers || []).length})`)}
    ${answersHtml(a)}
    <p style="margin:18px 0 0;font-size:13px;color:#646973;">✓ richtig · ✗ falsch · – wird vom Team gelesen</p>`;
  return {
    subject: `Deine Bewerbung als ${job} ist angekommen`,
    html: layout(env, {
      preheader: `Danke für deine Bewerbung als ${job}. Hier sind alle Angaben zum Nachlesen.`,
      badge: { text: 'Bewerbung eingegangen', bg: '#FDE8EA', fg: '#C0001A' },
      title: 'Deine Bewerbung ist angekommen',
      intro: `Hallo ${esc(a.displayName || a.username)}, danke für deine Bewerbung als <b>${esc(job)}</b>! Das Public Relations Department schaut sie sich an – das Ergebnis bekommst du per E-Mail und im Chat der App. Hier ist alles, was du geschickt hast:`,
      body,
      button: { text: 'Bewerbung in der App ansehen', href: `${appUrl(env)}#/karriere/${encodeURIComponent(a.job)}/bewerbung` },
    }),
    text: [`Deine Bewerbung als ${job} ist angekommen.`, '', `Roblox: ${a.username} (${a.displayName})`, `Discord: ${a.discord}`, `E-Mail: ${a.email}`,
      `Spielt seit: ${a.since || '–'}`, `Rang: ${a.rank || '–'}`, pct === null ? '' : `Ergebnis: ${a.score} von ${a.total} richtig (${pct} %)`, '',
      a.experience ? `Erfahrung:\n${a.experience}\n` : '', 'Fragen und Antworten:',
      ...(a.answers || []).flatMap((x, i) => ['', `${i + 1}. ${x.ok === true ? '[richtig] ' : x.ok === false ? '[falsch] ' : ''}${x.q}`, `   ${x.a || '–'}`])].join('\n'),
  };
}

export function resultMail(env, a, reviewer, chatId) {
  const passed = a.status === 'passed';
  const job = `${a.jobTitle}${a.area ? ` – ${a.area}` : ''}`;
  const body = `${scoreBlock(a)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
      ${row('Stelle', job)}${row('Ergebnis', passed ? '✅ Bestanden' : '❌ Nicht bestanden')}${row('Ausgewertet von', reviewer.username)}${row('Datum', fmtTime(Date.now()))}
    </table>`;
  return {
    subject: `${passed ? '✅ Bestanden' : '❌ Nicht bestanden'}: deine Bewerbung als ${job}`,
    html: layout(env, {
      preheader: passed ? `Herzlichen Glückwunsch – du hast bestanden!` : 'Das Ergebnis deiner Bewerbung ist da.',
      accent: passed ? '#408335' : '#C0001A',
      badge: passed ? { text: '✅ PASSED', bg: '#E8F3E5', fg: '#2F6B27' } : { text: '❌ FAILED', bg: '#FDE8EA', fg: '#C0001A' },
      title: passed ? 'Herzlichen Glückwunsch, du hast bestanden!' : 'Diesmal hat es leider nicht gereicht',
      intro: passed
        ? `Hallo ${esc(a.displayName || a.username)}, deine Bewerbung als <b>${esc(job)}</b> wurde von <b>${esc(reviewer.username)}</b> ausgewertet: <b>bestanden</b>. Willkommen im Team! Wir melden uns mit allem Weiteren im Chat der App und auf Discord.`
        : `Hallo ${esc(a.displayName || a.username)}, deine Bewerbung als <b>${esc(job)}</b> wurde von <b>${esc(reviewer.username)}</b> ausgewertet: <b>nicht bestanden</b>. Danke für deine Mühe – du kannst dich später gern noch einmal bewerben. Fragen beantwortet dir das Team im Chat.`,
      body,
      button: { text: 'Zum Chat in der App', href: `${appUrl(env)}#/chat${chatId ? `/${encodeURIComponent(chatId)}` : ''}` },
    }),
    text: `${passed ? '[✅ PASSED]' : '[❌ FAILED]'} Bewerbung als ${job}\nAusgewertet von ${reviewer.username}\n\n${passed ? 'Herzlichen Glückwunsch! Wir melden uns mit allem Weiteren.' : 'Danke für deine Bewerbung. Du kannst dich später gern noch einmal bewerben.'}\n\n${appUrl(env)}#/chat`,
  };
}
