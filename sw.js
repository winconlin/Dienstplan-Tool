const CACHE_NAME = 'mediplan-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.json',
  '/src/main.js',
  '/src/state.js',
  '/src/ui.js',
  '/src/calendar.js',
  '/src/i18n.js',
  '/src/export.js',
  '/src/utils.js',
  '/src/worker.js',
  '/src/db.js',
  '/src/migration.js',
  '/src/staff.js',
  '/src/validation.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
