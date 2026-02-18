import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, Phone, MessageCircle, Check, RefreshCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ApplicationRow {
  id: string;
  created_at?: string;
  حالة_الطلب?: string | null;
  اسم_الاستاذ: string;
  اسم_الاب?: string | null;
  تاريخ_الميلاد?: string | null;
  رقم_الهاتف?: string | null;
  البريد_الالكتروني?: string | null;
  التحصيل_الدراسي?: string | null;
  الحالة_الاجتماعية?: string | null;
  المؤهل_العلمي_الديني?: string[] | null;
  اسم_المسجد_السابق?: string | null;
  مكان_وصول_الحفظ?: string | null;
  اسم_المعلم_السابق?: string | null;
  اسم_الثانوية_الشرعية?: string | null;
  عدد_سنوات_التحصيل?: number | null;
  الحالة_الصحية_والنفسية?: string | null;
  الوظيفة_المرغوبة?: string | null;
  الصف_المرغوب?: string | null;
  المهارات?: string | null;
  الأحلام?: string | null;
  سنوات_الالتزام?: number | null;
}

const TeacherApplications = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem("jeelUser");
    if (!userData) {
      navigate("/login");
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== "admin") {
      toast.error("غير مصرح لك بالوصول إلى هذه الصفحة");
      navigate("/admin");
      return;
    }

    setUser(parsedUser);
    fetchApplications();
  }, [navigate]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("teacher-applications", {
        body: { action: "list" },
      });
      if (error) throw error;
      setApplications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading applications:", err);
      toast.error("حدث خطأ في تحميل الطلبات");
    } finally {
      setLoading(false);
    }
  };

  const filtered = applications.filter((a) =>
    a.اسم_الاستاذ?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.رقم_الهاتف?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.البريد_الالكتروني?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleWhatsApp = (phone?: string | null) => {
    if (!phone) {
      toast.error("رقم الهاتف غير متوفر");
      return;
    }
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, "")}` , "_blank");
  };

  const handleCall = (phone?: string | null) => {
    if (!phone) {
      toast.error("رقم الهاتف غير متوفر");
      return;
    }
    window.location.href = `tel:${phone}`;
  };

  const approve = async (applicationId: string) => {
    try {
      setProcessing(applicationId);
      const { data, error } = await supabase.functions.invoke("teacher-applications", {
        body: { action: "approve", applicationId },
      });
      if (error) throw error;
      toast.success("تمت الموافقة على الطلب وإضافته للأساتذة ✅");
      await fetchApplications();
    } catch (err) {
      console.error("Error approving application:", err);
      toast.error("تعذر إتمام الموافقة، حاول مجدداً");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DashboardLayout title="طلبات التسجيل" userName={user?.name}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-primary">طلبات تسجيل الأساتذة</h2>
            <p className="text-muted-foreground mt-1">مراجعة الطلبات والموافقة عليها</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchApplications} variant="outline">
              <RefreshCcw className="w-5 h-5 ml-2" />
              تحديث
            </Button>
            <Button onClick={() => navigate("/admin/teachers")} variant="outline">
              العودة للأساتذة
            </Button>
          </div>
        </div>

        <div className="stats-card">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="البحث بالاسم أو الهاتف أو البريد..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pr-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((app) => (
            <div key={app.id} className="stats-card hover:border-primary transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-bold text-xl">{app.اسم_الاستاذ}</h3>
                  {app.البريد_الالكتروني && (
                    <p className="text-sm text-muted-foreground">{app.البريد_الالكتروني}</p>
                  )}
                  {app.رقم_الهاتف && (
                    <p className="text-sm text-muted-foreground">{app.رقم_الهاتف}</p>
                  )}
                  {app.الوظيفة_المرغوبة && (
                    <div className="mt-2">
                      <span className="badge-info text-xs">{app.الوظيفة_المرغوبة}</span>
                    </div>
                  )}
                </div>
                <div className={`badge-${app.حالة_الطلب === "مقبول" ? "success" : "warning"}`}>
                  {app.حالة_الطلب || "قيد المراجعة"}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button size="sm" variant="outline" onClick={() => handleCall(app.رقم_الهاتف)}>
                  <Phone className="w-4 h-4 ml-2" /> اتصال
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleWhatsApp(app.رقم_الهاتف)}>
                  <MessageCircle className="w-4 h-4 ml-2" /> واتساب
                </Button>
                <Button
                  size="sm"
                  className="btn-primary"
                  onClick={() => approve(app.id)}
                  disabled={processing === app.id}
                >
                  <Check className="w-4 h-4 ml-2" /> {processing === app.id ? "جاري الموافقة..." : "موافقة"}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="stats-card text-center py-12 text-muted-foreground">
            <p className="text-lg">لا توجد طلبات حالياً</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TeacherApplications;
