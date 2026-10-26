/* OviCore mobile offline shell service worker */
const CACHE_VERSION = "ovicore-mobile-shell-v2";
const MOBILE_FALLBACK = "/mobile";
const LOGIN_FALLBACK = "/login?next=%2Fmobile";

const PRELOAD_URLS = [
  MOBILE_FALLBACK,
  LOGIN_FALLBACK,
  "/manifest.webmanifest",
  "/assets/ovicore-icon.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      // One missing optional asset must not prevent the service worker from
      // installing. Cache each shell resource independently.
      await Promise.allSettled(
        PRELOAD_URLS.map(async (url) => {
          const response = await fetch(url, {
            credentials: "same-origin",
            cache: "no-store",
          });

          if (response.ok) {
            await cache.put(url, response.clone());
          }
        }),
      );
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("ovicore-mobile-shell-") &&
                key !== CACHE_VERSION,
            )
            .map((key) => caches.delete(key)),
        ),
      ),
    ]),
  );
});

function isApiRequest(url) {
  return url.pathname === "/api" || url.pathname.startsWith("/api/");
}

function isMobileNavigation(url) {
  return (
    url.pathname === "/mobile" ||
    url.pathname.startsWith("/mobile/") ||
    url.pathname === "/login"
  );
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_VERSION);

  try {
    const response = await fetch(request);

    if (response.ok) {
      await cache.put(request, response.clone());

      const url = new URL(request.url);
      if (url.pathname === "/mobile") {
        await cache.put(MOBILE_FALLBACK, response.clone());
      }
    }

    return response;
  } catch {
    const exact = await cache.match(request, { ignoreSearch: false });
    if (exact) return exact;

    const url = new URL(request.url);

    if (url.pathname === "/login") {
      const login = await cache.match(LOGIN_FALLBACK, { ignoreSearch: true });
      if (login) return login;
    }

    const mobile = await cache.match(MOBILE_FALLBACK, { ignoreSearch: true });
    if (mobile) return mobile;

    return new Response(
      "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head><body style=\"font-family:system-ui;background:#f5f8f6;color:#174734;padding:32px\"><h2>OviCore is offline</h2><p>Connect once while signed in so this device can save the mobile app for offline use.</p></body></html>",
      {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API data is deliberately not cached here. The mobile app owns its
  // offline data cache and IndexedDB sync queue.
  if (isApiRequest(url)) return;

  if (request.mode === "navigate" && isMobileNavigation(url)) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Cache Next.js JS/CSS chunks, fonts, icons and other same-origin assets
  // as they are used. This makes a later cold start independent of reception.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname === "/manifest.webmanifest" ||
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font" ||
    request.destination === "image"
  ) {
    event.respondWith(cacheFirstAsset(request));
  }
});
