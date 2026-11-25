// PARTFLOW service worker: caches the app shell so the app opens offline. It never touches Firebase traffic (cross-origin),
// and Firestore keeps its own offline cache. Part-taking writes still require a connection (they are server-validated transactions).
const V = 'partflow-v2'
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/brand/partflow-wordmark.webp', '/brand/partflow-mark.webp'])).then(() => self.skipWaiting())) })
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())) })
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return
  const u = new URL(r.url); if (u.origin !== location.origin) return
  if (r.mode === 'navigate') { e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(V).then(x => x.put('/index.html', c)) } return res }).catch(() => caches.match('/index.html'))); return }
  if (u.pathname.startsWith('/assets/') || /\.(png|webp|ico|webmanifest)$/.test(u.pathname)) {
    e.respondWith(caches.match(r).then(h => h || fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(V).then(x => x.put(r, c)) } return res })))
  }
})
