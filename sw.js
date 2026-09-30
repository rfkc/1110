/* ============================================================
   11:10 — service worker
   Garde une copie de l'app sur le téléphone pour qu'elle marche hors ligne.

   ⚠️ À CHAQUE MODIFICATION DE L'APP : augmenter VERSION (v1 → v2 → v3…).
   Sinon l'iPhone continue d'afficher l'ancienne version gardée en cache.
   ============================================================ */
const VERSION = 'v3';

const CACHE = '1110-' + VERSION;
const FONT_CACHE = '1110-polices';

// Les fichiers de l'app, gardés dès l'installation
const FILES = [
  './',
  'index.html',
  'style.css',
  'app.js',
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

  // Polices Google : gardées après le premier chargement
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

  // Fichiers de l'app : copie locale d'abord, internet ensuite
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(req).catch(() => {
        if (req.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      });
    })
  );
});

// L'app demande le numéro de version (affiché dans les Réglages)
self.addEventListener('message', event => {
  if (event.data === 'version' && event.source) event.source.postMessage({ version: VERSION });
});
