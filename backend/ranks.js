/*
 * Train Sim Germany – Ränge der Roblox-Gruppe (gleiche Liste wie in assets/js/data.js), von oben nach unten.
 * Die Rolle in der Gruppe wird über das Kürzel in eckigen Klammern zugeordnet („[QD] Qualified Driver“),
 * sonst über den Namen. Nicht in der Gruppe = Guest.
 */
export const RANKS = [
  ['Chief Engineer', 'CEN'], ['Community Director', 'CDR'], ['Operation Manager', 'OM'], ['Project Engineer', 'PJE'],
  ['Public Relations Department', 'PRD'], ['Signaller Manager', 'SGM'], ['Conductor Manager', 'CDM'],
  ['Platform Staff Manager', 'PSM'], ['Driver Manager', 'DM'], ['Alpha Test Account(s)', 'AT'], ['Supervisor', 'SV'],
  ['Junior Supervisor', 'J-SV'], ['Signaller', 'SG'], ['Conductor', 'CD'], ['Platform Staff', 'PS'],
  ['Qualified Driver', 'QD'], ['Learning Driver', 'LD'], ['Guest', 'G'],
];
// Trainings gibt es für genau einen dieser Ränge
export const TRAINING_RANKS = ['Qualified Driver', 'Platform Staff', 'Conductor', 'Signaller'];

// Höhere Zahl = höherer Rang
export const level = (name) => {
  const i = RANKS.findIndex(([n]) => n === name);
  return i < 0 ? -1 : RANKS.length - 1 - i;
};
export const atLeast = (name, min) => level(name) >= level(min);

export function matchRank(role) {
  if (!role) return 'Guest';
  const name = String(role.name || '').toLowerCase();
  const prefix = ((name.match(/^\s*\[\s*([^\]]+?)\s*\]/) || name.match(/^\s*([a-z-]{1,5})\s*[|:]/) || [])[1] || '').replace(/\s+/g, '');
  const hit = (prefix && RANKS.find(([, p]) => p.toLowerCase() === prefix))
    || RANKS.slice().sort((a, b) => b[0].length - a[0].length).find(([rank]) => name.includes(rank.toLowerCase()));
  return hit ? hit[0] : 'Learning Driver';
}
