const CACHE = "chingadazo-v131";
const CORE = ["/js/hours.js?v=1", "/js/instance-config.js?v=1", "/css/chingadazo.css?v=1", "/js/gps.js?v=120", "/js/messages.js?v=118", "/icons/google.svg", "/js/finance.js?v=114", "/css/finance.css?v=114", "/", "/index.html", "/personal", "/personal.html", "/css/styles.css?v=118", "/js/auth.js?v=121", "/js/transport.js?v=112.2", "/js/data.js?v=112.2", "/js/store.js?v=112.2", "/js/ops.js?v=116", "/js/sync.js?v=118", "/js/printer.js?v=112.2", "/js/updates-v112.js?v=117", "/js/screens.js?v=112.2", "/js/app.js?v=123", "/informacion.html", "/manifest.json", "/personal-manifest.json", "/assets/logo.jpg"];
CORE.push('/js/continuity.js?v=1', '/js/app.js?v=124', '/js/app.js?v=125', '/js/dining.js?v=1', '/css/dining.css?v=1');
CORE.push('/js/continuity.js?v=2','/js/app.js?v=126','/js/dining.js?v=2','/js/dining-cash.js?v=1','/js/dining-kitchen.js?v=1','/js/dining-composer.js?v=1','/css/dining-cash.css?v=1');
CORE.push('/js/screens.js?v=127','/js/app.js?v=127','/js/dining-cash.js?v=127','/css/dining-cash.css?v=127','/js/cash-screens.js?v=1');
CORE.push('/js/printer.js?v=128','/js/app.js?v=128');
CORE.push('/js/dining.js?v=129','/js/dining-cash.js?v=129');
CORE.push('/js/native-bridge.js?v=1','/js/printer.js?v=130','/js/app.js?v=130','/js/dining-cash.js?v=130');
CORE.push('/js/cash-screens.js?v=131','/js/dining.js?v=131');
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => /^chingadazo-v\d+(?:-\d+)?$/.test(k) && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  // Application code and API responses must never fall back to an obsolete
  // cached copy; an old cashier screen must not bypass current controls.
  const url = new URL(e.request.url);
  // External scripts/fonts must retain their native request destination and CSP.
  // Re-fetching them here applies connect-src and breaks the Google auth loader.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/js/") || url.pathname.startsWith("/api/") || url.pathname === "/" || url.pathname.endsWith(".html") || url.pathname.endsWith(".css")) {
    e.respondWith(fetch(e.request, { cache: "no-store" }).catch(async () =>
      (await caches.match(e.request)) || new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })));
    return;
  }
  e.respondWith(fetch(e.request).then((response) => {
    if (e.request.method === "GET" && url.origin === self.location.origin && response.ok) {
      const copy = response.clone();
      e.waitUntil(caches.open(CACHE).then((cache) => cache.put(e.request, copy)));
    }
    return response;
  }).catch(async () => (await caches.match(e.request)) || new Response("Sin conexión", { status: 503 })));
});
self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "notify" && self.registration && self.registration.showNotification) {
    e.waitUntil(self.registration.showNotification(d.title || "El Chingadazo", {
      body: d.body || "",
      icon: "assets/logo.jpg",
      badge: "assets/logo.jpg",
      tag: d.tag || "blast",
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: [200, 80, 200],
      data: { url: "/" }
    }));
  }
});
self.addEventListener("push", (e) => {
  let d={};
  try { d=e.data?e.data.json():{}; } catch { d={body:e.data?.text()||""}; }
  const n=d.notification||d, url=d?.data?.url||n?.data?.url||"/";
  e.waitUntil(self.registration.showNotification(n.title||"El Chingadazo",{
    body:n.body||"Tienes una nueva actualización.",
    icon:n.icon||"/assets/logo.jpg",badge:n.badge||"/assets/logo.jpg",
    tag:n.tag||"chingadazo-alert",renotify:true,requireInteraction:true,silent:false,
    vibrate:n.vibrate||[500,120,500,120,900],data:{url}
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target=e.notification?.data?.url||"/";
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled:true }).then((list) => {
    const existing=list.find((client)=>new URL(client.url).pathname===new URL(target,self.location.origin).pathname);
    if (existing) return existing.focus();
    return clients.openWindow(target);
  }));
});
