import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Copy } from "lucide-react";

interface SimpleTeacherSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

const SimpleTeacherSettings = ({
  open,
  onOpenChange,
  userId,
}: SimpleTeacherSettingsProps) => {
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (open && userId) {
      loadUserData();
    } else {
      resetForm();
    }
  }, [open, userId]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("phone, email")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setPhone(data?.phone || "");
      setEmail(data?.email || "");
    } catch (error) {
      console.error("Error loading user data:", error);
      toast.error("حدث خطأ في تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPhone("");
    setEmail("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const copyEmail = () => {
    navigator.clipboard.writeText(email);
    toast.success("تم نسخ البريد الإلكتروني");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword && newPassword !== confirmPassword) {
      toast.error("كلمة المرور غير متطابقة");
      return;
    }

    if (newPassword && newPassword.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    setUpdating(true);
    try {
      // تحديث رقم الهاتف
      if (phone) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ phone })
          .eq("id", userId);

        if (profileError) throw profileError;
      }

      // تحديث كلمة المرور إذا تم إدخالها
      if (newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: newPassword
        });

        if (passwordError) throw passwordError;
      }

      toast.success("تم تحديث البيانات بنجاح");
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error("Error updating data:", error);
      toast.error(error.message || "حدث خطأ في تحديث البيانات");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تعديل الحساب</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div>
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyEmail}
                  title="نسخ البريد الإلكتروني"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="phone">رقم الهاتف</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="أدخل رقم الهاتف"
              />
            </div>

            <div>
              <Label htmlFor="newPassword">كلمة المرور الجديدة (اختياري)</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الجديدة"
              />
            </div>

            {newPassword && (
              <div>
                <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور"
                />
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={updating} className="flex-1">
                {updating ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  "حفظ التغييرات"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                إلغاء
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SimpleTeacherSettings;
