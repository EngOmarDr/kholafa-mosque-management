import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, Lock, RefreshCw, Download } from "lucide-react";
import { checkForUpdates, applyUpdate } from "@/lib/pwaUpdater";

interface AdminAccountSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AdminAccountSettings = ({ open, onOpenChange }: AdminAccountSettingsProps) => {
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(true);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUserEmail();
    }
  }, [open]);

  const fetchUserEmail = async () => {
    setLoadingEmail(true);
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (user?.email) {
        setEmail(user.email);
      }
    } catch (error) {
      console.error("Error fetching user email:", error);
      toast.error("حدث خطأ في تحميل البيانات");
    } finally {
      setLoadingEmail(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("الرجاء ملء جميع الحقول");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("كلمات المرور غير متطابقة");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success("تم تحديث كلمة المرور بنجاح");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast.error(error.message || "حدث خطأ في تحديث كلمة المرور");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const hasUpdate = await checkForUpdates();
      setUpdateAvailable(hasUpdate);
      if (hasUpdate) {
        toast.success("يوجد تحديث جديد متاح!");
      } else {
        toast.info("التطبيق محدث بالفعل");
      }
    } catch (error) {
      toast.error("حدث خطأ أثناء البحث عن التحديثات");
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleApplyUpdate = async () => {
    setApplyingUpdate(true);
    try {
      await applyUpdate();
    } catch (error) {
      toast.error("حدث خطأ، جاري إعادة تحميل الصفحة...");
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">إعدادات الحساب</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Email Section */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Mail className="w-4 h-4" />
              البريد الإلكتروني
            </Label>
            {loadingEmail ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : (
              <Input
                type="email"
                value={email}
                disabled
                className="bg-muted"
              />
            )}
            <p className="text-xs text-muted-foreground">
              لا يمكن تغيير البريد الإلكتروني حالياً
            </p>
          </div>

          {/* Password Change Section */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">تغيير كلمة المرور</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm">
                كلمة المرور الجديدة
              </Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الجديدة"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm">
                تأكيد كلمة المرور
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="أعد إدخال كلمة المرور"
              />
            </div>

            <Button
              onClick={handlePasswordChange}
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري التحديث...
                </>
              ) : (
                "تحديث كلمة المرور"
              )}
            </Button>
          </div>

          {/* App Update Section */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <Download className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">تحديث التطبيق</h3>
            </div>
            
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleCheckForUpdates}
                disabled={checkingUpdate}
                variant="outline"
                className="w-full"
              >
                {checkingUpdate ? (
                  <>
                    <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
                    جاري البحث...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 ml-2" />
                    البحث عن تحديثات
                  </>
                )}
              </Button>
              
              {updateAvailable && (
                <Button
                  onClick={handleApplyUpdate}
                  disabled={applyingUpdate}
                  className="w-full"
                >
                  {applyingUpdate ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      جاري التحديث...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 ml-2" />
                      تثبيت التحديث الآن
                    </>
                  )}
                </Button>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground">
              اضغط للبحث عن إصدار جديد من التطبيق
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminAccountSettings;
