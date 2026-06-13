// Rintakez service worker (hand-written, source file — committed, not generated).
//
// Pass-through worker: it exists so the app qualifies as an installable PWA,
// but it intentionally does NOT cache or serve any responses. A caching worker
// in development served stale JS chunks across rebuilds and broke the page in
// Chrome/Firefox. This version never intercepts responses, and on activation it
// deletes any caches left behind by older worker versions — so browsers that
// installed a previous SW self-heal on the next load.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// A fetch listener must exist for installability, but we let every request go
// straight to the network untouched (no respondWith, no caching).
self.addEventListener("fetch", () => {});
