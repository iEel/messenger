// Service Worker for Messenger Tracking System
// ★ Offline support: cache static assets + queue status updates

const CACHE_NAME = 'messenger-v1';
const STATIC_ASSETS = [
  '/',
  '/login',
  '/messenger',
  '/dispatcher',
  '/tasks',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and API calls — let them pass through
  if (event.request.method !== 'GET') return;

  // API calls: network-first with no cache
  if (url.pathname.startsWith('/api/')) return;

  // Static assets: network-first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline: serve from cache
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('/');
        });
      })
  );
});

// Background Sync: queue offline status updates
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-status-updates') {
    event.waitUntil(syncStatusUpdates());
  }
});

async function syncStatusUpdates() {
  // Get queued updates from IndexedDB
  try {
    const db = await openDB();
    const tx = db.transaction('offline-queue', 'readwrite');
    const store = tx.objectStore('offline-queue');
    const items = await getAllFromStore(store);

    for (const item of items) {
      try {
        await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
        });
        store.delete(item.id);
      } catch {
        // Still offline, leave in queue
        break;
      }
    }
  } catch {
    // IndexedDB not available
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('messenger-offline', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('offline-queue', { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllFromStore(store) {
  return new Promise((resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}
