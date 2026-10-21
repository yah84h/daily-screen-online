// يعمل لصفحة التلفزيون فقط: يحتفظ بآخر نسخة من الصفحة والخطوط لإعادة التحميل دون اتصال.
const CACHE = 'daily-screen-online-v2';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/index.html', '/fonts.css', '/workspace.jpg', '/school_font.ttf', '/branding/ministry-of-education.svg', '/branding/tuwaiq-academy.svg'])));
  self.skipWaiting();
});
self.addEventListener('activate', (e) =>
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('daily-screen-') && k !== CACHE).map((k) => caches.delete(k)))),
    ]),
  ),
);
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.origin !== location.origin) return; // Supabase لا يُخزَّن هنا؛ الصور تُخزَّن في IndexedDB
  if (u.pathname.startsWith('/admin') || u.pathname.startsWith('/login')) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/index.html'))),
  );
});
