// Custom Service Worker for advanced PWA features

// Handle service worker installation
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting(); // Activate immediately
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(clients.claim()); // Take control immediately
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // معالج مسح الـ cache بالكامل
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(clearAllCaches());
  }
});

// معالج طلبات الشبكة - للتنقل فقط
self.addEventListener('fetch', (event) => {
  // فقط لطلبات HTML/navigation
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // الطلب نجح - إرجاع الاستجابة
          return response;
        })
        .catch(async () => {
          // فشل الطلب - محاولة جلب من الـ cache
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // محاولة جلب index.html من الـ cache
          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) {
            return cachedIndex;
          }
          
          // فقط إذا لم يكن هناك أي cache، نعرض offline.html
          const offlinePage = await caches.match('/offline.html');
          return offlinePage || new Response('لا يوجد اتصال بالإنترنت', {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        })
    );
  }
});

// دالة مسح جميع الـ caches
async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('Service Worker: All caches cleared by force refresh');
  } catch (error) {
    console.error('Service Worker: Error clearing caches:', error);
  }
}

// Background Sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(syncQueueData());
  }
});

async function syncQueueData() {
  try {
    // Get sync queue from IndexedDB or send message to app
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_QUEUE',
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

// Push Notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');
  
  let data = {
    title: 'حلقات السلام',
    body: 'إشعار جديد',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: '/' }
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || payload.message || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || `notification-${Date.now()}`,
        data: payload.data || { url: '/' }
      };
    }
  } catch (e) {
    console.log('[SW] Error parsing push data:', e);
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    vibrate: [100, 50, 100],
    requireInteraction: true,
    data: data.data
  };

  console.log('[SW] Showing notification:', data.title, options);
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open new window if no existing window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Periodic Background Sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-sync') {
    event.waitUntil(syncContent());
  }
});

async function syncContent() {
  try {
    // Fetch latest data in background
    console.log('Periodic sync running...');
    
    // Notify app of new content
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'NEW_CONTENT_AVAILABLE',
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('Periodic sync failed:', error);
  }
}