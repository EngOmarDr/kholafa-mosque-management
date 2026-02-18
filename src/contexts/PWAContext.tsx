import React, { createContext, useContext, useEffect, useState } from 'react';

interface PWAContextType {
  isPWA: boolean;
  isMobileDevice: boolean;
  forceDesktopView: boolean;
  setForceDesktopView: (value: boolean) => void;
}

const PWAContext = createContext<PWAContextType>({
  isPWA: false,
  isMobileDevice: false,
  forceDesktopView: false,
  setForceDesktopView: () => {},
});

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [isPWA, setIsPWA] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [forceDesktopView, setForceDesktopView] = useState(false);
  
  useEffect(() => {
    // كشف PWA
    const pwaMode = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsPWA(pwaMode);
    
    // كشف جهاز موبايل
    const mobileDevice = 
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    setIsMobileDevice(mobileDevice);
    
    // إضافة class للـ body
    if (pwaMode) {
      document.body.classList.add('pwa-mode');
    }
    if (mobileDevice) {
      document.body.classList.add('mobile-device');
    }
    
    return () => {
      document.body.classList.remove('pwa-mode');
      document.body.classList.remove('mobile-device');
    };
  }, []);
  
  return (
    <PWAContext.Provider value={{ isPWA, isMobileDevice, forceDesktopView, setForceDesktopView }}>
      {children}
    </PWAContext.Provider>
  );
}

export const usePWA = () => useContext(PWAContext);
