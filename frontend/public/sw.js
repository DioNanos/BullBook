// BullBook Service Worker
// Versione cache
const CACHE_VERSION = 'bullbook-v1';

// Assets da cachare (generati durante build)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install event - caching iniziale
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );

  // Attiva immediatamente il nuovo SW
  self.skipWaiting();
});

// Activate event - pulizia cache vecchie
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  // Prendi controllo immediato di tutte le pagine
  return self.clients.claim();
});

// Fetch event - strategia di caching
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora WebSocket e chiamate API esterne (Bybit)
  if (url.protocol === 'ws:' || url.protocol === 'wss:' || url.hostname.includes('bybit.com')) {
    return;
  }

  // Network-first per API backend
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clona e cache response
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback a cache se network fail
          return caches.match(request);
        })
    );
    return;
  }

  // Cache-first per assets statici (CSS, JS, immagini)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Ritorna da cache e aggiorna in background
        fetch(request).then((response) => {
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(request, response);
          });
        });
        return cachedResponse;
      }

      // Non in cache - fetch dalla rete
      return fetch(request).then((response) => {
        // Cache la risposta per usi futuri
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

// Background sync (opzionale - per future features)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  // Placeholder per future sync features
});

// Push notifications (opzionale - per alert livelli)
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  // Placeholder per future push notifications
});
