// 오프라인 대비용 앱 셸 캐시. 온라인이면 항상 네트워크의 최신 파일을 쓰고, 캐시는 네트워크가 안 될 때만 쓴다.
// (캐시를 먼저 쓰면 재배포 뒤 새 index.html과 옛 app.js가 섞일 수 있다.)
const CACHE_NAME = 'jolupgak-shell-v14';
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/engine.js',
  '/i18n.js',
  '/theme.js',
  '/schedule.js',
  '/login.html',
  '/privacy.html',
  '/terms.html',
  '/manifest.webmanifest',
  '/pwa-icon.svg',
  '/favicon.svg',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/brand/logo-light.svg',
  '/brand/logo-dark.svg',
  '/brand/symbol-light.svg',
  '/brand/symbol-dark.svg',
  '/data/calendar.json',
  '/data/categories.json',
  '/data/curriculum.json',
  '/data/requirements.json',
  '/data/core_areas.json',
  '/sample/capture.png',
  '/sample/parsed.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())); // 페이지마다 제 주소로 저장
        return response;
      }).catch(async () => (await caches.match(request)) || (await caches.match('/index.html'))),
    );
    return;
  }

  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      return response;
    }).catch(async () => (await caches.match(request)) || Response.error()),
  );
});