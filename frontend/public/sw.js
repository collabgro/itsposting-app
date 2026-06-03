const CACHE_NAME = 'itsposting-v3';

const SHELL_ASSETS = [
  '/offline.html',
  '/manifest.json',
  '/fav-icon.png',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // offline.html is critical — if it fails, still install but warn
      return cache.add('/offline.html').catch(() => null).then(() =>
        Promise.allSettled(
          SHELL_ASSETS.slice(1).map((url) => cache.add(url).catch(() => null))
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept API calls — always network
  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests: network-first, branded offline fallback on failure.
  // Never cache page HTML — Next.js embeds content-hashed chunk URLs that go
  // stale after every deploy, causing blank-screen failures.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/offline.html').then((offlinePage) => offlinePage || new Response(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title></head><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#07070E;color:#F5F5F7"><div style="text-align:center"><h1>You\'re offline</h1><p style="color:#6E6E73">Check your connection and <a href="/" style="color:#7C5CFC">try again</a>.</p></div></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        ))
      )
    );
    return;
  }

  // Skip /_next/static/ — content-addressed by Next.js, handled by HTTP cache.
  // Caching in SW causes blank screens when HTML references new hashes.
  if (url.pathname.startsWith('/_next/')) return;

  // Static image assets: cache-first with network fallback
  if (
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.webp')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        }).catch(() => null);
      })
    );
    return;
  }

  // manifest.json: cache-first so it's available offline
  if (url.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'ItsPosting', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'ItsPosting', {
      body: data.body || 'ItsPosting AI has a new suggestion for you.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      tag: data.tag || 'itsposting',
      renotify: true,
      data: { url: data.url || '/dashboard' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
