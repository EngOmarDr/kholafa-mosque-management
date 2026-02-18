import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        // Check if there's a valid Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        if (session?.user) {
          // Get user profile to determine role
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (!isMounted) return;

          if (profile) {
            // Get actual role
            const { data: roleData } = await supabase.rpc('get_user_role', { p_user_id: session.user.id });
            const role = roleData || profile.role;

            // Redirect to appropriate dashboard
            switch (role) {
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
            }
          }
        } else {
          // No valid session, clear localStorage
          localStorage.removeItem("jeelUser");
        }
      } catch (error) {
        console.error("Error checking session:", error);
        // Clear localStorage on error
        localStorage.removeItem("jeelUser");
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent to-background relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 islamic-pattern opacity-20"></div>
      
      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 min-h-screen flex flex-col items-center justify-center">
        {/* Logo & Title */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white mb-6 shadow-emerald glow-emerald overflow-hidden">
            <img src="/logo.png" alt="جيل صلاحي" className="w-full h-full object-cover" />
          </div>
          
          <h1 className="text-6xl md:text-7xl font-bold text-primary mb-4 animate-slide-up">
            جيل صلاحي
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-8">
            نظام متكامل لإدارة حلقات القرآن الكريم
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground mb-8">
            <div className="flex items-center gap-2 badge-success">
              <Sparkles className="w-4 h-4" />
              <span>إدارة ذكية</span>
            </div>
            <div className="flex items-center gap-2 badge-gold">
              <Sparkles className="w-4 h-4" />
              <span>نظام نقاط</span>
            </div>
            <div className="flex items-center gap-2 badge-success">
              <Sparkles className="w-4 h-4" />
              <span>تقارير متقدمة</span>
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 animate-scale-in">
          <Button
            onClick={() => navigate("/login")}
            className="btn-primary text-lg px-8 py-6 h-auto"
          >
            تسجيل الدخول
            <ArrowLeft className="w-5 h-5 mr-2" />
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 w-full max-w-5xl">
          {[
            {
              title: "إدارة شاملة",
              description: "إدارة الطلاب والأساتذة والحضور بكل سهولة",
              gradient: "from-primary to-primary-light",
            },
            {
              title: "نظام النقاط",
              description: "تحفيز الطلاب من خلال نظام نقاط تفاعلي",
              gradient: "from-secondary-dark to-secondary",
            },
            {
              title: "تقارير دقيقة",
              description: "تقارير وإحصائيات مفصلة للتطور والحضور",
              gradient: "from-success to-primary",
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="stats-card hover:scale-105 transition-all duration-300 animate-slide-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className={`w-full h-2 rounded-full bg-gradient-to-r ${feature.gradient} mb-4`}></div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-20 text-center text-sm text-muted-foreground">
          <p>© 2025 جيل صلاحي - جميع الحقوق محفوظة</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
