import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BookOpen, Lock } from "lucide-react";

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // التحقق من وجود session صالحة لإعادة تعيين كلمة المرور
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setValidSession(true);
      } else {
        toast.error("رابط إعادة التعيين غير صالح أو منتهي الصلاحية");
        navigate("/forgot-password");
      }
    };
    checkSession();
  }, [navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

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

      if (error) {
        toast.error("حدث خطأ أثناء تحديث كلمة المرور");
        console.error("Reset password error:", error);
      } else {
        toast.success("تم تحديث كلمة المرور بنجاح!");
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      }
    } catch (error) {
      console.error("Reset password error:", error);
      toast.error("حدث خطأ أثناء تحديث كلمة المرور");
    } finally {
      setLoading(false);
    }
  };

  if (!validSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">جاري التحقق...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent to-background p-4">
      <div className="absolute inset-0 islamic-pattern opacity-30"></div>
      
      <div className="w-full max-w-md relative z-10 animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white mb-4 shadow-emerald overflow-hidden">
            <img src="/logo.png" alt="جيل صلاحي" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-4xl font-bold text-primary mb-2">إعادة تعيين كلمة المرور</h1>
          <p className="text-muted-foreground text-lg">جيل صلاحي</p>
        </div>

        {/* Form */}
        <div className="bg-card rounded-[--radius-lg] shadow-emerald p-8 border border-border">
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-base font-semibold flex items-center gap-2">
                <Lock className="w-4 h-4" />
                كلمة المرور الجديدة
              </Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="input-field h-12"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-base font-semibold flex items-center gap-2">
                <Lock className="w-4 h-4" />
                تأكيد كلمة المرور
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="input-field h-12"
                dir="ltr"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full btn-primary h-12 text-lg"
            >
              {loading ? "جاري التحديث..." : "تحديث كلمة المرور"}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>© 2025 جيل صلاحي - جميع الحقوق محفوظة</p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
