import { useState, useEffect } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSyncQueue, processSyncQueue } from "@/lib/backgroundSync";
import { toast } from "sonner";

const SyncStatusIndicator = () => {
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    updateQueueCount();
    
    // Update queue count periodically
    const interval = setInterval(updateQueueCount, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const updateQueueCount = () => {
    const queue = getSyncQueue();
    setQueueCount(queue.length);
  };

  const handleManualSync = async () => {
    if (!navigator.onLine) {
      toast.error("لا يوجد اتصال بالإنترنت");
      return;
    }

    setSyncing(true);
    try {
      await processSyncQueue();
      updateQueueCount();
      toast.success("تم مزامنة البيانات بنجاح");
    } catch (error) {
      toast.error("فشلت المزامنة");
    } finally {
      setSyncing(false);
    }
  };

  if (queueCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="flex items-center gap-2 bg-background border rounded-lg p-3 shadow-lg">
        <CloudOff className="w-5 h-5 text-amber-500" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold">بيانات غير متزامنة</span>
          <span className="text-xs text-muted-foreground">
            {queueCount} عملية في الانتظار
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleManualSync}
          disabled={syncing || !navigator.onLine}
        >
          {syncing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Cloud className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
};

export default SyncStatusIndicator;