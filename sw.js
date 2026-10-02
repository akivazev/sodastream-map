// Own files and the store list: network-first (stay fresh, work offline). Leaflet: cache-first.
var CACHE = 'sodamap-v1';
var SHELL = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icons/icon.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.hostname.endsWith('tile.openstreetmap.org')) return;

  var networkFirst = url.origin === location.origin &&
    (url.pathname.endsWith('/data/stores.json') || req.mode === 'navigate' ||
     /\.(js|css|html)$/.test(url.pathname));

  if (networkFirst) {
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return caches.match(req); }));
  } else {
    e.respondWith(caches.match(req).then(function (hit) { return hit || fetch(req); }));
  }
});
