import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { BookOpen, Lock, Mail, Search } from "lucide-react";
import StudentInquiryDialog from "@/components/StudentInquiryDialog";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { error } from "console";

const Login = () => {
  const [email, setEmail] = useState(() => localStorage.getItem("rememberedEmail") || "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inquiryDialogOpen, setInquiryDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useRequireAuth();

  // فحص إذا كان المستخدم مسجل دخول بالفعل والتوجيه حسب الدور
  useEffect(() => {
    if (!authLoading && user) {
      switch (user.role) {
        case "admin":
          navigate("/admin", { replace: true });
          break;
        case "supervisor":
        case "teacher":
          navigate("/teacher", { replace: true });
          break;
        case "student":
          navigate("/student", { replace: true });
          break;
        case "parent":
          navigate("/parent", { replace: true });
          break;
        default:
          navigate("/", { replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // تسجيل الدخول باستخدام Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });
      console.log(authData);
      console.log(authError);

      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          toast.error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
        } else if (authError.message.includes("Email not confirmed")) {
          toast.error("يرجى تأكيد بريدك الإلكتروني أولاً");
        } else {
          toast.error("حدث خطأ أثناء تسجيل الدخول");
        }
        setLoading(false);
        return;
      }

      if (!authData.user) {
        toast.error("حدث خطأ أثناء تسجيل الدخول");
        setLoading(false);
        return;
      }

      // جلب بيانات المستخدم من profiles
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile) {
        toast.error("لم يتم العثور على بيانات المستخدم");
        setLoading(false);
        return;
      }

      // التحقق من أن الحساب نشط
      if (!profile.active) {
        toast.error("حسابك غير نشط. يرجى التواصل مع الإدارة");
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // الحصول على الدور الحقيقي من user_roles
      const { data: roleData } = await supabase.rpc('get_user_role', { p_user_id: authData.user.id });
      const actualRole = roleData || profile.role;

      localStorage.setItem("jeelUser", JSON.stringify({ ...profile, role: actualRole }));
      // حفظ البريد الإلكتروني إذا اختار المستخدم "تذكرني"
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      toast.success(`مرحباً ${profile.name}!`);

      // التوجيه حسب الدور
      switch (actualRole) {
        case "admin":
          navigate("/admin");
          break;
        case "supervisor":
        case "teacher":
          navigate("/teacher");
          break;
        case "student":
          navigate("/student");
          break;
        case "parent":
          navigate("/parent");
          break;
        default:
          navigate("/");
      }
    } catch (error) {
      console.log(error);
      console.error("Login error:", error);
      toast.error("حدث خطأ أثناء تسجيل الدخول");
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
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white mb-4 shadow-emerald animate-float overflow-hidden">
            <img src="/logo.png" alt="جيل صلاحي" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-4xl font-bold text-primary mb-2">الخلفاء الراشدين</h1>
          <p className="text-muted-foreground text-lg">نظام إدارة حلقات القرآن الكريم</p>
        </div>

        {/* Login Form */}
        <div className="bg-card rounded-[--radius-lg] shadow-emerald p-8 border border-border">
          <form onSubmit={handleLogin} className="space-y-6">
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
                className="input-field h-12"
                dir="ltr"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <Label
                htmlFor="remember"
                className="text-sm font-medium cursor-pointer"
              >
                تذكرني
              </Label>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full btn-primary h-12 text-lg"
            >
              {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
            </Button>
          </form>

          {/* Student Inquiry Section */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground text-center mb-3">
              هل أنت ولي أمر؟
            </p>
            <Button
              type="button"
              className="w-full gap-2 bg-info text-info-foreground hover:bg-info/90 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-info/30 active:scale-[0.98]"
              onClick={() => setInquiryDialogOpen(true)}
            >
              <Search className="w-4 h-4" />
              الاستعلام عن طالب
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>© 2026 الخلفاء الراشدين - جميع الحقوق محفوظة</p>
        </div>
      </div>

      <StudentInquiryDialog
        open={inquiryDialogOpen}
        onOpenChange={setInquiryDialogOpen}
      />
    </div>
  );
};

export default Login;
