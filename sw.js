// Offline cache: text opens instantly from the saved copy, then refreshes in the background.
const CACHE = "aps-v2";
const CORE = ["./", "index.html", "styles.css", "config.js", "app.js", "data/manifest.json"];
const CDN = ["cdnjs.cloudflare.com", "cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    try {
      const manifest = await (await fetch("data/manifest.json", { cache: "no-cache" })).json();
      const text = [...manifest.courses.map((c) => c.file), ...manifest.pages.map((p) => p.file)];
      await cache.addAll(text);
    } catch (e) { /* text will be cached on first view instead */ }
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // Stale-while-revalidate: answer from cache, update it from the network for next time.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req, { ignoreVary: true });
      const network = fetch(req).then((res) => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    })());
  } else if (CDN.includes(url.hostname)) {
    // Libraries and fonts never change at a pinned version: cache first.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok || res.type === "opaque") cache.put(req, res.clone());
      return res;
    })());
  }
  // Everything else (Google Sheet) goes straight to the network.
});
