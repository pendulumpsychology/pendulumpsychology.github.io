// Service worker: shows push notifications, opens the app when one is tapped,
// and keeps a copy of the app's files so it opens quickly and offline.

const CACHE = 'roster-v9';
const SHELL = ['./', './index.html', './app.js', './config.js', './manifest.webmanifest', './icon-192.png', './apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

// Network first, so updates pushed to the website show up straight away; cached copy when offline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    } catch (e) {
      return (await caches.match(req, { ignoreSearch: true })) || (await caches.match('./')) || Response.error();
    }
  })());
});

self.addEventListener('push', (event) => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch (e) { msg = { title: 'Supervision roster', body: event.data && event.data.text() }; }
  event.waitUntil((async () => {
    await self.registration.showNotification(msg.title || 'Supervision roster', {
      body: msg.body || '',
      tag: msg.tag,
      renotify: !!msg.tag,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      data: { url: new URL(msg.group ? `./?g=${msg.group}` : './', self.registration.scope).href, group: msg.group },
    });
    for (const c of await self.clients.matchAll({ type: 'window' })) c.postMessage({ type: 'refresh' });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.url || self.registration.scope;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of windows) {
      if (c.url.startsWith(self.registration.scope)) {
        c.postMessage({ type: 'open-group', group: data.group });
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
