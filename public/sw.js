const appBase = new URL('./', self.registration.scope);
const scopeKey = new URL(self.registration.scope).pathname.replaceAll('/', '_');
const cachePrefix = `denegnyj-put-${scopeKey}-`;
const cacheName = `${cachePrefix}v19`;

const cacheJavaScriptTree = async (url, cache, seen) => {
  if (seen.has(url)) return;
  seen.add(url);
  const response = await fetch(url);
  if (!response.ok) return;
  const source = await response.clone().text();
  await cache.put(url, response);
  const imports = [...source.matchAll(/(?:from\s*|import\s*)["']([^"']+\.js(?:\?[^"']*)?)["']/g)]
    .map((match) => new URL(match[1], url).href)
    .filter((assetUrl) => new URL(assetUrl).origin === self.location.origin);
  await Promise.allSettled(imports.map((assetUrl) => cacheJavaScriptTree(assetUrl, cache, seen)));
};

// Без сети при установке service worker всё равно ставится: кэш дозаполнится
// при первой удачной загрузке, а не будет ждать интернета.
const precacheShell = async () => {
  const response = await fetch(appBase);
  if (!response.ok) throw new Error(`Unable to precache app shell (${response.status})`);
  const html = await response.clone().text();
  const cache = await caches.open(cacheName);
  await cache.put(appBase, response);

  const scripts = [
    ...html.matchAll(/(?:src|href)="([^"]+\.js)"/g),
    ...html.matchAll(/href="([^"]+\.css)"/g),
  ].map((match) => new URL(match[1], appBase).href);

  await Promise.allSettled(scripts.map((url) => cacheJavaScriptTree(url, cache, new Set())));

  // Иконки и манифест нужны офлайн-оболочке не меньше скриптов.
  const assets = [
    'app-icon.svg',
    'favicon.ico',
    'manifest.json',
    'icons/app-icon-180.png',
    'icons/app-icon-192.png',
    'icons/app-icon-512.png',
  ].map((path) => new URL(path, appBase).href);

  await Promise.allSettled(assets.map(async (url) => {
    try {
      const asset = await fetch(url, { cache: 'no-store' });
      if (asset.ok) await cache.put(url, asset);
    } catch {
      // отдельная иконка не критична для запуска
    }
  }));
};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      await precacheShell();
    } catch (err) {
      console.warn('[sw] shell не закеширован при установке:', err);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// Минимальная страница вместо пустого экрана: объясняет, что происходит,
// и пытается перезагрузиться сам, как только сеть вернётся.
const offlineShell = () => new Response(`<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Денежный путь — нет сети</title>
<style>
html,body{height:100%;margin:0;background:#f5f5f7;color:#1d1d1f;font-family:system-ui,-apple-system,sans-serif}
.box{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center}
.icon{width:64px;height:64px;border-radius:16px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:28px}
h1{font-size:18px;margin:0}
p{margin:0;font-size:14px;color:#6b7280;max-width:320px;line-height:1.5}
button{margin-top:8px;padding:10px 18px;border-radius:10px;border:1px solid #d1d5db;background:#fff;font:inherit;font-weight:600;cursor:pointer}
</style></head>
<body><div class="box">
<div class="icon">₽</div>
<h1>Нет подключения</h1>
<p>Приложение не загрузилось, потому что первая загрузка ещё не сохранилась на устройстве. Подключитесь к интернету — страница перезагрузится сама.</p>
<button onclick="location.reload()">Повторить</button>
</div>
<script>window.addEventListener('online', function(){ location.reload(); });</script>
</body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => (key === 'denegnyj-put-v16' || key.startsWith(cachePrefix)) && key !== cacheName)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cachedShell = await caches.match(appBase);
      try {
        // Долгая загрузка на мобильной сети не должна держать белый экран:
        // если сеть молчит дольше таймаута, отдаём сохранённую оболочку.
        const response = await Promise.race([
          fetch(request),
          new Promise((_, reject) => setTimeout(() => reject(new Error('network-timeout')), 6000)),
        ]);
        if (response && response.ok) {
          const copy = response.clone();
          void caches.open(cacheName).then((cache) => cache.put(appBase, copy)).catch(() => {});
          return response;
        }
        if (cachedShell) return cachedShell;
        return response;
      } catch {
        if (cachedShell) return cachedShell;
        return offlineShell();
      }
    })());
    return;
  }

  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'worker') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(cacheName).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(async () => (await caches.match(request)) ?? Response.error()));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => {
    const network = fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(cacheName).then((cache) => cache.put(request, copy));
      }
      return response;
    });
    return network.catch(() => cached ?? Response.error());
  }));
});
