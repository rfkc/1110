/* ============================================================
   11:10 — service worker
   Garde une copie de l'app sur le téléphone pour qu'elle marche hors ligne,
   tout en allant chercher la dernière version en ligne à chaque ouverture.

   ⚠️ À CHAQUE MODIFICATION DE L'APP : augmenter VERSION (v1 → v2 → v3…).
   C'est ce qui déclenche la mise à jour (et le rechargement) de l'app installée.
   ============================================================ */
const VERSION = 'v12';

const CACHE = '1110-' + VERSION;
const FONT_CACHE = '1110-polices';
const NETWORK_TIMEOUT = 3000; // au-delà, on prend la copie locale

// Les fichiers de l'app, gardés dès l'installation
const FILES = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'objectif.js',
  'objectif-ui.js',
  'manifest.json',
  'icons/icon.svg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' = on va chercher la vraie dernière version, pas une copie intermédiaire
      .then(cache => cache.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

// Nouvelle version active : on jette les anciennes copies
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Polices Google : elles ne changent jamais, on les garde après le premier chargement
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(req).then(hit => hit || fetch(req).then(res => {
          cache.put(req, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  if (url.origin !== location.origin) return;
  // Icônes et manifeste : on laisse l'iPhone les charger lui-même, sans intermédiaire
  // (« Sur l'écran d'accueil » les recharge, et doit toujours obtenir la vraie image)
  if (url.pathname.includes('/icons/') || url.pathname.endsWith('manifest.json')) return;
  event.respondWith(networkFirst(req, url));
});

// Fichiers de l'app : internet d'abord (toujours la dernière version),
// copie locale si pas de réseau ou réseau trop lent
async function networkFirst(req, url) {
  const cache = await caches.open(CACHE);
  const key = url.origin + url.pathname; // sans le "?jour=…" du mode test
  try {
    // no-cache : redemande au serveur au lieu d'une copie intermédiaire de moins de 10 min
    const res = await withTimeout(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }), NETWORK_TIMEOUT);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(key) || await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const index = await cache.match('index.html');
      if (index) return index;
    }
    return Response.error();
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      res => { clearTimeout(timer); resolve(res); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}

// L'app demande le numéro de version (affiché dans les Réglages)
self.addEventListener('message', event => {
  if (event.data === 'version' && event.source) event.source.postMessage({ version: VERSION });
});
