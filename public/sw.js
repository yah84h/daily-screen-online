// يعمل لصفحة التلفزيون فقط: يحتفظ بآخر نسخة من الصفحة والخطوط لإعادة التحميل دون اتصال.
const CACHE = 'daily-screen-online-v33';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/index.html', '/fonts.css', '/workspace.jpg', '/school_font.ttf', '/branding/ministry-of-education.svg', '/branding/tuwaiq-academy.svg'])));
  self.skipWaiting();
});
self.addEventListener('activate', (e) =>
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('daily-screen-') && k !== CACHE && k !== 'daily-screen-media').map((k) => caches.delete(k)))),
    ]),
  ),
);
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith('/local/')) return;
  if (/\.(mp4|webm)$/i.test(u.pathname)) {
    e.respondWith(fetch(e.request).catch(async()=>{
      const cached=await (await caches.open('daily-screen-media')).match(e.request.url);
      if(!cached)return Response.error();
      const range=e.request.headers.get('Range');if(!range)return cached;
      const bytes=await cached.arrayBuffer(),m=/^bytes=(\d+)-(\d*)$/.exec(range);
      if(!m)return cached;
      const start=Number(m[1]),end=Math.min(Number(m[2]||bytes.byteLength-1),bytes.byteLength-1);
      if(start>end)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${bytes.byteLength}`}});
      return new Response(bytes.slice(start,end+1),{status:206,headers:{'Content-Type':cached.headers.get('Content-Type')||'video/mp4','Content-Length':String(end-start+1),'Content-Range':`bytes ${start}-${end}/${bytes.byteLength}`,'Accept-Ranges':'bytes'}});
    }));return;
  }
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
