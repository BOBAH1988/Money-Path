// Service Worker для офлайн-работы PWA "Денежный путь".
// Кэширует оболочку приложения, чтобы оно загружалось без интернета.
// Данные хранятся в localStorage (уже реализовано в lib/firestore.ts) и
// синхронизируются с Firestore при появлении соединения.

const CACHE_NAME = 'denegnyj-put-v1';
const ASSETS = [
  '/Money-Path/',
  '/Money-Path/index.html',
  '/Money-Path/src/main.tsx',
  '/Money-Path/src/index.css',
  '/Money-Path/app-icon.svg',
  '/Money-Path/favicon.svg',
  '/Money-Path/icons/icon-192.png',
  '/Money-Path/icons/icon-512.png',
  '/Money-Path/manifest.json',
];

// Установка SW — кэшируем оболочку.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Активация — чистим старые кэши.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Стратегия: для навигации — кэш-first с сетевым фолбэком; для остальных — сеть-first с кэш-фолбэком.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Не кэшируем Firebase запросы.
  if (url.hostname.includes('firebaseio.com') || url.hostname.includes('googleapis.com')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/Money-Path/index.html').then((cached) => cached || fetch(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) =>
      fetch(request).then((networkResponse) => {
        try {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        } catch {}
        return networkResponse;
      }).catch(() => cached || fetch(request))
    )
  );
});
