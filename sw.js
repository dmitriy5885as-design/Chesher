/* CHESHER - offline application shell and release updates */
const CACHE = 'chesher-v0.26.5';
const APP_SHELL = [
  './', './index.html', './css/main.css', './css/animations.css',
  './js/chess-logic.js', './js/bot.js', './js/elo.js', './js/profile.js',
  './js/ui.js', './js/chat.js', './js/store.js', './js/quests.js',
  './js/analysis.js', './js/settings.js', './js/meme/MemeEventBus.js',
  './js/meme/MemeConfig.js', './js/meme/MemeThreatHandler.js',
  './js/firebase-config.js', './js/auth.js', './js/friends.js',
  './js/multiplayer.js', './js/net-ui.js', './js/matchmaking.js',
  './js/progress.js', './js/puzzle-data.js', './js/puzzles.js', './js/analytics.js', './js/main.js', './version.json', './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('chesher-') && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if(request.method !== 'GET' || url.origin !== self.location.origin ||
     url.pathname.endsWith('/sw.js') || request.headers.has('range') ||
     request.destination === 'video' || request.destination === 'audio') return;

  const cacheResponse = response => {
    if(response && response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
    }
    return response;
  };
  const cached = () => caches.open(CACHE).then(cache => cache.match(request, { ignoreSearch: true }));
  // Code/data refresh online; versioned URLs can use the precached offline shell.
  if(request.mode === 'navigate' || /\.(js|css|json|webmanifest)$/.test(url.pathname)) {
    event.respondWith(fetch(request).then(response => {
      if(response.ok) return cacheResponse(response);
      return cached().then(hit => hit || response);
    }).catch(async () => {
      const hit = await cached();
      if(hit) return hit;
      if(request.mode === 'navigate') return caches.match(new URL('./index.html', self.registration.scope));
      return Response.error();
    }));
  } else {
    event.respondWith(cached().then(hit => hit || fetch(request).then(cacheResponse)));
  }
});
