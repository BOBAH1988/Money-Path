const appBase = new URL('./', self.registration.scope);
const scopeKey = new URL(self.registration.scope).pathname.replaceAll('/', '_');
const cachePrefix = `denegnyj-put-${scopeKey}-`;
const cacheName = `${cachePrefix}v17`;

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

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const response = await fetch(appBase);
    if (!response.ok) throw new Error(`Unable to precache app shell (${response.status})`);
    const html = await response.clone().text();
    const cache = await caches.open(cacheName);
    await cache.put(appBase, response);

    const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)]
      .map((match) => new URL(match[1], appBase).href);
    const styles = [...html.matchAll(/href="([^"]+\.css)"/g)]
      .map((match) => new URL(match[1], appBase).href);
    await Promise.allSettled([
      ...scripts.map((url) => cacheJavaScriptTree(url, cache, new Set())),
      ...styles.map(async (url) => {
        const style = await fetch(url);
        if (style.ok) await cache.put(url, style);
      }),
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

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
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(cacheName).then((cache) => cache.put(appBase, copy));
      }
      return response;
    }).catch(async () => (await caches.match(appBase)) ?? Response.error()));
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
