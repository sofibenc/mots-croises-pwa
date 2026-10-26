// Service worker : appli disponible hors ligne + réception des captures partagées.
// Change VERSION à chaque déploiement pour que les téléphones récupèrent la nouvelle version.
const VERSION = "mc-v6";
const SHARE_CACHE = "mc-share";
const FILES = [
  "./",
  "./index.html",
  "./recognize.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./vendor/tesseract.min.js",
  "./vendor/worker.min.js",
  "./core/tesseract-core-lstm.wasm.js",
  "./core/tesseract-core-simd-lstm.wasm.js",
  "./lang/fra.traineddata.gz"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== SHARE_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  // « Partager vers… » : on garde l'image de côté puis on ouvre l'appli, qui la récupère
  if (req.method === "POST" && url.origin === location.origin && url.pathname.endsWith("/share")) {
    event.respondWith((async () => {
      const form = await req.formData();
      const file = form.get("image");
      if (file && typeof file !== "string") {
        const cache = await caches.open(SHARE_CACHE);
        await cache.put("shared-image", new Response(file, { headers: { "content-type": file.type || "image/png" } }));
      }
      return Response.redirect(new URL("./?shared=1", self.registration.scope).href, 303);
    })());
    return;
  }

  if (req.method !== "GET") return;

  // Polices Google : servies depuis le cache, rafraîchies en arrière-plan
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(caches.open(VERSION).then(async cache => {
      const hit = await cache.match(req);
      const net = fetch(req).then(res => { cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  if (url.origin !== location.origin) return;

  // Fichiers de l'appli : cache d'abord, réseau sinon
  event.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: req.mode === "navigate" });
    if (hit) return hit;
    try { return await fetch(req); }
    catch (e) {
      if (req.mode === "navigate") return caches.match("./index.html");
      throw e;
    }
  })());
});
