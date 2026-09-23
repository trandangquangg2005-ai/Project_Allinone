/* AIO service worker.
 *
 * Goal: the app opens and reads normally with no connection, and costs as
 * little as possible when there is one. Anything already fetched is served
 * from the device instead of the network, so a month of daily use stays well
 * inside the free plans this runs on.
 *
 * Writes are NOT handled here — they go through the app's own queue in
 * IndexedDB, which survives a closed tab and replays in one batch.
 */

const VERSION = "v1";
const PAGES = `aio-pages-${VERSION}`; // HTML documents and RSC payloads
const ASSETS = `aio-assets-${VERSION}`; // /_next/static, icons, fonts
const PHOTOS = `aio-photos-${VERSION}`; // check-in photos; immutable
const OFFLINE_URL = "/offline";

/** Keeps the photo cache from growing without bound on a phone. */
const PHOTO_LIMIT = 400;
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.add(OFFLINE_URL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith("aio-") && !key.endsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "clear-caches") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("aio-")).map((k) => caches.delete(k)))));
  }
});

async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - limit; i += 1) await cache.delete(keys[i]);
}

/** Immutable by construction: hashed asset URLs and photo ids are never reused. */
async function cacheFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type !== "opaque") {
    await cache.put(request, response.clone());
    if (limit) trim(cacheName, limit);
  }
  return response;
}

/**
 * Fresh when possible, last known copy otherwise. The timeout matters on a
 * flaky mobile connection, where a request can hang far longer than it takes
 * to show what we already have.
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS)),
    ]);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    if (request.mode === "navigate") {
      const fallback = await cache.match(OFFLINE_URL);
      if (fallback) return fallback;
    }
    throw new Error("offline");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // writes are queued by the app itself

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache: auth, the sync endpoint, and anything that sets a session.
  if (url.pathname.startsWith("/api/sync") || url.pathname.startsWith("/login") || url.pathname.startsWith("/change-password")) {
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(cacheFirst(request, ASSETS));
    return;
  }

  if (/^\/api\/photos\//.test(url.pathname) || /^\/p\/[^/]+\/photos\//.test(url.pathname)) {
    event.respondWith(cacheFirst(request, PHOTOS, PHOTO_LIMIT));
    return;
  }

  // Pages: both the HTML document and the RSC payload React fetches on a
  // client-side navigation, so moving between tabs works offline too.
  if (request.mode === "navigate" || request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    event.respondWith(networkFirst(request, PAGES));
  }
});
