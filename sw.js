// ApexPose AI — Service Worker
const CACHE_NAME = 'apexpose-v2.1.0';

// Файлы для кэширования при установке
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap',
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/+esm'
];

// Установка — кэшируем основные файлы
self.addEventListener('install', (event) => {
  console.log('[SW] Установка...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(CORE_ASSETS.map(url => new Request(url, { mode: 'no-cors' })));
      })
      .catch((err) => console.warn('[SW] Ошибка кэша:', err))
  );
  self.skipWaiting();
});

// Активация — удаляем старые кэши
self.addEventListener('activate', (event) => {
  console.log('[SW] Активация...');
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Не кэшируем запросы к камере, аналитике, чужим API
  if (req.method !== 'GET') return;
  if (req.url.startsWith('chrome-extension://')) return;
  if (req.url.includes('mediapipe-models')) {
    // Модель ИИ кэшируем стратегией "cache first"
    event.respondWith(cacheFirst(req));
    return;
  }
  if (req.url.includes('fonts.g')) {
    // Шрифты — "stale-while-revalidate"
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
  if (req.url.includes('cdn.jsdelivr') || req.url.includes('skypack')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Всё остальное — "network first" с fallback на кэш
  event.respondWith(networkFirst(req));
});

// Стратегии
async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const response = await fetch(req);
    if (response && response.status === 200) cache.put(req, response.clone());
    return response;
  } catch (e) {
    return cached || new Response('Offline', { status: 503 });
  }
}

async function networkFirst(req) {
  try {
    const response = await fetch(req);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, response.clone());
    }
    return response;
  } catch (e) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;

    // Если запрошена страница — отдаём index.html
    if (req.mode === 'navigate') {
      return cache.match('./index.html');
    }
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req).then((response) => {
    if (response && response.status === 200) cache.put(req, response.clone());
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}