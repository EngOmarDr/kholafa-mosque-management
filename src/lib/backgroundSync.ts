// Background Sync Manager for offline data synchronization

export type SyncItemType = 
  | 'attendance' 
  | 'recitation' 
  | 'bonus_points' 
  | 'student_update'
  | 'check_records'
  | 'teaching_session';

export interface SyncQueueItem {
  id: string;
  type: SyncItemType;
  data: any;
  timestamp: number;
}

const SYNC_QUEUE_KEY = 'pwa_sync_queue';

// Add item to sync queue
export const addToSyncQueue = (item: Omit<SyncQueueItem, 'id' | 'timestamp'>): void => {
  try {
    const queue = getSyncQueue();
    const newItem: SyncQueueItem = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    queue.push(newItem);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    
    // Register background sync if supported
    if ('serviceWorker' in navigator && 'sync' in navigator.serviceWorker) {
      navigator.serviceWorker.ready.then((registration: any) => {
        return registration.sync.register('sync-queue');
      }).catch((err: Error) => {
        console.error('Background sync registration failed:', err);
      });
    }
  } catch (error) {
    console.error('Error adding to sync queue:', error);
  }
};

// Get sync queue
export const getSyncQueue = (): SyncQueueItem[] => {
  try {
    const queueData = localStorage.getItem(SYNC_QUEUE_KEY);
    return queueData ? JSON.parse(queueData) : [];
  } catch (error) {
    console.error('Error getting sync queue:', error);
    return [];
  }
};

// Remove item from sync queue
export const removeFromSyncQueue = (itemId: string): void => {
  try {
    const queue = getSyncQueue();
    const updatedQueue = queue.filter(item => item.id !== itemId);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(updatedQueue));
  } catch (error) {
    console.error('Error removing from sync queue:', error);
  }
};

// Clear sync queue
export const clearSyncQueue = (): void => {
  try {
    localStorage.removeItem(SYNC_QUEUE_KEY);
  } catch (error) {
    console.error('Error clearing sync queue:', error);
  }
};

// Process sync queue (to be called when online)
export const processSyncQueue = async (): Promise<void> => {
  const queue = getSyncQueue();
  
  if (queue.length === 0) return;

  console.log(`Processing ${queue.length} items in sync queue...`);

  // Import supabase client dynamically to avoid circular dependencies
  const { supabase } = await import('@/integrations/supabase/client');
  
  // Import offline storage dynamically
  const offlineStorage = await import('./offlineStorage');

  for (const item of queue) {
    try {
      // Process based on type
      switch (item.type) {
        case 'attendance':
          await supabase.rpc('set_attendance', {
            p_student_id: item.data.student_id,
            p_date: item.data.date,
            p_status: item.data.status,
            p_points: item.data.points,
          });
          console.log('Synced attendance:', item.data);
          // مسح البيانات المحلية
          offlineStorage.clearLocalAttendance(item.data.student_id, item.data.date);
          break;
          
        case 'recitation':
          if (Array.isArray(item.data)) {
            await supabase.from('recitations').insert(item.data);
          } else {
            await supabase.from('recitations').insert([item.data]);
          }
          console.log('Synced recitation:', item.data);
          // مسح البيانات المحلية
          if (Array.isArray(item.data) && item.data.length > 0) {
            offlineStorage.clearLocalRecitations(item.data[0].student_id, item.data[0].date);
          } else if (item.data.student_id && item.data.date) {
            offlineStorage.clearLocalRecitations(item.data.student_id, item.data.date);
          }
          break;
          
        case 'bonus_points':
          await supabase.from('bonus_points').insert(item.data);
          console.log('Synced bonus points:', item.data);
          // مسح البيانات المحلية
          offlineStorage.clearLocalBonusPoints(item.data.student_id, item.data.date);
          break;
          
        case 'student_update':
          await supabase.from('students').update(item.data.updates).eq('id', item.data.studentId);
          console.log('Synced student update:', item.data);
          break;
          
        case 'check_records':
          if (Array.isArray(item.data)) {
            await supabase.from('check_records').insert(item.data);
          } else {
            await supabase.from('check_records').insert([item.data]);
          }
          console.log('Synced check records:', item.data);
          break;
          
        case 'teaching_session':
          await supabase.from('teaching_sessions').upsert(item.data);
          console.log('Synced teaching session:', item.data);
          break;
      }
      
      // Remove successfully synced item
      removeFromSyncQueue(item.id);
      
      // إطلاق حدث المزامنة الناجحة
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sync-complete', { detail: item }));
      }
    } catch (error) {
      console.error(`Error syncing item ${item.id}:`, error);
      // Keep item in queue for retry
    }
  }
};

// Monitor online status and sync when online
export const initBackgroundSync = (): void => {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', () => {
    console.log('Connection restored, processing sync queue...');
    processSyncQueue();
  });

  // Process queue on page load if online
  if (navigator.onLine) {
    processSyncQueue();
  }
};