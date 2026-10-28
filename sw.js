// Minimal service worker: always go to the network first, so the data is never stale.
// If the network is down, show the last page that loaded.
const CACHE = 'watchfloor-shell-v1';
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
