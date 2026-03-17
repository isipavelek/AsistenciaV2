const CACHE_NAME = 'asistencia-v2-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/src/main.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
