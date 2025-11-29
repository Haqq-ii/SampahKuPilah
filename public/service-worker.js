// Service Worker untuk SampahKuPilah PWA
// Versi cache: skp-pwa-v1
// Update versi ini saat ada perubahan besar pada asset untuk memaksa update cache

const CACHE_NAME = 'skp-pwa-v1';
const RUNTIME_CACHE = 'skp-runtime-v1';

// Daftar asset utama yang akan di-cache saat install
// Update daftar ini jika ada file baru yang penting
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/css/common.css',
  '/css/landing.css',
  '/css/auth.css',
  '/css/dashboard.css',
  '/css/katalog.css',
  '/css/marketplace.css',
  '/css/profile.css',
  '/style.css',
  '/landing.js',
  '/script.js',
  '/js/notification.js',
  '/js/indonesia-regions.js',
  '/js/leaderboard.js',
  '/js/marketplace.js',
  '/js/marketplace-create.js',
  '/js/marketplace-detail.js',
  '/js/marketplace-orders.js',
  '/js/marketplace-order-detail.js',
  '/js/password-validator.js',
  '/password-toggle.js',
  '/camera-detection.js',
  '/katalog.html',
  '/katalog.js',
  '/login.html',
  '/register.html',
  '/forgot-password.html',
  '/welcome.html',
  '/profile.html',
  '/profile.js',
  '/leaderboard.html',
  '/marketplace.html',
  '/marketplace-create.html',
  '/marketplace-detail.html',
  '/marketplace-orders.html',
  '/marketplace-order-detail.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.webmanifest'
];

// Event: Install - Pre-cache asset utama
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...', CACHE_NAME);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pre-caching assets');
        // Cache semua asset utama
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn('[Service Worker] Some assets failed to cache:', err);
          // Lanjutkan meskipun ada beberapa asset yang gagal
          return Promise.resolve();
        });
      })
      .then(() => {
        // Force activation setelah install selesai
        return self.skipWaiting();
      })
  );
});

// Event: Activate - Bersihkan cache lama
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...', CACHE_NAME);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Hapus cache lama yang bukan versi saat ini
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      // Ambil kontrol semua clients
      return self.clients.claim();
    })
  );
});

// Event: Fetch - Strategi caching
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension dan external API calls
  if (url.protocol === 'chrome-extension:' || 
      url.origin !== location.origin && 
      !url.pathname.startsWith('/api/')) {
    return;
  }
  
  // Strategi: Cache First untuk asset statis (CSS, JS, gambar, fonts)
  if (request.destination === 'style' || 
      request.destination === 'script' || 
      request.destination === 'image' ||
      request.destination === 'font' ||
      url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/i)) {
    
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[Service Worker] Cache hit:', url.pathname);
            return cachedResponse;
          }
          
          // Jika tidak ada di cache, fetch dari network
          return fetch(request)
            .then((response) => {
              // Validasi response
              if (!response || response.status !== 200 || response.type === 'error') {
                return response;
              }
              
              // Clone response untuk cache
              const responseToCache = response.clone();
              
              // Simpan ke runtime cache
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, responseToCache);
              });
              
              return response;
            })
            .catch((err) => {
              console.error('[Service Worker] Fetch failed:', err);
              // Fallback untuk halaman HTML
              if (request.destination === 'document') {
                return caches.match('/index.html');
              }
              throw err;
            });
        })
    );
    return;
  }
  
  // Strategi: Network First dengan fallback cache untuk halaman HTML dan API
  if (request.destination === 'document' || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Validasi response
          if (!response || response.status !== 200 || response.type === 'error') {
            throw new Error('Network response was not ok');
          }
          
          // Clone response untuk cache (hanya untuk HTML, bukan API)
          if (request.destination === 'document') {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          
          return response;
        })
        .catch((err) => {
          console.log('[Service Worker] Network failed, trying cache:', url.pathname);
          // Fallback ke cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Fallback ke index.html untuk halaman HTML
            if (request.destination === 'document') {
              return caches.match('/index.html');
            }
            throw err;
          });
        })
    );
    return;
  }
  
  // Default: Network only untuk request lainnya
  event.respondWith(fetch(request));
});

// Event: Message - Handle pesan dari client (untuk update cache manual)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});

