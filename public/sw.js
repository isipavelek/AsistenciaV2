const CACHE_NAME = 'asistencia-v2-cache-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/src/main.js',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/manifest.json'
];

// Instala el service worker y guarda en caché los recursos estáticos
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
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
