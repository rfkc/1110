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
      sortiesParSemaine: 2,
    };
  }

  // Paliers réguliers : tous les 50 km (objectif jusqu'à 500 km) ou tous les 100 km (au-delà)
  const stepOf = objectif => (objectif <= 500 ? 50 : 100);

  // Paliers réguliers puis l'objectif lui-même (ceux de la barre de progression)
  function milestones(objectif) {
    const list = [];
    for (let m = stepOf(objectif); m < objectif; m += stepOf(objectif)) list.push(m);
    return list.concat([objectif]);
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

    // arrondi au centième : 0,1 + 0,2 doit faire 0,3, pas 0,30000000000000004
    const sumBetween = (from, to) => round(counted.reduce((acc, r) => (r.n >= from && r.n <= to ? acc + r.km : acc), 0), 2);
    const totalBefore = n => round(s.totalDepart + sumBetween(start, n - 1), 2);

    // Où elle en est
    const total = round(s.totalDepart + sumBetween(start, yearEnd), 2);
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
      const kmSemaine = round(faitesSemaine.reduce((acc, r) => acc + r.km, 0), 2);
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
  /* ---------- Trophées ---------- */
  // cat : course (courses mythiques), symbole, trajet (depuis Grenoble), secret, regulier, objectif
  const COURSES = [
    [21.1, '🏅', 'Semi-marathon', 'la distance d’un semi-marathon, courue depuis le 1er janvier !'],
    [42.195, '🏅', 'Marathon', 'la distance d’un marathon, courue depuis le 1er janvier !'],
    [65, '⛰️', '6000D', 'autant que la 6000D, le trail mythique de La Plagne !'],
    [80.5, '🔥', '50 miles', 'soit 50 miles : une vraie distance d’ultra !'],
    [81, '🌙', 'SaintéLyon', 'la SaintéLyon, de Saint-Étienne à Lyon, de nuit !'],
    [89, '🦁', 'Comrades', 'la Comrades, le plus vieil ultra du monde, en Afrique du Sud !'],
    [149, '🏔️', 'Échappée Belle', 'l’Échappée Belle, la traversée de Belledonne, juste à côté de chez toi !'],
    [160.9, '💯', '100 miles', 'soit 100 miles : le Graal des ultra-traileurs !'],
    [161.3, '🌲', 'Western States', 'la Western States, le plus vieux 100 miles du monde, en Californie !'],
    [165, '⛏️', 'Hardrock', 'la Hardrock 100, dans les montagnes du Colorado !'],
    [171, '🗻', 'UTMB', 'l’UTMB, le tour du Mont-Blanc !'],
    [175, '🌋', 'Diagonale des Fous', 'la Diagonale des Fous, la traversée de La Réunion !'],
    [246, '🏛️', 'Spartathlon', 'le Spartathlon, d’Athènes à Sparte, comme Philippidès !'],
    [250, '🐪', 'Marathon des Sables', 'le Marathon des Sables, à travers le Sahara !'],
    [286, '🌊', 'L’Isère', 'toute la longueur de l’Isère, de sa source jusqu’au Rhône !'],
    [330, '🦣', 'Tor des Géants', 'le Tor des Géants, le tour de la vallée d’Aoste !'],
    [650, '🥾', 'GR5', 'la Grande Traversée des Alpes, du Léman à Nice !'],
  ];
  const TRAJETS = [
    [55, 'Chambéry'], [110, 'Lyon'], [170, 'Sainte-Sigolène'], [530, 'Toulouse'], [576, 'Paris'],
  ];
  // Capitales (et grandes villes) d'Europe qu'on peut rejoindre à pied depuis Grenoble ; km par la route, environ
  const EUROPE = [
    [305, '🇨🇭', 'Berne', 'Suisse'], [340, '🇲🇨', 'Monaco', 'Monaco'], [540, '🇱🇮', 'Vaduz', 'Liechtenstein'],
    [640, '🇦🇩', 'Andorre-la-Vieille', 'Andorre'], [650, '🇱🇺', 'Luxembourg', 'Luxembourg'], [660, '🇪🇸', 'Barcelone', 'Espagne'],
    [710, '🇸🇲', 'Saint-Marin', 'Saint-Marin'], [840, '🇧🇪', 'Bruxelles', 'Belgique'], [890, '🇸🇮', 'Ljubljana', 'Slovénie'],
    [930, '🇮🇹', 'Rome', 'Italie'], [1000, '🇳🇱', 'Amsterdam', 'Pays-Bas'], [1030, '🇭🇷', 'Zagreb', 'Croatie'],
    [1120, '🇨🇿', 'Prague', 'Tchéquie'], [1170, '🇦🇹', 'Vienne', 'Autriche'], [1230, '🇸🇰', 'Bratislava', 'Slovaquie'],
    [1250, '🇩🇪', 'Berlin', 'Allemagne'], [1280, '🇪🇸', 'Madrid', 'Espagne'], [1400, '🇭🇺', 'Budapest', 'Hongrie'],
    [1450, '🇩🇰', 'Copenhague', 'Danemark'], [1700, '🇵🇱', 'Varsovie', 'Pologne'], [1900, '🇵🇹', 'Lisbonne', 'Portugal'],
  ];
  const SECRETS = [
    [1, '👟', 'Première foulée', 'Le premier kilomètre de l’année. Tout commence ici !'],
    [42, '🌌', '42', 'la réponse à la grande question sur la vie, l’univers et le reste !'],
    [69, '😏', '69', 'on ne dira rien. 😏'],
    [111, '🕚', '11:10', 'ça ne te rappelle pas une certaine heure ? 11:10 ♥'],
    [123, '🚦', '1, 2, 3', '1, 2, 3… partez !'],
    [314.16, '🥧', 'π', '314,16 km : π × 100, un chiffre bien rond !'],
    [404, '🤖', 'Erreur 404', 'erreur 404 : fatigue introuvable.'],
    [666, '😈', 'Diabolique', 'une course diabolique !'],
    [777, '🎰', 'Jackpot', 'jackpot !'],
    [1000, '🚗', 'Mille Bornes', 'comme au Mille Bornes, partie gagnée !'],
    [1110, '💕', 'L’heure parfaite', '11:10, l’heure parfaite, en kilomètres.'],
  ];
  const kmLabel = km => fmtKm(km) + ' km';
  const PRIORITY = { objectif: 100, symbole: 60, secret: 55, course: 50, trajet: 50, europe: 50, regulier: 10 };

  // Tous les trophées de l'année, du plus court au plus long
  function trophies(settings) {
    const s = settings, days = daysInYear(s.annee), list = [];
    const add = (id, cat, km, icon, name, text, big) => list.push({ id, cat, km, icon, name, text, big: !!big });

    COURSES.forEach(([km, icon, name, text], i) => add('c' + i, 'course', km, icon, name, kmLabel(km) + ' : ' + text));
    add('s-semaine', 'symbole', 52, '📅', '1 km par semaine', '52 km : 1 km pour chacune des 52 semaines de l’année !');
    add('s-demi', 'symbole', days / 2, '🌗', 'Un demi-km par jour', kmLabel(days / 2) + ' : 500 m pour chaque jour de l’année !');
    // (si l'objectif est 365, « 1 km par jour » et l'objectif ne font qu'un : la fête de l'objectif reprend la phrase)
    if (s.objectif !== days) add('s-1', 'symbole', days, '☀️', '1 km par jour', kmLabel(days) + ' : 1 km pour chaque jour de l’année ! Ta moyenne d’1 km par jour est assurée.', true);
    add('s-2', 'symbole', days * 2, '✌️', '2 km par jour', kmLabel(days * 2) + ' : 2 km pour chaque jour de l’année !');
    add('s-3', 'symbole', days * 3, '🚀', '3 km par jour', kmLabel(days * 3) + ' : 3 km pour chaque jour de l’année !');
    if (s.objectif !== days) add('s-mi', 'symbole', s.objectif / 2, '🧭', 'À mi-chemin', kmLabel(s.objectif / 2) + ' : la moitié de ton objectif de ' + kmLabel(s.objectif) + ' !');
    TRAJETS.forEach(([km, ville], i) => add('t' + i, 'trajet', km, '🗺️', ville, kmLabel(km) + ' : en courant, tu aurais pu aller de Grenoble à ' + ville + ' !'));
    EUROPE.forEach(([km, flag, ville, pays], i) => add('e' + i, 'europe', km, flag, ville,
      kmLabel(km) + ' : en courant, tu aurais pu aller de Grenoble à ' + ville + (ville === pays ? '' : ' (' + pays + ')') + ' !'));
    add('t-lille', 'trajet', 804.7, '🎵', 'Lille · 500 miles', '804,7 km, soit 500 miles : autant que Grenoble → Lille ! « I would walk 500 miles »… toi, tu les as courus.');
    SECRETS.forEach(([km, icon, name, text], i) => add('x' + i, 'secret', km, icon, name, (km === 1 || text.includes(' km : ') ? '' : kmLabel(km) + ' : ') + text));
    milestones(s.objectif).slice(0, -1).forEach(km =>
      add('r' + km, 'regulier', km, '📍', kmLabel(km), kmLabel(km) + ' ! Plus que ' + kmLabel(s.objectif - km) + ' avant ton objectif.'));
    add('objectif', 'objectif', s.objectif, '🏆', 'Objectif ' + s.annee, kmLabel(s.objectif) + ' en ' + s.annee + ' : objectif atteint !', true);

    return list.sort((a, b) => a.km - b.km || PRIORITY[b.cat] - PRIORITY[a.cat]);
  }

  const alreadyFeted = (t, fetes) => fetes.includes(t.id) || fetes.includes(t.km); // (anciens paliers notés en km)

  // Ceux qu'on vient d'atteindre, jamais fêtés et pas déjà dépassés au départ, du plus important au moins important
  function newTrophies(total, settings, fetes) {
    return trophies(settings)
      .filter(t => t.km > settings.totalDepart && total >= t.km && !alreadyFeted(t, fetes))
      .sort((a, b) => (b.big - a.big) || PRIORITY[b.cat] - PRIORITY[a.cat] || b.km - a.km);
  }

  // Date de déblocage de chaque trophée : 'depart' (déjà dans le total de départ), une date, ou null
  function unlockDates(settings, runs, todayKey) {
    const c = curve(settings, runs, todayKey);
    const yearStart = dayNumber(settings.annee + '-01-01');
    const out = {};
    trophies(settings).forEach(t => {
      if (t.km <= settings.totalDepart) { out[t.id] = 'depart'; return; }
      const p = c.points.find(x => x.total >= t.km);
      out[t.id] = p ? keyOfNumber(yearStart + p.jour) : null;
    });
    return out;
  }

  // Début de la barre de progression : juste avant le total de départ (ou le 1er palier à venir)
  function barStart(settings) {
    const next = milestones(settings.objectif).find(m => m > settings.totalDepart) || settings.objectif;
    const margin = settings.objectif * 0.04;
    return Math.max(0, Math.floor((Math.min(settings.totalDepart, next) - margin) / 10) * 10);
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
  const ID_RE = /^[\w-]{1,40}$/; // identifiant de sortie : lettres, chiffres, tirets (rien d'autre dans la page)

  function cleanSettings(r) {
    if (!r || typeof r !== 'object') return null;
    if (!isNum(r.totalDepart) || r.totalDepart < 0 || r.totalDepart > 100000) return null;
    if (!isValidKey(r.dateDepart)) return null;
    if (!isNum(r.objectif) || r.objectif <= 0 || r.objectif > 100000) return null;
    if (!Number.isInteger(r.annee) || r.annee < 2000 || r.annee > 2200) return null;
    const spw = Number.isInteger(r.sortiesParSemaine) && r.sortiesParSemaine >= 1 && r.sortiesParSemaine <= 14 ? r.sortiesParSemaine : 2;
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
      if (typeof r.id !== 'string' || !ID_RE.test(r.id) || seen.has(r.id)) return;
      if (!isValidKey(r.date) || !isNum(r.km) || r.km <= 0 || r.km > 100) return;
      seen.add(r.id);
      out.sorties.push({ id: r.id, date: r.date, km: r.km });
    });
    // trophées déjà fêtés : leur identifiant (ou, pour les anciens paliers, leur km)
    out.paliersFetes = (Array.isArray(obj.paliersFetes) ? obj.paliersFetes : [])
      .filter(v => isNum(v) || (typeof v === 'string' && ID_RE.test(v)));
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
    defaultSettings, milestones, compute, curve, barStart,
    trophies, newTrophies, unlockDates,
    parseKm, checkDate, MESSAGES,
    emptyData, cleanData, cleanSettings, mergeData, newId,
    fmtKm, fmtKmJour,
  };
});
