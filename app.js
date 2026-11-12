/* ============================================================
   11:10 — la logique de l'app
   Tout est stocké sur le téléphone (localStorage), rien ne part sur internet.
   ============================================================ */
'use strict';

/* ---------- Mode test ----------
   Ajouter ?jour=2026-10-11 à l'adresse fait croire à l'app qu'on est ce jour-là.
   Les données de test sont rangées à part : les vraies ne sont jamais touchées. */
const params = new URLSearchParams(location.search);
const TEST_DAY = /^\d{4}-\d{2}-\d{2}$/.test(params.get('jour') || '') ? params.get('jour') : null;

/* ---------- Réglages ---------- */
// Format : { "2026-10-11": "11:10:42", "2026-10-12": null }  (null = ajouté à la main, sans heure)
const STORAGE_KEY = TEST_DAY ? '1110.test.days' : '1110.days';
const THEME_KEY = '1110.theme';
const MODE_KEY = '1110.mode';          // 'auto' (suit l'iPhone), 'light' ou 'dark'
const BDAY_SHOWN_KEY = '1110.bday.';   // + année : la grosse pluie de cœurs a déjà eu lieu
const BIRTHDAY = { month: 10, day: 11 };

const THEMES = [
  { id: 'rose',    name: 'Rose poudré',    swatch: ['#ED93B1', '#F4C0D1'] },
  { id: 'lavande', name: 'Lavande',        swatch: ['#9B8FE0', '#D9D4F6'] },
  { id: 'peche',   name: 'Pêche',          swatch: ['#F29B76', '#FBD3BE'] },
  { id: 'sauge',   name: 'Sauge',          swatch: ['#86AD92', '#CFE0D2'] },
  { id: 'ciel',    name: "Ciel d'automne", swatch: ['#7FAEE3', '#C9DEF5'] },
];

const MODES = [
  { id: 'auto',  name: 'Auto' },
  { id: 'light', name: 'Clair' },
  { id: 'dark',  name: 'Sombre' },
];

const HEART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.6 2.9 4.5 6.8 4.5c2.2 0 3.7 1.2 5.2 3 1.5-1.8 3-3 5.2-3 3.9 0 5.9 4.1 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg>';

const $ = sel => document.querySelector(sel);

/* ============================================================
   Dates — TOUJOURS en heure locale du téléphone
   (jamais toISOString(), qui est en UTC et décalerait les jours le soir)
   ============================================================ */
const pad = n => String(n).padStart(2, '0');

// Maintenant (ou le jour de test, à l'heure actuelle)
function now() {
  const d = new Date();
  if (TEST_DAY) {
    const [y, m, day] = TEST_DAY.split('-').map(Number);
    d.setFullYear(y, m - 1, day);
  }
  return d;
}

// "2026-10-11" à partir d'une date
function keyOf(date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}
const todayKey = () => keyOf(now());

// Date (à minuit, heure locale) à partir de "2026-10-11"
function dateOf(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Numéro de jour qui se suit sans trou : sert à compter les séries.
// (calculé en UTC exprès, pour ne pas être gêné par le passage heure d'été / d'hiver)
function dayNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

function timeNow() {
  const d = now();
  return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

const isBirthday = key => key.slice(5) === pad(BIRTHDAY.month) + '-' + pad(BIRTHDAY.day);
const isFuture = key => dayNumber(key) > dayNumber(todayKey());

const fmtDayLong  = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtDayShort = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
const fmtMonth    = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const fmtMonthOnly = new Intl.DateTimeFormat('fr-FR', { month: 'long' });
const fmtFull     = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n, word) => n + ' ' + word + (n > 1 ? 's' : '');

/* ============================================================
   Stockage
   ============================================================ */
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

// Ne garde que des entrées valides (protège contre un fichier importé abîmé)
function cleanDays(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && (v === null || (typeof v === 'string' && TIME_RE.test(v)))) {
      out[k] = v;
    }
  }
  return out;
}

function loadDays() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return cleanDays(raw ? JSON.parse(raw) : {});
  } catch (e) {
    return {};
  }
}

function saveDays() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
  } catch (e) {
    toast("Impossible d'enregistrer sur ce téléphone");
  }
}

let days = loadDays();
const has = key => Object.prototype.hasOwnProperty.call(days, key);

// Demande au navigateur de ne pas effacer nos données s'il manque de place
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ============================================================
   Accueil
   ============================================================ */
function renderHome() {
  const today = todayKey();
  const d = now();

  $('#home-date').textContent = fmtDayLong.format(d);
  renderClock();

  const year = today.slice(0, 4);
  const count = Object.keys(days).filter(k => k.startsWith(year)).length;
  $('#home-count').textContent = count ? plural(count, 'jour') + ' cette année' : 'Pas encore de 11:10 cette année';

  $('#bday').hidden = !isBirthday(today);

  const btn = $('#btn-1110');
  if (has(today)) {
    const t = days[today];
    btn.classList.add('done');
    btn.innerHTML = '<span>Déjà validé aujourd\'hui ✓</span>' + (t ? '<span class="time">à ' + t + '</span>' : '');
    $('#home-hint').hidden = true;
    $('#btn-undo').hidden = false;
  } else {
    btn.classList.remove('done');
    btn.innerHTML = '<span>C\'est 11:10 !</span>' + HEART_SVG;
    $('#home-hint').hidden = false;
    $('#btn-undo').hidden = true;
  }
}

function renderClock() {
  const d = now();
  $('#home-clock').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// Le gros bouton : enregistre le jour et l'heure exacte (une seule fois par jour)
function onMainButton() {
  const today = todayKey();
  if (has(today)) {
    rainHearts(8); // déjà validé : juste quelques cœurs pour le plaisir
    return;
  }
  days[today] = timeNow();
  saveDays();
  rainHearts(isBirthday(today) ? 70 : 32);
  if (navigator.vibrate) navigator.vibrate([30, 50, 30]); // (pas disponible sur iPhone)
  renderAll();
}

async function undoToday() {
  const today = todayKey();
  if (!has(today)) return;
  const t = days[today];
  const r = await ask({
    title: 'Annuler la coche du jour ?',
    text: t ? 'Le 11:10 enregistré à ' + t + ' sera retiré.' : "Le 11:10 d'aujourd'hui sera retiré.",
    buttons: [
      { label: 'Garder', value: 'keep' },
      { label: 'Retirer', value: 'remove', style: 'danger' },
    ],
  });
  if (r.value === 'remove') {
    delete days[today];
    saveDays();
    renderAll();
    toast('Coche retirée');
  }
}

// Le 11 octobre : grosse pluie de cœurs à la première ouverture de la journée
function birthdaySurprise() {
  const today = todayKey();
  if (!isBirthday(today)) return;
  if (!TEST_DAY) {
    const flag = BDAY_SHOWN_KEY + today.slice(0, 4);
    try {
      if (localStorage.getItem(flag)) return;
      localStorage.setItem(flag, '1');
    } catch (e) { /* tant pis, on montre quand même */ }
  }
  setTimeout(() => rainHearts(80), 500);
}

/* ============================================================
   Calendrier
   ============================================================ */
let viewYear = now().getFullYear();
let viewMonth = now().getMonth(); // 0 = janvier
let selectedKey = null;

function renderCalendar() {
  const first = new Date(viewYear, viewMonth, 1);
  $('#cal-title').textContent = cap(fmtMonth.format(first));

  const offset = (first.getDay() + 6) % 7;                    // lundi = première colonne
  const nbDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = todayKey();

  let html = '<span></span>'.repeat(offset);
  for (let day = 1; day <= nbDays; day++) {
    const key = viewYear + '-' + pad(viewMonth + 1) + '-' + pad(day);
    const cls = ['day'];
    if (has(key)) cls.push('on');
    if (key === today) cls.push('today');
    if (isFuture(key)) cls.push('future');
    if (isBirthday(key)) cls.push('birthday');
    if (key === selectedKey) cls.push('selected');
    const label = cap(fmtDayLong.format(dateOf(key))) + (has(key) ? ', validé' : '');
    html += '<button type="button" class="' + cls.join(' ') + '" data-key="' + key + '" aria-label="' + label + '">' + day + '</button>';
  }
  $('#cal-days').innerHTML = html;
  renderDetail();
}

// Le petit encart sous le calendrier
function renderDetail() {
  const el = $('#cal-detail');
  const prefix = viewYear + '-' + pad(viewMonth + 1);

  if (!selectedKey || !selectedKey.startsWith(prefix)) {
    const n = Object.keys(days).filter(k => k.startsWith(prefix)).length;
    el.innerHTML = '<span class="label">' + cap(fmtMonthOnly.format(new Date(viewYear, viewMonth, 1))) + '</span>'
      + '<strong>' + (n ? plural(n, 'jour') + ' ce mois-ci' : 'Aucun 11:10 ce mois-ci') + '</strong>';
    return;
  }

  const k = selectedKey;
  let main;
  if (has(k)) main = days[k] ? 'validé à ' + days[k] : 'validé (heure non notée)';
  else if (isFuture(k)) main = 'pas encore arrivé';
  else main = 'pas de 11:10 ce jour-là';

  el.innerHTML = '<span class="label">' + cap(fmtDayShort.format(dateOf(k))) + '</span>'
    + '<strong>' + main + '</strong>'
    + (isBirthday(k) ? '<span class="small">♥ ton anniversaire</span>' : '');
}

function changeMonth(delta) {
  const d = new Date(viewYear, viewMonth + delta, 1);
  viewYear = d.getFullYear();
  viewMonth = d.getMonth();
  selectedKey = null;
  renderCalendar();
}

// Appui long sur un jour : l'ajouter, changer son heure ou le retirer
async function editDay(key) {
  if (isFuture(key)) {
    toast("Ce jour n'est pas encore arrivé");
    return;
  }
  const label = fmtDayShort.format(dateOf(key));

  if (has(key)) {
    const old = days[key];
    const r = await ask({
      title: cap(label),
      text: "Change l'heure ou retire ce jour.",
      time: old ? old.slice(0, 5) : '',
      buttons: [
        { label: 'Retirer', value: 'remove', style: 'danger' },
        { label: 'Annuler', value: 'cancel' },
        { label: 'Enregistrer', value: 'save', style: 'primary' },
      ],
    });
    if (r.value === 'remove') {
      delete days[key];
    } else if (r.value === 'save') {
      const t = normTime(r.time);
      // même heure qu'avant : on garde les secondes d'origine
      if (!(old && t && old.slice(0, 5) === t.slice(0, 5))) days[key] = t;
    } else {
      return;
    }
  } else {
    const r = await ask({
      title: 'Ajouter le ' + label + ' ?',
      text: 'Heure du 11:10 (facultatif)',
      time: '11:10',
      buttons: [
        { label: 'Annuler', value: 'cancel' },
        { label: 'Ajouter', value: 'add', style: 'primary' },
      ],
    });
    if (r.value !== 'add') return;
    days[key] = normTime(r.time);
    rainHearts(14);
  }

  saveDays();
  selectedKey = key;
  renderAll();
}

const normTime = v => (TIME_RE.test(v || '') ? v : null);

// Détection de l'appui long (≈ 0,5 s sans bouger le doigt)
function setupLongPress() {
  const grid = $('#cal-days');
  let timer = null;
  let start = null;
  let fired = false;

  const cancel = () => {
    clearTimeout(timer);
    if (start) start.btn.classList.remove('pressing');
    start = null;
  };

  grid.addEventListener('pointerdown', e => {
    const btn = e.target.closest('.day');
    if (!btn) return;
    fired = false;
    start = { x: e.clientX, y: e.clientY, btn };
    btn.classList.add('pressing');
    timer = setTimeout(() => {
      fired = true;
      cancel();
      if (navigator.vibrate) navigator.vibrate(15);
      editDay(btn.dataset.key);
    }, 500);
  });
  grid.addEventListener('pointermove', e => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => grid.addEventListener(t, cancel));
  grid.addEventListener('contextmenu', e => e.preventDefault());

  // Appui court : affiche l'heure enregistrée ce jour-là
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.day');
    if (!btn) return;
    if (fired) { fired = false; return; }
    selectedKey = btn.dataset.key;
    renderCalendar();
  });
}

/* ============================================================
   Stats
   ============================================================ */
function computeStats() {
  const keys = Object.keys(days).sort();
  const nums = keys.map(dayNumber);
  const today = dayNumber(todayKey());

  // Meilleure série : la plus longue suite de jours consécutifs
  let best = 0, run = 0;
  nums.forEach((n, i) => {
    run = i > 0 && n === nums[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });

  // Série en cours : jusqu'à aujourd'hui (ou hier, si aujourd'hui n'est pas encore coché)
  const set = new Set(nums);
  let t = set.has(today) ? today : today - 1;
  let current = 0;
  while (set.has(t)) { current++; t--; }

  // Par mois
  const perMonth = {};
  keys.forEach(k => { const m = k.slice(0, 7); perMonth[m] = (perMonth[m] || 0) + 1; });
  const thisMonth = perMonth[todayKey().slice(0, 7)] || 0;
  let bestMonth = null;
  for (const [m, n] of Object.entries(perMonth)) {
    if (!bestMonth || n >= bestMonth.n) bestMonth = { m, n }; // à égalité : le plus récent
  }

  // Pourcentage de jours validés depuis le premier
  let pct = null, since = null;
  if (keys.length) {
    const span = today - nums[0] + 1;
    const pastCount = nums.filter(n => n <= today).length;
    pct = span > 0 ? Math.round(pastCount / span * 100) : 100;
    since = keys[0];
  }

  return { total: keys.length, current, best, thisMonth, bestMonth, pct, since };
}

function renderStats() {
  const s = computeStats();
  $('#st-total').textContent = plural(s.total, 'jour');
  $('#st-streak').textContent = plural(s.current, 'jour');
  $('#st-best').textContent = plural(s.best, 'jour');
  $('#st-month').textContent = plural(s.thisMonth, 'jour');
  if (s.bestMonth) {
    $('#st-bestmonth').textContent = plural(s.bestMonth.n, 'jour');
    $('#st-bestmonth-label').textContent = fmtMonth.format(dateOf(s.bestMonth.m + '-01'));
  } else {
    $('#st-bestmonth').textContent = '–';
    $('#st-bestmonth-label').textContent = '';
  }
  $('#st-pct').textContent = s.pct === null ? '–' : s.pct + ' %';
  $('#st-pct-label').textContent = s.since
    ? 'Depuis le ' + fmtFull.format(dateOf(s.since))
    : 'Depuis le premier 11:10';
}

/* ============================================================
   Réglages : thème, export, import
   ============================================================ */
function currentTheme() {
  const t = document.documentElement.dataset.theme;
  return THEMES.some(x => x.id === t) ? t : 'rose';
}

function setTheme(id) {
  document.documentElement.dataset.theme = id;
  try { localStorage.setItem(THEME_KEY, id); } catch (e) { /* rien */ }
  updateThemeColor();
  renderSettings();
}

// Mode clair / sombre choisi dans les Réglages
const darkQuery = matchMedia('(prefers-color-scheme: dark)');

function currentMode() {
  let m = null;
  try { m = localStorage.getItem(MODE_KEY); } catch (e) { /* rien */ }
  return MODES.some(x => x.id === m) ? m : 'auto';
}

// Allume ou éteint les couleurs sombres (attribut data-dark sur <html>)
function applyMode() {
  const mode = currentMode();
  const dark = mode === 'dark' || (mode === 'auto' && darkQuery.matches);
  document.documentElement.toggleAttribute('data-dark', dark);
  updateThemeColor();
}

function setMode(id) {
  try { localStorage.setItem(MODE_KEY, id); } catch (e) { /* rien */ }
  applyMode();
  renderSettings();
}

// Couleur de la barre d'état du téléphone = couleur de fond du thème
function updateThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && bg) meta.content = bg;
}

function renderSettings() {
  const mode = currentMode();
  $('#modes').innerHTML = MODES.map(m =>
    '<button type="button" class="mode-btn' + (m.id === mode ? ' selected' : '') + '" data-mode-id="' + m.id + '" aria-pressed="' + (m.id === mode) + '">' + m.name + '</button>'
  ).join('');

  const cur = currentTheme();
  $('#themes').innerHTML = THEMES.map(t =>
    '<button type="button" class="theme-btn' + (t.id === cur ? ' selected' : '') + '" data-theme-id="' + t.id + '" aria-pressed="' + (t.id === cur) + '">'
    + '<span class="swatch"><i style="background:' + t.swatch[0] + '"></i><i style="background:' + t.swatch[1] + '"></i></span>'
    + t.name + '</button>'
  ).join('');
}

async function exportData() {
  const data = { app: '11:10', format: 1, exportedAt: new Date().toISOString(), days };
  if (typeof objExportData === 'function') data.objectif365 = objExportData();
  const json = JSON.stringify(data, null, 2);
  const name = '11h10-sauvegarde-' + todayKey() + '.json';
  const file = new File([json], name, { type: 'application/json' });

  // Sur iPhone : la feuille de partage (Enregistrer dans Fichiers, Mail, AirDrop…)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Sauvegarde 11:10' });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // elle a fermé la feuille de partage
    }
  }
  // Sinon : téléchargement classique
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Import : on AJOUTE les jours du fichier, on n'efface jamais ceux déjà présents
// (les sorties d'Objectif 365 aussi, si le fichier en contient : un ancien fichier n'en a pas)
async function importData(file) {
  try {
    const data = JSON.parse(await file.text());
    const incoming = cleanDays(data && data.days ? data.days : data);
    const entries = Object.entries(incoming);
    const hasObj = !!(data && data.objectif365 && typeof objImportData === 'function');
    if (!entries.length && !hasObj) {
      toast('Ce fichier ne contient aucun 11:10');
      return;
    }
    let added = 0;
    for (const [k, v] of entries) {
      if (!has(k)) { days[k] = v; added++; }
      else if (days[k] === null && v) { days[k] = v; } // complète une heure manquante
    }
    saveDays();
    const runs = hasObj ? objImportData(data.objectif365) : 0;
    renderAll();
    const parts = [];
    if (added) parts.push(plural(added, 'jour') + ' ajouté' + (added > 1 ? 's' : ''));
    if (runs) parts.push(plural(runs, 'sortie') + ' ajoutée' + (runs > 1 ? 's' : ''));
    toast(parts.length ? parts.join(' · ') : 'Tout était déjà là');
    if (typeof objAfterShow === 'function') showScreen(view[view.space]); // réglages importés : quitte la bienvenue
  } catch (e) {
    toast('Fichier illisible');
  }
}

/* ============================================================
   Petits outils : cœurs, message, fenêtre de dialogue
   ============================================================ */
function rainHearts(count = 30) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) count = Math.min(count, 8);
  const box = $('#hearts');
  const colors = ['var(--btn)', 'var(--ring)', 'var(--soft)'];
  for (let i = 0; i < count; i++) {
    const h = document.createElement('span');
    h.className = 'heart';
    h.innerHTML = HEART_SVG;
    h.style.setProperty('--x', (Math.random() * 100) + 'vw');
    h.style.setProperty('--s', (12 + Math.random() * 22) + 'px');
    h.style.setProperty('--c', colors[i % colors.length]);
    h.style.setProperty('--d', (2.2 + Math.random() * 1.8) + 's');
    h.style.setProperty('--delay', (Math.random() * (count > 40 ? 1.6 : 0.8)) + 's');
    h.style.setProperty('--dx', ((Math.random() - 0.5) * 140) + 'px');
    h.style.setProperty('--r', ((Math.random() - 0.5) * 540) + 'deg');
    h.addEventListener('animationend', () => h.remove());
    box.appendChild(h);
  }
}

// Petit message en bas de l'écran ; avec { action, onAction } il porte un bouton (ex. « Annuler »)
let toastTimer = null;
function toast(msg, opts = {}) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('has-action', !!opts.action);
  if (opts.action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toast-btn';
    b.textContent = opts.action;
    b.addEventListener('click', () => {
      clearTimeout(toastTimer);
      el.classList.remove('show');
      opts.onAction();
    }, { once: true });
    el.appendChild(b);
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), opts.duration || 2400);
}

// Ouvre la fenêtre de dialogue et attend le choix : { value, time, km, date }
// (km et date : pour modifier une sortie d'Objectif 365)
const dlg = $('#dialog');
let dlgOpenedAt = 0;
function ask({ title, text = '', time, km, date, dateMin, dateMax, buttons }) {
  return new Promise(resolve => {
    $('#dialog-title').textContent = title;
    $('#dialog-text').textContent = text;
    const input = $('#dialog-time');
    $('#dialog-time-wrap').hidden = time === undefined;
    input.value = time || '';
    const kmIn = $('#dialog-km'), dateIn = $('#dialog-date');
    $('#dialog-fields').hidden = km === undefined;
    kmIn.value = km || '';
    dateIn.value = date || '';
    dateIn.min = dateMin || '';
    dateIn.max = dateMax || '';

    // Répond une seule fois, que ce soit par un bouton, Échap ou un toucher à côté
    let done = false;
    // (si la fenêtre est ouverte, ce « fermé » vient de la fenêtre d'avant, arrivé en retard : on l'ignore)
    const onClose = () => { if (!dlg.open) finish(''); };
    const finish = value => {
      if (done) return;
      done = true;
      dlg.removeEventListener('close', onClose);
      resolve({ value, time: input.value, km: kmIn.value, date: dateIn.value });
    };

    const actions = $('#dialog-actions');
    actions.innerHTML = '';
    buttons.forEach(b => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'btn ' + (b.style || '');
      el.textContent = b.label;
      el.addEventListener('click', () => {
        finish(b.value);
        dlg.close();
      });
      actions.appendChild(el);
    });

    dlg.addEventListener('close', onClose);
    dlgOpenedAt = Date.now();
    dlg.showModal();
    actions.lastElementChild.focus(); // évite d'ouvrir le sélecteur d'heure d'office
  });
}
// Toucher à côté de la fenêtre la ferme
// (sauf juste après l'ouverture : le doigt de l'appui long est peut-être encore posé)
dlg.addEventListener('click', e => {
  if (e.target === dlg && Date.now() - dlgOpenedAt > 600) dlg.close();
});

/* ============================================================
   Navigation et démarrage
   Deux espaces (11:10 et Objectif 365), chacun avec ses onglets.
   L'app se rouvre là où on l'a laissée.
   ============================================================ */
const VIEW_KEY = '1110.lastView';
const SPACE_SCREENS = {
  '1110': ['home', 'calendar', 'stats', 'settings'],
  '365': ['obj', 'obj-runs', 'obj-settings', 'obj-welcome'],
};

function loadView() {
  const v = { space: '1110', '1110': 'home', '365': 'obj' };
  try {
    const saved = JSON.parse(localStorage.getItem(VIEW_KEY) || '{}');
    if (saved.space in SPACE_SCREENS) v.space = saved.space;
    for (const sp in SPACE_SCREENS) if (SPACE_SCREENS[sp].includes(saved[sp])) v[sp] = saved[sp];
  } catch (e) { /* rien */ }
  return v;
}
const view = loadView();

function saveView() {
  try { localStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch (e) { /* rien */ }
}

const spaceOf = name => (SPACE_SCREENS['365'].includes(name) ? '365' : '1110');

function showScreen(name) {
  if (typeof objRoute === 'function') name = objRoute(name); // Objectif 365 pas encore réglé → bienvenue
  const space = spaceOf(name);
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
  document.querySelectorAll('.tab').forEach(t => {
    const on = t.dataset.screen === name;
    t.classList.toggle('active', on);
    if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });
  document.querySelectorAll('.tabbar').forEach(t => { t.hidden = t.dataset.space !== space; });
  document.querySelectorAll('.space-btn').forEach(b => b.setAttribute('aria-selected', String(b.dataset.space === space)));
  $('#main').scrollTop = 0;
  view.space = space;
  view[space] = name;
  saveView();
  if (typeof objAfterShow === 'function') objAfterShow(name);
}

const showSpace = space => showScreen(view[space]);

function renderAll() {
  renderHome();
  renderCalendar();
  renderStats();
  if (typeof objRender === 'function') objRender();
}

// Vérifie chaque seconde l'heure… et le passage à minuit
let shownDay = todayKey();
function tick() {
  renderClock();
  if (todayKey() !== shownDay) {
    shownDay = todayKey();
    viewYear = now().getFullYear();
    viewMonth = now().getMonth();
    renderAll();
    birthdaySurprise();
  }
}

function start() {
  if (TEST_DAY) {
    const banner = $('#test-banner');
    banner.textContent = 'Mode test : on fait comme si on était le ' + fmtFull.format(dateOf(TEST_DAY));
    banner.hidden = false;
  }

  document.documentElement.dataset.theme = currentTheme();
  applyMode();
  renderSettings();
  renderAll();
  showScreen(view[view.space]);
  setupLongPress();

  $('#btn-1110').addEventListener('click', onMainButton);
  $('#btn-undo').addEventListener('click', undoToday);
  $('#cal-prev').addEventListener('click', () => changeMonth(-1));
  $('#cal-next').addEventListener('click', () => changeMonth(1));
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showScreen(t.dataset.screen)));
  document.querySelectorAll('.space-btn').forEach(b => b.addEventListener('click', () => showSpace(b.dataset.space)));
  $('#themes').addEventListener('click', e => {
    const b = e.target.closest('.theme-btn');
    if (b) setTheme(b.dataset.themeId);
  });
  $('#modes').addEventListener('click', e => {
    const b = e.target.closest('.mode-btn');
    if (b) setMode(b.dataset.modeId);
  });
  $('#btn-export').addEventListener('click', exportData);
  $('#btn-import').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) importData(f);
    e.target.value = '';
  });

  // L'iPhone passe en clair/sombre : on suit, si le mode « Auto » est choisi
  darkQuery.addEventListener('change', applyMode);

  // Retour dans l'app (elle était en arrière-plan) : on remet tout à jour
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { days = loadDays(); tick(); renderAll(); }
  });

  setInterval(tick, 1000);
  birthdaySurprise();
  registerServiceWorker();
}

/* ---------- Service worker : fonctionnement hors ligne + mises à jour ---------- */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;

  const hadController = !!navigator.serviceWorker.controller;
  // updateViaCache: 'none' : le téléphone vérifie toujours sw.js en ligne, jamais une vieille copie
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});

  // L'app installée reste souvent en veille : quand elle revient au premier plan,
  // on vérifie s'il existe une nouvelle version (qui la rechargera toute seule)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    navigator.serviceWorker.getRegistration().then(reg => reg && reg.update()).catch(() => {});
  });

  // Une nouvelle version vient de s'installer : on recharge une fois pour l'afficher
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) return;
    refreshing = true;
    location.reload();
  });

  // Affiche le numéro de version dans les Réglages
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && e.data.version) $('#app-version').textContent = e.data.version;
  });
  navigator.serviceWorker.ready.then(reg => { if (reg.active) reg.active.postMessage('version'); });
}

start();
