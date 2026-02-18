import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Bell, Send, Loader2, AlertCircle, CheckCircle, Info,
  Users, Trash2, BarChart3, RefreshCw, CheckSquare, Square
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ar } from "date-fns/locale";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  read: boolean;
  created_at: string;
  target_role: string | null;
  target_user_id: string | null;
}

interface Stats {
  total: number;
  unread: number;
  read: number;
  byType: { [key: string]: number };
}

interface Teacher {
  id: string;
  name: string;
  user_id: string | null;
}

const AdminNotifications = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stats, setStats] = useState<Stats>({ total: 0, unread: 0, read: 0, byType: {} });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  // نموذج إرسال إشعار جديد
  const [newNotification, setNewNotification] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'warning' | 'success' | 'alert',
    target_role: 'all',
    target_teacher_id: '' // لإرسال لأستاذ محدد
  });

  // جلب قائمة الأساتذة
  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, "اسم الاستاذ", user_id')
        .order('"اسم الاستاذ"');

      if (error) throw error;

      setTeachers((data || []).map(t => ({
        id: t.id,
        name: t["اسم الاستاذ"],
        user_id: t.user_id
      })));
    } catch (error) {
      console.error('Error fetching teachers:', error);
    }
  };

  useEffect(() => {
    const userData = localStorage.getItem("jeelUser");
    if (!userData) {
      navigate("/login");
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== "admin") {
      toast.error("غير مصرح لك بالوصول إلى هذه الصفحة");
      navigate("/login");
      return;
    }
    setUser(parsedUser);
    fetchNotifications();
    fetchTeachers();
  }, [navigate]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100) as any);

      if (error) throw error;

      const typedData = (data || []).map(n => ({
        ...n,
        type: (n.type || 'info') as 'info' | 'warning' | 'success' | 'alert'
      }));

      setNotifications(typedData);
      calculateStats(typedData);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('حدث خطأ في تحميل الإشعارات');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: Notification[]) => {
    const byType: { [key: string]: number } = {};
    let unread = 0;
    let read_count = 0;

    data.forEach(n => {
      byType[n.type] = (byType[n.type] || 0) + 1;
      if (n.read) read_count++;
      else unread++;
    });

    setStats({ total: data.length, unread, read: read_count, byType });
  };

  const sendNotification = async () => {
    if (!newNotification.title.trim() || !newNotification.message.trim()) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    // التحقق من اختيار أستاذ عند الإرسال لأستاذ محدد
    if (newNotification.target_role === 'specific_teacher' && !newNotification.target_teacher_id) {
      toast.error('يرجى اختيار الأستاذ');
      return;
    }

    setSending(true);
    try {
      // تحديد target_target_user_id إذا كان الإرسال لأستاذ محدد
      let targetUserId = null;
      let targetRole = newNotification.target_role === 'all' ? null : newNotification.target_role;

      if (newNotification.target_role === 'specific_teacher') {
        const selectedTeacher = teachers.find(t => t.id === newNotification.target_teacher_id);
        if (selectedTeacher?.user_id) {
          targetUserId = selectedTeacher.user_id;
          targetRole = 'teacher';
        } else {
          toast.error('الأستاذ المحدد ليس لديه حساب مستخدم');
          setSending(false);
          return;
        }
      }

      const { error } = await supabase
        .from('notifications')
        .insert({
          title: newNotification.title,
          message: newNotification.message,
          type: newNotification.type,
          target_role: targetRole,
          target_user_id: targetUserId,
          read: false
        } as any);

      if (error) throw error;

      // إرسال إشعار فوري عبر Push Notification
      try {
        const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
          body: {
            title: newNotification.title,
            message: newNotification.message,
            type: newNotification.type,
            targetUserIds: targetUserId ? [targetUserId] : undefined,
            targetRoles: targetRole && targetRole !== 'all' ? [targetRole] : undefined,
            url: '/notifications'
          }
        });

        if (pushError) {
          console.error('Push notification error:', pushError);
          toast.warning('تم حفظ الإشعار لكن فشل إرسال الإشعار الفوري');
        } else {
          toast.success('تم إرسال الإشعار بنجاح');
        }
      } catch (pushErr) {
        console.error('Push notification exception:', pushErr);
        toast.success('تم حفظ الإشعار (الإشعار الفوري قد لا يصل لبعض المستخدمين)');
      }
      setNewNotification({ title: '', message: '', type: 'info', target_role: 'all', target_teacher_id: '' });
      fetchNotifications();
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('حدث خطأ في إرسال الإشعار');
    } finally {
      setSending(false);
    }
  };

  const deleteOldNotifications = async (days: number) => {
    setDeleting(true);
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const { error } = await supabase
        .from('notifications')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) throw error;

      toast.success(`تم حذف الإشعارات الأقدم من ${days} يوم`);
      fetchNotifications();
    } catch (error) {
      console.error('Error deleting old notifications:', error);
      toast.error('حدث خطأ في حذف الإشعارات');
    } finally {
      setDeleting(false);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== id));
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      toast.success('تم حذف الإشعار');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('حدث خطأ في حذف الإشعار');
    }
  };

  const deleteSelectedNotifications = async () => {
    if (selectedIds.size === 0) {
      toast.error('يرجى تحديد إشعارات للحذف');
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      setNotifications(prev => prev.filter(n => !selectedIds.has(n.id)));
      toast.success(`تم حذف ${selectedIds.size} إشعار`);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error deleting selected notifications:', error);
      toast.error('حدث خطأ في حذف الإشعارات');
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map(n => n.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'warning':
      case 'alert':
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      default:
        return <Info className="w-4 h-4 text-primary" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'warning':
      case 'alert':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">تنبيه</Badge>;
      case 'success':
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">نجاح</Badge>;
      default:
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">معلومة</Badge>;
    }
  };

  const getRoleName = (role: string | null, userId: string | null = null) => {
    // إذا كان هناك مستخدم محدد، ابحث عن اسم الأستاذ
    if (userId && role === 'teacher') {
      const teacher = teachers.find(t => t.user_id === userId);
      if (teacher) {
        return `الأستاذ: ${teacher.name}`;
      }
    }

    if (!role) return 'الجميع';
    switch (role) {
      case 'admin': return 'الإداريين';
      case 'teacher': return 'المعلمين';
      case 'student': return 'الطلاب';
      case 'parent': return 'أولياء الأمور';
      default: return role;
    }
  };

  return (
    <DashboardLayout title="إدارة الإشعارات" userName={user?.name}>
      <div className="space-y-6 animate-fade-in">
        <Tabs defaultValue="send" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="send" className="gap-2">
              <Send className="w-4 h-4" />
              إرسال إشعار
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <Bell className="w-4 h-4" />
              سجل الإشعارات
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              الإحصائيات
            </TabsTrigger>
          </TabsList>

          {/* إرسال إشعار جديد */}
          <TabsContent value="send">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-primary" />
                  إرسال إشعار جديد
                </CardTitle>
                <CardDescription>
                  أرسل إشعاراً لجميع المستخدمين أو لفئة معينة
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>نوع الإشعار</Label>
                    <Select
                      value={newNotification.type}
                      onValueChange={(v) => setNewNotification(prev => ({ ...prev, type: v as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">
                          <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-blue-500" />
                            معلومة
                          </div>
                        </SelectItem>
                        <SelectItem value="success">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                            نجاح
                          </div>
                        </SelectItem>
                        <SelectItem value="warning">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            تنبيه
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>إرسال إلى</Label>
                    <Select
                      value={newNotification.target_role}
                      onValueChange={(v) => setNewNotification(prev => ({ ...prev, target_role: v, target_teacher_id: '' }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            الجميع
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">الإداريين</SelectItem>
                        <SelectItem value="teacher">جميع المعلمين</SelectItem>
                        <SelectItem value="specific_teacher">أستاذ محدد</SelectItem>
                        <SelectItem value="student">الطلاب</SelectItem>
                        <SelectItem value="parent">أولياء الأمور</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* اختيار أستاذ محدد */}
                {newNotification.target_role === 'specific_teacher' && (
                  <div className="space-y-2">
                    <Label>اختر الأستاذ *</Label>
                    <Select
                      value={newNotification.target_teacher_id}
                      onValueChange={(v) => setNewNotification(prev => ({ ...prev, target_teacher_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر أستاذاً..." />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.filter(t => t.user_id).map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {teachers.filter(t => t.user_id).length === 0 && (
                      <p className="text-sm text-muted-foreground">لا يوجد أساتذة لديهم حسابات مستخدمين</p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>عنوان الإشعار *</Label>
                  <Input
                    placeholder="أدخل عنوان الإشعار..."
                    value={newNotification.title}
                    onChange={(e) => setNewNotification(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>نص الإشعار *</Label>
                  <Textarea
                    placeholder="أدخل نص الإشعار..."
                    rows={4}
                    value={newNotification.message}
                    onChange={(e) => setNewNotification(prev => ({ ...prev, message: e.target.value }))}
                  />
                </div>

                <Button onClick={sendNotification} disabled={sending} className="w-full gap-2">
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  إرسال الإشعار
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* سجل الإشعارات */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-primary" />
                        سجل الإشعارات
                      </CardTitle>
                      <CardDescription>
                        عرض جميع الإشعارات المرسلة ({notifications.length})
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={fetchNotifications}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteOldNotifications(30)}
                        disabled={deleting}
                      >
                        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        حذف الأقدم من 30 يوم
                      </Button>
                    </div>
                  </div>

                  {/* شريط التحديد والحذف */}
                  {notifications.length > 0 && (
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedIds.size === notifications.length && notifications.length > 0}
                          onCheckedChange={toggleSelectAll}
                          id="select-all"
                        />
                        <label htmlFor="select-all" className="text-sm cursor-pointer">
                          {selectedIds.size === notifications.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                        </label>
                        {selectedIds.size > 0 && (
                          <Badge variant="secondary">{selectedIds.size} محدد</Badge>
                        )}
                      </div>
                      {selectedIds.size > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={deleteSelectedNotifications}
                          disabled={deleting}
                          className="gap-2"
                        >
                          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          حذف المحدد ({selectedIds.size})
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>لا توجد إشعارات</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-3 rounded-lg border transition-all ${selectedIds.has(notification.id)
                            ? 'bg-primary/10 border-primary/40'
                            : notification.read
                              ? 'bg-muted/30 border-border'
                              : 'bg-primary/5 border-primary/20'
                            }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={selectedIds.has(notification.id)}
                                onCheckedChange={() => toggleSelect(notification.id)}
                                className="mt-1"
                              />
                              {getNotificationIcon(notification.type)}
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-sm">{notification.title}</h4>
                                  {getTypeBadge(notification.type)}
                                  <Badge variant="secondary" className="text-xs">
                                    {getRoleName(notification.target_role, notification.target_user_id)}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mb-1">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-muted-foreground/60">
                                  {format(new Date(notification.created_at.endsWith('Z') ? notification.created_at : notification.created_at + 'Z'), 'PPp', { locale: ar })}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteNotification(notification.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* الإحصائيات */}
          <TabsContent value="stats">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10">
                      <Bell className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.total}</p>
                      <p className="text-sm text-muted-foreground">إجمالي الإشعارات</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-amber-500/10">
                      <AlertCircle className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.unread}</p>
                      <p className="text-sm text-muted-foreground">غير مقروء</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-emerald-500/10">
                      <CheckCircle className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.read}</p>
                      <p className="text-sm text-muted-foreground">مقروء</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-500/10">
                      <Info className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.byType['info'] || 0}</p>
                      <p className="text-sm text-muted-foreground">معلومات</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>توزيع الإشعارات حسب النوع</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(stats.byType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getNotificationIcon(type)}
                        <span className="capitalize">{type === 'info' ? 'معلومات' : type === 'success' ? 'نجاح' : type === 'warning' ? 'تنبيهات' : type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${(count / stats.total) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminNotifications;
