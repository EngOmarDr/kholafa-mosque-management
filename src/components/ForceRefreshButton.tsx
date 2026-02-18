import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { forceRefreshApp } from "@/lib/forceRefresh";

interface ForceRefreshButtonProps {
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
  showLabel?: boolean;
}

const ForceRefreshButton = ({ 
  size = "sm", 
  variant = "default",
  showLabel = true 
}: ForceRefreshButtonProps) => {
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  
  const handleForceRefresh = async () => {
    setRefreshing(true);
    toast.info("جاري تحديث البيانات من الخادم...");
    
    try {
      await forceRefreshApp(queryClient);
      toast.success("تم مسح الذاكرة المؤقتة، جاري التحديث...");
    } catch (error) {
      console.error('Force refresh error:', error);
      toast.error("حدث خطأ أثناء التحديث");
      setRefreshing(false);
    }
  };
  
  return (
    <Button 
      onClick={handleForceRefresh} 
      disabled={refreshing}
      size={size}
      variant={variant}
      className="gap-2"
    >
      <RefreshCw className={`${refreshing ? 'animate-spin' : ''} ${size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'}`} />
      {showLabel && (refreshing ? "جاري التحديث..." : "تحديث شامل")}
    </Button>
  );
};

export default ForceRefreshButton;
