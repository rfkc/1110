// Tests des calculs d'Objectif 365. Lancer : node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('../objectif.js');

const S = { totalDepart: 295, dateDepart: '2026-11-12', objectif: 365, annee: 2026, sortiesParSemaine: 3 };
let nid = 0;
const run = (date, km) => ({ id: 'r' + (++nid), date, km });
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, a + ' ≠ ' + b);

test('au départ (jeudi 12/11, 295 km) : 70 km, 50 jours, 1,4 km/jour, 20 km de retard', () => {
  const r = O.compute(S, [], '2026-11-12');
  assert.equal(r.total, 295);
  assert.equal(r.kmRestants, 70);
  assert.equal(r.joursRestants, 50);
  close(r.kmParJour, 1.4);
  assert.equal(O.fmtKmJour(r.kmParJour), '1,4');
  assert.equal(r.ecart, -20);
  assert.equal(r.enAvance, false); // corail
});

test('jeudi 19/11 après 25 km dans la semaine : 45 km, 43 jours, 1,05 km/jour', () => {
  const r = O.compute(S, [run('2026-11-16', 10), run('2026-11-18', 15)], '2026-11-19');
  assert.equal(r.kmRestants, 45);
  assert.equal(r.joursRestants, 43);
  assert.equal(O.fmtKmJour(r.kmParJour), '1,05');
  assert.equal(r.ecart, -2);
  assert.equal(r.enAvance, false);
  // cible du lundi 16/11 : 70 km restants × 7 / 46 jours
  close(r.semaine.cible, 70 * 7 / 46);
  assert.equal(r.semaine.atteinte, true);
  close(r.semaine.avance, 25 - 70 * 7 / 46);
});

test("la cible de la semaine ne bouge pas quand on ajoute une sortie en cours de semaine", () => {
  const runs = [run('2026-11-16', 4)];
  const avant = O.compute(S, runs, '2026-11-19').semaine;
  const apres = O.compute(S, runs.concat(run('2026-11-19', 3)), '2026-11-19').semaine;
  close(avant.cible, apres.cible);
  close(avant.reste - apres.reste, 3);
  assert.equal(avant.sortiesRestantes, 2);
  assert.equal(apres.sortiesRestantes, 1);
  close(apres.kmParSortie, apres.reste);
});

test('sorties par semaine : 2 par défaut, et la suggestion suit le réglage', () => {
  assert.equal(O.defaultSettings('2026-11-12').sortiesParSemaine, 2);
  const runs = [run('2026-11-16', 4)];
  const deux = O.compute({ ...S, sortiesParSemaine: 2 }, runs, '2026-11-17').semaine;
  const trois = O.compute({ ...S, sortiesParSemaine: 3 }, runs, '2026-11-17').semaine;
  assert.equal(deux.sortiesRestantes, 1);
  assert.equal(trois.sortiesRestantes, 2);
  close(deux.kmParSortie, deux.reste);
  close(trois.kmParSortie, trois.reste / 2);
});

test('le lundi suivant, la nouvelle cible part de ce qui reste vraiment', () => {
  const runs = [run('2026-11-16', 20)];
  const r = O.compute(S, runs, '2026-11-23');
  // lundi 23/11 : 365 − 315 = 50 km, 39 jours jusqu'au 31/12
  close(r.semaine.cible, 50 * 7 / 39);
  assert.equal(r.semaine.kmSemaine, 0);
  assert.equal(r.semaine.debut, '2026-11-23');
  assert.equal(r.semaine.fin, '2026-11-29');
});

test('modifier ou supprimer une ancienne sortie recalcule tout', () => {
  const a = run('2026-11-13', 5), b = run('2026-11-14', 6);
  let r = O.compute(S, [a, b], '2026-11-19');
  assert.equal(r.total, 306);
  close(r.semaine.cible, 59 * 7 / 46);

  r = O.compute(S, [{ ...a, km: 8 }, b], '2026-11-19');
  assert.equal(r.total, 309);
  close(r.semaine.cible, 56 * 7 / 46);

  r = O.compute(S, [a], '2026-11-19');
  assert.equal(r.total, 300);
  assert.equal(r.kmRestants, 65);
});

test('première semaine partielle : du jour de départ au dimanche', () => {
  const r = O.compute(S, [], '2026-11-12');
  assert.equal(r.semaine.debut, '2026-11-12');
  assert.equal(r.semaine.fin, '2026-11-15');
  assert.equal(r.semaine.partielle, true);
  close(r.semaine.cible, 70 * 4 / 50); // 5,6 km
  assert.equal(O.fmtKm(r.semaine.cible), '5,6');
  assert.equal(r.semaine.jourIndex, 3);       // jeudi
  assert.equal(r.semaine.joursAvantDebut, 3); // L, M, M grisés
  // une sortie le jour du départ compte
  const r2 = O.compute(S, [run('2026-11-12', 4)], '2026-11-12');
  assert.equal(r2.total, 299);
  close(r2.semaine.cible, r.semaine.cible);
});

test('dernière semaine : du lundi 28 au jeudi 31/12', () => {
  const runs = [run('2026-12-20', 30), run('2026-12-21', 35)]; // 360 km le 27 au soir
  const r = O.compute(S, runs, '2026-12-29');
  assert.equal(r.semaine.debut, '2026-12-28');
  assert.equal(r.semaine.fin, '2026-12-31');
  assert.equal(r.semaine.partielle, true);
  close(r.semaine.cible, 5); // tout ce qui reste
  assert.equal(r.joursRestants, 3);
  assert.equal(r.semaine.sortiesRestantes, 3);
});

test('le 31 décembre : il reste un jour', () => {
  const runs = [run('2026-12-20', 30), run('2026-12-21', 35)];
  const r = O.compute(S, runs, '2026-12-31');
  assert.equal(r.joursRestants, 1);
  close(r.kmParJour, 5);
  assert.equal(r.ecart, -4);
  assert.equal(r.semaine.sortiesRestantes, 1); // un seul jour : pas 3 sorties
});

test('objectif atteint puis dépassé', () => {
  const base = [run('2026-12-01', 35), run('2026-12-02', 35)]; // 365
  let r = O.compute(S, base, '2026-12-05');
  assert.equal(r.atteint, true);
  assert.equal(r.kmRestants, 0);
  assert.equal(r.kmParJour, 0);
  assert.equal(r.enAvance, true);
  assert.equal(r.depassement, 0);

  r = O.compute(S, base.concat(run('2026-12-04', 7)), '2026-12-05');
  assert.equal(r.total, 372);
  assert.equal(r.depassement, 7);
  assert.equal(r.semaine.atteinte, true);
});

test('plusieurs sorties le même jour', () => {
  const runs = [run('2026-11-13', 3), run('2026-11-13', 4)];
  const r = O.compute(S, runs, '2026-11-13');
  assert.equal(r.total, 302);
  assert.equal(r.semaine.sortiesFaites, 2);
  const c = O.curve(S, runs, '2026-11-13');
  assert.equal(c.points[c.points.length - 1].total, 302);
});

test('année bissextile (2028 : 366 jours)', () => {
  assert.equal(O.daysInYear(2028), 366);
  assert.equal(O.daysInYear(2026), 365);
  assert.equal(O.daysInYear(2100), 365);
  assert.equal(O.daysInYear(2000), 366);
  assert.equal(O.isValidKey('2028-02-29'), true);
  assert.equal(O.isValidKey('2026-02-29'), false);
  const S28 = { ...S, dateDepart: '2028-11-12', annee: 2028 };
  const r = O.compute(S28, [], '2028-11-12');
  assert.equal(r.joursRestants, 50);
  close(r.allure, 365 / 366);
  assert.equal(r.ecart, -20.1);
  // du 1er janvier au 31/12 : 366 jours
  const r2 = O.compute({ ...S28, dateDepart: '2028-01-01', totalDepart: 0 }, [], '2028-01-01');
  assert.equal(r2.joursRestants, 366);
  assert.equal(r2.ecart, 0);
  assert.equal(r2.enAvance, true);
});

test('passage au 1er janvier', () => {
  const runs = [run('2026-12-20', 30)];
  const fin = O.compute(S, runs, '2027-01-01');
  assert.equal(fin.anneeFinie, true);
  assert.equal(fin.joursRestants, 0);
  assert.equal(fin.semaine, null);
  assert.equal(fin.total, 325); // l'année 2026 reste figée
  // une sortie datée de 2027 ne compte pas pour 2026
  assert.equal(O.compute(S, runs.concat(run('2027-01-01', 5)), '2027-01-01').total, 325);

  // nouvel objectif 2027 réglé le 1er janvier (un vendredi)
  const S27 = { totalDepart: 0, dateDepart: '2027-01-01', objectif: 365, annee: 2027, sortiesParSemaine: 3 };
  const r = O.compute(S27, [], '2027-01-01');
  assert.equal(r.joursRestants, 365);
  close(r.kmParJour, 1);
  assert.equal(r.ecart, 0);
  assert.equal(r.enAvance, true);
  assert.equal(r.semaine.debut, '2027-01-01');
  assert.equal(r.semaine.fin, '2027-01-03');
  close(r.semaine.cible, 3);
});

test("« aujourd'hui » et « lundi » en heure locale, autour de minuit", () => {
  const original = process.env.TZ;
  try {
    for (const tz of ['Europe/Paris', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
      process.env.TZ = tz;
      assert.equal(O.keyOf(new Date(2026, 10, 12, 23, 59, 59)), '2026-11-12', tz);
      assert.equal(O.keyOf(new Date(2026, 10, 13, 0, 0, 1)), '2026-11-13', tz);
      assert.equal(O.keyOf(new Date(2026, 10, 15, 23, 59)), '2026-11-15', tz); // dimanche soir
      assert.equal(O.keyOf(new Date(2026, 10, 16, 0, 1)), '2026-11-16', tz);   // lundi
      assert.equal(O.weekday('2026-11-15'), 6, tz);
      assert.equal(O.weekday('2026-11-16'), 0, tz);
      assert.equal(O.compute(S, [], '2026-11-16').semaine.debut, '2026-11-16', tz);
    }
    // passage à l'heure d'hiver (25/10/2026) : pas de jour perdu ni doublé
    process.env.TZ = 'Europe/Paris';
    assert.equal(O.dayNumber('2026-10-26') - O.dayNumber('2026-10-25'), 1);
  } finally {
    if (original === undefined) delete process.env.TZ; else process.env.TZ = original;
  }
});

test('projection : seulement après 7 jours et au moins une sortie', () => {
  const runs = [run('2026-11-13', 9), run('2026-11-18', 9)];
  assert.equal(O.compute(S, [], '2026-11-25').projection, null);
  assert.equal(O.compute(S, runs, '2026-11-18').projection, null); // 7e jour
  const r = O.compute(S, runs, '2026-11-20'); // 9 jours, 18 km → 2 km/jour
  close(r.projection, 313 + 2 * 42);
});

test('saisie des km : virgule ou point, et refus gentils', () => {
  assert.deepEqual(O.parseKm('5,2'), { km: 5.2 });
  assert.deepEqual(O.parseKm('5.2'), { km: 5.2 });
  assert.deepEqual(O.parseKm(' 12 '), { km: 12 });
  assert.deepEqual(O.parseKm(',5'), { km: 0.5 });
  assert.deepEqual(O.parseKm('100'), { km: 100 });
  assert.deepEqual(O.parseKm('3,456'), { km: 3.46 });
  assert.equal(O.parseKm('').erreur, 'vide');
  assert.equal(O.parseKm('   ').erreur, 'vide');
  assert.equal(O.parseKm('0').erreur, 'zero');
  assert.equal(O.parseKm('0,0').erreur, 'zero');
  assert.equal(O.parseKm('-3').erreur, 'negatif');
  assert.equal(O.parseKm('abc').erreur, 'texte');
  assert.equal(O.parseKm('5km').erreur, 'texte');
  assert.equal(O.parseKm('1e3').erreur, 'texte');
  assert.equal(O.parseKm('5,2,1').erreur, 'texte');
  assert.equal(O.parseKm('101').erreur, 'trop');
  Object.values(O.MESSAGES).forEach(m => assert.equal(typeof m, 'string'));
});

test('dates de sortie : pas dans le futur, ni hors de l\'année, ni avant le départ', () => {
  assert.equal(O.checkDate('2026-11-12', S, '2026-11-20'), null); // le jour du départ : oui
  assert.equal(O.checkDate('2026-11-20', S, '2026-11-20'), null);
  assert.equal(O.checkDate('2026-11-21', S, '2026-11-20'), 'futur');
  assert.equal(O.checkDate('2026-11-11', S, '2026-11-20'), 'avantDepart');
  assert.equal(O.checkDate('2027-01-01', S, '2027-01-02'), 'annee');
  assert.equal(O.checkDate('2026-13-01', S, '2026-11-20'), 'date');
  assert.equal(O.checkDate('', S, '2026-11-20'), 'date');
});

test('paliers : chacun fêté une seule fois', () => {
  assert.deepEqual(O.milestones(365), [300, 333, 350, 365]);
  assert.deepEqual(O.milestones(320), [300, 320]);
  assert.deepEqual(O.newMilestones(295, 365, []), []);
  assert.deepEqual(O.newMilestones(301, 365, []), [300]);
  assert.deepEqual(O.newMilestones(301, 365, [300]), []); // supprimée puis rajoutée : pas de 2e fête
  assert.deepEqual(O.newMilestones(372, 365, [300, 333]), [350, 365]);
});

test('courbe : part du total Strava et suit la ligne « 1 km/jour »', () => {
  const c = O.curve(S, [run('2026-11-13', 5)], '2026-11-14');
  assert.deepEqual(c.points.map(p => p.total), [295, 295, 300, 300]);
  assert.equal(c.points[0].jour, 314); // le 11/11 au soir (12/11 = 316e jour)
  close(c.ligne(314), 315);            // il faudrait 315 km : 20 km de retard
  assert.equal(c.dernierJour, 364);
  close(c.ligne(364), 365);
});

test('données : nettoyage et import sans rien perdre', () => {
  const d = O.cleanData({
    version: 1,
    reglages: S,
    sorties: [{ id: 'a', date: '2026-11-13', km: 5 }, { id: 'a', date: '2026-11-14', km: 3 },
      { id: 'b', date: 'n importe', km: 3 }, { id: 'c', date: '2026-11-14', km: -2 }, null],
    paliersFetes: [300, 'x'],
  });
  assert.equal(d.sorties.length, 1);
  assert.deepEqual(d.paliersFetes, [300]);
  assert.deepEqual(d.reglages, S);
  assert.equal(O.cleanData(null).reglages, null);
  assert.equal(O.cleanData({ reglages: { ...S, totalDepart: -1 } }).reglages, null);

  // un ancien fichier d'export (sans Objectif 365) ne change rien
  const ancien = O.mergeData(d, undefined);
  assert.equal(ancien.ajoutees, 0);
  assert.deepEqual(ancien.data, d);

  // import : on ajoute ce qui manque, on garde ce qui existe
  const m = O.mergeData(d, { reglages: { ...S, totalDepart: 1 }, sorties: [{ id: 'a', date: '2026-11-13', km: 9 }, { id: 'z', date: '2026-11-15', km: 4 }], paliersFetes: [333] });
  assert.equal(m.ajoutees, 1);
  assert.equal(m.data.sorties.find(r => r.id === 'a').km, 5);
  assert.equal(m.data.reglages.totalDepart, 295);
  assert.deepEqual(m.data.paliersFetes, [300, 333]);

  // sur un téléphone neuf : les réglages arrivent avec le fichier
  assert.deepEqual(O.mergeData(O.emptyData(), d).data.reglages, S);
});

test('affichage des nombres à la française', () => {
  assert.equal(O.fmtKm(5.6), '5,6');
  assert.equal(O.fmtKm(295), '295');
  assert.equal(O.fmtKm(2.8333), '2,8');
  assert.equal(O.fmtKm(-0.04), '0');
  assert.equal(O.fmtKmJour(1.0465), '1,05');
  assert.equal(O.fmtKmJour(0.97), '0,97');
  assert.equal(O.fmtKmJour(1), '1');
});
