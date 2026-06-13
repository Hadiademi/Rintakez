// Rintakez service worker (hand-written, source file — committed, not generated).
// Minimal network-first SW that makes the app installable.
// Safety: only handles same-origin GET requests, so it NEVER caches or serves
// stale Supabase responses (different origin) or non-GET API/auth mutations.
const CACHE = "rintakez-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop old cache versions.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Skip cross-origin (e.g. Supabase, image CDNs) — let the network handle them.
  if (url.origin !== self.location.origin) return;

  // Network-first: always try fresh, fall back to cache when offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches
          .open(CACHE)
          .then((cache) => cache.put(request, copy))
          .catch(() => {});
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
