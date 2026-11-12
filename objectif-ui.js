/* ============================================================
   11:10 — Objectif 365 : l'écran
   Les calculs sont dans objectif.js ; ici, on affiche et on réagit aux gestes.
   Utilise les petits outils d'app.js : $, todayKey, dateOf, ask, toast, rainHearts…
   Les données sont dans leur propre clé : celles de 11:10 ne sont jamais touchées.
   ============================================================ */
'use strict';

const O = window.Objectif;
const OBJ_KEY = TEST_DAY ? '1110.test.objectif365' : '1110.objectif365';

/* ---------- Stockage ---------- */
function objLoad() {
  try {
    const raw = localStorage.getItem(OBJ_KEY);
    return O.cleanData(raw ? JSON.parse(raw) : null);
  } catch (e) {
    return O.emptyData();
  }
}

function objSave() {
  try {
    localStorage.setItem(OBJ_KEY, JSON.stringify(obj));
  } catch (e) {
    toast("Impossible d'enregistrer sur ce téléphone");
  }
}

let obj = objLoad();

// Pour la sauvegarde (export / import) gérée par app.js
function objExportData() { return obj; }
function objImportData(incoming) {
  const res = O.mergeData(obj, incoming);
  obj = res.data;
  objSave();
  return res.ajoutees;
}

/* ---------- Petits outils ---------- */
const fmtKm = O.fmtKm;
const fmtKmJour = O.fmtKmJour;
const fmtDayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const fmtRunDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtWeekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' });
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const kmText = km => String(km).replace('.', ','); // 5.25 → "5,25" (pour la modifier)
const pluralS = (n, word) => n + ' ' + word + (n > 1 ? 's' : '');

// "5,2" → 5.2 ; renvoie NaN si ce n'est pas un nombre
function parseNum(text) {
  const t = String(text || '').trim().replace(/\s/g, '').replace(',', '.');
  return /^\d*\.?\d+$|^\d+\.$/.test(t) ? Number(t) : NaN;
}

// Fait défiler un nombre jusqu'à sa nouvelle valeur (≈ 0,9 s)
function tween(el, from, to, fmt) {
  if (el._raf) cancelAnimationFrame(el._raf);
  clearTimeout(el._end);
  if (from === to || !isFinite(from) || !isFinite(to) || reduceMotion() || document.hidden) {
    el.textContent = fmt(to);
    return;
  }
  const t0 = performance.now(), dur = 900;
  const step = t => {
    const p = Math.min(1, Math.max(0, (t - t0) / dur));
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (p < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
  // filet de sécurité : la bonne valeur s'affiche quoi qu'il arrive
  el._end = setTimeout(() => { cancelAnimationFrame(el._raf); el.textContent = fmt(to); }, dur + 150);
}

/* ---------- Navigation (appelée par showScreen dans app.js) ---------- */
function objRoute(name) {
  if (!name.startsWith('obj')) return name;
  if (!obj.reglages) return 'obj-welcome';
  return name === 'obj-welcome' ? 'obj' : name;
}

function objAfterShow(name) {
  updateDock();
  if (name === 'obj-settings') objFillSettings();
  if (name === 'obj-welcome') welcomeShow();
}

// La saisie rapide n'apparaît que sur le Suivi (et pas une fois l'année finie)
function updateDock() {
  const r = obj.reglages ? O.compute(obj.reglages, obj.sorties, todayKey()) : null;
  const show = view.space === '365' && view['365'] === 'obj' && r && !r.anneeFinie;
  $('#o-dock').hidden = !show;
  document.documentElement.classList.toggle('has-dock', !!show);
}

/* ============================================================
   Affichage du suivi
   ============================================================ */
let objLast = null;      // derniers chiffres affichés (pour les faire défiler)
let objFreshId = null;   // sortie qui vient d'être ajoutée (petite animation)

function objRender(opts = {}) {
  if (!obj.reglages) return;
  const s = obj.reglages;
  const today = todayKey();
  const r = O.compute(s, obj.sorties, today);
  const from = opts.animate ? objLast : null;

  renderMood(r, s, today, from);
  renderWeek(r, today, from);
  renderFacts(r);
  renderChart(s, today);
  renderRecent();
  renderRunsList();
  renderTrophies();

  objLast = {
    total: r.total, kmParJour: r.kmParJour, ecart: r.ecart, retard: -r.ecart, depassement: r.depassement,
    week: r.semaine ? (r.semaine.atteinte ? r.semaine.avance : r.semaine.reste) : 0,
  };
  objFreshId = null;
  renderDateChip();
  updateDock();
}

function renderMood(r, s, today, from) {
  const mood = $('#o-mood');
  let tone, humeur, lead;
  if (r.anneeFinie) {
    tone = 'done'; humeur = 'Bilan ' + s.annee;
    lead = 'Année ' + s.annee + ' bouclée&nbsp;: <em><span data-n="total">' + fmtKm(r.total) + '</span>&nbsp;km</em>. Bravo pour chaque kilomètre&nbsp;!';
  } else if (r.atteint) {
    tone = 'done'; humeur = 'Bravo !';
    lead = 'Objectif atteint&nbsp;! <em><span data-n="total">' + fmtKm(r.total) + '</span>&nbsp;km</em>'
      + (r.depassement >= 0.05 ? ', dépassé de <span data-n="depassement">' + fmtKm(r.depassement) + '</span>&nbsp;km.' : '.');
  } else {
    tone = r.enAvance ? 'ok' : 'warn';
    humeur = r.enAvance ? 'Dans les temps' : 'Un peu de retard';
    lead = 'Il te reste <em><span data-n="kmParJour" data-f="j">' + fmtKmJour(r.kmParJour) + '</span>&nbsp;km</em> par jour. ';
    if (r.ecart > 0) lead += 'Tu as <span data-n="ecart">' + fmtKm(r.ecart) + '</span>&nbsp;km d’avance&nbsp;!';
    else if (r.ecart === 0) lead += 'Pile dans les temps&nbsp;!';
    else lead += '<span data-n="retard">' + fmtKm(-r.ecart) + '</span>&nbsp;km à rattraper, ça se fait&nbsp;!';
  }
  mood.classList.toggle('warn', tone === 'warn');
  mood.classList.toggle('done', tone === 'done');
  $('#o-kicker').textContent = cap(fmtDayLong.format(dateOf(today))) + ' · ' + humeur;
  $('#o-wm').textContent = String(Math.round(s.objectif)); // l'objectif, en filigrane (sans espace : 1000)

  const leadEl = $('#o-lead');
  leadEl.innerHTML = lead;
  if (from) {
    leadEl.querySelectorAll('[data-n]').forEach(el => {
      const k = el.dataset.n;
      const to = { total: r.total, kmParJour: r.kmParJour, ecart: r.ecart, retard: -r.ecart, depassement: r.depassement }[k];
      tween(el, from[k], to, el.dataset.f === 'j' ? fmtKmJour : fmtKm);
    });
  }

  // La barre et ses paliers
  const lo = O.barStart(s);
  const hi = Math.max(s.objectif, r.total);
  const pos = km => Math.max(0, Math.min(100, (km - lo) / (hi - lo) * 100));
  const p = pos(r.total) + '%';
  $('#o-fill').style.width = p;
  $('#o-knob').style.left = p;

  // on garde les paliers assez espacés pour rester lisibles (l'objectif d'abord)
  const shown = [];
  r.paliers.filter(m => m >= lo).reverse().forEach(m => {
    if (shown.every(x => Math.abs(pos(x) - pos(m)) >= 11)) shown.push(m);
  });
  $('#o-flags').innerHTML = shown.reverse().map(m =>
    '<span class="' + (r.total >= m ? 'reached' : '') + (m === s.objectif ? ' last' : '') + '" style="left:' + pos(m) + '%">'
    + fmtKm(m) + (m === s.objectif ? ' ♥' : '') + '</span>'
  ).join('');

  const totalEl = $('#o-total');
  if (from) tween(totalEl, from.total, r.total, fmtKm); else totalEl.textContent = fmtKm(r.total);
  $('#o-goal').textContent = fmtKm(s.objectif);
  $('#o-left').textContent = r.atteint || r.anneeFinie ? '' : fmtKm(r.kmRestants) + ' km · ' + pluralS(r.joursRestants, 'jour');
}

function renderWeek(r, today, from) {
  const card = $('#o-week');
  const w = r.semaine;
  card.hidden = !w || r.atteint || r.anneeFinie;
  if (card.hidden) return;

  const finDay = fmtWeekday.format(dateOf(w.fin));
  card.classList.toggle('reached', w.atteinte);
  $('#o-week-label').textContent = w.atteinte ? 'Objectif de la semaine'
    : w.kmSemaine === 0 ? 'À faire d’ici ' + finDay : 'Reste d’ici ' + finDay;

  const v = $('#o-week-v');
  const value = w.atteinte ? w.avance : w.reste;
  const fmt = w.atteinte ? (n => '+' + fmtKm(n)) : fmtKm;
  if (from) tween(v, from.week, value, fmt); else v.textContent = fmt(value);

  // Les pastilles : sorties faites (pleines) puis sorties conseillées (pointillés)
  const done = obj.sorties.filter(x => x.date >= w.debut && x.date <= w.fin && x.date >= obj.reglages.dateDepart)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const rem = w.atteinte ? 0 : w.sortiesRestantes;
  const room = Math.max(1, 4 - rem);
  const doneShown = done.slice(-room);
  let pills = '';
  if (done.length > doneShown.length) pills += '<i class="done more">+' + (done.length - doneShown.length) + '</i>';
  pills += doneShown.map(x => '<i class="done"' + (x.id === objFreshId ? '' : ' style="animation:none"') + '>' + fmtKm(x.km) + ' km</i>').join('');
  for (let i = 0; i < rem; i++) pills += '<i>' + fmtKm(w.kmParSortie) + ' km</i>';
  $('#o-pills').innerHTML = pills;

  // La frise L … D
  const monday = O.dayNumber(w.debut) - w.joursAvantDebut;
  const start = O.dayNumber(w.debut), end = O.dayNumber(w.fin);
  const ranDays = new Set(done.map(x => O.dayNumber(x.date)));
  $('#o-days').innerHTML = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => {
    const n = monday + i;
    const cls = [];
    if (n < start || n > end) cls.push('off');
    else if (i === w.jourIndex) cls.push('today');
    else if (i < w.jourIndex) cls.push('past');
    if (ranDays.has(n)) cls.push('ran');
    return '<span class="' + cls.join(' ') + '">' + d + '</span>';
  }).join('');

  let note;
  if (w.atteinte) note = 'Objectif de la semaine atteint, bravo&nbsp;!';
  else if (w.kmSemaine > 0 && w.reste < 1) note = 'Presque bouclée&nbsp;: plus que ' + fmtKm(w.reste) + '&nbsp;km cette semaine';
  else {
    const n = w.sortiesRestantes;
    const conseil = n + ' sortie' + (n > 1 ? 's' : '') + ' de ' + fmtKm(w.kmParSortie) + '&nbsp;km';
    note = w.kmSemaine === 0 ? 'soit ' + conseil : 'Déjà ' + fmtKm(w.kmSemaine) + '&nbsp;km · encore ' + conseil;
  }
  $('#o-week-note').innerHTML = note;
}

function renderFacts(r) {
  const facts = $('#o-facts');
  facts.hidden = r.anneeFinie;
  $('#o-f-left-label').textContent = r.atteint ? 'En plus' : 'Reste';
  $('#o-f-left').textContent = r.atteint ? '+' + fmtKm(r.depassement) + ' km' : fmtKm(r.kmRestants) + ' km';
  $('#o-f-days').textContent = r.joursRestants;
  const proj = $('#o-f-proj');
  if (r.projection !== null) {
    proj.textContent = '≈ ' + fmtKm(Math.round(r.projection)) + ' km';
    proj.classList.remove('soft');
  } else {
    const wait = Math.max(1, 8 - r.joursEcoules);
    proj.textContent = r.joursEcoules > 7 ? 'après 1 sortie' : 'dans ' + wait + ' j';
    proj.classList.add('soft');
  }
}

// La courbe : son total jour après jour face à la ligne « 1 km/jour »
function renderChart(s, today) {
  const c = O.curve(s, obj.sorties, today);
  const pts = c.points;
  const x0 = pts[0].jour, x1 = Math.max(c.dernierJour, x0 + 1);
  const maxT = Math.max.apply(null, pts.map(p => p.total));
  const yLo = Math.floor((Math.min(pts[0].total, c.ligne(x0)) - 5) / 5) * 5;
  const yHi = Math.ceil(Math.max(s.objectif, maxT) + 3);
  const W = 320, H = 150, L = 4, R = 286, T = 12, B = 122;
  const X = j => L + (j - x0) / (x1 - x0) * (R - L);
  const Y = v => B - (v - yLo) / (yHi - yLo) * (B - T);
  const f = n => n.toFixed(1);

  const line = pts.map((p, i) => (i ? 'L' : 'M') + f(X(p.jour)) + ' ' + f(Y(p.total))).join(' ');
  const last = pts[pts.length - 1];
  const area = line + ' L' + f(X(last.jour)) + ' ' + B + ' L' + f(X(x0)) + ' ' + B + 'Z';
  const yearStart = O.dayNumber(s.annee + '-01-01');
  const label = j => fmtDayMonth.format(dateOf(O.keyOfNumber(yearStart + j)));

  $('#o-chart').innerHTML =
    '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Ta courbe : ' + fmtKm(last.total) + ' km, face à la ligne de 1 km par jour">'
    + '<line class="o-axis" x1="' + L + '" y1="' + B + '" x2="' + R + '" y2="' + B + '"/>'
    + '<line class="o-axis" x1="' + L + '" y1="' + f(Y(s.objectif)) + '" x2="' + R + '" y2="' + f(Y(s.objectif)) + '" stroke-dasharray="2 4"/>'
    + '<text x="' + (R + 4) + '" y="' + f(Y(s.objectif) + 3) + '">' + fmtKm(s.objectif) + '</text>'
    + '<path class="o-pace" d="M' + f(X(x0)) + ' ' + f(Y(c.ligne(x0))) + ' L' + f(X(x1)) + ' ' + f(Y(c.ligne(x1))) + '"/>'
    + '<path class="o-me-area" d="' + area + '"/>'
    + '<path class="o-me" d="' + line + '"/>'
    + '<circle cx="' + f(X(last.jour)) + '" cy="' + f(Y(last.total)) + '" r="5" fill="var(--card)" stroke="var(--ring)" stroke-width="2.5"/>'
    + '<text x="' + L + '" y="' + (H - 6) + '">' + label(x0 + 1) + '</text>'
    + '<text x="' + R + '" y="' + (H - 6) + '" text-anchor="end">' + label(c.dernierJour) + '</text>'
    + '</svg>'
    + (!obj.sorties.length ? '<p class="o-empty o-chart-empty">Ta courbe se dessinera au fil de tes sorties.</p>' : '')
    + '<div class="o-legend"><span><i></i>Toi</span><span><i class="pace"></i>' + fmtKmJour(s.objectif / O.daysInYear(s.annee)) + ' km par jour</span></div>';
}

const sortedRuns = () => obj.sorties.slice().sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));

function runRow(x) {
  return '<button type="button" class="o-run' + (x.id === objFreshId ? ' fresh' : '') + '" data-id="' + x.id + '">'
    + '<span>' + cap(fmtRunDay.format(dateOf(x.date))) + '</span><b>' + fmtKm(x.km) + ' km</b></button>';
}

function renderRecent() {
  const runs = sortedRuns();
  $('#o-all').hidden = runs.length <= 3;
  $('#o-recent').innerHTML = runs.length
    ? runs.slice(0, 3).map(runRow).join('')
    : '<p class="o-empty">Ta première sortie s’affichera ici.<br>Note-la juste en dessous, après ta course.</p>';
}

function renderRunsList() {
  const runs = sortedRuns();
  const s = obj.reglages;
  const sum = runs.reduce((a, x) => a + x.km, 0);
  $('#o-runs-sum').textContent = runs.length
    ? pluralS(runs.length, 'sortie') + ' · ' + fmtKm(sum) + ' km depuis le ' + fmtFull.format(dateOf(s.dateDepart))
    : '';
  $('#o-runs-hint').hidden = !runs.length;
  if (!runs.length) {
    $('#o-runs').innerHTML = '<div class="o-empty-big">'
      + '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 34c6 0 9-2 12-7l4-7 6 4c3 2 6 2 9 1l5-2v8c0 3-2 5-5 5H9c-2 0-3-1-3-2z"/><path d="M22 20l3-5"/><path d="M14 38v4M24 38v4M34 38v4"/></svg>'
      + '<p>Pas encore de sortie.<br>Ajoute ta prochaine course depuis l’onglet Suivi.</p></div>';
    return;
  }
  const groups = [];
  runs.forEach(x => {
    const m = x.date.slice(0, 7);
    if (!groups.length || groups[groups.length - 1].m !== m) groups.push({ m, runs: [] });
    groups[groups.length - 1].runs.push(x);
  });
  $('#o-runs').innerHTML = groups.map(g =>
    '<div class="o-month"><h4><span>' + cap(fmtMonth.format(dateOf(g.m + '-01'))) + '</span><span>'
    + fmtKm(g.runs.reduce((a, x) => a + x.km, 0)) + ' km</span></h4>'
    + '<div class="card">' + g.runs.map(runRow).join('') + '</div></div>'
  ).join('');
}

/* ============================================================
   Saisie d'une sortie
   ============================================================ */
let objDate = null; // null = aujourd'hui

function dockDate() { return objDate || todayKey(); }

function renderDateChip() {
  const today = todayKey(), d = dockDate();
  const s = obj.reglages;
  const input = $('#o-date');
  input.max = today;
  if (s) input.min = s.dateDepart > s.annee + '-01-01' ? s.dateDepart : s.annee + '-01-01';
  input.value = d;
  const yesterday = O.keyOfNumber(O.dayNumber(today) - 1);
  $('#o-date-label').textContent = d === today ? 'auj.' : d === yesterday ? 'hier' : fmtDayMonth.format(dateOf(d));
  $('#o-date-label').parentElement.classList.toggle('past', d !== today);
}

function objError(msg, el) {
  toast(msg);
  if (el && !reduceMotion()) {
    el.classList.remove('o-shake');
    void el.offsetWidth;
    el.classList.add('o-shake');
  }
}

function objAdd(e) {
  e.preventDefault();
  const s = obj.reglages;
  const today = todayKey();
  const field = $('#o-add-field');
  const p = O.parseKm($('#o-km').value);
  if (p.erreur) return objError(O.MESSAGES[p.erreur], field);
  const date = dockDate();
  const bad = O.checkDate(date, s, today);
  if (bad) return objError(O.MESSAGES[bad], field);

  const before = O.compute(s, obj.sorties, today);
  const run = { id: O.newId(), date, km: p.km };
  obj.sorties.push(run);
  objSave();
  $('#o-km').value = '';
  $('#o-km').blur();
  objDate = null;
  renderDateChip();
  objFreshId = run.id;
  objRender({ animate: true });

  const after = O.compute(s, obj.sorties, today);
  let msg = '+' + fmtKm(run.km) + ' km';
  if (after.atteint) msg += ' · objectif atteint !';
  else if (after.semaine && after.semaine.atteinte && before.semaine && !before.semaine.atteinte) msg += ' · semaine bouclée !';
  else msg += ' · plus que ' + fmtKmJour(after.kmParJour) + ' km/jour !';
  toast(msg, {
    action: 'Annuler',
    duration: 5000,
    onAction: () => {
      obj.sorties = obj.sorties.filter(x => x.id !== run.id);
      objSave();
      objRender({ animate: true });
      toast('Sortie retirée');
    },
  });
  objCheckMilestones();
}

// Modifier ou supprimer une sortie (touchée dans une liste)
async function objEditRun(id) {
  const run = obj.sorties.find(x => x.id === id);
  if (!run) return;
  const s = obj.reglages;
  const today = todayKey();
  const r = await ask({
    title: 'Modifier la sortie',
    km: kmText(run.km),
    date: run.date,
    dateMin: s.dateDepart,
    dateMax: today,
    buttons: [
      { label: 'Supprimer', value: 'remove', style: 'danger' },
      { label: 'Annuler', value: 'cancel' },
      { label: 'Enregistrer', value: 'save', style: 'primary' },
    ],
  });

  if (r.value === 'remove') {
    const ok = await ask({
      title: 'Supprimer cette sortie ?',
      text: 'La sortie du ' + fmtRunDay.format(dateOf(run.date)) + ' (' + fmtKm(run.km) + ' km) sera retirée, et tous les chiffres recalculés.',
      buttons: [
        { label: 'Garder', value: 'keep' },
        { label: 'Supprimer', value: 'remove', style: 'danger' },
      ],
    });
    if (ok.value !== 'remove') return;
    const index = obj.sorties.indexOf(run);
    obj.sorties.splice(index, 1);
    objSave();
    objRender({ animate: true });
    toast('Sortie supprimée', {
      action: 'Annuler',
      duration: 5000,
      onAction: () => {
        obj.sorties.splice(Math.min(index, obj.sorties.length), 0, run);
        objSave();
        objRender({ animate: true });
      },
    });
    return;
  }

  if (r.value !== 'save') return;
  const p = O.parseKm(r.km);
  if (p.erreur) return objError(O.MESSAGES[p.erreur]);
  const bad = O.checkDate(r.date, s, today);
  if (bad) return objError(O.MESSAGES[bad]);
  if (p.km === run.km && r.date === run.date) return;
  run.km = p.km;
  run.date = r.date;
  objSave();
  objFreshId = run.id;
  objRender({ animate: true });
  toast('Sortie modifiée');
  objCheckMilestones();
}

/* ============================================================
   Trophées : les fêtes (moyenne, ou grande pour l'objectif et « 1 km par jour »)
   ============================================================ */
const CAT_LABEL = { exploit: 'Exploit', course: 'Course mythique', symbole: 'Symbolique', trajet: 'Voyage', europe: 'Voyage en Europe', secret: 'Trophée secret', regulier: 'Palier', objectif: 'Objectif' };

// Les trophées réservés à Alix n'existent que si 11:10 est débloqué
const objOpts = () => ({ alix: isUnlocked() });
const kmTxt = t => (t.km === null ? '' : fmtKm(t.km) + ' km');

function objCheckMilestones() {
  const s = obj.reglages;
  const fresh = O.newTrophies(s, obj.sorties, todayKey(), obj.paliersFetes, objOpts());
  if (!fresh.length) return;
  obj.paliersFetes.push(...fresh.map(t => t.id)); // chacun n'est fêté qu'une fois, même après une suppression
  objSave();
  renderTrophies();
  setTimeout(() => celebrate(fresh), reduceMotion() ? 0 : 900); // après la montée de la barre
}

// Une seule carte, même si la sortie débloque plusieurs trophées d'un coup
function celebrate(list) {
  const s = obj.reglages;
  const main = list[0];                       // le plus important (déjà trié)
  let others = list.slice(1);
  const big = main.big;
  const box = $('#o-party');
  box.classList.toggle('big', big);

  let text = main.text;
  if (main.id === 'objectif') {
    text = 'Tu l’as fait ! ' + fmtKm(s.objectif) + ' km en ' + s.annee + '. Chaque sortie compte, et tu les as toutes faites.';
    if (s.objectif === O.daysInYear(s.annee)) text += ' 1 km pour chaque jour de l’année !';
    text += isUnlocked() ? ' Gros bisous ma vie ♥' : ' Bravo !';
  }

  $('#o-party-kicker').textContent = others.length ? (others.length + 1) + ' trophées débloqués !'
    : main.id === 'objectif' ? 'Objectif ' + s.annee : CAT_LABEL[main.cat];
  $('#o-party-icon').textContent = main.icon;
  $('#o-party-title').textContent = main.km !== null && (main.cat === 'regulier' || main.cat === 'objectif' || main.cat === 'symbole')
    ? fmtKm(main.km) + ' km' : main.name;
  $('#o-party-text').textContent = text;

  const shown = others.slice(0, 4);
  $('#o-party-list').innerHTML = shown.map(t =>
    '<li><span aria-hidden="true">' + t.icon + '</span><b>' + t.name + '</b><em>' + kmTxt(t) + '</em></li>'
  ).join('') + (others.length > shown.length
    ? '<li class="more">+ ' + (others.length - shown.length) + ' autre' + (others.length - shown.length > 1 ? 's' : '') + ' à découvrir dans Trophées</li>' : '');
  $('#o-party-list').hidden = !others.length;

  box.hidden = false;
  rainHearts(big ? 90 : 45);
  if (big) setTimeout(() => rainHearts(50), 1600);
  $('#o-party-ok').focus();
}

/* ---------- L'onglet Trophées ---------- */
function trSections(s) {
  const ville = O.VILLES[s.ville] ? s.ville : O.DEFAULT_VILLE;
  return [
    ['exploit', 'Exploits'],
    ['course', 'Courses mythiques'],
    ['symbole', 'Symboliques'],
    ['trajet', 'Voyages depuis ' + ville],
    ['europe', 'Europe depuis ' + ville],
    ['secret', 'Secrets'],
  ];
}

function trophyState(t, total, dates) {
  const d = dates[t.id];
  if (d) return { on: true, sub: d === 'depart' ? 'au départ' : 'le ' + fmtDayMonth.format(dateOf(d)) };
  return { on: false, sub: t.km === null ? 'à débloquer' : 'encore ' + fmtKm(t.km - total) + ' km' };
}

function renderTrophies() {
  const s = obj.reglages;
  if (!s) return;
  const today = todayKey();
  const total = O.compute(s, obj.sorties, today).total;
  const all = O.trophies(s, objOpts());
  const dates = O.unlockDates(s, obj.sorties, today, objOpts());
  const unlocked = all.filter(t => dates[t.id]).length;
  $('#o-tr-sum').textContent = unlocked + ' trophée' + (unlocked > 1 ? 's' : '') + ' sur ' + all.length + ' en ' + s.annee;

  let html = '<h3 class="o-tr-h">Spéciaux</h3>';
  trSections(s).forEach(([cat, label]) => {
    const list = all.filter(t => t.cat === cat || (cat === 'symbole' && t.cat === 'objectif'));
    if (!list.length) return;
    const n = list.filter(t => dates[t.id]).length;
    html += '<h4 class="o-tr-sub"><span>' + label + '</span><span>' + n + ' / ' + list.length + '</span></h4><div class="o-badges">';
    html += list.map(t => {
      const st = trophyState(t, total, dates);
      const secret = t.cat === 'secret' && !st.on;
      return '<button type="button" class="o-badge' + (st.on ? ' on' : '') + (secret ? ' secret' : '') + '" data-tr="' + t.id + '">'
        + '<span class="o-badge-icon" aria-hidden="true">' + (secret ? '?' : t.icon) + '</span>'
        + '<b>' + (secret ? 'Secret' : t.name) + '</b>'
        + '<span class="o-badge-sub">' + (secret ? '' : kmTxt(t) + (kmTxt(t) && st.sub ? '<br>' : '') + st.sub) + '</span></button>';
    }).join('');
    html += '</div>';
  });

  const reg = all.filter(t => t.cat === 'regulier');
  const next = reg.find(t => !dates[t.id]);
  html += '<h3 class="o-tr-h">Réguliers <small>tous les ' + (reg[1] ? fmtKm(reg[1].km - reg[0].km) : '') + ' km</small></h3><div class="o-regs">'
    + reg.map(t => '<button type="button" class="o-reg' + (dates[t.id] ? ' on' : t === next ? ' next' : '') + '" data-tr="' + t.id + '">' + fmtKm(t.km) + '</button>').join('')
    + '</div>';
  $('#o-trophies').innerHTML = html;
}

// Toucher un trophée : lire sa phrase
function showTrophy(id) {
  const s = obj.reglages;
  const t = O.trophies(s, objOpts()).find(x => x.id === id);
  if (!t) return;
  const today = todayKey();
  const total = O.compute(s, obj.sorties, today).total;
  const st = trophyState(t, total, O.unlockDates(s, obj.sorties, today, objOpts()));
  if (t.cat === 'secret' && !st.on) {
    ask({ title: 'Trophée secret', text: 'Continue de courir pour le découvrir…', buttons: [{ label: 'OK', value: 'ok', style: 'primary' }] });
    return;
  }
  ask({
    title: t.icon + ' ' + t.name,
    text: t.text + '\n\n' + (st.on ? (st.sub === 'au départ' ? 'Déjà dans ton total de départ' : 'Débloqué' + (st.sub ? ' ' + st.sub : '')) : 'Pas encore : ' + st.sub),
    buttons: [{ label: 'OK', value: 'ok', style: 'primary' }],
  });
}

// La carte reste affichée jusqu'à ce qu'elle touche « Continuer »
function closeParty() {
  $('#o-party').hidden = true;
}

/* ============================================================
   Bienvenue : 3 petites étapes
   ============================================================ */
let wStep = 1;

function welcomeShow() {
  const today = todayKey();
  if (!$('#w-date').value) $('#w-date').value = today;
  $('#w-date').max = today;
  if (!$('#w-goal').value) $('#w-goal').value = '365';
  if (!$('#w-year').value) $('#w-year').value = today.slice(0, 4);
  welcomeStep(wStep);
}

function welcomeStep(n) {
  wStep = n;
  document.querySelectorAll('.o-step').forEach(el => { el.hidden = Number(el.dataset.step) !== n; });
  document.querySelectorAll('#o-steps i').forEach((el, i) => el.classList.toggle('on', i === n - 1));
  $('#w-next').textContent = n === 3 ? 'C’est parti !' : 'Suivant';
  $('#w-back').hidden = n === 1;
  $('#main').scrollTop = 0;
}

// Lit et vérifie les réglages d'un formulaire ; renvoie { reglages } ou { erreur }
function readSettings(ids) {
  const today = todayKey();
  const raw = $(ids.total).value.trim();
  const total = raw === '' ? 0 : parseNum(raw);
  if (!(total >= 0 && total <= 100000)) return { erreur: 'Le total : un nombre, par exemple 295', el: ids.total };
  const date = $(ids.date).value;
  if (!O.isValidKey(date)) return { erreur: 'Choisis la date de ce total', el: ids.date };
  if (date > today) return { erreur: "Cette date n'est pas encore arrivée", el: ids.date };
  const goal = parseNum($(ids.goal).value);
  if (!(goal > 0 && goal <= 100000)) return { erreur: "L'objectif : un nombre, par exemple 365", el: ids.goal };
  const year = Number($(ids.year).value.trim());
  if (!Number.isInteger(year) || year < 2000 || year > 2200) return { erreur: "L'année : par exemple " + today.slice(0, 4), el: ids.year };
  if (Number(date.slice(0, 4)) > year) return { erreur: "La date du total doit être dans l'année " + year, el: ids.date };
  const runs = Number($(ids.runs).value);
  const ville = O.VILLES[$(ids.ville).value] ? $(ids.ville).value : O.DEFAULT_VILLE;
  return { reglages: { totalDepart: total, dateDepart: date, objectif: goal, annee: year, sortiesParSemaine: runs, ville } };
}

const W_IDS = { total: '#w-total', date: '#w-date', goal: '#w-goal', year: '#w-year', runs: '#w-runs', ville: '#w-ville' };
const S_IDS = { total: '#s-total', date: '#s-date', goal: '#s-goal', year: '#s-year', runs: '#s-runs', ville: '#s-ville' };

// Les listes de villes (bienvenue et réglages)
function fillVilles() {
  const names = Object.keys(O.VILLES).sort((a, b) => a.localeCompare(b, 'fr'));
  document.querySelectorAll('[data-villes]').forEach(sel => {
    sel.innerHTML = names.map(n => '<option value="' + n + '">' + n + '</option>').join('');
    sel.value = O.DEFAULT_VILLE;
  });
}

function welcomeNext() {
  const res = readSettings(W_IDS);
  if (res.erreur) {
    const onStep = { '#w-total': 1, '#w-date': 1, '#w-goal': 2, '#w-year': 2 }[res.el];
    if (onStep <= wStep) {
      if (onStep < wStep) welcomeStep(onStep);
      return objError(res.erreur, $(res.el).closest('.o-input'));
    }
  }
  if (wStep < 3) return welcomeStep(wStep + 1);

  obj.reglages = res.reglages;
  obj.paliersFetes = []; // (les trophées déjà dans le total de départ ne sont jamais fêtés)
  objSave();
  wStep = 1;
  objRender();
  showScreen('obj');
  rainHearts(18);
  toast('C’est parti ! Note ta prochaine sortie en bas.', { duration: 3500 });
}

function setStepper(output, value) {
  const v = Math.max(1, Math.min(14, value));
  output.value = v;
  output.textContent = v;
  const unit = output.id === 'w-runs' ? $('#w-runs-unit') : null;
  if (unit) unit.textContent = v > 1 ? 'sorties par semaine' : 'sortie par semaine';
}

/* ============================================================
   Réglages
   ============================================================ */
function objFillSettings() {
  const s = obj.reglages;
  if (!s) return;
  $('#s-total').value = kmText(s.totalDepart);
  $('#s-date').value = s.dateDepart;
  $('#s-date').max = todayKey();
  $('#s-goal').value = kmText(s.objectif);
  $('#s-year').value = s.annee;
  $('#s-ville').value = O.VILLES[s.ville] ? s.ville : O.DEFAULT_VILLE;
  setStepper($('#s-runs'), s.sortiesParSemaine);
}

function objSaveSettings(e) {
  e.preventDefault();
  const res = readSettings(S_IDS);
  if (res.erreur) return objError(res.erreur, $(res.el));
  document.activeElement && document.activeElement.blur();
  obj.reglages = res.reglages;
  objSave();
  objRender({ animate: true });
  toast('Réglages enregistrés');
  objCheckMilestones();
}

/* ============================================================
   Clavier : la saisie reste toujours visible au-dessus
   ============================================================ */
function setupKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const app = document.querySelector('.app');
  const update = () => {
    const kb = window.innerHeight - vv.height;
    const open = kb > 120 && document.activeElement && document.activeElement.tagName === 'INPUT';
    document.documentElement.classList.toggle('kb', open);
    app.style.height = open ? vv.height + 'px' : '';
    if (open) window.scrollTo(0, 0);
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  document.addEventListener('focusout', () => setTimeout(update, 50));
}

/* ============================================================
   Démarrage
   ============================================================ */
function objStart() {
  $('#o-dock').addEventListener('submit', objAdd);
  $('#o-date').addEventListener('change', e => {
    const v = e.target.value;
    objDate = v && v !== todayKey() ? v : null;
    renderDateChip();
  });

  // Toucher une sortie dans une liste : la modifier
  ['#o-recent', '#o-runs'].forEach(sel => $(sel).addEventListener('click', e => {
    const b = e.target.closest('.o-run');
    if (b) objEditRun(b.dataset.id);
  }));
  $('#o-all').addEventListener('click', () => showScreen('obj-runs'));
  $('#o-trophies').addEventListener('click', e => {
    const b = e.target.closest('[data-tr]');
    if (b) showTrophy(b.dataset.tr);
  });
  // Entrée dans « Modifier la sortie » = Enregistrer (et pas Annuler)
  ['#dialog-km', '#dialog-date'].forEach(sel => $(sel).addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const save = $('#dialog-actions .primary');
    if (save) save.click();
  }));

  // Bienvenue
  $('#w-next').addEventListener('click', welcomeNext);
  $('#w-back').addEventListener('click', () => welcomeStep(Math.max(1, wStep - 1)));
  ['#w-total', '#w-date', '#w-goal', '#w-year'].forEach(sel => $(sel).addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); welcomeNext(); }
  }));
  document.querySelectorAll('.o-stepper').forEach(st => st.addEventListener('click', e => {
    const b = e.target.closest('.o-step-btn');
    if (!b) return;
    const out = document.getElementById(st.dataset.target);
    setStepper(out, Number(out.value) + Number(b.dataset.delta));
  }));
  setStepper($('#w-runs'), 2);
  fillVilles();

  // Réglages
  $('#o-form').addEventListener('submit', objSaveSettings);
  $('#o-export').addEventListener('click', exportData);
  $('#o-import').addEventListener('click', () => $('#file-import').click());

  // Fête
  $('#o-party-ok').addEventListener('click', closeParty);

  // Retour dans l'app : on relit les données (au cas où) et on remet tout à jour
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    obj = objLoad();
    renderDateChip();
    objRender();
  });

  setupKeyboard();
  renderDateChip();
  objRender();
  showScreen(view[view.space]);
}

objStart();
