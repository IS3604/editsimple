/* EditSimple Studio service worker: shows push notifications and opens the right page when one is clicked. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: 'EditSimple Studio', body: event.data ? event.data.text() : '' }; }
  const title = d.title || 'EditSimple Studio';
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: '/apple-icon.png',
    badge: '/apple-icon.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    requireInteraction: false,
    data: { url: d.url || '/website/leads' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (new URL(c.url).origin === self.location.origin) {
        await c.focus();
        try { await c.navigate(url); } catch { /* older browsers */ }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
