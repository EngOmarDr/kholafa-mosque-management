import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Phone, Mail, Lock, Grid3x3, List, Smartphone, Sun, Moon, Bell } from "lucide-react";
import PWAInstallButton from "./PWAInstallButton";
import PushNotificationManager from "./PushNotificationManager";

interface TeacherAccountSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

const TeacherAccountSettings = ({ open, onOpenChange, userId }: TeacherAccountSettingsProps) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list" | "mobile">(
    () => (localStorage.getItem("view_mode") as any) || "grid"
  );
  const [darkMode, setDarkMode] = useState<boolean>(
    () => localStorage.getItem("theme_mode") === "dark"
  );

  useEffect(() => {
    if (open && userId) {
      loadUserData();
    }
  }, [open, userId]);

  const loadUserData = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, email, phone")
        .eq("id", userId)
        .single();

      if (error) throw error;

      if (data) {
        setFormData(prev => ({
          ...prev,
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
        }));
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      toast.error("حدث خطأ في تحميل البيانات");
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      toast.error("كلمة المرور الجديدة غير متطابقة");
      return;
    }

    setLoading(true);

    try {
      // تحديث البيانات الأساسية في profiles
      const updateData: any = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
      };

      const { error: profileError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", userId);

      if (profileError) throw profileError;

      // إذا كان يريد تغيير كلمة المرور
      if (formData.currentPassword && formData.newPassword) {
        // تسجيل دخول للتحقق من كلمة المرور الحالية
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email || "",
          password: formData.currentPassword,
        });

        if (signInError) {
          toast.error("كلمة المرور الحالية غير صحيحة");
          setLoading(false);
          return;
        }

        // تحديث كلمة المرور
        const { error: passwordError } = await supabase.auth.updateUser({
          password: formData.newPassword,
        });

        if (passwordError) {
          toast.error("حدث خطأ أثناء تحديث كلمة المرور");
          setLoading(false);
          return;
        }

        toast.success("تم تحديث كلمة المرور بنجاح");
      }

      toast.success("تم تحديث البيانات بنجاح ✅");

      onOpenChange(false);
      
      // إعادة تعيين حقول كلمة المرور
      setFormData(prev => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
    } catch (error) {
      console.error("Error updating account:", error);
      toast.error("حدث خطأ أثناء تحديث البيانات");
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[60vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">
            إعدادات الحساب
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* المعلومات الأساسية */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">المعلومات الأساسية</h3>
            
            <div>
              <Label htmlFor="name">الاسم *</Label>
              <div className="relative">
                <User className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="pr-10"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pr-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="phone">رقم الهاتف</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="pr-10"
                />
              </div>
            </div>
          </div>

          {/* تغيير كلمة المرور */}
          <div className="space-y-4 p-4 bg-muted rounded-lg">
            <h3 className="text-lg font-semibold">تغيير كلمة المرور (اختياري)</h3>
            
            <div>
              <Label htmlFor="currentPassword">كلمة المرور الحالية</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="currentPassword"
                  type="password"
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  className="pr-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  className="pr-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword">تأكيد كلمة المرور الجديدة</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="pr-10"
                />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              💡 اترك الحقول فارغة إذا كنت لا تريد تغيير كلمة المرور
            </p>
          </div>

          {/* إعدادات العرض والمظهر */}
          <div className="space-y-4 p-4 mt-6 rounded-xl border border-border bg-muted/30">
            <h3 className="text-lg font-semibold">إعدادات العرض والمظهر</h3>
            
            {/* طريقة عرض قائمة الطلاب */}
            <div className="space-y-3">
              <Label className="font-semibold">طريقة عرض قائمة الطلاب:</Label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "grid" ? "default" : "outline"}
                  onClick={() => {
                    setViewMode("grid");
                    localStorage.setItem("view_mode", "grid");
                    window.dispatchEvent(new CustomEvent("viewModeChange", { detail: "grid" }));
                    toast.success("تم تغيير طريقة العرض إلى بطاقات");
                  }}
                  className="flex items-center gap-2"
                  title="عرض الطلاب كبطاقات"
                >
                  <Grid3x3 className="w-4 h-4" />
                  بطاقات
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "list" ? "default" : "outline"}
                  onClick={() => {
                    setViewMode("list");
                    localStorage.setItem("view_mode", "list");
                    window.dispatchEvent(new CustomEvent("viewModeChange", { detail: "list" }));
                    toast.success("تم تغيير طريقة العرض إلى قائمة");
                  }}
                  className="flex items-center gap-2"
                  title="عرض الطلاب كقائمة"
                >
                  <List className="w-4 h-4" />
                  قائمة
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "mobile" ? "default" : "outline"}
                  onClick={() => {
                    setViewMode("mobile");
                    localStorage.setItem("view_mode", "mobile");
                    window.dispatchEvent(new CustomEvent("viewModeChange", { detail: "mobile" }));
                    toast.success("تم تغيير طريقة العرض للجوال");
                  }}
                  className="flex items-center gap-2"
                  title="عرض مناسب للجوال"
                >
                  <Smartphone className="w-4 h-4" />
                  عرض احترافي للجوال
                </Button>
              </div>
            </div>

            <div className="border-t border-border my-4"></div>

            {/* الوضع الليلي */}
            <div className="space-y-3">
              <Label className="font-semibold">الوضع الليلي:</Label>
              <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                <div className="flex items-center gap-3">
                  {darkMode ? (
                    <Moon className="w-5 h-5 text-primary" />
                  ) : (
                    <Sun className="w-5 h-5 text-primary" />
                  )}
                  <span className="text-sm font-medium">
                    {darkMode ? "الوضع الليلي 🌙" : "الوضع الفاتح ☀️"}
                  </span>
                </div>
                <Switch
                  checked={darkMode}
                  onCheckedChange={(checked) => {
                    setDarkMode(checked);
                    localStorage.setItem("theme_mode", checked ? "dark" : "light");
                    if (checked) {
                      document.documentElement.classList.add("dark");
                    } else {
                      document.documentElement.classList.remove("dark");
                    }
                    toast.success(checked ? "تم تفعيل الوضع الليلي 🌙" : "تم تفعيل الوضع الفاتح ☀️");
                  }}
                  title="تبديل الوضع الليلي أو الفاتح"
                />
              </div>
            </div>

            <div className="border-t border-border my-4"></div>

            {/* الإشعارات الفورية */}
            <div className="space-y-3">
              <Label className="font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4" />
                الإشعارات الفورية:
              </Label>
              <PushNotificationManager />
            </div>

            <div className="border-t border-border my-4"></div>

            {/* تثبيت التطبيق */}
            <div className="space-y-3">
              <Label className="font-semibold">تثبيت التطبيق:</Label>
              <div className="flex flex-col gap-3 p-3 bg-background rounded-lg border">
                <p className="text-sm text-muted-foreground">
                  قم بتثبيت التطبيق على جهازك للحصول على تجربة أفضل وإمكانية الوصول السريع
                </p>
                <PWAInstallButton />
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "جاري الحفظ..." : "حفظ التغييرات"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TeacherAccountSettings;
