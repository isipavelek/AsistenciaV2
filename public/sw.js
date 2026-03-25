const CACHE_NAME = 'asistencia-v2-cache-v7';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './src/main.js',
  './pwa-icon-192.png',
  './pwa-icon-512.png',
  './manifest.json'
];

// Instala el service worker y guarda en caché los recursos estáticos estables
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

// Limpia cachés antiguos agresivamente
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
        // Borrar absolutamente todos los caches para evitar que la página se cuelgue con la versión vieja
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    }).then(() => {
      self.clients.claim();
    })
  );
});

// Bypass para evitar el hang infinito de la estrategia anterior
self.addEventListener('fetch', (e) => {
  // Dejar que el navegador maneje todas las peticiones de red
  return;
});
