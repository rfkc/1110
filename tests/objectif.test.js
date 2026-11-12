// Tests des calculs d'Objectif 365. Lancer : node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('../objectif.js');

const S = { totalDepart: 295, dateDepart: '2026-11-12', objectif: 365, annee: 2026, sortiesParSemaine: 3, ville: 'Grenoble' };
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

const ids = list => list.map(t => t.id);

test('paliers réguliers : tous les 50 km jusqu’à 500 km d’objectif, tous les 100 km au-delà', () => {
  assert.deepEqual(O.milestones(365), [50, 100, 150, 200, 250, 300, 350, 365]);
  assert.deepEqual(O.milestones(500), [50, 100, 150, 200, 250, 300, 350, 400, 450, 500]);
  assert.deepEqual(O.milestones(1000), [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
  assert.deepEqual(O.milestones(550), [100, 200, 300, 400, 500, 550]);
});

// Nouveaux trophées après avoir atteint « total » km (une seule sortie le 20/11), vus le 24/11
const after = (settings, total, fetes = [], opts) =>
  O.newTrophies(settings, total > settings.totalDepart ? [run('2026-11-20', total - settings.totalDepart)] : [], '2026-11-24', fetes, opts);
const kmIds = list => ids(list).filter(id => !/^(p-|d\d)/.test(id)); // sans les exploits ni les dates

test('trophées : chacun fêté une seule fois, jamais ceux déjà dans le total de départ', () => {
  assert.deepEqual(ids(after(S, 295)), []);
  const first = after(S, 301);
  assert.ok(kmIds(first).includes('r300'));
  assert.ok(ids(first).includes('p-1'));                       // première sortie
  assert.deepEqual(after(S, 301, ids(first)), []);              // supprimée puis rajoutée : pas de 2e fête
  assert.ok(!kmIds(after(S, 301, [300])).includes('r300'));     // ancien format (km) reconnu
  assert.ok(first.every((t, i) => i === 0 || !t.big));         // le plus important en premier
  // 365 pour elle : l'objectif (qui vaut aussi « 1 km par jour »), en grande fête, en premier
  const big = after(S, 365);
  assert.equal(big[0].id, 'objectif');
  assert.ok(big[0].big);
  // pour lui (1000 km), « 1 km par jour » à 365 est un trophée à part, en grande fête aussi
  const R = { ...S, totalDepart: 0, objectif: 1000 };
  assert.ok(O.trophies(R).find(t => t.id === 's-1').big);
  assert.ok(O.trophies(R).find(t => t.id === 's-mi'));
});

test('trophées : la liste complète, sans identifiant en double', () => {
  const all = O.trophies(S, { alix: true });
  assert.equal(new Set(ids(all)).size, all.length);
  all.forEach(t => assert.match(t.id, /^[\w-]{1,40}$/));
  const km = all.filter(t => t.km !== null);
  for (let i = 1; i < km.length; i++) assert.ok(km[i - 1].km <= km[i].km); // triés par km
  assert.equal(all.find(x => x.id === 's-1'), undefined);  // fusionné avec l'objectif de 365
  assert.equal(all.find(x => x.id === 's-mi'), undefined); // = « un demi-km par jour »
  const t = O.trophies({ ...S, annee: 2028 }).find(x => x.id === 's-1');
  assert.equal(t.km, 366); // année bissextile : « 1 km par jour » = 366 km
  assert.ok(O.trophies(S).find(x => x.name === '500 miles').text.includes('I would walk'));
  [501, 512, 555, 1337].forEach(n => assert.equal(all.find(x => x.km === n), undefined)); // retirés
});

test('trophées : ce qui est réservé à Alix', () => {
  const pote = ids(O.trophies(S));
  const alix = ids(O.trophies(S, { alix: true }));
  // 11:10 (111 km), l'heure parfaite (1 110 km), Chambéry et Sainte-Sigolène, 11/10, 13/04, 11,1 km d'un coup
  ['x3', 'x10', 'a0', 'a1', 'p-1110'].forEach(id => { assert.ok(alix.includes(id), id); assert.ok(!pote.includes(id), id); });
  const dates = O.trophies(S, { alix: true }).filter(x => x.jour).map(x => x.jour);
  assert.ok(dates.includes('10-11') && dates.includes('04-13'));
  assert.ok(!O.trophies(S).some(x => x.jour === '10-11' || x.jour === '04-13'));
  assert.ok(O.trophies(S).some(x => x.jour === '12-23')); // l'anniversaire du boss : pour tout le monde
});

test('trajets : à vol d’oiseau depuis la ville de chacun', () => {
  const lyon = O.trophies(S).find(x => x.cat === 'trajet' && x.name === 'Lyon');
  assert.ok(lyon.km > 85 && lyon.km < 100, String(lyon.km));  // Grenoble → Lyon ≈ 95 km
  assert.ok(lyon.text.includes('à vol d’oiseau') && lyon.text.includes('de Grenoble à Lyon'));
  const P = { ...S, ville: 'Paris' };
  assert.equal(O.trophies(P).find(x => x.name === 'Paris'), undefined); // pas de Paris → Paris
  const lyonP = O.trophies(P).find(x => x.name === 'Lyon');
  assert.ok(lyonP.km > 380 && lyonP.km < 400, String(lyonP.km)); // Paris → Lyon ≈ 392 km
  assert.equal(O.cleanSettings({ ...S, ville: 'Atlantide' }).ville, 'Grenoble'); // ville inconnue
  assert.equal(O.cleanSettings({ ...S, ville: undefined }).ville, 'Grenoble');  // anciens réglages
});

test('trophées : date de déblocage', () => {
  const runs = [run('2026-11-13', 4), run('2026-11-15', 3)];
  const d = O.unlockDates(S, runs, '2026-11-20');
  assert.equal(d['r250'], 'depart');      // déjà dans les 295 km
  assert.equal(d['r300'], '2026-11-15');  // 295 + 4 = 299, puis 302
  assert.equal(d['r350'], null);
});

test('exploits et dates spéciales', () => {
  const runs = [run('2026-11-13', 25), run('2026-11-14', 11.1), run('2026-11-15', 3), run('2026-11-17', 12), run('2026-11-24', 12)];
  const d = O.unlockDates(S, runs, '2026-11-26', { alix: true });
  assert.equal(d['p-1'], '2026-11-13');
  assert.equal(d['p-10km'], '2026-11-13');
  assert.equal(d['p-semi'], '2026-11-13');
  assert.equal(d['p-marathon'], null);
  assert.equal(d['p-10'], null);
  assert.equal(d['p-weekend'], '2026-11-15');     // samedi 14 + dimanche 15
  assert.equal(d['p-semaine'], '2026-11-13');     // 5,6 km à faire la 1re semaine
  assert.equal(d['p-3semaines'], '2026-11-24');   // 3 semaines bouclées de suite
  assert.equal(d['p-retour'], '2026-11-13');      // 20 km de retard, puis +4 km
  assert.equal(d['p-1110'], '2026-11-14');        // 11,1 km pile
  const vendredi13 = O.trophies(S).find(x => x.jour === 'vendredi13');
  assert.equal(d[vendredi13.id], '2026-11-13');   // le 13/11/2026 est un vendredi
  const noel = O.trophies(S).find(x => x.jour === '12-25');
  assert.equal(d[noel.id], null);
  // une semaine ratée casse la série
  const d2 = O.unlockDates(S, [run('2026-11-13', 6), run('2026-11-24', 12), run('2026-12-01', 12)], '2026-12-03');
  assert.equal(d2['p-3semaines'], null);
});

test('objectif de 1000 km : un palier tous les 100 km, sans fêter ceux déjà dépassés', () => {
  const R = { ...S, totalDepart: 838.9, objectif: 1000 };
  assert.ok(!kmIds(after(R, 845)).includes('r800'));    // 800 était déjà passé au départ
  assert.ok(kmIds(after(R, 901)).includes('r900'));
  assert.equal(after(R, 1001)[0].id, 'objectif');
  assert.equal(O.barStart(R), 790);
  assert.equal(O.barStart(S), 280); // la barre de 365 ne change pas
  const r = O.compute(R, [], '2026-11-12');
  assert.equal(O.fmtKmJour(r.kmParJour), '3,22');
  assert.equal(r.ecart, -24.1);
  assert.equal(O.fmtKm(r.semaine.cible), '12,9');
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
    paliersFetes: [300, '<x>'],
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

test('arrondis : 364,9 + 0,1 fait bien 365 (objectif atteint)', () => {
  const runs = [run('2026-11-13', 69.8), run('2026-11-14', 0.1), run('2026-11-15', 0.1)];
  const r = O.compute(S, runs, '2026-11-15');
  assert.equal(r.total, 365);
  assert.equal(r.atteint, true);
  assert.equal(r.kmRestants, 0);
  const r2 = O.compute({ ...S, totalDepart: 0 }, [run('2026-11-13', 0.1), run('2026-11-13', 0.2)], '2026-11-13');
  assert.equal(r2.total, 0.3);
});

test('import : un identifiant de sortie bizarre est écarté', () => {
  const d = O.cleanData({ sorties: [
    { id: '"><img src=x onerror=alert(1)>', date: '2026-11-13', km: 5 },
    { id: 'ok-1_a', date: '2026-11-13', km: 5 },
    { id: '', date: '2026-11-13', km: 5 },
  ] });
  assert.deepEqual(d.sorties.map(r => r.id), ['ok-1_a']);
  assert.match(O.newId(), /^[\w-]{1,40}$/);
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
