// Service Worker для офлайн-работы PWA "Денежный путь".
const CACHE_NAME = 'denegnyj-put-v15';
const ASSETS = [
  '/Money-Path/',
  '/Money-Path/index.html',
  '/Money-Path/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
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

  if (url.hostname.includes('firebaseio.com') || url.hostname.includes('googleapis.com')) {
    return;
  }

  // Для навигаций — сеть primero, кэш как фолбэк (SPA fallback).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/Money-Path/index.html'))
    );
    return;
  }

  // Для остальных ресурсов — кэш primero с сетевым обновлением.
  event.respondWith(
    caches.match(request).then((cached) =>
      fetch(request).then((networkResponse) => {
        if (!networkResponse.ok) return cached || networkResponse;
        try {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        } catch {}
        return networkResponse;
      }).catch(() => cached)
    )
  );
});
