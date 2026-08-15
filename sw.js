// sw.js — the offline layer's I/O half.
//
// Every decision about what to store and how to serve it lives in
// js/offline-cache.js so it can be tested under Node. This file holds no path
// list and no policy of its own: it only wires those decisions to the Cache
// API. Keep it that way.

import {
  PRECACHE_PATHS,
  cacheNameFor,
  strategyFor,
  isFontHost,
  isCacheableResponse,
} from './js/offline-cache.js';

// Must match APP_VERSION in js/app.js and version in package.json. Bump it on
// any release that changes a cached file, or installs serve stale forever.
const APP_VERSION = '10.24.0';
const CACHE = cacheNameFor(APP_VERSION);

self.addEventListener('install', (event) => {
  // A rejected addAll aborts the install, so a broken or interrupted precache
  // leaves the previously working version untouched rather than half-populated.
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_PATHS)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((name) => (name === CACHE ? null : caches.delete(name))));
    await self.clients.claim();
  })());
});

// The only message this worker accepts. The page sends it when the learner
// presses Reload, never automatically.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheableResponse(response)) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request).then(async (response) => {
    if (isCacheableResponse(response)) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  if (cached) return cached;
  const response = await network;
  if (response) return response;
  throw new Error('offline and uncached');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Fonts are cross-origin and cached opportunistically after the first online
  // load, so an installed copy makes fewer requests to Google, not more.
  if (isFontHost(url.hostname)) {
    event.respondWith(cacheFirst(request).catch(() => fetch(request)));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      staleWhileRevalidate(request).catch(() => caches.match('./index.html').then((r) => r || Response.error())),
    );
    return;
  }

  // On Pages the worker lives at /kotoba-lab/sw.js, so pathnames arrive as
  // /kotoba-lab/js/app.js and must be reduced to js/app.js before the policy
  // module sees them. Locally the scope is / and this is a no-op.
  const scopePath = new URL('./', self.location).pathname;
  const path = url.pathname.startsWith(scopePath) ? url.pathname.slice(scopePath.length) : url.pathname;
  const strategy = strategyFor(path);

  if (strategy === 'asset') {
    event.respondWith(cacheFirst(request));
  } else if (strategy === 'shell') {
    event.respondWith(staleWhileRevalidate(request));
  }
  // 'network' falls through untouched: the worker never intercepts it.
});
