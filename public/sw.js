const CACHE_NAME = 'asistencia-v2-cache-v5';
const ASSETS = [
  './',
  './index.html',
  './pwa-icon-192.png',
  './pwa-icon-512.png',
  './manifest.json'
];

// Instala el service worker y guarda en caché los recursos estáticos estables
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(err => {
        console.error('Error al cachear activos en sw.js:', err);
      });
    })
  );
});

// Limpia cachés antiguos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// Estrategia: Network First con fallback a caché
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request);
    })
  );
});
