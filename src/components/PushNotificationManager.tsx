import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// VAPID Public Key - يجب أن يكون نفس المفتاح المخزن في Supabase Secrets
const VAPID_PUBLIC_KEY = "BNo_ESsf5u2eB1FIJ-27s-5QyfRqQKW6jCgU0x8r3R_G2Fthe8ycqbn5Zn9qytMWWYb9bYgy_ymy9_Ls8ocGyyg";

const PushNotificationManager = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if Push Notifications are supported
    if ("Notification" in window && "serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  };

  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeToNotifications = async () => {
    if (!isSupported) {
      toast.error("المتصفح لا يدعم الإشعارات");
      return;
    }

    setLoading(true);
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      
      if (permission !== "granted") {
        toast.error("تم رفض إذن الإشعارات");
        setLoading(false);
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push notifications with real VAPID key
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer
      });

      // Convert subscription to JSON format
      const subscriptionData = subscription.toJSON();

      // Save subscription to database
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // First, try to delete any existing subscription for this user
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id);

        // Insert new subscription
        const { error: insertError } = await supabase
          .from('push_subscriptions')
          .insert([{
            user_id: user.id,
            subscription_data: subscriptionData as any,
            device_info: navigator.userAgent,
            is_active: true,
          }]);

        if (insertError) {
          throw insertError;
        }
        
        setIsSubscribed(true);
        toast.success("تم تفعيل الإشعارات بنجاح!");
      }
    } catch (error) {
      console.error("Error subscribing to notifications:", error);
      toast.error("فشل تفعيل الإشعارات");
    } finally {
      setLoading(false);
    }
  };

  const unsubscribeFromNotifications = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        await supabase
          .from('push_subscriptions')
          .update({ is_active: false })
          .eq('user_id', user.id);
        
        setIsSubscribed(false);
        toast.success("تم إلغاء الإشعارات");
      }
    } catch (error) {
      console.error("Error unsubscribing:", error);
      toast.error("فشل إلغاء الإشعارات");
    } finally {
      setLoading(false);
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          الإشعارات الفورية
        </CardTitle>
        <CardDescription>
          احصل على تنبيهات فورية للأحداث المهمة
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isSubscribed ? (
          <Button
            variant="outline"
            onClick={unsubscribeFromNotifications}
            disabled={loading}
            className="w-full"
          >
            <BellOff className="w-4 h-4 ml-2" />
            إلغاء الإشعارات
          </Button>
        ) : (
          <Button
            onClick={subscribeToNotifications}
            disabled={loading}
            className="w-full"
          >
            <Bell className="w-4 h-4 ml-2" />
            تفعيل الإشعارات
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default PushNotificationManager;