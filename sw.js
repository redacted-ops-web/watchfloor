// Minimal service worker: always go to the network first, so the data is never stale.
// If the network is down, show the last page that loaded.
const CACHE = 'intsum-shell-v4';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return; // only the page itself; data, API and map layers are never cached
  e.respondWith(
    fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('/', copy)); return res; })
      .catch(() => caches.match('/').then(r => r || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })))
  );
});

// Push notifications: the server sends a short JSON message when a severe or critical item appears.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(String(d.title || 'INTSUM').slice(0, 120), {
    body: String(d.body || '').slice(0, 300), icon: 'icons/icon-192.png?v=3', badge: 'icons/icon-192.png?v=3',
    tag: 'watchfloor-alert', renotify: true, data: { url: typeof d.url === 'string' ? d.url : '/' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin);
  if (target.origin !== self.location.origin) return;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) { c.navigate(target.href).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(target.href);
  }));
});
