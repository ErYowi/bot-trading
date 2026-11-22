// Service worker de ONYX: funciona sin conexión y recibe notificaciones push.
const CACHE = 'onyx-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'charts.js', 'github.js', 'manifest.webmanifest', 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Red primero para la app (siempre la última versión); caché si no hay conexión.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});

self.addEventListener('push', (e) => {
  let data = { title: 'ONYX', body: 'Nueva operación' };
  try { data = { ...data, ...e.data.json() }; } catch { /* texto plano */ }
  e.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: data.url || './' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate(target); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});
