// オフラインでも起動できるよう、アプリ本体と MediaPipe のファイルをキャッシュします。
// index.html を更新したら VERSION を上げてください。
// build: export-import backup (Dropbox sync removed)
const VERSION = 'sampler-v9';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  // HTTPキャッシュを避けて最新ファイルを取得
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.all(FILES.map(u =>
        fetch(new Request(u, { cache: 'reload' })).then(r => (r.ok ? c.put(u, r) : null)).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // MediaPipe（CDN）：初回取得時にキャッシュ → 2回目以降はオフラインでも動作
  if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/@mediapipe/')) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return res;
      }))
    );
    return;
  }
  // アプリ本体：ネット優先（常に最新）→ オフライン時はキャッシュ
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok && url.origin === location.origin) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html')))
  );
});
