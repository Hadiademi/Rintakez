// Rintakez service worker (hand-written, source file — committed, not generated).
//
// Near-pass-through worker. It exists so the app qualifies as an installable
// PWA and can show a branded offline page — but it deliberately does NOT cache
// app chunks, HTML routes, or assets. A caching worker in development served
// stale JS chunks across rebuilds and broke the page in Chrome/Firefox.
//
// The ONLY thing it caches is the static `/offline.html` fallback, kept in a
// versioned cache. Fetches are pass-through EXCEPT navigation requests, which
// fall back to that page only when the network is unreachable. Normal loads
// therefore always hit the network (no stale chunks).

const OFFLINE_CACHE = "rintakez-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  // Precache ONLY the static offline page — nothing else.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(OFFLINE_CACHE);
      await cache.add(OFFLINE_URL);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  // Clean up caches from older worker versions, but KEEP the current offline
  // cache (older versions of this worker nuked everything on activate).
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== OFFLINE_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only intervene for top-level navigations. Everything else (chunks, assets,
  // API calls) goes straight to the network untouched — no caching, no
  // respondWith — so a stale chunk can never be served.
  if (request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        // Always try the live network first.
        return await fetch(request);
      } catch {
        // Network unreachable → serve the branded offline page.
        const cache = await caches.open(OFFLINE_CACHE);
        const cached = await cache.match(OFFLINE_URL);
        return cached ?? Response.error();
      }
    })(),
  );
});
