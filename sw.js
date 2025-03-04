const CACHE_NAME = 'option-risk-cache-v1';
const urlsToCache = [
  '/',
  '/welcome.html',
  '/index.html',
  '/description.html',
  '/notes.html',
  '/styles.css',
  '/script.js',
  '/sw.js',
  '/manifest.json',
  '/logo.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
