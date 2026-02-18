import { QueryClient } from "@tanstack/react-query";

/**
 * مسح جميع Service Worker caches
 */
export const clearAllCaches = async (): Promise<void> => {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('All browser caches cleared');
  }
};

/**
 * إرسال رسالة للـ Service Worker لمسح الـ cache
 */
export const notifyServiceWorker = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage({ type: 'CLEAR_CACHE' });
      console.log('Service Worker notified to clear cache');
    }
  }
};

/**
 * التحديث الإجباري الشامل
 * يمسح كل الـ caches ويعيد تحميل الصفحة لجلب البيانات من الخادم
 */
export const forceRefreshApp = async (queryClient: QueryClient): Promise<void> => {
  try {
    // 1. مسح React Query cache
    queryClient.clear();
    console.log('React Query cache cleared');
    
    // 2. مسح Service Worker caches
    await clearAllCaches();
    
    // 3. إبلاغ Service Worker
    await notifyServiceWorker();
    
    // 4. إعادة تحميل الصفحة بدون cache
    setTimeout(() => {
      window.location.reload();
    }, 500);
  } catch (error) {
    console.error('Error during force refresh:', error);
    throw error;
  }
};
