// Service Worker для офлайн-работы PWA "Денежный путь".
const CACHE_NAME = 'denegnyj-put-v16';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.hostname.includes('firebaseio.com') || url.hostname.includes('googleapis.com')) {
    return;
  }

  // Навигация (HTML) — сеть primero, чтобы PWA не залипал на старом index.html/чанках.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/Money-Path/index.html', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('/Money-Path/index.html'))
    );
    return;
  }

  // JS/CSS/worker — сеть primero, кэш как фолбэк (избегаем несовместимых старых чанков).
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'worker') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Остальные ассеты — кэш primero с обновлением в фоне.
  event.respondWith(
    caches.match(request).then((cached) =>
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return networkResponse || cached;
        })
        .catch(() => cached)
    )
  );
});
