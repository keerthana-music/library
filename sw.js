/* The Keerthana App — minimal service worker.
   Network-first for same-origin GETs (so updates always land), with a cache
   fallback so the app shell still opens offline. Cross-origin requests
   (Google Drive, OAuth, GSI) are left untouched. */
const CACHE = 'kms-v1';
const SHELL = ['./', './index.html', './manifest.json',
               './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;      // don't touch Drive/OAuth/etc.
  e.respondWith(
    fetch(req)
      .then((r) => { const rc = r.clone(); caches.open(CACHE).then((c) => c.put(req, rc)); return r; })
      .catch(() => caches.match(req).then((m) => m || caches.match('./index.html')))
  );
});
