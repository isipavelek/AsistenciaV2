const CACHE_NAME = 'asistencia-v2-cache-v6';
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
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(err => {
        console.warn('Algunos activos no pudieron ser cacheados:', err);
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

// Estrategia: Network First con auto-cache para archivos estáticos
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Clonamos la respuesta para guardarla en caché si es válida
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(e.request);
      })
  );
});
