import * as React from "react";

const MOBILE_BREAKPOINT = 768;

// الكشف عن وضع PWA
function isPWAMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

// الكشف عن جهاز اللمس
function isTouchDevice(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    // في SSR أو قبل التحميل، نفترض mobile إذا كان PWA
    if (typeof window === 'undefined') return false;
    return isPWAMode() || isTouchDevice() || window.innerWidth < MOBILE_BREAKPOINT;
  });

  React.useEffect(() => {
    const checkMobile = () => {
      // في وضع PWA أو جهاز لمس، نعتبره دائماً mobile
      if (isPWAMode() || isTouchDevice()) {
        setIsMobile(true);
        return;
      }
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const pwaQuery = window.matchMedia('(display-mode: standalone)');
    
    mql.addEventListener("change", checkMobile);
    pwaQuery.addEventListener("change", checkMobile);
    
    checkMobile();
    
    return () => {
      mql.removeEventListener("change", checkMobile);
      pwaQuery.removeEventListener("change", checkMobile);
    };
  }, []);

  return isMobile;
}

// Hook إضافي للكشف عن PWA
export function useIsPWA() {
  const [isPWA, setIsPWA] = React.useState(false);
  
  React.useEffect(() => {
    setIsPWA(isPWAMode());
  }, []);
  
  return isPWA;
}
