/* ===============================
   Dentro Offline-First SW
================================ */

const CACHE_VERSION = 'dentro-v3';
const APP_CACHE = `app-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

/* ===============================
   Core files (minimum to boot app)
================================ */

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

/* ===============================
   INSTALL - Precache core
================================ */

self.addEventListener('install', (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    })
  );
});

/* ===============================
   ACTIVATE - Clean old caches
================================ */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== APP_CACHE && key !== RUNTIME_CACHE) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

/* ===============================
   FETCH STRATEGY
================================ */

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Ignore non-http
  if (!url.protocol.startsWith('http')) return;

  /* ===============================
     1) Navigation (SPA support)
     Always return cached index.html
  ================================ */

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((response) => {
        return response || fetch(request);
      })
    );
    return;
  }

  /* ===============================
     2) Same-origin assets (JS/CSS/images)
     Cache First (true offline)
  ================================ */

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request)
          .then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            const cloned = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, cloned);
            });

            return networkResponse;
          })
          .catch(() => {
            return new Response('Offline', { status: 503 });
          });
      })
    );
    return;
  }

  /* ===============================
     3) External resources (fonts/CDN)
     Cache then network fallback
  ================================ */

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => new Response('', { status: 404 }));
    })
  );
});

/* ===============================
   Manual update trigger
================================ */

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
