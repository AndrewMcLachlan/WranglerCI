// Registers the service worker that makes Wrangler installable as a PWA.
// Only runs in production builds; the dev server doesn't ship the SW so
// HMR isn't affected.
export const registerServiceWorker = () => {
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker registration failed", err);
    });
  });
};
