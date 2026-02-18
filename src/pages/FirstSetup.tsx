import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BookOpen, Mail, Lock, User, Phone } from "lucide-react";

const FirstSetup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("كلمات المرور غير متطابقة");
      return;
    }

    if (password.length < 8) {
      toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }

    setLoading(true);

    try {
      // Call Edge Function to create admin
      const { data, error } = await supabase.functions.invoke('create-admin', {
        body: {
          email: email.trim(),
          password,
          name,
          phone,
          role: 'admin'
        }
      });

      if (error) {
        console.error('Error creating admin:', error);
        toast.error("حدث خطأ أثناء إنشاء حساب الأدمن");
        setLoading(false);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setLoading(false);
        return;
      }

      toast.success("تم إنشاء حساب الأدمن بنجاح! يمكنك الآن تسجيل الدخول");
      navigate("/login");

    } catch (error) {
      console.error("Error:", error);
      toast.error("حدث خطأ أثناء إنشاء حساب الأدمن");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent to-background p-4">
      <div className="absolute inset-0 islamic-pattern opacity-30"></div>

      <div className="w-full max-w-md relative z-10 animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white mb-4 shadow-emerald overflow-hidden">
            <img src="/logo.png" alt="جيل صلاحي" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-4xl font-bold text-primary mb-2">الخلفاء الراشدين</h1>
          <p className="text-muted-foreground text-lg">إنشاء حساب المدير الأول</p>
        </div>

        <div className="bg-card rounded-[--radius-lg] shadow-emerald p-8 border border-border">
          <form onSubmit={handleCreateAdmin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base font-semibold flex items-center gap-2">
                <User className="w-4 h-4" />
                الاسم الكامل
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="محمد أحمد"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="input-field h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-base font-semibold flex items-center gap-2">
                <Mail className="w-4 h-4" />
                البريد الإلكتروني
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field h-12"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-base font-semibold flex items-center gap-2">
                <Phone className="w-4 h-4" />
                رقم الهاتف
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="0501234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field h-12"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-base font-semibold flex items-center gap-2">
                <Lock className="w-4 h-4" />
                كلمة المرور
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
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
                minLength={8}
                className="input-field h-12"
                dir="ltr"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full btn-primary h-12 text-lg"
            >
              {loading ? "جاري الإنشاء..." : "إنشاء حساب المدير"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              هل لديك حساب بالفعل؟{" "}
              <a href="/login" className="text-primary hover:underline font-medium">
                تسجيل الدخول
              </a>
            </p>
          </div>
        </div>

        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>© 2026 الخلفاء الراشدين - جميع الحقوق محفوظة</p>
        </div>
      </div>
    </div>
  );
};

export default FirstSetup;
