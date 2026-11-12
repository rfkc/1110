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
      ville: 'Grenoble',
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

  /* ---------- Trophées ---------- */
  // cat : exploit, course (courses mythiques), symbole, trajet (France), europe, secret, regulier, objectif
  // alix : réservé à Alix (11:10 débloqué)
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
    [804.7, '🎵', '500 miles', 'soit 500 miles ! « I would walk 500 miles »… toi, tu les as courus.'],
  ];

  // Villes de départ possibles : [latitude, longitude]
  const VILLES = {
    'Aix-en-Provence': [43.530, 5.447], 'Ajaccio': [41.919, 8.738], 'Amiens': [49.894, 2.296], 'Angers': [47.478, -0.563],
    'Annecy': [45.899, 6.129], 'Avignon': [43.949, 4.806], 'Bayonne': [43.493, -1.475], 'Besançon': [47.238, 6.024],
    'Bordeaux': [44.838, -0.579], 'Brest': [48.390, -4.486], 'Caen': [49.183, -0.371], 'Chambéry': [45.564, 5.918],
    'Chamonix': [45.924, 6.869], 'Clermont-Ferrand': [45.778, 3.087], 'Dijon': [47.322, 5.041], 'Gap': [44.559, 6.079],
    'Genève': [46.204, 6.143], 'Grenoble': [45.188, 5.724], 'La Rochelle': [46.160, -1.151], 'Lausanne': [46.520, 6.633],
    'Le Havre': [49.494, 0.108], 'Le Mans': [48.006, 0.199], 'Lille': [50.629, 3.057], 'Limoges': [45.834, 1.262],
    'Lyon': [45.764, 4.836], 'Marseille': [43.296, 5.370], 'Metz': [49.120, 6.176], 'Montpellier': [43.611, 3.877],
    'Mulhouse': [47.750, 7.336], 'Nancy': [48.692, 6.184], 'Nantes': [47.218, -1.554], 'Nice': [43.710, 7.262],
    'Nîmes': [43.837, 4.360], 'Orléans': [47.903, 1.909], 'Paris': [48.857, 2.352], 'Pau': [43.295, -0.371],
    'Perpignan': [42.699, 2.895], 'Poitiers': [46.580, 0.340], 'Reims': [49.258, 4.032], 'Rennes': [48.117, -1.678],
    'Rouen': [49.443, 1.099], 'Saint-Étienne': [45.440, 4.387], 'Strasbourg': [48.573, 7.752], 'Toulon': [43.124, 5.928],
    'Toulouse': [43.605, 1.444], 'Tours': [47.394, 0.685], 'Valence': [44.933, 4.892], 'Voiron': [45.364, 5.589],
  };
  const DEFAULT_VILLE = 'Grenoble';

  // Destinations en France (depuis la ville de chacun), puis Chambéry et Sainte-Sigolène pour Alix
  const FRANCE = [
    ['Paris', 48.857, 2.352], ['Lyon', 45.764, 4.836], ['Marseille', 43.296, 5.370], ['Toulouse', 43.605, 1.444],
    ['Nice', 43.710, 7.262], ['Nantes', 47.218, -1.554], ['Montpellier', 43.611, 3.877], ['Strasbourg', 48.573, 7.752],
    ['Bordeaux', 44.838, -0.579], ['Lille', 50.629, 3.057], ['Rennes', 48.117, -1.678], ['Brest', 48.390, -4.486],
    ['Biarritz', 43.483, -1.559], ['Chamonix', 45.924, 6.869], ['Mont-Saint-Michel', 48.636, -1.511],
  ];
  const FRANCE_ALIX = [['Chambéry', 45.564, 5.918], ['Sainte-Sigolène', 45.243, 4.234]];
  // Capitales (et Barcelone) qu'on peut rejoindre à pied
  const EUROPE = [
    ['🇨🇭', 'Berne', 'Suisse', 46.948, 7.447], ['🇲🇨', 'Monaco', 'Monaco', 43.738, 7.424],
    ['🇱🇮', 'Vaduz', 'Liechtenstein', 47.141, 9.521], ['🇦🇩', 'Andorre-la-Vieille', 'Andorre', 42.506, 1.522],
    ['🇱🇺', 'Luxembourg', 'Luxembourg', 49.611, 6.130], ['🇪🇸', 'Barcelone', 'Espagne', 41.385, 2.173],
    ['🇸🇲', 'Saint-Marin', 'Saint-Marin', 43.936, 12.447], ['🇧🇪', 'Bruxelles', 'Belgique', 50.850, 4.352],
    ['🇸🇮', 'Ljubljana', 'Slovénie', 46.056, 14.506], ['🇮🇹', 'Rome', 'Italie', 41.903, 12.496],
    ['🇳🇱', 'Amsterdam', 'Pays-Bas', 52.370, 4.895], ['🇭🇷', 'Zagreb', 'Croatie', 45.815, 15.982],
    ['🇨🇿', 'Prague', 'Tchéquie', 50.075, 14.438], ['🇦🇹', 'Vienne', 'Autriche', 48.208, 16.374],
    ['🇸🇰', 'Bratislava', 'Slovaquie', 48.149, 17.107], ['🇩🇪', 'Berlin', 'Allemagne', 52.520, 13.405],
    ['🇪🇸', 'Madrid', 'Espagne', 40.417, -3.704], ['🇭🇺', 'Budapest', 'Hongrie', 47.498, 19.040],
    ['🇩🇰', 'Copenhague', 'Danemark', 55.676, 12.568], ['🇵🇱', 'Varsovie', 'Pologne', 52.230, 21.012],
    ['🇵🇹', 'Lisbonne', 'Portugal', 38.722, -9.139],
  ];

  // Distance à vol d'oiseau entre deux points (km)
  function distance(lat1, lon1, lat2, lon2) {
    const rad = x => x * Math.PI / 180;
    const a = Math.sin(rad(lat2 - lat1) / 2) ** 2
      + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
    return Math.round(2 * 6371 * Math.asin(Math.sqrt(a)));
  }

  // Kilomètres secrets : [km, icône, nom, phrase, réservé à Alix]
  const SECRETS = [
    [1, '👟', 'Première foulée', 'Le premier kilomètre de l’année. Tout commence ici !'],
    [42, '🌌', '42', 'la réponse à la grande question sur la vie, l’univers et le reste !'],
    [69, '😏', '69', 'on ne dira rien. 😏'],
    [111, '🕚', '11:10', 'ça ne te rappelle pas une certaine heure ? 11:10 ♥', true],
    [123, '🚦', '1, 2, 3', '1, 2, 3… partez !'],
    [314.16, '🥧', 'π', '314,16 km : π × 100, un chiffre bien rond !'],
    [404, '🤖', 'Erreur 404', 'erreur 404 : fatigue introuvable.'],
    [666, '😈', 'Diabolique', 'une course diabolique !'],
    [777, '🎰', 'Jackpot', 'jackpot !'],
    [1000, '🚗', 'Mille Bornes', 'comme au Mille Bornes, partie gagnée !'],
    [1110, '💕', 'L’heure parfaite', '11:10, l’heure parfaite, en kilomètres.', true],
    [7, '🕶️', '007', '7 km : 007, Bond, James Bond.'],
    [88, '⚡', 'Retour vers le futur', '88 km… Retour vers le futur !'],
    [99, '😬', '99', 'si près de 100…'],
    [101, '🐶', '101 Dalmatiens', '101 km : un par dalmatien !'],
    [360, '🔄', '360', 'un tour complet !'],
    [747, '✈️', '747', 'décollage !'],
    [911, '🏎️', '911', 'comme la Porsche !'],
    [999, '😬', '999', 'à un cheveu des 1 000…'],
    [1024, '🤓', '1 024', '1 kilo-octet de kilomètres.'],
    [1111, '✨', '1 111', 'que des 1 : fais un vœu !'],
    [1234, '🎵', '1 234', '1, 2, 3, 4…'],
    [1492, '⛵', '1 492', 'comme Christophe Colomb, cap sur l’Amérique !'],
    [1664, '🍺', '1 664', 'une bière bien méritée !'],
    [1789, '🇫🇷', '1 789', 'la Révolution !'],
    [1969, '🌕', '1 969', 'un petit pas pour l’homme…'],
    [1998, '⚽', '1 998', 'et 1, et 2, et 3-0 !'],
    [2000, '🎉', 'L’an 2000', 'bienvenue dans l’an 2000 !'],
  ];

  // Dates spéciales (secrètes) : une sortie notée ce jour-là. [mois-jour, icône, nom, phrase, Alix]
  const DATES = [
    ['01-01', '🥂', 'Bonne résolution', 'Une sortie le 1er janvier : bonne résolution tenue !'],
    ['02-14', '💘', 'Saint-Valentin', 'Une course pour la Saint-Valentin !'],
    ['02-29', '🐸', 'Bissextile', 'Une sortie un 29 février : ça n’arrive que tous les 4 ans !'],
    ['04-01', '🐟', 'Poisson d’avril', 'Poisson d’avril… et pourtant, tu as vraiment couru !'],
    ['vendredi13', '🐈‍⬛', 'Vendredi 13', 'Une sortie un vendredi 13 : même pas peur !'],
    ['06-21', '🎸', 'Fête de la musique', 'Une course pour la fête de la musique !'],
    ['07-14', '🎆', '14 juillet', 'Une course pour le 14 juillet, avant le feu d’artifice !'],
    ['10-31', '🎃', 'Halloween', 'Une sortie pour Halloween : bouh !'],
    ['12-23', '👑', 'Anniversaire du boss', 'Le 23 décembre, c’est l’anniversaire de Rémi, le boss, le roi. Joyeux anniversaire au roi ! 🎂'],
    ['12-25', '🎄', 'Lutin coureur', 'Une sortie le jour de Noël : lutin coureur !'],
    ['12-31', '🎇', 'Dernière foulée', 'Une sortie le 31 décembre : dernière foulée de l’année !'],
    ['10-11', '🎂', 'Course d’anniversaire', 'Une course le jour de ton anniversaire ! Bon anniv ma vie ♥', true],
    ['04-13', '💞', 'Notre jour', 'Une course le 13 avril, notre jour ♥', true],
  ];
  const kmLabel = km => fmtKm(km) + ' km';
  const PRIORITY = { objectif: 100, symbole: 60, secret: 55, exploit: 52, course: 50, trajet: 50, europe: 50, regulier: 10 };

  // Exploits : liés aux sorties elles-mêmes (pas au total). [id, icône, nom, phrase]
  const EXPLOITS = [
    ['p-1', '🎯', 'Première sortie', 'Ta première sortie notée dans l’app. C’est parti !'],
    ['p-10', '🔟', '10 sorties', '10 sorties cette année !'],
    ['p-50', '🎖️', '50 sorties', '50 sorties cette année, quelle régularité !'],
    ['p-100', '💯', '100 sorties', '100 sorties cette année. Respect !'],
    ['p-10km', '🏃', '10 km d’un coup', 'Une sortie de 10 km ou plus !'],
    ['p-semi', '🥈', 'Semi d’un coup', 'Un semi-marathon (21,1 km) en une seule sortie !'],
    ['p-marathon', '🥇', 'Marathon d’un coup', 'Un marathon (42,2 km) en une seule sortie. Énorme !'],
    ['p-semaine', '✅', 'Semaine bouclée', 'Objectif de la semaine atteint !'],
    ['p-3semaines', '🔥', '3 semaines d’affilée', 'Objectif de la semaine atteint 3 semaines de suite !'],
    ['p-retour', '🔁', 'Retour dans les temps', 'Tu étais en retard, te voilà en avance !'],
    ['p-weekend', '🗓️', 'Week-end complet', 'Une sortie le samedi et une le dimanche !'],
    ['p-1110', '🕚', '11:10 en une sortie', 'Une sortie de 11,1 km pile : 11:10 ♥', true],
  ];

  const villeOf = s => (VILLES[s.ville] ? s.ville : DEFAULT_VILLE);

  // Tous les trophées de l'année, du plus court au plus long (les exploits et les dates à la fin)
  // opts.alix : ajoute ce qui est réservé à Alix (11:10 débloqué)
  function trophies(settings, opts = {}) {
    const s = settings, days = daysInYear(s.annee), list = [], alix = !!opts.alix;
    const add = (id, cat, km, icon, name, text, big, extra) => list.push(Object.assign({ id, cat, km, icon, name, text, big: !!big }, extra));

    EXPLOITS.forEach(([id, icon, name, text, perso]) => { if (!perso || alix) add(id, 'exploit', null, icon, name, text); });
    COURSES.forEach(([km, icon, name, text], i) => add('c' + i, 'course', km, icon, name, kmLabel(km) + ' : ' + text));
    add('s-semaine', 'symbole', 52, '📅', '1 km par semaine', '52 km : 1 km pour chacune des 52 semaines de l’année !');
    add('s-demi', 'symbole', days / 2, '🌗', 'Un demi-km par jour', kmLabel(days / 2) + ' : 500 m pour chaque jour de l’année !');
    // (si l'objectif est 365, « 1 km par jour » et l'objectif ne font qu'un : la fête de l'objectif reprend la phrase)
    if (s.objectif !== days) add('s-1', 'symbole', days, '☀️', '1 km par jour', kmLabel(days) + ' : 1 km pour chaque jour de l’année ! Ta moyenne d’1 km par jour est assurée.', true);
    add('s-2', 'symbole', days * 2, '✌️', '2 km par jour', kmLabel(days * 2) + ' : 2 km pour chaque jour de l’année !');
    add('s-3', 'symbole', days * 3, '🚀', '3 km par jour', kmLabel(days * 3) + ' : 3 km pour chaque jour de l’année !');
    if (s.objectif !== days) add('s-mi', 'symbole', s.objectif / 2, '🧭', 'À mi-chemin', kmLabel(s.objectif / 2) + ' : la moitié de ton objectif de ' + kmLabel(s.objectif) + ' !');
    // Trajets à vol d'oiseau depuis la ville de départ (on saute les villes à moins de 15 km)
    const ville = villeOf(s), [lat, lon] = VILLES[ville];
    const trip = (id, cat, icon, nom, dlat, dlon, pays) => {
      const km = distance(lat, lon, dlat, dlon);
      if (km < 15) return;
      add(id, cat, km, icon, nom, kmLabel(km) + ' à vol d’oiseau : en courant, tu aurais pu aller de ' + ville + ' à ' + nom
        + (pays && pays !== nom ? ' (' + pays + ')' : '') + ' !');
    };
    FRANCE.forEach(([nom, dlat, dlon], i) => trip('f' + i, 'trajet', '🗺️', nom, dlat, dlon));
    if (alix) FRANCE_ALIX.forEach(([nom, dlat, dlon], i) => trip('a' + i, 'trajet', '💗', nom, dlat, dlon));
    EUROPE.forEach(([flag, nom, pays, dlat, dlon], i) => trip('e' + i, 'europe', flag, nom, dlat, dlon, pays));

    SECRETS.forEach(([km, icon, name, text, perso], i) => {
      if (!perso || alix) add('x' + i, 'secret', km, icon, name, (km === 1 || /^\d/.test(text) ? '' : kmLabel(km) + ' : ') + text);
    });
    DATES.forEach(([jour, icon, name, text, perso], i) => { if (!perso || alix) add('d' + i, 'secret', null, icon, name, text, false, { jour }); });
    milestones(s.objectif).slice(0, -1).forEach(km =>
      add('r' + km, 'regulier', km, '📍', kmLabel(km), kmLabel(km) + ' ! Plus que ' + kmLabel(s.objectif - km) + ' avant ton objectif.'));
    add('objectif', 'objectif', s.objectif, '🏆', 'Objectif ' + s.annee, kmLabel(s.objectif) + ' en ' + s.annee + ' : objectif atteint !', true);

    const kmOf = t => (t.km === null ? Infinity : t.km);
    return list.sort((a, b) => kmOf(a) - kmOf(b) || PRIORITY[b.cat] - PRIORITY[a.cat]);
  }

  const alreadyFeted = (t, fetes) => fetes.includes(t.id) || (t.km !== null && fetes.includes(t.km)); // (anciens paliers notés en km)

  // Ceux qu'on vient de débloquer et jamais fêtés (pas ceux déjà dans le total de départ),
  // du plus important au moins important
  function newTrophies(settings, runs, todayKey, fetes, opts = {}) {
    const dates = unlockDates(settings, runs, todayKey, opts);
    return trophies(settings, opts)
      .filter(t => dates[t.id] && dates[t.id] !== 'depart' && !alreadyFeted(t, fetes))
      .sort((a, b) => (b.big - a.big) || PRIORITY[b.cat] - PRIORITY[a.cat] || (b.km || 0) - (a.km || 0));
  }

  // Les sorties qui comptent (année, à partir du départ), dans l'ordre des dates
  function countedRuns(s, runs, todayKey) {
    const start = Math.max(dayNumber(s.dateDepart), dayNumber(s.annee + '-01-01'));
    const end = Math.min(dayNumber(s.annee + '-12-31'), dayNumber(todayKey));
    return runs.map((r, i) => ({ r, i, n: dayNumber(r.date) }))
      .filter(x => x.n >= start && x.n <= end)
      .sort((a, b) => a.n - b.n || a.i - b.i)
      .map(x => x.r);
  }

  // Date à laquelle chaque exploit a été réussi (ou absent s'il ne l'est pas encore)
  function exploitDates(s, runs, todayKey) {
    const out = {};
    const list = countedRuns(s, runs, todayKey);
    const firstWhere = (id, test) => { const r = list.find(test); if (r) out[id] = r.date; };
    [[1, 'p-1'], [10, 'p-10'], [50, 'p-50'], [100, 'p-100']].forEach(([n, id]) => { if (list[n - 1]) out[id] = list[n - 1].date; });
    firstWhere('p-10km', r => r.km >= 10);
    firstWhere('p-semi', r => r.km >= 21.0975);
    firstWhere('p-marathon', r => r.km >= 42.195);
    firstWhere('p-1110', r => r.km === 11.1);
    if (!list.length) return out;

    // Week-end complet : une sortie un samedi et une le lendemain
    const days = new Set(list.map(r => dayNumber(r.date)));
    const sunday = [...days].sort((a, b) => a - b).find(n => weekday(keyOfNumber(n)) === 6 && days.has(n - 1));
    if (sunday !== undefined) out['p-weekend'] = keyOfNumber(sunday);

    // Semaines bouclées (et 3 d'affilée) : le jour où le total de la semaine atteint sa cible
    const today = dayNumber(todayKey), yearEnd = dayNumber(s.annee + '-12-31');
    const last = Math.min(today, yearEnd);
    const start = Math.max(dayNumber(s.dateDepart), dayNumber(s.annee + '-01-01'));
    let streak = 0;
    for (let monday = start - (start + 3) % 7; monday <= last; monday += 7) {
      const end = Math.min(monday + 6, last);
      const w = compute(s, runs, keyOfNumber(end)).semaine;
      let reached = null;
      if (w && w.atteinte) {
        let sum = 0;
        for (const r of list) {
          const n = dayNumber(r.date);
          if (n < Math.max(monday, start) || n > end) continue;
          sum += r.km;
          if (sum >= w.cible - 0.05) { reached = r.date; break; }
        }
        reached = reached || keyOfNumber(Math.max(monday, start));
      }
      if (reached) {
        if (!out['p-semaine']) out['p-semaine'] = reached;
        if (++streak === 3 && !out['p-3semaines']) out['p-3semaines'] = reached;
      } else if (monday + 6 <= last) {
        streak = 0; // semaine finie sans atteindre la cible (la semaine en cours ne casse pas la série)
      }
    }

    // Retour dans les temps : en retard un jour, puis en avance (même règle que la boussole)
    const pace = s.objectif / daysInYear(s.annee), yearStart = dayNumber(s.annee + '-01-01');
    const perDay = {};
    list.forEach(r => { const n = dayNumber(r.date); perDay[n] = (perDay[n] || 0) + r.km; });
    let total = s.totalDepart, behind = false;
    for (let n = start; n <= last; n++) {
      const ref = pace * (n - yearStart);
      if (round(total - ref, 1) < 0) behind = true;
      total += perDay[n] || 0;
      if (behind && perDay[n] && round(total - ref, 1) >= 0) { out['p-retour'] = keyOfNumber(n); break; }
    }
    return out;
  }

  // Date de déblocage de chaque trophée : 'depart' (déjà dans le total de départ), une date, ou null
  function unlockDates(settings, runs, todayKey, opts = {}) {
    const s = settings;
    const c = curve(s, runs, todayKey);
    const yearStart = dayNumber(s.annee + '-01-01');
    const exploits = exploitDates(s, runs, todayKey);
    const list = countedRuns(s, runs, todayKey);
    const out = {};
    trophies(s, opts).forEach(t => {
      if (t.cat === 'exploit') { out[t.id] = exploits[t.id] || null; return; }
      if (t.jour) {
        const r = list.find(x => (t.jour === 'vendredi13'
          ? x.date.slice(8) === '13' && weekday(x.date) === 4
          : x.date.slice(5) === t.jour));
        out[t.id] = r ? r.date : null;
        return;
      }
      if (t.km <= s.totalDepart) { out[t.id] = 'depart'; return; }
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
    const ville = typeof r.ville === 'string' && VILLES[r.ville] ? r.ville : DEFAULT_VILLE;
    return { totalDepart: r.totalDepart, dateDepart: r.dateDepart, objectif: r.objectif, annee: r.annee, sortiesParSemaine: spw, ville };
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
    trophies, newTrophies, unlockDates, VILLES, DEFAULT_VILLE, distance,
    parseKm, checkDate, MESSAGES,
    emptyData, cleanData, cleanSettings, mergeData, newId,
    fmtKm, fmtKmJour,
  };
});
