import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";
import { initUpdateChecker, applyUpdate } from "@/lib/pwaUpdater";

const UpdateNotification = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    initUpdateChecker(() => {
      setUpdateAvailable(true);
    });
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      await applyUpdate();
    } catch (error) {
      console.error('Error applying update:', error);
      setUpdating(false);
    }
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
      <Alert className="shadow-lg bg-primary text-primary-foreground border-primary">
        <RefreshCw className="h-4 w-4" />
        <AlertTitle className="font-bold">تحديث متوفر!</AlertTitle>
        <AlertDescription className="mt-2 flex items-center justify-between gap-4">
          <span className="text-sm">
            يتوفر إصدار جديد من التطبيق
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleUpdate}
              disabled={updating}
            >
              {updating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                "تحديث"
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setUpdateAvailable(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default UpdateNotification;