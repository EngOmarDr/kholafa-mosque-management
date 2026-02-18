import { useState, useEffect, useCallback } from "react";
import { Bell, X, AlertCircle, CheckCircle, Info, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Notification {
  id: string;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'success' | 'alert';
  read: boolean;
  created_at: string;
  target_role?: string;
  target_user_id?: string;
}

type FilterType = 'all' | 'unread' | 'info' | 'warning' | 'success';

export const NotificationsPanel = ({ userRole, userId }: { userRole: string, userId?: string }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  // جلب عدد الإشعارات غير المقروءة فور تحميل الصفحة
  const fetchUnreadCount = useCallback(async () => {
    try {
      const { count, error } = await (supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false)
        .or(`target_role.eq.${userRole},target_role.is.null${userId ? `,target_user_id.eq.${userId}` : ''}`) as any);

      if (!error) {
        setUnreadCount(count || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [userRole, userId]);

  // جلب العدد فوراً عند تحميل المكون
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('notifications')
        .select('*')
        .or(`target_role.eq.${userRole},target_role.is.null${userId ? `,target_user_id.eq.${userId}` : ''}`)
        // عرض غير المقروء أولاً لتجنب إخفائها بسبب limit
        .order('read', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(50) as any);

      if (error) throw error;

      const typedData = (data || []).map(notification => ({
        ...notification,
        type: (notification.type || 'info') as 'info' | 'warning' | 'success' | 'alert'
      }));

      setNotifications(typedData);

      // لا تحسب unreadCount من قائمة محدودة (50). احسبه من الاستعلام الدقيق.
      fetchUnreadCount();
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('حدث خطأ في تحميل الإشعارات');
    } finally {
      setLoading(false);
    }
  }, [userRole, userId, fetchUnreadCount]);

  // الاشتراك في التحديثات الفورية
  useEffect(() => {
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          fetchUnreadCount();
          if (open) {
            fetchNotifications();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, fetchUnreadCount, fetchNotifications]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await (supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId) as any);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      // تحديث جميع الإشعارات غير المقروءة في قاعدة البيانات للمستخدم الحالي
      const { error } = await (supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false)
        .or(`target_role.eq.${userRole},target_role.is.null${userId ? `,user_id.eq.${userId}` : ''}`) as any);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);
      toast.success('تم تحديد جميع الإشعارات كمقروءة');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('حدث خطأ في تحديث الإشعارات');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'warning':
      case 'alert':
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      default:
        return <Info className="w-5 h-5 text-primary" />;
    }
  };

  const getNotificationBgColor = (type: string, read: boolean) => {
    if (read) return 'bg-background border-border';

    switch (type) {
      case 'warning':
      case 'alert':
        return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800';
      case 'success':
        return 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800';
      default:
        return 'bg-primary/5 border-primary/20';
    }
  };

  const formatTime = (date: string) => {
    try {
      // إضافة Z لتحديد أن التوقيت UTC
      const utcDate = date.endsWith('Z') ? date : date + 'Z';
      return formatDistanceToNow(new Date(utcDate), { addSuffix: true, locale: ar });
    } catch {
      return 'منذ لحظات';
    }
  };

  // تصفية الإشعارات
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read;
    return n.type === filter || (filter === 'warning' && n.type === 'alert');
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs animate-pulse"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 pb-2 space-y-4 border-b">
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <span>الإشعارات</span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {unreadCount} جديد
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs text-primary hover:text-primary"
              >
                تحديد الكل كمقروء
              </Button>
            )}
          </SheetTitle>

          {/* فلاتر الإشعارات */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="w-full">
            <TabsList className="w-full grid grid-cols-4 h-9">
              <TabsTrigger value="all" className="text-xs px-2">الكل</TabsTrigger>
              <TabsTrigger value="unread" className="text-xs px-2">غير مقروء</TabsTrigger>
              <TabsTrigger value="warning" className="text-xs px-2">تنبيهات</TabsTrigger>
              <TabsTrigger value="success" className="text-xs px-2">نجاح</TabsTrigger>
            </TabsList>
          </Tabs>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-10rem)]">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{filter === 'all' ? 'لا توجد إشعارات' : 'لا توجد إشعارات في هذه الفئة'}</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {filteredNotifications.map((notification, index) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border transition-all cursor-pointer hover:shadow-sm ${getNotificationBgColor(notification.type || 'info', notification.read)}`}
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type || 'info')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className={`font-semibold text-sm ${notification.read ? 'text-muted-foreground' : ''}`}>
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <p className={`text-sm mb-2 ${notification.read ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        {formatTime(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
