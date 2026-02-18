import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BookOpen, Mail, ArrowRight } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // التحقق من وجود البريد الإلكتروني
      const { data: existingUser } = await supabase
        .rpc('verify_user_email', { p_email: email });

      if (!existingUser) {
        toast.error("البريد الإلكتروني غير مسجل في النظام");
        setLoading(false);
        return;
      }

      // إرسال رابط إعادة تعيين كلمة المرور
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast.error("حدث خطأ أثناء إرسال رابط إعادة التعيين");
        console.error("Reset password error:", error);
      } else {
        setEmailSent(true);
        toast.success("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني");
      }
    } catch (error) {
      console.error("Reset password error:", error);
      toast.error("حدث خطأ أثناء معالجة الطلب");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent to-background p-4">
      <div className="absolute inset-0 islamic-pattern opacity-30"></div>

      <div className="w-full max-w-md relative z-10 animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white mb-4 shadow-emerald overflow-hidden">
            <img src="/logo.png" alt="جيل صلاحي" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-4xl font-bold text-primary mb-2">استعادة كلمة المرور</h1>
          <p className="text-muted-foreground text-lg">الخلفاء الراشدين</p>
        </div>

        {/* Form */}
        <div className="bg-card rounded-[--radius-lg] shadow-emerald p-8 border border-border">
          {!emailSent ? (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base font-semibold flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  البريد الإلكتروني
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input-field h-12"
                  dir="ltr"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full btn-primary h-12 text-lg"
              >
                {loading ? "جاري الإرسال..." : "إرسال رابط إعادة التعيين"}
              </Button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">تم إرسال الرابط!</h3>
              <p className="text-muted-foreground">
                تحقق من بريدك الإلكتروني واتبع التعليمات لإعادة تعيين كلمة المرور
              </p>
              <Button
                onClick={() => setEmailSent(false)}
                variant="outline"
                className="mt-4"
              >
                إرسال مرة أخرى
              </Button>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              العودة لتسجيل الدخول
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>© 2026 الخلفاء الراشدين - جميع الحقوق محفوظة</p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
