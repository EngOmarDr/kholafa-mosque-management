// PWA Update Manager - Handles app updates and caching

export const checkForUpdates = async (): Promise<boolean> => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        return !!registration.waiting;
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  }
  return false;
};

export const applyUpdate = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    
    if (registration?.waiting) {
      // Tell the waiting service worker to activate
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Wait for the new service worker to activate with timeout
      await Promise.race([
        new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            resolve();
          }, { once: true });
        }),
        // Timeout after 3 seconds
        new Promise<void>((resolve) => setTimeout(resolve, 3000))
      ]);
    }
    
    // Reload the page in all cases
    window.location.reload();
  } else {
    // If no Service Worker, just reload
    window.location.reload();
  }
};

export const initUpdateChecker = (onUpdateAvailable: () => void): void => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      // Check for updates every hour
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              onUpdateAvailable();
            }
          });
        }
      });
    });
  }
};