// Prüft die Luna-Dokumentation: Jeder ```luna-Block muss fehlerfrei sein, jede Seite braucht id, Gruppe, Titel und Einleitung,
// Links auf #/luna/<seite> müssen eine Seite treffen. Aufruf im Projektordner: node tools/check-luna-docs.mjs
import { PAGES, GROUPS, render } from '../assets/js/luna-docs.js';
import { parse, runScript } from '../backend/luna.js';
import { LUNA_INTERN } from '../backend/luna-intern.js';

const fails = [];
const ids = new Set(PAGES.map((p) => p.id));
const extra = new Set(['start', 'intern']);
const check = (label, md) => {
  for (const m of String(md).matchAll(/```luna\n([\s\S]*?)```/g)) {
    try { parse(m[1]); } catch (e) { fails.push(`${label}: Zeile ${e.line} – ${e.message}\n    ${m[1].split('\n')[Math.max(0, (e.line || 1) - 1)]}`); }
  }
  // Links prüfen – Beispiele in Backticks zählen nicht
  for (const m of String(md).replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '').matchAll(/\]\(#\/luna\/([\w-]+)/g)) if (!ids.has(m[1]) && !extra.has(m[1])) fails.push(`${label}: Link auf unbekannte Seite #/luna/${m[1]}`);
  render(md, label);
};
const seen = new Set();
for (const p of PAGES) {
  if (!/^[a-z0-9-]+$/.test(p.id) || seen.has(p.id)) fails.push(`Seite „${p.id}“: id fehlt, ist doppelt oder hat ungültige Zeichen`);
  seen.add(p.id);
  if (!GROUPS.includes(p.group)) fails.push(`Seite „${p.id}“: Gruppe „${p.group}“ steht nicht in GROUPS`);
  if (!p.title || !p.lead) fails.push(`Seite „${p.id}“: title oder lead fehlt`);
  check(p.id, p.md);
}
check('intern', LUNA_INTERN);
// Läuft die Sprache überhaupt? Ein kurzer Probelauf
const r = runScript('local t = { 1, 2, 3 }\nprint(#t)');
if (r.output[0]?.text !== '3') fails.push('runScript liefert nicht das erwartete Ergebnis');
console.log(`${PAGES.length} Seiten geprüft.`);
if (fails.length) { console.log(`\n${fails.length} Fehler:\n- ${fails.join('\n- ')}`); process.exit(1); }
console.log('Alles in Ordnung.');
