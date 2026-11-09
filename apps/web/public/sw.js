/* Doqto service worker.
 *
 * It keeps the app shell fast and shows an offline page when the network is gone. It never
 * caches API calls or pages, so nothing about a signed-in patient is stored by it.
 */
const VERSION = 'v2';
const STATIC_CACHE = `doqto-static-${VERSION}`;
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const res = await fetch(OFFLINE_URL, { credentials: 'same-origin' });
      await cache.put(OFFLINE_URL, res.clone());
      // The offline page needs its stylesheet and icons to look right without a network.
      const html = await res.text();
      const assets = [...html.matchAll(/(?:href|src)="(\/(?:_next\/static|icons)\/[^"]+)"/g)].map(
        (m) => m[1],
      );
      await Promise.allSettled([...new Set(assets)].map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith('doqto-') && n !== STATIC_CACHE)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

// Web Push: an alert like "Your turn is near". The server sends only a title, a line of text and
// where to go; nothing clinical is ever in a push message.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Doqto', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Doqto', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'doqto',
      data: { url: data.url || '/appointments' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/appointments', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of windows) {
        if ('focus' in w) {
          await w.focus();
          if ('navigate' in w) await w.navigate(target).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Live data is never served from a cache.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/webpack-hmr')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()),
    );
    return;
  }

  const isAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:woff2?|png|jpe?g|svg|webp|avif|ico)$/.test(url.pathname);
  if (isAsset) event.respondWith(staleWhileRevalidate(request));
});
