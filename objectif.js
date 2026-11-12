/* ============================================================
   11:10 — Objectif 365 : les calculs
   Aucun lien avec l'affichage : on donne les réglages, la liste des sorties
   et la date du jour, et on récupère tous les chiffres.
   Rien n'est stocké en double : tout est recalculé à chaque fois,
   donc corriger une ancienne sortie met tout à jour.

   Utilisable dans la page (window.Objectif) et dans les tests (Node).
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Objectif = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Dates : des clés "AAAA-MM-JJ", en heure locale ---------- */
  const pad = n => String(n).padStart(2, '0');
  const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

  // "2026-11-12" à partir d'une date, avec l'heure locale du téléphone (jamais l'UTC)
  function keyOf(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  // Numéro de jour qui se suit sans trou (insensible aux changements d'heure)
  function dayNumber(key) {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86400000;
  }

  function keyOfNumber(n) {
    const d = new Date(n * 86400000);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  function isValidKey(key) {
    if (typeof key !== 'string' || !KEY_RE.test(key)) return false;
    return keyOfNumber(dayNumber(key)) === key; // refuse le 31 février
  }

  // 0 = lundi … 6 = dimanche (le 1er janvier 1970 était un jeudi)
  const weekday = key => (dayNumber(key) + 3) % 7;
  const daysInYear = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
  const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;

  /* ---------- Réglages par défaut ---------- */
  function defaultSettings(todayKey) {
    return {
      totalDepart: 0,
      dateDepart: todayKey,
      objectif: 365,
      annee: Number(todayKey.slice(0, 4)),
      sortiesParSemaine: 3,
    };
  }

  // Paliers fêtés : 300, 333 et 350 (s'ils sont sous l'objectif), puis l'objectif lui-même
  function milestones(objectif) {
    return [300, 333, 350].filter(m => m < objectif).concat([objectif]);
  }

  /* ---------- Le calcul principal ---------- */
  function compute(settings, runs, todayKey) {
    const s = settings;
    const Y = s.annee;
    const yearStart = dayNumber(Y + '-01-01');
    const yearEnd = dayNumber(Y + '-12-31');
    const nbDays = daysInYear(Y);
    const pace = s.objectif / nbDays;                 // 1 km/jour pour 365 km
    const start = Math.max(dayNumber(s.dateDepart), yearStart);
    const today = dayNumber(todayKey);
    const dayRef = Math.min(Math.max(today, yearStart), yearEnd + 1); // aujourd'hui, ramené dans l'année

    // Seules comptent les sorties de l'année, à partir du jour de départ (inclus)
    const counted = runs
      .filter(r => { const n = dayNumber(r.date); return n >= start && n <= yearEnd; })
      .map(r => ({ id: r.id, date: r.date, km: r.km, n: dayNumber(r.date) }));

    const sumBetween = (from, to) => counted.reduce((acc, r) => (r.n >= from && r.n <= to ? acc + r.km : acc), 0);
    const totalBefore = n => s.totalDepart + sumBetween(start, n - 1);

    // Où elle en est
    const total = s.totalDepart + sumBetween(start, yearEnd);
    const kmRestants = Math.max(0, s.objectif - total);
    const joursRestants = Math.max(0, yearEnd - dayRef + 1); // aujourd'hui compris
    const atteint = total >= s.objectif;
    const depassement = Math.max(0, total - s.objectif);

    // La boussole
    let kmParJour;
    if (kmRestants === 0) kmParJour = 0;
    else kmParJour = joursRestants > 0 ? kmRestants / joursRestants : Infinity;
    const ecart = round(joursRestants * pace - kmRestants, 1); // > 0 avance, < 0 retard
    const enAvance = ecart >= 0;                              // même règle pour le signe et la couleur

    // La semaine (lundi → dimanche), ramenée au départ et à l'année
    const monday = dayRef - (dayRef + 3) % 7;
    const weekStart = Math.max(monday, start);
    const weekEnd = Math.min(monday + 6, yearEnd);
    let semaine = null;
    if (today >= start && today <= yearEnd && weekStart <= weekEnd) {
      const kmRestantsLundi = Math.max(0, s.objectif - totalBefore(weekStart));
      const joursRestantsLundi = yearEnd - weekStart + 1;
      const joursSemaine = weekEnd - weekStart + 1;
      const cible = kmRestantsLundi * joursSemaine / joursRestantsLundi;
      const faitesSemaine = counted.filter(r => r.n >= weekStart && r.n <= weekEnd);
      const kmSemaine = faitesSemaine.reduce((acc, r) => acc + r.km, 0);
      const reste = cible - kmSemaine;
      const joursRestantsSemaine = weekEnd - today + 1;
      const sortiesRestantes = Math.max(1, Math.min(s.sortiesParSemaine - faitesSemaine.length, joursRestantsSemaine));
      semaine = {
        debut: keyOfNumber(weekStart),
        fin: keyOfNumber(weekEnd),
        partielle: joursSemaine < 7,
        cible,
        kmSemaine,
        sortiesFaites: faitesSemaine.length,
        reste: Math.max(0, reste),
        atteinte: reste <= 0.05,
        avance: Math.max(0, -reste),
        sortiesRestantes,
        kmParSortie: Math.max(0, reste) / sortiesRestantes,
        jourIndex: today - monday,              // 0 = lundi, pour la frise L…D
        joursAvantDebut: weekStart - monday,    // jours de la semaine avant le départ ou l'année
      };
    }

    // Projection : seulement après 7 jours d'utilisation et au moins une sortie
    const joursEcoules = today - start + 1;
    let projection = null;
    if (joursEcoules > 7 && counted.length > 0 && today <= yearEnd) {
      const rythme = sumBetween(start, today) / joursEcoules;
      projection = total + rythme * joursRestants;
    }

    return {
      total, kmRestants, joursRestants, kmParJour, ecart, enAvance, atteint, depassement,
      pourcentage: s.objectif > 0 ? total / s.objectif * 100 : 0,
      allure: pace, anneeFinie: today > yearEnd, avantDepart: today < start,
      semaine, projection, joursEcoules,
      paliers: milestones(s.objectif),
    };
  }

  /* ---------- La courbe : total à la fin de chaque jour, et la ligne « 1 km/jour » ---------- */
  function curve(settings, runs, todayKey) {
    const s = settings;
    const yearStart = dayNumber(s.annee + '-01-01');
    const yearEnd = dayNumber(s.annee + '-12-31');
    const pace = s.objectif / daysInYear(s.annee);
    const start = Math.max(dayNumber(s.dateDepart), yearStart);
    const last = Math.min(dayNumber(todayKey), yearEnd);
    const perDay = {};
    runs.forEach(r => { const n = dayNumber(r.date); if (n >= start && n <= yearEnd) perDay[n] = (perDay[n] || 0) + r.km; });

    // Premier point : la veille au soir du départ (le total Strava)
    const points = [{ jour: start - 1 - yearStart, total: s.totalDepart }];
    let t = s.totalDepart;
    for (let n = start; n <= last; n++) {
      t += perDay[n] || 0;
      points.push({ jour: n - yearStart, total: t });
    }
    return {
      points,                                  // jour = n° du jour dans l'année (0 = 1er janvier)
      ligne: jour => pace * (jour + 1),        // où il faudrait être le soir de ce jour
      dernierJour: yearEnd - yearStart,
    };
  }

  /* ---------- Paliers à fêter ---------- */
  // Ceux qu'on vient d'atteindre et qui n'ont jamais été fêtés
  function newMilestones(total, objectif, dejaFetes) {
    return milestones(objectif).filter(m => total >= m && !dejaFetes.includes(m));
  }

  /* ---------- Saisie ---------- */
  // "5,2" ou "5.2" → 5.2 ; renvoie { km } ou { erreur }
  function parseKm(text) {
    const t = String(text == null ? '' : text).trim().replace(/\s/g, '').replace(',', '.');
    if (!t) return { erreur: 'vide' };
    if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(t)) return { erreur: 'texte' };
    const km = Number(t);
    if (!isFinite(km)) return { erreur: 'texte' };
    if (km < 0) return { erreur: 'negatif' };
    if (km === 0) return { erreur: 'zero' };
    if (km > 100) return { erreur: 'trop' };
    return { km: round(km, 2) };
  }

  // Vérifie la date d'une sortie : pas dans le futur, dans l'année, pas avant le départ
  function checkDate(dateKey, settings, todayKey) {
    if (!isValidKey(dateKey)) return 'date';
    const n = dayNumber(dateKey);
    if (n > dayNumber(todayKey)) return 'futur';
    if (dateKey.slice(0, 4) !== String(settings.annee)) return 'annee';
    if (n < dayNumber(settings.dateDepart)) return 'avantDepart';
    return null;
  }

  const MESSAGES = {
    vide: 'Indique le nombre de km',
    texte: 'Juste un nombre, par exemple 5,2',
    negatif: 'Un nombre positif, par exemple 5,2',
    zero: 'Il faut au moins quelques mètres',
    trop: 'Plus de 100 km ? Vérifie le chiffre',
    date: 'Cette date ne va pas',
    futur: "Cette date n'est pas encore arrivée",
    annee: "Cette date n'est pas dans l'année de l'objectif",
    avantDepart: 'Avant le départ : elle est déjà dans le total',
  };

  /* ---------- Données enregistrées ---------- */
  // Format : { version: 1, reglages: {...} | null, sorties: [{ id, date, km }], paliersFetes: [300, …] }
  function emptyData() {
    return { version: 1, reglages: null, sorties: [], paliersFetes: [] };
  }

  const isNum = v => typeof v === 'number' && isFinite(v);

  function cleanSettings(r) {
    if (!r || typeof r !== 'object') return null;
    if (!isNum(r.totalDepart) || r.totalDepart < 0 || r.totalDepart > 100000) return null;
    if (!isValidKey(r.dateDepart)) return null;
    if (!isNum(r.objectif) || r.objectif <= 0 || r.objectif > 100000) return null;
    if (!Number.isInteger(r.annee) || r.annee < 2000 || r.annee > 2200) return null;
    const spw = Number.isInteger(r.sortiesParSemaine) && r.sortiesParSemaine >= 1 && r.sortiesParSemaine <= 14 ? r.sortiesParSemaine : 3;
    return { totalDepart: r.totalDepart, dateDepart: r.dateDepart, objectif: r.objectif, annee: r.annee, sortiesParSemaine: spw };
  }

  // Ne garde que des données valides (protège contre un fichier importé abîmé)
  function cleanData(obj) {
    const out = emptyData();
    if (!obj || typeof obj !== 'object') return out;
    out.reglages = cleanSettings(obj.reglages);
    const seen = new Set();
    (Array.isArray(obj.sorties) ? obj.sorties : []).forEach(r => {
      if (!r || typeof r !== 'object') return;
      if (typeof r.id !== 'string' || !r.id || seen.has(r.id)) return;
      if (!isValidKey(r.date) || !isNum(r.km) || r.km <= 0 || r.km > 100) return;
      seen.add(r.id);
      out.sorties.push({ id: r.id, date: r.date, km: r.km });
    });
    out.paliersFetes = (Array.isArray(obj.paliersFetes) ? obj.paliersFetes : []).filter(isNum);
    return out;
  }

  // Import : on AJOUTE ce qui manque, on n'efface rien. Renvoie { data, ajoutees }
  function mergeData(current, incoming) {
    const cur = cleanData(current);
    const inc = cleanData(incoming);
    const ids = new Set(cur.sorties.map(r => r.id));
    let ajoutees = 0;
    inc.sorties.forEach(r => { if (!ids.has(r.id)) { cur.sorties.push(r); ids.add(r.id); ajoutees++; } });
    if (!cur.reglages && inc.reglages) cur.reglages = inc.reglages;
    inc.paliersFetes.forEach(m => { if (!cur.paliersFetes.includes(m)) cur.paliersFetes.push(m); });
    return { data: cur, ajoutees };
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- Affichage des nombres, à la française ---------- */
  const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
  // Évite le "-0" : on arrondit d'abord
  const fmtKm = n => nf1.format(round(n, 1) + 0);          // 5,6 · 295 · 2,8
  const fmtKmJour = n => nf2.format(round(n, 2) + 0);      // 1,4 · 1,05 · 0,97

  return {
    keyOf, dayNumber, keyOfNumber, isValidKey, weekday, daysInYear,
    defaultSettings, milestones, compute, curve, newMilestones,
    parseKm, checkDate, MESSAGES,
    emptyData, cleanData, cleanSettings, mergeData, newId,
    fmtKm, fmtKmJour,
  };
});
