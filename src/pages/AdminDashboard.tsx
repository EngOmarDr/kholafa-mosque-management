import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import DashboardLayout from "@/components/DashboardLayout";
import StatsCard from "@/components/StatsCard";
import { Users, GraduationCap, TrendingUp, Building, Award, FileText, BarChart3, Bell, Package, AlertTriangle, HardDrive, BookOpen, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import StudentAnalyticsDialog from "@/components/StudentAnalyticsDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import QuickStudentSearch from "@/components/QuickStudentSearch";
import ClassesOverviewDialog from "@/components/ClassesOverviewDialog";
import { UnlistedStudentsDialog } from "@/components/UnlistedStudentsDialog";
import { ProbationStudentsDialog } from "@/components/ProbationStudentsDialog";
import { Eye, EyeOff } from "lucide-react";

interface DashboardStats {
  studentsCount: number;
  teachersCount: number;
  averageAttendance: number;
  hidayahStudentsCount: number;
  totalRegisteredCount: number;
  notEnrolledCount: number;
  trialPeriodCount: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useRequireAuth();
  const [stats, setStats] = useState<DashboardStats>({
    studentsCount: 0,
    teachersCount: 0,
    averageAttendance: 0,
    hidayahStudentsCount: 0,
    totalRegisteredCount: 0,
    notEnrolledCount: 0,
    trialPeriodCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [showStudentAnalytics, setShowStudentAnalytics] = useState(false);
  const [showClassesOverview, setShowClassesOverview] = useState(false);
  const [showStatsCards, setShowStatsCards] = useState(true);
  const [unlistedDialogOpen, setUnlistedDialogOpen] = useState(false);
  const [probationDialogOpen, setProbationDialogOpen] = useState(false);
  const [pendingToolReissues, setPendingToolReissues] = useState(0);

  useEffect(() => {
    if (!authLoading && user) {
      fetchStats();
      fetchPendingToolReissues();
    }
  }, [authLoading, user]);

  const fetchPendingToolReissues = async () => {
    try {
      const { count } = await supabase
        .from("tool_reissues")
        .select("*", { count: "exact", head: true })
        .eq("status", "lost");

      setPendingToolReissues(count || 0);
    } catch (error) {
      console.error("Error fetching pending tool reissues:", error);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);

      const statsPromises = [
        // 1. إجمالي الطلاب
        supabase.from("students").select("*", { count: "exact", head: true }),

        // 2. عدد الطلاب المسجلين
        supabase.from("students").select("*", { count: "exact", head: true })
          .eq("mosque_name", "الخلفاء الراشدين").eq("registration_status", "مسجل"),

        // 4. عدد الطلاب المسجلين في كل المساجد
        supabase.from("students").select("*", { count: "exact", head: true })
          .eq("registration_status", "مسجل"),

        // 5. عدد الطلاب غير مدرج بعد
        supabase.from("students").select("*", { count: "exact", head: true })
          .eq("registration_status", "غير مدرج بعد"),

        // 6. عدد طلاب فترة التجربة
        supabase.from("students").select("*", { count: "exact", head: true })
          .eq("registration_status", "فترة تجربة"),

        // 7. نسبة الحضور (آخر 7 أيام)
        supabase.from("attendance").select("status")
          .gte("date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]),

        // 8. عدد الأساتذة (نحتاج فقط المعرّفات الفريدة للطلاب الذين لديهم أستاذ)
        supabase.from("students").select("teacher_id").not("teacher_id", "is", null)
      ];

      const results = await Promise.all(statsPromises);

      const studentsCount = results[0].count || 0;
      const hidayahStudentsCount = results[1].count || 0;
      const totalRegisteredCount = results[2].count || 0;
      const notEnrolledCount = results[3].count || 0;
      const trialPeriodCount = results[4].count || 0;

      // حساب نسبة الحضور
      const attendanceData = results[5].data || [];
      const presentCount = attendanceData.filter((a: any) => a.status === "حاضر").length || 0;
      const totalCount = attendanceData.length || 1;
      const averageAttendance = Math.round(presentCount / totalCount * 100);

      // حساب عدد الأساتذة
      const studentTeacherData = results[6].data || [];
      const teachersCount = new Set(studentTeacherData.map((s: any) => s.teacher_id)).size;

      setStats({
        studentsCount,
        teachersCount,
        averageAttendance,
        hidayahStudentsCount,
        totalRegisteredCount,
        notEnrolledCount,
        trialPeriodCount
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error("حدث خطأ في تحميل الإحصائيات");
    } finally {
      setLoading(false);
    }
  };

  if (loading || authLoading) {
    return <DashboardLayout title="لوحة تحكم الأدمن" userName={user?.name}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="stats-card">
            <Skeleton className="h-24" />
          </div>)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6, 7].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    </DashboardLayout>;
  }

  return <DashboardLayout title="لوحة تحكم الأدمن" userName={user?.name}>
    <div className="space-y-6 animate-fade-in">
      {/* مربع الحلقات في الأعلى */}
      <div onClick={() => setShowClassesOverview(true)} className="stats-card hover:border-teal-500 cursor-pointer bg-gradient-to-l from-teal-500/5 to-transparent">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-teal-500/10">
            <BookOpen className="w-6 h-6 text-teal-500" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">📚 الحلقات</h3>
            <p className="text-sm text-muted-foreground">عرض جميع الحلقات والأساتذة والطلاب</p>
          </div>
        </div>
      </div>

      {/* بحث سريع عن الطلاب */}
      <QuickStudentSearch />

      {/* Header with Buttons */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold">الإحصائيات</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowStatsCards(!showStatsCards)} className="gap-2">
            {showStatsCards ? <>
              <EyeOff className="w-4 h-4" />
              إخفاء البطاقات
            </> : <>
              <Eye className="w-4 h-4" />
              إظهار البطاقات
            </>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/activity-logs")} className="gap-2">
            <FileText className="w-4 h-4" />
            سجل التغييرات
          </Button>
        </div>
      </div>

      {showStatsCards && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
        {/* <StatsCard
          title="طلاب مسجلين (كل المساجد)"
          value={stats.totalRegisteredCount}
          icon={Users}
          variant="primary"
          onClick={() => navigate("/admin/students?status=مسجل")}
        /> */}
        <StatsCard title="عدد الأساتذة" value={stats.teachersCount} icon={GraduationCap} variant="gold" onClick={() => navigate("/admin/teachers")} />
        <StatsCard title="الطلاب المسجلين" value={stats.hidayahStudentsCount} icon={Building} variant="primary" />
        <StatsCard title="إجمالي الطلاب" value={stats.studentsCount} icon={Users} trend={{
          value: 12,
          isPositive: true
        }} variant="primary" onClick={() => navigate("/admin/students")} />
        <StatsCard
          title="طلاب غير مدرج بعد"
          value={stats.notEnrolledCount}
          icon={Users}
          variant="gold"
          onClick={() => setUnlistedDialogOpen(true)}
          className="hover:border-yellow-500 hover:shadow-md"
        />
        <StatsCard
          title="طلاب فترة التجربة"
          value={stats.trialPeriodCount}
          icon={GraduationCap}
          variant="primary"
          onClick={() => setProbationDialogOpen(true)}
          className="hover:border-primary hover:shadow-md cursor-pointer"
        />
      </div>}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div onClick={() => navigate("/admin/students")} className="stats-card hover:border-primary cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">إدارة الطلاب</h3>
              <p className="text-sm text-muted-foreground">عرض وإدارة الطلاب</p>
            </div>
          </div>
        </div>

        <div onClick={() => navigate("/admin/teachers")} className="stats-card hover:border-secondary cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-secondary/10">
              <GraduationCap className="w-6 h-6 text-secondary-dark" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">إدارة الأساتذة</h3>
              <p className="text-sm text-muted-foreground">عرض وإدارة الأساتذة</p>
            </div>
          </div>
        </div>

        <div onClick={() => navigate("/admin/reports-analytics")} className="stats-card hover:border-blue-500 cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">سجلات وإحصائيات وتقارير</h3>
              <p className="text-sm text-muted-foreground">بحث متقدم، رسوم بيانية، وتقارير تفصيلية</p>
            </div>
          </div>
        </div>

        <div onClick={() => navigate("/admin/quick-attendance")} className="stats-card hover:border-orange-500 cursor-pointer bg-gradient-to-br from-orange-500/5 to-transparent">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-orange-500/10">
              <CheckCircle className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">🏃 التفقد السريع لكل الطلاب</h3>
              <p className="text-sm text-muted-foreground">البحث عن أي طالب وتسجيل حضوره فوراً</p>
            </div>
          </div>
        </div>

        <div onClick={() => navigate("/admin/teachers-monitoring")} className="stats-card hover:border-indigo-500 cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-indigo-500/10">
              <BarChart3 className="w-6 h-6 text-indigo-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">مراقبة حلقات الأساتذة</h3>
              <p className="text-sm text-muted-foreground">متابعة نشاط الأساتذة اليومي</p>
            </div>
          </div>
        </div>

        <div onClick={() => navigate("/admin/class-monitoring")} className="stats-card hover:border-green-500 cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-500/10">
              <Users className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">إدخال البيانات لحلقة معينة</h3>
              <p className="text-sm text-muted-foreground">إدخال البيانات لأي حلقة</p>
            </div>
          </div>
        </div>

        <div onClick={() => navigate("/admin/check-items")} className="stats-card hover:border-amber-500 cursor-pointer relative">
          {pendingToolReissues > 0 && (
            <div className="absolute -top-2 -left-2 bg-destructive text-destructive-foreground text-xs font-bold rounded-full min-w-6 h-6 flex items-center justify-center shadow-lg animate-pulse px-1">
              {pendingToolReissues}
            </div>
          )}
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10">
              <Package className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">إدارة أدوات الطلاب</h3>
              <p className="text-sm text-muted-foreground">تعريف عناصر التفقد والنقاط وتقارير الأدوات</p>
            </div>
          </div>
        </div>


        <div onClick={() => navigate("/admin/backup")} className="stats-card hover:border-emerald-500 cursor-pointer transition-all hover:shadow-lg">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <HardDrive className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">💾 النسخ الاحتياطي</h3>
              <p className="text-sm text-muted-foreground">تصدير واستيراد وإعادة تعيين البيانات</p>
            </div>
          </div>
        </div>

        <div onClick={() => navigate("/admin/notifications")} className="stats-card hover:border-violet-500 cursor-pointer transition-all hover:shadow-lg">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-violet-500/10">
              <Bell className="w-6 h-6 text-violet-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">🔔 إدارة الإشعارات</h3>
              <p className="text-sm text-muted-foreground">إرسال إشعارات وعرض الإحصائيات</p>
            </div>
          </div>
        </div>

        <div onClick={() => navigate("/admin/surveys")} className="stats-card hover:border-purple-500 cursor-pointer transition-all hover:shadow-lg">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-500/10">
              <FileText className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">📋 إدارة الاستبيانات</h3>
              <p className="text-sm text-muted-foreground">إنشاء استبيانات ديناميكية وتحليل النتائج</p>
            </div>
          </div>
        </div>
      </div >

    </div >

    {/* Dialogs */}
    < StudentAnalyticsDialog open={showStudentAnalytics} onOpenChange={setShowStudentAnalytics} />
    <ClassesOverviewDialog open={showClassesOverview} onOpenChange={setShowClassesOverview} />
    <UnlistedStudentsDialog open={unlistedDialogOpen} onOpenChange={setUnlistedDialogOpen} />
    <ProbationStudentsDialog open={probationDialogOpen} onOpenChange={setProbationDialogOpen} />
  </DashboardLayout >;
};

export default AdminDashboard;
