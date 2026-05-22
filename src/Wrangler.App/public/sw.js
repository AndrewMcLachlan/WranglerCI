// Wrangler CI service worker — scaffolding only.
//
// Required for the browser to treat the app as installable; deliberately
// has no caching strategy yet so we don't serve stale assets while the
// app is still in active development. Offline support can be layered on
// later by adding install/activate/fetch handlers that pre-cache the
// shell and serve cached responses on failure.

self.addEventListener("install", (event) => {
  // Take over immediately so the new SW becomes active without waiting
  // for all tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass everything through to the network. Without a fetch handler at all,
// Chrome won't treat the SW as "controlling" the page on first install,
// which blocks the install prompt.
self.addEventListener("fetch", () => {});
