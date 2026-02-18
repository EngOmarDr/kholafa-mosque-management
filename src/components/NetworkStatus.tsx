import { useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSyncQueue, processSyncQueue } from "@/lib/backgroundSync";
import { toast } from "sonner";

const NetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showAlert, setShowAlert] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // تحديث عدد العمليات المعلقة
  useEffect(() => {
    const updatePendingCount = () => {
      const queue = getSyncQueue();
      setPendingCount(queue.length);
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 2000);

    // الاستماع لحدث المزامنة
    const handleSyncComplete = () => {
      updatePendingCount();
    };
    window.addEventListener('sync-complete', handleSyncComplete);

    return () => {
      clearInterval(interval);
      window.removeEventListener('sync-complete', handleSyncComplete);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowAlert(true);
      setTimeout(() => setShowAlert(false), 5000);
      
      // بدء المزامنة التلقائية
      const queue = getSyncQueue();
      if (queue.length > 0) {
        processSyncQueue();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowAlert(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await processSyncQueue();
      toast.success("تمت المزامنة بنجاح");
    } catch (error) {
      toast.error("فشلت المزامنة");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      {/* إشعار مؤقت عند تغيير الحالة */}
      {showAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
          <Alert
            variant={isOnline ? "default" : "destructive"}
            className="shadow-lg animate-in fade-in slide-in-from-top-2 duration-300"
          >
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <Wifi className="h-5 w-5 text-green-500" />
                ) : (
                  <WifiOff className="h-5 w-5" />
                )}
                <AlertDescription className="font-semibold text-sm">
                  {isOnline
                    ? "تم استعادة الاتصال بالإنترنت"
                    : "لا يوجد اتصال - يعمل التطبيق بوضع Offline"}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        </div>
      )}
      
      {/* شريط صغير ثابت في الأعلى عند وضع Offline */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-center py-2 text-sm z-50 font-medium">
          ⚠️ وضع Offline - البيانات تُحفظ محلياً وسيتم المزامنة عند توفر الإنترنت
        </div>
      )}
      
      {/* شريط عند استعادة الاتصال مع زر مزامنة */}
      {isOnline && pendingCount > 0 && (
        <div className="fixed top-0 left-0 right-0 bg-green-500 text-white text-center py-2 text-sm z-50 flex items-center justify-center gap-3">
          <span className="font-medium">
            ✅ الاتصال متاح - {pendingCount} عملية في الانتظار
          </span>
          <Button 
            size="sm" 
            onClick={handleManualSync}
            disabled={syncing}
            className="h-7 bg-white text-green-600 hover:bg-green-50"
          >
            {syncing ? (
              <>
                <RefreshCw className="h-3 w-3 ml-1 animate-spin" />
                جاري المزامنة...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 ml-1" />
                مزامنة الآن
              </>
            )}
          </Button>
        </div>
      )}
    </>
  );
};

export default NetworkStatus;